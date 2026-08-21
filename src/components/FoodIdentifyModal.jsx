import { useState, useRef, useEffect } from 'react'
import { UNIT_LABEL, normalize, categoryForName } from '../data.js'
import { identifyFood } from '../firebase.js'

const UNITS = ['u', 'kg', 'g', 'l', 'ml']

const LABEL_MAP = {
  fruit: 'fruita', apple: 'poma', banana: 'platan', orange: 'taronja',
  lemon: 'llimona', grape: 'raim', strawberry: 'maduixa', mango: 'mango',
  pear: 'pera', peach: 'pressec', watermelon: 'sindria', melon: 'melo',
  pineapple: 'pinya', kiwi: 'kiwi', avocado: 'alvocat', cherry: 'cirera',
  tomato: 'tomaquet', potato: 'patata', onion: 'ceba', carrot: 'pastanaga',
  garlic: 'all', lettuce: 'enciam', cucumber: 'cogombre', pepper: 'pebrot',
  broccoli: 'brocoli', mushroom: 'bolet', corn: 'blat de moro',
  dairy: 'lactics', milk: 'llet', cheese: 'formatge', yogurt: 'iogurt',
  butter: 'mantega', cream: 'nata', egg: 'ou', eggs: 'ous',
  meat: 'carn', chicken: 'pollastre', beef: 'vedella', pork: 'porc',
  fish: 'peix', salmon: 'salmó', tuna: 'tonyina', shrimp: 'gamba',
  bread: 'pa', cereal: 'cereals', rice: 'arròs', pasta: 'pasta',
  noodle: 'fideus', flour: 'farina', cookie: 'galeta',
  water: 'aigua', juice: 'suc', beer: 'cervesa', wine: 'vi',
  coffee: 'café', tea: 'te', soda: 'refresc',
  chocolate: 'xocolata', candy: 'caramelo', sugar: 'sucre', honey: 'mel',
  oil: 'oli', vinegar: 'vinagre', salt: 'sal', pepper_spice: 'pebre',
  soup: 'sopa', sauce: 'salsa', ketchup: 'ketchup', mustard: 'mostassa',
  mayonnaise: 'maionesa', ice_cream: 'gelat',
  nut: 'fruita seca', almond: 'ametlla', walnut: 'nou',
  bean: 'mongetes', pea: 'pesols', lentil: 'llenties', chickpea: 'cigrons',
  detergent: 'detergent', soap: 'sabó', cleaner: 'netejador',
  tissue: 'paper', toilet_paper: 'paper higiènic',
  frozen: 'congelat', pizza: 'pizza', bread_product: 'pa'
}

function labelToCatalan(label) {
  const low = label.toLowerCase()
  if (LABEL_MAP[low]) return LABEL_MAP[low]
  const words = low.split(/\s+/)
  for (const w of words) {
    if (LABEL_MAP[w]) return LABEL_MAP[w]
  }
  return low
}

function suggestScore(query, target) {
  const t = normalize(query)
  const s = normalize(target)
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

export default function FoodIdentifyModal({ stockItems, mode, onClose, onConfirm }) {
  const [imageUrl, setImageUrl] = useState(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [query, setQuery] = useState('')
  const [selectedName, setSelectedName] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [quantity, setQuantity] = useState(1)
  const [unit, setUnit] = useState('u')
  const [showAll, setShowAll] = useState(false)
  const cameraRef = useRef(null)
  const galleryRef = useRef(null)

  useEffect(() => {
    if (mode === 'camera' && cameraRef.current) cameraRef.current.click()
    if (mode === 'gallery' && galleryRef.current) galleryRef.current.click()
  }, [mode])

  const selectItem = (s) => {
    setSelectedName(s.name)
    setSelectedId(s.id)
    setUnit(s.unit || 'u')
  }

  const handleFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setLoading(true)
    setImageUrl(URL.createObjectURL(file))

    try {
      const reader = new FileReader()
      const base64 = await new Promise((resolve) => {
        reader.onload = () => resolve(reader.result)
        reader.readAsDataURL(file)
        reader.onerror = () => resolve(null)
      })

      if (!base64) { setLoading(false); return }

      const data = await identifyFood(base64)

      const candidates = []

      if (data.labels?.length > 0) {
        for (const label of data.labels) {
          const ca = labelToCatalan(label.description)
          candidates.push({ source: 'label', text: ca, score: label.score })
        }
      }

      if (data.rawText) {
        const words = data.rawText.split(/\s+/).filter((w) => w.length >= 3)
        for (const w of words) {
          candidates.push({ source: 'text', text: w, score: 1 })
        }
      }

      const scored = stockItems.map((s) => {
        let bestScore = 0
        let bestSource = ''
        for (const c of candidates) {
          const sc = suggestScore(c.text, s.name)
          if (sc > bestScore) {
            bestScore = sc
            bestSource = c.source
          }
        }
        return { item: s, score: bestScore, source: bestSource }
      }).filter((s) => s.score > 0).sort((a, b) => b.score - a.score)

      const top3 = scored.slice(0, 3)
      setResult({ candidates, top3, all: scored })

      if (top3.length > 0) {
        selectItem(top3[0].item)
      }
    } catch (err) {
      console.error('identifyFood error', err)
      setResult({ candidates: [], top3: [], all: [], error: err.message })
    }
    setLoading(false)
  }

  const confirm = () => {
    const name = selectedName.trim()
    if (!name) return
    onConfirm({ name, quantity, unit, matchedId: selectedId })
  }

  const filteredStock = stockItems.filter((s) => {
    if (!query.trim()) return true
    return normalize(s.name).includes(normalize(query))
  }).sort((a, b) => {
    if (selectedId === a.id) return 1
    if (selectedId === b.id) return -1
    const sa = result?.all?.find((r) => r.item.id === a.id)?.score || 0
    const sb = result?.all?.find((r) => r.item.id === b.id)?.score || 0
    return sb - sa
  })

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal receipt-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Identificar aliment</h2>
        <p className="desc">Fes una foto o tria una imatge per identificar l'aliment.</p>

        {!imageUrl && (
          <div className="identify-upload">
            <button className="identify-upload-btn" onClick={() => cameraRef.current?.click()}>
              📷 Fer una foto
            </button>
            <button className="identify-upload-btn identify-upload-alt" onClick={() => galleryRef.current?.click()}>
              🖼️ Triar de la galeria
            </button>
          </div>
        )}

        {imageUrl && (
          <div className="identify-preview">
            <img src={imageUrl} alt="Aliment" className="identify-img" />
            {!loading && !result && (
              <div className="identify-retry-group">
                <button className="identify-retry" onClick={() => cameraRef.current?.click()}>📷 Nova foto</button>
                <button className="identify-retry" onClick={() => galleryRef.current?.click()}>🖼️ Galeria</button>
              </div>
            )}
          </div>
        )}

        {loading && (
          <div className="identify-loading">
            <div className="spinner" />
            <span>Analitzant imatge...</span>
          </div>
        )}

        {result && !loading && (
          <div className="identify-result">
            {result.candidates.length > 0 && (
              <div className="identify-labels">
                <span className="identify-labels-title">Detectat:</span>
                {result.candidates.slice(0, 6).map((c, i) => (
                  <span key={i} className={`identify-label identify-label-${c.source}`}>
                    {c.text}
                  </span>
                ))}
              </div>
            )}

            {result.top3.length > 0 && (
              <div className="receipt-suggestions">
                <span className="receipt-suggestions-label">Podria ser:</span>
                {result.top3.map((r) => (
                  <button
                    key={r.item.id}
                    className={`receipt-suggestion-btn${selectedId === r.item.id ? ' receipt-suggestion-active' : ''}`}
                    onClick={() => selectItem(r.item)}
                  >
                    {r.item.name}
                  </button>
                ))}
              </div>
            )}

            <div className="receipt-suggestions">
              <button
                className="receipt-suggestion-btn receipt-picker-toggle"
                onClick={() => { setShowAll(!showAll); setQuery('') }}
              >
                {showAll ? 'Tanca la llista' : 'Tota la llista'}
              </button>
            </div>

            {showAll && (
              <div className="receipt-picker">
                <input
                  className="receipt-picker-search"
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Cerca aliment..."
                  autoFocus
                />
                <div className="receipt-picker-list">
                  {filteredStock.map((s) => (
                    <button
                      key={s.id}
                      className={`receipt-picker-item${selectedId === s.id ? ' receipt-picker-active' : ''}`}
                      onClick={() => selectItem(s)}
                    >
                      {s.name}
                      {s.quantity > 0 && <span className="receipt-picker-qty">{s.quantity} {UNIT_LABEL[s.unit] || 'u'}</span>}
                    </button>
                  ))}
                  {filteredStock.length === 0 && (
                    <div className="receipt-picker-empty">Cap aliment trobat</div>
                  )}
                </div>
              </div>
            )}

            <div className="identify-fields">
              <input
                className="receipt-name-input"
                type="text"
                value={selectedName}
                onChange={(e) => { setSelectedName(e.target.value); setSelectedId(null) }}
                placeholder="Nom de l'aliment"
              />
              <input
                className="receipt-qty"
                type="number"
                min="0"
                step="any"
                inputMode="decimal"
                value={quantity}
                onChange={(e) => setQuantity(parseFloat(e.target.value.replace(',', '.')) || 0)}
                placeholder="Qtt"
              />
              <select
                className="receipt-unit"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
              >
                {UNITS.map((u) => (
                  <option key={u} value={u}>{UNIT_LABEL[u] || u}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>Cancel·la</button>
          <button
            className="btn btn-primary"
            onClick={confirm}
            disabled={!selectedName.trim() || loading}
          >
            Afegeix a l'estoc
          </button>
        </div>
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={handleFile} style={{ display: 'none' }} />
        <input ref={galleryRef} type="file" accept="image/*" onChange={handleFile} style={{ display: 'none' }} />
      </div>
    </div>
  )
}
