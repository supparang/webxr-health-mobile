// === /herohealth/hygiene-vr/hygiene-vr.boot.js ===
// Boot HygieneVR — PRODUCTION (anti-stall + diagnostics + harden)
// PATCH v20260210e
//
// ✅ Imports engine: hygiene.safe.js (must export boot)
// ✅ If missing DOM or import fails -> show readable error on screen
// ✅ Warn if particles.js or quiz bank missing
// ✅ Global error traps (error + unhandledrejection)
// ✅ Anti-stall watchdog (shows overlay from hygiene-vr.html window.HHA_STALL)
// Notes:
// - Quiz bank filename is: hygiene-quiz-bank.js (NOT hygiene.quiz-bank.js)
//

'use strict';

function $id(id){ return document.getElementById(id); }

function banner(msg){
  const b = $id('banner');
  if(!b) return;
  b.textContent = msg;
  b.classList.add('show');
  clearTimeout(banner._t);
  banner._t = setTimeout(()=>b.classList.remove('show'), 1600);
}

function setHudSub(msg){
  const sub = $id('hudSub');
  if(sub) sub.textContent = String(msg||'');
}

function stall(){
  return (window.HHA_STALL && typeof window.HHA_STALL.show === 'function') ? window.HHA_STALL : null;
}

function showFatal(msg, err){
  console.error('[HygieneBoot]', msg, err||'');
  setHudSub(`BOOT ERROR: ${msg}`);

  const s = stall();
  const details = [
    `❌ ${msg}`,
    err ? (err.stack || err.message || String(err)) : '',
    `URL: ${location.href}`,
    `UA: ${navigator.userAgent}`
  ].filter(Boolean).join('\n\n');

  if(s){
    s.set(details);
    s.show(details);
  }else{
    // fallback: banner only
    banner(`❌ ${msg}`);
    const startOverlay = $id('startOverlay');
    if(startOverlay){
      const card = startOverlay.querySelector('.hw-card-sub');
      if(card){
        card.innerHTML = `
          <b style="color:#fca5a5">เกิดปัญหาโหลดเกม</b><br>
          <span style="color:#94a3b8">${msg}</span><br>
          <span style="color:#94a3b8">เปิด Console/Network ดูว่าไฟล์ 404 หรือ import ผิด</span>
        `;
      }
      startOverlay.style.display = 'grid';
    }
  }
}

function hasCssHref(part){
  try{
    return [...document.styleSheets].some(s=>{
      try{ return (s.href||'').includes(part); }catch{ return false; }
    });
  }catch{ return false; }
}

function waitForGlobal(getter, ms){
  const t0 = Date.now();
  return new Promise((resolve)=>{
    (function tick(){
      try{
        const v = getter();
        if(v) return resolve(v);
      }catch{}
      if(Date.now() - t0 >= ms) return resolve(null);
      setTimeout(tick, 50);
    })();
  });
}

// -------------------- Global error traps --------------------
function installGlobalTraps(){
  window.addEventListener('error', (e)=>{
    try{
      const msg = e?.message || 'unknown error';
      const src = e?.filename ? `@ ${e.filename}:${e.lineno||0}:${e.colno||0}` : '';
      const err = e?.error;
      const detail = [
        `JS ERROR: ${msg}`,
        src,
        err ? (err.stack || err.message || String(err)) : ''
      ].filter(Boolean).join('\n');
      showFatal(`เกิด JS error`, new Error(detail));
    }catch(_){}
  });

  window.addEventListener('unhandledrejection', (e)=>{
    try{
      const r = e?.reason;
      const detail = r ? (r.stack || r.message || String(r)) : 'unknown rejection';
      showFatal('Promise rejection (unhandled)', new Error(detail));
    }catch(_){}
  });
}

// -------------------- Anti-stall watchdog --------------------
// แนวคิด: engine ต้อง “ขยับเวลา/ปล่อย tick” อย่างน้อยทุก ๆ X ms
// ให้ hygiene.safe.js เรียก: window.__HHA_HEARTBEAT__ = performance.now() เป็นระยะ
// (ถ้ายังไม่ได้ใส่ เดี๋ยวใน C จะ patch ให้)
const WATCHDOG = {
  enable: true,
  warnAfterMs: 3500,
  hardAfterMs: 6500,
  intervalMs: 700
};

function startWatchdog(){
  if(!WATCHDOG.enable) return;

  const s = stall();
  let shown = false;

  function note(msg){
    if(s) s.set(msg);
  }

  const t0 = performance.now ? performance.now() : Date.now();

  const timer = setInterval(()=>{
    try{
      const now = performance.now ? performance.now() : Date.now();
      const hb = Number(window.__HHA_HEARTBEAT__ || 0);
      const dt = hb ? (now - hb) : (now - t0);

      // ถ้าเกมกำลังอยู่ overlay start/end ก็ไม่ต้องเตือนหนัก
      const startOverlay = $id('startOverlay');
      const endOverlay = $id('endOverlay');
      const overlayVisible =
        (startOverlay && getComputedStyle(startOverlay).display !== 'none') ||
        (endOverlay && getComputedStyle(endOverlay).display !== 'none');

      if(overlayVisible){
        shown = false;
        if(s) s.hide();
        return;
      }

      if(dt > WATCHDOG.hardAfterMs){
        const msg = [
          'เกมค้าง/สะดุด (watchdog)',
          `ไม่มี heartbeat นาน ${(dt/1000).toFixed(1)}s`,
          'แนะนำกด Reload เกม',
          '',
          'เช็คสาเหตุที่พบบ่อย:',
          '1) มือถือหน่วง/เมมเต็ม',
          '2) JS error (ดู Console)',
          '3) เป้า click ไม่ถึง (HUD/overlay บัง) หรือ pointer-events ผิด',
          '',
          `URL: ${location.href}`
        ].join('\n');
        if(s){
          s.show(msg);
          note(msg);
          shown = true;
        }else{
          banner('เกมค้าง/สะดุด — แนะนำ Reload');
        }
      }else if(dt > WATCHDOG.warnAfterMs){
        if(!shown){
          banner('⚠️ เกมเริ่มหน่วง/สะดุด');
          shown = true;
        }
      }else{
        if(shown){
          shown = false;
          if(s) s.hide();
        }
      }
    }catch(_){}
  }, WATCHDOG.intervalMs);

  // store in case you want to stop it later
  window.__HHA_WATCHDOG_TIMER__ = timer;
}

// -------------------- Main boot --------------------
async function main(){
  installGlobalTraps();

  // DOM must exist
  const stage = $id('stage');
  if(!stage){
    showFatal('ไม่พบ #stage (hygiene-vr.html ไม่ครบหรือ id ไม่ตรง)');
    return;
  }

  // CSS hint
  const cssOk = hasCssHref('/hygiene-vr.css');
  if(!cssOk){
    console.warn('[HygieneBoot] hygiene-vr.css may be missing or blocked');
    setHudSub('⚠️ CSS อาจหาย/ไม่ถูกโหลด (เช็ค Network: hygiene-vr.css)');
    banner('⚠️ CSS อาจไม่ถูกโหลด (ตรวจ Network)');
  }

  // Wait a bit for deferred scripts to populate globals
  // particles.js -> window.Particles
  const P = await waitForGlobal(()=>window.Particles, 1200);
  if(!P){
    console.warn('[HygieneBoot] window.Particles not found (particles.js missing?)');
    banner('⚠️ FX ไม่พร้อม (particles.js อาจหาย/404)');
  }else{
    try{ console.log('[HygieneBoot] Particles OK'); }catch{}
  }

  // quiz bank -> window.HHA_HYGIENE_QUIZ_BANK (from hygiene-quiz-bank.js)
  const bank = await waitForGlobal(()=>window.HHA_HYGIENE_QUIZ_BANK, 1200);
  if(!bank){
    console.warn('[HygieneBoot] HHA_HYGIENE_QUIZ_BANK not found (hygiene-quiz-bank.js missing?)');
    banner('⚠️ Quiz bank ไม่พร้อม (hygiene-quiz-bank.js อาจหาย/404)');
  }else{
    try{ console.log('[HygieneBoot] quiz bank:', bank.length); }catch{}
  }

  // Start watchdog early (กันค้างระหว่าง import/init)
  startWatchdog();

  // Import engine safely
  let engine;
  try{
    engine = await import('./hygiene.safe.js');
  }catch(err){
    showFatal('import hygiene.safe.js ไม่สำเร็จ (ไฟล์หาย/พาธผิด/ไม่ใช่ module)', err);
    return;
  }

  if(!engine || typeof engine.boot !== 'function'){
    showFatal('hygiene.safe.js ต้อง export function boot()');
    return;
  }

  // Run engine boot
  try{
    engine.boot();
    console.log('[HygieneBoot] engine.boot OK');
    banner('✅ โหลดเกมพร้อม');
  }catch(err){
    showFatal('engine.boot() crash', err);
  }
}

main();