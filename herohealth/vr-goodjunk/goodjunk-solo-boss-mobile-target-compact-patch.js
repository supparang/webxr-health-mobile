(function GoodJunkSoloBossMobileTargetCompactPatch(){
  'use strict';

  const PATCH_VERSION = 'v8.47.0-solo-boss-mobile-target-compact';

  const path = location.pathname || '';
  const qs = new URL(location.href).searchParams;

  /*
   * ใช้กับ Solo / Solo Boss เท่านั้น
   * กันไม่ให้ไปกระทบ Battle / Race / Duet / Coop
   */
  const isBlockedMode =
    /battle|race|duet|coop|lobby/i.test(path) ||
    /battle|race|duet|coop/i.test(qs.get('mode') || '');

  if (isBlockedMode) return;

  function $(sel, root){
    return (root || document).querySelector(sel);
  }

  function $all(sel, root){
    return Array.from((root || document).querySelectorAll(sel));
  }

  function isMobile(){
    return (
      window.matchMedia &&
      window.matchMedia('(max-width: 760px)').matches
    ) || /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '');
  }

  function injectStyle(){
    if ($('#gjSoloBossMobileTargetCompactStyle')) return;

    const style = document.createElement('style');
    style.id = 'gjSoloBossMobileTargetCompactStyle';
    style.textContent = `
      @media (max-width: 760px){
        html.gj-solo-target-compact .target,
        html.gj-solo-target-compact .food-target,
        html.gj-solo-target-compact .gj-target,
        html.gj-solo-target-compact .food-card,
        html.gj-solo-target-compact [data-food-target],
        html.gj-solo-target-compact .spawn-item{
          width: clamp(66px, 17.5vw, 82px) !important;
          min-width: clamp(66px, 17.5vw, 82px) !important;
          max-width: 82px !important;

          height: clamp(76px, 20vw, 94px) !important;
          min-height: clamp(76px, 20vw, 94px) !important;
          max-height: 94px !important;

          padding: 7px 6px !important;
          border-radius: 18px !important;
          border-width: 4px !important;
          box-shadow: 0 8px 18px rgba(45, 60, 90, .13) !important;
        }

        html.gj-solo-target-compact .target img,
        html.gj-solo-target-compact .food-target img,
        html.gj-solo-target-compact .gj-target img,
        html.gj-solo-target-compact .food-card img,
        html.gj-solo-target-compact [data-food-target] img,
        html.gj-solo-target-compact .spawn-item img{
          width: clamp(36px, 9.6vw, 48px) !important;
          height: clamp(36px, 9.6vw, 48px) !important;
          max-width: 48px !important;
          max-height: 48px !important;
          object-fit: contain !important;
          margin: 0 auto 3px !important;
        }

        html.gj-solo-target-compact .target .label,
        html.gj-solo-target-compact .food-target .label,
        html.gj-solo-target-compact .gj-target .label,
        html.gj-solo-target-compact .food-card .label,
        html.gj-solo-target-compact [data-food-target] .label,
        html.gj-solo-target-compact .spawn-item .label,
        html.gj-solo-target-compact .target-name,
        html.gj-solo-target-compact .food-name{
          font-size: clamp(10.5px, 2.85vw, 12.5px) !important;
          line-height: 1.12 !important;
          max-height: 2.3em !important;
          overflow: hidden !important;
        }

        html.gj-solo-target-compact .target{
          touch-action: manipulation !important;
        }

        /*
         * กันเป้าหลุดขอบจอ/เข้าใต้ overlay
         */
        html.gj-solo-target-compact .gj-compact-clamped{
          transition: left .12s ease, top .12s ease, transform .12s ease !important;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function getArena(){
    return (
      $('#arena') ||
      $('.arena') ||
      $('#gameArea') ||
      $('.game-area') ||
      $('#playArea') ||
      $('.play-area') ||
      document.body
    );
  }

  function looksLikeTarget(el){
    if (!el || !el.classList) return false;

    if (
      el.matches('.target,.food-target,.gj-target,.food-card,[data-food-target],.spawn-item')
    ){
      return true;
    }

    return false;
  }

  function clampPercent(value, min, max){
    const n = Number(String(value || '').replace('%',''));
    if (!Number.isFinite(n)) return null;
    return Math.max(min, Math.min(max, n));
  }

  function clampTarget(el){
    if (!isMobile() || !looksLikeTarget(el)) return;

    /*
     * mobile safe area:
     * x ไม่ให้ชิดขวาเกินไป
     * y กัน mission/toast ด้านบน และ boss/fair director/skill ด้านล่าง
     */
    const SAFE = {
      minX: 14,
      maxX: 76,
      minY: 22,
      maxY: 60
    };

    const left = el.style.left;
    const top = el.style.top;

    const lx = clampPercent(left, SAFE.minX, SAFE.maxX);
    const ty = clampPercent(top, SAFE.minY, SAFE.maxY);

    if (lx !== null){
      el.style.left = lx + '%';
    }

    if (ty !== null){
      el.style.top = ty + '%';
    }

    el.classList.add('gj-compact-clamped');
  }

  function compactExistingTargets(){
    if (!isMobile()) return;

    document.documentElement.classList.add('gj-solo-target-compact');

    $all('.target,.food-target,.gj-target,.food-card,[data-food-target],.spawn-item')
      .forEach(clampTarget);
  }

  function observeTargets(){
    const arena = getArena();
    if (!arena || !window.MutationObserver) return;

    if (arena.dataset.gjSoloCompactObserved === '1') return;
    arena.dataset.gjSoloCompactObserved = '1';

    const mo = new MutationObserver(function(mutations){
      mutations.forEach(function(m){
        Array.from(m.addedNodes || []).forEach(function(node){
          if (!(node instanceof HTMLElement)) return;

          if (looksLikeTarget(node)){
            clampTarget(node);
          }

          $all('.target,.food-target,.gj-target,.food-card,[data-food-target],.spawn-item', node)
            .forEach(clampTarget);
        });
      });
    });

    mo.observe(arena, {
      childList: true,
      subtree: true
    });
  }

  function patchRandomSpawnHelpers(){
    /*
     * ถ้าไฟล์หลักมี helper randomPercent / spawn config บางชื่อ
     * ให้ตั้งค่า safe area กลาง ๆ ไว้เป็น global เผื่อโค้ดหลักอ่านได้
     */
    window.GJ_SOLO_BOSS_MOBILE_TARGET_COMPACT = {
      version: PATCH_VERSION,
      safeSpawnMobile: {
        minX: 14,
        maxX: 76,
        minY: 22,
        maxY: 60
      },
      targetSizeMobile: {
        minW: 66,
        maxW: 82,
        minH: 76,
        maxH: 94
      },
      compactExistingTargets,
      clampTarget
    };
  }

  function boot(){
    injectStyle();
    patchRandomSpawnHelpers();

    if (isMobile()){
      compactExistingTargets();
      observeTargets();

      setInterval(compactExistingTargets, 900);
    }

    console.info('[GoodJunk Solo Boss Mobile Target Compact]', PATCH_VERSION, 'loaded');
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  }else{
    boot();
  }
})();