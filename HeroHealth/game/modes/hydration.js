// === Hero Health Academy — game/modes/hydration.js (2025-10-30 fixed)
// Start at 52%, 2s grace, per-second decay, proper zone events, safe HUD updates

export const name = 'hydration';

const ZONE = { LOW: 'LOW', OK: 'OK', HIGH: 'HIGH' };
const OK_MIN = 45, OK_MAX = 65;

const DECAY_PER_SEC = { Easy: 2, Normal: 3, Hard: 4 }; // % per second
const SIP = { water:+8, small:+5, sweet:-7 }; // example actions

const clamp = (n,a,b)=>Math.max(a,Math.min(b,n));
const zoneOf = (pct)=> (pct<OK_MIN? ZONE.LOW : pct>OK_MAX? ZONE.HIGH : ZONE.OK);

function updateHUD(hud, pct){
  try{ hud?.showHydration?.(zoneOf(pct), pct); }catch{}
}

export function create({ engine, hud, coach }){
  const host  = document.getElementById('spawnHost');
  const layer = document.getElementById('gameLayer');

  const state = {
    running:false,
    pct: 52,                 // <<< เริ่มที่กลาง ๆ
    diff: (window.__HHA_DIFF||document.body.getAttribute('data-diff')||'Normal'),
    _acc: 0,                 // สะสมวินาทีสำหรับดีเคย์
    _graceUntil: 0,          // ช่วงปลอดดีเคย์
    _lastZone: null,
    stats:{ highCount:0, okTicks:0 }
  };

  function start(){
    stop();
    state.running = true;
    state.pct = 52;
    state._acc = 0;
    state._graceUntil = performance.now() + 2000; // 2s grace
    state._lastZone = zoneOf(state.pct);
    updateHUD(hud, state.pct);
    coach?.onStart?.();
  }

  function stop(){
    state.running = false;
    // ไม่มี DOM สแปมในโหมดนี้ แต่ถ้ามีไอเทม ให้ลบทิ้งที่นี่
  }

  // UI actions (คุณจะยิงจากปุ่ม/อีโมจิได้)
  function applySip(kind){
    const beforeZone = zoneOf(state.pct);
    const delta = SIP[kind]||0;
    state.pct = clamp(state.pct + delta, 0, 100);
    updateHUD(hud, state.pct);

    // quest: hydro_click
    try {
      window.HHA_QUESTS?.event?.('hydro_click', { kind, zoneBefore: beforeZone, zoneAfter: zoneOf(state.pct) });
    } catch {}

    // FEVER / SFX / score (ปรับได้ตามที่ต้องการ)
    if (zoneOf(state.pct) === ZONE.OK){
      engine?.sfx?.play?.('sfx-good');
      engine?.score?.add?.(5);
    } else {
      engine?.sfx?.play?.('sfx-bad');
    }
  }

  // เชื่อมต่อกับระบบสแปนไอคอน (ตัวอย่างเรียบง่าย: สุ่มปุ่มจิบบ้างเป็นระยะ)
  function maybeSpawnButtons(dt){
    // ถ้าอยากให้มีอีโมจิให้กด เพิ่มที่นี่ (คล้าย goodjunk/groups)
    // ตัวอย่างนี้เน้น logic hydration + HUD เลยยังไม่สปาวน์ไอคอน
  }

  function update(dt, Bus){
    if (!state.running) return;

    // สะสมวินาที
    state._acc += dt;

    // ไม่มีดีเคย์ระหว่าง grace
    const now = performance.now();
    const inGrace = now < state._graceUntil;

    // per-second decay
    while (state._acc >= 1){
      state._acc -= 1;

      if (!inGrace){
        const dps = DECAY_PER_SEC[state.diff] ?? DECAY_PER_SEC.Normal;
        state.pct = clamp(state.pct - dps, 0, 100);
      }

      // quest tick
      try {
        window.HHA_QUESTS?.event?.('hydro_tick', { zone: zoneOf(state.pct), pct: state.pct|0 });
      } catch {}

      // zone cross
      const z = zoneOf(state.pct);
      if (z !== state._lastZone){
        try { window.HHA_QUESTS?.event?.('hydro_cross', { from: state._lastZone, to: z }); } catch {}
        if (z === ZONE.OK){ state.stats.okTicks++; }
        if (z === ZONE.HIGH){ state.stats.highCount++; }
        state._lastZone = z;
      }

      updateHUD(hud, state.pct);
    }

    maybeSpawnButtons(dt);
  }

  function cleanup(){ stop(); }

  // --- optional: public hooks (ถ้ามีปุ่มใน UI เรียกใช้) ---
  // ตัวอย่าง: window.HHA_HYDRO.apply('water'|'small'|'sweet')
  window.HHA_HYDRO = {
    apply(kind){ applySip(kind); }
  };

  return { start, stop, update, cleanup };
}
