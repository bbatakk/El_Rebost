import { useState } from 'react'
import { CATEGORIES, categoryColor, formatQty, UNIT_LABEL } from '../../data.js'
import { priceFor, itemCost, fmtEuro, fmtPrice, shoppingTotals, qtyUnit } from '../../prices.js'
import { useCollapsed } from '../../lib/appUtils.js'
import { expiryLine } from './common.jsx'

export default function ShoppingTab({ items, onBought, onBuyAll, onClear, onSetPrice }) {
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
