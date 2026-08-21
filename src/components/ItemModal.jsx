import { useState, useRef, useEffect } from 'react'
import { CATEGORIES, categoryForName, estimatedExpiry, toInputDate, todayInputDate, UNITS, UNIT_LABEL } from '../data.js'
import { suggestPrice, fmtEuro } from '../prices.js'
import { lookupBarcode } from '../off.js'
import BarcodeScanner from './BarcodeScanner.jsx'

export default function ItemModal({ item, allowExpiry = true, initialCategory, onClose, onSave }) {
  const editing = !!item
  const [name, setName] = useState(item ? item.name : '')
  const [category, setCategory] = useState(item ? item.category : (initialCategory || 'Verdura'))
  const [unit, setUnit] = useState(item ? item.unit || 'u' : 'u')
  const [price, setPrice] = useState(item && item.price != null ? String(item.price) : '')
  const [lots, setLots] = useState(() => {
    const src = item && Array.isArray(item.lots) && item.lots.length
      ? item.lots
      : item
        ? [{ qty: item.quantity ?? 0, expiry: item.expiry ?? null }]
        : [{ qty: 1, expiry: null }]
    return src.map((lot) => ({ qty: String(lot.qty), expiry: lot.expiry ? toInputDate(lot.expiry) : '' }))
  })
  const [auto, setAuto] = useState(item ? !item.expiry : true)
  const [scanning, setScanning] = useState(false)
  const [scanMsg, setScanMsg] = useState(null)
  const nameRef = useRef(null)

  useEffect(() => { if (nameRef.current) nameRef.current.focus() }, [])

  const suggested = name.trim() ? suggestPrice(name, unit, category) : null

  function handleNameChange(value) {
    setName(value)
    const cat = categoryForName(value)
    if (!editing || value.trim() === '') setCategory(cat)
  }

  function updateLot(i, patch) {
    setLots((prev) => prev.map((lot, idx) => (idx === i ? { ...lot, ...patch } : lot)))
  }

  function removeLot(i) {
    setLots((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev))
  }

  function addLot() {
    setLots((prev) => [...prev, { qty: '1', expiry: '' }])
  }

  function parseInputDate(input) {
    const d = new Date(input + 'T00:00:00')
    return isNaN(d.getTime()) ? null : d.getTime()
  }

  async function handleScan(code) {
    setScanning(false)
    try {
      const product = await lookupBarcode(code)
      if (product && product.name) {
        setName(product.name)
        setCategory(categoryForName(product.name))
        setUnit(product.unit || 'u')
        setLots([{ qty: String(product.qty || 1), expiry: '' }])
        setScanMsg(null)
      } else {
        setScanMsg(`No s'ha trobat el producte per al codi ${code}. Escriu-lo manualment.`)
      }
    } catch (err) {
      setScanMsg('Error en consultar el producte. Escriu-lo manualment.')
    }
  }

  function handleSave() {
    const trimmed = name.trim()
    if (!trimmed) return
    let parsed = lots
      .map((lot) => ({
        qty: Math.max(0, parseFloat(String(lot.qty).replace(',', '.')) || 0),
        expiry: lot.expiry ? parseInputDate(lot.expiry) : null
      }))
      .filter((lot) => lot.qty > 0 || lot.expiry)
    if (parsed.length === 0) parsed = [{ qty: 0, expiry: null }]
    if (auto && allowExpiry) {
      const est = estimatedExpiry(trimmed, category)
      if (est) parsed = parsed.map((lot) => (lot.expiry ? lot : { ...lot, expiry: est }))
    }
    const parsedPrice = price.trim() === '' ? null : (parseFloat(price.replace(',', '.')) || null)
    onSave({ name: trimmed, category, unit, lots: parsed, price: parsedPrice })
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{editing ? 'Editar aliment' : 'Nou aliment'}</h2>
        <p className="desc">Els aliments a punt de caducar s&apos;aprofiten millor a la cuina.</p>

        <div className="field">
          <label>Nom</label>
          <div className="name-row">
            <input
              ref={nameRef}
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Per exemple: Tomàquet"
              maxLength={80}
            />
            <button type="button" className="btn btn-secondary btn-slim" onClick={() => setScanning(true)}>
              Escaneja
            </button>
          </div>
          {scanMsg && <div className="scanner-error">{scanMsg}</div>}
        </div>

        <div className="row">
          <div className="field">
            <label>Categoria</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Unitat</label>
            <select value={unit} onChange={(e) => setUnit(e.target.value)}>
              {UNITS.map((u) => <option key={u} value={u}>{UNIT_LABEL[u]}</option>)}
            </select>
          </div>
        </div>

        <div className="field">
          <label>Preu (€ per {UNIT_LABEL[unit]})</label>
          <input
            type="number"
            min="0"
            step="any"
            inputMode="decimal"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder={suggested != null ? fmtEuro(suggested) : 'Opcional'}
          />
          {suggested != null && (
            <div className="field-hint">Orientatiu: {fmtEuro(suggested)} per {UNIT_LABEL[unit]}. Serveix per estimar el cost de la compra.</div>
          )}
        </div>

        <div className="field">
          <label>{allowExpiry ? 'Lots (quantitat i caducitat)' : 'Lots (quantitat)'}</label>
          {lots.map((lot, i) => (
            <div className="lot-row" key={i}>
              <input
                type="number"
                min="0"
                step="any"
                value={lot.qty}
                onChange={(e) => updateLot(i, { qty: e.target.value })}
                aria-label="Quantitat del lot"
              />
              {allowExpiry && (
                <input
                  type="date"
                  min={todayInputDate()}
                  value={lot.expiry}
                  onChange={(e) => updateLot(i, { expiry: e.target.value })}
                  aria-label="Caducitat del lot"
                />
              )}
              <button
                type="button"
                className="icon-btn danger"
                onClick={() => removeLot(i)}
                aria-label="Elimina lot"
                disabled={lots.length <= 1}
              >✕</button>
            </div>
          ))}
          <button type="button" className="btn btn-secondary btn-slim" onClick={addLot}>+ Afegeix lot</button>
        </div>

        {allowExpiry && (
          <div className="check-row">
            <input
              id="auto-expiry"
              type="checkbox"
              checked={auto}
              onChange={(e) => setAuto(e.target.checked)}
            />
            <label htmlFor="auto-expiry">Fruites i verdures: estima la caducitat automàticament</label>
          </div>
        )}

        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>Cancel·la</button>
          <button className="btn btn-primary" onClick={handleSave}>
            {editing ? 'Desa' : 'Afegeix'}
          </button>
        </div>
      </div>

      {scanning && (
        <BarcodeScanner
          onScan={(code) => handleScan(code)}
          onClose={() => setScanning(false)}
        />
      )}
    </div>
  )
}
