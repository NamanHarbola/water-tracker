// Runs every 15 minutes (see .github/workflows/reminders.yml). For every
// tracked user, works out — in THEIR OWN timezone and using THEIR OWN
// goal settings (start hour / end hour / reminders-per-day, set from
// Profile → "Your goal") — whether a slot is due right now and hasn't
// been logged yet, and if so sends them a real push via OneSignal. This
// mirrors src/lib/schedule.js so the reminders always match what's shown
// on the Dashboard.

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

// Mirrors src/lib/schedule.js's buildWaterSlots — kept in sync manually
// since this runs in plain Node, not the Vite bundle.
function buildWaterSlots(startHour, endHour, slotCount) {
  const start = Math.min(startHour, endHour)
  const end = Math.max(startHour, endHour)
  const spanMinutes = (end - start) * 60
  const count = Math.min(48, Math.max(1, slotCount))
  const slots = []
  for (let i = 0; i < count; i++) {
    const raw = count === 1 ? 0 : (spanMinutes * i) / (count - 1)
    const offset = Math.round(raw / 15) * 15
    slots.push({ hour: start + Math.floor(offset / 60), minute: offset % 60 })
  }
  return slots
}

function localNow(timeZone) {
  const now = new Date()
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })
  const parts = Object.fromEntries(fmt.formatToParts(now).map((p) => [p.type, p.value]))
  const hour = parts.hour === '24' ? 0 : Number(parts.hour)
  return { dateKey: `${parts.year}-${parts.month}-${parts.day}`, hour, minute: Number(parts.minute) }
}

async function sendPush(userId, label) {
  const res = await fetch('https://api.onesignal.com/notifications', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Key ${process.env.ONESIGNAL_REST_API_KEY}`
    },
    body: JSON.stringify({
      app_id: process.env.ONESIGNAL_APP_ID,
      include_external_user_ids: [userId],
      channel_for_external_user_ids: 'push',
      headings: { en: label },
      contents: { en: "Tap to log it before your next slot." }
    })
  })
  const json = await res.json()
  if (!res.ok) throw new Error(JSON.stringify(json))
  return json
}

async function main() {
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, water_start_hour, water_end_hour, water_slot_count, timezone')
    .eq('role', 'user')
  if (error) throw error
  if (!profiles?.length) {
    console.log('No tracked users yet.')
    return
  }

  let sent = 0
  for (const profile of profiles) {
    const timeZone = profile.timezone || 'Asia/Kolkata'
    const { dateKey, hour, minute } = localNow(timeZone)
    const slots = buildWaterSlots(profile.water_start_hour ?? 9, profile.water_end_hour ?? 21, profile.water_slot_count ?? 13)

    const nowMinutes = hour * 60 + minute
    const dueSlot = slots.find((s) => {
      const slotMinutes = s.hour * 60 + s.minute
      // Within 15 min after the slot — matches this workflow's cron cadence.
      return nowMinutes >= slotMinutes && nowMinutes - slotMinutes < 15
    })
    if (!dueSlot) continue

    const slotId = `${dateKey}-${String(dueSlot.hour).padStart(2, '0')}${String(dueSlot.minute).padStart(2, '0')}`

    const { data: existingLog } = await supabase
      .from('logs')
      .select('id')
      .eq('user_id', profile.id)
      .eq('slot_id', slotId)
      .maybeSingle()
    if (existingLog) continue

    const label = `${dueSlot.hour % 12 || 12}${dueSlot.hour < 12 ? 'am' : 'pm'} water break`
    try {
      await sendPush(profile.id, label)
      sent++
      console.log(`Sent to ${profile.id} for slot ${slotId}`)
    } catch (err) {
      console.error(`Failed for ${profile.id}:`, err.message)
    }
  }

  console.log(`Done. Sent ${sent} reminder(s).`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
