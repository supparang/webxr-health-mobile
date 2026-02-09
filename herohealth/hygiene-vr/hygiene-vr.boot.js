// === /herohealth/hygiene-vr/hygiene-vr.boot.js ===
// Boot HygieneVR — PRODUCTION (anti-stall + diagnostics)
// PATCH v20260206g
//
// ✅ Imports engine: hygiene.safe.js (must export boot)
// ✅ If missing DOM or import fails -> show readable error on screen
// ✅ Warn if particles.js or quiz bank missing
// ✅ Watchdog: detect freeze (no hha:time ticks / RAF stuck) and show banner
//
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

// ---------- Watchdog ----------
function installWatchdog(){
  // We use hha:time (emitted every frame/tick) as heartbeat
  let lastBeatMs = Date.now();
  let beats = 0;

  function beat(){
    lastBeatMs = Date.now();
    beats++;
  }

  // heartbeat from engine
  window.addEventListener('hha:time', beat);

  // also beat on hha:judge (tap/shoot)
  window.addEventListener('hha:judge', beat);

  // periodic check
  const CHECK_EVERY_MS = 1200;
  const FREEZE_MS = 6500; // if no beat within this => likely stuck
  const WARN1_MS = 3800;

  setInterval(()=>{
    const dt = Date.now() - lastBeatMs;

    // warn early
    if(dt > WARN1_MS && dt < FREEZE_MS){
      // show only sometimes
      if(!installWatchdog._warned){
        installWatchdog._warned = true;
        showBanner('⏳ เกมเหมือนช้าลง… ถ้าค้างให้กด Pause/Resume หรือรีโหลด');
      }
      return;
    }

    // freeze
    if(dt >= FREEZE_MS){
      showBanner('⚠️ เกมค้าง/หยุดตอบสนอง (แนะนำรีโหลดหน้า)');

      // dump minimal diag (doesn't crash UI)
      try{
        console.warn('[HygieneBoot][Watchdog] freeze suspected', {
          dtMs: dt,
          beats,
          hasParticles: !!window.Particles,
          hasQuizBank: Array.isArray(window.HHA_HYGIENE_QUIZ_BANK),
          mem: (performance && performance.memory) ? performance.memory : undefined
        });
      }catch{}

      // allow warning again after a while
      installWatchdog._warned = false;
      // reset beat so we don't spam every interval
      lastBeatMs = Date.now();
    }
  }, CHECK_EVERY_MS);
}

async function main(){
  // global error hooks (show on screen)
  window.addEventListener('error', (e)=>{
    try{ showBanner(`❌ Error: ${(e && e.message) || 'unknown'}`); }catch{}
  });
  window.addEventListener('unhandledrejection', (e)=>{
    try{ showBanner(`❌ Promise: ${(e && e.reason && e.reason.message) || 'rejection'}`); }catch{}
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

  // Watchdog install early
  installWatchdog();

  // Wait a bit for deferred scripts to populate globals
  // particles.js -> window.Particles
  const P = await waitForGlobal(()=>window.Particles, 1100);
  if(!P){
    console.warn('[HygieneBoot] window.Particles not found (particles.js missing?)');
    showBanner('⚠️ FX ไม่พร้อม (particles.js อาจหาย/404)');
  }

  // quiz bank -> window.HHA_HYGIENE_QUIZ_BANK (from hygiene-quiz-bank.js)
  const bank = await waitForGlobal(()=>window.HHA_HYGIENE_QUIZ_BANK, 1100);
  if(!bank){
    console.warn('[HygieneBoot] HHA_HYGIENE_QUIZ_BANK not found (hygiene-quiz-bank.js missing?)');
    showBanner('⚠️ Quiz bank ไม่พร้อม (hygiene-quiz-bank.js อาจหาย/404)');
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
    showBanner('✅ โหลดเกมสำเร็จ');
  }catch(err){
    showFatal('engine.boot() crash', err);
  }
}

main();