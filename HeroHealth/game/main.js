// === Hero Health Academy — game/main.js (2025-10-30 + MissionSystem v2.3 + Leaderboard)
// - ใช้ MissionSystem เป็นตัวกำกับ mini-quests (combo/perfect/golden/ฯลฯ)
// - ซ่อนเมนูเมื่อเริ่ม / โชว์ HUD ระหว่างเล่น
// - บันทึกและแสดง Leaderboard (week/month/year/all) ด้วย localStorage

import { MissionSystem } from './core/mission-system.js';
import { Leaderboard }   from './core/leaderboard.js';

import * as goodjunk  from './modes/goodjunk.js';
import * as groups    from './modes/groups.js';
import * as hydration from './modes/hydration.js';
import * as plate     from './modes/plate.js';

const MODES = { goodjunk, groups, hydration, plate };
const $  = (s)=>document.querySelector(s);
const on = (el,ev,fn)=>el && el.addEventListener(ev,fn);

// ---------------- Leaderboard ----------------
const LB = new Leaderboard({ key:'hha_board_v2', maxKeep:500, retentionDays:365 });
let lbScope = 'month';
function renderLB(){
  const host = $('#lbTable'); if(!host) return;
  LB.renderInto(host, { scope: lbScope });
  const info = LB.getInfo(lbScope)?.text || '';
  const elInfo = $('#lbInfo'); if (elInfo) elInfo.textContent = info;
}
function wireLB(){
  const nameInput = $('#playerName');
  try { const saved = localStorage.getItem('hha_name'); if (saved && nameInput) nameInput.value = saved; } catch {}
  on($('#saveName'), 'click', ()=>{
    const v = (nameInput?.value || '').trim();
    try { localStorage.setItem('hha_name', v); } catch {}
    renderLB();
  });
  document.querySelectorAll('#lbScopes .chip').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      document.querySelectorAll('#lbScopes .chip').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      lbScope = btn.getAttribute('data-scope') || 'month';
      renderLB();
    });
  });
  renderLB();
}

// ---------------- HUD facade (click-through) ----------------
const HUD = {
  show(){ const w=$('#hudWrap'); if(w) w.style.display='block'; },
  hide(){ const w=$('#hudWrap'); if(w) w.style.display='none'; },
  setScore(n){ const el=$('#score'); if(el) el.textContent=n|0; },
  setTime(n){ const el=$('#time');  if(el) el.textContent=n|0; },
  setCombo(n){ const el=$('#combo'); if(el) el.textContent='x'+(n|0); },
  coachSay(t){
    const c=$('#coachHUD'), txt=$('#coachText'); if(!c||!txt) return;
    txt.textContent=t; c.style.display='flex';
    setTimeout(()=>{ c.style.display='none'; }, 1200);
  },
  setTarget(group,have,need){
    const w=$('#targetWrap'); const b=$('#targetBadge'); if(!b) return;
    if(w) w.style.display='inline-flex'; b.textContent=`${group} • ${have}/${need}`;
  },
  setQuestChips(chips=[]){
    const ul=$('#questChips'); if(!ul) return;
    ul.innerHTML = chips.map(q=>{
      const need=q.need|0, prog=Math.min(q.progress|0, need), pct=need?Math.round((prog/need)*100):0;
      return `<li class="${q.done?'done':''} ${q.fail?'fail':''}">
        <span class="ico">${q.icon||'⭐'}</span>
        <span class="ql">${q.label||q.key}</span>
        <span class="qp">${prog}/${need}</span>
        <span class="bar"><i style="width:${pct}%"></i></span>
      </li>`;
    }).join('');
  },
  dimPenalty(){
    document.body.classList.add('flash-danger');
    setTimeout(()=>document.body.classList.remove('flash-danger'), 160);
  }
};

// ---------------- App State ----------------
const Missions = new MissionSystem();
const App = {
  modeKey: (document.body.dataset.mode || 'goodjunk'),
  diff:    (document.body.dataset.diff  || 'Normal'),
  lang:    (document.documentElement.getAttribute('data-hha-lang') || 'TH'),
  score:0, combo:0, time:45, running:false, loopId:0,

  missionRun:null,         // โครงชุดเควสต์ ({list, seconds, lang})
  missionState:{},         // state ภายในภารกิจ (ctx, missions)
  coach:{
    onStart(){ HUD.coachSay(App.lang==='EN'?'Ready? Go!':'พร้อมไหม? ลุย!'); },
    onQuestProgress(desc, prog, need){ HUD.coachSay(`${desc} • ${prog}/${need}`); },
    onQuestDone(){ HUD.coachSay(App.lang==='EN'?'Quest ✓':'เควสต์สำเร็จ ✓'); },
    onQuestFail(){ HUD.coachSay(App.lang==='EN'?'Quest failed':'เควสต์ไม่สำเร็จ'); },
    onTimeLow(){ HUD.coachSay(App.lang==='EN'?'10s left—push!':'เหลือ 10 วิ สุดแรง!'); },
    onEnd(score){ HUD.coachSay((score|0)>=200 ? (App.lang==='EN'?'Awesome!':'สุดยอด!') : (App.lang==='EN'?'Nice!':'ดีมาก!')); },
  },

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
  sys:null,   // instance ของโหมด (create().start/update/stop)
  lastTs:0, accumSec:0
};

// ---------------- Menu wiring ----------------
function wireMenu(){
  const setMode=(k, label)=>{
    App.modeKey=k; document.body.dataset.mode=k;
    const head=$('#modeName'); if(head) head.textContent=label;
    ['m_goodjunk','m_groups','m_hydration','m_plate'].forEach(id=>{
      const b=$('#'+id); if(b) b.classList.toggle('active', id==='m_'+k);
    });
  };
  on($('#m_goodjunk'),'click', ()=>setMode('goodjunk','Good vs Junk'));
  on($('#m_groups'),'click',   ()=>setMode('groups','5 Food Groups'));
  on($('#m_hydration'),'click',()=>setMode('hydration','Hydration'));
  on($('#m_plate'),'click',    ()=>setMode('plate','Healthy Plate'));

  const setDiff=(d)=>{
    App.diff=d; const el=$('#difficulty'); if(el) el.textContent=d;
    ['d_easy','d_normal','d_hard'].forEach(id=>{
      const b=$('#'+id); if(b) b.classList.toggle('active', id==='d_'+d.toLowerCase());
    });
  };
  on($('#d_easy'),'click',   ()=>setDiff('Easy'));
  on($('#d_normal'),'click', ()=>setDiff('Normal'));
  on($('#d_hard'),'click',   ()=>setDiff('Hard'));

  on($('#btn_start'),'click', startGame);

  // ปุ่มในหน้าผลลัพธ์
  on($('#result'), 'click', (e)=>{
    const a=e.target.closest?.('[data-result]'); if(!a) return;
    if (a.dataset.result==='replay'){ hideResult(); startGame(); }
    if (a.dataset.result==='home'){ hideResult(); showMenu(); }
  });
}
function showMenu(){ const m=$('#menuBar'); if(m) m.style.display='block'; HUD.hide(); App.running=false; }
function hideMenu(){ const m=$('#menuBar'); if(m) m.style.display='none'; HUD.show(); }

// ---------------- Event Bus → MissionSystem ----------------
const Bus = {
  hit({ kind='good', points=10, ui={}, meta={} }={}){
    // คะแนน + คอมโบ
    App.engine.score.add(points);
    App.combo = (kind==='bad') ? 0 : (App.combo+1);
    HUD.setCombo(App.combo);

    // แจ้งภารกิจ
    Missions.onEvent(kind==='perfect' ? 'perfect' : 'good', { count:1, ...meta }, App.missionState);
    if (meta?.golden) Missions.onEvent('golden', { count:1 }, App.missionState);
    Missions.onEvent('combo', { value: App.combo }, App.missionState);
  },
  miss({ meta={} }={}){
    App.combo = 0; HUD.setCombo(0);
    Missions.onEvent('miss', { count:1, ...meta }, App.missionState);
  },
  // ให้โหมดต่าง ๆ เรียกส่งอีเวนต์เฉพาะทาง (groups/hydration/plate)
  event(name, meta={}){
    Missions.onEvent(name, meta, App.missionState);
  }
};

// ---------------- Game loop ----------------
function startGame(){
  hideMenu();

  // reset run
  App.score=0; App.combo=0; HUD.setScore(0); HUD.setCombo(0);
  App.time = (window.__HHA_TIME|0) || 45; HUD.setTime(App.time);
  App.running=true; App.lastTs=performance.now(); App.accumSec=0;

  // clear field
  const host = $('#spawnHost'); if(host) host.innerHTML='';

  // boot missions (3 เควสต์/รัน)
  App.missionRun   = Missions.start(App.modeKey, { difficulty:App.diff, lang:App.lang, seconds:App.time, count:3 });
  App.missionState = Missions.attachToState(App.missionRun, { lang:App.lang, ctx:{} });
  HUD.setQuestChips(Missions.tick(App.missionState, { score:App.score }, null, { hud:HUD, coach:App.coach, lang:App.lang }) || []);

  // boot mode
  const Mode = MODES[App.modeKey] || goodjunk;
  App.sys = Mode.create
    ? Mode.create({ engine: App.engine, hud: HUD, coach: App.coach })
    : null;
  App.coach.onStart();
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

  // per-frame update (ให้โหมด spawn/อัปเดต)
  App.sys?.update?.(dt, Bus);

  // per-second tick
  if (App.accumSec >= 1){
    const steps = Math.floor(App.accumSec);
    App.accumSec -= steps;
    for (let i=0;i<steps;i++){
      App.time = Math.max(0, (App.time|0) - 1);
      HUD.setTime(App.time);

      // อัปเดตภารกิจทุกวินาที → คืน chips ไปวาด HUD
      const chips = Missions.tick(
        App.missionState,
        { score: App.score },
        ({success,key,index})=>{/* optional hook เมื่อจบเควสต์แต่ละอัน */},
        { hud: HUD, coach: App.coach, lang: App.lang }
      ) || [];
      HUD.setQuestChips(chips);

      if (App.time<=0){ endGame(); return; }
      if (App.time===10){ App.coach.onTimeLow?.(); }
    }
  }
  App.loopId = requestAnimationFrame(loop);
}

function endGame(){
  App.running=false;
  App.sys?.stop?.();
  Missions.stop(App.missionState);

  // บันทึก leaderboard
  const name = ($('#playerName')?.value || localStorage.getItem('hha_name') || '').trim();
  try { if (name) localStorage.setItem('hha_name', name); } catch {}
  LB.submit(App.modeKey, App.diff, App.score, { name });

  // สรุปผล + แสดงเควสต์ (สถานะล่าสุดจาก chips)
  const chips = (App.missionState?.missions||[]).map(m=>({
    done:m.done, success:!!m.success, label: Missions.describe(m, App.lang)
  }));
  const t=$('#resultText'), pb=$('#pbRow');
  if (t) t.textContent = `คะแนน ${App.score}`;
  if (pb){
    pb.innerHTML = chips.map(c=> (c.success? '✅':'❌') + ' ' + c.label ).join(' • ');
  }

  showResult();
  renderLB();
}

function showResult(){ const r=$('#result'); if(r) r.style.display='flex'; }
function hideResult(){ const r=$('#result'); if(r) r.style.display='none'; }

// ---------------- Boot ----------------
function boot(){
  wireMenu();
  wireLB();           // leaderboard UI
  showMenu();

  // pause on blur / resume on focus
  window.addEventListener('blur', ()=>{ if(App.running){ App.running=false; } });
  window.addEventListener('focus', ()=>{
    const menuShown   = !!$('#menuBar')?.offsetParent;
    const resultShown = !!$('#result')?.offsetParent;
    if(!menuShown && !resultShown){
      App.running=true; App.lastTs=performance.now();
      App.loopId=requestAnimationFrame(loop);
    }
  });
}
boot();
