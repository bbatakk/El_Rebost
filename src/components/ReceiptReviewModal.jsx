import { useState, useEffect } from 'react'
import { UNIT_LABEL, normalize } from '../data.js'

const UNITS = ['u', 'kg', 'g', 'l', 'ml']

function suggestScore(ticketName, stockName) {
  const t = normalize(ticketName)
  const s = normalize(stockName)
  if (!t || !s) return 0

  if (t === s) return 100
  if (t.includes(s) || s.includes(t)) return 90

  const tWords = t.split(/\s+/).filter(Boolean)
  const sWords = s.split(/\s+/).filter(Boolean)
  let matches = 0
  for (const tw of tWords) {
    for (const sw of sWords) {
      if (tw === sw || tw.startsWith(sw) || sw.startsWith(tw) || tw.endsWith(sw) || sw.endsWith(tw)) {
        matches++
        break
      }
    }
  }
  if (matches === 0) return 0
  const ratio = matches / Math.max(tWords.length, sWords.length)
  return Math.round(ratio * 80 + matches * 2)
}

function bestMatch(ticketName, stockItems) {
  const scored = stockItems
    .map((s) => ({ s, score: suggestScore(ticketName, s.name) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
  return scored.length > 0 ? scored[0].s : null
}

export default function ReceiptReviewModal({ items, ocrText, stockItems, onClose, onConfirm }) {
  const [rows, setRows] = useState(() => {
    return items.map((it) => {
      const best = bestMatch(it.name, stockItems)
      if (best) {
        return { ...it, displayName: best.name, matchedId: best.id, selected: true }
      }
      return { ...it, displayName: it.name, selected: true }
    })
  })
  const [showRaw, setShowRaw] = useState(false)
  const [pickerRow, setPickerRow] = useState(null)
  const [pickerQuery, setPickerQuery] = useState('')

  const update = (i, field, value) => {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)))
  }

  const acceptSuggestion = (i, stockItem) => {
    setRows((prev) => prev.map((r, idx) => (idx === i ? {
      ...r,
      displayName: stockItem.name,
      matchedId: stockItem.id
    } : r)))
    setPickerRow(null)
    setPickerQuery('')
  }

  const toggle = (i) => {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, selected: !r.selected } : r)))
  }

  const remove = (i) => {
    setRows((prev) => prev.filter((_, idx) => idx !== i))
  }

  const confirm = () => {
    const selected = rows.filter((r) => r.selected && (r.displayName || r.name).trim())
    onConfirm(selected)
  }

  const allSelected = rows.every((r) => r.selected)
  const matchedCount = rows.filter((r) => r.matchedId).length
  const toggleAll = () => {
    const newState = !allSelected
    setRows((prev) => prev.map((r) => ({ ...r, selected: newState })))
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal receipt-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Ticket de compra</h2>
        <p className="desc">
          {rows.length} article{rows.length === 1 ? '' : 's'} detectat{rows.length === 1 ? '' : 's'}.
          {matchedCount > 0 && ` ${matchedCount} trobat${matchedCount === 1 ? '' : 's'} a l'estoc.`}
          Revisa-los abans d'afegir-los.
        </p>

        {ocrText && (
          <div className="receipt-raw-wrap">
            <button className="receipt-raw-toggle" onClick={() => setShowRaw(!showRaw)}>
              {showRaw ? 'Amaga' : 'Veure'} text OCR
            </button>
            {showRaw && (
              <pre className="receipt-raw">{ocrText}</pre>
            )}
          </div>
        )}

        <div className="receipt-actions-top">
          <label className="receipt-check-all">
            <input type="checkbox" checked={allSelected} onChange={toggleAll} />
            Seleccionar tot
          </label>
        </div>

        <div className="receipt-list">
          {rows.map((r, i) => {
            const suggestions = stockItems
              .map((s) => ({ s, score: suggestScore(r.name, s.name) }))
              .filter(({ score }) => score > 0)
              .sort((a, b) => b.score - a.score)
              .slice(0, 3)
              .map(({ s }) => s)

            return (
              <div key={i} className={`receipt-row${r.selected ? '' : ' receipt-row-off'}`}>
                <label className="receipt-check">
                  <input type="checkbox" checked={r.selected} onChange={() => toggle(i)} />
                </label>
                <div className="receipt-fields-col">
                  <div className="receipt-raw-text" title="Text detectat al ticket">
                    {r.name}
                    {!r.matchedId && suggestions.length === 0 && (
                      <span className="receipt-tag-new">Nou</span>
                    )}
                  </div>
                  {suggestions.length > 0 && (
                    <div className="receipt-suggestions">
                      <span className="receipt-suggestions-label">Potser és:</span>
                      {suggestions.map((s) => (
                        <button
                          key={s.id}
                          className={`receipt-suggestion-btn${r.matchedId === s.id ? ' receipt-suggestion-active' : ''}`}
                          onClick={() => acceptSuggestion(i, s)}
                        >
                          {s.name}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="receipt-suggestions">
                    <button
                      className="receipt-suggestion-btn receipt-picker-toggle"
                      onClick={() => {
                        setPickerRow(pickerRow === i ? null : i)
                        setPickerQuery('')
                      }}
                    >
                      {pickerRow === i ? 'Tanca la llista' : 'Tota la llista'}
                    </button>
                  </div>
                  {pickerRow === i && (
                    <div className="receipt-picker">
                      <input
                        className="receipt-picker-search"
                        type="text"
                        value={pickerQuery}
                        onChange={(e) => setPickerQuery(e.target.value)}
                        placeholder="Cerca aliment..."
                        autoFocus
                      />
                      <div className="receipt-picker-list">
                        {stockItems
                          .filter((s) => {
                            if (!pickerQuery.trim()) return true
                            return normalize(s.name).includes(normalize(pickerQuery))
                          })
                          .sort((a, b) => {
                            const sa = suggestScore(r.name, a.name)
                            const sb = suggestScore(r.name, b.name)
                            return sb - sa
                          })
                          .map((s) => (
                            <button
                              key={s.id}
                              className={`receipt-picker-item${r.matchedId === s.id ? ' receipt-picker-active' : ''}`}
                              onClick={() => acceptSuggestion(i, s)}
                            >
                              {s.name}
                              {s.quantity > 0 && <span className="receipt-picker-qty">{s.quantity} {UNIT_LABEL[s.unit] || 'u'}</span>}
                            </button>
                          ))}
                        {stockItems.filter((s) => !pickerQuery.trim() || normalize(s.name).includes(normalize(pickerQuery))).length === 0 && (
                          <div className="receipt-picker-empty">Cap aliment trobat</div>
                        )}
                      </div>
                    </div>
                  )}
                  <div className="receipt-fields-row">
                    <input
                      className="receipt-name-input"
                      type="text"
                      value={r.displayName || r.name}
                      onChange={(e) => update(i, 'displayName', e.target.value)}
                      placeholder="Nom"
                    />
                    <input
                      className="receipt-qty"
                      type="number"
                      min="0"
                      step="any"
                      inputMode="decimal"
                      value={r.quantity ?? ''}
                      onChange={(e) => update(i, 'quantity', e.target.value === '' ? null : parseFloat(e.target.value.replace(',', '.')) || null)}
                      placeholder="Qtt"
                    />
                    <select
                      className="receipt-unit"
                      value={r.unit || 'u'}
                      onChange={(e) => update(i, 'unit', e.target.value)}
                    >
                      {UNITS.map((u) => (
                        <option key={u} value={u}>{UNIT_LABEL[u] || u}</option>
                      ))}
                    </select>
                    <div className="receipt-price">
                      {r.price != null ? `${r.price.toFixed(2)} €` : '—'}
                    </div>
                  </div>
                </div>
                <button className="icon-btn receipt-remove" onClick={() => remove(i)} aria-label="Elimina">✕</button>
              </div>
            )
          })}
        </div>

        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>Cancel·la</button>
          <button className="btn btn-primary" onClick={confirm} disabled={rows.filter((r) => r.selected && (r.displayName || r.name).trim()).length === 0}>
            Afegeix a l'estoc ({rows.filter((r) => r.selected && (r.displayName || r.name).trim()).length})
          </button>
        </div>
      </div>
    </div>
  )
}
