import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/useAuth'

function OrganizationInfoPage() {
  const { organization, role, members, leaveOrganization } = useAuth()
  const navigate = useNavigate()

  function handleLeave() {
    leaveOrganization()
    navigate('/organization', { replace: true })
  }

  return (
    <section>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Organization
          </h1>
          <p className="mt-1 text-slate-600">
            View your organization details and members.
          </p>
        </div>

        {role === 'member' && (
          <button
            type="button"
            onClick={handleLeave}
            className="rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-50"
          >
            Leave Organization
          </button>
        )}
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <article className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-sm font-medium text-slate-500">
            Organization name
          </h2>
          <p className="mt-3 text-lg font-semibold text-slate-900">
            {organization?.name}
          </p>
        </article>
        <article className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-sm font-medium text-slate-500">
            Organization code
          </h2>
          <p className="mt-3 font-mono text-lg font-semibold tracking-wider text-brand-800">
            {organization?.code}
          </p>
        </article>
      </div>

      <div className="mt-6 rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-slate-900">Members</h2>
        </div>
        <div className="overflow-x-auto">
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
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {members.map((member) => (
                <tr key={member.id}>
                  <td className="px-5 py-3 font-medium text-slate-900">
                    {member.name}
                  </td>
                  <td className="px-5 py-3 text-slate-600">{member.email}</td>
                  <td className="px-5 py-3 capitalize text-slate-700">
                    {member.role}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}

export default OrganizationInfoPage
