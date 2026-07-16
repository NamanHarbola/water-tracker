import { useEffect, useRef } from 'react'

// Polls while the tab/PWA is open and fires a notification the first time a
// scheduled slot's hour arrives and hasn't been logged yet.
//
// Fixes vs the original version:
//  - Checks every 20s instead of every 60s, so a slot that becomes due is
//    noticed quickly instead of possibly waiting almost a full minute.
//  - Runs one check immediately on mount, instead of waiting for the first
//    interval tick — otherwise opening the app right as a slot goes due
//    could sit silently for up to a minute.
//  - `firedRef` is keyed by slot id (which already includes the local date,
//    see src/lib/date.js), so it naturally resets once a new day's slots
//    are generated — no stale "already fired" state carrying over.
//
// This does NOT wake the app if it's fully closed/killed — that needs
// server-triggered push (see README's note on web push / a small backend
// cron). A page that isn't open can't run this polling loop at all.
export default function useReminders(slots, doneSlotIds) {
  const firedRef = useRef(new Set())

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }

    function checkDue() {
      if (!('Notification' in window) || Notification.permission !== 'granted') return
      const now = new Date()
      for (const slot of slots) {
        const isDue = now >= slot.time && now - slot.time < 10 * 60 * 1000 // within 10 min of the hour
        if (isDue && !doneSlotIds.has(slot.id) && !firedRef.current.has(slot.id)) {
          firedRef.current.add(slot.id)
          navigator.serviceWorker?.ready.then((reg) => {
            reg.active?.postMessage({
              type: 'SHOW_REMINDER',
              hour: slot.hour
            })
          })
        }
      }
    }

    checkDue()
    const interval = setInterval(checkDue, 20 * 1000)
    return () => clearInterval(interval)
  }, [slots, doneSlotIds])
}
