import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, reauthenticateWithPopup, deleteUser } from 'firebase/auth'
import {
  getFirestore,
  doc,
  collection,
  query,
  where,
  getDoc,
  getDocs,
  onSnapshot,
  setDoc,
  updateDoc,
  writeBatch,
  arrayUnion,
  arrayRemove,
  serverTimestamp,
  enableMultiTabIndexedDbPersistence
} from 'firebase/firestore'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { useEffect, useState } from 'react'

const firebaseConfig = {
  apiKey: 'AIzaSyBsDayOBUg9n6HF10SL1Gyqip9ptV7731E',
  authDomain: 'casaestoc.firebaseapp.com',
  projectId: 'casaestoc',
  storageBucket: 'casaestoc.firebasestorage.app',
  messagingSenderId: '164255768041',
  appId: '1:164255768041:web:1233e825ff300687dd7f78'
}

const app = initializeApp(firebaseConfig)
const auth = getAuth(app)
const db = getFirestore(app)
const functions = getFunctions(app)
const googleProvider = new GoogleAuthProvider()

enableMultiTabIndexedDbPersistence(db).catch((err) => {
  if (err.code !== 'already-exists') console.warn('persistence', err.code)
})

const LAST_REBOST_KEY = (uid) => `lastRebost:${uid}`

export function loginWithGoogle() {
  return signInWithPopup(auth, googleProvider)
}

export function logout() {
  return signOut(auth)
}

export function getLastRebost(uid) {
  return localStorage.getItem(LAST_REBOST_KEY(uid)) || null
}

export function setLastRebost(uid, id) {
  if (id == null) localStorage.removeItem(LAST_REBOST_KEY(uid))
  else localStorage.setItem(LAST_REBOST_KEY(uid), id)
}

export function useAuth() {
  const [state, setState] = useState({ ready: false, user: null })

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => setState({ ready: true, user }))
    return unsub
  }, [])

  return state
}

export function useRebosts(uid) {
  const [state, setState] = useState({ ready: !uid, rebosts: [] })

  useEffect(() => {
    if (!uid) {
      setState({ ready: true, rebosts: [] })
      return
    }
    setState({ ready: false, rebosts: [] })
    const q = query(collection(db, 'rebosts'), where('members', 'array-contains', uid))
    const unsub = onSnapshot(
      q,
      (snap) => {
        setState({ ready: true, rebosts: snap.docs.map((d) => ({ id: d.id, ...d.data() })) })
      },
      (err) => {
        console.error('rebosts', err)
        setState({ ready: true, rebosts: [] })
      }
    )
    return unsub
  }, [uid])

  return state
}

export function useRebostData(id) {
  const [state, setState] = useState({ ready: !id, data: null })

  useEffect(() => {
    if (!id) {
      setState({ ready: true, data: null })
      return
    }
    setState({ ready: false, data: null })
    const ref = doc(db, 'rebosts', id)
    const unsub = onSnapshot(
      ref,
      (snap) => {
        setState({ ready: true, data: snap.exists() ? snap.data() : null })
      },
      (err) => {
        console.error('rebost', err)
        setState({ ready: true, data: null })
      }
    )
    return unsub
  }, [id])

  return state
}

export function saveRebost(id, partial) {
  return setDoc(doc(db, 'rebosts', id), {
    ...partial,
    updatedAt: serverTimestamp()
  }, { merge: true })
}

export function renameRebost(id, name) {
  return updateDoc(doc(db, 'rebosts', id), {
    name,
    updatedAt: serverTimestamp()
  })
}

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const CODE_LENGTH = 6

function randomCode() {
  let out = ''
  for (let i = 0; i < CODE_LENGTH; i++) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]
  }
  return out
}

export async function createRebost(uid, name) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = randomCode()
    const ref = doc(collection(db, 'rebosts'))
    const batch = writeBatch(db)
    batch.set(ref, {
      owner: uid,
      members: [uid],
      code,
      name,
      items: [],
      recipes: [],
      mealPlan: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    })
    batch.set(doc(db, 'rebostCodes', code), { id: ref.id, name })
    try {
      await batch.commit()
      return { id: ref.id, code }
    } catch (err) {
      if (attempt >= 7) throw err
      // Possible code collision: the batch is atomic, so a new code is tried.
    }
  }
  throw new Error('No s\'ha pogut generar un codi únic. Torna-ho a provar.')
}

export async function joinRebost(code, uid) {
  const normalized = String(code || '').trim().toUpperCase().replace(/\s+/g, '')
  if (!normalized) return { error: 'invalid' }
  const snap = await getDoc(doc(db, 'rebostCodes', normalized))
  if (!snap.exists()) return { error: 'not-found' }
  const meta = snap.data()
  if (!meta || !meta.id) return { error: 'not-found' }
  try {
    await updateDoc(doc(db, 'rebosts', meta.id), { members: arrayUnion(uid) })
  } catch (err) {
    console.error('join', err)
    return { error: 'not-found' }
  }
  return { id: meta.id, name: meta.name || null }
}

export function deleteRebost(id, code) {
  const batch = writeBatch(db)
  batch.delete(doc(db, 'rebosts', id))
  if (code) batch.delete(doc(db, 'rebostCodes', code))
  return batch.commit()
}

// Elimina el compte de Google de l'app: esborra els rebosts on l'usuari és l'amo
// (i els seus codis) i el treu dels rebosts on només és membre.
export async function deleteAccount(uid) {
  const user = auth.currentUser
  if (!user) return

  // Google exigeix una sessió recent per esborrar el compte.
  await reauthenticateWithPopup(user, googleProvider)

  const owned = await getDocs(query(collection(db, 'rebosts'), where('owner', '==', uid)))
  const ownedIds = new Set()
  for (const snap of owned.docs) {
    const data = snap.data()
    const batch = writeBatch(db)
    batch.delete(doc(db, 'rebosts', snap.id))
    if (data.code) batch.delete(doc(db, 'rebostCodes', data.code))
    await batch.commit()
    ownedIds.add(snap.id)
  }

  const member = await getDocs(query(collection(db, 'rebosts'), where('members', 'array-contains', uid)))
  const batch = writeBatch(db)
  for (const snap of member.docs) {
    if (!ownedIds.has(snap.id)) batch.update(doc(db, 'rebosts', snap.id), { members: arrayRemove(uid) })
  }
  await batch.commit()

  await deleteUser(auth.currentUser || user)
  localStorage.removeItem(LAST_REBOST_KEY(uid))
}

export async function scanReceipt(base64Image) {
  const scan = httpsCallable(functions, 'scanReceipt')
  const result = await scan({ image: base64Image })
  return result.data
}

export async function identifyFood(base64Image) {
  const identify = httpsCallable(functions, 'identifyFood')
  const result = await identify({ image: base64Image })
  return result.data
}
