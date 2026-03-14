export interface PlatformSettingsUpdate {
  platformMarginRate: number; // Percentage (e.g. 20 for 20%)
  deliveryFees: number; // In euros (e.g. 50 for 50 €)
  defaultCommissionRate: number; // Percentage (e.g. 10 for 10%)
  opsEmail: string;
  requestExpirationDays: number;
  requestUrgencyDaysBeforeStart: number;
}
