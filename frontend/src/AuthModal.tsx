import { apiFetch } from './api';

import { useState, type FormEvent } from 'react'

interface AuthUser {
  id: number
  name: string
  email: string
}

interface AuthModalProps {
  onClose: () => void
  onSuccess: (user: AuthUser, token: string) => void
}

type AuthMode = 'login' | 'register'

function AuthModal({ onClose, onSuccess }: AuthModalProps) {
  const [mode, setMode] = useState<AuthMode>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')

    if (mode === 'register' && password !== confirmation) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)

    try {
      const endpoint = mode === 'login'
        ? '/api/login'
        : '/api/register'

      const payload: Record<string, string> = {
        email,
        password,
      }

      if (mode === 'register') {
        payload.name = name
        payload.password_confirmation = confirmation
      }

      const response = await apiFetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
      })

      const result = await response.json()

      if (!response.ok) {
        const validationErrors = result.errors
          ? Object.values(result.errors).flat().join(' ')
          : ''

        throw new Error(
          validationErrors || result.message || 'Authentication failed.',
        )
      }

      if (!result.token || !result.user) {
        throw new Error('The server returned an invalid authentication response.')
      }

      onSuccess(result.user, result.token)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Something went wrong. Please try again.',
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-overlay" onMouseDown={onClose}>
      <div
        className="auth-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button
          className="auth-close"
          onClick={onClose}
          type="button"
          aria-label="Close"
        >
          ×
        </button>

        <div className="auth-brand">
          KEYNEST<span>.</span>
        </div>

        <h2 id="auth-title">
          {mode === 'login' ? 'Welcome back!' : 'Create your account'}
        </h2>

        <p className="auth-description">
          {mode === 'login'
            ? 'Sign in to continue your gaming adventure.'
            : 'Join KeyNest and discover great digital deals.'}
        </p>

        <form onSubmit={handleSubmit}>
          {mode === 'register' && (
            <label>
              Full name
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Your name"
                required
                maxLength={255}
              />
            </label>
          )}

          <label>
            Email address
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              required
            />
          </label>

          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="At least 8 characters"
              minLength={8}
              required
            />
          </label>

          {mode === 'register' && (
            <label>
              Confirm password
              <input
                type="password"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                placeholder="Repeat your password"
                minLength={8}
                required
              />
            </label>
          )}

          {error && (
            <div className="auth-error" role="alert">
              {error}
            </div>
          )}

          <button
            className="primary-button auth-submit"
            type="submit"
            disabled={loading}
          >
            {loading
              ? 'Please wait...'
              : mode === 'login'
                ? 'Sign in'
                : 'Create account'}
          </button>
        </form>

        <div className="auth-switch">
          {mode === 'login'
            ? "Don't have an account?"
            : 'Already have an account?'}

          <button
            type="button"
            onClick={() => {
              setMode(mode === 'login' ? 'register' : 'login')
              setError('')
            }}
          >
            {mode === 'login' ? 'Create account' : 'Sign in'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default AuthModal
