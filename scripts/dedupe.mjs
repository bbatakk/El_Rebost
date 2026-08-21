// Elimina aliments duplicats (singular/plural) de Firestore conservant el nom del catàleg.
// Dry-run: node scripts/dedupe.mjs
// Aplica:  node scripts/dedupe.mjs --apply
import fs from 'node:fs'
import path from 'node:path'

const API_KEY = 'AIzaSyBsDayOBUg9n6HF10SL1Gyqip9ptV7731E'
const PROJECT = 'casaestoc'
const FIRESTORE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`
const APPLY = process.argv.includes('--apply')

const foodsJs = fs.readFileSync(path.join(process.cwd(), 'src', 'foods.js'), 'utf8')
const CANONICAL = new Set([...foodsJs.matchAll(/name:\s*['"]([^'"]+)['"]/g)].map((m) => m[1]))

function normalize(value) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

function stemForms(word) {
  const forms = new Set([word])
  if (word.length <= 3) return forms
  if (word.endsWith('es')) {
    const s = word.slice(0, -2)
    forms.add(s)
    forms.add(s + 'a')
    forms.add(s + 'e')
  }
  if (word.endsWith('ns')) forms.add(word.slice(0, -2))
  if (word.endsWith('s')) forms.add(word.slice(0, -1))
  if (word.endsWith('a')) forms.add(word.slice(0, -1))
  return forms
}

function productKeys(name) {
  const words = normalize(name).split(/\s+/).filter(Boolean)
  const head = words[0]
  let candidates = [...stemForms(head)]
  if (words.length > 1) candidates = candidates.map((c) => c + ' ' + words.slice(1).join(' '))
  return candidates
}

async function signIn() {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`,
    { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ returnSecureToken: true }) }
  )
  if (!res.ok) throw new Error(`Sign in failed: ${res.status} ${await res.text()}`)
  return (await res.json()).idToken
}

async function getDoc(token) {
  const res = await fetch(`${FIRESTORE}/casa/shared`, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${await res.text()}`)
  return res.json()
}

async function patchItems(token, values) {
  const body = { fields: { items: { arrayValue: { values } } } }
  const res = await fetch(`${FIRESTORE}/casa/shared?updateMask.fieldPaths=items`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`Patch failed: ${res.status} ${await res.text()}`)
  return res.json()
}

const token = await signIn()
const doc = await getDoc(token)
const values = doc?.fields?.items?.arrayValue?.values ?? []
console.log(`Total aliments: ${values.length}`)

const rawByItem = values.map((v) => v.mapValue.fields)
const hasPositiveQty = (f) => {
  if (f.quantity && Number(f.quantity.integerValue || f.quantity.doubleValue || 0) > 0) return true
  if (f.lots && f.lots.arrayValue?.values) {
    return f.lots.arrayValue.values.some((lot) => {
      const q = lot.mapValue?.fields?.qty
      return q && Number(q.integerValue || q.doubleValue || 0) > 0
    })
  }
  return false
}

const stateOf = (f) => ({
  id: f.id.stringValue,
  name: f.name.stringValue,
  category: f.category.stringValue,
  isCanonical: CANONICAL.has(f.name.stringValue),
  hasState:
    (f.active && f.active.booleanValue === true) ||
    (f.onShoppingList && f.onShoppingList.booleanValue === true) ||
    hasPositiveQty(f) ||
    !!f.shoppingNote?.stringValue ||
    !!f.expiry?.stringValue ||
    f.toBuy !== undefined,
})

const byCategory = new Map()
for (const f of rawByItem) {
  const cat = f.category.stringValue
  if (!byCategory.has(cat)) byCategory.set(cat, [])
  byCategory.get(cat).push(f)
}

const toDelete = new Set()
const plans = []
const planSeen = new Set()
for (const [cat, list] of byCategory) {
  const seen = new Map()
  for (const f of list) {
    for (const key of productKeys(f.name.stringValue)) {
      if (!seen.has(key)) seen.set(key, [])
      seen.get(key).push(f)
    }
  }
  for (const group of seen.values()) {
    const unique = [...new Map(group.map((f) => [f.id.stringValue, f])).values()]
    if (unique.length < 2) continue
    const keeper = unique.find((f) => CANONICAL.has(f.name.stringValue)) || unique.find((f) => stateOf(f).hasState) || unique[0]
    const victims = unique.filter((f) => f.id.stringValue !== keeper.id.stringValue)
    if (!victims.length) continue
    const sig = [keeper.id.stringValue, ...victims.map((v) => v.id.stringValue)].sort().join('|')
    if (planSeen.has(sig)) continue
    planSeen.add(sig)
    plans.push({ cat, keeper: stateOf(keeper), victims: victims.map(stateOf) })
    for (const v of victims) toDelete.add(v.id.stringValue)
  }
}

if (!plans.length) {
  console.log('No hi ha duplicats per netejar.')
  process.exit(0)
}

for (const p of plans) {
  console.log(`\n[${p.cat}] conserva "${p.keeper.name}"`)
  for (const v of p.victims) {
    const why = v.hasState ? ' (TÉ ESTAT: es fusiona)' : ''
    console.log(`  esborra "${v.name}"${why}`)
  }
}

if (!APPLY) {
  console.log(`\nDry-run: ${plans.length} grups, ${toDelete.size} ítems per esborrar. Passa --apply per aplicar.`)
  process.exit(0)
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-')
fs.writeFileSync(path.join(process.cwd(), 'scripts', `backup-${stamp}.json`), JSON.stringify(doc, null, 2))
console.log(`Backup guardat a scripts/backup-${stamp}.json`)

const keptValues = []
for (const v of values) {
  const f = v.mapValue.fields
  if (toDelete.has(f.id.stringValue)) continue
  const plan = plans.find((p) => p.keeper.id === f.id.stringValue)
  if (!plan) {
    keptValues.push(v)
    continue
  }
  for (const victim of plan.victims) {
    if (!victim.hasState) continue
    const vf = rawByItem.find((x) => x.id.stringValue === victim.id)
    for (const key of ['shoppingNote', 'toBuy', 'unit', 'expiry']) {
      if (vf[key] !== undefined) f[key] = vf[key]
    }
    if (vf.active && vf.active.booleanValue === true) f.active = vf.active
    if (vf.onShoppingList && vf.onShoppingList.booleanValue === true) f.onShoppingList = vf.onShoppingList
    if (hasPositiveQty(vf)) {
      if (vf.quantity !== undefined) f.quantity = vf.quantity
      if (vf.lots !== undefined) f.lots = vf.lots
    }
  }
  keptValues.push({ mapValue: { fields: f } })
}

await patchItems(token, keptValues)
console.log(`\nFet! ${plans.length} grups netejats. Ara hi ha ${keptValues.length} aliments (abans ${values.length}).`)
