import { useEffect, useRef, useState } from 'react'
import { supabase } from '../supabaseClient'
import Avatar from './Avatar'

function dateKey(iso) {
  return iso.slice(0, 10)
}

function computeStreak(dateKeysWithLogs) {
  const set = new Set(dateKeysWithLogs)
  let streak = 0
  let cursor = new Date()
  // if today has no logs yet, start counting from yesterday instead
  if (!set.has(cursor.toISOString().slice(0, 10))) {
    cursor.setDate(cursor.getDate() - 1)
  }
  while (set.has(cursor.toISOString().slice(0, 10))) {
    streak += 1
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

export default function Profile({ session, onBack, onSignOut }) {
  const userId = session.user.id
  const fileInputRef = useRef(null)

  const [profile, setProfile] = useState(null)
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [history, setHistory] = useState([]) // [{date, waterCount, calories}]
  const [streak, setStreak] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    setProfile(profileData)
    setName(profileData?.full_name || '')

    const since = new Date()
    since.setDate(since.getDate() - 13)
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
      const k = dateKey(l.uploaded_at)
      byDate[k] = byDate[k] || { date: k, waterCount: 0, calories: 0 }
      byDate[k].waterCount += 1
    }
    for (const c of calData || []) {
      const k = dateKey(c.logged_at)
      byDate[k] = byDate[k] || { date: k, waterCount: 0, calories: 0 }
      byDate[k].calories += c.calories
    }

    const days = Object.values(byDate).sort((a, b) => (a.date < b.date ? 1 : -1))
    setHistory(days)
    setStreak(computeStreak(Object.keys(byDate).filter((k) => byDate[k].waterCount > 0)))
    setLoading(false)
  }

  async function saveName() {
    setSaving(true)
    await supabase.from('profiles').update({ full_name: name }).eq('id', userId)
    setSaving(false)
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-bubble to-white pb-12">
      <header className="flex items-center gap-3 px-5 pt-6 pb-2">
        <button onClick={onBack} className="text-2xl leading-none text-deep press-pop">
          ←
        </button>
        <h1 className="font-display text-xl text-deep">Your profile</h1>
      </header>

      <main className="px-5 space-y-6 mt-4">
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

        <section>
          <h2 className="font-display text-lg text-deep mb-3">Last 14 days</h2>
          {history.length === 0 && (
            <p className="text-sm text-ink/40">No records yet — get tracking!</p>
          )}
          <div className="space-y-2">
            {history.map((day) => (
              <div
                key={day.date}
                className="bg-white rounded-2xl px-4 py-3 flex items-center justify-between border border-deep/5"
              >
                <span className="text-sm font-medium text-deep">
                  {new Date(day.date).toLocaleDateString(undefined, {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short'
                  })}
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
        </section>

        <button onClick={onSignOut} className="w-full text-center text-sm text-ink/40 py-2">
          Sign out
        </button>
      </main>
    </div>
  )
}
