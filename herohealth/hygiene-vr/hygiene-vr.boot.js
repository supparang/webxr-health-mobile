// === /herohealth/hygiene-vr/hygiene-vr.boot.js ===
// Boot HygieneVR — PRODUCTION (anti-stall + diagnostics)
// ✅ Imports engine: hygiene.safe.js (must export boot)
// ✅ Detects missing CSS / missing quiz bank / missing particles
// ✅ Shows readable error on screen (not "stuck")
'use strict';

function $id(id){ return document.getElementById(id); }

function showBanner(msg){
  const banner = $id('banner');
  if(!banner) return;
  banner.textContent = String(msg || '');
  banner.classList.add('show');
  clearTimeout(showBanner._t);
  showBanner._t = setTimeout(()=>banner.classList.remove('show'), 1400);
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

function waitDeferScriptsReady(){
  // defer scripts run after parsing; DOMContentLoaded is a good "everything defer loaded" signal
  return new Promise((resolve)=>{
    if(document.readyState === 'interactive' || document.readyState === 'complete') resolve();
    else document.addEventListener('DOMContentLoaded', resolve, { once:true });
  });
}

function cssLoadedHint(){
  try{
    return [...document.styleSheets].some(s=>{
      try{
        const href = String(s.href||'');
        return href.includes('/hygiene-vr.css');
      }catch(_){ return false; }
    });
  }catch(_){
    return false;
  }
}

async function main(){
  // 1) DOM must exist
  const stage = $id('stage');
  if(!stage){
    showFatal('ไม่พบ #stage (hygiene-vr.html ไม่ครบหรือ id ไม่ตรง)');
    return;
  }

  // 2) Wait for defer scripts (vr-ui.js / particles.js / quiz-bank.js)
  await waitDeferScriptsReady();

  // 3) CSS hint
  const sub = $id('hudSub');
  if(!cssLoadedHint()){
    console.warn('[HygieneBoot] hygiene-vr.css may be missing/blocked');
    if(sub) sub.textContent = '⚠️ CSS อาจหาย/ไม่ถูกโหลด (เช็ค Network: hygiene-vr.css)';
    showBanner('⚠️ CSS อาจยังไม่โหลด (เช็ค Network)');
  }

  // 4) Particles hint (FX)
  if(!window.Particles || typeof window.Particles.popText !== 'function'){
    console.warn('[HygieneBoot] Particles not ready (FX may be missing)');
    showBanner('⚠️ FX ยังไม่พร้อม (particles.js อาจไม่โหลด)');
  }else{
    console.log('[HygieneBoot] Particles OK');
  }

  // 5) Quiz bank hint
  if(!Array.isArray(window.HHA_HYGIENE_QUIZ_BANK) || !window.HHA_HYGIENE_QUIZ_BANK.length){
    console.warn('[HygieneBoot] Quiz bank missing/empty: window.HHA_HYGIENE_QUIZ_BANK');
    showBanner('⚠️ Quiz bank ไม่พบ (hygiene-quiz-bank.js อาจไม่โหลด)');
  }else{
    console.log('[HygieneBoot] QuizBank OK:', window.HHA_HYGIENE_QUIZ_BANK.length);
  }

  // 6) Import engine safely
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

  // 7) Run engine boot
  try{
    engine.boot();
    console.log('[HygieneBoot] engine.boot OK');
    if(sub) sub.textContent = 'RUN OK ✅ (กด Start ได้เลย)';
  }catch(err){
    showFatal('engine.boot() crash', err);
  }
}

main();