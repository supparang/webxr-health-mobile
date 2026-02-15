// === /herohealth/hygiene-vr/hygiene-vr.boot.js ===
// Boot HygieneVR — PRODUCTION (anti-stall + diagnostics)
// PATCH v20260215b
// ✅ Visible error UI on crash/unhandledrejection
// ✅ Heartbeat monitor (if engine freezes -> show reload hint)
// ✅ Warn if particles.js or quiz bank missing
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
        <span style="color:#94a3b8">กด Reload แล้วลองใหม่</span>
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

function wireCrashGuards(){
  window.addEventListener('error', (e)=>{
    const msg = (e && (e.message || e.error?.message)) || 'JS Error';
    showBanner('⚠️ เกมสะดุด: ' + msg);
    console.error('[HygieneBoot] window.error', e);
  });

  window.addEventListener('unhandledrejection', (e)=>{
    const msg = (e && (e.reason?.message || String(e.reason))) || 'Promise Error';
    showBanner('⚠️ เกมสะดุด: ' + msg);
    console.error('[HygieneBoot] unhandledrejection', e);
  });
}

function startHeartbeatWatch(){
  // engine will call window.HHA_HEARTBEAT()
  let last = Date.now();
  window.HHA_HEARTBEAT = ()=>{ last = Date.now(); };

  setInterval(()=>{
    const running = !!window.HHA_RUNNING;
    if(!running) return;

    const dt = Date.now() - last;
    if(dt > 2500){
      showBanner('⏳ เกมค้าง/หยุดตอบสนอง — แนะนำกด Reload');
      const sub = $id('hudSub');
      if(sub) sub.textContent = '⚠️ Freeze detected • กด Reload (หรือกลับ HUB แล้วเข้าใหม่)';
    }
  }, 900);
}

async function main(){
  wireCrashGuards();

  const stage = $id('stage');
  if(!stage){
    showFatal('ไม่พบ #stage (hygiene-vr.html ไม่ครบหรือ id ไม่ตรง)');
    return;
  }

  const cssOk = hasCssHref('/hygiene-vr.css');
  if(!cssOk){
    console.warn('[HygieneBoot] hygiene-vr.css may be missing or blocked');
    showBanner('⚠️ CSS อาจไม่ถูกโหลด (ตรวจ Network)');
  }

  // Particles
  const P = await waitForGlobal(()=>window.Particles, 900);
  if(!P){
    console.warn('[HygieneBoot] window.Particles not found');
    showBanner('⚠️ FX ไม่พร้อม (particles.js อาจหาย/404)');
  }

  // Quiz bank
  const bank = await waitForGlobal(()=>window.HHA_HYGIENE_QUIZ_BANK, 900);
  if(!bank){
    console.warn('[HygieneBoot] HHA_HYGIENE_QUIZ_BANK not found');
    showBanner('⚠️ Quiz bank ไม่พร้อม (hygiene-quiz-bank.js อาจหาย/404)');
  }

  // Import engine
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

  startHeartbeatWatch();

  try{
    engine.boot();
    console.log('[HygieneBoot] engine.boot OK');
  }catch(err){
    showFatal('engine.boot() crash', err);
  }
}

main();