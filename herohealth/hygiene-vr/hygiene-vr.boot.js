// === /herohealth/hygiene-vr/hygiene-vr.boot.js ===
// Boot HygieneVR — PRODUCTION (anti-stall + diagnostics)
//
// ✅ Imports engine: ./hygiene.safe.js (must export boot)
// ✅ Shows readable error on screen (ไม่ “ค้างเงียบ”)
// ✅ Warns if CSS/QuizBank missing (404 บ่อยสุด)
// ✅ Does NOT require quiz bank to run (เกมเล่นได้แม้ไม่มี quiz)
//
// Usage (in hygiene-vr.html):
// <script type="module" src="./hygiene-vr.boot.js?v=..."></script>

'use strict';

function $id(id){ return document.getElementById(id); }

function setText(id, txt){
  const el = $id(id);
  if(el) el.textContent = String(txt ?? '');
}

function showBanner(msg){
  const banner = $id('banner');
  if(!banner) return;
  banner.textContent = String(msg ?? '');
  banner.classList.add('show');
}

function showFatal(msg, err){
  console.error('[HygieneBoot]', msg, err||'');
  setText('hudSub', `BOOT ERROR: ${msg}`);
  showBanner(`❌ ${msg}`);

  const startOverlay = $id('startOverlay');
  if(startOverlay){
    const sub = startOverlay.querySelector('.hw-card-sub');
    if(sub){
      sub.innerHTML = `
        <b style="color:#fca5a5">เกิดปัญหาโหลดเกม</b><br>
        <span style="color:#94a3b8">${escapeHtml(msg)}</span><br>
        <span style="color:#94a3b8">เปิด DevTools → Console/Network ดูว่าไฟล์ 404 หรือ import ผิด</span>
      `;
    }
    startOverlay.style.display = 'grid';
  }
}

function escapeHtml(s){
  return String(s ?? '').replace(/[&<>"']/g, (c)=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

function hasStylesheetIncludes(token){
  try{
    return [...document.styleSheets].some(ss=>{
      try{ return (ss.href||'').includes(token); }catch(_){ return false; }
    });
  }catch(_){ return false; }
}

function wait(ms){ return new Promise(r=>setTimeout(r, ms)); }

async function main(){
  // ---- DOM must exist
  const stage = $id('stage');
  if(!stage){
    showFatal('ไม่พบ #stage (hygiene-vr.html ไม่ครบหรือ id ไม่ตรง)');
    return;
  }

  // ---- CSS hint
  // NOTE: on GitHub pages href อาจเป็น full url; ใช้ token คร่าว ๆ
  const cssOk = hasStylesheetIncludes('/hygiene-vr.css') || hasStylesheetIncludes('hygiene-vr.css');
  if(!cssOk){
    console.warn('[HygieneBoot] hygiene-vr.css may be missing/blocked');
    setText('hudSub', '⚠️ CSS อาจหาย/ไม่ถูกโหลด (เช็ค Network: hygiene-vr.css)');
  }

  // ---- Quiz bank hint (ไม่บังคับ)
  // ของคุณชื่อ hygiene-quiz-bank.js (ขีดกลาง)
  const quizBankReady = Array.isArray(window.HHA_HYGIENE_QUIZ_BANK) && window.HHA_HYGIENE_QUIZ_BANK.length > 0;
  if(!quizBankReady){
    console.warn('[HygieneBoot] Quiz bank not ready (ok). Expected: window.HHA_HYGIENE_QUIZ_BANK');
    // อย่า fatal เพราะเกมเล่นได้
  } else {
    console.log('[HygieneBoot] Quiz bank ready:', window.HHA_HYGIENE_QUIZ_BANK.length);
  }

  // ---- Import engine safely
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

  // ---- Anti-stall: ถ้า boot แล้วไม่เปลี่ยนสถานะใด ๆ ภายใน X ms ให้เตือน
  const t0 = Date.now();
  const startOverlay = $id('startOverlay');
  const hudSub = $id('hudSub');

  let booted = false;
  try{
    engine.boot();
    booted = true;
    console.log('[HygieneBoot] engine.boot OK');
  }catch(err){
    showFatal('engine.boot() crash', err);
    return;
  }

  // ---- After-boot sanity checks
  // 1) start overlay should be visible initially (จนกด Start)
  // 2) hudSub should have mode/diff/seed/view text soon
  await wait(250);

  if(booted){
    // ถ้า overlay หายไปเองโดยไม่กด start อาจโดนสคริปต์อื่นปิด
    if(startOverlay && getComputedStyle(startOverlay).display === 'none'){
      console.warn('[HygieneBoot] startOverlay hidden early (ok if auto-start, otherwise check code)');
    }

    // ถ้า hudSub ยัง "ready…" นาน ๆ แปลว่า setHud ไม่ถูกเรียก/DOM id ไม่ตรง
    if(hudSub && (hudSub.textContent||'').trim() === 'ready…'){
      console.warn('[HygieneBoot] hudSub not updated yet; check ids or setHud()');
    }
  }

  // ---- Stall warning (ไม่ใช่ fatal)
  await wait(1200);
  const stillReady = hudSub && (hudSub.textContent||'').includes('ready');
  const overlayShown = startOverlay && getComputedStyle(startOverlay).display !== 'none';
  if(stillReady && overlayShown){
    showBanner('ℹ️ ถ้ากด Start แล้วไม่เกิดอะไร: เปิด DevTools → Console/Network ดู 404 หรือ error');
    console.warn('[HygieneBoot] Potential stall: overlay visible + hudSub not progressed', { dt: Date.now()-t0 });
  }
}

main();