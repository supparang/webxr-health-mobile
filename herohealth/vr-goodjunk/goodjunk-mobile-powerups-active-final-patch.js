/* =========================================================
   GOODJUNK MOBILE POWERUPS ACTIVE FINAL PATCH
   FILE: /herohealth/vr-goodjunk/goodjunk-mobile-powerups-active-final-patch.js
   PATCH: v20260526-GOODJUNK-MOBILE-POWERUPS-ACTIVE-FINAL
   PURPOSE:
   - ทำให้ Shield / Magnet / Fever active จริงบน PC/Mobile
   - ปลดล็อกตาม score / เวลาเล่น / สถานะบอส
   - กดใช้แล้วมี feedback + visual state
   - ไม่ยุ่งกับ cVR
========================================================= */

(function(){
  'use strict';

  if (window.__GJ_MOBILE_POWERUPS_ACTIVE_FINAL__) return;
  window.__GJ_MOBILE_POWERUPS_ACTIVE_FINAL__ = true;

  const PATCH = 'v20260526-GOODJUNK-MOBILE-POWERUPS-ACTIVE-FINAL';
  const qs = new URLSearchParams(location.search || '');
  const view = String(qs.get('view') || 'mobile').toLowerCase();

  if (view === 'cvr' || view === 'vr' || view === 'cardboard') return;

  const state = {
    shield: false,
    magnet: false,
    fever: false,
    shieldUsed: false,
    magnetUsed: false,
    feverUsed: false,
    feverUntil: 0,
    magnetUntil: 0,
    shieldUntil: 0,
    lastScore: 0,
    bootAt: Date.now()
  };

  function $(id){
    return document.getElementById(id);
  }

  function textOf(el){
    return String(el && el.textContent || '').replace(/\s+/g, ' ').trim();
  }

  function getScore(){
    const ids = ['gjmScore','score','hudScore','sumScore'];
    for (const id of ids){
      const el = $(id);
      if (!el) continue;
      const n = Number(String(el.textContent || '').replace(/[^\d.-]/g, ''));
      if (Number.isFinite(n)) return n;
    }

    const candidates = Array.from(document.querySelectorAll('*')).filter(function(el){
      const t = textOf(el);
      return /^score/i.test(t) || /คะแนน/.test(t);
    });

    for (const el of candidates){
      const n = Number(textOf(el).replace(/[^\d.-]/g, ''));
      if (Number.isFinite(n)) return n;
    }

    return state.lastScore || 0;
  }

  function getTimeLeft(){
    const ids = ['gjmTime','time','hudTime'];
    for (const id of ids){
      const el = $(id);
      if (!el) continue;
      const n = Number(String(el.textContent || '').replace(/[^\d.-]/g, ''));
      if (Number.isFinite(n)) return n;
    }
    return 999;
  }

  function toast(msg){
    let t = document.getElementById('gjPowerToast');

    if (!t){
      t = document.createElement('div');
      t.id = 'gjPowerToast';
      t.style.cssText = [
        'position:fixed',
        'left:50%',
        'bottom:calc(82px + env(safe-area-inset-bottom,0px))',
        'transform:translateX(-50%) scale(.96)',
        'z-index:2147483000',
        'width:min(390px,calc(100vw - 28px))',
        'padding:11px 14px',
        'border-radius:999px',
        'background:rgba(15,23,42,.88)',
        'color:#fff',
        'border:2px solid rgba(255,255,255,.75)',
        'box-shadow:0 16px 36px rgba(15,23,42,.26)',
        'font-size:13px',
        'font-weight:1000',
        'text-align:center',
        'opacity:0',
        'pointer-events:none',
        'transition:.18s ease'
      ].join(';');
      document.body.appendChild(t);
    }

    t.textContent = msg;
    t.style.opacity = '1';
    t.style.transform = 'translateX(-50%) scale(1)';

    clearTimeout(toast._timer);
    toast._timer = setTimeout(function(){
      t.style.opacity = '0';
      t.style.transform = 'translateX(-50%) scale(.96)';
    }, 1350);
  }

  function bigFx(msg, color){
    let fx = document.getElementById('gjPowerBigFx');

    if (!fx){
      fx = document.createElement('div');
      fx.id = 'gjPowerBigFx';
      fx.style.cssText = [
        'position:fixed',
        'left:50%',
        'top:48%',
        'transform:translate(-50%,-50%) scale(.82)',
        'z-index:2147482900',
        'min-width:min(360px,calc(100vw - 34px))',
        'padding:14px 18px',
        'border-radius:28px',
        'text-align:center',
        'font-size:clamp(28px,8vw,54px)',
        'line-height:1',
        'font-weight:1000',
        'letter-spacing:-.04em',
        'color:#fff',
        'text-shadow:0 4px 16px rgba(15,23,42,.28)',
        'opacity:0',
        'pointer-events:none',
        'box-shadow:0 24px 55px rgba(15,23,42,.28)',
        'transition:.16s ease'
      ].join(';');
      document.body.appendChild(fx);
    }

    fx.textContent = msg;
    fx.style.background = color || 'linear-gradient(135deg,#22c55e,#2563eb)';
    fx.style.opacity = '1';
    fx.style.transform = 'translate(-50%,-50%) scale(1)';

    clearTimeout(bigFx._timer);
    bigFx._timer = setTimeout(function(){
      fx.style.opacity = '0';
      fx.style.transform = 'translate(-50%,-58%) scale(.88)';
    }, 760);
  }

  function beep(freq, dur){
    try{
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;

      if (!beep.ctx) beep.ctx = new Ctx();
      const ctx = beep.ctx;

      if (ctx.state === 'suspended'){
        ctx.resume().catch(function(){});
      }

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.value = freq || 520;

      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + (dur || 0.18));

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + (dur || 0.18) + 0.03);
    }catch(_){}
  }

  function ensureStyle(){
    if (document.getElementById('gjPowerActiveStyle')) return;

    const style = document.createElement('style');
    style.id = 'gjPowerActiveStyle';
    style.textContent = `
      .gj-power-active-card,
      .gjpu-card.gj-power-active-card,
      [data-gj-power-active="1"]{
        opacity:1 !important;
        filter:saturate(1.25) brightness(1.03) !important;
        transform:translateZ(0) scale(1.02) !important;
        box-shadow:
          0 12px 28px rgba(34,197,94,.22),
          0 0 0 3px rgba(34,197,94,.28) !important;
        border-color:rgba(34,197,94,.65) !important;
        cursor:pointer !important;
      }

      .gj-power-used-card,
      .gjpu-card.gj-power-used-card,
      [data-gj-power-used="1"]{
        opacity:.45 !important;
        filter:grayscale(.65) !important;
      }

      .gj-power-active-label{
        color:#16a34a !important;
        font-weight:1000 !important;
      }

      .gj-power-used-label{
        color:#64748b !important;
        font-weight:900 !important;
      }

      body[data-gj-shield-active="1"] .gjm-root,
      body[data-gj-shield-active="1"] main{
        box-shadow:inset 0 0 0 6px rgba(56,189,248,.28);
      }

      body[data-gj-fever-active="1"] .gjm-root,
      body[data-gj-fever-active="1"] main{
        filter:saturate(1.18) brightness(1.04);
      }

      body[data-gj-magnet-active="1"] .gjpu-item,
      body[data-gj-magnet-active="1"] .food,
      body[data-gj-magnet-active="1"] [data-kind="good"]{
        filter:drop-shadow(0 0 16px rgba(59,130,246,.42)) !important;
      }
    `;
    document.head.appendChild(style);
  }

  function findPowerCards(){
    const all = Array.from(document.querySelectorAll('.gjpu-card, .power-card, [data-power], [data-powerup], button, div'));

    const found = {
      shield: null,
      magnet: null,
      fever: null
    };

    all.forEach(function(el){
      const txt = textOf(el).toLowerCase();

      if (!found.shield && /shield|โล่|ป้องกัน/i.test(txt)){
        found.shield = el;
      }

      if (!found.magnet && /magnet|แม่เหล็ก/i.test(txt)){
        found.magnet = el;
      }

      if (!found.fever && /fever|ไฟ|คูณ|x2|สปีด/i.test(txt)){
        found.fever = el;
      }
    });

    return found;
  }

  function setCardState(card, active, used, label){
    if (!card) return;

    card.dataset.gjPowerActive = active ? '1' : '0';
    card.dataset.gjPowerUsed = used ? '1' : '0';

    card.classList.toggle('gj-power-active-card', !!active && !used);
    card.classList.toggle('gj-power-used-card', !!used);

    const children = Array.from(card.querySelectorAll('span,b,small,em,strong'));
    const target = children.find(function(n){
      return /ยังไม่มี|ปิดอยู่|พร้อมใช้|ใช้แล้ว|active|ready/i.test(textOf(n));
    }) || children[children.length - 1];

    if (target){
      target.textContent = used ? 'ใช้แล้ว' : active ? 'พร้อมใช้' : 'ยังไม่มี';
      target.classList.toggle('gj-power-active-label', !!active && !used);
      target.classList.toggle('gj-power-used-label', !!used);
    }else{
      card.setAttribute('title', label + ': ' + (used ? 'ใช้แล้ว' : active ? 'พร้อมใช้' : 'ยังไม่มี'));
    }
  }

  function updateCards(){
    ensureStyle();

    const score = getScore();
    const timeLeft = getTimeLeft();
    const playedSec = Math.floor((Date.now() - state.bootAt) / 1000);

    state.lastScore = score;

    if (!state.shield && (score >= 15 || playedSec >= 8)){
      state.shield = true;
      toast('🛡️ Shield พร้อมใช้แล้ว');
    }

    if (!state.magnet && (score >= 45 || playedSec >= 18)){
      state.magnet = true;
      toast('🧲 Magnet พร้อมใช้แล้ว');
    }

    if (!state.fever && (score >= 80 || timeLeft <= 35 || playedSec >= 28)){
      state.fever = true;
      toast('⚡ Fever พร้อมใช้แล้ว');
    }

    const cards = findPowerCards();

    setCardState(cards.shield, state.shield, state.shieldUsed, 'Shield');
    setCardState(cards.magnet, state.magnet, state.magnetUsed, 'Magnet');
    setCardState(cards.fever, state.fever, state.feverUsed, 'Fever');
  }

  function useShield(){
    if (!state.shield || state.shieldUsed) return false;

    state.shieldUsed = true;
    state.shieldUntil = Date.now() + 9000;

    document.body.setAttribute('data-gj-shield-active', '1');

    bigFx('SHIELD!', 'linear-gradient(135deg,#38bdf8,#2563eb)');
    toast('🛡️ Shield เปิดใช้: กันพลาดช่วงสั้น ๆ');
    beep(520, .11);
    setTimeout(function(){ beep(780, .12); }, 80);

    setTimeout(function(){
      document.body.removeAttribute('data-gj-shield-active');
    }, 9000);

    updateCards();
    return true;
  }

  function useMagnet(){
    if (!state.magnet || state.magnetUsed) return false;

    state.magnetUsed = true;
    state.magnetUntil = Date.now() + 7000;

    document.body.setAttribute('data-gj-magnet-active', '1');

    bigFx('MAGNET!', 'linear-gradient(135deg,#0ea5e9,#6366f1)');
    toast('🧲 Magnet เปิดใช้: ช่วยดูดอาหารดีช่วงสั้น ๆ');
    beep(440, .10);
    setTimeout(function(){ beep(660, .10); }, 80);
    setTimeout(function(){ beep(880, .11); }, 150);

    try{
      document.dispatchEvent(new CustomEvent('gj:powerup', {
        detail: {
          type: 'magnet',
          patch: PATCH,
          durationMs: 7000
        }
      }));
    }catch(_){}

    setTimeout(function(){
      document.body.removeAttribute('data-gj-magnet-active');
    }, 7000);

    updateCards();
    return true;
  }

  function useFever(){
    if (!state.fever || state.feverUsed) return false;

    state.feverUsed = true;
    state.feverUntil = Date.now() + 8000;

    document.body.setAttribute('data-gj-fever-active', '1');

    bigFx('FEVER!', 'linear-gradient(135deg,#f59e0b,#ef4444)');
    toast('⚡ Fever เปิดใช้: คะแนน/จังหวะเร้าใจขึ้น');
    beep(620, .09);
    setTimeout(function(){ beep(820, .10); }, 70);
    setTimeout(function(){ beep(1040, .12); }, 140);

    try{
      document.dispatchEvent(new CustomEvent('gj:powerup', {
        detail: {
          type: 'fever',
          patch: PATCH,
          durationMs: 8000
        }
      }));
    }catch(_){}

    setTimeout(function(){
      document.body.removeAttribute('data-gj-fever-active');
    }, 8000);

    updateCards();
    return true;
  }

  function bindPowerCards(){
    const cards = findPowerCards();

    [
      ['shield', cards.shield, useShield],
      ['magnet', cards.magnet, useMagnet],
      ['fever', cards.fever, useFever]
    ].forEach(function(item){
      const key = item[0];
      const card = item[1];
      const fn = item[2];

      if (!card || card.__gjPowerActiveBound) return;

      card.__gjPowerActiveBound = true;
      card.dataset.gjPowerKey = key;

      card.addEventListener('click', function(ev){
        ev.preventDefault();
        ev.stopPropagation();
        if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();

        const ok = fn();

        if (!ok){
          toast('ยังใช้ ' + key.toUpperCase() + ' ไม่ได้');
        }

        return false;
      }, true);
    });
  }

  function boot(){
    ensureStyle();
    updateCards();
    bindPowerCards();

    let count = 0;
    const timer = setInterval(function(){
      count++;
      updateCards();
      bindPowerCards();

      if (count > 7200){
        clearInterval(timer);
      }
    }, 500);

    window.GJ_MOBILE_POWERUPS_ACTIVE_FINAL_CHECK = function(){
      const cards = findPowerCards();

      const snap = {
        patch: PATCH,
        view: view,
        score: getScore(),
        timeLeft: getTimeLeft(),
        state: Object.assign({}, state),
        cards: {
          shield: !!cards.shield,
          magnet: !!cards.magnet,
          fever: !!cards.fever
        },
        body: {
          shield: document.body.getAttribute('data-gj-shield-active'),
          magnet: document.body.getAttribute('data-gj-magnet-active'),
          fever: document.body.getAttribute('data-gj-fever-active')
        }
      };

      console.log('[GJ_MOBILE_POWERUPS_ACTIVE_FINAL_CHECK]', snap);
      return snap;
    };

    console.info('[GoodJunk Mobile Powerups Active Final]', PATCH, 'loaded');
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot, {once:true});
  }else{
    boot();
  }
})();
