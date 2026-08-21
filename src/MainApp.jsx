import { useEffect, useMemo, useRef, useState } from 'react'
import { CATEGORIES, expiryStatus, EXPIRY, normalizeItem } from './data.js'
import { DISHES, missingIngredients, have, dishKey, cookPlan, shoppingShortfall } from './dishes.js'
import { TABS, TAB_LABEL, tabFromHash, hasModalToken } from './lib/appUtils.js'
import { useTimer, showTimerNotification, closeTimerNotification, alarm, vibrateAlarm, notifyTimerFinish } from './lib/timer.js'
import { useToast } from './hooks/useToast.js'
import { useRebostActions } from './hooks/useRebostActions.js'
import { useScans } from './hooks/useScans.js'
import ItemModal from './components/ItemModal.jsx'
import DishModal from './components/DishModal.jsx'
import RecipeModal from './components/RecipeModal.jsx'
import TimerBar from './components/TimerBar.jsx'
import TimerModal from './components/TimerModal.jsx'
import CookModal from './components/CookModal.jsx'
import ReceiptReviewModal from './components/ReceiptReviewModal.jsx'
import FoodIdentifyModal from './components/FoodIdentifyModal.jsx'
import ConfirmDialog from './components/ConfirmDialog.jsx'
import Logo from './components/Logo.jsx'
import StockTab from './components/tabs/StockTab.jsx'
import FoodsTab from './components/tabs/FoodsTab.jsx'
import KitchenTab from './components/tabs/KitchenTab.jsx'
import ShoppingTab from './components/tabs/ShoppingTab.jsx'
import MenuTab from './components/tabs/MenuTab.jsx'

export default function MainApp({ data, save, rebostName, onOpenMenu }) {
  const [tab, setTab] = useState(() => tabFromHash(window.location.hash))
  const [modal, setModal] = useState(null) // { type: 'item', item? } | { type: 'dish', dish } | { type: 'recipe', recipe? }
  const [stockQuery, setStockQuery] = useState('')
  const [stockFilter, setStockFilter] = useState('Totes')
  const [confirm, setConfirm] = useState(null) // { title, message, onConfirm }
  const [timerOpen, setTimerOpen] = useState(false)
  const [mealOpen, setMealOpen] = useState(false)
  const [cook, setCook] = useState(null) // { dish, plan, fromMenu }
  const [receiptSource, setReceiptSource] = useState(null) // 'camera' | 'gallery' | 'pick'
  const receiptCameraRef = useRef(null)
  const receiptGalleryRef = useRef(null)

  const { toast, showToast, dismissToast } = useToast()

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

  const actions = useRebostActions({ data, save, showToast })
  const { rawItems, items, activeItems, recipes, mealPlan, mutate } = actions

  const scans = useScans({ rawItems, mutate, showToast })

  const requestDeleteItem = (item) => {
    setConfirm({
      title: 'Eliminar aliment',
      message: `Esborrarà "${item.name}" de l'estoc. Ho pots desfer.`,
      onConfirm: () => { setConfirm(null); actions.removeItem(item.id) }
    })
  }

  const requestDeleteRecipe = (recipe) => {
    setConfirm({
      title: 'Eliminar recepta',
      message: `Esborrarà "${recipe.name}". Ho pots desfer.`,
      onConfirm: () => { setConfirm(null); actions.removeRecipe(recipe.id) }
    })
  }

  const requestClearShopping = () => {
    setConfirm({
      title: 'Buida la llista',
      message: 'Es trauran tots els productes de la llista de la compra. Ho pots desfer.',
      onConfirm: () => { setConfirm(null); actions.clearShoppingList() }
    })
  }

  const openCook = (dish, fromMenu) => {
    setCook({ dish, plan: cookPlan(activeItems, dish), fromMenu })
  }

  const confirmCook = (rows) => {
    const used = rows.filter((r) => r.amount > 0).length
    actions.applyCook(rows)
    if (cook.fromMenu != null) actions.markDayDone(cook.fromMenu)
    setCook(null)
    showToast(used > 0 ? `${used} ingredient${used === 1 ? '' : 's'} restat${used === 1 ? '' : 's'} de l'estoc` : 'Cap ingredient restat')
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
      actions.addMissingToShopping(s.dish, 2)
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
            onChangeQuantity={actions.changeQuantity}
            onToggleShopping={actions.toggleShoppingList}
            onChangeToBuy={actions.changeToBuy}
            onEdit={(it) => openModal({ type: 'item', item: it, source: 'stock' })}
            onDelete={(it) => actions.deactivateItem(it.id)}
          />
        ) : tab === 'foods' ? (
          <FoodsTab
            items={items}
            onToggleActive={actions.toggleActive}
            onSetCategoryActive={actions.setCategoryActive}
            onSetAllActive={actions.setAllActive}
            onAddSuggested={actions.addSuggestedFood}
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
            onBought={(id) => { actions.bought(id); showToast('Producte comprat') }}
            onBuyAll={actions.buyAll}
            onClear={requestClearShopping}
            onSetPrice={actions.setPrice}
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
          disabled={scans.receiptLoading}
          aria-label="Escaneja ticket o identifica aliment"
          title="Escaneja ticket o identifica aliment"
        >
          {scans.receiptLoading ? (
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
              <button className="receipt-source-btn" onClick={() => { setReceiptSource(null); scans.openIdentify('camera') }}>
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                Fer una foto
              </button>
              <button className="receipt-source-btn" onClick={() => { setReceiptSource(null); scans.openIdentify('gallery') }}>
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
        onChange={scans.handleReceiptFile}
        style={{ display: 'none' }}
      />
      <input
        ref={receiptGalleryRef}
        type="file"
        accept="image/*"
        onChange={scans.handleReceiptFile}
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
              actions.updateItem(modal.item.id, fields)
              showToast('Canvis desats')
            } else {
              actions.addItem(fields)
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
            actions.addMissingToShopping(dish, servings)
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
              actions.updateRecipe(modal.recipe.id, recipe)
              showToast('Recepta desada')
            } else {
              actions.addRecipe(recipe)
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

      {scans.receipt && (
        <ReceiptReviewModal
          items={scans.receipt.items}
          ocrText={scans.receipt.text}
          stockItems={rawItems}
          onClose={scans.closeReceipt}
          onConfirm={scans.confirmReceipt}
        />
      )}

      {scans.identifyOpen && (
        <FoodIdentifyModal
          stockItems={rawItems}
          mode={scans.identifyMode}
          onClose={scans.closeIdentify}
          onConfirm={scans.confirmIdentify}
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
              onSaveMealPlan={actions.saveMealPlan}
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
                dismissToast()
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
