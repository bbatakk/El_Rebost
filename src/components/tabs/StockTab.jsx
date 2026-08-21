import { CATEGORIES, categoryColor, expiryStatus, EXPIRY, formatQty, UNIT_LABEL } from '../../data.js'
import { useCollapsed } from '../../lib/appUtils.js'
import ItemMenu from '../ItemMenu.jsx'
import { expiryLine, expiryTag } from './common.jsx'

export default function StockTab({ items, query, onQueryChange, filter, onFilterChange, onChangeQuantity, onToggleShopping, onChangeToBuy, onEdit, onDelete }) {
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
