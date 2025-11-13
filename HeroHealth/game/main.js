// === /HeroHealth/game/main.js (2025-11-13 COACH + COMBO HUD + QUEST SUMMARY FIX v2) ===
'use strict';

const $  = (s)=>document.querySelector(s);
const $$ = (s)=>document.querySelectorAll(s);

const qs   = new URLSearchParams(location.search);
let MODE   = (qs.get('mode')||'goodjunk').toLowerCase();
let DIFF   = (qs.get('diff')||'normal').toLowerCase();
const DURATION  = Number(qs.get('duration')||60);
const AUTOSTART = qs.get('autostart') === '1';

// ---------- HUD refs ----------
const elScore   = $('#hudScore');
const elCombo   = $('#hudCombo');
const elTimePill= $('#timePill');

function setScore(n){
  if(!elScore) return;
  elScore.textContent = (n|0).toLocaleString();
}
function setCombo(n){
  if(!elCombo) return;
  elCombo.textContent = (n|0);
}
let lastSec = DURATION;
function setTimeLeft(sec){
  if(!elTimePill) return;
  const s = Math.max(0, sec|0);
  elTimePill.textContent = `TIME ${s}s`;
  elTimePill.classList.toggle('warn',   s<=10 && s>5);
  elTimePill.classList.toggle('danger', s<=5);
}

// ---------- Fever bar mount ----------
import('../vr/ui-fever.js').then(({ensureFeverBar})=>{
  try{
    const dock = document.getElementById('feverBarDock') || document.getElementById('hudTop');
    ensureFeverBar?.(dock);
  }catch(_){}
}).catch(()=>{});

// ---------- Quest HUD bridge ----------
try{
  import('../vr/quest-hud.js').catch(()=>{});
}catch(_){}
window.addEventListener('hha:quest', (e)=>{
  try{
    window.dispatchEvent(new CustomEvent('quest:update',{detail:e.detail}));
  }catch(_){}
});

// ---------- Coach HUD (ใต้ fever bar) ----------
(function setupCoachHUD(){
  const cssId = 'hha-coach-css';
  if (!document.getElementById(cssId)){
    const css = document.createElement('style');
    css.id = cssId;
    css.textContent = `
      #hhaCoachWrap{
        margin-top:6px;
        pointer-events:none;
      }
      #hhaCoachBubble{
        display:inline-block;
        max-width:min(320px,72vw);
        padding:6px 10px;
        border-radius:999px;
        background:rgba(15,23,42,.92);
        border:1px solid #38bdf8;
        color:#e0f2fe;
        font:800 11px system-ui;
        letter-spacing:.2px;
        opacity:0;
        transform:translateY(4px);
        transition:opacity .25s ease, transform .25s ease;
        box-shadow:0 6px 18px rgba(0,0,0,.45);
      }
      #hhaCoachWrap.show #hhaCoachBubble{
        opacity:1;
        transform:translateY(0);
      }
    `;
    document.head.appendChild(css);
  }

  const dock = document.getElementById('feverBarDock');
  const box  = dock?.closest('.score-box') || document.querySelector('.score-box');
  if (!box) return;

  const wrap = document.createElement('div');
  wrap.id = 'hhaCoachWrap';
  wrap.innerHTML = `<div id="hhaCoachBubble">พร้อมลุยแล้ว เก็บของดีให้ได้เยอะที่สุด!</div>`;
  box.appendChild(wrap);

  const bubble = wrap.querySelector('#hhaCoachBubble');
  let hideTimer = null;

  function showCoach(text){
    if (!bubble) return;
    if (text) bubble.textContent = text;
    wrap.classList.add('show');
    clearTimeout(hideTimer);
    hideTimer = setTimeout(()=>wrap.classList.remove('show'), 3000);
  }

  window.addEventListener('hha:coach', (e)=>{
    const t = (e.detail && e.detail.text) || '';
    if (!t) return;
    showCoach(t);
  });

  showCoach('แตะเริ่มเกมแล้วเก็บของดีให้ต่อเนื่อง!');
})();

// ---------- score/time listeners ----------
let scoreTotal = 0;
let comboNow   = 0;
let comboMax   = 0;
let misses     = 0;
let hits       = 0;

window.addEventListener('hha:score', (e)=>{
  const d = e.detail || {};

  if (typeof d.total === 'number') scoreTotal = d.total|0;
  else scoreTotal = Math.max(0, (scoreTotal|0) + (d.delta|0));

  if (typeof d.combo === 'number') comboNow = d.combo|0;
  if (typeof d.comboMax === 'number') comboMax = Math.max(comboMax, d.comboMax|0);

  if (d.good === true)  hits++;
  if (d.good === false) misses++;

  setScore(scoreTotal);
  setCombo(comboNow);
});

window.addEventListener('hha:combo', (e)=>{
  const d = e.detail || {};
  comboNow = d.combo|0;
  comboMax = Math.max(comboMax, d.comboMax|0);
  setCombo(comboNow);
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

  const d = detail || {};
  const hub = d.hubUrl || '/webxr-health-mobile/HeroHealth/hub.html';

  const o = document.createElement('div');
  o.id = 'resultOverlay';
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
    </div>
  `;
  document.body.appendChild(o);

  const cssId = 'hha-result-css';
  if (!document.getElementById(cssId)){
    const css = document.createElement('style');
    css.id = cssId;
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
      @media (max-width:640px){#resultOverlay .stats{grid-template-columns:repeat(2,minmax(0,1fr))}}
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

// ---------- สรุปผล + ดึงค่าจาก goalsAll / minisAll ----------
window.addEventListener('hha:end',(e)=>{
  const d = e.detail||{};

  // แปลง goalsAll → goalCleared (ถ้าโหมดยังไม่ได้ให้มา)
  try{
    if (Array.isArray(d.goalsAll) && !('goalCleared' in d)){
      const list = d.goalsAll;
      const totalGoals   = list.length;
      const clearedGoals = list.filter(g=>{
        if(!g) return false;
        const prog   = Number(g.prog||0);
        const target = Number(g.target||0);
        if (g.done === true) return true;
        if (target>0 && prog>=target) return true;
        return false;
      }).length;
      d.goalCleared = totalGoals>0 ? (clearedGoals === totalGoals) : false;
    }

    // แปลง minisAll → questsCleared / questsTotal ถ้าไม่ได้ให้มา
    if (Array.isArray(d.minisAll) && (!('questsCleared' in d) || !('questsTotal' in d))){
      const list = d.minisAll;
      const totalMini   = list.length;
      const clearedMini = list.filter(m=>{
        if(!m) return false;
        const prog   = Number(m.prog||0);
        const target = Number(m.target||0);
        if (m.done === true) return true;
        if (target>0 && prog>=target) return true;
        return false;
      }).length;

      if (!('questsTotal'   in d)) d.questsTotal   = totalMini;
      if (!('questsCleared' in d)) d.questsCleared = clearedMini;
    }
  }catch(_){}

  if (d.score == null)      d.score      = scoreTotal|0;
  if (d.misses == null)     d.misses     = misses|0;
  if (d.comboMax == null)   d.comboMax   = comboMax|0;
  if (d.duration == null)   d.duration   = DURATION;
  if (d.mode == null)       d.mode       = MODE;
  if (d.difficulty == null) d.difficulty = DIFF;

  showResult(d);
});

// ---------- Loader ----------
async function loadModeModule(name){
  const extOrder = (name==='goodjunk'||name==='groups')
    ? ['safe','quest','js']
    : ['quest','safe','js'];

  const bases = [
    '../modes/',
    '/webxr-health-mobile/HeroHealth/modes/'
  ];

  let err;
  for (const base of bases){
    for (const ext of extOrder){
      const url = `${base}${name}.${ext}.js`;
      try{
        console.log('[ModeLoader] try', url);
        const mod = await import(url + `?v=${Date.now()}`);
        if (mod?.boot || mod?.default?.boot) return mod;
      }catch(e){ err = e; }
    }
  }
  throw new Error(`ไม่พบไฟล์โหมด: ${name}\n${err?.message||err}`);
}

// ---------- countdown 3-2-1 ----------
function runCountdown(sec=3){
  return new Promise((resolve)=>{
    const id='hha-count-css';
    if(!document.getElementById(id)){
      const css=document.createElement('style'); css.id=id;
      css.textContent=`
        #countOverlay{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.55);z-index:700}
        #countOverlay .num{font:900 clamp(64px,12vw,160px) system-ui;color:#e5edff;text-shadow:0 12px 40px rgba(0,0,0,.6)}
        #countOverlay.go .num{color:#86efac;text-shadow:0 10px 40px rgba(16,185,129,.45)}
      `;
      document.head.appendChild(css);
    }
    let overlay = document.getElementById('countOverlay');
    if(!overlay){
      overlay = document.createElement('div');
      overlay.id='countOverlay';
      overlay.innerHTML='<div class="num">3</div>';
      document.body.appendChild(overlay);
    }
    const label = overlay.querySelector('.num');
    overlay.style.display='flex';
    let t=sec;
    label.textContent=t;
    const tick=()=>{
      t--;
      if (t<=0){
        label.textContent='GO!';
        overlay.classList.add('go');
        setTimeout(()=>{ overlay.style.display='none'; overlay.classList.remove('go'); resolve(); }, 450);
      }else{
        label.textContent=t;
        setTimeout(tick,900);
      }
    };
    setTimeout(tick,900);
  });
}

// ---------- Start orchestration ----------
let controller = null;
let started    = false;

async function startGame(){
  if (started) return;
  started = true;

  scoreTotal=0; misses=0; hits=0; comboNow=0; comboMax=0;
  setScore(0); setCombo(0); setTimeLeft(DURATION); lastSec = DURATION;

  try{
    const p=document.getElementById('startPanel');
    if (p) p.setAttribute('visible','false');
  }catch(_){}

  let mod;
  try{
    mod = await loadModeModule(MODE);
  }catch(err){
    alert(`เริ่มเกมไม่สำเร็จ: โหลดโหมดไม่พบ\n${err?.message||err}`);
    started=false; return;
  }

  const boot = mod.boot || mod.default?.boot;
  if (!boot){
    alert('เริ่มเกมไม่สำเร็จ: โมดูลไม่มีฟังก์ชัน boot()');
    started=false; return;
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

// ปุ่มเริ่ม
const domBtn = document.getElementById('btnStart');
domBtn?.addEventListener('click', (e)=>{ e.preventDefault(); startGame(); });
const vrBtn = document.getElementById('vrStartBtn');
vrBtn?.addEventListener('click', (e)=>{ e.preventDefault(); startGame(); });

// Auto start
if (AUTOSTART){
  setTimeout(()=>startGame(), 0);
}