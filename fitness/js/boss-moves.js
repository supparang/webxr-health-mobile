// === /fitness/js/boss-moves.js ===
// A-64 Boss Signature Moves (pattern scripts)
'use strict';

import { buildStormPattern } from './pattern-gen.js';

function rand(a,b){ return a + Math.random()*(b-a); }
function pick(arr){ return arr[Math.floor(Math.random()*arr.length)]; }

export function pickBossMove(state){
  const bossId = state?.bossIndex ?? 0;
  const phase = state?.bossPhase ?? 1;

  // โอกาส “ท่าไม้ตาย” ต่อเหตุการณ์ (ไม่ใช่ทุก spawn)
  // phase 3 จะเจอบ่อยขึ้น
  const p = phase === 1 ? 0.35 : (phase === 2 ? 0.48 : 0.62);
  if (Math.random() > p) return null;

  // บอสลายเซ็น
  if (bossId === 0) return moveBubbleGlove(state);
  if (bossId === 1) return moveSparkGuard(state);
  if (bossId === 2) return moveShadowMitt(state);
  return moveGalaxyPunch(state);
}

// --- Boss 0: Bubble Glove ---
// จุดเด่น: “ฟองใหญ่ → ฟองเล็กเป็นชุด” (สอนให้จับแพทเทิร์น)
function moveBubbleGlove(state){
  const phase = state.bossPhase || 1;
  const k = phase === 1 ? 5 : (phase === 2 ? 6 : 7);
  const pts = buildStormPattern(k, state);
  return {
    name: 'Bubble Wave',
    message: '🫧 BUBBLE WAVE! ฟองมาเป็นคลื่น — ไล่ตามแนวโค้ง!',
    spawns: pts.map((pos, i)=>({
      delayMs: i * (phase === 3 ? 90 : 110),
      kind: 'normal',
      pos,
      sizeMul: phase === 1 ? 1.05 : (phase === 2 ? 0.95 : 0.88)
    }))
  };
}

// --- Boss 1: Spark Guard ---
// จุดเด่น: “สายฟ้า + ระเบิดหลอก” ให้คนตัดสินใจเร็ว
function moveSparkGuard(state){
  const phase = state.bossPhase || 1;
  const k = phase === 1 ? 5 : 6;
  const pts = buildStormPattern(k, state);
  return {
    name: 'Spark Trap',
    message: '⚡ SPARK TRAP! มีลูกหลอกแทรก — อย่าตีสีแดงมั่ว!',
    spawns: pts.map((pos, i)=>{
      const roll = Math.random();
      let kind = 'normal';
      // แทรก bomb/decoy ให้รู้สึก “ต้องคิด”
      if (phase >= 2 && roll < 0.16) kind = 'decoy';
      if (phase === 3 && roll < 0.12) kind = 'bomb';
      return {
        delayMs: i * (phase === 3 ? 95 : 120),
        kind,
        pos,
        sizeMul: phase === 3 ? 0.88 : 0.96
      };
    })
  };
}

// --- Boss 2: Shadow Mitt ---
// จุดเด่น: “เงา/ลวง” สลับ normal กับ decoy เป็นจังหวะ
function moveShadowMitt(state){
  const phase = state.bossPhase || 1;
  const k = phase === 1 ? 6 : (phase === 2 ? 7 : 8);
  const pts = buildStormPattern(k, state);
  return {
    name: 'Shadow Swap',
    message: '🕶️ SHADOW SWAP! เป้าลวงสลับจริง — ดูจังหวะก่อนตี!',
    spawns: pts.map((pos, i)=>{
      const kind = (i % 3 === 2 && phase >= 2) ? 'decoy' : 'normal';
      return {
        delayMs: i * (phase === 3 ? 90 : 110),
        kind,
        pos,
        sizeMul: phase === 3 ? 0.84 : 0.92
      };
    })
  };
}

// --- Boss 3: Galaxy Punch ---
// จุดเด่น: “Galaxy Burst” เร็ว + เล็ก + รัวสั้น ๆ
function moveGalaxyPunch(state){
  const phase = state.bossPhase || 1;
  const k = phase === 1 ? 6 : (phase === 2 ? 7 : 9);
  const pts = buildStormPattern(k, state);
  return {
    name: 'Galaxy Burst',
    message: '🌌 GALAXY BURST! รัวเร็วมาก — ตีทันทีที่เห็น!',
    spawns: pts.map((pos, i)=>{
      // phase 3 แทรก bomb นิด ๆ ให้ลุ้น
      let kind = 'normal';
      const r = Math.random();
      if (phase === 3 && r < 0.10) kind = 'bomb';
      else if (phase === 3 && r < 0.18) kind = 'decoy';
      return {
        delayMs: i * (phase === 3 ? 80 : 100),
        kind,
        pos,
        sizeMul: phase === 3 ? 0.78 : 0.86
      };
    })
  };
}