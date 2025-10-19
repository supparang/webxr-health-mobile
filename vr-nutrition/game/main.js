// game/main.js (ES Modules Engine)
import { Engine } from './core/engine.js';
import { HUD } from './ui/hud.js';
import { ScoreSystem } from './systems/score.js';
import { FeverSystem } from './systems/fever.js';
import * as M1 from './modes/goodjunk.js';
import * as M2 from './modes/groups.js';
import * as M3 from './modes/hydration.js';
import * as M4 from './modes/plate.js';

const canvas = document.getElementById('c');
const engine = new Engine(THREE, canvas);
const hud = new HUD();

const sfx = {
  ding(){ const el=document.getElementById('sfx-ding'); try{ el.currentTime=0; el.play(); }catch{} },
  thud(){ const el=document.getElementById('sfx-thud'); try{ el.currentTime=0; el.play(); }catch{} },
  tick(){ const el=document.getElementById('sfx-tick'); try{ el.currentTime=0; el.play(); }catch{} },
};

const systems = {
  score: new ScoreSystem(),
  fever: new FeverSystem(),
  fx: sfx
};

const MODES = {
  goodjunk:M1, groups:M2, hydration:M3, plate:M4
};

const state = {
  modeKey:'goodjunk',
  difficulty:'Normal',
  running:false, paused:false,
  timeLeft:60,
  ACTIVE:new Set(),
  lane:{},
};

function groupIcon(k){ return k==='grains'?'🍞':k==='protein'?'🍗':k==='veggies'?'🥦':k==='fruits'?'🍎':'🥛'; }

function setupLanes(){
  const X=[-1.1,-0.55,0,0.55,1.1], Y=[-0.2,0.0,0.18,0.32], Z=-2.2;
  state.lane={X,Y,Z, occupied:new Set(), cooldown:new Map(), last:null};
}
function now(){ return performance.now(); }
function isAdj(r,c){ const last=state.lane.last; if(!last) return false; const [pr,pc]=last; return Math.abs(pr-r)<=1 && Math.abs(pc-c)<=1; }
function pickLane(){
  const {X,Y,Z,occupied,cooldown}=state.lane;
  const cand=[]; for(let r=0;r<Y.length;r++){ for(let c=0;c<X.length;c++){ const k=r+','+c,cd=cooldown.get(k)||0,free=!occupied.has(k)&&now()>cd&&!isAdj(r,c); if(free) cand.push({r,c,k}); } }
  if(!cand.length) return null; const p=cand[Math.floor(Math.random()*cand.length)];
  occupied.add(p.k); state.lane.last=[p.r,p.c]; return {x:X[p.c], y:1.6+Y[p.r], z:Z-0.1*Math.abs(p.c-2), key:p.k};
}
function releaseLane(k){ const {occupied,cooldown}=state.lane; occupied.delete(k); cooldown.set(k, now()+800); }

function spawnOnce(){
  const lane=pickLane(); if(!lane) return;
  const meta = MODES[state.modeKey].pickMeta(state.difficulty, state);
  const ch = meta.char;
  const m = engine.makeBillboard(ch); m.position.set(lane.x,lane.y,lane.z); m.userData={lane:lane.key, meta};
  engine.group.add(m); state.ACTIVE.add(m);
  const life= state.difficulty==='Hard'?1900: state.difficulty==='Easy'?4200:3000;
  m.userData.timer = setTimeout(()=>{ if(!m.parent) return;
    if(meta.type==='gj' && meta.good===false){ systems.score.add(1); } // sweep bonus
    if(meta.type==='groups' && state.currentTarget && meta.group===state.currentTarget){ systems.score.bad(); }
    if(meta.type==='hydra' && meta.water===false){ systems.score.add(1); }
    updateHUD(); destroy(m);
  }, life + Math.floor(Math.random()*500-250));
}
function destroy(obj){ if(obj.parent) obj.parent.remove(obj); state.ACTIVE.delete(obj); releaseLane(obj.userData.lane); }

function hit(obj){
  const meta=obj.userData.meta;
  // Fever multiplier applied at add() time via wrapping:
  const baseAdd = systems.score.add.bind(systems.score);
  systems.score.add = (base)=> baseAdd(base * systems.fever.scoreMul());
  MODES[state.modeKey].onHit(meta, systems, state, hud);
  systems.score.add = baseAdd; // restore
  updateHUD();
}

function onClick(ev){
  if(!state.running || state.paused) return;
  const inter = engine.raycastFromClient(ev.clientX, ev.clientY);
  if(inter.length){ const o=inter[0].object; hit(o); destroy(o); }
}

function updateHUD(){
  hud.setScore(systems.score.score);
  hud.setCombo(systems.score.combo);
  hud.setTime(state.timeLeft);
  hud.setDiff(state.difficulty);
  hud.setMode(MODES[state.modeKey].name || state.modeKey);
  hud.fever(systems.fever.active);
}

let spawnTimer=null, timeTimer=null, spawnCount=0, lastTs=performance.now();
function loop(){
  const ts=performance.now(); const dt=ts-lastTs; lastTs=ts;
  systems.fever.update(dt);
  updateHUD();
}
function runSpawn(){
  if(!state.running || state.paused) return;
  spawnOnce(); spawnCount++;
  const base=700; const accel=Math.max(0.5,1-(spawnCount/120));
  const feverBoost = systems.fever.active ? 0.82 : 1.0;
  const next=Math.max(300, base*accel*feverBoost);
  spawnTimer=setTimeout(runSpawn, next);
}
function runTimer(){
  if(!state.running || state.paused) return;
  timeTimer=setTimeout(()=>{
    state.timeLeft--;
    if(state.timeLeft<=0){ end(); }
    else runTimer();
    updateHUD();
  }, 1000);
}

function start(){
  document.getElementById('help').style.display='none';
  state.running=true; state.paused=false; state.timeLeft=60; spawnCount=0; systems.score.reset(); setupLanes();
  const M = MODES[state.modeKey]; if(M.init) M.init(state, hud, state.difficulty);
  updateHUD(); setTimeout(spawnOnce,200); runSpawn(); runTimer();
  canvas.style.pointerEvents='auto';
}
function pause(){ if(!state.running) return; state.paused=!state.paused; if(!state.paused){ runSpawn(); runTimer(); } }
function end(){ state.running=false; state.paused=false; clearTimeout(spawnTimer); clearTimeout(timeTimer); canvas.style.pointerEvents='none'; }

// UI
document.getElementById('menuBar').addEventListener('click', (e)=>{
  const btn=e.target.closest('button'); if(!btn) return;
  const act=btn.getAttribute('data-action'); const val=btn.getAttribute('data-value'); e.preventDefault(); e.stopPropagation();
  if(act==='start') start();
  else if(act==='pause') pause();
  else if(act==='restart'){ end(); start(); }
  else if(act==='help'){ document.getElementById('help').style.display='flex'; }
  else if(act==='mode'){ state.modeKey=val; if(val!=='plate') hud.hidePills(); if(val!=='groups') hud.hideTarget(); updateHUD(); }
  else if(act==='diff'){ state.difficulty=val; updateHUD(); }
}, false);
document.getElementById('help').addEventListener('click',(e)=>{
  if(e.target.getAttribute('data-action')==='helpClose' || e.target.id==='help') e.currentTarget.style.display='none';
});

canvas.addEventListener('click', onClick);
canvas.addEventListener('touchstart',(e)=>{ if(e.touches&&e.touches[0]) onClick({clientX:e.touches[0].clientX, clientY:e.touches[0].clientY}); }, {passive:true});

engine.startLoop(loop);

// error box
window.onerror=(msg,src,line,col)=>{ const box=document.getElementById('errors'); if(!box){ const d=document.createElement('div'); d.id='errors'; d.style.cssText='position:fixed;top:8px;right:8px;background:rgba(30,0,0,.85);color:#ffb;border:1px solid #f66;padding:6px 10px;border-radius:8px;z-index:9'; document.body.appendChild(d); }
  const err=document.getElementById('errors'); err.style.display='block'; err.textContent='Errors: '+msg+' @'+(src||'inline')+':'+line+':'+col; };
