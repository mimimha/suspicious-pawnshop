import type { CustomerQueueConfig } from '@/customer/customerQueue';

export const CUSTOMER_QUEUE_CONFIG = {
  customersPerDayByStage: [5, 6],
  delayBetweenCustomersSeconds: 0,
} as const;

export function customerQueueConfigForStage(stage: number): CustomerQueueConfig {
  const index = Math.min(Math.max(stage, 1), CUSTOMER_QUEUE_CONFIG.customersPerDayByStage.length) - 1;
  const customersPerDay = CUSTOMER_QUEUE_CONFIG.customersPerDayByStage[index]!;
  return {
    minimumCustomersPerDay: customersPerDay,
    maximumCustomersPerDay: customersPerDay,
    delayBetweenCustomersSeconds: CUSTOMER_QUEUE_CONFIG.delayBetweenCustomersSeconds,
  };
}
