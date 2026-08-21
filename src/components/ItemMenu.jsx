import { useState } from 'react'

export default function ItemMenu({ onEdit, onDelete, deleteLabel = 'Eliminar', destructive = true }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="menu">
      <button className="icon-btn" onClick={(e) => { e.stopPropagation(); setOpen(!open) }} aria-label="Més accions">⋮</button>
      {open && (
        <div className="menu-pop">
          <button onClick={(e) => { e.stopPropagation(); setOpen(false); onEdit() }}>Editar</button>
          <button className={destructive ? 'danger' : ''} onClick={(e) => { e.stopPropagation(); setOpen(false); onDelete() }}>{deleteLabel}</button>
        </div>
      )}
    </div>
  )
}
