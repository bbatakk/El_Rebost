import { useState } from 'react'
import Logo from './Logo.jsx'
import QrModal from './QrModal.jsx'
import QrScanner from './QrScanner.jsx'

const GoogleIcon = ({ size = 20 }) => (
  <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true" focusable="false">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
  </svg>
)

export function Splash() {
  return (
    <div className="splash">
      <Logo size={72} />
    </div>
  )
}

export function LoginScreen({ onLogin, error }) {
  return (
    <div className="auth-wrap">
      <div className="login-card">
        <Logo size={64} />
        <h1>El Rebost</h1>
        <p className="auth-sub">El teu rebost, la compra i els plats de casa, sempre al dia.</p>
        <button className="google-btn" onClick={onLogin}>
          <GoogleIcon />
          <span>Inicia sessió amb Google</span>
        </button>
        {error && <p className="auth-error">{error}</p>}
      </div>
    </div>
  )
}

export function RebostSelect({ rebosts, onSelect, onCreate, onJoin, onLogout, onDeleteAccount, busy, joinBusy, error, userUid, onRename }) {
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [createdCode, setCreatedCode] = useState(null)
  const [joinError, setJoinError] = useState(null)
  const [createError, setCreateError] = useState(null)
  const [view, setView] = useState('list')
  const [scanning, setScanning] = useState(false)
  const [createdQr, setCreatedQr] = useState(false)
  const [editingNameId, setEditingNameId] = useState(null)
  const [nameDraft, setNameDraft] = useState('')
  const [renaming, setRenaming] = useState(false)
  const [renameError, setRenameError] = useState(null)

  const runJoin = async (rawCode) => {
    const trimmed = String(rawCode || '').trim().toUpperCase().replace(/\s+/g, '')
    if (!trimmed || joinBusy) return
    setJoinError(null)
    const result = await onJoin(trimmed)
    if (result && result.error) {
      setJoinError(
        result.error === 'not-found'
          ? 'No s\'ha trobat cap rebost amb aquest codi.'
          : 'No s\'ha pogut entrar al rebost. Torna-ho a provar.'
      )
    }
  }

  const submitJoin = (e) => {
    e.preventDefault()
    runJoin(code)
  }

  const handleScan = (text) => {
    setScanning(false)
    setCode(String(text || '').trim().toUpperCase().replace(/\s+/g, ''))
    runJoin(text)
  }

  const submitRename = async (e) => {
    e.preventDefault()
    const trimmed = nameDraft.trim()
    if (!trimmed || !editingNameId || renaming) return
    if (trimmed === (rebosts.find((r) => r.id === editingNameId) || {}).name) {
      setEditingNameId(null)
      return
    }
    setRenaming(true)
    setRenameError(null)
    try {
      await onRename(editingNameId, trimmed)
      setEditingNameId(null)
    } catch (err) {
      console.error('rename', err)
      setRenameError('No s\'ha pogut canviar el nom. Torna-ho a provar.')
    } finally {
      setRenaming(false)
    }
  }

  const submitCreate = async (e) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed || busy) return
    setCreateError(null)
    const result = await onCreate(trimmed)
    if (result && result.code) {
      setName('')
      setCreatedCode(result.code)
    } else {
      setCreateError('No s\'ha pogut crear el rebost. Torna-ho a provar.')
    }
  }

  return (
    <div className="auth-page">
      <header className="app-header">
        <div className="brand">
          <Logo size={40} />
          <div>
            <h1>El Rebost</h1>
            <div className="sub">Els teus rebosts, la compra i els plats de casa.</div>
          </div>
        </div>
        <div className="header-actions">
          <button className="auth-logout" onClick={onLogout}>Tanca la sessió</button>
        </div>
      </header>

      <div className="tabs rebost-tabs">
        <button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')}>
          Rebosts
          <span className="tab-count">{rebosts.length}</span>
        </button>
        <button className={view === 'join' ? 'active' : ''} onClick={() => setView('join')}>Entra amb codi</button>
        <button className={view === 'create' ? 'active' : ''} onClick={() => setView('create')}>Crea un rebost</button>
      </div>

      <main className="content auth-content">
        {view === 'list' && (rebosts.length === 0 ? (
          <div className="empty">
            <div className="big">🏠</div>
            <p>Encara no tens cap rebost.</p>
            <div className="empty-actions">
              <button className="btn btn-primary" onClick={() => setView('create')}>Crea un rebost</button>
              <button className="btn btn-secondary" onClick={() => setView('join')}>Entra amb un codi</button>
            </div>
          </div>
        ) : (
          <div className="rebost-list">
            {rebosts.map((r) => {
              const editing = editingNameId === r.id
              if (editing) {
                return (
                  <form key={r.id} className="rebost-card rebost-rename-form" onSubmit={submitRename}>
                    <input
                      value={nameDraft}
                      onChange={(e) => { setNameDraft(e.target.value); setRenameError(null) }}
                      maxLength={60}
                      autoFocus
                      aria-label="Nou nom del rebost"
                    />
                    <button type="submit" className="btn btn-primary btn-slim" disabled={renaming || !nameDraft.trim()}>
                      {renaming ? '...' : 'Desa'}
                    </button>
                    <button type="button" className="icon-btn" onClick={() => setEditingNameId(null)} aria-label="Cancel·la">✕</button>
                  </form>
                )
              }
              return (
                <div key={r.id} className="rebost-card">
                  <button className="rebost-card-select" onClick={() => onSelect(r.id)}>
                    <span className="rebost-card-icon"><Logo size={30} /></span>
                    <span className="rebost-card-name">{r.name}</span>
                    <span className="rebost-card-go">→</span>
                  </button>
                  {r.owner === userUid && (
                    <button
                      className="icon-btn"
                      onClick={() => { setEditingNameId(r.id); setNameDraft(r.name); setRenameError(null) }}
                      aria-label={`Canvia el nom del rebost "${r.name}"`}
                      title="Canvia el nom"
                    >
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
                        <path d="M12 20h9" />
                        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                      </svg>
                    </button>
                  )}
                </div>
              )
            })}
            {renameError && <p className="auth-error">{renameError}</p>}
          </div>
        ))}

        {view === 'join' && (
          <div className="auth-view">
            <h2>Entra amb el codi</h2>
            <p className="auth-sub">Demana el codi a qui va crear el rebost.</p>
            <form className="rebost-code-form" onSubmit={submitJoin}>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="Codi del rebost"
                maxLength={6}
                disabled={joinBusy}
                autoCapitalize="characters"
                autoComplete="off"
                autoFocus
              />
              <button type="submit" className="btn-primary" disabled={joinBusy || code.trim().length < 6}>
                {joinBusy ? 'Entrant...' : 'Entra'}
              </button>
            </form>
            <button type="button" className="scan-qr-btn" onClick={() => setScanning(true)}>
              Escaneja un codi QR
            </button>
            {joinError && <p className="auth-error">{joinError}</p>}
          </div>
        )}

        {view === 'create' && (
          <div className="auth-view">
            <h2>Crea un rebost</h2>
            <p className="auth-sub">Posa-hi un nom. Compartiràs un codi perquè hi entrin els de casa.</p>
            <form className="new-rebost-form" onSubmit={submitCreate}>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nom del rebost nou..."
                maxLength={60}
                disabled={busy}
                autoFocus
              />
              <button type="submit" className="btn-primary" disabled={busy || !name.trim()}>
                {busy ? 'Creant...' : 'Crea'}
              </button>
            </form>
            {createdCode && (
              <div className="code-banner">
                Rebost creat amb el codi <strong>{createdCode}</strong>. Comparteix-lo amb qui hi hagi d'entrar.
                <button type="button" className="banner-qr-btn" onClick={() => setCreatedQr(true)}>Mostra QR</button>
              </div>
            )}
            {createError && <p className="auth-error">{createError}</p>}
          </div>
        )}

        {error && <p className="auth-error" style={{ textAlign: 'center' }}>{error}</p>}

        <footer className="auth-footer">
          <DeleteAccountAction onDeleteAccount={onDeleteAccount} />
        </footer>
      </main>

      {scanning && <QrScanner onScan={handleScan} onClose={() => setScanning(false)} />}
      {createdQr && createdCode && <QrModal value={createdCode} onClose={() => setCreatedQr(false)} />}
    </div>
  )
}

function CodeChip({ code }) {
  const [showQr, setShowQr] = useState(false)
  if (!code) return null
  return (
    <>
      <button type="button" className="code-chip" onClick={() => setShowQr(true)} title="Mostra el codi QR">
        {code}
      </button>
      {showQr && <QrModal value={code} onClose={() => setShowQr(false)} />}
    </>
  )
}

function DeleteAccountAction({ onDeleteAccount }) {
  const [confirm, setConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState(null)

  if (!confirm) {
    return (
      <button className="delete-account-btn" onClick={() => setConfirm(true)}>
        Elimina el meu compte
      </button>
    )
  }

  const run = async () => {
    setDeleting(true)
    setError(null)
    try {
      await onDeleteAccount()
    } catch (err) {
      console.error('delete account', err)
      setDeleting(false)
      if (err && err.code === 'auth/popup-closed-by-user') setConfirm(false)
      else setError('No s\'ha pogut eliminar el compte. Torna-ho a provar.')
    }
  }

  return (
    <div className="modal-backdrop danger-backdrop" onClick={() => { if (!deleting) setConfirm(false) }}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Eliminar el teu compte</h2>
        <p className="desc">
          S'eliminarà el teu compte de Google d'El Rebost i tots els rebosts que has creat.
          Els rebosts on només ets membre es mantindran per als altres. Aquesta acció no es pot desfer.
        </p>
        <p className="desc">
          Apareixerà una finestra de Google per confirmar que ets tu.
        </p>
        {error && <p className="auth-error">{error}</p>}
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={() => setConfirm(false)} disabled={deleting}>Cancel·la</button>
          <button className="btn btn-danger" onClick={run} disabled={deleting}>
            {deleting ? 'Eliminant...' : 'Elimina el compte'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function RebostMenu({ rebosts, currentId, userUid, onSwitch, onDelete, onRename, onLogout, onClose, onCreate, onJoin, onDeleteAccount }) {
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [created, setCreated] = useState(null)
  const [createError, setCreateError] = useState(null)
  const [showJoin, setShowJoin] = useState(false)
  const [joining, setJoining] = useState(false)
  const [joinCode, setJoinCode] = useState('')
  const [joinError, setJoinError] = useState(null)
  const [scanning, setScanning] = useState(false)
  const [createdQr, setCreatedQr] = useState(false)
  const [editingNameId, setEditingNameId] = useState(null)
  const [nameDraft, setNameDraft] = useState('')
  const [renaming, setRenaming] = useState(false)
  const [renameError, setRenameError] = useState(null)

  const submit = async (e) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      setCreateError('Escriu un nom per al rebost.')
      return
    }
    if (creating) return
    setCreating(true)
    setCreated(null)
    setCreateError(null)
    const result = await onCreate(trimmed)
    setCreating(false)
    if (result && result.code) {
      setName('')
      setCreated(result.code)
    } else {
      setCreateError('No s\'ha pogut crear el rebost. Torna-ho a provar.')
    }
  }

  const runJoin = async (rawCode) => {
    const trimmed = String(rawCode || '').trim().toUpperCase().replace(/\s+/g, '')
    if (joining) return
    if (!trimmed) {
      setJoinError('Escriu el codi del rebost.')
      return
    }
    if (trimmed.length < 6) {
      setJoinError('El codi ha de tenir 6 caràcters.')
      return
    }
    setJoining(true)
    setJoinError(null)
    const result = await onJoin(trimmed)
    setJoining(false)
    if (result && result.error) {
      setJoinError(
        result.error === 'not-found'
          ? 'No s\'ha trobat cap rebost amb aquest codi.'
          : 'No s\'ha pogut entrar al rebost. Torna-ho a provar.'
      )
    } else {
      onClose()
    }
  }

  const submitJoin = (e) => {
    e.preventDefault()
    runJoin(joinCode)
  }

  const handleScan = (text) => {
    setScanning(false)
    setJoinCode(String(text || '').trim().toUpperCase().replace(/\s+/g, ''))
    runJoin(text)
  }

  const submitRename = async (e) => {
    e.preventDefault()
    const trimmed = nameDraft.trim()
    if (!trimmed || !editingNameId || renaming) return
    if (trimmed === (rebosts.find((r) => r.id === editingNameId) || {}).name) {
      setEditingNameId(null)
      return
    }
    setRenaming(true)
    setRenameError(null)
    try {
      await onRename(editingNameId, trimmed)
      setEditingNameId(null)
    } catch (err) {
      console.error('rename', err)
      setRenameError('No s\'ha pogut canviar el nom. Torna-ho a provar.')
    } finally {
      setRenaming(false)
    }
  }

  return (
    <>
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal rebost-menu" onClick={(e) => e.stopPropagation()}>
        <h2>Gestiona els teus rebosts</h2>

        <div className="rebost-menu-actions">
          <button
            className={'btn' + (showCreate ? ' active' : '')}
            onClick={() => { setShowCreate((v) => !v); setShowJoin(false) }}
          >
            + Nou rebost
          </button>
          <button
            className={'btn' + (showJoin ? ' active' : '')}
            onClick={() => { setShowJoin((v) => !v); setShowCreate(false) }}
          >
            Entra amb codi
          </button>
        </div>

        {showCreate && (
          <div className="rebost-menu-create">
            <form className="new-rebost-form" onSubmit={submit}>
              <input
                value={name}
                onChange={(e) => { setName(e.target.value); setCreateError(null) }}
                placeholder="Nom del rebost nou..."
                maxLength={60}
                disabled={creating}
              />
              <button type="submit" className="btn-primary" disabled={creating}>
                {creating ? 'Creant...' : 'Crea'}
              </button>
            </form>
            {createError && <p className="auth-error">{createError}</p>}
            {created && (
              <div className="code-banner">
                Creat amb el codi <strong>{created}</strong>. Comparteix-lo amb qui hi hagi d'entrar.
                <button type="button" className="banner-qr-btn" onClick={() => setCreatedQr(true)}>Mostra QR</button>
              </div>
            )}
          </div>
        )}

        {showJoin && (
          <div className="rebost-menu-join">
            <form className="rebost-code-form" onSubmit={submitJoin}>
              <input
                value={joinCode}
                onChange={(e) => { setJoinCode(e.target.value.toUpperCase()); setJoinError(null) }}
                placeholder="Codi del rebost"
                maxLength={6}
                disabled={joining}
                autoCapitalize="characters"
                autoComplete="off"
              />
              <button type="submit" className="btn-primary" disabled={joining}>
                {joining ? 'Entrant...' : 'Entra'}
              </button>
            </form>
            <button type="button" className="scan-qr-btn" onClick={() => setScanning(true)}>
              Escaneja un codi QR
            </button>
            {joinError && <p className="auth-error">{joinError}</p>}
          </div>
        )}

        <div className="rebost-menu-list">
          {rebosts.map((r) => {
            const editing = editingNameId === r.id
            return (
              <div key={r.id} className="rebost-menu-item">
                {editing ? (
                  <form className="rebost-rename-form" onSubmit={submitRename}>
                    <input
                      value={nameDraft}
                      onChange={(e) => { setNameDraft(e.target.value); setRenameError(null) }}
                      maxLength={60}
                      autoFocus
                      aria-label="Nou nom del rebost"
                    />
                    <button type="submit" className="btn btn-primary btn-slim" disabled={renaming || !nameDraft.trim()}>
                      {renaming ? '...' : 'Desa'}
                    </button>
                    <button type="button" className="icon-btn" onClick={() => setEditingNameId(null)} aria-label="Cancel·la">✕</button>
                  </form>
                ) : (
                  <button className="rebost-menu-name" onClick={() => onSwitch(r.id)}>
                    <span className="rebost-card-icon"><Logo size={26} /></span>
                    <span className="rebost-card-name">{r.name}</span>
                    {r.id === currentId && <span className="tag tag-info">Actual</span>}
                  </button>
                )}
                {!editing && <CodeChip code={r.code} />}
                {r.owner === userUid && !editing && (
                  <button
                    className="icon-btn"
                    onClick={() => { setEditingNameId(r.id); setNameDraft(r.name); setRenameError(null) }}
                    aria-label={`Canvia el nom del rebost "${r.name}"`}
                    title="Canvia el nom"
                  >
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
                      <path d="M12 20h9" />
                      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                    </svg>
                  </button>
                )}
                {r.owner === userUid && (
                  <button
                    className="icon-btn danger-icon"
                    onClick={() => onDelete(r)}
                    aria-label={`Eliminar el rebost "${r.name}"`}
                    title="Eliminar rebost"
                  >
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                      <path d="M10 11v6M14 11v6" />
                      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                    </svg>
                  </button>
                )}
              </div>
            )
          })}
          {renameError && <p className="auth-error">{renameError}</p>}
        </div>

        <button className="logout-btn" onClick={onLogout}>
          Tanca la sessió
        </button>
        <DeleteAccountAction onDeleteAccount={onDeleteAccount} />
        <div className="version-tag">El Rebost · v1.0.0</div>
      </div>
    </div>
      {scanning && <QrScanner onScan={handleScan} onClose={() => setScanning(false)} />}
      {createdQr && created && <QrModal value={created} onClose={() => setCreatedQr(false)} />}
    </>
  )
}
