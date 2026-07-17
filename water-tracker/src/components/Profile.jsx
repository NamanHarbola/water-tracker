import { useEffect, useRef, useState } from 'react'
import { supabase } from '../supabaseClient'
import Avatar from './Avatar'
import WaterChart from './WaterChart'
import { localDateKey, isoToLocalDateKey } from '../lib/date'
import { pushSupported, getPushSubscriptionState, subscribeToPush, unsubscribeFromPush } from '../lib/oneSignalPush'

function computeStreak(dateKeysWithLogs) {
  const set = new Set(dateKeysWithLogs)
  let streak = 0
  let cursor = new Date()
  // if today has no logs yet, start counting from yesterday instead
  if (!set.has(localDateKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1)
  }
  while (set.has(localDateKey(cursor))) {
    streak += 1
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

// Fills in zero-value days so charts don't skip gaps where nothing was logged.
function fillDays(byDate, numDays) {
  const days = []
  const cursor = new Date()
  for (let i = numDays - 1; i >= 0; i--) {
    const d = new Date(cursor)
    d.setDate(d.getDate() - i)
    const key = localDateKey(d)
    const label = d.toLocaleDateString(undefined, { day: 'numeric', month: numDays > 14 ? undefined : 'short' })
    days.push(byDate[key] || { date: key, label, waterCount: 0, calories: 0 })
    if (byDate[key]) days[days.length - 1].label = label
  }
  return days
}

export default function Profile({ session, onBack, onSignOut }) {
  const userId = session.user.id
  const fileInputRef = useRef(null)

  const [profile, setProfile] = useState(null)
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [historyByDate, setHistoryByDate] = useState({})
  const [streak, setStreak] = useState(0)
  const [loading, setLoading] = useState(true)
  const [historyView, setHistoryView] = useState('list') // list | weekly | monthly

  // Goal settings form state
  const [goalForm, setGoalForm] = useState({ startHour: 9, endHour: 21, slotCount: 13, calorieGoal: 2000 })
  const [goalSaving, setGoalSaving] = useState(false)
  const [goalSaved, setGoalSaved] = useState(false)

  // Push notifications
  const [pushState, setPushState] = useState('checking') // checking | unsupported | unsubscribed | subscribed
  const [pushBusy, setPushBusy] = useState(false)
  const [pushError, setPushError] = useState('')

  useEffect(() => {
    load()
    refreshPushState()
  }, [])

  async function refreshPushState() {
    if (!pushSupported()) {
      setPushState('unsupported')
      return
    }
    setPushState(await getPushSubscriptionState())
  }

  async function load() {
    setLoading(true)
    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    setProfile(profileData)
    setName(profileData?.full_name || '')
    setGoalForm({
      startHour: profileData?.water_start_hour ?? 9,
      endHour: profileData?.water_end_hour ?? 21,
      slotCount: profileData?.water_slot_count ?? 13,
      calorieGoal: profileData?.calorie_goal ?? 2000
    })

    // 90 days covers the monthly chart; weekly/list views just slice it down.
    const since = new Date()
    since.setDate(since.getDate() - 89)
    const sinceIso = since.toISOString()

    const { data: logData } = await supabase
      .from('logs')
      .select('uploaded_at')
      .eq('user_id', userId)
      .gte('uploaded_at', sinceIso)

    const { data: calData } = await supabase
      .from('calorie_logs')
      .select('calories, logged_at')
      .eq('user_id', userId)
      .gte('logged_at', sinceIso)

    const byDate = {}
    for (const l of logData || []) {
      const k = isoToLocalDateKey(l.uploaded_at)
      byDate[k] = byDate[k] || { date: k, waterCount: 0, calories: 0 }
      byDate[k].waterCount += 1
    }
    for (const c of calData || []) {
      const k = isoToLocalDateKey(c.logged_at)
      byDate[k] = byDate[k] || { date: k, waterCount: 0, calories: 0 }
      byDate[k].calories += c.calories
    }

    setHistoryByDate(byDate)
    setStreak(computeStreak(Object.keys(byDate).filter((k) => byDate[k].waterCount > 0)))
    setLoading(false)
  }

  async function saveName() {
    setSaving(true)
    await supabase.from('profiles').update({ full_name: name }).eq('id', userId)
    setSaving(false)
  }

  async function saveGoals(e) {
    e.preventDefault()
    setGoalSaving(true)
    setGoalSaved(false)
    const { error } = await supabase
      .from('profiles')
      .update({
        water_start_hour: Number(goalForm.startHour),
        water_end_hour: Number(goalForm.endHour),
        water_slot_count: Number(goalForm.slotCount),
        calorie_goal: Number(goalForm.calorieGoal)
      })
      .eq('id', userId)
    setGoalSaving(false)
    if (!error) {
      setGoalSaved(true)
      setTimeout(() => setGoalSaved(false), 2000)
    }
  }

  async function togglePush() {
    setPushError('')
    setPushBusy(true)
    try {
      if (pushState === 'subscribed') {
        await unsubscribeFromPush()
        setPushState('unsubscribed')
      } else {
        await subscribeToPush()
        setPushState('subscribed')
      }
    } catch (err) {
      setPushError(err.message || 'Something went wrong.')
    }
    setPushBusy(false)
  }

  async function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const ext = file.name.split('.').pop()
    const path = `${userId}/avatar.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true })

    if (!uploadError) {
      const { data } = supabase.storage.from('avatars').getPublicUrl(path)
      await supabase.from('profiles').update({ avatar_url: data.publicUrl }).eq('id', userId)
      setProfile((p) => ({ ...p, avatar_url: data.publicUrl }))
    }
    setUploading(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-bubble to-white flex items-center justify-center">
        <span className="text-ink/40 text-sm">Loading…</span>
      </div>
    )
  }

  const list14 = fillDays(historyByDate, 14).slice().reverse()
  const weekly = fillDays(historyByDate, 7)
  const monthly = fillDays(historyByDate, 30)

  return (
    <div className="min-h-screen bg-gradient-to-b from-bubble to-white pb-12">
      <div className="max-w-md mx-auto">
      <header
        className="flex items-center gap-3 px-4 sm:px-5 pb-2"
        style={{ paddingTop: 'max(1.5rem, env(safe-area-inset-top))' }}
      >
        <button onClick={onBack} className="text-2xl leading-none text-deep press-pop p-1 -ml-1">
          ←
        </button>
        <h1 className="font-display text-xl text-deep">Your profile</h1>
      </header>

      <main className="px-4 sm:px-5 space-y-6 mt-4">
        <div className="bg-white rounded-blob p-6 shadow-sm border border-deep/5 flex flex-col items-center gap-3 relative overflow-hidden">
          <div className="deco-bubble w-10 h-10 bg-sun -top-3 -right-3 animate-float" />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="relative press-pop"
          >
            <Avatar url={profile?.avatar_url} name={name} email={session.user.email} size={88} />
            <span className="absolute -bottom-1 -right-1 bg-splash text-white text-xs rounded-full w-6 h-6 flex items-center justify-center border-2 border-white">
              ✎
            </span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />
          {uploading && <span className="text-xs text-ink/40">Uploading photo…</span>}

          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={saveName}
            placeholder="Your name"
            className="text-center font-display text-lg text-deep bg-transparent border-b-2 border-bubble focus:border-splash outline-none px-2 py-1 w-full max-w-[200px]"
          />
          <p className="text-xs text-ink/40">{session.user.email}</p>
          {saving && <span className="text-xs text-ink/30">Saving…</span>}

          <div className="flex items-center gap-1.5 bg-sun/20 text-deep px-4 py-1.5 rounded-full mt-1">
            <span>🔥</span>
            <span className="font-display text-sm">{streak}-day streak</span>
          </div>
        </div>

        {/* Editable water goal + reminder schedule */}
        <section className="bg-white rounded-blob p-4 sm:p-5 shadow-sm border border-deep/5">
          <h2 className="font-display text-lg text-deep mb-1">Your goal</h2>
          <p className="text-xs text-ink/40 mb-4">
            Set how many reminders you want each day and the window they're spread across.
          </p>
          <form onSubmit={saveGoals} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-xs font-semibold text-ink/50 mb-1 block">Start hour (0–23)</span>
                <input
                  type="number"
                  min={0}
                  max={23}
                  value={goalForm.startHour}
                  onChange={(e) => setGoalForm((f) => ({ ...f, startHour: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-deep/10 text-base focus:border-splash outline-none tabular"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-ink/50 mb-1 block">End hour (0–23)</span>
                <input
                  type="number"
                  min={0}
                  max={23}
                  value={goalForm.endHour}
                  onChange={(e) => setGoalForm((f) => ({ ...f, endHour: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-deep/10 text-base focus:border-splash outline-none tabular"
                />
              </label>
            </div>
            <label className="block">
              <span className="text-xs font-semibold text-ink/50 mb-1 block">
                Reminders per day: {goalForm.slotCount}
              </span>
              <input
                type="range"
                min={1}
                max={24}
                value={goalForm.slotCount}
                onChange={(e) => setGoalForm((f) => ({ ...f, slotCount: e.target.value }))}
                className="w-full accent-splash"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-ink/50 mb-1 block">Daily calorie goal</span>
              <input
                type="number"
                min={200}
                max={10000}
                step={50}
                value={goalForm.calorieGoal}
                onChange={(e) => setGoalForm((f) => ({ ...f, calorieGoal: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl border border-deep/10 text-base focus:border-splash outline-none tabular"
              />
            </label>
            <button
              type="submit"
              disabled={goalSaving}
              className="w-full py-2.5 rounded-xl bg-splash text-white font-semibold press-pop disabled:opacity-60"
            >
              {goalSaving ? 'Saving…' : goalSaved ? 'Saved ✓' : 'Save goal'}
            </button>
          </form>
        </section>

        {/* Push notifications */}
        <section className="bg-white rounded-blob p-4 sm:p-5 shadow-sm border border-deep/5">
          <h2 className="font-display text-lg text-deep mb-1">Push notifications</h2>
          {pushState === 'unsupported' && (
            <p className="text-xs text-ink/40">
              Not available in this browser, or OneSignal isn't configured yet. See the
              README's "Real push notifications" section.
            </p>
          )}
          {pushState !== 'unsupported' && (
            <>
              <p className="text-xs text-ink/40 mb-3">
                {pushState === 'subscribed'
                  ? "You'll get a real notification on this device even when the app is fully closed."
                  : 'Turn this on to get reminders even when the app is fully closed (not just backgrounded).'}
              </p>
              <button
                onClick={togglePush}
                disabled={pushBusy || pushState === 'checking'}
                className={`w-full py-2.5 rounded-xl font-semibold press-pop disabled:opacity-60 ${
                  pushState === 'subscribed'
                    ? 'bg-bubble text-deep border border-deep/10'
                    : 'bg-mint text-white'
                }`}
              >
                {pushBusy
                  ? 'Working…'
                  : pushState === 'subscribed'
                  ? 'Turn off push notifications'
                  : 'Enable push notifications'}
              </button>
              {pushError && <p className="text-xs text-coral mt-2">{pushError}</p>}
            </>
          )}
        </section>

        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display text-lg text-deep">History</h2>
            <div className="flex gap-1 bg-bubble rounded-full p-1">
              {[
                ['list', 'List'],
                ['weekly', 'Weekly'],
                ['monthly', 'Monthly']
              ].map(([val, label]) => (
                <button
                  key={val}
                  onClick={() => setHistoryView(val)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold press-pop ${
                    historyView === val ? 'bg-white text-deep shadow-sm' : 'text-ink/40'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {historyView === 'list' && (
            <>
              {list14.every((d) => d.waterCount === 0 && d.calories === 0) && (
                <p className="text-sm text-ink/40">No records yet — get tracking!</p>
              )}
              <div className="space-y-2">
                {list14.map((day) => (
                  <div
                    key={day.date}
                    className="bg-white rounded-2xl px-4 py-3 flex items-center justify-between border border-deep/5"
                  >
                    <span className="text-sm font-medium text-deep">
                      {(() => {
                        const [y, m, d] = day.date.split('-').map(Number)
                        return new Date(y, m - 1, d).toLocaleDateString(undefined, {
                          weekday: 'short',
                          day: 'numeric',
                          month: 'short'
                        })
                      })()}
                    </span>
                    <div className="flex items-center gap-3 text-xs tabular">
                      <span className="flex items-center gap-1 text-splash">
                        💧 {day.waterCount}
                      </span>
                      <span className="flex items-center gap-1 text-sun">
                        🔥 {day.calories} kcal
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {historyView === 'weekly' && (
            <div className="space-y-4">
              <div className="bg-white rounded-blob p-4 shadow-sm border border-deep/5">
                <h3 className="text-sm font-semibold text-deep mb-2">💧 Water breaks — last 7 days</h3>
                <WaterChart
                  data={weekly}
                  valueKey="waterCount"
                  color="#00C2FF"
                  unit="water breaks"
                  goal={profile?.water_slot_count || 0}
                />
              </div>
              <div className="bg-white rounded-blob p-4 shadow-sm border border-deep/5">
                <h3 className="text-sm font-semibold text-deep mb-2">🔥 Calories — last 7 days</h3>
                <WaterChart
                  data={weekly}
                  valueKey="calories"
                  color="#FFC93C"
                  unit="kcal"
                  goal={profile?.calorie_goal || 0}
                />
              </div>
            </div>
          )}

          {historyView === 'monthly' && (
            <div className="space-y-4">
              <div className="bg-white rounded-blob p-4 shadow-sm border border-deep/5">
                <h3 className="text-sm font-semibold text-deep mb-2">💧 Water breaks — last 30 days</h3>
                <WaterChart
                  data={monthly}
                  valueKey="waterCount"
                  color="#00C2FF"
                  unit="water breaks"
                  goal={profile?.water_slot_count || 0}
                />
              </div>
              <div className="bg-white rounded-blob p-4 shadow-sm border border-deep/5">
                <h3 className="text-sm font-semibold text-deep mb-2">🔥 Calories — last 30 days</h3>
                <WaterChart
                  data={monthly}
                  valueKey="calories"
                  color="#FFC93C"
                  unit="kcal"
                  goal={profile?.calorie_goal || 0}
                />
              </div>
            </div>
          )}
        </section>

        <button onClick={onSignOut} className="w-full text-center text-sm text-ink/40 py-2">
          Sign out
        </button>
      </main>
      </div>
    </div>
  )
}
