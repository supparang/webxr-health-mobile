// === /herohealth/hygiene-vr/hygiene-vr.boot.js ===
// Boot HygieneVR — PRODUCTION (anti-stall + diagnostics + HUD-safe auto-calibration)
// PATCH v20260215c
//
// ✅ Imports engine: hygiene.safe.js (must export boot)
// ✅ If missing DOM or import fails -> show readable error on screen
// ✅ Warn if particles.js or quiz bank missing
// ✅ Auto-calibrate HUD safe zones: sets --hw-top-safe/--hw-bottom-safe based on actual HUD height
// ✅ Watchdog: if RAF stalls (mobile hiccup), show hint banner
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

// ----- HUD safe zone auto-calibration -----
// measure top HUD height & bottom overlay presence, then set CSS vars used by hygiene.safe.js spawn rect
function calibrateHudSafe(){
  try{
    const root = document.documentElement;
    const top = document.querySelector('.hw-top');
    const sat = parseFloat(getComputedStyle(root).getPropertyValue('--sat')) || 0;

    // Base fallback (must match css default-ish)
    let topSafe = 180;
    let bottomSafe = 210;

    if(top){
      const r = top.getBoundingClientRect();
      // top content height + some breathing room (banner sits below)
      topSafe = Math.max(150, Math.round(r.bottom + 22));
      // include safe-area top inset already accounted via padding; but keep stable on mobile
      topSafe = Math.max(topSafe, Math.round(140 + sat));
    }

    // Bottom safe: consider overlays buttons area / browser bars; keep a decent margin
    // On cVR, bottom HUD often bigger
    const body = document.body;
    const isCVR = body && body.classList.contains('view-cvr');
    bottomSafe = isCVR ? 260 : 220;

    root.style.setProperty('--hw-top-safe', topSafe + 'px');
    root.style.setProperty('--hw-bottom-safe', bottomSafe + 'px');

    // Small debug line in console
    console.log('[HygieneBoot] HUD safe set:', { topSafe, bottomSafe });
  }catch(e){
    console.warn('[HygieneBoot] calibrateHudSafe failed', e);
  }
}

function installWatchdog(){
  let last = performance.now();
  function ping(){
    const now = performance.now();
    const dt = now - last;
    last = now;

    // if main thread stalls badly (tab background / mobile pause) show a hint
    if(dt > 2600){
      showBanner('⚠️ เกมสะดุด (มือถือหน่วง/แท็บพัก) — ลอง Reload หรือปิดแอปอื่น', 2200);
    }
    requestAnimationFrame(ping);
  }
  requestAnimationFrame(ping);
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

  // Let layout settle then calibrate HUD safe zones
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', ()=>{
      calibrateHudSafe();
      setTimeout(calibrateHudSafe, 200);
      setTimeout(calibrateHudSafe, 700);
    }, { once:true });
  }else{
    calibrateHudSafe();
    setTimeout(calibrateHudSafe, 200);
    setTimeout(calibrateHudSafe, 700);
  }
  window.addEventListener('resize', ()=>{ calibrateHudSafe(); }, { passive:true });

  installWatchdog();

  // Wait a bit for deferred scripts to populate globals
  const P = await waitForGlobal(()=>window.Particles, 900);
  if(!P){
    console.warn('[HygieneBoot] window.Particles not found (particles.js missing?)');
    showBanner('⚠️ FX ไม่พร้อม (particles.js อาจหาย/404)');
  }

  // quiz bank -> window.HHA_HYGIENE_QUIZ_BANK (from hygiene-quiz-bank.js)
  const bank = await waitForGlobal(()=>window.HHA_HYGIENE_QUIZ_BANK, 900);
  if(!bank){
    console.warn('[HygieneBoot] HHA_HYGIENE_QUIZ_BANK not found (hygiene-quiz-bank.js missing?)');
    showBanner('⚠️ Quiz bank ไม่พร้อม (hygiene-quiz-bank.js อาจหาย/404)');
  }else{
    try{ console.log('[HygieneBoot] quiz bank:', bank.length); }catch{}
  }

  // Import engine safely
  let engine;
  try{
    engine = await import('./hygiene.safe.js?v=20260215c');
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
    showBanner('พร้อมเล่น ✅');
  }catch(err){
    showFatal('engine.boot() crash', err);
  }
}

main();