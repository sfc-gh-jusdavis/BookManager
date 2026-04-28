import { useAuth } from '../../context/AuthContext'

interface HeaderProps {
  title: string
  subtitle?: string
}

export function Header({ title, subtitle }: HeaderProps) {
  const { currentUser } = useAuth()

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800">{title}</h1>
        {subtitle && (
          <p className="text-sm text-slate-500">{subtitle}</p>
        )}
      </div>
      <div className="flex items-center gap-4">
        <span className="text-sm text-slate-500">
          {currentUser.role === 'acem' ? 'Manager View' : 'My Book'}
        </span>
      </div>
    </header>
  )
}
