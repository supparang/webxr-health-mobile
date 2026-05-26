/* =========================================================
   HeroHealth Groups cVR
   PATCH: v20260525-groups-cvr-vr-feeling-v6-comfort-sound
   File: /herohealth/patches/groups/groups-cvr-vr-feeling-v6-comfort-sound.js

   Purpose:
   - cVR comfort polish for Cardboard/mobile landscape
   - Fullscreen / orientation lock attempt after user gesture
   - Recenter helper
   - WebAudio SFX: lock, portal, correct, wrong, combo, end
   - Mute/unmute
   - Prevent accidental scroll/zoom
   - Visual/UX/audio only: does not change scoring logic
========================================================= */
(function(){
  'use strict';

  var PATCH_ID = 'v20260525-groups-cvr-vr-feeling-v6-comfort-sound';

  if (window.__HHA_GROUPS_CVR_VR_FEELING_V6_COMFORT_SOUND__) return;
  window.__HHA_GROUPS_CVR_VR_FEELING_V6_COMFORT_SOUND__ = true;

  function $(sel, root){
    return (root || document).querySelector(sel);
  }

  function $all(sel, root){
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }

  function textOf(el){
    return String(el && (el.innerText || el.textContent || '') || '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  var state = {
    audioReady:false,
    muted:false,
    overlayDone:false,
    lastToast:'',
    lastScore:0,
    lastCombo:0,
    lastCorrect:0,
    lastLives:'',
    lastGate:null,
    recenterY:0,
    lastTapAt:0
  };

  try {
    state.muted = localStorage.getItem('HHA_GROUPS_CVR_MUTED') === '1';
    state.overlayDone = localStorage.getItem('HHA_GROUPS_CVR_COMFORT_READY') === '1';
  } catch(e) {}

  var audioCtx = null;
  var masterGain = null;

  function addStyle(){
    if ($('#hha-groups-cvr-v6-comfort-sound-style')) return;

    var style = document.createElement('style');
    style.id = 'hha-groups-cvr-v6-comfort-sound-style';

    style.textContent = `
      html.hha-cvr-comfort,
      body.hha-cvr-comfort{
        width:100% !important;
        height:100% !important;
        overflow:hidden !important;
        overscroll-behavior:none !important;
        touch-action:none !important;
        user-select:none !important;
        -webkit-user-select:none !important;
        -webkit-touch-callout:none !important;
      }

      body.hha-cvr-comfort .game{
        transform:translateY(var(--hha-cvr-recenter-y, 0px)) !important;
        transition:transform .18s ease !important;
      }

      .hha-cvr-comfort-overlay{
        position:fixed;
        inset:0;
        z-index:1000000;
        display:grid;
        place-items:center;
        padding:
          calc(18px + env(safe-area-inset-top,0px))
          calc(18px + env(safe-area-inset-right,0px))
          calc(18px + env(safe-area-inset-bottom,0px))
          calc(18px + env(safe-area-inset-left,0px));
        background:
          radial-gradient(circle at 50% 35%, rgba(255,255,255,.86), rgba(223,247,255,.70) 48%, rgba(210,242,255,.86)),
          linear-gradient(135deg,#eaffff,#fff8dd);
        backdrop-filter:blur(10px);
      }

      .hha-cvr-comfort-overlay.hidden{
        display:none !important;
      }

      .hha-cvr-comfort-card{
        width:min(620px,94vw);
        border-radius:30px;
        background:rgba(255,255,255,.94);
        border:2px solid rgba(207,238,250,.98);
        box-shadow:0 24px 70px rgba(33,79,100,.22);
        padding:24px;
        text-align:center;
        color:#214f64;
      }

      .hha-cvr-comfort-icon{
        width:82px;
        height:82px;
        margin:0 auto 10px;
        border-radius:26px;
        display:grid;
        place-items:center;
        background:linear-gradient(135deg,#fff7b5,#ffd966);
        font-size:44px;
        box-shadow:0 16px 35px rgba(255,190,60,.22);
      }

      .hha-cvr-comfort-card h2{
        margin:0;
        font:1000 clamp(1.45rem,4vw,2.25rem)/1.05 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        letter-spacing:-.5px;
      }

      .hha-cvr-comfort-card p{
        margin:9px auto 0;
        max-width:520px;
        color:#6f8fa1;
        font:900 14px/1.45 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
      }

      .hha-cvr-comfort-steps{
        display:grid;
        grid-template-columns:repeat(3,minmax(0,1fr));
        gap:8px;
        margin:18px 0;
      }

      .hha-cvr-comfort-step{
        min-height:72px;
        border-radius:20px;
        border:1px solid rgba(207,238,250,.98);
        background:#fbfeff;
        padding:10px 8px;
        display:flex;
        flex-direction:column;
        justify-content:center;
        gap:4px;
        color:#214f64;
        font:1000 13px/1.15 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
      }

      .hha-cvr-comfort-step small{
        color:#6f8fa1;
        font-size:10px;
        font-weight:900;
      }

      .hha-cvr-comfort-actions{
        display:flex;
        justify-content:center;
        align-items:center;
        flex-wrap:wrap;
        gap:10px;
        margin-top:16px;
      }

      .hha-cvr-comfort-btn{
        min-height:48px;
        border:0;
        border-radius:999px;
        padding:12px 18px;
        font:1000 15px/1 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        cursor:pointer;
        box-shadow:0 14px 30px rgba(33,79,100,.14);
      }

      .hha-cvr-comfort-btn.primary{
        color:white;
        background:linear-gradient(135deg,#42a5ff,#7ed957);
      }

      .hha-cvr-comfort-btn.soft{
        color:#214f64;
        background:#effaff;
        border:1px solid rgba(207,238,250,.98);
      }

      .hha-cvr-toolbar{
        position:fixed;
        right:calc(10px + env(safe-area-inset-right,0px));
        bottom:calc(9px + env(safe-area-inset-bottom,0px));
        z-index:900;
        display:flex;
        align-items:center;
        gap:6px;
        opacity:.72;
        transition:.15s ease;
      }

      .hha-cvr-toolbar:hover,
      .hha-cvr-toolbar.active{
        opacity:.96;
      }

      body.summaryOpen .hha-cvr-toolbar{
        display:none !important;
      }

      .hha-cvr-toolbtn{
        height:32px;
        min-width:38px;
        padding:0 9px;
        border-radius:999px;
        border:1px solid rgba(207,238,250,.98);
        background:rgba(255,255,255,.88);
        color:#214f64;
        font:1000 11px/1 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        box-shadow:0 10px 22px rgba(33,79,100,.12);
        cursor:pointer;
      }

      .hha-cvr-toolbtn.on{
        color:#154225;
        background:linear-gradient(135deg,#edffe8,#ffffff);
        border-color:rgba(126,217,87,.75);
      }

      .hha-cvr-toolbtn.off{
        color:#8a4d00;
        background:linear-gradient(135deg,#fff7d6,#ffffff);
        border-color:rgba(255,217,102,.85);
      }

      .hha-cvr-toast-mini{
        position:fixed;
        left:50%;
        bottom:calc(48px + env(safe-area-inset-bottom,0px));
        transform:translateX(-50%) translateY(12px) scale(.92);
        z-index:901;
        max-width:min(520px,78vw);
        padding:8px 12px;
        border-radius:999px;
        background:rgba(33,79,100,.92);
        color:white;
        text-align:center;
        font:1000 12px/1.2 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        opacity:0;
        pointer-events:none;
        transition:.16s ease;
        box-shadow:0 16px 34px rgba(0,0,0,.18);
      }

      .hha-cvr-toast-mini.show{
        opacity:1;
        transform:translateX(-50%) translateY(0) scale(.92);
      }

      .hha-cvr-recenter-grid{
        position:fixed;
        left:50%;
        top:50%;
        width:190px;
        height:190px;
        transform:translate(-50%,-50%);
        z-index:246;
        pointer-events:none;
        border-radius:999px;
        opacity:0;
        transition:.18s ease;
        background:
          linear-gradient(90deg, transparent calc(50% - 1px), rgba(126,217,87,.45) calc(50% - 1px) calc(50% + 1px), transparent calc(50% + 1px)),
          linear-gradient(0deg, transparent calc(50% - 1px), rgba(126,217,87,.45) calc(50% - 1px) calc(50% + 1px), transparent calc(50% + 1px));
        border:2px solid rgba(126,217,87,.28);
        box-shadow:0 0 36px rgba(126,217,87,.20);
      }

      .hha-cvr-recenter-grid.show{
        opacity:.85;
      }

      @media (max-height:620px){
        .hha-cvr-comfort-card{
          padding:16px;
          border-radius:24px;
        }

        .hha-cvr-comfort-icon{
          width:58px;
          height:58px;
          border-radius:20px;
          font-size:32px;
          margin-bottom:7px;
        }

        .hha-cvr-comfort-card h2{
          font-size:1.35rem;
        }

        .hha-cvr-comfort-card p{
          font-size:11px;
          margin-top:6px;
        }

        .hha-cvr-comfort-steps{
          margin:10px 0;
          gap:6px;
        }

        .hha-cvr-comfort-step{
          min-height:52px;
          border-radius:16px;
          font-size:10px;
          padding:7px 6px;
        }

        .hha-cvr-comfort-step small{
          font-size:8px;
        }

        .hha-cvr-comfort-actions{
          margin-top:10px;
        }

        .hha-cvr-comfort-btn{
          min-height:40px;
          padding:9px 14px;
          font-size:12px;
        }

        .hha-cvr-toolbar{
          right:8px;
          bottom:6px;
          gap:4px;
          transform:scale(.88);
          transform-origin:right bottom;
        }

        .hha-cvr-toolbtn{
          height:28px;
          min-width:32px;
          padding:0 7px;
          font-size:9px;
        }

        .hha-cvr-recenter-grid{
          width:148px;
          height:148px;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function initAudio(){
    if (state.audioReady && audioCtx) return true;

    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;

      audioCtx = audioCtx || new AC();

      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }

      masterGain = masterGain || audioCtx.createGain();
      masterGain.gain.value = state.muted ? 0 : 0.18;
      masterGain.connect(audioCtx.destination);

      state.audioReady = true;
      return true;
    } catch(e) {
      return false;
    }
  }

  function setMuted(muted){
    state.muted = !!muted;

    try {
      localStorage.setItem('HHA_GROUPS_CVR_MUTED', state.muted ? '1' : '0');
    } catch(e) {}

    if (masterGain) {
      masterGain.gain.value = state.muted ? 0 : 0.18;
    }

    updateToolbar();
  }

  function tone(freq, duration, type, gain, startOffset){
    if (!initAudio() || state.muted || !audioCtx || !masterGain) return;

    var t0 = audioCtx.currentTime + (startOffset || 0);
    var osc = audioCtx.createOscillator();
    var g = audioCtx.createGain();

    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain || 0.08, t0 + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);

    osc.connect(g);
    g.connect(masterGain);

    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  function noise(duration, gain){
    if (!initAudio() || state.muted || !audioCtx || !masterGain) return;

    var bufferSize = Math.max(1, Math.floor(audioCtx.sampleRate * duration));
    var buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    var data = buffer.getChannelData(0);

    for (var i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 1.6);
    }

    var src = audioCtx.createBufferSource();
    var g = audioCtx.createGain();
    var t0 = audioCtx.currentTime;

    src.buffer = buffer;
    g.gain.setValueAtTime(gain || 0.05, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);

    src.connect(g);
    g.connect(masterGain);

    src.start(t0);
    src.stop(t0 + duration + 0.02);
  }

  function sfx(name){
    if (state.muted) return;

    if (name === 'boot') {
      tone(523, .10, 'sine', .07, 0);
      tone(659, .12, 'sine', .06, .08);
      tone(784, .16, 'sine', .05, .17);
    }

    if (name === 'lock') {
      tone(660, .08, 'triangle', .07, 0);
      tone(990, .10, 'triangle', .05, .07);
    }

    if (name === 'portal') {
      tone(392, .08, 'sine', .05, 0);
      tone(784, .11, 'sine', .06, .06);
      tone(1175, .12, 'triangle', .04, .15);
    }

    if (name === 'correct') {
      tone(523, .08, 'triangle', .08, 0);
      tone(659, .08, 'triangle', .08, .07);
      tone(880, .13, 'triangle', .07, .14);
    }

    if (name === 'wrong') {
      tone(220, .12, 'sawtooth', .055, 0);
      tone(155, .17, 'sawtooth', .045, .10);
      noise(.12, .025);
    }

    if (name === 'combo') {
      tone(880, .06, 'square', .04, 0);
      tone(1175, .07, 'square', .035, .06);
      tone(1568, .10, 'triangle', .03, .12);
    }

    if (name === 'end') {
      tone(392, .12, 'sine', .06, 0);
      tone(523, .16, 'sine', .055, .12);
      tone(659, .22, 'sine', .05, .26);
    }

    if (name === 'recenter') {
      tone(440, .08, 'sine', .05, 0);
      tone(880, .10, 'sine', .04, .08);
    }
  }

  function vibrate(pattern){
    try {
      if (navigator.vibrate) navigator.vibrate(pattern || 18);
    } catch(e) {}
  }

  function miniToast(msg){
    var box = $('.hha-cvr-toast-mini');

    if (!box) {
      box = document.createElement('div');
      box.className = 'hha-cvr-toast-mini';
      document.body.appendChild(box);
    }

    box.textContent = String(msg || '');
    box.classList.add('show');

    clearTimeout(window.__HHA_CVR_MINI_TOAST_TIMER__);
    window.__HHA_CVR_MINI_TOAST_TIMER__ = setTimeout(function(){
      box.classList.remove('show');
    }, 1200);
  }

  function requestFullscreen(){
    var el = document.documentElement;

    try {
      if (!document.fullscreenElement && el.requestFullscreen) {
        el.requestFullscreen({ navigationUI:'hide' }).catch(function(){});
      } else if (!document.webkitFullscreenElement && el.webkitRequestFullscreen) {
        el.webkitRequestFullscreen();
      }
    } catch(e) {}
  }

  function lockLandscape(){
    try {
      if (screen.orientation && screen.orientation.lock) {
        screen.orientation.lock('landscape').catch(function(){});
      }
    } catch(e) {}
  }

  function hideAddressBar(){
    try {
      window.scrollTo(0, 1);
      setTimeout(function(){ window.scrollTo(0, 1); }, 120);
      setTimeout(function(){ window.scrollTo(0, 1); }, 500);
    } catch(e) {}
  }

  function enterComfortMode(){
    initAudio();
    requestFullscreen();
    lockLandscape();
    hideAddressBar();

    try {
      localStorage.setItem('HHA_GROUPS_CVR_COMFORT_READY', '1');
    } catch(e) {}

    state.overlayDone = true;

    var overlay = $('.hha-cvr-comfort-overlay');
    if (overlay) overlay.classList.add('hidden');

    document.body.classList.add('hha-cvr-comfort-ready');

    sfx('boot');
    vibrate([18, 20, 18]);
    miniToast('cVR พร้อมแล้ว • แตะเพื่อ LOCK → รอ Portal → แตะส่ง');
  }

  function ensureOverlay(){
    if ($('.hha-cvr-comfort-overlay')) return;

    var overlay = document.createElement('div');
    overlay.className = 'hha-cvr-comfort-overlay' + (state.overlayDone ? ' hidden' : '');

    overlay.innerHTML = `
      <div class="hha-cvr-comfort-card">
        <div class="hha-cvr-comfort-icon">🥽</div>
        <h2>เริ่ม Cardboard cVR</h2>
        <p>หมุนมือถือเป็นแนวนอน ใส่ Cardboard แล้วแตะปุ่มเริ่ม ระบบจะพยายามเปิดเต็มจอ เปิดเสียง และล็อกแนวนอนให้</p>

        <div class="hha-cvr-comfort-steps">
          <div class="hha-cvr-comfort-step">1) LOCK อาหาร<small>เล็งกลางจอแล้วแตะ</small></div>
          <div class="hha-cvr-comfort-step">2) รอ Portal<small>ดูหมู่ที่ถูก</small></div>
          <div class="hha-cvr-comfort-step">3) แตะส่ง<small>ตอน Portal สว่าง</small></div>
        </div>

        <div class="hha-cvr-comfort-actions">
          <button class="hha-cvr-comfort-btn primary" type="button" data-hha-cvr-enter>เริ่ม cVR เต็มจอ</button>
          <button class="hha-cvr-comfort-btn soft" type="button" data-hha-cvr-skip>เล่นต่อแบบไม่เต็มจอ</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    var enter = overlay.querySelector('[data-hha-cvr-enter]');
    var skip = overlay.querySelector('[data-hha-cvr-skip]');

    if (enter) {
      enter.addEventListener('click', function(ev){
        ev.preventDefault();
        ev.stopPropagation();
        if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();
        enterComfortMode();
        return false;
      }, true);
    }

    if (skip) {
      skip.addEventListener('click', function(ev){
        ev.preventDefault();
        ev.stopPropagation();
        if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();

        initAudio();

        try {
          localStorage.setItem('HHA_GROUPS_CVR_COMFORT_READY', '1');
        } catch(e) {}

        state.overlayDone = true;
        overlay.classList.add('hidden');
        miniToast('เล่นต่อได้ • แตะเพื่อ LOCK → รอ Portal → แตะส่ง');
        return false;
      }, true);
    }
  }

  function ensureToolbar(){
    if ($('.hha-cvr-toolbar')) return;

    var toolbar = document.createElement('div');
    toolbar.className = 'hha-cvr-toolbar';

    toolbar.innerHTML = `
      <button class="hha-cvr-toolbtn" type="button" data-hha-cvr-full>เต็มจอ</button>
      <button class="hha-cvr-toolbtn" type="button" data-hha-cvr-recenter>Recenter</button>
      <button class="hha-cvr-toolbtn" type="button" data-hha-cvr-sound>เสียง</button>
    `;

    document.body.appendChild(toolbar);

    var full = toolbar.querySelector('[data-hha-cvr-full]');
    var recenter = toolbar.querySelector('[data-hha-cvr-recenter]');
    var sound = toolbar.querySelector('[data-hha-cvr-sound]');

    if (full) {
      full.addEventListener('click', function(ev){
        ev.preventDefault();
        ev.stopPropagation();
        if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();

        initAudio();
        requestFullscreen();
        lockLandscape();
        hideAddressBar();
        sfx('boot');
        vibrate(18);
        miniToast('เปิดเต็มจอแล้ว');
        toolbar.classList.add('active');
        setTimeout(function(){ toolbar.classList.remove('active'); }, 900);
        return false;
      }, true);
    }

    if (recenter) {
      recenter.addEventListener('click', function(ev){
        ev.preventDefault();
        ev.stopPropagation();
        if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();

        doRecenter();
        return false;
      }, true);
    }

    if (sound) {
      sound.addEventListener('click', function(ev){
        ev.preventDefault();
        ev.stopPropagation();
        if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();

        initAudio();
        setMuted(!state.muted);
        sfx(state.muted ? 'wrong' : 'boot');
        miniToast(state.muted ? 'ปิดเสียงแล้ว' : 'เปิดเสียงแล้ว');
        return false;
      }, true);
    }

    updateToolbar();
  }

  function updateToolbar(){
    var sound = $('[data-hha-cvr-sound]');
    if (sound) {
      sound.textContent = state.muted ? '🔇' : '🔊';
      sound.classList.toggle('off', state.muted);
      sound.classList.toggle('on', !state.muted);
    }
  }

  function ensureRecenterGrid(){
    if ($('.hha-cvr-recenter-grid')) return;

    var grid = document.createElement('div');
    grid.className = 'hha-cvr-recenter-grid';
    document.body.appendChild(grid);
  }

  function doRecenter(){
    document.documentElement.style.setProperty('--hha-cvr-recenter-y', '0px');
    document.body.style.setProperty('--hha-cvr-recenter-y', '0px');

    var grid = $('.hha-cvr-recenter-grid');
    if (grid) {
      grid.classList.add('show');
      setTimeout(function(){ grid.classList.remove('show'); }, 850);
    }

    hideAddressBar();
    sfx('recenter');
    vibrate([18, 12, 18]);
    miniToast('Recenter แล้ว • วาง crosshair กลางจอ');
  }

  function parseNumber(el){
    var n = Number(textOf(el).replace(/[^\d.-]/g,''));
    return isFinite(n) ? n : 0;
  }

  function bindGameSfx(){
    if (document.__hhaGroupsCvrComfortSfxBound) return;
    document.__hhaGroupsCvrComfortSfxBound = true;

    document.addEventListener('pointerdown', function(ev){
      if ($('.hha-cvr-comfort-overlay:not(.hidden)')) return;
      if (document.body.classList.contains('summaryOpen')) return;

      state.lastTapAt = Date.now();
      initAudio();
      sfx('lock');
    }, true);

    document.addEventListener('click', function(){
      if ($('.hha-cvr-comfort-overlay:not(.hidden)')) return;
      if (document.body.classList.contains('summaryOpen')) return;

      setTimeout(function(){
        sfx('portal');
      }, 65);
    }, true);

    var mo = new MutationObserver(function(){
      clearTimeout(window.__HHA_CVR_COMFORT_SFX_SCAN__);
      window.__HHA_CVR_COMFORT_SFX_SCAN__ = setTimeout(scanForSfx, 60);
    });

    mo.observe(document.body, {
      childList:true,
      subtree:true,
      characterData:true,
      attributes:true,
      attributeFilter:['class','style']
    });

    setInterval(scanForSfx, 500);
  }

  function scanForSfx(){
    if (!state.audioReady && !audioCtx) return;

    var toast = textOf($('#toast'));
    var score = parseNumber($('#score'));
    var combo = parseNumber($('#combo'));
    var acc = textOf($('#accuracy'));
    var lives = textOf($('#lives'));
    var correctText = textOf($('#sumCorrect'));
    var activeGate = $('.gate.active');
    var gateNo = activeGate && (activeGate.dataset && activeGate.dataset.gate || textOf(activeGate).match(/[1-5]/)?.[0]);

    if (toast && toast !== state.lastToast) {
      if (toast.indexOf('ถูกต้อง') >= 0 || toast.indexOf('Mission Clear') >= 0) {
        sfx('correct');
        vibrate([18, 18, 22]);
      } else if (toast.indexOf('ยังไม่ใช่') >= 0 || toast.indexOf('ต้องเข้า') >= 0 || toast.indexOf('หมด') >= 0) {
        sfx('wrong');
        vibrate([32, 18, 32]);
      } else if (toast.indexOf('LOCK') >= 0 || toast.indexOf('เลือก') >= 0) {
        sfx('lock');
      }

      state.lastToast = toast;
    }

    if (score > state.lastScore && state.lastScore > 0) {
      sfx('correct');
    }

    if (combo > state.lastCombo && combo > 1) {
      if (combo % 3 === 0 || combo >= 5) {
        sfx('combo');
        vibrate(24);
      }
    }

    if (lives && state.lastLives && lives.length < state.lastLives.length) {
      sfx('wrong');
      vibrate([35, 18, 35]);
    }

    if (document.body.classList.contains('summaryOpen') && !state.summarySoundPlayed) {
      state.summarySoundPlayed = true;
      sfx('end');
      vibrate([20, 20, 28]);
    }

    if (gateNo && gateNo !== state.lastGate) {
      if (Date.now() - state.lastTapAt > 280) {
        tone(330 + Number(gateNo) * 55, .035, 'sine', .018, 0);
      }
      state.lastGate = gateNo;
    }

    state.lastScore = score;
    state.lastCombo = combo;
    state.lastLives = lives;
    state.lastCorrect = correctText;
  }

  function preventAccidentalGestures(){
    if (document.__hhaGroupsCvrPreventGestureV6) return;
    document.__hhaGroupsCvrPreventGestureV6 = true;

    ['gesturestart','gesturechange','gestureend'].forEach(function(evt){
      document.addEventListener(evt, function(e){
        e.preventDefault();
      }, { passive:false });
    });

    document.addEventListener('dblclick', function(e){
      if (!document.body.classList.contains('summaryOpen')) {
        e.preventDefault();
      }
    }, { passive:false });

    document.addEventListener('touchmove', function(e){
      if (!document.body.classList.contains('summaryOpen')) {
        e.preventDefault();
      }
    }, { passive:false });
  }

  function mark(){
    document.documentElement.classList.add('hha-cvr-comfort');
    document.body.classList.add('hha-cvr-comfort');

    if (state.overlayDone) {
      document.body.classList.add('hha-cvr-comfort-ready');
    }
  }

  function scan(){
    mark();
    ensureOverlay();
    ensureToolbar();
    ensureRecenterGrid();
    updateToolbar();
  }

  function bind(){
    preventAccidentalGestures();
    bindGameSfx();

    window.addEventListener('resize', function(){
      setTimeout(hideAddressBar, 120);
      setTimeout(scan, 180);
    }, { passive:true });

    window.addEventListener('orientationchange', function(){
      setTimeout(hideAddressBar, 280);
      setTimeout(scan, 420);
    }, { passive:true });

    document.addEventListener('visibilitychange', function(){
      if (!document.hidden && audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume().catch(function(){});
      }
    });
  }

  function boot(){
    addStyle();
    bind();
    scan();

    [120,300,700,1300,2400,4200].forEach(function(ms){
      setTimeout(scan, ms);
    });

    console.info('[HeroHealth Groups cVR]', PATCH_ID, 'ready', {
      muted: state.muted,
      overlayDone: state.overlayDone
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  } else {
    boot();
  }

})();
