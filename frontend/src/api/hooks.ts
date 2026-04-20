import { useQuery } from '@tanstack/react-query'
import api from './client'
import type {
  Account,
  UseCase,
  CreditConsumption,
  AccountFeatureUsage,
  GongCall,
  AccountResource,
  TMR,
  UseCaseForecast,
  CreditForecast,
  UseCaseCompletionPrediction,
  TMRSuccessPrediction,
  SimilarDeployment,
  CurrentUser,
  CreditDailyEntry,
} from '../types'

export function useAccounts() {
  return useQuery<Account[]>({
    queryKey: ['accounts'],
    queryFn: () => api.get('/accounts').then((r) => r.data),
  })
}

export function useAccount(accountId: string) {
  return useQuery<Account>({
    queryKey: ['accounts', accountId],
    queryFn: () => api.get(`/accounts/${accountId}`).then((r) => r.data),
    enabled: !!accountId,
  })
}

export function useAccountUseCases(accountId: string) {
  return useQuery<UseCase[]>({
    queryKey: ['accounts', accountId, 'use-cases'],
    queryFn: () => api.get(`/accounts/${accountId}/use-cases`).then((r) => r.data),
    enabled: !!accountId,
  })
}

export function useAccountCredits(accountId: string) {
  return useQuery<CreditConsumption[]>({
    queryKey: ['accounts', accountId, 'credits'],
    queryFn: () => api.get(`/accounts/${accountId}/credits`).then((r) => r.data),
    enabled: !!accountId,
  })
}

export function useAccountFeatures(accountId: string) {
  return useQuery<AccountFeatureUsage[]>({
    queryKey: ['accounts', accountId, 'features'],
    queryFn: () => api.get(`/accounts/${accountId}/features`).then((r) => r.data),
    enabled: !!accountId,
  })
}

export function useAccountCreditSeries(accountId: string) {
  return useQuery<CreditDailyEntry[]>({
    queryKey: ['accounts', accountId, 'credit-series'],
    queryFn: () => api.get(`/accounts/${accountId}/credit-series`).then((r) => r.data),
    enabled: !!accountId,
  })
}

export function useAccountGongCalls(accountId: string) {
  return useQuery<GongCall[]>({
    queryKey: ['accounts', accountId, 'gong-calls'],
    queryFn: () => api.get(`/accounts/${accountId}/gong-calls`).then((r) => r.data),
    enabled: !!accountId,
  })
}

export function useAccountResources(accountId: string) {
  return useQuery<AccountResource[]>({
    queryKey: ['accounts', accountId, 'resources'],
    queryFn: () => api.get(`/accounts/${accountId}/resources`).then((r) => r.data),
    enabled: !!accountId,
  })
}

export function useUseCases() {
  return useQuery<UseCase[]>({
    queryKey: ['use-cases'],
    queryFn: () => api.get('/use-cases').then((r) => r.data),
  })
}

export function useTMRs() {
  return useQuery<TMR[]>({
    queryKey: ['tmrs'],
    queryFn: () => api.get('/tmrs').then((r) => r.data),
  })
}

export function useTMRPredictions() {
  return useQuery<TMRSuccessPrediction[]>({
    queryKey: ['tmrs', 'predictions'],
    queryFn: () => api.get('/tmrs/predictions').then((r) => r.data),
  })
}

export function useForecasts() {
  return useQuery<UseCaseForecast[]>({
    queryKey: ['forecasts'],
    queryFn: () => api.get('/forecasts/use-cases-forecast').then((r) => r.data),
  })
}

export function useCreditForecasts() {
  return useQuery<CreditForecast[]>({
    queryKey: ['forecasts', 'credits'],
    queryFn: () => api.get('/forecasts/credits').then((r) => r.data),
  })
}

export function useUseCasePredictions() {
  return useQuery<UseCaseCompletionPrediction[]>({
    queryKey: ['forecasts', 'use-cases'],
    queryFn: () => api.get('/forecasts/use-cases').then((r) => r.data),
  })
}

export function useSimilarDeployments(useCaseType: string) {
  return useQuery<SimilarDeployment[]>({
    queryKey: ['forecasts', 'similar', useCaseType],
    queryFn: () => api.get(`/forecasts/similar/${useCaseType}`).then((r) => r.data),
    enabled: !!useCaseType,
  })
}

export function useGongCalls() {
  return useQuery<GongCall[]>({
    queryKey: ['gong-calls'],
    queryFn: () => api.get('/gong-calls').then((r) => r.data),
  })
}

export function useAceDisplayNames() {
  return useQuery<Record<string, string>>({
    queryKey: ['ace-display-names'],
    queryFn: () => api.get('/ace-display-names').then((r) => r.data),
  })
}

export function useAuthMe() {
  return useQuery<CurrentUser>({
    queryKey: ['auth', 'me'],
    queryFn: () => api.get('/auth/me').then((r) => r.data),
  })
}

export function useMockUsers() {
  return useQuery<CurrentUser[]>({
    queryKey: ['auth', 'mock-users'],
    queryFn: () => api.get('/auth/mock-users').then((r) => r.data),
  })
}

export function useAuthMode() {
  return useQuery<{ spcs_mode: boolean; mock_data: boolean }>({
    queryKey: ['auth', 'mode'],
    queryFn: () => api.get('/auth/mode').then((r) => r.data),
    staleTime: Infinity,
  })
}

interface DailyCreditRow { date: string; credits: number }
interface ServiceSummary { service_name: string; credits_30d: number; credits_7d: number; status: string }
export interface CostOverview {
  credits_today: number
  credits_7d: number
  credits_30d: number
  daily_series: DailyCreditRow[]
  services: ServiceSummary[]
  projected_monthly: number
  budget_credits: number | null
}

export function useAdminCosts() {
  return useQuery<CostOverview>({
    queryKey: ['admin', 'costs'],
    queryFn: () => api.get('/admin/costs').then((r) => r.data),
    staleTime: 60_000,
    retry: false,
  })
}
