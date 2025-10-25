// ===== Boot flag (for index bootWarn) =====
window.__HHA_BOOT_OK = true;

// ===== Imports (ตรงตามโครงสร้างจริง: HeroHealth/game/core/, HeroHealth/game/modes/) =====
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
import * as groups    from './modes/groups.js';
import * as hydration from './modes/hydration.js';
import * as plate     from './modes/plate.js';

// ===== Utils =====
const qs = (s) => document.querySelector(s);
const setText = (sel, txt) => { const el = qs(sel); if (el) el.textContent = txt; };
const now = () => performance.now?.() ?? Date.now();
const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));

// ===== Systems =====
const hud   = new HUD();
const sfx   = new SFX({ enabled:true, poolSize:4 });
const board = new Leaderboard();
const mission = new MissionSystem();
const power = new PowerUpSystem();
const score = new ScoreSystem();
const eng = new Engine(THREE, document.getElementById('c'));
const fx  = new FloatingFX(eng);
const coach = new Coach({ lang: 'TH' });

// ===== Config =====
const MODES = { goodjunk, groups, hydration, plate };
const DIFFS = {
  Easy:   { time:70, spawn:820, life:4200 },
  Normal: { time:60, spawn:700, life:3000 },
  Hard:   { time:50, spawn:560, life:1900 }
};

// ===== Game State =====
const state = {
  modeKey: 'goodjunk',
  difficulty: 'Normal',
  running: false,
  timeLeft: 60,
  ctx: {},
  fever: false,
  mission: null
};

// ===== Game Functions =====
function start(){
  console.log('▶ เริ่มเกม');
  state.running = true;
  state.timeLeft = (DIFFS[state.difficulty] || DIFFS.Normal).time;
  score.reset();
  updateHUD();
  coach.say?.('เริ่มกันเลย!');
  tick();
}
function pause(){
  state.running = !state.running;
  coach.say?.(state.running ? 'เล่นต่อ!' : 'พักก่อนนะ');
}
function restart(){
  state.running = false;
  setTimeout(start, 200);
}
function updateHUD(){
  setText('#score', score.score|0);
  setText('#combo', 'x' + (score.combo||0));
  setText('#time',  state.timeLeft|0);
}
function tick(){
  if(!state.running) return;
  state.timeLeft--;
  updateHUD();
  if(state.timeLeft<=0){ end(); return; }
  setTimeout(tick,1000);
}
function end(){
  state.running = false;
  console.log('🏁 จบเกม');
  document.getElementById('result').style.display='flex';
}

// ===== Bind Buttons after DOM Ready =====
window.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('#menuBar button').forEach(btn => {
    btn.addEventListener('click', e => {
      const a = btn.getAttribute('data-action');
      if(a==='start') start();
      else if(a==='pause') pause();
      else if(a==='restart') restart();
      else if(a==='help'){
        document.getElementById('help').style.display='flex';
      }
    });
  });

  // Help modal close
  document.getElementById('help')?.addEventListener('click', e=>{
    if(e.target.matches('#btn_ok, #help')) e.currentTarget.style.display='none';
  });

  // Result modal close
  document.getElementById('result')?.addEventListener('click', e=>{
    const a=e.target.getAttribute('data-result');
    if(a==='replay'){ e.currentTarget.style.display='none'; restart(); }
    if(a==='home'){ e.currentTarget.style.display='none'; }
  });

  // ปลดล็อกเสียงจาก gesture แรก
  ['pointerdown','touchstart','keydown'].forEach(ev=>{
    window.addEventListener(ev,()=>sfx.unlock(),{once:true,passive:true});
  });

  console.log("✅ UI Buttons Active");
});

// ===== Boot Complete =====
console.log("✅ main.js loaded and ready");
