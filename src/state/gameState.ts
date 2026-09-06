import { GAME_BALANCE, type GameBalance } from '@/config/gameBalance';

/**
 * DAY 하나의 진행 단계.
 *
 * 통합 기획서 §3의 DAY 흐름에서 시세·판매·거래를 제외한 뼈대만 가져온 것이다.
 * 전이는 BeforeOpen → Open → Closed → (다음 날) BeforeOpen 순서로만 일어난다.
 */
export type DayPhase = 'BeforeOpen' | 'Open' | 'Closed';
export type GamePhase = DayPhase | 'StageResult' | 'GameOver' | 'DemoClear';

export type StageFailureReason = 'rent' | 'profitGoal' | null;

export interface RentResult {
  success: boolean;
  rent: number;
  moneyBefore: number;
  moneyAfter: number;
  shortfall: number;
  /** 이 STAGE에 요구된 최소 실현 손익. 0이면 목표 없음. */
  profitGoal: number;
  /** 이 STAGE 동안 확정된 실현 손익. */
  realizedProfit: number;
  /** 실패 원인. 성공이면 null. */
  failureReason: StageFailureReason;
}

/** 잘못된 Phase 전이를 시도했을 때 던진다. */
export class InvalidPhaseTransitionError extends Error {
  constructor(from: GamePhase, action: string) {
    super(`'${from}' 상태에서는 ${action}을(를) 할 수 없다.`);
    this.name = 'InvalidPhaseTransitionError';
  }
}

/**
 * 게임 전체 흐름에 필요한 최소 상태.
 *
 * Inventory / Market / Customer 상태는 여기 두지 않는다. 각 시스템이 소유한다.
 * Phaser 에 의존하지 않는 순수 로직이므로 그대로 단위 테스트할 수 있다.
 */
export class GameState {
  private readonly balance: GameBalance;

  private _stage = 1;
  private _day = 1;
  private _phase: GamePhase = 'BeforeOpen';
  private _money: number;
  private _remainingSeconds = 0;
  private _rentResult: RentResult | null = null;
  private openingTimeBonusSeconds = 0;

  constructor(balance: GameBalance = GAME_BALANCE) {
    this.balance = balance;
    this._money = balance.startingMoney;
  }

  /** 현재 STAGE. 월세 납부 성공 시 데모 범위 안에서 증가한다. */
  get stage(): number {
    return this._stage;
  }

  get day(): number {
    return this._day;
  }

  get phase(): GamePhase {
    return this._phase;
  }

  get money(): number {
    return this._money;
  }

  /** 거래 성사 시 현금을 차감한다. 음수·비정수·잔액 초과 금액은 거부한다. */
  spendMoney(amount: number): void {
    if (!Number.isSafeInteger(amount) || amount < 0 || amount > this._money) {
      throw new RangeError('사용 금액은 보유 현금 이하의 0 이상 정수여야 한다.');
    }
    this._money -= amount;
  }

  /** 판매 성사 시 현금을 증가시킨다. */
  earnMoney(amount: number): void {
    if (!Number.isSafeInteger(amount) || amount < 0) {
      throw new RangeError('획득 금액은 0 이상의 정수여야 한다.');
    }
    this._money += amount;
  }

  /** 남은 영업시간(초). Open 이 아닐 때는 0이다. */
  get remainingSeconds(): number {
    return this._remainingSeconds;
  }

  get daysPerStage(): number {
    return this.balance.daysPerStage;
  }

  /** 이 STAGE를 넘기기 위해 필요한 최소 실현 손익. 0이면 목표 없음. */
  get profitGoalDue(): number {
    return this.balance.stageProfitGoals[this._stage - 1] ?? 0;
  }

  get rentDue(): number {
    const rent = this.balance.stageRents[this._stage - 1];
    if (rent === undefined) throw new Error(`STAGE ${this._stage} 월세가 설정되지 않았다.`);
    return rent;
  }

  get rentResult(): RentResult | null { return this._rentResult; }

  /** 데모에서 플레이 가능한 마지막 STAGE인지. 통과하면 다음 STAGE 대신 DEMO CLEAR로 간다. */
  get isFinalDemoStage(): boolean {
    return this._stage >= this.balance.finalDemoStage;
  }

  /** STAGE의 마지막 DAY 영업이 끝나 최종 정산을 기다리는 상태. */
  get isStageFinished(): boolean {
    return this._phase === 'Closed' && this._day >= this.balance.daysPerStage;
  }

  get canOpenShop(): boolean {
    return this._phase === 'BeforeOpen';
  }

  get canAdvanceToNextDay(): boolean {
    return this._phase === 'Closed' && !this.isStageFinished;
  }

  /** 영업 시작. BeforeOpen 에서만 가능하며 영업시간이 그때 채워진다. */
  openShop(): void {
    if (!this.canOpenShop) {
      throw new InvalidPhaseTransitionError(this._phase, '영업 시작');
    }
    this._phase = 'Open';
    this._remainingSeconds = this.balance.dayDurationSeconds + this.openingTimeBonusSeconds;
    this.openingTimeBonusSeconds = 0;
  }

  addOpeningTimeBonus(seconds: number): void {
    if (this._phase !== 'BeforeOpen') throw new InvalidPhaseTransitionError(this._phase, '영업시간 증량');
    if (!Number.isSafeInteger(seconds) || seconds <= 0) throw new RangeError('증량 시간은 양의 정수여야 한다.');
    this.openingTimeBonusSeconds += seconds;
  }

  addRemainingTime(seconds: number): void {
    if (this._phase !== 'Open') throw new InvalidPhaseTransitionError(this._phase, '영업시간 증량');
    if (!Number.isSafeInteger(seconds) || seconds <= 0) throw new RangeError('증량 시간은 양의 정수여야 한다.');
    this._remainingSeconds += seconds;
  }

  /**
   * 영업시간을 흘려보낸다. Open 이 아니면 아무 일도 하지 않는다
   * (매 프레임 호출되므로 오류가 아니라 무시한다).
   * 남은 시간이 0이 되면 자동으로 Closed 로 전이한다.
   */
  tick(deltaSeconds: number): void {
    if (this._phase !== 'Open') {
      return;
    }
    this._remainingSeconds = Math.max(0, this._remainingSeconds - deltaSeconds);
    if (this._remainingSeconds === 0) {
      this.closeShop();
    }
  }

  /**
   * 영업 종료. 시간이 0이 되면 tick 이 호출하고,
   * 개발용 즉시 종료 기능도 이 메서드를 쓴다.
   */
  closeShop(): void {
    if (this._phase !== 'Open') {
      throw new InvalidPhaseTransitionError(this._phase, '영업 종료');
    }
    this._phase = 'Closed';
    this._remainingSeconds = 0;
  }

  /** 다음 DAY 로 넘어간다. 마지막 DAY 에서는 거부된다. */
  advanceToNextDay(): void {
    if (this._phase !== 'Closed') {
      throw new InvalidPhaseTransitionError(this._phase, '다음 날 진행');
    }
    if (this.isStageFinished) {
      throw new InvalidPhaseTransitionError(
        this._phase,
        `마지막 DAY(${this.balance.daysPerStage}) 이후 다음 날 진행`,
      );
    }
    this._day += 1;
    this._phase = 'BeforeOpen';
    this._remainingSeconds = 0;
  }

  /** 마지막 DAY 종료 뒤 월세를 한 번만 판정하고 결과 Phase로 전환한다. */
  /**
   * STAGE 마감 정산. 월세를 낼 현금과 최소 실현 손익을 모두 채워야 통과한다.
   * 월세가 부족하면 현금을 차감하지 않는다.
   */
  settleRent(realizedProfit = 0): RentResult {
    if (!this.isStageFinished || this._rentResult !== null) {
      throw new InvalidPhaseTransitionError(this._phase, '월세 정산');
    }
    const rent = this.rentDue;
    const profitGoal = this.profitGoalDue;
    const moneyBefore = this._money;
    const canPayRent = moneyBefore >= rent;
    // 목표가 0 이하면 목표 없음으로 본다(적자 자체를 실패로 만들지 않는다).
    const metProfitGoal = profitGoal <= 0 || realizedProfit >= profitGoal;
    const success = canPayRent && metProfitGoal;
    if (success) this._money -= rent;
    this._rentResult = {
      success,
      rent,
      moneyBefore,
      moneyAfter: this._money,
      shortfall: canPayRent ? 0 : rent - moneyBefore,
      profitGoal,
      realizedProfit,
      failureReason: success ? null : (canPayRent ? 'profitGoal' : 'rent'),
    };
    this._phase = success
      ? (this._stage >= this.balance.finalDemoStage ? 'DemoClear' : 'StageResult')
      : 'GameOver';
    return { ...this._rentResult };
  }

  /** 월세 납부 성공 뒤 현금을 유지하며 다음 STAGE DAY 1로 이동한다. */
  advanceToNextStage(): void {
    if (this._phase !== 'StageResult' || !this._rentResult?.success) {
      throw new InvalidPhaseTransitionError(this._phase, '다음 STAGE 진행');
    }
    this._stage += 1;
    this._day = 1;
    this._phase = 'BeforeOpen';
    this._remainingSeconds = 0;
    this._rentResult = null;
  }

  /** DEV 전용: 현재 진행 상태와 무관하게 지정한 STAGE의 DAY 1 영업 전으로 이동한다. */
  setStageForDevelopment(stage: number): void {
    if (!Number.isSafeInteger(stage) || stage < 1 || stage > this.balance.finalDemoStage) {
      throw new RangeError('DEV STAGE는 유효한 범위의 정수여야 한다.');
    }
    this._stage = stage;
    this._day = 1;
    this._phase = 'BeforeOpen';
    this._remainingSeconds = 0;
    this._rentResult = null;
  }
}
