// === /herohealth/hygiene-vr/hygiene-vr.boot.js ===
// Boot HygieneVR — PRODUCTION (anti-stall + diagnostics)
//
// ✅ Imports engine: ./hygiene.safe.js  (must export boot())
// ✅ Detects common stalls: missing #stage / missing CSS / missing quiz bank / missing particles
// ✅ Shows readable fatal error on screen (instead of "ค้าง")
// ✅ Keeps game playable even if quiz bank missing (quiz simply won't open)

'use strict';

function $id(id){ return document.getElementById(id); }

function setTextSafe(el, txt){
  try{ if(el) el.textContent = String(txt ?? ''); }catch{}
}
function setHtmlSafe(el, html){
  try{ if(el) el.innerHTML = String(html ?? ''); }catch{}
}

function showBanner(msg){
  const banner = $id('banner');
  if(!banner) return;
  banner.textContent = String(msg ?? '');
  banner.classList.add('show');
  clearTimeout(showBanner._t);
  showBanner._t = setTimeout(()=>{ try{ banner.classList.remove('show'); }catch{} }, 1400);
}

function showFatal(msg, err){
  console.error('[HygieneBoot]', msg, err || '');
  const sub = $id('hudSub');
  const startOverlay = $id('startOverlay');

  setTextSafe(sub, `BOOT ERROR: ${msg}`);
  showBanner(`❌ ${msg}`);

  if(startOverlay){
    const cardSub = startOverlay.querySelector('.hw-card-sub');
    setHtmlSafe(cardSub, `
      <b style="color:#fca5a5">เกิดปัญหาโหลดเกม</b><br>
      <span style="color:#94a3b8">${msg}</span><br>
      <span style="color:#94a3b8">เปิด Console/Network ดูว่าไฟล์ 404 หรือ import ผิด</span>
    `);
    startOverlay.style.display = 'grid';
  }
}

function hasStylesheetIncludes(part){
  try{
    const sheets = Array.from(document.styleSheets || []);
    for(const s of sheets){
      try{
        const href = (s && s.href) ? String(s.href) : '';
        if(href.includes(part)) return true;
      }catch{}
    }
  }catch{}
  return false;
}

function warnNonBlocking(msg){
  console.warn('[HygieneBoot]', msg);
  const sub = $id('hudSub');
  if(sub){
    // อย่าแทนที่ถ้ามี error อยู่แล้ว
    const cur = String(sub.textContent || '');
    if(!cur.startsWith('BOOT ERROR')){
      sub.textContent = `⚠️ ${msg}`;
    }
  }
  showBanner(`⚠️ ${msg}`);
}

// Optional: fetch HEAD check (works on GitHub Pages)
async function checkUrlOk(rel){
  try{
    const u = new URL(rel, location.href).toString();
    const r = await fetch(u, { method:'HEAD', cache:'no-store' });
    return !!(r && r.ok);
  }catch{
    return false;
  }
}

async function main(){
  // DOM must exist
  const stage = $id('stage');
  if(!stage){
    showFatal('ไม่พบ #stage (hygiene-vr.html ไม่ครบหรือ id ไม่ตรง)');
    return;
  }

  // CSS check (common "everything looks gone" cause)
  const cssOk =
    hasStylesheetIncludes('/hygiene-vr.css') ||
    hasStylesheetIncludes('hygiene-vr.css');

  if(!cssOk){
    // ลองเช็ค HEAD ว่าไฟล์มีจริงไหม (กันพาธผิด/ไฟล์หาย)
    const headOk = await checkUrlOk('./hygiene-vr.css');
    warnNonBlocking(headOk
      ? 'CSS โหลดไม่ขึ้นในหน้า (อาจโดนบล็อก/พาธมี query) — ดู Network ว่า hygiene-vr.css status อะไร'
      : 'ไม่พบไฟล์ hygiene-vr.css (404) — เอฟเฟกต์/เป้าจะดูเหมือนหาย');
  }

  // Quiz bank check (name mismatch friendly)
  // Accept both: window.HHA_HYGIENE_QUIZ_BANK
  // Your file is hygiene-quiz-bank.js (NOT hygiene.quiz-bank.js)
  const quizLoaded = Array.isArray(window.HHA_HYGIENE_QUIZ_BANK) && window.HHA_HYGIENE_QUIZ_BANK.length > 0;
  if(!quizLoaded){
    warnNonBlocking('Quiz bank ยังไม่ถูกโหลด (window.HHA_HYGIENE_QUIZ_BANK ว่าง) — เกมยังเล่นได้ แต่ Quiz จะไม่ขึ้น');
  }

  // Particles check (effects)
  // Note: Particles layer z-index 9999; should appear if file loaded
  if(!window.Particles || typeof window.Particles.popText !== 'function'){
    // ไม่ทำ fatal เพราะเกมยังเล่นได้
    warnNonBlocking('Particles ยังไม่พร้อม (effects อาจไม่แสดง) — เช็คว่า ../vr/particles.js โหลดสำเร็จหรือ 404');
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

    // If user feels "ค้าง": it’s usually overlay still showing (needs Start)
    // Show small nudge once.
    setTimeout(()=>{
      const startOverlay = $id('startOverlay');
      const isVisible = startOverlay && (getComputedStyle(startOverlay).display !== 'none');
      if(isVisible){
        showBanner('กด ▶ Start เพื่อเริ่มภารกิจ');
      }
    }, 600);

  }catch(err){
    showFatal('engine.boot() crash', err);
  }
}

main();