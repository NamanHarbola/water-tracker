// Web Push subscribe/unsubscribe helpers. This is the free, standards-based
// alternative to a paid service like OneSignal: the browser's built-in Push
// API + VAPID keys you generate yourself, no third-party account needed.
//
// Requires:
//  - VITE_VAPID_PUBLIC_KEY set in .env (see README "Real push notifications")
//  - The `push_subscriptions` table from supabase/migration_04_goals_and_push.sql
//  - public/sw.js registered (already wired up in index.html)

import { supabase } from '../supabaseClient'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY

export function pushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && !!VAPID_PUBLIC_KEY
}

export async function getPushSubscriptionState() {
  if (!pushSupported()) return 'unsupported'
  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.getSubscription()
  return sub ? 'subscribed' : 'unsubscribed'
}

export async function subscribeToPush(userId) {
  if (!pushSupported()) throw new Error('Push notifications are not supported in this browser.')

  if (Notification.permission === 'default') {
    const perm = await Notification.requestPermission()
    if (perm !== 'granted') throw new Error('Notification permission was denied.')
  }
  if (Notification.permission !== 'granted') {
    throw new Error('Notification permission was denied.')
  }

  const reg = await navigator.serviceWorker.ready
  let sub = await reg.pushManager.getSubscription()
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    })
  }

  const json = sub.toJSON()
  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: userId,
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth
    },
    { onConflict: 'endpoint' }
  )
  if (error) throw error
  return sub
}

export async function unsubscribeFromPush() {
  if (!('serviceWorker' in navigator)) return
  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.getSubscription()
  if (!sub) return
  await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
  await sub.unsubscribe()
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}
