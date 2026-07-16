// Minimal service worker. Two responsibilities:
// 1. Lets the site be installed as a PWA (required for iOS home-screen notifications).
// 2. Shows a local notification when the page tells it to via postMessage.
//    This covers reminders while the tab is open/backgrounded. For reminders
//    that must fire even when the app is fully closed, see the README section
//    on server-side push (e.g. via a free OneSignal plan) — that requires a
//    small backend cron job, which a pure static site can't do on its own.

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

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clientList) => {
      if (clientList.length > 0) return clientList[0].focus()
      return self.clients.openWindow('/')
    })
  )
})
