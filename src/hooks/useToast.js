import { useEffect, useRef, useState } from 'react'

export function useToast() {
  const [toast, setToast] = useState(null) // { id, message, action? }
  const toastTimer = useRef(null)

  const showToast = (message, action) => {
    setToast({ id: Date.now(), message, action })
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 3500)
  }

  const dismissToast = () => setToast(null)

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
  }, [])

  return { toast, showToast, dismissToast }
}
