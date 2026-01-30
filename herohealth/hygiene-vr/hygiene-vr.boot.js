// === /herohealth/hygiene-vr/hygiene-vr.boot.js ===
// Boot HygieneVR — PRODUCTION (anti-stall + diagnostics)
// ✅ Imports engine: ./hygiene.safe.js (must export boot)
// ✅ Detect missing CSS / particles / quiz bank (shows readable warnings)
// ✅ If import fails -> show readable error on screen
'use strict';

function $id(id){ return document.getElementById(id); }

function setSub(text){
  const sub = $id('hudSub');
  if(sub) sub.textContent = String(text || '');
}
function showBanner(msg){
  const b = $id('banner');
  if(!b) return;
  b.textContent = String(msg || '');
  b.classList.add('show');
  clearTimeout(showBanner._t);
  showBanner._t = setTimeout(()=>b.classList.remove('show'), 1200);
}

function showFatal(msg, err){
  console.error('[HygieneBoot]', msg, err||'');
  setSub(`BOOT ERROR: ${msg}`);
  showBanner(`❌ ${msg}`);

  const startOverlay = $id('startOverlay');
  if(startOverlay){
    const card = startOverlay.querySelector('.hw-card-sub');
    if(card){
      card.innerHTML = `
        <b style="color:#fca5a5">เกิดปัญหาโหลดเกม</b><br>
        <span style="color:#94a3b8">${String(msg||'')}</span><br>
        <span style="color:#94a3b8">เปิด DevTools → Console/Network ดูไฟล์ 404 หรือ import ผิด</span>
      `;
    }
    startOverlay.style.display = 'grid';
  }
}

// ---------- tiny helpers ----------
async function headCheck(url, label){
  // GitHub Pages บางครั้ง HEAD อาจไม่สะดวก → fallback GET no-store
  try{
    const r = await fetch(url, { method:'HEAD', cache:'no-store' });
    if(r && r.ok) return { ok:true, label, status:r.status };
  }catch(_){}
  try{
    const r2 = await fetch(url, { method:'GET', cache:'no-store' });
    const ok = !!(r2 && r2.ok);
    return { ok, label, status: r2 ? r2.status : 0 };
  }catch(err){
    return { ok:false, label, status:0, err };
  }
}

function hasStylesheetPart(part){
  try{
    return [...document.styleSheets].some(s => (s && s.href && String(s.href).includes(part)));
  }catch(_){ return false; }
}

function resolveUrl(rel){
  try{ return new URL(rel, location.href).toString(); }
  catch(_){ return rel; }
}

async function main(){
  // DOM must exist
  const stage = $id('stage');
  if(!stage){
    showFatal('ไม่พบ #stage (hygiene-vr.html ไม่ครบหรือ id ไม่ตรง)');
    return;
  }

  // Status
  setSub('กำลังบูตเกม…');
  showBanner('🔧 Booting…');

  // 1) CSS presence (best-effort)
  const cssHrefPart = '/hygiene-vr.css';
  const cssLoaded = hasStylesheetPart(cssHrefPart);
  if(!cssLoaded){
    console.warn('[HygieneBoot] hygiene-vr.css may be missing in styleSheets');
    // ตรวจจริงด้วย fetch
    const cssUrl = resolveUrl('./hygiene-vr.css');
    const cssCheck = await headCheck(cssUrl, 'hygiene-vr.css');
    if(!cssCheck.ok){
      setSub('⚠️ CSS ไม่โหลด (hygiene-vr.css 404?) เกมอาจดูเหมือนค้าง');
      showBanner('⚠️ hygiene-vr.css ไม่เจอ (เช็คชื่อ/พาธ)');
    }else{
      setSub('⚠️ CSS อาจถูก block/cache แปลก ๆ แต่ไฟล์มีอยู่');
    }
  }

  // 2) particles.js (FX) check
  const particlesReady = !!window.Particles;
  if(!particlesReady){
    const pUrl = resolveUrl('../vr/particles.js');
    const pCheck = await headCheck(pUrl, 'particles.js');
    if(!pCheck.ok){
      console.warn('[HygieneBoot] particles.js missing:', pCheck);
      showBanner('⚠️ FX ไม่พร้อม (particles.js 404)');
      // ไม่ fatal — เกมยังเล่นได้ แค่ไม่มี FX
    }else{
      // ไฟล์มีอยู่แต่ยังไม่พร้อม (อาจ defer ยังไม่ execute)
      console.warn('[HygieneBoot] particles.js exists but window.Particles not ready yet');
    }
  }

  // 3) quiz bank check (ชื่อไฟล์ต้องตรง: hygiene-quiz-bank.js)
  const bankOk = Array.isArray(window.HHA_HYGIENE_QUIZ_BANK) && window.HHA_HYGIENE_QUIZ_BANK.length > 0;
  if(!bankOk){
    const qbUrl = resolveUrl('./hygiene-quiz-bank.js');
    const qbCheck = await headCheck(qbUrl, 'hygiene-quiz-bank.js');
    if(!qbCheck.ok){
      console.warn('[HygieneBoot] quiz bank missing:', qbCheck);
      showBanner('⚠️ Quiz bank หาย (hygiene-quiz-bank.js 404) — จะไม่สุ่มคำถาม');
    }else{
      // ไฟล์มีแต่ยังไม่ set global
      showBanner('⚠️ Quiz bank โหลดแต่ยังไม่พร้อม — เช็คชื่อ window.HHA_HYGIENE_QUIZ_BANK');
    }
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
    setSub('พร้อม! กด Start ได้เลย ✅');
    showBanner('✅ Ready!');
    console.log('[HygieneBoot] engine.boot OK');
  }catch(err){
    showFatal('engine.boot() crash', err);
  }
}

main();