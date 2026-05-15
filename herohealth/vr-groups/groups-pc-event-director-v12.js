// === /herohealth/vr-groups/groups-pc-event-director-v12.js ===
// HeroHealth Groups PC — v1.2 Event Director
// Adds timed PC mini-events: Keyboard Sprint, Score Rush, Combo Sprint, No-Miss Window, Boss Command.

(function(){
  'use strict';

  const VERSION = 'v1.2-pc-event-director-20260514';
  if(window.__HHA_GROUPS_PC_EVENT_V12__) return;
  window.__HHA_GROUPS_PC_EVENT_V12__ = true;

  const WIN = window;
  const DOC = document;

  const EVENTS = {
    scoreRush:{id:'scoreRush',icon:'🏆',title:'Score Rush!',desc:'เก็บคะแนนเพิ่มให้ถึงเป้า',target:90,duration:15000,color:'gold'},
    comboSprint:{id:'comboSprint',icon:'🔥',title:'Combo Sprint!',desc:'ทำคอมโบให้ถึงเป้า',target:7,duration:15000,color:'orange'},
    keyboardSprint:{id:'keyboardSprint',icon:'⌨️',title:'Keyboard Sprint!',desc:'กดเลข 1–5 ให้ถูกต่อเนื่อง',target:5,duration:16000,color:'blue'},
    noMiss:{id:'noMiss',icon:'🛡️',title:'No-Miss Window!',desc:'ห้ามพลาดจนหมดเวลา',target:1,duration:12000,color:'green'},
    bossCommand:{id:'bossCommand',icon:'👑',title:'Boss Command!',desc:'ตอบถูกใน Boss Phase',target:5,duration:18000,color:'boss'}
  };

  const state = {
    active:null,
    progress:0,
    startedAt:0,
    endsAt:0,
    nextAt:0,
    completed:0,
    failed:0,
    bonus:0,
    badges:[],
    baselineScore:0,
    baselineCombo:0,
    keyHits:0,
    audio:null,
    timer:null
  };

  const $ = id => DOC.getElementById(id);

  function api(){ return WIN.HHA_GROUPS_PC_V1 || null; }

  function gameState(){
    try{
      const a = api();
      return a && typeof a.getState === 'function' ? (a.getState() || {}) : {};
    }catch(e){ return {}; }
  }

  function playing(s){ return s && s.mode === 'game' && !s.ended; }

  function now(){ return Date.now(); }

  function clamp(n,min,max){
    n=Number(n);
    if(!Number.isFinite(n)) n=min;
    return Math.max(min,Math.min(max,n));
  }

  function injectStyle(){
    if($('groups-pc-v12-style')) return;

    const s = DOC.createElement('style');
    s.id = 'groups-pc-v12-style';
    s.textContent = `
      .pc-v12-card{
        position:absolute;
        left:18px;
        right:18px;
        top:214px;
        z-index:44;
        display:none;
        border-radius:24px;
        padding:11px 13px;
        background:rgba(255,255,255,.92);
        border:2px solid rgba(255,255,255,.94);
        box-shadow:0 16px 42px rgba(35,81,107,.16);
        pointer-events:none;
      }

      body.pc-v12-active .pc-v12-card{ display:block; }

      .pc-v12-card.gold{border-color:#ffd966;background:linear-gradient(135deg,rgba(255,249,218,.96),rgba(255,255,255,.94));}
      .pc-v12-card.orange,.pc-v12-card.boss{border-color:#ffb347;background:linear-gradient(135deg,rgba(255,244,224,.97),rgba(255,255,255,.94));}
      .pc-v12-card.green{border-color:#a7f28e;background:linear-gradient(135deg,rgba(236,255,229,.96),rgba(255,255,255,.94));}
      .pc-v12-card.blue{border-color:#8ecbff;background:linear-gradient(135deg,rgba(232,248,255,.97),rgba(255,255,255,.94));}

      .pc-v12-top{display:flex;align-items:center;justify-content:space-between;gap:12px;}
      .pc-v12-title{display:flex;align-items:center;gap:8px;font-size:15px;font-weight:1000;color:#244e68;}
      .pc-v12-count{border-radius:999px;padding:5px 9px;background:#fff5ca;color:#806000;font-size:12px;font-weight:1000;}
      .pc-v12-desc{margin-top:4px;color:#7193a8;font-size:12px;font-weight:850;}
      .pc-v12-bars{display:grid;grid-template-columns:1fr 90px;gap:8px;margin-top:8px;}
      .pc-v12-progress,.pc-v12-time{height:10px;border-radius:999px;overflow:hidden;background:rgba(97,187,255,.16);}
      .pc-v12-progress i,.pc-v12-time i{display:block;height:100%;width:0%;border-radius:inherit;background:linear-gradient(90deg,#7ed957,#ffd966,#ff9d3f);transition:width .16s ease;}
      .pc-v12-time i{background:linear-gradient(90deg,#61bbff,#ff9d3f,#ff7d7d);}

      .pc-v12-alert{
        position:absolute;
        left:50%;
        top:50%;
        z-index:150;
        width:min(620px,80vw);
        transform:translate(-50%,-50%);
        border-radius:36px;
        padding:22px 18px;
        text-align:center;
        background:linear-gradient(145deg,rgba(255,255,255,.98),rgba(255,248,220,.96));
        box-shadow:0 30px 84px rgba(35,81,107,.28);
        color:#714300;
        font-size:clamp(34px,5vw,64px);
        line-height:1.02;
        font-weight:1000;
        pointer-events:none;
        opacity:0;
      }

      .pc-v12-alert.show{animation:pcv12Alert .98s ease both;}
      .pc-v12-alert small{display:block;margin-top:8px;font-size:clamp(13px,1.6vw,18px);color:#8a6a31;font-weight:900;line-height:1.25;}

      @keyframes pcv12Alert{
        0%{opacity:0;transform:translate(-50%,-42%) scale(.78);}
        18%{opacity:1;transform:translate(-50%,-50%) scale(1.08);}
        72%{opacity:1;transform:translate(-50%,-50%) scale(1);}
        100%{opacity:0;transform:translate(-50%,-60%) scale(.94);}
      }

      .pc-v12-summary{
        margin-top:12px;
        border-radius:24px;
        padding:13px;
        background:linear-gradient(180deg,#ffffff,#f5fcff);
        border:2px solid #d7edf7;
      }

      .pc-v12-summary h3{margin:0;font-size:17px;font-weight:1000;color:#244e68;}
      .pc-v12-summary p{margin:7px 0 0;color:#7193a8;font-size:13px;line-height:1.35;font-weight:850;}
    `;
    DOC.head.appendChild(s);
  }

  function ensureUi(){
    const game = $('game');
    if(!game) return;

    if(!$('pcv12Card')){
      const card = DOC.createElement('div');
      card.id = 'pcv12Card';
      card.className = 'pc-v12-card';
      card.innerHTML = `
        <div class="pc-v12-top">
          <div class="pc-v12-title"><span id="pcv12Icon">⭐</span><span id="pcv12Title">Event</span></div>
          <div id="pcv12Count" class="pc-v12-count">0/3</div>
        </div>
        <div id="pcv12Desc" class="pc-v12-desc">ทำภารกิจพิเศษให้สำเร็จ</div>
        <div class="pc-v12-bars">
          <div class="pc-v12-progress"><i id="pcv12Progress"></i></div>
          <div class="pc-v12-time"><i id="pcv12Time"></i></div>
        </div>
      `;
      game.appendChild(card);
    }

    if(!$('pcv12Alert')){
      const alert = DOC.createElement('div');
      alert.id = 'pcv12Alert';
      alert.className = 'pc-v12-alert';
      game.appendChild(alert);
    }
  }

  function alertBox(title, desc){
    const el = $('pcv12Alert');
    if(!el) return;
    el.innerHTML = `${title}<small>${desc || ''}</small>`;
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
  }

  function scheduleNext(ms){
    state.nextAt = now() + (ms || 8500 + Math.random() * 6500);
  }

  function chooseEvent(s){
    if((s.phase || '') === 'boss' && Math.random() < .58) return EVENTS.bossCommand;

    const pool = [
      EVENTS.scoreRush,
      EVENTS.comboSprint,
      EVENTS.keyboardSprint,
      EVENTS.noMiss
    ];

    return pool[Math.floor(Math.random() * pool.length) % pool.length];
  }

  function startEvent(def){
    const s = gameState();

    state.active = Object.assign({}, def);
    state.progress = 0;
    state.startedAt = now();
    state.endsAt = now() + def.duration;
    state.baselineScore = Number(s.score || 0);
    state.baselineCombo = Number(s.combo || 0);
    state.keyHits = 0;

    DOC.body.classList.add('pc-v12-active');
    alertBox(`${def.icon} ${def.title}`, def.desc);
    updateUi();

    try{
      WIN.dispatchEvent(new CustomEvent('groups-pc:v12:event-start',{detail:{version:VERSION,event:def.id,title:def.title}}));
    }catch(e){}
  }

  function clearEvent(){
    state.active = null;
    state.progress = 0;
    DOC.body.classList.remove('pc-v12-active');
  }

  function completeEvent(){
    if(!state.active) return;
    const e = state.active;

    state.completed += 1;
    state.bonus += 30;

    const badge = `${e.icon} ${e.title.replace('!','')}`;
    if(!state.badges.includes(badge)) state.badges.push(badge);

    alertBox(`สำเร็จ! ${e.icon}`, 'Event Clear +30 Bonus');

    try{
      WIN.dispatchEvent(new CustomEvent('groups-pc:v12:event-complete',{detail:{version:VERSION,event:e.id,bonus:30,completed:state.completed}}));
    }catch(err){}

    clearEvent();
    scheduleNext(10500 + Math.random() * 5200);
  }

  function failEvent(){
    if(!state.active) return;
    const e = state.active;

    state.failed += 1;
    alertBox('พลาด Event', `${e.icon} ${e.title} หมดเวลา`);

    try{
      WIN.dispatchEvent(new CustomEvent('groups-pc:v12:event-fail',{detail:{version:VERSION,event:e.id,failed:state.failed}}));
    }catch(err){}

    clearEvent();
    scheduleNext(7600 + Math.random() * 4400);
  }

  function updateUi(){
    if(!state.active) return;

    const e = state.active;
    const card = $('pcv12Card');
    if(card) card.className = `pc-v12-card ${e.color || ''}`;

    if($('pcv12Icon')) $('pcv12Icon').textContent = e.icon;
    if($('pcv12Title')) $('pcv12Title').textContent = e.title;
    if($('pcv12Desc')) $('pcv12Desc').textContent = e.desc;
    if($('pcv12Count')) $('pcv12Count').textContent = `${state.progress}/${e.target}`;

    if($('pcv12Progress')){
      $('pcv12Progress').style.width = clamp(state.progress / Math.max(1,e.target) * 100, 0, 100) + '%';
    }

    if($('pcv12Time')){
      const left = clamp((state.endsAt - now()) / Math.max(1,e.duration), 0, 1);
      $('pcv12Time').style.width = left * 100 + '%';
    }
  }

  function progressFromJudge(d){
    if(!state.active) return;

    const s = gameState();
    const e = state.active;

    if(!d.ok){
      if(e.id === 'noMiss'){
        state.progress = 0;
        failEvent();
        return;
      }
      if(e.id === 'comboSprint'){
        state.progress = 0;
        updateUi();
      }
      return;
    }

    if(e.id === 'scoreRush'){
      state.progress = Math.min(e.target, Math.max(0, Number(s.score || 0) - state.baselineScore));
    }

    if(e.id === 'comboSprint'){
      state.progress = Math.max(state.progress, Math.min(e.target, Number(s.combo || 0)));
    }

    if(e.id === 'bossCommand'){
      if((s.phase || d.phase) === 'boss') state.progress += 1;
    }

    if(e.id === 'noMiss'){
      state.progress = 1;
    }

    updateUi();
    if(state.progress >= e.target) completeEvent();
  }

  function poll(){
    const s = gameState();

    if(!playing(s)){
      if(state.active) clearEvent();
      return;
    }

    if(!state.nextAt) scheduleNext(6500);

    if(!state.active && now() >= state.nextAt){
      startEvent(chooseEvent(s));
      return;
    }

    if(state.active){
      if(state.active.id === 'noMiss'){
        state.progress = 1;
      }

      if(now() >= state.endsAt){
        if(state.active.id === 'noMiss') completeEvent();
        else failEvent();
        return;
      }

      updateUi();
    }
  }

  function appendSummary(){
    const card = DOC.querySelector('.summary-card');
    if(!card) return;

    let box = $('pcv12Summary');
    if(!box){
      box = DOC.createElement('div');
      box.id = 'pcv12Summary';
      box.className = 'pc-v12-summary';
      const actions = card.querySelector('.actions');
      card.insertBefore(box, actions);
    }

    const badges = state.badges.length ? state.badges.join(' • ') : 'ยังไม่มี Event Badge';

    box.innerHTML = `
      <h3>⚡ PC Event Director</h3>
      <p>สำเร็จ ${state.completed} Event • พลาด ${state.failed} Event • Bonus ${state.bonus}<br>${badges}</p>
    `;

    try{
      const raw = localStorage.getItem('HHA_GROUPS_PC_SUMMARY');
      if(raw){
        const summary = JSON.parse(raw);
        summary.pcEventDirector = {
          version:VERSION,
          completed:state.completed,
          failed:state.failed,
          bonus:state.bonus,
          badges:state.badges.slice()
        };
        localStorage.setItem('HHA_GROUPS_PC_SUMMARY', JSON.stringify(summary));
      }
    }catch(e){}
  }

  function installEvents(){
    WIN.addEventListener('groups-pc:judge', ev=>{
      progressFromJudge(ev.detail || {});
    });

    DOC.addEventListener('keydown', ev=>{
      if(!state.active || state.active.id !== 'keyboardSprint') return;
      if(['1','2','3','4','5'].includes(ev.key)){
        state.keyHits += 1;
        state.progress = Math.min(state.active.target, state.keyHits);
        updateUi();
        if(state.progress >= state.active.target) completeEvent();
      }
    });

    WIN.addEventListener('groups:end', ()=>{
      if(state.active) clearEvent();
      setTimeout(appendSummary, 120);
      setTimeout(appendSummary, 450);
    });
  }

  function init(){
    injectStyle();
    ensureUi();
    installEvents();
    state.timer = setInterval(poll, 180);

    WIN.HHA_GROUPS_PC_V12_EVENT_DIRECTOR = {
      version:VERSION,
      startEvent:id=>EVENTS[id] && startEvent(EVENTS[id]),
      getState:()=>({
        version:VERSION,
        active:state.active,
        progress:state.progress,
        completed:state.completed,
        failed:state.failed,
        bonus:state.bonus,
        badges:state.badges.slice()
      })
    };

    console.info('[Groups PC v1.2] event director installed', VERSION);
  }

  if(DOC.readyState === 'loading') DOC.addEventListener('DOMContentLoaded', init, {once:true});
  else init();
})();
