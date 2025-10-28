// === Hero Health Academy — modes/hydration.js (clamp delta/sec + lowCount + first tooltips) ===
import { Quests } from '/webxr-health-mobile/HeroHealth/game/core/quests.js';

const ZONES = { LOW:'LOW', OK:'OK', HIGH:'HIGH' };
const MAX_DELTA_PER_TICK = 8;

function clamp(n,a,b){ return Math.max(a, Math.min(b, n)); }
function zoneOf(level, minOK, maxOK){
  if (level < minOK) return ZONES.LOW;
  if (level > maxOK) return ZONES.HIGH;
  return ZONES.OK;
}

let _hinted = false;

function tooltipOnce(msg){
  if (_hinted) return;
  _hinted = true;
  let el = document.getElementById('toast'); if (!el){ el = document.createElement('div'); el.id='toast'; el.className='toast'; document.body.appendChild(el); }
  el.textContent = msg; el.classList.add('show'); setTimeout(()=>el.classList.remove('show'), 1200);
}

export function init(state, hud, diff){
  state.hydTotalTime = diff.time|0;
  state.hyd = 50; state.hydMin = 35; state.hydMax = 65; state.hydDecay = 0.25;
  state._hydPrevZone = zoneOf(state.hyd, state.hydMin, state.hydMax);
  state.highCount = 0; state.lowCount = 0;
  _hinted = false;

  ensureHUD(); hud.showHydration?.(); render(state);
}

export function cleanup(state,hud){ hud.hideHydration?.(); }

function ensureHUD(){ /* (เหมือนเวอร์ชันก่อนของคุณ) */ }
function render(state){ /* (เหมือนเวอร์ชันก่อนของคุณ) */ }

export function pickMeta(diff,state){
  const r = Math.random();
  if (r < 0.55) return { id:'water',  char:'💧', aria:'Water', good:true,  life: diff.life };
  if (r < 0.85) return { id:'sweet',  char:'🧃', aria:'Sweet drink', good:false, life: diff.life };
  if (r < 0.95) return { id:'ice',    char:'🧊', aria:'Ice (cooldown)', good:true,  life: diff.life, booster:true };
  return                { id:'gold',  char:'⭐', aria:'Golden', good:true, life: diff.life, golden:true };
}

export function onHit(meta, sys, state, hud){
  const before = state.hyd; const beforeZone = zoneOf(before, state.hydMin, state.hydMax);
  if (meta.id==='water'){
    const z = beforeZone; let delta = (z===ZONES.HIGH ? +2 : +6);
    state.hyd = clamp(before + delta, 0, 100);
    tooltipOnce('💧 น้ำเปล่า: ช่วยขึ้น (ถ้า “มากไป” ขึ้นช้า)');
  }else if (meta.id==='sweet'){
    const z = beforeZone; let delta = (z===ZONES.HIGH ? -8 : z===ZONES.OK ? -3 : +4);
    state.hyd = clamp(before + delta, 0, 100);
    tooltipOnce('🧃 น้ำหวาน: ใช้ลดตอน “มากไป” (ถ้าต่ำอยู่จะยิ่งแย่)');
  }else if (meta.id==='ice'){
    state.hydDecayBoostUntil = performance.now() + 5000;
    state.hydDecay = 0.1;
  }else if (meta.id==='gold'){
    if (before < state.hydMin) state.hyd = clamp(before + 10, 0, 100);
    else if (before > state.hydMax) state.hyd = clamp(before - 10, 0, 100);
    else state.hyd = clamp(before + 6, 0, 100);
  }

  Quests.event('hydro_click', { zoneBefore: beforeZone, kind: meta.id==='sweet'?'sweet':'water' });

  const afterZone = zoneOf(state.hyd, state.hydMin, state.hydMax);
  if (afterZone === ZONES.OK) return meta.golden?'perfect':'good';
  else if (beforeZone!==afterZone && afterZone!==ZONES.OK) return 'bad';
  return 'ok';
}

export function tick(state, sys, hud){
  const now = performance.now();
  if (state.hydDecayBoostUntil && now > state.hydDecayBoostUntil){ state.hydDecayBoostUntil = 0; state.hydDecay = 0.25; }

  const before = state.hyd;
  state.hyd = clamp(state.hyd - state.hydDecay, 0, 100);
  // limit swing per tick
  const swing = state.hyd - before;
  if (Math.abs(swing) > MAX_DELTA_PER_TICK){
    state.hyd = before + (swing>0?+1:-1)*MAX_DELTA_PER_TICK;
  }

  const z = zoneOf(state.hyd, state.hydMin, state.hydMax);
  Quests.event('hydro_tick', { level: state.hyd, zone: (z===ZONES.OK?'OK':z) });

  if (z !== state._hydPrevZone){
    Quests.event('hydro_cross', { from: state._hydPrevZone, to: (z===ZONES.OK?'OK':z) });
    if (z===ZONES.HIGH) state.highCount++;
    if (z===ZONES.LOW)  state.lowCount++;
    state._hydPrevZone = z;
  }

  if (z!=='OK' && hud?.dimPenalty){ hud.dimPenalty(); }

  render(state);
}
