(function GoodJunkBattleV2RuntimeHitHardCapturePatch(){
  'use strict';

  const PATCH_VERSION = 'v2.4.43-runtime-hit-hard-capture';

  const isRun =
    /goodjunk-battle-v2-run/i.test(location.pathname) ||
    !!window.GJ_BATTLE_RUNTIME;

  if (!isRun) return;

  function $(sel, root){
    return (root || document).querySelector(sel);
  }

  function $all(sel, root){
    return Array.from((root || document).querySelectorAll(sel));
  }

  function now(){
    return Date.now();
  }

  function safeNum(v, fallback){
    const n = Number(v);
    return Number.isFinite(n) ? n : Number(fallback || 0);
  }

  function getState(){
    window.GJ_BATTLE_RUNTIME = window.GJ_BATTLE_RUNTIME || {};
    window.GJ_BATTLE_RUNTIME.state = window.GJ_BATTLE_RUNTIME.state || {};
    const s = window.GJ_BATTLE_RUNTIME.state;

    s.score = safeNum(s.score, 0);
    s.good = safeNum(s.good, 0);
    s.junk = safeNum(s.junk, 0);
    s.miss = safeNum(s.miss, 0);
    s.hearts = safeNum(s.hearts, 3);
    s.power = safeNum(s.power || s.attackPower, 0);
    s.ended = !!s.ended;

    return s;
  }

  function emit(name, detail){
    try{
      window.dispatchEvent(new CustomEvent(name, {
        detail: Object.assign({
          version: PATCH_VERSION,
          at: now()
        }, detail || {})
      }));
    }catch(_){}
  }

  function injectStyle(){
    if ($('#gjRuntimeHitHardCaptureStyle')) return;

    const style = document.createElement('style');
    style.id = 'gjRuntimeHitHardCaptureStyle';
    style.textContent = `
      .target{
        pointer-events:auto !important;
        cursor:pointer !important;
        z-index:999 !important;
        touch-action:none !important;
        user-select:none !important;
        -webkit-user-select:none !important;
      }

      .target.gj-hard-hit{
        opacity:0 !important;
        transform:translate(-50%,-50%) scale(1.25) !important;
      }

      #arena,
      .arena{
        touch-action:none !important;
      }
    `;
    document.head.appendChild(style);
  }

  function syncUi(){
    const s = getState();

    const scoreEl = $('#score,[data-score]');
    const timerEl = $('#timer,[data-time]');
    const heartsEl = $('#hearts,[data-hearts]');
    const goodEl = $('#goodCount');
    const junkEl = $('#junkCount');
    const missEl = $('#missCount');
    const powerEl = $('#attackCount');
    const battlePowerEl = $('#battlePower,[data-battle-power]');
    const powerFill = $('#powerFill');

    if (scoreEl) scoreEl.textContent = String(s.score);

    if (heartsEl){
      const h = Math.max(0, Math.min(3, s.hearts));
      heartsEl.textContent = '❤'.repeat(h) + '♡'.repeat(Math.max(0, 3 - h));
    }

    if (goodEl) goodEl.textContent = 'Good ' + s.good;
    if (junkEl) junkEl.textContent = 'Junk ' + s.junk;
    if (missEl) missEl.textContent = 'Miss ' + s.miss;

    const power = Math.max(0, Math.min(5, s.power));

    if (powerEl) powerEl.textContent = 'Power ' + power + '/5';
    if (battlePowerEl) battlePowerEl.textContent = 'พลัง ' + power + '/5';
    if (powerFill) powerFill.style.width = ((power / 5) * 100) + '%';

    window.GJ_BATTLE_STATE = Object.assign({}, window.GJ_BATTLE_STATE || {}, {
      score:s.score,
      myScore:s.score,
      points:s.score,
      good:s.good,
      junk:s.junk,
      miss:s.miss,
      hearts:s.hearts,
      hp:s.hearts,
      lives:s.hearts,
      power:s.power,
      attackPower:s.power,
      ended:s.ended
    });

    emit('gj:battle-state-updated', window.GJ_BATTLE_STATE);

    if (window.GJ_BATTLE_CORE && typeof window.GJ_BATTLE_CORE.forceRealtimeSync === 'function'){
      window.GJ_BATTLE_CORE.forceRealtimeSync('hard-hit-capture');
    }
  }

  function floatingText(text, target, good){
    const arena = $('#arena') || $('.arena');
    if (!arena || !target) return;

    const tRect = target.getBoundingClientRect();
    const aRect = arena.getBoundingClientRect();

    const x = ((tRect.left + tRect.width / 2 - aRect.left) / aRect.width) * 100;
    const y = ((tRect.top + tRect.height / 2 - aRect.top) / aRect.height) * 100;

    const el = document.createElement('div');
    el.textContent = text;
    el.style.cssText = [
      'position:absolute',
      'left:' + x + '%',
      'top:' + y + '%',
      'z-index:1200',
      'transform:translate(-50%,-50%)',
      'font-weight:1000',
      'font-size:20px',
      'pointer-events:none',
      'color:' + (good ? '#247a39' : '#9b2c22'),
      'text-shadow:0 2px 0 rgba(255,255,255,.8)'
    ].join(';');

    arena.appendChild(el);

    el.animate([
      { opacity:1, transform:'translate(-50%,-50%) scale(1)' },
      { opacity:0, transform:'translate(-50%,-120%) scale(1.18)' }
    ], {
      duration:650,
      easing:'ease-out',
      fill:'forwards'
    });

    setTimeout(function(){
      el.remove();
    }, 700);
  }

  function classifyTarget(target){
    const kind =
      target.dataset.kind ||
      target.dataset.type ||
      target.getAttribute('data-kind') ||
      target.getAttribute('data-type') ||
      '';

    if (String(kind).toLowerCase().includes('junk')) return 'junk';
    if (target.classList.contains('junk') || target.classList.contains('bad')) return 'junk';

    return 'good';
  }

  function hardHit(target, source){
    if (!target || target.classList.contains('gj-hard-hit') || target.classList.contains('hit')) return false;

    const s = getState();
    if (s.ended) return false;

    const kind = classifyTarget(target);

    target.classList.add('gj-hard-hit', 'hit');

    if (kind === 'good'){
      const gain = 10;
      s.good += 1;
      s.score += gain;
      s.power = Math.min(5, safeNum(s.power, 0) + 1);
      s.attackPower = s.power;

      floatingText('+' + gain, target, true);

      emit('gj:good-collected', {
        score:gain,
        power:1,
        kind:'good',
        source:source || 'hard-capture'
      });

      emit('hha:score', {
        type:'good',
        score:gain,
        points:gain
      });
    }else{
      s.junk += 1;
      s.miss += 1;
      s.hearts = Math.max(0, safeNum(s.hearts, 3) - 1);
      s.score = Math.max(0, safeNum(s.score, 0) - 4);

      floatingText('-❤', target, false);

      emit('gj:junk-hit', {
        damage:1,
        kind:'junk',
        source:source || 'hard-capture'
      });

      emit('hha:miss', {
        type:'junk',
        damage:1
      });
    }

    syncUi();

    setTimeout(function(){
      target.remove();
    }, 90);

    return true;
  }

  function findNearestTarget(clientX, clientY){
    const targets = $all('.target:not(.hit):not(.gj-hard-hit)');
    let best = null;
    let bestDist = Infinity;

    targets.forEach(function(t){
      const r = t.getBoundingClientRect();
      if (!r.width || !r.height) return;

      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const d = Math.hypot(cx - clientX, cy - clientY);

      if (d < bestDist){
        best = t;
        bestDist = d;
      }
    });

    if (best && bestDist <= 68) return best;
    return null;
  }

  function bindTarget(target){
    if (!target || target.dataset.gjHardCaptureBound === '1') return;

    target.dataset.gjHardCaptureBound = '1';
    target.style.pointerEvents = 'auto';

    ['pointerdown','mousedown','touchstart','click'].forEach(function(type){
      target.addEventListener(type, function(ev){
        ev.preventDefault();
        ev.stopImmediatePropagation();
        hardHit(target, type);
      }, {
        passive:false,
        capture:true
      });
    });
  }

  function bindExistingTargets(){
    $all('.target').forEach(bindTarget);
  }

  function observeTargets(){
    const arena = $('#arena') || $('.arena') || document.body;
    if (!window.MutationObserver) return;

    const mo = new MutationObserver(bindExistingTargets);
    mo.observe(arena, {
      childList:true,
      subtree:true
    });
  }

  function bindArenaCapture(){
    const arena = $('#arena') || $('.arena');
    if (!arena || arena.dataset.gjHardCaptureArena === '1') return;

    arena.dataset.gjHardCaptureArena = '1';

    ['pointerdown','mousedown','touchstart','click'].forEach(function(type){
      arena.addEventListener(type, function(ev){
        const targetEl =
          ev.target &&
          ev.target.classList &&
          ev.target.classList.contains('target')
            ? ev.target
            : findNearestTarget(
                ev.clientX || (ev.touches && ev.touches[0] && ev.touches[0].clientX) || 0,
                ev.clientY || (ev.touches && ev.touches[0] && ev.touches[0].clientY) || 0
              );

        if (!targetEl) return;

        ev.preventDefault();
        ev.stopImmediatePropagation();
        hardHit(targetEl, 'arena-' + type);
      }, {
        passive:false,
        capture:true
      });
    });
  }

  function boot(){
    injectStyle();
    bindExistingTargets();
    observeTargets();
    bindArenaCapture();

    window.GJ_BATTLE_RUNTIME_HIT_HARD_CAPTURE = {
      version: PATCH_VERSION,
      hardHit,
      syncUi,
      bindExistingTargets,
      findNearestTarget
    };

    console.info('[GoodJunk Battle Runtime Hit Hard Capture]', PATCH_VERSION, 'loaded');
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  }else{
    boot();
  }
})();
