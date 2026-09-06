import { describe, it, expect } from 'vitest';
import { GameState, InvalidPhaseTransitionError } from '@/state/gameState';
import { GAME_BALANCE, type GameBalance } from '@/config/gameBalance';

/** 테스트용 밸런스. 실제 값과 다르게 두어 config 가 실제로 참조되는지 확인한다. */
const TEST_BALANCE: GameBalance = {
  daysPerStage: 3,
  dayDurationSeconds: 10,
  startingMoney: 1_234,
  stageRents: [1_000, 2_000],
  stageProfitGoals: [0, 0],
  finalDemoStage: 2,
};

/** 해당 DAY 의 영업을 끝내고 Closed 상태로 만든다. */
function playThroughDay(state: GameState): void {
  state.openShop();
  state.tick(state.remainingSeconds);
}

describe('GameState 초기 상태', () => {
  it('영업 전 시간 보너스를 한 번 적용한다', () => {
    const state = new GameState(TEST_BALANCE);
    state.addOpeningTimeBonus(30);
    state.openShop();
    expect(state.remainingSeconds).toBe(TEST_BALANCE.dayDurationSeconds + 30);
  });

  it('영업 중 남은 시간을 즉시 늘린다', () => {
    const state = new GameState(TEST_BALANCE);
    state.openShop();
    state.tick(3);
    state.addRemainingTime(30);
    expect(state.remainingSeconds).toBe(TEST_BALANCE.dayDurationSeconds - 3 + 30);
  });

  it('STAGE 1, DAY 1, BeforeOpen 으로 시작한다', () => {
    const state = new GameState(TEST_BALANCE);

    expect(state.stage).toBe(1);
    expect(state.day).toBe(1);
    expect(state.phase).toBe('BeforeOpen');
  });

  it('시작 자금은 config 의 startingMoney 다', () => {
    expect(new GameState(TEST_BALANCE).money).toBe(TEST_BALANCE.startingMoney);
  });

  it('기본 생성자는 GAME_BALANCE 를 사용한다', () => {
    const state = new GameState();

    expect(state.money).toBe(GAME_BALANCE.startingMoney);
    expect(state.daysPerStage).toBe(GAME_BALANCE.daysPerStage);
  });

  it('영업 전에는 남은 영업시간이 0이다', () => {
    expect(new GameState(TEST_BALANCE).remainingSeconds).toBe(0);
  });
});

describe('GameState DEV 전환', () => {
  it('현재 DAY·phase와 무관하게 STAGE 2 DAY 1 영업 전으로 이동한다', () => {
    const state = new GameState(TEST_BALANCE);
    state.openShop();
    state.tick(3);

    state.setStageForDevelopment(2);

    expect(state.stage).toBe(2);
    expect(state.day).toBe(1);
    expect(state.phase).toBe('BeforeOpen');
    expect(state.rentResult).toBeNull();
  });
});

describe('자금 사용', () => {
  it('유효한 금액을 정확히 차감한다', () => {
    const state = new GameState(TEST_BALANCE);
    state.spendMoney(234);
    expect(state.money).toBe(1_000);
  });

  it.each([-1, 1.5, TEST_BALANCE.startingMoney + 1])('잘못된 사용 금액 %s를 거부한다', (amount) => {
    const state = new GameState(TEST_BALANCE);
    expect(() => state.spendMoney(amount)).toThrow(RangeError);
    expect(state.money).toBe(TEST_BALANCE.startingMoney);
  });
});

describe('판매 수익', () => {
  it('유효한 판매 수익을 현금에 더한다', () => {
    const state = new GameState(TEST_BALANCE);
    state.earnMoney(766);
    expect(state.money).toBe(2_000);
  });

  it.each([-1, 1.5])('잘못된 수익 %s를 거부한다', (amount) => {
    expect(() => new GameState(TEST_BALANCE).earnMoney(amount)).toThrow(RangeError);
  });
});

describe('Phase 전이', () => {
  it('BeforeOpen 에서 영업을 시작하면 Open 이 되고 영업시간이 채워진다', () => {
    const state = new GameState(TEST_BALANCE);

    state.openShop();

    expect(state.phase).toBe('Open');
    expect(state.remainingSeconds).toBe(TEST_BALANCE.dayDurationSeconds);
  });

  it('Open 에서 시간이 0이 되면 자동으로 Closed 가 된다', () => {
    const state = new GameState(TEST_BALANCE);
    state.openShop();

    state.tick(TEST_BALANCE.dayDurationSeconds);

    expect(state.phase).toBe('Closed');
    expect(state.remainingSeconds).toBe(0);
  });

  it('영업시간이 남아 있으면 Open 을 유지한다', () => {
    const state = new GameState(TEST_BALANCE);
    state.openShop();

    state.tick(TEST_BALANCE.dayDurationSeconds - 1);

    expect(state.phase).toBe('Open');
  });
});

describe('영업시간 타이머', () => {
  it('Open 에서만 시간이 흐른다', () => {
    const state = new GameState(TEST_BALANCE);

    state.tick(5);
    expect(state.remainingSeconds).toBe(0);
    expect(state.phase).toBe('BeforeOpen');

    state.openShop();
    state.tick(4);
    expect(state.remainingSeconds).toBe(TEST_BALANCE.dayDurationSeconds - 4);
  });

  it('남은 시간은 0 아래로 내려가지 않는다', () => {
    const state = new GameState(TEST_BALANCE);
    state.openShop();

    state.tick(TEST_BALANCE.dayDurationSeconds * 10);

    expect(state.remainingSeconds).toBe(0);
  });

  it('Closed 가 된 뒤에는 tick 이 상태를 바꾸지 않는다', () => {
    const state = new GameState(TEST_BALANCE);
    playThroughDay(state);

    state.tick(100);

    expect(state.phase).toBe('Closed');
    expect(state.day).toBe(1);
  });
});

describe('잘못된 전이 거부', () => {
  it('BeforeOpen 에서 바로 영업 종료할 수 없다', () => {
    const state = new GameState(TEST_BALANCE);

    expect(() => state.closeShop()).toThrow(InvalidPhaseTransitionError);
  });

  it('BeforeOpen 에서 다음 날로 넘어갈 수 없다', () => {
    const state = new GameState(TEST_BALANCE);

    expect(() => state.advanceToNextDay()).toThrow(InvalidPhaseTransitionError);
  });

  it('Open 에서 다시 영업을 시작할 수 없다', () => {
    const state = new GameState(TEST_BALANCE);
    state.openShop();

    expect(() => state.openShop()).toThrow(InvalidPhaseTransitionError);
  });

  it('Open 에서 다음 날로 넘어갈 수 없다', () => {
    const state = new GameState(TEST_BALANCE);
    state.openShop();

    expect(() => state.advanceToNextDay()).toThrow(InvalidPhaseTransitionError);
  });

  it('Closed 에서 영업을 다시 시작하거나 종료할 수 없다', () => {
    const state = new GameState(TEST_BALANCE);
    playThroughDay(state);

    expect(() => state.openShop()).toThrow(InvalidPhaseTransitionError);
    expect(() => state.closeShop()).toThrow(InvalidPhaseTransitionError);
  });
});

describe('DAY 진행', () => {
  it('Closed 에서 다음 날로 넘어가면 DAY 가 1 증가하고 BeforeOpen 이 된다', () => {
    const state = new GameState(TEST_BALANCE);
    playThroughDay(state);

    state.advanceToNextDay();

    expect(state.day).toBe(2);
    expect(state.phase).toBe('BeforeOpen');
    expect(state.remainingSeconds).toBe(0);
  });

  it('DAY 1 → 2 → 3 으로 증가한다', () => {
    const state = new GameState(TEST_BALANCE);

    playThroughDay(state);
    state.advanceToNextDay();
    playThroughDay(state);
    state.advanceToNextDay();

    expect(state.day).toBe(TEST_BALANCE.daysPerStage);
    expect(state.phase).toBe('BeforeOpen');
  });

  it('전체 사이클을 돌아도 STAGE 와 money 는 그대로다', () => {
    const state = new GameState(TEST_BALANCE);

    playThroughDay(state);
    state.advanceToNextDay();
    playThroughDay(state);

    expect(state.stage).toBe(1);
    expect(state.money).toBe(TEST_BALANCE.startingMoney);
  });
});

describe('마지막 DAY 경계', () => {
  /** 마지막 DAY 의 영업까지 끝낸 상태로 만든다. */
  function playToLastDayClosed(): GameState {
    const state = new GameState(TEST_BALANCE);
    for (let day = 1; day < TEST_BALANCE.daysPerStage; day += 1) {
      playThroughDay(state);
      state.advanceToNextDay();
    }
    playThroughDay(state);
    return state;
  }

  it('마지막 DAY 영업 종료 시 STAGE 종료 상태가 된다', () => {
    const state = playToLastDayClosed();

    expect(state.day).toBe(TEST_BALANCE.daysPerStage);
    expect(state.phase).toBe('Closed');
    expect(state.isStageFinished).toBe(true);
    expect(state.canAdvanceToNextDay).toBe(false);
  });

  it('마지막 DAY 에서는 다음 날로 진행할 수 없다', () => {
    const state = playToLastDayClosed();

    expect(() => state.advanceToNextDay()).toThrow(InvalidPhaseTransitionError);
    expect(state.day).toBe(TEST_BALANCE.daysPerStage);
  });

  it('마지막 DAY 이전에는 STAGE 종료가 아니다', () => {
    const state = new GameState(TEST_BALANCE);
    playThroughDay(state);

    expect(state.isStageFinished).toBe(false);
    expect(state.canAdvanceToNextDay).toBe(true);
  });
});

describe('월세와 STAGE 결과', () => {
  function playToLastDayClosed(state = new GameState(TEST_BALANCE)): GameState {
    for (let day = 1; day < TEST_BALANCE.daysPerStage; day += 1) {
      playThroughDay(state);
      state.advanceToNextDay();
    }
    playThroughDay(state);
    return state;
  }

  it('현금이 충분하면 월세를 차감하고 STAGE 성공 결과를 만든다', () => {
    const state = playToLastDayClosed();
    const result = state.settleRent();
    expect(result).toEqual({
      success: true, rent: 1_000, moneyBefore: 1_234, moneyAfter: 234, shortfall: 0,
      profitGoal: 0, realizedProfit: 0, failureReason: null,
    });
    expect(state.money).toBe(234);
    expect(state.phase).toBe('StageResult');
    expect(() => state.settleRent()).toThrow(InvalidPhaseTransitionError);
  });

  it('현금이 부족하면 차감하지 않고 부족액과 GAME OVER를 만든다', () => {
    const state = new GameState(TEST_BALANCE);
    state.spendMoney(300);
    playToLastDayClosed(state);
    const result = state.settleRent();
    expect(result.success).toBe(false);
    expect(result.shortfall).toBe(66);
    expect(state.money).toBe(934);
    expect(state.phase).toBe('GameOver');
  });

  it('아무 거래도 하지 않으면 STAGE 1 최소 실현 손익 목표에서 막힌다', () => {
    const state = new GameState();
    for (let day = 1; day < GAME_BALANCE.daysPerStage; day += 1) {
      playThroughDay(state);
      state.advanceToNextDay();
    }
    playThroughDay(state);
    // 시작 자금은 STAGE 1 월세보다 많지만, 장사로 남긴 것이 없으면 통과하지 못한다.
    expect(state.money).toBeGreaterThanOrEqual(state.rentDue);
    expect(state.profitGoalDue).toBeGreaterThan(0);
    const result = state.settleRent(0);
    expect(result.success).toBe(false);
    expect(result.failureReason).toBe('profitGoal');
    expect(state.phase).toBe('GameOver');
  });

  it('STAGE 1 성공 뒤 현금을 유지하고 STAGE 2 DAY 1로 이동한다', () => {
    const state = playToLastDayClosed();
    state.settleRent();
    state.advanceToNextStage();
    expect(state.stage).toBe(2);
    expect(state.day).toBe(1);
    expect(state.phase).toBe('BeforeOpen');
    expect(state.money).toBe(234);
    expect(state.rentDue).toBe(2_000);
    expect(state.rentResult).toBeNull();
  });

  it('STAGE 2 성공은 STAGE 3 대신 DEMO CLEAR로 끝난다', () => {
    const state = playToLastDayClosed();
    state.settleRent();
    state.advanceToNextStage();
    state.earnMoney(2_000);
    playToLastDayClosed(state);
    state.settleRent();
    expect(state.stage).toBe(2);
    expect(state.phase).toBe('DemoClear');
    expect(() => state.advanceToNextStage()).toThrow(InvalidPhaseTransitionError);
  });

  it('마지막 DAY 종료 전에는 월세를 정산할 수 없다', () => {
    expect(() => new GameState(TEST_BALANCE).settleRent()).toThrow(InvalidPhaseTransitionError);
  });
});

describe('STAGE 최소 실현 손익 목표', () => {
  const goalBalance = { ...TEST_BALANCE, stageProfitGoals: [3_000, 0] };

  const playToStageEnd = (balance = goalBalance) => {
    const state = new GameState(balance);
    for (let day = 1; day < balance.daysPerStage; day += 1) {
      playThroughDay(state);
      state.advanceToNextDay();
    }
    playThroughDay(state);
    return state;
  };

  it('월세를 낼 수 있어도 목표 손익에 못 미치면 실패한다', () => {
    const state = playToStageEnd();
    const result = state.settleRent(2_900);
    expect(result.success).toBe(false);
    expect(result.failureReason).toBe('profitGoal');
    expect(result.profitGoal).toBe(3_000);
    expect(result.realizedProfit).toBe(2_900);
    expect(state.phase).toBe('GameOver');
    // 실패했으면 월세를 걷지 않는다.
    expect(state.money).toBe(result.moneyBefore);
  });

  it('목표 손익을 채우면 통과하고 월세를 차감한다', () => {
    const state = playToStageEnd();
    const result = state.settleRent(3_000);
    expect(result.success).toBe(true);
    expect(result.failureReason).toBe(null);
    expect(state.money).toBe(result.moneyBefore - result.rent);
  });

  it('목표가 0인 STAGE는 손익과 무관하게 월세만 본다', () => {
    const state = playToStageEnd({ ...goalBalance, stageProfitGoals: [0, 0] });
    const result = state.settleRent(-50_000);
    expect(result.success).toBe(true);
    expect(result.profitGoal).toBe(0);
  });

  it('현금이 부족하면 목표를 채워도 월세 실패로 표시한다', () => {
    const state = playToStageEnd({ ...goalBalance, stageRents: [999_999, 999_999] });
    const result = state.settleRent(10_000);
    expect(result.success).toBe(false);
    expect(result.failureReason).toBe('rent');
  });
});

describe('STAGE 목표 밸런스', () => {
  it('월세 합이 시작 자금보다 커서 무거래로는 데모를 통과할 수 없다', () => {
    const rentTotal = GAME_BALANCE.stageRents
      .slice(0, GAME_BALANCE.finalDemoStage)
      .reduce((total, rent) => total + rent, 0);

    expect(rentTotal).toBeGreaterThan(GAME_BALANCE.startingMoney);
  });

  it('모든 STAGE가 무거래 통과를 막는 최소 실현 손익 목표를 갖는다', () => {
    // 목표가 0인 STAGE는 앞 STAGE에서 벌어 둔 이월 자금만으로 통과할 수 있다.
    GAME_BALANCE.stageProfitGoals.slice(0, GAME_BALANCE.finalDemoStage)
      .forEach((goal, index) => {
        expect(goal, `STAGE ${index + 1} 손익 목표`).toBeGreaterThan(0);
      });
  });

  it('뒤 STAGE의 손익 목표가 앞 STAGE보다 높다', () => {
    const goals = GAME_BALANCE.stageProfitGoals.slice(0, GAME_BALANCE.finalDemoStage);
    goals.forEach((goal, index) => {
      if (index === 0) return;
      expect(goal).toBeGreaterThan(goals[index - 1]!);
    });
  });

  it('마지막 STAGE만 최종 STAGE로 표시된다', () => {
    const state = new GameState();

    expect(state.isFinalDemoStage).toBe(false);
    state.setStageForDevelopment(GAME_BALANCE.finalDemoStage);
    expect(state.isFinalDemoStage).toBe(true);
  });

  it('STAGE 2도 손익 목표에서 막힐 수 있다', () => {
    const state = new GameState();
    state.setStageForDevelopment(2);
    for (let day = 1; day < GAME_BALANCE.daysPerStage; day += 1) {
      playThroughDay(state);
      state.advanceToNextDay();
    }
    playThroughDay(state);

    const result = state.settleRent(state.profitGoalDue - 100);
    expect(result.success).toBe(false);
    expect(result.failureReason).toBe('profitGoal');
  });
});

