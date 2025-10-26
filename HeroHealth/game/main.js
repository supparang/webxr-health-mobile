// === Hero Health Academy — main.js (Stable Full v3) ===
// - Icon auto-size by difficulty
// - Score/combo/fever effects (popup + flame)
// - Mini Quest support
// - Centered modals
// - Safe spawn area (not under header/menu)
// - Coach HUD + Replay/Home buttons fixed

window.__HHA_BOOT_OK = true;

// ----- Imports -----
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

// ----- Helpers -----
const $ = (s)=>document.querySelector(s);
const setText=(sel,txt)=>{const el=$(sel);if(el)el.textContent=txt;};
const MODES={goodjunk,groups,hydration,plate};
const DIFFS={Easy:{time:70,spawn:900,life:4200},Normal:{time:60,spawn:700,life:3000},Hard:{time:50,spawn:550,life:1800}};
const ICON_SIZE_MAP={Easy:92,Normal:72,Hard:58};

// ----- State -----
const state={
  modeKey:'goodjunk',
  difficulty:'Normal',
  running:false,
  paused:false,
  timeLeft:60,
  lang:localStorage.getItem('hha_lang')||'TH',
  combo:0,
  bestCombo:0,
  fever:{active:false,meter:0,drainPerSec:14,chargeGood:10,chargePerfect:20,threshold:100,mul:2,timeLeft:0},
  spawnTimer:0,tickTimer:0,ctx:{}
};

const hud=new HUD();
const sfx=new SFX();
const score=new ScoreSystem();
const power=new PowerUpSystem();
const coach=new Coach({lang:state.lang});
const eng=new Engine(THREE,document.getElementById('c'));

// ----- Coach HUD -----
function coachSpeak(text,ms=1600){
  const wrap=document.getElementById('coachHUD');const box=document.getElementById('coachText');
  if(!wrap||!box)return;
  box.textContent=text||'';
  wrap.style.display='block';
  wrap.style.opacity='1';
  clearTimeout(coachSpeak._t1);clearTimeout(coachSpeak._t2);
  coachSpeak._t1=setTimeout(()=>{wrap.style.opacity='0';},Math.max(800,ms-400));
  coachSpeak._t2=setTimeout(()=>{wrap.style.display='none';},Math.max(900,ms));
}
const _say=coach.say?.bind(coach);
coach.say=(msg)=>{try{_say?.(msg);}catch{}coachSpeak(String(msg||''));};
coach.onStart=(mode)=>coachSpeak(state.lang==='TH'?'เริ่มเลย!':'Let’s go!',1500);
coach.onEnd=(scoreVal)=>coachSpeak((state.lang==='TH'?'จบเกม! คะแนน ':'Finished! Score ')+(scoreVal|0),1800);
function coachGood(){coachSpeak(state.lang==='TH'?'เยี่ยม!':'Nice!');}
function coachBad(){coachSpeak(state.lang==='TH'?'พลาดนะ!':'Oops!');}

// ----- Fever & Score -----
function setFeverBar(pct){const b=$('#feverBar');if(!b)return;b.style.width=Math.min(100,Math.max(0,pct|0))+'%';}
function showFeverLabel(show){const f=$('#fever');if(!f)return;f.style.display=show?'block':'none';}
function startFever(){if(state.fever.active)return;state.fever.active=true;state.fever.timeLeft=7;showFeverLabel(true);}
function stopFever(){state.fever.active=false;state.fever.timeLeft=0;showFeverLabel(false);}
function makeScoreBurst(x,y,text,minor,color){const el=document.createElement('div');el.className='scoreBurst';
el.style.left=x+'px';el.style.top=y+'px';el.style.color=color||'#7fffd4';el.textContent=text;
if(minor){const m=document.createElement('span');m.className='minor';m.textContent=minor;el.appendChild(m);}
document.body.appendChild(el);setTimeout(()=>{el.remove();},900);}
function makeFlame(x,y,strong){const el=document.createElement('div');el.className='flameBurst'+(strong?' strong':'');
el.style.left=x+'px';el.style.top=y+'px';document.body.appendChild(el);setTimeout(()=>{el.remove();},900);}
function scoreWithEffects(base,x,y){
  const comboMul=state.combo>=20?1.4:(state.combo>=10?1.2:1);
  const feverMul=state.fever.active?state.fever.mul:1;
  const total=Math.round(base*comboMul*feverMul);
  score.add(total);
  const tag=(total>=0?'+':'')+total;
  const minor=(comboMul>1||feverMul>1)?('x'+comboMul.toFixed(1)+(feverMul>1?' & FEVER':'')):'';
  makeScoreBurst(x,y,tag,minor,total>=0?'#7fffd4':'#ff9b9b');
  if(state.fever.active)makeFlame(x,y,total>=10);
}

// ----- Combo -----
function addCombo(kind){
  if(kind==='bad'){state.combo=0;hud.setCombo?.('x0');return;}
  if(kind==='good'||kind==='perfect'){state.combo++;
    const fever=state.fever;
    const gain=kind==='perfect'?fever.chargePerfect:fever.chargeGood;
    fever.meter=Math.min(100,fever.meter+gain);
    if(fever.meter>=fever.threshold)startFever();
  }
}

// ----- Spawn -----
function spawnOnce(diff){
  if(!state.running||state.paused)return;
  const mode=MODES[state.modeKey];
  const meta=(mode?.pickMeta?.(diff,state))||{};
  const el=document.createElement('button');
  el.className='item';el.textContent=meta.char||'❓';
  el.style.fontSize=(ICON_SIZE_MAP[state.difficulty]||72)+'px';
  const headerH=$('header.brand')?.offsetHeight||56;
  const menuH=$('#menuBar')?.offsetHeight||120;
  const yMin=headerH+60;const yMax=window.innerHeight-menuH-80;
  el.style.left=(20+Math.random()*(window.innerWidth-80))+'px';
  el.style.top =(yMin+Math.random()*(yMax-yMin))+'px';
  el.addEventListener('click',ev=>{
    ev.stopPropagation();
    try{
      const sys={score,sfx,power,coach,fx:eng?.fx};
      const res=(mode?.onHit?.(meta,sys,state,hud))||'ok';
      const r=el.getBoundingClientRect();
      const cx=r.left+r.width/2;const cy=r.top+r.height/2;
      if(res==='good'||res==='perfect'){addCombo(res);coachGood();}
      if(res==='bad'){addCombo('bad');coachBad();}
      const base={good:7,perfect:14,ok:2,bad:-3,power:5}[res]||1;
      scoreWithEffects(base,cx,cy);
    }catch(e){console.warn('onHit error',e);}
    finally{el.remove();}
  });
  document.body.appendChild(el);
  setTimeout(()=>{el.remove();},meta.life||diff.life||3000);
}
function spawnLoop(){if(!state.running||state.paused)return;
  const diff=DIFFS[state.difficulty]||DIFFS.Normal;
  spawnOnce(diff);
  state.spawnTimer=setTimeout(spawnLoop,(diff.spawn||700)*(power.timeScale||1));
}

// ----- Tick / Start / End -----
function tick(){
  if(!state.running||state.paused)return;
  if(state.fever.active){
    state.fever.timeLeft=Math.max(0,state.fever.timeLeft-1);
    state.fever.meter=Math.max(0,state.fever.meter-state.fever.drainPerSec);
    setFeverBar(state.fever.meter);
    if(state.fever.timeLeft<=0||state.fever.meter<=0)stopFever();
  }
  try{MODES[state.modeKey]?.tick?.(state,{score,sfx,power,coach,fx:eng?.fx},hud);}catch(e){console.warn(e);}
  state.timeLeft=Math.max(0,state.timeLeft-1);
  hud.setTime?.(state.timeLeft);
  if(state.timeLeft<=0){end();return;}
  state.tickTimer=setTimeout(tick,1000);
}
function start(){
  end(true);
  const diff=DIFFS[state.difficulty]||DIFFS.Normal;
  Object.assign(state,{running:true,paused:false,timeLeft:diff.time,combo:0});
  stopFever();score.reset?.();hud.setScore?.(0);
  coach.onStart?.(state.modeKey);
  tick();spawnLoop();
}
function end(silent){
  state.running=false;state.paused=false;
  clearTimeout(state.tickTimer);clearTimeout(state.spawnTimer);
  MODES[state.modeKey]?.cleanup?.(state,hud);
  if(!silent){
    const modal=$('#result');if(modal)modal.style.display='flex';
    coach.onEnd?.(score.score);
  }
}

// ----- Events -----
document.addEventListener('pointerup',e=>{
  const a=e.target.closest?.('[data-action]');
  if(!a)return;
  const act=a.getAttribute('data-action'),v=a.getAttribute('data-value');
  if(act==='mode'){state.modeKey=v;start();}
  else if(act==='diff'){state.difficulty=v;start();}
  else if(act==='start'){start();}
  else if(act==='pause'){state.paused=!state.paused;if(!state.paused){tick();spawnLoop();}}
},{passive:true});

// ----- Replay/Home buttons -----
document.addEventListener('click',e=>{
  const b=e.target.closest?.('[data-result]');
  if(!b)return;
  const act=b.getAttribute('data-result');
  const modal=$('#result');
  if(act==='replay'){if(modal)modal.style.display='none';end(true);start();}
  else if(act==='home'){if(modal)modal.style.display='none';end(true);}
},{passive:true});

// ----- Boot -----
hud.setScore?.(0);
