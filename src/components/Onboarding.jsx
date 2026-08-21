import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

const STEPS = [
  {
    emoji: '🏠',
    title: 'Benvingut a El Rebost',
    text: "Gestiona l'estoc, la cuina i la compra de casa en una sola app, compartida amb tots els qui hi viuen i sincronitzada en temps real."
  },
  {
    emoji: '🥕',
    title: 'Els aliments',
    text: "El catàleg és el punt de partida: activa amb l'interruptor els aliments que fas servir i només aquests apareixeran a l'Estoc.",
    points: [
      ['🏷️', 'Categories i vida útil ja configurades'],
      ['➕', 'Afegeix-ne de nous quan vulguis']
    ]
  },
  {
    emoji: '🧺',
    title: "L'estoc",
    text: 'Què tens a casa, quant en tens i fins quan et durarà.',
    points: [
      ['⏰', 'Avisos quan alguna cosa caduca aviat'],
      ['👆', 'Toca la quantitat per editar-la, amb lots i data']
    ]
  },
  {
    emoji: '📷',
    title: 'Entra productes en un segon',
    text: "Des del botó de càmera de l'Estoc, oblida't d'escriure:",
    points: [
      ['🧾', "Foto del tiquet: els articles s'afegeixen sols"],
      ['🥑', "Foto d'un aliment: endevina què és"],
      ['🏷️', 'Codi de barres: cerca el producte automàticament']
    ]
  },
  {
    emoji: '🍳',
    title: 'La cuina',
    text: 'Et diem què pots cuinar ara mateix amb el que tens.',
    points: [
      ['✅', 'Plats «Es pot fer» i «Gairebé» amb les faltes exactes'],
      ['📅', 'Menú de la setmana generat automàticament'],
      ['🔥', "Cuinar un plat resta els ingredients de l'estoc"]
    ]
  },
  {
    emoji: '🛒',
    title: 'La compra',
    text: 'La llista de tota la casa, sempre igual per a tothom.',
    points: [
      ['🧺', 'Marca la cistella d’un aliment per afegir-lo'],
      ['💰', "El cost s'estima sol; toca el preu per ajustar-lo"],
      ['✅', 'Comprat? Torna directament a l’estoc']
    ]
  },
  {
    emoji: '🔑',
    title: 'Convida els de casa',
    text: 'Comparteix el codi o el QR del rebost des del menú: entraran a veure i editar exactament el mateix que tu, en temps real.'
  }
]

export default function Onboarding({ onClose }) {
  const [step, setStep] = useState(0)
  const [dir, setDir] = useState(1)
  const touchX = useRef(null)
  const last = step === STEPS.length - 1
  const s = STEPS[step]

  const go = (n) => {
    const target = Math.max(0, Math.min(STEPS.length - 1, n))
    if (target === step) return
    setDir(target > step ? 1 : -1)
    setStep(target)
  }

  const next = () => {
    if (last) onClose()
    else go(step + 1)
  }

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowRight' || e.key === 'Enter') next()
      else if (e.key === 'ArrowLeft') go(step - 1)
      else if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const onTouchStart = (e) => { touchX.current = e.touches[0].clientX }

  const onTouchEnd = (e) => {
    if (touchX.current == null) return
    const dx = e.changedTouches[0].clientX - touchX.current
    touchX.current = null
    if (dx <= -48) next()
    else if (dx >= 48) go(step - 1)
  }

  return createPortal(
    <div className="onboarding-backdrop" role="dialog" aria-modal="true" aria-label="Tutorial d'El Rebost">
      <div className="onboarding-card" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <div className="onboarding-progress">Pas {step + 1} de {STEPS.length}</div>
        <div key={step} className={'onboarding-step ' + (dir > 0 ? 'enter-right' : 'enter-left')}>
          <div className="onboarding-emoji">{s.emoji}</div>
          <h2 className="onboarding-title">{s.title}</h2>
          <p className="onboarding-text">{s.text}</p>
          {s.points && (
            <ul className="onboarding-points">
              {s.points.map(([icon, label]) => (
                <li key={label}>
                  <span className="onboarding-point-icon">{icon}</span>
                  {label}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="onboarding-dots">
          {STEPS.map((_, i) => (
            <button
              key={i}
              type="button"
              className={'onboarding-dot' + (i === step ? ' active' : '')}
              onClick={() => go(i)}
              aria-label={`Vés al pas ${i + 1}`}
            />
          ))}
        </div>
        <div className="onboarding-actions">
          {step > 0 ? (
            <button type="button" className="onboarding-skip" onClick={() => go(step - 1)}>← Enrere</button>
          ) : (
            <button type="button" className="onboarding-skip" onClick={onClose}>Saltar</button>
          )}
          <button type="button" className="onboarding-next" onClick={next}>
            {last ? 'Comença!' : 'Següent'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
