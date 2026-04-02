import { useAuth } from '../../context/AuthContext'

export function RoleToggle() {
  const { currentUser, switchUser, availableUsers } = useAuth()

  const roleBg = currentUser.role === 'acem'
    ? 'bg-amber-500 hover:bg-amber-600'
    : 'bg-snow-500 hover:bg-snow-600'

  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2">
      <div className="flex flex-col items-end gap-1">
        {availableUsers.map((user) => (
          <button
            key={user.user_id}
            onClick={() => switchUser(user.user_id)}
            className={`
              px-3 py-1.5 rounded-lg text-xs font-medium transition-all shadow-lg
              ${user.user_id === currentUser.user_id
                ? `${roleBg} text-white`
                : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
              }
            `}
          >
            {user.role === 'acem' ? 'ACEM' : 'ACE'}: {user.display_name}
          </button>
        ))}
      </div>
    </div>
  )
}
