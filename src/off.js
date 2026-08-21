import { unitFromQuantity } from './data.js'

export async function lookupBarcode(code) {
  const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json`)
  if (!res.ok) return null
  const json = await res.json()
  if (json.status !== 1 || !json.product) return null
  const p = json.product
  const name = (p.product_name_ca || p.product_name || p.generic_name_ca || p.generic_name || '').trim()
  const parsed = unitFromQuantity(p.quantity || p.product_quantity?.toString())
  return {
    code,
    name,
    unit: parsed ? parsed.unit : 'u',
    qty: parsed ? parsed.qty : 1
  }
}
