import { useState, useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import {
  LayoutDashboard,
  Building2,
  TrendingUp,
  ClipboardList,
  Users,
  Database,
  ChevronLeft,
  ChevronRight,
  Snowflake,
  ShieldAlert,
} from 'lucide-react'
import { clsx } from 'clsx'

interface NavItem {
  to: string
  label: string
  icon: React.ReactNode
  acemOnly?: boolean
  adminOnly?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: <LayoutDashboard size={20} /> },
  { to: '/accounts', label: 'Accounts', icon: <Building2 size={20} /> },
  { to: '/forecasts', label: 'Forecasts', icon: <TrendingUp size={20} /> },
  { to: '/tmrs', label: 'TMRs', icon: <ClipboardList size={20} /> },
  { to: '/team', label: 'Team', icon: <Users size={20} />, acemOnly: true },
  { to: '/data-catalog', label: 'Data Catalog', icon: <Database size={20} /> },
  { to: '/admin/costs', label: 'Cost Monitor', icon: <ShieldAlert size={20} />, adminOnly: true },
]

export function Sidebar() {
  const { currentUser, isAdmin } = useAuth()
  const [collapsed, setCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebar-collapsed')
    return saved === 'true'
  })

  useEffect(() => {
    localStorage.setItem('sidebar-collapsed', String(collapsed))
  }, [collapsed])

  const visibleItems = NAV_ITEMS.filter(
    (item) => (!item.acemOnly || currentUser.role === 'acem') && (!item.adminOnly || isAdmin)
  )

  return (
    <aside
      className={clsx(
        'h-screen bg-white border-r border-slate-200 flex flex-col transition-all duration-200 ease-in-out',
        collapsed ? 'w-16' : 'w-60'
      )}
    >
      {/* Logo */}
      <div className={clsx(
        'flex items-center h-16 border-b border-slate-200 px-4',
        collapsed ? 'justify-center' : 'gap-3'
      )}>
        <Snowflake size={24} className="text-snow-500 shrink-0" />
        {!collapsed && (
          <span className="text-lg font-bold text-slate-800 truncate">
            BookManager
          </span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-2 space-y-1">
        {visibleItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                collapsed && 'justify-center',
                isActive
                  ? 'bg-snow-50 text-snow-700 border-l-2 border-snow-500'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              )
            }
          >
            <span className="shrink-0">{item.icon}</span>
            {!collapsed && <span>{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* User info */}
      <div className={clsx(
        'border-t border-slate-200 p-3',
        collapsed ? 'text-center' : ''
      )}>
        {!collapsed ? (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-snow-100 text-snow-700 flex items-center justify-center text-xs font-bold">
              {currentUser.display_name.split(' ').map(n => n[0]).join('')}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-800 truncate">
                {currentUser.display_name}
              </p>
              <p className="text-xs text-slate-500 uppercase">
                {currentUser.role}
              </p>
            </div>
          </div>
        ) : (
          <div className="w-8 h-8 mx-auto rounded-full bg-snow-100 text-snow-700 flex items-center justify-center text-xs font-bold">
            {currentUser.display_name.split(' ').map(n => n[0]).join('')}
          </div>
        )}
      </div>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center justify-center h-10 border-t border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors"
      >
        {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>
    </aside>
  )
}
