import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { dishKey, dishMatchesQuery, generateMealPlan } from '../../dishes.js'

const WEEKDAYS = ['Diumenge', 'Dilluns', 'Dimarts', 'Dimecres', 'Dijous', 'Divendres', 'Dissabte']

function dayLabel(i) {
  const d = new Date()
  d.setDate(d.getDate() + i)
  return WEEKDAYS[d.getDay()]
}

export default function MenuTab({ scored, mealPlan, onSaveMealPlan, onNotify, onViewDish, onCook, onAddToShopping }) {
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
