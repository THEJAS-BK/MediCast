import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/useAuth'

type Mode = 'create' | 'join'

function OrganizationPage() {
  const { createOrganization, joinOrganization } = useAuth()
  const navigate = useNavigate()

  const [mode, setMode] = useState<Mode | null>(null)
  const [organizationName, setOrganizationName] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [createdCode, setCreatedCode] = useState('')
  const [error, setError] = useState('')

  function chooseMode(nextMode: Mode) {
    setMode(nextMode)
    setError('')
    setOrganizationName('')
    setJoinCode('')
  }

  function backToChoices() {
    setMode(null)
    setError('')
    setOrganizationName('')
    setJoinCode('')
  }

  function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const name = organizationName.trim()

    if (!name) {
      setError('Organization name is required.')
      return
    }

    setError('')
    setCreatedCode(createOrganization(name))
  }

  function handleJoin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const code = joinCode.trim()

    if (!code) {
      setError('Organization code is required.')
      return
    }

    setError('')
    joinOrganization(code)
    navigate('/dashboard')
  }

  return (
    <section className="mx-auto max-w-3xl">
      <div>
        {createdCode ? (
          <div className="max-w-md rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              Organization created
            </h1>
            <p className="mt-1 text-slate-600">
              Share this code with your team so they can join.
            </p>

            <p className="mt-5 rounded-lg bg-brand-50 px-4 py-3 text-center font-mono text-lg font-semibold tracking-wider text-brand-800 ring-1 ring-brand-100">
              {createdCode}
            </p>

            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              className="mt-6 w-full rounded-lg bg-brand-600 px-4 py-2 font-medium text-white transition-colors hover:bg-brand-700"
            >
              Continue to Dashboard
            </button>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              Choose your organization
            </h1>
            <p className="mt-1 text-slate-600">
              Create a new workspace or join an existing one.
            </p>

            {!mode && (
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => chooseMode('create')}
                  className="rounded-xl bg-white p-6 text-left shadow-sm ring-1 ring-slate-200 transition-colors hover:bg-brand-50 hover:ring-brand-200"
                >
                  <h2 className="text-lg font-semibold text-slate-900">
                    Create Organization
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Set up a new workspace and invite your team with a code.
                  </p>
                  <span className="mt-4 inline-block text-sm font-medium text-brand-700">
                    Create →
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => chooseMode('join')}
                  className="rounded-xl bg-white p-6 text-left shadow-sm ring-1 ring-slate-200 transition-colors hover:bg-brand-50 hover:ring-brand-200"
                >
                  <h2 className="text-lg font-semibold text-slate-900">
                    Join Organization
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Enter a code shared by your organization administrator.
                  </p>
                  <span className="mt-4 inline-block text-sm font-medium text-brand-700">
                    Join →
                  </span>
                </button>
              </div>
            )}

            {mode && (
              <form
                onSubmit={mode === 'create' ? handleCreate : handleJoin}
                noValidate
                className="mt-6 max-w-md rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200"
              >
                <div className="flex items-center justify-between gap-4">
                  <h2 className="text-lg font-semibold text-slate-900">
                    {mode === 'create'
                      ? 'Create Organization'
                      : 'Join Organization'}
                  </h2>
                  <button
                    type="button"
                    onClick={backToChoices}
                    className="text-sm font-medium text-slate-500 hover:text-slate-900"
                  >
                    Back
                  </button>
                </div>

                <div className="mt-4">
                  <label
                    htmlFor={
                      mode === 'create'
                        ? 'organization-name'
                        : 'organization-code'
                    }
                    className="block text-sm font-medium text-slate-700"
                  >
                    {mode === 'create' ? 'Organization name' : 'Organization code'}
                  </label>
                  <input
                    id={
                      mode === 'create'
                        ? 'organization-name'
                        : 'organization-code'
                    }
                    type="text"
                    value={mode === 'create' ? organizationName : joinCode}
                    onChange={(event) => {
                      if (mode === 'create') {
                        setOrganizationName(event.target.value)
                      } else {
                        setJoinCode(event.target.value)
                      }
                      setError('')
                    }}
                    placeholder={
                      mode === 'create' ? 'e.g. City Care Hospital' : 'e.g. ORG-123456'
                    }
                    aria-invalid={Boolean(error)}
                    aria-describedby={
                      error ? 'organization-error' : undefined
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-brand-500 focus:ring-2 focus:ring-brand-200 focus:outline-none"
                  />
                  {error && (
                    <p
                      id="organization-error"
                      role="alert"
                      className="mt-2 text-sm text-red-600"
                    >
                      {error}
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  className="mt-6 w-full rounded-lg bg-brand-600 px-4 py-2 font-medium text-white transition-colors hover:bg-brand-700"
                >
                  {mode === 'create' ? 'Create organization' : 'Join organization'}
                </button>
              </form>
            )}
          </>
        )}
      </div>
    </section>
  )
}

export default OrganizationPage
