// === /herohealth/hygiene-vr/hygiene-vr.boot.js ===
// Boot HygieneVR — PRODUCTION (anti-stall + diagnostics) [LATEST]
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
        <span style="color:#94a3b8">เช็ค Console/Network: 404, path, module import</span>
      `;
    }
    startOverlay.style.display = 'grid';
  }
}

function diagSoft(){
  try{
    const qb = (window.HHA_HYGIENE_QUIZ_BANK && Array.isArray(window.HHA_HYGIENE_QUIZ_BANK))
      ? window.HHA_HYGIENE_QUIZ_BANK.length : 0;

    const fxOk = !!(window.Particles && typeof window.Particles.popText==='function');

    const sub = $id('hudSub');
    if(sub){
      const bits = [];
      bits.push(qb ? `quizOK(${qb})` : 'quizMISSING');
      bits.push(fxOk ? 'fxOK' : 'fxMISSING');
      sub.textContent = (sub.textContent || 'ready…') + ` • ${bits.join(' • ')}`;
    }
  }catch{}
}

async function main(){
  const stage = $id('stage');
  if(!stage){
    showFatal('ไม่พบ #stage (hygiene-vr.html ไม่ครบหรือ id ไม่ตรง)');
    return;
  }

  // CSS presence hint
  const cssOk = [...document.styleSheets].some(s=>{
    try{ return (s.href||'').includes('/hygiene-vr.css'); }catch{ return false; }
  });
  if(!cssOk){
    console.warn('[HygieneBoot] hygiene-vr.css may be missing or blocked');
    const sub = $id('hudSub');
    if(sub) sub.textContent = '⚠️ CSS อาจหาย/ไม่ถูกโหลด (เช็ค Network: hygiene-vr.css)';
  }

  // small diagnostics (quiz/fx)
  diagSoft();

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

  try{
    engine.boot();
    console.log('[HygieneBoot] engine.boot OK');
    diagSoft();
  }catch(err){
    showFatal('engine.boot() crash', err);
  }
}

main();