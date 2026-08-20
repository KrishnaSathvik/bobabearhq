import { type FormEvent, type ReactNode, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { isSupabaseConfigured, supabase } from './lib/supabase'

const workspaceEmail = 'bobabearkhammam@gmail.com'

export default function AuthGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [checking, setChecking] = useState(isSupabaseConfigured)

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setChecking(false)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession))
    return () => data.subscription.unsubscribe()
  }, [])

  if (!isSupabaseConfigured) return children
  if (checking) return <div className="auth-loading">Opening Boba Bear HQ…</div>
  if (!session) return <Login />
  return children
}

function Login() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function signIn(event: FormEvent) {
    event.preventDefault()
    if (!supabase) return
    setLoading(true)
    setError('')
    const { error: authError } = await supabase.auth.signInWithPassword({ email: workspaceEmail, password })
    if (authError) setError('That password didn’t work. Please try again.')
    setLoading(false)
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <p className="login-brand">Boba Bear HQ</p>
        <h1>Welcome back</h1>
        <p className="login-copy">Sign in to your shared Khammam workspace.</p>
        <form onSubmit={signIn}>
          <label>Email<input value={workspaceEmail} readOnly /></label>
          <label>Password<input type="password" value={password} onChange={event => setPassword(event.target.value)} autoComplete="current-password" autoFocus /></label>
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button className="login-button" disabled={!password || loading}>{loading ? 'Signing in…' : 'Sign in'}</button>
        </form>
      </section>
    </main>
  )
}
