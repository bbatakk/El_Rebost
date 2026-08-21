import { useState } from 'react'
import { have, dishKey, dishMatchesQuery, ingredientCoverage } from '../../dishes.js'
import { useCollapsed } from '../../lib/appUtils.js'
import ItemMenu from '../ItemMenu.jsx'

export default function KitchenTab({ scored, items, onDishClick, onEditRecipe, onDeleteRecipe }) {
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
