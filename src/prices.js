import { normalize, parseQuantity } from './data.js'

// Preus orientatius de supermercat (€). No són exactes: serveixen com a referència
// per estimar el cost d'una compra i es poden ajustar per aliment.
// unit: unitat natural de compra (kg, l o u).
// perUnit: preu aproximat per peça (per a fruita i verdura que es compten per unitats).
const PRICES = {
  // ---- Fruita ----
  poma: { price: 1.9, unit: 'kg', perUnit: 0.35 },
  platan: { price: 1.4, unit: 'kg', perUnit: 0.25 },
  taronja: { price: 1.5, unit: 'kg', perUnit: 0.25 },
  llimona: { price: 1.9, unit: 'kg', perUnit: 0.2 },
  mandarina: { price: 1.8, unit: 'kg', perUnit: 0.2 },
  clementina: { price: 1.9, unit: 'kg', perUnit: 0.2 },
  maduixa: { price: 2.6, unit: 'kg', perUnit: 0.15 },
  pera: { price: 2.0, unit: 'kg', perUnit: 0.35 },
  kiwi: { price: 2.7, unit: 'kg', perUnit: 0.4 },
  alvocat: { price: 3.3, unit: 'kg', perUnit: 0.9 },
  mango: { price: 3.5, unit: 'kg', perUnit: 1.5 },
  pinya: { price: 2.0, unit: 'kg', perUnit: 1.8 },
  melo: { price: 1.6, unit: 'kg', perUnit: 2.0 },
  raim: { price: 2.4, unit: 'kg', perUnit: 1.2 },
  sindria: { price: 0.9, unit: 'kg', perUnit: 3.0 },
  pressec: { price: 2.4, unit: 'kg', perUnit: 0.45 },
  nectarina: { price: 2.4, unit: 'kg', perUnit: 0.4 },
  albercoc: { price: 2.9, unit: 'kg', perUnit: 0.3 },
  pruna: { price: 2.3, unit: 'kg', perUnit: 0.2 },
  cirera: { price: 4.5, unit: 'kg', perUnit: 0.05 },
  codony: { price: 2.5, unit: 'kg' },
  figa: { price: 3.0, unit: 'kg', perUnit: 0.25 },
  magrana: { price: 2.8, unit: 'kg', perUnit: 0.8 },
  caqui: { price: 2.5, unit: 'kg', perUnit: 0.6 },
  papaia: { price: 3.5, unit: 'kg', perUnit: 1.5 },
  xirimoia: { price: 4.5, unit: 'kg', perUnit: 1.2 },
  pomelo: { price: 1.8, unit: 'kg', perUnit: 0.9 },
  nespra: { price: 2.5, unit: 'kg', perUnit: 0.2 },
  nabiu: { price: 6.0, unit: 'kg' },
  gerd: { price: 8.0, unit: 'kg' },
  mora: { price: 6.0, unit: 'kg' },
  // ---- Verdura ----
  patata: { price: 1.2, unit: 'kg', perUnit: 0.18 },
  'patata nova': { price: 1.6, unit: 'kg', perUnit: 0.25 },
  'ceba tendra': { price: 1.8, unit: 'kg', perUnit: 0.2 },
  ceba: { price: 1.3, unit: 'kg', perUnit: 0.25 },
  all: { price: 3.5, unit: 'kg', perUnit: 0.3 },
  tomaquet: { price: 2.2, unit: 'kg', perUnit: 0.35 },
  'tomaquet cherry': { price: 3.5, unit: 'kg', perUnit: 0.03 },
  enciam: { price: 1.1, unit: 'u' },
  escarola: { price: 1.6, unit: 'u' },
  rucula: { price: 2.0, unit: 'u' },
  canonges: { price: 2.0, unit: 'u' },
  espinacs: { price: 2.1, unit: 'kg', perUnit: 0.9 },
  pastanaga: { price: 1.3, unit: 'kg', perUnit: 0.15 },
  pebrot: { price: 2.4, unit: 'kg', perUnit: 0.5 },
  bitxo: { price: 3.5, unit: 'kg', perUnit: 0.1 },
  carabasso: { price: 1.8, unit: 'kg', perUnit: 0.8 },
  carabassa: { price: 1.2, unit: 'kg', perUnit: 2.0 },
  alberginia: { price: 2.2, unit: 'kg', perUnit: 0.6 },
  cogombre: { price: 1.6, unit: 'kg', perUnit: 0.55 },
  broquil: { price: 2.1, unit: 'kg', perUnit: 1.2 },
  coliflor: { price: 1.7, unit: 'kg', perUnit: 1.3 },
  col: { price: 1.3, unit: 'kg', perUnit: 1.0 },
  'col xinesa': { price: 1.5, unit: 'kg', perUnit: 1.5 },
  kale: { price: 3.5, unit: 'kg', perUnit: 2.0 },
  esparrecs: { price: 5.5, unit: 'kg', perUnit: 2.5 },
  carxofa: { price: 2.9, unit: 'kg', perUnit: 0.9 },
  porro: { price: 2.2, unit: 'kg', perUnit: 0.35 },
  api: { price: 2.0, unit: 'kg', perUnit: 1.2 },
  fonoll: { price: 2.5, unit: 'kg', perUnit: 0.8 },
  pesols: { price: 3.0, unit: 'kg' },
  mongetes: { price: 3.1, unit: 'kg' },
  moniato: { price: 1.6, unit: 'kg', perUnit: 0.4 },
  rave: { price: 2.0, unit: 'kg', perUnit: 0.1 },
  remolatxa: { price: 1.5, unit: 'kg', perUnit: 0.4 },
  bleda: { price: 2.0, unit: 'kg' },
  xampinyo: { price: 3.0, unit: 'kg', perUnit: 0.2 },
  bolet: { price: 8.0, unit: 'kg' },
  seta: { price: 8.0, unit: 'kg' },
  alfabrega: { price: 1.4, unit: 'u' },
  romani: { price: 1.2, unit: 'u' },
  julivert: { price: 0.9, unit: 'u' },
  gingebre: { price: 4.0, unit: 'kg' },
  // ---- Carn ----
  pollastre: { price: 3.2, unit: 'kg' },
  'pit de pollastre': { price: 5.5, unit: 'kg' },
  'cuixa de pollastre': { price: 3.5, unit: 'kg' },
  'ala de pollastre': { price: 3.0, unit: 'kg' },
  vedella: { price: 9.5, unit: 'kg' },
  'filet de vedella': { price: 14.0, unit: 'kg' },
  entrecot: { price: 13.0, unit: 'kg' },
  'llom de vedella': { price: 12.0, unit: 'kg' },
  porc: { price: 5.5, unit: 'kg' },
  llom: { price: 7.5, unit: 'kg' },
  cansalada: { price: 5.5, unit: 'kg' },
  botifarra: { price: 7.0, unit: 'kg' },
  pernil: { price: 9.0, unit: 'kg' },
  'pernil iberic': { price: 25.0, unit: 'kg' },
  xorico: { price: 9.0, unit: 'kg' },
  salami: { price: 10.0, unit: 'kg' },
  fuet: { price: 9.0, unit: 'kg' },
  'carn picada': { price: 7.5, unit: 'kg' },
  hamburguesa: { price: 8.0, unit: 'kg' },
  costella: { price: 6.5, unit: 'kg' },
  xai: { price: 14.0, unit: 'kg' },
  'gall dindi': { price: 5.5, unit: 'kg' },
  conill: { price: 6.5, unit: 'kg' },
  // ---- Peix ----
  salmo: { price: 12.0, unit: 'kg' },
  'salmo fumat': { price: 25.0, unit: 'kg' },
  tonyina: { price: 14.0, unit: 'kg' },
  bacalla: { price: 12.0, unit: 'kg' },
  gambes: { price: 15.0, unit: 'kg' },
  calamars: { price: 12.0, unit: 'kg' },
  musclos: { price: 3.5, unit: 'kg' },
  pop: { price: 16.0, unit: 'kg' },
  llobarro: { price: 14.0, unit: 'kg' },
  sardines: { price: 5.0, unit: 'kg' },
  seitons: { price: 12.0, unit: 'kg' },
  cloisses: { price: 10.0, unit: 'kg' },
  llenguado: { price: 16.0, unit: 'kg' },
  rap: { price: 15.0, unit: 'kg' },
  moll: { price: 9.0, unit: 'kg' },
  lluc: { price: 9.0, unit: 'kg' },
  pescada: { price: 10.0, unit: 'kg' },
  daurada: { price: 13.0, unit: 'kg' },
  sipia: { price: 10.0, unit: 'kg' },
  navalles: { price: 14.0, unit: 'kg' },
  tellines: { price: 12.0, unit: 'kg' },
  cavalla: { price: 6.0, unit: 'kg' },
  bonitol: { price: 11.0, unit: 'kg' },
  truita: { price: 8.0, unit: 'kg' },
  // ---- Làctics ----
  llet: { price: 0.85, unit: 'l' },
  iogurt: { price: 0.45, unit: 'u' },
  'iogurt grec': { price: 0.6, unit: 'u' },
  kefir: { price: 1.5, unit: 'u' },
  formatge: { price: 9.0, unit: 'kg' },
  'formatge ratllat': { price: 10.0, unit: 'kg' },
  parmesa: { price: 15.0, unit: 'kg' },
  emmental: { price: 12.0, unit: 'kg' },
  'formatge de cabra': { price: 12.0, unit: 'kg' },
  camembert: { price: 7.0, unit: 'u' },
  brie: { price: 6.0, unit: 'u' },
  roquefort: { price: 14.0, unit: 'kg' },
  'formatge en porcions': { price: 2.5, unit: 'u' },
  mantega: { price: 1.6, unit: 'u' },
  margarina: { price: 1.5, unit: 'u' },
  nata: { price: 1.3, unit: 'u' },
  mozzarella: { price: 1.5, unit: 'u' },
  ricotta: { price: 2.0, unit: 'u' },
  mato: { price: 1.8, unit: 'u' },
  flam: { price: 0.8, unit: 'u' },
  'crema catalana': { price: 1.0, unit: 'u' },
  'llet condensada': { price: 1.5, unit: 'u' },
  'llet en pols': { price: 6.0, unit: 'kg' },
  // ---- Ous ----
  ou: { price: 0.22, unit: 'u' },
  'ou ecologic': { price: 0.4, unit: 'u' },
  // ---- Pa i cereals ----
  pa: { price: 1.0, unit: 'u' },
  'pa de motlle': { price: 1.6, unit: 'u' },
  croissant: { price: 0.9, unit: 'u' },
  'tortilla de blat': { price: 2.0, unit: 'u' },
  arros: { price: 2.0, unit: 'kg' },
  'arros bomba': { price: 3.0, unit: 'kg' },
  'arros basmati': { price: 3.5, unit: 'kg' },
  pasta: { price: 1.8, unit: 'kg' },
  espagueti: { price: 1.8, unit: 'kg' },
  macarrons: { price: 1.8, unit: 'kg' },
  fideus: { price: 2.0, unit: 'kg' },
  cuscus: { price: 3.0, unit: 'kg' },
  quinoa: { price: 6.0, unit: 'kg' },
  bulgur: { price: 3.0, unit: 'kg' },
  farina: { price: 1.0, unit: 'kg' },
  'farina de blat de moro': { price: 2.0, unit: 'kg' },
  llevat: { price: 0.5, unit: 'u' },
  'flocs de civada': { price: 2.5, unit: 'kg' },
  muesli: { price: 3.5, unit: 'kg' },
  cereals: { price: 3.5, unit: 'kg' },
  galetes: { price: 2.2, unit: 'kg' },
  torrades: { price: 1.5, unit: 'kg' },
  semola: { price: 1.8, unit: 'kg' },
  // ---- Begudes ----
  aigua: { price: 0.4, unit: 'l' },
  suc: { price: 1.3, unit: 'l' },
  cervesa: { price: 0.9, unit: 'l' },
  vi: { price: 4.0, unit: 'l' },
  cava: { price: 6.0, unit: 'l' },
  cafe: { price: 12.0, unit: 'kg' },
  'cafe en capsula': { price: 0.4, unit: 'u' },
  te: { price: 6.0, unit: 'kg' },
  infusio: { price: 2.0, unit: 'u' },
  cola: { price: 0.9, unit: 'l' },
  gasosa: { price: 1.0, unit: 'l' },
  tonica: { price: 1.2, unit: 'l' },
  vermut: { price: 7.0, unit: 'l' },
  sidra: { price: 2.5, unit: 'l' },
  whisky: { price: 14.0, unit: 'l' },
  ron: { price: 12.0, unit: 'l' },
  ginebra: { price: 14.0, unit: 'l' },
  // ---- Congelats ----
  'verdura congelada': { price: 2.0, unit: 'kg' },
  'pesols congelats': { price: 2.2, unit: 'kg' },
  'espinacs congelats': { price: 2.0, unit: 'kg' },
  'peix congelat': { price: 8.0, unit: 'kg' },
  'gambes congelades': { price: 12.0, unit: 'kg' },
  'calamars congelats': { price: 9.0, unit: 'kg' },
  'patates fregides': { price: 2.5, unit: 'kg' },
  croquetes: { price: 6.0, unit: 'kg' },
  mandonguilles: { price: 7.0, unit: 'kg' },
  pizza: { price: 3.5, unit: 'u' },
  gelat: { price: 5.0, unit: 'l' },
  // ---- Conserves i llegums ----
  olives: { price: 2.2, unit: 'u' },
  'tomaquet triturat': { price: 1.0, unit: 'u' },
  'sardines en conserva': { price: 1.8, unit: 'u' },
  'esparrecs en conserva': { price: 2.5, unit: 'u' },
  'tonyina en conserva': { price: 2.0, unit: 'u' },
  llenties: { price: 1.2, unit: 'u' },
  cigrons: { price: 1.2, unit: 'u' },
  faves: { price: 2.5, unit: 'kg' },
  melmelada: { price: 2.5, unit: 'u' },
  'pebrots del piquillo': { price: 2.5, unit: 'u' },
  ametlla: { price: 9.0, unit: 'kg' },
  nou: { price: 10.0, unit: 'kg' },
  avellana: { price: 8.0, unit: 'kg' },
  cacauet: { price: 5.0, unit: 'kg' },
  pansa: { price: 4.0, unit: 'kg' },
  pinyo: { price: 30.0, unit: 'kg' },
  pistatxo: { price: 12.0, unit: 'kg' },
  anacard: { price: 12.0, unit: 'kg' },
  // ---- Altres ----
  oli: { price: 4.0, unit: 'l' },
  sal: { price: 0.8, unit: 'kg' },
  pebre: { price: 2.5, unit: 'u' },
  pimento: { price: 2.0, unit: 'u' },
  sucre: { price: 1.2, unit: 'kg' },
  mel: { price: 5.5, unit: 'u' },
  vinagre: { price: 1.5, unit: 'l' },
  maionesa: { price: 2.0, unit: 'u' },
  mostassa: { price: 1.5, unit: 'u' },
  ketchup: { price: 1.8, unit: 'u' },
  'salsa de soja': { price: 2.0, unit: 'u' },
  pesto: { price: 2.5, unit: 'u' },
  canyella: { price: 2.0, unit: 'u' },
  farigola: { price: 1.5, unit: 'u' },
  vainilla: { price: 2.0, unit: 'u' },
  'nou moscada': { price: 2.5, unit: 'u' },
  comi: { price: 2.5, unit: 'u' },
  curri: { price: 3.0, unit: 'u' },
  orenga: { price: 1.5, unit: 'u' },
  llorer: { price: 1.2, unit: 'u' },
  'herbes provencals': { price: 1.8, unit: 'u' },
  xocolata: { price: 3.0, unit: 'u' },
  'xocolata en pols': { price: 4.0, unit: 'kg' },
  cacau: { price: 5.0, unit: 'kg' },
  'brou de pollastre': { price: 1.5, unit: 'u' },
  'brou de verdures': { price: 1.5, unit: 'u' },
  gaspatxo: { price: 2.0, unit: 'l' },
  gelatina: { price: 1.0, unit: 'u' }
}

const ALIASES = {
  // plurals catalans
  ous: 'ou',
  patates: 'patata',
  cebes: 'ceba',
  tomaquets: 'tomaquet',
  tomàquets: 'tomaquet',
  pastanagues: 'pastanaga',
  pebrots: 'pebrot',
  alberginies: 'alberginia',
  carxofes: 'carxofa',
  pomes: 'poma',
  peres: 'pera',
  taronges: 'taronja',
  llimones: 'llimona',
  mandarines: 'mandarina',
  maduixes: 'maduixa',
  kiwis: 'kiwi',
  alvocats: 'alvocat',
  pressecs: 'pressec',
  carabassons: 'carabasso',
  cogombres: 'cogombre',
  moniatos: 'moniato',
  alfabregues: 'alfabrega',
  romanins: 'romani',
  juliverts: 'julivert',
  melons: 'melo',
  mangos: 'mango',
  pinya: 'pinya',
  prunes: 'pruna',
  cireres: 'cirera',
  nectarines: 'nectarina',
  albercocs: 'albercoc',
  figues: 'figa',
  magranes: 'magrana',
  caquis: 'caqui',
  papaies: 'papaia',
  xirimoies: 'xirimoia',
  clementines: 'clementina',
  pomelos: 'pomelo',
  nespres: 'nespra',
  nabius: 'nabiu',
  gerds: 'gerd',
  moras: 'mora',
  mores: 'mora',
  raves: 'rave',
  remolatxes: 'remolatxa',
  escaroles: 'escarola',
  rucules: 'rucula',
  xampinyons: 'xampinyo',
  bolets: 'bolet',
  setes: 'seta',
  bitxos: 'bitxo',
  fonolls: 'fonoll',
  bledes: 'bleda',
  xoricos: 'xorico',
  chorizo: 'xorico',
  chorizos: 'xorico',
  salamis: 'salami',
  fuets: 'fuet',
  costelles: 'costella',
  'gall dindis': 'gall dindi',
  conills: 'conill',
  llenguados: 'llenguado',
  raps: 'rap',
  mols: 'moll',
  lluços: 'lluc',
  daurades: 'daurada',
  sipies: 'sipia',
  cavalles: 'cavalla',
  bonitols: 'bonitol',
  truites: 'truita',
  formatges: 'formatge',
  infusions: 'infusio',
  coles: 'cola',
  gasoses: 'gasosa',
  toniques: 'tonica',
  sidres: 'sidra',
  melmelades: 'melmelada',
  ametlles: 'ametlla',
  nous: 'nou',
  avellanes: 'avellana',
  cacauets: 'cacauet',
  panses: 'pansa',
  pinyons: 'pinyo',
  pistatxos: 'pistatxo',
  anacards: 'anacard',
  xocolates: 'xocolata',
  // formes en castellà comunes
  espinaca: 'espinacs',
  tomate: 'tomaquet',
  tomates: 'tomaquet',
  cebolla: 'ceba',
  zanahoria: 'pastanaga',
  pimiento: 'pebrot',
  berenjena: 'alberginia',
  calabacin: 'carabasso',
  pepino: 'cogombre',
  lechuga: 'enciam',
  fresa: 'maduixa',
  fresas: 'maduixa',
  naranja: 'taronja',
  naranjas: 'taronja',
  platano: 'platan',
  platanos: 'platan',
  manzana: 'poma',
  manzanas: 'poma',
  limon: 'llimona',
  limones: 'llimona',
  sandia: 'sindria',
  melocoton: 'pressec',
  melocotones: 'pressec',
  uva: 'raim',
  melon: 'melo',
  aguacate: 'alvocat',
  aguacates: 'alvocat',
  pollo: 'pollastre',
  'carne picada': 'carn picada',
  jamon: 'pernil',
  jamones: 'pernil',
  queso: 'formatge',
  quesos: 'formatge',
  leche: 'llet',
  huevo: 'ou',
  huevos: 'ou',
  pan: 'pa',
  arroz: 'arros',
  harina: 'farina',
  azucar: 'sucre',
  aceite: 'oli',
  agua: 'aigua',
  vino: 'vi',
  merluza: 'lluc',
  pescada: 'pescada',
  bonito: 'bonitol',
  caballa: 'cavalla',
  dorada: 'daurada'
}

// Preus de reserva per categoria (€ per kg/l o per peça) per a aliments
// personalitzats que no tenen entrada pròpia al catàleg.
const CATEGORY_PRICE = {
  Fruita: { kg: 2.0, u: 0.4 },
  Verdura: { kg: 1.8, u: 0.5 },
  Carn: { kg: 8.0, u: 3.0 },
  Peix: { kg: 12.0, u: 4.0 },
  Làctics: { kg: 4.0, u: 1.0 },
  Ous: { kg: 3.0, u: 0.25 },
  'Pa i cereals': { kg: 2.5, u: 1.2 },
  Begudes: { l: 1.5, u: 1.2 },
  Congelats: { kg: 3.0, u: 2.0 },
  Conserves: { kg: 3.0, u: 1.5 },
  'Plats preparats': { kg: 8.0, u: 3.5 },
  Drogueria: { l: 2.0, u: 2.5 },
  Altres: { kg: 3.0, u: 1.5 }
}

function priceEntry(name) {
  const key = normalize(name)
  return PRICES[key] || PRICES[ALIASES[key]]
}

// Preu suggerit (€) per unitat de l'aliment segons la unitat de l'ítem.
export function suggestPrice(name, unit = 'u', category) {
  const entry = priceEntry(name)
  if (entry) {
    if (unit === 'g') return entry.unit === 'kg' ? entry.price / 1000 : entry.price
    if (unit === 'ml') return entry.unit === 'l' ? entry.price / 1000 : entry.price
    if (unit === 'u' && entry.perUnit != null) return entry.perUnit
    return entry.price
  }
  const fallback = CATEGORY_PRICE[category]
  if (!fallback) return null
  if (unit === 'g') return (fallback.kg ?? fallback.l) / 1000
  if (unit === 'ml') return (fallback.l ?? fallback.kg) / 1000
  if (unit === 'u') return fallback.u ?? fallback.kg
  return fallback.kg ?? fallback.l ?? fallback.u
}

// Preu efectiu (€ per unitat): el de l'usuari si l'ha posat, sinó el suggerit.
export function priceFor(item) {
  if (item && item.price != null && item.price > 0) return item.price
  return suggestPrice(item && item.name, (item && item.unit) || 'u', item && item.category)
}

function noteUnitQty(note) {
  const m = /^(\d+)(?:\s*\/\s*(\d+))?\s*(kg|g|l|ml)\b/i.exec((note || '').trim())
  if (!m) return null
  const num = parseInt(m[1], 10)
  const den = m[2] ? parseInt(m[2], 10) : 1
  if (!den) return null
  return { qty: num / den, unit: m[3].toLowerCase() }
}

// Quantitat que cal comprar (en la unitat de l'ítem o la indicada a la nota).
export function qtyToBuy(item) {
  if (item.toBuy != null) return item.toBuy
  const nu = noteUnitQty(item.shoppingNote)
  if (nu) return nu.qty
  return parseQuantity(item.shoppingNote)
}

// Unitat en què s'expressa la quantitat a comprar.
export function qtyUnit(item) {
  if (item.toBuy != null) return item.unit || 'u'
  const nu = noteUnitQty(item.shoppingNote)
  if (nu) return nu.unit
  return item.unit || 'u'
}

// Cost estimat d'un aliment de la compra. null = no té preu.
export function itemCost(item) {
  const qty = qtyToBuy(item)
  if (!qty) return 0
  const price = priceFor(item)
  if (price == null) return null
  return Math.round(qty * price * 100) / 100
}

export function fmtPrice(n) {
  const rounded = Math.round((n || 0) * 100) / 100
  return String(rounded).replace('.', ',')
}

export function fmtEuro(n) {
  return n.toFixed(2).replace('.', ',') + ' €'
}

export function shoppingTotals(shoppingList) {
  let total = 0
  let unpriced = 0
  for (const item of shoppingList) {
    const cost = itemCost(item)
    if (cost == null) unpriced++
    else total += cost
  }
  return { total: Math.round(total * 100) / 100, unpriced }
}
