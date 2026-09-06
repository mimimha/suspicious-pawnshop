import Phaser from 'phaser';
import { DayScene } from '@/scenes/DayScene';
import { GAME_WIDTH, GAME_HEIGHT, RENDER_SCALE } from '@/config/resolution';

export const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game',
  // 논리 해상도가 아니라 실제로 렌더링할 픽셀 수. 카메라 zoom 이 좌표계를 되돌린다.
  width: GAME_WIDTH * RENDER_SCALE,
  height: GAME_HEIGHT * RENDER_SCALE,
  backgroundColor: '#1a1a1a',
  render: {
    antialias: true,
    powerPreference: 'high-performance',
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    expandParent: true,
    autoRound: true,
    resizeInterval: 100,
  },
  scene: [DayScene],
};
