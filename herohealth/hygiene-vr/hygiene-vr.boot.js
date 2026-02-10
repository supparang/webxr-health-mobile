// === /herohealth/hygiene-vr/hygiene-vr.boot.js ===
// Boot HygieneVR — PRODUCTION (anti-stall + diagnostics + harden)
// PATCH v20260206m
//
// ✅ Imports engine: hygiene.safe.js (must export boot)
// ✅ If missing DOM or import fails -> show readable error on screen
// ✅ Warn if particles.js or quiz bank missing
// ✅ Adds watchdog for "stall/freeze" (RAF + hha:time heartbeat)
// ✅ Hooks window.onerror + unhandledrejection for on-screen error
//
'use strict';

function $id(id){ return document.getElementById(id); }

function showBanner(msg, ms=1800){
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
        <span style="color:#94a3b8">ตรวจ Console/Network ว่าไฟล์ 404 หรือ import ผิด</span><br>
        <button id="btnReloadGame" style="margin-top:10px;padding:10px 12px;border-radius:14px;border:1px solid rgba(148,163,184,.18);background:rgba(15,23,42,.75);color:#e5e7eb;font-weight:900;cursor:pointer">🔄 Reload เกม</button>
      `;
      setTimeout(()=>{
        const b = document.getElementById('btnReloadGame');
        if(b) b.onclick = ()=>location.reload();
      }, 0);
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

/* -----------------------------
   Anti-stall watchdog
   - RAF heartbeat: checks if frames keep moving
   - hha:time heartbeat: checks engine tick loop still alive
-------------------------------- */
function installWatchdog(){
  const state = {
    lastRafMs: performance.now(),
    lastTimeEvtMs: performance.now(),
    rafOk: true,
    timeEvtOk: true,
    armed: false,
    // thresholds
    stallWarnMs: 1500,
    stallHardMs: 2800,
    timer: null
  };

  function pokeRAF(){
    state.lastRafMs = performance.now();
  }
  function onTimeEvt(){
    state.lastTimeEvtMs = performance.now();
  }

  // listen to engine time events once it starts emitting
  window.addEventListener('hha:time', onTimeEvt);

  // RAF pulse
  (function rafLoop(){
    pokeRAF();
    requestAnimationFrame(rafLoop);
  })();

  function ensureOverlayButton(){
    const startOverlay = $id('startOverlay');
    if(!startOverlay) return;

    const card = startOverlay.querySelector('.hw-card');
    if(!card) return;

    let btn = document.getElementById('btnReloadGame2');
    if(btn) return;

    const row = card.querySelector('.hw-card-row');
    if(!row) return;

    btn = document.createElement('button');
    btn.id = 'btnReloadGame2';
    btn.type = 'button';
    btn.className = 'hw-ghost';
    btn.textContent = '🔄 Reload เกม';
    btn.addEventListener('click', ()=>location.reload(), { passive:true });
    row.appendChild(btn);
  }

  function showStall(kind){
    // kind: 'warn' | 'hard'
    const startOverlay = $id('startOverlay');
    const sub = $id('hudSub');

    if(kind === 'warn'){
      showBanner('⚠️ เกมเหมือนสะดุด… ถ้ายังไม่หายให้กด Reload', 2200);
      if(sub) sub.textContent = '⚠️ stall detected (try reload)';
      return;
    }

    showBanner('❌ เกมค้าง (stall) — กด Reload เกม', 2600);
    if(sub) sub.textContent = '❌ stall hard — reload recommended';

    if(startOverlay){
      const cardSub = startOverlay.querySelector('.hw-card-sub');
      if(cardSub){
        cardSub.innerHTML = `
          <b style="color:#fca5a5">เกมค้าง/สะดุด</b><br>
          <span style="color:#94a3b8">แนะนำกด Reload เกม (มักเกิดจาก memory/JS error/มือถือหน่วง)</span><br>
          <span style="color:#94a3b8">เปิด Console ดู error ได้</span>
        `;
      }
      ensureOverlayButton();
      startOverlay.style.display = 'grid';
    }
  }

  state.timer = setInterval(()=>{
    const now = performance.now();
    const rafGap = now - state.lastRafMs;
    const timeGap = now - state.lastTimeEvtMs;

    // NOTE: บางเครื่อง RAF ยังเดินแต่เกมหยุด (engine tick หยุด) => timeGap จะช่วยจับ
    // เราจะเริ่มตรวจจริงจังหลังโหลดไปสักครู่
    if(!state.armed){
      if(timeGap < 1200) state.armed = true; // engine ส่ง time แล้ว => armed
      return;
    }

    const stalled = (rafGap > state.stallHardMs) || (timeGap > state.stallHardMs);
    const warned  = (rafGap > state.stallWarnMs) || (timeGap > state.stallWarnMs);

    if(stalled) showStall('hard');
    else if(warned) showStall('warn');
  }, 450);

  return state;
}

async function main(){
  // Error hooks -> show on-screen immediately (avoid "ค้างเงียบ")
  window.addEventListener('error', (ev)=>{
    try{
      const msg = (ev && ev.message) ? ev.message : 'Unknown error';
      showFatal(`Runtime error: ${msg}`, ev && (ev.error || ev));
    }catch{}
  });

  window.addEventListener('unhandledrejection', (ev)=>{
    try{
      const r = ev && ev.reason;
      const msg = (r && (r.message || String(r))) || 'Unhandled promise rejection';
      showFatal(`Promise error: ${msg}`, r);
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
    showBanner('⚠️ CSS อาจไม่ถูกโหลด (ตรวจ Network)', 2200);
  }

  // Wait a bit for deferred scripts to populate globals
  // particles.js -> window.Particles
  const P = await waitForGlobal(()=>window.Particles, 1100);
  if(!P){
    console.warn('[HygieneBoot] window.Particles not found (particles.js missing?)');
    showBanner('⚠️ FX ไม่พร้อม (particles.js อาจหาย/404)', 2200);
  }

  // quiz bank -> window.HHA_HYGIENE_QUIZ_BANK (from hygiene-quiz-bank.js)
  const bank = await waitForGlobal(()=>window.HHA_HYGIENE_QUIZ_BANK, 1100);
  if(!bank){
    console.warn('[HygieneBoot] HHA_HYGIENE_QUIZ_BANK not found (hygiene-quiz-bank.js missing?)');
    showBanner('⚠️ Quiz bank ไม่พร้อม (hygiene-quiz-bank.js อาจหาย/404)', 2200);
  }else{
    try{ console.log('[HygieneBoot] quiz bank:', bank.length); }catch{}
  }

  // Install watchdog (after DOM ready)
  installWatchdog();

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