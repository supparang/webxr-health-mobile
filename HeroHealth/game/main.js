// === Hero Health Academy — game/main.js (2025-10-30 fixed)
// – รองรับ fx.js แบบ named import
// – Quests / HUD ผูกครบ, pause/focus safety, plate & hydration พร้อม

import * as HUDMod from './core/hud.js';
import { Quests }  from './core/quests.js';
import * as FX     from './core/fx.js'; // ✅ fixed import

import * as goodjunk  from './modes/goodjunk.js';
import * as groups    from './modes/groups.js';
import * as hydration from './modes/hydration.js';
import * as plate     from './modes/plate.js';

// ===== Engine =====
const Engine = {
  score:{
    value:0, combo:0,
    add(n=0){this.value+=n|0;},
    comboUp(){this.combo++;},
    comboBreak(){this.combo=0;}
  },
  sfx:{ play(id){try{document.getElementById(id)?.play?.();}catch{}}},
  fx:{
    popText(txt,{x,y,ms=700}={}){
      const t=document.createElement('div');
      t.textContent=txt;
      t.style.cssText=`position:fixed;left:${x}px;top:${y}px;
        transform:translate(-50%,-50%);font:900 16px/1 ui-rounded;
        color:#fff;text-shadow:0 2px 8px #0008;pointer-events:none;
        transition:all .6s;z-index:300`;
      document.body.appendChild(t);
      requestAnimationFrame(()=>{
        t.style.top=(y-40)+'px';t.style.opacity='0';
      });
      setTimeout(()=>t.remove(),ms);
    },
    add3DTilt:FX.add3DTilt,
    shatter3D:FX.shatter3D
  }
};

// ===== App state =====
const App={
  running:false,modeKey:'goodjunk',diff:'Normal',lang:'TH',
  timeLeft:45,raf:0,lastTs:0,game:null,hud:null
};

function $(s){return document.querySelector(s);}
function setActive(btns,a){btns.forEach(b=>b.classList.toggle('active',b===a));}
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));

// ===== HUD + Quests =====
App.hud=HUDMod.createHUD({
  onHome:stopToHome,
  onReplay:()=>startGame(App.modeKey,App.diff,App.lang)
});
Quests.bindToMain({hud:App.hud});

// ===== Mode registry =====
const MODES={goodjunk,groups,hydration,plate};

// ===== Menu =====
const BTN_START=$('#btn_start');
const BTN_E=$('#d_easy'),BTN_N=$('#d_normal'),BTN_H=$('#d_hard');
const TILE_M={
  goodjunk:$('#m_goodjunk'),
  groups:$('#m_groups'),
  hydration:$('#m_hydration'),
  plate:$('#m_plate')
};
const MODE_NAME=$('#modeName');
const DIFF_TEXT=$('#difficulty');

for(const [k,el]of Object.entries(TILE_M)){
  el?.addEventListener('click',()=>{
    Object.values(TILE_M).forEach(x=>x?.classList.remove('active'));
    el.classList.add('active');App.modeKey=k;
    MODE_NAME.textContent={
      goodjunk:'Good vs Junk',
      groups:'5 Food Groups',
      hydration:'Hydration',
      plate:'Healthy Plate'
    }[k];
    document.body.setAttribute('data-mode',k);
  });
}

BTN_E.addEventListener('click',()=>{setActive([BTN_E,BTN_N,BTN_H],BTN_E);App.diff='Easy';DIFF_TEXT.textContent='Easy';});
BTN_N.addEventListener('click',()=>{setActive([BTN_E,BTN_N,BTN_H],BTN_N);App.diff='Normal';DIFF_TEXT.textContent='Normal';});
BTN_H.addEventListener('click',()=>{setActive([BTN_E,BTN_N,BTN_H],BTN_H);App.diff='Hard';DIFF_TEXT.textContent='Hard';});
BTN_START.addEventListener('click',()=>startGame(App.modeKey,App.diff,App.lang));

// ===== Core flow =====
function startGame(modeKey='goodjunk',diff='Normal',lang='TH'){
  stopGame();
  App.running=true;App.timeLeft=45;
  Engine.score.value=0;Engine.score.combo=0;
  App.hud.resetScore(0,0);App.hud.updateTime(App.timeLeft);
  $('#menuBar').style.display='none';

  // toggle HUD per mode
  if(modeKey==='plate'){ $('#plateTracker').style.display='block';$('#targetWrap').style.display='none';}
  else if(modeKey==='groups'){ $('#plateTracker').style.display='none';$('#targetWrap').style.display='inline-flex';}
  else{ $('#plateTracker').style.display='none';$('#targetWrap').style.display='none';}

  // quests
  Quests.setLang(lang);
  Quests.beginRun(modeKey,diff,lang,App.timeLeft);

  const Bus={
    hit:({kind,points,ui,meta}={})=>{
      const gain=points??(kind==='perfect'?18:10);
      Engine.score.add(gain);Engine.score.comboUp();
      Quests.event('hit',{result:kind||'good',meta,comboNow:Engine.score.combo,score:Engine.score.value});
      App.hud.updateScore(Engine.score.value,Engine.score.combo,App.timeLeft);
    },
    miss:({meta}={})=>{
      Engine.score.comboBreak();
      Quests.event('hit',{result:'bad',meta,comboNow:Engine.score.combo,score:Engine.score.value});
      App.hud.updateScore(Engine.score.value,Engine.score.combo,App.timeLeft);
      App.hud.dimPenalty();
    }
  };

  const mod=MODES[modeKey]||goodjunk;
  App.game=mod.create({
    engine:Engine,
    hud:App.hud,
    coach:{
      onStart(){App.hud.setCoach('Start!');setTimeout(()=>App.hud.showCoach(false),600);},
      onGood(){},onBad(){}
    }
  });
  App.game.start();

  App.lastTs=performance.now();
  tickSecond();
  App.raf=requestAnimationFrame(loop);
}

function loop(ts){
  if(!App.running)return;
  const dt=Math.min(0.05,(ts-App.lastTs)/1000);
  App.lastTs=ts;
  try{App.game?.update?.(dt,{hit:App.Bus?.hit,miss:App.Bus?.miss});}catch(e){console.error(e);}
  App.raf=requestAnimationFrame(loop);
}

function tickSecond(){
  if(!App.running)return;
  App.timeLeft=clamp(App.timeLeft-1,0,999);
  App.hud.updateTime(App.timeLeft);
  Quests.tick({score:Engine.score.value});
  if(App.timeLeft<=0){endGame();return;}
  setTimeout(tickSecond,1000);
}

function endGame(){
  if(!App.running)return;
  App.running=false;
  try{App.game?.stop?.();}catch{}
  const qs=Quests.endRun({score:Engine.score.value});
  App.hud.showResult({score:Engine.score.value,combo:Engine.score.combo,quests:qs});
}

function stopGame(){
  cancelAnimationFrame(App.raf);
  try{App.game?.stop?.();}catch{}
  App.game=null;
}

function stopToHome(){
  stopGame();
  $('#menuBar').style.display='';
  $('#plateTracker').style.display='none';
  App.hud.showCoach(false);
  App.hud.hideResult();
}

// pause/focus guard
window.addEventListener('blur',()=>{if(App.running){App.hud.setCoach('⏸ Paused');App.hud.showCoach(true);}});
window.addEventListener('focus',()=>{if(App.running){App.hud.showCoach(false);}});

window.__HHA_APP=App;
