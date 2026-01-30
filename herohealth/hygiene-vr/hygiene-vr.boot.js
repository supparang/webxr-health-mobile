// === /herohealth/hygiene-vr/hygiene-vr.boot.js ===
// Boot HygieneVR — PRODUCTION (anti-stall + diagnostics)
//
// ✅ Imports engine: hygiene.safe.js (must export boot)
// ✅ If missing DOM or import fails -> show readable error on screen
// ✅ Warn if CSS / quiz bank missing (non-fatal)

'use strict';

function $id(id){ return document.getElementById(id); }

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

function showWarn(msg){
  console.warn('[HygieneBoot]', msg);
  const sub = $id('hudSub');
  if(sub) sub.textContent = `⚠️ ${msg}`;
}

async function main(){
  const stage = $id('stage');
  if(!stage){
    showFatal('ไม่พบ #stage (hygiene-vr.html ไม่ครบหรือ id ไม่ตรง)');
    return;
  }

  // CSS presence hint (non-blocking)
  const cssOk = [...document.styleSheets].some(s=>{
    try{ return (s.href||'').includes('/hygiene-vr.css'); }catch{ return false; }
  });
  if(!cssOk){
    showWarn('CSS อาจหาย/ไม่ถูกโหลด (เช็ค Network: hygiene-vr.css)');
  }

  // Quiz bank presence hint (non-blocking)
  if(!Array.isArray(window.HHA_HYGIENE_QUIZ_BANK) || !window.HHA_HYGIENE_QUIZ_BANK.length){
    showWarn('Quiz bank ยังไม่พร้อม (เช็ค hygiene-quiz-bank.js โหลดได้ไหม)');
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
  }catch(err){
    showFatal('engine.boot() crash', err);
  }
}

main();