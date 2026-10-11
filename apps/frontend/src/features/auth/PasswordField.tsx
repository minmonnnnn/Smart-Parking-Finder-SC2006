import { useState } from 'react'
import type { ChangeEvent } from 'react'

interface PasswordFieldProps {
  id: string
  value: string
  onChange(event: ChangeEvent<HTMLInputElement>): void
  autoComplete: 'current-password' | 'new-password'
  invalid?: boolean
}

export function PasswordField({ id, value, onChange, autoComplete, invalid = false }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false)

  return <div className="auth-field">
    <label htmlFor={id}>Password</label>
    <div className="auth-password">
      <input
        id={id}
        name="password"
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        autoComplete={autoComplete}
        aria-invalid={invalid}
      />
      <button
        className="auth-password__toggle"
        type="button"
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
        onClick={() => setVisible((previous) => !previous)}
      >
        <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2.25 12s3.5-6 9.75-6 9.75 6 9.75 6-3.5 6-9.75 6-9.75-6-9.75-6Z" />
          <circle cx="12" cy="12" r="2.5" />
          {visible && <path d="M3 21 21 3" />}
        </svg>
        {visible ? 'Hide' : 'Show'}
      </button>
    </div>
  </div>
}
