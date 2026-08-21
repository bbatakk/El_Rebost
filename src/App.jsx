import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useAuth, useRebosts, useRebostData, saveRebost, renameRebost, loginWithGoogle, logout, getLastRebost, setLastRebost, createRebost, joinRebost, deleteRebost, deleteAccount, scanReceipt, identifyFood } from './firebase.js'
import { CATEGORIES, categoryColor, formatExpiry, expiryStatus, EXPIRY, parseQuantity, combineShoppingNote, categoryForName, normalizeItem, finalizeItem, totalQty, minExpiry, formatQty, UNIT_LABEL, normalize } from './data.js'
import { priceFor, itemCost, fmtEuro, fmtPrice, shoppingTotals, qtyUnit } from './prices.js'
import { DISHES, missingIngredients, sameProduct, have, generateMealPlan, dishKey, dishMatchesQuery, ingredientCoverage, shoppingShortfall, cookPlan } from './dishes.js'
import { ALL_FOODS } from './foods.js'
import ItemModal from './components/ItemModal.jsx'
import DishModal from './components/DishModal.jsx'
import RecipeModal from './components/RecipeModal.jsx'
import TimerBar from './components/TimerBar.jsx'
import TimerModal from './components/TimerModal.jsx'
import CookModal from './components/CookModal.jsx'
import ReceiptReviewModal from './components/ReceiptReviewModal.jsx'
import FoodIdentifyModal from './components/FoodIdentifyModal.jsx'
import Logo from './components/Logo.jsx'
import { Splash, LoginScreen, RebostSelect, RebostMenu } from './components/AuthScreens.jsx'
import Onboarding from './components/Onboarding.jsx'

const TABS = ['foods', 'stock', 'kitchen', 'shopping']
const TAB_LABEL = { stock: 'Estoc', foods: 'Aliments', kitchen: 'Cuina', shopping: 'Compra' }

function tabFromHash(hash) {
  const m = /^#\/(stock|foods|kitchen|shopping)/.exec(hash || '')
  return m ? m[1] : 'stock'
}

function hasModalToken(hash) {
  return /^#\/(stock|foods|kitchen|shopping)\/modal/.test(hash || '')
}

function zeroItem(it) {
  return {
    ...it,
    active: false,
    lots: [{ qty: 0, expiry: null }],
    quantity: 0,
    expiry: null
  }
}

function newId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return 'id-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8)
}

function useCollapsed() {
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

let audioCtx = null
function ensureAudio() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!audioCtx) audioCtx = new Ctx()
    if (audioCtx.state === 'suspended') audioCtx.resume()
    return audioCtx
  } catch (e) { return null }
}

function alarm() {
  const ctx = ensureAudio()
  if (!ctx) return
  try {
    const note = (freq, start, dur, vol) => {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.type = 'sine'
      o.frequency.value = freq
      o.connect(g)
      g.connect(ctx.destination)
      const t = ctx.currentTime + start
      g.gain.setValueAtTime(0.0001, t)
      g.gain.exponentialRampToValueAtTime(vol, t + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
      o.start(t)
      o.stop(t + dur + 0.05)
    }
    for (let i = 0; i < 8; i++) {
      const s = i * 0.55
      note(880, s, 0.3, 0.5)
      note(1175, s + 0.05, 0.3, 0.35)
    }
  } catch (e) { /* sense àudio */ }
}

function requestNotifyPermission() {
  try {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  } catch (e) { /* sense notificacions */ }
}

function vibrateAlarm() {
  if (!('vibrate' in navigator)) return
  const until = Date.now() + 6000
  const id = setInterval(() => {
    const left = until - Date.now()
    if (left <= 0) {
      clearInterval(id)
      navigator.vibrate(0)
      return
    }
    navigator.vibrate(Math.min(1200, left))
  }, 1000)
}

function notifyTimerFinish(label) {
  try {
    if (!('Notification' in window) || Notification.permission !== 'granted') return
    closeTimerNotification('el-rebost-timer')
    const options = {
      body: label || 'El temporitzador ha arribat a 0.',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: 'el-rebost-timer-done',
      renotify: true,
      vibrate: [500, 200, 500, 200, 500, 200, 500, 200, 500, 200, 1000]
    }
    if (navigator.serviceWorker && navigator.serviceWorker.ready) {
      navigator.serviceWorker.ready.then((reg) => reg.showNotification('⏰ Temps acabat', options))
    } else {
      new Notification('⏰ Temps acabat', options)
    }
  } catch (e) { /* sense notificacions */ }
}

function showTimerNotification(body, silent) {
  try {
    if (!('Notification' in window) || Notification.permission !== 'granted') return
    const options = {
      body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: 'el-rebost-timer',
      silent: !!silent,
      renotify: false
    }
    if (navigator.serviceWorker && navigator.serviceWorker.ready) {
      navigator.serviceWorker.ready.then((reg) => reg.showNotification('El Rebost', options))
    } else {
      new Notification('El Rebost', options)
    }
  } catch (e) { /* sense notificacions */ }
}

function closeTimerNotification(tag) {
  try {
    if (!navigator.serviceWorker || !navigator.serviceWorker.ready) return
    navigator.serviceWorker.ready.then((reg) =>
      reg.getNotifications({ tag }).then((list) => list.forEach((n) => n.close()))
    )
  } catch (e) { /* sense notificacions */ }
}

function useTimer(onFinish) {
  const [timer, setTimer] = useState(null)
  const onFinishRef = useRef(onFinish)
  onFinishRef.current = onFinish
  const prevRunning = useRef(null)

  useEffect(() => {
    if (!timer || !timer.running) return undefined
    const id = setInterval(() => {
      setTimer((t) => {
        if (!t || !t.running) return t
        const remaining = t.deadline - Date.now()
        if (remaining <= 0) return { ...t, running: false, remaining: 0, deadline: null }
        return { ...t, remaining }
      })
    }, 250)
    return () => clearInterval(id)
  }, [timer && timer.running])

  useEffect(() => {
    const wasRunning = prevRunning.current
    prevRunning.current = timer ? timer.running : null
    if (timer && wasRunning === true && timer.running === false && timer.remaining === 0) {
      onFinishRef.current && onFinishRef.current(timer.label)
    }
  }, [timer])

  const start = (ms, label) => {
    ensureAudio()
    requestNotifyPermission()
    setTimer({
      total: Math.max(0, ms),
      deadline: Date.now() + Math.max(0, ms),
      remaining: Math.max(0, ms),
      running: true,
      label: label || null
    })
  }
  const pause = () => setTimer((t) => (t && t.running ? { ...t, running: false, remaining: Math.max(0, t.deadline - Date.now()), deadline: null } : t))
  const resume = () => setTimer((t) => (t && !t.running && t.remaining > 0 ? { ...t, running: true, deadline: Date.now() + t.remaining } : t))
  const restart = () => setTimer((t) => (t && t.total > 0 ? { ...t, running: true, deadline: Date.now() + t.total, remaining: t.total } : t))
  const stop = () => setTimer(null)
  const edit = (ms) => setTimer((t) => (t ? { ...t, total: Math.max(0, ms), remaining: Math.max(0, ms), running: false, deadline: null } : t))

  return { timer, start, pause, resume, restart, stop, edit }
}

function MainApp({ data, save, rebostName, onOpenMenu }) {
  const [tab, setTab] = useState(() => tabFromHash(window.location.hash))
  const [modal, setModal] = useState(null) // { type: 'item', item? } | { type: 'dish', dish } | { type: 'recipe', recipe? }
  const [stockQuery, setStockQuery] = useState('')
  const [stockFilter, setStockFilter] = useState('Totes')
  const [toast, setToast] = useState(null) // { id, message, action? }
  const [confirm, setConfirm] = useState(null) // { title, message, onConfirm }
  const [timerOpen, setTimerOpen] = useState(false)
  const [mealOpen, setMealOpen] = useState(false)
  const [cook, setCook] = useState(null) // { dish, plan, fromMenu }
  const [receipt, setReceipt] = useState(null) // { items: [...] }
  const [receiptLoading, setReceiptLoading] = useState(false)
  const [receiptSource, setReceiptSource] = useState(null) // 'camera' | 'gallery'
  const receiptCameraRef = useRef(null)
  const receiptGalleryRef = useRef(null)
  const [identifyOpen, setIdentifyOpen] = useState(false)
  const [identifyMode, setIdentifyMode] = useState(null) // 'camera' | 'gallery'
  const toastTimer = useRef(null)

  const showToast = (message, action) => {
    setToast({ id: Date.now(), message, action })
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 3500)
  }

  const timerCtrl = useTimer((label) => {
    alarm()
    vibrateAlarm()
    notifyTimerFinish(label)
    showToast(label ? `⏰ Temps acabat: ${label}` : '⏰ Temps acabat!')
  })

  useEffect(() => {
    const t = timerCtrl.timer
    if (!t || !t.running) return undefined
    const deadline = t.deadline
    const label = t.label
    const notify = () => {
      const ms = Math.max(0, deadline - Date.now())
      const total = Math.round(ms / 1000)
      const m = Math.floor(total / 60)
      const s = String(total % 60).padStart(2, '0')
      showTimerNotification(`${label ? label + ' · ' : ''}Queden ${m}:${s}`, true)
    }
    notify()
    const id = setInterval(notify, 1000)
    return () => {
      clearInterval(id)
      closeTimerNotification('el-rebost-timer')
    }
  }, [timerCtrl.timer && timerCtrl.timer.running, timerCtrl.timer && timerCtrl.timer.deadline])

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
  }, [])

  useEffect(() => {
    if (!window.location.hash) window.history.replaceState(null, '', '#/stock')
  }, [])

  useEffect(() => {
    const onHashChange = () => {
      setTab(tabFromHash(window.location.hash))
      if (!hasModalToken(window.location.hash)) setModal(null)
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  const goTab = (t) => {
    setTab(t)
    setModal(null)
    window.history.pushState(null, '', `#/${t}`)
  }

  const openModal = (m) => {
    setModal(m)
    window.history.pushState(null, '', `#/${tab}/modal`)
  }

  const closeModal = () => {
    setModal(null)
    window.history.replaceState(null, '', `#/${tab}`)
  }

  const rawItems = data && Array.isArray(data.items) ? data.items : []
  const items = rawItems.map(normalizeItem)
  const activeItems = items.filter((it) => it.active !== false)
  const recipes = data && Array.isArray(data.recipes) ? data.recipes : []
  const mealPlan = data && Array.isArray(data.mealPlan) ? data.mealPlan : []

  const dataRef = useRef(null)
  dataRef.current = data

  const mutate = (fn) => {
    const base = dataRef.current && Array.isArray(dataRef.current.items) ? dataRef.current.items : []
    const next = fn(base)
    dataRef.current = { ...(dataRef.current || {}), items: next }
    save({ items: next }).catch((err) => console.error('save', err))
  }

  const addItem = (fields) => mutate((list) => [
    ...list,
    { id: newId(), ...finalizeItem(fields) }
  ])

  const updateItem = (id, fields) => mutate((list) =>
    list.map((it) => (it.id === id ? { ...it, ...finalizeItem(fields) } : it))
  )

  const removeItem = (id) => {
    const index = rawItems.findIndex((it) => it.id === id)
    const removed = rawItems[index]
    mutate((list) => list.filter((it) => it.id !== id))
    showToast('Aliment eliminat', {
      label: 'Desfer',
      onClick: () => {
        mutate((list) => {
          const next = [...list]
          next.splice(Math.min(Math.max(index, 0), next.length), 0, removed)
          return next
        })
        showToast('Aliment restaurat')
      }
    })
  }

  const requestDeleteItem = (item) => {
    setConfirm({
      title: 'Eliminar aliment',
      message: `Esborrarà "${item.name}" de l'estoc. Ho pots desfer.`,
      onConfirm: () => { setConfirm(null); removeItem(item.id) }
    })
  }

  const deactivateItem = (id) => {
    mutate((list) => list.map((it) => (it.id === id ? zeroItem(it) : it)))
    showToast("Aliment tret de l'estoc")
  }

  const changeQuantity = (id, delta) => mutate((list) =>
    list.map((it) => {
      if (it.id !== id) return it
      const norm = normalizeItem(it)
      const lots = norm.lots.map((lot, i) => (i === 0 ? { ...lot, qty: Math.max(0, lot.qty + delta) } : lot))
      return { ...it, lots, quantity: totalQty(lots), expiry: minExpiry(lots) }
    })
  )

  const toggleShoppingList = (id) => mutate((list) =>
    list.map((it) => {
      if (it.id !== id) return it
      if (it.onShoppingList) return { ...it, onShoppingList: false }
      return { ...it, onShoppingList: true, toBuy: it.toBuy != null ? it.toBuy : 1 }
    })
  )

  const changeToBuy = (id, delta) => mutate((list) =>
    list.map((it) => {
      if (it.id !== id) return it
      const base = it.toBuy != null ? it.toBuy : 1
      return { ...it, toBuy: Math.max(1, Math.round(base + delta)) }
    })
  )

  const toggleActive = (id) => mutate((list) =>
    list.map((it) => {
      if (it.id !== id) return it
      if (it.active === false) return { ...it, active: true }
      return zeroItem(it)
    })
  )

  const snapshotItems = (list) =>
    list.map((it) => ({ ...it, lots: Array.isArray(it.lots) ? it.lots.map((l) => ({ ...l })) : it.lots }))

  const restoreSnapshot = (snap) => (list) =>
    list.map((it) => {
      const orig = snap.find((p) => p.id === it.id)
      return orig ? { ...orig } : it
    })

  const setCategoryActive = (category, active) => {
    const prev = snapshotItems(rawItems.filter((it) => it.category === category))
    mutate((list) =>
      list.map((it) => {
        if (it.category !== category) return it
        if (active) return { ...it, active: true }
        return zeroItem(it)
      })
    )
    showToast(active ? `${category}: tot activat` : `${category}: tot desactivat`, {
      label: 'Desfer',
      onClick: () => {
        mutate(restoreSnapshot(prev))
        showToast('Canvis desfets')
      }
    })
  }

  const setAllActive = (active) => {
    const prev = snapshotItems(rawItems)
    mutate((list) =>
      list.map((it) => (active ? { ...it, active: true } : zeroItem(it)))
    )
    showToast(active ? 'Tots els aliments activats' : 'Tots els aliments desactivats', {
      label: 'Desfer',
      onClick: () => {
        mutate(restoreSnapshot(prev))
        showToast('Canvis desfets')
      }
    })
  }

  const addSuggestedFood = (food) => {
    addItem({ name: food.name, category: food.category, quantity: 0 })
    showToast(`"${food.name}" afegit al catàleg`)
  }

  const bought = (id) => mutate((list) =>
    list.map((it) => {
      if (it.id !== id) return it
      const norm = normalizeItem(it)
      const extra = it.toBuy != null ? it.toBuy : parseQuantity(it.shoppingNote)
      const lots = norm.lots.map((lot, i) => (i === 0 ? { ...lot, qty: lot.qty + extra } : lot))
      return { ...it, active: true, lots, quantity: totalQty(lots), expiry: minExpiry(lots), onShoppingList: false, shoppingNote: null, toBuy: null }
    })
  )

  const clearShoppingList = () => {
    const removed = rawItems.filter((it) => it.onShoppingList).map((it) => ({ ...it }))
    mutate((list) => list.map((it) => ({ ...it, onShoppingList: false, shoppingNote: null, toBuy: null })))
    showToast('Llista de la compra buidada', {
      label: 'Desfer',
      onClick: () => {
        mutate((list) => list.map((it) => {
          const orig = removed.find((r) => r.id === it.id)
          return orig ? { ...it, onShoppingList: orig.onShoppingList, shoppingNote: orig.shoppingNote, toBuy: orig.toBuy } : it
        }))
        showToast('Llista restaurada')
      }
    })
  }

  const setPrice = (id, price) => mutate((list) =>
    list.map((it) => (it.id === id ? { ...it, price } : it))
  )

  const buyAll = (ids) => {
    const set = new Set(ids)
    mutate((list) => list.map((it) => {
      if (!set.has(it.id)) return it
      const norm = normalizeItem(it)
      const extra = it.toBuy != null ? it.toBuy : parseQuantity(it.shoppingNote)
      const lots = norm.lots.map((lot, i) => (i === 0 ? { ...lot, qty: lot.qty + extra } : lot))
      return { ...it, active: true, lots, quantity: totalQty(lots), expiry: minExpiry(lots), onShoppingList: false, shoppingNote: null, toBuy: null }
    }))
    showToast(ids.length === 1 ? 'Producte comprat' : `${ids.length} productes comprats`)
  }

  const requestClearShopping = () => {
    setConfirm({
      title: 'Buida la llista',
      message: 'Es trauran tots els productes de la llista de la compra. Ho pots desfer.',
      onConfirm: () => { setConfirm(null); clearShoppingList() }
    })
  }

  const mutateRecipes = (fn) => {
    const base = dataRef.current && Array.isArray(dataRef.current.recipes) ? dataRef.current.recipes : []
    const next = fn(base)
    dataRef.current = { ...(dataRef.current || {}), recipes: next }
    save({ recipes: next }).catch((err) => console.error('save', err))
  }

  const addRecipe = (recipe) => mutateRecipes((list) => [...list, { id: newId(), user: true, ...recipe }])

  const updateRecipe = (id, fields) => mutateRecipes((list) =>
    list.map((r) => (r.id === id ? { ...r, ...fields } : r))
  )

  const removeRecipe = (id) => {
    const index = recipes.findIndex((r) => r.id === id)
    const removed = recipes[index]
    mutateRecipes((list) => list.filter((r) => r.id !== id))
    showToast('Recepta eliminada', {
      label: 'Desfer',
      onClick: () => {
        mutateRecipes((list) => {
          const next = [...list]
          next.splice(Math.min(Math.max(index, 0), next.length), 0, removed)
          return next
        })
        showToast('Recepta restaurada')
      }
    })
  }

  const requestDeleteRecipe = (recipe) => {
    setConfirm({
      title: 'Eliminar recepta',
      message: `Esborrarà "${recipe.name}". Ho pots desfer.`,
      onConfirm: () => { setConfirm(null); removeRecipe(recipe.id) }
    })
  }

  const saveMealPlan = (plan) => {
    dataRef.current = { ...(dataRef.current || {}), mealPlan: plan }
    save({ mealPlan: plan }).catch((err) => console.error('save', err))
  }

  const addMissingToShopping = (dish, servings) => mutate((list) => {
    const factor = servings / 2
    let result = list
    const toBuy = shoppingShortfall(list.map(normalizeItem), dish, factor)
    for (const ingredient of toBuy) {
      const newLine = ingredient.line
      const existing = result.find((it) => sameProduct(it.name, ingredient.label))
      if (existing) {
        result = result.map((it) =>
          it.id === existing.id
            ? { ...it, onShoppingList: true, shoppingNote: combineShoppingNote(it.shoppingNote, newLine) }
            : it
        )
      } else {
        const category = categoryForName(ingredient.label)
        result = [...result, finalizeItem({
          id: newId(),
          name: ingredient.label,
          category,
          quantity: 0,
          onShoppingList: true,
          shoppingNote: newLine
        })]
      }
    }
    return result
  })

  const openCook = (dish, fromMenu) => {
    setCook({ dish, plan: cookPlan(activeItems, dish), fromMenu })
  }

  const applyCook = (rows) => {
    mutate((list) => {
      let result = list.map((it) => ({ ...it }))
      for (const row of rows) {
        if (!(row.amount > 0)) continue
        result = result.map((it) => {
          if (it.id !== row.itemId) return it
          const norm = normalizeItem(it)
          let remaining = row.amount
          const lots = norm.lots.map((lot) => {
            if (remaining <= 0) return lot
            const take = Math.min(lot.qty, remaining)
            remaining -= take
            return { ...lot, qty: Math.max(0, Math.round((lot.qty - take) * 100) / 100) }
          })
          const qty = totalQty(lots)
          return { ...it, lots, quantity: qty, expiry: minExpiry(lots), active: qty > 0 }
        })
      }
      return result
    })
  }

  const markDayDone = (index) => {
    saveMealPlan(mealPlan.map((entry, i) => (i === index ? { ...entry, done: true } : entry)))
  }

  const confirmCook = (rows) => {
    const used = rows.filter((r) => r.amount > 0).length
    applyCook(rows)
    if (cook.fromMenu != null) markDayDone(cook.fromMenu)
    setCook(null)
    showToast(used > 0 ? `${used} ingredient${used === 1 ? '' : 's'} restat${used === 1 ? '' : 's'} de l'estoc` : 'Cap ingredient restat')
  }

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

  const stockCount = activeItems.length
  const expiringCount = activeItems.filter((it) => it.expiry && expiryStatus(it.expiry) !== EXPIRY.OK).length
  const shoppingCount = items.filter((it) => it.onShoppingList).length

  const scored = useMemo(() => {
    const all = [...DISHES, ...recipes]
    return all.map((dish) => {
      const missing = missingIngredients(activeItems, dish)
      const expiring = dish.ingredients.filter((ing) =>
        activeItems.some((it) => it.quantity > 0 && it.expiry && expiryStatus(it.expiry) !== EXPIRY.OK && have([it], ing))
      ).length
      return { dish, missingCount: missing.length, expiring }
    }).sort((a, b) => {
      if ((a.expiring === 0) !== (b.expiring === 0)) return a.expiring === 0 ? 1 : -1
      return a.missingCount - b.missingCount
    })
  }, [activeItems, recipes])
  const readyCount = scored.filter((s) => s.missingCount === 0).length
  const almostCount = scored.filter((s) => s.missingCount > 0 && s.missingCount <= 2).length
  const plannedCount = mealPlan.filter((e) => e && e.key).length

  const addWeekToShopping = () => {
    const planned = mealPlan.filter((e) => e && e.key && !e.done)
    let added = 0
    for (const entry of planned) {
      const s = scored.find((sc) => dishKey(sc.dish) === entry.key)
      if (!s) continue
      added += shoppingShortfall(activeItems.map(normalizeItem), s.dish, 1).length
      addMissingToShopping(s.dish, 2)
    }
    setMealOpen(false)
    goTab('shopping')
    showToast(added > 0
      ? `${added} ingredient${added === 1 ? '' : 's'} afegit${added === 1 ? '' : 's'} a la compra`
      : 'Ja tens tot el que cal')
  }

  const title = TAB_LABEL[tab]
  const subtitle = {
    stock: `${stockCount} productes` + (expiringCount > 0 ? ` · ${expiringCount} caduquen aviat` : ''),
    foods: `${items.length} aliments al catàleg`,
    kitchen: `Pots fer: ${readyCount} · Gairebé: ${almostCount}`,
    shopping: `${shoppingCount} productes`
  }[tab]

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <Logo size={40} />
          <div>
            <h1>El Rebost</h1>
            <div className="sub">
              <span className="sub-rebost">{rebostName}</span>
              <span className="sub-title">{title}</span>
              <span className="sub-detail">{subtitle}</span>
            </div>
          </div>
        </div>
        <div className="header-actions">
          <button className="icon-btn header-menu" onClick={() => setTimerOpen(true)} aria-label="Temporitzador" title="Temporitzador">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
              <circle cx="12" cy="12" r="9" />
              <polyline points="12 7 12 12 15 14" />
            </svg>
          </button>
          <button className="icon-btn header-menu" onClick={() => setMealOpen(true)} aria-label="Menú de la setmana" title="Menú de la setmana">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
              <rect x="3" y="4" width="18" height="17" rx="2" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          </button>
          <button className="icon-btn header-menu" onClick={onOpenMenu} aria-label="Gestionar rebosts" title="Gestionar rebosts">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" focusable="false">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
        </div>
      </header>

      <div className="tabs">
        {TABS.map((t) => (
          <button key={t} className={tab === t ? 'active' : ''} onClick={() => goTab(t)}>
            {TAB_LABEL[t]}
            {t === 'stock' && <span className="tab-count">{stockCount}</span>}
            {t === 'foods' && <span className="tab-count">{items.length}</span>}
            {t === 'kitchen' && <span className="tab-count">{readyCount}</span>}
            {t === 'shopping' && <span className="tab-count">{shoppingCount}</span>}
          </button>
        ))}
      </div>

      <main className="content">
        {tab === 'stock' ? (
          <StockTab
            items={activeItems}
            query={stockQuery}
            onQueryChange={setStockQuery}
            filter={stockFilter}
            onFilterChange={setStockFilter}
            onChangeQuantity={changeQuantity}
            onToggleShopping={toggleShoppingList}
            onChangeToBuy={changeToBuy}
            onEdit={(it) => openModal({ type: 'item', item: it, source: 'stock' })}
            onDelete={(it) => deactivateItem(it.id)}
          />
        ) : tab === 'foods' ? (
          <FoodsTab
            items={items}
            onToggleActive={toggleActive}
            onSetCategoryActive={setCategoryActive}
            onSetAllActive={setAllActive}
            onAddSuggested={addSuggestedFood}
            onEdit={(it) => openModal({ type: 'item', item: it, source: 'foods' })}
            onDelete={requestDeleteItem}
          />
        ) : tab === 'kitchen' ? (
          <KitchenTab
            scored={scored}
            items={activeItems}
            onDishClick={(d) => openModal({ type: 'dish', dish: d })}
            onEditRecipe={(r) => openModal({ type: 'recipe', recipe: r })}
            onDeleteRecipe={requestDeleteRecipe}
          />
        ) : (
          <ShoppingTab
            items={items}
            onBought={(id) => { bought(id); showToast('Producte comprat') }}
            onBuyAll={buyAll}
            onClear={requestClearShopping}
            onSetPrice={setPrice}
          />
        )}
      </main>

      {(tab === 'stock' || tab === 'foods' || tab === 'kitchen') && (
        <button
          className="fab"
          onClick={() => openModal(tab === 'kitchen' ? { type: 'recipe', recipe: null } : { type: 'item', item: null, source: tab })}
          aria-label={tab === 'kitchen' ? 'Afegeix recepta' : 'Afegeix aliment'}
        >+</button>
      )}

      {tab === 'stock' && (
        <button
          className="fab fab-secondary"
          onClick={() => setReceiptSource(receiptSource ? null : 'pick')}
          disabled={receiptLoading}
          aria-label="Escaneja ticket o identifica aliment"
          title="Escaneja ticket o identifica aliment"
        >
          {receiptLoading ? (
            <span className="fab-spinner" />
          ) : (
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
          )}
        </button>
      )}

      {receiptSource === 'pick' && (
        <div className="receipt-source-popup" onClick={() => setReceiptSource(null)}>
          <div className="receipt-source-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="receipt-source-section">
              <span className="receipt-source-section-label">Ticket de compra</span>
              <button className="receipt-source-btn" onClick={() => { setReceiptSource(null); receiptCameraRef.current?.click() }}>
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                Fer una foto
              </button>
              <button className="receipt-source-btn" onClick={() => { setReceiptSource(null); receiptGalleryRef.current?.click() }}>
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                Triar de la galeria
              </button>
            </div>
            <div className="receipt-source-divider" />
            <div className="receipt-source-section">
              <span className="receipt-source-section-label">Identificar aliment</span>
              <button className="receipt-source-btn" onClick={() => { setReceiptSource(null); setIdentifyOpen(true); setIdentifyMode('camera') }}>
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                Fer una foto
              </button>
              <button className="receipt-source-btn" onClick={() => { setReceiptSource(null); setIdentifyOpen(true); setIdentifyMode('gallery') }}>
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                Triar de la galeria
              </button>
            </div>
          </div>
        </div>
      )}

      <input
        ref={receiptCameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleReceiptFile}
        style={{ display: 'none' }}
      />
      <input
        ref={receiptGalleryRef}
        type="file"
        accept="image/*"
        onChange={handleReceiptFile}
        style={{ display: 'none' }}
      />

      {modal && modal.type === 'item' && (
        <ItemModal
          item={modal.item}
          allowExpiry={modal.source !== 'foods'}
          initialCategory={CATEGORIES.includes(stockFilter) ? stockFilter : undefined}
          onClose={closeModal}
          onSave={(fields) => {
            if (modal.item) {
              updateItem(modal.item.id, fields)
              showToast('Canvis desats')
            } else {
              addItem(fields)
              showToast('Aliment afegit')
            }
            closeModal()
          }}
        />
      )}

      {modal && modal.type === 'dish' && (
        <DishModal
          dish={modal.dish}
          stock={activeItems}
          onClose={closeModal}
          onCook={(dish) => {
            closeModal()
            openCook(dish, null)
          }}
          onAddToShopping={(dish, servings) => {
            addMissingToShopping(dish, servings)
            closeModal()
            setMealOpen(false)
            goTab('shopping')
            showToast('Afegit a la llista de la compra')
          }}
        />
      )}

      {modal && modal.type === 'recipe' && (
        <RecipeModal
          recipe={modal.recipe}
          onClose={closeModal}
          onSave={(recipe) => {
            if (modal.recipe) {
              updateRecipe(modal.recipe.id, recipe)
              showToast('Recepta desada')
            } else {
              addRecipe(recipe)
              showToast('Recepta afegida')
            }
            closeModal()
          }}
        />
      )}

      {confirm && (
        <ConfirmDialog
          title={confirm.title}
          message={confirm.message}
          onCancel={() => setConfirm(null)}
          onConfirm={confirm.onConfirm}
        />
      )}

      {cook && (
        <CookModal
          dish={cook.dish}
          plan={cook.plan}
          onClose={() => setCook(null)}
          onConfirm={confirmCook}
        />
      )}

      {receipt && (
        <ReceiptReviewModal
          items={receipt.items}
          ocrText={receipt.text}
          stockItems={rawItems}
          onClose={() => setReceipt(null)}
          onConfirm={confirmReceipt}
        />
      )}

      {identifyOpen && (
        <FoodIdentifyModal
          stockItems={rawItems}
          mode={identifyMode}
          onClose={() => { setIdentifyOpen(false); setIdentifyMode(null) }}
          onConfirm={confirmIdentify}
        />
      )}

      {timerCtrl.timer && (
        <TimerBar
          timer={timerCtrl.timer}
          onPause={timerCtrl.pause}
          onResume={timerCtrl.resume}
          onRestart={timerCtrl.restart}
          onStop={timerCtrl.stop}
          onEdit={timerCtrl.edit}
        />
      )}

      {timerOpen && (
        <TimerModal
          onStart={(ms, label) => {
            timerCtrl.start(ms, label)
            setTimerOpen(false)
          }}
          onClose={() => setTimerOpen(false)}
        />
      )}

      {mealOpen && (
        <div className="modal-backdrop meal-backdrop" onClick={() => setMealOpen(false)}>
          <div className="modal mealplan-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h2>Menú de la setmana</h2>
              <button className="icon-btn" onClick={() => setMealOpen(false)} aria-label="Tanca">✕</button>
            </div>
            <p className="desc">
              {plannedCount > 0
                ? `${plannedCount} àpat${plannedCount === 1 ? '' : 's'} planificat${plannedCount === 1 ? '' : 's'}`
                : 'Planifica els pròxims 7 àpats aprofitant el que tens.'}
            </p>
            <MenuTab
              scored={scored}
              mealPlan={mealPlan}
              onSaveMealPlan={saveMealPlan}
              onNotify={showToast}
              onViewDish={(dish) => {
                openModal({ type: 'dish', dish })
              }}
              onCook={(dish, index) => {
                openCook(dish, index)
              }}
              onAddToShopping={addWeekToShopping}
            />
          </div>
        </div>
      )}

      {toast && (
        <div className="toast" key={toast.id} role="status">
          <span>{toast.message}</span>
          {toast.action && (
            <button
              className="toast-action"
              onClick={() => {
                setToast(null)
                toast.action.onClick()
              }}
            >
              {toast.action.label}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function expiryLine(item) {
  return item.expiry ? ` · Caduca el ${formatExpiry(item.expiry)}` : ''
}

function expiryTag(item) {
  if (!item.expiry) return null
  const st = expiryStatus(item.expiry)
  if (st === EXPIRY.EXPIRED) return <span className="tag tag-expired">Caducat</span>
  if (st === EXPIRY.SOON) return <span className="tag tag-soon">Aviat</span>
  return null
}

function StockTab({ items, query, onQueryChange, filter, onFilterChange, onChangeQuantity, onToggleShopping, onChangeToBuy, onEdit, onDelete }) {
  const [collapsed, toggle] = useCollapsed()
  const sorted = [...items].sort((a, b) => {
    if ((a.expiry == null) !== (b.expiry == null)) return a.expiry == null ? 1 : -1
    return (a.expiry || Number.MAX_SAFE_INTEGER) - (b.expiry || Number.MAX_SAFE_INTEGER)
      || a.name.localeCompare(b.name)
  })
  const shown = query
    ? sorted.filter((it) => it.name.toLowerCase().includes(query.trim().toLowerCase()))
    : sorted
  const filtered = shown.filter((it) => {
    if (filter === 'Per comprar') return it.onShoppingList
    if (filter === 'Caduca aviat') return it.expiry && expiryStatus(it.expiry) !== EXPIRY.OK
    return filter === 'Totes' || it.category === filter
  })
  const sections = CATEGORIES
    .filter((c) => filter === 'Totes' || ['Per comprar', 'Caduca aviat'].includes(filter) || c === filter)
    .map((c) => [c, filtered.filter((it) => it.category === c)])
    .filter(([, list]) => list.length > 0)
  const multi = !CATEGORIES.includes(filter)

  if (shown.length === 0 || (filtered.length === 0 && filter !== 'Totes')) {
    const emptyMessage = shown.length === 0
      ? (query ? `No s'ha trobat cap aliment per "${query}".` : 'Encara no tens aliments. Toca + per afegir-ne.')
      : (filter === 'Per comprar' ? 'No tens cap aliment a la llista de la compra.' : 'No tens cap aliment a punt de caducar.')
    return (
      <>
        <input
          className="search"
          placeholder="Cercar aliment"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
        />
        <div className="chip-row">
          {['Totes', 'Per comprar', 'Caduca aviat', ...CATEGORIES].map((c) => (
            <button key={c} className={'chip' + (filter === c ? ' active' : '')} onClick={() => onFilterChange(c)}>
              {CATEGORIES.includes(c) && <span className="cat-dot" style={{ background: categoryColor(c) }} />}
              {c}
            </button>
          ))}
        </div>
        <div className="empty">
          <div className="big">🧺</div>
          {emptyMessage}
        </div>
      </>
    )
  }

  return (
    <>
      <input
        className="search"
        placeholder="Cercar aliment"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
      />
      <div className="chip-row">
        {['Totes', 'Per comprar', 'Caduca aviat', ...CATEGORIES].map((c) => (
          <button key={c} className={'chip' + (filter === c ? ' active' : '')} onClick={() => onFilterChange(c)}>
            {CATEGORIES.includes(c) && <span className="cat-dot" style={{ background: categoryColor(c) }} />}
            {c}
          </button>
        ))}
      </div>
      {sections.map(([cat, list]) => (
        <div key={cat}>
          <div
            className={'section-header' + (multi ? ' collapsible' + (collapsed.has(cat) ? ' collapsed' : '') : '')}
            onClick={multi ? () => toggle(cat) : undefined}
          >
            <span className="category-header">
              <span className="cat-dot" style={{ background: categoryColor(cat) }} />
              {cat}
              {multi && <span className="collapse-arrow">▾</span>}
            </span>
            <span className="section-count">{list.length}</span>
          </div>
          {(!multi || !collapsed.has(cat)) && list.map((item) => (
            <div key={item.id} className="card">
              <button
                className={'check' + (item.onShoppingList ? ' checked' : '')}
                onClick={() => onToggleShopping(item.id)}
                aria-label="Llista de la compra"
                title="Llista de la compra"
              >✓</button>
              <div className="card-text">
                <div className="card-title">
                  {item.name}
                  {expiryTag(item)}
                </div>
                <div className="card-sub">
                  {item.category}{expiryLine(item)}
                  {item.quantity <= 0 && <span style={{ color: 'var(--danger)' }}> · Cal comprar-ne</span>}
                  {item.onShoppingList && item.shoppingNote && (
                    <span style={{ color: 'var(--green-dark)' }}> · Per comprar: {item.shoppingNote}</span>
                  )}
                </div>
              </div>
              <div className="controls-col">
                <div className="qty-controls">
                  <button onClick={() => onChangeQuantity(item.id, -1)} disabled={item.quantity <= 0}>−</button>
                  <button
                    className="qty-display"
                    onClick={() => onEdit(item)}
                    title="Toca per editar la quantitat"
                    aria-label={`Editar ${item.name}`}
                  >
                    {formatQty(item.quantity)}{item.unit !== 'u' ? ` ${UNIT_LABEL[item.unit]}` : ''}
                  </button>
                  <button onClick={() => onChangeQuantity(item.id, 1)}>+</button>
                </div>
                {item.onShoppingList && (
                  <div className="buy-controls">
                    <span>Comprar</span>
                    <button onClick={() => onChangeToBuy(item.id, -1)} aria-label="Menys per comprar">−</button>
                    <span className="buy-qty">{formatQty(item.toBuy != null ? item.toBuy : 1)}{item.unit !== 'u' ? ` ${UNIT_LABEL[item.unit]}` : ''}</span>
                    <button onClick={() => onChangeToBuy(item.id, 1)} aria-label="Més per comprar">+</button>
                  </div>
                )}
              </div>
              <ItemMenu onEdit={() => onEdit(item)} onDelete={() => onDelete(item)} deleteLabel="Treu de l'estoc" destructive={false} />
            </div>
          ))}
        </div>
      ))}
    </>
  )
}

function FoodsTab({ items, onToggleActive, onSetCategoryActive, onSetAllActive, onAddSuggested, onEdit, onDelete }) {
  const [collapsed, toggle] = useCollapsed()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('Totes')
  const q = query.trim().toLowerCase()
  const present = new Set(items.map((it) => normalize(it.name)))
  const suggestions = ALL_FOODS.filter((f) => !present.has(normalize(f.name)))
  const catalog = [
    ...items.map((it) => ({ ...it, suggestion: false })),
    ...suggestions.map((f) => ({ id: null, name: f.name, category: f.category, suggestion: true, active: true }))
  ]
  const allActive = items.length > 0 && items.every((it) => it.active !== false)
  const matches = (name) => !q || name.toLowerCase().includes(q)
  const sections = CATEGORIES
    .filter((c) => filter === 'Totes' || c === filter)
    .map((c) => [c, catalog.filter((it) => it.category === c && matches(it.name)).sort((a, b) => a.name.localeCompare(b.name))])
    .filter(([, list]) => list.length > 0)
  const multi = filter === 'Totes'

  const searchAndChips = (
    <>
      <input
        className="search"
        placeholder="Cercar aliments"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="chip-row">
        {['Totes', ...CATEGORIES].map((c) => (
          <button key={c} className={'chip' + (filter === c ? ' active' : '')} onClick={() => setFilter(c)}>
            {CATEGORIES.includes(c) && <span className="cat-dot" style={{ background: categoryColor(c) }} />}
            {c}
          </button>
        ))}
      </div>
      <div className="foods-hint">
        Activa l'interruptor dels aliments que fas servir cada dia: només aquests es mostraran a l'Estoc.
      </div>
    </>
  )

  if (sections.length === 0) {
    return (
      <>
        {searchAndChips}
        <div className="empty">
          <div className="big">🥕</div>
          No s'ha trobat cap aliment per "{query}".
        </div>
      </>
    )
  }

  return (
    <>
      {searchAndChips}
      {filter === 'Totes' && (
        <div className="foods-toolbar">
          <div className="foods-toolbar-head">
            <span className="foods-toolbar-title">Tots els aliments</span>
            <button className="btn btn-secondary btn-slim" onClick={() => onSetAllActive(!allActive)}>
              {allActive ? 'Desactiva totes' : 'Activa totes'}
            </button>
          </div>
          <span className="foods-count-line">{items.length} aliments</span>
        </div>
      )}
      {sections.map(([cat, list]) => {
        const own = list.filter((it) => !it.suggestion)
        const catAllActive = own.length > 0 && own.every((it) => it.active !== false)
        return (
          <div key={cat}>
            <div
              className={'section-header' + (multi ? ' collapsible' + (collapsed.has(cat) ? ' collapsed' : '') : '')}
              onClick={multi ? () => toggle(cat) : undefined}
            >
              <span className="category-header">
                <span className="cat-dot" style={{ background: categoryColor(cat) }} />
                {cat}
                {multi && <span className="collapse-arrow">▾</span>}
              </span>
              {own.length > 0 && (
                <button
                  className="btn btn-secondary btn-slim"
                  onClick={(e) => { e.stopPropagation(); onSetCategoryActive(cat, !catAllActive) }}
                >
                  {catAllActive ? `Desactiva ${cat.toLowerCase()}` : `Activa ${cat.toLowerCase()}`}
                </button>
              )}
            </div>
            {(!multi || !collapsed.has(cat)) && <span className="foods-count-line">{list.length} aliments</span>}
            {(!multi || !collapsed.has(cat)) && list.map((item) =>
              item.suggestion ? (
                <div key={'s-' + item.name} className="card food-row food-suggest">
                  <div className="card-text">
                    <div className="card-title">{item.name}</div>
                    <div className="card-sub">No està al teu catàleg</div>
                  </div>
                  <button className="btn btn-secondary btn-slim" onClick={() => onAddSuggested(item)}>+ Afegeix</button>
                </div>
              ) : (
                <div key={item.id} className="card food-row">
                  <button
                    className={'switch' + (item.active !== false ? ' on' : '')}
                    onClick={() => onToggleActive(item.id)}
                    aria-label={item.active !== false ? `Treu ${item.name} de l'estoc` : `Afegeix ${item.name} a l'estoc`}
                  >
                    <span className="switch-knob" />
                  </button>
                  <div className="card-text">
                    <div className="card-title">
                      {item.name}
                      {item.active !== false && item.quantity > 0 && (
                        <span className="tag tag-info">{formatQty(item.quantity)}{item.unit !== 'u' ? ` ${UNIT_LABEL[item.unit]}` : ''}</span>
                      )}
                    </div>
                    <div className="card-sub">
                      {item.active !== false ? "S'usa a l'estoc" : "Amagat de l'estoc"}
                      {item.onShoppingList ? ' · a la llista de la compra' : ''}
                    </div>
                  </div>
              <ItemMenu onEdit={() => onEdit(item)} onDelete={() => onDelete(item)} />
                </div>
              )
            )}
          </div>
        )
      })}
    </>
  )
}

function ItemMenu({ onEdit, onDelete, deleteLabel = 'Eliminar', destructive = true }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="menu">
      <button className="icon-btn" onClick={(e) => { e.stopPropagation(); setOpen(!open) }} aria-label="Més accions">⋮</button>
      {open && (
        <div className="menu-pop">
          <button onClick={(e) => { e.stopPropagation(); setOpen(false); onEdit() }}>Editar</button>
          <button className={destructive ? 'danger' : ''} onClick={(e) => { e.stopPropagation(); setOpen(false); onDelete() }}>{deleteLabel}</button>
        </div>
      )}
    </div>
  )
}

function ConfirmDialog({ title, message, onCancel, onConfirm }) {
  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{title}</h2>
        <p className="desc">{message}</p>
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onCancel}>Cancel·la</button>
          <button className="btn btn-danger" onClick={onConfirm}>Elimina</button>
        </div>
      </div>
    </div>
  )
}

const WEEKDAYS = ['Diumenge', 'Dilluns', 'Dimarts', 'Dimecres', 'Dijous', 'Divendres', 'Dissabte']

function dayLabel(i) {
  const d = new Date()
  d.setDate(d.getDate() + i)
  return WEEKDAYS[d.getDay()]
}

function KitchenTab({ scored, items, onDishClick, onEditRecipe, onDeleteRecipe }) {
  const [collapsed, toggle] = useCollapsed()
  const [filter, setFilter] = useState('Totes')
  const [query, setQuery] = useState('')

  const shown = (filter === 'Es pot fer' ? scored.filter((s) => s.missingCount === 0)
    : filter === 'Gairebé' ? scored.filter((s) => s.missingCount > 0 && s.missingCount <= 2)
    : scored)
    .filter((s) => dishMatchesQuery(s.dish, query))

  const dishGroups = [
    ['Es pot fer', shown.filter((s) => s.missingCount === 0)],
    ['Gairebé', shown.filter((s) => s.missingCount > 0 && s.missingCount <= 2)],
    ['Et falten ingredients', shown.filter((s) => s.missingCount > 2)]
  ].filter(([, list]) => list.length > 0)

  return (
    <>
      <input
        className="search"
        placeholder="Cercar plat"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="kitchen-toolbar">
        <div className="chip-row">
          {['Totes', 'Es pot fer', 'Gairebé'].map((c) => (
            <button key={c} className={'chip' + (filter === c ? ' active' : '')} onClick={() => setFilter(c)}>{c}</button>
          ))}
        </div>
      </div>

      {shown.length === 0 ? (
        <div className="empty">
          <div className="big">🍽️</div>
          {query ? `Cap plat coincideix amb "${query}".` : 'Cap plat coincideix amb aquest filtre.'}
        </div>
      ) : (
        dishGroups.map(([label, list]) => (
          <div key={label}>
            <div
              className={'category-header collapsible' + (collapsed.has('g:' + label) ? ' collapsed' : '')}
              onClick={() => toggle('g:' + label)}
            >
              <span className="cat-dot" style={{ background: 'var(--green)' }} />
              {label}
              <span className="collapse-arrow">▾</span>
              <span className="section-count">{list.length}</span>
            </div>
            {!collapsed.has('g:' + label) && list.map(({ dish, missingCount, expiring }) => (
          <div key={dishKey(dish)} className="card dish-card" onClick={() => onDishClick(dish)}>
            <div className="card-text">
              <div className="card-title">
                {dish.name}
                {missingCount === 0 ? <span className="tag tag-ok">La pots fer</span>
                  : missingCount <= 2 ? <span className="tag tag-soon">Gairebé!</span> : null}
                {dish.user && <span className="tag tag-info">Pròpia</span>}
              </div>
              {expiring > 0 && <div className="tag tag-soon" style={{ marginTop: 6 }}>Aprofita-ho: {expiring} aliment{expiring === 1 ? '' : 's'} a punt de caducar</div>}
              <div className="dish-missing">
                {missingCount === 0 ? 'Tens tots els ingredients.' : `Et falten ${missingCount} ingredient${missingCount === 1 ? '' : 's'}`}
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                {dish.ingredients.map((ing) => {
                  const ok = have(items, ing)
                  const cov = ingredientCoverage(items, ing)
                  const style = ok
                    ? { background: 'var(--green-container)', color: 'var(--on-green-container)' }
                    : { background: 'var(--surface-variant)', color: 'var(--on-surface-variant)' }
                  return (
                    <span key={ing.label} className="tag" style={style}>
                      {!ok ? '✗ ' : cov && cov.ratio < 1 ? `⚠ ${cov.have} de ${cov.need} ` : '✓ '}{ing.label}
                    </span>
                  )
                })}
              </div>
            </div>
            {dish.user && (
              <ItemMenu onEdit={() => onEditRecipe(dish)} onDelete={() => onDeleteRecipe(dish)} />
            )}
          </div>
            ))}
          </div>
        ))
      )}

    </>
  )
}

function MenuTab({ scored, mealPlan, onSaveMealPlan, onNotify, onViewDish, onCook, onAddToShopping }) {
  const [plan, setPlan] = useState(mealPlan)
  const [picking, setPicking] = useState(null)
  const [pickQuery, setPickQuery] = useState('')
  const [confirmClear, setConfirmClear] = useState(false)

  useEffect(() => setPlan(mealPlan), [mealPlan])

  const dishByKey = useMemo(() => {
    const map = {}
    for (const s of scored) map[dishKey(s.dish)] = s
    return map
  }, [scored])

  const savePlan = (next) => {
    setPlan(next)
    onSaveMealPlan(next)
  }

  const generate = () => {
    const next = generateMealPlan(scored, 7)
    while (next.length < 7) next.push({ key: null, name: null, user: false })
    savePlan(next)
    onNotify(next.some((e) => e.key) ? 'Menú generat' : 'No hi ha prou plats')
  }

  const clear = () => {
    savePlan([])
    setConfirmClear(false)
  }

  const choose = (key, name) => {
    const next = plan.map((entry, i) => (i === picking ? { ...entry, key, name, user: key.startsWith('u-') } : entry))
    savePlan(next)
    setPicking(null)
  }

  const removeDay = (i) => {
    savePlan(plan.map((entry, j) => (j === i ? { key: null, name: null, user: false } : entry)))
    onNotify('Dia esborrat del menú')
  }

  const isEmptyPlan = plan.length === 0 || plan.every((e) => !e.key)
  const hasPlan = !isEmptyPlan

  return (
    <>
      <div className="mealplan">
        <div className="mealplan-actions">
          <button className="btn btn-secondary btn-slim" onClick={() => setConfirmClear(true)} disabled={plan.length === 0}>Neteja</button>
          <button className="btn btn-primary btn-slim" onClick={generate}>Genera</button>
        </div>
        {isEmptyPlan ? (
          <div className="mealplan-empty">
            Toca <strong>Genera</strong> per planificar els pròxims 7 dies aprofitant el que tens i el que caduca.
          </div>
        ) : (
          plan.map((entry, i) => {
            const s = entry.key ? dishByKey[entry.key] : null
            return (
              <div key={i} className={`mealplan-day${entry.done ? ' mealplan-day-done' : ''}`}>
                <button className="mealplan-day-main" onClick={() => setPicking(i)}>
                  <span className="mealplan-dayname">{dayLabel(i)}</span>
                  <span className="mealplan-dish">{entry.name || 'Tria un plat'}</span>
                  {s && s.missingCount === 0 && !entry.done && <span className="tag tag-ok">La pots fer</span>}
                  {s && s.missingCount > 0 && s.missingCount <= 2 && !entry.done && <span className="tag tag-soon">Gairebé</span>}
                  {s && s.missingCount > 2 && !entry.done && <span className="tag">{s.missingCount} faltes</span>}
                  {entry.done && <span className="tag tag-done">✓ Fet</span>}
                </button>
                {s && entry.key && !entry.done && (
                  <button className="icon-btn cook-btn" onClick={() => onCook(s.dish, i)} aria-label="Cuina aquest plat" title="Cuina aquest plat">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
                      <path d="M12 2C6.48 2 2 6 2 10c0 2.5 1.5 4.5 3 5.5V20a2 2 0 002 2h10a2 2 0 002-2v-4.5c1.5-1 3-3 3-5.5 0-4-4.48-8-10-8z" />
                      <path d="M12 2v4" />
                      <path d="M9 10h6" />
                    </svg>
                  </button>
                )}
                {s && entry.key && (
                  <button className="icon-btn" onClick={() => onViewDish(s.dish)} aria-label="Veure recepta" title="Veure recepta">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 16v-4" />
                      <path d="M12 8h.01" />
                    </svg>
                  </button>
                )}
                {entry.key && (
                  <button className="icon-btn" onClick={() => removeDay(i)} aria-label="Esborra el dia">✕</button>
                )}
              </div>
            )
          })
        )}
        {hasPlan && (
          <button className="btn btn-primary btn-slim mealplan-shopping" onClick={onAddToShopping}>
            🛒 Afegeix a la compra el que falta
          </button>
        )}
      </div>

      {picking !== null && createPortal(
        <div className="modal-backdrop" onClick={() => setPicking(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Plat per al {dayLabel(picking)}</h2>
            <p className="desc">Tria entre els plats disponibles.</p>
            <input
              className="search pick-search"
              placeholder="Cercar plat"
              value={pickQuery}
              onChange={(e) => setPickQuery(e.target.value)}
            />
            <div className="pick-list">
              {scored.filter((s) => dishMatchesQuery(s.dish, pickQuery)).map((s) => {
                const key = dishKey(s.dish)
                return (
                  <button key={key} className="pick-item" onClick={() => choose(key, s.dish.name)}>
                    <span className="pick-name">{s.dish.name}</span>
                    {s.missingCount === 0
                      ? <span className="tag tag-ok">La pots fer</span>
                      : s.missingCount <= 2
                        ? <span className="tag tag-soon">Gairebé</span>
                        : <span className="tag">{s.missingCount} faltes</span>}
                  </button>
                )
              })}
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setPicking(null)}>Cancel·la</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {confirmClear && createPortal(
        <div className="modal-backdrop" onClick={() => setConfirmClear(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Neteja el menú</h2>
            <p className="desc">Esborrarà tots els plats del menú de la setmana. Aquesta acció no es pot desfer.</p>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setConfirmClear(false)}>Cancel·la</button>
              <button className="btn btn-danger" onClick={clear}>Neteja</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}

export default function App() {
  const { ready: authReady, user } = useAuth()
  const [rebostId, setRebostId] = useState(null)
  const [loginError, setLoginError] = useState(null)
  const [createBusy, setCreateBusy] = useState(false)
  const [joinBusy, setJoinBusy] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuConfirm, setMenuConfirm] = useState(null) // { title, message, rebostId, code }
  const [showOnboarding, setShowOnboarding] = useState(false)

  useEffect(() => {
    if (!user || user.isAnonymous) {
      setRebostId(null)
      return
    }
    setRebostId(getLastRebost(user.uid))
  }, [user ? user.uid : null])

  useEffect(() => {
    if (user && !user.isAnonymous && !localStorage.getItem('elrebost:onboarding:' + user.uid)) {
      setShowOnboarding(true)
    }
  }, [user ? user.uid : null])

  const closeOnboarding = () => {
    if (user) localStorage.setItem('elrebost:onboarding:' + user.uid, '1')
    setShowOnboarding(false)
  }

  const { ready: rebostsReady, rebosts } = useRebosts(user && !user.isAnonymous ? user.uid : null)
  const { ready: dataReady, data } = useRebostData(rebostId)
  const current = rebosts.find((r) => r.id === rebostId)

  useEffect(() => {
    if (current && dataReady && !data) setLastRebost(user.uid, null)
  }, [current, dataReady, data, user])

  const handleLogin = () => {
    setLoginError(null)
    loginWithGoogle().catch((err) => {
      if (err && err.code === 'auth/popup-closed-by-user') return
      console.error('login', err)
      setLoginError('No s\'ha pogut iniciar la sessió. Torna-ho a provar.')
    })
  }

  const enterRebost = (id) => {
    setRebostId(id)
    if (user) setLastRebost(user.uid, id)
  }

  const handleJoin = (code) => {
    setJoinBusy(true)
    return joinRebost(code, user.uid)
      .then((res) => {
        if (!res.error) enterRebost(res.id)
        return res
      })
      .catch((err) => {
        console.error('join', err)
        return { error: 'unknown' }
      })
      .finally(() => setJoinBusy(false))
  }

  const handleCreate = (name) => {
    setCreateBusy(true)
    return createRebost(user.uid, name)
      .then((res) => res)
      .catch((err) => {
        console.error('create', err)
        return null
      })
      .finally(() => setCreateBusy(false))
  }

  const handleRename = (id, name) => renameRebost(id, name)

  const requestDeleteRebost = (r) => {
    setMenuConfirm({
      title: 'Eliminar rebost',
      message: `S'eliminarà el rebost "${r.name}" amb TOT el seu contingut. Aquesta acció no es pot desfer.`,
      rebostId: r.id,
      code: r.code
    })
  }

  const confirmDeleteRebost = () => {
    if (!menuConfirm) return
    const { rebostId, code } = menuConfirm
    deleteRebost(rebostId, code)
      .then(() => {
        setMenuConfirm(null)
        if (rebostId === current?.id) {
          setMenuOpen(false)
          setRebostId(null)
          if (user) setLastRebost(user.uid, null)
        }
      })
      .catch((err) => {
        console.error('delete', err)
        setMenuConfirm(null)
        setMenuOpen(false)
      })
  }

  const renderSelect = () => (
    <>
      <RebostSelect
        rebosts={rebosts}
        onCreate={handleCreate}
        onJoin={handleJoin}
        onSelect={enterRebost}
        onLogout={() => logout()}
        onDeleteAccount={() => deleteAccount(user.uid)}
        busy={createBusy}
        joinBusy={joinBusy}
        userUid={user.uid}
        onRename={handleRename}
      />
      {showOnboarding && <Onboarding onClose={closeOnboarding} />}
    </>
  )

  if (!authReady) return <Splash />
  if (!user || user.isAnonymous) return <LoginScreen onLogin={handleLogin} error={loginError} />
  if (!rebostsReady) return <Splash />
  if (!current || (dataReady && !data)) return renderSelect()
  if (!dataReady) return <Splash />

  const save = (partial) => saveRebost(current.id, partial)

  return (
    <>
      <MainApp
        data={data}
        save={save}
        rebostName={current.name}
        onOpenMenu={() => setMenuOpen(true)}
      />

      {menuOpen && (
        <RebostMenu
          rebosts={rebosts}
          currentId={current.id}
          userUid={user.uid}
          onCreate={handleCreate}
          onJoin={handleJoin}
          onSwitch={(id) => {
            enterRebost(id)
            setMenuOpen(false)
          }}
          onDelete={requestDeleteRebost}
          onRename={handleRename}
          onLogout={() => logout()}
          onDeleteAccount={() => deleteAccount(user.uid)}
          onClose={() => setMenuOpen(false)}
        />
      )}

      {menuConfirm && (
        <ConfirmDialog
          title={menuConfirm.title}
          message={menuConfirm.message}
          onCancel={() => setMenuConfirm(null)}
          onConfirm={confirmDeleteRebost}
        />
      )}

      {showOnboarding && <Onboarding onClose={closeOnboarding} />}
    </>
  )
}

function ShoppingTab({ items, onBought, onBuyAll, onClear, onSetPrice }) {
  const [collapsed, toggle] = useCollapsed()
  const [editingPrice, setEditingPrice] = useState(null)
  const [priceDraft, setPriceDraft] = useState('')
  const shopping = items.filter((it) => it.onShoppingList)
  const sections = CATEGORIES
    .map((c) => [c, shopping.filter((it) => it.category === c).sort((a, b) => a.name.localeCompare(b.name))])
    .filter(([, list]) => list.length > 0)
  const { total, unpriced } = shoppingTotals(shopping)

  const startEditPrice = (item) => {
    const cur = priceFor(item)
    setEditingPrice(item.id)
    setPriceDraft(cur != null ? String(cur) : '')
  }

  const savePrice = (id) => {
    onSetPrice(id, priceDraft.trim() === '' ? null : (parseFloat(priceDraft.replace(',', '.')) || null))
    setEditingPrice(null)
  }

  if (shopping.length === 0) {
    return (
      <div className="empty">
        <div className="big">🛒</div>
        La llista és buida. Marca la cistella d'un aliment per afegir-lo.
      </div>
    )
  }

  return (
    <>
      <div className="section-header">
        <span className="section-title">Per comprar</span>
        <button className="btn btn-secondary" style={{ flex: 'none', padding: '6px 14px' }} onClick={onClear}>Buida</button>
      </div>
      <div className="cart-summary">
        <span className="cart-total">Cost estimat: <strong>{fmtEuro(total)}</strong></span>
        <span className="cart-hint">
          {unpriced > 0 ? `${unpriced} aliment${unpriced === 1 ? '' : 's'} sense preu · ` : ''}
          Preus orientatius · toca un preu per ajustar-lo
        </span>
      </div>
      {sections.map(([cat, list]) => (
        <div key={cat}>
          <div
            className={'category-header collapsible' + (collapsed.has(cat) ? ' collapsed' : '')}
            onClick={() => toggle(cat)}
          >
            <span className="cat-dot" style={{ background: categoryColor(cat) }} />
            {cat}
            <span className="collapse-arrow">▾</span>
            <button
              className="btn-slim buy-all"
              onClick={(e) => { e.stopPropagation(); onBuyAll(list.map((it) => it.id)) }}
            >
              Comprat tots ({list.length})
            </button>
          </div>
          {!collapsed.has(cat) && list.map((item) => {
            const cost = itemCost(item)
            return (
              <div key={item.id} className="card">
                <div className="card-text">
                  <div className="card-title">{item.name}</div>
                  {item.toBuy != null
                    ? <div className="card-sub" style={{ color: 'var(--green-dark)', fontWeight: 600 }}>Comprar: {formatQty(item.toBuy)}{item.unit !== 'u' ? ` ${UNIT_LABEL[item.unit]}` : ''}</div>
                    : item.shoppingNote && <div className="card-sub" style={{ color: 'var(--green-dark)', fontWeight: 600 }}>{item.shoppingNote}</div>}
                  <div className="card-sub">{item.category}{expiryLine(item)}</div>
                  <div className="shopping-price">
                    {editingPrice === item.id ? (
                      <div className="price-edit">
                        <input
                          autoFocus
                          type="number"
                          min="0"
                          step="any"
                          inputMode="decimal"
                          value={priceDraft}
                          onChange={(e) => setPriceDraft(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && savePrice(item.id)}
                          aria-label="Preu per unitat"
                        />
                        <button className="btn btn-primary btn-slim" onClick={() => savePrice(item.id)}>OK</button>
                        <button className="icon-btn" onClick={() => setEditingPrice(null)} aria-label="Cancel·la">✕</button>
                      </div>
                    ) : (
                      <button className="price-btn" onClick={() => startEditPrice(item)} title="Ajusta el preu">
                        {priceFor(item) != null
                          ? `${fmtPrice(priceFor(item))} €/${UNIT_LABEL[qtyUnit(item)]}`
                          : 'Sense preu · afegeix'}
                      </button>
                    )}
                    {cost != null && <span className="price-line">≈ {fmtEuro(cost)}</span>}
                  </div>
                </div>
                <button className="btn btn-primary" style={{ flex: 'none', padding: '8px 16px' }} onClick={() => onBought(item.id)}>
                  Compra't
                </button>
              </div>
            )
          })}
        </div>
      ))}
    </>
  )
}
