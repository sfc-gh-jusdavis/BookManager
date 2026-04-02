import { useAuth } from '../context/AuthContext'
import { ACEDashboard } from './ACEDashboard'
import { ACEMDashboard } from './ACEMDashboard'

export function DashboardRouter() {
  const { currentUser } = useAuth()

  if (currentUser.role === 'acem') {
    return <ACEMDashboard />
  }
  return <ACEDashboard />
}
