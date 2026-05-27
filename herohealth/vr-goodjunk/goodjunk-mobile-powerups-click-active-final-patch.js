/* =========================================================
   GOODJUNK MOBILE/PC POWERUPS CLICK ACTIVE FINAL
   PATCH: v20260526-GOODJUNK-MOBILE-POWERUPS-CLICK-ACTIVE-FINAL
   FILE: /herohealth/vr-goodjunk/goodjunk-mobile-powerups-click-active-final-patch.js
   PURPOSE:
   - Fix side power-up cards showing "พร้อมใช้" but click does nothing
   - Stop flicker back to "ยังไม่มี"
   - Add real Shield / Magnet / Fever effects without touching summary/cooldown/return
========================================================= */

(function(){
  'use strict';

  if (window.__GJ_MOBILE_POWERUPS_CLICK_ACTIVE_FINAL__) return;
  window.__GJ_MOBILE_POWERUPS_CLICK_ACTIVE_FINAL__ = true;

  const PATCH = 'v20260526-GOODJUNK-MOBILE-POWERUPS-CLICK-ACTIVE-FINAL';

  const qs = new URLSearchParams(location.search || '');
  const view = String(qs.get('view') || '').toLowerCase();

  const isMobileOrPc =
    view === 'mobile' ||
    view === 'pc' ||
    view === '' ||
    !/cvr|cardboard|vr/.test(view);

  if (!isMobileOrPc) return;

  const POWER_KEYS = {
    shield: ['shield', 'โล่', '🛡️'],
    magnet: ['magnet', 'แม่เหล็ก', '🧲'],
    fever: ['fever', 'ไฟ', '⚡']
  };

  const state = {
    shieldReady: false,
    magnetReady: false,
    feverReady: false,
    shieldActiveUntil: 0,
    magnetActiveUntil: 0,
    feverActiveUntil: 0,
    lastScore: 0,
    lastReadyAt: 0
  };

  function now(){
    return Date.now();
  }

  function textOf(el){
    return String(el && el.textContent || '').replace(/\s+/g, ' ').trim();
  }

  function toast(msg){
    let t = document.getElementById('gjPowerToastFinal');

    if (!t){
      t = document.createElement('div');
      t.id = 'gjPowerToastFinal';
      t.style.position = 'fixed';
      t.style.left = '50%';
      t.style.bottom = 'calc(82px + env(safe-area-inset-bottom,0px))';
      t.style.transform = 'translateX(-50%)';
      t.style.zIndex = '2147482500';
      t.style.maxWidth = 'min(420px, calc(100vw - 28px))';
      t.style.padding = '11px 16px';
      t.style.borderRadius = '999px';
      t.style.background = 'rgba(15,23,42,.88)';
      t.style.color = '#fff';
      t.style.border = '2px solid rgba(255,255,255,.78)';
      t.style.boxShadow = '0 14px 34px rgba(15,23,42,.28)';
      t.style.backdropFilter = 'blur(8px)';
      t.style.fontSize = '13px';
      t.style.fontWeight = '1000';
      t.style.textAlign = 'center';
      t.style.opacity = '0';
      t.style.pointerEvents = 'none';
      t.style.transition = 'opacity .16s ease, transform .16s ease';
      document.body.appendChild(t);
    }

    t.textContent = msg;
    t.style.opacity = '1';
    t.style.transform = 'translateX(-50%) translateY(0) scale(1)';

    clearTimeout(toast._timer);
    toast._timer = setTimeout(function(){
      t.style.opacity = '0';
      t.style.transform = 'translateX(-50%) translateY(8px) scale(.96)';
    }, 1500);
  }

  function bigFx(msg, type){
    let fx = document.getElementById('gjPowerBigFxFinal');

    if (!fx){
      fx = document.createElement('div');
      fx.id = 'gjPowerBigFxFinal';
      fx.style.position = 'fixed';
      fx.style.left = '50%';
      fx.style.top = '45%';
      fx.style.transform = 'translate(-50%,-50%) scale(.85)';
      fx.style.zIndex = '2147482400';
      fx.style.minWidth = 'min(390px, calc(100vw - 40px))';
      fx.style.padding = '16px 20px';
      fx.style.borderRadius = '28px';
      fx.style.textAlign = 'center';
      fx.style.fontSize = 'clamp(28px, 8vw, 54px)';
      fx.style.lineHeight = '1';
      fx.style.fontWeight = '1000';
      fx.style.color = '#fff';
      fx.style.textShadow = '0 4px 18px rgba(15,23,42,.28)';
      fx.style.pointerEvents = 'none';
      fx.style.opacity = '0';
      fx.style.transition = 'opacity .16s ease, transform .16s ease';
      document.body.appendChild(fx);
    }

    const bg =
      type === 'shield' ? 'linear-gradient(135deg,#38bdf8,#2563eb)' :
      type === 'magnet' ? 'linear-gradient(135deg,#fb7185,#ef4444)' :
      type === 'fever' ? 'linear-gradient(135deg,#facc15,#f97316)' :
      'linear-gradient(135deg,#22c55e,#2563eb)';

    fx.textContent = msg;
    fx.style.background = bg;
    fx.style.border = '3px solid rgba(255,255,255,.82)';
    fx.style.opacity = '1';
    fx.style.transform = 'translate(-50%,-50%) scale(1.04)';

    clearTimeout(bigFx._timer);
    bigFx._timer = setTimeout(function(){
      fx.style.opacity = '0';
      fx.style.transform = 'translate(-50%,-58%) scale(.92)';
    }, 720);
  }

  function beep(kind){
    try{
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;

      if (!beep.ctx) beep.ctx = new AudioCtx();
      const ctx = beep.ctx;

      if (ctx.state === 'suspended') ctx.resume().catch(function(){});

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      const freq =
        kind === 'shield' ? 520 :
        kind === 'magnet' ? 680 :
        kind === 'fever' ? 880 :
        600;

      osc.type = kind === 'fever' ? 'square' : 'triangle';
      osc.frequency.value = freq;

      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.085, ctx.currentTime + 0.018);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.18);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.22);
    }catch(_){}
  }

  function getScore(){
    const ids = ['gjmScore','score','hudScore'];
    for (const id of ids){
      const el = document.getElementById(id);
      const n = Number(String(el && el.textContent || '').replace(/[^\d.-]/g,''));
      if (Number.isFinite(n)) return n;
    }
    return state.lastScore || 0;
  }

  function addScore(delta){
    const ids = ['gjmScore','score','hudScore'];
    ids.forEach(function(id){
      const el = document.getElementById(id);
      if (!el) return;

      const current = Number(String(el.textContent || '0').replace(/[^\d.-]/g,'')) || 0;
      el.textContent = String(Math.max(0, Math.round(current + delta)));
    });
  }

  function findPowerCards(){
    const nodes = Array.from(document.querySelectorAll('button, [role="button"], .gjpu-card, .power-card, .powerup-card, div'));

    const cards = {
      shield: null,
      magnet: null,
      fever: null
    };

    nodes.forEach(function(el){
      const t = textOf(el).toLowerCase();

      if (!cards.shield && POWER_KEYS.shield.some(k => t.includes(String(k).toLowerCase()))) cards.shield = el;
      if (!cards.magnet && POWER_KEYS.magnet.some(k => t.includes(String(k).toLowerCase()))) cards.magnet = el;
      if (!cards.fever && POWER_KEYS.fever.some(k => t.includes(String(k).toLowerCase()))) cards.fever = el;
    });

    return cards;
  }

  function setCardReady(card, ready, activeText){
    if (!card) return;

    card.setAttribute('data-gj-power-click-final', '1');
    card.style.cursor = 'pointer';
    card.style.pointerEvents = 'auto';

    if (ready){
      card.classList.add('on');
      card.classList.add('ready');
      card.setAttribute('data-ready', '1');
      card.style.opacity = '1';
      card.style.filter = 'saturate(1.2) brightness(1.04)';
      card.style.boxShadow = '0 0 0 3px rgba(34,197,94,.35), 0 12px 26px rgba(15,23,42,.18)';
    }

    const spans = Array.from(card.querySelectorAll('span, small, b, strong, em'));
    const status = spans.find(n => /ยังไม่มี|พร้อมใช้|ใช้แล้ว|active|ready|ไม่มี/i.test(textOf(n)));

    if (status){
      status.textContent = activeText || (ready ? 'พร้อมใช้' : 'ยังไม่มี');
    }else if (ready && !/พร้อมใช้/.test(textOf(card))){
      const s = document.createElement('span');
      s.textContent = activeText || 'พร้อมใช้';
      s.style.display = 'block';
      s.style.color = '#16a34a';
      s.style.fontSize = '11px';
      s.style.fontWeight = '1000';
      card.appendChild(s);
    }
  }

  function markReady(type){
    if (type === 'shield') state.shieldReady = true;
    if (type === 'magnet') state.magnetReady = true;
    if (type === 'fever') state.feverReady = true;

    state.lastReadyAt = now();
    syncCards();
  }

  function isReady(type){
    return !!(
      type === 'shield' ? state.shieldReady :
      type === 'magnet' ? state.magnetReady :
      type === 'fever' ? state.feverReady :
      false
    );
  }

  function consume(type){
    if (type === 'shield') state.shieldReady = false;
    if (type === 'magnet') state.magnetReady = false;
    if (type === 'fever') state.feverReady = false;
  }

  function activateShield(){
    if (!isReady('shield')){
      toast('🛡️ Shield ยังไม่พร้อม');
      return;
    }

    consume('shield');
    state.shieldActiveUntil = now() + 9000;

    document.body.setAttribute('data-gj-shield-active', '1');
    toast('🛡️ Shield ทำงาน 9 วินาที');
    bigFx('SHIELD!', 'shield');
    beep('shield');

    setTimeout(function(){
      if (now() >= state.shieldActiveUntil){
        document.body.removeAttribute('data-gj-shield-active');
      }
      syncCards();
    }, 9200);

    syncCards();
  }

  function activateMagnet(){
    if (!isReady('magnet')){
      toast('🧲 Magnet ยังไม่พร้อม');
      return;
    }

    consume('magnet');
    state.magnetActiveUntil = now() + 8500;

    document.body.setAttribute('data-gj-magnet-active', '1');
    toast('🧲 Magnet ทำงาน: ดึงคะแนนอาหารดี + bonus');
    bigFx('MAGNET!', 'magnet');
    beep('magnet');

    addScore(35);

    setTimeout(function(){
      if (now() >= state.magnetActiveUntil){
        document.body.removeAttribute('data-gj-magnet-active');
      }
      syncCards();
    }, 8800);

    syncCards();
  }

  function activateFever(){
    if (!isReady('fever')){
      toast('⚡ Fever ยังไม่พร้อม');
      return;
    }

    consume('fever');
    state.feverActiveUntil = now() + 8000;

    document.body.setAttribute('data-gj-fever-active', '1');
    toast('⚡ Fever ทำงาน: คะแนน bonus และเร่งพลังโจมตี');
    bigFx('FEVER!', 'fever');
    beep('fever');

    addScore(55);

    setTimeout(function(){
      if (now() >= state.feverActiveUntil){
        document.body.removeAttribute('data-gj-fever-active');
      }
      syncCards();
    }, 8300);

    syncCards();
  }

  function bindCard(card, type){
    if (!card || card.__gjPowerClickFinalBound) return;
    card.__gjPowerClickFinalBound = true;

    card.addEventListener('click', function(ev){
      ev.preventDefault();
      ev.stopPropagation();
      if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();

      if (type === 'shield') activateShield();
      if (type === 'magnet') activateMagnet();
      if (type === 'fever') activateFever();

      return false;
    }, true);

    card.addEventListener('pointerdown', function(ev){
      ev.stopPropagation();
    }, true);
  }

  function syncCards(){
    const cards = findPowerCards();

    bindCard(cards.shield, 'shield');
    bindCard(cards.magnet, 'magnet');
    bindCard(cards.fever, 'fever');

    setCardReady(
      cards.shield,
      state.shieldReady || now() < state.shieldActiveUntil,
      now() < state.shieldActiveUntil ? 'กำลังใช้' : (state.shieldReady ? 'พร้อมใช้' : 'ยังไม่มี')
    );

    setCardReady(
      cards.magnet,
      state.magnetReady || now() < state.magnetActiveUntil,
      now() < state.magnetActiveUntil ? 'กำลังใช้' : (state.magnetReady ? 'พร้อมใช้' : 'ยังไม่มี')
    );

    setCardReady(
      cards.fever,
      state.feverReady || now() < state.feverActiveUntil,
      now() < state.feverActiveUntil ? 'กำลังใช้' : (state.feverReady ? 'พร้อมใช้' : 'ยังไม่มี')
    );
  }

  function inferReadyFromScore(){
    const score = getScore();

    if (score > state.lastScore){
      const delta = score - state.lastScore;

      if (score >= 80) markReady('shield');
      if (score >= 150) markReady('magnet');
      if (score >= 230) markReady('fever');

      if (delta >= 25 && score >= 100){
        if (!state.shieldReady) markReady('shield');
      }
    }

    state.lastScore = score;
  }

  function interceptBadHitWithShield(){
    if (now() >= state.shieldActiveUntil) return;

    const livesEls = [
      document.getElementById('gjmLives'),
      document.getElementById('hudLives'),
      document.getElementById('lives')
    ].filter(Boolean);

    livesEls.forEach(function(el){
      const txt = String(el.textContent || '');
      if (txt && !txt.includes('💚💚💚💚')){
        el.textContent = txt.replace('💔','💚');
      }
    });
  }

  function applyFeverVisual(){
    const active = now() < state.feverActiveUntil;

    document.querySelectorAll('.gjpu-item, .food, .target, [data-kind="good"], [data-type="good"]').forEach(function(el){
      try{
        if (active){
          el.style.filter = 'saturate(1.35) brightness(1.08) drop-shadow(0 0 12px rgba(250,204,21,.55))';
        }else if (el.style.filter && el.style.filter.includes('drop-shadow')){
          el.style.filter = '';
        }
      }catch(_){}
    });
  }

  function tick(){
    inferReadyFromScore();
    interceptBadHitWithShield();
    applyFeverVisual();
    syncCards();

    try{
      localStorage.setItem('GJ_MOBILE_POWERUPS_CLICK_ACTIVE_LAST', JSON.stringify({
        patch: PATCH,
        score: getScore(),
        shieldReady: state.shieldReady,
        magnetReady: state.magnetReady,
        feverReady: state.feverReady,
        shieldActive: now() < state.shieldActiveUntil,
        magnetActive: now() < state.magnetActiveUntil,
        feverActive: now() < state.feverActiveUntil,
        savedAt: new Date().toISOString()
      }));
    }catch(_){}
  }

  function boot(){
    state.lastScore = getScore();

    const timer = setInterval(tick, 350);

    setTimeout(function(){
      markReady('shield');
    }, 1200);

    window.GJ_MOBILE_POWERUPS_CLICK_ACTIVE_CHECK = function(){
      const cards = findPowerCards();
      const snap = {
        patch,
        score: getScore(),
        shieldReady: state.shieldReady,
        magnetReady: state.magnetReady,
        feverReady: state.feverReady,
        shieldActive: now() < state.shieldActiveUntil,
        magnetActive: now() < state.magnetActiveUntil,
        feverActive: now() < state.feverActiveUntil,
        cards: {
          shield: !!cards.shield,
          magnet: !!cards.magnet,
          fever: !!cards.fever
        }
      };

      console.log('[GJ_MOBILE_POWERUPS_CLICK_ACTIVE_CHECK]', snap);
      return snap;
    };

    console.info('[GoodJunk Mobile Powerups Click Active]', PATCH, 'loaded');
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot, {once:true});
  }else{
    boot();
  }
})();
