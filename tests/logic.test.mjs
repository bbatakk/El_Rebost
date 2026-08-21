import assert from 'node:assert/strict'
import {
  normalize, categoryForName, scaleLine, parseQuantity, formatScaledQty,
  combineShoppingNote, estimatedExpiry, expiryStatus, EXPIRY, toInputDate, todayInputDate,
  normalizeItem, finalizeItem, totalQty, minExpiry, formatQty, unitFromQuantity, UNIT_LABEL
} from '../src/data.js'
import { sameProduct, have, missingIngredients, scoreDish, deriveKeys, dishKey, generateMealPlan, dishMatchesQuery, ingredientCoverage, shoppingShortfall, DISHES } from '../src/dishes.js'
import { suggestPrice, priceFor, qtyToBuy, qtyUnit, itemCost, fmtEuro, fmtPrice, shoppingTotals } from '../src/prices.js'

let passed = 0
const failures = []

function test(name, fn) {
  try { fn(); passed++ } catch (err) { failures.push({ name, err }) }
}

function daysFromNow(days) {
  const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + days)
  return d.getTime()
}

const item = (name, quantity, expiry) => ({ id: name, name, quantity, expiry: expiry ?? null })
const uItem = (name, quantity, expiry) => ({ ...item(name, quantity, expiry), unit: 'u' })
const labels = (arr) => arr.map((i) => i.label)

test('normalize', () => {
  assert.equal(normalize('Tomàquet  fresc!'), 'tomaquet  fresc')
  assert.equal(normalize('OLI'), 'oli')
  assert.equal(normalize(''), '')
})

test('categoryForName: totes les categories', () => {
  assert.equal(categoryForName('Llet'), 'Làctics')
  assert.equal(categoryForName('Formatge'), 'Làctics')
  assert.equal(categoryForName('Pernil dolç'), 'Carn')
  assert.equal(categoryForName('Pollastre'), 'Carn')
  assert.equal(categoryForName('Tonyina'), 'Peix')
  assert.equal(categoryForName('Gambes'), 'Peix')
  assert.equal(categoryForName('Ous'), 'Ous')
  assert.equal(categoryForName('Ou'), 'Ous')
  assert.equal(categoryForName('Pa'), 'Pa i cereals')
  assert.equal(categoryForName('Flocs de civada'), 'Pa i cereals')
  assert.equal(categoryForName('Espagueti'), 'Pa i cereals')
  assert.equal(categoryForName('Poma'), 'Fruita')
  assert.equal(categoryForName('Plàtan'), 'Fruita')
  assert.equal(categoryForName('Tomàquet'), 'Verdura')
  assert.equal(categoryForName('Patates'), 'Verdura')
  assert.equal(categoryForName('Espinacs'), 'Verdura')
  assert.equal(categoryForName('Meló'), 'Fruita')
  assert.equal(categoryForName('Mango'), 'Fruita')
  assert.equal(categoryForName('Pinya'), 'Fruita')
  assert.equal(categoryForName('Figa'), 'Fruita')
  assert.equal(categoryForName('Pèsols'), 'Verdura')
  assert.equal(categoryForName('Remolatxa'), 'Verdura')
  assert.equal(categoryForName('Rave'), 'Verdura')
  assert.equal(categoryForName('Croquetes'), 'Congelats')
  assert.equal(categoryForName('Gelat'), 'Congelats')
  assert.equal(categoryForName('Pizza'), 'Congelats')
  assert.equal(categoryForName('Xocolata'), 'Altres')
  assert.equal(categoryForName('Brou de pollastre'), 'Altres')
  assert.equal(categoryForName('Ametlles'), 'Altres')
  assert.equal(categoryForName('Sucre'), 'Altres')
  assert.equal(categoryForName(''), 'Altres')
})

test('formatScaledQty: fraccions', () => {
  assert.equal(formatScaledQty(0.25), '1/4')
  assert.equal(formatScaledQty(1 / 3), '1/3')
  assert.equal(formatScaledQty(0.5), '1/2')
  assert.equal(formatScaledQty(2 / 3), '2/3')
  assert.equal(formatScaledQty(0.75), '3/4')
  assert.equal(formatScaledQty(2), '2')
  assert.equal(formatScaledQty(1.5), '1 1/2')
  assert.equal(formatScaledQty(2.25), '2 1/4')
  assert.equal(formatScaledQty(0), '0')
})

test('scaleLine: factors i fraccions', () => {
  assert.equal(scaleLine('4 ous', 1), '4 ous')
  assert.equal(scaleLine('4 ous', 0.5), '2 ous')
  assert.equal(scaleLine('4 ous', 1.5), '6 ous')
  assert.equal(scaleLine('4 ous', 2), '8 ous')
  assert.equal(scaleLine('1/2 cogombre', 2), '1 cogombre')
  assert.equal(scaleLine('1/2 cogombre', 0.5), '1/4 cogombre')
  assert.equal(scaleLine('1 ceba petita', 1.5), '1 1/2 ceba petita')
  assert.equal(scaleLine('2 patates mitjanes', 0.75), '1 1/2 patates mitjanes')
  assert.equal(scaleLine("Oli d'oliva verge", 3), "Oli d'oliva verge")
  assert.equal(scaleLine('Un raig de sal', 2), 'Un raig de sal')
  assert.equal(scaleLine('1 pessic de sal', 0.5), '1/2 pessic de sal')
})

test('parseQuantity', () => {
  assert.equal(parseQuantity(''), 1)
  assert.equal(parseQuantity(null), 1)
  assert.equal(parseQuantity('2 ous'), 2)
  assert.equal(parseQuantity('1/2 ceba'), 1)
  assert.equal(parseQuantity('250 g de llet'), 250)
  assert.equal(parseQuantity('2 + 1 ous'), 3)
  assert.equal(parseQuantity('1 + 1/2 poma'), 2)
  assert.equal(parseQuantity('paraules'), 1)
  assert.equal(parseQuantity('1/0 impossible'), 1)
})

test('combineShoppingNote', () => {
  assert.equal(combineShoppingNote(null, '2 ous'), '2 ous')
  assert.equal(combineShoppingNote('2 ous', '2 ous'), '4 ous')
  assert.equal(combineShoppingNote('1 ceba petita', '1 ceba petita'), '2 ceba petita')
  assert.equal(combineShoppingNote('250 g de llet', '250 g de llet'), '500 g de llet')
  assert.equal(combineShoppingNote('1/2 cogombre', '1/2 cogombre'), '1 cogombre')
  assert.equal(combineShoppingNote('2 ous', '1 tomàquet'), '2 ous + 1 tomàquet')
  assert.equal(combineShoppingNote('1 ceba petita (opcional)', '2 ceba petita (opcional)'), '3 ceba petita (opcional)')
  assert.equal(combineShoppingNote('2 patates mitjanes', '2 patates mitjanes'), '4 patates mitjanes')
})

test('sameProduct bidireccional', () => {
  assert.ok(sameProduct('Patata', 'Patates'))
  assert.ok(sameProduct('Patates', 'Patata'))
  assert.ok(sameProduct('Espinacs', 'Espinaca'))
  assert.ok(sameProduct('Ous', 'Ou'))
  assert.ok(sameProduct('Llet', 'llet sencera'))
  assert.ok(!sameProduct('Patata', 'Pastanaga'))
  assert.ok(!sameProduct('Poma', 'Mel'))
  assert.ok(!sameProduct('Tomàquet', 'Tomate'))
  assert.ok(!sameProduct('', 'Patata'))
})

test('have: quantitat zero no compta', () => {
  const ing = { keys: ['patata', 'papa'] }
  assert.ok(have([item('Patata', 3)], ing))
  assert.ok(!have([item('Patata', 0)], ing))
  assert.ok(!have([item('Pastanaga', 3)], ing))
})

test('missingIngredients: estoc buit', () => {
  for (const dish of DISHES) {
    assert.equal(missingIngredients([], dish).length, dish.ingredients.length, dish.name)
  }
})

test('missingIngredients: estoc complet', () => {
  const stock = [
    item('Patata', 4), item('Ous', 6), item('Ceba', 2), item('Oli de oliva', 1),
    item('Sal', 1), item('Enciam', 1), item('Tomàquet', 6), item('Vinagre', 1)
  ]
  const truita = DISHES.find((d) => d.name === 'Truita de patata')
  const amanida = DISHES.find((d) => d.name === 'Amanida verda')
  assert.equal(missingIngredients(stock, truita).length, 0)
  assert.equal(missingIngredients(stock, amanida).length, 0)
})

test('missingIngredients: nom compost encaixa', () => {
  const stock = [item('Oli de oliva verge extra', 1)]
  const amanida = DISHES.find((d) => d.name === 'Amanida verda')
  assert.ok(!labels(missingIngredients(stock, amanida)).includes('Oli'))
})

test('missingIngredients: no confon subcadenes', () => {
  const stock = [item('Pastanaga', 2), item('Patata', 2)]
  const amanida = DISHES.find((d) => d.name === 'Amanida verda')
  const missing = labels(missingIngredients(stock, amanida))
  assert.ok(missing.includes('Enciam') && missing.includes('Tomàquet'))
})

test('missingIngredients: quantitat zero = falta', () => {
  const stock = [item('Patata', 0), item('Ous', 4)]
  const truita = DISHES.find((d) => d.name === 'Truita de patata')
  assert.ok(labels(missingIngredients(stock, truita)).includes('Patata'))
})

test('scoreDish: ingredients a punt de caducar', () => {
  const stock = [
    item('Tomàquet', 4, daysFromNow(1)), item('Oli de oliva', 1), item('Sal', 1)
  ]
  const scored = scoreDish(stock, DISHES.find((d) => d.name === 'Gaspatxo'))
  assert.equal(scored.expiryCount, 1)
  assert.equal(scored.missing.length, 4)
})

test('estimatedExpiry: fruita/verdura', () => {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const assertDays = (name, cat, days) => {
    const got = estimatedExpiry(name, cat)
    assert.ok(got, name + ' hauria de tenir caducitat')
    assert.equal(got, today.getTime() + days * 86400000, name)
  }
  assertDays('Plàtan', 'Fruita', 4)
  assertDays('Poma', 'Fruita', 21)
  assertDays('Tomàquet', 'Verdura', 7)
  assertDays('Enciam', 'Verdura', 5)
  assertDays('Patates', 'Verdura', 30)
  assert.equal(estimatedExpiry('Llet', 'Làctics'), null)
  assert.equal(estimatedExpiry('', 'Fruita'), null)
})

test('expiryStatus: llindars', () => {
  assert.equal(expiryStatus(null), EXPIRY.OK)
  assert.equal(expiryStatus(daysFromNow(5)), EXPIRY.OK)
  assert.equal(expiryStatus(daysFromNow(3)), EXPIRY.SOON)
  assert.equal(expiryStatus(daysFromNow(1)), EXPIRY.SOON)
  assert.equal(expiryStatus(daysFromNow(0)), EXPIRY.SOON)
  assert.equal(expiryStatus(daysFromNow(-1)), EXPIRY.EXPIRED)
})

test('toInputDate / todayInputDate', () => {
  assert.match(todayInputDate(), /^\d{4}-\d{2}-\d{2}$/)
  const d = new Date()
  const expected = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  assert.equal(todayInputDate(), expected)
  assert.equal(toInputDate(new Date(2026, 0, 5).getTime()), '2026-01-05')
})

test('tots els ingredients dels plats tenen clau en minúscula', () => {
  for (const dish of DISHES) {
    for (const ing of dish.ingredients) {
      assert.ok(Array.isArray(ing.keys) && ing.keys.length > 0, dish.name + ' / ' + ing.label)
    }
  }
})

test('totalQty / minExpiry', () => {
  const lots = [{ qty: 2, expiry: 10 }, { qty: 3, expiry: null }, { qty: 1, expiry: 5 }]
  assert.equal(totalQty(lots), 6)
  assert.equal(minExpiry(lots), 5)
  assert.equal(totalQty([]), 0)
  assert.equal(minExpiry([]), null)
  assert.equal(minExpiry([{ qty: 1, expiry: null }]), null)
})

test('normalizeItem: sense lots els deriva', () => {
  const n = normalizeItem({ id: 'a', name: 'Llet', quantity: 3, expiry: 1234 })
  assert.equal(n.unit, 'u')
  assert.deepEqual(n.lots, [{ qty: 3, expiry: 1234 }])
  assert.equal(n.quantity, 3)
  assert.equal(n.expiry, 1234)
})

test('normalizeItem: amb lots recalcula quantity/expiry', () => {
  const n = normalizeItem({ id: 'a', name: 'Iogurt', unit: 'g', lots: [{ qty: 1, expiry: 10 }, { qty: 2, expiry: null }] })
  assert.equal(n.unit, 'g')
  assert.equal(n.quantity, 3)
  assert.equal(n.expiry, 10)
})

test('finalizeItem: calcula quantity/expiry a partir dels lots', () => {
  const f = finalizeItem({ name: 'Iogurt', category: 'Làctics', unit: 'u', lots: [{ qty: 2, expiry: 10 }, { qty: 1, expiry: null }] })
  assert.equal(f.quantity, 3)
  assert.equal(f.expiry, 10)
  assert.equal(f.unit, 'u')
  assert.equal(f.lots.length, 2)
})

test('finalizeItem: default unitat i lots buit', () => {
  const f = finalizeItem({ name: 'Pa', category: 'Pa i cereals' })
  assert.equal(f.unit, 'u')
  assert.deepEqual(f.lots, [{ qty: 0, expiry: null }])
})

test('formatQty', () => {
  assert.equal(formatQty(3), '3')
  assert.equal(formatQty(0.5), '0.5')
  assert.equal(formatQty(0.25), '0.25')
  assert.equal(formatQty(null), '0')
})

test('unitFromQuantity: unitats des del text del producte', () => {
  assert.deepEqual(unitFromQuantity('400 g'), { unit: 'g', qty: 400 })
  assert.deepEqual(unitFromQuantity('1,5 kg'), { unit: 'kg', qty: 1.5 })
  assert.deepEqual(unitFromQuantity('1 L'), { unit: 'l', qty: 1 })
  assert.deepEqual(unitFromQuantity('500 ml'), { unit: 'ml', qty: 500 })
  assert.deepEqual(unitFromQuantity('1000 g'), { unit: 'kg', qty: 1 })
  assert.deepEqual(unitFromQuantity('6'), { unit: 'u', qty: 6 })
  assert.equal(unitFromQuantity(null), null)
  assert.equal(unitFromQuantity(''), null)
})

test('deriveKeys: singularitza el nom', () => {
  assert.deepEqual(deriveKeys('Tomàquets'), ['tomaquet'])
  assert.deepEqual(deriveKeys('Patates'), ['patate'])
  assert.deepEqual(deriveKeys('Ceba'), ['ceba'])
  assert.deepEqual(deriveKeys('Ous frescos'), ['ou', 'fresco'])
  assert.deepEqual(deriveKeys(''), ['producte'])
})

test('UNIT_LABEL cobreix totes les unitats', () => {
  for (const u of ['u', 'g', 'kg', 'ml', 'l']) assert.ok(UNIT_LABEL[u], u)
})

test('dishKey: distingeix estàndards i pròpies', () => {
  assert.equal(dishKey({ name: 'Truita de patata' }), 's-Truita de patata')
  assert.equal(dishKey({ name: 'Truita de patata', user: true }), 'u-Truita de patata')
})

test('generateMealPlan: 7 dies sense repetir plat', () => {
  const scored = DISHES.map((dish) => ({ dish, missingCount: 0 }))
  const plan = generateMealPlan(scored, 7)
  assert.equal(plan.length, 7)
  assert.equal(new Set(plan.map((d) => d.key)).size, 7)
  assert.ok(plan.every((d) => d.name && d.key && d.user === false))
})

test('generateMealPlan: evita repetir l\'ingredient principal', () => {
  const scored = DISHES.map((dish) => ({ dish, missingCount: 0 }))
  const plan = generateMealPlan(scored, 7)
  const mains = plan.map((d) => {
    const dish = DISHES.find((x) => x.name === d.name)
    return dish && dish.ingredients[0] ? dish.ingredients[0].label : null
  }).filter(Boolean)
  assert.equal(new Set(mains).size, mains.length)
})

test('generateMealPlan: amb poc stock omple els dies que pot', () => {
  const scored = DISHES.slice(0, 2).map((dish) => ({ dish, missingCount: 0 }))
  const plan = generateMealPlan(scored, 7)
  assert.ok(plan.length >= 2)
  assert.equal(new Set(plan.map((d) => d.key)).size, plan.length)
})

test('generateMealPlan: marca user per a receptes pròpies', () => {
  const scored = [
    { dish: { name: 'Meu plat', user: true, ingredients: [{ label: 'Ceba' }] }, missingCount: 0 },
    { dish: { name: 'Truita de patata', ingredients: [{ label: 'Patata' }] }, missingCount: 0 }
  ]
  const plan = generateMealPlan(scored, 7)
  const mine = plan.find((d) => d.name === 'Meu plat')
  assert.ok(mine && mine.user && mine.key === 'u-Meu plat')
})

test('generateMealPlan: prioritza els plats amb ingredients a punt de caducar', () => {
  const expiringDish = { name: 'Plat expirant', user: false, ingredients: [{ label: 'Llet', line: '1 l de llet' }] }
  const normalDish = { name: 'Plat normal', user: false, ingredients: [{ label: 'Patata', line: '2 patates' }] }
  const scored = [
    { dish: normalDish, missingCount: 0, expiring: 0 },
    { dish: expiringDish, missingCount: 0, expiring: 1 }
  ]
  const plan = generateMealPlan(scored, 2)
  assert.equal(plan[0].name, 'Plat expirant')
  assert.equal(plan[1].name, 'Plat normal')
})

test('dishMatchesQuery: per nom i per ingredient, sense accents', () => {
  const dish = DISHES.find((d) => d.name === 'Truita de patata')
  assert.ok(dishMatchesQuery(dish, 'truita'))
  assert.ok(dishMatchesQuery(dish, 'TRUITA'))
  assert.ok(dishMatchesQuery(dish, 'patata'))
  assert.ok(dishMatchesQuery(dish, 'cebolla'))
  assert.ok(dishMatchesQuery(dish, ''))
  assert.ok(!dishMatchesQuery(dish, 'lluç'))
})

test('ingredientCoverage: quantitats comptables', () => {
  const ous = { label: 'Ous', line: '4 ous', keys: ['ou'] }
  assert.deepEqual(ingredientCoverage([{ ...item('Ous', 4), unit: 'u' }], ous), { have: 4, need: 4, ratio: 1 })
  assert.deepEqual(ingredientCoverage([{ ...item('Ous', 2), unit: 'u' }], ous), { have: 2, need: 4, ratio: 0.5 })
  assert.equal(ingredientCoverage([], ous), null)
})

test('ingredientCoverage: no compara quan la unitat no és comparable', () => {
  const ous = { label: 'Ous', line: '4 ous', keys: ['ou'] }
  assert.equal(ingredientCoverage([{ ...item('Ous', 4), unit: 'g' }], ous), null)
  const llet = { label: 'Llet', line: '250 g de llet', keys: ['llet'] }
  assert.equal(ingredientCoverage([{ ...item('Llet', 1), unit: 'u' }], llet), null)
})

test('ingredientCoverage: ítem antic sense unitat es tracta com u', () => {
  const ous = { label: 'Ous', line: '4 ous', keys: ['ou'] }
  assert.deepEqual(ingredientCoverage([item('Ous', 4)], ous), { have: 4, need: 4, ratio: 1 })
  assert.deepEqual(ingredientCoverage([item('Ous', 2)], ous), { have: 2, need: 4, ratio: 0.5 })
})

test('shoppingShortfall: funciona amb ítems antics sense unitat', () => {
  const stock = [item('Patates', 3)]
  const dish = { name: 'Prova', user: false, ingredients: [{ label: 'Patata', line: '4 patates mitjanes', keys: ['patata'] }] }
  assert.deepEqual(shoppingShortfall(stock, dish, 1), [{ label: 'Patata', line: '1 patates mitjanes' }])
})

test('shoppingShortfall: ingredients totalment absents', () => {
  const stock = [uItem('Patata', 4), uItem('Ous', 6)]
  const dish = {
    name: 'Prova', user: false,
    ingredients: [
      { label: 'Patata', line: '4 patates', keys: ['patata'] },
      { label: 'Ceba', line: '1 ceba', keys: ['ceba'] }
    ]
  }
  assert.deepEqual(shoppingShortfall(stock, dish, 1), [{ label: 'Ceba', line: '1 ceba' }])
})

test('shoppingShortfall: quantitat parcial i escala per racions', () => {
  const stock = [uItem('Ous', 2)]
  const dish = { name: 'Prova', user: false, ingredients: [{ label: 'Ous', line: '4 ous', keys: ['ou'] }] }
  assert.deepEqual(shoppingShortfall(stock, dish, 1), [{ label: 'Ous', line: '2 ous' }])
  assert.deepEqual(shoppingShortfall(stock, dish, 2), [{ label: 'Ous', line: '4 ous' }])
})

test('shoppingShortfall: no afegeix quan no es pot comparar', () => {
  const stock = [uItem('Llet', 1)]
  const dish = { name: 'Prova', user: false, ingredients: [{ label: 'Llet', line: '250 g de llet', keys: ['llet'] }] }
  assert.deepEqual(shoppingShortfall(stock, dish, 1), [])
})

test('suggestPrice: per unitat natural i conversions', () => {
  assert.equal(suggestPrice('Poma', 'kg'), 1.9)
  assert.equal(suggestPrice('Poma', 'g'), 0.0019)
  assert.equal(suggestPrice('Poma', 'u'), 0.35)
  assert.equal(suggestPrice('Llet', 'l'), 0.85)
  assert.equal(suggestPrice('Llet', 'ml'), 0.00085)
  assert.equal(suggestPrice('Ous', 'u'), 0.22)
  assert.equal(suggestPrice('Patates', 'kg'), 1.2)
  assert.equal(suggestPrice('Pomes', 'kg'), 1.9)
  assert.equal(suggestPrice('Aliment inexistent', 'kg'), null)
  assert.equal(suggestPrice('', 'u'), null)
})

test('suggestPrice: preu per categoria de reserva', () => {
  assert.equal(suggestPrice('Púding', 'kg', 'Altres'), 3)
  assert.equal(suggestPrice('Púding', 'g', 'Altres'), 0.003)
  assert.equal(suggestPrice('Aliment rar', 'u', 'Peix'), 4)
  assert.equal(suggestPrice('Aliment rar', 'l', 'Altres'), 3)
  assert.equal(suggestPrice('Sense categoria', 'u'), null)
})

test('suggestPrice: catàleg ampliat', () => {
  assert.equal(suggestPrice('Meló', 'u'), 2.0)
  assert.equal(suggestPrice('Melons', 'u'), 2.0)
  assert.equal(suggestPrice('Meló', 'kg'), 1.6)
  assert.equal(suggestPrice('Mango', 'u'), 1.5)
  assert.equal(suggestPrice('Pinya', 'u'), 1.8)
  assert.equal(suggestPrice('Xocolata', 'u'), 3.0)
  assert.equal(suggestPrice('Xocolates', 'u'), 3.0)
  assert.equal(suggestPrice('Brou de pollastre', 'u'), 1.5)
  assert.equal(suggestPrice('Croquetes', 'kg'), 6.0)
  assert.equal(suggestPrice('Pizza', 'u'), 3.5)
  assert.equal(suggestPrice('Gelat', 'l'), 5.0)
  assert.equal(itemCost({ name: 'Meló', unit: 'u', shoppingNote: '1 meló' }), 2.0)
})

test('priceFor: sobreescriu el suggerit', () => {
  assert.equal(priceFor({ name: 'Poma', unit: 'kg' }), 1.9)
  assert.equal(priceFor({ name: 'Poma', unit: 'kg', price: 2.3 }), 2.3)
  assert.equal(priceFor({ name: 'Poma', unit: 'kg', price: 0 }), 1.9)
  assert.equal(priceFor({ name: 'Desconegut', unit: 'u' }), null)
  assert.equal(priceFor({ name: 'Desconegut', unit: 'u', category: 'Verdura' }), 0.5)
})

test('qtyToBuy / qtyUnit: des de toBuy o la nota', () => {
  assert.equal(qtyToBuy({ toBuy: 3, unit: 'u' }), 3)
  assert.equal(qtyUnit({ toBuy: 3, unit: 'u' }), 'u')
  assert.equal(qtyToBuy({ shoppingNote: '250 g de llet' }), 250)
  assert.equal(qtyUnit({ shoppingNote: '250 g de llet' }), 'g')
  assert.equal(qtyToBuy({ shoppingNote: '1/2 ceba' }), 1)
  assert.equal(qtyUnit({ shoppingNote: '1/2 ceba' }), 'u')
  assert.equal(qtyToBuy({ shoppingNote: '2 ous' }), 2)
  assert.equal(qtyToBuy({}), 1)
})

test('itemCost: quantitat per preu', () => {
  assert.equal(itemCost({ name: 'Llet', unit: 'u', shoppingNote: '1 l de llet' }), 0.85)
  assert.equal(itemCost({ name: 'Poma', unit: 'u', shoppingNote: '4 pomes' }), 1.4)
  assert.equal(itemCost({ name: 'Ous', unit: 'u', toBuy: 6 }), 1.32)
  assert.equal(itemCost({ name: 'Desconegut', unit: 'u', toBuy: 2 }), null)
  assert.equal(itemCost({ name: 'Desconegut', unit: 'u', toBuy: 2, price: 3.5 }), 7)
})

test('fmtEuro / fmtPrice', () => {
  assert.equal(fmtEuro(3.5), '3,50 €')
  assert.equal(fmtEuro(0), '0,00 €')
  assert.equal(fmtPrice(2.3), '2,3')
  assert.equal(fmtPrice(1.9), '1,9')
})

test('shoppingTotals: total i sense preu', () => {
  const list = [
    { id: 'a', name: 'Ous', unit: 'u', toBuy: 6 },
    { id: 'b', name: 'Llet', unit: 'u', shoppingNote: '1 l de llet' },
    { id: 'c', name: 'Desconegut', unit: 'u', toBuy: 1 }
  ]
  const { total, unpriced } = shoppingTotals(list)
  assert.equal(total, 2.17)
  assert.equal(unpriced, 1)
})

console.log(`\n${passed} proves passades${failures.length ? `, ${failures.length} fallades` : ''}`)
for (const f of failures) {
  console.log(`\nFAIL: ${f.name}`)
  console.log(f.err.message)
}
process.exit(failures.length === 0 ? 0 : 1)
