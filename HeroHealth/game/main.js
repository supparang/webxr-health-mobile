// ===== Boot flag (for index bootWarn) =====
window.__HHA_BOOT_OK = true;

// ===== Imports (ตรงตามโครงสร้าง GitHub Pages) =====
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
// (optional) import { Progression } from './core/progression.js';

import * as goodjunk from './modes/goodjunk.js';
import * as groups    from './modes/groups.js';
import * as hydration from './modes/hydration.js';
import * as plate     from './modes/plate.js';

// ===== Utils / Helpers =====
const qs = (s) => document.querySelector(s);
const setText = (sel, txt) => { const el = qs(sel); if (el) el.textContent = txt; };
const show = (sel, on, disp='flex') => { const el = qs(sel); if (el) el.style.display = on ? disp : 'none'; };
const now = () => performance.now?.() ?? Date.now();
const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));

// Anti-spam click
let _lastClick=0;
const allowClick=()=>{ const t=now(); if(t-_lastClick<220) return false; _lastClick=t; return true; };

// SFX throttle (≤8/วินาที)
let _sfxCount=0,_sfxWin=0;
const playSFX=(id,opts)=>{ const t=(now()/1000)|0; if(t!==_sfxWin){_sfxWin=t;_sfxCount=0;} if(_sfxCount++<8) try{sfx.play(id,opts);}catch{} };

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
  Easy:   { time:70, spawn:820, life:4200, hydWaterRate:0.78 },
  Normal: { time:60, spawn:700, life:3000, hydWaterRate:0.66 },
  Hard:   { time:50, spawn:560, life:1900, hydWaterRate:0.55 }
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

// ===== Fever / Combo Hooks =====
let feverCharge = 0;               
const FEVER_REQ = 10;

if (typeof score.setHandlers === 'function') {
  score.setHandlers({
    onCombo:(x)=>{
      coach.onCombo?.(x);
      feverCharge = Math.min(1, x/FEVER_REQ);
      hud.setFeverProgress?.(feverCharge);

      if(!state.fever && x >= FEVER_REQ){
        state.fever = true;
        document.body.classList.add('fever-bg');
        coach.onFever?.();
        playSFX('sfx-powerup');
        power.apply('boost'); // +100% คะแนน 7s
        setTimeout(()=>{
          state.fever=false;
          document.body.classList.remove('fever-bg');
          feverCharge=0;
          hud.setFeverProgress?.(0);
        }, 7000);
      }
    }
  });
}

// ===== Boot Ready =====
console.log("✅ main.js loaded successfully.");
