export interface CustomerQueueConfig {
  minimumCustomersPerDay: number;
  maximumCustomersPerDay: number;
  delayBetweenCustomersSeconds: number;
}

export type RandomSource = () => number;

/** 하루 동안 손님이 순차 방문하는 흐름만 소유한다. */
export class CustomerQueue {
  private _targetCount = 0;
  private _appearedCount = 0;
  private _processedCount = 0;
  private _waitingSeconds = 0;
  private activeCustomer = false;
  private acceptingCustomers = false;

  constructor(
    private readonly config: CustomerQueueConfig,
    private readonly random: RandomSource = Math.random,
  ) {}

  get targetCount(): number { return this._targetCount; }
  get appearedCount(): number { return this._appearedCount; }
  get processedCount(): number { return this._processedCount; }
  get waitingSeconds(): number { return this._waitingSeconds; }
  get hasActiveCustomer(): boolean { return this.activeCustomer; }
  get hasRemainingCustomers(): boolean { return this._appearedCount < this._targetCount; }
  get isWaiting(): boolean {
    return this.acceptingCustomers && !this.activeCustomer && this.hasRemainingCustomers;
  }

  startDay(): void {
    const span = this.config.maximumCustomersPerDay - this.config.minimumCustomersPerDay + 1;
    const normalizedRandom = Math.min(Math.max(this.random(), 0), 1 - Number.EPSILON);
    this._targetCount = this.config.minimumCustomersPerDay + Math.floor(normalizedRandom * span);
    this._appearedCount = 0;
    this._processedCount = 0;
    this._waitingSeconds = 0;
    this.activeCustomer = false;
    this.acceptingCustomers = true;
  }

  tick(deltaSeconds: number): void {
    if (!this.isWaiting || deltaSeconds <= 0) return;
    const remaining = this._waitingSeconds - deltaSeconds;
    this._waitingSeconds = remaining <= 1e-9 ? 0 : remaining;
  }

  takeNextCustomer(): boolean {
    if (!this.isWaiting || this._waitingSeconds > 0) return false;
    this._appearedCount += 1;
    this.activeCustomer = true;
    return true;
  }

  completeActiveCustomer(): boolean {
    if (!this.acceptingCustomers || !this.activeCustomer) return false;
    this.activeCustomer = false;
    this._processedCount += 1;
    this._waitingSeconds = this.hasRemainingCustomers
      ? this.config.delayBetweenCustomersSeconds
      : 0;
    return true;
  }

  skipWait(): void {
    if (this.isWaiting) this._waitingSeconds = 0;
  }

  stopDay(): void {
    this.acceptingCustomers = false;
    this.activeCustomer = false;
    this._waitingSeconds = 0;
  }
}
