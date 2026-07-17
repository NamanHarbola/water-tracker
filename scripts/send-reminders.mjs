// Runs hourly (see .github/workflows/reminders.yml). For the current
// scheduled slot, finds users who haven't logged it yet and sends
// them a real push notification via OneSignal — this fires even if
// their phone/app is fully closed, unlike the in-app reminder.

import { createClient } from '@supabase/supabase-js'

const SCHEDULE_HOURS = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21]

// The app's slot IDs are built from the browser's local wall-clock hour.
// Assumes your users are in India (IST) — change this if not.
const TIMEZONE = 'Asia/Kolkata'

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

function localHour(date) {
  return Number(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: TIMEZONE,
      hour: 'numeric',
      hourCycle: 'h23'
    }).format(date)
  )
}

async function main() {
  const now = new Date()
  const hour = localHour(now)

  if (!SCHEDULE_HOURS.includes(hour)) {
    console.log(`Hour ${hour} (${TIMEZONE}) is outside the schedule — nothing to send.`)
    return
  }

  const date = now.toISOString().slice(0, 10)
  const slotId = `${date}-${hour}`

  const { data: users, error: userErr } = await supabase
    .from('profiles')
    .select('id')
    .eq('role', 'user')
  if (userErr) throw userErr
  if (!users || users.length === 0) {
    console.log('No tracked users yet.')
    return
  }

  const { data: doneLogs, error: logErr } = await supabase
    .from('logs')
    .select('user_id')
    .eq('slot_id', slotId)
  if (logErr) throw logErr

  const doneIds = new Set((doneLogs || []).map((l) => l.user_id))
  const pending = users.map((u) => u.id).filter((id) => !doneIds.has(id))

  if (pending.length === 0) {
    console.log(`Slot ${slotId}: everyone already logged it.`)
    return
  }

  const res = await fetch('https://api.onesignal.com/notifications', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Key ${process.env.ONESIGNAL_REST_API_KEY}`
    },
    body: JSON.stringify({
      app_id: process.env.ONESIGNAL_APP_ID,
      include_external_user_ids: pending,
      channel_for_external_user_ids: 'push',
      headings: { en: 'Time to drink water 💧' },
      contents: { en: 'Tap to log your break before the next slot.' }
    })
  })

  const json = await res.json()
  if (!res.ok) {
    console.error('OneSignal error:', json)
    process.exit(1)
  }
  console.log(`Slot ${slotId}: reminder sent to ${pending.length} user(s).`, json)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
