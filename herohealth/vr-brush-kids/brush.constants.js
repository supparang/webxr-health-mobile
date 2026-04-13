// /herohealth/vr-brush-kids/brush.constants.js

export const GAME_ID = 'brush';
export const GAME_VARIANT = 'brush-v5';
export const GAME_TITLE = 'Brush V5: Mouth Rescue Adventure';
export const ZONE = 'hygiene';

export const SCENE_IDS = {
  launcher: 'launcher',
  intro: 'intro',
  scan: 'scan',
  guided: 'guided',
  pressure: 'pressure',
  fever: 'fever',
  bossBreak: 'bossBreak',
  boss: 'boss',
  finish: 'finish',
  summary: 'summary'
};

export const MODE_CONFIG = {
  learn: {
    id: 'learn',
    label: 'Learn',
    durationSec: 90,
    scanSec: 6,
    bossBreakSec: 8,
    targetScanCount: 2
  },
  adventure: {
    id: 'adventure',
    label: 'Adventure',
    durationSec: 90,
    scanSec: 5,
    bossBreakSec: 7,
    targetScanCount: 3
  },
  rescue: {
    id: 'rescue',
    label: 'Rescue',
    durationSec: 75,
    scanSec: 4,
    bossBreakSec: 6,
    targetScanCount: 3
  }
};

export const ZONE_DEFS = [
  { id: 'upper-left', label: 'บนซ้าย' },
  { id: 'upper-front', label: 'บนหน้า' },
  { id: 'upper-right', label: 'บนขวา' },
  { id: 'lower-left', label: 'ล่างซ้าย' },
  { id: 'lower-front', label: 'ล่างหน้า' },
  { id: 'lower-right', label: 'ล่างขวา' }
];

export const PATTERN_META = {
  horizontal: { label: 'ซ้าย ↔ ขวา' },
  vertical: { label: 'ขึ้น ↕ ลง' },
  circle: { label: 'วน ⟳ เป็นวง' }
};

export const COACH_LINES = {
  intro: ['คราบกำลังบุกแล้ว ไปช่วยฟันกัน!', 'เริ่มจากจุดอันตรายก่อนนะ'],
  scan: ['หาจุดสกปรกที่สุดให้เจอ', 'มองที่ขอบเหงือกและซอกฟัน'],
  guided: ['ค่อย ๆ แปรงตามทิศนะ', 'เยี่ยมเลย ทำตามลายให้ต่อเนื่อง'],
  pressure: ['หลายโซนเริ่มเสี่ยงแล้ว!', 'เลือกโซนให้ดีก่อนคราบลาม'],
  fever: ['สุดยอด! เข้า FEVER แล้ว!', 'รีบเก็บให้ได้มากที่สุด!'],
  bossBreak: ['ทำลายโล่ให้แตก!', 'แตะจุดอ่อนให้ครบ!'],
  boss: ['ตอนนี้แหละ รีบแปรงโจมตี!', 'บอสกำลังอ่อนแรง!'],
  finish: ['ช่วยทั้งปากสำเร็จแล้ว!', 'ฟันสะอาดสดใสสุด ๆ']
};

export const THREAT_RULES = {
  passiveRisePerSec: 3,
  cleanDropPerHit: 1.5,
  zoneIgnoredRisePerSec: 5
};

export const FEVER_RULES = {
  comboThreshold: 12,
  durationMs: 6000,
  cleanMultiplier: 1.5,
  scoreMultiplier: 2
};

export const SCORE_RULES = {
  patternHit: 10,
  zoneComplete: 100,
  scanHit: 50,
  scanSpecialHit: 100,
  bossBreakHit: 40,
  bossBreakPerfect: 200
};
