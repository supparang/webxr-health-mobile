// === Hero Health Academy — game/main.js (2025-10-30)
// HUD-safe, MiniQuest top-center, FE-ready, Result flow, pause on blur

import { Quests } from './core/quests.js';
import * as goodjunk  from './modes/goodjunk.js';
import * as groups    from './modes/groups.js';
import * as hydration from './modes/hydration.js';
import * as plate     from './modes/plate.js';

const MODES = { goodjunk, groups, hydration, plate };
const $ = (s)=>document.querySelector(s);
const on = (el,ev,fn)=>el && el.addEventListener(ev,fn);

// ---------------- HUD facade (ไม่รับคลิก) ----------------
const HUD = {
  show(){ const w=$('#hudWrap'); if(w){ w.style.display='block'; } },
  hide(){ const w=$('#hudWrap'); if(w){ w.style.display='none'; } },
  setScore(n){ const el=$('#score'); if(el) el.textContent = n|0; },
  setTime(n){ const el=$('#time');  if(el) el.textContent = n|0; },
  setCombo(n){ const el=$('#combo'); if(el) el.textContent = 'x'+(n|0); },
  coachSay(t){
    const c=$('#coachHUD'); const txt=$('#coachText');
    if(!c||!txt) return; txt.textContent=t; c.classList.add('show');
    setTimeout(()=>c.classList.remove('show'), 1200);
  },
  setTarget(group,have,need){
    const w=$('#targetWrap'); const b=$('#targetBadge');
    if(!b) return; if(w) w.style.display='inline-flex';
    b.textContent=`${group} • ${have}/${need}`;
  },
  showHydration(){ /* hydration.js เรนเดอร์เอง */ },
  hideHydration(){},
  dimPenalty(){
    document.body.classList.add('flash-danger');
    setTimeout(()=>document.body.classList.remove('flash-danger'),160);
  },
  // ---- Mini Quests chips ----
  setQuestChips(chips = []){
    const ul = $('#questChips'); if(!ul) return;
    ul.innerHTML = chips.map(q=>{
      const need=q.need|0, prog=Math.min(q.progress|0, need), pct=need?Math.round((prog/need)*100):0;
      const done=q.done?'done':''; const icon=q.icon||'⭐'; const label=q.label||q.id;
      return `<li class="${done}">
        <span class="qi">${icon}</span>
        <span class="ql">${label}</span>
        <span class="qp">${prog}/${need}</span>
        <span class="bar"><i style="width:${pct}%"></i></span>
      </li>`;
    }).join('');
  },
  markQuestDone(){ /* styled already */ },
};

// bind quests → HUD
Quests.bindToMain({ hud: HUD });

// ---------------- App state ----------------
const App = {
  modeKey: (document.body.dataset.mode || 'goodjunk'),
  diff:    (document.body.dataset.diff  || 'Normal'),
  lang:    (document.documentElement.getAttribute('data-hha-lang') || 'TH'),
  score:0, combo:0, time:45, running:false, loopId:0,
  engine:{
    score:{ add:(n)=>{ App.score += (n|0); HUD.setScore(App.score); } },
    sfx:{ play:()=>{} },
    fx:{  popText:(t,{x,y,ms}={})=>{
          const el=document.createElement('div'); el.textContent=t||'';
          Object.assign(el.style,{
            position:'fixed',left:(x||0)+'px',top:(y||0)+'px',
            transform:'translate(-50%,-50%) translateY(0)',opacity:'1',
            fontWeight:'900',color:'#eaf6ff',textShadow:'0 2px 8px #000',
            transition:'transform .7s, opacity .7s',zIndex:120,pointerEvents:'none'
          });
          document.body.appendChild(el);
          requestAnimationFrame(()=>{ el.style.transform='translate(-50%,-50%) translateY(-26px)'; el.style.opacity='0'; });
          setTimeout(()=>{ try{el.remove();}catch{} }, ms||720);
        } }
  },
  sys:null,
  lastTs:0, accumSec:0
};

// ---------------- UI wiring ----------------
function wireMenu(){
  const setMode=(k, label)=>{
    App.modeKey=k; const head=$('#modeName'); if(head) head.textContent=label;
    document.body.dataset.mode=k;
    for(const id of ['m_goodjunk','m_groups','m_hydration','m_plate']){
      const b=$('#'+id); if(b) b.classList.toggle('active', id==='m_'+k);
    }
  };
  on($('#m_goodjunk'),'click', ()=>setMode('goodjunk','Good vs Junk'));
  on($('#m_groups'),'click',   ()=>setMode('groups','5 Food Groups'));
  on($('#m_hydration'),'click',()=>setMode('hydration','Hydration'));
  on($('#m_plate'),'click',    ()=>setMode('plate','Healthy Plate'));

  const setDiff=(d)=>{
    App.diff=d; const el=$('#difficulty'); if(el) el.textContent=d;
    for (const id of ['d_easy','d_normal','d_hard']){
      const b=$('#'+id); if(b) b.classList.toggle('active', (id==='d_'+d.toLowerCase()));
    }
  };
  on($('#d_easy'),'click',   ()=>setDiff('Easy'));
  on($('#d_normal'),'click', ()=>setDiff('Normal'));
  on($('#d_hard'),'click',   ()=>setDiff('Hard'));

  on($('#btn_start'),'click', startGame);
  on($('#result'), 'click', (e)=>{
    const a=e.target.closest?.('[data-result]');
    if(!a) return;
    if (a.dataset.result==='replay'){ hideResult(); startGame(); }
    if (a.dataset.result==='home'){ hideResult(); showMenu(); }
  });
}
function showMenu(){ const m=$('#menuBar'); if(m) m.style.display='block'; HUD.hide(); App.running=false; }
function hideMenu(){ const m=$('#menuBar'); if(m) m.style.display='none'; HUD.show(); }

// ---------------- Game loop ----------------
function startGame(){
  hideMenu();

  // reset
  App.score=0; App.combo=0; HUD.setScore(0); HUD.setCombo(0);
  App.time = (window.__HHA_TIME|0) || 45; HUD.setTime(App.time);
  App.running=true; App.lastTs=performance.now(); App.accumSec=0;

  // clear field
  const host = $('#spawnHost'); if(host) host.innerHTML='';

  // quests
  Quests.setLang(App.lang);
  Quests.beginRun(App.modeKey, App.diff, App.lang, App.time);

  // boot mode
  const Mode = MODES[App.modeKey] || goodjunk;
  App.sys = Mode.create
    ? Mode.create({ engine: App.engine, hud: HUD, coach: {
        onStart(){ HUD.coachSay(App.lang==='EN'?'Go!':'เริ่ม!'); },
        onGood(){}, onBad(){}
      }})
    : null;
  App.sys?.start?.();

  // loop
  cancelAnimationFrame(App.loopId);
  App.loopId = requestAnimationFrame(loop);
}

function loop(ts){
  if (!App.running) return;
  const dt = Math.min(0.05, (ts - App.lastTs)/1000);
  App.lastTs = ts;
  App.accumSec += dt;

  // per-frame update
  App.sys?.update?.(dt, Bus);

  // per-second tick
  if (App.accumSec >= 1){
    const steps = Math.floor(App.accumSec);
    App.accumSec -= steps;
    for (let i=0;i<steps;i++){
      App.time = Math.max(0, (App.time|0) - 1);
      HUD.setTime(App.time);
      Quests.tick({ score: App.score });
      if (App.time<=0){ endGame(); return; }
    }
  }
  App.loopId = requestAnimationFrame(loop);
}

function endGame(){
  App.running=false;
  App.sys?.stop?.();

  const quests = Quests.endRun({ score: App.score });
  const r = $('#result'); const t=$('#resultText'); const pb=$('#pbRow');
  if (t) t.textContent = `คะแนน ${App.score}`;
  if (pb){
    pb.innerHTML = quests.map(q=>{
      const mark = q.done ? '✅' : '❌';
      const lbl  = q.label || q.id;
      return `<li>${mark} ${lbl}</li>`;
    }).join('');
  }
  showResult();
}

function showResult(){ const r=$('#result'); if(r) r.style.display='flex'; }
function hideResult(){ const r=$('#result'); if(r) r.style.display='none'; }

// ---------------- Bus (รับจากโหมด) ----------------
const Bus = {
  hit({ kind='good', points=10, ui={}, meta={} }={}){
    App.engine.score.add(points);
    App.combo = (kind==='bad') ? 0 : (App.combo+1);
    HUD.setCombo(App.combo);
    Quests.event('hit', { result: kind, meta, comboNow: App.combo, score: App.score });
  },
  miss({ meta={} }={}){
    App.combo = 0; HUD.setCombo(0);
    Quests.event('hit', { result: 'bad', meta, comboNow: 0, score: App.score });
  }
};

// ---------------- Boot ----------------
function boot(){
  wireMenu();
  showMenu();
  // pause on blur / resume on focus
  window.addEventListener('blur', ()=>{ if(App.running){ App.running=false; } });
  window.addEventListener('focus', ()=>{
    const menuShown = !!$('#menuBar')?.offsetParent;
    const resultShown = !!$('#result')?.offsetParent;
    if(!menuShown && !resultShown){
      App.running=true; App.lastTs=performance.now();
      App.loopId=requestAnimationFrame(loop);
    }
  });
}
boot();
