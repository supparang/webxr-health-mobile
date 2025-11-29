// === /HeroHealth/vr-goodjunk/game-engine-goodjunk-vr.js ===
// Adapter บาง ๆ สำหรับ GoodJunk VR
// เอา GameEngine เดิมมา re-export เป็น GameEngineVR
// เพื่อให้ goodjunk-vr.html ใช้ชื่อเดียวกันเสมอ

// 👈 GameEngine.js อยู่ในโฟลเดอร์ /vr
import { GameEngine } from './GameEngine.js';

// ใช้ชื่อ GameEngineVR สำหรับโหมด VR
export const GameEngineVR = GameEngine;

// เผื่อมีคน import แบบ default
export default GameEngineVR;
