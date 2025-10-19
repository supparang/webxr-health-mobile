// game/main.js (ES Modules Engine)
import { Engine } from './core/engine.js';
import { HUD } from './ui/hud.js';
import { ScoreSystem } from './systems/score.js';
import { FeverSystem } from './systems/fever.js';
import { PowerUpSystem } from './systems/powerups.js';
import { MissionSystem } from './systems/missions.js';
import { Leaderboard } from './systems/leaderboard.js';
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
  power: new PowerUpSystem(),
  mission: new MissionSystem(),
  board: new Leaderboard(),
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
  ctx:{goodHits:0, targetHitsTotal:0, bestStreak:0, currentStreak:0, waterHits:0, sweetMiss:0, perfectPlates:0, plateFills:0},
};

function groupIcon(k){ return k==='grains'?'🍞':k==='protein'?'🍗':k==='veggies'?'🥦':k==='fruits'?'🍎':'🥛'; }


const POWER_ITEMS = [
  {type:'power', kind:'slow', char:'⏳'},
  {type:'power', kind:'boost', char:'⭐'},
  {type:'power', kind:'shield', char:'🛡️'},
  {type:'power', kind:'timeplus', char:'⏱️➕'},
  {type:'power', kind:'timeminus', char:'⏱️➖'}
];
const TRAP_ITEMS = [
  {type:'trap', kind:'bomb', char:'💣'},
  {type:'trap', kind:'bait', char:'🎭'} // หลอกตา
];
function maybeSpecialMeta(baseMeta){
  const roll=Math.random();
  // 8% power, 5% trap (ถ้าอยู่ใน FEVER ลด trap ลงเล็กน้อย)
  const trapRate = systems.fever.active ? 0.03 : 0.05;
  if(roll<0.08) return POWER_ITEMS[Math.floor(Math.random()*POWER_ITEMS.length)];
  if(roll<0.08+trapRate) return TRAP_ITEMS[Math.floor(Math.random()*TRAP_ITEMS.length)];
  return baseMeta;
}

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
  let meta = MODES[state.modeKey].pickMeta(state.difficulty, state);
  meta = maybeSpecialMeta(meta);
  const ch = meta.char;
  const m = engine.makeBillboard(ch); m.position.set(lane.x,lane.y,lane.z); m.userData={lane:lane.key, meta};
  engine.group.add(m); state.ACTIVE.add(m);
  const life= state.difficulty==='Hard'?1900: state.difficulty==='Easy'?4200:3000;
  m.userData.timer = setTimeout(()=>{ if(!m.parent) return;
    if(meta.type==='gj' && meta.good===false){ systems.score.add(1); }
    if(meta.type==='groups' && state.currentTarget && meta.group===state.currentTarget){ systems.score.bad(); }
    if(meta.type==='hydra' && meta.water===false){ systems.score.add(1); state.ctx.sweetMiss++; }
    updateHUD(); destroy(m);
  }, life + Math.floor(Math.random()*500-250));
}
function destroy(obj){ if(obj.parent) obj.parent.remove(obj); state.ACTIVE.delete(obj); releaseLane(obj.userData.lane); }

function hit(obj){
  const meta=obj.userData.meta;
  // Fever multiplier applied at add() time via wrapping:
  const baseAdd = systems.score.add.bind(systems.score);
  systems.score.add = (base)=> baseAdd(base * systems.fever.scoreMul() * (1+systems.power.scoreBoost));
  MODES[state.modeKey].onHit(meta, systems, state, hud);

  // mission counters
  if(meta.type==='gj'){ if(meta.good){ state.ctx.goodHits++; state.ctx.currentStreak++; state.ctx.bestStreak=Math.max(state.ctx.bestStreak, state.ctx.currentStreak); } else { state.ctx.currentStreak=0; } }
  if(meta.type==='groups'){ if(state.currentTarget && meta.group===state.currentTarget){ state.ctx.targetHitsTotal++; state.ctx.currentStreak++; state.ctx.bestStreak=Math.max(state.ctx.bestStreak, state.ctx.currentStreak); } else { state.ctx.currentStreak=0; } }
  if(meta.type==='hydra'){ if(meta.water){ state.ctx.waterHits++; state.ctx.currentStreak++; state.ctx.bestStreak=Math.max(state.ctx.bestStreak, state.ctx.currentStreak); } else { state.ctx.currentStreak=0; } }
  if(meta.type==='plate'){ state.ctx.plateFills++; state.ctx.currentStreak++; state.ctx.bestStreak=Math.max(state.ctx.bestStreak, state.ctx.currentStreak); }

  // power-ups & traps
  if(meta.type==='power'){
    if(meta.kind==='slow'){ systems.power.apply('slow'); systems.fx.tick(); }
    if(meta.kind==='boost'){ systems.power.apply('boost'); systems.fx.ding(); }
    if(meta.kind==='shield'){ systems.power.apply('shield'); systems.fx.ding(); }
    if(meta.kind==='timeplus'){ state.timeLeft = Math.min(120, state.timeLeft+5); systems.fx.ding(); }
    if(meta.kind==='timeminus'){ state.timeLeft = Math.max(0, state.timeLeft-5); systems.fx.thud(); }
  } else if(meta.type==='trap'){
    // bomb or bait
    if(meta.kind==='bomb'){ // ใช้โล่ได้
      if(!systems.power.consumeShield()){ systems.score.add(-6); systems.score.bad(); systems.fever.onBad(); systems.fx.thud(); state.ctx.currentStreak=0; }
    }
    if(meta.kind==='bait'){ // ล่อให้เข้าใจผิด: หักคอมโบ
      if(!systems.power.consumeShield()){ systems.score.add(-4); systems.score.bad(); systems.fever.onBad(); systems.fx.thud(); state.ctx.currentStreak=0; }
    }
  }

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
  systems.power.tick(dt);
  updateHUD();
}
function runSpawn(){
  if(!state.running || state.paused) return;
  spawnOnce(); spawnCount++;
  const base=700; const accel=Math.max(0.5,1-(spawnCount/120));
  const feverBoost = systems.fever.active ? 0.82 : 1.0;
  const next=Math.max(280, base*accel*feverBoost*systems.power.timeScale);
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
  state.ctx={goodHits:0, targetHitsTotal:0, bestStreak:0, currentStreak:0, waterHits:0, sweetMiss:0, perfectPlates:0, plateFills:0};
  systems.mission.roll(state.modeKey);
  const M = MODES[state.modeKey]; if(M.init) M.init(state, hud, state.difficulty);
  updateHUD(); setTimeout(spawnOnce,200); runSpawn(); runTimer();
  canvas.style.pointerEvents='auto';
}
function pause(){ if(!state.running) return; state.paused=!state.paused; if(!state.paused){ runSpawn(); runTimer(); } }
function end(){ state.running=false; state.paused=false; clearTimeout(spawnTimer); clearTimeout(timeTimer); canvas.style.pointerEvents='none';

  // Leaderboard submit + mission reward
  const bonus = systems.mission.evaluate({...state.ctx, combo: systems.score.combo});
  if(bonus>0){ systems.score.score += bonus; }
  const top = systems.board.submit(state.modeKey, state.difficulty, systems.score.score);
  // Simple toast
  let msg = `จบเกม | คะแนน: ${systems.score.score}`;
  if(bonus>0) msg += ` + โบนัสมิชชัน ${bonus}`;
  const t=document.getElementById('toast') || ( ()=>{const d=document.createElement('div'); d.id='toast'; d.style.cssText='position:fixed;left:50%;top:58px;transform:translateX(-50%);background:rgba(0,0,0,.45);border:1px solid #0ff;border-radius:10px;padding:6px 10px;color:#0ff;z-index:6'; document.body.appendChild(d); return d;})();
  t.textContent = msg; t.style.display='block'; setTimeout(()=>t.style.display='none', 2800);

}

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
