import { useEffect, useState } from 'react'

function fmt(ms) {
  const total = Math.max(0, Math.round((ms || 0) / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export default function TimerBar({ timer, onPause, onResume, onRestart, onStop, onEdit }) {
  const [editing, setEditing] = useState(false)
  const [min, setMin] = useState('')
  const [sec, setSec] = useState('')

  useEffect(() => {
    if (!editing) return
    const total = Math.round(timer.remaining / 1000)
    setMin(String(Math.floor(total / 60)))
    setSec(String(total % 60))
  }, [editing, timer.remaining])

  const submit = () => {
    const m = Math.max(0, parseInt(min, 10) || 0)
    const s = Math.max(0, parseInt(sec, 10) || 0)
    onEdit((m * 60 + s) * 1000)
    setEditing(false)
  }

  const done = !timer.running && timer.remaining === 0

  return (
    <div className="timer-bar">
      <div className="timer-info">
        <span className="timer-label">{timer.label || 'Temporitzador'}</span>
        {editing ? (
          <span className="timer-edit">
            <input type="number" min="0" value={min} onChange={(e) => setMin(e.target.value)} aria-label="Minuts" />
            <span className="timer-unit">m</span>
            <input type="number" min="0" max="59" value={sec} onChange={(e) => setSec(e.target.value)} aria-label="Segons" />
            <span className="timer-unit">s</span>
            <button className="btn btn-primary btn-slim" onClick={submit}>OK</button>
          </span>
        ) : (
          <span className={'timer-display' + (done ? ' done' : '')}>{fmt(timer.remaining)}</span>
        )}
      </div>
      <div className="timer-controls">
        {editing ? (
          <button className="icon-btn" onClick={() => setEditing(false)} aria-label="Cancel·la">✕</button>
        ) : (
          <>
            <button className="icon-btn" onClick={() => setEditing(true)} aria-label="Edita el temps" title="Edita el temps">✎</button>
            {timer.running ? (
              <button className="icon-btn timer-main" onClick={onPause} aria-label="Pausa" title="Pausa">⏸</button>
            ) : timer.remaining > 0 ? (
              <button className="icon-btn timer-main" onClick={onResume} aria-label="Reprèn" title="Reprèn">▶</button>
            ) : null}
            <button className="icon-btn" onClick={onRestart} aria-label="Reinicia" title="Reinicia">↻</button>
            <button className="icon-btn" onClick={onStop} aria-label="Tanca el temporitzador" title="Tanca el temporitzador">✕</button>
          </>
        )}
      </div>
    </div>
  )
}
