// Integrated main.js (minimal wire-up)
import { Engine } from './core/engine.js';
import { HUD } from './core/hud.js';
import { FloatingFX } from './core/fx.js';
import { FeverSystem } from './core/fever.js';
import { PowerUpSystem } from './core/powerup.js';
import { MissionSystem } from './core/mission.js';
import { Leaderboard } from './core/leaderboard.js';
import { ScoreSystem } from './core/score.js';
import { Coach } from './core/coach.js';

import * as GJ from './modes/goodjunk.js';
import * as GP from './modes/groups.js';
import * as HY from './modes/hydration.js';
import * as PL from './modes/plate.js';

const THREE = window?.THREE;
window.__HHA_BOOT = true;

const DIFFS={
  Easy:{time:70, spawnBase:820, life:4200, trapRate:0.03, powerRate:0.10, hydWaterRate:0.78},
  Normal:{time:60, spawnBase:700, life:3000, trapRate:0.05, powerRate:0.08, hydWaterRate:0.66},
  Hard:{time:50, spawnBase:560, life:1900, trapRate:0.07, powerRate:0.06, hydWaterRate:0.55}
};

const MODES = { goodjunk:GJ, groups:GP, hydration:HY, plate:PL };

let engine,hud,floating,systems,coach;
const state={ modeKey:'goodjunk', difficulty:'Normal', diffCfg:DIFFS.Normal,
  running:false, paused:false, timeLeft:60, ACTIVE:new Set(), lane:{},
  ctx:{}, hydMin:45,hydMax:65,hyd:50 };

function updateHUD(){
  hud.setScore(systems?.score?.score||0);
  hud.setCombo(systems?.score?.combo||1);
  hud.setTime(state.timeLeft|0);
  hud.setDiff(state.difficulty);
  hud.setMode(state.modeKey);
  hud.fever(!!systems?.fever?.active);
}

function setupLanes(){ const X=[-1.1,-0.55,0,0.55,1.1], Y=[-0.2,0.0,0.18,0.32], Z=-2.2; state.lane={X,Y,Z,occupied:new Set(),cooldown:new Map(),last:null}; }
const now=()=>performance.now();
const isAdj=(r,c)=>{ const last=state.lane.last; if(!last) return false; const [pr,pc]=last; return Math.abs(pr-r)<=1 && Math.abs(pc-c)<=1; };
function pickLane(){
  const {X,Y,Z,occupied,cooldown}=state.lane; const cand=[];
  for(let r=0;r<Y.length;r++)for(let c=0;c<X.length;c++){
    const k=r+','+c,cd=cooldown.get(k)||0,free=!occupied.has(k)&&now()>cd&&!isAdj(r,c);
    if(free) cand.push({r,c,k});
  }
  if(!cand.length) return null;
  const p=cand[Math.floor(Math.random()*cand.length)];
  occupied.add(p.k); state.lane.last=[p.r,p.c];
  return {x:X[p.c],y:1.6+Y[p.r],z:Z-0.1*Math.abs(p.c-2),key:p.k};
}
function releaseLane(k){ const {occupied,cooldown}=state.lane; occupied.delete(k); cooldown.set(k, now()+800); }

const POWER_ITEMS=[{type:'power',kind:'slow',char:'⏳'},{type:'power',kind:'boost',char:'⭐'},{type:'power',kind:'shield',char:'🛡️'}];
function maybeSpecialMeta(base){
  const r=Math.random(), p=state.diffCfg?.powerRate??0.08;
  if(r<p) return POWER_ITEMS[Math.floor(Math.random()*POWER_ITEMS.length)];
  return base;
}

function spawnOnce(){
  const lane=pickLane(); if(!lane) return;
  let meta = MODES[state.modeKey].pickMeta(state.diffCfg,state);
  meta = maybeSpecialMeta(meta);
  const m=engine.makeBillboard(meta.char);
  m.position.set(lane.x,lane.y,lane.z);
  m.userData={lane:lane.key,meta};
  engine.group.add(m); state.ACTIVE.add(m);
  const life=state.diffCfg?.life||3000;
  m.userData.timer=setTimeout(()=>{ if(!m.parent) return; destroy(m); }, life + Math.floor(Math.random()*500-250));
}

function destroy(obj){
  if(obj.userData?.timer) { clearTimeout(obj.userData.timer); obj.userData.timer=null; }
  if(obj.parent) obj.parent.remove(obj);
  state.ACTIVE.delete(obj);
  if (obj.userData?.lane) releaseLane(obj.userData.lane);
}

function hit(obj){
  const meta=obj.userData.meta;
  MODES[state.modeKey].onHit(meta, systems, state, hud);
  destroy(obj);
  updateHUD();
}

function onCanvasClick(ev){
  if(!state.running || state.paused) return;
  const x=ev.clientX ?? (ev.touches&&ev.touches[0].clientX);
  const y=ev.clientY ?? (ev.touches&&ev.touches[0].clientY);
  const inter=engine.raycastFromClient(x,y); if(inter.length) hit(inter[0].object);
}

let spawnTimer=null,timeTimer=null,spawnCount=0,lastTs=performance.now();
function loop(){
  const ts=performance.now(), dt=ts-lastTs; lastTs=ts;
  systems.fever.update(dt); systems.power.tick(dt);
  updateHUD();
}
function runSpawn(){
  if(!state.running || state.paused) return;
  spawnOnce(); spawnCount++;
  const base=state.diffCfg?.spawnBase||700;
  const next=Math.max(280, base*1.0*systems.power.timeScale);
  spawnTimer=setTimeout(runSpawn,next);
}
function runTimer(){
  if(!state.running || state.paused) return;
  timeTimer=setTimeout(()=>{ state.timeLeft--; if(state.timeLeft<=0){ end(); } else runTimer(); updateHUD(); },1000);
}

function start(){
  document.getElementById('help').style.display='none';
  state.diffCfg=DIFFS[state.difficulty]||DIFFS.Normal;
  state.running=true; state.paused=false;
  state.timeLeft=state.diffCfg.time; spawnCount=0;
  systems.score.reset(); setupLanes();
  updateHUD();
  setTimeout(spawnOnce,200);
  runSpawn(); runTimer();
  document.getElementById('c').style.pointerEvents='auto';
}
function pause(){ if(!state.running) return; state.paused=!state.paused; if(!state.paused){ runSpawn(); runTimer(); } }
function end(){
  state.running=false; state.paused=false;
  clearTimeout(spawnTimer); clearTimeout(timeTimer);
  document.getElementById('c').style.pointerEvents='none';
  systems.board.submit(state.modeKey, state.difficulty, systems.score.score);
  document.getElementById('result').style.display='flex';
}

function boot(){
  const canvas=document.getElementById('c');
  window.__HHA_BOOT = true;
  engine=new Engine(THREE,canvas);
  hud=new HUD(); floating=new FloatingFX(engine); coach=new Coach();
  systems={ score:new ScoreSystem(), fever:new FeverSystem(), power:new PowerUpSystem(), mission:new MissionSystem(), board:new Leaderboard() };

  document.getElementById('langToggle')?.addEventListener('click', ()=>{});
  document.getElementById('soundToggle')?.addEventListener('click', ()=>{});
  document.getElementById('gfxSelect')?.addEventListener('change', ()=>{});

  ['goodjunk','groups','hydration','plate'].forEach(k=>{
    document.querySelector(`button[data-action="mode"][data-value="${k}"]`)?.addEventListener('click', ()=>{ state.modeKey=k; document.getElementById('modeName').textContent=k; });
  });
  ['Easy','Normal','Hard'].forEach(d=>{
    document.querySelector(`button[data-action="diff"][data-value="${d}"]`)?.addEventListener('click', ()=>{ state.difficulty=d; document.getElementById('difficulty').textContent=d; });
  });
  document.querySelector('button[data-action="start"]')?.addEventListener('click', start);
  document.querySelector('button[data-action="pause"]')?.addEventListener('click', pause);
  document.querySelector('button[data-action="restart"]')?.addEventListener('click', ()=>{ end(); start(); });
  document.querySelector('button[data-action="help"]')?.addEventListener('click', ()=>{ document.getElementById('help').style.display='flex'; });
  document.getElementById('help')?.addEventListener('click',(e)=>{ if(e.target.getAttribute('data-action')==='helpClose' || e.target.id==='help') e.currentTarget.style.display='none'; });
  document.getElementById('result')?.addEventListener('click',(e)=>{
    const b=e.target.closest('button'); if(!b) return; const a=b.getAttribute('data-result');
    if(a==='replay'){ document.getElementById('result').style.display='none'; start(); }
    if(a==='home'){ document.getElementById('result').style.display='none'; }
  });

  const canvasEl=document.getElementById('c');
  canvasEl.addEventListener('click', onCanvasClick, {passive:true});
  canvasEl.addEventListener('touchstart', e=>{ const t=e.touches&&e.touches[0]; if(!t) return; onCanvasClick({clientX:t.clientX, clientY:t.clientY}); }, {passive:true});

  engine.startLoop(loop);
}
if(document.readyState==='loading'){ window.addEventListener('DOMContentLoaded', boot); } else { boot(); }
