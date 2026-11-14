import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { AuthContext } from './auth'
import type {
  AuthContextValue,
  AuthMember,
  AuthOrganization,
  AuthUser,
  Role,
} from './auth'

const STORAGE_KEY = 'medicast.auth'

const DUMMY_MEMBERS = [
  { name: 'Dr. Aisha Khan', email: 'aisha.khan@example.com' },
  { name: 'Rahul Menon', email: 'rahul.menon@example.com' },
  { name: 'Sofia Alvarez', email: 'sofia.alvarez@example.com' },
  { name: 'Daniel Chen', email: 'daniel.chen@example.com' },
]

type AuthState = Pick<
  AuthContextValue,
  'user' | 'organization' | 'role' | 'members'
>

const EMPTY_AUTH: AuthState = {
  user: null,
  organization: null,
  role: null,
  members: [],
}

let memberIdCounter = 0

function createMemberId() {
  memberIdCounter += 1
  return `member-${Date.now()}-${memberIdCounter}`
}

function isRole(value: unknown): value is Role {
  return value === 'admin' || value === 'member'
}

function isStoredMember(value: unknown): value is AuthMember {
  if (!value || typeof value !== 'object') return false

  const member = value as Partial<AuthMember>

  return (
    typeof member.id === 'string' &&
    typeof member.name === 'string' &&
    typeof member.email === 'string' &&
    isRole(member.role)
  )
}

function seedMembers(user: AuthUser, role: Role): AuthMember[] {
  return [
    {
      id: createMemberId(),
      name: user.name,
      email: user.email,
      role,
    },
    ...DUMMY_MEMBERS.map((member, index): AuthMember => ({
      id: createMemberId(),
      name: member.name,
      email: member.email,
      role: role === 'member' && index === 0 ? 'admin' : 'member',
    })),
  ]
}

function readStoredAuth(): AuthState {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (!stored) return EMPTY_AUTH

    const parsed = JSON.parse(stored) as Partial<AuthState>
    if (!parsed.user?.email) return EMPTY_AUTH

    const user: AuthUser = {
      name: parsed.user.name || parsed.user.email,
      email: parsed.user.email,
    }
    const organization = parsed.organization ?? null
    const role = isRole(parsed.role) ? parsed.role : null
    const storedMembers = Array.isArray(parsed.members)
      ? parsed.members.filter(isStoredMember)
      : []
    const members =
      organization && role && storedMembers.length === 0
        ? seedMembers(user, role)
        : storedMembers

    return { user, organization, role, members }
  } catch {
    return EMPTY_AUTH
  }
}

function nameFromEmail(email: string) {
  const [localPart = ''] = email.split('@')
  const words = localPart.split(/[._-]+/).filter(Boolean)

  if (words.length === 0) return 'User'

  return words
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function generateOrganizationCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let suffix = ''

  for (let index = 0; index < 5; index += 1) {
    suffix += alphabet[Math.floor(Math.random() * alphabet.length)]
  }

  return `ORG-${suffix}`
}

function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(readStoredAuth)

  useEffect(() => {
    if (!state.user) {
      window.localStorage.removeItem(STORAGE_KEY)
      return
    }

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [state])

  function login(email: string) {
    const normalizedEmail = email.trim().toLowerCase()

    setState({
      user: {
        name: nameFromEmail(normalizedEmail),
        email: normalizedEmail,
      },
      organization: null,
      role: null,
      members: [],
    })
  }

  function signup(name: string, email: string) {
    setState({
      user: {
        name: name.trim(),
        email: email.trim().toLowerCase(),
      },
      organization: null,
      role: null,
      members: [],
    })
  }

  function createOrganization(name: string) {
    const code = generateOrganizationCode()
    const organization: AuthOrganization = {
      name: name.trim(),
      code,
    }

    setState((current) => {
      if (!current.user) return current

      return {
        ...current,
        organization,
        role: 'admin',
        members: seedMembers(current.user, 'admin'),
      }
    })

    return code
  }

  function joinOrganization(code: string) {
    const normalizedCode = code.trim().toUpperCase()
    const organization: AuthOrganization = {
      name: `Organization ${normalizedCode}`,
      code: normalizedCode,
    }

    setState((current) => {
      if (!current.user) return current

      return {
        ...current,
        organization,
        role: 'member',
        members: seedMembers(current.user, 'member'),
      }
    })
  }

  function addMember(name: string, email: string) {
    const member: AuthMember = {
      id: createMemberId(),
      name: name.trim(),
      email: email.trim().toLowerCase(),
      role: 'member',
    }

    setState((current) => ({
      ...current,
      members: [...current.members, member],
    }))
  }

  function removeMember(memberId: string) {
    setState((current) => {
      const member = current.members.find((item) => item.id === memberId)
      const isCurrentUser =
        member?.email.toLowerCase() === current.user?.email.toLowerCase()

      if (!member || isCurrentUser) return current

      return {
        ...current,
        members: current.members.filter((item) => item.id !== memberId),
      }
    })
  }

  function leaveOrganization() {
    setState((current) => {
      if (current.role !== 'member') return current

      return {
        ...current,
        organization: null,
        role: null,
        members: [],
      }
    })
  }

  function logout() {
    window.localStorage.removeItem(STORAGE_KEY)
    setState(EMPTY_AUTH)
  }

  return (
    <AuthContext.Provider
      value={{
        ...state,
        login,
        signup,
        createOrganization,
        joinOrganization,
        addMember,
        removeMember,
        leaveOrganization,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export default AuthProvider
