// Service worker. Three responsibilities:
// 1. Lets the site be installed as a PWA (required for iOS home-screen notifications).
// 2. Shows a local notification when the page tells it to via postMessage —
//    this covers reminders while the tab is open/backgrounded.
// 3. Shows a notification when a real server-sent Web Push message arrives
//    (see supabase/functions/send-reminders) — this is the one that fires
//    even when the app/PWA is fully closed.

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SHOW_REMINDER') {
    const hour = event.data.hour
    const label =
      typeof hour === 'number'
        ? `${hour % 12 || 12}${hour < 12 ? 'am' : 'pm'} water break`
        : 'Time to drink water 💧'
    self.registration.showNotification(label, {
      body: 'Tap to log your break before the next slot.',
      icon: '/icon-192.png',
      tag: 'water-reminder',
      renotify: true
    })
  }
})

// Real background push, sent by the send-reminders edge function via the
// standard Web Push protocol (no proprietary SDK — this is the browser's
// built-in PushManager, free on every browser that supports it).
self.addEventListener('push', (event) => {
  let payload = { title: 'Time to drink water 💧', body: 'Tap to log your break.' }
  if (event.data) {
    try {
      payload = { ...payload, ...event.data.json() }
    } catch {
      payload.body = event.data.text()
    }
  }
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: '/icon-192.png',
      tag: payload.tag || 'water-reminder',
      renotify: true,
      data: { url: payload.url || '/' }
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus()
      }
      return self.clients.openWindow(url)
    })
  )
})
