// === Hero Health Academy — main.js (2025-11-01 FULL Integrated Build) ===
'use strict';

import * as goodjunk from './modes/goodjunk.js';
import { HUD } from './core/hud.js';
import { Coach } from './core/coach.js';
import { SFX } from './core/sfx.js';
import { Quests } from './core/quests.js';

// ---------- Helpers ----------
const $ = (s)=>document.querySelector(s);
const sleep = (ms)=>new Promise(r=>setTimeout(r,ms));

// ---------- Global ----------
const G = {
  running:false, combo:0, fever:false, feverMiss:0,
  score:0, modeKey:'goodjunk', diff:'Normal', matchTime:45, elapsed:0,
  hud:null, coach:null, sfx:null, mode:null
};

// ---------- Init ----------
window.addEventListener('DOMContentLoaded', ()=>{
  G.hud=new HUD();
  G.coach=new Coach({lang:localStorage.getItem('hha_lang')||'TH'});
  G.sfx=new SFX();
  Quests.bindToMain({hud:G.hud,coach:G.coach});
  bindUI();
  document.addEventListener('visibilitychange',()=>{ if(document.hidden&&G.running) pauseGame(); });
});

// ---------- Bind UI ----------
function bindUI(){
  $('#btnStart')?.addEventListener('click',()=>startGame());
  $('#btnRetry')?.addEventListener('click',()=>startGame());
  $('#btnHome')?.addEventListener('click',()=>location.reload());
  $('#btnLang')?.addEventListener('click',()=>{
    const cur=(localStorage.getItem('hha_lang')||'TH').toUpperCase();
    const next=cur==='TH'?'EN':'TH';
    localStorage.setItem('hha_lang',next);
    G.coach.lang=next; G.hud.toast(`Language: ${next}`);
  });
}

// ---------- Start ----------
async function startGame(){
  if(G.running||window.HHA?._busy) return;
  window.HHA._busy=true;
  G.running=true; G.score=0; G.combo=0; G.fever=false; G.feverMiss=0; G.elapsed=0;
  G.hud.hideResult(); G.hud.resetBars?.();
  await countdown();
  G.mode=goodjunk.create(); G.mode.start({difficulty:G.diff});
  const lang=localStorage.getItem('hha_lang')||'TH';
  Quests.beginRun(G.modeKey,G.diff,lang,G.matchTime,{pick:3,sequential:true});
  loop();
}

// ---------- Countdown ----------
async function countdown(){
  const el=document.createElement('div');
  el.id='countdown'; el.style.cssText='position:fixed;inset:0;display:flex;align-items:center;justify-content:center;font:900 72px ui-rounded;color:#fff;text-shadow:0 4px 16px #000;z-index:2003;';
  document.body.appendChild(el);
  for(let i=3;i>0;i--){ el.textContent=i; G.sfx.tick?.(); await sleep(700); }
  el.textContent='Go!'; G.coach.onStart?.(); await sleep(600);
  el.remove();
}

// ---------- Loop ----------
function loop(){
  let last=performance.now();
  const step=(now)=>{
    if(!G.running) return;
    const dt=(now-last)/1000; last=now; G.elapsed+=dt;
    G.mode?.update(dt,BUS);
    if(Math.floor(G.elapsed)!==Math.floor(G.elapsed-dt)){
      Quests.tick({time:G.elapsed});
      G.hud.setTimer(G.matchTime-G.elapsed);
    }
    if(G.elapsed>=G.matchTime){ endGame(); return; }
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

// ---------- BUS ----------
const BUS={
  hit(e){
    const pts=e.points||0; G.score+=pts; G.combo++;
    if(G.combo>=10&&!G.fever){
      G.fever=true; G.feverMiss=0; G.mode?.setFever(true);
      Quests.event('fever',{on:true}); G.hud.showFever(true); G.sfx.fever?.();
    }
    if(e.meta?.gold) Quests.event('hit',{result:e.kind,comboNow:G.combo,meta:{gold:true}});
    else Quests.event('hit',{result:e.kind,comboNow:G.combo});
    G.hud.updateHUD(G.score,G.combo);
    G.hud.showFloatingText(e.ui?.x,e.ui?.y,`+${pts}`);
  },
  miss(ev){
    G.combo=0; Quests.event('miss',ev);
    if(G.fever){ G.feverMiss++; if(G.feverMiss>=3){ G.fever=false; G.mode?.setFever(false); Quests.event('fever',{on:false}); G.hud.showFever(false); } }
    G.sfx.bad?.();
  },
  power(kind){ Quests.event('power',{kind}); G.sfx.power?.(); },
  sfx:{ good:()=>G.sfx.good(), bad:()=>G.sfx.bad(), perfect:()=>G.sfx.perfect(), power:()=>G.sfx.power() }
};

// ---------- Pause ----------
function pauseGame(){
  if(!G.running) return;
  G.running=false; G.mode?.stop?.();
  G.hud.toast('⏸️ Paused'); window.HHA._busy=false;
}

// ---------- End ----------
function endGame(){
  if(!G.running) return;
  G.running=false; G.mode?.cleanup?.(); window.HHA._busy=false;
  const result=Quests.endRun({score:G.score});
  const stars=(result.totalDone>=8)?'★★★★★':(result.totalDone>=6)?'★★★★':(result.totalDone>=4)?'★★★':(result.totalDone>=2)?'★★':'★';
  G.hud.showResult({
    title:'Result',
    desc:`Score: ${G.score}\nStars: ${stars}`,
    stats:result.details,
    extra:[`Miss:${result.counters.anyMiss}`,`Junk:${result.counters.junkClicks}`]
  });
  G.coach.onEnd?.(G.score);
}

// ---------- Export ----------
window.HHA={ startGame, endGame, pauseGame };
