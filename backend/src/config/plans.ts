export const PLAN_CONFIG = {
  free: {
    initialCredits: 3,
    trialDays: 14,
    monthlyCredits: 0 // No monthly reset for free
  },
  pro: {
    initialCredits: 30,
    monthlyCredits: 30 // Resets monthly
  },
  enterprise: {
    initialCredits: -1, // -1 means unlimited
    monthlyCredits: -1 // Unlimited
  }
}

export const OVERAGE_PRICE = 2 // $2 per extra interview (for future)

