import { useState } from 'react'
import { CATEGORIES, categoryColor, formatQty, normalize, UNIT_LABEL } from '../../data.js'
import { ALL_FOODS } from '../../foods.js'
import { useCollapsed } from '../../lib/appUtils.js'
import ItemMenu from '../ItemMenu.jsx'

export default function FoodsTab({ items, onToggleActive, onSetCategoryActive, onSetAllActive, onAddSuggested, onEdit, onDelete }) {
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
