// === Hero Health Academy — game/main.js (2025-10-30 HUD force-on)
// ทำให้ HUD แสดงแน่นอนระหว่างเล่น + ซ่อนเมนู + มี Result modal

import * as goodjunk   from './modes/goodjunk.js';
import * as groups     from './modes/groups.js';
import * as hydration  from './modes/hydration.js';
import * as plate      from './modes/plate.js';
import { Quests }      from './core/quests.js'; // ถ้าไม่มีไฟล์นี้ ระบบ HUD ยังทำงาน (fallback)
import { add3DTilt, shatter3D } from './core/fx.js'; // ใช้กับเอฟเฟกต์แตกกระจาย

const MODES = { goodjunk, groups, hydration, plate };
window.HHA_FX = window.HHA_FX || { add3DTilt, shatter3D };

const $ = (s)=>document.querySelector(s);

// ------- Engine (คะแนน/คอมโบ/เสียง/FX) -------
const Engine = {
  score:{
    value:0, combo:0, fever:false,
    add(n){ this.value += n|0; },
    comboUp(){ this.combo++; if(this.combo>=10) this.fever = true; },
    comboBreak(){ this.combo=0; this.fever=false; }
  },
  sfx:{ play(id){ try{ const a=document.getElementById(id); if(a){ a.currentTime=0; a.play(); } }catch{} } },
  fx:{
    popText(txt,{x,y,ms=700}={}){
      const el=document.createElement('div');
      el.textContent=txt;
      el.style.cssText=`position:fixed;left:${x}px;top:${y}px;transform:translate(-50%,-50%);
        font:900 16px ui-rounded;color:#fff;text-shadow:0 2px 8px #0008;pointer-events:none;z-index:9999;opacity:1;transition:all .7s`;
      document.body.appendChild(el);
      requestAnimationFrame(()=>{ el.style.transform+=' translateY(-30px)'; el.style.opacity='0'; });
      setTimeout(()=>el.remove(), ms);
    }
  }
};

// ------- App state -------
const App = {
  modeKey:'goodjunk', diff:'Normal', lang:(localStorage.getItem('hha_lang')||'TH').toUpperCase(),
  running:false, timeLeft:45, lastTs:0, raf:0, game:null
};

// ------- HUD helpers (force visible) -------
function ensureHUDVisible(){
  const hw = $('#hudWrap'); if (hw) { hw.style.display='block'; hw.style.pointerEvents='none'; }
  // show/clear numbers
  setText('#score','0'); setText('#combo','0'); setText('#time', String(App.timeLeft));
  setText('#fever','–'); $('#coachHUD')?.replaceChildren();
  // show mode HUDs (containers)
  $('#targetWrap') && ($('#targetWrap').style.display='inline-flex');
  $('#plateTracker') && ($('#plateTracker').style.display='block');
  // hydration container will be created by hydration mode; แต่ถ้ามี hydroWrap แล้ว เปิดไว้
  $('#hydroWrap') && ($('#hydroWrap').style.display='block');
}
function hideHUD(){
  $('#hudWrap') && ($('#hudWrap').style.display='none');
}
function setText(sel, txt){ const el=$(sel); if (el) el.textContent=txt; }
function setCoach(t, ms=1200){
  const c = $('#coachHUD'); if(!c) return;
  c.textContent = t; c.style.opacity='1';
  setTimeout(()=>{ c.style.opacity='0'; c.textContent=''; }, ms);
}
function setQuestChips(chips=[]){
  const ul = $('#questChips'); if (!ul) return;
  ul.innerHTML = chips.map((q)=>{
    const p = Math.min(q.progress|0, q.need|0);
    const done = q.done ? '✅ ' : '';
    return `<li>${done}${q.icon||'⭐'} ${q.label||q.id} ${p}/${q.need}</li>`;
  }).join('');
}
function showResult(score, combo){
  setText('#resScore', String(score|0));
  setText('#resCombo', String(combo|0));
  const m = $('#resultModal'); if (m) m.style.display='flex';
}
function hideResult(){ const m = $('#resultModal'); if (m) m.style.display='none'; }

// ------- Bus (events from modes) -------
const Bus = {
  hit({kind='good', points, ui={x:innerWidth/2, y:innerHeight/2}, meta}={}){
    const pts = points ?? (kind==='perfect'?20:10);
    Engine.score.add(pts); Engine.score.comboUp();
    Engine.fx.popText(`+${pts}${kind==='perfect'?' ✨':''}`, ui);
    window.HHA_FX?.shatter3D?.(ui.x, ui.y);
    Engine.sfx.play(kind==='perfect'?'sfx-perfect':'sfx-good');
    updateScoreHUD();
    // pass to quests if present
    try{ Quests.event?.('hit', { result:kind, comboNow:Engine.score.combo, meta }); }catch{}
  },
  miss({meta}={}){
    Engine.score.comboBreak();
    Engine.sfx.play('sfx-bad');
    updateScoreHUD();
    try{ Quests.event?.('miss', { meta }); }catch{}
  }
};

function updateScoreHUD(){
  setText('#score', String(Engine.score.value|0));
  setText('#combo', String(Engine.score.combo|0));
  setText('#fever', Engine.score.fever ? 'ON' : '–');
}

// ------- Menu wiring -------
function wireMenu(){
  // modes
  [['goodjunk','m_goodjunk'],['groups','m_groups'],['hydration','m_hydration'],['plate','m_plate']]
  .forEach(([k,id])=>{
    const el = $('#'+id); if(!el) return;
    el.addEventListener('click', ()=>{
      document.querySelectorAll('.tile').forEach(t=>t.classList.remove('active'));
      el.classList.add('active');
      App.modeKey = k;
    });
  });
  // difficulty
  [['Easy','d_easy'],['Normal','d_normal'],['Hard','d_hard']]
  .forEach(([k,id])=>{
    const el = $('#'+id); if(!el) return;
    el.addEventListener('click', ()=>{
      document.querySelectorAll('.chip').forEach(c=>c.classList.remove('active'));
      el.classList.add('active');
      App.diff = k;
    });
  });
  // start
  $('#btn_start')?.addEventListener('click', startGame);
  // lang
  const lt = $('#langToggle');
  if (lt){ lt.textContent = App.lang; lt.addEventListener('click',()=>{ App.lang = (App.lang==='TH'?'EN':'TH'); lt.textContent=App.lang; localStorage.setItem('hha_lang', App.lang); }); }

  // result buttons
  $('#btn_home')?.addEventListener('click', ()=>{
    hideResult();
    App.running=false;
    try{ App.game?.stop?.(); }catch{}
    document.body.classList.remove('in-game');
    $('#menuBar').style.display='flex';
    hideHUD();
  });
  $('#btn_replay')?.addEventListener('click', ()=>{
    hideResult();
    startGame();
  });
}

// ------- Timer & loop -------
function tickSecond(){
  if(!App.running) return;
  App.timeLeft = Math.max(0, App.timeLeft - 1);
  setText('#time', String(App.timeLeft));
  try{ Quests.tick?.({ score:Engine.score.value|0 }); }catch{}
  if (App.timeLeft<=0) { endGame(); return; }
  setTimeout(tickSecond, 1000);
}
function gameLoop(ts){
  if(!App.running) return;
  const dt = Math.min(0.5, (ts-(App.lastTs||ts))/1000);
  App.lastTs = ts;
  try{ App.game?.update?.(dt, Bus); }catch{}
  App.raf = requestAnimationFrame(gameLoop);
}

// ------- Start / End -------
function startGame(){
  // hide menu, show HUD
  document.body.classList.add('in-game');
  $('#menuBar').style.display='none';
  ensureHUDVisible();
  hideResult();

  // reset
  App.running=true;
  App.timeLeft = 45;
  Engine.score.value=0; Engine.score.combo=0; Engine.score.fever=false;
  updateScoreHUD();
  setText('#time', String(App.timeLeft));

  // bind quests HUD
  try{
    Quests.bindToMain?.({ hud:{ setQuestChips } });
    Quests.setLang?.(App.lang);
    Quests.beginRun?.(App.modeKey, App.diff, App.lang, App.timeLeft);
    // refresh once
    const active = Quests.getActive?.(); 
    if (active?.list) setQuestChips(active.list.map(q=>({ ...q, label:q.label })));
  }catch{}

  // start mode
  const maker = MODES[App.modeKey]?.create;
  App.game = maker? maker({ engine:Engine, hud:{}, coach:{
    onStart(){ setCoach(App.lang==='EN'?'Ready… Go!':'พร้อม… ลุย!'); },
    onGood(){}, onBad(){}
  } }): null;
  App.game?.start?.();

  // loops
  setTimeout(tickSecond, 1000);
  App.lastTs = performance.now();
  App.raf = requestAnimationFrame(gameLoop);
}
function endGame(){
  App.running=false;
  try{ App.game?.stop?.(); }catch{}
  // summarize quests
  try{
    const done = Quests.endRun?.({ score:Engine.score.value|0 })||[];
    setQuestChips(done);
  }catch{}
  showResult(Engine.score.value, Engine.score.combo);
}

// ------- Boot -------
function boot(){
  wireMenu();
  // กันกรณีเปิดหน้ามาแบบไม่มีเมนู (เช่น hash)
  $('#menuBar').style.display='flex';
  hideResult(); hideHUD();
  // กันเคสภายนอกเรียก (debug)
  window.__HHA_APP = App;
}
boot();
