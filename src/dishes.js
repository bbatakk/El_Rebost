import { normalize, parseQuantity, scaleLine } from './data.js'

export function sameProduct(a, b) {
  const normA = normalize(a)
  const normB = normalize(b)
  if (normA && normA === normB) return true
  const wordsA = normA.split(/\s+/).filter(Boolean)
  const wordsB = normB.split(/\s+/).filter(Boolean)
  return wordsA.some((wa) => wordsB.some((wb) => keyMatchesWord(wa, wb) || keyMatchesWord(wb, wa)))
}

function keyMatchesWord(word, key) {
  if (word === key) return true
  const base = word.endsWith('s') && word.length > 1 ? word.slice(0, -1) : word
  if (base === key) return true
  if (base.length === key.length && base.length > 1 && base.slice(0, -1) === key.slice(0, -1)) return true
  return false
}

export function matches(normalized, ingredient) {
  const words = normalized.split(/\s+/).filter(Boolean)
  return words.some((word) => ingredient.keys.some((key) => keyMatchesWord(word, key)))
}

export function have(stock, ingredient) {
  return stock.some((item) => item.quantity > 0 && matches(normalize(item.name), ingredient))
}

export function missingIngredients(stock, dish) {
  return dish.ingredients.filter((ing) => !have(stock, ing))
}

export function deriveKeys(label) {
  const words = normalize(label).split(/\s+/).filter(Boolean)
  const keys = []
  for (const word of words) {
    const base = word.endsWith('s') && word.length > 1 ? word.slice(0, -1) : word
    if (base && !keys.includes(base)) keys.push(base)
  }
  return keys.length ? keys : ['producte']
}

export function dishKey(dish) {
  return (dish.user ? 'u-' : 's-') + dish.name
}

const QUANTITY_UNIT_WORDS = ['g', 'grams', 'kg', 'ml', 'litres', 'l', 'unitats', 'pols', 'raig', 'pessic', 'vessadeta', 'llaura']

export function dishMatchesQuery(dish, query) {
  const q = normalize(query)
  if (!q) return true
  if (normalize(dish.name).includes(q)) return true
  return dish.ingredients.some((ing) =>
    normalize(ing.label).includes(q) || (ing.keys || []).some((k) => normalize(k).includes(q))
  )
}

export function ingredientCoverage(stock, ingredient) {
  const matching = stock.filter((it) => it.quantity > 0 && matches(normalize(it.name), ingredient))
  if (matching.length === 0) return null
  if (matching.some((it) => (it.unit || 'u') !== 'u')) return null
  const words = normalize(ingredient.line).split(/\s+/).filter(Boolean)
  if (words.some((w) => QUANTITY_UNIT_WORDS.includes(w))) return null
  const need = parseQuantity(ingredient.line)
  if (need <= 0) return null
  const haveCount = matching.reduce((sum, it) => sum + it.quantity, 0)
  return { have: haveCount, need, ratio: haveCount / need }
}

export function shoppingShortfall(stock, dish, factor = 1) {
  const lines = []
  for (const ing of dish.ingredients) {
    const cov = ingredientCoverage(stock, ing)
    if (cov) {
      if (cov.ratio < 1) {
        lines.push({ label: ing.label, line: scaleLine(ing.line, ((cov.need - cov.have) / cov.need) * factor) })
      }
      continue
    }
    const hasAny = stock.some((it) => it.quantity > 0 && matches(normalize(it.name), ing))
    if (!hasAny) {
      lines.push({ label: ing.label, line: scaleLine(ing.line, factor) })
    }
  }
  return lines
}

function parseNumber(s) {
  s = String(s).trim().replace(',', '.')
  const mixed = /^(\d+)\s+(\d+)\s*\/\s*(\d+)$/.exec(s)
  if (mixed) return parseInt(mixed[1], 10) + parseInt(mixed[2], 10) / parseInt(mixed[3], 10)
  const frac = /^(\d+)\s*\/\s*(\d+)$/.exec(s)
  if (frac) return parseInt(frac[1], 10) / parseInt(frac[2], 10)
  const dec = parseFloat(s)
  return Number.isNaN(dec) ? null : dec
}

const COOK_SMALL_UNIT = /^(pessic|pols|raig|mica|poc|tros|trossos|grapat|grapats|got|gots|gota|gotes|cullerada|cullerades|culleradeta|culleradetes|cullera|culleres|llenca|llenques|llesca|llesques|rodanxa|rodanxes|branca|branques|full|fulls|tall|talls)$/i

function parseCookLine(line) {
  const t = String(line || '').trim()
  const m = /^(\d+(?:[.,]\d+)?(?:\s+\d+\s*\/\s*\d+|\s*\/\s*\d+)?)\s*([a-zA-ZÀ-ÿ]+)?/.exec(t)
  if (!m) return null
  const qty = parseNumber(m[1])
  if (qty == null || qty <= 0) return null
  const word = (m[2] || '').toLowerCase()
  let unit = 'u'
  if (word) {
    if (/^kg$/.test(word)) unit = 'kg'
    else if (/^g$|^gram$|^grams$/.test(word)) unit = 'g'
    else if (/^l$|^litre$|^litres$/.test(word)) unit = 'l'
    else if (/^ml$|^mil$|^millilitre$|^millilitres$/.test(word)) unit = 'ml'
    else if (/^u$|^unitat$|^unitats$/.test(word)) unit = 'u'
    else if (COOK_SMALL_UNIT.test(word)) return null
  }
  return { qty, unit }
}

export function cookPlan(stock, dish) {
  const subtract = []
  const skip = []
  for (const ing of dish.ingredients) {
    const parsed = parseCookLine(ing.line)
    if (!parsed) { skip.push({ label: ing.label, line: ing.line, reason: 'no-quantity' }); continue }
    const item = stock.find((it) => it.quantity > 0 && matches(normalize(it.name), ing))
    if (!item) { skip.push({ label: ing.label, line: ing.line, reason: 'no-match' }); continue }
    const itemUnit = item.unit || 'u'
    let amount = null
    if (parsed.unit === 'u' && itemUnit === 'u') amount = parsed.qty
    else if (parsed.unit === 'g' && itemUnit === 'g') amount = parsed.qty
    else if (parsed.unit === 'g' && itemUnit === 'kg') amount = parsed.qty / 1000
    else if (parsed.unit === 'kg' && itemUnit === 'kg') amount = parsed.qty
    else if (parsed.unit === 'ml' && itemUnit === 'ml') amount = parsed.qty
    else if (parsed.unit === 'ml' && itemUnit === 'l') amount = parsed.qty / 1000
    else if (parsed.unit === 'l' && itemUnit === 'l') amount = parsed.qty
    if (amount == null) { skip.push({ label: ing.label, line: ing.line, reason: 'unit-mismatch' }); continue }
    subtract.push({
      label: ing.label,
      line: ing.line,
      amount,
      unit: itemUnit,
      itemId: item.id,
      itemName: item.name,
      available: item.quantity
    })
  }
  return { subtract, skip }
}

export function generateMealPlan(scored, count = 7) {
  const ranked = [...scored].sort((a, b) => {
    if ((a.expiring > 0) !== (b.expiring > 0)) return a.expiring > 0 ? -1 : 1
    if (a.missingCount !== b.missingCount) return a.missingCount - b.missingCount
    return dishKey(a.dish).localeCompare(dishKey(b.dish))
  })
  const days = []
  const usedNames = new Set()
  const usedMain = new Set()
  for (let d = 0; d < count; d++) {
    let pick = null
    for (let pass = 0; pass < 2 && !pick; pass++) {
      for (const s of ranked) {
        const key = dishKey(s.dish)
        if (usedNames.has(key)) continue
        const main = s.dish.ingredients[0] ? s.dish.ingredients[0].label : null
        if (pass === 0 && main && usedMain.has(main)) continue
        pick = { ...s, key }
        break
      }
    }
    if (!pick) break
    usedNames.add(pick.key)
    const main = pick.dish.ingredients[0] ? pick.dish.ingredients[0].label : null
    if (main) usedMain.add(main)
    days.push({ key: pick.key, name: pick.dish.name, user: !!pick.dish.user })
  }
  return days
}

export const DISHES = [
  {
    name: 'Truita de patata',
    description: 'La clàssica truita de patates, esponjosa per fora i sucosa per dins. Perfecta per dinar o sopar acompanyada d\'una amanida.',
    ingredients: [
      { label: 'Patata', line: '4 patates mitjanes', keys: ['patata', 'patacas', 'papa'] },
      { label: 'Ous', line: '4 ous', keys: ['ou', 'huevo', 'huevos'] },
      { label: 'Ceba', line: '1 ceba petita (opcional)', keys: ['ceba', 'cebolla'] },
      { label: 'Oli', line: 'Oli d\'oliva verge', keys: ['oli', 'oliva', 'aceite'] },
      { label: 'Sal', line: '1 pessic de sal', keys: ['sal'] }
    ],
    steps: [
      'Peleu i talleu les patates a làmines fines. Si feu servir ceba, talleu-la a juliana.',
      'Poseu oli abundant en una paella i fregiu les patates (i la ceba) a foc mitjà uns 15 minuts, fins que estiguin toves però no daurades.',
      'Bateu els ous amb un pessic de sal en un bol gran.',
      'Escorreu les patates de l\'oli i barregeu-les amb els ous. Deixeu-ho reposar 2 minuts.',
      'Aboqueu la barreja a la paella amb un rajolí d\'oli i cuineu a foc mitjà 4-5 minuts per cada banda.',
      'Deixeu reposar la truita 2 minuts abans de servir-la.'
    ]
  },
  {
    name: 'Amanida verda',
    description: 'Una amanida fresca i lleugera, perfecta com a acompanyament o com a sopar d\'estiu.',
    ingredients: [
      { label: 'Enciam', line: '1 enciam petit', keys: ['enciam', 'lechuga', 'lettuce'] },
      { label: 'Tomàquet', line: '2 tomàquets madurs', keys: ['tomaquet', 'tomate', 'tomato'] },
      { label: 'Ceba', line: '1/2 ceba tendra', keys: ['ceba', 'cebolla', 'onion'] },
      { label: 'Oli', line: 'Oli d\'oliva verge', keys: ['oli', 'oliva', 'aceite'] },
      { label: 'Vinagre', line: '1 cullerada de vinagre', keys: ['vinagre'] },
      { label: 'Sal', line: 'Sal al gust', keys: ['sal'] }
    ],
    steps: [
      'Renteu i talleu l\'enciam a tires fines.',
      'Talleu els tomàquets a rodanxes o grills.',
      'Talleu la ceba a rodanxes molt fines.',
      'Barregeu-ho tot en un bol i amaniu amb oli, vinagre i sal.'
    ]
  },
  {
    name: 'Gaspatxo',
    description: 'Sopa freda andalusa, refrescant i plena de vitamines. Ideal per als dies de calor.',
    ingredients: [
      { label: 'Tomàquet', line: '6 tomàquets madurs', keys: ['tomaquet', 'tomate'] },
      { label: 'Cogombre', line: '1/2 cogombre', keys: ['cogombre', 'pepino'] },
      { label: 'Pebrot', line: '1/2 pebrot verd', keys: ['pebrot', 'pimiento'] },
      { label: 'All', line: '1 gra d\'all', keys: ['all', 'ajo', 'garlic'] },
      { label: 'Oli', line: '4 cullerades d\'oli d\'oliva', keys: ['oli', 'oliva'] },
      { label: 'Vinagre', line: '1 cullerada de vinagre', keys: ['vinagre'] },
      { label: 'Sal', line: 'Sal al gust', keys: ['sal'] }
    ],
    steps: [
      'Renteu i trossegeu els tomàquets, el cogombre i el pebrot.',
      'Poseu-los a la batedora amb l\'all, l\'oli, el vinagre i la sal.',
      'Tritureu fins que quedi ben fi. Si cal, afegiu una mica d\'aigua freda.',
      'Deixeu-lo a la nevera com a mínim 2 hores abans de servir.'
    ]
  },
  {
    name: 'Crema de carbassó',
    description: 'Crema suau i reconfortant, perfecta per sopar, freda o calenta.',
    ingredients: [
      { label: 'Carbassó', line: '2 carbassons', keys: ['carabasso', 'carbasso', 'calabacin', 'zucchini'] },
      { label: 'Ceba', line: '1 ceba', keys: ['ceba', 'cebolla'] },
      { label: 'Patata', line: '1 patata petita', keys: ['patata', 'papa'] },
      { label: 'All', line: '1 gra d\'all', keys: ['all', 'ajo'] },
      { label: 'Oli', line: '2 cullerades d\'oli d\'oliva', keys: ['oli', 'oliva'] },
      { label: 'Sal', line: 'Sal i pebre', keys: ['sal'] }
    ],
    steps: [
      'Peleu i trossegeu la ceba, la patata i l\'all.',
      'Sofregiu-los amb oli en una olla uns 5 minuts.',
      'Afegiu el carbassó a trossos i una mica de sal.',
      'Cobriu amb aigua o brou i cuineu 15-20 minuts.',
      'Tritureu-ho tot i rectifiqueu de sal i pebre.'
    ]
  },
  {
    name: 'Sopa de verdures',
    description: 'Brou calent ple de verdura, lleuger i reconstituent.',
    ingredients: [
      { label: 'Pastanaga', line: '2 pastanagues', keys: ['pastanaga', 'pastanagues', 'zanahoria'] },
      { label: 'Ceba', line: '1 ceba', keys: ['ceba', 'cebolla'] },
      { label: 'Patata', line: '2 patates', keys: ['patata', 'papa'] },
      { label: 'Api', line: '2 branques d\'api', keys: ['api', 'apio'] },
      { label: 'Oli', line: 'Oli d\'oliva', keys: ['oli', 'oliva'] },
      { label: 'Sal', line: 'Sal al gust', keys: ['sal'] }
    ],
    steps: [
      'Peleu i trossegeu totes les verdures.',
      'Sofregiu la ceba amb oli uns 5 minuts.',
      'Afegiu la resta de verdures i cobriu amb aigua.',
      'Cuineu a foc mitjà uns 30 minuts.',
      'Rectifiqueu de sal i serviu ben calent.'
    ]
  },
  {
    name: 'Verdura al vapor',
    description: 'Verdura cuita al vapor, lleugera i amb tots els nutrients conservats.',
    ingredients: [
      { label: 'Pastanaga', line: '2 pastanagues', keys: ['pastanaga', 'pastanagues', 'zanahoria'] },
      { label: 'Carbassó', line: '1 carbassó', keys: ['carabasso', 'carbasso', 'zucchini'] },
      { label: 'Bròquil', line: '1/2 bròquil', keys: ['brocoli', 'broquil'] },
      { label: 'Sal', line: 'Sal al gust', keys: ['sal'] },
      { label: 'Oli', line: 'Un raig d\'oli d\'oliva', keys: ['oli', 'oliva'] }
    ],
    steps: [
      'Renteu i trossegeu la verdura en trossos regulars.',
      'Poseu-la a la vaporera uns 10 minuts, fins que sigui tendra.',
      'Amaniu amb sal i un raig d\'oli d\'oliva.'
    ]
  },
  {
    name: 'Verdura a la planxa',
    description: 'Verdura a la planxa, daurada i plena de sabor. Perfecta com a guarnició.',
    ingredients: [
      { label: 'Carbassó', line: '1 carbassó', keys: ['carabasso', 'carbasso'] },
      { label: 'Albergínia', line: '1 albergínia', keys: ['alberginia', 'berenjena'] },
      { label: 'Pebrot', line: '1 pebrot', keys: ['pebrot', 'pimiento'] },
      { label: 'Oli', line: 'Oli d\'oliva verge', keys: ['oli', 'oliva'] },
      { label: 'Sal', line: 'Sal i pebre', keys: ['sal'] }
    ],
    steps: [
      'Talleu les verdures a rodanxes d\'aproximadament un dit.',
      'Escalfeu una planxa untada amb oli.',
      'Feu les verdures 3-4 minuts per cada costat, fins que estiguin daurades.',
      'Amaniu amb sal, pebre i un rajolí d\'oli.'
    ]
  },
  {
    name: 'Torrades amb tomàquet',
    description: 'Esmorzar mediterrani clàssic: pa torrat amb tomàquet, all i oli.',
    ingredients: [
      { label: 'Pa', line: '2 llesques gruixudes de pa', keys: ['pa', 'pan'] },
      { label: 'Tomàquet', line: '2 tomàquets madurs', keys: ['tomaquet', 'tomate'] },
      { label: 'All', line: '1 gra d\'all', keys: ['all', 'ajo'] },
      { label: 'Oli', line: 'Oli d\'oliva verge', keys: ['oli', 'oliva'] },
      { label: 'Sal', line: 'Sal al gust', keys: ['sal'] }
    ],
    steps: [
      'Toreu les llesques de pa.',
      'Fregueu-hi el gra d\'all tallat per la meitat.',
      'Fregueu la meitat del tomàquet sobre el pa, fent pressió.',
      'Amaniu amb oli d\'oliva i una mica de sal.'
    ]
  },
  {
    name: 'Pa amb tomàquet',
    description: 'El pa amb tomàquet de tota la vida: senzill, ràpid i deliciós.',
    ingredients: [
      { label: 'Pa', line: '2 llesques de pa', keys: ['pa', 'pan'] },
      { label: 'Tomàquet', line: '2 tomàquets madurs', keys: ['tomaquet', 'tomate'] },
      { label: 'Oli', line: 'Oli d\'oliva verge', keys: ['oli', 'oliva'] },
      { label: 'Sal', line: 'Sal al gust', keys: ['sal'] }
    ],
    steps: [
      'Talleu els tomàquets per la meitat.',
      'Fregueu-los sobre el pa fent pressió perquè deixi anar el suc.',
      'Amaniu amb oli d\'oliva i una mica de sal.'
    ]
  },
  {
    name: 'Amanida de fruita',
    description: 'Fruita fresca tallada a daus, dolça i refrescant. Bonica i fàcil de fer.',
    ingredients: [
      { label: 'Poma', line: '1 poma', keys: ['poma', 'manzana'] },
      { label: 'Plàtan', line: '1 plàtan', keys: ['platan', 'platano'] },
      { label: 'Taronja', line: '1 taronja', keys: ['taronja', 'naranja'] },
      { label: 'Llimona', line: 'Unes gotes de suc de llimona', keys: ['llimona', 'limon'] },
      { label: 'Sucre', line: '1 cullerada de sucre (opcional)', keys: ['sucre', 'azucar'] }
    ],
    steps: [
      'Peleu i talleu tota la fruita a daus.',
      'Barregeu-la suaument en un bol.',
      'Afegiu-hi unes gotes de llimona perquè no s\'enfosqueixi.',
      'Si voleu, empolvoreu amb una mica de sucre.'
    ]
  },
  {
    name: 'Batut de plàtan',
    description: 'Batut cremós i energètic, perfecte per esmorzar o berenar.',
    ingredients: [
      { label: 'Plàtan', line: '1 plàtan', keys: ['platan', 'platano'] },
      { label: 'Llet', line: '250 ml de llet', keys: ['llet', 'leche', 'milk'] },
      { label: 'Mel', line: '1 cullerada de mel (opcional)', keys: ['mel', 'miel'] }
    ],
    steps: [
      'Peleu el plàtan i trossegeu-lo.',
      'Poseu-lo a la batedora amb la llet.',
      'Tritureu fins que quedi cremós i serviu de seguida.'
    ]
  },
  {
    name: 'Muesli amb fruita',
    description: 'Esmorzar complet amb flocs de civada, fruita i iogurt.',
    ingredients: [
      { label: 'Flocs de civada', line: '50 g de flocs de civada', keys: ['flocs', 'avena', 'cereal'] },
      { label: 'Poma', line: '1 poma', keys: ['poma', 'manzana'] },
      { label: 'Plàtan', line: '1 plàtan', keys: ['platan', 'platano'] },
      { label: 'Iogurt', line: '2 iogurts naturals', keys: ['iogurt', 'yogur', 'yogurt'] }
    ],
    steps: [
      'Talleu la poma i el plàtan a daus.',
      'Poseu els flocs de civada en un bol.',
      'Afegiu el iogurt i repartiu la fruita a sobre.'
    ]
  },
  {
    name: 'Llenties estofades',
    description: 'Guisat de llenties amb verdura, contundent i ple de sabor per als dies freds.',
    ingredients: [
      { label: 'Llenties', line: '250 g de llenties', keys: ['llenties', 'llentia', 'lentejas', 'lentils'] },
      { label: 'Pastanaga', line: '2 pastanagues', keys: ['pastanaga', 'pastanagues', 'zanahoria'] },
      { label: 'Ceba', line: '1 ceba', keys: ['ceba', 'cebolla'] },
      { label: 'All', line: '2 grans d\'all', keys: ['all', 'ajo'] },
      { label: 'Oli', line: 'Oli d\'oliva', keys: ['oli', 'oliva'] },
      { label: 'Sal', line: 'Sal al gust', keys: ['sal'] }
    ],
    steps: [
      'Sofregiu la ceba, l\'all i la pastanaga tallats amb oli.',
      'Afegiu les llenties i cobriu-les amb aigua.',
      'Cuineu a foc lent 35-40 minuts, fins que estiguin toves.',
      'Rectifiqueu de sal i deixeu reposar uns minuts.'
    ]
  },
  {
    name: 'Espinacs amb all',
    description: 'Espinacs saltats amb all, ràpids i plens de sabor. Perfectes com a acompanyament.',
    ingredients: [
      { label: 'Espinacs', line: '300 g d\'espinacs', keys: ['espinacs', 'espinaca', 'spinach'] },
      { label: 'All', line: '2 grans d\'all', keys: ['all', 'ajo'] },
      { label: 'Oli', line: 'Oli d\'oliva', keys: ['oli', 'oliva'] },
      { label: 'Sal', line: 'Sal al gust', keys: ['sal'] }
    ],
    steps: [
      'Renteu els espinacs i escorreu-los bé.',
      'Sofregiu els alls a rodanxes amb oli fins que daurin.',
      'Afegiu els espinacs i saltegeu 3-4 minuts.',
      'Salpebreu i serveu ben calent.'
    ]
  },
  {
    name: 'Puré de patata',
    description: 'Puré cremós i suau, l\'acompanyament clàssic per a qualsevol plat.',
    ingredients: [
      { label: 'Patata', line: '4 patates', keys: ['patata', 'papa'] },
      { label: 'Llet', line: '150 ml de llet', keys: ['llet', 'leche'] },
      { label: 'Mantega', line: '30 g de mantega (opcional)', keys: ['mantega', 'mantequilla'] },
      { label: 'Sal', line: 'Sal i nou moscada', keys: ['sal'] }
    ],
    steps: [
      'Peleu les patates, trossegeu-les i bulliu-les amb sal uns 20 minuts.',
      'Escorreu-les i aixafeu-les amb la batedora o un aixafapatates.',
      'Afegiu la llet calenta (i la mantega) i remeneu fins que quedi cremós.',
      'Rectifiqueu de sal i, si voleu, un pessic de nou moscada.'
    ]
  },
  {
    name: 'Ous ferrats amb pa',
    description: 'El sopar de socors perfecte: ou fregit amb pa i una mica de sal.',
    ingredients: [
      { label: 'Ous', line: '2 ous', keys: ['ou', 'huevo', 'huevos'] },
      { label: 'Pa', line: '2 llesques de pa', keys: ['pa', 'pan'] },
      { label: 'Oli', line: 'Oli d\'oliva verge', keys: ['oli', 'oliva'] },
      { label: 'Sal', line: 'Sal al gust', keys: ['sal'] }
    ],
    steps: [
      'Escalfeu oli abundant en una paella.',
      'Trenqueu l\'ou i deixeu-lo caure suaument dins l\'oli.',
      'Cuineu 2-3 minuts fins que la clara estigui cuita.',
      'Toreu el pa i serviu-ho tot amb una mica de sal.'
    ]
  },
  {
    name: 'Amanida catalana',
    description: 'Amanida contundent amb enciam, tomàquet, pernil i ou. Un clàssic dels dinars d\'estiu.',
    ingredients: [
      { label: 'Enciam', line: '1 enciam', keys: ['enciam', 'lechuga'] },
      { label: 'Tomàquet', line: '2 tomàquets', keys: ['tomaquet', 'tomate'] },
      { label: 'Pernil', line: '100 g de pernil dolç o salat', keys: ['pernil', 'jamon', 'ham'] },
      { label: 'Ous', line: '2 ous', keys: ['ou', 'huevo'] },
      { label: 'Oli', line: 'Oli d\'oliva verge', keys: ['oli', 'oliva'] },
      { label: 'Sal', line: 'Sal al gust', keys: ['sal'] }
    ],
    steps: [
      'Bulliu els ous 9 minuts, refredeu-los amb aigua freda i peleu-los.',
      'Renteu i trossegeu l\'enciam i els tomàquets.',
      'Barregeu-ho amb el pernil tallat a tires.',
      'Afegiu els ous tallats a quarts i amaniu amb oli i sal.'
    ]
  },
  {
    name: 'Fruita amb iogurt',
    description: 'Postre lleuger de fruita i iogurt, dolç i refrescant. Ideal per acabar un àpat.',
    ingredients: [
      { label: 'Poma', line: '1 poma', keys: ['poma', 'manzana'] },
      { label: 'Iogurt', line: '2 iogurts naturals', keys: ['iogurt', 'yogur', 'yogurt'] },
      { label: 'Mel', line: '1 cullerada de mel (opcional)', keys: ['mel', 'miel'] }
    ],
    steps: [
      'Talleu la poma a daus petits.',
      'Poseu el iogurt en un bol i repartiu la fruita a sobre.',
      'Si voleu, afegiu-hi una cullerada de mel.'
    ]
  },
  {
    name: 'Arròs a la cassola amb verdures',
    description: 'Arròs melós amb verdures de temporada, cuit a poc a poc a la cassola. Un plat de diumenge.',
    ingredients: [
      { label: 'Arròs', line: '250 g d\'arròs', keys: ['arros', 'arroz', 'rice'] },
      { label: 'Carbassó', line: '1 carbassó', keys: ['carabasso', 'carbasso', 'calabacin'] },
      { label: 'Pebrot', line: '1 pebrot vermell', keys: ['pebrot', 'pimiento'] },
      { label: 'Ceba', line: '1 ceba', keys: ['ceba', 'cebolla'] },
      { label: 'Tomàquet', line: '2 tomàquets ratllats', keys: ['tomaquet', 'tomate'] },
      { label: 'All', line: '2 grans d\'all', keys: ['all', 'ajo'] },
      { label: 'Oli', line: 'Oli d\'oliva verge', keys: ['oli', 'oliva'] },
      { label: 'Sal', line: 'Sal al gust', keys: ['sal'] }
    ],
    steps: [
      'Sofregiu la ceba, l\'all i el pebrot tallats amb oli uns 5 minuts.',
      'Afegiu el carbassó a daus i el tomàquet ratllat, i cuineu 5 minuts més.',
      'Afegiu l\'arròs, remeneu-ho bé i cobriu amb brou o aigua (el doble de volum).',
      'Cuineu a foc mitjà 18-20 minuts, remenant de tant en tant, fins que l\'arròs estigui melós.',
      'Rectifiqueu de sal i deixeu reposar 5 minuts abans de servir.'
    ]
  },
  {
    name: 'Paella de marisc',
    description: 'Paella valenciana amb marisc, fumet i safrà. El plat reina per a ocasions especials.',
    ingredients: [
      { label: 'Arròs', line: '300 g d\'arròs', keys: ['arros', 'arroz', 'rice'] },
      { label: 'Gambes', line: '250 g de gambes', keys: ['gamba', 'gambes', 'langostino'] },
      { label: 'Musclos', line: '300 g de musclos', keys: ['musclo', 'musclos', 'mejillon'] },
      { label: 'Calamars', line: '200 g de calamars', keys: ['calamar', 'calamares'] },
      { label: 'Tomàquet', line: '2 tomàquets ratllats', keys: ['tomaquet', 'tomate'] },
      { label: 'All', line: '2 grans d\'all', keys: ['all', 'ajo'] },
      { label: 'Oli', line: 'Oli d\'oliva verge', keys: ['oli', 'oliva'] },
      { label: 'Sal', line: 'Sal al gust', keys: ['sal'] }
    ],
    steps: [
      'Escalfeu oli a la paella i sofregiu els calamars tallats a anelles uns 3 minuts.',
      'Afegiu l\'all, el tomàquet ratllat i, després, l\'arròs. Remeneu-ho tot.',
      'Cobriu amb fumet o aigua calenta i cuineu 10 minuts.',
      'Afegiu les gambes i els musclos i cuineu 8-10 minuts més, fins que l\'arròs estigui a punt.',
      'Deixeu reposar la paella 5 minuts tapada i serviu.'
    ]
  },
  {
    name: 'Fideuà',
    description: 'La paella de marisc en versió fideus. Cruixents a sota i plens de sabor.',
    ingredients: [
      { label: 'Fideus', line: '300 g de fideus', keys: ['fideus', 'fideo', 'fideos'] },
      { label: 'Gambes', line: '200 g de gambes', keys: ['gamba', 'gambes', 'langostino'] },
      { label: 'Musclos', line: '300 g de musclos', keys: ['musclo', 'musclos', 'mejillon'] },
      { label: 'Calamars', line: '150 g de calamars', keys: ['calamar', 'calamares'] },
      { label: 'Tomàquet', line: '2 tomàquets ratllats', keys: ['tomaquet', 'tomate'] },
      { label: 'All', line: '2 grans d\'all', keys: ['all', 'ajo'] },
      { label: 'Oli', line: 'Oli d\'oliva verge', keys: ['oli', 'oliva'] },
      { label: 'Sal', line: 'Sal al gust', keys: ['sal'] }
    ],
    steps: [
      'Sofregiu els calamars amb oli en una paella ampla.',
      'Afegiu l\'all, el tomàquet i els fideus, i remeneu 2 minuts.',
      'Cobriu amb fumet calent i cuineu 10 minuts.',
      'Afegiu les gambes i els musclos i cuineu 5 minuts més.',
      'Deixeu reposar 3 minuts i serviu amb allioli si voleu.'
    ]
  },
  {
    name: 'Espagueti amb tomàquet',
    description: 'Pasta clàssica amb salsa de tomàquet fresc, all i alfàbrega. Ràpida i reconfortant.',
    ingredients: [
      { label: 'Espagueti', line: '300 g d\'espagueti', keys: ['espagueti', 'espaguetis', 'pasta'] },
      { label: 'Tomàquet', line: '4 tomàquets madurs', keys: ['tomaquet', 'tomate'] },
      { label: 'All', line: '2 grans d\'all', keys: ['all', 'ajo'] },
      { label: 'Alfàbrega', line: 'Unes fulles d\'alfàbrega', keys: ['alfabrega', 'albahaca', 'basil'] },
      { label: 'Oli', line: 'Oli d\'oliva verge', keys: ['oli', 'oliva'] },
      { label: 'Sal', line: 'Sal al gust', keys: ['sal'] }
    ],
    steps: [
      'Bulliu l\'espagueti amb aigua i sal segons les instruccions del paquet.',
      'Sofregiu l\'all a làmines amb oli fins que dauri.',
      'Afegiu els tomàquets ratllats i cuineu 10 minuts a foc mitjà.',
      'Barregeu la pasta amb la salsa i les fulles d\'alfàbrega, i serviu.'
    ]
  },
  {
    name: 'Espagueti amb tonyina',
    description: 'Pasta amb tonyina, tomàquet i all. Un clàssic ràpid per als dies de presses.',
    ingredients: [
      { label: 'Espagueti', line: '300 g d\'espagueti', keys: ['espagueti', 'espaguetis', 'pasta'] },
      { label: 'Tonyina', line: '1 llauna de tonyina', keys: ['tonyina', 'atun', 'tuna'] },
      { label: 'All', line: '2 grans d\'all', keys: ['all', 'ajo'] },
      { label: 'Tomàquet', line: '3 tomàquets madurs', keys: ['tomaquet', 'tomate'] },
      { label: 'Oli', line: 'Oli d\'oliva verge', keys: ['oli', 'oliva'] },
      { label: 'Sal', line: 'Sal al gust', keys: ['sal'] }
    ],
    steps: [
      'Bulliu l\'espagueti amb aigua i sal.',
      'Sofregiu l\'all i el tomàquet ratllat amb oli uns 8 minuts.',
      'Afegiu la tonyina esmicolada i cuineu 2 minuts més.',
      'Barregeu la pasta amb la salsa i serviu ben calent.'
    ]
  },
  {
    name: 'Macarrons amb formatge',
    description: 'Macarrons gratinats amb salsa de formatge, cremosos i per llepar-se els dits.',
    ingredients: [
      { label: 'Macarrons', line: '300 g de macarrons', keys: ['macarrons', 'macarrones', 'pasta'] },
      { label: 'Mantega', line: '30 g de mantega', keys: ['mantega', 'mantequilla'] },
      { label: 'Llet', line: '400 ml de llet', keys: ['llet', 'leche', 'milk'] },
      { label: 'Formatge', line: '150 g de formatge ratllat', keys: ['formatge', 'queso', 'cheese'] },
      { label: 'Sal', line: 'Sal al gust', keys: ['sal'] }
    ],
    steps: [
      'Bulliu els macarrons amb aigua i sal i escorreu-los.',
      'En un cassó, foneu la mantega i afegiu la llet a poc a poc remenant.',
      'Afegiu el formatge ratllat i remeneu fins que quedi una salsa cremosa.',
      'Barregeu la pasta amb la salsa, poseu-la en una safata i gratineu 5 minuts.'
    ]
  },
  {
    name: 'Amanida de pasta',
    description: 'Pasta freda amb tomàquet, cogombre, olives i tonyina. Perfecta per a l\'estiu.',
    ingredients: [
      { label: 'Pasta', line: '250 g de pasta curta', keys: ['pasta', 'macarrons', 'penne'] },
      { label: 'Tomàquet', line: '2 tomàquets', keys: ['tomaquet', 'tomate'] },
      { label: 'Cogombre', line: '1/2 cogombre', keys: ['cogombre', 'pepino'] },
      { label: 'Olives', line: '100 g d\'olives', keys: ['olives', 'aceituna'] },
      { label: 'Tonyina', line: '1 llauna de tonyina', keys: ['tonyina', 'atun'] },
      { label: 'Oli', line: 'Oli d\'oliva verge', keys: ['oli', 'oliva'] },
      { label: 'Vinagre', line: '1 cullerada de vinagre', keys: ['vinagre'] },
      { label: 'Sal', line: 'Sal al gust', keys: ['sal'] }
    ],
    steps: [
      'Bulliu la pasta, escorreu-la i deixeu-la refredar.',
      'Talleu el tomàquet i el cogombre a daus i les olives a rodanxes.',
      'Barregeu la pasta amb les verdures i la tonyina.',
      'Amaniu amb oli, vinagre i sal, i deixeu-la a la nevera 1 hora.'
    ]
  },
  {
    name: 'Amanida caprese',
    description: 'Tomàquet, mozzarella i alfàbrega amb oli d\'oliva. Una amanida italiana senzilla i elegant.',
    ingredients: [
      { label: 'Tomàquet', line: '3 tomàquets madurs', keys: ['tomaquet', 'tomate'] },
      { label: 'Mozzarella', line: '2 boles de mozzarella', keys: ['mozzarella', 'mozarela'] },
      { label: 'Alfàbrega', line: 'Unes fulles d\'alfàbrega', keys: ['alfabrega', 'albahaca'] },
      { label: 'Oli', line: 'Oli d\'oliva verge extra', keys: ['oli', 'oliva'] },
      { label: 'Sal', line: 'Sal al gust', keys: ['sal'] }
    ],
    steps: [
      'Talleu els tomàquets i la mozzarella a rodanxes.',
      'Disposeu-les alternant en un plat.',
      'Repartiu les fulles d\'alfàbrega a sobre i amaniu amb oli i sal.'
    ]
  },
  {
    name: 'Patates al forn',
    description: 'Patates rostides al forn amb oli, sal i romaní. Cruixents per fora i toves per dins.',
    ingredients: [
      { label: 'Patata', line: '1 kg de patates', keys: ['patata', 'patatas', 'papa'] },
      { label: 'Oli', line: 'Oli d\'oliva verge', keys: ['oli', 'oliva'] },
      { label: 'Sal', line: 'Sal al gust', keys: ['sal'] },
      { label: 'Romaní', line: 'Romaní fresc', keys: ['romani', 'romero', 'rosemary'] }
    ],
    steps: [
      'Peleu i talleu les patates a galls.',
      'Barregeu-les amb oli, sal i romaní.',
      'Enforneu-les a 200 °C uns 35-40 minuts, fins que estiguin daurades.',
      'Remeneu a mitja cocció perquè es daurin per tot arreu.'
    ]
  },
  {
    name: 'Patates fregides casolanes',
    description: 'Patates fregides cruixents i daurades, el clàssic que agrada a tothom.',
    ingredients: [
      { label: 'Patata', line: '4 patates', keys: ['patata', 'patatas', 'papa'] },
      { label: 'Oli', line: 'Oli de gira-sol', keys: ['oli', 'oliva'] },
      { label: 'Sal', line: 'Sal al gust', keys: ['sal'] }
    ],
    steps: [
      'Peleu i talleu les patates a bastonets.',
      'Eixugueu-les bé amb paper de cuina.',
      'Fregiu-les en oli abundant a foc mitjà 6-8 minuts.',
      'Pugeu el foc 1 minut perquè quedin cruixents, escorreu-les i saleu-les.'
    ]
  },
  {
    name: 'Puré de moniato',
    description: 'Puré dolç i cremós de moniato, perfecte per acompanyar carns i guisats.',
    ingredients: [
      { label: 'Moniato', line: '4 moniatos', keys: ['moniato', 'boniato', 'camote'] },
      { label: 'Llet', line: '150 ml de llet', keys: ['llet', 'leche'] },
      { label: 'Mantega', line: '30 g de mantega', keys: ['mantega', 'mantequilla'] },
      { label: 'Sal', line: 'Sal al gust', keys: ['sal'] }
    ],
    steps: [
      'Peleu els moniatos, trossegeu-los i bulliu-los amb sal uns 20 minuts.',
      'Escorreu-los i aixafeu-los.',
      'Afegiu la llet calenta i la mantega, i remeneu fins que quedi cremós.'
    ]
  },
  {
    name: 'Crema de carbassa',
    description: 'Crema dolça i reconfortant de carbassa, perfecta per sopar a l\'hivern.',
    ingredients: [
      { label: 'Carbassa', line: '500 g de carbassa', keys: ['carabassa', 'carbassa', 'calabaza'] },
      { label: 'Ceba', line: '1 ceba', keys: ['ceba', 'cebolla'] },
      { label: 'Patata', line: '1 patata', keys: ['patata', 'papa'] },
      { label: 'Llet', line: '100 ml de llet (opcional)', keys: ['llet', 'leche'] },
      { label: 'Oli', line: 'Oli d\'oliva verge', keys: ['oli', 'oliva'] },
      { label: 'Sal', line: 'Sal al gust', keys: ['sal'] }
    ],
    steps: [
      'Trossegeu la carbassa, la ceba i la patata.',
      'Sofregiu la ceba amb oli uns 5 minuts.',
      'Afegiu la resta de verdures, cobriu amb aigua i cuineu 20 minuts.',
      'Tritureu-ho, afegiu la llet si voleu i rectifiqueu de sal.'
    ]
  },
  {
    name: 'Crema de porros',
    description: 'Vichyssoise de porros, suau i delicada. Es pot servir freda o calenta.',
    ingredients: [
      { label: 'Porro', line: '3 porros', keys: ['porro', 'puerro', 'leek'] },
      { label: 'Patata', line: '2 patates', keys: ['patata', 'papa'] },
      { label: 'Ceba', line: '1 ceba', keys: ['ceba', 'cebolla'] },
      { label: 'Nata', line: '100 ml de nata líquida', keys: ['nata', 'crema de llet'] },
      { label: 'Oli', line: 'Oli d\'oliva verge', keys: ['oli', 'oliva'] },
      { label: 'Sal', line: 'Sal al gust', keys: ['sal'] }
    ],
    steps: [
      'Lleveu la part verda dels porros i talleu-los a rodanxes.',
      'Sofregiu-los amb la ceba i oli uns 5 minuts.',
      'Afegiu les patates a trossos i cobriu amb aigua.',
      'Cuineu 20 minuts, tritureu-ho i afegiu la nata i la sal.'
    ]
  },
  {
    name: 'Coliflor gratinada',
    description: 'Coliflor bullida amb salsa blanca i formatge gratinat. Suau i deliciosa.',
    ingredients: [
      { label: 'Coliflor', line: '1 coliflor', keys: ['coliflor', 'cauliflower'] },
      { label: 'Llet', line: '400 ml de llet', keys: ['llet', 'leche'] },
      { label: 'Mantega', line: '30 g de mantega', keys: ['mantega', 'mantequilla'] },
      { label: 'Formatge', line: '100 g de formatge ratllat', keys: ['formatge', 'queso'] },
      { label: 'Sal', line: 'Sal i nou moscada', keys: ['sal'] }
    ],
    steps: [
      'Trossegeu la coliflor en ramets i bulliu-la amb sal uns 10 minuts.',
      'Prepareu una salsa blanca amb la mantega, la llet i la farina.',
      'Poseu la coliflor en una safata, cobriu amb la salsa i el formatge.',
      'Gratineu al forn fins que la superfície estigui daurada.'
    ]
  },
  {
    name: 'Cols de Brussel·les saltades',
    description: 'Cols de Brussel·les saltades amb pernil i all. Un acompanyament ple de sabor.',
    ingredients: [
      { label: 'Col', line: '300 g de cols de Brussel·les', keys: ['col', 'repollo', 'cabbage'] },
      { label: 'Pernil', line: '100 g de pernil dolç a tires', keys: ['pernil', 'jamon'] },
      { label: 'All', line: '2 grans d\'all', keys: ['all', 'ajo'] },
      { label: 'Oli', line: 'Oli d\'oliva verge', keys: ['oli', 'oliva'] },
      { label: 'Sal', line: 'Sal al gust', keys: ['sal'] }
    ],
    steps: [
      'Netegeu les cols i talleu-les per la meitat.',
      'Bulliu-les 5 minuts i escorreu-les.',
      'Saltigueu-les amb all, pernil i oli 4-5 minuts.',
      'Salpebreu i serviu ben calent.'
    ]
  },
  {
    name: 'Carxofes a la planxa',
    description: 'Carxofes a la planxa amb all i llimona. Senzill, saludable i ple de sabor.',
    ingredients: [
      { label: 'Carxofa', line: '4 carxofes', keys: ['carxofa', 'carxofes', 'alcachofa'] },
      { label: 'All', line: '2 grans d\'all', keys: ['all', 'ajo'] },
      { label: 'Oli', line: 'Oli d\'oliva verge', keys: ['oli', 'oliva'] },
      { label: 'Sal', line: 'Sal al gust', keys: ['sal'] },
      { label: 'Llimona', line: '1 llimona', keys: ['llimona', 'limon'] }
    ],
    steps: [
      'Netegeu les carxofes, traieu les fulles dures i talleu-les per la meitat.',
      'Bulliu-les 10 minuts i escorreu-les.',
      'Feu-les a la planxa amb oli i all 3-4 minuts per banda.',
      'Amaniu amb sal i un raig de llimona.'
    ]
  },
  {
    name: 'Espàrrecs a la planxa',
    description: 'Espàrrecs verds a la planxa amb oli i sal. Ràpids i delicats.',
    ingredients: [
      { label: 'Espàrrecs', line: '1 manat d\'espàrrecs', keys: ['esparrecs', 'esparrago', 'asparagus'] },
      { label: 'Oli', line: 'Oli d\'oliva verge', keys: ['oli', 'oliva'] },
      { label: 'Sal', line: 'Sal al gust', keys: ['sal'] }
    ],
    steps: [
      'Trenqueu la part llenyosa dels espàrrecs.',
      'Feu-los a la planxa amb oli 5-6 minuts, girant-los.',
      'Salpebreu i serviu de seguida.'
    ]
  },
  {
    name: 'Pèsols amb pernil',
    description: 'Pèsols tendres saltats amb pernil dolç. Un platet de cullera clàssic.',
    ingredients: [
      { label: 'Pèsols', line: '400 g de pèsols', keys: ['pesols', 'guisante', 'pea'] },
      { label: 'Pernil', line: '100 g de pernil dolç', keys: ['pernil', 'jamon'] },
      { label: 'Ceba', line: '1 ceba petita', keys: ['ceba', 'cebolla'] },
      { label: 'Oli', line: 'Oli d\'oliva verge', keys: ['oli', 'oliva'] }
    ],
    steps: [
      'Sofregiu la ceba picada amb oli.',
      'Afegiu els pèsols i una mica d\'aigua, i cuineu 8 minuts.',
      'Afegiu el pernil a tires i saltegeu 2 minuts més.'
    ]
  },
  {
    name: 'Mongetes amb botifarra',
    description: 'Mongetes fresques guisades amb botifarra. Cuina de cullera de tota la vida.',
    ingredients: [
      { label: 'Mongetes', line: '400 g de mongetes verdes', keys: ['mongetes', 'mongeta', 'judia'] },
      { label: 'Botifarra', line: '2 botifarres', keys: ['botifarra', 'butifarra'] },
      { label: 'All', line: '2 grans d\'all', keys: ['all', 'ajo'] },
      { label: 'Oli', line: 'Oli d\'oliva verge', keys: ['oli', 'oliva'] },
      { label: 'Sal', line: 'Sal al gust', keys: ['sal'] }
    ],
    steps: [
      'Netegeu i talleu les mongetes.',
      'Bulliu-les amb aigua i sal uns 10 minuts i escorreu-les.',
      'Fregiu les botifarres amb oli i les mongetes amb els alls.',
      'Barregeu-ho tot i cuineu 5 minuts més.'
    ]
  },
  {
    name: 'Samfaina',
    description: 'Guisat de verdures mediterrani amb albergínia, carbassó i pebrot. Base perfecta per acompanyar.',
    ingredients: [
      { label: 'Albergínia', line: '1 albergínia', keys: ['alberginia', 'berenjena'] },
      { label: 'Carbassó', line: '1 carbassó', keys: ['carabasso', 'carbasso'] },
      { label: 'Pebrot', line: '1 pebrot vermell', keys: ['pebrot', 'pimiento'] },
      { label: 'Tomàquet', line: '3 tomàquets madurs', keys: ['tomaquet', 'tomate'] },
      { label: 'Ceba', line: '1 ceba', keys: ['ceba', 'cebolla'] },
      { label: 'All', line: '2 grans d\'all', keys: ['all', 'ajo'] },
      { label: 'Oli', line: 'Oli d\'oliva verge', keys: ['oli', 'oliva'] },
      { label: 'Sal', line: 'Sal al gust', keys: ['sal'] }
    ],
    steps: [
      'Talleu totes les verdures a daus petits.',
      'Sofregiu la ceba i l\'all amb oli uns 5 minuts.',
      'Afegiu la resta de verdures i cuineu a foc baix 25-30 minuts.',
      'Rectifiqueu de sal i deixeu reposar uns minuts.'
    ]
  },
  {
    name: 'Truita de ceba',
    description: 'La truita de patates amb ceba caramel·litzada, encara més saborosa.',
    ingredients: [
      { label: 'Ous', line: '4 ous', keys: ['ou', 'huevo', 'huevos'] },
      { label: 'Ceba', line: '2 cebes', keys: ['ceba', 'cebolla'] },
      { label: 'Oli', line: 'Oli d\'oliva verge', keys: ['oli', 'oliva'] },
      { label: 'Sal', line: 'Sal al gust', keys: ['sal'] }
    ],
    steps: [
      'Talleu les cebes a juliana i sofregiu-les amb oli a foc baix fins que caramel·litzin.',
      'Bateu els ous amb sal.',
      'Barregeu les cebes amb els ous.',
      'Cueu la truita a la paella 3-4 minuts per cada banda.'
    ]
  },
  {
    name: 'Truita francesa',
    description: 'La truita més senzilla que existeix: ous, oli i sal. A punt en 5 minuts.',
    ingredients: [
      { label: 'Ous', line: '2 ous', keys: ['ou', 'huevo', 'huevos'] },
      { label: 'Oli', line: 'Oli d\'oliva verge', keys: ['oli', 'oliva'] },
      { label: 'Sal', line: 'Sal al gust', keys: ['sal'] }
    ],
    steps: [
      'Bateu els ous amb un pessic de sal.',
      'Escalfeu una mica d\'oli en una paella petita.',
      'Aboqueu els ous i cuineu 1 minut per cada banda, plegant-la per la meitat.'
    ]
  },
  {
    name: 'Ous remenats amb formatge',
    description: 'Ous remenats cremosos amb formatge. Un esmorzar o sopar ràpid i deliciós.',
    ingredients: [
      { label: 'Ous', line: '3 ous', keys: ['ou', 'huevo', 'huevos'] },
      { label: 'Formatge', line: '50 g de formatge ratllat', keys: ['formatge', 'queso'] },
      { label: 'Llet', line: '1 cullerada de llet', keys: ['llet', 'leche'] },
      { label: 'Mantega', line: '1 cullerada de mantega', keys: ['mantega', 'mantequilla'] },
      { label: 'Sal', line: 'Sal al gust', keys: ['sal'] }
    ],
    steps: [
      'Bateu els ous amb la llet i la sal.',
      'Foneu la mantega en una paella a foc baix.',
      'Aboqueu els ous i remeneu sense parar fins que quallin a mitges.',
      'Afegiu el formatge i retireu del foc.'
    ]
  },
  {
    name: 'Ous farcits',
    description: 'Ous durs farcits de tonyina i maionesa. Un clàssic dels aperitius.',
    ingredients: [
      { label: 'Ous', line: '6 ous', keys: ['ou', 'huevo', 'huevos'] },
      { label: 'Maionesa', line: '3 cullerades de maionesa', keys: ['maionesa', 'mayonesa'] },
      { label: 'Tonyina', line: '1 llauna de tonyina', keys: ['tonyina', 'atun'] },
      { label: 'Sal', line: 'Sal al gust', keys: ['sal'] }
    ],
    steps: [
      'Bulliu els ous 9 minuts i refredeu-los.',
      'Peleu-los, talleu-los per la meitat i traieu el rovell.',
      'Barregeu els rovells amb la tonyina i la maionesa.',
      'Ompliu les clares amb la barreja i reserveu a la nevera.'
    ]
  },
  {
    name: 'Pollastre rostit',
    description: 'Pollastre sencer rostit al forn amb all, llimona i romaní. Sucós i aromàtic.',
    ingredients: [
      { label: 'Pollastre', line: '1 pollastre sencer', keys: ['pollastre', 'pollo'] },
      { label: 'All', line: '4 grans d\'all', keys: ['all', 'ajo'] },
      { label: 'Llimona', line: '1 llimona', keys: ['llimona', 'limon'] },
      { label: 'Oli', line: 'Oli d\'oliva verge', keys: ['oli', 'oliva'] },
      { label: 'Sal', line: 'Sal al gust', keys: ['sal'] },
      { label: 'Romaní', line: 'Romaní fresc', keys: ['romani', 'romero'] }
    ],
    steps: [
      'Preescalfeu el forn a 200 °C.',
      'Unteu el pollastre amb oli, sal i romaní, i feu-li uns talls.',
      'Poseu els alls i la llimona a la meitat a dins la cavitat.',
      'Enforneu-lo uns 60-70 minuts, regant-lo amb el seu suc de tant en tant.'
    ]
  },
  {
    name: 'Guisat de pollastre',
    description: 'Pollastre guisat amb verdures, patata i un toc de vi. Contundent i ple de sabor.',
    ingredients: [
      { label: 'Pollastre', line: '1 pollastre trossejat', keys: ['pollastre', 'pollo'] },
      { label: 'Ceba', line: '1 ceba', keys: ['ceba', 'cebolla'] },
      { label: 'All', line: '2 grans d\'all', keys: ['all', 'ajo'] },
      { label: 'Tomàquet', line: '2 tomàquets', keys: ['tomaquet', 'tomate'] },
      { label: 'Pastanaga', line: '2 pastanagues', keys: ['pastanaga', 'pastanagues', 'zanahoria'] },
      { label: 'Patata', line: '2 patates', keys: ['patata', 'papa'] },
      { label: 'Vi', line: '100 ml de vi blanc', keys: ['vi', 'vino', 'wine'] },
      { label: 'Oli', line: 'Oli d\'oliva verge', keys: ['oli', 'oliva'] },
      { label: 'Sal', line: 'Sal al gust', keys: ['sal'] }
    ],
    steps: [
      'Daurau el pollastre a trossos amb oli i reserveu-lo.',
      'Sofregiu la ceba, l\'all i el tomàquet en la mateixa olla.',
      'Afegiu la pastanaga i la patata a trossos, el vi i el pollastre.',
      'Cobriu amb aigua i cuineu a foc lent 35 minuts.',
      'Rectifiqueu de sal i serviu ben calent.'
    ]
  },
  {
    name: 'Pit de pollastre al llimó',
    description: 'Pit de pollastre a la planxa marinat amb llimona i all. Lleuger i saborós.',
    ingredients: [
      { label: 'Pollastre', line: '2 pits de pollastre', keys: ['pollastre', 'pollo'] },
      { label: 'Llimona', line: '1 llimona', keys: ['llimona', 'limon'] },
      { label: 'All', line: '2 grans d\'all', keys: ['all', 'ajo'] },
      { label: 'Oli', line: 'Oli d\'oliva verge', keys: ['oli', 'oliva'] },
      { label: 'Sal', line: 'Sal al gust', keys: ['sal'] }
    ],
    steps: [
      'Barregeu el suc de llimona, l\'all picat, l\'oli i la sal.',
      'Marineu el pollastre amb la barreja 30 minuts.',
      'Feu-lo a la planxa 5-6 minuts per banda.',
      'Deixeu-lo reposar 3 minuts i talleu-lo a llesques.'
    ]
  },
  {
    name: 'Hamburguesa casolana',
    description: 'Hamburgueses fetes a casa amb carn picada, ceba i pa. Més bones que les de comprar.',
    ingredients: [
      { label: 'Carn picada', line: '500 g de carn picada', keys: ['picada', 'vedella', 'vaca', 'porc', 'carn'] },
      { label: 'Ceba', line: '1 ceba', keys: ['ceba', 'cebolla'] },
      { label: 'All', line: '1 gra d\'all', keys: ['all', 'ajo'] },
      { label: 'Ou', line: '1 ou', keys: ['ou', 'huevo'] },
      { label: 'Pa', line: '4 panets de hamburguesa', keys: ['pa', 'pan'] },
      { label: 'Sal', line: 'Sal i pebre', keys: ['sal'] }
    ],
    steps: [
      'Barregeu la carn picada amb la ceba i l\'all picats, l\'ou i la sal.',
      'Formeu 4 hamburgueses.',
      'Feu-les a la planxa o a la graella 4 minuts per banda.',
      'Munyeu-les dins dels panets amb els complements que vulgueu.'
    ]
  },
  {
    name: 'Llom a la planxa',
    description: 'Llom de porc a la planxa, tendre i fàcil de fer. Ideal amb una amanida.',
    ingredients: [
      { label: 'Llom', line: '4 talls de llom de porc', keys: ['llom', 'lomo'] },
      { label: 'All', line: '2 grans d\'all', keys: ['all', 'ajo'] },
      { label: 'Oli', line: 'Oli d\'oliva verge', keys: ['oli', 'oliva'] },
      { label: 'Sal', line: 'Sal al gust', keys: ['sal'] },
      { label: 'Pebre', line: 'Pebre negre', keys: ['pebre', 'pimienta'] }
    ],
    steps: [
      'Salpebreu els talls de llom.',
      'Feu-los a la planxa amb oli i all 3-4 minuts per banda.',
      'Deixeu-los reposar 2 minuts abans de servir.'
    ]
  },
  {
    name: 'Filet de vedella a la planxa',
    description: 'Filet de vedella a la planxa, acompanyat d\'all i pebre. Sucós i ràpid.',
    ingredients: [
      { label: 'Vedella', line: '2 filets de vedella', keys: ['vedella', 'vaca', 'ternera'] },
      { label: 'All', line: '1 gra d\'all', keys: ['all', 'ajo'] },
      { label: 'Oli', line: 'Oli d\'oliva verge', keys: ['oli', 'oliva'] },
      { label: 'Sal', line: 'Sal al gust', keys: ['sal'] },
      { label: 'Pebre', line: 'Pebre negre', keys: ['pebre', 'pimienta'] }
    ],
    steps: [
      'Treieu els filets de la nevera 20 minuts abans.',
      'Salpebreu-los i feu-los a la planxa amb oli i all.',
      'Cuineu 2-3 minuts per banda per a un punt al punt.',
      'Deixeu-los reposar 3 minuts i serviu.'
    ]
  },
  {
    name: 'Estofat de vedella',
    description: 'Vedella estofada a foc lent amb verdures i vi. Tendra i plena de sabor.',
    ingredients: [
      { label: 'Vedella', line: '600 g de vedella per estofar', keys: ['vedella', 'vaca', 'ternera'] },
      { label: 'Ceba', line: '1 ceba', keys: ['ceba', 'cebolla'] },
      { label: 'Pastanaga', line: '2 pastanagues', keys: ['pastanaga', 'pastanagues', 'zanahoria'] },
      { label: 'Tomàquet', line: '2 tomàquets', keys: ['tomaquet', 'tomate'] },
      { label: 'Vi', line: '150 ml de vi negre', keys: ['vi', 'vino'] },
      { label: 'All', line: '2 grans d\'all', keys: ['all', 'ajo'] },
      { label: 'Oli', line: 'Oli d\'oliva verge', keys: ['oli', 'oliva'] },
      { label: 'Sal', line: 'Sal al gust', keys: ['sal'] }
    ],
    steps: [
      'Daurau la vedella a trossos amb oli i reserveu-la.',
      'Sofregiu la ceba, l\'all i la pastanaga.',
      'Afegiu el tomàquet i el vi, i deixeu reduir.',
      'Torneu la vedella, cobriu amb aigua i cuineu a foc lent 1 hora i mitja.',
      'Rectifiqueu de sal i serviu amb patates al forn.'
    ]
  },
  {
    name: 'Bacallà amb samfaina',
    description: 'Lloms de bacallà sobre samfaina. El mar i l\'hort junts en un plat.',
    ingredients: [
      { label: 'Bacallà', line: '4 lloms de bacallà', keys: ['bacalla', 'bacalao'] },
      { label: 'Albergínia', line: '1 albergínia', keys: ['alberginia', 'berenjena'] },
      { label: 'Carbassó', line: '1 carbassó', keys: ['carabasso', 'carbasso'] },
      { label: 'Pebrot', line: '1 pebrot', keys: ['pebrot', 'pimiento'] },
      { label: 'Tomàquet', line: '3 tomàquets', keys: ['tomaquet', 'tomate'] },
      { label: 'All', line: '2 grans d\'all', keys: ['all', 'ajo'] },
      { label: 'Oli', line: 'Oli d\'oliva verge', keys: ['oli', 'oliva'] },
      { label: 'Sal', line: 'Sal al gust', keys: ['sal'] }
    ],
    steps: [
      'Prepareu la samfaina sofregint les verdures tallades 25 minuts.',
      'En una altra paella, feu els lloms de bacallà 2 minuts per banda.',
      'Poseu la samfaina al fons i el bacallà a sobre.',
      'Cuineu-ho tot 3 minuts més i serviu.'
    ]
  },
  {
    name: 'Salmó a la planxa',
    description: 'Salmó a la planxa amb llimona i all. Sucós, saludable i a punt en 10 minuts.',
    ingredients: [
      { label: 'Salmó', line: '2 talls de salmó', keys: ['salmo', 'salmon'] },
      { label: 'Llimona', line: '1 llimona', keys: ['llimona', 'limon'] },
      { label: 'All', line: '1 gra d\'all', keys: ['all', 'ajo'] },
      { label: 'Oli', line: 'Oli d\'oliva verge', keys: ['oli', 'oliva'] },
      { label: 'Sal', line: 'Sal al gust', keys: ['sal'] }
    ],
    steps: [
      'Salpebreu els talls de salmó.',
      'Feu-los a la planxa amb oli i all 3-4 minuts per banda.',
      'Acabeu amb un raig de llimona i serviu.'
    ]
  },
  {
    name: 'Tonyina a la planxa',
    description: 'Tonyina fresca a la planxa, daurada per fora i rosada per dins.',
    ingredients: [
      { label: 'Tonyina', line: '2 talls de tonyina', keys: ['tonyina', 'atun'] },
      { label: 'All', line: '1 gra d\'all', keys: ['all', 'ajo'] },
      { label: 'Oli', line: 'Oli d\'oliva verge', keys: ['oli', 'oliva'] },
      { label: 'Sal', line: 'Sal al gust', keys: ['sal'] }
    ],
    steps: [
      'Salpebreu els talls de tonyina.',
      'Feu-los a la planxa molt calenta 1-2 minuts per banda.',
      'Deixeu-los reposar 2 minuts i talleu-los a llesques.'
    ]
  },
  {
    name: 'Gambes a l\'all',
    description: 'Gambes saltades amb all i un raig de llimona. Un entrant espectacular.',
    ingredients: [
      { label: 'Gambes', line: '300 g de gambes', keys: ['gamba', 'gambes', 'langostino'] },
      { label: 'All', line: '4 grans d\'all', keys: ['all', 'ajo'] },
      { label: 'Oli', line: 'Oli d\'oliva verge', keys: ['oli', 'oliva'] },
      { label: 'Sal', line: 'Sal al gust', keys: ['sal'] },
      { label: 'Llimona', line: '1 llimona', keys: ['llimona', 'limon'] }
    ],
    steps: [
      'Escalfeu oli abundant en una paella.',
      'Afegiu els alls a làmines fins que daurin.',
      'Afegiu les gambes i saltegeu 2-3 minuts.',
      'Acabeu amb sal i un raig de llimona, i serviu de seguida.'
    ]
  },
  {
    name: 'Musclos a la marinera',
    description: 'Musclos oberts amb tomàquet, ceba i vi. Un plat de mar de tota la vida.',
    ingredients: [
      { label: 'Musclos', line: '1 kg de musclos', keys: ['musclo', 'musclos', 'mejillon'] },
      { label: 'Ceba', line: '1 ceba', keys: ['ceba', 'cebolla'] },
      { label: 'Tomàquet', line: '2 tomàquets', keys: ['tomaquet', 'tomate'] },
      { label: 'Vi', line: '100 ml de vi blanc', keys: ['vi', 'vino'] },
      { label: 'All', line: '2 grans d\'all', keys: ['all', 'ajo'] },
      { label: 'Oli', line: 'Oli d\'oliva verge', keys: ['oli', 'oliva'] },
      { label: 'Sal', line: 'Sal al gust', keys: ['sal'] }
    ],
    steps: [
      'Netegeu i raspalleu els musclos.',
      'Sofregiu la ceba, l\'all i el tomàquet amb oli.',
      'Afegiu el vi i deixeu reduir.',
      'Afegiu els musclos, tapeu i cuineu fins que s\'obrin.',
      'Llanceu els que no s\'hagin obert i serviu.'
    ]
  },
  {
    name: 'Calamars a la romana',
    description: 'Anelles de calamar arrebossades i cruixents. Un aperitiu que triomfa sempre.',
    ingredients: [
      { label: 'Calamars', line: '400 g de calamars', keys: ['calamar', 'calamares'] },
      { label: 'Farina', line: '150 g de farina', keys: ['farina', 'harina', 'flour'] },
      { label: 'Ous', line: '2 ous', keys: ['ou', 'huevo', 'huevos'] },
      { label: 'Oli', line: 'Oli d\'oliva verge', keys: ['oli', 'oliva'] },
      { label: 'Sal', line: 'Sal al gust', keys: ['sal'] },
      { label: 'Llimona', line: '1 llimona', keys: ['llimona', 'limon'] }
    ],
    steps: [
      'Talleu els calamars a anelles i eixugueu-los bé.',
      'Passeu-los per farina, després per ou batut i altra vegada per farina.',
      'Fregiu-los en oli abundant fins que estiguin daurados.',
      'Escorreu-los, saleu-los i serviu amb llimona.'
    ]
  },
  {
    name: 'Pop a la gallega',
    description: 'Pop cuit acompanyat de patata, oli i pimentó dolç. La recepta gallega més famosa.',
    ingredients: [
      { label: 'Pop', line: '600 g de pop', keys: ['pop', 'pulpo'] },
      { label: 'Patata', line: '2 patates', keys: ['patata', 'papa'] },
      { label: 'Pimentó', line: 'Pimentó dolç', keys: ['pimento', 'paprika'] },
      { label: 'Oli', line: 'Oli d\'oliva verge extra', keys: ['oli', 'oliva'] },
      { label: 'Sal', line: 'Sal grossa', keys: ['sal'] }
    ],
    steps: [
      'Bulliu el pop amb aigua i sal uns 40 minuts fins que sigui tendre.',
      'Bulliu les patates amb pell i talleu-les a rodanxes.',
      'Talleu el pop a rodanxes sobre les patates.',
      'Amaniu amb oli, pimentó i sal grossa.'
    ]
  },
  {
    name: 'Amanida de cigrons',
    description: 'Amanida freda de cigrons amb tomàquet, pebrot i olives. Sana i completa.',
    ingredients: [
      { label: 'Cigrons', line: '1 pot de cigrons', keys: ['cigrons', 'cigro', 'garbanzo'] },
      { label: 'Tomàquet', line: '2 tomàquets', keys: ['tomaquet', 'tomate'] },
      { label: 'Ceba', line: '1/2 ceba', keys: ['ceba', 'cebolla'] },
      { label: 'Pebrot', line: '1/2 pebrot verd', keys: ['pebrot', 'pimiento'] },
      { label: 'Olives', line: '50 g d\'olives', keys: ['olives', 'aceituna'] },
      { label: 'Oli', line: 'Oli d\'oliva verge', keys: ['oli', 'oliva'] },
      { label: 'Vinagre', line: '1 cullerada de vinagre', keys: ['vinagre'] },
      { label: 'Sal', line: 'Sal al gust', keys: ['sal'] }
    ],
    steps: [
      'Renteu i escorreu els cigrons.',
      'Talleu el tomàquet, la ceba i el pebrot a daus.',
      'Barregeu-ho tot amb les olives.',
      'Amaniu amb oli, vinagre i sal, i deixeu reposar 15 minuts.'
    ]
  },
  {
    name: 'Cigrons estofats',
    description: 'Cigrons guisats amb espinacs, ceba i all. Un plat de cullera calent i nutritiu.',
    ingredients: [
      { label: 'Cigrons', line: '1 pot de cigrons', keys: ['cigrons', 'cigro', 'garbanzo'] },
      { label: 'Espinacs', line: '300 g d\'espinacs', keys: ['espinacs', 'espinaca'] },
      { label: 'Ceba', line: '1 ceba', keys: ['ceba', 'cebolla'] },
      { label: 'All', line: '2 grans d\'all', keys: ['all', 'ajo'] },
      { label: 'Oli', line: 'Oli d\'oliva verge', keys: ['oli', 'oliva'] },
      { label: 'Sal', line: 'Sal al gust', keys: ['sal'] }
    ],
    steps: [
      'Sofregiu la ceba i l\'all amb oli.',
      'Afegiu els espinacs i deixeu que perdin volum.',
      'Afegiu els cigrons i una mica d\'aigua.',
      'Cuineu 10 minuts i rectifiqueu de sal.'
    ]
  },
  {
    name: 'Llenties amb arròs',
    description: 'Llenties i arròs plegats, els companys clàssics de la cuina de cullera.',
    ingredients: [
      { label: 'Llenties', line: '250 g de llenties', keys: ['llenties', 'llentia', 'lentejas', 'lentils'] },
      { label: 'Arròs', line: '150 g d\'arròs', keys: ['arros', 'arroz'] },
      { label: 'Ceba', line: '1 ceba', keys: ['ceba', 'cebolla'] },
      { label: 'All', line: '2 grans d\'all', keys: ['all', 'ajo'] },
      { label: 'Pastanaga', line: '1 pastanaga', keys: ['pastanaga', 'pastanagues', 'zanahoria'] },
      { label: 'Oli', line: 'Oli d\'oliva verge', keys: ['oli', 'oliva'] },
      { label: 'Sal', line: 'Sal al gust', keys: ['sal'] }
    ],
    steps: [
      'Sofregiu la ceba, l\'all i la pastanaga amb oli.',
      'Afegiu les llenties i cobriu amb aigua.',
      'Cuineu 20 minuts i afegiu l\'arròs.',
      'Cuineu 15 minuts més, rectifiqueu de sal i serveu.'
    ]
  },
  {
    name: 'Arròs amb llet',
    description: 'Postre tradicional d\'arròs amb llet, canyella i llimona. Cremós i reconfortant.',
    ingredients: [
      { label: 'Arròs', line: '200 g d\'arròs', keys: ['arros', 'arroz'] },
      { label: 'Llet', line: '1 litre de llet', keys: ['llet', 'leche'] },
      { label: 'Sucre', line: '100 g de sucre', keys: ['sucre', 'azucar'] },
      { label: 'Canyella', line: '1 branca de canyella', keys: ['canyella', 'canela'] },
      { label: 'Llimona', line: 'La pell d\'una llimona', keys: ['llimona', 'limon'] }
    ],
    steps: [
      'Poseu la llet amb la canyella i la pell de llimona a foc baix.',
      'Afegiu l\'arròs i cuineu remenant de tant en tant uns 40 minuts.',
      'Afegiu el sucre i cuineu 10 minuts més.',
      'Repartiu en bols, empolvoreu amb canyella i deixeu refredar.'
    ]
  },
  {
    name: 'Crema catalana',
    description: 'La crema catalana de tota la vida, amb la seva capa de sucre caramel·litzat.',
    ingredients: [
      { label: 'Llet', line: '500 ml de llet', keys: ['llet', 'leche'] },
      { label: 'Ous', line: '4 rovells d\'ou', keys: ['ou', 'huevo'] },
      { label: 'Sucre', line: '100 g de sucre', keys: ['sucre', 'azucar'] },
      { label: 'Canyella', line: '1 branca de canyella', keys: ['canyella', 'canela'] },
      { label: 'Llimona', line: 'La pell d\'una llimona', keys: ['llimona', 'limon'] }
    ],
    steps: [
      'Escalfeu la llet amb la canyella i la pell de llimona.',
      'Barregeu els rovells amb el sucre.',
      'Afegiu la llet calenta a poc a poc remenant.',
      'Cueu a foc baix fins que espesseixi i repartiu en cassoletes.',
      'Empolvoreu amb sucre i caramel·litzeu amb un bufador.'
    ]
  },
  {
    name: 'Flam de llet',
    description: 'Flam casolà de llet i ous, suau i amb caramel. El postre de sempre.',
    ingredients: [
      { label: 'Llet', line: '500 ml de llet', keys: ['llet', 'leche'] },
      { label: 'Ous', line: '3 ous', keys: ['ou', 'huevo'] },
      { label: 'Sucre', line: '100 g de sucre', keys: ['sucre', 'azucar'] }
    ],
    steps: [
      'Feu un caramel amb part del sucre i cobriu el motlle.',
      'Barregeu els ous amb la llet i la resta de sucre.',
      'Aboqueu la barreja al motlle.',
      'Cueu al bany maria al forn uns 40 minuts i deixeu refredar.'
    ]
  },
  {
    name: 'Pastís de poma',
    description: 'Pastís de poma esponjós i aromàtic, ideal per acompanyar el cafè.',
    ingredients: [
      { label: 'Poma', line: '3 pomes', keys: ['poma', 'manzana'] },
      { label: 'Farina', line: '200 g de farina', keys: ['farina', 'harina'] },
      { label: 'Sucre', line: '150 g de sucre', keys: ['sucre', 'azucar'] },
      { label: 'Ous', line: '2 ous', keys: ['ou', 'huevo'] },
      { label: 'Mantega', line: '100 g de mantega', keys: ['mantega', 'mantequilla'] },
      { label: 'Canyella', line: '1 culleradeta de canyella', keys: ['canyella', 'canela'] }
    ],
    steps: [
      'Bateu la mantega amb el sucre i els ous.',
      'Afegiu la farina i la canyella i remeneu.',
      'Peleu i talleu les pomes a làmines i barregeu-les amb la massa.',
      'Enforneu a 180 °C uns 35 minuts i deixeu refredar.'
    ]
  },
  {
    name: 'Magdalenes casolanes',
    description: 'Magdalenes esponjoses fetes a casa, perfectes per esmorzar o berenar.',
    ingredients: [
      { label: 'Farina', line: '250 g de farina', keys: ['farina', 'harina'] },
      { label: 'Sucre', line: '150 g de sucre', keys: ['sucre', 'azucar'] },
      { label: 'Ous', line: '2 ous', keys: ['ou', 'huevo'] },
      { label: 'Oli', line: '100 ml d\'oli', keys: ['oli', 'oliva'] },
      { label: 'Llet', line: '100 ml de llet', keys: ['llet', 'leche'] },
      { label: 'Llevat', line: '1 sobre de llevat', keys: ['llevat', 'levadura'] }
    ],
    steps: [
      'Bateu els ous amb el sucre fins que blanquegin.',
      'Afegiu l\'oli, la llet i, a poc a poc, la farina amb el llevat.',
      'Ompliu els motllos fins a 3/4 parts.',
      'Enforneu a 190 °C uns 15-18 minuts fins que estiguin daurades.'
    ]
  },
  {
    name: 'Batut de maduixa',
    description: 'Batut fresc de maduixa i llet, dolç i cremós. Perfecte per a l\'estiu.',
    ingredients: [
      { label: 'Maduixa', line: '250 g de maduixes', keys: ['maduixa', 'maduixes', 'fresa'] },
      { label: 'Llet', line: '250 ml de llet', keys: ['llet', 'leche'] },
      { label: 'Sucre', line: '1 cullerada de sucre', keys: ['sucre', 'azucar'] }
    ],
    steps: [
      'Renteu i traieu les fulles de les maduixes.',
      'Poseu-les a la batedora amb la llet i el sucre.',
      'Tritureu fins que quedi cremós i serveu ben fred.'
    ]
  },
  {
    name: 'Torrades de formatge',
    description: 'Pa de motlle torrat amb formatge fos al mig. Un berenar ràpid i deliciós.',
    ingredients: [
      { label: 'Pa', line: '4 llesques de pa de motlle', keys: ['pa', 'pan'] },
      { label: 'Formatge', line: '100 g de formatge', keys: ['formatge', 'queso'] },
      { label: 'Mantega', line: '1 cullerada de mantega', keys: ['mantega', 'mantequilla'] }
    ],
    steps: [
      'Unteu les llesques de pa amb mantega.',
      'Poseu el formatge entre dues llesques.',
      'Feu-les a la paella o a la sandvitxera fins que el pa estigui daurat i el formatge fos.'
    ]
  },
  {
    name: 'Entrepà de pernil dolç',
    description: 'L\'entrepà clàssic de pernil dolç i tomàquet. Ràpid, fàcil i bo sempre.',
    ingredients: [
      { label: 'Pa', line: '1 barra de pa', keys: ['pa', 'pan'] },
      { label: 'Pernil', line: '100 g de pernil dolç', keys: ['pernil', 'jamon'] },
      { label: 'Tomàquet', line: '1 tomàquet', keys: ['tomaquet', 'tomate'] },
      { label: 'Oli', line: 'Oli d\'oliva verge', keys: ['oli', 'oliva'] }
    ],
    steps: [
      'Obriu la barra de pa per la meitat.',
      'Amaniu amb una mica d\'oli.',
      'Poseu el pernil i les rodanxes de tomàquet a dins.',
      'Tanqueu l\'entrepà i a taula.'
    ]
  },
  {
    name: 'Entrepà de tonyina',
    description: 'Entrepà de tonyina amb maionesa i enciam. El clàssic dels pícnic.',
    ingredients: [
      { label: 'Pa', line: '1 barra de pa', keys: ['pa', 'pan'] },
      { label: 'Tonyina', line: '1 llauna de tonyina', keys: ['tonyina', 'atun'] },
      { label: 'Maionesa', line: '2 cullerades de maionesa', keys: ['maionesa', 'mayonesa'] },
      { label: 'Enciam', line: 'Unes fulles d\'enciam', keys: ['enciam', 'lechuga'] }
    ],
    steps: [
      'Barregeu la tonyina esmicolada amb la maionesa.',
      'Obriu la barra de pa i poseu-hi les fulles d\'enciam.',
      'Repartiu la barreja de tonyina a sobre i tanqueu l\'entrepà.'
    ]
  }
]

export function scoreDish(stock, dish) {
  const missing = missingIngredients(stock, dish)
  const counts = {}
  for (const ing of dish.ingredients) {
    const items = stock.filter((it) => it.quantity > 0 && matches(normalize(it.name), ing))
    for (const item of items) counts[item.id] = true
  }
  return {
    dish,
    missing,
    expiryCount: Object.keys(counts).filter((id) => {
      const item = stock.find((it) => it.id === id)
      return item && item.expiry && new Date(item.expiry) <= Date.now() + 3 * 86400000
    }).length
  }
}
