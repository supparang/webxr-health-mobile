// === /vr/game-engine-goodjunk-vr.js ===
// ตัว adapter บาง ๆ สำหรับ GoodJunk VR
// ใช้ GameEngine เดิม แล้ว re-export เป็น GameEngineVR
// เพื่อให้ goodjunk-vr.html import ได้ถูกชื่อ

import { GameEngine } from './vr-goodjunk/GameEngine.js';

// ใช้ชื่อ GameEngineVR ตามที่ goodjunk-vr.html เรียก
export const GameEngineVR = GameEngine;

// เผื่อกรณีมีคนใช้ default import
export default GameEngineVR;
