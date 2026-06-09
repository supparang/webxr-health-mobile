/* === /herohealth/vr-goodjunk/goodjunk-solo-boss-hit-dedupe-v851a.js === */
/* PATCH v20260608-v851a
   Purpose:
   - กัน goodHits / boss hit นับซ้ำจาก pointerdown + click + touch
   - ใช้ hitKey ต่อการ์ดอาหาร 1 ใบ = นับได้ครั้งเดียว
   - กัน summary อ่านค่า good เกินจริง
*/
(function(){
  'use strict';

  const PATCH = 'v20260608-GOODJUNK-HIT-DEDUPE-V851A';

  if (window.__GJ_HIT_DEDUPE_V851A__) {
    console.warn('[GoodJunk hit dedupe] already installed');
    return;
  }
  window.__GJ_HIT_DEDUPE_V851A__ = true;

  const seen = new Map();
  const TTL = 900;

  function now(){
    return Date.now ? Date.now() : new Date().getTime();
  }

  function cleanup(){
    const t = now();
    seen.forEach(function(v, k){
      if (t - v > TTL) seen.delete(k);
    });
  }

  function textOf(el){
    return String(
      (el && (el.innerText || el.textContent || el.getAttribute('aria-label') || el.title)) || ''
    ).replace(/\s+/g, ' ').trim();
  }

  function itemFromEventTarget(target){
    if (!target || !target.closest) return null;

    return target.closest(
      '.gjpu-item,' +
      '.gjm-food,' +
      '.food,' +
      '.food-card,' +
      '[data-food-id],' +
      '[data-food],' +
      '[data-kind],' +
      '[data-type],' +
      '[data-role="food"]'
    );
  }

  function classify(el){
    if (!el) return 'unknown';

    const raw = [
      el.dataset && el.dataset.kind,
      el.dataset && el.dataset.type,
      el.dataset && el.dataset.foodType,
      el.dataset && el.dataset.role,
      el.dataset && el.dataset.category,
      el.className,
      textOf(el)
    ].join(' ').toLowerCase();

    if (
      raw.includes('junk') ||
      raw.includes('bad') ||
      raw.includes('trash') ||
      raw.includes('ขยะ') ||
      raw.includes('หวาน') ||
      raw.includes('มัน') ||
      raw.includes('เค็ม')
    ) return 'junk';

    if (
      raw.includes('fake') ||
      raw.includes('trap') ||
      raw.includes('decoy') ||
      raw.includes('หลอก')
    ) return 'fake';

    if (
      raw.includes('good') ||
      raw.includes('healthy') ||
      raw.includes('protein') ||
      raw.includes('fruit') ||
      raw.includes('vegetable') ||
      raw.includes('veg') ||
      raw.includes('ดี') ||
      raw.includes('ผัก') ||
      raw.includes('ผลไม้') ||
      raw.includes('โปรตีน')
    ) return 'good';

    return 'unknown';
  }

  function ensureId(el){
    if (!el) return 'no-el';

    if (!el.dataset.gjHitUid) {
      const txt = textOf(el).slice(0, 36);
      const x = Math.round(el.getBoundingClientRect ? el.getBoundingClientRect().left : 0);
      const y = Math.round(el.getBoundingClientRect ? el.getBoundingClientRect().top : 0);

      el.dataset.gjHitUid = [
        'gjhit',
        now(),
        Math.random().toString(36).slice(2, 8),
        x,
        y,
        txt
      ].join('-');
    }

    return el.dataset.gjHitUid;
  }

  function markHit(el, ev){
    cleanup();

    const id = ensureId(el);
    const kind = classify(el);
    const key = id + '|' + kind;

    if (seen.has(key)) {
      if (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();
      }

      console.warn('[GoodJunk hit dedupe] blocked duplicate hit', {
        patch: PATCH,
        key: key,
        kind: kind,
        text: textOf(el)
      });

      return false;
    }

    seen.set(key, now());

    try {
      el.dataset.gjHitLocked = '1';
      el.dataset.gjHitKind = kind;
      el.style.pointerEvents = 'none';
    } catch (_) {}

    setTimeout(function(){
      try {
        if (el && el.parentNode) {
          el.style.pointerEvents = 'none';
        }
      } catch (_) {}
    }, 0);

    return true;
  }

  function captureHit(ev){
    const el = itemFromEventTarget(ev.target);
    if (!el) return;

    if (el.dataset && el.dataset.gjHitLocked === '1') {
      ev.preventDefault();
      ev.stopPropagation();
      if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();
      return;
    }

    markHit(el, ev);
  }

  /*
    สำคัญ:
    ใช้ capture phase ก่อน core click handler
    เพื่อให้ item เดียวกันไม่โดน pointerdown/click/touch ซ้ำ
  */
  ['pointerdown', 'touchstart', 'mousedown', 'click'].forEach(function(type){
    document.addEventListener(type, captureHit, true);
  });

  /*
    กันกรณี core สร้าง item ใหม่แล้วมี class เดิม แต่ไม่มี data id
  */
  const mo = new MutationObserver(function(muts){
    muts.forEach(function(m){
      Array.prototype.forEach.call(m.addedNodes || [], function(node){
        if (!node || node.nodeType !== 1) return;

        const candidates = [];

        if (
          node.matches &&
          node.matches('.gjpu-item,.gjm-food,.food,.food-card,[data-food-id],[data-food],[data-kind],[data-type],[data-role="food"]')
        ) {
          candidates.push(node);
        }

        if (node.querySelectorAll) {
          node.querySelectorAll('.gjpu-item,.gjm-food,.food,.food-card,[data-food-id],[data-food],[data-kind],[data-type],[data-role="food"]').forEach(function(el){
            candidates.push(el);
          });
        }

        candidates.forEach(function(el){
          ensureId(el);
          try {
            el.dataset.gjHitLocked = '0';
          } catch (_) {}
        });
      });
    });
  });

  try {
    mo.observe(document.documentElement || document.body, {
      childList: true,
      subtree: true
    });
  } catch (_) {}

  /*
    Export helper ให้ summary / balance patch ใช้อ่านค่าแบบไม่เพี้ยน
  */
  window.GJ_HIT_DEDUPE_V851A = {
    patch: PATCH,
    seen: seen,
    markHit: markHit,
    classify: classify,
    ensureId: ensureId,
    countSeenGood: function(){
      let n = 0;
      seen.forEach(function(_, k){
        if (String(k).includes('|good')) n++;
      });
      return n;
    }
  };

  console.log('[GoodJunk hit dedupe] installed', PATCH);
})();
