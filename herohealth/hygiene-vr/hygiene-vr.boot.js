// === /herohealth/hygiene-vr/hygiene-vr.boot.js ===
// Boot HygieneVR — PRODUCTION (anti-stall + diagnostics)
//
// ✅ Imports engine: hygiene.safe.js (must export boot)
// ✅ If missing DOM or import fails -> show readable error on screen
// ✅ Detect quiz bank presence + Particles presence
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
  if(sub) sub.textContent = `⚠️ ${msg}`;
}

function hasLoadedScriptPart(part){
  const ss = document.querySelectorAll('script[src]');
  for(const s of ss){
    const src = String(s.getAttribute('src')||'');
    if(src.includes(part)) return true;
  }
  return false;
}

async function main(){
  // DOM must exist
  const stage = $id('stage');
  if(!stage){
    showFatal('ไม่พบ #stage (hygiene-vr.html ไม่ครบหรือ id ไม่ตรง)');
    return;
  }

  // Quick presence hints (non-blocking)
  if(!hasLoadedScriptPart('/vr/particles.js') && !hasLoadedScriptPart('../vr/particles.js')){
    showWarn('particles.js อาจไม่ถูกโหลด → เอฟเฟกต์ (FX) จะไม่ขึ้น');
  }
  if(!hasLoadedScriptPart('hygiene-quiz-bank.js')){
    showWarn('hygiene-quiz-bank.js อาจไม่ถูกโหลด → Quiz จะไม่ขึ้น');
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

    // Post diagnostics (after boot)
    const hasParticles = !!window.Particles;
    const quizCount = Array.isArray(window.HHA_HYGIENE_QUIZ_BANK) ? window.HHA_HYGIENE_QUIZ_BANK.length : 0;

    console.log('[HygieneBoot] OK', { hasParticles, quizCount });

    if(!hasParticles){
      showWarn('Particles ไม่พร้อม (window.Particles 없음) → FX จะหาย');
    }
    if(quizCount <= 0){
      showWarn('Quiz bank ว่าง/ไม่พบ (window.HHA_HYGIENE_QUIZ_BANK) → Quiz จะไม่สุ่ม');
    }
  }catch(err){
    showFatal('engine.boot() crash', err);
  }
}

main();