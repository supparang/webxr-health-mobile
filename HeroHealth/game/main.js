// === Hero Health Academy — game/main.js (2025-10-30 synced version)
// ใช้ Engine + FX + โหมด DOM-spawn เช่น goodjunk.js

import { Engine } from './core/engine.js';
import * as goodjunk  from './modes/goodjunk.js';
import * as groups    from './modes/groups.js';
import * as hydration from './modes/hydration.js';
import * as plate     from './modes/plate.js';

const MODES = { goodjunk, groups, hydration, plate };
const $ = (s)=>document.querySelector(s);
const on=(el,ev,fn)=>el&&el.addEventListener(ev,fn);

const engine = new Engine(null, document.getElementById('c'));

const App = {
  modeKey:'goodjunk',
  diff:'Normal',
  score:0, combo:0, time:45,
  running:false, loopId:0,
  sys:null, hud:null, coach:null
};

// ---------------- HUD ----------------
const HUD = {
  show(){ $('#hudWrap').style.display='block'; },
  hide(){ $('#hudWrap').style.display='none'; },
  setScore(v){ $('#score').textContent = v|0; },
  setTime(v){ $('#time').textContent  = v|0; },
  setCombo(v){ $('#combo').textContent = 'x'+(v|0); },
  dimPenalty(){
    document.body.classList.add('flash-danger');
    setTimeout(()=>document.body.classList.remove('flash-danger'),160);
  }
};

// ---------------- Menu & Events ----------------
function wireMenu(){
  const setMode=(k, label)=>{
    App.modeKey=k;
    document.body.dataset.mode=k;
    for(const id of ['m_goodjunk','m_groups','m_hydration','m_plate']){
      const b=$('#'+id); b.classList.toggle('active', id==='m_'+k);
    }
  };
  on($('#m_goodjunk'),'click',()=>setMode('goodjunk'));
  on($('#m_groups'),'click',()=>setMode('groups'));
  on($('#m_hydration'),'click',()=>setMode('hydration'));
  on($('#m_plate'),'click',()=>setMode('plate'));

  const setDiff=(d)=>{
    App.diff=d;
    for(const id of ['d_easy','d_normal','d_hard']){
      const b=$('#'+id); b.classList.toggle('active', id==='d_'+d.toLowerCase());
    }
  };
  on($('#d_easy'),'click',()=>setDiff('Easy'));
  on($('#d_normal'),'click',()=>setDiff('Normal'));
  on($('#d_hard'),'click',()=>setDiff('Hard'));

  on($('#btn_start'),'click', startGame);
  on($('#result'),'click', (e)=>{
    const a=e.target.closest?.('[data-result]');
    if(!a) return;
    if(a.dataset.result==='replay'){ hideResult(); startGame(); }
    if(a.dataset.result==='home'){ hideResult(); showMenu(); }
  });
}

function showMenu(){ $('#menuBar').style.display='block'; HUD.hide(); App.running=false; }
function hideMenu(){ $('#menuBar').style.display='none'; HUD.show(); }

// ---------------- Gameplay Loop ----------------
function startGame(){
  hideMenu();
  App.score=0; App.combo=0; HUD.setScore(0); HUD.setCombo(0);
  App.time=45; HUD.setTime(App.time); App.running=true;

  const host = $('#spawnHost'); host.innerHTML='';

  const Mode = MODES[App.modeKey] || goodjunk;
  App.sys = Mode.create ? Mode.create({ engine, hud:HUD, coach:{
    onStart(){ $('#coachText').textContent='เริ่ม!'; $('#coachHUD').classList.add('show'); setTimeout(()=>$('#coachHUD').classList.remove('show'),1200); },
    onGood(){}, onBad(){}
  }}) : null;

  App.sys?.start?.();
  cancelAnimationFrame(App.loopId);
  App.loopId = requestAnimationFrame(loop);
}

function loop(ts){
  if(!App.running) return;
  const now = performance.now();
  if(!App._last) App._last = now;
  const dt = Math.min(0.05,(now-App._last)/1000);
  App._last = now;

  App.sys?.update?.(dt, Bus);

  App._accum=(App._accum||0)+dt;
  if(App._accum>=1){
    App._accum-=1;
    App.time=Math.max(0,App.time-1);
    HUD.setTime(App.time);
    if(App.time<=0){ endGame(); return; }
  }
  App.loopId=requestAnimationFrame(loop);
}

function endGame(){
  App.running=false;
  App.sys?.stop?.();
  $('#resultText').textContent=`คะแนน ${App.score}`;
  showResult();
}

function showResult(){ $('#result').style.display='flex'; }
function hideResult(){ $('#result').style.display='none'; }

// ---------------- Event Bus ----------------
const Bus={
  hit({kind='good',points=10,ui={}}={}){
    App.score+=points;
    HUD.setScore(App.score);
    App.combo = (kind==='bad') ? 0 : (App.combo+1);
    HUD.setCombo(App.combo);
  },
  miss(){ App.combo=0; HUD.setCombo(0); }
};

// ---------------- Boot ----------------
function boot(){
  wireMenu(); showMenu();
  window.addEventListener('blur',()=>{ if(App.running) App.running=false; });
  window.addEventListener('focus',()=>{
    if(App.running) return;
    const menuShown = $('#menuBar').style.display!=='none';
    const resultShown = $('#result').style.display!=='none';
    if(!menuShown && !resultShown){ App.running=true; App._last=performance.now(); requestAnimationFrame(loop); }
  });
}
boot();
