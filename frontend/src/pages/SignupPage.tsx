import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/useAuth'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type FieldErrors = {
  name?: string
  email?: string
  password?: string
}

function SignupPage() {
  const { signup } = useAuth()
  const navigate = useNavigate()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<FieldErrors>({})

  function clearError(field: keyof FieldErrors) {
    setErrors((current) => ({ ...current, [field]: undefined }))
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const nameValue = name.trim()
    const emailValue = email.trim()
    const nextErrors: FieldErrors = {}

    if (!nameValue) {
      nextErrors.name = 'Name is required.'
    }

    if (!emailValue) {
      nextErrors.email = 'Email is required.'
    } else if (!EMAIL_PATTERN.test(emailValue)) {
      nextErrors.email = 'Enter a valid email address.'
    }

    if (!password) {
      nextErrors.password = 'Password is required.'
    } else if (password.length < 8) {
      nextErrors.password = 'Password must be at least 8 characters.'
    }

    setErrors(nextErrors)

    if (Object.keys(nextErrors).length > 0) {
      return
    }

    signup(nameValue, emailValue)
    navigate('/organization')
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <Link
          to="/"
          className="text-lg font-semibold tracking-tight text-brand-700"
        >
          MediCast
        </Link>

        <h1 className="mt-8 text-2xl font-semibold tracking-tight text-slate-900">
          Create your account
        </h1>
        <p className="mt-1 text-slate-600">
          Start forecasting medicine demand with MediCast.
        </p>

        <form
          onSubmit={handleSubmit}
          noValidate
          className="mt-6 rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200"
        >
          <div>
            <label
              htmlFor="signup-name"
              className="block text-sm font-medium text-slate-700"
            >
              Name
            </label>
            <input
              id="signup-name"
              type="text"
              autoComplete="name"
              value={name}
              onChange={(event) => {
                setName(event.target.value)
                clearError('name')
              }}
              aria-invalid={Boolean(errors.name)}
              aria-describedby={
                errors.name ? 'signup-name-error' : undefined
              }
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-brand-500 focus:ring-2 focus:ring-brand-200 focus:outline-none"
            />
            {errors.name && (
              <p
                id="signup-name-error"
                role="alert"
                className="mt-2 text-sm text-red-600"
              >
                {errors.name}
              </p>
            )}
          </div>

          <div className="mt-4">
            <label
              htmlFor="signup-email"
              className="block text-sm font-medium text-slate-700"
            >
              Email
            </label>
            <input
              id="signup-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value)
                clearError('email')
              }}
              aria-invalid={Boolean(errors.email)}
              aria-describedby={
                errors.email ? 'signup-email-error' : undefined
              }
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-brand-500 focus:ring-2 focus:ring-brand-200 focus:outline-none"
            />
            {errors.email && (
              <p
                id="signup-email-error"
                role="alert"
                className="mt-2 text-sm text-red-600"
              >
                {errors.email}
              </p>
            )}
          </div>

          <div className="mt-4">
            <label
              htmlFor="signup-password"
              className="block text-sm font-medium text-slate-700"
            >
              Password
            </label>
            <input
              id="signup-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value)
                clearError('password')
              }}
              aria-invalid={Boolean(errors.password)}
              aria-describedby={
                errors.password ? 'signup-password-error' : undefined
              }
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-brand-500 focus:ring-2 focus:ring-brand-200 focus:outline-none"
            />
            {errors.password && (
              <p
                id="signup-password-error"
                role="alert"
                className="mt-2 text-sm text-red-600"
              >
                {errors.password}
              </p>
            )}
          </div>

          <button
            type="submit"
            className="mt-6 w-full rounded-lg bg-brand-600 px-4 py-2 font-medium text-white transition-colors hover:bg-brand-700"
          >
            Sign Up
          </button>
        </form>

        <p className="mt-4 text-sm text-slate-600">
          Already have an account?{' '}
          <Link
            to="/login"
            className="font-medium text-brand-700 hover:text-brand-800"
          >
            Login
          </Link>
        </p>
      </div>
    </main>
  )
}

export default SignupPage
