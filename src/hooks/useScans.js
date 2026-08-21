import { useState } from 'react'
import { scanReceipt } from '../firebase.js'
import { categoryForName, normalizeItem, finalizeItem, totalQty, minExpiry } from '../data.js'
import { sameProduct } from '../dishes.js'
import { newId } from '../lib/appUtils.js'

// Fluxos d'escaneig: tiquet (OCR) i identificació d'aliment per foto.
export function useScans({ rawItems, mutate, showToast }) {
  const [receipt, setReceipt] = useState(null) // { text, items: [...] }
  const [receiptLoading, setReceiptLoading] = useState(false)
  const [identifyOpen, setIdentifyOpen] = useState(false)
  const [identifyMode, setIdentifyMode] = useState(null) // 'camera' | 'gallery'

  const handleReceiptFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    setReceiptLoading(true)
    try {
      const base64 = await new Promise((resolve, reject) => {
        const img = new Image()
        const reader = new FileReader()
        reader.onload = () => {
          img.onload = () => {
            const canvas = document.createElement('canvas')
            const MAX = 1600
            let w = img.width, h = img.height
            if (w > MAX || h > MAX) {
              const scale = MAX / Math.max(w, h)
              w = Math.round(w * scale)
              h = Math.round(h * scale)
            }
            canvas.width = w
            canvas.height = h
            canvas.getContext('2d').drawImage(img, 0, 0, w, h)
            resolve(canvas.toDataURL('image/jpeg', 0.85))
          }
          img.onerror = reject
          img.src = reader.result
        }
        reader.onerror = reject
        reader.readAsDataURL(file)
      })

      const data = await scanReceipt(base64)
      if (!data.items || data.items.length === 0) {
        showToast('No s\'ha detectat cap article al ticket')
      } else {
        const matched = data.items.map((it) => {
          const existing = rawItems.find((r) => sameProduct(r.name, it.name))
          return { ...it, matchedName: existing ? existing.name : null, matchedId: existing ? existing.id : null }
        })
        setReceipt({ text: data.text, items: matched })
      }
    } catch (err) {
      console.error('receipt scan error', err)
      showToast('Error en processar el ticket')
    } finally {
      setReceiptLoading(false)
    }
  }

  const confirmReceipt = (selected) => {
    let added = 0
    for (const it of selected) {
      const name = (it.displayName || it.name || '').trim()
      if (!name) continue
      const qty = parseFloat(String(it.quantity).replace(',', '.')) || 0
      const unit = it.unit || 'u'
      const existing = it.matchedId ? rawItems.find((r) => r.id === it.matchedId) : rawItems.find((r) => sameProduct(r.name, name))
      if (existing) {
        const norm = normalizeItem(existing)
        const newLot = { qty: qty || 0, expiry: null, addedAt: new Date().toISOString() }
        mutate((list) => list.map((it) => {
          if (it.id !== existing.id) return it
          const lots = [...norm.lots, newLot]
          return { ...it, active: true, lots, quantity: totalQty(lots), expiry: minExpiry(lots), onShoppingList: false }
        }))
      } else {
        const category = categoryForName(name)
        const newLot = { qty: qty || 0, expiry: null, addedAt: new Date().toISOString() }
        mutate((list) => [...list, finalizeItem({
          id: newId(),
          name,
          category,
          quantity: qty || 0,
          lots: [newLot],
          expiry: null,
          active: true,
          price: it.price || null
        })])
      }
      added++
    }
    setReceipt(null)
    showToast(added > 0 ? `${added} article${added === 1 ? '' : 's'} afegit${added === 1 ? '' : 's'} a l'estoc` : 'Cap article afegit')
  }

  const confirmIdentify = ({ name, quantity, unit, matchedId }) => {
    if (!name.trim()) return
    const qty = parseFloat(String(quantity).replace(',', '.')) || 1
    const existing = matchedId ? rawItems.find((r) => r.id === matchedId) : rawItems.find((r) => sameProduct(r.name, name))
    if (existing) {
      const norm = normalizeItem(existing)
      const newLot = { qty, expiry: null, addedAt: new Date().toISOString() }
      mutate((list) => list.map((it) => {
        if (it.id !== existing.id) return it
        const lots = [...norm.lots, newLot]
        return { ...it, active: true, lots, quantity: totalQty(lots), expiry: minExpiry(lots), onShoppingList: false }
      }))
    } else {
      const category = categoryForName(name)
      const newLot = { qty, expiry: null, addedAt: new Date().toISOString() }
      mutate((list) => [...list, finalizeItem({
        id: newId(),
        name,
        category,
        quantity: qty,
        lots: [newLot],
        expiry: null,
        active: true,
        unit: unit || 'u'
      })])
    }
    setIdentifyOpen(false)
    showToast(`"${name}" afegit a l'estoc`)
  }

  const openIdentify = (mode) => {
    setIdentifyOpen(true)
    setIdentifyMode(mode)
  }

  const closeIdentify = () => {
    setIdentifyOpen(false)
    setIdentifyMode(null)
  }

  const closeReceipt = () => setReceipt(null)

  return {
    receipt, receiptLoading, identifyOpen, identifyMode,
    handleReceiptFile, confirmReceipt, confirmIdentify,
    openIdentify, closeIdentify, closeReceipt
  }
}
