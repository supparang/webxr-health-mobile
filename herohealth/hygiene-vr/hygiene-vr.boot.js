// === /herohealth/hygiene-vr/hygiene-vr.boot.js ===
// Boot HygieneVR — PRODUCTION (anti-stall + diagnostics)
// PATCH v20260215a
//
// ✅ Imports engine: hygiene.safe.js (must export boot)
// ✅ If missing DOM or import fails -> show readable error on screen
// ✅ Warn if particles.js or quiz bank missing
// ✅ Stall watchdog: detects long frame gaps / frozen feeling and offers Reload
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
    const row  = startOverlay.querySelector('.hw-card-row');
    if(card){
      card.innerHTML = `
        <b style="color:#fca5a5">เกิดปัญหาโหลดเกม</b><br>
        <span style="color:#94a3b8">${msg}</span><br>
        <span style="color:#94a3b8">เปิด Console/Network ดูว่าไฟล์ 404 หรือ import ผิด</span>
      `;
    }
    if(row){
      // add reload button (safe)
      const btn = document.createElement('button');
      btn.className = 'hw-cta';
      btn.type = 'button';
      btn.textContent = '⟳ Reload';
      btn.addEventListener('click', ()=>location.reload(), { passive:true });
      row.appendChild(btn);
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

// ✅ Stall watchdog: listens to rAF heartbeat
function installStallWatchdog(){
  let last = performance.now ? performance.now() : Date.now();
  let stalled = false;

  function tick(){
    const now = performance.now ? performance.now() : Date.now();
    const gap = now - last;
    last = now;

    // gap > 1800ms = เหมือนค้าง/โดน background/มือถือหน่วงหนัก
    if(gap > 1800 && !stalled){
      stalled = true;
      console.warn('[HygieneBoot] possible stall gap(ms)=', Math.round(gap));
      showBanner('เกมค้าง/สะดุด ⚠️ แนะนำกด Reload (มือถือหน่วง/หน่วยความจำต่ำ)');
      // auto reset stalled flag later (so it can warn again after a while)
      setTimeout(()=>{ stalled = false; }, 6000);
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  // also warn if page goes hidden (common on mobile)
  document.addEventListener('visibilitychange', ()=>{
    if(document.hidden) return;
    showBanner('กลับมาแล้ว ✅ ถ้าหน่วงให้กด Reload');
  }, { passive:true });
}

async function main(){
  installStallWatchdog();

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
    showBanner('พร้อมเล่น ✅');
  }catch(err){
    showFatal('engine.boot() crash', err);
  }
}

main();