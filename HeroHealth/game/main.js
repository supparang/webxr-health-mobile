// === /HeroHealth/game/main.js (2025-11-12 LATEST, stable) ===
'use strict';

const $  = (s)=>document.querySelector(s);
const $$ = (s)=>document.querySelectorAll(s);

const qs   = new URLSearchParams(location.search);
let MODE   = (qs.get('mode')||'goodjunk').toLowerCase();
let DIFF   = (qs.get('diff')||'normal').toLowerCase();
const DUR  = Number(qs.get('duration')||60);
const AUTOSTART = qs.get('autostart') === '1';

// ---------- HUD elements ----------
const elScore = $('#hudScore');
const elCombo = $('#hudCombo');
const elTop   = $('#hudTop');

// Time bubble (fixed, top-right of viewport)
let elTime = document.getElementById('hudTime');
if(!elTime){
  elTime = document.createElement('div');
  elTime.id = 'hudTime';
  elTime.style.cssText = `
    position:fixed; right:12px; top:12px; z-index:550;
    background:#0b1220cc; color:#e2e8f0; border:1px solid #334155;
    border-radius:999px; padding:6px 10px; font:900 12px system-ui;
    letter-spacing:.5px; box-shadow:0 8px 30px rgba(0,0,0,.35);
    transition: transform .2s ease, box-shadow .2s ease, color .2s ease, border-color .2s ease;
  `;
  document.body.appendChild(elTime);
}
function setScore(n){ if(elScore) elScore.textContent = (n|0).toLocaleString(); }
function setCombo(n){ if(elCombo) elCombo.textContent = (n|0).toLocaleString(); }
function setTimeLeft(sec){
  if(!elTime) return;
  const s = Math.max(0, sec|0);
  elTime.textContent = `TIME ${s}s`;
  // Glow เมื่อใกล้หมดเวลา
  if (s <= 10){
    elTime.style.transform = 'scale(1.08)';
    elTime.style.boxShadow = '0 0 0 3px rgba(239,68,68,.35), 0 10px 40px rgba(239,68,68,.45)';
    elTime.style.borderColor = '#ef4444';
    elTime.style.color = '#fecaca';
  } else if (s <= 20){
    elTime.style.transform = 'scale(1.04)';
    elTime.style.boxShadow = '0 0 0 3px rgba(245,158,11,.35), 0 10px 40px rgba(245,158,11,.35)';
    elTime.style.borderColor = '#f59e0b';
    elTime.style.color = '#fde68a';
  } else {
    elTime.style.transform = 'scale(1.00)';
    elTime.style.boxShadow = '0 8px 30px rgba(0,0,0,.35)';
    elTime.style.borderColor = '#334155';
    elTime.style.color = '#e2e8f0';
  }
}

// Ensure Fever bar mount
import('../vr/ui-fever.js').then(mod=>{
  try{
    const { ensureFeverBar } = mod;
    const dock = document.getElementById('feverBarDock') || elTop;
    ensureFeverBar && ensureFeverBar(dock);
  }catch{}
}).catch(()=>{});

// Load Quest HUD painter (แสดง Goal / Mini Quest)
(async ()=>{
  try{
    await import('../vr/quest-hud.js?v=' + Date.now());
    console.log('[HHA] quest-hud loaded');
  }catch(e){
    console.warn('[HHA] quest-hud failed to load', e);
  }
})();

// ---------- Relay quest updates ----------
let questState = { goal:null, mini:null };
window.addEventListener('hha:quest', (e)=>{
  questState = e.detail || {goal:null, mini:null};
  try{
    const evt = new CustomEvent('quest:update', { detail: questState });
    window.dispatchEvent(evt);
  }catch{}
});

// ---------- Score/time listeners ----------
let scoreTotal = 0;
let comboMax   = 0;   // โหมดจะคำนวณเองก็ได้; ที่นี่เก็บสำรอง
let misses     = 0;
let hits       = 0;
let lastSec    = null;

window.addEventListener('hha:score', (e)=>{
  const d = e.detail||{};
  scoreTotal = Math.max(0, (scoreTotal|0) + ((d.delta|0) || 0));
  if (d.good) hits++; else misses++;
  setScore(scoreTotal);
});
window.addEventListener('hha:time', (e)=>{
  const sec = (e.detail?.sec|0);
  if (sec !== lastSec){
    setTimeLeft(sec);
    lastSec = sec;
  }
});

// ---------- Result overlay ----------
function showResult(detail){
  const old = document.getElementById('resultOverlay'); if(old) old.remove();

  const d = detail||{};
  const hub = d.hubUrl || '/webxr-health-mobile/HeroHealth/hub.html';

  const o = document.createElement('div'); o.id='resultOverlay';
  o.innerHTML = `
  <div class="card">
    <h2>สรุปผล: ${d.mode||MODE} (${d.difficulty||DIFF})</h2>
    <div class="stats">
      <div class="pill"><div class="k">คะแนนรวม</div><div class="v">${(d.score||0).toLocaleString()}</div></div>
      <div class="pill"><div class="k">คอมโบสูงสุด</div><div class="v">${d.comboMax||0}</div></div>
      <div class="pill"><div class="k">พลาด</div><div class="v">${d.misses||0}</div></div>
      <div class="pill"><div class="k">เป้าหมาย</div><div class="v">${d.goalCleared===true?'ถึงเป้า':'ยังไม่ถึง'}</div></div>
      <div class="pill"><div class="k">เวลา</div><div class="v">${d.duration||DUR}s</div></div>
    </div>
    <div class="badge">Mini Quests ${d.questsCleared||0}/${d.questsTotal||0}</div>
    <div class="btns">
      <button id="btnRetry">เล่นอีกครั้ง</button>
      <button id="btnHub">กลับ Hub</button>
    </div>
  </div>`;
  document.body.appendChild(o);

  const badge = o.querySelector('.badge');
  const x = d.questsCleared|0, y = d.questsTotal|0;
  const r = y ? x/y : 0;
  badge.style.borderColor = r>=1 ? '#16a34a' : (r>=0.5 ? '#f59e0b' : '#ef4444');
  badge.style.background  = r>=1 ? '#16a34a22' : (r>=0.5 ? '#f59e0b22' : '#ef444422');
  badge.style.color       = r>=1 ? '#bbf7d0'   : (r>=0.5 ? '#fde68a' : '#fecaca');

  o.querySelector('#btnRetry').onclick = ()=>location.reload();
  o.querySelector('#btnHub').onclick   = ()=>location.href = hub;
}
(function injectResultCss(){
  if(document.getElementById('hha-result-css')) return;
  const css = document.createElement('style'); css.id='hha-result-css';
  css.textContent = `
  #resultOverlay{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;
    background:rgba(0,0,0,.65);z-index:999}
  #resultOverlay .card{background:#0b1220;border:1px solid #334155;border-radius:16px;color:#e2e8f0;
    min-width:320px;max-width:720px;padding:22px;box-shadow:0 20px 60px rgba(0,0,0,.45)}
  #resultOverlay h2{margin:0 0 14px 0;font:900 20px system-ui}
  #resultOverlay .stats{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;margin-bottom:10px}
  #resultOverlay .pill{background:#0f172a;border:1px solid #334155;border-radius:12px;padding:10px 12px;text-align:center}
  .pill .k{font:700 11px system-ui;color:#93c5fd;opacity:.85}
  .pill . v{font:900 18px system-ui;color:#f8fafc}
  #resultOverlay .badge{display:inline-block;margin:4px 0 14px 0;padding:6px 10px;border:2px solid #475569;border-radius:10px;font:800 12px system-ui}
  #resultOverlay .btns{display:flex;gap:10px;justify-content:flex-end}
  #resultOverlay .btns button{cursor:pointer;border:0;border-radius:10px;padding:8px 14px;font:800 14px system-ui}
  #btnRetry{background:#22c55e;color:#06270f}
  #btnHub{background:#1f2937;color:#e5e7eb}
  @media (max-width:640px){ #resultOverlay .stats{grid-template-columns:repeat(2,minmax(0,1fr))} }
  `;
  document.head.appendChild(css);
})();

// ---------- Countdown overlay ----------
function showCountdown(ms=2000){
  return new Promise(resolve=>{
    const wrap = document.createElement('div');
    wrap.id = 'countdownOverlay';
    wrap.style.cssText = `
      position:fixed; inset:0; display:flex; align-items:center; justify-content:center; z-index:700;
      background:linear-gradient(180deg, rgba(0,0,0,.35), rgba(0,0,0,.65));
      font:900 64px system-ui; color:#e2e8f0; text-shadow:0 10px 40px rgba(0,0,0,.6);
    `;
    const label = document.createElement('div');
    label.style.cssText = 'transform:scale(1); transition:transform .25s ease';
    wrap.appendChild(label);
    document.body.appendChild(wrap);

    const steps = ['3','2','1','GO!'];
    let i = 0;
    const tick = ()=>{
      label.textContent = steps[i];
      label.style.transform = 'scale(1.15)';
      setTimeout(()=>{ label.style.transform='scale(1)'; }, 150);
      i++;
      if (i >= steps.length){
        setTimeout(()=>{ try{ wrap.remove(); }catch{} resolve(); }, 250);
      } else {
        setTimeout(tick, 500);
      }
    };
    tick();
  });
}

// ---------- Mode loader ----------
async function loadModeModule(name){
  const tries = [
    `../modes/${name}.safe.js`,
    `../modes/${name}.quest.js`,
    `../modes/${name}.js`
  ];
  let lastErr = null;
  for (const url of tries){
    try{
      const mod = await import(url + `?v=${Date.now()}`);
      if (mod && (mod.boot || mod.default?.boot)) return mod;
    }catch(err){ lastErr = err; }
  }
  throw lastErr || new Error(`ไม่พบไฟล์โหมด: ${name}`);
}

// ---------- Orchestration ----------
let controller = null;
let started = false;

async function startGame(){
  if (started) return;
  started = true;

  // reset HUD
  scoreTotal = 0; misses=0; hits=0; comboMax=0;
  setScore(0); setCombo(0); setTimeLeft(DUR);

  // hide VR start panel
  try{ const p = document.getElementById('startPanel'); if(p) p.setAttribute('visible','false'); }catch{}

  await showCountdown();

  let mod;
  try{
    mod = await loadModeModule(MODE);
  }catch(err){
    alert(`เริ่มเกมไม่สำเร็จ: โหลดโหมดไม่พบ\n${(err && err.message)||err}`);
    started = false;
    return;
  }

  const boot = mod.boot || (mod.default && mod.default.boot);
  if(!boot){
    alert('เริ่มเกมไม่สำเร็จ: โมดูลไม่มีฟังก์ชัน boot()');
    started = false; return;
  }

  try{
    controller = await boot({ difficulty: DIFF, duration: DUR });
  }catch(err){
    console.error(err);
    alert('เริ่มเกมไม่สำเร็จ: เกิดข้อผิดพลาดระหว่างเริ่มโหมด');
    started = false;
  }
}

// Hook buttons
const domBtn = document.getElementById('btnStart');
if(domBtn){ domBtn.addEventListener('click', (e)=>{ e.preventDefault(); startGame(); }); }
const vrBtn = document.getElementById('vrStartBtn');
if(vrBtn){ vrBtn.addEventListener('click', (e)=>{ e.preventDefault(); startGame(); }); }

// Auto start if requested
if (AUTOSTART){ setTimeout(startGame, 0); }

// Receive end event and show overlay
window.addEventListener('hha:end', (e)=>{
  started = false;
  try{
    const d = e.detail || {};
    if (d.score == null) d.score = scoreTotal|0;
    if (d.misses == null) d.misses = misses|0;
    if (d.comboMax == null) d.comboMax = comboMax|0;
    if (d.duration == null) d.duration = DUR;
    if (d.mode == null) d.mode = MODE;
    if (d.difficulty == null) d.difficulty = DIFF;
    showResult(d);
  }catch(err){
    console.error('showResult failed', err);
  }
});
