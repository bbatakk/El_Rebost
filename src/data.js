import { PRODUCT_DAYS } from './shelflife.js'

export const CATEGORIES = [
  'Fruita',
  'Verdura',
  'Carn',
  'Peix',
  'Làctics',
  'Ous',
  'Pa i cereals',
  'Begudes',
  'Congelats',
  'Conserves',
  'Plats preparats',
  'Drogueria',
  'Altres'
]

const CATEGORY_COLORS = {
  Fruita: '#FF7043',
  Verdura: '#66BB6A',
  Carn: '#EF5350',
  Peix: '#42A5F5',
  Làctics: '#FFA000',
  Ous: '#FBC02D',
  'Pa i cereals': '#A1887F',
  Begudes: '#26C6DA',
  Congelats: '#7E57C2',
  Conserves: '#78909C',
  'Plats preparats': '#EC407A',
  Drogueria: '#00897B',
  Altres: '#9E9E9E'
}

export function categoryColor(cat) {
  return CATEGORY_COLORS[cat] || '#9E9E9E'
}

export function normalize(value) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .trim()
}

export function categoryForName(name) {
  const words = normalize(name).split(/\s+/).filter(Boolean)
  const any = (...keys) => words.some((w) => keys.some((k) => w === k))
  if (any('brou', 'caldo')) return 'Altres'
  if (any('llet', 'iogurt', 'yogur', 'yogurt', 'kefir', 'mantega', 'mantequilla', 'margarina', 'formatge', 'queso', 'parmesa', 'parmesano', 'emmental', 'camembert', 'brie', 'roquefort', 'mozzarella', 'ricotta', 'mato', 'nata', 'flam', 'crema')) return 'Làctics'
  if (any('pernil', 'jamon', 'carn', 'carne', 'pollastre', 'pollo', 'vedella', 'vaca', 'xai', 'corder', 'cordero', 'porc', 'botifarra', 'salchicha', 'llom', 'lomo', 'gall', 'dindi', 'pavo', 'conill', 'conejo', 'costella', 'costelles', 'costillas', 'cansalada', 'bacon', 'bacó', 'xorico', 'chorizo', 'salami', 'fuet', 'hamburguesa', 'filet', 'filete', 'entrecot', 'pit', 'pechuga', 'cuixa', 'muslo', 'ala')) return 'Carn'
  if (any('peix', 'pescado', 'bacalla', 'bacalao', 'salmo', 'tonyina', 'atun', 'gamba', 'gambes', 'sardina', 'sardines', 'musclo', 'musclos', 'mejillon', 'calamar', 'calamars', 'rap', 'llobarro', 'daurada', 'dorada', 'llenguado', 'moll', 'pescada', 'lluc', 'merluza', 'seitons', 'seitones', 'anxoves', 'anxova', 'cloissa', 'cloisses', 'sipia', 'sepia', 'navalles', 'navajas', 'tellines', 'cavalla', 'caballa', 'bonitol', 'bonito', 'truita', 'trucha')) return 'Peix'
  if (any('ou', 'ous', 'huevo', 'huevos')) return 'Ous'
  if (any('pa', 'pan', 'flocs', 'civada', 'avena', 'cereals', 'cereal', 'muesli', 'farina', 'harina', 'arros', 'arroz', 'bomba', 'basmati', 'pasta', 'espagueti', 'fideus', 'fideu', 'fideo', 'galeta', 'galetes', 'galletas', 'torrades', 'tostadas', 'cous', 'cuscu', 'quinoa', 'bulgur', 'semola', 'croissant', 'brioix', 'brioche', 'tortilla', 'motlle', 'molde', 'maizena')) return 'Pa i cereals'
  if (any('aigua', 'agua', 'suc', 'jugo', 'cervesa', 'cerveza', 'vi', 'vino', 'cava', 'te', 'infusio', 'infusion', 'cafe', 'cola', 'tonica', 'vermut', 'sidra', 'whisky', 'ron', 'ginebra', 'gasosa', 'gaseosa')) return 'Begudes'
  if (any('poma', 'manzana', 'platan', 'platano', 'taronja', 'naranja', 'llimona', 'limon', 'pera', 'kiwi', 'mango', 'maduixa', 'fresa', 'sindria', 'sandia', 'raim', 'uva', 'pruna', 'ciruela', 'cirera', 'cereza', 'melocoton', 'pressec', 'alvocat', 'aguacate', 'pinya', 'pina', 'melo', 'melon', 'nectarina', 'albercoc', 'albaricoque', 'codony', 'membrillo', 'figa', 'higo', 'magrana', 'granada', 'caqui', 'papaia', 'papaya', 'xirimoia', 'chirimoya', 'clementina', 'pomelo', 'nespra', 'nispero', 'nabiu', 'arandano', 'gerd', 'frambuesa', 'mora')) return 'Fruita'
  if (any('patata', 'patates', 'papa', 'patacas', 'ceba', 'cebolla', 'enciam', 'lechuga', 'tomaquet', 'tomate', 'cogombre', 'pepino', 'pebrot', 'pimiento', 'all', 'ajo', 'carabasso', 'carbasso', 'calabacin', 'carbassa', 'calabaza', 'pastanaga', 'zanahoria', 'api', 'apio', 'brocoli', 'broquil', 'alberginia', 'berenjena', 'espinacs', 'espinaca', 'llenties', 'lenteja', 'cigrons', 'cigro', 'garbanzo', 'faves', 'fabes', 'col', 'cols', 'repollo', 'coliflor', 'coliflores', 'pesols', 'mongetes', 'escarola', 'rucula', 'canonges', 'kale', 'fonoll', 'hinojo', 'bleda', 'acelga', 'xampinyo', 'champinon', 'bolet', 'seta', 'hongo', 'bitxo', 'chile', 'rave', 'rabano', 'remolatxa', 'remolacha', 'gingebre', 'jengibre', 'moniato', 'porro', 'carxofa', 'alberginia', 'api')) return 'Verdura'
  if (any('congelat', 'congelada', 'congelats', 'congelades', 'gelat', 'croqueta', 'croquetes', 'mandonguilla', 'mandonguilles', 'pizza')) return 'Congelats'
  if (any('amanida', 'ensalada', 'canelo', 'canelons', 'lasanya', 'lasana', 'lasagna', 'pure', 'pures', 'guisat', 'estofat', 'estofado', 'sopa', 'gazpacho', 'salmorejo', 'hummus', 'quiche', 'empanada', 'preparat', 'preparada', 'preparats', 'preparades', 'cuinat', 'cuinada', 'cuinats', 'cuinades')) return 'Plats preparats'
  if (any('detergent', 'detergente', 'detersiu', 'lleixiu', 'lejia', 'sabo', 'jabon', 'suavitzant', 'suavizante', 'desinfectant', 'desinfectante', 'netejador', 'netejadora', 'neteja', 'netejavidres', 'esponja', 'esponjes', 'fregall', 'fregalls', 'baieta', 'baietes', 'fregona', 'mopa', 'escombra', 'granera', 'recollidor', 'brossa', 'bosses', 'borses', 'bolses', 'paper', 'rotllo', 'rollo', 'ambientador', 'esprai', 'spray', 'drap', 'draps', 'tovallola', 'tovalloles', 'xampu', 'champu', 'dentifric', 'raspall', 'bolquer', 'bolquers', 'compresa', 'compreses')) return 'Drogueria'
  return 'Altres'
}

const DEFAULT_FRUITA_DAYS = 5
const DEFAULT_VERDURA_DAYS = 4

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

export function estimatedExpiry(name, category) {
  if (!name || name.trim() === '') return null
  if (category !== 'Fruita' && category !== 'Verdura') return null
  const days = estimateDays(name, category)
  if (days == null) return null
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + days)
  return d.getTime()
}

export function formatExpiry(millis) {
  const d = new Date(millis)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${dd}/${mm}/${d.getFullYear()}`
}

export function toInputDate(millis) {
  const d = new Date(millis)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

export function todayInputDate() {
  return toInputDate(Date.now())
}

export const EXPIRY = {
  EXPIRED: 'expired',
  SOON: 'soon',
  OK: 'ok'
}

export function expiryStatus(millis, now = Date.now()) {
  if (!millis) return EXPIRY.OK
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  const target = new Date(millis)
  target.setHours(0, 0, 0, 0)
  const diffDays = Math.round((target - today) / 86400000)
  if (diffDays < 0) return EXPIRY.EXPIRED
  if (diffDays <= 3) return EXPIRY.SOON
  return EXPIRY.OK
}

export function isSubsequence(a, b) {
  let i = 0
  for (const ch of b) {
    if (i < a.length && a[i] === ch) i++
  }
  return i === a.length
}

export function formatScaledQty(qty) {
  const rounded = Math.round(qty * 100) / 100
  const whole = Math.floor(rounded)
  const frac = rounded - whole
  if (frac < 0.001) return String(whole)
  const fractions = [
    [0.25, '1/4'],
    [1 / 3, '1/3'],
    [0.5, '1/2'],
    [2 / 3, '2/3'],
    [0.75, '3/4']
  ]
  let best = fractions[0]
  for (const f of fractions) {
    if (Math.abs(f[0] - frac) < Math.abs(best[0] - frac)) best = f
  }
  return whole === 0 ? best[1] : `${whole} ${best[1]}`
}

export function scaleLine(line, factor) {
  const m = /^(\d+)(?:\s*\/\s*(\d+))?\s+(.*)$/.exec(line)
  if (!m) return line
  const num = parseInt(m[1], 10)
  const den = m[2] ? parseInt(m[2], 10) : 1
  const scaled = (num / den) * factor
  return `${formatScaledQty(scaled)} ${m[3]}`
}

export function parseQuantity(note) {
  if (!note || note.trim() === '') return 1
  const parts = note.split(' + ')
  let total = 0
  for (const part of parts) {
    const m = /(\d+)(?:\s*\/\s*(\d+))?/.exec(part)
    if (!m) continue
    const num = parseInt(m[1], 10)
    const den = m[2] ? parseInt(m[2], 10) : 1
    if (den === 0) continue
    total += num / den
  }
  return total <= 0 ? 1 : Math.ceil(total)
}

function parseQty(line) {
  const m = /^(\d+)(?:\s*\/\s*(\d+))?\s+(.*)$/.exec(line)
  if (!m) return null
  const num = parseInt(m[1], 10)
  const den = m[2] ? parseInt(m[2], 10) : 1
  const rest = m[3].trim()
  const words = normalize(rest).split(/\s+/).filter(Boolean)
  return { qty: num / den, restText: rest, words }
}

export function combineShoppingNote(existing, newLine) {
  if (existing == null) return newLine
  const a = parseQty(existing)
  const b = parseQty(newLine)
  if (!a && !b) return existing
  if (!a || !b) return `${existing} + ${newLine}`
  let rest
  if (isSubsequence(a.words, b.words)) rest = b.restText
  else if (isSubsequence(b.words, a.words)) rest = a.restText
  else rest = null
  if (rest != null) return `${formatScaledQty(a.qty + b.qty)} ${rest}`
  return `${existing} + ${newLine}`
}

export const UNITS = ['u', 'g', 'kg', 'ml', 'l']
export const UNIT_LABEL = { u: 'unitats', g: 'grams', kg: 'kg', ml: 'ml', l: 'l' }

export function formatQty(q) {
  const n = Math.round((q || 0) * 100) / 100
  if (Number.isInteger(n)) return String(n)
  return String(n)
}

export function totalQty(lots) {
  return (lots || []).reduce((sum, lot) => sum + (lot.qty || 0), 0)
}

export function minExpiry(lots) {
  const expiries = (lots || []).map((lot) => lot.expiry).filter(Boolean)
  return expiries.length ? Math.min(...expiries) : null
}

export function normalizeItem(item) {
  if (!item) return item
  if (Array.isArray(item.lots) && item.lots.length) {
    return { ...item, unit: item.unit || 'u', quantity: totalQty(item.lots), expiry: minExpiry(item.lots) }
  }
  return {
    ...item,
    unit: item.unit || 'u',
    lots: [{ qty: item.quantity || 0, expiry: item.expiry || null }],
    quantity: item.quantity || 0,
    expiry: item.expiry || null
  }
}

export function finalizeItem(fields) {
  const rawLots = Array.isArray(fields.lots) && fields.lots.length
    ? fields.lots
    : [{ qty: fields.quantity ?? 0, expiry: fields.expiry ?? null }]
  const lots = rawLots.map((lot) => ({
    qty: Math.max(0, Number(lot.qty) || 0),
    expiry: lot.expiry || null
  }))
  return {
    ...fields,
    unit: fields.unit || 'u',
    lots,
    quantity: totalQty(lots),
    expiry: minExpiry(lots)
  }
}

export function unitFromQuantity(text) {
  if (!text) return null
  const m = /([\d.,]+)\s*(kg|grams?|g|millilitres?|ml|litres?|l|unitats|u)?/i.exec(text.trim())
  if (!m || m[1] == null) return null
  const value = parseFloat(m[1].replace(',', '.'))
  if (isNaN(value)) return null
  const unit = (m[2] || 'u').toLowerCase()
  if (unit.startsWith('kg')) return { unit: 'kg', qty: value }
  if (unit === 'g' || unit.startsWith('gram')) return { unit: value >= 1000 ? 'kg' : 'g', qty: value >= 1000 ? value / 1000 : value }
  if (unit.startsWith('ml')) return { unit: value >= 1000 ? 'l' : 'ml', qty: value >= 1000 ? value / 1000 : value }
  if (unit === 'l' || unit.startsWith('litre')) return { unit: 'l', qty: value }
  return { unit: 'u', qty: Math.round(value) }
}
