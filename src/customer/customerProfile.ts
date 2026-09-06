import {
  CUSTOMER_CONFIG, CUSTOMER_TYPE_BY_NAME, DEFAULT_CUSTOMER_TYPE,
} from '@/config/customerConfig';

export type CustomerType = 'honest' | 'normal' | 'suspicious' | 'fraudster';
export interface CustomerProfile { name: string; type: CustomerType; trust: number }

export class CustomerProfileStore {
  private readonly profiles = new Map<string, CustomerProfile>();

  profile(name: string): CustomerProfile {
    let profile = this.profiles.get(name);
    if (!profile) {
      profile = {
        name,
        type: CUSTOMER_TYPE_BY_NAME[name] ?? DEFAULT_CUSTOMER_TYPE,
        trust: CUSTOMER_CONFIG.startingTrust,
      };
      this.profiles.set(name, profile);
    }
    return { ...profile };
  }

  changeTrust(name: string, delta: number): number {
    const profile = this.profile(name);
    profile.trust = Math.min(100, Math.max(0, profile.trust + delta));
    this.profiles.set(name, profile);
    return profile.trust;
  }
}

export function trustDiscountRatioAdjustment(trust: number): number {
  return CUSTOMER_CONFIG.trustDiscountRatioAdjustments.find((band) => trust <= band.max)!.adjustment;
}
