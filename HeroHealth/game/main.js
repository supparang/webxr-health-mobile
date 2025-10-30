// === Hero Health Academy — game/main.js (fix: no LHS optional chaining), 2025-10-30
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
    addKind(kind){ this.add(kind==='perfect'?20:10); },
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
        const a = document.getElementById(id);
        if (a){
          a.currentTime = 0;
          a.play();
        }
      }catch{}
    }
  }
};

const App = {
  modeKey: (document.body.getAttribute('data-mode')||'goodjunk'),
  diff:    (document.body.getAttribute('data-diff')||'Normal'),
  lang:    (localStorage.getItem('hha_lang')||'TH').toUpperCase(),
  running:false, timeLeft:45, lastTs:0, raf:0, game:null, hud:null,
};

function wireMenu(){
  const tiles = [
    ['m_goodjunk','goodjunk','Good vs Junk'],
    ['m_groups','groups','5 Food Groups'],
    ['m_hydration','hydration','Hydration'],
    ['m_plate','plate','Healthy Plate'],
  ];
  tiles.forEach(([id,key,label])=>{
    const el = $('#'+id); if(!el) return;
    el.addEventListener('click', ()=>{
      document.querySelectorAll('.tile').forEach(t=>t.classList.remove('active'));
      el.classList.add('active');
      App.modeKey = key; $('#modeName').textContent = label;
    });
  });

  $('#d_easy')  ?.addEventListener('click', ()=> setDiff('Easy'));
  $('#d_normal')?.addEventListener('click', ()=> setDiff('Normal'));
  $('#d_hard')  ?.addEventListener('click', ()=> setDiff('Hard'));
  function setDiff(k){
    App.diff=k; $('#difficulty').textContent=k;
    document.querySelectorAll('.chip').forEach(c=>{ if(c.id?.startsWith('d_')) c.classList.remove('active'); });
    const map = {Easy:'#d_easy', Normal:'#d_normal', Hard:'#d_hard'};
    const sel = map[k]; if (sel) document.querySelector(sel)?.classList.add('active');
  }

  $('#langToggle')?.addEventListener('click', ()=>{
    App.lang = (App.lang==='TH'?'EN':'TH'); localStorage.setItem('hha_lang',App.lang);
    $('#langToggle').textContent = App.lang;
    try{ Quests.setLang(App.lang); }catch{}
  });

  $('#btn_start')?.addEventListener('click', ()=> startGame(App.modeKey, App.diff, App.lang));
  $('#btn_ok')    ?.addEventListener('click', ()=> $('#help').style.display='none');
}

function tickSecond(){
  if (!App.running) return;
  App.timeLeft = Math.max(0, App.timeLeft - 1);
  try{ Quests.tick({ score: Engine.score.value }); }catch{}
  App.hud.updateScore(Engine.score.value, Engine.score.combo, App.timeLeft);
  if (App.timeLeft<=0) return endGame();
  setTimeout(tickSecond, 1000);
}

function gameLoop(ts){
  if (!App.running) return;
  const dt = Math.min(0.5, (ts - (App.lastTs||ts))/1000);
  App.lastTs = ts;
  try{ App.game?.update?.(dt, Bus); }catch{}
  App.raf = requestAnimationFrame(gameLoop);
}

const Bus = {
  hit({kind='good',points,ui={x:innerWidth/2,y:innerHeight/2},meta}={}){
    const pts = points ?? (kind==='perfect'?20:10);
    Engine.score.add(pts); Engine.score.comboUp();
    Engine.fx.popText(`+${pts}${kind==='perfect'?' ✨':''}`, ui);
    window.HHA_FX?.shatter3D?.(ui.x, ui.y);
    Quests.event('hit', { result:kind, meta, comboNow:Engine.score.combo, score:Engine.score.value });
    App.hud.updateScore(Engine.score.value, Engine.score.combo, App.timeLeft);
    App.hud.setFever(Engine.score.fever);
    Engine.sfx.play(kind==='perfect'?'sfx-perfect':'sfx-good');
  },
  miss({meta}={}){
    Engine.score.comboBreak();
    Quests.event('hit', { result:'bad', meta, comboNow:0, score:Engine.score.value });
    App.hud.updateScore(Engine.score.value, 0, App.timeLeft);
    App.hud.dimPenalty();
    Engine.sfx.play('sfx-bad');
  }
};

function startGame(modeKey='goodjunk', diff='Normal', lang='TH'){
  try{ cancelAnimationFrame(App.raf); }catch{}
  try{ App.game?.stop?.(); }catch{}

  App.running = true;
  App.timeLeft = 45;
  Engine.score.value=0; Engine.score.combo=0; Engine.score.fever=false;

  App.hud.setCoach(lang==='EN'?'Go! Collect and avoid!':'ลุย! เก็บของดี เลี่ยงขยะ');
  App.hud.updateScore(0,0,App.timeLeft);
  Quests.beginRun(modeKey, diff, lang, App.timeLeft);

  const maker = MODES[modeKey]?.create || null;
  if (!maker){ console.error('mode not found', modeKey); return; }
  App.game = maker({ engine:Engine, hud:App.hud, coach: Coach });
  App.game.start?.();

  setTimeout(tickSecond, 1000);
  App.lastTs = performance.now();
  App.raf = requestAnimationFrame(gameLoop);

  if (modeKey==='hydration'){
    const hydTick = ()=>{ if(!App.running) return;
      try{ hydration.tick(App._hydState||{}, { score:Engine.score }, App.hud); }catch{}
      setTimeout(hydTick, 1000);
    }; setTimeout(hydTick, 1000);
  }
}

function endGame(){
  if(!App.running) return;
  App.running=false;
  try{ App.game?.stop?.(); }catch{}
  const quests = Quests.endRun({ score: Engine.score.value });
  App.hud.showResult({ score: Engine.score.value, combo: Engine.score.combo, quests });
}

const Coach = {
  onStart(){ App.hud.setCoach(App.lang==='EN'?'Ready... Go!':'พร้อม… ลุย!'); setTimeout(()=>App.hud.hideCoach(), 1200); },
  onGood(){},
  onBad(){},
};

function boot(){
  wireMenu();
  App.hud = createHUD({
    onHome: ()=>{ try{ App.game?.stop?.(); }catch{} App.running=false; $('#menuBar').style.display='block'; },
    onReplay: ()=> startGame(App.modeKey, App.diff, App.lang)
  });
  Quests.bindToMain({ hud: App.hud });
  window.__HHA_APP = App;
}
boot();
