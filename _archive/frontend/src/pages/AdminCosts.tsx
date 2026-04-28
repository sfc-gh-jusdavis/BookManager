import { Navigate } from 'react-router-dom'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer,
} from 'recharts'
import { Zap, TrendingUp, Server } from 'lucide-react'
import { Header } from '../components/layout/Header'
import { useAuth } from '../context/AuthContext'
import { useAdminCosts } from '../api/hooks'

function formatCredits(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(2)}K`
  return n.toFixed(3)
}

function formatDate(iso: string): string {
  const [, m, d] = iso.split('-').map(Number); return `${m}/${d}`
}

function KPI({ label, value, icon, color }: { label: string; value: string; icon: React.ReactNode; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
      <div className={`inline-flex p-2 rounded-lg mb-3 ${color}`}>{icon}</div>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      <p className="text-xs text-slate-500 mt-1">{label}</p>
    </div>
  )
}

export function AdminCosts() {
  const { isAdmin, loading } = useAuth()
  const { data, isLoading, error } = useAdminCosts()

  if (loading) return null
  if (!isAdmin) return <Navigate to="/" replace />

  return (
    <>
      <Header
        title="Cost Monitoring"
        subtitle="SPCS credit consumption for BKMNG_SERVICE"
      />
      <div className="p-6 space-y-6">
        {isLoading && (
          <div className="text-sm text-slate-400">Loading usage data…</div>
        )}
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">
            Failed to load cost data: {(error as Error).message}
          </div>
        )}
        {data && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <KPI label="Credits Today" value={formatCredits(data.credits_today)} icon={<Zap size={16} />} color="bg-sky-50 text-sky-600" />
              <KPI label="Credits (7d)" value={formatCredits(data.credits_7d)} icon={<TrendingUp size={16} />} color="bg-violet-50 text-violet-600" />
              <KPI label="Credits (30d)" value={formatCredits(data.credits_30d)} icon={<TrendingUp size={16} />} color="bg-amber-50 text-amber-600" />
              <KPI label="Projected Monthly" value={formatCredits(data.projected_monthly)} icon={<TrendingUp size={16} />} color="bg-emerald-50 text-emerald-600" />
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-4">30-Day Credit Consumption</h3>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={data.daily_series} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="#64748b" tickFormatter={formatDate} />
                  <YAxis tick={{ fontSize: 10 }} stroke="#64748b" tickFormatter={(v: number) => v.toFixed(1)} />
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
                    formatter={(v: number | string) => [Number(v).toFixed(4), 'Credits']}
                    labelFormatter={(l) => String(l)}
                  />
                  <Area type="monotone" dataKey="credits" stroke="#8B5CF6" fill="#8B5CF6" fillOpacity={0.15} strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-4 flex items-center gap-2">
                <Server size={14} /> Services
              </h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-wider text-slate-400 border-b border-slate-100">
                    <th className="text-left pb-2 font-medium">Service</th>
                    <th className="text-right pb-2 font-medium">7d Credits</th>
                    <th className="text-right pb-2 font-medium">30d Credits</th>
                    <th className="text-right pb-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.services.map((svc) => (
                    <tr key={svc.service_name} className="border-b border-slate-50 last:border-0">
                      <td className="py-2.5 font-mono text-xs text-slate-700">{svc.service_name}</td>
                      <td className="py-2.5 text-right tabular-nums text-slate-700">{formatCredits(svc.credits_7d)}</td>
                      <td className="py-2.5 text-right tabular-nums text-slate-700">{formatCredits(svc.credits_30d)}</td>
                      <td className="py-2.5 text-right">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${svc.status === 'RUNNING' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                          {svc.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </>
  )
}
