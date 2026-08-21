// Seed: esborra el document compartit de Firebase i hi escriu el catàleg d'aliments.
// Executa amb node:  node scripts/seed.mjs
import { randomUUID } from 'node:crypto'

const API_KEY = 'AIzaSyBsDayOBUg9n6HF10SL1Gyqip9ptV7731E'
const PROJECT = 'casaestoc'
const DOC = 'casa/shared'
const FIRESTORE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`

const PRODUCT_DAYS = {
  platan: 4, platano: 4, banana: 4,
  poma: 21, manzana: 21, apple: 21,
  pera: 7,
  taronja: 14, naranja: 14,
  mandarina: 10, clementina: 10,
  llimona: 14, limon: 14,
  llima: 14, lima: 14,
  pomelo: 14,
  raim: 7, uva: 7, grape: 7,
  maduixa: 3, fresa: 3, freson: 3, fresol: 3, strawberry: 3,
  melo: 7, melon: 7,
  sindria: 7, sandia: 7, watermelon: 7,
  pressec: 5, melocoton: 5, durazno: 5,
  nectarina: 5,
  albercoc: 4, albaricoque: 4,
  pruna: 7, ciruela: 7,
  cirera: 3, cereza: 3, cherry: 3,
  kiwi: 14,
  mango: 7,
  pinya: 7, pina: 7, ananas: 7, pineapple: 7,
  papaya: 5,
  magrana: 21, granada: 21, pomegranate: 21,
  figa: 3, higo: 3, fig: 3,
  nabius: 5, arandano: 5, blueberry: 5,
  coco: 30, coconut: 30,
  codony: 30, membrillo: 30,
  caqui: 7, kaki: 7, persimmon: 7,
  ponce: 7, poncil: 7,
  enciam: 5, lechuga: 5, lettuce: 5,
  tomaquet: 7, tomate: 7, tomato: 7,
  cogombre: 7, pepino: 7, cucumber: 7,
  carxofa: 5, alcachofa: 5, artichoke: 5,
  alberginia: 5, berenjena: 5, eggplant: 5,
  carabasso: 5, calabacin: 5, zucchini: 5,
  carabassa: 30, carbassa: 30, calabaza: 30, pumpkin: 30,
  patata: 30, papa: 30, patacas: 30, patates: 30, potato: 30,
  ceba: 30, cebolla: 30, onion: 30,
  all: 60, ajo: 60, garlic: 60,
  pastanaga: 21, zanahoria: 21, carrot: 21,
  pebrot: 7, pimiento: 7, pepper: 7, chile: 7,
  col: 21, cabbage: 21,
  brocoli: 7, broquil: 7, broccoli: 7,
  coliflor: 7, cauliflower: 7,
  espinacs: 3, espinaca: 3, spinach: 3,
  bleda: 3, acelga: 3, chard: 3,
  api: 14, apio: 14, celery: 14,
  porro: 14, puerro: 14, leek: 14,
  esparrecs: 4, esparrago: 4, asparagus: 4,
  xampinyo: 5, champinon: 5, bolet: 5, seta: 5, hongo: 5, mushroom: 5,
  pesols: 5, guisante: 5, pea: 5,
  mongeta: 5, judia: 5, ejote: 5, bean: 5,
  rave: 14, rabano: 14, radish: 14,
  remolatxa: 30, remolacha: 30, beet: 30, beetroot: 30,
  moniato: 30, boniato: 30, camote: 30, 'sweet potato': 30,
  julivert: 5, perejil: 5, parsley: 5,
  ceballot: 5, cebollino: 5, scallion: 5,
  escarola: 7, endive: 7,
  ruca: 5, rucula: 5, arugula: 5,
  alfabrega: 5, albahaca: 5, basil: 5,
  menta: 5, mint: 5,
  romani: 7, romero: 7, rosemary: 7,
  farigola: 7, tomillo: 7, thyme: 7,
  gingebre: 21, jengibre: 21, ginger: 21,
  ocra: 5, okra: 5
}
const DEFAULT_FRUITA_DAYS = 5
const DEFAULT_VERDURA_DAYS = 4

function normalize(value) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .trim()
}

function estimateDays(name, category) {
  const normalized = normalize(name)
  let best = null
  for (const keyword of Object.keys(PRODUCT_DAYS)) {
    if (normalized.includes(keyword) && (best === null || keyword.length > best.length)) {
      best = keyword
    }
  }
  if (best) return PRODUCT_DAYS[best]
  if (category === 'Fruita') return DEFAULT_FRUITA_DAYS
  if (category === 'Verdura') return DEFAULT_VERDURA_DAYS
  return null
}

function expiryFor(name, category) {
  if (category !== 'Fruita' && category !== 'Verdura') return null
  const days = estimateDays(name, category)
  if (days == null) return null
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + days)
  return d.getTime()
}

// [nom, categoria, quantitat]
const CATALOG = [
  // Fruita
  ['Plàtans', 'Fruita', 6],
  ['Pomes Golden', 'Fruita', 6],
  ['Pomes Granny Smith', 'Fruita', 4],
  ['Peres Conferència', 'Fruita', 4],
  ['Taronges', 'Fruita', 8],
  ['Mandarines', 'Fruita', 10],
  ['Llimones', 'Fruita', 4],
  ['Llimes', 'Fruita', 3],
  ['Pomelo', 'Fruita', 1],
  ['Raïm blanc', 'Fruita', 1],
  ['Raïm negre', 'Fruita', 1],
  ['Maduixes', 'Fruita', 1],
  ['Meló', 'Fruita', 1],
  ['Síndria', 'Fruita', 1],
  ['Préssecs', 'Fruita', 4],
  ['Nectarines', 'Fruita', 4],
  ['Albercocs', 'Fruita', 6],
  ['Prunes', 'Fruita', 6],
  ['Cireres', 'Fruita', 1],
  ['Kiwis', 'Fruita', 4],
  ['Mangos', 'Fruita', 2],
  ['Pinya', 'Fruita', 1],
  ['Papaia', 'Fruita', 1],
  ['Magranes', 'Fruita', 2],
  ['Figues', 'Fruita', 4],
  ['Nabius', 'Fruita', 1],
  ['Caquis', 'Fruita', 3],
  ['Codony', 'Fruita', 1],
  ['Coco', 'Fruita', 1],
  // Verdura
  ['Patates', 'Verdura', 1],
  ['Patates noves', 'Verdura', 1],
  ['Cebes', 'Verdura', 1],
  ['Alls', 'Verdura', 2],
  ['Pastanagues', 'Verdura', 1],
  ['Tomàquets madurs', 'Verdura', 1],
  ['Tomàquets cherry', 'Verdura', 1],
  ['Cogombres', 'Verdura', 2],
  ['Pebrots verds', 'Verdura', 3],
  ['Pebrots vermells', 'Verdura', 2],
  ['Pebrots d\'italiana', 'Verdura', 2],
  ['Enciam', 'Verdura', 2],
  ['Escarola', 'Verdura', 1],
  ['Ruca', 'Verdura', 1],
  ['Carbassons', 'Verdura', 3],
  ['Albergínies', 'Verdura', 2],
  ['Bròquil', 'Verdura', 1],
  ['Coliflor', 'Verdura', 1],
  ['Col llombarda', 'Verdura', 1],
  ['Cols de Brussel·les', 'Verdura', 1],
  ['Espinacs', 'Verdura', 1],
  ['Bledes', 'Verdura', 1],
  ['Api', 'Verdura', 1],
  ['Porros', 'Verdura', 3],
  ['Carxofes', 'Verdura', 4],
  ['Espàrrecs', 'Verdura', 1],
  ['Xampinyons', 'Verdura', 1],
  ['Pèsols frescos', 'Verdura', 1],
  ['Mongetes verdes', 'Verdura', 1],
  ['Raves', 'Verdura', 1],
  ['Remolatxes', 'Verdura', 3],
  ['Moniatos', 'Verdura', 2],
  ['Carbassa', 'Verdura', 1],
  ['Cigrons', 'Verdura', 1],
  ['Llenties', 'Verdura', 1],
  ['Mongetes seques', 'Verdura', 1],
  ['Julivert', 'Verdura', 1],
  ['Alfàbrega', 'Verdura', 1],
  ['Menta', 'Verdura', 1],
  ['Romaní fresc', 'Verdura', 1],
  ['Farigola fresca', 'Verdura', 1],
  ['Gingebre', 'Verdura', 1],
  // Carn
  ['Pit de pollastre', 'Carn', 1],
  ['Cuixes de pollastre', 'Carn', 1],
  ['Pollastre sencer', 'Carn', 1],
  ['Pollastre trossejat', 'Carn', 1],
  ['Pit de gall dindi', 'Carn', 1],
  ['Filet de vedella', 'Carn', 1],
  ['Carn picada de vedella', 'Carn', 1],
  ['Llom de porc', 'Carn', 1],
  ['Carn picada de porc', 'Carn', 1],
  ['Esquena de porc', 'Carn', 1],
  ['Cansalada', 'Carn', 1],
  ['Bacó a tires', 'Carn', 1],
  ['Pernil dolç', 'Carn', 1],
  ['Pernil serrà', 'Carn', 1],
  ['Botifarra', 'Carn', 1],
  ['Botifarra blanca', 'Carn', 1],
  ['Salsitxes', 'Carn', 1],
  ['Hamburgueses de vedella', 'Carn', 1],
  ['Espatlla de xai', 'Carn', 1],
  ['Magret d\'ànec', 'Carn', 1],
  // Peix
  ['Salmó', 'Peix', 1],
  ['Tonyina fresca', 'Peix', 1],
  ['Bacallà fresc', 'Peix', 1],
  ['Bacallà salat', 'Peix', 1],
  ['Llobarro', 'Peix', 1],
  ['Daurada', 'Peix', 2],
  ['Llenguado', 'Peix', 1],
  ['Rap', 'Peix', 1],
  ['Moll', 'Peix', 1],
  ['Pescada', 'Peix', 1],
  ['Gambes', 'Peix', 1],
  ['Sardines', 'Peix', 6],
  ['Seitons', 'Peix', 1],
  ['Musclos', 'Peix', 1],
  ['Cloïsses', 'Peix', 1],
  ['Calamars', 'Peix', 1],
  ['Pop', 'Peix', 1],
  // Làctics
  ['Llet sencera', 'Làctics', 2],
  ['Llet semidesnatada', 'Làctics', 1],
  ['Iogurt natural', 'Làctics', 12],
  ['Iogurt grec', 'Làctics', 4],
  ['Formatge parmesà', 'Làctics', 1],
  ['Formatge ratllat', 'Làctics', 1],
  ['Formatge emmental', 'Làctics', 1],
  ['Formatge de cabra', 'Làctics', 1],
  ['Formatge fresc', 'Làctics', 1],
  ['Mozzarella', 'Làctics', 2],
  ['Mató', 'Làctics', 1],
  ['Mantega', 'Làctics', 1],
  ['Nata líquida', 'Làctics', 1],
  ['Flam', 'Làctics', 4],
  // Ous
  ['Ous de gallina', 'Ous', 24],
  ['Ous de guatlla', 'Ous', 12],
  ['Clares d\'ou', 'Ous', 1],
  // Pa i cereals
  ['Pa de pagès', 'Pa i cereals', 2],
  ['Barra de pa', 'Pa i cereals', 3],
  ['Panets', 'Pa i cereals', 6],
  ['Pa de motlle', 'Pa i cereals', 1],
  ['Pa de sègol', 'Pa i cereals', 1],
  ['Torrades', 'Pa i cereals', 1],
  ['Ciabatta', 'Pa i cereals', 2],
  ['Bagels', 'Pa i cereals', 4],
  ['Flocs de civada', 'Pa i cereals', 1],
  ['Muesli', 'Pa i cereals', 1],
  ['Cereals integrals', 'Pa i cereals', 1],
  ['Farina de blat', 'Pa i cereals', 1],
  ['Farina de força', 'Pa i cereals', 1],
  ['Farina de blat de moro', 'Pa i cereals', 1],
  ['Arròs bomba', 'Pa i cereals', 1],
  ['Arròs basmati', 'Pa i cereals', 1],
  ['Espagueti', 'Pa i cereals', 3],
  ['Macarrons', 'Pa i cereals', 2],
  ['Penne', 'Pa i cereals', 2],
  ['Fideus', 'Pa i cereals', 1],
  ['Galetes Maria', 'Pa i cereals', 1],
  ['Cous-cous', 'Pa i cereals', 1],
  ['Sèmola', 'Pa i cereals', 1],
  // Begudes
  ['Aigua mineral', 'Begudes', 2],
  ['Aigua amb gas', 'Begudes', 1],
  ['Suc de taronja', 'Begudes', 1],
  ['Suc de poma', 'Begudes', 1],
  ['Llimonada', 'Begudes', 1],
  ['Beguda de cola', 'Begudes', 1],
  ['Taronjada', 'Begudes', 1],
  ['Gasosa', 'Begudes', 1],
  ['Cervesa', 'Begudes', 6],
  ['Vi negre', 'Begudes', 2],
  ['Vi blanc', 'Begudes', 1],
  ['Cava', 'Begudes', 1],
  ['Cafè en gra', 'Begudes', 1],
  ['Cafè soluble', 'Begudes', 1],
  ['Te', 'Begudes', 1],
  ['Infusions de camamilla', 'Begudes', 1],
  ['Cacau soluble', 'Begudes', 1],
  // Congelats
  ['Gelats', 'Congelats', 8],
  ['Pèsols congelats', 'Congelats', 1],
  ['Mongetes congelades', 'Congelats', 1],
  ['Espinacs congelats', 'Congelats', 1],
  ['Verdura congelada', 'Congelats', 1],
  ['Bolets congelats', 'Congelats', 1],
  ['Fruits vermells congelats', 'Congelats', 1],
  ['Patates fregides congelades', 'Congelats', 1],
  ['Pa congelat', 'Congelats', 1],
  ['Pizzes congelades', 'Congelats', 2],
  ['Croquetes', 'Congelats', 1],
  ['Empanadilles', 'Congelats', 12],
  ['Gambes congelades', 'Congelats', 1],
  ['Pop congelat', 'Congelats', 1],
  ['Bacallà congelat', 'Congelats', 1],
  ['Hamburgueses congelades', 'Congelats', 4],
  ['Xurros congelats', 'Congelats', 1],
  // Conserves
  ['Tonyina en oli', 'Conserves', 6],
  ['Tonyina natural', 'Conserves', 4],
  ['Sardines en conserva', 'Conserves', 4],
  ['Musclos en escabetx', 'Conserves', 2],
  ['Anxoves', 'Conserves', 1],
  ['Escabetx de peix', 'Conserves', 1],
  ['Tomàquet fregit', 'Conserves', 2],
  ['Tomàquet triturat', 'Conserves', 4],
  ['Salsa de tomàquet', 'Conserves', 1],
  ['Pèsols en conserva', 'Conserves', 2],
  ['Olives verdes', 'Conserves', 1],
  ['Olives negres', 'Conserves', 1],
  ['Tàperes', 'Conserves', 1],
  ['Cogombrets en vinagre', 'Conserves', 1],
  ['Paté', 'Conserves', 1],
  ['Confitura de maduixa', 'Conserves', 1],
  ['Confitura de préssec', 'Conserves', 1],
  ['Peres en almívar', 'Conserves', 1],
  ['Préssecs en almívar', 'Conserves', 1],
  // Altres
  ['Sal', 'Altres', 1],
  ['Sucre', 'Altres', 1],
  ['Sucre morè', 'Altres', 1],
  ['Oli d\'oliva verge extra', 'Altres', 1],
  ['Oli d\'oliva verge', 'Altres', 1],
  ['Oli de gira-sol', 'Altres', 1],
  ['Vinagre de vi', 'Altres', 1],
  ['Vinagre balsàmic', 'Altres', 1],
  ['Salsa de soja', 'Altres', 1],
  ['Mostassa', 'Altres', 1],
  ['Ketchup', 'Altres', 1],
  ['Maionesa', 'Altres', 1],
  ['Pebre negre', 'Altres', 1],
  ['Pimentó dolç', 'Altres', 1],
  ['Orenga', 'Altres', 1],
  ['Farigola seca', 'Altres', 1],
  ['Comí', 'Altres', 1],
  ['Nou moscada', 'Altres', 1],
  ['Canyella en pols', 'Altres', 1],
  ['Cacau en pols', 'Altres', 1],
  ['Xocolata negra', 'Altres', 2],
  ['Xocolata amb llet', 'Altres', 1],
  ['Crema de cacauet', 'Altres', 1],
  ['Crema de xocolata per untar', 'Altres', 1],
  ['Mel', 'Altres', 1],
  ['Cacauets', 'Altres', 1],
  ['Nous', 'Altres', 1],
  ['Ametlles', 'Altres', 1],
  ['Avellanes', 'Altres', 1],
  ['Pistatxos', 'Altres', 1],
  ['Pipes', 'Altres', 1],
  ['Passes de raïm', 'Altres', 1],
  ['Dàtils', 'Altres', 1],
  ['Bicarbonat', 'Altres', 1],
  ['Llevat químic', 'Altres', 1],
  ['Llevat fresc', 'Altres', 1],
  ['Brou de pollastre', 'Altres', 4],
  ['Pastilles de brou de verdures', 'Altres', 1]
]

const items = CATALOG.map(([name, category, quantity]) => ({
  id: randomUUID(),
  name,
  category,
  quantity,
  expiry: expiryFor(name, category),
  onShoppingList: false
}))

function toFields(it) {
  const fields = {
    id: { stringValue: it.id },
    name: { stringValue: it.name },
    category: { stringValue: it.category },
    quantity: { integerValue: String(it.quantity) },
    onShoppingList: { booleanValue: false },
    active: { booleanValue: false }
  }
  if (it.expiry != null) fields.expiry = { integerValue: String(it.expiry) }
  return fields
}

async function signIn() {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`,
    { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ returnSecureToken: true }) }
  )
  if (!res.ok) throw new Error(`Sign in failed: ${res.status} ${await res.text()}`)
  return (await res.json()).idToken
}

async function wipeAndSeed(token) {
  const headers = { Authorization: `Bearer ${token}`, 'content-type': 'application/json' }
  const del = await fetch(`${FIRESTORE}/casa/shared`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
  if (!del.ok && del.status !== 404) throw new Error(`Delete failed: ${del.status} ${await del.text()}`)

  const body = {
    fields: {
      items: { arrayValue: { values: items.map((it) => ({ mapValue: { fields: toFields(it) } })) } },
      updatedAt: { timestampValue: new Date().toISOString() }
    }
  }
  const post = await fetch(`${FIRESTORE}/casa?documentId=shared`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  })
  if (!post.ok) throw new Error(`Seed failed: ${post.status} ${await post.text()}`)
}

async function verify(token) {
  const res = await fetch(`${FIRESTORE}/casa/shared`, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) throw new Error(`Verify failed: ${res.status}`)
  const doc = await res.json()
  const values = doc?.fields?.items?.arrayValue?.values ?? []
  console.log(`Aliments al document: ${values.length}`)
  const names = values.map((v) => v.mapValue.fields.name.stringValue)
  console.log('Primers:', names.slice(0, 5).join(' | '))
  console.log('Últims:', names.slice(-5).join(' | '))
  const cats = {}
  for (const v of values) {
    const c = v.mapValue.fields.category.stringValue
    cats[c] = (cats[c] || 0) + 1
  }
  console.log('Per categoria:', JSON.stringify(cats, null, 2))
}

const token = await signIn()
await wipeAndSeed(token)
await verify(token)
console.log('Seed completat.')
