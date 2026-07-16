// Centralized date helpers.
//
// The bug this fixes: the old code mixed `date.toISOString().slice(0, 10)`
// (which gives the UTC calendar day) with hour slots and comparisons built
// in LOCAL time. For anyone not in UTC — e.g. India at UTC+5:30 — that
// mismatch meant:
//   - "today" could silently mean the wrong day for the first few hours
//     after local midnight (uploads before 5:30am IST were being filed
//     under yesterday).
//   - hourly water slots (9am, 10am, ...) could be built against the wrong
//     date string and drift by the UTC offset.
//   - streaks in the profile screen could skip or double-count days.
//
// Everything below works in the browser's LOCAL time and only converts to
// ISO/UTC at the very last step (when talking to Supabase), so the instant
// sent to the server always matches the user's actual local day boundary.

export function localDateKey(d = new Date()) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function startOfLocalDay(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0)
}

export function endOfLocalDay(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999)
}

// A specific hour on the given LOCAL day (used to build water slots).
export function localHourDate(baseDate, hour) {
  return new Date(
    baseDate.getFullYear(),
    baseDate.getMonth(),
    baseDate.getDate(),
    hour,
    0,
    0,
    0
  )
}

// Which LOCAL calendar day does this ISO timestamp fall on for this user?
export function isoToLocalDateKey(iso) {
  return localDateKey(new Date(iso))
}
