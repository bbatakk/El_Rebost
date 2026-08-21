import { useEffect, useRef, useState } from 'react'

export default function BarcodeScanner({ onScan, onClose }) {
  const [error, setError] = useState(null)
  const [attempt, setAttempt] = useState(0)
  const scannerRef = useRef(null)

  useEffect(() => {
    let mounted = true
    const el = document.getElementById('barcode-reader')
    if (!el) return undefined
    setError(null)
    import('html5-qrcode')
      .then((mod) => {
        const Html5Qrcode = mod.Html5Qrcode || (mod.default && mod.default.Html5Qrcode)
        if (!mounted) return null
        const scanner = new Html5Qrcode('barcode-reader')
        scannerRef.current = scanner
        return scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 220, height: 220 } },
          (text) => {
            if (mounted) {
              scanner.stop().catch(() => {})
              onScan(text)
            }
          },
          () => {}
        )
      })
      .catch(() => {
        if (mounted) setError('No es pot accedir a la càmera. Comprova el permís i torna-ho a provar.')
      })
    return () => {
      mounted = false
      const s = scannerRef.current
      if (s && s.isScanning) s.stop().catch(() => {})
    }
  }, [attempt, onScan])

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Escaneja el codi de barres</h2>
        <p className="desc">Posa el codi de barres de l&apos;aliment dins del marc. Necessita permís de càmera.</p>
        <div id="barcode-reader" className="scanner" />
        {error && <div className="scanner-error">{error}</div>}
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>Cancel·la</button>
          {error && <button className="btn btn-primary" onClick={() => setAttempt((a) => a + 1)}>Reintenta</button>}
        </div>
      </div>
    </div>
  )
}
