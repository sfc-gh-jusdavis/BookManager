import { Component, type ReactNode, type ErrorInfo } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './context/AuthContext'

class ErrorBoundary extends Component<{ children: ReactNode }, { error: unknown }> {
  state = { error: null as unknown }
  static getDerivedStateFromError(error: unknown) { return { error } }
  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error('[BookManager] Unhandled render error:', error, info.componentStack)
  }
  render() {
    const { error } = this.state
    if (error !== null && error !== undefined && error !== false) {
      const msg = error instanceof Error ? error.message : String(error)
      const stack = error instanceof Error ? error.stack : ''
      return (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: '#7f1d1d', color: '#fef2f2', padding: '2rem',
          fontFamily: 'monospace', zIndex: 99999, overflow: 'auto'
        }}>
          <h2 style={{ color: '#fca5a5', marginBottom: '1rem' }}>React Error Boundary</h2>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: '0.8rem', color: '#fef2f2' }}>
            {msg}{stack ? '\n\n' + stack : ''}
          </pre>
        </div>
      )
    }
    return this.props.children
  }
}
import { AppLayout } from './components/layout/AppLayout'
import { DashboardRouter } from './pages/DashboardRouter'
import { Accounts } from './pages/Accounts'
import { AccountDetail } from './pages/AccountDetail'
import { Forecasts } from './pages/Forecasts'
import { Team } from './pages/Team'
import { TeamMemberProfile } from './pages/TeamMemberProfile'
import { TMRs } from './pages/TMRs'
import { DataCatalog } from './pages/DataCatalog'
import { AdminCosts } from './pages/AdminCosts'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 0,
    },
  },
})

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              <Route element={<AppLayout />}>
                <Route path="/" element={<DashboardRouter />} />
                <Route path="/accounts" element={<Accounts />} />
                <Route path="/accounts/:accountId" element={<AccountDetail />} />
                <Route path="/forecasts" element={<Forecasts />} />
                <Route path="/tmrs" element={<TMRs />} />
                <Route path="/team" element={<Team />} />
                <Route path="/team/:aceId" element={<TeamMemberProfile />} />
                <Route path="/data-catalog" element={<DataCatalog />} />
                <Route path="/admin/costs" element={<AdminCosts />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  )
}
