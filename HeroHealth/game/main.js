// === Hero Health Academy — main.js (2025-11-01 Sequential Quest Edition) ===

import * as THREE from 'https://unpkg.com/three@0.159.0/build/three.module.js';
import * as goodjunk from './modes/goodjunk.js';
import { HUD } from './core/hud.js';
import { Coach } from './core/coach.js';
import { SFX } from './core/sfx.js';
import { Quests } from './core/quests.js';

// ---------- Helpers ----------
const $ = (s) => document.querySelector(s);
function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }

// ---------- Global Game State ----------
const G = {
  running: false,
  combo: 0,
  fever: false,
  feverMiss: 0,
  score: 0,
  modeKey: 'goodjunk',
  diff: 'Normal',
  matchTime: 45, // seconds
  elapsed: 0,
  hud: null,
  coach: null,
  sfx: null,
  mode: null
};

// ---------- Initialize ----------
window.addEventListener('DOMContentLoaded', ()=>{
  G.hud = new HUD();
  G.coach = new Coach();
  G.sfx = new SFX();
  Quests.bindToMain({ hud:G.hud, coach:G.coach });
  bindUI();
});

// ---------- UI Bind ----------
function bindUI(){
  $('#btnStart')?.addEventListener('click', startGame);
  $('#btnHome')?.addEventListener('click', ()=>location.reload());
  $('#btnRetry')?.addEventListener('click', ()=>startGame());
}

// ---------- Core Game Loop ----------
async function startGame(){
  if(G.running) return;
  G.running = true;
  G.score = 0; G.combo = 0; G.fever = false; G.elapsed = 0; G.feverMiss = 0;
  G.hud.hideResult();
  G.coach.say("🎬 3... 2... 1... Go!");
  await sleep(2000);

  // Init mode
  G.mode = goodjunk.create();
  G.mode.start({ difficulty:G.diff });
  
  // ✅ เริ่มระบบ Mini Quest (สุ่ม 3 เควสต์, Sequential)
  const lang = localStorage.getItem('hha_lang') || 'TH';
  Quests.beginRun(G.modeKey, G.diff, lang, G.matchTime, { pick: 3, sequential: true });

  loop();
}

// ---------- Main Loop ----------
async function loop(){
  const start = performance.now();
  let last = start;

  const step = (now)=>{
    if(!G.running) return;
    const dt = (now - last)/1000;
    last = now;
    G.elapsed += dt;

    // update mode
    G.mode?.update(dt, BUS);

    // tick quests ทุกวินาที
    if(Math.floor(G.elapsed) !== Math.floor(G.elapsed - dt)){
      Quests.tick({ time:G.elapsed });
      G.hud.setTimer(G.matchTime - G.elapsed);
    }

    // match end
    if(G.elapsed >= G.matchTime){
      endGame();
      return;
    }

    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

// ---------- BUS (Game Events) ----------
const BUS = {
  hit(e){
    G.score += e.points || 0;
    G.combo++;
    if(G.combo >= 10 && !G.fever){
      G.fever = true; G.feverMiss = 0;
      G.mode?.setFever(true);
      Quests.event('fever', { on:true });
      G.hud.showFever(true);
      G.sfx.fever?.();
    }
    if(e.meta?.gold) G.hud.flashText('🌟 +Gold!');
    G.hud.showFloatingText(e.ui?.x, e.ui?.y, `+${e.points}`);
    Quests.event('hit', { result:e.kind, comboNow:G.combo, meta:e.meta });
  },
  miss(ev){
    Quests.event('miss', ev);
    G.combo = 0;
    if(G.fever){
      G.feverMiss++;
      if(G.feverMiss >= 3){
        G.fever = false;
        G.mode?.setFever(false);
        Quests.event('fever', { on:false });
        G.hud.showFever(false);
      }
    }
  },
  power(kind){
    Quests.event('power', { kind });
    G.sfx.power?.();
  },
  sfx: {
    good:()=>G.sfx.good(),
    bad:()=>G.sfx.bad(),
    perfect:()=>G.sfx.perfect(),
    power:()=>G.sfx.power()
  }
};

// ---------- End Game ----------
function endGame(){
  G.running = false;
  G.mode?.cleanup();
  G.mode = null;

  const result = Quests.endRun({ score:G.score });
  G.hud.showResult({
    score: G.score,
    quests: result.details,
    totalDone: result.totalDone,
    miss: result.counters.anyMiss,
    junk: result.counters.junkClicks
  });
  G.coach.say(`🏁 Mission Complete! You finished ${result.totalDone} quests.`);
  G.sfx.end?.();
}
