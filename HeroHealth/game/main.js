// === Hero Health Academy — game/main.js (2025-10-30)
// Hide menu when playing, show HUD only

import * as goodjunk   from './modes/goodjunk.js';
import * as groups     from './modes/groups.js';
import * as hydration  from './modes/hydration.js';
import * as plate      from './modes/plate.js';
import { Quests }      from './core/quests.js';
import { createHUD }   from './core/hud.js';
import { add3DTilt, shatter3D } from './core/fx.js';

const MODES = { goodjunk, groups, hydration, plate };
window.HHA_FX = window.HHA_FX || { add3DTilt, shatter3D };

function $(s){ return document.querySelector(s); }

const Engine = {
  score:{
    value:0, combo:0, fever:false,
    add(n){ this.value += n|0; if (this.combo>=10 && !this.fever) this.fever=true; },
    comboUp(){ this.combo++; if (this.combo>=10) this.fever=true; },
    comboBreak(){ this.combo=0; this.fever=false; }
  },
  fx:{
    popText(txt,{x,y,ms=700}={}){
      const el=document.createElement('div');
      el.textContent = txt;
      el.style.cssText=`position:fixed;left:${x}px;top:${y}px;transform:translate(-50%,-50%);
        font:900 16px ui-rounded;color:#fff;text-shadow:0 2px 8px #0008;pointer-events:none;z-index:200;opacity:1;transition:all .7s ease`;
      document.body.appendChild(el);
      requestAnimationFrame(()=>{ el.style.transform+=' translateY(-30px)'; el.style.opacity='0'; });
      setTimeout(()=>el.remove(), ms);
    }
  },
  sfx:{
    play(id){
      try{
        const a=document.getElementById(id);
        if(a){ a.currentTime=0; a.play(); }
      }catch{}
    }
  }
};

const App = {
  modeKey:'goodjunk', diff:'Normal', lang:'TH',
  running:false, timeLeft:45, lastTs:0, raf:0, game:null, hud:null
};

// === Menu setup ===
function wireMenu(){
  ['goodjunk','groups','hydration','plate'].forEach(k=>{
    const el=$(`#m_${k}`); if(!el) return;
    el.addEventListener('click',()=>{
      document.querySelectorAll('.tile').forEach(t=>t.classList.remove('active'));
      el.classList.add('active'); App.modeKey=k;
    });
  });
  ['d_easy','d_normal','d_hard'].forEach(id=>{
    const el=$(`#${id}`); if(!el)return;
    el.addEventListener('click',()=>{
      document.querySelectorAll('.chip').forEach(c=>c.classList.remove('active'));
      el.classList.add('active');
      App.diff=id.split('_')[1].replace(/^\w/,c=>c.toUpperCase());
    });
  });
  $('#btn_start')?.addEventListener('click',()=>startGame());
  $('#langToggle')?.addEventListener('click',()=>{
    App.lang=(App.lang==='TH'?'EN':'TH'); localStorage.setItem('hha_lang',App.lang);
    $('#langToggle').textContent=App.lang;
  });
}

// === Game loop ===
function tickSecond(){
  if(!App.running)return;
  App.timeLeft=Math.max(0,App.timeLeft-1);
  App.hud.updateScore(Engine.score.value,Engine.score.combo,App.timeLeft);
  if(App.timeLeft<=0) return endGame();
  setTimeout(tickSecond,1000);
}
function gameLoop(ts){
  if(!App.running)return;
  const dt=Math.min(0.5,(ts-(App.lastTs||ts))/1000);
  App.lastTs=ts;
  try{ App.game?.update?.(dt,Bus);}catch{}
  App.raf=requestAnimationFrame(gameLoop);
}

// === Event Bus ===
const Bus={
  hit({kind='good',points,ui={x:innerWidth/2,y:innerHeight/2}}={}){
    const pts=points??(kind==='perfect'?20:10);
    Engine.score.value+=pts; Engine.score.comboUp();
    Engine.fx.popText(`+${pts}${kind==='perfect'?' ✨':''}`,ui);
    window.HHA_FX?.shatter3D?.(ui.x,ui.y);
    App.hud.updateScore(Engine.score.value,Engine.score.combo,App.timeLeft);
    Engine.sfx.play(kind==='perfect'?'sfx-perfect':'sfx-good');
  },
  miss(){
    Engine.score.comboBreak(); App.hud.updateScore(Engine.score.value,0,App.timeLeft);
    Engine.sfx.play('sfx-bad');
  }
};

// === Start Game ===
function startGame(){
  document.body.classList.add('in-game');
  $('#menuBar').style.display='none';
  App.running=true; App.timeLeft=45;
  Engine.score.value=0; Engine.score.combo=0; Engine.score.fever=false;
  App.hud.updateScore(0,0,App.timeLeft);
  const maker=MODES[App.modeKey]?.create;
  App.game=maker?maker({engine:Engine,hud:App.hud,coach:Coach}):null;
  App.game?.start?.();
  setTimeout(tickSecond,1000);
  App.lastTs=performance.now(); App.raf=requestAnimationFrame(gameLoop);
}

// === End Game ===
function endGame(){
  App.running=false;
  try{App.game?.stop?.();}catch{}
  App.hud.showResult({score:Engine.score.value,combo:Engine.score.combo});
}

// === Coach ===
const Coach={
  onStart(){App.hud.setCoach(App.lang==='EN'?'Ready... Go!':'พร้อม… ลุย!');setTimeout(()=>App.hud.hideCoach(),1200);}
};

// === Boot ===
function boot(){
  wireMenu();
  App.hud=createHUD({
    onHome:()=>{
      App.running=false;
      document.body.classList.remove('in-game');
      $('#menuBar').style.display='flex';
    },
    onReplay:()=>startGame()
  });
  window.__HHA_APP=App;
}
boot();
