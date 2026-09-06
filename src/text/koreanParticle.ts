/**
 * 한글 조사 자동 선택.
 *
 * 손님 대사에 물건 이름을 끼워 넣을 때 받침 유무에 따라 은/는, 이/가, 을/를이 달라진다.
 * 대사마다 고정해 두면 물건이 바뀔 때 어색해지므로 이름을 보고 고른다.
 */
const HANGUL_FIRST = 0xac00;
const HANGUL_LAST = 0xd7a3;
const JONGSEONG_COUNT = 28;

/** 숫자를 한국어로 읽었을 때 받침이 있는지. 영(ㅇ) 일(ㄹ) 삼(ㅁ) 육(ㄱ) 칠(ㄹ) 팔(ㄹ). */
const DIGIT_HAS_FINAL: Record<string, boolean> = {
  0: true, 1: true, 2: false, 3: true, 4: false,
  5: false, 6: true, 7: true, 8: true, 9: false,
};

/** 마지막 글자에 받침이 있는지 본다. 판단할 수 없으면 없는 것으로 본다. */
export function hasFinalConsonant(word: string): boolean {
  const characters = [...word.trim()];
  const last = characters[characters.length - 1];
  if (last === undefined) return false;
  const code = last.codePointAt(0);
  if (code === undefined) return false;
  if (code >= HANGUL_FIRST && code <= HANGUL_LAST) {
    return (code - HANGUL_FIRST) % JONGSEONG_COUNT !== 0;
  }
  const digit = DIGIT_HAS_FINAL[last];
  return digit ?? false;
}

/** 받침 유무로 조사를 골라 붙인다. */
export function withParticle(word: string, whenFinal: string, whenNoFinal: string): string {
  return `${word}${hasFinalConsonant(word) ? whenFinal : whenNoFinal}`;
}

/** 은/는 */
export function topicParticle(word: string): string {
  return withParticle(word, '은', '는');
}

/** 이/가 */
export function subjectParticle(word: string): string {
  return withParticle(word, '이', '가');
}

/** 을/를 */
export function objectParticle(word: string): string {
  return withParticle(word, '을', '를');
}

/** 서술격 조사(이다 / 다). 받침이 없으면 붙이지 않는다. */
export function copulaParticle(word: string): string {
  return withParticle(word, '이', '');
}
