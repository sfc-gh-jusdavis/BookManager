/** Rough used credits by account health status (table / cards). */
export function estimatedCreditsUsed(status: string, allocated: number): number {
  const factors: Record<string, number> = {
    Active: 0.68,
    Onboarding: 0.12,
    'At Risk': 0.45,
    'Go Live': 0.82,
  }
  return allocated * (factors[status] ?? 0.5)
}
