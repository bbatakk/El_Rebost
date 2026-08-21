import { useEffect, useState } from 'react'
import {
  useAuth, useRebosts, useRebostData, saveRebost, renameRebost,
  loginWithGoogle, logout, getLastRebost, setLastRebost,
  createRebost, joinRebost, deleteRebost, deleteAccount
} from './firebase.js'
import MainApp from './MainApp.jsx'
import ConfirmDialog from './components/ConfirmDialog.jsx'
import { Splash, LoginScreen, RebostSelect, RebostMenu } from './components/AuthScreens.jsx'
import Onboarding from './components/Onboarding.jsx'

// Arrel de l'app: sessió de Google, selecció del rebost actiu i el seu menú.
export default function App() {
  const { ready: authReady, user } = useAuth()
  const [rebostId, setRebostId] = useState(null)
  const [loginError, setLoginError] = useState(null)
  const [createBusy, setCreateBusy] = useState(false)
  const [joinBusy, setJoinBusy] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuConfirm, setMenuConfirm] = useState(null) // { title, message, rebostId, code }
  const [showOnboarding, setShowOnboarding] = useState(false)

  useEffect(() => {
    if (!user || user.isAnonymous) {
      setRebostId(null)
      return
    }
    setRebostId(getLastRebost(user.uid))
  }, [user ? user.uid : null])

  useEffect(() => {
    if (user && !user.isAnonymous && !localStorage.getItem('elrebost:onboarding:' + user.uid)) {
      setShowOnboarding(true)
    }
  }, [user ? user.uid : null])

  const closeOnboarding = () => {
    if (user) localStorage.setItem('elrebost:onboarding:' + user.uid, '1')
    setShowOnboarding(false)
  }

  const { ready: rebostsReady, rebosts } = useRebosts(user && !user.isAnonymous ? user.uid : null)
  const { ready: dataReady, data } = useRebostData(rebostId)
  const current = rebosts.find((r) => r.id === rebostId)

  useEffect(() => {
    if (current && dataReady && !data) setLastRebost(user.uid, null)
  }, [current, dataReady, data, user])

  const handleLogin = () => {
    setLoginError(null)
    loginWithGoogle().catch((err) => {
      if (err && err.code === 'auth/popup-closed-by-user') return
      console.error('login', err)
      setLoginError('No s\'ha pogut iniciar la sessió. Torna-ho a provar.')
    })
  }

  const enterRebost = (id) => {
    setRebostId(id)
    if (user) setLastRebost(user.uid, id)
  }

  const handleJoin = (code) => {
    setJoinBusy(true)
    return joinRebost(code, user.uid)
      .then((res) => {
        if (!res.error) enterRebost(res.id)
        return res
      })
      .catch((err) => {
        console.error('join', err)
        return { error: 'unknown' }
      })
      .finally(() => setJoinBusy(false))
  }

  const handleCreate = (name) => {
    setCreateBusy(true)
    return createRebost(user.uid, name)
      .then((res) => res)
      .catch((err) => {
        console.error('create', err)
        return null
      })
      .finally(() => setCreateBusy(false))
  }

  const handleRename = (id, name) => renameRebost(id, name)

  const requestDeleteRebost = (r) => {
    setMenuConfirm({
      title: 'Eliminar rebost',
      message: `S'eliminarà el rebost "${r.name}" amb TOT el seu contingut. Aquesta acció no es pot desfer.`,
      rebostId: r.id,
      code: r.code
    })
  }

  const confirmDeleteRebost = () => {
    if (!menuConfirm) return
    const { rebostId, code } = menuConfirm
    deleteRebost(rebostId, code)
      .then(() => {
        setMenuConfirm(null)
        if (rebostId === current?.id) {
          setMenuOpen(false)
          setRebostId(null)
          if (user) setLastRebost(user.uid, null)
        }
      })
      .catch((err) => {
        console.error('delete', err)
        setMenuConfirm(null)
        setMenuOpen(false)
      })
  }

  const renderSelect = () => (
    <>
      <RebostSelect
        rebosts={rebosts}
        onCreate={handleCreate}
        onJoin={handleJoin}
        onSelect={enterRebost}
        onLogout={() => logout()}
        onDeleteAccount={() => deleteAccount(user.uid)}
        busy={createBusy}
        joinBusy={joinBusy}
        userUid={user.uid}
        onRename={handleRename}
      />
      {showOnboarding && <Onboarding onClose={closeOnboarding} />}
    </>
  )

  if (!authReady) return <Splash />
  if (!user || user.isAnonymous) return <LoginScreen onLogin={handleLogin} error={loginError} />
  if (!rebostsReady) return <Splash />
  if (!current || (dataReady && !data)) return renderSelect()
  if (!dataReady) return <Splash />

  const save = (partial) => saveRebost(current.id, partial)

  return (
    <>
      <MainApp
        data={data}
        save={save}
        rebostName={current.name}
        onOpenMenu={() => setMenuOpen(true)}
      />

      {menuOpen && (
        <RebostMenu
          rebosts={rebosts}
          currentId={current.id}
          userUid={user.uid}
          onCreate={handleCreate}
          onJoin={handleJoin}
          onSwitch={(id) => {
            enterRebost(id)
            setMenuOpen(false)
          }}
          onDelete={requestDeleteRebost}
          onRename={handleRename}
          onLogout={() => logout()}
          onDeleteAccount={() => deleteAccount(user.uid)}
          onClose={() => setMenuOpen(false)}
        />
      )}

      {menuConfirm && (
        <ConfirmDialog
          title={menuConfirm.title}
          message={menuConfirm.message}
          onCancel={() => setMenuConfirm(null)}
          onConfirm={confirmDeleteRebost}
        />
      )}

      {showOnboarding && <Onboarding onClose={closeOnboarding} />}
    </>
  )
}
