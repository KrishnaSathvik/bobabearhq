import { type FormEvent, type ReactNode, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { isSupabaseConfigured, supabase } from './lib/supabase'

export const workspaceEmail = 'bobabearkhammam@gmail.com'

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
    // Supabase's own wording ("Invalid login credentials", "AuthApiError") is
    // for developers. Two people sharing one password need one plain sentence.
    if (authError) setError(/invalid|credential|password/i.test(authError.message)
      ? 'Invalid email or password.'
      : 'Could not sign in right now. Please try again.')
    setLoading(false)
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <img className="login-logo" src="/logo-lockup.png" alt="Boba Bear" width={310} height={293} />
        <h1>Shared workspace</h1>
        <form onSubmit={signIn}>
          <label>Email<input value={workspaceEmail} readOnly /></label>
          <label>Password<input type="password" value={password} onChange={event => setPassword(event.target.value)} autoComplete="current-password" autoFocus /></label>
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button className="login-button" disabled={!password || loading}>{loading ? 'Logging in…' : 'Log in'}</button>
        </form>
      </section>
    </main>
  )
}
