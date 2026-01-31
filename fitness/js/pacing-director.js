// === /fitness/js/pacing-director.js ===
// A-64 Anti-boredom pacing director: ensure "events" every 8–12s (play mode only)
'use strict';

import { pickBossMove } from './boss-moves.js';
import { buildStormPattern } from './pattern-gen.js';

function nowMs(){ return performance.now(); }
function rand(a,b){ return a + Math.random()*(b-a); }

export class PacingDirector {
  constructor(){
    this.nextEventAt = 0;
    this.eventGapMin = 8000;
    this.eventGapMax = 12000;
    this.lastEventName = '';
  }

  reset(){
    this.nextEventAt = nowMs() + rand(this.eventGapMin, this.eventGapMax);
    this.lastEventName = '';
  }

  // returns event object or null
  maybeTrigger(state){
    if (!state || !state.running) return null;
    if (state.mode !== 'play') return null; // research: ปิด pacing event
    const t = nowMs();
    if (t < this.nextEventAt) return null;

    // schedule next
    const phase = state.bossPhase || 1;
    const fatigue = state.perf?.fatigue ?? 0;
    const pMiss = state.ml?.lastPMiss ?? 0.12;

    // ถ้าเริ่มล้า/พลาดเยอะ → ลดโหด แต่ยังให้ "มีเหตุการณ์" แบบช่วยได้
    const soften = (fatigue >= 0.75 || pMiss >= 0.60);

    const gap = soften ? rand(9500, 13000) : rand(8000, 11500);
    this.nextEventAt = t + gap;

    // เลือก event type
    // 1) Boss move (signature) 2) Storm 3) Bonus (heal/shield)
    const roll = Math.random();

    // โบนัสช่วย (กันแตก) เมื่อ soften
    if (soften && roll < 0.55) {
      this.lastEventName = 'Support Bonus';
      return {
        type: 'bonus',
        name: 'Support Bonus',
        message: '✨ BONUS! โอกาสฟื้นตัว — เก็บ 🩹/🛡️ ให้ทัน!',
        spawnPlan: buildSupportBonusPlan(state)
      };
    }

    // Boss signature move
    if (roll < 0.58) {
      const mv = pickBossMove(state);
      if (mv) {
        this.lastEventName = mv.name;
        return { type: 'bossmove', ...mv };
      }
    }

    // Storm pattern
    this.lastEventName = 'Storm';
    return {
      type: 'storm',
      name: 'Storm',
      message: phase === 3
        ? '⚡ STORM+! เฟส 3 รัวเร็ว — อย่าหลงเป้าลวง!'
        : '⚡ STORM! เป้ามาเป็นชุด — ไล่ตามแพทเทิร์น!',
      spawnPlan: buildStormPlan(state)
    };
  }
}

function buildStormPlan(state){
  const phase = state.bossPhase || 1;
  const k = (phase === 1) ? 5 : (phase === 2 ? 6 : 7);
  const pts = buildStormPattern(k, state);
  const gap = phase === 3 ? 95 : 120;

  return pts.map((pos, i)=>{
    let kind = 'normal';
    const r = Math.random();
    if (phase === 3 && r < 0.12) kind = 'decoy';
    else if (phase === 3 && r < 0.18) kind = 'bomb';
    else if (r < 0.06 && (state.playerHp||1) < 0.55) kind = 'heal';
    else if (r < 0.10 && (state.shield||0) < 2) kind = 'shield';

    return { delayMs: i*gap, kind, pos, sizeMul: phase === 3 ? 0.86 : 0.96, storm: true };
  });
}

function buildSupportBonusPlan(state){
  const phase = state.bossPhase || 1;
  const k = phase === 3 ? 5 : 4;
  const pts = buildStormPattern(k, state);
  const gap = 140;

  return pts.map((pos, i)=>{
    // ส่วนใหญ่เป็น heal/shield + แทรก normal นิดเพื่อไม่ให้ชิลเกิน
    const r = Math.random();
    let kind = 'heal';
    if (r < 0.45) kind = 'heal';
    else if (r < 0.85) kind = 'shield';
    else kind = 'normal';

    return { delayMs: i*gap, kind, pos, sizeMul: 1.0, storm: true };
  });
}