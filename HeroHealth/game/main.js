// === /HeroHealth/game/main.js (2025-11-13 Fallback HUD + Countdown + Time Glow) ===
'use strict';

const $  = (s)=>document.querySelector(s);
const $$ = (s)=>document.querySelectorAll(s);

const qs   = new URLSearchParams(location.search);
let MODE   = (qs.get('mode')||'goodjunk').toLowerCase();
let DIFF   = (qs.get('diff')||'normal').toLowerCase();
const DURATION  = Number(qs.get('duration')||60);
const AUTOSTART = qs.get('autostart') === '1';

// ---------- HUD (score/combo) ----------
const elScore = $('#hudScore');
const elCombo = $('#hudCombo');
function setScore(n){ if(elScore) elScore.textContent = (n|0).toLocaleString(); }
function setCombo(n){ if(elCombo) elCombo.textContent = (n|0).toLocaleString(); }

// ---------- TIME pill (top-right with glow) ----------
const timePill = document.getElementById('timePill');
let lastSec = DURATION;
function setTimeLeft(sec){
  if(!timePill) return;
  const s = Math.max(0, sec|0);
  timePill.textContent = `TIME ${s}s`;
  timePill.classList.toggle('warn',  s<=10 && s>5);
  timePill.classList.toggle('danger', s<=5);
}

// ---------- Fever bar mount ----------
import('../vr/ui-fever.js').then(({ensureFeverBar})=>{
  try{
    const dock = document.getElementById('feverBarDock') || document.getElementById('hudTop');
    ensureFeverBar?.(dock);
  }catch(_){}
}).catch(()=>{});

// ---------- Quest HUD loader with fallbacks ----------
async function tryImport(url){
  try { return await import(url + `?v=${Date.now()}`); } catch(e){ return null; }
}
async function loadQuestHUD(){
  // 1) path relative (correct when main.js in /HeroHealth/game/)
  let mod = await tryImport('../vr/quest-hud.js');
  if (mod) return true;
  // 2) absolute on GitHub Pages
  mod = await tryImport('/webxr-health-mobile/HeroHealth/vr/quest-hud.js');
  if (mod) return true;
  // 3) inline minimal HUD (no external file) — prevents blank HUD if 404
  installMinimalQuestHUD();
  console.warn('[QuestHUD] external quest-hud.js not found — using inline minimal HUD');
  return true;
}
function installMinimalQuestHUD(){
  if (document.getElementById('miniQuestHUD')) return;
  const box = document.createElement('div');
  box.id='miniQuestHUD';
  box.style.cssText = 'position:fixed;right:16px;top:88px;z-index:520;background:#0b1220cc;border:1px solid #334155;border-radius:12px;color:#e2e8f0;padding:10px 12px;font:800 12px system-ui;max-width:min(50vw,420px);pointer-events:none;';
  box.innerHTML = '<div id="mqGoal">GOAL: —</div><div style="height:8px;border-radius:6px;background:#0f172a;border:1px solid #334155;margin:6px 0"><div id="mqGoalFill" style="height:100%;width:0%;background:linear-gradient(90deg,#60a5fa,#22c55e)"></div></div><div id="mqMini">MINI: —</div><div style="height:8px;border-radius:6px;background:#0f172a;border:1px solid #334155;margin:6px 0"><div id="mqMiniFill" style="height:100%;width:0%;background:linear-gradient(90deg,#a78bfa,#f59e0b)"></div></div>';
  document.body.appendChild(box);
  const gLab = box.querySelector('#mqGoal');
  const gBar = box.querySelector('#mqGoalFill');
  const mLab = box.querySelector('#mqMini');
  const mBar = box.querySelector('#mqMiniFill');
  function pct(n,d){ return d>0 ? Math.max(0, Math.min(100, Math.round((n/d)*100))) : 0; }
  function render(d){
    if(d?.goal){ gLab.textContent = `GOAL: ${d.goal.label||'—'} (${d.goal.prog|0}/${d.goal.target|0})`; gBar.style.width = pct(d.goal.prog|0, d.goal.target|0)+'%'; }
    if(d?.mini){ mLab.textContent = `MINI: ${d.mini.label||'—'} (${d.mini.prog|0}/${d.mini.target|0})`; mBar.style.width = pct(d.mini.prog|0, d.mini.target|0)+'%'; }
  }
  window.addEventListener('hha:quest', (e)=>render(e.detail||{}));
  window.addEventListener('quest:update', (e)=>render(e.detail||{}));
}
await loadQuestHUD();

// ---------- bridge (defensive) ----------
window.addEventListener('hha:quest', (e)=>{
  try{ window.dispatchEvent(new CustomEvent('quest:update',{detail:e.detail})); }catch(_){}
});

// ---------- score/time listeners ----------
let scoreTotal=0, comboMax=0, misses=0, hits=0;
window.addEventListener('hha:score', (e)=>{
  const d=e.detail||{};
  scoreTotal = Math.max(0, (scoreTotal|0) + (d.delta|0));
  if(d.good) hits++; else misses++;
  setScore(scoreTotal);
});
window.addEventListener('hha:time', (e)=>{
  const sec=(e.detail?.sec|0);
  if(sec!==lastSec){ setTimeLeft(sec); lastSec=sec; }
});

// ---------- Result overlay ----------
function showResult(detail){
  const old=document.getElementById('resultOverlay'); if(old) old.remove();
  const d=detail||{};
  const hub=d.hubUrl || '/webxr-health-mobile/HeroHealth/hub.html';
  const o=document.createElement('div'); o.id='resultOverlay';
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
  const badge=o.querySelector('.badge');
  const x=d.questsCleared|0, y=d.questsTotal|0, r=y?x/y:0;
  badge.style.borderColor = r>=1 ? '#16a34a' : (r>=0.5 ? '#f59e0b' : '#ef4444');
  badge.style.background  = r>=1 ? '#16a34a22' : (r>=0.5 ? '#f59e0b22' : '#ef444422');
  badge.style.color       = r>=1 ? '#bbf7d0'   : (r>=0.5 ? '#fde68a' : '#fecaca');

  o.querySelector('#btnRetry').onclick = ()=>location.reload();
  o.querySelector('#btnHub').onclick   = ()=>location.href = hub;
}
window.addEventListener('hha:end',(e)=>{
  const d=e.detail||{};
  if (d.score == null) d.score = scoreTotal|0;
  if (d.misses == null) d.misses = misses|0;
  if (d.comboMax == null) d.comboMax = comboMax|0;
  if (d.duration == null) d.duration = DURATION;
  if (d.mode == null) d.mode = MODE;
  if (d.difficulty == null) d.difficulty = DIFF;
  showResult(d);
});

// ---------- Loader (robust paths) ----------
async function loadModeModule(name){
  const extOrder = (name==='goodjunk'||name==='groups') ? ['safe','quest','js'] : ['quest','safe','js'];
  const bases = ['../modes/','/webxr-health-mobile/HeroHealth/modes/'];
  const tries=[];
  for(const base of bases){ for(const ext of extOrder){ tries.push(`${base}${name}.${ext}.js`); } }
  let err;
  for(const url of tries){
    try{
      console.log('[ModeLoader] try', url);
      const mod=await import(url+`?v=${Date.now()}`);
      if(mod?.boot || mod?.default?.boot) return mod;
    }catch(e){ err=e; }
  }
  throw new Error(`ไม่พบไฟล์โหมด: ${name}\n${err?.message||err}`);
}

// ---------- Countdown 3-2-1-GO ----------
function runCountdown(sec=3){
  const overlay = document.getElementById('countdownOverlay');
  if(!overlay){ return Promise.resolve(); }
  return new Promise((resolve)=>{
    overlay.style.display='flex';
    const label=overlay.querySelector('.num');
    let t=sec;
    function tick(){
      label.textContent=t>0?t:'GO!';
      overlay.classList.toggle('go', t<=0);
      if(t<=0){ setTimeout(()=>{ overlay.style.display='none'; resolve(); },420); }
      else { t--; setTimeout(tick, 800); }
    }
    tick();
  });
}

// ---------- Start orchestration ----------
let controller=null, started=false;
async function startGame(){
  if(started) return;
  started = true;
  // reset states
  setScore(0); setCombo(0); setTimeLeft(DURATION); lastSec=DURATION;

  // hide start panel
  try{ const p=document.getElementById('startPanel'); if(p) p.setAttribute('visible','false'); }catch(_){}

  // load module
  let mod;
  try{ mod = await loadModeModule(MODE); }
  catch(err){ alert(`เริ่มเกมไม่สำเร็จ: โหลดโหมดไม่พบ\n${err?.message||err}`); started=false; return; }

  const boot = mod.boot || mod.default?.boot;
  if(!boot){ alert('เริ่มเกมไม่สำเร็จ: โมดูลไม่มีฟังก์ชัน boot()'); started=false; return; }

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
document.getElementById('btnStart')?.addEventListener('click', (e)=>{ e.preventDefault(); startGame(); });
document.getElementById('vrStartBtn')?.addEventListener('click', (e)=>{ e.preventDefault(); startGame(); });
if(AUTOSTART){ setTimeout(()=>startGame(), 0); }
