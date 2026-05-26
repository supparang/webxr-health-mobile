/* =========================================================
   HeroHealth Hydration Solo SFX / Mobile Game Feel Patch
   File: /herohealth/hydration-vr/hydration-solo-sfx-pack44.patch.js
   Version: v20260526-pack44-sfx-mobile-feel

   Purpose:
   - Add lightweight WebAudio SFX + vibration feedback
   - No external audio files needed
   - Safe add-on after Hydration Solo Clean Core + Pack41 + Pack42 + Pack43
   - Does NOT depend on old hydration-vr.js
   ========================================================= */

(function(){
  'use strict';

  var VERSION = 'v20260526-pack44-sfx-mobile-feel';

  if(window.HHA_HYDRATION_SOLO_SFX_PACK44){
    console.warn('[Hydration Solo SFX Pack44] already loaded');
    return;
  }

  window.HHA_HYDRATION_SOLO_SFX_PACK44 = true;

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

  function readNumber(sel, fallback){
    var el = q(sel);
    if(!el) return fallback;
    var raw = String(el.textContent || '').replace(/[^0-9.-]/g,'');
    var n = Number(raw);
    return Number.isFinite(n) ? n : fallback;
  }

  function currentView(){
    var ctx = window.HHA_HYDRATION_RUN_CONTEXT || {};
    return String(ctx.view || document.body.dataset.view || 'mobile').toLowerCase();
  }

  function now(){ return Date.now(); }

  var STORE_KEY = 'HHA_HYDRATION_SFX_MUTED';
  var VOL_KEY = 'HHA_HYDRATION_SFX_VOL';

  var sfx = {
    ctx:null,
    master:null,
    ready:false,
    muted:localStorage.getItem(STORE_KEY) === '1',
    volume:clamp(Number(localStorage.getItem(VOL_KEY) || 0.34), 0.05, 0.70),
    last:{},
    started:false,
    lastCombo:0,
    lastFever:0,
    lastScore:0,
    lastHydration:0,
    summaryPlayed:false
  };

  function injectStyle(){
    if(q('#hha-hydration-solo-sfx-pack44-css')) return;

    var style = document.createElement('style');
    style.id = 'hha-hydration-solo-sfx-pack44-css';
    style.textContent = `
      .hha-sfx44-toggle{
        position:fixed;
        right:calc(12px + env(safe-area-inset-right,0px));
        bottom:calc(12px + env(safe-area-inset-bottom,0px));
        z-index:14000;
        width:54px;
        height:54px;
        border:0;
        border-radius:19px;
        display:grid;
        place-items:center;
        background:rgba(255,255,255,.95);
        box-shadow:0 12px 32px rgba(30,75,115,.20);
        color:#24445c;
        font-size:24px;
        font-weight:1000;
        cursor:pointer;
        touch-action:manipulation;
      }

      .hha-sfx44-toggle.muted{
        opacity:.72;
        filter:grayscale(.45);
      }

      .hha-sfx44-toast{
        position:fixed;
        right:calc(76px + env(safe-area-inset-right,0px));
        bottom:calc(18px + env(safe-area-inset-bottom,0px));
        z-index:14001;
        padding:8px 12px;
        border-radius:999px;
        background:rgba(255,255,255,.94);
        color:#24445c;
        border:2px solid #d7f3ff;
        box-shadow:0 12px 30px rgba(30,75,115,.14);
        font-weight:1000;
        opacity:0;
        transform:translateY(8px);
        pointer-events:none;
        transition:.18s ease;
      }

      .hha-sfx44-toast.show{
        opacity:1;
        transform:translateY(0);
      }

      body.hha-sfx44-water-pulse .hha-solo-hud .hha-solo-pill.hot{
        animation:hhaSfx44Pulse .34s ease-out both;
      }

      body.hha-sfx44-hit-pulse .hha-solo-time,
      body.hha-sfx44-hit-pulse .hha-solo-hud .hha-solo-pill{
        animation:hhaSfx44Pulse .28s ease-out both;
      }

      @keyframes hhaSfx44Pulse{
        0%{ transform:scale(1); }
        40%{ transform:scale(1.045); }
        100%{ transform:scale(1); }
      }

      @media (max-width:520px){
        .hha-sfx44-toggle{
          width:48px;
          height:48px;
          border-radius:16px;
          font-size:21px;
          bottom:calc(8px + env(safe-area-inset-bottom,0px));
          right:calc(8px + env(safe-area-inset-right,0px));
        }

        .hha-sfx44-toast{
          right:calc(62px + env(safe-area-inset-right,0px));
          bottom:calc(12px + env(safe-area-inset-bottom,0px));
          font-size:12px;
          padding:7px 10px;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function showSfxToast(text){
    try{
      var t = q('.hha-sfx44-toast');
      if(!t){
        t = document.createElement('div');
        t.className = 'hha-sfx44-toast';
        document.body.appendChild(t);
      }

      t.textContent = text;
      t.classList.add('show');
      clearTimeout(t._timer);
      t._timer = setTimeout(function(){
        t.classList.remove('show');
      }, 1100);
    }catch(e){}
  }

  function ensureToggle(){
    var btn = q('.hha-sfx44-toggle');
    if(btn) return btn;

    btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'hha-sfx44-toggle';
    btn.setAttribute('aria-label','Toggle sound');
    btn.innerHTML = sfx.muted ? '🔇' : '🔊';
    btn.classList.toggle('muted', sfx.muted);

    btn.addEventListener('click', function(ev){
      try{ ev.preventDefault(); ev.stopPropagation(); }catch(e){}
      unlockAudio();
      sfx.muted = !sfx.muted;
      try{ localStorage.setItem(STORE_KEY, sfx.muted ? '1' : '0'); }catch(e){}
      btn.innerHTML = sfx.muted ? '🔇' : '🔊';
      btn.classList.toggle('muted', sfx.muted);
      showSfxToast(sfx.muted ? 'ปิดเสียงเกม' : 'เปิดเสียงเกม');
      if(!sfx.muted) play('tap');
    }, true);

    document.body.appendChild(btn);
    return btn;
  }

  function audioContext(){
    if(sfx.ctx) return sfx.ctx;

    var AC = window.AudioContext || window.webkitAudioContext;
    if(!AC) return null;

    try{
      sfx.ctx = new AC();
      sfx.master = sfx.ctx.createGain();
      sfx.master.gain.value = sfx.volume;
      sfx.master.connect(sfx.ctx.destination);
      return sfx.ctx;
    }catch(e){
      return null;
    }
  }

  function unlockAudio(){
    var ctx = audioContext();
    if(!ctx) return;

    try{
      if(ctx.state === 'suspended'){
        ctx.resume().catch(function(){});
      }
      sfx.ready = true;
    }catch(e){}
  }

  function throttle(name, ms){
    var t = now();
    var last = sfx.last[name] || 0;
    if(t - last < ms) return false;
    sfx.last[name] = t;
    return true;
  }

  function vibrate(pattern){
    try{
      if(navigator.vibrate){
        navigator.vibrate(pattern || 25);
      }
    }catch(e){}
  }

  function pulseBody(cls, ms){
    try{
      document.body.classList.remove(cls);
      void document.body.offsetWidth;
      document.body.classList.add(cls);
      setTimeout(function(){
        document.body.classList.remove(cls);
      }, ms || 360);
    }catch(e){}
  }

  function tone(freq, start, dur, gain, type){
    var ctx = audioContext();
    if(!ctx || !sfx.master || sfx.muted) return;

    try{
      var osc = ctx.createOscillator();
      var g = ctx.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, start);
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), start + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
      osc.connect(g);
      g.connect(sfx.master);
      osc.start(start);
      osc.stop(start + dur + 0.025);
    }catch(e){}
  }

  function noise(start, dur, gain, filterFreq){
    var ctx = audioContext();
    if(!ctx || !sfx.master || sfx.muted) return;

    try{
      var length = Math.max(1, Math.floor(ctx.sampleRate * dur));
      var buffer = ctx.createBuffer(1, length, ctx.sampleRate);
      var data = buffer.getChannelData(0);

      for(var i=0; i<length; i++){
        data[i] = (Math.random() * 2 - 1) * (1 - i / length);
      }

      var src = ctx.createBufferSource();
      var g = ctx.createGain();
      var filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(filterFreq || 900, start);
      g.gain.setValueAtTime(gain, start);
      g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
      src.buffer = buffer;
      src.connect(filter);
      filter.connect(g);
      g.connect(sfx.master);
      src.start(start);
      src.stop(start + dur + 0.02);
    }catch(e){}
  }

  function play(name){
    unlockAudio();
    if(sfx.muted) return;

    var ctx = audioContext();
    if(!ctx) return;

    var t = ctx.currentTime + 0.004;

    try{
      if(name === 'tap'){
        if(!throttle('tap', 80)) return;
        tone(520, t, 0.045, 0.08, 'triangle');
        return;
      }

      if(name === 'water'){
        if(!throttle('water', 95)) return;
        tone(620, t, 0.065, 0.10, 'sine');
        tone(880, t + 0.042, 0.075, 0.085, 'sine');
        noise(t, 0.075, 0.040, 1500);
        pulseBody('hha-sfx44-water-pulse', 340);
        vibrate(20);
        return;
      }

      if(name === 'bad'){
        if(!throttle('bad', 120)) return;
        tone(210, t, 0.11, 0.10, 'sawtooth');
        tone(155, t + 0.06, 0.13, 0.075, 'square');
        noise(t, 0.10, 0.048, 650);
        pulseBody('hha-sfx44-hit-pulse', 300);
        vibrate(55);
        return;
      }

      if(name === 'shield'){
        if(!throttle('shield', 180)) return;
        tone(740, t, 0.075, 0.10, 'triangle');
        tone(1100, t + 0.055, 0.10, 0.08, 'sine');
        noise(t + 0.02, 0.08, 0.035, 2400);
        vibrate([24,24,24]);
        return;
      }

      if(name === 'combo'){
        if(!throttle('combo', 260)) return;
        tone(660, t, 0.055, 0.075, 'triangle');
        tone(820, t + 0.045, 0.055, 0.070, 'triangle');
        tone(1040, t + 0.09, 0.075, 0.065, 'sine');
        vibrate([18,22,18]);
        return;
      }

      if(name === 'mission'){
        if(!throttle('mission', 700)) return;
        tone(520, t, 0.08, 0.09, 'triangle');
        tone(720, t + 0.08, 0.08, 0.09, 'triangle');
        tone(980, t + 0.16, 0.16, 0.075, 'sine');
        noise(t + 0.12, 0.12, 0.035, 2200);
        vibrate([28,35,28]);
        return;
      }

      if(name === 'fever'){
        if(!throttle('fever', 900)) return;
        tone(740, t, 0.08, 0.10, 'triangle');
        tone(940, t + 0.07, 0.08, 0.095, 'triangle');
        tone(1180, t + 0.14, 0.12, 0.085, 'sine');
        tone(1480, t + 0.25, 0.18, 0.065, 'sine');
        noise(t + 0.05, 0.18, 0.040, 2600);
        vibrate([30,40,30,40,30]);
        return;
      }

      if(name === 'boss'){
        if(!throttle('boss', 950)) return;
        tone(180, t, 0.14, 0.09, 'sawtooth');
        tone(140, t + 0.11, 0.18, 0.080, 'sawtooth');
        noise(t, 0.22, 0.055, 500);
        vibrate([55,40,55]);
        return;
      }

      if(name === 'summary'){
        if(!throttle('summary', 1200)) return;
        tone(520, t, 0.08, 0.080, 'triangle');
        tone(660, t + 0.10, 0.08, 0.075, 'triangle');
        tone(880, t + 0.20, 0.13, 0.070, 'sine');
        vibrate([25,30,25]);
        return;
      }
    }catch(e){}
  }

  function targetFromEvent(ev){
    try{
      if(!ev || !ev.target || !ev.target.closest) return null;
      var t = ev.target.closest('.hha-solo-target, .hha-hydration-target');
      if(!t || !t.isConnected) return null;
      if(ev.target.closest('.hha-solo-summary, .hha-solo-start, .hha-solo-controls, .hha-sfx44-toggle')) return null;
      return t;
    }catch(e){
      return null;
    }
  }

  function playTargetSound(t){
    if(!t || !t.isConnected) return;

    var last = Number(t.dataset.hhaPack44SfxAt || 0);
    if(now() - last < 250) return;
    t.dataset.hhaPack44SfxAt = String(now());

    var good = t.dataset.good === '1';
    var shield = Number(t.dataset.shield || 0) > 0 || /shield|ice|น้ำแข็ง/i.test(t.textContent || '');

    if(good && shield) play('shield');
    else if(good) play('water');
    else play('bad');
  }

  function bindUnlock(){
    ['pointerdown','touchstart','mousedown','keydown','click'].forEach(function(evt){
      document.addEventListener(evt, unlockAudio, { capture:true, passive:true });
    });
  }

  function bindTargetSfx(){
    ['pointerdown','touchstart','mousedown'].forEach(function(evt){
      document.addEventListener(evt, function(ev){
        var t = targetFromEvent(ev);
        if(t) playTargetSound(t);
      }, { capture:true, passive:true });
    });

    window.addEventListener('hha:shoot', function(){
      try{
        var cx = (window.innerWidth || 0) / 2;
        var cy = (window.innerHeight || 0) / 2;
        var best = null;
        var bestD = Infinity;

        qa('.hha-solo-target, .hha-hydration-target').forEach(function(t){
          var r = t.getBoundingClientRect();
          if(r.width <= 0 || r.height <= 0) return;
          var tx = r.left + r.width / 2;
          var ty = r.top + r.height / 2;
          var d = Math.hypot(tx - cx, ty - cy);
          if(cx >= r.left - 52 && cx <= r.right + 52 && cy >= r.top - 52 && cy <= r.bottom + 52 && d < bestD){
            best = t;
            bestD = d;
          }
        });

        if(best) playTargetSound(best);
        else play('tap');
      }catch(e){}
    }, true);
  }

  function watchHudAndBanner(){
    setInterval(function(){
      try{
        var combo = readNumber('#hha-solo-combo', 0);
        var fever = readNumber('#hha-solo-fever', 0);
        var score = readNumber('#hha-solo-score', 0);
        var hydration = readNumber('#hha-solo-hydration', 0);
        var hasSummary = !!q('.hha-solo-summary');

        if(hasSummary && !sfx.summaryPlayed){
          sfx.summaryPlayed = true;
          play('summary');
        }

        if(combo > 0 && combo !== sfx.lastCombo){
          if(combo % 8 === 0) play('mission');
          else if(combo >= 5 && combo % 5 === 0) play('combo');
          sfx.lastCombo = combo;
        }

        if(fever >= 90 && sfx.lastFever < 90){
          play('fever');
        }

        if(hydration < 35 && sfx.lastHydration >= 35){
          play('boss');
        }

        if(score > sfx.lastScore + 500 && combo >= 8){
          play('combo');
        }

        sfx.lastFever = fever;
        sfx.lastScore = score;
        sfx.lastHydration = hydration;
      }catch(e){}
    }, 320);

    var lastBanner = '';
    setInterval(function(){
      try{
        var b = q('.hha-solo-banner.show, .hha-boss42-alert, .hha-balance43-tip.show');
        if(!b) return;

        var txt = String(b.textContent || '').trim();
        if(!txt || txt === lastBanner) return;
        lastBanner = txt;

        if(/HEAT|Heat|Boss|บอส|Emergency/i.test(txt)) play('boss');
        else if(/Fever|FEVER|Diamond|Splash/i.test(txt)) play('fever');
        else if(/Mission|Combo|สำเร็จ/i.test(txt)) play('mission');
      }catch(e){}
    }, 280);
  }

  function boot(){
    injectStyle();
    ensureToggle();
    bindUnlock();
    bindTargetSfx();
    watchHudAndBanner();

    console.info('[Hydration Solo SFX Pack44] loaded', VERSION, { view:currentView(), muted:sfx.muted, volume:sfx.volume });
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  }else{
    boot();
  }
})();
