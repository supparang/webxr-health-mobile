// === /herohealth/hygiene-vr/hygiene-vr.boot.js ===
// Boot HygieneVR — PRODUCTION (anti-stall + diagnostics v2)
//
// ✅ Imports engine: hygiene.safe.js (must export boot)
// ✅ Warn if CSS not loaded (hygiene-vr.css)
// ✅ Warn if Quiz bank missing (window.HHA_HYGIENE_QUIZ_BANK)
// ✅ If missing DOM or import fails -> show readable error on screen
//
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

function warn(msg){
  console.warn('[HygieneBoot]', msg);
  const sub = $id('hudSub');
  if(sub && !String(sub.textContent||'').includes('⚠️')){
    sub.textContent = `⚠️ ${msg}`;
  }
}

function hasStylesheetMatch(needle){
  try{
    for(const s of document.styleSheets){
      try{
        const href = String(s && s.href ? s.href : '');
        if(href.includes(needle)) return true;
      }catch(_){}
    }
  }catch(_){}
  return false;
}

async function main(){
  // DOM must exist
  const stage = $id('stage');
  if(!stage){
    showFatal('ไม่พบ #stage (hygiene-vr.html ไม่ครบหรือ id ไม่ตรง)');
    return;
  }

  // CSS presence hints
  // NOTE: ใช้ "hygiene-vr.css" (ไม่ fix เป็น /hygiene-vr.css)
  if(!hasStylesheetMatch('hygiene-vr.css')){
    warn('CSS อาจหาย/ไม่ถูกโหลด (เช็ค Network: hygiene-vr.css)');
  }

  // Quiz bank hints (non-blocking)
  // ต้องเป็น window.HHA_HYGIENE_QUIZ_BANK จาก hygiene-quiz-bank.js
  if(!Array.isArray(window.HHA_HYGIENE_QUIZ_BANK)){
    warn('Quiz bank ยังไม่โหลด (เช็คไฟล์: hygiene-quiz-bank.js)');
  }else if(!window.HHA_HYGIENE_QUIZ_BANK.length){
    warn('Quiz bank ว่างเปล่า (HHA_HYGIENE_QUIZ_BANK.length=0)');
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