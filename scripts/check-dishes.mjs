// Comprovació multi-rebost: entra amb un compte temporal anònim, llegeix
// l'estoc del rebost indicat pel codi de 6 caràcters i calcula per a cada plat
// quants ingredients hi ha disponibles. En acabar, es treu dels membres i
// esborra el compte temporal (no deixa rastre).
//
// Executa:  node scripts/check-dishes.mjs <CODI>
// Exemple:  node scripts/check-dishes.mjs ABC123
import { DISHES, missingIngredients } from '../src/dishes.js'

const API_KEY = 'AIzaSyBsDayOBUg9n6HF10SL1Gyqip9ptV7731E'
const PROJECT = 'casaestoc'
const FIRESTORE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`

const code = (process.argv[2] || '').trim().toUpperCase().replace(/\s+/g, '')
if (!code || code.length !== 6) {
  console.error('Ús: node scripts/check-dishes.mjs <CODI>  (el codi de 6 caràcters del rebost)')
  process.exit(1)
}

async function api(path, options = {}) {
  const res = await fetch(`${FIRESTORE}/${path}`, options)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(`${res.status} ${body?.error?.message || res.statusText}`)
  }
  return res.json()
}

function num(field) {
  if (!field) return null
  if (field.integerValue != null) return Number(field.integerValue)
  if (field.doubleValue != null) return Number(field.doubleValue)
  return null
}

// Converteix un document REST de rebost en { id, name, items }
function parseRebost(id, doc) {
  const f = doc?.fields ?? {}
  const values = f.items?.arrayValue?.values ?? []
  const items = values.map((v) => {
    const it = v.mapValue.fields
    let quantity = num(it.quantity)
    if (quantity == null && it.lots?.arrayValue?.values) {
      quantity = it.lots.arrayValue.values.reduce(
        (sum, lot) => sum + (num(lot.mapValue.fields.qty) || 0), 0)
    }
    return {
      id: it.id?.stringValue,
      name: it.name?.stringValue,
      quantity: quantity ?? 0,
      expiry: num(it.expiry)
    }
  })
  return { id, name: f.name?.stringValue || id, items }
}

async function main() {
  // 1. Compte anònim temporal
  const signUpRes = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`,
    { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ returnSecureToken: true }) }
  )
  if (!signUpRes.ok) throw new Error(`No s'ha pogut crear el compte temporal (${signUpRes.status})`)
  const { idToken, localId: uid } = await signUpRes.json()
  const auth = { Authorization: `Bearer ${idToken}` }

  try {
    // 2. Codi -> id del rebost
    let meta
    try {
      meta = await api(`rebostCodes/${code}`, { headers: auth })
    } catch (err) {
      throw new Error(`El codi "${code}" no correspon a cap rebost.`)
    }
    const rebostId = meta?.fields?.id?.stringValue
    if (!rebostId) throw new Error('El codi no té cap rebost associat.')

    // 3. Unir-se com a membre (transformació atòmica: no cal conèixer la llista actual)
    await api(':commit', {
      method: 'POST',
      headers: { ...auth, 'content-type': 'application/json' },
      body: JSON.stringify({
        writes: [{
          transform: {
            document: `projects/${PROJECT}/databases/(default)/documents/rebosts/${rebostId}`,
            fieldTransforms: [
              { fieldPath: 'members', appendMissingElements: { values: [{ stringValue: uid }] } }
            ]
          }
        }]
      })
    })

    // 4. Llegir el rebost
    const doc = await api(`rebosts/${rebostId}`, { headers: auth })
    const rebost = parseRebost(rebostId, doc)

    // 5. Informe
    console.log(`Rebost: ${rebost.name}`)
    console.log(`Aliments llegits: ${rebost.items.length}`)
    const totallyReady = []
    const nearReady = []
    for (const dish of DISHES) {
      const missing = missingIngredients(rebost.items, dish)
      if (missing.length === 0) totallyReady.push(dish.name)
      else if (missing.length <= 2) nearReady.push(`${dish.name} (falta: ${missing.map((m) => m.label).join(', ')})`)
    }
    console.log(`Plats totals: ${DISHES.length}`)
    console.log(`Plats amb TOTS els ingredients: ${totallyReady.length}`)
    if (totallyReady.length) console.log('   ' + totallyReady.join(' | '))
    console.log(`Plats amb 1-2 ingredients de pas: ${nearReady.length}`)
    for (const n of nearReady) console.log('   ' + n)

    // 6. Treure's dels membres (els membres poden modificar només el camp members)
    const members = (doc.fields?.members?.arrayValue?.values ?? [])
      .map((v) => v.stringValue)
      .filter((m) => m !== uid)
    await api(`rebosts/${rebostId}?updateMask.fieldPaths=members`, {
      method: 'PATCH',
      headers: { ...auth, 'content-type': 'application/json' },
      body: JSON.stringify({
        fields: { members: { arrayValue: { values: members.map((m) => ({ stringValue: m })) } } }
      })
    })
  } finally {
    // 7. Esborrar el compte temporal
    await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:delete?key=${API_KEY}`,
      { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ idToken }) }
    ).catch(() => {})
  }
}

main().catch((e) => { console.error('Error:', e.message); process.exit(1) })
