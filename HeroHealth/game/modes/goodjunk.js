// === Hero Health Academy — modes/goodjunk.js (aligned with A–D, missions-safe) ===
export const name = 'goodjunk';

// กลุ่มตัวอย่าง (อาหารดี/ขยะ) — ใช้ไอคอนเดิม
const GOOD = [
  { id:'apple',   labelEN:'Apple',    labelTH:'แอปเปิล',  icon:'🍎' },
  { id:'carrot',  labelEN:'Carrot',   labelTH:'แครอท',    icon:'🥕' },
  { id:'broccoli',labelEN:'Broccoli', labelTH:'บรอกโคลี', icon:'🥦' },
  { id:'rice',    labelEN:'Rice',     labelTH:'ข้าว',     icon:'🍚' },
  { id:'fish',    labelEN:'Fish',     labelTH:'ปลา',      icon:'🐟' },
  { id:'egg',     labelEN:'Egg',      labelTH:'ไข่',      icon:'🥚' },
  { id:'milk',    labelEN:'Milk',     labelTH:'นม',       icon:'🥛' },
];
const JUNK = [
  { id:'donut',   labelEN:'Donut',    labelTH:'โดนัท',    icon:'🍩' },
  { id:'burger',  labelEN:'Burger',   labelTH:'เบอร์เกอร์',icon:'🍔' },
  { id:'fries',   labelEN:'Fries',    labelTH:'เฟรนช์ฟรายส์', icon:'🍟' },
  { id:'soda',    labelEN:'Soda',     labelTH:'น้ำอัดลม', icon:'🥤' },
  { id:'candy',   labelEN:'Candy',    labelTH:'ลูกอม',    icon:'🍬' },
  { id:'cookie',  labelEN:'Cookie',   labelTH:'คุกกี้',   icon:'🍪' },
  { id:'pizza',   labelEN:'Pizza',    labelTH:'พิซซ่า',   icon:'🍕' },
];

const ST = {
  lang:'TH',
  needGood: 0, gotGood: 0,
  x2Until: 0,           // รองรับคะแนนคูณ 2 ชั่วคราว (ให้สอดคล้องกับ main.js)
};

export function init(gameState, hud, diff){
  ST.lang = localStorage.getItem('hha_lang') || 'TH';
  // เควสหลักของโหมดนี้คือ “เก็บของดี เลี่ยงของขยะ”
  // ไม่ต้องแสดง HUD พิเศษนอกเหนือจากคอมโบ/สกอร์
  ST.gotGood = 0;
  ST.needGood = (gameState?.difficulty==='Hard')? 20 : (gameState?.difficulty==='Easy'? 10 : 15);
}

export function cleanup(){}

export function tick(){ /* no-op */ }

export function pickMeta(diff){
  // ปรับสัดส่วนของดี:ขยะ ~ 60:40 ให้เล่นมันและทำเควสได้
  const isGood = Math.random() < 0.6;
  const pool = isGood ? GOOD : JUNK;
  const it = pool[(Math.random()*pool.length)|0];

  const golden = performance.now() < ST.x2Until;
  const mult = golden ? 2 : 1;

  const lifeBase = diff?.life || 3000;
  const life = Math.min(4500, Math.max(700, lifeBase)); // cap TTL ตามระบบรวม

  return {
    id: it.id,
    char: it.icon,
    good: isGood,
    mult,
    life,
    golden
  };
}

export function onHit(meta, systems){
  if (meta.good){
    ST.gotGood++;
    systems.coach?.say?.(t('เยี่ยม! อาหารดี', 'Great! Healthy pick', ST.lang));
    return 'good'; // คะแนนคูณอยู่ที่ main.js ผ่าน meta.mult
  }else{
    systems.coach?.say?.(t('ระวังของขยะ!', 'Careful, junk!', ST.lang));
    return 'bad';
  }
}

// Power durations ให้ main.js ใช้กับ UI บาร์ด้านซ้ายบน (แม้โหมดนี้จะไม่ใช้งานแม่เหล็ก)
export function getPowerDurations(){ return { x2:8, freeze:3, magnet:0 }; }
export const powers = {
  x2Target(){ ST.x2Until = performance.now() + 8000; },
  freezeTarget(){ /* main.js จัดการ freeze spawn โดยรวม */ },
  magnetNext(){ /* ไม่ใช้ใน goodjunk */ }
};

// utils
function t(th,en,lang){ return lang==='EN'?en:th; }
import { add3DTilt, shatter3D } from '/webxr-health-mobile/HeroHealth/game/core/fx.js';

export const fx = {
  onSpawn(el/*, state*/){
    add3DTilt(el);
  },
  onHit(x, y/*, meta, state*/){
    shatter3D(x, y);
  }
};
