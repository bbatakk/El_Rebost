import { useState } from 'react'
import { createPortal } from 'react-dom'

const STEPS = [
  {
    emoji: '🏠',
    title: 'Benvingut a El Rebost',
    text: "Gestiona l'estoc, la cuina i la compra de casa, compartit amb tots els qui hi viuen, en temps real."
  },
  {
    emoji: '🥕',
    title: 'Els aliments',
    text: "Activa els aliments que fas servir perquè surtin a l'Estoc. El catàleg t'ajuda a afegir-los ràpid amb la categoria i el preu correctes."
  },
  {
    emoji: '🧺',
    title: "L'estoc",
    text: "Aquí veus què tens a casa, amb quantitats i caducitats. T'avisem quan alguna cosa està a punt de caducar."
  },
  {
    emoji: '🍳',
    title: 'La cuina',
    text: "Tria què cuinar segons el que tens, o afegeix les teves receptes i planifica els àpats de la setmana."
  },
  {
    emoji: '🛒',
    title: 'La compra',
    text: "Afegeix a la llista el que falta i marca-ho quan ho compris. El cost s'estima sol."
  },
  {
    emoji: '🔑',
    title: 'Comparteix-ho',
    text: "Comparteix el codi (o el QR) del rebost perquè els de casa hi entrin i ho vegin tot en temps real."
  }
]

export default function Onboarding({ onClose }) {
  const [step, setStep] = useState(0)
  const last = step === STEPS.length - 1
  const s = STEPS[step]

  const next = () => {
    if (last) onClose()
    else setStep((v) => v + 1)
  }

  return createPortal(
    <div className="onboarding-backdrop">
      <div className="onboarding-card">
        <div className="onboarding-emoji">{s.emoji}</div>
        <h2 className="onboarding-title">{s.title}</h2>
        <p className="onboarding-text">{s.text}</p>
        <div className="onboarding-dots">
          {STEPS.map((_, i) => (
            <span key={i} className={'onboarding-dot' + (i === step ? ' active' : '')} />
          ))}
        </div>
        <div className="onboarding-actions">
          <button className="onboarding-skip" onClick={onClose}>Saltar</button>
          <button className="onboarding-next" onClick={next}>
            {last ? 'Comença' : 'Següent'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
