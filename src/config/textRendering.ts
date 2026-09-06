import Phaser from 'phaser';
import { RENDER_SCALE } from '@/config/resolution';

/**
 * Phaser 기본 텍스트 해상도는 1이라, 캔버스가 확대되면 글자 텍스처도 함께 늘어나 흐려진다.
 *
 * 캔버스 백킹스토어를 RENDER_SCALE 배로 키웠으므로 글자도 같은 배율로 구워야 1:1 로 맞는다.
 * 이보다 낮으면 흐려지고, 높으면 텍스처 메모리만 낭비된다.
 */
export const TEXT_RESOLUTION = RENDER_SCALE;

/** Phaser의 공식 확장 지점(GameObjectFactory.register)으로 text 팩토리 기본값만 바꾼다. */
export function registerCrispTextFactory(): void {
  Phaser.GameObjects.GameObjectFactory.register(
    'text',
    function registerText(
      this: Phaser.GameObjects.GameObjectFactory,
      x: number,
      y: number,
      text: string | string[],
      style?: Phaser.Types.GameObjects.Text.TextStyle,
    ) {
      return this.displayList.add(new Phaser.GameObjects.Text(
        this.scene, x, y, text, { resolution: TEXT_RESOLUTION, ...style },
      ));
    },
  );
}
