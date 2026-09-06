import type { ItemSeed } from '@/config/tradeConfig';

export interface BagMerchantConfig {
  pageSize: number;
  priceRatio: { min: number; max: number };
  roundingUnit: number;
}

export interface MerchantOffer {
  readonly item: ItemSeed;
  readonly price: number;
}

export type MerchantRandomSource = () => number;

/** STAGE 마지막의 단 한 번뿐인 매입 제안 목록을 소유한다. */
export class BagMerchant {
  private merchantOffers: MerchantOffer[] = [];
  private _status: 'idle' | 'visiting' | 'finished' = 'idle';

  constructor(
    private readonly config: BagMerchantConfig,
    private readonly random: MerchantRandomSource = Math.random,
  ) {}

  get offers(): readonly MerchantOffer[] {
    return this.merchantOffers.map((offer) => ({ ...offer }));
  }
  get status(): 'idle' | 'visiting' | 'finished' { return this._status; }

  startVisit(catalog: readonly ItemSeed[]): void {
    if (this._status !== 'idle') throw new Error('보따리 상인 방문은 한 번만 시작할 수 있다.');
    const candidates = [...new Map(catalog.map((item) => [item.id, item])).values()];
    for (let index = candidates.length - 1; index > 0; index -= 1) {
      const target = Math.floor(this.normalizedRandom() * (index + 1));
      [candidates[index], candidates[target]] = [candidates[target]!, candidates[index]!];
    }

    this.merchantOffers = candidates.map((item) => {
      const { min, max } = this.config.priceRatio;
      const ratio = min + this.normalizedRandom() * (max - min);
      const price = Math.round((item.basePrice * ratio) / this.config.roundingUnit)
        * this.config.roundingUnit;
      return { item, price };
    });
    this._status = 'visiting';
  }

  finishVisit(): void {
    if (this._status !== 'visiting') throw new Error('진행 중인 보따리 상인 방문이 없다.');
    this._status = 'finished';
  }

  private normalizedRandom(): number {
    return Math.min(Math.max(this.random(), 0), 1 - Number.EPSILON);
  }
}
