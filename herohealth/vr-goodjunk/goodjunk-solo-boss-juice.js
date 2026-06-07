// === /herohealth/vr-goodjunk/goodjunk-solo-boss-juice.js ===
// FULL PATCH v20260606-GOODJUNK-SOLO-BOSS-JUICE-SAFE-VIBRATION-V8403F
// Purpose:
// - เพิ่มความรู้สึกสนุก เร้าใจ: toast, screen shake, hit spark, combo flash, boss punch feedback
// - แก้ Intervention: navigator.vibrate ถูก block เพราะเรียกก่อน user gesture
// - vibrate/audio จะทำงานเฉพาะหลังผู้เล่นแตะ/คลิก/กดปุ่มแล้วเท่านั้น
// - ไม่บังคับจบเกม ไม่เปิด summary เอง ไม่ยุ่งกับ win gate / summary restore
// - ใช้ได้กับ goodjunk-solo-boss.html และ goodjunk-solo-boss-pc.html

(function(){
  'use strict';

  if(window.GJ_SOLO_BOSS_JUICE_V8403F_LOADED){
    console.log('[GJ Juice] already loaded');
    return;
  }

  window.GJ_SOLO_BOSS_JUICE_V8403F_LOADED = true;

  const PATCH = 'v20260606-GOODJUNK-SOLO-BOSS-JUICE-SAFE-VIBRATION-V8403F';

  const state = {
    gestureUnlocked:false,
    audioUnlocked:false,
    audioCtx:null,
    muted:false,

    lastToastAt:0,
    lastShakeAt:0,
    lastSparkAt:0,
    lastComboFlashAt:0,
    lastVibrateAt:0,
    lastSoundAt:0,

    combo:0,
    maxCombo:0,
    goodHits:0,
    junkHits:0,
    fakeHits:0,
    score:0,

    installedAt:Date.now()
  };

  const CFG = {
    toastMinGap:220,
    shakeMinGap:180,
    sparkMinGap:60,
    comboFlashMinGap:260,
    vibrateMinGap:260,
    soundMinGap:90
  };

  function now(){
    return Date.now();
  }

  function qs(){
    return new URLSearchParams(location.search || '');
  }

  function boolParam(name, fallback){
    const q = qs();
    const v = String(q.get(name) || '').toLowerCase();

    if(v === '1' || v === 'true' || v === 'yes' || v === 'on') return true;
    if(v === '0' || v === 'false' || v === 'no' || v === 'off') return false;

    return !!fallback;
  }

  function viewMode(){
    const q = qs();
    return String(q.get('view') || q.get('device') || 'mobile').toLowerCase();
  }

  function isMobileish(){
    const v = viewMode();
    return v === 'mobile' || v === 'phone' || v === 'touch';
  }

  function safeText(v){
    return String(v == null ? '' : v);
  }

  function clamp(n, min, max){
    n = Number(n);
    if(!Number.isFinite(n)) n = min;
    return Math.max(min, Math.min(max, n));
  }

  function root(){
    return document.getElementById('gjSoloBossMain') ||
           document.querySelector('.gjm-root') ||
           document.body ||
           document.documentElement;
  }

  function playArea(){
    return document.getElementById('gjSoloBossArea') ||
           document.querySelector('.gjm-area') ||
           root();
  }

  function dispatch(name, detail){
    try{
      window.dispatchEvent(new CustomEvent(name, {
        detail:detail || {}
      }));
    }catch(_){}
  }

  function unlockByGesture(reason){
    if(state.gestureUnlocked) return;

    state.gestureUnlocked = true;

    try{
      document.documentElement.dataset.gjGestureUnlocked = '1';
      if(document.body) document.body.dataset.gjGestureUnlocked = '1';
    }catch(_){}

    try{
      localStorage.setItem('GJ_GESTURE_UNLOCKED_LAST', JSON.stringify({
        patch:PATCH,
        reason:reason || 'gesture',
        at:new Date().toISOString()
      }));
    }catch(_){}

    console.log('[GJ Juice] gesture unlocked:', reason || 'gesture');
  }

  function bindGestureUnlock(){
    const unlock = function(ev){
      unlockByGesture(ev && ev.type ? ev.type : 'gesture');
      tryUnlockAudio('gesture-' + (ev && ev.type || 'event'));
    };

    [
      'pointerdown',
      'mousedown',
      'touchstart',
      'keydown',
      'click'
    ].forEach(function(type){
      document.addEventListener(type, unlock, {
        capture:true,
        passive:true
      });
    });

    window.addEventListener('gj:real-play', function(){
      unlockByGesture('gj:real-play');
      tryUnlockAudio('gj:real-play');
    });

    window.addEventListener('gj:game-start', function(){
      unlockByGesture('gj:game-start');
      tryUnlockAudio('gj:game-start');
    });

    window.addEventListener('gj:start', function(){
      unlockByGesture('gj:start');
      tryUnlockAudio('gj:start');
    });
  }

  function canVibrate(){
    if(!state.gestureUnlocked) return false;
    if(boolParam('novibrate', false)) return false;
    if(!('vibrate' in navigator)) return false;
    if(now() - state.lastVibrateAt < CFG.vibrateMinGap) return false;

    return true;
  }

  function safeVibrate(pattern, reason){
    if(!canVibrate()) return false;

    try{
      state.lastVibrateAt = now();
      navigator.vibrate(pattern);
      return true;
    }catch(e){
      return false;
    }
  }

  function tryUnlockAudio(reason){
    if(state.audioUnlocked) return true;
    if(state.muted || boolParam('mute', false)) return false;

    if(!state.gestureUnlocked) return false;

    try{
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if(!AudioContext) return false;

      if(!state.audioCtx){
        state.audioCtx = new AudioContext();
      }

      if(state.audioCtx.state === 'suspended'){
        state.audioCtx.resume().catch(function(){});
      }

      state.audioUnlocked = true;

      console.log('[GJ Juice] audio unlocked:', reason || 'gesture');
      return true;
    }catch(e){
      return false;
    }
  }

  function beep(freq, duration, type, gain){
    if(state.muted || boolParam('mute', false)) return false;
    if(!state.gestureUnlocked) return false;
    if(now() - state.lastSoundAt < CFG.soundMinGap) return false;

    tryUnlockAudio('beep');

    const ctx = state.audioCtx;
    if(!ctx || ctx.state === 'closed') return false;

    try{
      state.lastSoundAt = now();

      const osc = ctx.createOscillator();
      const g = ctx.createGain();

      osc.type = type || 'sine';
      osc.frequency.value = Number(freq || 440);

      g.gain.value = 0.0001;

      osc.connect(g);
      g.connect(ctx.destination);

      const t = ctx.currentTime;
      const d = Math.max(0.03, Number(duration || 0.08));

      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain || 0.045), t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d);

      osc.start(t);
      osc.stop(t + d + 0.02);

      return true;
    }catch(e){
      return false;
    }
  }

  function injectCss(){
    if(document.getElementById('gjJuiceV8403fCss')) return;

    const css = document.createElement('style');
    css.id = 'gjJuiceV8403fCss';
    css.textContent = `
      .gj-juice-shake{
        animation:gjJuiceShake .18s linear 1 !important;
      }

      .gj-juice-hit-good{
        animation:gjJuiceGoodPulse .28s ease-out 1 !important;
      }

      .gj-juice-hit-bad{
        animation:gjJuiceBadPulse .30s ease-out 1 !important;
      }

      .gj-juice-combo{
        animation:gjJuiceComboPulse .38s ease-out 1 !important;
      }

      @keyframes gjJuiceShake{
        0%{ transform:translate3d(0,0,0); }
        20%{ transform:translate3d(-5px,2px,0); }
        40%{ transform:translate3d(4px,-2px,0); }
        60%{ transform:translate3d(-3px,1px,0); }
        80%{ transform:translate3d(2px,-1px,0); }
        100%{ transform:translate3d(0,0,0); }
      }

      @keyframes gjJuiceGoodPulse{
        0%{ filter:saturate(1) brightness(1); }
        35%{ filter:saturate(1.45) brightness(1.15); }
        100%{ filter:saturate(1) brightness(1); }
      }

      @keyframes gjJuiceBadPulse{
        0%{ filter:saturate(1) brightness(1); }
        35%{ filter:saturate(1.3) brightness(.92) hue-rotate(-12deg); }
        100%{ filter:saturate(1) brightness(1); }
      }

      @keyframes gjJuiceComboPulse{
        0%{ transform:scale(1); }
        35%{ transform:scale(1.08); }
        100%{ transform:scale(1); }
      }

      .gj-juice-toast{
        position:fixed;
        left:50%;
        top:calc(78px + env(safe-area-inset-top,0px));
        z-index:2147483500;
        transform:translate(-50%,-10px) scale(.96);
        min-width:min(380px,calc(100vw - 28px));
        max-width:min(560px,calc(100vw - 28px));
        border-radius:22px;
        padding:12px 16px;
        color:#fff;
        background:rgba(15,23,42,.92);
        box-shadow:0 18px 42px rgba(15,23,42,.28);
        border:2px solid rgba(255,255,255,.15);
        font-family:system-ui,-apple-system,Segoe UI,sans-serif;
        text-align:center;
        pointer-events:none;
        opacity:0;
        transition:opacity .16s ease, transform .16s ease;
      }

      .gj-juice-toast.show{
        opacity:1;
        transform:translate(-50%,0) scale(1);
      }

      .gj-juice-toast b{
        display:block;
        font-size:15px;
        line-height:1.16;
        font-weight:1000;
      }

      .gj-juice-toast span{
        display:block;
        margin-top:4px;
        color:#fde68a;
        font-size:12px;
        line-height:1.25;
        font-weight:900;
      }

      .gj-juice-spark{
        position:fixed;
        z-index:2147483400;
        width:58px;
        height:58px;
        margin:-29px 0 0 -29px;
        border-radius:999px;
        display:grid;
        place-items:center;
        pointer-events:none;
        font-size:30px;
        background:rgba(255,255,255,.72);
        box-shadow:0 12px 34px rgba(15,23,42,.16);
        animation:gjJuiceSpark .44s ease-out forwards;
      }

      @keyframes gjJuiceSpark{
        0%{ opacity:0; transform:scale(.52) translateY(6px); }
        28%{ opacity:1; transform:scale(1.08) translateY(-2px); }
        100%{ opacity:0; transform:scale(1.42) translateY(-20px); }
      }

      .gj-juice-boss-hit{
        position:fixed;
        left:50%;
        bottom:calc(122px + env(safe-area-inset-bottom,0px));
        z-index:2147483300;
        transform:translateX(-50%);
        min-width:min(360px,calc(100vw - 32px));
        border-radius:999px;
        padding:10px 16px;
        background:linear-gradient(90deg,rgba(239,68,68,.94),rgba(251,191,36,.94));
        color:#fff;
        font-family:system-ui,-apple-system,Segoe UI,sans-serif;
        font-size:13px;
        font-weight:1000;
        text-align:center;
        box-shadow:0 16px 38px rgba(239,68,68,.25);
        pointer-events:none;
        animation:gjJuiceBossHit .54s ease-out forwards;
      }

      @keyframes gjJuiceBossHit{
        0%{ opacity:0; transform:translateX(-50%) translateY(12px) scale(.96); }
        25%{ opacity:1; transform:translateX(-50%) translateY(0) scale(1.02); }
        100%{ opacity:0; transform:translateX(-50%) translateY(-18px) scale(1); }
      }

      @media(max-width:720px){
        .gj-juice-toast{
          top:calc(62px + env(safe-area-inset-top,0px));
          padding:10px 13px;
          border-radius:18px;
        }

        .gj-juice-toast b{
          font-size:13px;
        }

        .gj-juice-toast span{
          font-size:11px;
        }

        .gj-juice-spark{
          width:50px;
          height:50px;
          margin:-25px 0 0 -25px;
          font-size:26px;
        }

        .gj-juice-boss-hit{
          bottom:calc(88px + env(safe-area-inset-bottom,0px));
          font-size:12px;
          padding:9px 13px;
        }
      }
    `;

    document.head.appendChild(css);
  }

  function pulse(el, className){
    if(!el) return;

    try{
      el.classList.remove(className);
      void el.offsetWidth;
      el.classList.add(className);

      window.setTimeout(function(){
        try{ el.classList.remove(className); }catch(_){}
      }, 420);
    }catch(_){}
  }

  function shake(reason){
    if(now() - state.lastShakeAt < CFG.shakeMinGap) return;

    state.lastShakeAt = now();

    const el = root();
    pulse(el, 'gj-juice-shake');

    dispatch('gj:juice-shake', {
      patch:PATCH,
      reason:reason || ''
    });
  }

  function toast(title, sub, tone){
    if(now() - state.lastToastAt < CFG.toastMinGap) return;

    state.lastToastAt = now();

    let el = document.getElementById('gjJuiceToast');
    if(!el){
      el = document.createElement('div');
      el.id = 'gjJuiceToast';
      el.className = 'gj-juice-toast';
      el.innerHTML = '<b></b><span></span>';
      document.documentElement.appendChild(el);
    }

    const b = el.querySelector('b');
    const s = el.querySelector('span');

    if(b) b.textContent = safeText(title || '');
    if(s) s.textContent = safeText(sub || '');

    if(tone === 'good'){
      el.style.background = 'linear-gradient(135deg,rgba(22,163,74,.94),rgba(37,99,235,.92))';
    }else if(tone === 'bad'){
      el.style.background = 'linear-gradient(135deg,rgba(239,68,68,.94),rgba(124,45,18,.92))';
    }else if(tone === 'boss'){
      el.style.background = 'linear-gradient(135deg,rgba(124,58,237,.94),rgba(15,23,42,.92))';
    }else{
      el.style.background = 'rgba(15,23,42,.92)';
    }

    el.classList.add('show');

    clearTimeout(el.__gjToastTimer);
    el.__gjToastTimer = setTimeout(function(){
      try{ el.classList.remove('show'); }catch(_){}
    }, 1100);
  }

  function spark(x, y, icon){
    if(now() - state.lastSparkAt < CFG.sparkMinGap) return;

    state.lastSparkAt = now();

    const el = document.createElement('div');
    el.className = 'gj-juice-spark';
    el.textContent = icon || '✨';

    const px = clamp(x || window.innerWidth / 2, 30, window.innerWidth - 30);
    const py = clamp(y || window.innerHeight / 2, 30, window.innerHeight - 30);

    el.style.left = px + 'px';
    el.style.top = py + 'px';

    document.documentElement.appendChild(el);

    setTimeout(function(){
      try{ el.remove(); }catch(_){}
    }, 520);
  }

  function bossHit(label){
    const el = document.createElement('div');
    el.className = 'gj-juice-boss-hit';
    el.textContent = label || 'โจมตีบอสสำเร็จ!';

    document.documentElement.appendChild(el);

    setTimeout(function(){
      try{ el.remove(); }catch(_){}
    }, 620);
  }

  function updateHud(scoreDelta, comboDelta){
    try{
      const scoreEl = document.getElementById('gjmScore');
      const comboEl = document.getElementById('gjmCombo');

      if(scoreEl){
        const n = Number(String(scoreEl.textContent || '0').replace(/[^\d.-]/g,'')) || 0;
        state.score = Math.max(state.score, n + Number(scoreDelta || 0));
      }

      if(comboEl){
        const current = Number(String(comboEl.textContent || '0').replace(/[^\d.-]/g,'')) || 0;
        state.combo = Math.max(current, state.combo + Number(comboDelta || 0));
        state.maxCombo = Math.max(state.maxCombo, state.combo);
      }
    }catch(_){}
  }

  function flashCombo(){
    if(now() - state.lastComboFlashAt < CFG.comboFlashMinGap) return;

    state.lastComboFlashAt = now();

    const el = document.getElementById('gjmCombo');
    pulse(el, 'gj-juice-combo');
  }

  function onGoodHit(detail){
    detail = detail || {};

    state.goodHits += 1;
    state.combo += 1;
    state.maxCombo = Math.max(state.maxCombo, state.combo);

    const x = detail.x || detail.clientX || window.innerWidth * 0.5;
    const y = detail.y || detail.clientY || window.innerHeight * 0.48;

    spark(x, y, detail.icon || '🥦');
    pulse(root(), 'gj-juice-hit-good');
    flashCombo();

    if(state.combo > 0 && state.combo % 5 === 0){
      toast('🔥 คอมโบ x' + state.combo + '!', 'เลือกอาหารดีต่อเนื่อง เก่งมาก!', 'good');
      beep(760, 0.09, 'triangle', 0.045);
      safeVibrate([24, 28, 24], 'combo');
    }else{
      beep(640, 0.055, 'sine', 0.032);
      safeVibrate(18, 'good-hit');
    }

    if(state.goodHits % 4 === 0){
      bossHit('โจมตีบอสด้วยอาหารดี!');
    }

    dispatch('gj:juice-good', {
      patch:PATCH,
      goodHits:state.goodHits,
      combo:state.combo,
      maxCombo:state.maxCombo
    });
  }

  function onBadHit(detail){
    detail = detail || {};

    state.combo = 0;

    if(detail.kind === 'fake'){
      state.fakeHits += 1;
    }else{
      state.junkHits += 1;
    }

    const x = detail.x || detail.clientX || window.innerWidth * 0.5;
    const y = detail.y || detail.clientY || window.innerHeight * 0.48;

    spark(x, y, detail.icon || '⚠️');
    pulse(root(), 'gj-juice-hit-bad');
    shake('bad-hit');

    toast(
      detail.title || 'ระวังอาหารขยะ!',
      detail.sub || 'คอมโบถูกรีเซ็ตแล้ว ลองใหม่อีกครั้ง',
      'bad'
    );

    beep(180, 0.12, 'sawtooth', 0.026);
    safeVibrate([38, 30, 38], 'bad-hit');

    dispatch('gj:juice-bad', {
      patch:PATCH,
      junkHits:state.junkHits,
      fakeHits:state.fakeHits,
      combo:state.combo
    });
  }

  function onBossDamage(detail){
    detail = detail || {};

    bossHit(detail.label || 'Junk Boss โดนโจมตี!');
    shake('boss-damage');

    beep(330, 0.06, 'square', 0.035);
    setTimeout(function(){
      beep(520, 0.07, 'triangle', 0.035);
    }, 70);

    safeVibrate([18, 24, 18], 'boss-damage');

    dispatch('gj:juice-boss-damage', {
      patch:PATCH,
      detail:detail
    });
  }

  function onBossDefeated(detail){
    detail = detail || {};

    toast(
      '🎉 ชนะบอสแล้ว!',
      'เลือกอาหารดี ชนะอาหารขยะได้',
      'boss'
    );

    bossHit('Boss Defeated!');
    shake('boss-defeated');

    beep(520, 0.08, 'triangle', 0.042);
    setTimeout(function(){ beep(690, 0.09, 'triangle', 0.044); }, 95);
    setTimeout(function(){ beep(880, 0.11, 'triangle', 0.046); }, 205);

    safeVibrate([30, 30, 50, 30, 70], 'boss-defeated');

    dispatch('gj:juice-boss-defeated', {
      patch:PATCH,
      detail:detail
    });
  }

  function inferHitFromClick(ev){
    const target = ev.target && ev.target.closest
      ? ev.target.closest('.gjpu-item,.food,.food-item,[data-kind],[data-type],[data-food-kind],[data-good],[data-junk]')
      : null;

    if(!target) return;

    const txt = safeText(target.textContent).toLowerCase();
    const kind =
      safeText(target.dataset && (
        target.dataset.kind ||
        target.dataset.type ||
        target.dataset.foodKind ||
        target.dataset.category ||
        ''
      )).toLowerCase();

    const looksBad =
      kind.includes('junk') ||
      kind.includes('bad') ||
      kind.includes('fake') ||
      kind.includes('trap') ||
      txt.includes('junk') ||
      txt.includes('ขยะ') ||
      txt.includes('หลอก');

    const looksGood =
      kind.includes('good') ||
      kind.includes('healthy') ||
      kind.includes('fruit') ||
      kind.includes('veg') ||
      txt.includes('ดี') ||
      txt.includes('ผัก') ||
      txt.includes('ผลไม้') ||
      txt.includes('น้ำ');

    if(looksBad){
      onBadHit({
        x:ev.clientX,
        y:ev.clientY,
        kind:kind.includes('fake') ? 'fake' : 'junk',
        icon:txt.includes('น้ำ') ? '🧃' : '🍟'
      });
      return;
    }

    if(looksGood){
      onGoodHit({
        x:ev.clientX,
        y:ev.clientY,
        icon:txt.includes('น้ำ') ? '💧' : '🥦'
      });
    }
  }

  function bindEvents(){
    window.addEventListener('gj:good-hit', function(ev){
      onGoodHit(ev && ev.detail || {});
    });

    window.addEventListener('gj:good', function(ev){
      onGoodHit(ev && ev.detail || {});
    });

    window.addEventListener('gj:junk-hit', function(ev){
      onBadHit(Object.assign({ kind:'junk' }, ev && ev.detail || {}));
    });

    window.addEventListener('gj:bad-hit', function(ev){
      onBadHit(Object.assign({ kind:'junk' }, ev && ev.detail || {}));
    });

    window.addEventListener('gj:fake-hit', function(ev){
      onBadHit(Object.assign({ kind:'fake', icon:'🧃' }, ev && ev.detail || {}));
    });

    window.addEventListener('gj:miss', function(ev){
      onBadHit(Object.assign({
        title:'พลาดนิดเดียว!',
        sub:'ตั้งใจใหม่ เลือกอาหารดีให้ไวขึ้น',
        icon:'💨'
      }, ev && ev.detail || {}));
    });

    window.addEventListener('gj:boss-damage', function(ev){
      onBossDamage(ev && ev.detail || {});
    });

    window.addEventListener('gj:boss-hit', function(ev){
      onBossDamage(ev && ev.detail || {});
    });

    window.addEventListener('gj:boss-defeated', function(ev){
      onBossDefeated(ev && ev.detail || {});
    });

    window.addEventListener('gj:win', function(ev){
      onBossDefeated(ev && ev.detail || {});
    });

    document.addEventListener('click', function(ev){
      unlockByGesture('click');
      inferHitFromClick(ev);
    }, true);

    document.addEventListener('pointerdown', function(ev){
      unlockByGesture('pointerdown');
    }, true);

    document.addEventListener('touchstart', function(){
      unlockByGesture('touchstart');
    }, {
      passive:true,
      capture:true
    });

    document.addEventListener('keydown', function(){
      unlockByGesture('keydown');
    }, true);
  }

  function exposeApi(){
    window.GJ_JUICE = window.GJ_JUICE || {};

    Object.assign(window.GJ_JUICE, {
      version:PATCH,
      state:state,
      unlock:unlockByGesture,
      toast:toast,
      spark:spark,
      shake:shake,
      bossHit:bossHit,
      good:onGoodHit,
      bad:onBadHit,
      bossDamage:onBossDamage,
      bossDefeated:onBossDefeated,
      vibrate:safeVibrate,
      beep:beep,
      mute:function(v){
        state.muted = !!v;
      }
    });

    window.GJ_SOLO_BOSS_JUICE = window.GJ_JUICE;
  }

  function autoWarmupNotice(){
    setTimeout(function(){
      if(!state.gestureUnlocked){
        toast('พร้อมลุยบอส!', 'แตะเริ่มเล่น แล้วเลือกอาหารดีให้ต่อเนื่อง', 'boss');
      }
    }, 900);
  }

  function install(){
    injectCss();
    bindGestureUnlock();
    bindEvents();
    exposeApi();
    autoWarmupNotice();

    try{
      localStorage.setItem('GJ_SOLO_BOSS_JUICE_LAST_PATCH', JSON.stringify({
        patch:PATCH,
        view:viewMode(),
        mobile:isMobileish(),
        at:new Date().toISOString()
      }));
    }catch(_){}

    console.log('[GJ Juice] installed', {
      patch:PATCH,
      view:viewMode(),
      mobile:isMobileish()
    });
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', install, { once:true });
  }else{
    install();
  }
})();
