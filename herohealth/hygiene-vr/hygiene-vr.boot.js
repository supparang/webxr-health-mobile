// === /herohealth/hygiene-vr/hygiene-vr.boot.js ===
// Boot HygieneVR — PRODUCTION (anti-stall + diagnostics)
//
// ✅ Imports engine: hygiene.safe.js (must export boot)
// ✅ If missing DOM or import fails -> show readable error on screen
// ✅ Extra diagnostics: particles.js + quiz bank presence
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

function warnHUD(msg){
  try{
    const sub = $id('hudSub');
    if(sub) sub.textContent = msg;
    console.warn('[HygieneBoot]', msg);
  }catch{}
}

async function main(){
  // DOM must exist
  const stage = $id('stage');
  if(!stage){
    showFatal('ไม่พบ #stage (hygiene-vr.html ไม่ครบหรือ id ไม่ตรง)');
    return;
  }

  // CSS presence hints (non-blocking)
  const cssOk = [...document.styleSheets].some(s=>{
    try{ return (s.href||'').includes('/hygiene-vr.css'); }catch{ return false; }
  });
  if(!cssOk){
    warnHUD('⚠️ CSS อาจหาย/ไม่ถูกโหลด (เช็ค Network: hygiene-vr.css)');
  }

  // particles presence (FX)
  if(!window.Particles){
    warnHUD('⚠️ Particles ยังไม่พร้อม (FX อาจไม่ขึ้น) — เช็ค ../vr/particles.js 404?');
  }else{
    console.log('[HygieneBoot] Particles OK');
  }

  // quiz bank presence (not fatal)
  // NOTE: ชื่อ global ต้องเป็น HHA_HYGIENE_QUIZ_BANK
  if(!Array.isArray(window.HHA_HYGIENE_QUIZ_BANK) || !window.HHA_HYGIENE_QUIZ_BANK.length){
    console.warn('[HygieneBoot] Quiz bank missing/empty: window.HHA_HYGIENE_QUIZ_BANK');
    // ไม่ fatal เพราะเกมเล่นได้แม้ไม่มี quiz
  }else{
    console.log('[HygieneBoot] Quiz bank OK:', window.HHA_HYGIENE_QUIZ_BANK.length);
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