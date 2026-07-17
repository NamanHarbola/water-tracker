// Push notification helpers backed by OneSignal (see index.html for SDK
// setup and App.jsx for the login-linking effect). Exposes the same small
// surface the old Web-Push version did, so Profile.jsx doesn't need to
// know which backend is behind it.

function withOneSignal() {
  return new Promise((resolve) => {
    window.OneSignalDeferred = window.OneSignalDeferred || []
    window.OneSignalDeferred.push(resolve)
  })
}

export function pushSupported() {
  // OneSignal itself checks browser support at init time; from here we
  // just need the SDK script to have loaded, which OneSignalDeferred
  // guarantees once resolved. Actual "can this browser get push at all"
  // (e.g. iOS needing an installed PWA) surfaces as requestPermission()
  // rejecting, which subscribeToPush() below turns into a friendly error.
  return typeof window !== 'undefined'
}

export async function getPushSubscriptionState() {
  const OneSignal = await withOneSignal()
  return OneSignal.User.PushSubscription.optedIn ? 'subscribed' : 'unsubscribed'
}

export async function subscribeToPush() {
  const OneSignal = await withOneSignal()
  if (!OneSignal.Notifications.permission) {
    const granted = await OneSignal.Notifications.requestPermission()
    if (!granted && !OneSignal.Notifications.permission) {
      throw new Error('Notification permission was denied.')
    }
  }
  await OneSignal.User.PushSubscription.optIn()
}

export async function unsubscribeFromPush() {
  const OneSignal = await withOneSignal()
  await OneSignal.User.PushSubscription.optOut()
}
