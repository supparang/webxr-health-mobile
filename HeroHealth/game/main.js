// === /HeroHealth/game/main.js (2025-11-13 HUD+COMBO+COUNTDOWN) ===
'use strict';

const $  = (s)=>document.querySelector(s);
const $$ = (s)=>document.querySelectorAll(s);

const qs        = new URLSearchParams(location.search);
let   MODE      = (qs.get('mode') || 'goodjunk').toLowerCase();
let   DIFF      = (qs.get('diff')  || 'easy').toLowerCase();
const DURATION  = Number(qs.get('duration') || 60);
const AUTOSTART = qs.get('autostart') === '1';

// ---------- HUD (score/combo) ----------
const elScore = $('#hudScore');
const elCombo = $('#hudCombo');

function setScore(n){
  if (!elScore) return;
  elScore.textContent = (n|0).toLocaleString();
}
function setCombo(n){
  if (!elCombo) return;
  elCombo.textContent = (n|0).toLocaleString();
}

// ---------- TIME pill (ใช้ #timePill จาก index.vr.html) ----------
const elTimePill = $('#timePill');
let   lastSec    = DURATION;

function setTimeLeft(sec){
  if (!elTimePill) return;
  const s = Math.max(0, sec|0);
  elTimePill.textContent = `TIME ${s}s`;
  elTimePill.classList.toggle('warn',   s <= 10 && s > 5);
  elTimePill.classList.toggle('danger', s <= 5);
}

// ---------- Fever bar mount ----------
import('../vr/ui-fever.js')
  .then(({ ensureFeverBar })=>{
    try{
      const dock = document.getElementById('feverBarDock') || document.getElementById('hudTop');
      ensureFeverBar?.(dock);
    }catch(_){}
  })
  .catch(()=>{});

// ---------- Quest HUD (Goal + Mini) ----------
import('../vr/quest-hud.js').catch(()=>{});

// bridge เผื่อโหมดไหน dispatch hha:quest
window.addEventListener('hha:quest', (e)=>{
  try{
    window.dispatchEvent(new CustomEvent('quest:update',{ detail:e.detail }));
  }catch(_){}
});

// ---------- score/time listeners ----------
let scoreTotal = 0;
let comboMax   = 0;
let misses     = 0;
let hits       = 0;

window.addEventListener('hha:score', (e)=>{
  const d = e.detail || {};
  scoreTotal = Math.max(0, (scoreTotal|0) + (d.delta|0));
  if (d.good) hits++; else misses++;

  // combo live
  if (typeof d.combo === 'number'){
    const c = d.combo|0;
    setCombo(c);
    if (c > comboMax) comboMax = c;
  }
  if (typeof d.comboMax === 'number'){
    const cm = d.comboMax|0;
    if (cm > comboMax) comboMax = cm;
  }

  setScore(scoreTotal);
});

window.addEventListener('hha:time', (e)=>{
  const sec = (e.detail?.sec|0);
  if (sec !== lastSec){
    lastSec = sec;
    setTimeLeft(sec);
  }
});

// ---------- Result overlay ----------
function showResult(detail){
  const old = document.getElementById('resultOverlay');
  if (old) old.remove();

  const d   = detail || {};
  const hub = d.hubUrl || '/webxr-health-mobile/HeroHealth/hub.html';

  const o = document.createElement('div');
  o.id = 'resultOverlay';
  o.innerHTML = `
    <div class="card">
      <h2>สรุปผล: ${d.mode||MODE} (${d.difficulty||DIFF})</h2>
      <div class="stats">
        <div class="pill">
          <div class="k">คะแนนรวม</div>
          <div class="v">${(d.score||0).toLocaleString()}</div>
        </div>
        <div class="pill">
          <div class="k">คอมโบสูงสุด</div>
          <div class="v">${d.comboMax||0}</div>
        </div>
        <div class="pill">
          <div class="k">พลาด</div>
          <div class="v">${d.misses||0}</div>
        </div>
        <div class="pill">
          <div class="k">เป้าหมาย</div>
          <div class="v">${d.goalCleared===true ? 'ถึงเป้า' : 'ไม่ถึง (-)'}</div>
        </div>
        <div class="pill">
          <div class="k">เวลา</div>
          <div class="v">${d.duration||0}s</div>
        </div>
      </div>
      <div class="badge">Mini Quests ${d.questsCleared||0}/${d.questsTotal||0}</div>
      <div class="btns">
        <button id="btnRetry">เล่นอีกครั้ง</button>
        <button id="btnHub">กลับ Hub</button>
      </div>
    </div>
  `;
  document.body.appendChild(o);

  const cssId = 'hha-result-css';
  if (!document.getElementById(cssId)){
    const css = document.createElement('style');
    css.id = cssId;
    css.textContent = `
      #resultOverlay{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;
        background:rgba(0,0,0,.65);z-index:999}
      #resultOverlay .card{
        background:#0b1220;border:1px solid #334155;border-radius:16px;color:#e2e8f0;
        min-width:320px;max-width:720px;padding:22px;
        box-shadow:0 20px 60px rgba(0,0,0,.45)
      }
      #resultOverlay h2{margin:0 0 14px 0;font:900 20px system-ui}
      #resultOverlay .stats{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;margin-bottom:10px}
      #resultOverlay .pill{background:#0f172a;border:1px solid #334155;border-radius:12px;
        padding:10px 12px;text-align:center}
      .pill .k{font:700 11px system-ui;color:#93c5fd;opacity:.85}
      .pill .v{font:900 18px system-ui;color:#f8fafc}
      #resultOverlay .badge{display:inline-block;margin:4px 0 14px 0;
        padding:6px 10px;border:2px solid #475569;border-radius:10px;font:800 12px system-ui}
      #resultOverlay .btns{display:flex;gap:10px;justify-content:flex-end}
      #resultOverlay .btns button{cursor:pointer;border:0;border-radius:10px;
        padding:8px 14px;font:800 14px system-ui}
      #btnRetry{background:#22c55e;color:#06270f}
      #btnHub{background:#1f2937;color:#e5e7eb}
      @media (max-width:640px){
        #resultOverlay .stats{grid-template-columns:repeat(2,minmax(0,1fr))}
      }
    `;
    document.head.appendChild(css);
  }

  const badge = o.querySelector('.badge');
  const x = d.questsCleared|0;
  const y = d.questsTotal|0;
  const r = y ? x/y : 0;

  badge.style.borderColor = r>=1 ? '#16a34a' : (r>=0.5 ? '#f59e0b' : '#ef4444');
  badge.style.background  = r>=1 ? '#16a34a22' : (r>=0.5 ? '#f59e0b22' : '#ef444422');
  badge.style.color       = r>=1 ? '#bbf7d0'   : (r>=0.5 ? '#fde68a' : '#fecaca');

  o.querySelector('#btnRetry').onclick = ()=>location.reload();
  o.querySelector('#btnHub').onclick   = ()=>location.href = hub;
}

window.addEventListener('hha:end',(e)=>{
  const d = e.detail || {};
  if (d.score      == null) d.score      = scoreTotal|0;
  if (d.misses     == null) d.misses     = misses|0;
  if (d.comboMax   == null) d.comboMax   = comboMax|0;
  if (d.duration   == null) d.duration   = DURATION;
  if (d.mode       == null) d.mode       = MODE;
  if (d.difficulty == null) d.difficulty = DIFF;
  showResult(d);
});

// ---------- Loader (โหมดเกม) ----------
async function loadModeModule(name){
  const extOrder = (name === 'goodjunk' || name === 'groups')
    ? ['safe','quest','js']
    : ['quest','safe','js'];

  const bases = [
    '../modes/',
    '/webxr-health-mobile/HeroHealth/modes/'
  ];

  let lastErr;
  for (const base of bases){
    for (const ext of extOrder){
      const url = `${base}${name}.${ext}.js`;
      try{
        console.log('[ModeLoader] try', url);
        const mod = await import(url + `?v=${Date.now()}`);
        if (mod?.boot || mod?.default?.boot) return mod;
      }catch(e){
        lastErr = e;
      }
    }
  }
  throw new Error(`ไม่พบไฟล์โหมด: ${name}\n${lastErr?.message || lastErr}`);
}

// ---------- Countdown 3-2-1-GO ใช้ #countOverlay จาก HTML ----------
function runCountdown(sec = 3){
  const ov  = document.getElementById('countOverlay');
  const num = ov?.querySelector('.num');
  if (!ov || !num) return Promise.resolve(); // ถ้าไม่มี overlay ก็ข้ามไปเลย

  return new Promise((resolve)=>{
    let t = sec|0;
    ov.style.display = 'flex';
    ov.classList.remove('go');
    num.textContent = t;

    const tick = ()=>{
      t--;
      if (t <= 0){
        ov.classList.add('go');
        num.textContent = 'GO!';
        setTimeout(()=>{
          ov.style.display = 'none';
          resolve();
        }, 360);
      } else {
        num.textContent = t;
        setTimeout(tick, 900);
      }
    };
    setTimeout(tick, 900);
  });
}

// ---------- Start orchestration ----------
let controller = null;
let started    = false;

async function startGame(){
  if (started) return;
  started = true;

  // reset states
  scoreTotal = 0;
  misses     = 0;
  hits       = 0;
  comboMax   = 0;
  setScore(0);
  setCombo(0);
  setTimeLeft(DURATION);
  lastSec = DURATION;

  // ซ่อนแผงเริ่มเกมใน A-Frame
  try{
    const p = document.getElementById('startPanel');
    if (p) p.setAttribute('visible','false');
  }catch(_){}

  // โหลดโมดโหมดเกม
  let mod;
  try{
    mod = await loadModeModule(MODE);
  }catch(err){
    alert(`เริ่มเกมไม่สำเร็จ: โหลดโหมดไม่พบ\n${err?.message || err}`);
    started = false;
    return;
  }

  const boot = mod.boot || mod.default?.boot;
  if (!boot){
    alert('เริ่มเกมไม่สำเร็จ: โมดูลไม่มีฟังก์ชัน boot()');
    started = false;
    return;
  }

  // Countdown 3-2-1-GO
  await runCountdown(3);

  try{
    controller = await boot({ difficulty: DIFF, duration: DURATION });
    controller?.start?.();
  }catch(err){
    console.error(err);
    alert('เริ่มเกมไม่สำเร็จ: เกิดข้อผิดพลาดระหว่างเริ่มโหมด');
    started = false;
  }
}

// ปุ่มเริ่ม (Desktop + VR Panel)
const domBtn = document.getElementById('btnStart');
domBtn?.addEventListener('click',(e)=>{
  e.preventDefault();
  startGame();
});

const vrBtn = document.getElementById('vrStartBtn');
vrBtn?.addEventListener('click',(e)=>{
  e.preventDefault();
  startGame();
});

// Autostart
if (AUTOSTART){
  setTimeout(()=>startGame(), 0);
}