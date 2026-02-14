// === /herohealth/hygiene-vr/hygiene-vr.boot.js ===
// Boot HygieneVR — PRODUCTION (anti-stall + diagnostics + cache-bust)
// PATCH v20260211b
//
// ✅ Imports engine: hygiene.safe.js (must export boot)
// ✅ If import fails -> show readable error on screen + show tested URLs
// ✅ Cache-bust module import with ?v=... (prevents stale mobile cache)
// ✅ Warn if particles.js or quiz bank missing
//
'use strict';

function $id(id){ return document.getElementById(id); }

function showBanner(msg){
  const banner = $id('banner');
  if(!banner) return;
  banner.textContent = msg;
  banner.classList.add('show');
  clearTimeout(showBanner._t);
  showBanner._t = setTimeout(()=>banner.classList.remove('show'), 1600);
}

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
      const hint = `
<b style="color:#fca5a5">เกิดปัญหาโหลดเกม</b><br>
<span style="color:#94a3b8">${msg}</span><br>
<span style="color:#94a3b8">
แนะนำตรวจ Network ว่าไฟล์ 404/blocked หรือ cache เก่า<br>
• เปิด Chrome DevTools → Network → ดู hygiene.safe.js<br>
• ถ้าเป็นมือถือ: ลองเปิดลิงก์แบบ <b>Ctrl+F5</b> หรือเพิ่ม <b>&v=...</b> ที่ URL
</span>
`;
      card.innerHTML = hint;
    }
    startOverlay.style.display = 'grid';
  }
}

function hasCssHref(part){
  try{
    return [...document.styleSheets].some(s=>{
      try{ return (s.href||'').includes(part); }catch{ return false; }
    });
  }catch{ return false; }
}

function waitForGlobal(getter, ms){
  const t0 = Date.now();
  return new Promise((resolve)=>{
    (function tick(){
      try{
        const v = getter();
        if(v) return resolve(v);
      }catch{}
      if(Date.now() - t0 >= ms) return resolve(null);
      setTimeout(tick, 50);
    })();
  });
}

// ✅ build cache-bust token (prefer HTML/CSS version param, fallback to time)
function getBuildToken(){
  // allow override by URL ?v=20260211b
  const u = new URL(location.href);
  const v = u.searchParams.get('v');
  if(v) return String(v);

  // if hygiene-vr.boot.js is loaded with ?v=... in HTML, we still want a stable token:
  // Use a short "day token" to reduce cache issues without changing every refresh.
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,'0');
  const day = String(d.getDate()).padStart(2,'0');
  return `${y}${m}${day}a`; // e.g., 20260214a
}

async function main(){
  // DOM must exist
  const stage = $id('stage');
  if(!stage){
    showFatal('ไม่พบ #stage (hygiene-vr.html ไม่ครบหรือ id ไม่ตรง)');
    return;
  }

  // CSS hint
  const cssOk = hasCssHref('/hygiene-vr.css');
  if(!cssOk){
    console.warn('[HygieneBoot] hygiene-vr.css may be missing or blocked');
    const sub = $id('hudSub');
    if(sub) sub.textContent = '⚠️ CSS อาจหาย/ไม่ถูกโหลด (เช็ค Network: hygiene-vr.css)';
    showBanner('⚠️ CSS อาจไม่ถูกโหลด (ตรวจ Network)');
  }

  // Wait a bit for deferred scripts to populate globals
  // particles.js -> window.Particles
  const P = await waitForGlobal(()=>window.Particles, 900);
  if(!P){
    console.warn('[HygieneBoot] window.Particles not found (particles.js missing?)');
    showBanner('⚠️ FX ไม่พร้อม (particles.js อาจหาย/404)');
  }

  // quiz bank -> window.HHA_HYGIENE_QUIZ_BANK
  const bank = await waitForGlobal(()=>window.HHA_HYGIENE_QUIZ_BANK, 900);
  if(!bank){
    console.warn('[HygieneBoot] HHA_HYGIENE_QUIZ_BANK not found (hygiene-quiz-bank.js missing?)');
    showBanner('⚠️ Quiz bank ไม่พร้อม (hygiene-quiz-bank.js อาจหาย/404)');
  }else{
    try{ console.log('[HygieneBoot] quiz bank:', bank.length); }catch{}
  }

  // ✅ Import engine safely (cache-bust)
  const build = getBuildToken();

  // Keep same folder: ./hygiene.safe.js
  const engineUrl = new URL('./hygiene.safe.js', location.href);
  engineUrl.searchParams.set('v', build);

  let engine;
  try{
    engine = await import(engineUrl.href);
  }catch(err){
    // Help user debug: show exact URL we tried
    const msg =
      `import hygiene.safe.js ไม่สำเร็จ (ไฟล์หาย/พาธผิด/ไม่ใช่ module)\n`+
      `ลองเปิด URL นี้ตรง ๆ ดูว่าได้ 200 ไหม:\n${engineUrl.href}`;
    showFatal(msg, err);
    return;
  }

  if(!engine || typeof engine.boot !== 'function'){
    showFatal('hygiene.safe.js ต้อง export function boot()');
    return;
  }

  // Run engine boot
  try{
    engine.boot();
    console.log('[HygieneBoot] engine.boot OK', { build, engineUrl: engineUrl.href });
    showBanner('✅ โหลดเกมสำเร็จ');
  }catch(err){
    showFatal('engine.boot() crash', err);
  }
}

main();