import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

export default function QrModal({ value, onClose }) {
  const [dataUrl, setDataUrl] = useState(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let alive = true
    setDataUrl(null)
    if (value) {
      import('qrcode/lib/browser')
        .then((mod) => (mod.default || mod).toDataURL(value, { width: 512, margin: 2, errorCorrectionLevel: 'M' }))
        .then((url) => { if (alive) setDataUrl(url) })
        .catch((err) => { if (alive) console.error('qr', err) })
    }
    return () => { alive = false }
  }, [value])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch { /* sense portapapers */ }
  }

  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal qr-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Codi del rebost</h2>
        <p className="desc">Escaneja aquest codi QR per entrar al rebost.</p>
        <div className="qr-frame">
          {dataUrl ? (
            <img src={dataUrl} alt={`Codi QR ${value}`} />
          ) : (
            <div className="qr-placeholder" />
          )}
        </div>
        <div className="qr-code-text">{value}</div>
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>Tanca</button>
          <button className="btn btn-primary" onClick={copy}>
            {copied ? 'Copiat!' : 'Copia el codi'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
