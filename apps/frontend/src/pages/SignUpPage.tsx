import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import type { VehicleType } from '@smart-parking/shared-types'
import { PasswordField } from '../features/auth/PasswordField'
import { useAuth } from '../features/auth/AuthContext'
import '../features/auth/auth.css'

interface SignUpPageProps {
  onSwitchMode(): void
}

export function SignUpPage({ onSwitchMode }: SignUpPageProps) {
  const { register } = useAuth()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [vehicleType, setVehicleType] = useState<VehicleType | ''>('')
  const [errors, setErrors] = useState<string[]>([])
  const [pending, setPending] = useState(false)
  const [registered, setRegistered] = useState(false)
  const successHeadingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    if (registered) successHeadingRef.current?.focus()
  }, [registered])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    const normalizedName = name.trim()
    const normalizedEmail = email.trim().toLowerCase()
    const nextErrors = [
      ...(!normalizedName ? ['Enter your name'] : []),
      ...(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) ? ['Enter a valid email address'] : []),
      ...(!(password.length >= 8 && /[A-Z]/.test(password) && /[a-z]/.test(password) && /[0-9]/.test(password)) ? ['Use at least 8 characters with uppercase, lowercase, and a number'] : []),
      ...(!vehicleType ? ['Choose your vehicle type'] : []),
    ]
    setErrors(nextErrors)
    if (nextErrors.length || !vehicleType) return

    setPending(true)
    try {
      await register({ name: normalizedName, email: normalizedEmail, password, vehicleType })
      setRegistered(true)
      setPassword('')
    } catch (error) {
      setErrors([error instanceof Error ? error.message : 'Could not create your account. Please try again.'])
    } finally {
      setPending(false)
    }
  }

  return <main className="auth-screen">
    <section className="auth-panel" aria-labelledby="sign-up-title">
      <div className="auth-mark" aria-hidden="true"><span>P</span><i /><i /><i /></div>
      <p className="auth-eyebrow">SMART PARKING · SINGAPORE</p>
      {registered ? <>
        <div role="status" aria-live="polite">
          <h1 id="sign-up-title" ref={successHeadingRef} tabIndex={-1}>Account created</h1>
          <p className="auth-intro">Your account is ready. Sign in to start finding parking.</p>
        </div>
        <button className="auth-submit auth-confirm" type="button" onClick={onSwitchMode}>Continue to sign in</button>
      </> : <>
        <h1 id="sign-up-title">Start parking smarter.</h1>
        <p className="auth-intro">Create an account to keep your parking plans close.</p>
        <form className="auth-form" onSubmit={(event) => void handleSubmit(event)} noValidate>
          <div className="auth-field">
            <label htmlFor="sign-up-name">Full name</label>
            <input id="sign-up-name" name="name" type="text" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} aria-invalid={errors.includes('Enter your name')} />
          </div>
          <div className="auth-field">
            <label htmlFor="sign-up-email">Email address</label>
            <input id="sign-up-email" name="email" type="email" inputMode="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} aria-invalid={errors.includes('Enter a valid email address')} />
          </div>
          <PasswordField id="sign-up-password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" invalid={errors.some((message) => message.startsWith('Use at least'))} />
          <div className="auth-field">
            <label htmlFor="sign-up-vehicle">Vehicle type</label>
            <select id="sign-up-vehicle" name="vehicleType" value={vehicleType} onChange={(event) => setVehicleType(event.target.value as VehicleType | '')} aria-invalid={errors.includes('Choose your vehicle type')}>
              <option value="">Select vehicle type</option>
              <option value="EV">EV</option>
              <option value="Petrol">Petrol</option>
              <option value="Hybrid">Hybrid</option>
            </select>
          </div>
          {errors.length > 0 && <div className="auth-errors" role="alert">{errors.map((message) => <p key={message}>{message}</p>)}</div>}
          <button className="auth-submit" type="submit" disabled={pending}>{pending ? 'Creating account…' : 'Create account'}</button>
        </form>
        <p className="auth-switch">Already have an account? <button type="button" onClick={onSwitchMode}>Sign in</button></p>
      </>}
    </section>
  </main>
}
