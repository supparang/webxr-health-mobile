// === /herohealth/hygiene-vr/hygiene-vr.boot.js ===
// Boot HygieneVR — PRODUCTION (anti-stall + diagnostics)
//
// ✅ Imports engine: hygiene.safe.js (must export boot)
// ✅ Detects missing CSS / Quiz bank / Particles and surfaces in HUD/banner
//
'use strict';

function $id(id){ return document.getElementById(id); }

function showBanner(msg){
  const banner = $id('banner');
  if(!banner) return;
  banner.textContent = msg;
  banner.classList.add('show');
  clearTimeout(showBanner._t);
  showBanner._t = setTimeout(()=>banner.classList.remove('show'), 1500);
}

function showFatal(msg, err){
  console.error('[HygieneBoot]', msg, err||'');
  const sub = $id('hudSub');
  const startOverlay = $id('startOverlay');

  if(sub) sub.textContent = `BOOT ERROR: ${msg}`;
  showBanner(`❌ ${msg}`);

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

function hasCssHrefContains(part){
  try{
    return [...document.styleSheets].some(s=>{
      try{ return (s.href||'').includes(part); }catch{ return false; }
    });
  }catch{ return false; }
}

async function main(){
  // DOM must exist
  const stage = $id('stage');
  if(!stage){
    showFatal('ไม่พบ #stage (hygiene-vr.html ไม่ครบหรือ id ไม่ตรง)');
    return;
  }

  const sub = $id('hudSub');

  // CSS check
  const cssOk = hasCssHrefContains('/hygiene-vr.css') || hasCssHrefContains('hygiene-vr.css');
  if(!cssOk){
    console.warn('[HygieneBoot] hygiene-vr.css may be missing or blocked');
    if(sub) sub.textContent = '⚠️ CSS อาจหาย/ไม่ถูกโหลด (เช็ค Network: hygiene-vr.css)';
    showBanner('⚠️ CSS อาจไม่ถูกโหลด (เช็ค hygiene-vr.css)');
  }

  // Quiz bank check (defer script should set global)
  const quizOk = Array.isArray(window.HHA_HYGIENE_QUIZ_BANK) && window.HHA_HYGIENE_QUIZ_BANK.length > 0;
  if(!quizOk){
    console.warn('[HygieneBoot] Quiz bank missing: window.HHA_HYGIENE_QUIZ_BANK');
    showBanner('⚠️ ยังไม่มี Quiz bank (hygiene-quiz-bank.js)');
  }else{
    console.log('[HygieneBoot] Quiz bank OK:', window.HHA_HYGIENE_QUIZ_BANK.length);
  }

  // Particles check
  const fxOk = !!(window.Particles && (window.Particles.popText || window.Particles.pop));
  if(!fxOk){
    console.warn('[HygieneBoot] Particles missing: ../vr/particles.js');
    showBanner('⚠️ เอฟเฟกต์ (Particles) ยังไม่โหลด');
  }else{
    console.log('[HygieneBoot] Particles OK');
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
    if(sub && (!sub.textContent || sub.textContent.includes('ready'))){
      sub.textContent = 'พร้อมแล้ว ✅ (กด Start)';
    }
  }catch(err){
    showFatal('engine.boot() crash', err);
  }
}

main();