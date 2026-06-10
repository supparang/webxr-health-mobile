// === /herohealth/vr-goodjunk/goodjunk-solo-boss-play-area-bounds-v852f.js ===
// PATCH v20260610-GOODJUNK-PLAY-AREA-BOUNDS-V852F
// Fix:
// - ล็อกพื้นที่ gameplay ไม่ให้กินถึงโซนบนสุด
// - กัน item/target ไปโผล่บนหัวจอ
// - clamp ตำแหน่งของ .gjpu-item ให้อยู่ใน play area เท่านั้น

(function(){
  'use strict';

  const PATCH = 'v20260610-GOODJUNK-PLAY-AREA-BOUNDS-V852F';

  if (window.__GJ_PLAY_AREA_BOUNDS_V852F__) return;
  window.__GJ_PLAY_AREA_BOUNDS_V852F__ = true;

  function byId(id){
    return document.getElementById(id);
  }

  function qa(sel, root){
    return Array.from((root || document).querySelectorAll(sel));
  }

  function clamp(v, min, max){
    return Math.max(min, Math.min(max, v));
  }

  function px(v){
    return Math.round(v) + 'px';
  }

  function isMobile(){
    return window.innerWidth <= 720;
  }

  function ensureStyle(){
    if (byId('gjPlayAreaBoundsStyleV852F')) return;

    const style = document.createElement('style');
    style.id = 'gjPlayAreaBoundsStyleV852F';
    style.textContent = `
      body.gj-play-area-bounds-v852f #gjSoloBossArea{
        position:absolute !important;
        left:0 !important;
        right:0 !important;
        overflow:hidden !important;
      }

      body.gj-play-area-bounds-v852f #gjSoloBossArea .gjm-lane{
        height:100% !important;
        bottom:0 !important;
        background:linear-gradient(180deg,rgba(255,255,255,.02),rgba(34,197,94,.12)) !important;
      }
    `;
    document.head.appendChild(style);
  }

  function getHudBottom(){
    const hud = byId('gjmHud');
    if (!hud) return isMobile() ? 72 : 86;
    const r = hud.getBoundingClientRect();
    return Math.max(0, r.bottom);
  }

  function getBottomUiTop(){
    const selectors = [
      '#gjBossHud',
      '#gjBossPanel',
      '#gjDirectorCard',
      '.gj-boss',
      '.boss',
      '.boss-panel',
      '.fair-director',
      '.gj-director',
      '[data-gj-boss-hud]',
      '[data-gj-director]'
    ];

    const tops = [];

    selectors.forEach(function(sel){
      qa(sel).forEach(function(el){
        const r = el.getBoundingClientRect();
        if (r.height > 20 && r.top < window.innerHeight) {
          tops.push(r.top);
        }
      });
    });

    if (tops.length) return Math.min.apply(null, tops);

    return window.innerHeight - (isMobile() ? 170 : 150);
  }

  function desiredBounds(){
    const hudBottom = getHudBottom();

    // เว้นหัว HUD ด้านบน
    const top = Math.max(isMobile() ? 96 : 112, hudBottom + 10);

    // เว้น director + boss panel ด้านล่าง
    const uiTop = getBottomUiTop();
    const bottom = Math.min(
      window.innerHeight - (isMobile() ? 150 : 130),
      uiTop - 10
    );

    return {
      top,
      bottom: Math.max(top + 220, bottom)
    };
  }

  function applyAreaBounds(){
    const area = byId('gjSoloBossArea');
    const root = byId('gjSoloBossMain');
    if (!area || !root) return;

    const b = desiredBounds();
    const bottomInset = Math.max(0, window.innerHeight - b.bottom);

    area.style.top = px(b.top);
    area.style.bottom = px(bottomInset);
    area.style.left = '0';
    area.style.right = '0';
    area.style.overflow = 'hidden';

    area.dataset.gjPlayAreaPatch = PATCH;
    document.body.classList.add('gj-play-area-bounds-v852f');
  }

  function isFoodItem(el){
    if (!el || !el.isConnected) return false;

    if (
      el.matches('.gjpu-item') ||
      el.matches('[data-food-kind]') ||
      el.matches('[data-food-type]') ||
      el.matches('[data-kind]') ||
      el.matches('[data-type]') ||
      el.matches('[data-good]') ||
      el.matches('[data-junk]') ||
      el.matches('[data-fake]')
    ){
      return true;
    }

    return false;
  }

  function clampItemIntoArea(el){
    const area = byId('gjSoloBossArea');
    if (!area || !el || !isFoodItem(el)) return;
    if (!area.contains(el)) return;

    const areaRect = area.getBoundingClientRect();
    const r = el.getBoundingClientRect();

    const itemH = Math.max(el.offsetHeight || r.height || 68, 52);
    const itemW = Math.max(el.offsetWidth || r.width || 62, 44);

    const minTop = 6;
    const maxTop = Math.max(minTop, areaRect.height - itemH - 6);

    const minLeft = 6;
    const maxLeft = Math.max(minLeft, areaRect.width - itemW - 6);

    let currentTop = parseFloat(el.style.top);
    let currentLeft = parseFloat(el.style.left);

    if (!Number.isFinite(currentTop)) {
      currentTop = r.top - areaRect.top;
    }
    if (!Number.isFinite(currentLeft)) {
      currentLeft = r.left - areaRect.left;
    }

    const fixedTop = clamp(currentTop, minTop, maxTop);
    const fixedLeft = clamp(currentLeft, minLeft, maxLeft);

    const moved =
      Math.abs(fixedTop - currentTop) > 0.5 ||
      Math.abs(fixedLeft - currentLeft) > 0.5;

    if (moved) {
      el.style.top = px(fixedTop);
      el.style.left = px(fixedLeft);
      el.style.bottom = 'auto';
      el.style.right = 'auto';
    }
  }

  function clampAllItems(){
    qa('.gjpu-item,[data-food-kind],[data-food-type],[data-kind],[data-type],[data-good],[data-junk],[data-fake]')
      .forEach(clampItemIntoArea);
  }

  function bindStartCleanup(){
    const btn = byId('gjmStartBtn');
    const overlay = byId('gjmStartOverlay');

    if (!btn || btn.dataset.gjBoundsBound === '1') return;
    btn.dataset.gjBoundsBound = '1';

    btn.addEventListener('click', function(){
      setTimeout(function(){
        if (overlay){
          overlay.style.display = 'none';
          overlay.style.pointerEvents = 'none';
        }
        applyAreaBounds();
        clampAllItems();
      }, 80);

      setTimeout(function(){
        applyAreaBounds();
        clampAllItems();
      }, 320);
    }, true);
  }

  function observe(){
    const area = byId('gjSoloBossArea') || document.body;
    if (!area) return;

    const mo = new MutationObserver(function(mutations){
      let shouldClamp = false;

      mutations.forEach(function(m){
        if (m.type === 'childList') {
          m.addedNodes.forEach(function(node){
            if (node && node.nodeType === 1) {
              if (isFoodItem(node)) shouldClamp = true;
              qa('.gjpu-item,[data-food-kind],[data-food-type],[data-kind],[data-type],[data-good],[data-junk],[data-fake]', node)
                .forEach(function(){ shouldClamp = true; });
            }
          });
        }

        if (m.type === 'attributes') {
          const t = m.target;
          if (t && t.nodeType === 1 && isFoodItem(t)) {
            shouldClamp = true;
          }
        }
      });

      if (shouldClamp) {
        requestAnimationFrame(function(){
          applyAreaBounds();
          clampAllItems();
        });
      }
    });

    mo.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class']
    });
  }

  function boot(){
    ensureStyle();
    applyAreaBounds();
    clampAllItems();
    bindStartCleanup();
    observe();

    window.addEventListener('resize', function(){
      applyAreaBounds();
      clampAllItems();
    });

    window.addEventListener('orientationchange', function(){
      setTimeout(function(){
        applyAreaBounds();
        clampAllItems();
      }, 200);
    });

    setTimeout(function(){
      applyAreaBounds();
      clampAllItems();
    }, 300);

    setTimeout(function(){
      applyAreaBounds();
      clampAllItems();
    }, 1000);

    console.log('[GJ Play Area Bounds V852F] installed:', PATCH);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  } else {
    boot();
  }
})();