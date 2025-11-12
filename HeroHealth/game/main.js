// === /HeroHealth/game/main.js (2025-11-12 LATEST, stable) ===
'use strict';

// ---------- Short helpers ----------
const $  = (s)=>document.querySelector(s);
const $$ = (s)=>document.querySelectorAll(s);
const qs = new URLSearchParams(location.search);

// Route params
let MODE = (qs.get('mode')||'goodjunk').toLowerCase();
let DIFF = (qs.get('diff')||'normal').toLowerCase();
const AUTOSTART = qs.get('autostart') === '1';
const DURATION  = Number(qs.get('duration')||60);

// HUD refs
const elScore = $('#hudScore');
const elCombo = $('#hudCombo');
const elTop   = $('#hudTop');

// ---------- HUD: TIME bubble (top-right of score box) ----------
let elTime = document.getElementById('hudTime');
if(!elTime){
  elTime = document.createElement('div');
  elTime.id = 'hudTime';
  elTime.style.cssText = `
    position:absolute; right:12px; top:10px;
    background:#0b1220; color:#e2e8f0; border:1px solid #334155;
    border-radius:999px; padding:2px 10px; font:900 12px system-ui;
    opacity:.95; letter-spacing:.4px; transition: box-shadow .25s ease, transform .25s ease;
  `;
  const scoreBox = document.querySelector('[data-hud="scorebox"]') || $('.score-box');
  if(scoreBox){ scoreBox.style.position='relative'; scoreBox.appendChild(elTime); }
}
function setScore(n){ if(elScore) elScore.textContent = (n|0).toLocaleString(); }
function setCombo(n){ if(elCombo) elCombo.textContent = (n|0).toLocaleString(); }
function setTimeLeft(sec){
  if(!elTime) return;
  const s = Math.max(0, sec|0);
  elTime.textContent = `TIME ${s}s`;
  // glow / pulse when <= 10s
  if (s<=10){
    elTime.style.boxShadow = '0 0 0 6px rgba(239,68,68,.15), 0 0 24px rgba(239,68,68,.55)';
    elTime.style.transform = 'scale(1.05)';
  } else {
    elTime.style.boxShadow = 'none';
    elTime.style.transform = 'scale(1.0)';
  }
}

// ---------- Fever bar mount (logic inside ui-fever.js) ----------
import('../vr/ui-fever.js?v='+Date.now())
  .then(mod=>{
    try{
      const { ensureFeverBar } = mod;
      const dock = document.getElementById('feverBarDock') || elTop;
      if(ensureFeverBar) ensureFeverBar(dock);
    }catch(_){}
  }).catch(()=>{});

// ---------- Quest HUD bridge ----------
let questState = { goal:null, mini:null };
// forward mode → quest-hud
window.addEventListener('hha:quest', (e)=>{
  questState = e.detail || {goal:null, mini:null};
  try{
    const evt = new CustomEvent('quest:update', { detail: questState });
    window.dispatchEvent(evt);
  }catch(_){}
});
// ensure quest-hud loaded (safe if missing)
import('../vr/quest-hud.js?v='+Date.now()).catch(()=>{});

// ---------- Particles (score pop / shards) ----------
let PFX = null;
import('../vr/particles.js?v='+Date.now())
  .then(m=>{ PFX = m.Particles || m.default || null; })
  .catch(()=>{});

// Show score pop & burst exactly at hit point
window.addEventListener('hha:hit-screen', (e)=>{
  const d = e.detail||{};
  if (PFX?.scorePop)    PFX.scorePop(d.x|0, d.y|0, (d.delta|0)||0);
  if (PFX?.burstShards) PFX.burstShards(null, null, { screen:{x:d.x|0, y:d.y|0} });
});

// ---------- Score/Time state ----------
let scoreTotal = 0;
let comboMax   = 0;
let misses     = 0;
let hits       = 0;
let lastSec    = null;

window.addEventListener('hha:score', (e)=>{
  const d = e.detail||{};
  scoreTotal = Math.max(0, (scoreTotal|0) + (d.delta|0));
  if(d.good){ hits++; } else { misses++; }
  setScore(scoreTotal);
});

window.addEventListener('hha:time', (e)=>{
  const sec = (e.detail?.sec|0);
  if(sec!==lastSec){
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
      <div class="pill"><div class="k">เป้าหมาย</div><div class="v">${d.goalCleared===true?'ถึงเป้า':'ไม่ถึง (-)'}</div></div>
      <div class="pill"><div class="k">เวลา</div><div class="v">${d.duration||0}s</div></div>
    </div>
    <div class="badge">Mini Quests ${d.questsCleared||0}/${d.questsTotal||0}</div>
    <div class="btns">
      <button id="btnRetry">เล่นอีกครั้ง</button>
      <button id="btnHub">กลับ Hub</button>
    </div>
  </div>`;
  document.body.appendChild(o);

  // badge coloring by completion ratio
  const badge = o.querySelector('.badge');
  const x = d.questsCleared|0, y = d.questsTotal|0;
  const r = y? x/y : 0;
  badge.style.borderColor = r>=1 ? '#16a34a' : (r>=0.5 ? '#f59e0b' : '#ef4444');
  badge.style.background  = r>=1 ? '#16a34a22' : (r>=0.5 ? '#f59e0b22' : '#ef444422');
  badge.style.color       = r>=1 ? '#bbf7d0'   : (r>=0.5 ? '#fde68a' : '#fecaca');

  o.querySelector('#btnRetry').onclick = ()=>location.reload();
  o.querySelector('#btnHub').onclick   = ()=>location.href = hub;
}

// inject CSS once
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
  .pill .v{font:900 18px system-ui;color:#f8fafc}
  #resultOverlay .badge{display:inline-block;margin:4px 0 14px 0;padding:6px 10px;border:2px solid #475569;border-radius:10px;font:800 12px system-ui}
  #resultOverlay .btns{display:flex;gap:10px;justify-content:flex-end}
  #resultOverlay .btns button{cursor:pointer;border:0;border-radius:10px;padding:8px 14px;font:800 14px system-ui}
  #btnRetry{background:#22c55e;color:#06270f}
  #btnHub{background:#1f2937;color:#e5e7eb}
  @media (max-width:640px){ #resultOverlay .stats{grid-template-columns:repeat(2,minmax(0,1fr))} }
  `;
  document.head.appendChild(css);
})();

// ---------- Mode loader ----------
async function loadModeModule(name){
  const tries = [
    `../modes/${name}.safe.js`,
    `../modes/${name}.quest.js`,
    `../modes/${name}.js`,
  ];
  let lastErr=null;
  for(const url of tries){
    try{
      const mod = await import(url + `?v=${Date.now()}`);
      if (mod && (mod.boot || mod.default?.boot)) return mod;
    }catch(err){ lastErr = err; }
  }
  throw lastErr || new Error(`ไม่พบไฟล์โหมด: ${name}`);
}

// ---------- Countdown 3-2-1-GO ----------
function showCountdown(){
  return new Promise((resolve)=>{
    const id='hha-countdown';
    const old=document.getElementById(id); if(old) old.remove();
    const el = document.createElement('div'); el.id=id;
    el.innerHTML = `<div class="cd-ball">3</div>`;
    document.body.appendChild(el);

    const cssId='hha-countdown-css';
    if(!document.getElementById(cssId)){
      const css=document.createElement('style'); css.id=cssId;
      css.textContent=`
      #hha-countdown{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;z-index:850;pointer-events:none}
      #hha-countdown .cd-ball{
        min-width:120px; min-height:120px; display:flex; align-items:center; justify-content:center;
        border-radius:999px; font:900 48px system-ui; color:#e2e8f0; background:#0b1220dd; border:2px solid #334155;
        box-shadow:0 0 30px rgba(37,99,235,.55), inset 0 0 18px rgba(147,197,253,.25);
        transform:scale(0.8); opacity:.0; transition:transform .28s ease, opacity .28s ease, box-shadow .28s ease;
      }`;
      document.head.appendChild(css);
    }

    const ball = el.firstElementChild;
    const seq = ['3','2','1','GO!'];
    let i=0;
    const tick=()=>{
      if(i>=seq.length){ setTimeout(()=>{ try{el.remove();}catch{} resolve(); }, 120); return; }
      ball.textContent = seq[i++];
      ball.style.opacity='1'; ball.style.transform='scale(1.0)';
      setTimeout(()=>{ ball.style.opacity='.0'; ball.style.transform='scale(0.8)'; setTimeout(tick, 120); }, 520);
    };
    setTimeout(tick, 40);
  });
}

// ---------- Start/stop orchestration ----------
let controller = null;
let started = false;

async function startGame(){
  if (started) return;
  started = true;

  // reset HUD
  scoreTotal=0; misses=0; hits=0; comboMax=0;
  setScore(0); setCombo(0); setTimeLeft(DURATION);

  // hide start panel
  try{ document.getElementById('startPanel')?.setAttribute('visible','false'); }catch(_){}

  // countdown
  await showCountdown();

  // load mode
  let mod;
  try{
    mod = await loadModeModule(MODE);
  }catch(err){
    alert(`เริ่มเกมไม่สำเร็จ: โหลดโหมดไม่พบ\n${err?.message||err}`);
    started = false; return;
  }
  const boot = mod.boot || mod.default?.boot;
  if(!boot){
    alert('เริ่มเกมไม่สำเร็จ: โมดูลไม่มีฟังก์ชัน boot()');
    started=false; return;
  }

  try{
    controller = await boot({ difficulty: DIFF, duration: DURATION });
    // VERY IMPORTANT: actually start spawner/time
    if (controller?.start) controller.start();
  }catch(err){
    console.error(err);
    alert('เริ่มเกมไม่สำเร็จ: เกิดข้อผิดพลาดระหว่างเริ่มโหมด');
    started=false;
  }
}

// Buttons
document.getElementById('btnStart')?.addEventListener('click', (e)=>{ e.preventDefault(); startGame(); });
document.getElementById('vrStartBtn')?.addEventListener('click', (e)=>{ e.preventDefault(); startGame(); });

// Auto start if requested
if (AUTOSTART){ setTimeout(startGame, 0); }

// ---------- Handle end from modes ----------
window.addEventListener('hha:end', (e)=>{
  started = false;
  try{
    const d = e.detail || {};
    if (d.score == null)     d.score = scoreTotal|0;
    if (d.misses == null)    d.misses = misses|0;
    if (d.comboMax == null)  d.comboMax = comboMax|0;
    if (d.duration == null)  d.duration = DURATION;
    if (d.mode == null)      d.mode = MODE;
    if (d.difficulty == null)d.difficulty = DIFF;
    showResult(d);
  }catch(err){
    console.error('showResult failed', err);
  }
});
