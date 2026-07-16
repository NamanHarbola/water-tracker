import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabaseClient'
import WaterTank from './WaterTank'
import TrackWaterModal from './TrackWaterModal'
import CalorieTracker from './CalorieTracker'
import Avatar from './Avatar'
import useReminders from '../useReminders'

const DEFAULT_HOURS = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21] // 9am–9pm hourly

function todayKey() {
  return new Date().toISOString().slice(0, 10)
}

function buildSlots(hours) {
  const date = todayKey()
  const now = new Date()
  return hours.map((h) => {
    const slotTime = new Date(`${date}T${String(h).padStart(2, '0')}:00:00`)
    return {
      id: `${date}-${h}`,
      hour: h,
      time: slotTime,
      isPast: slotTime <= now
    }
  })
}

export default function Dashboard({ session, onOpenProfile }) {
  const userId = session.user.id
  const hours = DEFAULT_HOURS
  const slots = useMemo(() => buildSlots(hours), [])

  const [profile, setProfile] = useState(null)
  const [logs, setLogs] = useState([])
  const [calorieEntries, setCalorieEntries] = useState([])
  const [activeSlot, setActiveSlot] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    const date = todayKey()

    const { data: profileData } = await supabase
      .from('profiles')
      .select('full_name, avatar_url')
      .eq('id', userId)
      .single()

    const { data: logData } = await supabase
      .from('logs')
      .select('*')
      .eq('user_id', userId)
      .gte('uploaded_at', `${date}T00:00:00`)

    const { data: calData } = await supabase
      .from('calorie_logs')
      .select('*')
      .eq('user_id', userId)
      .gte('logged_at', `${date}T00:00:00`)

    setProfile(profileData)
    setLogs(logData || [])
    setCalorieEntries(calData || [])
    setLoading(false)
  }

  const doneSlotIds = new Set(logs.map((l) => l.slot_id))
  useReminders(slots, doneSlotIds)
  const doneCount = slots.filter((s) => doneSlotIds.has(s.id)).length
  const percent = (doneCount / slots.length) * 100
  const allDone = doneCount === slots.length

  const nextSlot =
    slots.find((s) => s.isPast && !doneSlotIds.has(s.id)) ||
    slots.find((s) => !doneSlotIds.has(s.id))

  return (
    <div className="min-h-screen bg-gradient-to-b from-bubble to-white pb-12 relative overflow-hidden">
      <div className="deco-bubble w-24 h-24 bg-splash/30 -top-8 -right-10 animate-float" />
      <div className="deco-bubble w-16 h-16 bg-coral/20 top-40 -left-8 animate-float-delay" />

      <header className="flex items-center justify-between px-5 pt-6 pb-2 relative">
        <div>
          <p className="text-ink/40 text-xs">
            {allDone ? 'Fully hydrated today 🎉' : 'Today'}
          </p>
          <h1 className="font-display text-xl text-deep">
            {new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' })}
          </h1>
        </div>
        <button onClick={onOpenProfile} className="press-pop">
          <Avatar url={profile?.avatar_url} name={profile?.full_name} email={session.user.email} size={44} />
        </button>
      </header>

      <main className="px-5 space-y-6 mt-4 relative">
        <WaterTank percent={percent} doneCount={doneCount} totalCount={slots.length} />

        <button
          onClick={() => setActiveSlot(nextSlot?.id ?? `${todayKey()}-manual-${Date.now()}`)}
          className="w-full py-4 rounded-blob bg-splash text-white font-display text-lg shadow-[0_8px_0_-2px_rgba(21,94,155,0.35)] press-pop transition"
        >
          💧 Track water
        </button>

        <section>
          <h2 className="font-display text-lg text-deep mb-3">Today's slots</h2>
          <div className="flex flex-wrap gap-2">
            {slots.map((s) => {
              const done = doneSlotIds.has(s.id)
              return (
                <div
                  key={s.id}
                  className={`px-3 py-2 rounded-full text-sm tabular border-2 ${
                    done
                      ? 'bg-mint/20 border-mint text-deep'
                      : s.isPast
                      ? 'bg-coral/10 border-coral/30 text-coral'
                      : 'bg-white border-bubble text-ink/40'
                  }`}
                >
                  {s.hour % 12 || 12}
                  {s.hour < 12 ? 'am' : 'pm'} {done ? '✓' : ''}
                </div>
              )
            })}
          </div>
        </section>

        <CalorieTracker
          userId={userId}
          entries={calorieEntries}
          onAdd={(entry) => setCalorieEntries((prev) => [...prev, entry])}
        />
      </main>

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
