import { createContext, useContext, useState, ReactNode } from 'react'

export type UserRole = 'ace' | 'acem'

export interface CurrentUser {
  user_id: string
  email: string
  display_name: string
  role: UserRole
  team_id: string | null
}

const MOCK_USERS: Record<string, CurrentUser> = {
  'ace-jane': {
    user_id: 'ace-jane',
    email: 'jane.smith@company.com',
    display_name: 'Jane Smith',
    role: 'ace',
    team_id: 'team-west',
  },
  'ace-carlos': {
    user_id: 'ace-carlos',
    email: 'carlos.rodriguez@company.com',
    display_name: 'Carlos Rodriguez',
    role: 'ace',
    team_id: 'team-west',
  },
  'acem-mark': {
    user_id: 'acem-mark',
    email: 'mark.johnson@company.com',
    display_name: 'Mark Johnson',
    role: 'acem',
    team_id: 'team-west',
  },
}

interface AuthContextType {
  currentUser: CurrentUser
  switchUser: (userId: string) => void
  availableUsers: CurrentUser[]
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState('ace-jane')
  const currentUser = MOCK_USERS[userId] ?? MOCK_USERS['ace-jane']!

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        switchUser: setUserId,
        availableUsers: Object.values(MOCK_USERS),
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
