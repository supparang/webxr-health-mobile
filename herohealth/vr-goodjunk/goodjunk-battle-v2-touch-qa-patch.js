(function GoodJunkBattleV2TouchQAPatch(){
  'use strict';

  const PATCH_VERSION = 'v2.4.44-touch-scroll-hit-qa-patch';

  const isBattlePage = /goodjunk-battle-v2-run/i.test(location.pathname) || !!window.GJ_BATTLE_RUNTIME || !!window.GJ_BATTLE_CORE;
  if (!isBattlePage) return;

  const url = new URL(location.href);
  const params = url.searchParams;
  const view = String(params.get('view') || params.get('device') || window.GJ_VIEW || '').toLowerCase();
  const isMobileLike = view === 'mobile' || view === 'cardboard' || view === 'cvr' || view === 'vr' || /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '');

  function $(sel, root){ return (root || document).querySelector(sel); }
  function $all(sel, root){ return Array.from((root || document).querySelectorAll(sel)); }

  function injectStyle(){
    if ($('#gjBattleTouchQAPatchStyle')) return;
    const style = document.createElement('style');
    style.id = 'gjBattleTouchQAPatchStyle';
    style.textContent = `
      html.gj-battle-touch-qa,
      html.gj-battle-touch-qa body{ overscroll-behavior:none !important; }

      html.gj-battle-touch-qa .arena,
      html.gj-battle-touch-qa .arena-wrap,
      html.gj-battle-touch-qa .target,
      html.gj-battle-touch-qa .tap-zone{
        touch-action:none !important;
        -webkit-user-select:none !important;
        user-select:none !important;
        -webkit-touch-callout:none !important;
      }

      html.gj-battle-touch-qa .target{ pointer-events:auto !important; }
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
    return !!target.closest('button:not(.target):not(.tap-zone), a, input, select, textarea, [data-back-lobby], [data-back-hub], [data-all-modes], [data-nutrition-zone], .result-overlay');
  }

  function lockScrollInsideArena(){
    const arena = $('#arena') || $('.arena');
    if (!arena) return;

    const block = function(ev){
      if (!isGameplayActive()) return;
      if (isInsideInteractiveControl(ev.target)) return;
      const inArena = ev.target === arena || arena.contains(ev.target);
      if (!inArena) return;
      ev.preventDefault();
    };

    arena.addEventListener('touchmove', block, {passive:false});
    arena.addEventListener('pointermove', function(ev){
      if (!isGameplayActive()) return;
      if (ev.pointerType === 'touch') ev.preventDefault();
    }, {passive:false});

    document.addEventListener('gesturestart', function(ev){
      if (!isGameplayActive()) return;
      ev.preventDefault();
    }, {passive:false});
  }

  function getPointFromEvent(ev){
    if (ev.touches && ev.touches[0]) return {x:ev.touches[0].clientX, y:ev.touches[0].clientY};
    if (ev.changedTouches && ev.changedTouches[0]) return {x:ev.changedTouches[0].clientX, y:ev.changedTouches[0].clientY};
    return {x:ev.clientX, y:ev.clientY};
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
      const tolerance = Math.max(28, Math.min(52, rect.width * 0.65));

      if (d <= tolerance && d < bestDist){
        best = target;
        bestDist = d;
      }
    });

    return best;
  }

  function synthesizeTargetHit(target){
    if (!target || target.classList.contains('hit')) return false;
    try{ target.click(); return true; }catch(_){}
    return false;
  }

  function improveTargetHitArea(){
    const arena = $('#arena') || $('.arena');
    if (!arena) return;

    ['pointerdown','touchstart'].forEach(function(type){
      arena.addEventListener(type, function(ev){
        if (!isGameplayActive()) return;
        if (isInsideInteractiveControl(ev.target)) return;
        if (ev.target && ev.target.classList && ev.target.classList.contains('target')) return;

        const p = getPointFromEvent(ev);
        const target = findNearestTarget(p.x, p.y);
        if (target){
          ev.preventDefault();
          ev.stopPropagation();
          synthesizeTargetHit(target);
        }
      }, {passive:false, capture:true});
    });
  }

  function boot(){
    document.documentElement.classList.add('gj-battle-touch-qa');
    injectStyle();
    lockScrollInsideArena();
    improveTargetHitArea();

    window.GJ_BATTLE_TOUCH_QA_PATCH = {
      version: PATCH_VERSION,
      isMobileLike,
      isGameplayActive,
      findNearestTarget,
      synthesizeTargetHit
    };

    console.info('[GoodJunk Battle Touch QA Patch]', PATCH_VERSION, 'loaded');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once:true});
  else boot();
})();
