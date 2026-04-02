export type UserRole = 'ace' | 'acem'

export interface CurrentUser {
  user_id: string
  email: string
  display_name: string
  role: UserRole
  team_id: string | null
}

export type EngagementStatus = 'Pre-Activation' | 'Active' | 'Completed'

export interface Account {
  account_id: string
  account_name: string
  industry: string
  ace_assigned: string
  collaborators: string[]
  engagement_status: EngagementStatus
  status: string
  use_case_count: number
  total_credits_allocated: number
  activation_start_date: string
  region: string | null
  acv: number
  consumption_ytd: number
}

export type ForecastCategory = 'Commit' | 'Most Likely' | 'Stretch'
export type PerformanceTier = 'Overperforming' | 'On Track' | 'At Risk'

export interface UseCaseForecast {
  use_case_id: string
  account_id: string
  auto_category: ForecastCategory
  override_category: ForecastCategory | null
  override_note: string | null
  override_by: string | null
  override_at: string | null
  pending_approval: boolean
  quarter: string
}

export interface PSNote {
  note_id: string
  use_case_id: string
  author: string
  content: string
  created_at: string
}

export interface UseCase {
  use_case_id: string
  account_id: string
  account_name: string
  use_case_name: string
  description: string
  status: string
  ps_notes: PSNote[]
  ps_notes_summary: string | null
  go_live_date: string | null
  target_go_live_date: string | null
  lead_se: string
  ace_assigned: string
  created_date: string
  last_modified_date: string
  stage: string
  complexity: string | null
}

export interface TMRReviewNote {
  note_id: string
  tmr_id: string
  author_id: string
  author_name: string
  content: string
  created_at: string
}

export interface TMR {
  tmr_id: string
  account_id: string
  account_name: string
  requestor: string
  request_type: string
  status: string
  requested_date: string
  start_date: string | null
  end_date: string | null
  estimated_hours: number | null
  actual_hours: number | null
  use_case_id: string | null
  priority: string
  outcome: string | null
  assigned_to: string | null
  review_notes: TMRReviewNote[]
}

export interface CreditConsumption {
  account_id: string
  measurement_date: string
  credits_used: number
  credits_allocated: number
  warehouse_name: string | null
  compute_credits: number
  storage_credits: number
  cloud_services_credits: number
  daily_trend: number
  monthly_trend: number
}

export interface AccountFeatureUsage {
  account_id: string
  feature_name: string
  usage_count: number
  first_used: string | null
  last_used: string | null
  measurement_period: string
}

export interface CreditForecast {
  account_id: string
  forecast_date: string
  predicted_credits_30d: number
  predicted_credits_60d: number
  predicted_credits_90d: number
  confidence_interval_lower: number
  confidence_interval_upper: number
  trend_direction: string
  model_version: string
}

export interface UseCaseCompletionPrediction {
  use_case_id: string
  account_id: string
  predicted_go_live_date: string
  confidence_score: number
  risk_factors: string[]
  predicted_status: string
  days_remaining_estimate: number
  similar_use_case_refs: string[]
  model_version: string
}

export interface TMRSuccessPrediction {
  tmr_id: string
  predicted_success_probability: number
  predicted_completion_date: string | null
  risk_level: string
  recommended_actions: string[]
  comparable_tmr_outcomes: string[]
  model_version: string
}

export interface SimilarDeployment {
  deployment_id: string
  use_case_type: string
  industry: string
  account_size: string
  days_to_go_live: number
  credits_consumed: number
  features_used: string[]
  success_rating: number | null
  blockers_encountered: string[]
  resources_used: number
}

export interface GongCall {
  call_id: string
  account_id: string
  call_date: string
  duration_minutes: number
  summary: string
  topics: string[]
  action_items: string[]
  next_steps: string[]
  participants_internal: string[]
  participants_external: string[]
}

export type ResourceType = 'note' | 'link'
export type LinkType = 'google_drive' | 'confluence' | 'email' | 'slack' | 'other'

export interface AccountResource {
  resource_id: string
  account_id: string
  resource_type: ResourceType
  title: string
  content: string
  link_type: LinkType | null
  created_by: string
  created_at: string
}
