import { useEffect, useRef, useState } from 'react'

let audioCtx = null
export function ensureAudio() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!audioCtx) audioCtx = new Ctx()
    if (audioCtx.state === 'suspended') audioCtx.resume()
    return audioCtx
  } catch (e) { return null }
}

export function alarm() {
  const ctx = ensureAudio()
  if (!ctx) return
  try {
    const note = (freq, start, dur, vol) => {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.type = 'sine'
      o.frequency.value = freq
      o.connect(g)
      g.connect(ctx.destination)
      const t = ctx.currentTime + start
      g.gain.setValueAtTime(0.0001, t)
      g.gain.exponentialRampToValueAtTime(vol, t + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
      o.start(t)
      o.stop(t + dur + 0.05)
    }
    for (let i = 0; i < 8; i++) {
      const s = i * 0.55
      note(880, s, 0.3, 0.5)
      note(1175, s + 0.05, 0.3, 0.35)
    }
  } catch (e) { /* sense àudio */ }
}

function requestNotifyPermission() {
  try {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  } catch (e) { /* sense notificacions */ }
}

export function vibrateAlarm() {
  if (!('vibrate' in navigator)) return
  const until = Date.now() + 6000
  const id = setInterval(() => {
    const left = until - Date.now()
    if (left <= 0) {
      clearInterval(id)
      navigator.vibrate(0)
      return
    }
    navigator.vibrate(Math.min(1200, left))
  }, 1000)
}

export function notifyTimerFinish(label) {
  try {
    if (!('Notification' in window) || Notification.permission !== 'granted') return
    closeTimerNotification('el-rebost-timer')
    const options = {
      body: label || 'El temporitzador ha arribat a 0.',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: 'el-rebost-timer-done',
      renotify: true,
      vibrate: [500, 200, 500, 200, 500, 200, 500, 200, 500, 200, 1000]
    }
    if (navigator.serviceWorker && navigator.serviceWorker.ready) {
      navigator.serviceWorker.ready.then((reg) => reg.showNotification('⏰ Temps acabat', options))
    } else {
      new Notification('⏰ Temps acabat', options)
    }
  } catch (e) { /* sense notificacions */ }
}

export function showTimerNotification(body, silent) {
  try {
    if (!('Notification' in window) || Notification.permission !== 'granted') return
    const options = {
      body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: 'el-rebost-timer',
      silent: !!silent,
      renotify: false
    }
    if (navigator.serviceWorker && navigator.serviceWorker.ready) {
      navigator.serviceWorker.ready.then((reg) => reg.showNotification('El Rebost', options))
    } else {
      new Notification('El Rebost', options)
    }
  } catch (e) { /* sense notificacions */ }
}

export function closeTimerNotification(tag) {
  try {
    if (!navigator.serviceWorker || !navigator.serviceWorker.ready) return
    navigator.serviceWorker.ready.then((reg) =>
      reg.getNotifications({ tag }).then((list) => list.forEach((n) => n.close()))
    )
  } catch (e) { /* sense notificacions */ }
}

export function useTimer(onFinish) {
  const [timer, setTimer] = useState(null)
  const onFinishRef = useRef(onFinish)
  onFinishRef.current = onFinish
  const prevRunning = useRef(null)

  useEffect(() => {
    if (!timer || !timer.running) return undefined
    const id = setInterval(() => {
      setTimer((t) => {
        if (!t || !t.running) return t
        const remaining = t.deadline - Date.now()
        if (remaining <= 0) return { ...t, running: false, remaining: 0, deadline: null }
        return { ...t, remaining }
      })
    }, 250)
    return () => clearInterval(id)
  }, [timer && timer.running])

  useEffect(() => {
    const wasRunning = prevRunning.current
    prevRunning.current = timer ? timer.running : null
    if (timer && wasRunning === true && timer.running === false && timer.remaining === 0) {
      onFinishRef.current && onFinishRef.current(timer.label)
    }
  }, [timer])

  const start = (ms, label) => {
    ensureAudio()
    requestNotifyPermission()
    setTimer({
      total: Math.max(0, ms),
      deadline: Date.now() + Math.max(0, ms),
      remaining: Math.max(0, ms),
      running: true,
      label: label || null
    })
  }
  const pause = () => setTimer((t) => (t && t.running ? { ...t, running: false, remaining: Math.max(0, t.deadline - Date.now()), deadline: null } : t))
  const resume = () => setTimer((t) => (t && !t.running && t.remaining > 0 ? { ...t, running: true, deadline: Date.now() + t.remaining } : t))
  const restart = () => setTimer((t) => (t && t.total > 0 ? { ...t, running: true, deadline: Date.now() + t.total, remaining: t.total } : t))
  const stop = () => setTimer(null)
  const edit = (ms) => setTimer((t) => (t ? { ...t, total: Math.max(0, ms), remaining: Math.max(0, ms), running: false, deadline: null } : t))

  return { timer, start, pause, resume, restart, stop, edit }
}
