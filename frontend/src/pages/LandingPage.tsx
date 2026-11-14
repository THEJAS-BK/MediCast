import { Link } from 'react-router-dom'

function LandingPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-2xl text-center">
        <h1 className="text-5xl font-semibold tracking-tight text-slate-900 sm:text-6xl">
          MediCast
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-xl text-slate-700">
          Forecast demand. Protect supply.
        </p>
        <p className="mx-auto mt-3 max-w-xl text-lg text-slate-600">
          MediCast helps hospitals anticipate medicine demand and keep the
          right stock on hand.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            to="/login"
            className="rounded-lg bg-brand-600 px-5 py-2.5 font-medium text-white transition-colors hover:bg-brand-700"
          >
            Login
          </Link>
          <Link
            to="/signup"
            className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 font-medium text-slate-700 transition-colors hover:bg-slate-100"
          >
            Sign Up
          </Link>
        </div>
      </div>
    </main>
  )
}

export default LandingPage
