// OneSignal's own worker script handles real background push delivery
// (see index.html for SDK init) — this import lets it register its
// listeners inside the same service worker file the site already needs
// for PWA install support.
importScripts('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDKWorker.js')

// Beyond OneSignal, this service worker has one more job: showing a local
// notification when the page tells it to via postMessage. That covers
// reminders while the tab is open/backgrounded (see src/useReminders.js) —
// OneSignal is only needed for the "app is fully closed" case.

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
      for (const client of clientList) {
        if ('focus' in client) return client.focus()
      }
      return self.clients.openWindow('/')
    })
  )
})
