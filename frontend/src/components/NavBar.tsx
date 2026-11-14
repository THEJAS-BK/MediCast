import { useEffect, useRef, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/useAuth'

function linkClass(isActive: boolean) {
  return `rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
    isActive
      ? 'bg-brand-100 text-brand-800'
      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
  }`
}

function getInitials(name: string | undefined) {
  const trimmed = name?.trim()

  if (!trimmed) return '?'

  return trimmed
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('')
}

function NavBar() {
  const { user, role, logout } = useAuth()
  const menuRef = useRef<HTMLDivElement>(null)
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  useEffect(() => {
    if (!isMenuOpen) return

    function handleMouseDown(event: MouseEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node)
      ) {
        setIsMenuOpen(false)
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleMouseDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('mousedown', handleMouseDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isMenuOpen])

  function handleLogout() {
    setIsMenuOpen(false)
    logout()
    window.location.replace('/')
  }

  return (
    <header className="relative z-20 border-b border-slate-200 bg-white">
      <nav className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-4 px-6 py-4">
        <div className="flex items-center gap-4">
          <NavLink
            to="/dashboard"
            className="text-lg font-semibold tracking-tight text-brand-700"
          >
            MediCast
          </NavLink>

          <div className="flex items-center gap-1">
            <NavLink
              to="/dashboard"
              className={({ isActive }) => linkClass(isActive)}
            >
              Dashboard
            </NavLink>
            <NavLink
              to="/inventory"
              className={({ isActive }) => linkClass(isActive)}
            >
              Inventory
            </NavLink>
            <NavLink
              to="/calculator"
              className={({ isActive }) => linkClass(isActive)}
            >
              Calculate
            </NavLink>
          </div>
        </div>

        <div ref={menuRef} className="relative">
          <button
            type="button"
            onClick={() => setIsMenuOpen((open) => !open)}
            aria-label="Open profile menu"
            aria-haspopup="menu"
            aria-expanded={isMenuOpen}
            className="flex items-center gap-2 rounded-lg p-1 transition-colors hover:bg-slate-100 focus:ring-2 focus:ring-brand-200 focus:outline-none"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-800">
              {getInitials(user?.name)}
            </span>
            <svg
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              className="h-4 w-4 text-slate-500"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="m6 8 4 4 4-4" />
            </svg>
          </button>

          {isMenuOpen && (
            <div
              role="menu"
              className="absolute right-0 mt-2 w-56 rounded-xl bg-white py-1 shadow-lg ring-1 ring-slate-200"
            >
              <div className="border-b border-slate-100 px-4 py-2">
                <p className="truncate text-sm font-medium text-slate-900">
                  {user?.name}
                </p>
                <p className="truncate text-xs text-slate-500">{user?.email}</p>
              </div>

              <NavLink
                to="/profile"
                role="menuitem"
                onClick={() => setIsMenuOpen(false)}
                className="block px-4 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-100"
              >
                Profile
              </NavLink>

              <NavLink
                to="/organization-info"
                role="menuitem"
                onClick={() => setIsMenuOpen(false)}
                className="block px-4 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-100"
              >
                Organization
              </NavLink>

              {role === 'admin' && (
                <NavLink
                  to="/admin"
                  role="menuitem"
                  onClick={() => setIsMenuOpen(false)}
                  className="block px-4 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-100"
                >
                  Admin Panel
                </NavLink>
              )}

              <button
                type="button"
                role="menuitem"
                onClick={handleLogout}
                className="block w-full px-4 py-2 text-left text-sm text-slate-700 transition-colors hover:bg-slate-100"
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </nav>
    </header>
  )
}

export default NavBar
