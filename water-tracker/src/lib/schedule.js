// Builds the day's water-reminder slots from a user's editable goal
// settings (start hour, end hour, how many reminders in between), instead
// of the old fixed 9am–9pm hourly grid.
//
// `slotCount` reminders are spread evenly across [startHour, endHour],
// rounded to the nearest 15 minutes so times look natural (e.g. 9:00,
// 10:12, 11:24 instead of 9:00, 10:12:51.4...). With slotCount = 1 the
// single reminder lands at startHour.

export const DEFAULT_GOAL = { startHour: 9, endHour: 21, slotCount: 13 }

export function buildWaterSlots(goal, now = new Date()) {
  const startHour = clampHour(goal?.startHour ?? DEFAULT_GOAL.startHour)
  const endHour = clampHour(goal?.endHour ?? DEFAULT_GOAL.endHour)
  const slotCount = Math.min(48, Math.max(1, goal?.slotCount ?? DEFAULT_GOAL.slotCount))

  const start = Math.min(startHour, endHour)
  const end = Math.max(startHour, endHour)
  const spanMinutes = (end - start) * 60
  const dateKey = localDateKey(now)

  const slots = []
  for (let i = 0; i < slotCount; i++) {
    const rawOffset = slotCount === 1 ? 0 : (spanMinutes * i) / (slotCount - 1)
    const offsetMinutes = Math.round(rawOffset / 15) * 15
    const hour = start + Math.floor(offsetMinutes / 60)
    const minute = offsetMinutes % 60
    const slotTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute, 0, 0)
    slots.push({
      id: `${dateKey}-${String(hour).padStart(2, '0')}${String(minute).padStart(2, '0')}`,
      hour,
      minute,
      time: slotTime,
      isPast: slotTime <= now
    })
  }
  return slots
}

export function formatSlotTime(hour, minute) {
  const h = hour % 12 || 12
  const ampm = hour < 12 ? 'am' : 'pm'
  return minute ? `${h}:${String(minute).padStart(2, '0')}${ampm}` : `${h}${ampm}`
}

function clampHour(h) {
  return Math.min(23, Math.max(0, Math.round(h)))
}

// duplicated here (not imported from ./date) to keep this module dependency-free
function localDateKey(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
