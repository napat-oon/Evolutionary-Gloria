import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../app/api'
import PageBackdrop from './PageBackdrop'

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [token, setToken] = useState(searchParams.get('token') ?? '')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (password !== confirm) {
      setError('Passwords do not match')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await api.post('/api/auth/reset', { token, newPassword: password })
      navigate('/login')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Reset failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="page">
      <PageBackdrop src="/images/eevee-evolutions-wallpaper.png" shiftY={-530} />
      <h1 className="game-title">Evolutionary Gloria</h1>
      <form className="auth-card glass" onSubmit={onSubmit}>
        <h2>Reset password</h2>
        {error && <p className="form-error">{error}</p>}
        <label>
          Reset token
          <input value={token} onChange={(e) => setToken(e.target.value)} required />
        </label>
        <label>
          New password (min 8 characters)
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            minLength={8}
            maxLength={72}
            required
          />
        </label>
        <label>
          Confirm new password
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            required
          />
        </label>
        <button type="submit" disabled={busy}>
          {busy ? 'Resetting…' : 'Reset password'}
        </button>
        <p className="auth-links">
          <Link to="/login">Back to login</Link>
        </p>
      </form>
    </main>
  )
}
