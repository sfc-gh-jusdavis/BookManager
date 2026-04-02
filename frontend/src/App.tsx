import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './context/AuthContext'
import { AppLayout } from './components/layout/AppLayout'
import { DashboardRouter } from './pages/DashboardRouter'
import { Accounts } from './pages/Accounts'
import { AccountDetail } from './pages/AccountDetail'
import { Forecasts } from './pages/Forecasts'
import { Team } from './pages/Team'
import { TeamMemberProfile } from './pages/TeamMemberProfile'
import { TMRs } from './pages/TMRs'
import { DataCatalog } from './pages/DataCatalog'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
})

export default function App() {
  return (
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
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}
