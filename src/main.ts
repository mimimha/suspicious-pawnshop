import '@/fonts.css';
import Phaser from 'phaser';
import { gameConfig } from '@/config/gameConfig';
import { registerCrispTextFactory } from '@/config/textRendering';

registerCrispTextFactory();
new Phaser.Game(gameConfig);
