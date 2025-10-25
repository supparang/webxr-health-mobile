// Hero Health Academy - main.js (Combo + Fever + FX + HelpScene + Adaptive Size)
// Updated: 2025-10-25

window.__HHA_BOOT_OK = true;

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

const MODES = { goodjunk, groups, hydration, plate };
const DIFFS = {
  Easy:   { time:70, spawn:900, life:4200 },
  Normal: { time:60, spawn:700, life:3000 },
  Hard:   { time:50, spawn:550, life:1800 }
};

const $ = (s)=>document.querySelector(s);
const byAction=(el)=>el?.closest('[data-action]');

const i18n = {
  TH:{mode:'โหมด',diff:'ความยาก',score:'คะแนน',combo:'คอมโบ',time:'เวลา',
      helpTitle:'วิธีเล่น',helpBody:'เลือกโหมด → เก็บสิ่งที่ถูกต้อง → หลีกเลี่ยงกับดัก',
      replay:'เล่นอีกครั้ง',home:'หน้าหลัก',
      names:{goodjunk:'ดี vs ขยะ',groups:'จาน 5 หมู่',hydration:'สมดุลน้ำ',plate:'จัดจานสุขภาพ'},
      diffs:{Easy:'ง่าย',Normal:'ปกติ',Hard:'ยาก'}},
  EN:{mode:'Mode',diff:'Difficulty',score:'Score',combo:'Combo',time:'Time',
      helpTitle:'How to Play',helpBody:'Pick a mode → Collect correct items → Avoid traps',
      replay:'Replay',home:'Home',
      names:{goodjunk:'Good vs Trash',groups:'Food Groups',hydration:'Hydration',plate:'Healthy Plate'},
      diffs:{Easy:'Easy',Normal:'Normal',Hard:'Hard'}}
};

function T(lang){return i18n[lang]||i18n.TH;}

const state={
  modeKey:'goodjunk',difficulty:'Normal',running:false,paused:false,
  timeLeft:60,lang:localStorage.getItem('hha_lang')||'TH',
  gfx:localStorage.getItem('hha_gfx')||'quality',ctx:{},ACTIVE:new Set()
};

const hud=new HUD(),sfx=new SFX(),score=new ScoreSystem(),power=new PowerUpSystem();
let coach;try{coach=new Coach({lang:state.lang});}catch{coach={onStart(){},onEnd(){},say(){},lang:state.lang};}
let eng;try{eng=new Engine(THREE,document.getElementById('c'));}catch{eng={};}

// ---------- Combo / Fever ----------
state.combo=0;state.bestCombo=0;
state.fever={active:false,meter:0,drainPerSec:14,chargePerGood:10,chargePerPerfect:20,threshold:100,mul:2,timeLeft:0};
function setFeverBar(p){const b=$('#feverBar');if(b)b.style.width=Math.max(0,Math.min(100,p))+'%';}
function showFeverLabel(v){const f=$('#fever');if(!f)return;f.style.display=v?'block':'none';f.classList.toggle('pulse',!!v);}
function screenShake(px=6,ms=180){const c=$('#c');if(!c)return;c.classList.add('shake');setTimeout(()=>c.classList.remove('shake'),ms);}
function spawnFloatText(x,y,t){const e=document.createElement('div');e.className='floatText';e.textContent=t;e.style.left=x+'px';e.style.top=y+'px';document.body.appendChild(e);setTimeout(()=>e.remove(),800);}
function startFever(){if(state.fever.active)return;state.fever.active=true;state.fever.timeLeft=7;showFeverLabel(true);try{$('#sfx-powerup')?.play();}catch{}screenShake(8,280);}
function stopFever(){state.fever.active=false;state.fever.timeLeft=0;showFeverLabel(false);}
function addCombo(k){if(k==='bad'){state.combo=0;document.body.classList.add('shake');setTimeout(()=>document.body.classList.remove('shake'),220);return;}
  if(k==='good'||k==='perfect'){state.combo++;state.bestCombo=Math.max(state.bestCombo,state.combo);hud.setCombo?.('x'+state.combo);
    if(!state.fever.active){const add=k==='perfect'?state.fever.chargePerPerfect:state.fever.chargePerGood;state.fever.meter=Math.min(100,state.fever.meter+add);setFeverBar(state.fever.meter);if(state.fever.meter>=state.fever.threshold)startFever();}
    else state.fever.timeLeft=Math.min(10,state.fever.timeLeft+.6);}
}
function scoreWithEffects(base,x,y){const comboMul=state.combo>=20?1.4:state.combo>=10?1.2:1;const feverMul=state.fever.active?state.fever.mul:1;
  const total=Math.round(base*comboMul*feverMul);score.add?.(total);
  const tag=(feverMul>1||comboMul>1)?`+${total} ✦`:(total>=0?`+${total}`:`${total}`);const color=(feverMul>1?'#ffd54a':(total>=0?'#7fffd4':'#ff9b9b'));
  try{eng?.fx?.popText?.(tag,{color});}catch{spawnFloatText(x,y,tag);}
}

// ---------- UI ----------
function applyUI(){const t=T(state.lang);$('#modeName').textContent=t.names[state.modeKey];$('#difficulty').textContent=t.diffs[state.difficulty];}
function updateHUD(){hud.setScore?.(score.score);hud.setCombo?.('x'+state.combo);hud.setTime?.(state.timeLeft);}

// ---------- Game Flow ----------
function start(){end(true);const diff=DIFFS[state.difficulty];state.running=true;state.paused=false;state.timeLeft=diff.time;state.combo=0;state.fever.meter=0;
  score.reset?.();MODES[state.modeKey]?.init?.(state,hud,diff);coach.onStart?.(state.modeKey);updateHUD();tick();spawnLoop();}
function end(silent=false){state.running=false;clearTimeout(state.tickTimer);clearTimeout(state.spawnTimer);MODES[state.modeKey]?.cleanup?.(state,hud);
  if(!silent){$('#result').style.display='flex';coach.onEnd?.(score.score,{grade:'A'});}}
function spawnOnce(diff){
  if(!state.running)return;
  const mode=MODES[state.modeKey];const meta=mode.pickMeta?.(diff,state)||{};const el=document.createElement('button');
  el.className='item';el.textContent=meta.char||'❓';
  const sizeMap={Easy:'80px',Normal:'64px',Hard:'52px'};el.style.fontSize=sizeMap[state.difficulty];el.style.position='fixed';el.style.border='none';el.style.background='none';el.style.cursor='pointer';el.style.transition='transform .15s,filter .15s';
  el.onmouseenter=()=>el.style.transform='scale(1.2)';el.onmouseleave=()=>el.style.transform='scale(1)';
  const headerH=$('header.brand')?.offsetHeight||56,menuH=$('#menuBar')?.offsetHeight||120;
  const yMin=headerH+60,yMax=window.innerHeight-menuH-80,xMin=20,xMax=window.innerWidth-80;
  el.style.left=(xMin+Math.random()*(xMax-xMin))+'px';el.style.top=(yMin+Math.random()*(yMax-yMin))+'px';el.style.zIndex='80';
  el.addEventListener('click',(ev)=>{
    ev.stopPropagation();const sys={score,sfx,power,coach,fx:eng?.fx};
    const result=mode.onHit?.(meta,sys,state,hud)||'ok';
    const r=el.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2;
    if(result==='good'||result==='perfect')addCombo(result);if(result==='bad')addCombo('bad');
    const baseMap={good:7,perfect:14,ok:2,bad:-3,power:5};scoreWithEffects(baseMap[result]||1,x,y);
    if(result==='perfect')screenShake(5,200);if(state.fever.active)el.classList.add('feverHit');el.remove();
  });
  document.body.appendChild(el);
  setTimeout(()=>el.remove(),meta.life||diff.life);
}
function spawnLoop(){if(!state.running)return;const diff=DIFFS[state.difficulty];spawnOnce(diff);state.spawnTimer=setTimeout(spawnLoop,diff.spawn);}
function tick(){if(!state.running)return;
  if(state.fever.active){state.fever.timeLeft=Math.max(0,state.fever.timeLeft-1);state.fever.meter=Math.max(0,state.fever.meter-state.fever.drainPerSec);setFeverBar(state.fever.meter);if(state.fever.timeLeft<=0||state.fever.meter<=0)stopFever();}
  try{MODES[state.modeKey]?.tick?.(state,{score,sfx,power,coach,fx:eng?.fx},hud);}catch{}
  state.timeLeft=Math.max(0,state.timeLeft-1);updateHUD();if(state.timeLeft<=0){end();return;}
  state.tickTimer=setTimeout(tick,1000);
}

// ---------- Events ----------
document.addEventListener('pointerup',e=>{
  const a=byAction(e.target)?.dataset.action,v=byAction(e.target)?.dataset.value;
  if(!a)return;
  if(a==='mode'){state.modeKey=v;applyUI();if(state.running)start();}
  else if(a==='diff'){state.difficulty=v;applyUI();if(state.running)start();}
  else if(a==='start'){start();}
  else if(a==='restart'){end(true);start();}
  else if(a==='help'){const help=$('#help');help.style.display='flex';}
  else if(a==='helpClose'){$('#help').style.display='none';}
},{passive:true});

window.addEventListener('pointerdown',()=>sfx.unlock?.(),{once:true,passive:true});
applyUI();updateHUD();
