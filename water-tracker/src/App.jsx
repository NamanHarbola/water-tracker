import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import Login from './components/Login'
import Dashboard from './components/Dashboard'
import AdminPanel from './components/AdminPanel'
import Profile from './components/Profile'

export default function App() {
  const [session, setSession] = useState(null)
  const [role, setRole] = useState(null)
  const [ready, setReady] = useState(false)
  const [view, setView] = useState('home') // 'home' | 'profile'

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      if (data.session) loadRole(data.session.user.id)
      else setReady(true)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
      if (newSession) loadRole(newSession.user.id)
      else {
        setRole(null)
        setReady(true)
      }
    })

    return () => sub.subscription.unsubscribe()
  }, [])

  async function loadRole(userId) {
    // Ensures a profile row exists, then reads its role.
    const { data } = await supabase.from('profiles').select('role').eq('id', userId).single()
    setRole(data?.role || 'user')
    setReady(true)
  }

  function signOut() {
    supabase.auth.signOut()
  }

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bubble">
        <span className="text-ink/40 text-sm">Loading…</span>
      </div>
    )
  }

  if (!session) return <Login />
  if (role === 'admin') return <AdminPanel onSignOut={signOut} />

  if (view === 'profile') {
    return (
      <Profile session={session} onBack={() => setView('home')} onSignOut={signOut} />
    )
  }

  return <Dashboard session={session} onOpenProfile={() => setView('profile')} />
}
