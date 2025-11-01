// === Hero Health Academy — game/main.js (Option B, final safe build) ===
import { sfx as SFX } from './core/sfx.js';
import { Engine, FX } from './core/engine.js';
import { ScoreSystem } from './core/score.js';
import { PowerUpSystem } from './core/powerup.js';

// --- Modes ---
import * as goodjunk from './modes/goodjunk.js';
import * as groups from './modes/groups.js';
import * as hydration from './modes/hydration.js';
import * as plate from './modes/plate.js';
const MODS = { goodjunk, groups, hydration, plate };

// ---------- Globals ----------
const engine = new Engine();
engine.sfx = SFX;
SFX.loadIds(['sfx-good','sfx-bad','sfx-perfect','sfx-tick','sfx-powerup']);

const score = new ScoreSystem();
let power = null;

function createPower() {
  try {
    power = new PowerUpSystem();
    power.onChange(updatePowerBar);
    power.attachToScore(score);
    console.debug('[PowerUpSystem] ready', typeof power.dispose);
  } catch (e) {
    console.warn('[PowerUpSystem] fallback mode');
    power = {
      apply(){}, onChange(){}, attachToScore(){},
      getCombinedTimers(){ return {x2:0,freeze:0,sweep:0,shield:0,shieldCount:0}; }
    };
  }
}

let state = { mode:'goodjunk', diff:'Normal', running:false, raf:0, lastT:0, ctrl:null, legacy:null };

const $ = (s)=>document.querySelector(s);
const modeBadge=$('#modeBadge'), diffBadge=$('#diffBadge'), scoreVal=$('#scoreVal'), menuBar=$('#menuBar'), spawnHost=$('#spawnHost');

// ---------- HUD ----------
function toast(msg){
  const el=$('#toast'); if(!el) return;
  el.textContent=msg; el.classList.add('show');
  setTimeout(()=>{el.classList.remove('show');},1000);
}
function updatePowerBar(){
  try{
    const timers=power.getCombinedTimers();
    const any=Math.max(timers.x2,timers.freeze,timers.sweep,timers.shield)>0?1:0;
    const pct=Math.min(100,(timers.x2*10+timers.freeze*15+timers.sweep*12+timers.shield*8));
    const fill=$('#powerFill'); if(fill) fill.style.width=(any?Math.max(8,pct):0)+'%';
  }catch{}
}
function setActiveBtn(groupSel,val,attr){
  document.querySelectorAll(groupSel).forEach(el=>{
    if(el.dataset[attr]===val) el.classList.add('active'); else el.classList.remove('active');
  });
}
function safeDisposePower(){
  try{
    if(power && typeof power.dispose==='function') power.dispose();
    else if(power){
      power.timers={x2:0,freeze:0,sweep:0,shield:0};
      power.stacks={x2:0,freeze:0,sweep:0,shield:0};
      updatePowerBar();
    }
  }catch(e){console.warn('safeDisposePower fail',e);}
}

// ---------- Fallback ----------
const Fallback={
  start(){
    spawnHost.innerHTML='';
    const b=document.createElement('button');
    b.textContent='🥗'; b.className='spawn-emoji';
    Object.assign(b.style,{position:'fixed',left:'50%',top:'50%',transform:'translate(-50%,-50%)',fontSize:'64px',border:0,background:'transparent',zIndex:8});
    b.onclick=(ev)=>{
      FX.popText('+10',{x:ev.clientX,y:ev.clientY});
      score.addKind('good',{comboNow:score.combo});
      engine.sfx.good();
      scoreVal.textContent=score.get();
    };
    document.body.appendChild(b);
  },
  stop(){}, update(){}
};

// ---------- Bus ----------
const Bus={
  hit(p={}){
    const k=p.kind||'good'; const meta=p.meta||{};
    if(k==='golden'){score.addKind('perfect',{...meta,golden:true,comboNow:score.combo});power.apply('x2',6);engine.sfx.perfect();FX.popText('+BONUS ✨',p.ui);}
    else if(k==='perfect'){score.addKind('perfect',{...meta,comboNow:score.combo});engine.sfx.perfect();}
    else if(k==='good'){score.addKind('good',{...meta,comboNow:score.combo});engine.sfx.good();}
    else{score.addKind('ok',{...meta,comboNow:score.combo});}
    scoreVal.textContent=score.get();
  },
  miss(p={}){score.addKind('bad',p.meta||{});engine.sfx.bad();scoreVal.textContent=score.get();
    document.body.classList.add('flash-danger');setTimeout(()=>document.body.classList.remove('flash-danger'),180);},
  power(kind){power.apply(kind);engine.sfx.power();toast('Power: '+kind);}
};

// ---------- Loop ----------
function loop(ts){
  if(!state.running) return;
  const t=ts||performance.now(), dt=state.lastT?Math.min(0.1,(t-state.lastT)/1000):0.016; state.lastT=t;
  try{
    if(state.ctrl?.update) state.ctrl.update(dt,Bus);
    else if(state.legacy?.update) state.legacy.update(dt,Bus);
  }catch(e){showError(e);}
  state.raf=requestAnimationFrame(loop);
}

// ---------- Control ----------
function stopGame(){
  state.running=false; cancelAnimationFrame(state.raf);
  safeDisposePower(); score.reset();
  try{state.ctrl?.stop?.();}catch{} try{state.legacy?.stop?.();}catch{} try{spawnHost.innerHTML='';}catch{}
}
function startGame(){
  stopGame(); createPower(); updatePowerBar(); SFX.unlock();
  modeBadge.textContent=state.mode; diffBadge.textContent=state.diff; scoreVal.textContent='0';
  let mod=MODS[state.mode]; state.ctrl=null; state.legacy=null;
  try{
    if(mod?.create){state.ctrl=mod.create({engine});state.ctrl.start?.({difficulty:state.diff});}
    else if(mod?.start&&mod?.update){state.legacy=mod;mod.start({difficulty:state.diff});}
    else{toast('Mode not found → fallback');state.ctrl=Fallback;Fallback.start();}
  }catch(e){showError(e);state.ctrl=Fallback;Fallback.start();}
  menuBar.style.display='none'; state.running=true; state.lastT=0; state.raf=requestAnimationFrame(loop);
}

// ---------- Menu ----------
(function(){
  const mb=menuBar;
  const onHit=(ev)=>{
    const t=ev.target.closest('.btn'); if(!t) return;
    SFX.unlock();
    if(t.dataset.mode){state.mode=t.dataset.mode;setActiveBtn('.btn[data-mode]',state.mode,'mode');modeBadge.textContent=state.mode;return;}
    if(t.dataset.diff){state.diff=t.dataset.diff;setActiveBtn('.btn[data-diff]',state.diff,'diff');diffBadge.textContent=state.diff;return;}
    if(t.dataset.action==='start'){startGame();return;}
    if(t.dataset.action==='howto'){alert('🥗 Good vs Junk: แตะอาหารดี หลีกของไม่ดี\n🧺 Groups: ตรงหมวดอาหาร\n💧 Hydration: รักษา 45–65%\n🍽️ Plate: เติมครบหมวด');return;}
    if(t.dataset.action==='sound'){const on=!SFX.isEnabled();SFX.setEnabled(on);SFX.unlock();if(on)SFX.good();toast('Sound: '+(on?'ON':'OFF'));return;}
  };
  ['click','pointerup','touchend','keydown'].forEach(e=>mb.addEventListener(e,onHit,{passive:true}));
})();

// ---------- Error ----------
function showError(e){
  const msg=(e&&(e.message||e.toString()))||'Unknown';
  const box=document.createElement('div');
  box.style.cssText='position:fixed;left:0;right:0;bottom:0;z-index:99999;background:#7f1d1d;color:#fff;padding:6px 10px;font:600 13px ui-rounded';
  box.textContent='⚠️ '+msg; document.body.appendChild(box); console.error(e);
}
window.addEventListener('error',e=>showError(e.error||e));
window.addEventListener('unhandledrejection',e=>showError(e.reason||e));

window.addEventListener('pointerdown',()=>SFX.unlock(),{once:true,passive:true});
try{window.HHA={start:startGame,stop:stopGame,setMode:(m)=>state.mode=m,setDiff:(d)=>state.diff=d,score,createPower};}catch{}
