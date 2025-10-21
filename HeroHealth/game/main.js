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

const hud = new HUD();
const sfx = new SFX({enabled:true, poolSize:4});
const board = new Leaderboard();
const mission = new MissionSystem();
const power = new PowerUpSystem();
const score = new ScoreSystem();

const state={
  modeKey:'goodjunk',
  difficulty:'Normal',
  running:false,
  timeLeft:60,
  ACTIVE:new Set(),
  ctx:{},
  lang:(localStorage.getItem('hha_lang')||'TH'),
  gfx:(localStorage.getItem('hha_gfx')||'quality')
};

const eng = new Engine(THREE, document.getElementById('c'));
const fx = new FloatingFX(eng);
const systems = { score, sfx, power, fx };

function q(s){ return document.querySelector(s); }

// ---------------- i18n ----------------
const I18N = {
  TH:{
    brand:'HERO HEALTH ACADEMY',
    score:'คะแนน', combo:'คอมโบ', time:'เวลา', target:'หมวด', quota:'โควตา', hydro:'สมดุลน้ำ',
    mode:'โหมด', diff:'ความยาก',
    modes:{goodjunk:'ดี vs ขยะ', groups:'จาน 5 หมู่', hydration:'สมดุลน้ำ', plate:'จัดจานสุขภาพ'},
    diffs:{Easy:'ง่าย', Normal:'ปกติ', Hard:'ยาก'},
    btn:{start:'▶ เริ่มเกม', pause:'⏸ พัก', restart:'↻ เริ่มใหม่', help:'❓ วิธีเล่น', ok:'โอเค', replay:'↻ เล่นอีกครั้ง', home:'🏠 หน้าหลัก'},
    helpTitle:'วิธีเล่น',
    helpBody:'เลือกโหมด → เก็บสิ่งที่ถูกต้อง → หลีกเลี่ยงกับดัก',
    summary:'สรุปผล',
    gfx:{quality:'กราฟิก: ปกติ', low:'กราฟิก: ประหยัด'}
  },
  EN:{
    brand:'HERO HEALTH ACADEMY',
    score:'Score', combo:'Combo', time:'Time', target:'Target', quota:'Quota', hydro:'Hydration',
    mode:'Mode', diff:'Difficulty',
    modes:{goodjunk:'Good vs Junk', groups:'5 Food Groups', hydration:'Hydration', plate:'Healthy Plate'},
    diffs:{Easy:'Easy', Normal:'Normal', Hard:'Hard'},
    btn:{start:'▶ Start', pause:'⏸ Pause', restart:'↻ Restart', help:'❓ How to Play', ok:'OK', replay:'↻ Replay', home:'🏠 Home'},
    helpTitle:'How to Play',
    helpBody:'Pick a mode → collect correct items → avoid traps',
    summary:'Summary',
    gfx:{quality:'Graphics: Quality', low:'Graphics: Performance'}
  }
};

function applyLang(){
  const L = I18N[state.lang]||I18N.TH;
  q('#brandTitle').textContent=L.brand;
  q('#t_score').textContent=L.score;
  q('#t_combo').textContent=L.combo;
  q('#t_time').textContent=L.time;
  q('#t_target').textContent=L.target;
  q('#t_quota').textContent=L.quota;
  q('#t_hydro').textContent=L.hydro;
  q('#t_mode').textContent=L.mode;
  q('#t_diff').textContent=L.diff;
  q('#modeName').textContent=L.modes[state.modeKey];
  q('#difficulty').textContent=L.diffs[state.difficulty];
  q('#btn_start').textContent=L.btn.start;
  q('#btn_pause').textContent=L.btn.pause;
  q('#btn_restart').textContent=L.btn.restart;
  q('#btn_help').textContent=L.btn.help;
  q('#btn_ok').textContent=L.btn.ok;
  q('#btn_replay').textContent=L.btn.replay;
  q('#btn_home').textContent=L.btn.home;
  q('#h_help').textContent=L.helpTitle;
  q('#helpBody').textContent=L.helpBody;
  q('#h_summary').textContent=L.summary;
  q('#gfxToggle').textContent='🎛️ '+(state.gfx==='low'?L.gfx.low:L.gfx.quality);
}

q('#langToggle').addEventListener('click',()=>{
  state.lang=(state.lang==='TH')?'EN':'TH';
  localStorage.setItem('hha_lang',state.lang);
  applyLang();
});

// ---------------- Graphics Mode ----------------
function applyGFX(){
  const L = I18N[state.lang]||I18N.TH;
  if(state.gfx==='low'){
    eng.renderer.setPixelRatio(0.75);
    document.body.classList.add('low-gfx');
    q('#gfxToggle').textContent='🎛️ '+L.gfx.low;
  } else {
    eng.renderer.setPixelRatio(window.devicePixelRatio||1);
    document.body.classList.remove('low-gfx');
    q('#gfxToggle').textContent='🎛️ '+L.gfx.quality;
  }
}
q('#gfxToggle').addEventListener('click',()=>{
  state.gfx=(state.gfx==='low')?'quality':'low';
  localStorage.setItem('hha_gfx',state.gfx);
  applyGFX();
});

// ---------------- เกมหลัก ----------------
window.addEventListener('pointerdown',()=>sfx.unlock(),{once:true});
document.addEventListener('click',(e)=>{
  const b=e.target.closest('#menuBar button'); if(!b) return;
  const a=b.getAttribute('data-action'), v=b.getAttribute('data-value');
  if(a==='mode'){ state.modeKey=v; applyLang(); }
  if(a==='diff'){ state.difficulty=v; applyLang(); }
  if(a==='start') start();
  if(a==='pause') state.running=!state.running;
  if(a==='restart'){ end(true); start(); }
  if(a==='help') q('#help').style.display='flex';
});
q('#help').addEventListener('click',(e)=>{ if(e.target.matches('[data-action="helpClose"], #help')) q('#help').style.display='none'; });

const timers={spawn:0,tick:0};
function start(){
  end(true);
  const diff=DIFFS[state.difficulty]||DIFFS.Normal;
  state.running=true;
  state.timeLeft=diff.time;
  state.ctx={hits:0, perfectPlates:0, hyd:50};
  score.reset();
  hud.setCombo(score.combo);
  hud.setScore(score.score);
  mission.roll(state.modeKey);
  MODES[state.modeKey].init?.(state,hud,diff);
  updateHUD(); tick(); spawnLoop();
}
function end(silent=false){
  state.running=false; clearTimeout(timers.spawn); clearTimeout(timers.tick);
  if(!silent){
    board.submit(state.modeKey,state.difficulty,score.score);
    const top=board.getTop(5).map((r,i)=>`${i+1}. ${r.mode} • ${r.diff} – ${r.score}`).join('<br>');
    q('#resCore').innerHTML=`${I18N[state.lang].score}: <b>${score.score}</b> | ${I18N[state.lang].mode}: <b>${I18N[state.lang].modes[state.modeKey]}</b>`;
    q('#resBoard').innerHTML=`<h4>🏆 TOP</h4>${top}`;
    q('#result').style.display='flex';
  }
}
q('#result').addEventListener('click',(e)=>{
  const a=e.target.getAttribute('data-result');
  if(a==='replay'){ q('#result').style.display='none'; start(); }
  if(a==='home'){ q('#result').style.display='none'; }
});
function updateHUD(){ hud.setScore(score.score); hud.setCombo(score.combo); hud.setTime(state.timeLeft); }
function spawnLoop(){
  if(!state.running) return;
  const diff=DIFFS[state.difficulty]||DIFFS.Normal;
  spawnOnce(diff);
  const accel=Math.max(0.5,1-(score.score/400));
  const next=Math.max(220,diff.spawn*accel*power.timeScale);
  timers.spawn=setTimeout(spawnLoop,next);
}
function spawnOnce(diff){
  const meta=MODES[state.modeKey].pickMeta(diff,state);
  const el=document.createElement('button');
  el.className='item'; el.textContent=meta.char||'?';
  el.style.left=(10+Math.random()*80)+'vw';
  el.style.top=(20+Math.random()*60)+'vh';
  el.onclick=()=>{
    MODES[state.modeKey].onHit(meta,systems,state,hud);
    state.ctx.hits=(state.ctx.hits||0)+1;
    if(mission.evaluate({score:score.score,hits:state.ctx.hits,hyd:state.hyd||50,perfectPlates:state.ctx.perfectPlates||0})){
      fx.spawn3D(null,'🎯 +20','good'); score.add(20); sfx.play('sfx-perfect');
    }
    el.remove();
  };
  document.body.appendChild(el);
  setTimeout(()=>el.remove(),(diff.life||2500));
}
function tick(){
  if(!state.running) return;
  state.timeLeft--; updateHUD();
  if(state.timeLeft<=0){ end(); return; }
  if(state.timeLeft<=10){ document.body.classList.add('flash'); try{document.getElementById('sfx-tick').play();}catch{} }
  else { document.body.classList.remove('flash'); }
  timers.tick=setTimeout(tick,1000);
}

// ---------------- บูต ----------------
applyLang();
applyGFX();
