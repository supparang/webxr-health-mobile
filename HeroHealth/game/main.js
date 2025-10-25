// ===== Boot flag =====
window.__HHA_BOOT_OK = true;

import * as THREE from 'https://unpkg.com/three@0.159.0/build/three.module.js';
import { Engine } from './core/engine.js';
import { HUD } from './core/hud.js';
import { SFX } from './core/sfx.js';
import { Leaderboard } from './core/leaderboard.js';
import { MissionSystem } from './core/mission.js';
import { PowerUpSystem } from './core/powerup.js';
import { ScoreSystem } from './core/score.js';
import { FloatingFX } from './core/fx.js';
import { Coach } from './core/coach.js';

import * as goodjunk from './modes/goodjunk.js';
import * as groups from './modes/groups.js';
import * as hydration from './modes/hydration.js';
import * as plate from './modes/plate.js';

const MODES = { goodjunk, groups, hydration, plate };
const qs = s => document.querySelector(s);
const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));

// ===== Core Systems =====
const hud   = new HUD();
const sfx   = new SFX({ enabled:true });
const board = new Leaderboard();
const mission = new MissionSystem();
const power = new PowerUpSystem();
const score = new ScoreSystem();
const eng   = new Engine(THREE, document.getElementById('c'));
const fx    = new FloatingFX(eng);
const coach = new Coach({ lang:'TH' });

const state = {
  modeKey:'goodjunk',
  difficulty:'Normal',
  running:false,
  timeLeft:60,
  ctx:{hits:0,miss:0},
  fever:false
};

const DIFFS = {
  Easy:   { time:70, spawn:820, life:4200 },
  Normal: { time:60, spawn:700, life:3000 },
  Hard:   { time:50, spawn:560, life:1900 }
};

// ===== Update HUD =====
function updateHUD(){
  qs('#score').textContent = score.score|0;
  qs('#combo').textContent = 'x'+(score.combo|0);
  qs('#time').textContent  = state.timeLeft|0;
}

// ===== Spawner =====
const pool=[];
function createItem(){
  const el=document.createElement('button');
  el.className='item';
  el.style.position='fixed';
  el.style.fontSize='40px';
  el.style.zIndex='100';
  return el;
}
function getItem(){ return pool.pop()||createItem(); }
function releaseItem(el){
  el.onclick=null;
  el.remove();
  if(pool.length<50) pool.push(el);
}

function spawnOnce(diff){
  const mode = MODES[state.modeKey];
  const meta = mode.pickMeta ? mode.pickMeta(diff,state) : {char:'🍎',good:true};
  const el=getItem();
  el.textContent = meta.char;
  el.style.left = (8+Math.random()*84)+'vw';
  el.style.top  = (14+Math.random()*60)+'vh';
  el.onclick = ()=>{
    mode.onHit?.(meta,{score,sfx,power,fx},state,hud);
    releaseItem(el);
    updateHUD();
  };
  document.body.appendChild(el);
  setTimeout(()=>el.isConnected&&releaseItem(el),diff.life||3000);
}

const timers={spawn:0,tick:0};

function spawnLoop(){
  if(!state.running)return;
  const diff = DIFFS[state.difficulty];
  spawnOnce(diff);
  timers.spawn=setTimeout(spawnLoop,diff.spawn);
}

// ===== Game Control =====
function start(){
  end(true);
  const diff = DIFFS[state.difficulty];
  state.running=true;
  state.timeLeft=diff.time;
  score.reset(); updateHUD();
  coach.say('เริ่มเกม!');
  tick(); spawnLoop();
}

function tick(){
  if(!state.running)return;
  state.timeLeft--;
  updateHUD();
  if(state.timeLeft<=0){ end(); return; }
  timers.tick=setTimeout(tick,1000);
}

function end(silent=false){
  state.running=false;
  clearTimeout(timers.spawn); clearTimeout(timers.tick);
  if(!silent){
    const res=qs('#resCore');
    res.innerHTML=`คะแนน: <b>${score.score|0}</b>`;
    document.getElementById('result').style.display='flex';
  }
}

// ===== Menu Buttons =====
document.addEventListener('click',e=>{
  const b=e.target.closest('#menuBar button');
  if(!b)return;
  const a=b.dataset.action, v=b.dataset.value;
  if(a==='mode') state.modeKey=v;
  if(a==='diff') state.difficulty=v;
  if(a==='start') start();
  if(a==='pause'){ state.running=!state.running; if(state.running)tick(); }
  if(a==='restart'){ end(true); start(); }
});
