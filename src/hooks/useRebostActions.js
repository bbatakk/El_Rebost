import { useRef } from 'react'
import {
  parseQuantity, combineShoppingNote, categoryForName, normalizeItem, finalizeItem,
  totalQty, minExpiry
} from '../data.js'
import { sameProduct, shoppingShortfall } from '../dishes.js'
import { newId, zeroItem } from '../lib/appUtils.js'

// Totes les mutacions de dades del rebost actiu (items, receptes i pla de menú).
export function useRebostActions({ data, save, showToast }) {
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

  const mutateRecipes = (fn) => {
    const base = dataRef.current && Array.isArray(dataRef.current.recipes) ? dataRef.current.recipes : []
    const next = fn(base)
    dataRef.current = { ...(dataRef.current || {}), recipes: next }
    save({ recipes: next }).catch((err) => console.error('save', err))
  }

  const saveMealPlan = (plan) => {
    dataRef.current = { ...(dataRef.current || {}), mealPlan: plan }
    save({ mealPlan: plan }).catch((err) => console.error('save', err))
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

  return {
    rawItems, items, activeItems, recipes, mealPlan,
    mutate, mutateRecipes, saveMealPlan,
    addItem, updateItem, removeItem, deactivateItem,
    changeQuantity, toggleShoppingList, changeToBuy, toggleActive,
    setCategoryActive, setAllActive, addSuggestedFood,
    bought, clearShoppingList, setPrice, buyAll,
    addRecipe, updateRecipe, removeRecipe,
    addMissingToShopping, applyCook, markDayDone
  }
}
