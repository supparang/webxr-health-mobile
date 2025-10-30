// === Hero Health Academy — game/main.js (synced with core/hud.js createHUD)
import { Engine }     from './core/engine.js';
import { createHUD }  from './core/hud.js';

import * as goodjunk  from './modes/goodjunk.js';
import * as groups    from './modes/groups.js';
import * as hydration from './modes/hydration.js';
import * as plate     from './modes/plate.js';

const MODES = { goodjunk, groups, hydration, plate };
const $  = (s)=>document.querySelector(s);
const on = (el,ev,fn)=>el && el.addEventListener(ev,fn);

// ---------- Engine & HUD ----------
const engine = new Engine(null, document.getElementById('c'));
const hud = createHUD({
  onHome:  ()=>showMenu(),
  onReplay:()=>startGame()
});

// ---------- App State ----------
const App = {
  modeKey: (document.body.dataset.mode || 'goodjunk'),
  diff:    (document.body.dataset.diff || 'Normal'),
  score:0, combo:0, time:45,
  running:false, loopId:0, _last:0, _accum:0,
  sys:null
};

// ---------- UI wiring ----------
function wireMenu(){
  const setMode=(k)=>{
    App.modeKey=k;
    document.body.dataset.mode=k;
    for(const id of ['m_goodjunk','m_groups','m_hydration','m_plate']){
      const b=$('#'+id); if(!b) continue;
      b.classList.toggle('active', id==='m_'+k);
    }
  };
  on($('#m_goodjunk'),'click',  ()=>setMode('goodjunk'));
  on($('#m_groups'),'click',    ()=>setMode('groups'));
  on($('#m_hydration'),'click', ()=>setMode('hydration'));
  on($('#m_plate'),'click',     ()=>setMode('plate'));

  const setDiff=(d)=>{
    App.diff=d;
    const ids=['d_easy','d_normal','d_hard'];
    ids.forEach(id=> $('#'+id)?.classList.toggle('active', id==='d_'+d.toLowerCase()));
    document.body.dataset.diff = d;
  };
  on($('#d_easy'),'click',   ()=>setDiff('Easy'));
  on($('#d_normal'),'click', ()=>setDiff('Normal'));
  on($('#d_hard'),'click',   ()=>setDiff('Hard'));

  on($('#btn_start'),'click', startGame);

  // result buttons handled inside hud.showResult via onHome/onReplay
}

function showMenu(){ $('#menuBar').style.display='block'; App.running=false; }
function hideMenu(){ $('#menuBar').style.display='none'; }

// ---------- Game Loop ----------
function startGame(){
  hideMenu();

  // reset state
  App.score=0; App.combo=0; App.time=45;
  hud.updateScore(App.score, 'x0', App.time);

  // clear field
  const host = $('#spawnHost'); if (host) host.innerHTML='';

  // boot mode (DOM-spawn factory)
  const Mode = MODES[App.modeKey] || goodjunk;
  App.sys = Mode.create ? Mode.create({
    engine,
    hud,
    coach: {
      onStart(){ hud.setCoach('เริ่ม!'); setTimeout(()=>hud.hideCoach(), 1200); },
      onGood(){ hud.setCoach('+ดีมาก!'); setTimeout(()=>hud.hideCoach(), 800); },
      onBad(){  hud.setCoach('ระวัง!');  setTimeout(()=>hud.hideCoach(), 800); }
    }
  }) : null;

  // start/update
  App.sys?.start?.();
  App.running=true; App._last=performance.now(); App._accum=0;
  cancelAnimationFrame(App.loopId);
  App.loopId = requestAnimationFrame(loop);
}

function loop(ts){
  if(!App.running) return;
  const now = performance.now();
  const dt = Math.min(0.05, (now - (App._last||now))/1000);
  App._last = now;

  // per-frame
  App.sys?.update?.(dt, Bus);

  // per-second
  App._accum += dt;
  if (App._accum >= 1){
    const steps = Math.floor(App._accum);
    App._accum -= steps;
    for(let i=0;i<steps;i++){
      App.time = Math.max(0, (App.time|0) - 1);
      hud.updateScore(App.score, App.combo, App.time);
      if (App.time <= 0){ return endGame(); }
    }
  }
  App.loopId = requestAnimationFrame(loop);
}

function endGame(){
  App.running=false;
  try { App.sys?.stop?.(); } catch {}
  hud.showResult({ score: App.score, combo: App.combo, quests: [] });
}

// ---------- Mode Bus ----------
const Bus = {
  hit({ kind='good', points=10, ui }={}){
    App.score += points|0;
    App.combo = (kind==='bad') ? 0 : (App.combo+1);
    hud.updateScore(App.score, App.combo, App.time);

    // floating text + shatter
    if (ui?.x!=null && ui?.y!=null){
      engine.fx.popText(`+${points}${kind==='perfect'?' ✨':''}`, { x:ui.x, y:ui.y, ms:720 });
      engine.fx.shatter3D(ui.x, ui.y, { shards: 28, sparks: 12 });
    }
  },
  miss(){
    App.combo = 0;
    hud.updateScore(App.score, App.combo, App.time);
    hud.dimPenalty();
  }
};

// ---------- Boot ----------
function boot(){
  wireMenu(); showMenu();

  // Pause on blur / resume on focus (เฉพาะตอนเล่น)
  window.addEventListener('blur', ()=>{ if(App.running) App.running=false; });
  window.addEventListener('focus', ()=>{
    const menuShown = $('#menuBar').style.display!=='none';
    const resultShown = $('#result').style.display!=='none';
    if(!menuShown && !resultShown && !App.running){
      App.running=true; App._last=performance.now();
      App.loopId=requestAnimationFrame(loop);
    }
  });

  // ป้องกัน canvas บังคลิก
  const c = $('#c'); if (c){ c.style.pointerEvents='none'; c.style.zIndex='1'; }
}
boot();
