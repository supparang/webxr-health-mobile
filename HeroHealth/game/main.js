// === /HeroHealth/game/main.js (2025-11-12 LATEST+) ===
'use strict';

const $  = (s)=>document.querySelector(s);
const $$ = (s)=>document.querySelectorAll(s);

const qs = new URLSearchParams(location.search);
let MODE = (qs.get('mode')||'goodjunk').toLowerCase();
let DIFF = (qs.get('diff')||'normal').toLowerCase();
const AUTOSTART = qs.get('autostart') === '1';

const elScore = $('#hudScore');
const elCombo = $('#hudCombo');
const elTop   = $('#hudTop');
const elTimePill = $('#timePill');
const elCountdown = $('#countdownOverlay');

function setScore(n){ if(elScore) elScore.textContent = (n|0).toLocaleString(); }
function setCombo(n){ if(elCombo) elCombo.textContent = (n|0).toLocaleString(); }

/* ----- TIME HUD (glow states + warn/danger) ----- */
let lastSec = null;
function setTimeLeft(sec){
  if(!elTimePill) return;
  const s = Math.max(0, sec|0);
  elTimePill.textContent = `TIME ${s}s`;
  elTimePill.classList.toggle('danger', s <= 5);
  elTimePill.classList.toggle('warn',   s > 5 && s <= 10);
}
window.addEventListener('hha:time', (e)=>{
  const sec = (e.detail?.sec|0);
  if(sec!==lastSec){ setTimeLeft(sec); lastSec = sec; }
});

/* ----- Fever bar mount (safe) ----- */
import('../vr/ui-fever.js').then(mod=>{
  try{
    const { ensureFeverBar } = mod;
    const dock = document.getElementById('feverBarDock') || elTop;
    if(ensureFeverBar) ensureFeverBar(dock);
  }catch{}
}).catch(()=>{});

/* ----- Quest HUD Bridge (goal/mini → quest-hud.js) ----- */
let questState = { goal:null, mini:null };
window.addEventListener('hha:quest', (e)=>{
  questState = e.detail || {goal:null, mini:null};
  try{
    window.dispatchEvent(new CustomEvent('quest:update', { detail: questState }));
  }catch{}
});

/* ----- Score & Combo counters ----- */
let scoreTotal = 0, comboNow = 0, comboMax = 0, misses = 0, hits = 0;
window.addEventListener('hha:score', (e)=>{
  const d = e.detail||{};
  scoreTotal = Math.max(0, (scoreTotal|0) + (d.delta|0));
  if(d.good){ hits++; comboNow = (comboNow|0)+1; comboMax = Math.max(comboMax, comboNow); }
  else { misses++; comboNow = 0; }
  setScore(scoreTotal);
  setCombo(comboNow);
});

/* ----- Optional: score pop near hit (DOM coords from factory) ----- */
let Particles = null;
(async()=>{ try{ Particles = (await import('../vr/particles.js')).Particles; } catch{} })();
window.addEventListener('hha:hit-screen',(e)=>{
  if(!Particles?.scorePop) return;
  const d = e.detail||{};
  const txt = (d.delta>0?`+${d.delta}`:`${d.delta}`);
  try{
    Particles.scorePop({ x:d.x, y:d.y, text:txt, good:!!d.good });
  }catch{}
});

/* ----- Result overlay ----- */
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
      <div class="pill"><div class="k">คอมโบสูงสุด</div><div class="v">${d.comboMax!=null?d.comboMax:comboMax}</div></div>
      <div class="pill"><div class="k">พลาด</div><div class="v">${d.misses!=null?d.misses:misses}</div></div>
      <div class="pill"><div class="k">เป้าหมาย</div><div class="v">${d.goalCleared===true?'ถึงเป้า':'ไม่ถึง (-)'}</div></div>
      <div class="pill"><div class="k">เวลา</div><div class="v">${d.duration||Number(qs.get('duration')||60)}s</div></div>
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
  const r = y? x/y : 0;
  badge.style.borderColor = r>=1 ? '#16a34a' : (r>=0.5 ? '#f59e0b' : '#ef4444');
  badge.style.background  = r>=1 ? '#16a34a22' : (r>=0.5 ? '#f59e0b22' : '#ef444422');
  badge.style.color       = r>=1 ? '#bbf7d0'   : (r>=0.5 ? '#fde68a' : '#fecaca');

  o.querySelector('#btnRetry').onclick = ()=>location.reload();
  o.querySelector('#btnHub').onclick   = ()=>location.href = hub;
}

/* Inject overlay CSS (once) */
(function injectResultCss(){
  if(document.getElementById('hha-result-css')) return;
  const css = document.createElement('style'); css.id='hha-result-css';
  css.textContent = `
  #resultOverlay{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.65);z-index:999}
  #resultOverlay .card{background:#0b1220;border:1px solid #334155;border-radius:16px;color:#e2e8f0;min-width:320px;max-width:720px;padding:22px;box-shadow:0 20px 60px rgba(0,0,0,.45)}
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
  `;
  document.head.appendChild(css);
})();

/* ----- Countdown 3-2-1-GO ----- */
function runCountdown(start=3){
  return new Promise(resolve=>{
    if(!elCountdown){ resolve(); return; }
    const numEl = elCountdown.querySelector('.num');
    let n = start|0;
    elCountdown.style.display='flex';
    const tick = ()=>{
      if(n>0){
        elCountdown.classList.remove('go');
        numEl.textContent = n;
        numEl.style.animation = 'none'; void numEl.offsetWidth; numEl.style.animation = null;
        n--; setTimeout(tick, 700);
      }else{
        elCountdown.classList.add('go');
        numEl.textContent = 'GO';
        numEl.style.animation = 'none'; void numEl.offsetWidth; numEl.style.animation = null;
        setTimeout(()=>{ elCountdown.style.display='none'; resolve(); }, 500);
      }
    };
    tick();
  });
}

/* ----- Mode loader (try .safe.js → .quest.js → .js) ----- */
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
      if(mod && (mod.boot||mod.default?.boot)) return mod;
    }catch(err){ lastErr = err; }
  }
  throw lastErr || new Error(`ไม่พบไฟล์โหมด: ${name}`);
}

/* ----- Start orchestration ----- */
let controller = null;
let started = false;

async function startGame(){
  if (started) return;
  started = true;

  // reset HUD
  scoreTotal = 0; misses=0; hits=0; comboNow=0; comboMax=0; setScore(0); setCombo(0);
  const duration = Number(qs.get('duration')||60);
  setTimeLeft(duration);

  // hide start panel
  try{ const p = document.getElementById('startPanel'); if(p) p.setAttribute('visible','false'); }catch{}

  // countdown ก่อนเริ่มจริง
  await runCountdown(3);

  // load & boot mode
  let mod;
  try{
    mod = await loadModeModule(MODE);
  }catch(err){
    alert(`เริ่มเกมไม่สำเร็จ: โหลดโหมดไม่พบ\n${err?.message||err}`);
    started = false; return;
  }
  const boot = mod.boot || (mod.default && mod.default.boot);
  if (!boot){
    alert('เริ่มเกมไม่สำเร็จ: โมดูลไม่มีฟังก์ชัน boot()');
    started = false; return;
  }

  try{
    controller = await boot({ difficulty: DIFF, duration });
    // บางโหมดคืน controller.start(); ถ้ามีให้เรียก
    if (controller && typeof controller.start === 'function'){
      controller.start();
    }
  }catch(err){
    console.error(err);
    alert('เริ่มเกมไม่สำเร็จ: เกิดข้อผิดพลาดระหว่างเริ่มโหมด');
    started = false;
  }
}

/* Buttons + autostart */
const domBtn = document.getElementById('btnStart');
if(domBtn){ domBtn.addEventListener('click', (e)=>{ e.preventDefault(); startGame(); }); }
const vrBtn = document.getElementById('vrStartBtn');
if(vrBtn){ vrBtn.addEventListener('click', (e)=>{ e.preventDefault(); startGame(); }); }
if(AUTOSTART){ setTimeout(startGame, 0); }

/* ----- Receive end → show result ----- */
window.addEventListener('hha:end', (e)=>{
  started = false;
  const d = e.detail || {};
  if (d.score == null) d.score = scoreTotal|0;
  if (d.misses == null) d.misses = misses|0;
  if (d.comboMax == null) d.comboMax = comboMax|0;
  if (d.duration == null) d.duration = Number(qs.get('duration')||60);
  if (d.mode == null) d.mode = MODE;
  if (d.difficulty == null) d.difficulty = DIFF;
  showResult(d);
});
