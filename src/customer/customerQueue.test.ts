import { describe, expect, it } from 'vitest';
import { CustomerQueue, type CustomerQueueConfig } from '@/customer/customerQueue';
import { customerQueueConfigForStage } from '@/config/customerQueueConfig';

const CONFIG: CustomerQueueConfig = {
  minimumCustomersPerDay: 4,
  maximumCustomersPerDay: 5,
  delayBetweenCustomersSeconds: 2,
};

describe('CustomerQueue', () => {
  it('STAGE 1은 5명, STAGE 2는 6명으로 하루 방문 수를 고정한다', () => {
    const stageOne = new CustomerQueue(customerQueueConfigForStage(1));
    const stageTwo = new CustomerQueue(customerQueueConfigForStage(2));
    stageOne.startDay();
    stageTwo.startDay();
    expect(stageOne.targetCount).toBe(5);
    expect(stageTwo.targetCount).toBe(6);
  });

  it('난수 경계에 따라 하루 목표를 4명 또는 5명으로 정한다', () => {
    expect(new CustomerQueue(CONFIG, () => 0).startDay()).toBeUndefined();
    const four = new CustomerQueue(CONFIG, () => 0);
    four.startDay();
    const five = new CustomerQueue(CONFIG, () => 0.999999);
    five.startDay();
    expect(four.targetCount).toBe(4);
    expect(five.targetCount).toBe(5);
  });

  it('첫 손님은 즉시, 다음 손님은 처리 후 대기시간이 지나야 받는다', () => {
    const queue = new CustomerQueue(CONFIG, () => 0);
    queue.startDay();
    expect(queue.takeNextCustomer()).toBe(true);
    expect(queue.takeNextCustomer()).toBe(false);
    expect(queue.completeActiveCustomer()).toBe(true);
    expect(queue.processedCount).toBe(1);
    expect(queue.takeNextCustomer()).toBe(false);
    queue.tick(1.9);
    expect(queue.takeNextCustomer()).toBe(false);
    queue.tick(0.1);
    expect(queue.takeNextCustomer()).toBe(true);
  });

  it('성사·결렬·거절처럼 호출 원인과 무관하게 활성 손님을 한 번만 처리한다', () => {
    const queue = new CustomerQueue(CONFIG, () => 0);
    queue.startDay();
    queue.takeNextCustomer();
    expect(queue.completeActiveCustomer()).toBe(true);
    expect(queue.completeActiveCustomer()).toBe(false);
    expect(queue.processedCount).toBe(1);
  });

  it('목표 수보다 많은 손님을 등장시키지 않는다', () => {
    const queue = new CustomerQueue(CONFIG, () => 0);
    queue.startDay();
    for (let index = 0; index < 4; index += 1) {
      expect(queue.takeNextCustomer()).toBe(true);
      queue.completeActiveCustomer();
      queue.skipWait();
    }
    expect(queue.appearedCount).toBe(4);
    expect(queue.processedCount).toBe(4);
    expect(queue.takeNextCustomer()).toBe(false);
    expect(queue.hasRemainingCustomers).toBe(false);
  });

  it('영업 종료 후 진행 손님을 집계하지 않고 추가 등장도 막는다', () => {
    const queue = new CustomerQueue(CONFIG, () => 0);
    queue.startDay();
    queue.takeNextCustomer();
    queue.stopDay();
    expect(queue.completeActiveCustomer()).toBe(false);
    expect(queue.processedCount).toBe(0);
    expect(queue.takeNextCustomer()).toBe(false);
  });

  it('다음 DAY 시작 시 목표와 진행 상태를 새로 초기화한다', () => {
    let random = 0;
    const queue = new CustomerQueue(CONFIG, () => random);
    queue.startDay();
    queue.takeNextCustomer();
    queue.completeActiveCustomer();
    random = 0.999999;
    queue.startDay();
    expect(queue.targetCount).toBe(5);
    expect(queue.appearedCount).toBe(0);
    expect(queue.processedCount).toBe(0);
    expect(queue.waitingSeconds).toBe(0);
    expect(queue.takeNextCustomer()).toBe(true);
  });
});
