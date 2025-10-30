// === Hero Health Academy — main.js (2025-10-30)
// Start→Loop→End pipeline; HUD + Quests wired; Result modal; pause/resume safety;
// No duplicate FX; supports 4 modes (goodjunk, groups, hydration, plate)

import * as HUDMod      from './core/hud.js';
import { Quests }       from './core/quests.js';
import * as FX          from './core/fx.js';

import * as goodjunk    from './modes/goodjunk.js';
import * as groups      from './modes/groups.js';
import * as hydration   from './modes/hydration.js';
import * as plate       from './modes/plate.js';

// --------- Simple Engine-like singletons ---------
const Engine = {
  score: {
    value: 0,
    combo: 0,
    add(n=0){ this.value += n|0; },
    addKind(kind, {mode}={}){
      const map = { good:10, perfect:18 };
      this.add(map[kind]||0);
    },
    comboUp(){ this.combo++; },
    comboBreak(){ this.combo = 0; }
  },
  sfx: {
    play(id){ try{ document.getElementById(id)?.play?.(); }catch{} }
  },
  fx: {
    popText(txt, {x,y,ms=700}={}){
      const t=document.createElement('div');
      t.textContent=txt;
      t.style.cssText=`position:fixed;left:${x}px;top:${y}px;transform:translate(-50%,-50%);
        font:900 16px ui-rounded;color:#fff;text-shadow:0 2px 6px #0008;pointer-events:none;z-index:200;transition:all .7s`;
      document.body.appendChild(t);
      requestAnimationFrame(()=>{
        t.style.top = (y-40)+'px'; t.style.opacity='0.0';
      });
      setTimeout(()=>{ try{t.remove();}catch{} }, ms);
    }
  },
  fever: { active:false }
};

// --------- App State ---------
const App = {
  running:false, modeKey:'goodjunk', diff:'Normal', lang:'TH',
  timeLeft:45, raf:0, lastTs:0, game:null, Bus:null, hud:null
};

// --------- Helpers ---------
function $(sel){ return document.querySelector(sel); }
function setActive(btns, activeEl){ btns.forEach(b=>b.classList.toggle('active', b===activeEl)); }
function clamp(n,a,b){ return Math.max(a, Math.min(b,n)); }

// --------- HUD binding ---------
App.hud = HUDMod.createHUD({
  onHome: stopToHome,
  onReplay: ()=> startGame(App.modeKey, App.diff, App.lang),
});

// Bind quests → HUD
Quests.bindToMain({ hud: App.hud });

// --------- Mode registry ---------
const MODES = { goodjunk, groups, hydration, plate };

// --------- Menu wiring ---------
const BTN_START = $('#btn_start');
const BTN_E = $('#d_easy'), BTN_N = $('#d_normal'), BTN_H = $('#d_hard');
const TILE_M = {
  goodjunk: $('#m_goodjunk'),
  groups: $('#m_groups'),
  hydration: $('#m_hydration'),
  plate: $('#m_plate'),
};
const MODE_NAME = $('#modeName');
const DIFF_TEXT = $('#difficulty');

for (const [k,el] of Object.entries(TILE_M)){
  el?.addEventListener('click', ()=>{
    Object.values(TILE_M).forEach(x=>x?.classList.remove('active'));
    el?.classList.add('active');
    App.modeKey = k;
    MODE_NAME.textContent = {
      goodjunk:'Good vs Junk', groups:'5 Food Groups', hydration:'Hydration', plate:'Healthy Plate'
    }[k] || 'Good vs Junk';
    document.body.setAttribute('data-mode', App.modeKey);
  });
}

BTN_E?.addEventListener('click', ()=>{ setActive([BTN_E,BTN_N,BTN_H], BTN_E); App.diff='Easy'; DIFF_TEXT.textContent='Easy'; });
BTN_N?.addEventListener('click', ()=>{ setActive([BTN_E,BTN_N,BTN_H], BTN_N); App.diff='Normal'; DIFF_TEXT.textContent='Normal'; });
BTN_H?.addEventListener('click', ()=>{ setActive([BTN_E,BTN_N,BTN_H], BTN_H); App.diff='Hard'; DIFF_TEXT.textContent='Hard'; });

BTN_START?.addEventListener('click', ()=> startGame(App.modeKey, App.diff, App.lang));

// --------- Core flow ---------
function startGame(modeKey='goodjunk', diff='Normal', lang='TH'){
  stopGame(); // safety
  App.running = true;
  App.timeLeft = 45;
  Engine.score.value = 0; Engine.score.combo = 0;
  App.hud.resetScore(0,0); App.hud.updateTime(App.timeLeft);
  App.hud.setCoach('Go!'); App.hud.showCoach(true);
  $('#menuBar').style.display='none';

  // reveal per-mode HUDs
  if (modeKey==='plate'){ $('#plateTracker').style.display='block'; $('#targetWrap').style.display='none'; }
  else if (modeKey==='groups'){ $('#plateTracker').style.display='none'; $('#targetWrap').style.display='inline-flex'; }
  else { $('#plateTracker').style.display='none'; $('#targetWrap').style.display='none'; }

  // quests begin
  Quests.setLang(lang);
  Quests.beginRun(modeKey, diff, lang, App.timeLeft);

  // bus for score/combo/quests
  App.Bus = {
    hit: ({kind, points, ui, meta}={})=>{
      const gain = points ?? (kind==='perfect'?18:10);
      Engine.score.add(gain);
      Engine.score.comboUp();
      Quests.event('hit', { result:kind||'good', meta, comboNow:Engine.score.combo, score:Engine.score.value });
      App.hud.updateScore(Engine.score.value, Engine.score.combo, App.timeLeft);
    },
    miss: ({meta}={})=>{
      Engine.score.comboBreak();
      Quests.event('hit', { result:'bad', meta, comboNow:Engine.score.combo, score:Engine.score.value });
      App.hud.updateScore(Engine.score.value, Engine.score.combo, App.timeLeft);
      App.hud.dimPenalty();
    }
  };

  // mount mode
  const mod = MODES[modeKey] || goodjunk;
  App.game = mod.create({ engine:Engine, hud:App.hud, coach:{
    onStart(){ App.hud.setCoach('Start!'); setTimeout(()=>App.hud.showCoach(false), 600); },
    onGood(){},
    onBad(){},
  }});
  App.game.start();

  // loop
  App.lastTs = performance.now();
  tickSeconds(); // start second timer
  App.raf = requestAnimationFrame(loop);
}

// per-frame
function loop(ts){
  if (!App.running) return;
  const dt = Math.min(0.05, (ts - App.lastTs)/1000); // clamp 50ms
  App.lastTs = ts;

  try{ App.game?.update?.(dt, App.Bus); }catch(e){ console.error(e); }

  App.raf = requestAnimationFrame(loop);
}

// per-second timer
function tickSeconds(){
  if (!App.running) return;
  App.timeLeft = clamp(App.timeLeft-1, 0, 999);
  App.hud.updateTime(App.timeLeft);
  Quests.tick({ score: Engine.score.value });

  if (App.timeLeft<=0){ return endGame(); }

  setTimeout(tickSeconds, 1000);
}

function endGame(){
  if (!App.running) return;
  App.running = false;
  try{ App.game?.stop?.(); }catch{}
  const questSum = Quests.endRun({ score: Engine.score.value });
  App.hud.showResult({
    score: Engine.score.value,
    combo: Engine.score.combo,
    quests: questSum
  });
}

function stopGame(){
  cancelAnimationFrame(App.raf);
  try{ App.game?.stop?.(); }catch{}
  App.game = null;
}

function stopToHome(){
  stopGame();
  $('#menuBar').style.display='';
  $('#plateTracker').style.display='none';
  App.hud.showCoach(false);
  App.hud.hideResult();
}

// Pause on blur (no undefined pauseGame; handled here)
window.addEventListener('blur', ()=>{ if(App.running){ App.hud.setCoach('⏸ Paused'); App.hud.showCoach(true); }});
window.addEventListener('focus', ()=>{ if(App.running){ App.hud.showCoach(false); }});

// expose for debug
window.__HHA_APP = App;
