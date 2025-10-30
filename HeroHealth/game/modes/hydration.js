// === Hero Health Academy — game/modes/hydration.js (2025-10-30, synced)
// - Relative imports -> ../core/*
// - Gauge play: keep needle in OK zone; click items to adjust
// - Quest/Progress events: hydro_tick, hydro_cross, hydro_click, hydration_high
// - Fair expiry miss (only if item would've helped), FX tilt/shatter
// - Factory adapter for main.js DOM-spawn flow (DOM buttons under #spawnHost)

import { Progress } from '../core/progression.js';
import { Quests   } from '../core/quests.js';

export const name = 'hydration';

// ---------- Safe FX bootstrap ----------
(function ensureFX(){
  if (!window.HHA_FX) {
    window.HHA_FX = { add3DTilt: ()=>{}, shatter3D: ()=>{} };
    (async () => {
      try {
        const m = await import('../core/fx.js').catch(()=>null);
        if (m) Object.assign(window.HHA_FX, m);
      } catch {}
    })();
  }
})();

// ---------- Tunables ----------
const LIFE_RANGE   = [800, 4200];          // ms
const OK_MIN       = -20, OK_MAX = 20;     // zone bounds (percent)
const HI_THRESH    = 55;                    // above => HIGH
const LO_THRESH    = -55;                   // below => LOW
const DRIFT_BASE   = 2.0;                   // passive drift per second (toward +)
const DRIFT_JITTER = 1.0;
const CLICK_WATER  = +14;                   // effect on gauge
const CLICK_SWEET  = -18;                   // treat HIGH
const CLICK_SIP    = +6;                    // small water
const GOLDEN_CH    = 0.08;

const ITEMS = [
  { kind:'water', emoji:'💧',     weight: 55,   effect: CLICK_WATER },
  { kind:'sip',   emoji:'🥤',     weight: 22,   effect: CLICK_SIP   },
  { kind:'sweet', emoji:'🍬',     weight: 18,   effect: CLICK_SWEET },
  { kind:'gold',  emoji:'💠',     weight: 5,    effect: CLICK_WATER*1.4, golden:true },
];

function pickWeighted(list){
  const sum = list.reduce((s,a)=>s+(a.weight||1),0);
  let r = Math.random()*sum;
  for (const it of list){
    r -= (it.weight||1);
    if (r<=0) return it;
  }
  return list[list.length-1];
}
const clamp = (x,a,b)=>Math.max(a,Math.min(b,x));

// ---------- HUD helpers ----------
function zoneOf(v){
  if (v >  HI_THRESH) return 'HIGH';
  if (v <  LO_THRESH) return 'LOW';
  if (v >= OK_MIN && v <= OK_MAX) return 'OK';
  return (v>OK_MAX) ? 'MID_HIGH' : 'MID_LOW';
}
function hudHydrate(hud, v){
  const z = zoneOf(v);
  const pct = clamp(Math.round((v+100)/2), 0, 100); // map -100..100 -> 0..100
  hud?.showHydration?.(z, pct);
}

// ---------- Legacy API (minimal stubs) ----------
export function init(state={}, hud){
  state.lang = (state.lang||localStorage.getItem('hha_lang')||'TH').toUpperCase();
  state.ctx = state.ctx || {};
  state.ctx.gauge = 0;                 // -100 .. 100
  state.ctx.hydOkSec = 0;
  state.ctx.overflow = 0;
  state.ctx.recoverFromLow = 0;
  state.ctx.treatHigh = 0;
  state._lastZone = 'OK';
  state._secAcc = 0;                   // accumulator for per-second tick
  hudHydrate(hud, state.ctx.gauge);

  try{
    Progress.emit?.('run_start', { mode:'hydration', difficulty: state.difficulty });
  }catch{}
}
export function cleanup(){ /* none */ }

export function pickMeta(diff={}, state={}){
  const lifeBase = Number(diff.life)>0? Number(diff.life) : 3000;
  const life = clamp(lifeBase + (Math.random()*1200-600), LIFE_RANGE[0], LIFE_RANGE[1]);
  const it = pickWeighted(ITEMS);
  return {
    id:`h_${Date.now().toString(36)}_${(Math.random()*999)|0}`,
    char: it.emoji,
    aria: it.kind,
    label: it.kind,
    kind: it.kind,
    effect: it.effect,
    good: true,           // hydra: we score only on correct timing; expiry handled below
    golden: !!it.golden,
    life
  };
}

export function onHit(meta={}, systems={}, state={}){
  if (!meta || !Number.isFinite(meta.effect)) return 'ok';
  const score = systems?.score;
  const sfx   = systems?.sfx;

  const before = state.ctx.gauge|0;
  const zBefore = zoneOf(before);

  // Apply effect
  state.ctx.gauge = clamp((state.ctx.gauge|0) + (meta.effect|0), -100, 100);
  const after = state.ctx.gauge|0;
  const zAfter = zoneOf(after);

  // Quest/Progress events
  try {
    Quests.event?.('hydro_click', { kind: meta.kind, zoneBefore: zBefore, zoneAfter: zAfter });
    if (meta.kind==='sweet' && zBefore==='HIGH' && zAfter!=='HIGH') {
      Quests.event?.('hydro_treat_high', { kind:'sweet', zoneBefore:'HIGH' });
      Progress.notify?.('hydration_high', { resolved:true });
    }
    if (zBefore==='LOW' && zAfter==='OK') {
      Quests.event?.('hydro_recover_low', { from:'LOW', to:'OK' });
    }
  } catch {}

  // Scoring
  let res = 'ok';
  if (zAfter==='OK'){
    res = meta.golden ? 'perfect' : 'good';
    try{ sfx?.play?.(meta.golden?'sfx-perfect':'sfx-good'); }catch{}
    score?.add?.(meta.golden ? 20 : 12, { kind: res });
  } else {
    // clicking sweet while not HIGH or pushing further away is a "bad"
    const misguided = (meta.kind==='sweet' && zBefore!=='HIGH') ||
                      (meta.kind!=='sweet' && (zBefore==='HIGH'));
    if (misguided){
      res = 'bad';
      document.body.classList.add('flash-danger'); setTimeout(()=>document.body.classList.remove('flash-danger'), 150);
      try{ sfx?.play?.('sfx-bad'); }catch{}
      score?.addPenalty?.(8, { kind:'bad' });
    } else {
      // neutral nudge
      score?.add?.(6, { kind:'ok' });
    }
  }
  return res;
}

export function tick(){ /* handled in factory's update() */ }

// ---------- FX hooks ----------
export const fx = {
  onSpawn(el){ try{ (window?.HHA_FX?.add3DTilt||(()=>{}))(el); }catch{} },
  onHit(x,y){ try{ (window?.HHA_FX?.shatter3D||(()=>{}))(x,y); }catch{} }
};

// ============================================================================
// Factory Adapter (DOM spawn)
// ============================================================================
export function create({ engine, hud, coach }) {
  const host  = document.getElementById('spawnHost');
  const layer = document.getElementById('gameLayer');

  const state = {
    running:false,
    items:[],
    difficulty: (window.__HHA_DIFF || 'Normal'),
    lang: (localStorage.getItem('hha_lang')||'TH').toUpperCase(),
    ctx:{ gauge:0, hydOkSec:0, overflow:0, recoverFromLow:0, treatHigh:0 },
    _lastZone:'OK',
    _secAcc:0,            // seconds accumulator
    stats:{ good:0, perfect:0, bad:0, miss:0 }
  };

  function start(){
    stop();
    state.running = true;
    init(state, hud, {});
    coach?.onStart?.();
  }

  function stop(){
    state.running = false;
    try { for (const it of state.items) it.el.remove(); } catch {}
    state.items.length = 0;
  }

  function update(dt, Bus){
    if (!state.running || !layer) return;

    // 1) Gauge passive drift
    const driftPerSec = DRIFT_BASE + (Math.random()*DRIFT_JITTER - DRIFT_JITTER/2);
    state.ctx.gauge = clamp(state.ctx.gauge + driftPerSec * dt * (state._driftDir||1), -100, 100);
    // flip drift direction occasionally
    if (!state._driftFlipAcc) state._driftFlipAcc = 0;
    state._driftFlipAcc += dt;
    if (state._driftFlipAcc > 3.5){ state._driftFlipAcc = 0; state._driftDir = (Math.random()<0.5?-1:1); }

    // 2) Per-second mission/quest ticking + crossing events
    state._secAcc += dt;
    if (state._secAcc >= 1){
      state._secAcc -= 1;

      const z = zoneOf(state.ctx.gauge);
      if (z==='OK'){
        state.ctx.hydOkSec++;
      }
      // Quest/Progress hooks per second
      try {
        Quests.event?.('hydro_tick', { zone:z });
        Progress.notify?.('score_tick', { score: engine?.score?.get?.()|0 });
        if (z==='HIGH') Progress.notify?.('hydration_high', {});
      } catch {}

      // crossing event
      if (z !== state._lastZone){
        try { Quests.event?.('hydro_cross', { from: state._lastZone, to: z }); } catch {}
        state._lastZone = z;
      }

      hudHydrate(hud, state.ctx.gauge);
    }

    // 3) Spawn cadence
    const rect = layer.getBoundingClientRect();
    if (!state._spawnCd) state._spawnCd = 0.22;
    const timeLeft = Number(document.getElementById('time')?.textContent||'0')|0;
    const bias = timeLeft <= 15 ? 0.12 : 0;
    state._spawnCd -= dt;
    if (state._spawnCd <= 0){
      spawnOne(rect, Bus);
      state._spawnCd = clamp(0.40 - bias + Math.random()*0.24, 0.26, 0.95);
    }

    // 4) Expiry handling (miss only if helpful to current zone)
    const now = performance.now();
    const gone = [];
    for (const it of state.items){
      if (now - it.born > it.meta.life){
        const z = zoneOf(state.ctx.gauge);
        const helpful = (z==='HIGH' && it.meta.kind==='sweet')
                     || (z==='LOW'  && (it.meta.kind==='water'||it.meta.kind==='sip'||it.meta.kind==='gold'));
        if (helpful){
          Bus?.miss?.({ meta:{ reason:'expire', kind:it.meta.kind } });
          state.stats.miss++;
        }
        try { it.el.remove(); } catch {}
        gone.push(it);
      }
    }
    if (gone.length) state.items = state.items.filter(x=>!gone.includes(x));
  }

  function spawnOne(rect, Bus){
    // Adjust item weights dynamically by zone
    const z = zoneOf(state.ctx.gauge);
    const wBias = (arr)=>arr.map(a=>{
      const k = a.kind;
      let w = a.weight;
      if (z==='HIGH' && k==='sweet') w += 14;
      if (z==='LOW' && (k==='water'||k==='sip')) w += 14;
      if (Math.random() < GOLDEN_CH) return { ...a, weight: w+6, golden:true };
      return { ...a, weight: w };
    });

    const lifeHint = 2200;
    const meta0 = pickWeighted(wBias(ITEMS));
    const meta = {
      id:`spawn_${Date.now().toString(36)}_${(Math.random()*999)|0}`,
      char: meta0.emoji,
      aria: meta0.kind,
      label: meta0.kind,
      kind: meta0.kind,
      effect: meta0.effect,
      good: true,
      golden: !!meta0.golden,
      life: clamp(lifeHint + (Math.random()*1200-500), LIFE_RANGE[0], LIFE_RANGE[1])
    };

    const pad = 30;
    const x = Math.round(pad + Math.random()*(Math.max(1, rect.width)  - pad*2));
    const y = Math.round(pad + Math.random()*(Math.max(1, rect.height) - pad*2));

    const b = document.createElement('button');
    b.className = 'spawn-emoji';
    b.type = 'button';
    b.style.left = x + 'px';
    b.style.top  = y + 'px';
    b.textContent = meta.char;
    b.setAttribute('aria-label', meta.aria);
    if (meta.golden) b.style.filter = 'drop-shadow(0 0 10px rgba(64,200,255,.9))';

    try { (window?.HHA_FX?.add3DTilt||(()=>{}))(b); } catch {}

    b.addEventListener('click', (ev)=>{
      if (!state.running) return;
      ev.stopPropagation();
      const ui = { x: ev.clientX, y: ev.clientY };

      const res = onHit(meta, { score: engine?.score, sfx: engine?.sfx }, state);

      if (res==='good' || res==='perfect'){
        const pts = res==='perfect'? 20 : 10;
        engine?.fx?.popText?.(`+${pts}${res==='perfect'?' ✨':''}`, { x: ui.x, y: ui.y, ms: 720 });
        try { (window?.HHA_FX?.shatter3D||(()=>{}))(ui.x, ui.y); } catch {}
        state.stats[res]++; Bus?.hit?.({ kind: res, points: pts, ui, meta });
        coach?.onGood?.();
      } else if (res==='bad'){
        document.body.classList.add('flash-danger'); setTimeout(()=>document.body.classList.remove('flash-danger'), 150);
        state.stats.bad++; Bus?.miss?.({ meta });
        coach?.onBad?.();
      }

      try { b.remove(); } catch {}
      const idx = state.items.findIndex(it=>it.el===b); if (idx>=0) state.items.splice(idx,1);
    }, { passive:false });

    (host||document.getElementById('spawnHost'))?.appendChild?.(b);
    state.items.push({ el:b, x, y, born: performance.now(), life: meta.life, meta });
  }

  function cleanup(){ stop(); }

  return { start, stop, update, cleanup };
}
