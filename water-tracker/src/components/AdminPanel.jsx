import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabaseClient'
import Avatar from './Avatar'
import CalendarExport from './CalendarExport'
import { localDateKey, startOfLocalDay } from '../lib/date'

export default function AdminPanel({ onSignOut }) {
  const [tab, setTab] = useState('overview') // overview | clips
  const [logs, setLogs] = useState([])
  const [calorieLogs, setCalorieLogs] = useState([])
  const [users, setUsers] = useState([])
  const [urls, setUrls] = useState({})
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const [search, setSearch] = useState('')
  const [selectedUserId, setSelectedUserId] = useState(null) // null = all users
  const [statusFilter, setStatusFilter] = useState('all') // all | unreviewed | reviewed
  const [deletingId, setDeletingId] = useState(null)
  const [exportUser, setExportUser] = useState(null) // user object, or null when modal closed

  useEffect(() => {
    load()
  }, [])

  async function load({ silent = false } = {}) {
    if (silent) setRefreshing(true)
    else setLoading(true)

    const dayStart = startOfLocalDay().toISOString()

    const { data: logData } = await supabase
      .from('logs')
      .select('*')
      .order('uploaded_at', { ascending: false })
      .limit(300)

    const { data: calData } = await supabase
      .from('calorie_logs')
      .select('*')
      .gte('logged_at', dayStart)

    const { data: userData } = await supabase
      .from('profiles')
      .select('id, email, full_name, avatar_url, role')
      .eq('role', 'user')

    setLogs(logData || [])
    setCalorieLogs(calData || [])
    setUsers(userData || [])
    setLoading(false)
    setRefreshing(false)

    // sign short-lived URLs for each clip that doesn't have one yet
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

  async function deleteClip(log) {
    const confirmMsg = log.reviewed
      ? 'Delete this reviewed clip? This removes the video permanently.'
      : "This clip hasn't been reviewed yet — delete anyway? This removes the video permanently."
    if (!window.confirm(confirmMsg)) return

    setDeletingId(log.id)
    await supabase.storage.from('water-clips').remove([log.video_path])
    const { error } = await supabase.from('logs').delete().eq('id', log.id)
    setDeletingId(null)

    if (!error) {
      setLogs((prev) => prev.filter((l) => l.id !== log.id))
    } else {
      window.alert(
        "Couldn't delete — make sure migration_03 (admin delete policies) has been run in Supabase."
      )
    }
  }

  const date = localDateKey()
  const unreviewedCount = logs.filter((l) => !l.reviewed).length

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return users
    return users.filter(
      (u) =>
        (u.full_name || '').toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q)
    )
  }, [users, search])

  const visibleClips = useMemo(() => {
    return logs.filter((l) => {
      if (selectedUserId && l.user_id !== selectedUserId) return false
      if (statusFilter === 'reviewed' && !l.reviewed) return false
      if (statusFilter === 'unreviewed' && l.reviewed) return false
      return true
    })
  }, [logs, selectedUserId, statusFilter])

  const selectedUser = users.find((u) => u.id === selectedUserId)

  function openUserClips(userId) {
    setSelectedUserId(userId)
    setStatusFilter('all')
    setTab('clips')
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-bubble to-white pb-12">
      <div className="max-w-2xl mx-auto">
        <header
          className="flex items-center justify-between px-4 sm:px-5 pb-3"
          style={{ paddingTop: 'max(1.5rem, env(safe-area-inset-top))' }}
        >
          <div>
            <h1 className="font-display text-2xl text-deep">Admin</h1>
            <p className="text-xs text-ink/40">
              {users.length} tracked user{users.length === 1 ? '' : 's'} · {unreviewedCount} clip
              {unreviewedCount === 1 ? '' : 's'} to review
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => load({ silent: true })}
              className={`text-xs text-ink/40 press-pop ${refreshing ? 'animate-pulse' : ''}`}
            >
              ↻ Refresh
            </button>
            <button onClick={onSignOut} className="text-sm text-ink/40">
              Sign out
            </button>
          </div>
        </header>

        {/* Stat cards */}
        <div className="px-4 sm:px-5 grid grid-cols-3 gap-2 mb-4">
          <StatCard label="Users" value={users.length} color="text-deep" />
          <StatCard
            label="Clips today"
            value={logs.filter((l) => localDateKey(new Date(l.uploaded_at)) === date).length}
            color="text-splash"
          />
          <StatCard label="To review" value={unreviewedCount} color="text-coral" />
        </div>

        <div className="px-4 sm:px-5 flex gap-2 mb-4">
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

        {loading && <p className="text-ink/40 text-sm px-4 sm:px-5">Loading…</p>}

        {!loading && tab === 'overview' && (
          <main className="px-4 sm:px-5 space-y-3">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search users by name or email…"
              className="w-full px-3 py-2 rounded-xl border border-deep/10 text-base focus:border-splash outline-none mb-1"
            />

            {filteredUsers.length === 0 && (
              <p className="text-ink/40 text-sm">
                {users.length === 0
                  ? "No tracked users yet — once someone signs up (and isn't marked admin), they'll show up here."
                  : 'No users match that search.'}
              </p>
            )}
            {filteredUsers.map((u) => {
              const userLogsToday = logs.filter(
                (l) => l.user_id === u.id && localDateKey(new Date(l.uploaded_at)) === date
              )
              const userUnreviewed = logs.filter((l) => l.user_id === u.id && !l.reviewed).length
              const userCalToday = calorieLogs
                .filter((c) => c.user_id === u.id)
                .reduce((sum, c) => sum + c.calories, 0)

              return (
                <div
                  key={u.id}
                  className="w-full text-left bg-white rounded-blob p-4 shadow-sm border border-deep/5 flex items-center gap-4"
                >
                  <button onClick={() => openUserClips(u.id)} className="flex items-center gap-4 flex-1 min-w-0 press-pop">
                    <Avatar url={u.avatar_url} name={u.full_name} email={u.email} size={52} />
                    <div className="flex-1 min-w-0">
                      <p className="font-display text-deep truncate">{u.full_name || u.email}</p>
                      <div className="flex gap-3 mt-1 text-xs tabular flex-wrap">
                        <span className="text-splash">💧 {userLogsToday.length} today</span>
                        <span className="text-sun">🔥 {userCalToday} kcal</span>
                        {userUnreviewed > 0 && (
                          <span className="text-coral font-semibold">{userUnreviewed} to review</span>
                        )}
                      </div>
                    </div>
                  </button>
                  <button
                    onClick={() => setExportUser(u)}
                    title="Export monthly calendar JPEG"
                    className="shrink-0 w-9 h-9 rounded-full bg-bubble text-deep flex items-center justify-center press-pop"
                  >
                    📅
                  </button>
                </div>
              )
            })}
          </main>
        )}

        {!loading && tab === 'clips' && (
          <main className="px-4 sm:px-5 space-y-4">
            {/* Filters */}
            <div className="bg-white rounded-2xl p-3 border border-deep/5 space-y-3">
              <div className="flex items-center gap-2">
                <select
                  value={selectedUserId || ''}
                  onChange={(e) => setSelectedUserId(e.target.value || null)}
                  className="flex-1 min-w-0 px-3 py-2 rounded-xl border border-deep/10 text-base bg-white outline-none focus:border-splash"
                >
                  <option value="">All users</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.full_name || u.email}
                    </option>
                  ))}
                </select>
                {selectedUserId && (
                  <button
                    onClick={() => setSelectedUserId(null)}
                    className="text-xs text-ink/40 shrink-0 px-2"
                  >
                    Clear
                  </button>
                )}
              </div>

              <div className="flex gap-1.5">
                {[
                  ['all', 'All'],
                  ['unreviewed', 'Unreviewed'],
                  ['reviewed', 'Reviewed']
                ].map(([val, label]) => (
                  <button
                    key={val}
                    onClick={() => setStatusFilter(val)}
                    className={`flex-1 px-2 py-1.5 rounded-full text-xs font-semibold press-pop ${
                      statusFilter === val
                        ? 'bg-deep text-white'
                        : 'bg-bubble text-ink/50'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {selectedUser && (
              <div className="flex items-center gap-2 text-sm text-ink/50 px-1">
                <Avatar url={selectedUser.avatar_url} name={selectedUser.full_name} email={selectedUser.email} size={24} />
                Showing clips for <span className="font-semibold text-deep">{selectedUser.full_name || selectedUser.email}</span>
              </div>
            )}

            {visibleClips.length === 0 && (
              <p className="text-ink/40 text-sm">No clips match these filters.</p>
            )}

            {visibleClips.map((log) => {
              const user = users.find((u) => u.id === log.user_id)
              return (
                <div
                  key={log.id}
                  className="bg-white rounded-blob p-4 shadow-sm border border-deep/5 flex gap-3 sm:gap-4"
                >
                  <div className="w-24 h-32 sm:w-28 sm:h-36 bg-ink rounded-2xl overflow-hidden shrink-0">
                    {urls[log.id] ? (
                      <video src={urls[log.id]} className="w-full h-full object-cover" controls />
                    ) : (
                      <div className="w-full h-full animate-pulse bg-deep/20" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    {!selectedUserId && (
                      <p className="font-medium text-deep truncate">
                        {user?.full_name || user?.email || log.user_id}
                      </p>
                    )}
                    <p className="text-xs text-ink/40 tabular mt-0.5">
                      {new Date(log.uploaded_at).toLocaleString()}
                    </p>
                    <p className="text-xs text-ink/40 mt-0.5">Slot: {log.slot_id}</p>

                    <div className="flex flex-wrap gap-2 mt-3">
                      <button
                        onClick={() => markReviewed(log.id, !log.reviewed)}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold press-pop ${
                          log.reviewed
                            ? 'bg-mint/20 text-deep'
                            : 'bg-bubble text-ink/60 border border-deep/10'
                        }`}
                      >
                        {log.reviewed ? '✓ Reviewed' : 'Mark reviewed'}
                      </button>

                      <button
                        onClick={() => deleteClip(log)}
                        disabled={deletingId === log.id}
                        className="px-3 py-1.5 rounded-full text-xs font-semibold press-pop bg-coral/10 text-coral border border-coral/20 disabled:opacity-50"
                      >
                        {deletingId === log.id ? 'Deleting…' : '🗑 Delete'}
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </main>
        )}
      </div>

      {exportUser && <CalendarExport user={exportUser} onClose={() => setExportUser(null)} />}
    </div>
  )
}

function StatCard({ label, value, color }) {
  return (
    <div className="bg-white rounded-2xl p-3 border border-deep/5 text-center">
      <p className={`font-display text-xl tabular ${color}`}>{value}</p>
      <p className="text-[11px] text-ink/40 mt-0.5">{label}</p>
    </div>
  )
}
