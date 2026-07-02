import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../app/api'

interface ForgotResponse {
  message: string
  resetToken: string | null
}

export default function ForgotPasswordPage() {
  const [usernameOrEmail, setUsernameOrEmail] = useState('')
  const [result, setResult] = useState<ForgotResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      setResult(await api.post<ForgotResponse>('/api/auth/forgot', { usernameOrEmail }))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="page">
      <h1 className="game-title">Evolutionary Gloria</h1>
      <form className="auth-card" onSubmit={onSubmit}>
        <h2>Forgot password</h2>
        {error && <p className="form-error">{error}</p>}
        {result ? (
          <>
            <p>{result.message}.</p>
            {result.resetToken && (
              <>
                <p>Use this one-time token (valid 15 minutes):</p>
                <code className="reset-token">{result.resetToken}</code>
                <Link className="button-link" to={`/reset?token=${encodeURIComponent(result.resetToken)}`}>
                  Reset password now
                </Link>
              </>
            )}
          </>
        ) : (
          <>
            <label>
              Username or email
              <input
                value={usernameOrEmail}
                onChange={(e) => setUsernameOrEmail(e.target.value)}
                autoComplete="username"
                required
              />
            </label>
            <button type="submit" disabled={busy}>
              {busy ? 'Requesting…' : 'Request reset token'}
            </button>
          </>
        )}
        <p className="auth-links">
          <Link to="/login">Back to login</Link>
        </p>
      </form>
    </main>
  )
}
