// === /herohealth/hygiene-vr/hygiene-vr.boot.js ===
// Boot HygieneVR — PRODUCTION (anti-stall + readable diagnostics)
//
// ✅ Imports engine: ./hygiene.safe.js (must export boot)
// ✅ Verifies: stage DOM, CSS loaded, Particles loaded, Quiz bank loaded
// ✅ If missing/404/import error -> show readable error on screen (not silent stall)
// ✅ Works on GitHub Pages
//
'use strict';

function $id(id){ return document.getElementById(id); }

function setBanner(msg){
  const banner = $id('banner');
  if(!banner) return;
  banner.textContent = msg;
  banner.classList.add('show');
  clearTimeout(setBanner._t);
  setBanner._t = setTimeout(()=>banner.classList.remove('show'), 1800);
}

function setHudSub(msg){
  const sub = $id('hudSub');
  if(sub) sub.textContent = msg;
}

function showStartOverlayError(html){
  const startOverlay = $id('startOverlay');
  if(!startOverlay) return;
  const card = startOverlay.querySelector('.hw-card-sub');
  if(card) card.innerHTML = html;
  startOverlay.style.display = 'grid';
}

function showFatal(msg, err){
  console.error('[HygieneBoot]', msg, err||'');
  setHudSub(`BOOT ERROR: ${msg}`);
  setBanner(`❌ ${msg}`);

  showStartOverlayError(`
    <b style="color:#fca5a5">เกิดปัญหาโหลดเกม</b><br>
    <span style="color:#94a3b8">${msg}</span><br>
    <span style="color:#94a3b8">เปิด Console/Network ดูว่าไฟล์ 404 หรือ import ผิด</span>
  `);
}

function hasStylesheetContains(part){
  try{
    return [...document.styleSheets].some(s=>{
      try{ return (s.href||'').includes(part); }catch{ return false; }
    });
  }catch{
    return false;
  }
}

// Wait global var exists (from defer scripts)
function waitForGlobal(getter, timeoutMs){
  const t0 = Date.now();
  return new Promise(resolve=>{
    (function tick(){
      let v = null;
      try{ v = getter(); }catch{}
      if(v) return resolve(true);
      if(Date.now()-t0 > timeoutMs) return resolve(false);
      setTimeout(tick, 50);
    })();
  });
}

async function main(){
  // 1) DOM must exist
  const stage = $id('stage');
  if(!stage){
    showFatal('ไม่พบ #stage (hygiene-vr.html ไม่ครบหรือ id ไม่ตรง)');
    return;
  }

  // 2) Quick presence hints (non-blocking)
  // CSS
  const cssOk = hasStylesheetContains('/hygiene-vr/hygiene-vr.css') || hasStylesheetContains('hygiene-vr.css');
  if(!cssOk){
    console.warn('[HygieneBoot] hygiene-vr.css may be missing/blocked');
    setHudSub('⚠️ CSS อาจหาย/ไม่ถูกโหลด (เช็ค Network: hygiene-vr.css)');
    setBanner('⚠️ CSS อาจไม่โหลด (ดู Network)');
  }

  // 3) Wait for Particles + Quiz bank (defer scripts may load slightly after module starts)
  // Particles: not required, but affects "effect feels alive"
  const particlesOk = await waitForGlobal(()=>window.Particles && typeof window.Particles.popText==='function', 1200);
  if(!particlesOk){
    console.warn('[HygieneBoot] particles.js not ready/missing');
    setBanner('⚠️ เอฟเฟกต์อาจหาย (particles.js ไม่โหลด)');
  }else{
    console.log('[HygieneBoot] Particles OK');
  }

  // Quiz bank: optional, but you asked for it
  // Your real file defines: window.HHA_HYGIENE_QUIZ_BANK
  const quizOk = await waitForGlobal(()=>Array.isArray(window.HHA_HYGIENE_QUIZ_BANK) && window.HHA_HYGIENE_QUIZ_BANK.length>0, 1600);
  if(!quizOk){
    console.warn('[HygieneBoot] quiz bank missing or empty: window.HHA_HYGIENE_QUIZ_BANK');
    setBanner('⚠️ Quiz ยังไม่พร้อม (เช็ค hygiene-quiz-bank.js)');
    // not fatal
  }else{
    console.log('[HygieneBoot] Quiz bank OK:', window.HHA_HYGIENE_QUIZ_BANK.length);
  }

  // 4) Import engine safely (must be module)
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

  // 5) Run engine boot (catch crash)
  try{
    engine.boot();
    console.log('[HygieneBoot] engine.boot OK');
    setHudSub('ready ✅');
    if(particlesOk){
      try{ window.Particles.popText(window.innerWidth*0.5, window.innerHeight*0.2, 'พร้อมเริ่ม ▶', 'cyan'); }catch{}
    }
  }catch(err){
    showFatal('engine.boot() crash', err);
  }
}

main();