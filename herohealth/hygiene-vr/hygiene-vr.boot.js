// === /herohealth/hygiene-vr/hygiene-vr.boot.js ===
// Boot HygieneVR — PRODUCTION (anti-stall + diagnostics)
// PATCH v20260204b
//
// ✅ Imports engine: hygiene.safe.js (must export boot)
// ✅ If missing DOM or import fails -> show readable error on screen
// ✅ Warn if particles.js or quiz bank missing
// ✅ Small watchdog to detect "freeze" symptoms

'use strict';

function $id(id){ return document.getElementById(id); }

function showBanner(msg){
  const banner = $id('banner');
  if(!banner) return;
  banner.textContent = msg;
  banner.classList.add('show');
  clearTimeout(showBanner._t);
  showBanner._t = setTimeout(()=>banner.classList.remove('show'), 1800);
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
        <span style="color:#94a3b8">แนะนำ: เปิด Console/Network ดูว่าไฟล์ 404 หรือ import ผิด</span>
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

// simple RAF watchdog: if no RAF for too long while running, warn user
function startFreezeWatchdog(){
  let last = performance.now();
  let rafId = 0;

  function loop(t){
    last = t;
    rafId = requestAnimationFrame(loop);
  }
  rafId = requestAnimationFrame(loop);

  const timer = setInterval(()=>{
    const now = performance.now();
    const dt = now - last;

    // if tab in background, dt can be huge; ignore when hidden
    if(document.hidden) return;

    // if "frame gap" too big -> warn (mobile hiccup / memory / long task)
    if(dt > 2200){
      console.warn('[HygieneBoot] possible freeze/long task, dt(ms)=', dt|0);
      showBanner('เกมค้าง/สะดุด • แนะนำกด Reload (มือถือหน่วง/หน่วยความจำ/JS error)');
      const sub = $id('hudSub');
      if(sub) sub.textContent = '⚠️ สะดุด/ค้าง ตรวจ Console error หรือ Reload';
    }
  }, 1200);

  return ()=>{ try{ cancelAnimationFrame(rafId); }catch{} try{ clearInterval(timer); }catch{} };
}

async function main(){
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
  const P = await waitForGlobal(()=>window.Particles, 900);
  if(!P){
    console.warn('[HygieneBoot] window.Particles not found (particles.js missing?)');
    showBanner('⚠️ FX ไม่พร้อม (particles.js อาจหาย/404)');
  }else{
    try{ console.log('[HygieneBoot] Particles OK'); }catch{}
  }

  // quiz bank -> window.HHA_HYGIENE_QUIZ_BANK (from hygiene-quiz-bank.js)
  const bank = await waitForGlobal(()=>window.HHA_HYGIENE_QUIZ_BANK, 900);
  if(!bank){
    console.warn('[HygieneBoot] HHA_HYGIENE_QUIZ_BANK not found (hygiene-quiz-bank.js missing?)');
    showBanner('⚠️ Quiz bank ไม่พร้อม (hygiene-quiz-bank.js อาจหาย/404)');
  }else{
    try{ console.log('[HygieneBoot] quiz bank:', bank.length); }catch{}
  }

  // Watchdog (warn if freeze)
  const stopWatch = startFreezeWatchdog();

  // Import engine safely
  let engine;
  try{
    engine = await import('./hygiene.safe.js');
  }catch(err){
    stopWatch?.();
    showFatal('import hygiene.safe.js ไม่สำเร็จ (ไฟล์หาย/พาธผิด/ไม่ใช่ module)', err);
    return;
  }

  if(!engine || typeof engine.boot !== 'function'){
    stopWatch?.();
    showFatal('hygiene.safe.js ต้อง export function boot()');
    return;
  }

  // Run engine boot
  try{
    engine.boot();
    console.log('[HygieneBoot] engine.boot OK');
    showBanner('✅ โหลดเกมพร้อมแล้ว');
  }catch(err){
    stopWatch?.();
    showFatal('engine.boot() crash', err);
  }

  // Keep watchdog alive (it only warns; doesn't stop the game)
}

main();