// === /herohealth/vr-groups/groups-pc-thrill-v11.js ===
// HeroHealth Groups PC — v1.1 Thrill Layer
// Adds combo callouts, particles, danger edge, boss pressure bar, hit/miss screen feedback.

(function(){
  'use strict';

  const VERSION = 'v1.1-pc-thrill-layer-20260514';
  if(window.__HHA_GROUPS_PC_THRILL_V11__) return;
  window.__HHA_GROUPS_PC_THRILL_V11__ = true;

  const DOC = document;
  const WIN = window;

  const state = {
    lastCombo:0,
    lastScore:0,
    lastPhase:'',
    bossHp:0,
    bossMax:10,
    danger:false,
    poll:null,
    audio:null
  };

  const $ = id => DOC.getElementById(id);

  function api(){
    return WIN.HHA_GROUPS_PC_V1 || null;
  }

  function gameState(){
    try{
      const a = api();
      return a && typeof a.getState === 'function' ? (a.getState() || {}) : {};
    }catch(e){
      return {};
    }
  }

  function injectStyle(){
    if($('groups-pc-v11-style')) return;

    const s = DOC.createElement('style');
    s.id = 'groups-pc-v11-style';
    s.textContent = `
      body.pc-v11-hit .game{ filter:brightness(1.08) saturate(1.08); }
      body.pc-v11-miss .game{ animation:pcv11Miss .22s ease both; }

      @keyframes pcv11Miss{
        0%{transform:translateX(0);}
        20%{transform:translateX(-5px);}
        45%{transform:translateX(5px);}
        70%{transform:translateX(-2px);}
        100%{transform:translateX(0);}
      }

      body.pc-v11-danger .game::after{
        content:"";
        position:absolute;
        inset:0;
        z-index:95;
        pointer-events:none;
        background:radial-gradient(circle at 50% 52%,rgba(255,255,255,0) 52%,rgba(255,90,90,.34) 100%);
        animation:pcv11Danger .38s ease-in-out infinite alternate;
      }

      @keyframes pcv11Danger{
        from{opacity:.2;}
        to{opacity:.76;}
      }

      .pc-v11-combo{
        position:absolute;
        left:50%;
        top:164px;
        z-index:130;
        min-width:min(500px,70vw);
        max-width:calc(100vw - 40px);
        transform:translateX(-50%);
        border-radius:999px;
        padding:12px 18px;
        background:linear-gradient(135deg,rgba(255,255,255,.97),rgba(255,245,201,.96));
        border:2px solid rgba(255,217,102,.9);
        box-shadow:0 20px 56px rgba(35,81,107,.2);
        color:#8a5200;
        text-align:center;
        font-size:clamp(22px,3vw,40px);
        line-height:1.05;
        font-weight:1000;
        pointer-events:none;
        opacity:0;
      }

      .pc-v11-combo.show{ animation:pcv11Combo .88s ease both; }

      @keyframes pcv11Combo{
        0%{opacity:0; transform:translateX(-50%) translateY(14px) scale(.82);}
        18%{opacity:1; transform:translateX(-50%) translateY(0) scale(1.08);}
        72%{opacity:1; transform:translateX(-50%) translateY(-4px) scale(1);}
        100%{opacity:0; transform:translateX(-50%) translateY(-22px) scale(.94);}
      }

      .pc-v11-bossbar{
        position:absolute;
        left:18px;
        right:18px;
        top:166px;
        z-index:42;
        display:none;
        border-radius:24px;
        padding:10px 13px;
        background:rgba(255,255,255,.92);
        box-shadow:0 14px 34px rgba(35,81,107,.14);
        pointer-events:none;
      }

      body.boss-on .pc-v11-bossbar{ display:block; }

      .pc-v11-boss-top{
        display:flex;
        justify-content:space-between;
        gap:12px;
        align-items:center;
        color:#8a3c20;
        font-size:14px;
        font-weight:1000;
      }

      .pc-v11-boss-meter{
        height:11px;
        margin-top:7px;
        border-radius:999px;
        overflow:hidden;
        background:rgba(255,125,125,.18);
      }

      .pc-v11-boss-meter i{
        display:block;
        height:100%;
        width:0%;
        border-radius:999px;
        background:linear-gradient(90deg,#ff7d7d,#ffb347,#ffd966);
        transition:width .18s ease;
      }

      .pc-v11-particles{
        position:absolute;
        inset:0;
        z-index:125;
        pointer-events:none;
        overflow:hidden;
      }

      .pc-v11-p{
        position:absolute;
        width:12px;
        height:12px;
        border-radius:999px;
        background:#ffd966;
        opacity:0;
        animation:pcv11Particle .78s ease-out forwards;
      }

      @keyframes pcv11Particle{
        0%{opacity:1; transform:translate(0,0) scale(1);}
        100%{opacity:0; transform:translate(var(--dx),var(--dy)) scale(.24);}
      }

      .pc-v11-toast{
        position:absolute;
        left:50%;
        top:42%;
        z-index:140;
        width:min(560px,78vw);
        transform:translate(-50%,-50%);
        border-radius:36px;
        padding:22px 18px;
        text-align:center;
        background:linear-gradient(145deg,rgba(255,255,255,.98),rgba(255,247,218,.96));
        color:#714300;
        box-shadow:0 30px 84px rgba(35,81,107,.26);
        font-size:clamp(32px,5vw,62px);
        line-height:1.02;
        font-weight:1000;
        pointer-events:none;
        opacity:0;
      }

      .pc-v11-toast.show{ animation:pcv11Toast .98s ease both; }

      @keyframes pcv11Toast{
        0%{opacity:0; transform:translate(-50%,-42%) scale(.78);}
        18%{opacity:1; transform:translate(-50%,-50%) scale(1.08);}
        72%{opacity:1; transform:translate(-50%,-50%) scale(1);}
        100%{opacity:0; transform:translate(-50%,-60%) scale(.94);}
      }
    `;
    DOC.head.appendChild(s);
  }

  function ensureLayer(){
    const game = $('game');
    if(!game) return;

    if(!$('pcv11Combo')){
      const c = DOC.createElement('div');
      c.id = 'pcv11Combo';
      c.className = 'pc-v11-combo';
      game.appendChild(c);
    }

    if(!$('pcv11Bossbar')){
      const b = DOC.createElement('div');
      b.id = 'pcv11Bossbar';
      b.className = 'pc-v11-bossbar';
      b.innerHTML = `
        <div class="pc-v11-boss-top">
          <span>👑 Boss Pressure</span>
          <span id="pcv11BossText">0/10</span>
        </div>
        <div class="pc-v11-boss-meter"><i id="pcv11BossFill"></i></div>
      `;
      game.appendChild(b);
    }

    if(!$('pcv11Particles')){
      const p = DOC.createElement('div');
      p.id = 'pcv11Particles';
      p.className = 'pc-v11-particles';
      game.appendChild(p);
    }

    if(!$('pcv11Toast')){
      const t = DOC.createElement('div');
      t.id = 'pcv11Toast';
      t.className = 'pc-v11-toast';
      game.appendChild(t);
    }
  }

  function showCombo(text){
    const el = $('pcv11Combo');
    if(!el) return;
    el.textContent = text;
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
  }

  function stageToast(text){
    const el = $('pcv11Toast');
    if(!el) return;
    el.textContent = text;
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
  }

  function burst(kind){
    const layer = $('pcv11Particles');
    const stage = $('stage');
    if(!layer || !stage) return;

    const sr = stage.getBoundingClientRect();
    const lr = layer.getBoundingClientRect();
    const cx = sr.left + sr.width * (.25 + Math.random() * .5) - lr.left;
    const cy = sr.top + sr.height * (.25 + Math.random() * .45) - lr.top;

    const colors = {
      good:['#7ed957','#ffd966','#61bbff'],
      miss:['#ff7d7d','#ffb3b3','#ffd1d1'],
      golden:['#ffd966','#ffb347','#fff2a8'],
      fever:['#ff9d3f','#ffd966','#ffffff'],
      boss:['#ff7d7d','#ff9d3f','#ffd966']
    }[kind] || ['#ffd966','#7ed957','#61bbff'];

    for(let i=0;i<24;i++){
      const p = DOC.createElement('i');
      p.className = 'pc-v11-p';
      const ang = Math.PI * 2 * i / 24;
      const dist = 58 + Math.random() * 74;
      p.style.left = cx + 'px';
      p.style.top = cy + 'px';
      p.style.background = colors[i % colors.length];
      p.style.setProperty('--dx', Math.cos(ang) * dist + 'px');
      p.style.setProperty('--dy', Math.sin(ang) * dist + 'px');
      layer.appendChild(p);
      setTimeout(()=>p.remove(), 860);
    }
  }

  function pulse(cls, ms){
    DOC.body.classList.add(cls);
    setTimeout(()=>DOC.body.classList.remove(cls), ms || 180);
  }

  function updateBossBar(){
    const f = $('pcv11BossFill');
    const t = $('pcv11BossText');
    if(!f || !t) return;
    f.style.width = Math.max(0, Math.min(100, state.bossHp / state.bossMax * 100)) + '%';
    t.textContent = `${state.bossHp}/${state.bossMax}`;
  }

  function unlockAudio(){
    try{
      if(!state.audio){
        const AC = WIN.AudioContext || WIN.webkitAudioContext;
        if(AC) state.audio = new AC();
      }
      if(state.audio && state.audio.state === 'suspended') state.audio.resume();
    }catch(e){}
  }

  function beep(freq, dur, type){
    try{
      unlockAudio();
      const ctx = state.audio;
      if(!ctx) return;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type || 'sine';
      o.frequency.value = freq || 720;
      g.gain.setValueAtTime(.001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(.048, ctx.currentTime + .012);
      g.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + (dur || .08));
      o.connect(g); g.connect(ctx.destination);
      o.start(); o.stop(ctx.currentTime + (dur || .08) + .02);
    }catch(e){}
  }

  function dangerPoll(s){
    if(!s || s.mode !== 'game' || s.ended){
      DOC.body.classList.remove('pc-v11-danger');
      return;
    }

    const dangerous = DOC.querySelectorAll('.fall-item.danger').length > 0;
    DOC.body.classList.toggle('pc-v11-danger', dangerous);

    if(dangerous && !state.danger){
      state.danger = true;
      beep(260, .07, 'triangle');
    }

    if(!dangerous) state.danger = false;
  }

  function poll(){
    const s = gameState();
    if(!s || !s.mode) return;

    dangerPoll(s);

    const phase = s.phase || '';
    if(phase !== state.lastPhase){
      state.lastPhase = phase;
      state.bossHp = 0;
      updateBossBar();

      if(phase === 'storm'){
        stageToast('⚡ SPEED SORT!');
        burst('good');
      }

      if(phase === 'boss'){
        stageToast('👑 BOSS RUSH!');
        burst('boss');
        beep(360, .14, 'sawtooth');
        setTimeout(()=>beep(620, .12), 120);
      }
    }

    const combo = Number(s.combo || 0);
    if(combo !== state.lastCombo){
      if(combo === 5) showCombo('🔥 Combo 5!');
      if(combo === 10) showCombo('⚡ Super Sort x10!');
      if(combo === 15) showCombo('🚀 Mega Combo x15!');
      if(combo > 0 && combo % 20 === 0) showCombo(`🏆 Ultra Combo x${combo}!`);
      state.lastCombo = combo;
    }

    if(s.score !== state.lastScore){
      state.lastScore = Number(s.score || 0);
    }
  }

  function installEvents(){
    WIN.addEventListener('groups-pc:judge', ev=>{
      const d = ev.detail || {};
      if(d.ok){
        pulse('pc-v11-hit', 150);
        burst(d.phase === 'boss' ? 'boss' : 'good');

        if(d.phase === 'boss'){
          state.bossHp = Math.min(state.bossMax, state.bossHp + 1);
          updateBossBar();

          if(state.bossHp >= state.bossMax){
            stageToast('👑 Boss Broken!');
            burst('boss');
            beep(1080, .12);
            state.bossHp = 0;
            setTimeout(updateBossBar, 260);
          }
        }
      }else{
        pulse('pc-v11-miss', 230);
        burst('miss');
        showCombo('คอมโบหลุด!');
      }
    });

    WIN.addEventListener('groups:end', ()=>{
      DOC.body.classList.remove('pc-v11-danger','pc-v11-hit','pc-v11-miss');
      state.bossHp = 0;
      updateBossBar();
    });

    DOC.addEventListener('pointerdown', unlockAudio, {once:true, passive:true});
  }

  function init(){
    injectStyle();
    ensureLayer();
    installEvents();
    state.poll = setInterval(poll, 130);

    WIN.HHA_GROUPS_PC_V11_THRILL = {
      version:VERSION,
      showCombo,
      stageToast,
      burst,
      getState:()=>({version:VERSION,bossHp:state.bossHp,bossMax:state.bossMax})
    };

    console.info('[Groups PC v1.1] thrill layer installed', VERSION);
  }

  if(DOC.readyState === 'loading') DOC.addEventListener('DOMContentLoaded', init, {once:true});
  else init();
})();
