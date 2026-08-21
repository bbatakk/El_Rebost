import { formatExpiry, expiryStatus, EXPIRY } from '../../data.js'

export function expiryLine(item) {
  return item.expiry ? ` · Caduca el ${formatExpiry(item.expiry)}` : ''
}

export function expiryTag(item) {
  if (!item.expiry) return null
  const st = expiryStatus(item.expiry)
  if (st === EXPIRY.EXPIRED) return <span className="tag tag-expired">Caducat</span>
  if (st === EXPIRY.SOON) return <span className="tag tag-soon">Aviat</span>
  return null
}
