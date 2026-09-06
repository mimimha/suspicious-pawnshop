import { describe, expect, it } from 'vitest';
import { ALL_ITEMS } from '@/config/tradeConfig';
import {
  copulaParticle, hasFinalConsonant, objectParticle, subjectParticle, topicParticle,
} from '@/text/koreanParticle';

describe('hasFinalConsonant', () => {
  it('받침이 있는 글자로 끝나면 true다', () => {
    ['고서적', '만년필', '앤티크 안경', '수첩'].forEach((word) => {
      expect(hasFinalConsonant(word)).toBe(true);
    });
  });

  it('받침이 없는 글자로 끝나면 false다', () => {
    ['빈티지 카메라', '회중시계', '구형 동전 세트', '오래된 라디오', '인장 반지']
      .forEach((word) => expect(hasFinalConsonant(word)).toBe(false));
  });

  it('숫자로 끝나면 읽는 소리를 기준으로 판단한다', () => {
    expect(hasFinalConsonant('1')).toBe(true);
    expect(hasFinalConsonant('2')).toBe(false);
  });
});

describe('조사 선택', () => {
  it('은/는, 이/가, 을/를, 이다를 받침에 맞춰 붙인다', () => {
    expect(topicParticle('고서적')).toBe('고서적은');
    expect(topicParticle('회중시계')).toBe('회중시계는');
    expect(subjectParticle('만년필')).toBe('만년필이');
    expect(subjectParticle('라디오')).toBe('라디오가');
    expect(objectParticle('앤티크 안경')).toBe('앤티크 안경을');
    expect(objectParticle('빈티지 카메라')).toBe('빈티지 카메라를');
    expect(copulaParticle('고서적')).toBe('고서적이');
    expect(copulaParticle('회중시계')).toBe('회중시계');
  });

  it('등장하는 모든 물건 이름에 대해 조사가 하나로 정해진다', () => {
    ALL_ITEMS.forEach((item) => {
      expect(topicParticle(item.name).startsWith(item.name)).toBe(true);
      expect(topicParticle(item.name).length).toBe(item.name.length + 1);
    });
  });
});
