// === /herohealth/vr-groups/groups-pc-boss-arena-v13.js ===
// HeroHealth Groups PC — v1.3 Boss Arena Upgrade
// Adds stronger boss commands and boss-clear tracking without changing core.

(function(){
  'use strict';

  const VERSION = 'v1.3-pc-boss-arena-20260514';
  if(window.__HHA_GROUPS_PC_BOSS_V13__) return;
  window.__HHA_GROUPS_PC_BOSS_V13__ = true;

  const WIN = window;
  const DOC = document;

  const COMMANDS = [
    {id:'bossCorrect',icon:'👑',title:'ตอบถูก 6 ครั้ง',target:6,duration:17000},
    {id:'bossNoMiss',icon:'🛡️',title:'ห้ามพลาด 10 วิ',target:1,duration:10000},
    {id:'bossCombo',icon:'🔥',title:'ทำคอมโบ +5',target:5,duration:16000},
    {id:'bossScore',icon:'🏆',title:'เก็บ 120 คะแนน',target:120,duration:18000}
  ];

  const state = {
    active:null,
    progress:0,
    endsAt:0,
    baselineCombo:0,
    baselineScore:0,
    cleared:0,
    failed:0,
    lastPhase:'',
    nextCommandAt:0,
    timer:null
  };

  const $ = id => DOC.getElementById(id);

  function api(){ return WIN.HHA_GROUPS_PC_V1 || null; }

  function gs(){
    try{
      const a = api();
      return a && typeof a.getState === 'function' ? (a.getState() || {}) : {};
    }catch(e){ return {}; }
  }

  function clamp(n,min,max){
    n=Number(n);
    if(!Number.isFinite(n)) n=min;
    return Math.max(min,Math.min(max,n));
  }

  function injectStyle(){
    if($('groups-pc-v13-style')) return;

    const s = DOC.createElement('style');
    s.id = 'groups-pc-v13-style';
    s.textContent = `
      .pc-v13-card{
        position:absolute;
        right:18px;
        top:268px;
        z-index:46;
        width:min(360px,32vw);
        display:none;
        border-radius:28px;
        padding:14px;
        background:linear-gradient(145deg,rgba(255,244,224,.97),rgba(255,255,255,.95));
        border:2px solid #ffb347;
        box-shadow:0 20px 56px rgba(35,81,107,.18);
        pointer-events:none;
      }

      body.boss-on .pc-v13-card{ display:block; }

      .pc-v13-title{
        display:flex;
        justify-content:space-between;
        gap:10px;
        align-items:center;
        color:#8a3c20;
        font-size:16px;
        font-weight:1000;
      }

      .pc-v13-desc{
        margin-top:6px;
        color:#8a6a31;
        font-size:13px;
        font-weight:900;
      }

      .pc-v13-meter{
        height:12px;
        margin-top:10px;
        border-radius:999px;
        overflow:hidden;
        background:rgba(255,125,125,.18);
      }

      .pc-v13-meter i{
        display:block;
        height:100%;
        width:0%;
        background:linear-gradient(90deg,#ff7d7d,#ffb347,#ffd966);
        transition:width .18s ease;
      }

      .pc-v13-flash{
        position:absolute;
        inset:0;
        z-index:145;
        pointer-events:none;
        opacity:0;
        background:radial-gradient(circle at 50% 45%,rgba(255,217,102,.48),rgba(255,255,255,0) 46%);
      }

      .pc-v13-flash.show{ animation:pcv13Flash .58s ease both; }

      @keyframes pcv13Flash{
        0%{opacity:0;}
        38%{opacity:1;}
        100%{opacity:0;}
      }

      .pc-v13-summary{
        margin-top:12px;
        border-radius:24px;
        padding:13px;
        background:linear-gradient(180deg,#fff7e5,#ffffff);
        border:2px solid #ffcf8a;
      }

      .pc-v13-summary h3{margin:0;font-size:17px;font-weight:1000;color:#8a3c20;}
      .pc-v13-summary p{margin:7px 0 0;color:#8a6a31;font-size:13px;line-height:1.35;font-weight:850;}
    `;
    DOC.head.appendChild(s);
  }

  function ensureUi(){
    const game = $('game');
    if(!game) return;

    if(!$('pcv13Card')){
      const card = DOC.createElement('div');
      card.id = 'pcv13Card';
      card.className = 'pc-v13-card';
      card.innerHTML = `
        <div class="pc-v13-title">
          <span id="pcv13Title">👑 Boss Command</span>
          <span id="pcv13Count">0/6</span>
        </div>
        <div id="pcv13Desc" class="pc-v13-desc">รอ Boss Phase</div>
        <div class="pc-v13-meter"><i id="pcv13Fill"></i></div>
      `;
      game.appendChild(card);
    }

    if(!$('pcv13Flash')){
      const f = DOC.createElement('div');
      f.id = 'pcv13Flash';
      f.className = 'pc-v13-flash';
      game.appendChild(f);
    }
  }

  function flash(){
    const f = $('pcv13Flash');
    if(!f) return;
    f.classList.remove('show');
    void f.offsetWidth;
    f.classList.add('show');
  }

  function setCommand(cmd){
    const s = gs();

    state.active = Object.assign({}, cmd);
    state.progress = 0;
    state.endsAt = Date.now() + cmd.duration;
    state.baselineCombo = Number(s.combo || 0);
    state.baselineScore = Number(s.score || 0);

    updateUi();
    flash();

    try{
      WIN.dispatchEvent(new CustomEvent('groups-pc:v13:boss-command',{detail:{version:VERSION,command:cmd.id,title:cmd.title}}));
    }catch(e){}
  }

  function clearCommand(){
    state.active = null;
    state.progress = 0;
    state.nextCommandAt = Date.now() + 4200;
    updateUi();
  }

  function complete(){
    if(!state.active) return;

    state.cleared += 1;
    flash();

    try{
      WIN.dispatchEvent(new CustomEvent('groups-pc:v13:boss-clear',{detail:{version:VERSION,command:state.active.id,cleared:state.cleared}}));
    }catch(e){}

    clearCommand();
  }

  function fail(){
    if(!state.active) return;

    state.failed += 1;

    try{
      WIN.dispatchEvent(new CustomEvent('groups-pc:v13:boss-fail',{detail:{version:VERSION,command:state.active.id,failed:state.failed}}));
    }catch(e){}

    clearCommand();
  }

  function updateUi(){
    const title = $('pcv13Title');
    const desc = $('pcv13Desc');
    const count = $('pcv13Count');
    const fill = $('pcv13Fill');

    if(!state.active){
      if(title) title.textContent = '👑 Boss Command';
      if(desc) desc.textContent = 'เข้าสู่ Boss Phase แล้วระบบจะให้คำสั่งพิเศษ';
      if(count) count.textContent = '-';
      if(fill) fill.style.width = '0%';
      return;
    }

    const c = state.active;

    if(title) title.textContent = `${c.icon} ${c.title}`;
    if(desc){
      const left = Math.max(0, Math.ceil((state.endsAt - Date.now()) / 1000));
      desc.textContent = `ทำให้สำเร็จก่อนหมดเวลา ${left}s`;
    }
    if(count) count.textContent = `${state.progress}/${c.target}`;
    if(fill) fill.style.width = clamp(state.progress / Math.max(1,c.target) * 100, 0, 100) + '%';
  }

  function pickCommand(){
    return COMMANDS[Math.floor(Math.random() * COMMANDS.length) % COMMANDS.length];
  }

  function poll(){
    const s = gs();

    if(!s || s.mode !== 'game' || s.ended){
      if(state.active) clearCommand();
      return;
    }

    const phase = s.phase || '';
    if(phase !== state.lastPhase){
      state.lastPhase = phase;
      if(phase === 'boss'){
        state.nextCommandAt = Date.now() + 900;
      }else{
        clearCommand();
      }
    }

    if(phase !== 'boss') return;

    if(!state.active && Date.now() >= state.nextCommandAt){
      setCommand(pickCommand());
      return;
    }

    if(state.active){
      if(Date.now() >= state.endsAt){
        if(state.active.id === 'bossNoMiss') complete();
        else fail();
        return;
      }

      if(state.active.id === 'bossCombo'){
        state.progress = Math.max(state.progress, Math.min(state.active.target, Number(s.combo || 0) - state.baselineCombo));
      }

      if(state.active.id === 'bossScore'){
        state.progress = Math.max(0, Math.min(state.active.target, Number(s.score || 0) - state.baselineScore));
      }

      updateUi();
    }
  }

  function onJudge(d){
    if(!state.active) return;

    if(!d.ok){
      if(state.active.id === 'bossNoMiss') fail();
      if(state.active.id === 'bossCombo'){
        state.progress = 0;
        state.baselineCombo = Number(gs().combo || 0);
      }
      updateUi();
      return;
    }

    if(state.active.id === 'bossCorrect'){
      state.progress += 1;
    }

    if(state.active.id === 'bossNoMiss'){
      state.progress = 1;
    }

    if(state.progress >= state.active.target) complete();
    else updateUi();
  }

  function appendSummary(){
    const card = DOC.querySelector('.summary-card');
    if(!card) return;

    let box = $('pcv13Summary');
    if(!box){
      box = DOC.createElement('div');
      box.id = 'pcv13Summary';
      box.className = 'pc-v13-summary';
      const actions = card.querySelector('.actions');
      card.insertBefore(box, actions);
    }

    box.innerHTML = `
      <h3>👑 Boss Arena</h3>
      <p>เคลียร์ Boss Command ${state.cleared} ครั้ง • พลาด ${state.failed} ครั้ง</p>
    `;

    try{
      const raw = localStorage.getItem('HHA_GROUPS_PC_SUMMARY');
      if(raw){
        const summary = JSON.parse(raw);
        summary.pcBossArena = {
          version:VERSION,
          cleared:state.cleared,
          failed:state.failed
        };
        localStorage.setItem('HHA_GROUPS_PC_SUMMARY', JSON.stringify(summary));
      }
    }catch(e){}
  }

  function installEvents(){
    WIN.addEventListener('groups-pc:judge', ev=>onJudge(ev.detail || {}));

    WIN.addEventListener('groups:end', ()=>{
      if(state.active) clearCommand();
      setTimeout(appendSummary, 160);
      setTimeout(appendSummary, 520);
    });
  }

  function init(){
    injectStyle();
    ensureUi();
    installEvents();
    state.timer = setInterval(poll, 220);

    WIN.HHA_GROUPS_PC_V13_BOSS = {
      version:VERSION,
      getState:()=>({
        version:VERSION,
        active:state.active,
        progress:state.progress,
        cleared:state.cleared,
        failed:state.failed
      })
    };

    console.info('[Groups PC v1.3] boss arena installed', VERSION);
  }

  if(DOC.readyState === 'loading') DOC.addEventListener('DOMContentLoaded', init, {once:true});
  else init();
})();
