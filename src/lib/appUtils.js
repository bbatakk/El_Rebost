import { useCallback, useState } from 'react'

export const TABS = ['foods', 'stock', 'kitchen', 'shopping']
export const TAB_LABEL = { stock: 'Estoc', foods: 'Aliments', kitchen: 'Cuina', shopping: 'Compra' }

export function tabFromHash(hash) {
  const m = /^#\/(stock|foods|kitchen|shopping)/.exec(hash || '')
  return m ? m[1] : 'stock'
}

export function hasModalToken(hash) {
  return /^#\/(stock|foods|kitchen|shopping)\/modal/.test(hash || '')
}

export function zeroItem(it) {
  return {
    ...it,
    active: false,
    lots: [{ qty: 0, expiry: null }],
    quantity: 0,
    expiry: null
  }
}

export function newId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return 'id-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8)
}

export function useCollapsed() {
  const [collapsed, setCollapsed] = useState(() => new Set())
  const toggle = useCallback((key) => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])
  return [collapsed, toggle]
}
