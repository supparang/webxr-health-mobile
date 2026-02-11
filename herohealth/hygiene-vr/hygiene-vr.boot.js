// === /herohealth/hygiene-vr/hygiene-vr.boot.js ===
// Boot HygieneVR — PRODUCTION (anti-stall + diagnostics)
// PATCH v20260211a
//
// ✅ Imports engine: hygiene.safe.js (must export boot)
// ✅ If missing DOM or import fails -> show readable error on screen
// ✅ Wait for defer scripts (Particles / QuizBank / VRUI) to populate globals
// ✅ Watchdog: detect stall/freeze-ish and warn user to reload
//
'use strict';

function $id(id){ return document.getElementById(id); }

function showBanner(msg, ms=1600){
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
        <span style="color:#94a3b8">แนะนำเปิด Console/Network เช็ค 404 หรือ error</span>
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
   Stall watchdog
   - ถ้า frame ไม่ขยับ (tab freeze / device lag) หรือ
   - ถ้าไม่มี “กิจกรรมเกม” นานเกินไป -> แจ้งเตือน
   --------------------------- */
function setupWatchdog(){
  const STATE = {
    lastFrameMs: performance.now(),
    lastActivityMs: performance.now(),
    warned: false
  };

  // engine จะเรียก window.__HHA_HYGIENE_ACTIVITY() ได้ (ถ้าคุณเพิ่มใน hygiene.safe.js)
  // แต่แม้ไม่เพิ่ม เราก็ขยับ activity เมื่อมี input/visibility/RAF
  window.__HHA_HYGIENE_ACTIVITY = function(){
    STATE.lastActivityMs = performance.now();
  };

  // bump on user inputs
  const bump = ()=>{ STATE.lastActivityMs = performance.now(); };
  window.addEventListener('pointerdown', bump, { passive:true });
  window.addEventListener('touchstart',  bump, { passive:true });
  window.addEventListener('keydown',     bump, { passive:true });
  document.addEventListener('visibilitychange', bump, { passive:true });

  function raf(){
    const now = performance.now();
    const dtFrame = now - STATE.lastFrameMs;
    STATE.lastFrameMs = now;

    // ถ้า frame gap ใหญ่ผิดปกติ (มือถือหน่วง/สลับแอปกลับมา)
    if(dtFrame > 2200){
      showBanner('⚠️ เกมสะดุด/หน่วง (มือถือ/เมมโมรี่) — ถ้าค้างให้ Reload');
      STATE.lastActivityMs = now;
      STATE.warned = false;
    }

    const idle = now - STATE.lastActivityMs;

    // ถ้า “เงียบ” นาน (ผู้ใช้กำลังเล่น แต่เกมไม่ตอบสนอง)
    if(idle > 9000 && !STATE.warned){
      STATE.warned = true;
      showBanner('เกมค้าง/สะดุด • แนะนำกด Reload เกม (มักเกิดจาก memory/JS error/มือถือหน่วง) • เปิด Console ดู error ได้', 3600);
    }

    // reset warn หลังมี activity
    if(idle < 2000) STATE.warned = false;

    requestAnimationFrame(raf);
  }
  requestAnimationFrame(raf);
}

async function main(){
  setupWatchdog();

  // show runtime errors on screen (ไม่ให้ “ค้างเงียบ”)
  window.addEventListener('error', (e)=>{
    try{
      const m = (e && (e.message || e.error?.message)) || 'Unknown error';
      showBanner('❌ JS error: ' + m, 3200);
      console.error('[HygieneBoot] window.error', e);
    }catch{}
  });

  window.addEventListener('unhandledrejection', (e)=>{
    try{
      const m = (e && (e.reason?.message || String(e.reason))) || 'Unhandled rejection';
      showBanner('❌ Promise error: ' + m, 3200);
      console.error('[HygieneBoot] unhandledrejection', e);
    }catch{}
  });

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
    const sub = $id('hudSub');
    if(sub) sub.textContent = '⚠️ CSS อาจหาย/ไม่ถูกโหลด (เช็ค Network: hygiene-vr.css)';
    showBanner('⚠️ CSS อาจไม่ถูกโหลด (ตรวจ Network)');
  }

  // Wait a bit for deferred scripts to populate globals
  // particles.js -> window.Particles
  const P = await waitForGlobal(()=>window.Particles, 1200);
  if(!P){
    console.warn('[HygieneBoot] window.Particles not found (particles.js missing?)');
    showBanner('⚠️ FX ไม่พร้อม (particles.js อาจหาย/404)');
  }else{
    try{ console.log('[HygieneBoot] Particles OK'); }catch{}
  }

  // quiz bank -> window.HHA_HYGIENE_QUIZ_BANK (from hygiene-quiz-bank.js)
  const bank = await waitForGlobal(()=>window.HHA_HYGIENE_QUIZ_BANK, 1200);
  if(!bank){
    console.warn('[HygieneBoot] HHA_HYGIENE_QUIZ_BANK not found (hygiene-quiz-bank.js missing?)');
    showBanner('⚠️ Quiz bank ไม่พร้อม (hygiene-quiz-bank.js อาจหาย/404)');
  }else{
    try{ console.log('[HygieneBoot] Quiz bank OK:', bank.length); }catch{}
  }

  // vr-ui -> not required for non-VR, but warn if missing in VR view
  const view = (new URL(location.href).searchParams.get('view') || 'pc').toLowerCase();
  const vrui = await waitForGlobal(()=>window.__HHA_VRUI_LOADED__ || window.HHA_VRUI_CONFIG, 600);
  if((view === 'vr' || view === 'cvr') && !vrui){
    console.warn('[HygieneBoot] vr-ui.js may be missing');
    showBanner('⚠️ VR UI อาจไม่พร้อม (vr-ui.js)');
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

    // mark as activity
    try{ window.__HHA_HYGIENE_ACTIVITY?.(); }catch{}

    console.log('[HygieneBoot] engine.boot OK');
    showBanner('✅ โหลดเกมสำเร็จ', 900);
  }catch(err){
    showFatal('engine.boot() crash', err);
  }
}

main();