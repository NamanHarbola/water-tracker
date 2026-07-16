import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabaseClient'
import WaterTank from './WaterTank'
import TrackWaterModal from './TrackWaterModal'
import CalorieTracker from './CalorieTracker'
import Avatar from './Avatar'
import useReminders from '../useReminders'
import { localDateKey, startOfLocalDay } from '../lib/date'
import { buildWaterSlots, formatSlotTime, DEFAULT_GOAL } from '../lib/schedule'

export default function Dashboard({ session, onOpenProfile }) {
  const userId = session.user.id

  // `now` ticks forward periodically so slots correctly flip to "past due"
  // as the day goes on, and so we notice when local midnight rolls over
  // instead of freezing "today" at whatever it was on page load.
  const [now, setNow] = useState(() => new Date())
  const dateKey = localDateKey(now)

  const [profile, setProfile] = useState(null)
  const [logs, setLogs] = useState([])
  const [calorieEntries, setCalorieEntries] = useState([])
  const [activeSlot, setActiveSlot] = useState(null)
  const [loading, setLoading] = useState(true)

  const goal = profile
    ? {
        startHour: profile.water_start_hour,
        endHour: profile.water_end_hour,
        slotCount: profile.water_slot_count
      }
    : DEFAULT_GOAL

  const slots = useMemo(
    () => buildWaterSlots(goal, now),
    [dateKey, now, goal.startHour, goal.endHour, goal.slotCount]
  )

  useEffect(() => {
    const tick = setInterval(() => setNow(new Date()), 30 * 1000)
    return () => clearInterval(tick)
  }, [])

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateKey])

  async function loadData() {
    setLoading(true)
    const dayStart = startOfLocalDay().toISOString()

    const { data: profileData } = await supabase
      .from('profiles')
      .select('full_name, avatar_url, water_start_hour, water_end_hour, water_slot_count, calorie_goal')
      .eq('id', userId)
      .single()

    const { data: logData } = await supabase
      .from('logs')
      .select('*')
      .eq('user_id', userId)
      .gte('uploaded_at', dayStart)

    const { data: calData } = await supabase
      .from('calorie_logs')
      .select('*')
      .eq('user_id', userId)
      .gte('logged_at', dayStart)

    setProfile(profileData)
    setLogs(logData || [])
    setCalorieEntries(calData || [])
    setLoading(false)
  }

  const doneSlotIds = new Set(logs.map((l) => l.slot_id))
  useReminders(slots, doneSlotIds)
  const doneCount = slots.filter((s) => doneSlotIds.has(s.id)).length
  const percent = slots.length ? (doneCount / slots.length) * 100 : 0
  const allDone = slots.length > 0 && doneCount === slots.length

  const nextSlot =
    slots.find((s) => s.isPast && !doneSlotIds.has(s.id)) ||
    slots.find((s) => !doneSlotIds.has(s.id))

  return (
    <div className="min-h-screen bg-gradient-to-b from-bubble to-white pb-safe relative overflow-hidden">
      <div className="deco-bubble w-24 h-24 bg-splash/30 -top-8 -right-10 animate-float" />
      <div className="deco-bubble w-16 h-16 bg-coral/20 top-40 -left-8 animate-float-delay" />

      <div className="max-w-md mx-auto relative">
        <header
          className="flex items-center justify-between px-4 sm:px-5 pb-2 relative"
          style={{ paddingTop: 'max(1.5rem, env(safe-area-inset-top))' }}
        >
          <div className="min-w-0">
            <p className="text-ink/40 text-xs">
              {allDone ? 'Fully hydrated today 🎉' : 'Today'}
            </p>
            <h1 className="font-display text-lg sm:text-xl text-deep truncate">
              {new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' })}
            </h1>
          </div>
          <button onClick={onOpenProfile} className="press-pop shrink-0">
            <Avatar url={profile?.avatar_url} name={profile?.full_name} email={session.user.email} size={44} />
          </button>
        </header>

        <main className="px-4 sm:px-5 space-y-6 mt-4 relative pb-10">
          <WaterTank percent={percent} doneCount={doneCount} totalCount={slots.length} />

          <button
            onClick={() => setActiveSlot(nextSlot?.id ?? `${dateKey}-manual-${Date.now()}`)}
            className="w-full py-4 rounded-blob bg-splash text-white font-display text-lg shadow-[0_8px_0_-2px_rgba(21,94,155,0.35)] press-pop transition active:brightness-95"
          >
            💧 Track water
          </button>

          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display text-lg text-deep">Today's slots</h2>
              <button onClick={onOpenProfile} className="text-xs text-splash font-semibold press-pop">
                Edit goal
              </button>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {slots.map((s) => {
                const done = doneSlotIds.has(s.id)
                const overdue = s.isPast && !done
                return (
                  <div
                    key={s.id}
                    className={`px-2 py-2 rounded-full text-sm tabular border-2 text-center ${
                      done
                        ? 'bg-mint/20 border-mint text-deep'
                        : overdue
                        ? 'bg-coral/10 border-coral/30 text-coral'
                        : 'bg-white border-bubble text-ink/40'
                    }`}
                  >
                    {formatSlotTime(s.hour, s.minute)} {done ? '✓' : ''}
                  </div>
                )
              })}
            </div>
          </section>

          <CalorieTracker
            userId={userId}
            entries={calorieEntries}
            onAdd={(entry) => setCalorieEntries((prev) => [...prev, entry])}
            goal={profile?.calorie_goal || 2000}
          />
        </main>
      </div>

      {activeSlot && (
        <TrackWaterModal
          userId={userId}
          slotId={activeSlot}
          onClose={() => setActiveSlot(null)}
          onLogged={loadData}
        />
      )}
    </div>
  )
}
