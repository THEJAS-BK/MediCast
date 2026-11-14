import { useState } from 'react'
import type { FormEvent } from 'react'
import type { AuthMember } from '../context/auth'
import { useAuth } from '../context/useAuth'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type FieldErrors = {
  name?: string
  email?: string
}

function AdminPage() {
  const { organization, user, members, addMember, removeMember } = useAuth()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [errors, setErrors] = useState<FieldErrors>({})

  function clearError(field: keyof FieldErrors) {
    setErrors((current) => ({ ...current, [field]: undefined }))
  }

  function isCurrentUser(member: AuthMember) {
    return member.email.toLowerCase() === user?.email.toLowerCase()
  }

  function handleAddMember(event: FormEvent<HTMLFormElement>) {
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

    setErrors(nextErrors)

    if (Object.keys(nextErrors).length > 0) {
      return
    }

    addMember(nameValue, emailValue)
    setName('')
    setEmail('')
  }

  function handleRemoveMember(member: AuthMember) {
    if (window.confirm(`Remove ${member.name} from the organization?`)) {
      removeMember(member.id)
    }
  }

  return (
    <section>
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
        Admin Panel
      </h1>
      <p className="mt-1 text-slate-600">
        Manage your organization and its members.
      </p>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Organization
          </p>
          <p className="mt-1 text-lg font-semibold text-slate-900">
            {organization?.name}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Organization code
          </p>
          <p className="mt-1 font-mono text-lg font-semibold tracking-wider text-brand-800">
            {organization?.code}
          </p>
        </div>
      </div>

      <div className="mt-6">
        <h2 className="text-lg font-semibold text-slate-900">Members</h2>
        <p className="mt-1 text-sm text-slate-600">
          Remove members who should no longer have access.
        </p>

        <div className="mt-3 overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th scope="col" className="px-5 py-3 font-medium">
                  Name
                </th>
                <th scope="col" className="px-5 py-3 font-medium">
                  Email
                </th>
                <th scope="col" className="px-5 py-3 font-medium">
                  Role
                </th>
                <th scope="col" className="px-5 py-3 text-right font-medium">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {members.map((member) => {
                const isSelf = isCurrentUser(member)

                return (
                  <tr key={member.id}>
                    <td className="px-5 py-3 font-medium text-slate-900">
                      {member.name}
                    </td>
                    <td className="px-5 py-3 text-slate-600">
                      {member.email}
                    </td>
                    <td className="px-5 py-3 capitalize text-slate-700">
                      {member.role}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleRemoveMember(member)}
                        disabled={isSelf}
                        title={
                          isSelf ? 'You cannot remove yourself' : undefined
                        }
                        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <form
        onSubmit={handleAddMember}
        noValidate
        className="mt-6 max-w-md rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200"
      >
        <h2 className="text-lg font-semibold text-slate-900">Add Member</h2>
        <p className="mt-1 text-sm text-slate-600">
          New members are added with the member role.
        </p>

        <div className="mt-4">
          <label
            htmlFor="member-name"
            className="block text-sm font-medium text-slate-700"
          >
            Name
          </label>
          <input
            id="member-name"
            type="text"
            autoComplete="name"
            value={name}
            onChange={(event) => {
              setName(event.target.value)
              clearError('name')
            }}
            aria-invalid={Boolean(errors.name)}
            aria-describedby={errors.name ? 'member-name-error' : undefined}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-brand-500 focus:ring-2 focus:ring-brand-200 focus:outline-none"
          />
          {errors.name && (
            <p
              id="member-name-error"
              role="alert"
              className="mt-2 text-sm text-red-600"
            >
              {errors.name}
            </p>
          )}
        </div>

        <div className="mt-4">
          <label
            htmlFor="member-email"
            className="block text-sm font-medium text-slate-700"
          >
            Email
          </label>
          <input
            id="member-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value)
              clearError('email')
            }}
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? 'member-email-error' : undefined}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-brand-500 focus:ring-2 focus:ring-brand-200 focus:outline-none"
          />
          {errors.email && (
            <p
              id="member-email-error"
              role="alert"
              className="mt-2 text-sm text-red-600"
            >
              {errors.email}
            </p>
          )}
        </div>

        <button
          type="submit"
          className="mt-6 w-full rounded-lg bg-brand-600 px-4 py-2 font-medium text-white transition-colors hover:bg-brand-700"
        >
          Add member
        </button>
      </form>
    </section>
  )
}

export default AdminPage
