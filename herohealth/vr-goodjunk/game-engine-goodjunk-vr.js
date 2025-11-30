// === /herohealth/vr-goodjunk/game-engine-goodjunk-vr.js ===
// Adapter สำหรับ Good vs Junk VR ให้ goodjunk-vr.html เรียกใช้ง่าย ๆ

'use strict';

// ใช้ GameEngine ตัวหลักจากไฟล์ GameEngine.js ในโฟลเดอร์เดียวกัน
import { GameEngine } from './GameEngine.js';

export const GameEngineVR = {
  start(diff) {
    // diff: 'easy' | 'normal' | 'hard'
    GameEngine.start(diff || 'normal');
  },
  stop() {
    GameEngine.stop();
  }
};

export default GameEngineVR;
