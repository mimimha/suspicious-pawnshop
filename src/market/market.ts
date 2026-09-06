import { MARKET_CONFIG } from '@/config/marketConfig';
import { ITEM_CATEGORIES, type ItemCategory, type ItemSeed } from '@/config/tradeConfig';
import { fakeDisposalPrice, type Authenticity } from '@/item/authenticity';

export type MarketTrend = 'down' | 'normal' | 'up';
type RandomSource = () => number;

interface CategoryMarket { previous: number | null; current: number }

/** 그래프에 쓸 최근 시세 이력의 최대 길이(2일 전·어제·오늘). */
const RECENT_HISTORY_LENGTH = 3;

export class Market {
  private day = 0;
  private readonly values = new Map<ItemCategory, CategoryMarket>();
  private nextValues = new Map<ItemCategory, number>();
  private readonly historyValues = new Map<ItemCategory, number[]>();

  constructor(private readonly random: RandomSource = Math.random) {}

  get currentDay(): number { return this.day; }

  updateForDay(day: number): boolean {
    if (!Number.isSafeInteger(day) || day < 1) throw new RangeError('DAY는 1 이상의 정수여야 한다.');
    if (day === this.day) return false;
    if (day !== this.day + 1) throw new Error('시세는 DAY 순서대로 한 번씩만 갱신할 수 있다.');
    for (const category of ITEM_CATEGORIES) {
      const previousValue = this.values.get(category)?.current ?? null;
      const current = this.nextValues.get(category) ?? this.randomMultiplier(category);
      this.values.set(category, { previous: previousValue, current });
      const history = this.historyValues.get(category) ?? [];
      history.push(current);
      this.historyValues.set(category, history.slice(-RECENT_HISTORY_LENGTH));
    }
    this.nextValues = new Map(
      ITEM_CATEGORIES.map((category) => [category, this.randomMultiplier(category)]),
    );
    this.day = day;
    return true;
  }

  multiplier(category: ItemCategory): number {
    return this.requireCategory(category).current;
  }

  trend(category: ItemCategory): MarketTrend {
    const value = this.requireCategory(category);
    if (value.previous === null) return 'normal';
    const difference = value.current - value.previous;
    if (Math.abs(difference) <= MARKET_CONFIG.normalDifference) return 'normal';
    return difference < 0 ? 'down' : 'up';
  }

  salePrice(item: ItemSeed, authenticity: Authenticity = 'genuine'): number {
    if (authenticity === 'fake') return fakeDisposalPrice(item);
    const raw = item.basePrice * this.multiplier(item.category);
    const unit = MARKET_CONFIG.priceRoundingUnit;
    return Math.round(raw / unit) * unit;
  }

  /**
   * 그래프용 최근 판매가. 오래된 값부터 오늘까지, 최대 3일(2일 전·어제·오늘)이다.
   * DAY 1에는 오늘 값 하나뿐이다.
   */
  recentSalePrices(item: ItemSeed, authenticity: Authenticity = 'genuine'): number[] {
    const history = this.historyValues.get(item.category);
    if (!history || history.length === 0) throw new Error('DAY 시세를 먼저 갱신해야 한다.');
    if (authenticity === 'fake') return history.map(() => fakeDisposalPrice(item));
    return history.map((multiplier) => this.roundPrice(item.basePrice * multiplier));
  }

  previousSalePrice(item: ItemSeed, authenticity: Authenticity = 'genuine'): number | null {
    if (authenticity === 'fake') return fakeDisposalPrice(item);
    const previous = this.requireCategory(item.category).previous;
    return previous === null ? null : this.roundPrice(item.basePrice * previous);
  }

  nextDaySalePrice(item: ItemSeed, authenticity: Authenticity = 'genuine'): number {
    if (authenticity === 'fake') return fakeDisposalPrice(item);
    const multiplier = this.nextValues.get(item.category);
    if (multiplier === undefined) throw new Error('DAY 시세를 먼저 갱신해야 한다.');
    return this.roundPrice(item.basePrice * multiplier);
  }

  private randomMultiplier(category: ItemCategory): number {
    const type = MARKET_CONFIG.categoryTypes[category];
    const range = MARKET_CONFIG.ranges[type];
    return range.min + (range.max - range.min) * this.random();
  }

  private roundPrice(raw: number): number {
    const unit = MARKET_CONFIG.priceRoundingUnit;
    return Math.round(raw / unit) * unit;
  }

  private requireCategory(category: ItemCategory): CategoryMarket {
    const value = this.values.get(category);
    if (!value) throw new Error('DAY 시세를 먼저 갱신해야 한다.');
    return value;
  }
}
