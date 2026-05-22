(function GoodJunkBattleV2TouchQAPatch(){
  'use strict';

  const PATCH_VERSION = 'v2.4.34-touch-scroll-hit-qa-patch';

  const isBattlePage =
    /goodjunk-battle-v2-run/i.test(location.pathname) ||
    !!window.GJ_BATTLE_RUNTIME ||
    !!window.GJ_BATTLE_CORE;

  if (!isBattlePage) return;

  const url = new URL(location.href);
  const params = url.searchParams;

  const view = String(
    params.get('view') ||
    params.get('device') ||
    window.GJ_VIEW ||
    ''
  ).toLowerCase();

  const isMobileLike =
    view === 'mobile' ||
    view === 'cardboard' ||
    view === 'cvr' ||
    view === 'vr' ||
    /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '');

  function $(sel, root){
    return (root || document).querySelector(sel);
  }

  function $all(sel, root){
    return Array.from((root || document).querySelectorAll(sel));
  }

  function emit(name, detail){
    try{
      window.dispatchEvent(new CustomEvent(name, {
        detail: Object.assign({
          version: PATCH_VERSION,
          at: Date.now()
        }, detail || {})
      }));
    }catch(_){}
  }

  function toast(msg){
    let el = $('#toast');

    if (!el){
      el = document.createElement('div');
      el.id = 'toast';
      el.style.cssText = [
        'position:fixed',
        'left:50%',
        'bottom:calc(84px + env(safe-area-inset-bottom))',
        'transform:translateX(-50%) translateY(16px)',
        'z-index:999999',
        'max-width:92vw',
        'padding:10px 14px',
        'border-radius:999px',
        'background:rgba(0,0,0,.82)',
        'color:#fff',
        'font:900 13px system-ui,sans-serif',
        'text-align:center',
        'opacity:0',
        'pointer-events:none',
        'transition:opacity .18s ease, transform .18s ease'
      ].join(';');
      document.body.appendChild(el);
    }

    el.textContent = msg;
    el.style.opacity = '1';
    el.style.transform = 'translateX(-50%) translateY(0)';

    clearTimeout(toast._t);
    toast._t = setTimeout(function(){
      el.style.opacity = '0';
      el.style.transform = 'translateX(-50%) translateY(16px)';
    }, 1200);
  }

  function injectStyle(){
    if ($('#gjBattleTouchQAPatchStyle')) return;

    const style = document.createElement('style');
    style.id = 'gjBattleTouchQAPatchStyle';
    style.textContent = `
      html.gj-battle-touch-qa,
      html.gj-battle-touch-qa body{
        overscroll-behavior:none !important;
      }

      html.gj-battle-touch-qa .arena,
      html.gj-battle-touch-qa .arena-wrap,
      html.gj-battle-touch-qa .target,
      html.gj-battle-touch-qa .tap-zone{
        touch-action:none !important;
        -webkit-user-select:none !important;
        user-select:none !important;
        -webkit-touch-callout:none !important;
      }

      html.gj-battle-touch-qa .target{
        pointer-events:auto !important;
      }

      html.gj-battle-touch-qa.gj-battle-mobile-compact .topbar{
        min-height:44px !important;
        padding-top:4px !important;
        padding-bottom:4px !important;
      }

      html.gj-battle-touch-qa.gj-battle-mobile-compact .hud-strip{
        min-height:42px !important;
      }

      html.gj-battle-touch-qa.gj-battle-mobile-compact .hud-card{
        padding-top:3px !important;
        padding-bottom:3px !important;
      }

      html.gj-battle-touch-qa.gj-battle-mobile-compact .opponent-mini{
        min-height:32px !important;
        padding-top:3px !important;
        padding-bottom:3px !important;
      }

      html.gj-battle-touch-qa.gj-battle-mobile-compact .battle-actions{
        padding:4px !important;
        gap:4px !important;
      }

      html.gj-battle-touch-qa.gj-battle-mobile-compact .skill-btn{
        min-height:38px !important;
        padding-top:4px !important;
        padding-bottom:4px !important;
      }

      html.gj-battle-touch-qa.gj-battle-mobile-compact .power-row{
        min-height:24px !important;
        padding-top:3px !important;
        padding-bottom:3px !important;
      }

      html.gj-battle-touch-qa .gj-hit-proxy{
        position:absolute;
        z-index:14;
        border-radius:50%;
        pointer-events:auto;
        background:transparent;
        transform:translate(-50%,-50%);
      }
    `;

    document.head.appendChild(style);
  }

  function isGameplayActive(){
    const runtime = window.GJ_BATTLE_RUNTIME;
    const rs = runtime && runtime.state ? runtime.state : null;

    if (!rs) return true;
    if (rs.ended) return false;
    if (rs.running === false) return false;

    return true;
  }

  function isInsideInteractiveControl(target){
    if (!target) return false;

    return !!target.closest(
      'button:not(.target):not(.tap-zone), a, input, select, textarea, [data-back-lobby], [data-back-hub], [data-all-modes], [data-nutrition-zone], .result-overlay'
    );
  }

  function lockScrollInsideArena(){
    const arena = $('#arena') || $('.arena');
    if (!arena) return;

    const block = function(ev){
      if (!isGameplayActive()) return;
      if (isInsideInteractiveControl(ev.target)) return;

      const inArena =
        ev.target === arena ||
        arena.contains(ev.target);

      if (!inArena) return;

      ev.preventDefault();
    };

    arena.addEventListener('touchmove', block, { passive:false });
    arena.addEventListener('pointermove', function(ev){
      if (!isGameplayActive()) return;
      if (ev.pointerType === 'touch'){
        ev.preventDefault();
      }
    }, { passive:false });

    document.addEventListener('gesturestart', function(ev){
      if (!isGameplayActive()) return;
      ev.preventDefault();
    }, { passive:false });

    document.addEventListener('touchmove', function(ev){
      if (!isGameplayActive()) return;
      if (!isMobileLike) return;
      if (isInsideInteractiveControl(ev.target)) return;

      const arenaNow = $('#arena') || $('.arena');
      if (arenaNow && arenaNow.contains(ev.target)){
        ev.preventDefault();
      }
    }, { passive:false });
  }

  function getPointFromEvent(ev){
    if (ev.touches && ev.touches[0]){
      return {
        x: ev.touches[0].clientX,
        y: ev.touches[0].clientY
      };
    }

    if (ev.changedTouches && ev.changedTouches[0]){
      return {
        x: ev.changedTouches[0].clientX,
        y: ev.changedTouches[0].clientY
      };
    }

    return {
      x: ev.clientX,
      y: ev.clientY
    };
  }

  function findNearestTarget(clientX, clientY){
    const targets = $all('.target:not(.hit)');
    if (!targets.length) return null;

    let best = null;
    let bestDist = Infinity;

    targets.forEach(function(target){
      const rect = target.getBoundingClientRect();

      if (!rect.width || !rect.height) return;

      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const d = Math.hypot(cx - clientX, cy - clientY);

      const tolerance = Math.max(28, Math.min(46, rect.width * 0.55));

      if (d <= tolerance && d < bestDist){
        best = target;
        bestDist = d;
      }
    });

    return best;
  }

  function synthesizeTargetHit(target){
    if (!target || target.classList.contains('hit')) return false;

    try{
      target.dispatchEvent(new PointerEvent('pointerdown', {
        bubbles:true,
        cancelable:true,
        pointerId:1,
        pointerType:'touch',
        isPrimary:true,
        clientX:target.getBoundingClientRect().left + target.getBoundingClientRect().width / 2,
        clientY:target.getBoundingClientRect().top + target.getBoundingClientRect().height / 2
      }));
      return true;
    }catch(_){}

    try{
      target.click();
      return true;
    }catch(_){}

    return false;
  }

  function improveTargetHitArea(){
    const arena = $('#arena') || $('.arena');
    if (!arena) return;

    arena.addEventListener('pointerdown', function(ev){
      if (!isGameplayActive()) return;
      if (isInsideInteractiveControl(ev.target)) return;

      if (ev.target && ev.target.classList && ev.target.classList.contains('target')){
        return;
      }

      const p = getPointFromEvent(ev);
      const target = findNearestTarget(p.x, p.y);

      if (target){
        ev.preventDefault();
        ev.stopPropagation();
        synthesizeTargetHit(target);
      }
    }, { passive:false, capture:true });

    arena.addEventListener('touchstart', function(ev){
      if (!isGameplayActive()) return;
      if (isInsideInteractiveControl(ev.target)) return;

      const p = getPointFromEvent(ev);
      const target = findNearestTarget(p.x, p.y);

      if (target){
        ev.preventDefault();
        ev.stopPropagation();
        synthesizeTargetHit(target);
      }
    }, { passive:false, capture:true });
  }

  function compactMobileLayout(){
    if (!isMobileLike) return;

    document.documentElement.classList.add('gj-battle-mobile-compact');

    const app = $('#app') || $('.app');
    const arenaWrap = $('.arena-wrap');

    if (!app || !arenaWrap) return;

    function fit(){
      if (!isMobileLike) return;

      const vh = window.innerHeight || document.documentElement.clientHeight || 640;
      const topbar = $('.topbar');
      const hud = $('.hud-strip');
      const opponent = $('.opponent-mini');
      const bottom = $('.bottom-zone');

      const used =
        (topbar ? topbar.getBoundingClientRect().height : 0) +
        (hud ? hud.getBoundingClientRect().height : 0) +
        (opponent ? opponent.getBoundingClientRect().height : 0) +
        (bottom ? bottom.getBoundingClientRect().height : 0) +
        28;

      const minArena = Math.max(250, Math.floor(vh * 0.46));
      const maxArena = Math.max(minArena, vh - used);

      arenaWrap.style.minHeight = minArena + 'px';
      arenaWrap.style.height = Math.max(minArena, maxArena) + 'px';
    }

    fit();
    window.addEventListener('resize', function(){
      setTimeout(fit, 120);
    });

    window.addEventListener('orientationchange', function(){
      setTimeout(fit, 300);
    });
  }

  function fixCardboardTapPriority(){
    const tapZone = $('#tapZone');
    const arena = $('#arena') || $('.arena');

    if (!tapZone || !arena) return;

    tapZone.addEventListener('pointerdown', function(ev){
      if (!isGameplayActive()) return;

      ev.preventDefault();
      ev.stopPropagation();

      if (
        window.GJ_BATTLE_RUNTIME &&
        typeof window.GJ_BATTLE_RUNTIME.shootCrosshair === 'function'
      ){
        window.GJ_BATTLE_RUNTIME.shootCrosshair();
      }
    }, { passive:false, capture:true });
  }

  function observeTargets(){
    const arena = $('#arena') || $('.arena');
    if (!arena || !window.MutationObserver) return;

    const mo = new MutationObserver(function(){
      $all('.target').forEach(function(t){
        if (t.dataset.gjTouchQaBound === '1') return;
        t.dataset.gjTouchQaBound = '1';

        t.addEventListener('touchstart', function(ev){
          if (!isGameplayActive()) return;
          ev.preventDefault();
        }, { passive:false });

        t.addEventListener('pointerdown', function(ev){
          if (!isGameplayActive()) return;
          ev.stopPropagation();
        }, { passive:false });
      });
    });

    mo.observe(arena, {
      childList:true,
      subtree:true
    });
  }

  function patchNavigationSafety(){
    function preserveParams(out){
      [
        'pid','name','diff','time','view','hub','zone','cat',
        'room','roomCode','studyId','conditionGroup','api','log'
      ].forEach(function(k){
        if (out.searchParams.get(k)) return;
        const v = params.get(k);
        if (v !== null && v !== ''){
          out.searchParams.set(k, v);
        }
      });

      return out;
    }

    window.GJ_BATTLE_BUILD_SAFE_URL = function(path){
      const out = new URL(path, location.href);
      return preserveParams(out).toString();
    };
  }

  function boot(){
    document.documentElement.classList.add('gj-battle-touch-qa');

    injectStyle();
    lockScrollInsideArena();
    improveTargetHitArea();
    compactMobileLayout();
    fixCardboardTapPriority();
    observeTargets();
    patchNavigationSafety();

    window.GJ_BATTLE_TOUCH_QA_PATCH = {
      version: PATCH_VERSION,
      isMobileLike,
      isGameplayActive,
      findNearestTarget,
      synthesizeTargetHit,
      compactMobileLayout
    };

    emit('gj:battle-touch-qa-ready', {
      mobileLike:isMobileLike
    });

    console.info('[GoodJunk Battle Touch QA Patch]', PATCH_VERSION, 'loaded');
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  }else{
    boot();
  }
})();
