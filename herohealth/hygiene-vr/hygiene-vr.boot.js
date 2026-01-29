// === /herohealth/hygiene-vr/hygiene-vr.boot.js ===
// Boot HygieneVR — PRODUCTION (anti-stall + diagnostics + self-heal)
// ✅ Imports engine: hygiene.safe.js (must export boot)
// ✅ Detects missing CSS / particles / quiz-bank and shows readable warnings
// ✅ If import fails -> show readable error on screen (not "stuck")
// ✅ Adds window.onerror / unhandledrejection to surface runtime crashes
'use strict';

function $id(id){ return document.getElementById(id); }

function setText(el, txt){
  try{ if(el) el.textContent = String(txt ?? ''); }catch{}
}

function showBanner(msg){
  const banner = $id('banner');
  if(!banner) return;
  banner.textContent = String(msg ?? '');
  banner.classList.add('show');
  clearTimeout(showBanner._t);
  showBanner._t = setTimeout(()=>banner.classList.remove('show'), 1600);
}

function showFatal(msg, err){
  console.error('[HygieneBoot]', msg, err || '');
  const sub = $id('hudSub');
  const startOverlay = $id('startOverlay');

  setText(sub, `BOOT ERROR: ${msg}`);
  showBanner(`❌ ${msg}`);

  if(startOverlay){
    const box = startOverlay.querySelector('.hw-card-sub');
    if(box){
      box.innerHTML = `
        <b style="color:#fca5a5">เกิดปัญหาโหลดเกม</b><br>
        <span style="color:#94a3b8">${msg}</span><br>
        <span style="color:#94a3b8">เปิด DevTools → Console/Network ดูว่าไฟล์ 404 หรือ import ผิด</span>
      `;
    }
    startOverlay.style.display = 'grid';
  }
}

function cssLooksLoaded(){
  // Quick check: link tag present + styleSheets includes hygiene-vr.css
  const linkOk = !!document.querySelector('link[rel="stylesheet"][href*="hygiene-vr.css"]');
  let sheetOk = false;
  try{
    sheetOk = [...document.styleSheets].some(s => (s.href || '').includes('hygiene-vr.css'));
  }catch(_){}
  return linkOk || sheetOk;
}

function particlesLooksLoaded(){
  return !!(window.Particles && (typeof window.Particles.popText === 'function'));
}

function quizBankLooksLoaded(){
  return Array.isArray(window.HHA_HYGIENE_QUIZ_BANK) && window.HHA_HYGIENE_QUIZ_BANK.length > 0;
}

function installQuizFallbackIfMissing(){
  if(quizBankLooksLoaded()) return;

  // ✅ fallback minimal (กันเกมดูเหมือน "ระบบสุ่มไม่ทำงาน")
  window.HHA_HYGIENE_QUIZ_BANK = [
    { tag:'fallback', q:'ควรล้างมือเมื่อไหร่?', a:'ก่อนกินอาหารและหลังเข้าห้องน้ำ', wrong:['เฉพาะตอนมือเปื้อน','เฉพาะตอนเช้า','ไม่ต้องล้าง'] },
    { tag:'fallback', q:'ทำไมต้องใช้สบู่ล้างมือ?', a:'สบู่ช่วยชะล้างคราบมันและเชื้อโรค', wrong:['ทำให้เล็บยาว','ทำให้มือเย็น','ทำให้จับของแน่น'] },
    { tag:'fallback', q:'คำท่อง 7 ขั้นตอนคืออะไร?', a:'ฝ่า-หลัง-ซอก-ข้อ-โป้ง-เล็บ-ข้อมือ', wrong:['หลัง-ข้อ-โป้ง','ฝ่า-ซอก-เล็บ-หลัง','โป้ง-เล็บ-ฝ่า-ซอก'] },
    { tag:'fallback', q:'ส่วนที่เชื้อมักสะสมและลืมถูบ่อย?', a:'ซอกนิ้วและปลายนิ้ว/เล็บ', wrong:['ข้อศอก','หัวเข่า','ไหล่'] },
    { tag:'fallback', q:'ล้างมือควรใช้เวลาอย่างน้อยประมาณเท่าไหร่?', a:'ประมาณ 20 วินาทีขึ้นไป', wrong:['3 วินาที','5 วินาที','ไม่ต้องถู'] }
  ];

  console.warn('[HygieneBoot] Quiz bank missing → fallback injected');
  showBanner('⚠️ Quiz bank ไม่โหลด (ใช้ชุดสำรองชั่วคราว)');
}

function installGlobalCrashHandlers(){
  // Show runtime errors on screen to avoid "stuck"
  window.addEventListener('error', (e)=>{
    const msg = e?.message || 'runtime error';
    showBanner(`❌ ${msg}`);
    console.error('[HygieneBoot] window.error', e);
  });

  window.addEventListener('unhandledrejection', (e)=>{
    showBanner('❌ promise error (unhandled)');
    console.error('[HygieneBoot] unhandledrejection', e);
  });
}

function moduleUrl(path, v){
  // Cache-bust safely (GitHub Pages sometimes sticky)
  try{
    const u = new URL(path, location.href);
    if(v) u.searchParams.set('v', String(v));
    return u.toString();
  }catch{
    return path + (v ? ('?v=' + encodeURIComponent(String(v))) : '');
  }
}

async function main(){
  installGlobalCrashHandlers();

  // DOM must exist
  const stage = $id('stage');
  if(!stage){
    showFatal('ไม่พบ #stage (hygiene-vr.html ไม่ครบหรือ id ไม่ตรง)');
    return;
  }

  // Quick warnings (non-blocking)
  const sub = $id('hudSub');
  if(!cssLooksLoaded()){
    console.warn('[HygieneBoot] hygiene-vr.css may be missing or blocked');
    setText(sub, '⚠️ CSS อาจหาย/ไม่ถูกโหลด (เช็ค Network: hygiene-vr.css)');
    showBanner('⚠️ CSS ไม่เข้า → เป้ากับเอฟเฟกต์อาจหาย');
  }

  // particles check (non-blocking)
  // (particles.js เป็น defer; ถ้า 404 จะทำให้ Effect หายหมด)
  if(!particlesLooksLoaded()){
    console.warn('[HygieneBoot] particles.js missing? window.Particles not found');
    showBanner('⚠️ Effect ไม่มา (เช็ค Network: ../vr/particles.js)');
  }

  // quiz bank check + fallback (non-blocking)
  // รองรับทั้งชื่อไฟล์เดิม/ใหม่ แต่สุดท้ายต้องได้ window.HHA_HYGIENE_QUIZ_BANK
  installQuizFallbackIfMissing();

  // Import engine safely (cache bust by day)
  const bust = '20260129a';
  let engine;
  try{
    engine = await import(moduleUrl('./hygiene.safe.js', bust));
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
    showBanner('✅ โหลดเกมสำเร็จ — กด Start ได้เลย');
    if(sub && sub.textContent === 'ready…') setText(sub, 'ready ✅');
  }catch(err){
    showFatal('engine.boot() crash', err);
  }
}

main();