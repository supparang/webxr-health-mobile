import * as THREE from 'https://unpkg.com/three@0.159.0/build/three.module.js';
import { Engine } from './core/engine.js';
import { HUD } from './core/hud.js';
import { Coach } from './core/coach.js';
import { SFX } from './core/sfx.js';
import { ScoreSystem } from './core/score.js';
import { PowerUpSystem } from './core/powerup.js';
import * as goodjunk from './modes/goodjunk.js';
import * as groups from './modes/groups.js';
import * as hydration from './modes/hydration.js';
import * as plate from './modes/plate.js';

window.__HHA_BOOT_OK = true;

const MODES = { goodjunk, groups, hydration, plate };
const DIFFS = {
  Easy:   { time:70, spawn:900, life:4200 },
  Normal: { time:60, spawn:700, life:3000 },
  Hard:   { time:50, spawn:550, life:1800 }
};

const state = {
  modeKey: 'goodjunk',
  difficulty: 'Normal',
  running: false,
  timeLeft: 60,
  lang: localStorage.getItem('hha_lang') || 'TH',
  gfx: localStorage.getItem('hha_gfx') || 'quality'
};

const hud = new HUD();
const sfx = new SFX();
const score = new ScoreSystem();
const power = new PowerUpSystem();
const coach = new Coach({lang: state.lang});
const eng = new Engine(THREE, document.getElementById('c'));

function q(sel){return document.querySelector(sel);}
function updateHUD(){
  hud.setScore(score.score);
  hud.setCombo(score.combo);
  hud.setTime(state.timeLeft);
}

function start(){
  end(true);
  state.running=true;
  const diff=DIFFS[state.difficulty]||DIFFS.Normal;
  state.timeLeft=diff.time;
  score.reset();
  hud.hideHydration();hud.hideTarget();hud.hidePills();
  MODES[state.modeKey].init?.(state,hud,diff);
  if(state.modeKey!=='hydration') hud.hideHydration();
  coach.onStart(state.modeKey);
  tick(); spawnLoop();
}

function end(silent=false){
  state.running=false;
  clearTimeout(state.spawnTimer);
  clearTimeout(state.tickTimer);
  hud.hideHydration();hud.hideTarget();hud.hidePills();
  if(!silent){
    q('#result').style.display='flex';
    coach.onEnd(score.score,{grade:'A',accuracyPct:95});
  }
}

function spawnOnce(diff){
  const meta=MODES[state.modeKey].pickMeta(diff,state);
  const el=document.createElement('button');
  el.className='item';
  el.textContent=meta.char;
  el.style.left=(10+Math.random()*80)+'vw';
  el.style.top=(20+Math.random()*60)+'vh';
  el.onclick=()=>{
    MODES[state.modeKey].onHit(meta,{score,sfx,power},state,hud);
    el.remove();
  };
  document.body.appendChild(el);
  setTimeout(()=>el.remove(),diff.life);
}

function spawnLoop(){
  if(!state.running) return;
  const diff=DIFFS[state.difficulty]||DIFFS.Normal;
  spawnOnce(diff);
  state.spawnTimer=setTimeout(spawnLoop,diff.spawn*power.timeScale);
}

function tick(){
  if(!state.running) return;
  state.timeLeft--;
  updateHUD();
  if(state.timeLeft<=0){end();return;}
  state.tickTimer=setTimeout(tick,1000);
}

q('#btn_start').addEventListener('click',()=>start());
q('#btn_restart').addEventListener('click',()=>{end(true);start();});
q('#btn_help').addEventListener('click',()=>q('#help').style.display='flex');
q('#help').addEventListener('click',e=>{
  if(e.target.matches('[data-action="helpClose"],#help')) e.currentTarget.style.display='none';
});
q('#langToggle').addEventListener('click',()=>{
  state.lang=state.lang==='TH'?'EN':'TH';
  localStorage.setItem('hha_lang',state.lang);
  coach.lang=state.lang;
});
q('#gfxToggle').addEventListener('click',()=>{
  state.gfx=state.gfx==='low'?'quality':'low';
  localStorage.setItem('hha_gfx',state.gfx);
  eng.renderer.setPixelRatio(state.gfx==='low'?0.75:(window.devicePixelRatio||1));
});
