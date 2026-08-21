import { useState } from 'react'

const PRESETS = [1, 3, 5, 10, 15, 20, 30, 45, 60]

export default function TimerModal({ onStart, onClose }) {
  const [min, setMin] = useState(10)
  const [sec, setSec] = useState(0)
  const [label, setLabel] = useState('')

  const start = (ms) => {
    if (ms > 0) onStart(ms, label.trim() || null)
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Temporitzador</h2>
        <p className="desc">Programa un compte enrere per cuinar.</p>

        <div className="field">
          <label>Nom (opcional)</label>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Per exemple: Macarrons"
            maxLength={60}
            autoFocus
          />
        </div>

        <div className="field">
          <label>Durada</label>
          <div className="timer-presets">
            {PRESETS.map((m) => (
              <button key={m} type="button" className="timer-preset" onClick={() => start(m * 60000)}>{m}′</button>
            ))}
          </div>
          <div className="timer-custom">
            <input
              type="number"
              min="0"
              value={min}
              onChange={(e) => setMin(e.target.value)}
              aria-label="Minuts del temporitzador"
            />
            <span className="timer-unit">min</span>
            <input
              type="number"
              min="0"
              max="59"
              value={sec}
              onChange={(e) => setSec(e.target.value)}
              aria-label="Segons del temporitzador"
            />
            <span className="timer-unit">s</span>
            <button
              type="button"
              className="btn btn-primary btn-slim"
              onClick={() => start(((parseInt(min, 10) || 0) * 60 + (parseInt(sec, 10) || 0)) * 1000)}
            >
              Inicia
            </button>
          </div>
        </div>

        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>Cancel·la</button>
        </div>
      </div>
    </div>
  )
}
