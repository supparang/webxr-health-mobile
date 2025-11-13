// === /HeroHealth/game/main.js (2025-11-13 FIX LOADER + COMBO HUD) ===
'use strict';

const $  = (s)=>document.querySelector(s);
const $$ = (s)=>document.querySelectorAll(s);

const qs   = new URLSearchParams(location.search);
let MODE   = (qs.get('mode')||'goodjunk').toLowerCase();
let DIFF   = (qs.get('diff')||'normal').toLowerCase();
const DURATION  = Number(qs.get('duration')||60);
const AUTOSTART = qs.get('autostart') === '1';

// ---------- HUD refs ----------
const elScore = $('#hudScore');
const elCombo = $('#hudCombo');
function setScore(n){ if(elScore) elScore.textContent = (n|0).toLocaleString(); }
function setCombo(n){ if(elCombo) elCombo.textContent = (n|0).toLocaleString(); }

// ---------- TIME bubble (แยกจาก #timePill ของ index) ----------
(function injectTimeBubble(){
  if (document.getElementById('hudTimeBubble')) return;
  const css = document.createElement('style'); css.id='hha-time-css';
  css.textContent = `
  #hudTimeBubble{position:fixed;top:14px;right:14px;z-index:560;pointer-events:none}
  #hudTimeBubble .pill{
    background:#0b1220e0;color:#e2e8f0;border:2px solid #334155;
    border-radius:999px;padding:4px 10px;font:900 14px system-ui;
    letter-spacing:.2px;box-shadow:0 10px 24px rgba(0,0,0,.35)
  }
  #hudTimeBubble.low{filter:drop-shadow(0 0 10px #f59e0b);}
  #hudTimeBubble.crit{
    animation:hb 0.7s ease-in-out infinite;
    filter:drop-shadow(0 0 14px #ef4444);
  }
  @keyframes hb{0%,100%{transform:scale(1)}50%{transform:scale(1.08)}}
  `;
  document.head.appendChild(css);

  const wrap = document.createElement('div');
  wrap.id='hudTimeBubble';
  wrap.innerHTML = `<div class="pill">TIME ${DURATION}s</div>`;
  document.body.appendChild(wrap);
})();

const elTimeWrap = document.getElementById('hudTimeBubble');
const elTimeText = elTimeWrap?.querySelector('.pill');
let lastSec = DURATION;

function setTimeLeft(sec){
  if(!elTimeWrap || !elTimeText) return;
  const s = Math.max(0, sec|0);
  elTimeText.textContent = `TIME ${s}s`;
  elTimeWrap.classList.toggle('low',  s <= 15 && s > 5);
  elTimeWrap.classList.toggle('crit', s <= 5);

  // ซิงก์ไป #timePill ของ index.vr.html ถ้ามี
  const pill = document.getElementById('timePill');
  if (pill){
    pill.textContent = `TIME ${s}s`;
    pill.classList.toggle('warn',   s<=10 && s>5);
    pill.classList.toggle('danger', s<=5);
  }
}

// ---------- Fever bar mount ----------
import('../vr/ui-fever.js').then(({ensureFeverBar})=>{
  try{
    const dock = document.getElementById('feverBarDock') || document.getElementById('hudTop');
    ensureFeverBar?.(dock);
  }catch(_){}
}).catch(()=>{});

// ---------- Quest HUD (GOAL + MINI) ----------
import('../vr/quest-hud.js').catch(()=>{ /* ถ้าไม่มีไฟล์ ก็ไม่เป็นไร */ });

// bridge event บางโหมดส่ง hha:quest → ส่งต่อเป็น quest:update
window.addEventListener('hha:quest', (e)=>{
  try{ window.dispatchEvent(new CustomEvent('quest:update',{detail:e.detail})); }catch(_){}
});
window.addEventListener('quest:update', ()=>{}); // ให้ quest-hud hook เอง

// ---------- คะแนน/เวลา/คอมโบ ----------
let scoreTotal = 0;
let misses = 0;
let hits   = 0;
let comboNow = 0;
let comboMax = 0;

window.addEventListener('hha:score', (e)=>{
  const d = e.detail || {};
  const delta = d.delta|0;
  scoreTotal = Math.max(0, (scoreTotal|0) + delta);
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

// รับคอมโบจากโหมด (goodjunk.safe.js จะยิง hha:combo ให้)
window.addEventListener('hha:combo', (e)=>{
  const d = e.detail || {};
  comboNow = d.combo|0;
  comboMax = Math.max(comboMax, d.comboMax|0, comboNow);
  setCombo(comboNow);
});

// ---------- Result overlay ----------
function showResult(detail){
  const old = document.getElementById('resultOverlay'); if(old) old.remove();
  const d = detail || {};
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

  const cssId='hha-result-css';
  if(!document.getElementById(cssId)){
    const css=document.createElement('style'); css.id=cssId;
    css.textContent=`
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
      @media (max-width:640px){ #resultOverlay .stats{grid-template-columns:repeat(2,minmax(0,1fr))} }
    `;
    document.head.appendChild(css);
  }

  const badge = o.querySelector('.badge');
  const x = d.questsCleared|0, y = d.questsTotal|0;
  const r = y ? x/y : 0;
  badge.style.borderColor = r>=1 ? '#16a34a' : (r>=0.5 ? '#f59e0b' : '#ef4444');
  badge.style.background  = r>=1 ? '#16a34a22' : (r>=0.5 ? '#f59e0b22' : '#ef444422');
  badge.style.color       = r>=1 ? '#bbf7d0'   : (r>=0.5 ? '#fde68a' : '#fecaca');

  o.querySelector('#btnRetry').onclick = ()=>location.reload();
  o.querySelector('#btnHub').onclick   = ()=>location.href = hub;
}

window.addEventListener('hha:end',(e)=>{
  const d = e.detail||{};
  if (d.score == null)      d.score      = scoreTotal|0;
  if (d.misses == null)     d.misses     = misses|0;
  if (d.comboMax == null)   d.comboMax   = comboMax|0;
  if (d.duration == null)   d.duration   = DURATION;
  if (d.mode == null)       d.mode       = MODE;
  if (d.difficulty == null) d.difficulty = DIFF;
  showResult(d);
});

// ---------- Loader (แก้ .js.js) ----------
async function loadModeModule(name){
  name = (name || '').toLowerCase();

  const relPaths = [
    `${name}.safe.js`,
    `${name}.quest.js`,
    `${name}.js`
  ];

  const bases = [
    '../modes/',                                   // relative
    '/webxr-health-mobile/HeroHealth/modes/'       // absolute fallback
  ];

  let lastErr;
  for (const base of bases){
    for (const rel of relPaths){
      const url = base + rel + `?v=${Date.now()}`;
      console.log('[ModeLoader] try', url);
      try{
        const mod = await import(url);
        if (mod?.boot || mod?.default?.boot) return mod;
      }catch(e){
        lastErr = e;
      }
    }
  }

  throw new Error(`ไม่พบไฟล์โหมด: ${name}\n${lastErr?.message||lastErr}`);
}

// ---------- Countdown 3-2-1-GO ----------
function runCountdown(sec=3){
  return new Promise((resolve)=>{
    const id='hha-count-css';
    if(!document.getElementById(id)){
      const css=document.createElement('style'); css.id=id;
      css.textContent=`
        #countOverlay{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.55);z-index:700}
        #countOverlay .num{font:900 clamp(64px,12vw,160px) system-ui;color:#e2e8f0;text-shadow:0 12px 40px rgba(0,0,0,.6)}
      `;
      document.head.appendChild(css);
    }
    const o=document.getElementById('countOverlay');
    if(!o){ resolve(); return; }
    const label=o.querySelector('.num');
    o.style.display='flex';
    let t=sec;
    label.textContent = t;
    const tick=()=>{
      t--;
      if(t<=0){
        label.textContent='GO!';
        setTimeout(()=>{
          o.style.display='none';
          resolve();
        },350);
      }else{
        label.textContent=t;
        setTimeout(tick, 900);
      }
    };
    setTimeout(tick, 900);
  });
}

// ---------- Start orchestration ----------
let controller=null, started=false;

async function startGame(){
  if (started) return;
  started = true;

  scoreTotal=0; misses=0; hits=0; comboNow=0; comboMax=0;
  setScore(0); setCombo(0); setTimeLeft(DURATION); lastSec = DURATION;

  try{
    const p=document.getElementById('startPanel');
    if(p) p.setAttribute('visible','false');
  }catch(_){}

  let mod;
  try{
    mod = await loadModeModule(MODE);
  }catch(err){
    alert(`เริ่มเกมไม่สำเร็จ: โหลดโหมดไม่พบ\n${err?.message||err}`);
    started=false;
    return;
  }

  const boot = mod.boot || mod.default?.boot;
  if (!boot){
    alert('เริ่มเกมไม่สำเร็จ: โมดูลไม่มีฟังก์ชัน boot()');
    started=false;
    return;
  }

  await runCountdown(3);

  try{
    controller = await boot({ difficulty: DIFF, duration: DURATION });
    controller?.start?.();
  }catch(err){
    console.error(err);
    alert('เริ่มเกมไม่สำเร็จ: เกิดข้อผิดพลาดระหว่างเริ่มโหมด');
    started=false;
  }
}

// Bind buttons
const domBtn = document.getElementById('btnStart');
domBtn?.addEventListener('click', (e)=>{ e.preventDefault(); startGame(); });
const vrBtn = document.getElementById('vrStartBtn');
vrBtn?.addEventListener('click', (e)=>{ e.preventDefault(); startGame(); });

// Autostart (ถ้าต้องการ)
if (AUTOSTART){ setTimeout(()=>startGame(), 0); }