// =========================================================
// GOODJUNK MOBILE POWERUPS EFFECT BIND FINAL
// PATCH: v20260526-GOODJUNK-MOBILE-POWERUPS-EFFECT-BIND-FINAL
// FILE: /herohealth/vr-goodjunk/goodjunk-mobile-powerups-effect-bind-final-patch.js
// PURPOSE:
// - ผูก Shield / Magnet / Fever ให้มีผลจริง
// - ไม่บังการกดเป้า
// - ไม่ยุ่ง Summary / Cooldown / Return
// - ใช้กับ /herohealth/vr-goodjunk/goodjunk-solo-boss.html PC/Mobile
// =========================================================

(function(){
  'use strict';

  if (window.__GJ_MOBILE_POWERUPS_EFFECT_BIND_FINAL__) return;
  window.__GJ_MOBILE_POWERUPS_EFFECT_BIND_FINAL__ = true;

  const PATCH = 'v20260526-GOODJUNK-MOBILE-POWERUPS-EFFECT-BIND-FINAL';

  const QS = new URLSearchParams(location.search || '');
  const view = String(QS.get('view') || '').toLowerCase();

  // ใช้เฉพาะ PC/Mobile ของหน้า 2D solo boss ไม่ใช้กับ cVR full 3D
  const isCvr =
    view === 'cvr' ||
    view === 'cardboard' ||
    view === 'vr' ||
    String(QS.get('entry') || '').toLowerCase() === 'cardboard';

  if (isCvr) return;

  const POWER = {
    shield: {
      ready: false,
      active: false,
      used: 0,
      until: 0
    },
    magnet: {
      ready: false,
      active: false,
      used: 0,
      until: 0
    },
    fever: {
      ready: false,
      active: false,
      used: 0,
      until: 0
    }
  };

  const CONFIG = {
    shieldMs: 9000,
    magnetMs: 8000,
    feverMs: 8500,
    scanMs: 160,
    magnetRadiusPx: 160,
    feverScoreBonus: 1.35,
    feverHitBonus: 1.25
  };

  function $(sel, root){
    return (root || document).querySelector(sel);
  }

  function $all(sel, root){
    return Array.from((root || document).querySelectorAll(sel));
  }

  function now(){
    return Date.now();
  }

  function isSummaryOpen(){
    return !!(
      $('.gjr-overlay') ||
      $('.gjr-summary') ||
      $('#gjrSummary') ||
      document.body.classList.contains('summary-open')
    );
  }

  function isCooldownPage(){
    return /warmup-gate\.html/i.test(location.pathname) &&
      /phase=cooldown/i.test(location.search);
  }

  function toast(msg){
    let t = $('#gjPowerToast');

    if (!t){
      t = document.createElement('div');
      t.id = 'gjPowerToast';
      t.style.cssText = [
        'position:fixed',
        'left:50%',
        'bottom:calc(82px + env(safe-area-inset-bottom,0px))',
        'transform:translateX(-50%) translateY(10px) scale(.96)',
        'z-index:2147482500',
        'width:min(390px,calc(100vw - 24px))',
        'border-radius:999px',
        'padding:10px 14px',
        'background:rgba(15,23,42,.88)',
        'color:#fff',
        'border:2px solid rgba(255,255,255,.72)',
        'box-shadow:0 16px 34px rgba(15,23,42,.24)',
        'font-size:13px',
        'font-weight:1000',
        'text-align:center',
        'opacity:0',
        'pointer-events:none',
        'transition:.18s ease',
        'backdrop-filter:blur(8px)'
      ].join(';');
      document.body.appendChild(t);
    }

    t.textContent = msg;
    t.style.opacity = '1';
    t.style.transform = 'translateX(-50%) translateY(0) scale(1)';

    clearTimeout(toast._timer);
    toast._timer = setTimeout(function(){
      t.style.opacity = '0';
      t.style.transform = 'translateX(-50%) translateY(10px) scale(.96)';
    }, 1300);
  }

  function pulse(text, kind){
    let box = $('#gjPowerPulse');

    if (!box){
      box = document.createElement('div');
      box.id = 'gjPowerPulse';
      box.style.cssText = [
        'position:fixed',
        'left:50%',
        'top:44%',
        'transform:translate(-50%,-50%) scale(.82)',
        'z-index:2147482400',
        'min-width:min(360px,calc(100vw - 34px))',
        'border-radius:28px',
        'padding:14px 18px',
        'text-align:center',
        'font-size:clamp(28px,8vw,54px)',
        'line-height:1',
        'font-weight:1000',
        'letter-spacing:-.05em',
        'color:#fff',
        'text-shadow:0 4px 16px rgba(15,23,42,.28)',
        'box-shadow:0 22px 60px rgba(15,23,42,.24)',
        'opacity:0',
        'pointer-events:none'
      ].join(';');
      document.body.appendChild(box);
    }

    const bg =
      kind === 'shield'
        ? 'linear-gradient(135deg,rgba(56,189,248,.95),rgba(37,99,235,.88))'
        : kind === 'magnet'
          ? 'linear-gradient(135deg,rgba(244,114,182,.95),rgba(168,85,247,.88))'
          : 'linear-gradient(135deg,rgba(245,158,11,.95),rgba(239,68,68,.88))';

    box.textContent = text;
    box.style.background = bg;
    box.style.border = '3px solid rgba(255,255,255,.86)';
    box.style.transition = 'none';
    box.style.opacity = '0';
    box.style.transform = 'translate(-50%,-50%) scale(.78)';

    requestAnimationFrame(function(){
      box.style.transition = '.22s ease';
      box.style.opacity = '1';
      box.style.transform = 'translate(-50%,-50%) scale(1)';
    });

    clearTimeout(pulse._timer);
    pulse._timer = setTimeout(function(){
      box.style.opacity = '0';
      box.style.transform = 'translate(-50%,-60%) scale(.92)';
    }, 820);
  }

  function scoreEl(){
    return $('#gjmScore') || $('[data-score]') || $('.gj-score b') || $('.score b');
  }

  function getScore(){
    const el = scoreEl();
    const n = Number(String(el && el.textContent || '0').replace(/[^\d.-]/g, ''));
    return Number.isFinite(n) ? n : 0;
  }

  function setScore(v){
    const el = scoreEl();
    if (!el) return;
    el.textContent = String(Math.max(0, Math.round(v)));
  }

  function livesEl(){
    return $('#gjmLives') || $('[data-lives]') || $('.gj-lives b') || $('.lives b');
  }

  function getLives(){
    const el = livesEl();
    if (!el) return 4;

    const txt = String(el.textContent || '');
    const hearts = (txt.match(/💚/g) || []).length;

    if (hearts > 0) return hearts;

    const n = Number(txt.replace(/[^\d.-]/g, ''));
    return Number.isFinite(n) ? n : 4;
  }

  function setLives(n){
    const el = livesEl();
    if (!el) return;

    const lives = Math.max(0, Math.min(6, Math.round(n)));
    el.textContent = lives > 0 ? '💚'.repeat(lives) : '💔';
  }

  function powerCards(){
    const candidates = $all('.gjpu-card, .gj-powerup-card, [data-power], [data-powerup], button, .btn');

    return candidates.filter(function(el){
      const txt = String(el.textContent || '').toLowerCase();
      const id = String(el.id || '').toLowerCase();
      const data = String(el.dataset && (el.dataset.power || el.dataset.powerup || el.dataset.kind || '') || '').toLowerCase();

      return /shield|magnet|fever|โล่|แม่เหล็ก|ไข้|พลัง/.test(txt + ' ' + id + ' ' + data);
    });
  }

  function typeOfCard(el){
    const txt = String(el.textContent || '').toLowerCase();
    const id = String(el.id || '').toLowerCase();
    const data = String(el.dataset && (el.dataset.power || el.dataset.powerup || el.dataset.kind || '') || '').toLowerCase();
    const all = txt + ' ' + id + ' ' + data;

    if (/shield|โล่/.test(all)) return 'shield';
    if (/magnet|แม่เหล็ก/.test(all)) return 'magnet';
    if (/fever|ไข้|พลัง/.test(all)) return 'fever';

    return '';
  }

  function setCardState(type, stateText){
    powerCards().forEach(function(card){
      const t = typeOfCard(card);
      if (t !== type) return;

      card.dataset.gjPowerState = stateText;

      card.classList.remove('on', 'ready', 'active', 'off', 'using');

      if (stateText === 'ready'){
        card.classList.add('ready');
      }else if (stateText === 'active'){
        card.classList.add('on');
        card.classList.add('active');
      }else{
        card.classList.add('off');
      }

      const small =
        $('.state', card) ||
        $('.status', card) ||
        $('span', card);

      if (small){
        small.textContent =
          stateText === 'ready' ? 'พร้อมใช้' :
          stateText === 'active' ? 'กำลังใช้' :
          'ยังไม่พร้อม';
      }
    });
  }

  function syncCards(){
    ['shield','magnet','fever'].forEach(function(type){
      const p = POWER[type];

      if (p.active && now() > p.until){
        p.active = false;
        p.ready = false;
        setCardState(type, 'off');
      }

      if (p.active){
        setCardState(type, 'active');
      }else if (p.ready){
        setCardState(type, 'ready');
      }else{
        setCardState(type, 'off');
      }
    });
  }

  function targetNodes(){
    return $all('.gjpu-item, .gj-item, .food, .target, [data-kind], [data-food-type], [data-type]').filter(function(el){
      if (!el || !el.getBoundingClientRect) return false;
      if (el.closest && el.closest('.gjpu-card,.gj-powerup-card,#gjPowerToast,#gjPowerPulse')) return false;
      const r = el.getBoundingClientRect();
      if (r.width < 16 || r.height < 16) return false;
      if (r.right < 0 || r.left > innerWidth || r.bottom < 0 || r.top > innerHeight) return false;
      return true;
    });
  }

  function targetKind(el){
    const txt = String(el.textContent || '').toLowerCase();
    const cls = String(el.className || '').toLowerCase();
    const data = el.dataset || {};
    const all = [
      data.kind,
      data.type,
      data.foodType,
      data.role,
      data.gjKind,
      txt,
      cls
    ].join(' ').toLowerCase();

    if (/junk|bad|ขยะ|หวาน|ทอด|น้ำอัดลม|เฟรนช์|fries|soda|donut|candy/.test(all)) return 'junk';
    if (/fake|หลอก|juice|น้ำผลไม้|ชา|ชานม/.test(all)) return 'fake';
    if (/good|healthy|ผัก|ผลไม้|โปรตีน|น้ำเปล่า|broccoli|apple|egg|water|rice|corn|fish|milk/.test(all)) return 'good';

    return '';
  }

  function centerOf(el){
    const r = el.getBoundingClientRect();
    return {
      x: r.left + r.width / 2,
      y: r.top + r.height / 2
    };
  }

  function nearestGoodTarget(){
    const cx = innerWidth / 2;
    const cy = innerHeight / 2;

    let best = null;
    let bestD = Infinity;

    targetNodes().forEach(function(el){
      if (targetKind(el) !== 'good') return;

      const c = centerOf(el);
      const dx = c.x - cx;
      const dy = c.y - cy;
      const d = Math.sqrt(dx * dx + dy * dy);

      if (d < bestD){
        bestD = d;
        best = el;
      }
    });

    if (!best || bestD > CONFIG.magnetRadiusPx * 2.4) return null;

    return best;
  }

  function clickTarget(el){
    if (!el) return false;

    try{
      el.dispatchEvent(new PointerEvent('pointerdown', {
        bubbles:true,
        cancelable:true,
        pointerId:1,
        pointerType:'touch',
        clientX:centerOf(el).x,
        clientY:centerOf(el).y
      }));
    }catch(_){}

    try{
      el.dispatchEvent(new MouseEvent('click', {
        bubbles:true,
        cancelable:true,
        clientX:centerOf(el).x,
        clientY:centerOf(el).y,
        view:window
      }));
      return true;
    }catch(_){}

    try{
      el.click();
      return true;
    }catch(_){}

    return false;
  }

  function activateShield(){
    if (!POWER.shield.ready || POWER.shield.active) return;

    POWER.shield.ready = false;
    POWER.shield.active = true;
    POWER.shield.used++;
    POWER.shield.until = now() + CONFIG.shieldMs;

    setCardState('shield', 'active');
    pulse('SHIELD!', 'shield');
    toast('🛡️ Shield พร้อมกันพลาด 1 ครั้ง');

    try{
      localStorage.setItem('GJ_POWER_SHIELD_ACTIVE_LAST', JSON.stringify({
        patch: PATCH,
        until: POWER.shield.until,
        savedAt: new Date().toISOString()
      }));
    }catch(_){}
  }

  function activateMagnet(){
    if (!POWER.magnet.ready || POWER.magnet.active) return;

    POWER.magnet.ready = false;
    POWER.magnet.active = true;
    POWER.magnet.used++;
    POWER.magnet.until = now() + CONFIG.magnetMs;

    setCardState('magnet', 'active');
    pulse('MAGNET!', 'magnet');
    toast('🧲 Magnet ช่วยดึง/เลือกอาหารดีใกล้กลางจอ');

    try{
      localStorage.setItem('GJ_POWER_MAGNET_ACTIVE_LAST', JSON.stringify({
        patch: PATCH,
        until: POWER.magnet.until,
        savedAt: new Date().toISOString()
      }));
    }catch(_){}
  }

  function activateFever(){
    if (!POWER.fever.ready || POWER.fever.active) return;

    POWER.fever.ready = false;
    POWER.fever.active = true;
    POWER.fever.used++;
    POWER.fever.until = now() + CONFIG.feverMs;

    setCardState('fever', 'active');
    pulse('FEVER!', 'fever');
    toast('⚡ Fever เพิ่มคะแนน/แรงโจมตีชั่วคราว');

    try{
      localStorage.setItem('GJ_POWER_FEVER_ACTIVE_LAST', JSON.stringify({
        patch: PATCH,
        until: POWER.fever.until,
        savedAt: new Date().toISOString()
      }));
    }catch(_){}
  }

  function activatePower(type){
    if (isSummaryOpen() || isCooldownPage()) return;

    if (type === 'shield') activateShield();
    if (type === 'magnet') activateMagnet();
    if (type === 'fever') activateFever();

    syncCards();
  }

  function bindPowerCards(){
    powerCards().forEach(function(card){
      if (card.__gjPowerEffectBindFinal) return;
      card.__gjPowerEffectBindFinal = true;

      const type = typeOfCard(card);
      if (!type) return;

      card.style.pointerEvents = 'auto';
      card.style.cursor = 'pointer';

      card.addEventListener('click', function(ev){
        ev.preventDefault();
        ev.stopPropagation();
        if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();

        if (POWER[type].ready || POWER[type].active){
          activatePower(type);
        }else{
          toast('ยังไม่พร้อม ใช้ได้เมื่อเก็บพลังครบ');
        }

        return false;
      }, true);
    });
  }

  function grantPower(type, reason){
    if (!POWER[type]) return;

    if (POWER[type].active) return;

    POWER[type].ready = true;
    setCardState(type, 'ready');

    try{
      localStorage.setItem('GJ_POWER_READY_LAST', JSON.stringify({
        patch: PATCH,
        type: type,
        reason: reason || '',
        savedAt: new Date().toISOString()
      }));
    }catch(_){}
  }

  function detectPowerReadyFromUi(){
    powerCards().forEach(function(card){
      const type = typeOfCard(card);
      if (!type) return;

      const txt = String(card.textContent || '').toLowerCase();

      if (/พร้อมใช้|ready/.test(txt)){
        POWER[type].ready = true;
      }

      if (/กำลังใช้|active|using/.test(txt)){
        POWER[type].active = true;
        if (!POWER[type].until) {
          POWER[type].until = now() + (
            type === 'shield' ? CONFIG.shieldMs :
            type === 'magnet' ? CONFIG.magnetMs :
            CONFIG.feverMs
          );
        }
      }
    });
  }

  function applyShieldProtection(){
    if (!POWER.shield.active) return;

    const beforeLives = getLives();

    setTimeout(function(){
      const afterLives = getLives();

      if (afterLives < beforeLives){
        setLives(beforeLives);
        POWER.shield.active = false;
        POWER.shield.ready = false;
        POWER.shield.until = 0;

        setCardState('shield', 'off');
        pulse('BLOCK!', 'shield');
        toast('🛡️ Shield กันพลาดให้แล้ว');
      }
    }, 80);
  }

  function applyFeverScoreBoost(){
    if (!POWER.fever.active) return;

    const before = getScore();

    setTimeout(function(){
      if (!POWER.fever.active) return;

      const after = getScore();
      const gained = after - before;

      if (gained > 0){
        const bonus = Math.round(gained * (CONFIG.feverScoreBonus - 1));
        if (bonus > 0){
          setScore(after + bonus);
          toast('⚡ Fever Bonus +' + bonus);
        }
      }
    }, 90);
  }

  function runMagnetAssist(){
    if (!POWER.magnet.active) return;
    if (isSummaryOpen()) return;

    const target = nearestGoodTarget();
    if (!target) return;

    if (target.__gjMagnetClickedAt && now() - target.__gjMagnetClickedAt < 900) return;
    target.__gjMagnetClickedAt = now();

    target.style.filter = 'drop-shadow(0 0 18px rgba(34,197,94,.75))';
    target.style.transform = (target.style.transform || '') + ' scale(1.04)';

    clickTarget(target);
  }

  function watchTargetHits(){
    document.addEventListener('pointerdown', function(ev){
      if (isSummaryOpen()) return;

      const t = ev.target && ev.target.closest
        ? ev.target.closest('.gjpu-item,.gj-item,.food,.target,[data-kind],[data-food-type],[data-type]')
        : null;

      if (!t) return;
      if (t.closest && t.closest('.gjpu-card,.gj-powerup-card')) return;

      applyShieldProtection();
      applyFeverScoreBoost();
    }, true);

    document.addEventListener('click', function(ev){
      if (isSummaryOpen()) return;

      const t = ev.target && ev.target.closest
        ? ev.target.closest('.gjpu-item,.gj-item,.food,.target,[data-kind],[data-food-type],[data-type]')
        : null;

      if (!t) return;
      if (t.closest && t.closest('.gjpu-card,.gj-powerup-card')) return;

      const kind = targetKind(t);

      if (kind === 'good'){
        if (!POWER.shield.ready && !POWER.shield.active && Math.random() < 0.12){
          grantPower('shield', 'good-hit-random');
        }

        if (!POWER.magnet.ready && !POWER.magnet.active && Math.random() < 0.10){
          grantPower('magnet', 'good-hit-random');
        }

        if (!POWER.fever.ready && !POWER.fever.active && Math.random() < 0.10){
          grantPower('fever', 'good-hit-random');
        }
      }

      if (kind === 'junk' || kind === 'fake'){
        applyShieldProtection();
      }
    }, true);
  }

  function patchSummaryStoredData(){
    window.addEventListener('gj:reward-summary-shown', function(ev){
      const detail = ev && ev.detail ? ev.detail : {};

      try{
        const prev = JSON.parse(localStorage.getItem('GJ_SOLO_BOSS_LAST_SUMMARY') || '{}') || {};
        localStorage.setItem('GJ_SOLO_BOSS_LAST_SUMMARY', JSON.stringify(Object.assign({}, prev, detail, {
          patchPowerups: PATCH,
          powerupsUsed: {
            shield: POWER.shield.used,
            magnet: POWER.magnet.used,
            fever: POWER.fever.used
          },
          savedAt: new Date().toISOString()
        })));
      }catch(_){}
    });
  }

  function injectStyles(){
    if ($('#gjMobilePowerupsEffectBindCss')) return;

    const css = document.createElement('style');
    css.id = 'gjMobilePowerupsEffectBindCss';
    css.textContent = `
      .gjpu-root,
      .gj-powerup-root{
        pointer-events:none !important;
      }

      .gjpu-card,
      .gj-powerup-card,
      [data-power],
      [data-powerup]{
        pointer-events:auto !important;
        user-select:none !important;
        touch-action:manipulation !important;
      }

      .gjpu-card.ready,
      .gj-powerup-card.ready,
      [data-gj-power-state="ready"]{
        border-color:rgba(34,197,94,.85) !important;
        box-shadow:0 0 0 3px rgba(34,197,94,.18),0 12px 26px rgba(15,23,42,.16) !important;
        opacity:1 !important;
      }

      .gjpu-card.active,
      .gjpu-card.on,
      .gj-powerup-card.active,
      .gj-powerup-card.on,
      [data-gj-power-state="active"]{
        border-color:rgba(34,197,94,.95) !important;
        box-shadow:0 0 0 4px rgba(34,197,94,.24),0 0 22px rgba(34,197,94,.38) !important;
        opacity:1 !important;
      }

      .gjpu-card.off,
      .gj-powerup-card.off,
      [data-gj-power-state="off"]{
        opacity:.76 !important;
      }
    `;
    document.head.appendChild(css);
  }

  function boot(){
    injectStyles();
    bindPowerCards();
    watchTargetHits();
    patchSummaryStoredData();

    let count = 0;

    const timer = setInterval(function(){
      count++;

      if (isCooldownPage()){
        clearInterval(timer);
        return;
      }

      bindPowerCards();
      detectPowerReadyFromUi();
      syncCards();
      runMagnetAssist();

      if (count > 7200){
        clearInterval(timer);
      }
    }, CONFIG.scanMs);

    window.GJ_MOBILE_POWERUPS_EFFECT_BIND_CHECK = function(){
      const snap = {
        patch: PATCH,
        view: view || 'unknown',
        score: getScore(),
        lives: getLives(),
        power: JSON.parse(JSON.stringify(POWER)),
        cards: powerCards().map(function(card){
          return {
            type: typeOfCard(card),
            text: String(card.textContent || '').replace(/\s+/g,' ').trim(),
            state: card.dataset.gjPowerState || '',
            classes: String(card.className || '')
          };
        }),
        targets: targetNodes().length,
        summaryOpen: isSummaryOpen()
      };

      console.log('[GJ_MOBILE_POWERUPS_EFFECT_BIND_CHECK]', snap);
      return snap;
    };

    console.info('[GoodJunk Mobile Powerups Effect Bind Final]', PATCH, 'loaded');
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot, {once:true});
  }else{
    boot();
  }
})();
