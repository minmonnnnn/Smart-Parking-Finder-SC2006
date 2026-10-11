import { useEffect, useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import type { VehicleType } from '@smart-parking/shared-types'
import { useAuth } from '../features/auth/AuthContext'
import '../features/auth/auth.css'

interface ProfilePageProps {
  onAccountDeleted(): void
}

export function ProfilePage({ onAccountDeleted }: ProfilePageProps) {
  const { session, profile, loading, error, loadProfile, updateProfile, deleteAccount } = useAuth()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState('')
  const [vehicleType, setVehicleType] = useState<VehicleType | ''>('')
  const [editError, setEditError] = useState('')
  const [profileUpdated, setProfileUpdated] = useState(false)
  const [saving, setSaving] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [deleting, setDeleting] = useState(false)
  const deleteTriggerRef = useRef<HTMLButtonElement>(null)
  const cancelDeleteRef = useRef<HTMLButtonElement>(null)
  const confirmDeleteRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const restoreDeleteFocusRef = useRef(false)

  useEffect(() => {
    if (confirming) {
      if (deleting) dialogRef.current?.focus()
      else cancelDeleteRef.current?.focus()
    } else if (restoreDeleteFocusRef.current) {
      restoreDeleteFocusRef.current = false
      deleteTriggerRef.current?.focus()
    }
  }, [confirming, deleting])

  function startEditing() {
    if (!profile) return
    setName(profile.name)
    setVehicleType(profile.vehicleType)
    setEditError('')
    setProfileUpdated(false)
    setEditing(true)
  }

  function cancelEditing() {
    if (!profile || saving) return
    setName(profile.name)
    setVehicleType(profile.vehicleType)
    setEditError('')
    setEditing(false)
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving) return
    const trimmedName = name.trim()
    if (!trimmedName) {
      setEditError('Enter your name')
      return
    }
    if (!vehicleType) {
      setEditError('Choose your vehicle type')
      return
    }

    setEditError('')
    setSaving(true)
    try {
      await updateProfile({ name: trimmedName, vehicleType })
      setEditing(false)
      setProfileUpdated(true)
    } catch (cause) {
      setEditError(cause instanceof Error ? cause.message : 'Could not save your profile. Try again.')
    } finally {
      setSaving(false)
    }
  }

  function closeConfirmation() {
    if (deleting) return
    restoreDeleteFocusRef.current = true
    setConfirming(false)
    setDeleteError('')
  }

  function handleDialogKeys(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.preventDefault()
      closeConfirmation()
    }
    if (event.key !== 'Tab') return
    if (deleting) {
      event.preventDefault()
      return
    }
    if (event.shiftKey && document.activeElement === cancelDeleteRef.current) {
      event.preventDefault()
      confirmDeleteRef.current?.focus()
    } else if (!event.shiftKey && document.activeElement === confirmDeleteRef.current) {
      event.preventDefault()
      cancelDeleteRef.current?.focus()
    }
  }

  async function confirmDeletion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (deleting) return
    setDeleteError('')
    setDeleting(true)
    try {
      await deleteAccount()
      onAccountDeleted()
    } catch (cause) {
      setDeleteError(cause instanceof Error ? `Could not delete your account. ${cause.message}` : 'Could not delete your account. Try again.')
    } finally {
      setDeleting(false)
    }
  }

  return <main className="auth-screen profile-screen">
    <section className="auth-panel profile-panel" aria-labelledby="profile-title" inert={confirming}>
      <div className="auth-mark" aria-hidden="true"><span>P</span><i /><i /><i /></div>
      <p className="auth-eyebrow">SMART PARKING · YOUR ACCOUNT</p>
      <h1 id="profile-title">Your profile.</h1>
      <p className="auth-intro">Keep your details ready for the next space.</p>

      {!profile ? loading ? <p className="profile-state" role="status">Loading your profile…</p>
        : error ? <div className="profile-state">
          <p className="auth-errors" role="alert">Could not load your profile. Try again.</p>
          <button className="profile-secondary" type="button" onClick={() => { setProfileUpdated(false); void loadProfile().catch(() => undefined) }}>Try again</button>
        </div>
          : <p className="profile-state">{session ? 'Your profile is unavailable.' : 'Sign in to view your profile.'}</p>
        : <>
          <form className="auth-form profile-form" onSubmit={(event) => void saveProfile(event)} noValidate>
            <div className="auth-field">
              <label htmlFor="profile-name">Full name</label>
              <input id="profile-name" name="name" type="text" autoComplete="name" value={editing ? name : profile.name} readOnly={!editing} onChange={(event) => setName(event.target.value)} aria-invalid={editError === 'Enter your name'} />
            </div>
            <div className="auth-field">
              <label htmlFor="profile-email">Email address</label>
              <input id="profile-email" name="email" type="email" autoComplete="email" value={profile.email} readOnly />
              <p className="profile-hint">Your email address is managed with your sign-in details.</p>
            </div>
            <div className="auth-field">
              <label htmlFor="profile-vehicle">Vehicle type</label>
              <select id="profile-vehicle" name="vehicleType" value={editing ? vehicleType : profile.vehicleType} disabled={!editing} onChange={(event) => setVehicleType(event.target.value as VehicleType | '')} aria-invalid={editError === 'Choose your vehicle type'}>
                <option value="EV">EV</option>
                <option value="Petrol">Petrol</option>
                <option value="Hybrid">Hybrid</option>
              </select>
            </div>
            {editError && <p className="auth-errors" role="alert">{editError}</p>}
            {profileUpdated && <p className="profile-success" role="status">Profile updated</p>}
            {editing ? <div className="profile-actions">
              <button className="profile-secondary" type="button" onClick={cancelEditing} disabled={saving}>Cancel</button>
              <button className="auth-submit" type="submit" disabled={saving}>{saving ? 'Saving changes…' : 'Save changes'}</button>
            </div> : <button className="auth-submit" type="button" onClick={startEditing}>Edit profile</button>}
          </form>

          <section className="profile-danger" aria-labelledby="profile-danger-title">
            <h2 id="profile-danger-title">Delete your account</h2>
            <p>This permanently removes your account and saved parking locations.</p>
            <button ref={deleteTriggerRef} className="profile-delete-trigger" type="button" onClick={() => setConfirming(true)}>Delete account</button>
          </section>
        </>}
    </section>

    {confirming && <div className="profile-modal-backdrop">
      <div ref={dialogRef} tabIndex={-1} className="profile-modal" role="dialog" aria-modal="true" aria-labelledby="delete-account-title" aria-describedby="delete-account-description" onKeyDown={handleDialogKeys}>
        <h2 id="delete-account-title">Delete your account?</h2>
        <p id="delete-account-description">Your profile and saved parking locations will be permanently removed. This cannot be undone.</p>
        {deleteError && <p className="auth-errors" role="alert">{deleteError}</p>}
        <form onSubmit={(event) => void confirmDeletion(event)}>
          <button ref={cancelDeleteRef} className="profile-secondary" type="button" onClick={closeConfirmation} disabled={deleting}>Cancel</button>
          <button ref={confirmDeleteRef} className="profile-delete-confirm" type="submit" disabled={deleting}>{deleting ? 'Deleting account…' : 'Delete account'}</button>
        </form>
      </div>
    </div>}
  </main>
}
