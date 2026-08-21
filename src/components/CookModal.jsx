import { useState } from 'react'
import { UNIT_LABEL } from '../data.js'

export default function CookModal({ dish, plan, onClose, onConfirm }) {
  const [rows, setRows] = useState(() =>
    plan.subtract.map((r) => ({ ...r, amount: String(r.amount) }))
  )

  const setAmount = (i, value) => {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, amount: value } : r)))
  }

  const confirm = () => {
    const parsed = rows.map((r) => ({
      ...r,
      amount: Math.max(0, parseFloat(String(r.amount).replace(',', '.')) || 0)
    }))
    onConfirm(parsed)
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Cuinar: {dish.name}</h2>
        <p className="desc">Aquests ingredients es restaran de l'estoc. Pots ajustar les quantitats abans de confirmar.</p>

        {rows.length > 0 ? (
          rows.map((r, i) => (
            <div className="cook-row" key={r.itemId + '-' + i}>
              <span className="cook-label">{r.label}</span>
              <input
                type="number"
                min="0"
                step="any"
                inputMode="decimal"
                value={r.amount}
                onChange={(e) => setAmount(i, e.target.value)}
                aria-label={`Quantitat de ${r.label}`}
              />
              <span className="cook-unit">{UNIT_LABEL[r.unit]}</span>
            </div>
          ))
        ) : (
          <div className="cook-empty">Cap ingredient es pot restar d'aquest plat.</div>
        )}

        {plan.skip.length > 0 && (
          <div className="cook-skip">
            No es resten: <strong>{plan.skip.map((s) => s.label).join(', ')}</strong> (bàsics o sense quantitat compatible).
          </div>
        )}

        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>Cancel·la</button>
          <button className="btn btn-primary" onClick={confirm}>Resta de l'estoc</button>
        </div>
      </div>
    </div>
  )
}
