import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../app/AuthContext'
import PageBackdrop from './PageBackdrop'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [usernameOrEmail, setUsernameOrEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await login(usernameOrEmail, password)
      navigate('/lobby')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Login failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="page">
      <PageBackdrop src="/images/eevee-evolutions-wallpaper.png" shiftY={-530} />
      <h1 className="game-title">Evolutionary Gloria</h1>
      <form className="auth-card glass" onSubmit={onSubmit}>
        <h2>Login</h2>
        {error && <p className="form-error">{error}</p>}
        <label>
          Username or email
          <input
            value={usernameOrEmail}
            onChange={(e) => setUsernameOrEmail(e.target.value)}
            autoComplete="username"
            required
          />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
        <button type="submit" disabled={busy}>
          {busy ? 'Logging in…' : 'Login'}
        </button>
        <p className="auth-links">
          <Link to="/register">Create an account</Link>
          <Link to="/forgot">Forgot password?</Link>
        </p>
      </form>
    </main>
  )
}
