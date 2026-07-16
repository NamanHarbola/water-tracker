import { useEffect, useRef } from 'react'

// Polls once a minute while the tab/PWA is open and fires a notification
// the first time a scheduled slot's hour arrives and hasn't been logged yet.
// This does NOT wake the app if it's fully closed — for that you'd need
// server-triggered push (see README).
export default function useReminders(slots, doneSlotIds) {
  const firedRef = useRef(new Set())

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }

    const interval = setInterval(() => {
      const now = new Date()
      for (const slot of slots) {
        const isDue = now >= slot.time && now - slot.time < 5 * 60 * 1000 // within 5 min of the hour
        if (isDue && !doneSlotIds.has(slot.id) && !firedRef.current.has(slot.id)) {
          firedRef.current.add(slot.id)
          navigator.serviceWorker?.ready.then((reg) => {
            reg.active?.postMessage({ type: 'SHOW_REMINDER' })
          })
        }
      }
    }, 60 * 1000)

    return () => clearInterval(interval)
  }, [slots, doneSlotIds])
}
