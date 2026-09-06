import { describe, expect, it } from 'vitest';
import { CustomerProfileStore, trustDiscountRatioAdjustment } from '@/customer/customerProfile';
import { CUSTOMER_CONFIG, CUSTOMER_TYPE_BY_NAME } from '@/config/customerConfig';
import { CUSTOMER_NAMES } from '@/config/tradeConfig';

describe('CustomerProfileStore', () => {
  it('같은 이름의 유형과 신뢰도를 유지하고 0~100으로 제한한다', () => {
    const store = new CustomerProfileStore();
    const type = store.profile('민준').type;
    store.changeTrust('민준', 80);
    expect(store.profile('민준')).toMatchObject({ type, trust: 100 });
    store.changeTrust('민준', -200);
    expect(store.profile('민준').trust).toBe(0);
  });

  it.each([[10, -0.03], [30, -0.015], [50, 0], [70, 0.015], [90, 0.03]])(
    '신뢰도 %i의 할인율 보정은 %s다',
    (trust, adjustment) => expect(trustDiscountRatioAdjustment(trust)).toBe(adjustment),
  );
});

describe('손님 유형 배정', () => {
  it('등장하는 모든 이름에 유형이 지정돼 있다', () => {
    CUSTOMER_NAMES.forEach((name) => {
      expect(CUSTOMER_TYPE_BY_NAME[name], `${name} 유형 누락`).toBeDefined();
    });
  });

  it('네 유형이 모두 실제로 등장한다', () => {
    const store = new CustomerProfileStore();
    const types = new Set(CUSTOMER_NAMES.map((name) => store.profile(name).type));

    expect(types).toEqual(new Set(['honest', 'normal', 'suspicious', 'fraudster']));
  });

  it('공격 가능한 유형의 손님이 최소 한 명 이상 존재한다', () => {
    const store = new CustomerProfileStore();
    const prone = CUSTOMER_NAMES.filter(
      (name) => CUSTOMER_CONFIG.attackProneTypes.includes(store.profile(name).type),
    );

    expect(prone.length).toBeGreaterThan(0);
  });

  it('표에 없는 이름은 위험 가중치가 없는 유형으로 떨어진다', () => {
    const store = new CustomerProfileStore();

    expect(store.profile('DEV 손님').type).toBe('normal');
  });
});
