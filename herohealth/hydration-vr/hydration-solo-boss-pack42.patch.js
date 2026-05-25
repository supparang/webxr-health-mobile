/* =========================================================
   HeroHealth Hydration Solo Boss/Fever/Mission Patch
   File: /herohealth/hydration-vr/hydration-solo-boss-pack42.patch.js
   Version: v20260525-pack42-boss-fever-mission

   Purpose:
   - Add stronger Boss / Fever / Mission layer to Hydration Solo Clean Core
   - Designed to load AFTER:
       1) hydration-solo-core.js
       2) hydration-solo-effects-pack41.patch.js
   - Does NOT depend on old hydration-vr.js or old patch files
   ========================================================= */

(function(){
  'use strict';

  var VERSION = 'v20260525-pack42-boss-fever-mission';

  if(window.HHA_HYDRATION_SOLO_BOSS_PACK42){
    console.warn('[Hydration Solo Boss Pack42] already loaded');
    return;
  }

  window.HHA_HYDRATION_SOLO_BOSS_PACK42 = true;

  function q(sel, root){
    try{ return (root || document).querySelector(sel); }
    catch(e){ return null; }
  }

  function qa(sel, root){
    try{ return Array.from((root || document).querySelectorAll(sel)); }
    catch(e){ return []; }
  }

  function clamp(n, min, max){
    n = Number(n);
    if(!Number.isFinite(n)) n = min;
    return Math.max(min, Math.min(max, n));
  }

  function esc(s){
    return String(s == null ? '' : s)
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;')
      .replace(/'/g,'&#39;');
  }

  function readNumber(sel, fallback){
    var el = q(sel);
    if(!el) return fallback;
    var txt = String(el.textContent || '').replace(/[^0-9.-]/g,'');
    var n = Number(txt);
    return Number.isFinite(n) ? n : fallback;
  }

  function currentView(){
    var ctx = window.HHA_HYDRATION_RUN_CONTEXT || {};
    return String(ctx.view || document.body.dataset.view || 'mobile').toLowerCase();
  }

  function currentDiff(){
    var ctx = window.HHA_HYDRATION_RUN_CONTEXT || {};
    return String(ctx.diff || 'normal').toLowerCase();
  }

  function injectStyle(){
    if(q('#hha-hydration-solo-boss-pack42-css')) return;

    var style = document.createElement('style');
    style.id = 'hha-hydration-solo-boss-pack42-css';
    style.textContent = `
      .hha-boss42-panel{
        position:fixed;
        left:50%;
        top:calc(158px + env(safe-area-inset-top,0px));
        transform:translateX(-50%);
        z-index:10012;
        width:min(430px,62vw);
        padding:10px 12px;
        border-radius:22px;
        background:rgba(255,255,255,.92);
        border:3px solid rgba(255,210,140,.72);
        box-shadow:0 14px 34px rgba(30,75,115,.16);
        color:#24445c;
        pointer-events:none;
        opacity:0;
        transition:opacity .18s ease, transform .18s ease;
      }

      .hha-boss42-panel.show{
        opacity:1;
        transform:translateX(-50%) translateY(4px);
      }

      .hha-boss42-head{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:10px;
        margin-bottom:6px;
        font-weight:1000;
      }

      .hha-boss42-title{
        display:flex;
        align-items:center;
        gap:7px;
        min-width:0;
      }

      .hha-boss42-title b{
        white-space:nowrap;
        overflow:hidden;
        text-overflow:ellipsis;
      }

      .hha-boss42-phase{
        flex:0 0 auto;
        padding:4px 8px;
        border-radius:999px;
        background:#fff4c5;
        color:#85631b;
        font-size:12px;
        font-weight:1000;
      }

      .hha-boss42-bar{
        height:12px;
        border-radius:999px;
        overflow:hidden;
        background:#edf8fd;
        box-shadow:inset 0 0 0 2px rgba(204,238,251,.9);
      }

      .hha-boss42-fill{
        height:100%;
        width:100%;
        border-radius:999px;
        background:linear-gradient(90deg,#ff6b6b,#ffbd59,#ffd966);
        transition:width .26s ease;
      }

      .hha-boss42-sub{
        margin-top:5px;
        color:#66879c;
        font-size:12px;
        font-weight:900;
        text-align:center;
      }

      .hha-boss42-alert{
        position:fixed;
        left:50%;
        top:42%;
        transform:translate(-50%,-50%);
        z-index:18000;
        width:min(90vw,470px);
        padding:18px 20px;
        border-radius:30px;
        background:rgba(255,255,255,.97);
        border:4px solid #74dcff;
        box-shadow:0 24px 74px rgba(30,75,115,.28);
        text-align:center;
        color:#24445c;
        pointer-events:none;
        animation:hhaBoss42Alert .98s ease-out forwards;
      }

      .hha-boss42-alert.heat{border-color:#ffd28c}
      .hha-boss42-alert.danger{border-color:#ffb2a2}
      .hha-boss42-alert.fever{border-color:#74dcff}
      .hha-boss42-alert.clear{border-color:#b9efc5}

      .hha-boss42-alert b{
        display:block;
        font-size:clamp(25px,5vw,36px);
        line-height:1.05;
        font-weight:1000;
        color:#1884cf;
      }

      .hha-boss42-alert small{
        display:block;
        margin-top:7px;
        color:#66879c;
        font-size:15px;
        font-weight:950;
        line-height:1.25;
      }

      @keyframes hhaBoss42Alert{
        0%{ transform:translate(-50%,-38%) scale(.82); opacity:0; }
        18%{ transform:translate(-50%,-50%) scale(1.04); opacity:1; }
        74%{ transform:translate(-50%,-50%) scale(1); opacity:1; }
        100%{ transform:translate(-50%,-62%) scale(.96); opacity:0; }
      }

      .hha-boss42-emergency-water{
        position:fixed;
        right:calc(16px + env(safe-area-inset-right,0px));
        bottom:calc(18px + env(safe-area-inset-bottom,0px));
        z-index:12000;
        width:min(280px,70vw);
        padding:12px 14px;
        border-radius:24px;
        background:rgba(255,255,255,.95);
        border:3px solid #74dcff;
        box-shadow:0 16px 42px rgba(30,75,115,.20);
        color:#24445c;
        font-weight:1000;
        pointer-events:none;
        opacity:0;
        transform:translateY(16px) scale(.94);
        transition:.2s ease;
      }

      .hha-boss42-emergency-water.show{
        opacity:1;
        transform:translateY(0) scale(1);
      }

      .hha-boss42-emergency-water b{
        display:block;
        font-size:18px;
        line-height:1.15;
      }

      .hha-boss42-emergency-water span{
        display:block;
        margin-top:4px;
        color:#66879c;
        font-size:13px;
        line-height:1.2;
      }

      body.hha-boss42-heatwave::before{
        content:'';
        position:fixed;
        inset:0;
        z-index:60;
        pointer-events:none;
        background:
          radial-gradient(circle at 50% 18%,rgba(255,210,90,.18),transparent 35%),
          linear-gradient(180deg,rgba(255,157,70,.08),transparent 55%);
        animation:hhaBoss42HeatPulse 1.2s ease-in-out infinite alternate;
      }

      @keyframes hhaBoss42HeatPulse{
        from{ opacity:.28; }
        to{ opacity:.72; }
      }

      body.hha-boss42-diamond .hha-solo-hud .hha-solo-pill.hot,
      body.hha-boss42-diamond .hha-solo-time{
        box-shadow:0 0 0 4px rgba(116,220,255,.25),0 16px 42px rgba(35,136,255,.24);
      }

      @media (max-width:520px){
        .hha-boss42-panel{
          top:calc(196px + env(safe-area-inset-top,0px));
          width:min(330px,76vw);
          padding:8px 10px;
          border-radius:20px;
        }

        .hha-boss42-head{font-size:13px; margin-bottom:5px}
        .hha-boss42-phase{font-size:10px; padding:3px 7px}
        .hha-boss42-sub{font-size:10.5px}
        .hha-boss42-bar{height:10px}

        .hha-boss42-alert{
          top:45%;
          padding:15px 17px;
          border-radius:26px;
        }

        .hha-boss42-alert small{font-size:13px}

        .hha-boss42-emergency-water{
          left:50%;
          right:auto;
          bottom:calc(12px + env(safe-area-inset-bottom,0px));
          transform:translate(-50%,16px) scale(.94);
          width:min(310px,86vw);
          padding:10px 12px;
        }

        .hha-boss42-emergency-water.show{
          transform:translate(-50%,0) scale(1);
        }
      }
    `;

    document.head.appendChild(style);
  }

  function vibrate(pattern){
    try{ if(navigator.vibrate) navigator.vibrate(pattern || 35); }
    catch(e){}
  }

  function screenFlash(type){
    try{
      var n = document.createElement('div');
      n.className = 'hha-solo-screen-flash ' + (type || 'fever');
      document.body.appendChild(n);
      setTimeout(function(){ try{ n.remove(); }catch(e){} }, 560);
    }catch(e){}
  }

  function alertPop(title, sub, type){
    try{
      var old = q('.hha-boss42-alert');
      if(old) old.remove();

      var n = document.createElement('div');
      n.className = 'hha-boss42-alert ' + (type || 'fever');
      n.innerHTML = '<b>' + esc(title || '') + '</b><small>' + esc(sub || '') + '</small>';
      document.body.appendChild(n);

      setTimeout(function(){ try{ n.remove(); }catch(e){} }, 1060);
    }catch(e){}
  }

  function ensurePanel(){
    var panel = q('.hha-boss42-panel');
    if(panel) return panel;

    panel = document.createElement('div');
    panel.className = 'hha-boss42-panel';
    panel.innerHTML = `
      <div class="hha-boss42-head">
        <div class="hha-boss42-title"><span>🌞</span><b>Heat Boss</b></div>
        <div class="hha-boss42-phase" id="hha-boss42-phase">Calm</div>
      </div>
      <div class="hha-boss42-bar"><div class="hha-boss42-fill" id="hha-boss42-fill"></div></div>
      <div class="hha-boss42-sub" id="hha-boss42-sub">เก็บน้ำดีและทำ Combo เพื่อลดพลังบอส</div>
    `;

    document.body.appendChild(panel);
    return panel;
  }

  function ensureEmergency(){
    var n = q('.hha-boss42-emergency-water');
    if(n) return n;

    n = document.createElement('div');
    n.className = 'hha-boss42-emergency-water';
    n.innerHTML = '<b>💧 Emergency Water!</b><span>Hydration ต่ำ รีบเก็บน้ำเปล่า/แตงโม/แตงกวา</span>';
    document.body.appendChild(n);
    return n;
  }

  var state = {
    started:false,
    panelVisible:false,
    bossHp:100,
    phase:'calm',
    lastCombo:0,
    lastHydration:100,
    lastFever:0,
    lastTime:0,
    lastScore:0,
    warnedHeat:false,
    warnedEmergency:false,
    warnedFever:false,
    diamond:false,
    missionCount:0
  };

  function updatePanel(phase, hp, sub){
    var panel = ensurePanel();
    var fill = q('#hha-boss42-fill');
    var phaseEl = q('#hha-boss42-phase');
    var subEl = q('#hha-boss42-sub');

    hp = clamp(hp, 0, 100);

    panel.classList.toggle('show', !!state.started);
    if(fill) fill.style.width = hp + '%';
    if(phaseEl) phaseEl.textContent = phase || 'Calm';
    if(subEl) subEl.textContent = sub || 'เก็บน้ำดีและทำ Combo เพื่อลดพลังบอส';
  }

  function inferBossHp(combo, hydration, fever, score){
    var hp = 100;
    hp -= Math.min(54, Math.floor(combo / 8) * 18);
    hp -= Math.min(20, Math.floor(score / 900) * 4);
    hp -= hydration >= 80 ? 10 : hydration >= 65 ? 6 : hydration >= 50 ? 2 : 0;
    hp -= fever >= 70 ? 8 : fever >= 40 ? 4 : 0;
    return clamp(hp, 0, 100);
  }

  function readHud(){
    return {
      hydration:readNumber('#hha-solo-hydration', 60),
      score:readNumber('#hha-solo-score', 0),
      combo:readNumber('#hha-solo-combo', 0),
      fever:readNumber('#hha-solo-fever', 0),
      time:readNumber('#hha-solo-time', 0),
      hasHud:!!q('.hha-solo-hud'),
      hasSummary:!!q('.hha-solo-summary')
    };
  }

  function setHeatWave(on){
    document.body.classList.toggle('hha-boss42-heatwave', !!on);
  }

  function setDiamond(on){
    document.body.classList.toggle('hha-boss42-diamond', !!on);
  }

  function watch(){
    setInterval(function(){
      try{
        var h = readHud();

        if(h.hasSummary){
          state.started = false;
          setHeatWave(false);
          setDiamond(false);
          updatePanel(state.phase, state.bossHp, 'สรุปผลรอบนี้แล้ว');
          return;
        }

        state.started = h.hasHud;
        if(!state.started){
          var panel = q('.hha-boss42-panel');
          if(panel) panel.classList.remove('show');
          return;
        }

        var hp = inferBossHp(h.combo, h.hydration, h.fever, h.score);
        state.bossHp = hp;

        var phase = 'Calm';
        var sub = 'เก็บน้ำดีและทำ Combo เพื่อลดพลังบอส';

        if(h.time > 0 && h.time <= 30){
          phase = 'Final Heat';
          sub = 'ช่วงท้าย! รักษา Hydration และคอมโบให้ดี';
          setHeatWave(true);
        }else if(h.hydration < 35){
          phase = 'Emergency';
          sub = 'Hydration ต่ำมาก รีบเก็บน้ำดี';
          setHeatWave(true);
        }else if(h.combo >= 16){
          phase = 'Boss Weak';
          sub = 'บอสอ่อนแรงแล้ว! ทำคอมโบต่อเนื่อง';
          setHeatWave(false);
        }else if(h.fever >= 70){
          phase = 'Fever Ready';
          sub = 'ใกล้ Fever แล้ว เก็บน้ำดีต่ออีกนิด';
          setHeatWave(false);
        }else if(h.time > 0 && h.time <= 90){
          phase = 'Heat Wave';
          sub = 'บอสเริ่มกดดัน อย่าให้ Hydration ตก';
          setHeatWave(h.hydration < 60);
        }else{
          setHeatWave(false);
        }

        updatePanel(phase, hp, sub);

        var emergency = ensureEmergency();
        emergency.classList.toggle('show', h.hydration > 0 && h.hydration < 35 && !h.hasSummary);

        if(h.time > 0 && h.time <= 90 && !state.warnedHeat){
          state.warnedHeat = true;
          alertPop('HEAT WAVE!', 'บอสเริ่มมาแล้ว รักษา Hydration ให้อยู่โซนเขียว', 'heat');
          screenFlash('bad');
          vibrate([35,35,35]);
        }

        if(h.hydration < 35 && !state.warnedEmergency){
          state.warnedEmergency = true;
          alertPop('EMERGENCY WATER!', 'Hydration ต่ำ รีบเก็บน้ำดี', 'danger');
          screenFlash('bad');
          vibrate([50,30,50]);
        }

        if(h.hydration >= 45){
          state.warnedEmergency = false;
        }

        if(h.fever >= 80 && !state.warnedFever){
          state.warnedFever = true;
          alertPop('FEVER READY!', 'เก็บน้ำดีต่อเนื่องเพื่อระเบิดคะแนน', 'fever');
          screenFlash('fever');
          vibrate([25,25,25]);
        }

        if(h.fever < 45){
          state.warnedFever = false;
        }

        if(h.combo > 0 && h.combo !== state.lastCombo){
          if(h.combo % 8 === 0){
            state.missionCount += 1;
            alertPop('MISSION CLEAR!', 'Combo ' + h.combo + ' • Heat Boss อ่อนแรง', 'clear');
            screenFlash('good');
            vibrate([25,30,25]);
          }

          if(h.combo >= 24 && !state.diamond){
            state.diamond = true;
            setDiamond(true);
            alertPop('DIAMOND FLOW!', 'คอมโบสูงมาก รักษาจังหวะนี้ไว้', 'fever');
            screenFlash('fever');
          }
        }

        if(h.combo < 8 && state.diamond){
          state.diamond = false;
          setDiamond(false);
        }

        if(hp <= 40 && state.phase !== 'weak'){
          state.phase = 'weak';
          alertPop('BOSS WEAK!', 'อีกนิดเดียว เก็บน้ำและทำ Combo ต่อ', 'clear');
          screenFlash('good');
        }

        if(hp <= 12 && state.phase !== 'nearWin'){
          state.phase = 'nearWin';
          alertPop('FINAL SPLASH!', 'Heat Boss ใกล้แพ้แล้ว!', 'fever');
          screenFlash('fever');
          vibrate([40,35,40]);
        }

        state.lastCombo = h.combo;
        state.lastHydration = h.hydration;
        state.lastFever = h.fever;
        state.lastTime = h.time;
        state.lastScore = h.score;
      }catch(e){}
    }, 350);
  }

  function boot(){
    injectStyle();
    ensurePanel();
    ensureEmergency();
    watch();
    console.info('[Hydration Solo Boss Pack42] loaded', VERSION, { view:currentView(), diff:currentDiff() });
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  }else{
    boot();
  }
})();
