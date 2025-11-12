// === HeroHealth/game/main.js (2025-11-13 stable) ===
'use strict';

const $=(s)=>document.querySelector(s);
const qs=new URLSearchParams(location.search);
let MODE=(qs.get('mode')||'goodjunk').toLowerCase();
let DIFF=(qs.get('diff')||'normal').toLowerCase();
const DURATION=Number(qs.get('duration')||60);
const AUTOSTART=qs.get('autostart')==='1';

const elScore=$('#hudScore');
const elCombo=$('#hudCombo');
const elTime=$('#timePill');
function setScore(n){if(elScore)elScore.textContent=(n|0).toLocaleString();}
function setCombo(n){if(elCombo)elCombo.textContent=(n|0).toLocaleString();}
function setTimeLeft(sec){
  if(!elTime)return;
  const s=Math.max(0,sec|0);
  elTime.textContent=`TIME ${s}s`;
  elTime.classList.toggle('warn',s<=15&&s>5);
  elTime.classList.toggle('danger',s<=5);
}

import('../vr/ui-fever.js').then(({ensureFeverBar})=>{
  try{ensureFeverBar?.($('#feverBarDock'));}catch(_){}
}).catch(()=>{});
try{await import('../vr/quest-hud.js');}catch(_){}

window.addEventListener('hha:quest',(e)=>{
  try{window.dispatchEvent(new CustomEvent('quest:update',{detail:e.detail}));}catch(_){}
});

let scoreTotal=0,comboMax=0,misses=0,hits=0,lastSec=DURATION;
window.addEventListener('hha:score',(e)=>{
  const d=e.detail||{};
  scoreTotal=Math.max(0,(scoreTotal|0)+(d.delta|0));
  if(d.good)hits++;else misses++;
  setScore(scoreTotal);
});
window.addEventListener('hha:time',(e)=>{
  const sec=e.detail?.sec|0;
  if(sec!==lastSec){setTimeLeft(sec);lastSec=sec;}
});

function showResult(detail){
  const old=$('#resultOverlay');if(old)old.remove();
  const d=detail||{};
  const hub='/webxr-health-mobile/HeroHealth/hub.html';
  const o=document.createElement('div');o.id='resultOverlay';
  o.innerHTML=`
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
  const css=document.createElement('style');
  css.textContent=`#resultOverlay{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.65);z-index:999}
  #resultOverlay .card{background:#0b1220;border:1px solid #334155;border-radius:16px;color:#e2e8f0;min-width:320px;max-width:720px;padding:22px;}
  #resultOverlay h2{margin:0 0 14px;font:900 20px system-ui}
  #resultOverlay .stats{display:grid;grid-template-columns:repeat(5,1fr);gap:10px}
  .pill{background:#0f172a;border:1px solid #334155;border-radius:12px;padding:10px;text-align:center}
  .pill .k{font:700 11px system-ui;color:#93c5fd;opacity:.85}
  .pill .v{font:900 18px system-ui;color:#f8fafc}
  #resultOverlay .badge{margin:8px 0;padding:6px 10px;border:2px solid #475569;border-radius:10px;font:800 12px system-ui;text-align:center}
  #resultOverlay .btns{display:flex;gap:10px;justify-content:flex-end;margin-top:10px}
  #btnRetry{background:#22c55e;color:#06270f;border:0;border-radius:10px;padding:8px 14px;font:800 14px system-ui}
  #btnHub{background:#1f2937;color:#e5e7eb;border:0;border-radius:10px;padding:8px 14px;font:800 14px system-ui}`;
  document.head.appendChild(css);
  o.querySelector('#btnRetry').onclick=()=>location.reload();
  o.querySelector('#btnHub').onclick=()=>location.href=hub;
}

window.addEventListener('hha:end',(e)=>{
  const d=e.detail||{};
  d.score??=scoreTotal|0;
  d.misses??=misses|0;
  d.comboMax??=comboMax|0;
  d.duration??=DURATION;
  d.mode??=MODE;
  d.difficulty??=DIFF;
  showResult(d);
});

async function loadModeModule(name){
  const extOrder=(name==='goodjunk'||name==='groups')?['safe','quest','js']:['quest','safe','js'];
  const bases=['../modes/','/webxr-health-mobile/HeroHealth/modes/'];
  for(const base of bases){
    for(const ext of extOrder){
      const url=`${base}${name}.${ext}.js?v=${Date.now()}`;
      try{
        const mod=await import(url);
        if(mod?.boot||mod?.default?.boot)return mod;
      }catch{}
    }
  }
  throw new Error(`ไม่พบไฟล์โหมด: ${name}`);
}

function runCountdown(sec=3){
  return new Promise((resolve)=>{
    const ov=document.getElementById('countOverlay');
    if(!ov)return resolve();
    const label=ov.querySelector('.num');
    let t=sec;
    ov.style.display='flex';
    label.textContent=t;
    const tick=()=>{
      t--;
      if(t<=0){
        ov.classList.add('go');
        label.textContent='GO!';
        setTimeout(()=>{ov.style.display='none';ov.classList.remove('go');resolve();},350);
      }else{
        label.textContent=t;
        setTimeout(tick,900);
      }
    };
    setTimeout(tick,900);
  });
}

let started=false;
async function startGame(){
  if(started)return;started=true;
  scoreTotal=0;misses=0;hits=0;comboMax=0;setScore(0);setCombo(0);setTimeLeft(DURATION);
  try{$('#startPanel')?.setAttribute('visible','false');}catch(_){}
  await runCountdown(3);
  let mod;
  try{mod=await loadModeModule(MODE);}catch(err){alert(`โหลดโหมดไม่พบ\n${err.message}`);started=false;return;}
  const boot=mod.boot||mod.default?.boot;
  if(!boot){alert('โมดูลไม่มี boot()');started=false;return;}
  try{(await boot({difficulty:DIFF,duration:DURATION}))?.start?.();}catch(err){console.error(err);alert('เริ่มโหมดล้มเหลว');started=false;}
}

$('#btnStart')?.addEventListener('click',(e)=>{e.preventDefault();startGame();});
$('#vrStartBtn')?.addEventListener('click',(e)=>{e.preventDefault();startGame();});
if(AUTOSTART)setTimeout(()=>startGame(),0);
