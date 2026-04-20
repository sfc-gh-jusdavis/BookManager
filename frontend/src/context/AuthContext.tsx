import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import api from '../api/client'

export type UserRole = 'ace' | 'acem'

export interface CurrentUser {
  user_id: string
  email: string
  display_name: string
  role: UserRole
  team_id: string | null
  is_admin: boolean
}

const FALLBACK_USER: CurrentUser = {
  user_id: 'jusdavis',
  email: 'j.davis@snowflake.com',
  display_name: 'Justin Davis',
  role: 'ace',
  team_id: 'team-west',
  is_admin: true,
}

interface AuthContextType {
  currentUser: CurrentUser
  switchUser: (userId: string) => void
  availableUsers: CurrentUser[]
  loading: boolean
  isSpcs: boolean
  isAdmin: boolean
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<CurrentUser>(FALLBACK_USER)
  const [availableUsers, setAvailableUsers] = useState<CurrentUser[]>([])
  const [loading, setLoading] = useState(true)
  const [isSpcs, setIsSpcs] = useState(false)

  useEffect(() => {
    const savedUser = localStorage.getItem('mock-user-id')
    if (savedUser) {
      api.defaults.headers.common['X-Mock-User'] = savedUser
    }

    Promise.all([
      api.get<{ spcs_mode: boolean; mock_data: boolean }>('/auth/mode').then((r) => r.data),
      api.get<CurrentUser>('/auth/me').then((r) => r.data),
      api.get<CurrentUser[]>('/auth/mock-users').then((r) => r.data).catch(() => []),
    ])
      .then(([mode, me, users]) => {
        setIsSpcs(mode.spcs_mode)
        setCurrentUser(me)
        if (mode.spcs_mode) {
          setAvailableUsers([me])
        } else {
          setAvailableUsers(users.length > 0 ? users : [me])
        }
      })
      .catch(() => {
        setCurrentUser(FALLBACK_USER)
        setAvailableUsers([FALLBACK_USER])
      })
      .finally(() => setLoading(false))
  }, [])

  const switchUser = useCallback((userId: string) => {
    if (isSpcs) return
    localStorage.setItem('mock-user-id', userId)
    api.defaults.headers.common['X-Mock-User'] = userId
    api.get<CurrentUser>('/auth/me').then((r) => setCurrentUser(r.data))
  }, [isSpcs])

  return (
    <AuthContext.Provider value={{
      currentUser,
      switchUser,
      availableUsers,
      loading,
      isSpcs,
      isAdmin: currentUser.is_admin,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
