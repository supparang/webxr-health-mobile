// ===== Boot flag (for index bootWarn) =====
window.__HHA_BOOT_OK = true;

// ===== Imports =====
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

// ===== Utils =====
const qs = (s) => document.querySelector(s);
const now = () => performance.now?.() ?? Date.now();
const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));

// ===== Core Systems =====
const MODES = { goodjunk, groups, hydration, plate };
const hud   = new HUD();
const sfx   = new SFX({ enabled:true, poolSize:6 });
const board = new Leaderboard();
const mission = new MissionSystem();
const power = new PowerUpSystem();
const score = new ScoreSystem();
const eng = new Engine(THREE, document.getElementById('c'));
const fx  = new FloatingFX(eng);
const coach = new Coach({ lang:'TH' });

let state = {
  modeKey: 'goodjunk',
  difficulty: 'Normal',
  running: false,
  timeLeft: 60,
  fever: false,
  demo: false
};

// ===== Difficulty table =====
const DIFFS = {
  Easy:   { time:70, spawn:900, life:4200 },
  Normal: { time:60, spawn:700, life:3000 },
  Hard:   { time:50, spawn:560, life:1900 }
};

// ===== HUD refresh =====
function updateHUD(){
  qs('#score').textContent = score.score|0;
  qs('#combo').textContent = 'x'+(score.combo|0);
  qs('#time').textContent  = state.timeLeft|0;
}

// ===== Start Game =====
export function start(opt={}){
  const diff = DIFFS[state.difficulty];
  state.running = true;
  state.timeLeft = diff.time;
  state.demo = opt.demoPassed || false;
  score.reset();
  hud.reset();
  mission.reset();
  power.reset();
  sfx.tick();
  coach.say('เริ่มกันเลย!');
  loop();
}
window.start = start;

// ===== Main Loop =====
let last = now();
function loop(){
  if(!state.running) return;
  const t = now(); const dt = (t - last)/1000; last = t;
  state.timeLeft -= dt;
  updateHUD();

  // spawn / tick per mode
  MODES[state.modeKey]?.tick?.(state, {score, fx, sfx, power, coach}, hud);

  if(state.timeLeft<=0){
    end();
  }else{
    requestAnimationFrame(loop);
  }
}

// ===== End Game =====
export function end(skipAnim=false){
  state.running = false;
  const html = `<h4>${state.modeKey.toUpperCase()}</h4>
  <p>คะแนนรวม: <b>${score.score|0}</b></p>
  <p>คอมโบสูงสุด: x${score.bestCombo||0}</p>`;
  const res = document.getElementById('result');
  const core = document.getElementById('resCore');
  if(core) core.innerHTML = html;
  if(res) res.style.display='flex';
  sfx.power();
  coach.say('เยี่ยมมาก!');
}
window.end = end;

// ===== Fever Combo System =====
if(typeof score.setHandlers==='function'){
  score.setHandlers({
    onCombo:(x)=>{
      if(x>0 && x%5===0){ sfx.good(); fx.popText('+COMBO', {color:'#0f0'}); }
    },
    onScore:(val)=>{
      if(val>50) fx.popText('PERFECT!',{color:'#ff0'});
    }
  });
}

// ===== Input Shortcuts =====
window.addEventListener('keydown',(e)=>{
  if(!state.running) return;
  const k=e.key.toLowerCase();
  if(k==='p'){ state.running=false; coach.say('Pause'); }
});

// ===== Integration with UI.js =====
window.preStartFlow = function(){
  // fade-in demo countdown
  const coachHUD=document.getElementById('coachHUD');
  const coachText=document.getElementById('coachText');
  if(coachText){ coachText.textContent='เริ่มใน 3...'; }
  coachHUD?.classList.add('show');
  let c=3;
  const int=setInterval(()=>{
    if(!coachText) return;
    c--; coachText.textContent=`${c}...`;
    if(c<=0){
      clearInterval(int);
      coachHUD.classList.remove('show');
      start({demoPassed:true});
    }
  },1000);
};

// ===== Utility for external UI =====
window.HHA = {
  startGame:(opt)=>start(opt),
  pause:()=>{ state.running=false; },
  resume:()=>{ if(!state.running){ state.running=true; loop(); } },
  restart:()=>{ end(true); start({demoPassed:true}); },
  onEnd:(cb)=>{ window.__onGameEnd=cb; },
};
