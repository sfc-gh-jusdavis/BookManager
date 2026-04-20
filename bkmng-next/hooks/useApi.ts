"use client";

import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { CurrentUser } from "@/types/auth";

export type GongCall = {
  call_id: string;
  account_id: string;
  title: string | null;
  call_date: string;
  duration_minutes: number | null;
  summary: string | null;
  key_points: string | null;
  next_steps: string[];
  outcome: string | null;
  call_score: number | null;
  direction: string | null;
  participants_emails: string[];
  action_items: string[];
  topics: string[];
  recording_url: string | null;
};

export type TMR = {
  tmr_id: string;
  account_id: string;
  account_name: string;
  use_case_id: string | null;
  status: string;
  stage: string | null;
  activity_requested: string | null;
  engagement_type: string | null;
  requestor: string | null;
  requestor_email: string | null;
  request_reason: string | null;
  specialist_comments: string | null;
  specialist_engagement_status: string | null;
  resolution: string | null;
  rejection_reason: string | null;
  manager_approver: string | null;
  manager_approver_email: string | null;
  requested_date: string | null;
  start_date: string | null;
  close_date: string | null;
  assigned_resource_id: string | null;
  assigned_resource_email: string | null;
  assigned_resource_name: string | null;
  secondary_member_id: string | null;
  secondary_member_email: string | null;
  secondary_member_name: string | null;
};

export type RevenueSummary = {
  account_id: string;
  contract_capacity: number | null;
  total_consumed_revenue: number | null;
  capacity_remaining: number | null;
  total_consumed_credits: number | null;
  pct_consumed: number | null;
  predicted_overage_date: string | null;
  last_actual_date: string | null;
  contract_start_date: string | null;
  contract_end_date: string | null;
  wow_credits_pct_change: number | null;
  mom_credits_pct_change: number | null;
};

export type NBAItem = {
  id: string;
  signal_type: string;
  account_id: string;
  account_name: string;
  priority: "high" | "medium" | "low";
  text: string;
  summary: string;
};

function getMockUserId(): string | undefined {
  if (typeof window === "undefined") return undefined;
  return localStorage.getItem("bkmng-mock-user-id") || "jusdavis";
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const mockUserId = getMockUserId();
  const headers: Record<string, string> = { "Content-Type": "application/json", ...(init?.headers as Record<string, string> ?? {}) };
  if (mockUserId) headers["X-Mock-User"] = mockUserId;
  const res = await fetch(path, { ...init, headers });
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return res.json();
}

const DEFAULT_OPTS = { staleTime: 30_000, retry: 1 };

export function useAccounts() {
  return useQuery({ queryKey: ["accounts"], queryFn: () => apiFetch("/api/accounts"), ...DEFAULT_OPTS });
}

export function useAccount(accountId: string) {
  return useQuery({ queryKey: ["account", accountId], queryFn: () => apiFetch(`/api/accounts/${accountId}`), ...DEFAULT_OPTS, enabled: !!accountId });
}

export function useAccountUseCases(accountId: string) {
  return useQuery({ queryKey: ["account-use-cases", accountId], queryFn: () => apiFetch(`/api/accounts/${accountId}/use-cases`), ...DEFAULT_OPTS, enabled: !!accountId });
}

export function useAccountCredits(accountId: string) {
  return useQuery({ queryKey: ["account-credits", accountId], queryFn: () => apiFetch(`/api/accounts/${accountId}/credits`), ...DEFAULT_OPTS, enabled: !!accountId });
}

export function useAccountFeatures(accountId: string) {
  return useQuery({ queryKey: ["account-features", accountId], queryFn: () => apiFetch(`/api/accounts/${accountId}/features`), ...DEFAULT_OPTS, enabled: !!accountId });
}

export function useAccountRevenueSummary(accountId: string) {
  return useQuery({ queryKey: ["account-revenue-summary", accountId], queryFn: () => apiFetch(`/api/accounts/${accountId}/revenue-summary`), ...DEFAULT_OPTS, enabled: !!accountId });
}

export function useAccountRevenueSummaries() {
  return useQuery({ queryKey: ["account-revenue-summaries"], queryFn: () => apiFetch<Record<string, RevenueSummary>>("/api/accounts/revenue-summaries"), ...DEFAULT_OPTS });
}

export function useAccountGongCalls(accountId: string) {
  return useQuery({ queryKey: ["account-gong-calls", accountId], queryFn: () => apiFetch(`/api/accounts/${accountId}/gong-calls`), ...DEFAULT_OPTS, enabled: !!accountId });
}

export function useAccountResources(accountId: string) {
  return useQuery({ queryKey: ["account-resources", accountId], queryFn: () => apiFetch(`/api/accounts/${accountId}/resources`), ...DEFAULT_OPTS, enabled: !!accountId });
}

export function useUseCases() {
  return useQuery({ queryKey: ["use-cases"], queryFn: () => apiFetch("/api/use-cases"), ...DEFAULT_OPTS });
}

export function useTMRs() {
  return useQuery({ queryKey: ["tmrs"], queryFn: () => apiFetch("/api/tmrs"), ...DEFAULT_OPTS });
}

export function useTMRPredictions() {
  return useQuery({ queryKey: ["tmr-predictions"], queryFn: () => apiFetch("/api/tmrs/predictions"), ...DEFAULT_OPTS });
}

export function useForecasts() {
  return useQuery({ queryKey: ["forecasts"], queryFn: () => apiFetch("/api/forecasts/use-cases-forecast"), ...DEFAULT_OPTS });
}

export function useCreditForecasts() {
  return useQuery({ queryKey: ["credit-forecasts"], queryFn: () => apiFetch("/api/forecasts/credits"), ...DEFAULT_OPTS });
}

export function useUseCasePredictions() {
  return useQuery({ queryKey: ["use-case-predictions"], queryFn: () => apiFetch("/api/forecasts/use-cases"), ...DEFAULT_OPTS });
}

export function useGongCalls() {
  return useQuery({ queryKey: ["gong-calls"], queryFn: () => apiFetch("/api/gong-calls"), ...DEFAULT_OPTS });
}

export function useAceDisplayNames() {
  return useQuery({ queryKey: ["ace-display-names"], queryFn: () => apiFetch<Record<string, string>>("/api/ace-display-names"), ...DEFAULT_OPTS });
}

export function useAuthMe() {
  return useQuery({ queryKey: ["auth-me"], queryFn: () => apiFetch<CurrentUser>("/api/auth/me"), staleTime: Infinity });
}

export function useNBA() {
  return useQuery({ queryKey: ["nba"], queryFn: () => apiFetch<NBAItem[]>("/api/nba"), ...DEFAULT_OPTS });
}

export function useAdminCosts() {
  return useQuery({ queryKey: ["admin-costs"], queryFn: () => apiFetch("/api/admin/costs"), staleTime: 60_000, retry: false });
}

export type AccountTracking = {
  account_id: string;
  account_name: string | null;
  tracking_status: "following" | "archived";
  notes: string | null;
  updated_at: string | null;
};

export function useAccountTracking(accountId: string) {
  return useQuery<AccountTracking | null>({
    queryKey: ["account-tracking", accountId],
    queryFn: async () => {
      try {
        return await apiFetch<AccountTracking>(`/api/accounts/${accountId}/tracking`);
      } catch {
        return null;
      }
    },
    ...DEFAULT_OPTS,
    enabled: !!accountId,
  });
}

export function useRefreshAccount(accountId: string) {
  const qc = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["account", accountId] }),
      qc.invalidateQueries({ queryKey: ["account-use-cases", accountId] }),
      qc.invalidateQueries({ queryKey: ["account-timeline", accountId] }),
      qc.invalidateQueries({ queryKey: ["manual-meetings", accountId] }),
      qc.invalidateQueries({ queryKey: ["account-gong-calls", accountId] }),
      qc.invalidateQueries({ queryKey: ["account-context", accountId] }),
      qc.invalidateQueries({ queryKey: ["account-situations", accountId] }),
    ]);
    setIsRefreshing(false);
  }, [qc, accountId]);
  return { refresh, isRefreshing };
}

export function useRefreshBook() {
  const qc = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["accounts"] }),
      qc.invalidateQueries({ queryKey: ["use-cases"] }),
      qc.invalidateQueries({ queryKey: ["signal-counts"] }),
      qc.invalidateQueries({ queryKey: ["nba"] }),
      qc.invalidateQueries({ queryKey: ["gong-calls"] }),
      qc.invalidateQueries({ queryKey: ["account-use-cases"] }),
      qc.invalidateQueries({ queryKey: ["account-timeline"] }),
      qc.invalidateQueries({ queryKey: ["manual-meetings"] }),
      qc.invalidateQueries({ queryKey: ["account-gong-calls"] }),
    ]);
    setIsRefreshing(false);
  }, [qc]);
  return { refresh, isRefreshing };
}

export function useSetAccountTracking(accountId: string) {
  const qc = useQueryClient();
  return useMutation<unknown, unknown, { status: "following" | "archived"; notes?: string }>({
    mutationFn: (body) =>
      apiFetch<AccountTracking>(`/api/accounts/${accountId}/tracking`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["account-tracking", accountId] });
      qc.invalidateQueries({ queryKey: ["tracked-accounts"] });
    },
  });
}

export function useDeleteAccountTracking(accountId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const mockUserId = typeof window !== "undefined" ? (localStorage.getItem("bkmng-mock-user-id") || "jusdavis") : "jusdavis";
      const res = await fetch(`/api/accounts/${accountId}/tracking`, {
        method: "DELETE",
        headers: { "X-Mock-User": mockUserId },
      });
      if (!res.ok && res.status !== 204) throw new Error(`DELETE tracking → ${res.status}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["account-tracking", accountId] });
      qc.invalidateQueries({ queryKey: ["tracked-accounts"] });
    },
  });
}


export function useUpdateAccountFields(accountId: string) {
  const qc = useQueryClient();
  return useMutation<unknown, unknown, { status?: string; engagement_status?: string; no_recording?: boolean }, { previous: unknown } | undefined>({
    mutationFn: (body) =>
      apiFetch(`/api/accounts/${accountId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    onMutate: async (body) => {
      await qc.cancelQueries({ queryKey: ["account", accountId] });
      const previous = qc.getQueryData(["account", accountId]);
      qc.setQueryData(["account", accountId], (old: Record<string, unknown> | undefined) =>
        old ? { ...old, ...body } : old
      );
      return { previous };
    },
    onError: (_err, _body, ctx) => {
      if (ctx?.previous !== undefined) qc.setQueryData(["account", accountId], ctx.previous);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["account", accountId] });
    },
  });
}

export function useTrackedAccounts() {
  return useQuery({ queryKey: ["tracked-accounts"], queryFn: () => apiFetch<Record<string, unknown>[]>("/api/accounts-tracked"), ...DEFAULT_OPTS });
}

export type SignalCountEntry = { high: number; medium: number; low: number; total: number };

export function useSignalCounts() {
  return useQuery<Record<string, SignalCountEntry>>({
    queryKey: ["signal-counts"],
    queryFn: () => apiFetch<Record<string, SignalCountEntry>>("/api/accounts/signal-counts"),
    staleTime: 60_000,
    retry: 1,
  });
}

export type UseCaseAssessment = {
  use_case_id: string;
  account_id: string;
  account_name?: string;
  use_case_name?: string;
  ai_tier?: "high" | "medium" | "low";
  confidence?: number;
  rationale?: string;
  recommended_actions?: string;
  risk_level?: "high" | "medium" | "low";
  opportunity_score?: number;
  computed_at?: string;
};

export type AccountAssessment = {
  account_id: string;
  account_name?: string;
  ai_priority_score?: number;
  priority_tier?: "critical" | "high" | "medium" | "low";
  confidence?: number;
  rationale?: string;
  recommended_actions?: string;
  key_risks?: string;
  key_opportunities?: string;
  computed_at?: string;
};

export function useAccountAssessments() {
  return useQuery<AccountAssessment[]>({
    queryKey: ["account-assessments"],
    queryFn: () => apiFetch<AccountAssessment[]>("/api/assessments/accounts"),
    staleTime: 300_000,
    retry: 1,
  });
}

export function useAllUseCaseAssessments() {
  return useQuery<UseCaseAssessment[]>({
    queryKey: ["all-use-case-assessments"],
    queryFn: () => apiFetch<UseCaseAssessment[]>("/api/assessments/use-cases"),
    staleTime: 300_000,
    retry: 1,
  });
}

export function useUseCaseAssessments(accountId: string) {
  return useQuery<UseCaseAssessment[]>({
    queryKey: ["use-case-assessments", accountId],
    queryFn: () => apiFetch<UseCaseAssessment[]>(`/api/assessments/use-cases/${accountId}`),
    staleTime: 300_000,
    retry: 1,
    enabled: !!accountId,
  });
}

export type UseCaseBreakdownItem = {
  breakdown_id?: string;
  use_case_id: string;
  account_id: string;
  account_name?: string;
  parent_use_case_name?: string;
  splittability_score?: number;
  splittability_reason?: string;
  sub_use_case_index?: number;
  sub_use_case_name?: string;
  sub_workload?: string;
  sub_technical_use_case?: string;
  sub_rationale?: string;
  sub_estimated_effort?: string;
  sub_key_activities?: string;
  total_sub_use_cases?: number;
  overall_rationale?: string;
  criteria_scores?: string;
  status?: string;
  computed_at?: string;
};

export type BreakdownSummary = {
  use_case_id: string;
  account_id: string;
  account_name?: string;
  parent_use_case_name?: string;
  splittability_score?: number;
  splittability_reason?: string;
  total_sub_use_cases?: number;
  overall_rationale?: string;
  computed_at?: string;
};

export function useAllBreakdownSummaries() {
  return useQuery<BreakdownSummary[]>({
    queryKey: ["breakdown-summaries"],
    queryFn: () => apiFetch<BreakdownSummary[]>("/api/assessments/breakdowns"),
    staleTime: 300_000,
    retry: 1,
  });
}

export function useAccountBreakdowns(accountId: string) {
  return useQuery<UseCaseBreakdownItem[]>({
    queryKey: ["account-breakdowns", accountId],
    queryFn: () => apiFetch<UseCaseBreakdownItem[]>(`/api/assessments/breakdowns/${accountId}`),
    staleTime: 300_000,
    retry: 1,
    enabled: !!accountId,
  });
}

export function useUseCaseBreakdowns(accountId: string, useCaseId: string) {
  return useQuery<UseCaseBreakdownItem[]>({
    queryKey: ["use-case-breakdowns", accountId, useCaseId],
    queryFn: () => apiFetch<UseCaseBreakdownItem[]>(`/api/assessments/breakdowns/${accountId}/${useCaseId}`),
    staleTime: 300_000,
    retry: 1,
    enabled: !!accountId && !!useCaseId,
  });
}

export type QuarterData = {
  actual: number;
  projected: number;
  total: number;
  complete_months: number;
  is_complete: boolean;
};

export type AccountConsumptionProjection = {
  account_id: string;
  account_name: string;
  contract_capacity: number | null;
  capacity_remaining: number | null;
  total_consumed_credits: number | null;
  monthly_run_rate: number;
  quarters: Record<string, QuarterData>;
  fy_actual: number;
  fy_projected: number;
  fy_total: number;
  pct_capacity_projected: number | null;
};

export type ConsumptionProjection = {
  fy_label: string;
  fy_start: string;
  fy_end: string;
  as_of: string;
  quarters: { key: string; label: string; start: string; end: string; is_current: boolean }[];
  accounts: AccountConsumptionProjection[];
};

export function useConsumptionProjection() {
  return useQuery<ConsumptionProjection>({
    queryKey: ["consumption-projection"],
    queryFn: () => apiFetch<ConsumptionProjection>("/api/forecasts/consumption-projection"),
    ...DEFAULT_OPTS,
  });
}

export type FeatureAdoption = {
  account_id: string;
  account_name: string;
  feature_name: string;
  feature_raw: string;
  feature_source: string;
  category: string;
  first_use_date: string | null;
  days_since_first_use: number;
  is_new_30d: boolean;
  is_new_90d: boolean;
};

export type AdoptionSignals = {
  account_id: string;
  account_name: string;
  sig_pipeline: number;
  sig_transforms: number;
  sig_bi: number;
  sig_cost: number;
  sig_collab: number;
  sig_obs: number;
  sig_aiml: number;
  sig_spcs: number;
  signal_count: number;
  adoption_profile: string;
  missing_categories: string;
  total_billed_credits_90d: number;
};

export type AccountAdoptionData = {
  signals: AdoptionSignals | null;
  features: FeatureAdoption[];
};

export function useRecentAdoptions(days = 7) {
  return useQuery<FeatureAdoption[]>({
    queryKey: ["recent-adoptions", days],
    queryFn: () => apiFetch<FeatureAdoption[]>(`/api/adoption/recent?days=${days}`),
    ...DEFAULT_OPTS,
  });
}

export function useAccountAdoption(accountId: string) {
  return useQuery<AccountAdoptionData>({
    queryKey: ["account-adoption", accountId],
    queryFn: () => apiFetch<AccountAdoptionData>(`/api/accounts/${accountId}/adoption`),
    ...DEFAULT_OPTS,
    enabled: !!accountId,
  });
}

export type TimelineNote = {
  note_id: string;
  use_case_id: string;
  use_case_name: string;
  author_id: string;
  content: string;
  created_at: string;
  source_type?: string | null;
  is_deletable?: boolean;
};

export function useAccountTimeline(accountId: string) {
  return useQuery<TimelineNote[]>({
    queryKey: ["account-timeline", accountId],
    queryFn: () => apiFetch<TimelineNote[]>(`/api/accounts/${accountId}/timeline`),
    ...DEFAULT_OPTS,
    enabled: !!accountId,
  });
}

export type AlertItem = {
  alert_id: string;
  user_email: string;
  signal_id: string | null;
  signal_type: string;
  account_id: string | null;
  account_name: string | null;
  text: string | null;
  priority: "high" | "medium" | "low";
  source: string | null;
  is_read: boolean;
  is_dismissed: boolean;
  created_at: string | null;
};

export function useAlerts() {
  return useQuery<AlertItem[]>({
    queryKey: ["alerts"],
    queryFn: () => apiFetch<AlertItem[]>("/api/alerts"),
    staleTime: 60_000,
    retry: 1,
  });
}

export function useAlertCount() {
  return useQuery<{ count: number }>({
    queryKey: ["alert-count"],
    queryFn: () => apiFetch<{ count: number }>("/api/alerts/count"),
    staleTime: 60_000,
    retry: 1,
  });
}

export function useMarkAlertRead() {
  const qc = useQueryClient();
  return useMutation<unknown, unknown, string>({
    mutationFn: (alertId) =>
      apiFetch(`/api/alerts/${alertId}/read`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["alerts"] });
      qc.invalidateQueries({ queryKey: ["alert-count"] });
    },
  });
}

export function useDismissAlert() {
  const qc = useQueryClient();
  return useMutation<unknown, unknown, string>({
    mutationFn: (alertId) =>
      apiFetch(`/api/alerts/${alertId}/dismiss`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["alerts"] });
      qc.invalidateQueries({ queryKey: ["alert-count"] });
    },
  });
}

export function useMuteAlert() {
  const qc = useQueryClient();
  return useMutation<unknown, unknown, { alertId: string; scope: "instance" | "type"; duration_days?: number }>({
    mutationFn: ({ alertId, scope, duration_days = 3 }) =>
      apiFetch(`/api/alerts/${alertId}/mute`, {
        method: "POST",
        body: JSON.stringify({ scope, duration_days }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["alerts"] });
      qc.invalidateQueries({ queryKey: ["alert-count"] });
    },
  });
}

export type ManualMeeting = {
  meeting_id: string;
  account_id: string;
  account_name: string | null;
  title: string;
  meeting_date: string;
  attendees: string | null;
  notes: string | null;
  notes_summary: string | null;
  notes_added: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export function useManualMeetings(accountId: string) {
  return useQuery<ManualMeeting[]>({
    queryKey: ["manual-meetings", accountId],
    queryFn: () => apiFetch<ManualMeeting[]>(`/api/accounts/${accountId}/manual-meetings`),
    staleTime: 30_000,
    enabled: !!accountId,
  });
}

export function useAddManualMeeting(accountId: string) {
  const qc = useQueryClient();
  return useMutation<unknown, unknown, { title: string; meeting_date: string; attendees?: string }>({
    mutationFn: (body) =>
      apiFetch<ManualMeeting>(`/api/accounts/${accountId}/manual-meetings`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["manual-meetings", accountId] });
    },
  });
}

export function useUpdateMeetingNotes(accountId: string) {
  const qc = useQueryClient();
  return useMutation<unknown, unknown, { meetingId: string; notes: string }>({
    mutationFn: ({ meetingId, notes }) =>
      apiFetch<ManualMeeting>(`/api/accounts/${accountId}/manual-meetings/${meetingId}`, {
        method: "PATCH",
        body: JSON.stringify({ notes }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["manual-meetings", accountId] });
      qc.invalidateQueries({ queryKey: ["account-timeline", accountId] });
      setTimeout(() => {
        qc.invalidateQueries({ queryKey: ["manual-meetings", accountId] });
        qc.invalidateQueries({ queryKey: ["account-timeline", accountId] });
      }, 7000);
    },
  });
}

export function useAddTimelineContext(accountId: string) {
  const qc = useQueryClient();
  return useMutation<
    { meeting_id: string; status: string },
    unknown,
    { classification: string; content: string; title?: string; context_date?: string }
  >({
    mutationFn: (body) =>
      apiFetch<{ meeting_id: string; status: string }>(`/api/accounts/${accountId}/timeline-context`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["account-timeline", accountId] });
      qc.invalidateQueries({ queryKey: ["manual-meetings", accountId] });
      qc.invalidateQueries({ queryKey: ["account-context", accountId] });
      setTimeout(() => {
        qc.invalidateQueries({ queryKey: ["account-timeline", accountId] });
      }, 8000);
    },
  });
}

export function useDeleteTimelineContext(accountId: string) {
  const qc = useQueryClient();
  return useMutation<{ status: string }, unknown, string>({
    mutationFn: (entryId) =>
      apiFetch<{ status: string }>(`/api/accounts/${accountId}/timeline-context/${entryId}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["account-timeline", accountId] });
      qc.invalidateQueries({ queryKey: ["manual-meetings", accountId] });
      qc.invalidateQueries({ queryKey: ["account-context", accountId] });
    },
  });
}

export type MeetingActivity = {
  activity_id: string;
  account_id: string;
  account_name: string;
  ace_assigned: string | null;
  subject: string | null;
  activity_date: string | null;
  owner_id: string | null;
  participant_names: string | null;
  is_upcoming: boolean;
  takeaways: string | null;
  is_pain_points: boolean;
  is_next_steps: boolean;
  is_competitor: boolean;
};

export type EmailActivity = {
  account_id: string;
  account_name: string;
  ace_assigned: string | null;
  emails_last_7d: number;
  emails_last_14d: number;
  emails_last_30d: number;
  emails_last_90d: number;
  last_email_date: string | null;
  emails_outbound_30d: number;
  emails_inbound_30d: number;
  avg_weekly_email_frequency: number | null;
  email_trend: string | null;
};

export function useMeetingActivity(accountId: string, upcomingOnly = false) {
  return useQuery<MeetingActivity[]>({
    queryKey: ["meetings", accountId, upcomingOnly],
    queryFn: () =>
      apiFetch<MeetingActivity[]>(
        `/api/accounts/${accountId}/meetings?limit=20&upcoming_only=${upcomingOnly}`
      ),
    staleTime: 5 * 60_000,
    enabled: !!accountId,
  });
}

export function useEmailActivity(accountId: string) {
  return useQuery<EmailActivity>({
    queryKey: ["email-activity", accountId],
    queryFn: () =>
      apiFetch<EmailActivity>(`/api/accounts/${accountId}/email-activity`),
    staleTime: 5 * 60_000,
    enabled: !!accountId,
  });
}

export type EnrichedText = { text: string; source?: string | null; reasoning?: string | null };
export type EnrichedItem = { item: string; source?: string | null; reasoning?: string | null };
export type EnrichedAgenda = { topic: string; source?: string | null; reasoning?: string | null };
export type EnrichedQuestion = { question: string; source?: string | null; reasoning?: string | null };

export type MeetingPrep = {
  prep_id?: number;
  account_id: string;
  account_name: string;
  last_meeting_recap: string | null;
  changes_since_last: string | null;
  open_action_items: string | null;
  suggested_agenda: string | null;
  questions_to_ask: string | null;
  competitive_context: string | null;
  account_briefing_summary: string | null;
  generated_at?: string | null;
  error?: string;
  meeting_recaps: string | null;
  feature_signals: string | null;
  suggested_assets: string | null;
  pre_meeting_email: string | null;
  doc_links: string | null;
};

export type DocLink = { url: string; title: string };
export type MeetingRecap = {
  title: string;
  date: string;
  summary: string;
  key_decisions: string[];
  open_items: string[];
  gong_url: string | null;
};
export type SuggestedTopic = {
  topic: string;
  justification: string;
  evidence_source: "signal" | "gong" | "notes" | "adoption";
  priority: "high" | "medium";
  feature_area: string;
  doc_links: DocLink[];
};
export type FeatureSignal = {
  feature: string;
  category: string;
  first_use_date: string;
  insight: string;
  suggested_action: string;
  doc_links: DocLink[];
};
export type SuggestedAsset = {
  asset_type: "demo" | "pdf_guide" | "notebook" | "workshop";
  title: string;
  description: string;
  related_topic: string;
};

export function useMeetingPrep(accountId: string) {
  return useQuery<MeetingPrep>({
    queryKey: ["meeting-prep", accountId],
    queryFn: () => apiFetch<MeetingPrep>(`/api/accounts/${accountId}/meeting-prep`),
    staleTime: 6 * 60 * 60_000,
    enabled: !!accountId,
    retry: 1,
  });
}

export function useRefreshMeetingPrep(accountId: string) {
  const qc = useQueryClient();
  return useMutation<unknown, unknown, string>({
    mutationFn: (additionalContext) =>
      apiFetch<MeetingPrep>(`/api/accounts/${accountId}/meeting-prep`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ additional_context: additionalContext }),
      }),
    onSuccess: (data) => {
      qc.setQueryData(["meeting-prep", accountId], data);
    },
  });
}

export function useGeneratePrepEmail(accountId: string) {
  const qc = useQueryClient();
  return useMutation<{ subject: string; body: string }, unknown, { recipient_name?: string; meeting_date?: string }>({
    mutationFn: (body) =>
      apiFetch<{ subject: string; body: string }>(`/api/accounts/${accountId}/meeting-prep/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["meeting-prep", accountId] });
    },
  });
}

export type AccountContact = {
  name: string;
  email: string;
  title: string | null;
  department: string | null;
  role_on_account: string;
  is_champion: boolean;
  gong_call_count_90d: number;
  last_gong_call_date: string | null;
  days_since_last_call: number | null;
};

export function useAccountContacts(accountId: string) {
  return useQuery<AccountContact[]>({
    queryKey: ["account-contacts", accountId],
    queryFn: () => apiFetch<AccountContact[]>(`/api/accounts/${accountId}/contacts`),
    staleTime: 30 * 60_000,
    enabled: !!accountId,
  });
}

export type AccountBriefing = {
  briefing_id?: number;
  account_id: string;
  account_name: string;
  situation_summary: string | null;
  top_risk: string | null;
  top_opportunity: string | null;
  recommended_actions: string | null;
  talking_points: string | null;
  key_questions: string | null;
  context_used?: boolean;
  gong_calls_used?: number;
  generated_at?: string | null;
  model_used?: string | null;
  error?: string;
};

export function useAccountBriefing(accountId: string, refresh = false) {
  return useQuery<AccountBriefing>({
    queryKey: ["account-briefing", accountId, refresh],
    queryFn: () => apiFetch<AccountBriefing>(`/api/accounts/${accountId}/briefing${refresh ? "?refresh=true" : ""}`),
    staleTime: 6 * 60 * 60_000,
    enabled: !!accountId,
    retry: 1,
  });
}

export type CompositePattern = {
  pattern_id: string;
  account_id: string;
  account_name: string;
  ace_email: string;
  pattern_name: string;
  category: "risk" | "opportunity" | "action_needed";
  severity: "critical" | "high" | "medium";
  description: string;
  recommended_action: string;
  talking_points: string;
  component_signals: string;
  created_at: string;
};

export function useSituations() {
  return useQuery<CompositePattern[]>({
    queryKey: ["situations"],
    queryFn: () => apiFetch<CompositePattern[]>("/api/situations"),
    staleTime: 5 * 60_000,
  });
}

export function useAccountSituations(accountId: string) {
  return useQuery<CompositePattern[]>({
    queryKey: ["account-situations", accountId],
    queryFn: () => apiFetch<CompositePattern[]>(`/api/accounts/${accountId}/situations`),
    staleTime: 5 * 60_000,
    enabled: !!accountId,
  });
}

export type ContextNote = {  context_id: string | null;
  account_name: string | null;
  context_type: string | null;
  content: string;
  source: string | null;
  created_by: string | null;
  created_at: string | null;
  is_active: boolean;
  parsed_summary: string | null;
  sentiment: string | null;
  people_mentioned: string | null;
  topics_discussed: string | null;
  competitors_mentioned: string | null;
  action_items: string | null;
  risks_identified: string | null;
  opportunities_identified: string | null;
  blockers_mentioned: string | null;
  parse_status: string | null;
};

export function useAccountContext(accountId: string) {
  return useQuery<ContextNote[]>({
    queryKey: ["account-context", accountId],
    queryFn: () => apiFetch<ContextNote[]>(`/api/accounts/${accountId}/context`),
    staleTime: 30_000,
    enabled: !!accountId,
  });
}

export function useAddAccountContext(accountId: string) {
  const qc = useQueryClient();
  return useMutation<{ status: string; context_id: number | null; parsed: boolean; summary: string | null; sentiment: string | null }, unknown, { content: string; context_type?: string; source?: string; use_case_id?: string }>({
    mutationFn: (body) =>
      apiFetch<{ status: string; context_id: number | null; parsed: boolean; summary: string | null; sentiment: string | null }>(
        `/api/accounts/${accountId}/context`,
        { method: "POST", body: JSON.stringify(body) }
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["account-context", accountId] });
    },
  });
}

export type UserPreferences = {
  preferred_name: string | null;
  greeting_style: string | null;
  closing_style: string | null;
  writing_examples: string[] | null;
};

export function useUserPreferences() {
  return useQuery<UserPreferences>({
    queryKey: ["user-preferences"],
    queryFn: () => apiFetch<UserPreferences>("/api/user/preferences"),
    staleTime: 5 * 60_000,
  });
}

export function useUpdatePreferences() {
  const qc = useQueryClient();
  return useMutation<unknown, unknown, Partial<UserPreferences>>({
    mutationFn: (body) =>
      apiFetch("/api/user/preferences", {
        method: "PUT",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["user-preferences"] });
    },
  });
}

export type AlertPreferenceItem = {
  signal_type: string;
  label: string;
  description: string;
  how_generated: string;
  category: string;
  default_priority: string;
  priority: string;
  enabled: boolean;
};

export function useAlertPreferences() {
  return useQuery<AlertPreferenceItem[]>({
    queryKey: ["alert-preferences"],
    queryFn: () => apiFetch<AlertPreferenceItem[]>("/api/user/alert-preferences"),
    staleTime: 60_000,
  });
}

export function useUpdateAlertPreference() {
  const qc = useQueryClient();
  return useMutation<unknown, unknown, { signal_type: string; enabled: boolean; priority_override?: string | null }>({
    mutationFn: (body) =>
      apiFetch("/api/user/alert-preferences", {
        method: "PUT",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["alert-preferences"] });
    },
  });
}

export type SecurityMilestone = {
  id: string;
  name: string;
  status: "complete" | "partial" | "not_started" | "not_applicable";
  priority: "critical" | "high" | "medium" | "informational";
  industry_required: boolean;
  industry_priority: string;
  raw_value: Record<string, number> | null;
  llm_summary: string | null;
  ace_override: {
    status: string;
    notes: string;
    updated_by: string;
    updated_at: string;
  } | null;
};

export type SecurityTier = {
  tier_id: string;
  tier_name: string;
  milestones: SecurityMilestone[];
};

export type SecurityPostureData = {
  account_id: string;
  account_name: string;
  industry: string;
  service_level: string;
  overall_score: number;
  total_milestones: number;
  applicable_milestones: number;
  last_checked: string | null;
  tiers: SecurityTier[];
};

export function useSecurityPosture(accountId: string) {
  return useQuery<SecurityPostureData>({
    queryKey: ["security-posture", accountId],
    queryFn: () => apiFetch<SecurityPostureData>(`/api/accounts/${accountId}/security-posture`),
    ...DEFAULT_OPTS,
    enabled: !!accountId,
  });
}

export function useSetSecurityOverride(accountId: string) {
  const qc = useQueryClient();
  return useMutation<unknown, unknown, { milestone_id: string; ace_status: string; ace_notes: string }>({
    mutationFn: ({ milestone_id, ...body }) =>
      apiFetch(`/api/accounts/${accountId}/security-posture/${milestone_id}/override`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["security-posture", accountId] });
    },
  });
}

export function useDeleteSecurityOverride(accountId: string) {
  const qc = useQueryClient();
  return useMutation<unknown, unknown, { milestone_id: string }>({
    mutationFn: async ({ milestone_id }) => {
      const mockUserId = typeof window !== "undefined" ? (localStorage.getItem("bkmng-mock-user-id") || "jusdavis") : "jusdavis";
      const res = await fetch(`/api/accounts/${accountId}/security-posture/${milestone_id}/override`, {
        method: "DELETE",
        headers: { "X-Mock-User": mockUserId },
      });
      if (!res.ok && res.status !== 204) throw new Error(`DELETE override → ${res.status}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["security-posture", accountId] });
    },
  });
}
