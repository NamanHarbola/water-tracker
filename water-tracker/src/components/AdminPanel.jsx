import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import Avatar from './Avatar'

function todayKey() {
  return new Date().toISOString().slice(0, 10)
}

export default function AdminPanel({ onSignOut }) {
  const [tab, setTab] = useState('overview') // overview | clips
  const [logs, setLogs] = useState([])
  const [calorieLogs, setCalorieLogs] = useState([])
  const [users, setUsers] = useState([])
  const [urls, setUrls] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    const date = todayKey()

    const { data: logData } = await supabase
      .from('logs')
      .select('*')
      .order('uploaded_at', { ascending: false })
      .limit(100)

    const { data: calData } = await supabase
      .from('calorie_logs')
      .select('*')
      .gte('logged_at', `${date}T00:00:00`)

    const { data: userData } = await supabase
      .from('profiles')
      .select('id, email, full_name, avatar_url, role')
      .eq('role', 'user')

    setLogs(logData || [])
    setCalorieLogs(calData || [])
    setUsers(userData || [])
    setLoading(false)

    // sign short-lived URLs for each clip
    for (const log of logData || []) {
      const { data } = await supabase.storage
        .from('water-clips')
        .createSignedUrl(log.video_path, 60 * 30)
      if (data?.signedUrl) {
        setUrls((prev) => ({ ...prev, [log.id]: data.signedUrl }))
      }
    }
  }

  async function markReviewed(id, reviewed) {
    await supabase.from('logs').update({ reviewed }).eq('id', id)
    setLogs((prev) => prev.map((l) => (l.id === id ? { ...l, reviewed } : l)))
  }

  const date = todayKey()
  const unreviewedCount = logs.filter((l) => !l.reviewed).length

  return (
    <div className="min-h-screen bg-gradient-to-b from-bubble to-white pb-12">
      <header className="flex items-center justify-between px-5 pt-6 pb-4">
        <h1 className="font-display text-2xl text-deep">Admin</h1>
        <button onClick={onSignOut} className="text-sm text-ink/40">
          Sign out
        </button>
      </header>

      <div className="px-5 flex gap-2 mb-4">
        <button
          onClick={() => setTab('overview')}
          className={`px-4 py-2 rounded-full text-sm font-semibold press-pop ${
            tab === 'overview' ? 'bg-splash text-white' : 'bg-white text-ink/50 border border-deep/10'
          }`}
        >
          Overview
        </button>
        <button
          onClick={() => setTab('clips')}
          className={`px-4 py-2 rounded-full text-sm font-semibold press-pop relative ${
            tab === 'clips' ? 'bg-splash text-white' : 'bg-white text-ink/50 border border-deep/10'
          }`}
        >
          Clips
          {unreviewedCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 bg-coral text-white text-[10px] rounded-full w-5 h-5 flex items-center justify-center">
              {unreviewedCount}
            </span>
          )}
        </button>
      </div>

      {loading && <p className="text-ink/40 text-sm px-5">Loading…</p>}

      {!loading && tab === 'overview' && (
        <main className="px-5 space-y-3">
          {users.length === 0 && (
            <p className="text-ink/40 text-sm">
              No tracked users yet — once someone signs up (and isn't marked admin), they'll show up here.
            </p>
          )}
          {users.map((u) => {
            const userLogsToday = logs.filter(
              (l) => l.user_id === u.id && l.uploaded_at.slice(0, 10) === date
            )
            const userCalToday = calorieLogs
              .filter((c) => c.user_id === u.id)
              .reduce((sum, c) => sum + c.calories, 0)

            return (
              <div
                key={u.id}
                className="bg-white rounded-blob p-4 shadow-sm border border-deep/5 flex items-center gap-4"
              >
                <Avatar url={u.avatar_url} name={u.full_name} email={u.email} size={52} />
                <div className="flex-1 min-w-0">
                  <p className="font-display text-deep truncate">{u.full_name || u.email}</p>
                  <div className="flex gap-4 mt-1 text-xs tabular">
                    <span className="text-splash">💧 {userLogsToday.length} today</span>
                    <span className="text-sun">🔥 {userCalToday} kcal</span>
                  </div>
                </div>
              </div>
            )
          })}
        </main>
      )}

      {!loading && tab === 'clips' && (
        <main className="px-5 space-y-4">
          {logs.length === 0 && <p className="text-ink/40 text-sm">No clips logged yet.</p>}

          {logs.map((log) => {
            const user = users.find((u) => u.id === log.user_id)
            return (
              <div
                key={log.id}
                className="bg-white rounded-blob p-4 shadow-sm border border-deep/5 flex gap-4"
              >
                <div className="w-28 h-36 bg-ink rounded-2xl overflow-hidden shrink-0">
                  {urls[log.id] ? (
                    <video src={urls[log.id]} className="w-full h-full object-cover" controls />
                  ) : (
                    <div className="w-full h-full animate-pulse bg-deep/20" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="font-medium text-deep truncate">
                    {user?.full_name || user?.email || log.user_id}
                  </p>
                  <p className="text-xs text-ink/40 tabular mt-0.5">
                    {new Date(log.uploaded_at).toLocaleString()}
                  </p>
                  <p className="text-xs text-ink/40 mt-0.5">Slot: {log.slot_id}</p>

                  <button
                    onClick={() => markReviewed(log.id, !log.reviewed)}
                    className={`mt-3 px-3 py-1.5 rounded-full text-xs font-semibold press-pop ${
                      log.reviewed
                        ? 'bg-mint/20 text-deep'
                        : 'bg-bubble text-ink/60 border border-deep/10'
                    }`}
                  >
                    {log.reviewed ? '✓ Reviewed' : 'Mark reviewed'}
                  </button>
                </div>
              </div>
            )
          })}
        </main>
      )}
    </div>
  )
}
