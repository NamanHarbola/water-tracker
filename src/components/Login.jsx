import { useState } from 'react'
import { supabase } from '../supabaseClient'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState('signin') // signin | signup
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const fn =
      mode === 'signin'
        ? supabase.auth.signInWithPassword({ email, password })
        : supabase.auth.signUp({ email, password })
    const { error } = await fn
    setLoading(false)
    if (error) setError(error.message)
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-bubble to-white flex items-center justify-center p-6 relative overflow-hidden">
      <div className="deco-bubble w-20 h-20 bg-splash/30 top-10 -left-6 animate-float" />
      <div className="deco-bubble w-14 h-14 bg-coral/25 top-1/3 -right-4 animate-float-delay" />
      <div className="deco-bubble w-10 h-10 bg-sun/30 bottom-16 left-8 animate-float" />

      <div className="w-full max-w-sm relative">
        <div className="text-center mb-8">
          <span className="text-5xl inline-block animate-wiggle">💧</span>
          <h1 className="font-display text-4xl text-deep mt-2">Aqua</h1>
          <p className="text-ink/50 text-sm mt-1">Stay on top of your water breaks</p>
        </div>

        <form onSubmit={submit} className="bg-white rounded-blob p-6 shadow-sm border border-deep/5 space-y-4">
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-deep/10 focus:border-splash outline-none text-base"
          />
          <input
            type="password"
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            required
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-deep/10 focus:border-splash outline-none text-base"
          />
          {error && <p className="text-sm text-red-500">{error}</p>}
          <button
            disabled={loading}
            className="w-full py-3 rounded-2xl bg-splash text-white font-display press-pop disabled:opacity-60"
          >
            {loading ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <button
          onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
          className="w-full text-center text-sm text-ink/50 mt-4"
        >
          {mode === 'signin' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
        </button>
      </div>
    </div>
  )
}
