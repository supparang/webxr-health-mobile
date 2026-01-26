// === /herohealth/hygiene-vr/hygiene-vr.boot.js ===
// Boot HygieneVR — PRODUCTION (anti-stall + diagnostics + CSS fallback)

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
        <span style="color:#94a3b8">เช็ค Network: 404 / import error</span>
      `;
    }
    startOverlay.style.display = 'grid';
  }
}

function injectFallbackCss(){
  if(document.getElementById('hwFallbackCss')) return;
  const st = document.createElement('style');
  st.id = 'hwFallbackCss';
  st.textContent = `
    /* Fallback (ถ้า hygiene-vr.css ไม่มา) ให้ยังมองเห็น stage/targets */
    #gameRoot{ position:relative; min-height:100vh; }
    #stage{ position:fixed; inset:0; overflow:hidden; }
    .hw-tgt{
      position:fixed;
      left: calc(var(--x,50) * 1vw);
      top:  calc(var(--y,50) * 1vh);
      transform: translate(-50%,-50%) scale(var(--s,1));
      width: 68px; height: 68px; border-radius: 999px;
      border: 2px solid rgba(148,163,184,.25);
      background: rgba(2,6,23,.35);
      color: #fff;
      display:grid; place-items:center;
      z-index: 5;
    }
    .hw-tgt .emoji{ font-size: 34px; line-height: 1; }
  `;
  document.head.appendChild(st);
}

async function main(){
  // trap runtime errors to avoid "silent stall"
  window.addEventListener('error', (e)=> showFatal(`Runtime error: ${e.message||'unknown'}`, e.error), { once:false });
  window.addEventListener('unhandledrejection', (e)=> showFatal(`Promise rejected: ${String(e.reason||'unknown')}`, e.reason), { once:false });

  const stage = $id('stage');
  if(!stage){
    showFatal('ไม่พบ #stage (hygiene-vr.html ไม่ครบหรือ id ไม่ตรง)');
    return;
  }

  // CSS presence
  const cssOk = [...document.styleSheets].some(s=>{
    try{ return (s.href||'').includes('hygiene-vr.css'); }catch{ return false; }
  });
  if(!cssOk){
    console.warn('[HygieneBoot] hygiene-vr.css may be missing or blocked');
    const sub = $id('hudSub');
    if(sub) sub.textContent = '⚠️ CSS อาจหาย/ไม่ถูกโหลด (fallback CSS enabled)';
    injectFallbackCss(); // ✅ สำคัญ: กัน "ค้างเพราะมองไม่เห็น"
  }

  // Quiz bank presence
  if(!Array.isArray(window.HHA_HYGIENE_QUIZ_BANK) || !window.HHA_HYGIENE_QUIZ_BANK.length){
    console.warn('[HygieneBoot] Quiz bank missing: window.HHA_HYGIENE_QUIZ_BANK');
    const banner = $id('banner');
    if(banner){
      banner.textContent = '⚠️ Quiz bank ยังไม่ถูกโหลด (hygiene.quiz-bank.js)';
      banner.classList.add('show');
      setTimeout(()=>banner.classList.remove('show'), 1600);
    }
  }

  // Import engine
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
  }catch(err){
    showFatal('engine.boot() crash', err);
  }
}

main();