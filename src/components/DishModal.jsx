import { useState } from 'react'
import { missingIngredients, have, ingredientCoverage, shoppingShortfall } from '../dishes.js'
import { scaleLine, expiryStatus, EXPIRY } from '../data.js'

export default function DishModal({ dish, stock, onClose, onCook, onAddToShopping }) {
  const [servings, setServings] = useState(2)
  const missing = missingIngredients(stock, dish)
  const toBuy = shoppingShortfall(stock, dish, 1)
  const factor = servings / 2
  const expiring = dish.ingredients.filter((ing) =>
    stock.some((it) => it.quantity > 0 && it.expiry && expiryStatus(it.expiry) !== EXPIRY.OK && have([it], ing))
  ).length

  function handleAdd() {
    if (toBuy.length === 0) return
    onAddToShopping(dish, servings)
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{dish.name}</h2>
        <p className="desc">{dish.description}</p>
        {expiring > 0 && (
          <div className="tag tag-soon" style={{ marginBottom: 12 }}>
            Aprofita-ho: {expiring} ingredient{expiring === 1 ? '' : 's'} a punt de caducar
          </div>
        )}

        <div className="field">
          <label>Per a quantes persones?</label>
          <select value={servings} onChange={(e) => setServings(parseInt(e.target.value, 10))}>
            {[1, 2, 3, 4, 6, 8].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>

        <div className="note">
          <h3>Ingredients</h3>
          <ul>
            {dish.ingredients.map((ing) => {
              const has = !missing.includes(ing)
              const cov = ingredientCoverage(stock, ing)
              return (
                <li key={ing.label}>
                  {!has ? '✗ ' : cov && cov.ratio < 1 ? `⚠ (en tens ${cov.have} de ${cov.need}) ` : '✓ '}
                  <strong>{ing.label}</strong> — {scaleLine(ing.line, factor)}
                </li>
              )
            })}
          </ul>
        </div>

        <div className="note">
          <h3>Passos</h3>
          <ol>
            {dish.steps.map((step, i) => <li key={i}>{step}</li>)}
          </ol>
        </div>

        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>Tanca</button>
          {missing.length === 0 && (
            <button className="btn btn-primary" onClick={() => onCook(dish)}>Cuina aquest plat</button>
          )}
          {toBuy.length > 0 && (
            <button className="btn btn-primary" onClick={handleAdd}>
              Afegeix a la compra ({toBuy.length})
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
