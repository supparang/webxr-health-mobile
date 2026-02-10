// === /herohealth/hygiene-vr/hygiene-vr.boot.js ===
// Boot HygieneVR — PRODUCTION (anti-stall + diagnostics + watchdog)
// PATCH v20260206i
//
// ✅ Imports engine: hygiene.safe.js (must export boot)
// ✅ If missing DOM or import fails -> show readable error on screen
// ✅ Warn if particles.js or quiz bank missing
// ✅ Watchdog: detect "game frozen" and soft-recover
//
'use strict';

function $id(id){ return document.getElementById(id); }

function showBanner(msg, ms=1700){
  const banner = $id('banner');
  if(!banner) return;
  banner.textContent = msg;
  banner.classList.add('show');
  clearTimeout(showBanner._t);
  showBanner._t = setTimeout(()=>banner.classList.remove('show'), ms);
}

function showFatal(msg, err){
  console.error('[HygieneBoot]', msg, err||'');
  const sub = $id('hudSub');
  const banner = $id('banner');
  const startOverlay = $id('startOverlay');

  if(sub) sub.textContent = `BOOT ERROR: ${msg}`;
  if(banner){
    banner.textContent = `❌ ${msg}`;
    banner.classList.add('show');
  }
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

/* ---------------------------
   WATCHDOG (anti-freeze)
   Idea:
   - engine should "ping" window.__HHA_HEARTBEAT__ occasionally (we provide helper)
   - if not pinged, we still can detect RAF stalls by measuring time drifts
--------------------------- */
function installWatchdog(){
  // shared heartbeat object
  const HB = (window.__HHA_HEARTBEAT__ = window.__HHA_HEARTBEAT__ || {
    lastMs: Date.now(),
    ticks: 0,
    mark(){ this.lastMs = Date.now(); this.ticks++; }
  });

  // expose helper for engine (optional)
  window.HHA_BOOT_DIAG = window.HHA_BOOT_DIAG || {};
  window.HHA_BOOT_DIAG.heartbeat = ()=>{ try{ HB.mark(); }catch{} };

  let lastFrameMs = Date.now();
  let frameCount = 0;
  let stalledCount = 0;
  let lastWarnMs = 0;

  // very light RAF monitor
  function rafLoop(){
    const now = Date.now();
    const dt = now - lastFrameMs;
    lastFrameMs = now;
    frameCount++;

    // if browser tab/background, dt can be large; don't panic too quickly
    const hbAge = now - (HB.lastMs || now);

    // "soft stall" conditions:
    // - heartbeat not updated for 4500ms AND
    // - we are still getting RAF frames (so the page isn't totally backgrounded)
    if(frameCount > 25){
      if(hbAge > 4500){
        stalledCount++;
      }else{
        stalledCount = Math.max(0, stalledCount-1);
      }
    }

    // warn + ask engine to recover when persistent
    if(stalledCount >= 18){ // ~18 cycles of suspicion (~18*~16ms-ish with throttle)
      stalledCount = 0;
      const since = Math.round(hbAge/1000);
      const now2 = Date.now();
      if(now2 - lastWarnMs > 2500){
        lastWarnMs = now2;
        showBanner(`🧯 เกมเหมือนค้าง (${since}s) → กำลังพยายามกู้…`, 2000);
      }

      // tell engine to soft-recover if it supports it
      try{
        if(window.HHA_BOOT_DIAG){
          window.HHA_BOOT_DIAG.recoverRequestedAt = Date.now();
        }
      }catch{}

      try{
        window.dispatchEvent(new CustomEvent('hha:recover', {
          detail: { reason:'watchdog', hbAgeMs: hbAge }
        }));
      }catch{}
    }

    requestAnimationFrame(rafLoop);
  }
  requestAnimationFrame(rafLoop);

  // debug ping in case engine doesn't call heartbeat:
  // we still mark heartbeat when user interacts (tap/click) so hbAge isn't falsely huge
  const mark = ()=>{ try{ HB.mark(); }catch{} };
  window.addEventListener('pointerdown', mark, { passive:true });
  window.addEventListener('touchstart', mark, { passive:true });
  window.addEventListener('keydown', mark, { passive:true });

  return HB;
}

async function main(){
  // DOM must exist
  const stage = $id('stage');
  if(!stage){
    showFatal('ไม่พบ #stage (hygiene-vr.html ไม่ครบหรือ id ไม่ตรง)');
    return;
  }

  // install watchdog early
  installWatchdog();

  // CSS hint
  const cssOk = hasCssHref('/hygiene-vr.css');
  if(!cssOk){
    console.warn('[HygieneBoot] hygiene-vr.css may be missing or blocked');
    const sub = $id('hudSub');
    if(sub) sub.textContent = '⚠️ CSS อาจหาย/ไม่ถูกโหลด (เช็ค Network: hygiene-vr.css)';
    showBanner('⚠️ CSS อาจไม่ถูกโหลด (ตรวจ Network)', 2000);
  }

  // Wait a bit for deferred scripts to populate globals
  // particles.js -> window.Particles
  const P = await waitForGlobal(()=>window.Particles, 900);
  if(!P){
    console.warn('[HygieneBoot] window.Particles not found (particles.js missing?)');
    showBanner('⚠️ FX ไม่พร้อม (particles.js อาจหาย/404)', 2200);
  }

  // quiz bank -> window.HHA_HYGIENE_QUIZ_BANK (from hygiene-quiz-bank.js)
  const bank = await waitForGlobal(()=>window.HHA_HYGIENE_QUIZ_BANK, 900);
  if(!bank){
    console.warn('[HygieneBoot] HHA_HYGIENE_QUIZ_BANK not found (hygiene-quiz-bank.js missing?)');
    showBanner('⚠️ Quiz bank ไม่พร้อม (hygiene-quiz-bank.js อาจหาย/404)', 2300);
  }else{
    try{ console.log('[HygieneBoot] quiz bank:', bank.length); }catch{}
  }

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
    showBanner('✅ โหลดเกมพร้อมแล้ว', 1200);
  }catch(err){
    showFatal('engine.boot() crash', err);
  }

  // extra: catch unexpected errors to avoid "ค้างเงียบ"
  window.addEventListener('error', (e)=>{
    try{
      const msg = (e && e.message) ? e.message : 'runtime error';
      showBanner(`❌ ERROR: ${msg}`, 2600);
      console.error('[HygieneBoot] window.error', e);
    }catch{}
  });

  window.addEventListener('unhandledrejection', (e)=>{
    try{
      showBanner('❌ Promise error (unhandledrejection)', 2600);
      console.error('[HygieneBoot] unhandledrejection', e);
    }catch{}
  });
}

main();