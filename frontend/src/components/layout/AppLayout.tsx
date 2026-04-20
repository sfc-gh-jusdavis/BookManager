import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { RoleToggle } from '../dev/RoleToggle'
import { useAuth } from '../../context/AuthContext'
import { Snowflake } from 'lucide-react'

export function AppLayout() {
  const { isSpcs, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3 text-slate-400">
          <Snowflake size={32} className="text-snow-500 animate-spin" />
          <p className="text-sm font-medium">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto bg-slate-50">
        <Outlet />
      </main>
      {!isSpcs && <RoleToggle />}
    </div>
  )
}
