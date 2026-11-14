import { useAuth } from '../context/useAuth'

function ProfilePage() {
  const { user, organization, role } = useAuth()

  return (
    <section>
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
        Profile
      </h1>
      <p className="mt-1 text-slate-600">
        Account details for this session.
      </p>

      <dl className="mt-6 max-w-md rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <dt className="text-sm text-slate-500">Name</dt>
          <dd className="text-sm font-medium text-slate-900">
            {user?.name}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-4 border-b border-slate-100 py-4">
          <dt className="text-sm text-slate-500">Email</dt>
          <dd className="text-sm font-medium text-slate-900">
            {user?.email}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-4 border-b border-slate-100 py-4">
          <dt className="text-sm text-slate-500">Organization</dt>
          <dd className="text-sm font-medium text-slate-900">
            {organization?.name}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-4 pt-4">
          <dt className="text-sm text-slate-500">Role</dt>
          <dd className="text-sm font-medium capitalize text-slate-900">
            {role}
          </dd>
        </div>
      </dl>
    </section>
  )
}

export default ProfilePage
