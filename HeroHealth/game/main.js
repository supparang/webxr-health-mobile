
import * as THREE from 'https://unpkg.com/three@0.159.0/build/three.module.js';
import { Engine } from './core/engine.js';
import { HUD } from './core/hud.js';
import { SFX } from './core/sfx.js';
import { Leaderboard } from './core/leaderboard.js';
import { MissionSystem } from './core/mission.js';
import { PowerUpSystem } from './core/powerup.js';
import { ScoreSystem } from './core/score.js';
import { FloatingFX } from './core/fx.js';
import * as goodjunk from './modes/goodjunk.js';
import * as groups from './modes/groups.js';
import * as hydration from './modes/hydration.js';
import * as plate from './modes/plate.js';

const MODES={ goodjunk, groups, hydration, plate };
const DIFFS={ Easy:{time:70, spawn:820, life:4200, hydWaterRate:.78}, Normal:{time:60, spawn:700, life:3000, hydWaterRate:.66}, Hard:{time:50, spawn:560, life:1900, hydWaterRate:.55} };

const state={ modeKey:'goodjunk', difficulty:'Normal', running:false, timeLeft:60, ACTIVE:new Set(), ctx:{} };
const hud = new HUD();
const sfx = new SFX({enabled:true, poolSize:4});
const board = new Leaderboard();
const mission = new MissionSystem();
const power = new PowerUpSystem();
const score = new ScoreSystem();

const eng = new Engine(THREE, document.getElementById('c'));
const fx = new FloatingFX(eng);

const systems = { score, sfx, power, fx };

function q(s){ return document.querySelector(s); }

// unlock sfx on first gesture
window.addEventListener('pointerdown', ()=>sfx.unlock(), {once:true});

// UI events
document.addEventListener('click', (e)=>{
  const b=e.target.closest('#menuBar button'); if(!b) return;
  const a=b.getAttribute('data-action'), v=b.getAttribute('data-value');
  if(a==='mode'){ state.modeKey=v; q('#modeName').textContent=MODES[v]?.name||v; }
  if(a==='diff'){ state.difficulty=v; q('#difficulty').textContent=v==='Easy'?'ง่าย':(v==='Hard'?'ยาก':'ปกติ'); }
  if(a==='start') start();
  if(a==='pause') state.running=!state.running;
  if(a==='restart'){ end(); start(); }
  if(a==='help') q('#help').style.display='flex';
});
q('#help')?.addEventListener('click', (e)=>{ if(e.target.matches('[data-action="helpClose"], #help')) q('#help').style.display='none'; });

function start(){
  end(true);
  const diff=DIFFS[state.difficulty]||DIFFS.Normal;
  state.running=true; state.timeLeft=diff.time; state.ctx={hits:0, perfectPlates:0, hyd:50};
  score.reset(); hud.setCombo(score.combo); hud.setScore(score.score);
  mission.roll(state.modeKey);
  // init mode
  MODES[state.modeKey].init?.(state,hud,diff);
  updateHUD(); tick(); spawnLoop();
}

function end(silent=false){
  state.running=false; clearTimeout(timers.spawn); clearTimeout(timers.tick);
  if(!silent){
    board.submit(state.modeKey, state.difficulty, score.score);
    const top = board.getTop(5).map((r,i)=>`${i+1}. ${r.mode} • ${r.diff} – ${r.score}`).join('<br>');
    q('#resCore').innerHTML = `คะแนน: <b>${score.score}</b> | โหมด: <b>${MODES[state.modeKey].name}</b> | ความยาก: <b>${state.difficulty}</b>`;
    q('#resBoard').innerHTML = `<h4>🏆 อันดับล่าสุด</h4>${top}`;
    q('#result').style.display='flex';
  }
}
q('#result')?.addEventListener('click', (e)=>{
  const a=e.target.getAttribute('data-result');
  if(a==='replay'){ q('#result').style.display='none'; start(); }
  if(a==='home'){ q('#result').style.display='none'; }
});

function updateHUD(){ hud.setScore(score.score); hud.setCombo(score.combo); hud.setTime(state.timeLeft); }

const timers={spawn:0,tick:0};

function spawnLoop(){
  if(!state.running) return;
  const diff=DIFFS[state.difficulty]||DIFFS.Normal;
  spawnOnce(diff);
  const accel=Math.max(0.5, 1 - (score.score/400));
  const next=Math.max(220, diff.spawn*accel*power.timeScale);
  timers.spawn=setTimeout(spawnLoop, next);
}

function spawnOnce(diff){
  const meta = MODES[state.modeKey].pickMeta(diff,state);
  const el=document.createElement('button');
  el.className='item'; el.textContent=meta.char||'?';
  el.style.left=(10+Math.random()*80)+'vw';
  el.style.top=(20+Math.random()*60)+'vh';
  el.onclick=()=>{
    MODES[state.modeKey].onHit(meta, systems, state, hud);
    state.ctx.hits=(state.ctx.hits||0)+1;
    if(mission.evaluate({ score:score.score, hits:state.ctx.hits, hyd:state.hyd||50, perfectPlates:state.ctx.perfectPlates||0 })){
      fx.spawn3D(null,'🎯 Mission +20','good'); score.add(20); sfx.play('sfx-perfect');
    }
    el.remove();
  };
  document.body.appendChild(el);
  setTimeout(()=>el.remove(), (diff.life||2500));
}

function tick(){
  if(!state.running) return;
  state.timeLeft--; updateHUD();
  if(state.timeLeft<=0){ end(); return; }
  if(state.timeLeft<=10){ q('body')?.classList.add('flash'); try{ document.getElementById('sfx-tick').play(); }catch{} }
  else { q('body')?.classList.remove('flash'); }
  timers.tick=setTimeout(tick,1000);
}
