// === /herohealth/vr-goodjunk/goodjunk-race.js ===
// GoodJunk RACE Controller — PRODUCTION (SYNC GO via room-bus)
// FULL v20260304-RACE-SYNC-GOAT
'use strict';

export function bootRace(opts = {}){
  const overlayId = String(opts.overlayId || 'raceOverlay');
  const numId = String(opts.numId || 'raceNum');
  const subId = String(opts.subId || 'raceSub');

  const wait = !!opts.wait;
  const autostartMs = Number(opts.autostartMs || 3000) || 3000;

  const room = String(opts.room || '').trim();
  const pid  = String(opts.pid || 'anon').trim() || 'anon';
  const bus  = opts.bus || null;

  const onGo = (typeof opts.onGo === 'function') ? opts.onGo : null;

  const overlay = document.getElementById(overlayId);
  const numEl = document.getElementById(numId);
  const subEl = document.getElementById(subId);

  function show(on){
    if(!overlay) return;
    overlay.setAttribute('aria-hidden', on ? 'false' : 'true');
  }
  function setNum(v){ if(numEl) numEl.textContent = String(v); }
  function setSub(v){ if(subEl) subEl.textContent = String(v); }

  // If overlay missing, just GO
  if(!overlay || !numEl || !subEl){
    try{ onGo && onGo(); }catch(_){}
    return;
  }

  // Non-wait: show briefly then GO
  if(!wait){
    show(true);
    setSub('RACE! ไปเลย!');
    setNum('GO');
    setTimeout(()=> show(false), 900);
    try{ onGo && onGo(); }catch(_){}
    return;
  }

  // ---- WAIT MODE (with optional sync) ----
  show(true);
  setSub('เตรียมตัว…');
  setNum('3');

  const now = ()=> (performance && performance.now) ? performance.now() : Date.now();
  const wallNow = ()=> Date.now(); // wall clock ms
  let goAtWallMs = 0;             // absolute wall-clock timestamp (ms)
  let gotGoAt = false;
  let started = false;

  // Helper: start countdown to GO_AT
  function startCountdownTo(goAt){
    if(started) return;
    goAtWallMs = Number(goAt)||0;
    if(!Number.isFinite(goAtWallMs) || goAtWallMs <= 0){
      // fallback immediate
      doGo();
      return;
    }
    gotGoAt = true;

    function tick(){
      if(started) return;
      const leftMs = goAtWallMs - wallNow();
      const leftS = Math.ceil(leftMs/1000);

      if(leftMs > 2500){
        setSub('เริ่มพร้อมกัน…');
        setNum(String(Math.min(9, Math.max(3, leftS))));
        requestAnimationFrame(tick);
        return;
      }
      if(leftMs > 1500){
        setSub('พร้อม…');
        setNum('2');
        requestAnimationFrame(tick);
        return;
      }
      if(leftMs > 500){
        setSub('พร้อม…');
        setNum('1');
        requestAnimationFrame(tick);
        return;
      }
      doGo();
    }
    requestAnimationFrame(tick);
  }

  function doGo(){
    if(started) return;
    started = true;
    setSub('GO!');
    setNum('GO');
    try{ onGo && onGo(); }catch(_){}
    setTimeout(()=> show(false), 650);
  }

  // ---- SYNC via bus ----
  // Event types
  const EVT_HELLO = 'race:hello';
  const EVT_GOAT  = 'race:goAt';

  // If bus exists and room provided, we try to sync
  if(bus && room){
    // Listen for GO_AT from any peer
    bus.on(EVT_GOAT, (payload)=>{
      const goAt = payload?.goAtWallMs;
      if(!goAt) return;
      // Accept first GO_AT (or earlier one)
      if(!gotGoAt || Number(goAt) < goAtWallMs){
        startCountdownTo(goAt);
      }
    });

    // Tell peers we joined (optional; can help future host logic)
    try{ bus.emit(EVT_HELLO, { pid, t: wallNow() }); }catch(_){}

    // Host logic (simple + safe):
    // - If nobody sends GO_AT soon, THIS client will propose one.
    // - Proposed GO_AT = now + autostartMs + 3500ms (3..2..1)
    // - Small buffer makes slower devices still catch up.
    const proposeDelayMs = 350; // wait a bit for existing host message
    setSub('รอหัวหน้าห้อง…');

    setTimeout(()=>{
      if(gotGoAt) return;
      const goAt = wallNow() + Math.max(800, autostartMs) + 3500;
      // announce to room
      try{ bus.emit(EVT_GOAT, { goAtWallMs: goAt, from: pid, room }); }catch(_){}
      // start locally too
      startCountdownTo(goAt);
    }, proposeDelayMs);

    // Safety fallback: if still nothing after 8s, GO
    setTimeout(()=>{
      if(!started && !gotGoAt){
        doGo();
      }
    }, 8000);

    return; // done
  }

  // ---- No bus => local-only countdown ----
  // local countdown begins after autostartMs
  const t0 = now();
  function localTick(){
    if(started) return;
    const t = now() - t0;
    if(t < autostartMs){
      const left = Math.max(0, Math.ceil((autostartMs - t)/1000));
      setSub(`เริ่มใน ${left}s`);
      requestAnimationFrame(localTick);
      return;
    }
    const elapsed = t - autostartMs;
    const sec = Math.floor(elapsed / 1000);
    const n = 3 - sec;
    if(n > 0){
      setSub('พร้อม…');
      setNum(String(n));
      requestAnimationFrame(localTick);
      return;
    }
    doGo();
  }
  requestAnimationFrame(localTick);
}