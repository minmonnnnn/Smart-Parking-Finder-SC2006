import { useState } from 'react'
import type { FormEvent } from 'react'
import { PasswordField } from '../features/auth/PasswordField'
import { useAuth } from '../features/auth/AuthContext'
import '../features/auth/auth.css'

interface SignInPageProps {
  onSignedIn(): void
  onSwitchMode(): void
}

export function SignInPage({ onSignedIn, onSwitchMode }: SignInPageProps) {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<string[]>([])
  const [pending, setPending] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    const normalizedEmail = email.trim().toLowerCase()
    const nextErrors = [
      ...(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) ? ['Enter a valid email address'] : []),
      ...(!password ? ['Enter your password'] : []),
    ]
    setErrors(nextErrors)
    if (nextErrors.length) return

    setPending(true)
    try {
      await login({ email: normalizedEmail, password })
      onSignedIn()
    } catch (error) {
      setErrors([error instanceof Error ? error.message : 'Could not sign in. Please try again.'])
    } finally {
      setPending(false)
    }
  }

  return <main className="auth-screen">
    <section className="auth-panel" aria-labelledby="sign-in-title">
      <div className="auth-mark" aria-hidden="true"><span>P</span><i /><i /><i /></div>
      <p className="auth-eyebrow">SMART PARKING · SINGAPORE</p>
      <h1 id="sign-in-title">Welcome back.</h1>
      <p className="auth-intro">Sign in to get moving and find your next space.</p>

      <form className="auth-form" onSubmit={(event) => void handleSubmit(event)} noValidate>
        <div className="auth-field">
          <label htmlFor="sign-in-email">Email address</label>
          <input id="sign-in-email" name="email" type="email" inputMode="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} aria-invalid={errors.includes('Enter a valid email address')} />
        </div>
        <PasswordField id="sign-in-password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" invalid={errors.includes('Enter your password')} />
        {errors.length > 0 && <div className="auth-errors" role="alert">{errors.map((message) => <p key={message}>{message}</p>)}</div>}
        <button className="auth-submit" type="submit" disabled={pending}>{pending ? 'Signing in…' : 'Sign in'}</button>
      </form>

      <p className="auth-switch">New to Smart Parking? <button type="button" onClick={onSwitchMode}>Create an account</button></p>
    </section>
  </main>
}
