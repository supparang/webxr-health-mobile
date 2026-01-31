// === /herohealth/hygiene-vr/hygiene-vr.boot.js ===
// Boot HygieneVR — PRODUCTION (anti-stall + diagnostics + quiz/particles check)
//
// ✅ Imports engine: hygiene.safe.js (must export boot)
// ✅ If missing DOM or import fails -> show readable error on screen
// ✅ Checks: hygiene-vr.css loaded, particles.js loaded, quiz bank loaded
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

function showWarn(msg){
  console.warn('[HygieneBoot]', msg);
  const sub = $id('hudSub');
  const banner = $id('banner');
  if(sub) sub.textContent = `⚠️ ${msg}`;
  if(banner){
    banner.textContent = `⚠️ ${msg}`;
    banner.classList.add('show');
    clearTimeout(showWarn._t);
    showWarn._t = setTimeout(()=>banner.classList.remove('show'), 1600);
  }
}

function qs(k,d=null){ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch{ return d; } }

function hasStylesheetMatch(needle){
  try{
    return [...document.styleSheets].some(s=>{
      try{ return (s.href||'').includes(needle); }catch{ return false; }
    });
  }catch{
    return false;
  }
}

function domReady(){
  if(document.readyState === 'complete' || document.readyState === 'interactive') return Promise.resolve();
  return new Promise(res=>document.addEventListener('DOMContentLoaded', res, { once:true }));
}

async function main(){
  await domReady();

  // DOM must exist
  const stage = $id('stage');
  if(!stage){
    showFatal('ไม่พบ #stage (hygiene-vr.html ไม่ครบหรือ id ไม่ตรง)');
    return;
  }

  // ✅ show start overlay if exists (กันความรู้สึกค้าง)
  const startOverlay = $id('startOverlay');
  if(startOverlay) startOverlay.style.display = 'grid';

  // ---- Quick checks (non-blocking) ----
  // CSS
  const cssOk = hasStylesheetMatch('/hygiene-vr.css');
  if(!cssOk){
    showWarn('CSS อาจหาย/ไม่ถูกโหลด (เช็ค Network: hygiene-vr.css) — ถ้าไม่มี CSS เป้า/เลย์เอาต์จะเพี้ยน');
  }

  // Particles
  // (particles.js เป็น defer ดังนั้นถ้าโหลดไม่สำเร็จ WIN.Particles จะ undefined)
  setTimeout(()=>{
    if(!window.Particles){
      showWarn('particles.js ไม่พร้อม (เอฟเฟกต์จะไม่ขึ้น) — เช็ค Network: ../vr/particles.js ต้อง 200');
    }
  }, 450);

  // Quiz bank
  // ✅ ตอนนี้ชื่อไฟล์ของคุณคือ hygiene-quiz-bank.js (มี dash)
  // run html ต้องโหลด script นี้ให้สำเร็จก่อน engine จะเรียกใช้ quiz ได้
  setTimeout(()=>{
    const bank = window.HHA_HYGIENE_QUIZ_BANK;
    if(!Array.isArray(bank) || !bank.length){
      showWarn('Quiz bank ยังไม่ถูกโหลด — ต้องมี window.HHA_HYGIENE_QUIZ_BANK (เช็คไฟล์ hygiene-quiz-bank.js / path ถูกไหม)');
    }else{
      console.log('[HygieneBoot] Quiz bank OK:', bank.length);
    }
  }, 450);

  // ---- Import engine safely ----
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

  // ---- Run engine boot ----
  try{
    engine.boot();
    console.log('[HygieneBoot] engine.boot OK');
  }catch(err){
    showFatal('engine.boot() crash', err);
  }
}

// Global trap (กันเงียบ)
window.addEventListener('error', (e)=>{
  try{
    const msg = (e && (e.message || e.error?.message)) || 'Unknown error';
    showWarn(`JS error: ${msg}`);
  }catch{}
});
window.addEventListener('unhandledrejection', (e)=>{
  try{
    const msg = (e && (e.reason?.message || String(e.reason))) || 'Unhandled rejection';
    showWarn(`Promise error: ${msg}`);
  }catch{}
});

main();