import { useState, useRef, useEffect } from 'react'
import { deriveKeys } from '../dishes.js'

export default function RecipeModal({ recipe, onClose, onSave }) {
  const editing = !!recipe
  const [name, setName] = useState(recipe ? recipe.name : '')
  const [description, setDescription] = useState(recipe ? recipe.description : '')
  const [servings, setServings] = useState(recipe ? recipe.servings : 2)
  const [ingredients, setIngredients] = useState(() => {
    const src = recipe ? recipe.ingredients : [{ label: '', line: '' }]
    return src.map((ing) => ({ label: ing.label, line: ing.line }))
  })
  const [steps, setSteps] = useState(recipe ? recipe.steps.join('\n') : '')
  const nameRef = useRef(null)

  useEffect(() => { if (nameRef.current) nameRef.current.focus() }, [])

  function updateIng(i, patch) {
    setIngredients((prev) => prev.map((ing, idx) => (idx === i ? { ...ing, ...patch } : ing)))
  }

  function removeIng(i) {
    setIngredients((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev))
  }

  function addIng() {
    setIngredients((prev) => [...prev, { label: '', line: '' }])
  }

  function handleSave() {
    const trimmed = name.trim()
    if (!trimmed) return
    const ings = ingredients
      .map((ing) => ({ label: ing.label.trim(), line: ing.line.trim() }))
      .filter((ing) => ing.label)
    const stepsList = steps.split('\n').map((s) => s.trim()).filter(Boolean)
    onSave({
      name: trimmed,
      description: description.trim(),
      servings: Math.max(1, parseInt(servings, 10) || 2),
      ingredients: ings.map((ing) => ({ ...ing, keys: deriveKeys(ing.label) })),
      steps: stepsList
    })
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{editing ? 'Editar recepta' : 'Nova recepta'}</h2>
        <p className="desc">Afegeix els teus plats de casa i El Rebost els tindrà en compte amb el teu estoc.</p>

        <div className="field">
          <label>Nom</label>
          <input
            ref={nameRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Per exemple: Macarrons amb tomàquet"
            maxLength={80}
          />
        </div>

        <div className="field">
          <label>Descripció</label>
          <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Una frase breu" maxLength={200} />
        </div>

        <div className="field">
          <label>Racions</label>
          <input type="number" min="1" value={servings} onChange={(e) => setServings(e.target.value)} />
        </div>

        <div className="field">
          <label>Ingredients</label>
          {ingredients.map((ing, i) => (
            <div className="ing-row" key={i}>
              <input
                value={ing.label}
                onChange={(e) => updateIng(i, { label: e.target.value })}
                placeholder="Nom (ex. Ceba)"
                aria-label="Nom de l'ingredient"
                maxLength={80}
              />
              <input
                value={ing.line}
                onChange={(e) => updateIng(i, { line: e.target.value })}
                placeholder="Quantitat (ex. 1 ceba petita)"
                aria-label="Quantitat de l'ingredient"
                maxLength={120}
              />
              <button
                type="button"
                className="icon-btn danger"
                onClick={() => removeIng(i)}
                aria-label="Elimina ingredient"
                disabled={ingredients.length <= 1}
              >✕</button>
            </div>
          ))}
          <button type="button" className="btn btn-secondary btn-slim" onClick={addIng}>+ Afegeix ingredient</button>
        </div>

        <div className="field">
          <label>Passos (un per línia)</label>
          <textarea value={steps} onChange={(e) => setSteps(e.target.value)} placeholder="Escalfeu oli a la paella..." maxLength={4000} />
        </div>

        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>Cancel·la</button>
          <button className="btn btn-primary" onClick={handleSave}>
            {editing ? 'Desa' : 'Afegeix'}
          </button>
        </div>
      </div>
    </div>
  )
}
