// Comprovació: llegeix els aliments del document compartit de Firebase
// i calcula per a cada plat quants ingredients hi ha disponibles.
// Executa: node scripts/check-dishes.mjs
import { DISHES, missingIngredients } from '../src/dishes.js'

const API_KEY = 'AIzaSyBsDayOBUg9n6HF10SL1Gyqip9ptV7731E'
const PROJECT = 'casaestoc'
const FIRESTORE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`

async function main() {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`,
    { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ returnSecureToken: true }) }
  )
  const { idToken } = await res.json()
  const doc = await fetch(`${FIRESTORE}/casa/shared`, { headers: { Authorization: `Bearer ${idToken}` } }).then((r) => r.json())
  const values = doc?.fields?.items?.arrayValue?.values ?? []
  const stock = values.map((v) => {
    const f = v.mapValue.fields
    return {
      id: f.id.stringValue,
      name: f.name.stringValue,
      quantity: Number(f.quantity.integerValue),
      expiry: f.expiry ? Number(f.expiry.integerValue) : null
    }
  })

  console.log(`Aliments llegits: ${stock.length}`)
  const totallyReady = []
  const nearReady = []
  for (const dish of DISHES) {
    const missing = missingIngredients(stock, dish)
    if (missing.length === 0) totallyReady.push(dish.name)
    else if (missing.length <= 2) nearReady.push(`${dish.name} (falta: ${missing.map((m) => m.label).join(', ')})`)
  }
  console.log(`Plats totals: ${DISHES.length}`)
  console.log(`Plats amb TOTS els ingredients: ${totallyReady.length}`)
  console.log('   ' + totallyReady.join(' | '))
  console.log(`Plats amb 1-2 ingredients de pas: ${nearReady.length}`)
  for (const n of nearReady) console.log('   ' + n)
}

main().catch((e) => { console.error(e); process.exit(1) })
