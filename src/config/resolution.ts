/**
 * 해상도 관련 상수. 의존성이 없는 말단 모듈로 두어 gameConfig <-> Scene 순환 import 를 막는다.
 */

/** 게임 논리 해상도. 씬의 모든 좌표는 이 좌표계를 기준으로 한다. */
export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;

/** 렌더 배율의 상한. 이 이상 올려도 눈에 보이는 이득은 거의 없고 GPU 비용만 늘어난다. */
const MAX_RENDER_SCALE = 3;

/**
 * 캔버스 백킹스토어 배율.
 *
 * Phaser 의 FIT 스케일 모드는 캔버스를 CSS 로 늘릴 뿐 `canvas.width` 를 절대 바꾸지 않는다.
 * (`scale.zoom` 도 CSS 크기만 건드린다.) 그래서 게임을 1280x720 으로 띄우면 1920x1080
 * 모니터에서 1.5 배, DPR 2 인 고해상도 화면에서는 3 배로 확대돼 화면 전체가 뭉개진다.
 *
 * 이 배율만큼 백킹스토어를 키우고 카메라 zoom 으로 되돌려서
 * **논리 좌표계는 1280x720 그대로 유지**한다.
 *
 * 부팅 시점에 한 번만 계산한다. FIT 모드는 실행 중에 백킹스토어를 바꿀 수 없어서,
 * 창 크기가 바뀌어도 재계산하지 않는다. (그래도 기존 1 배 고정보다는 항상 낫다.)
 */
export const RENDER_SCALE = computeRenderScale();

function computeRenderScale(): number {
  if (typeof window === 'undefined') return 1;

  const pixelRatio = window.devicePixelRatio || 1;
  const aspect = GAME_WIDTH / GAME_HEIGHT;

  // FIT 은 종횡비를 유지하므로 실제로 그려지는 CSS 폭은 가로/세로 중 더 빡빡한 쪽이 정한다.
  const cssWidth = Math.min(window.innerWidth, window.innerHeight * aspect);
  const physicalWidth = cssWidth * pixelRatio;
  if (!Number.isFinite(physicalWidth) || physicalWidth <= 0) return 1;

  return Math.min(Math.max(physicalWidth / GAME_WIDTH, 1), MAX_RENDER_SCALE);
}
