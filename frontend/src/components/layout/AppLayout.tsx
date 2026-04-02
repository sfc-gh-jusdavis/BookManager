import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { RoleToggle } from '../dev/RoleToggle'

export function AppLayout() {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto bg-slate-50">
        <Outlet />
      </main>
      <RoleToggle />
    </div>
  )
}
