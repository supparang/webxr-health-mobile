// === /herohealth/hygiene-vr/hygiene-vr.boot.js ===
// Boot HygieneVR — PRODUCTION (anti-stall + diagnostics)
// ✅ Shows readable error on screen (no silent "hang")
// ✅ Checks CSS / QuizBank / Particles presence (warn only)
// ✅ Imports engine: ./hygiene.safe.js  (must export boot())
// ✅ Runs engine.boot() safely
'use strict';

function $id(id){ return document.getElementById(id); }

function showBanner(msg){
  const banner = $id('banner');
  if(!banner) return;
  banner.textContent = String(msg || '');
  banner.classList.add('show');
}

function setHudSub(msg){
  const sub = $id('hudSub');
  if(sub) sub.textContent = String(msg || '');
}

function setStartOverlayError(htmlMsg){
  const startOverlay = $id('startOverlay');
  if(!startOverlay) return;

  const sub = startOverlay.querySelector('.hw-card-sub');
  if(sub){
    sub.innerHTML = htmlMsg;
  }
  startOverlay.style.display = 'grid';
}

function showFatal(msg, err){
  console.error('[HygieneBoot]', msg, err || '');
  setHudSub(`BOOT ERROR: ${msg}`);
  showBanner(`❌ ${msg}`);

  setStartOverlayError(`
    <b style="color:#fca5a5">เกิดปัญหาโหลดเกม</b><br>
    <span style="color:#94a3b8">${String(msg || '')}</span><br>
    <span style="color:#94a3b8">แนะนำ: เปิด DevTools → Console/Network ดูไฟล์ 404 หรือ error import</span>
  `);
}

function warn(msg){
  console.warn('[HygieneBoot]', msg);
  // ไม่ fatal แค่แจ้งบน HUD ให้รู้
  const prev = ($id('hudSub')?.textContent || '');
  if(!prev || prev === 'ready…') setHudSub(`⚠️ ${msg}`);
}

function isCssLoadedContains(part){
  try{
    const sheets = Array.from(document.styleSheets || []);
    return sheets.some(s=>{
      try{
        const href = String(s.href || '');
        return href.includes(part);
      }catch(_){ return false; }
    });
  }catch(_){
    return false;
  }
}

function qs(k,d=null){
  try{ return new URL(location.href).searchParams.get(k) ?? d; }
  catch(_){ return d; }
}

async function main(){
  // 1) DOM sanity
  const stage = $id('stage');
  if(!stage){
    showFatal('ไม่พบ #stage (hygiene-vr.html ไม่ครบ หรือ id ไม่ตรง)');
    return;
  }

  // 2) CSS diagnostics (warn only)
  // NOTE: href บน github pages จะเป็น full url; ขอแค่มี "hygiene-vr.css"
  const cssOk = isCssLoadedContains('hygiene-vr.css');
  if(!cssOk){
    warn('CSS อาจหาย/ไม่ถูกโหลด (เช็ค Network: hygiene-vr.css)');
  }

  // 3) Soft-check quiz bank + particles (warn only)
  // Quiz bank โหลดแบบ defer → ปกติจะมาก่อน module boot อยู่แล้ว
  const wantQuiz = (qs('quiz','1') !== '0');
  if(wantQuiz && !Array.isArray(window.HHA_HYGIENE_QUIZ_BANK)){
    warn('Quiz bank ยังไม่มา (เช็ค hygiene-quiz-bank.js ว่าโหลดได้/ชื่อไฟล์ถูก)');
  }

  if(!window.Particles){
    warn('Particles ยังไม่มา (เช็ค ../vr/particles.js ว่าโหลดได้/พาธถูก)'); 
  }

  // 4) Import engine safely
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

  // 5) Run engine.boot safely
  try{
    engine.boot();
    console.log('[HygieneBoot] engine.boot OK');
    setHudSub('ready…'); // ให้ engine จะมาเขียนทับเอง
  }catch(err){
    showFatal('engine.boot() crash', err);
  }
}

main();