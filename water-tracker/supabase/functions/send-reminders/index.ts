// Supabase Edge Function: send-reminders
//
// Runs on a cron schedule (see supabase/migration_05_cron.sql, every 15
// min). For every user with a saved push subscription, it works out —
// in THAT user's own timezone — whether a water-goal slot is due right
// now and hasn't been logged yet, and if so sends a real Web Push
// notification via the browser's standard Push API + VAPID keys. This is
// entirely free: no OneSignal/Firebase account, just the web-push
// protocol and Supabase's own free-tier cron + edge functions.
//
// Deploy:
//   supabase functions deploy send-reminders
//   supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:you@example.com
//   supabase secrets set SB_SERVICE_ROLE_KEY=...   (Project Settings -> API -> service_role key)
// (SUPABASE_URL is already available automatically inside edge functions.)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import webpush from 'https://esm.sh/web-push@3.6.7'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SB_SERVICE_ROLE_KEY')!
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')!
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') || 'mailto:admin@example.com'

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

// Mirrors src/lib/schedule.js — kept in sync manually since this runs in
// Deno, not the Vite bundle.
function buildWaterSlots(startHour: number, endHour: number, slotCount: number, now: Date) {
  const start = Math.min(startHour, endHour)
  const end = Math.max(startHour, endHour)
  const spanMinutes = (end - start) * 60
  const count = Math.min(48, Math.max(1, slotCount))
  const slots: { hour: number; minute: number }[] = []
  for (let i = 0; i < count; i++) {
    const raw = count === 1 ? 0 : (spanMinutes * i) / (count - 1)
    const offset = Math.round(raw / 15) * 15
    slots.push({ hour: start + Math.floor(offset / 60), minute: offset % 60 })
  }
  return slots
}

// Current local wall-clock time + date-key for a given IANA timezone.
function localNow(timeZone: string) {
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
  return {
    dateKey: `${parts.year}-${parts.month}-${parts.day}`,
    hour,
    minute: Number(parts.minute)
  }
}

Deno.serve(async () => {
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, water_start_hour, water_end_hour, water_slot_count, timezone')
    .eq('role', 'user')

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }

  let sent = 0
  const errors: string[] = []

  for (const profile of profiles || []) {
    const timeZone = profile.timezone || 'Asia/Kolkata'
    const { dateKey, hour, minute } = localNow(timeZone)
    const slots = buildWaterSlots(
      profile.water_start_hour ?? 9,
      profile.water_end_hour ?? 21,
      profile.water_slot_count ?? 13,
      new Date()
    )

    // A slot is "due" if we're within 15 minutes after it (matches the
    // cron cadence in migration_05_cron.sql).
    const nowMinutes = hour * 60 + minute
    const dueSlot = slots.find((s) => {
      const slotMinutes = s.hour * 60 + s.minute
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

    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', profile.id)
    if (!subs?.length) continue

    const label = `${dueSlot.hour % 12 || 12}${dueSlot.hour < 12 ? 'am' : 'pm'} water break`
    const payload = JSON.stringify({
      title: label,
      body: "Tap to log it before your next slot.",
      tag: 'water-reminder',
      url: '/'
    })

    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        )
        sent++
      } catch (err) {
        errors.push(`${sub.id}: ${err instanceof Error ? err.message : String(err)}`)
        // 404/410 means the subscription is dead — clean it up.
        if (err instanceof Error && /404|410/.test(err.message)) {
          await supabase.from('push_subscriptions').delete().eq('id', sub.id)
        }
      }
    }
  }

  return new Response(JSON.stringify({ sent, errors }), {
    headers: { 'Content-Type': 'application/json' }
  })
})
