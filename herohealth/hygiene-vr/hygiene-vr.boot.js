// === /herohealth/hygiene-vr/hygiene-vr.boot.js ===
// Boot HygieneVR — PRODUCTION (anti-stall + diagnostics + HUD-safe calibrate)
// PATCH v20260215c
//
// ✅ Imports engine: hygiene.safe.js (must export boot)
// ✅ If missing DOM or import fails -> show readable error on screen
// ✅ Warn if particles.js or quiz bank missing
// ✅ Auto-calibrate HUD safe zones (prevents HUD blocking targets)
// ✅ Anti-stall watchdog: if RAF stalls -> show banner
//
'use strict';

function $id(id){ return document.getElementById(id); }

function showBanner(msg){
  const banner = $id('banner');
  if(!banner) return;
  banner.textContent = msg;
  banner.classList.add('show');
  clearTimeout(showBanner._t);
  showBanner._t = setTimeout(()=>banner.classList.remove('show'), 1600);
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

function clamp(v,a,b){ v = Number(v)||0; return Math.max(a, Math.min(b, v)); }

function calibrateHudSafeZones(){
  // Measure actual HUD blocks (top HUD height & optional bottom overlays)
  try{
    const root = document.documentElement;
    const hudTop = document.querySelector('.hw-top');
    const hud = document.querySelector('.hw-hud');
    const sab = Number(getComputedStyle(root).getPropertyValue('--sab')) || 0;
    const sat = Number(getComputedStyle(root).getPropertyValue('--sat')) || 0;

    let topSafe = 190;
    let bottomSafe = 210;

    if(hudTop){
      const r = hudTop.getBoundingClientRect();
      // + margin to account banner/row wraps
      topSafe = Math.ceil(r.bottom + 18);
    } else if(hud){
      const r = hud.getBoundingClientRect();
      topSafe = Math.ceil((r.top||0) + 190);
    }

    // Bottom safe: just protect bottom safe-area + a bit (since we don't have bottom HUD in this game)
    bottomSafe = Math.ceil(120 + sab + 28);

    // clamp to sane range
    topSafe = clamp(topSafe, 150, 360);
    bottomSafe = clamp(bottomSafe, 140, 360);

    root.style.setProperty('--hw-top-safe', topSafe + 'px');
    root.style.setProperty('--hw-bottom-safe', bottomSafe + 'px');

    console.log('[HygieneBoot] HUD-safe calibrated:', { topSafe, bottomSafe, sat, sab });
  }catch(err){
    console.warn('[HygieneBoot] calibrateHudSafeZones failed', err);
  }
}

function setupAntiStallWatchdog(){
  // If main loop stalls (tab throttling / JS error / device lag), at least show user hint
  let lastFrame = performance.now();
  function raf(t){
    lastFrame = t;
    requestAnimationFrame(raf);
  }
  requestAnimationFrame(raf);

  setInterval(()=>{
    const now = performance.now();
    const gap = now - lastFrame;

    // if gap too large while page visible => user perceives "freeze"
    // 1800ms is a good heuristic
    if(!document.hidden && gap > 1800){
      showBanner('⚠️ เกมสะดุด/ค้าง • แนะนำ Reload (มือถือหน่วง/หน่วยความจำเต็ม/มี error)');
      console.warn('[HygieneBoot] RAF stall detected gap(ms)=', Math.round(gap));
    }
  }, 900);
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
  const P = await waitForGlobal(()=>window.Particles, 900);
  if(!P){
    console.warn('[HygieneBoot] window.Particles not found (particles.js missing?)');
    showBanner('⚠️ FX ไม่พร้อม (particles.js อาจหาย/404)');
  }

  const bank = await waitForGlobal(()=>window.HHA_HYGIENE_QUIZ_BANK, 900);
  if(!bank){
    console.warn('[HygieneBoot] HHA_HYGIENE_QUIZ_BANK not found (hygiene-quiz-bank.js missing?)');
    showBanner('⚠️ Quiz bank ไม่พร้อม (hygiene-quiz-bank.js อาจหาย/404)');
  }else{
    try{ console.log('[HygieneBoot] quiz bank:', bank.length); }catch{}
  }

  // Calibrate safe zones AFTER layout is stable (fix HUD blocking targets)
  try{
    if(document.readyState === 'loading'){
      document.addEventListener('DOMContentLoaded', ()=>calibrateHudSafeZones(), { once:true });
    }else{
      calibrateHudSafeZones();
    }
    // also recalibrate after a short delay (fonts/rows wrap on mobile)
    setTimeout(calibrateHudSafeZones, 350);
    window.addEventListener('resize', ()=>setTimeout(calibrateHudSafeZones, 80), { passive:true });
  }catch{}

  // watchdog
  setupAntiStallWatchdog();

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
  }catch(err){
    showFatal('engine.boot() crash', err);
  }
}

main();