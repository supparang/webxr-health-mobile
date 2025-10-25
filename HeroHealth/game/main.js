// ===== Boot flag (for index bootWarn) =====
window.__HHA_BOOT_OK = true;

// ===== Imports (แก้ path ให้ถูกกับ GitHub Pages) =====
import * as THREE from 'https://unpkg.com/three@0.159.0/build/three.module.js';
import { Engine } from '../core/engine.js';
import { HUD } from '../core/hud.js';
import { SFX } from '../core/sfx.js';
import { Leaderboard } from '../core/leaderboard.js';
import { MissionSystem } from '../core/mission.js';
import { PowerUpSystem } from '../core/powerup.js';
import { ScoreSystem } from '../core/score.js';
import { FloatingFX } from '../core/fx.js';
import { Coach } from '../core/coach.js';
// (optional) import { Progression } from '../core/progression.js';

import * as goodjunk from '../modes/goodjunk.js';
import * as groups    from '../modes/groups.js';
import * as hydration from '../modes/hydration.js';
import * as plate     from '../modes/plate.js';

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

// Modal focus helper
const focusBtnStart=()=>{ const b=document.getElementById('btn_start'); b?.focus?.(); };

// Mission HUD line
function setMissionLine(text, showLine=true){
  const el = document.getElementById('missionLine');
  if(!el) return;
  el.style.display = showLine ? 'block' : 'none';
  if(text != null) el.textContent = text;
}

// ===== Config =====
const MODES = { goodjunk, groups, hydration, plate };
const DIFFS = {
  Easy:   { time:70, spawn:820, life:4200, hydWaterRate:0.78 },
  Normal: { time:60, spawn:700, life:3000, hydWaterRate:0.66 },
  Hard:   { time:50, spawn:560, life:1900, hydWaterRate:0.55 }
};

// ===== Systems =====
const hud   = new HUD();
const sfx   = new SFX({ enabled:true, poolSize:4 });
const board = new Leaderboard();
const mission = new MissionSystem();
const power = new PowerUpSystem();
const score = new ScoreSystem();
// const prog  = new Progression();

const state = {
  modeKey: 'goodjunk',
  difficulty: 'Normal',
  running: false,
  timeLeft: 60,
  ctx: {},
  lang: (localStorage.getItem('hha_lang') || 'TH'),
  gfx:  (localStorage.getItem('hha_gfx')  || 'quality'),
  soundOn: (localStorage.getItem('hha_sound') ?? '1') === '1',
  fever: false,
  mission: null,
  rank: localStorage.getItem('hha_rank') || 'C'
};

const eng = new Engine(THREE, document.getElementById('c'));
const fx  = new FloatingFX(eng);
const coach = new Coach({ lang: state.lang });

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

// ===== I18N =====
const I18N = {
  TH:{
    brand:'HERO HEALTH ACADEMY',
    score:'คะแนน', combo:'คอมโบ', time:'เวลา',
    target:'หมวด', quota:'โควตา', hydro:'สมดุลน้ำ',
    mode:'โหมด', diff:'ความยาก',
    modes:{goodjunk:'ดี vs ขยะ', groups:'จาน 5 หมู่', hydration:'สมดุลน้ำ', plate:'จัดจานสุขภาพ'},
    diffs:{Easy:'ง่าย', Normal:'ปกติ', Hard:'ยาก'},
    btn:{start:'▶ เริ่มเกม', pause:'⏸ พัก', restart:'↻ เริ่มใหม่', help:'❓ วิธีเล่น', ok:'โอเค', replay:'↻ เล่นอีกครั้ง', home:'🏠 หน้าหลัก'},
    gfx:{quality:'กราฟิก: ปกติ', low:'กราฟิก: ประหยัด'},
    sound:{on:'🔊 เสียง: เปิด', off:'🔇 เสียง: ปิด'},
    helpTitle:'วิธีเล่น',
    summary:'สรุปผล'
  },
  EN:{
    brand:'HERO HEALTH ACADEMY',
    score:'Score', combo:'Combo', time:'Time',
    target:'Target', quota:'Quota', hydro:'Hydration',
    mode:'Mode', diff:'Difficulty',
    modes:{goodjunk:'Good vs Junk', groups:'5 Food Groups', hydration:'Hydration', plate:'Healthy Plate'},
    diffs:{Easy:'Easy', Normal:'Normal', Hard:'Hard'},
    btn:{start:'▶ Start', pause:'⏸ Pause', restart:'↻ Restart', help:'❓ How to Play', ok:'OK', replay:'↻ Replay', home:'🏠 Home'},
    gfx:{quality:'Graphics: Quality', low:'Graphics: Performance'},
    sound:{on:'🔊 Sound: On', off:'🔇 Sound: Off'},
    helpTitle:'How to Play',
    summary:'Summary'
  }
};

// ===== Apply UI + Systems =====
function applyLang(){
  const L = I18N[state.lang] || I18N.TH;
  setText('#brandTitle', L.brand);
  setText('#t_score', L.score);
  setText('#t_combo', L.combo);
  setText('#t_time',  L.time);
  setText('#t_target',L.target);
  setText('#t_quota', L.quota);
  setText('#t_hydro', L.hydro);
  setText('#t_mode',  L.mode);
  setText('#t_diff',  L.diff);
  setText('#modeName', L.modes[state.modeKey]);
  setText('#difficulty', L.diffs[state.difficulty]);
}

function updateHUD(){
  setText('#score', score.score|0);
  setText('#combo', 'x' + (score.combo||0));
  setText('#time',  state.timeLeft|0);
}

// ===== Game Core Functions (ย่อ) =====
// ... (คงเนื้อหาเดิมทั้งหมดจากเวอร์ชันก่อน เช่น start(), end(), tick(), spawnLoop(), preStartFlow(), setAppState() ฯลฯ)
// ไม่ต้องเปลี่ยนเนื้อหาอื่นใด

// ===== Boot =====
applyLang();
