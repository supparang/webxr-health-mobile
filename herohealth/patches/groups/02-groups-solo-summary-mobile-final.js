/* =========================================================
   HeroHealth Groups Solo
   PATCH: v20260520-groups-solo-summary-mobile-final-02
   File: /herohealth/patches/groups/02-groups-solo-summary-mobile-final.js

   Purpose:
   - Compact Summary on Mobile
   - Hide floating gameplay buttons on Summary
   - Fix Replay button
   - Fix Back to Nutrition Zone button
   - Make badge/stat layout shorter and child-friendly
========================================================= */
(function(){
  'use strict';

  const PATCH_ID = 'v20260520-groups-solo-summary-mobile-final-02';
  if (window.__HHA_GROUPS_SOLO_SUMMARY_MOBILE_FINAL__) return;
  window.__HHA_GROUPS_SOLO_SUMMARY_MOBILE_FINAL__ = true;

  const qs = new URLSearchParams(location.search);

  const BASE = 'https://supparang.github.io/webxr-health-mobile';
  const HERO = BASE + '/herohealth';
  const DEFAULT_ZONE = HERO + '/nutrition-zone.html';

  function isMobileUA(){
    return /Android|iPhone|iPad|iPod|Mobile|Windows Phone/i.test(navigator.userAgent || '');
  }

  function rawView(){
    return String(qs.get('view') || '').toLowerCase();
  }

  function view(){
    const v = rawView();
    if (['cvr','cardboard','cardboard-vr','vr','webxr'].includes(v)) return 'cvr';
    if (['mobile','phone','touch'].includes(v)) return 'mobile';
    if (['pc','desktop'].includes(v)) return 'pc';
    return isMobileUA() ? 'mobile' : 'pc';
  }

  const VIEW = view();

  document.body.classList.add('hha-groups-summary-patch-ready');
  document.body.classList.add('hha-summary-view-' + VIEW);

  function addStyle(){
    if (document.getElementById('hha-groups-summary-mobile-final-style')) return;

    const style = document.createElement('style');
    style.id = 'hha-groups-summary-mobile-final-style';
    style.textContent = `
      body.hha-groups-summary-mode{
        overflow-x:hidden !important;
        padding-bottom:calc(36px + env(safe-area-inset-bottom, 0px)) !important;
      }

      body.hha-groups-summary-mode .hha-summary-root{
        width:min(92vw, 620px) !important;
        max-width:min(92vw, 620px) !important;
        margin:18px auto calc(96px + env(safe-area-inset-bottom, 0px)) !important;
        padding:clamp(18px, 4.8vw, 30px) !important;
        border-radius:34px !important;
        box-sizing:border-box !important;
      }

      body.hha-summary-view-mobile.hha-groups-summary-mode .hha-summary-root,
      body.hha-summary-view-cvr.hha-groups-summary-mode .hha-summary-root{
        width:min(91vw, 560px) !important;
        max-width:min(91vw, 560px) !important;
        padding:20px 18px 26px !important;
        margin-top:14px !important;
      }

      body.hha-groups-summary-mode .hha-summary-root h1,
      body.hha-groups-summary-mode .hha-summary-root .title,
      body.hha-groups-summary-mode .hha-summary-root [class*="title"]{
        font-size:clamp(30px, 9vw, 48px) !important;
        line-height:1.08 !important;
        margin:10px 0 8px !important;
        letter-spacing:-.5px !important;
      }

      body.hha-groups-summary-mode .hha-summary-root h2,
      body.hha-groups-summary-mode .hha-summary-root h3{
        font-size:clamp(22px, 6vw, 34px) !important;
        line-height:1.12 !important;
        margin:12px 0 8px !important;
      }

      body.hha-groups-summary-mode .hha-summary-root p,
      body.hha-groups-summary-mode .hha-summary-root .sub,
      body.hha-groups-summary-mode .hha-summary-root .subtitle,
      body.hha-groups-summary-mode .hha-summary-root [class*="subtitle"]{
        font-size:clamp(15px, 4vw, 20px) !important;
        line-height:1.25 !important;
        margin:6px 0 10px !important;
      }

      body.hha-groups-summary-mode .hha-summary-root .hha-summary-metric-card{
        min-height:auto !important;
        padding:12px 10px !important;
        border-radius:24px !important;
        margin:6px !important;
        box-sizing:border-box !important;
      }

      body.hha-groups-summary-mode .hha-summary-root .hha-summary-metric-card *{
        line-height:1.12 !important;
      }

      body.hha-groups-summary-mode .hha-summary-root .hha-summary-metric-card strong,
      body.hha-groups-summary-mode .hha-summary-root .hha-summary-metric-card b,
      body.hha-groups-summary-mode .hha-summary-root .hha-summary-metric-card .num,
      body.hha-groups-summary-mode .hha-summary-root .hha-summary-metric-card [class*="num"],
      body.hha-groups-summary-mode .hha-summary-root .hha-summary-metric-card [class*="value"]{
        font-size:clamp(28px, 8vw, 44px) !important;
      }

      body.hha-groups-summary-mode .hha-summary-badge-wrap{
        display:flex !important;
        flex-wrap:wrap !important;
        justify-content:center !important;
        align-items:center !important;
        gap:8px !important;
        margin:10px auto 14px !important;
      }

      body.hha-groups-summary-mode .hha-summary-badge-chip{
        display:inline-flex !important;
        align-items:center !important;
        justify-content:center !important;
        width:auto !important;
        min-width:auto !important;
        max-width:100% !important;
        min-height:38px !important;
        padding:8px 14px !important;
        margin:0 !important;
        border-radius:999px !important;
        box-sizing:border-box !important;
        font-size:clamp(15px, 4vw, 20px) !important;
        line-height:1.08 !important;
        white-space:nowrap !important;
      }

      body.hha-summary-view-mobile.hha-groups-summary-mode .hha-summary-badge-chip,
      body.hha-summary-view-cvr.hha-groups-summary-mode .hha-summary-badge-chip{
        min-height:36px !important;
        padding:7px 12px !important;
        font-size:clamp(14px, 3.8vw, 18px) !important;
      }

      body.hha-groups-summary-mode .hha-summary-root .hha-summary-action-row{
        display:flex !important;
        flex-direction:column !important;
        align-items:center !important;
        gap:14px !important;
        margin-top:22px !important;
      }

      body.hha-groups-summary-mode .hha-summary-root .hha-summary-action-btn{
        display:flex !important;
        align-items:center !important;
        justify-content:center !important;
        width:min(82vw, 360px) !important;
        min-height:58px !important;
        border-radius:999px !important;
        font-size:clamp(24px, 6.4vw, 34px) !important;
        font-weight:900 !important;
        text-align:center !important;
        cursor:pointer !important;
        text-decoration:none !important;
        box-sizing:border-box !important;
        touch-action:manipulation !important;
      }

      body.hha-summary-view-mobile.hha-groups-summary-mode .hha-summary-root .hha-summary-action-btn{
        min-height:56px !important;
        width:min(82vw, 340px) !important;
      }

      body.hha-groups-summary-mode .hha-summary-floating-hide{
        display:none !important;
        opacity:0 !important;
        pointer-events:none !important;
        visibility:hidden !important;
      }

      body.hha-groups-summary-mode .hha-solo-view-pill,
      body.hha-groups-summary-mode .hha-cvr-crosshair{
        display:none !important;
      }

      body.hha-groups-summary-mode .hha-summary-root{
        animation:hhaSummaryPop .26s ease both;
      }

      @keyframes hhaSummaryPop{
        from{ transform:translateY(10px) scale(.985); opacity:.6; }
        to{ transform:translateY(0) scale(1); opacity:1; }
      }
    `;

    document.head.appendChild(style);
  }

  function buildUrl(base, extra){
    const out = new URL(base, location.href);

    [
      'pid','name','diff','time','view','studyId',
      'conditionGroup','zone','cat','game','gameId',
      'mode','theme','api','log'
    ].forEach(k => {
      const v = qs.get(k);
      if (v !== null && v !== '') out.searchParams.set(k, v);
    });

    Object.entries(extra || {}).forEach(([k,v]) => {
      if (v === null || v === undefined) out.searchParams.delete(k);
      else out.searchParams.set(k, String(v));
    });

    return out.toString();
  }

  function nutritionZoneUrl(){
    const hub = qs.get('hub');

    if (hub && /^https?:\/\//.test(hub) && hub.includes('/nutrition-zone.html')) {
      return hub;
    }

    return buildUrl(DEFAULT_ZONE, {
      zone:'nutrition',
      cat:'nutrition',
      game:'groups',
      gameId:'groups',
      mode:'solo',
      run:null,
      phase:null
    });
  }

  function replayUrl(){
    return buildUrl(location.href, {
      run:'play',
      phase:null,
      mode:'solo',
      game:'groups',
      gameId:'groups',
      zone:'nutrition',
      cat:'nutrition',
      seed:Date.now()
    });
  }

  function bodyText(){
    return String(document.body && document.body.innerText || '');
  }

  function isSummaryVisible(){
    const t = bodyText();
    return (
      t.includes('สรุปผลการเล่น') ||
      t.includes('เล่นอีกครั้ง') ||
      t.includes('กลับ Nutrition Zone') ||
      (t.includes('Food Hero') && t.includes('Best Score'))
    );
  }

  function findSummaryRoot(){
    const candidates = Array.from(document.querySelectorAll('main,section,article,div'))
      .filter(el => {
        const t = String(el.innerText || '');
        if (t.length < 30) return false;
        return (
          t.includes('สรุปผลการเล่น') ||
          t.includes('เล่นอีกครั้ง') ||
          t.includes('กลับ Nutrition Zone')
        );
      })
      .map(el => {
        const r = el.getBoundingClientRect();
        return {
          el,
          area: Math.max(1, r.width * r.height),
          top: r.top
        };
      })
      .filter(x => x.area > 10000)
      .sort((a,b) => b.area - a.area);

    if (!candidates.length) return null;

    let root = candidates[0].el;

    const better = root.closest(
      '.summary, #summary, .result, .result-card, .summary-card, .modal, .dialog, .panel, .card, main, section'
    );

    if (better && better !== document.body) root = better;

    return root;
  }

  const BADGE_NAMES = [
    'Golden Hunter',
    'Decoy Dodger',
    'Fever Finisher',
    'Comeback Hero',
    'Mission Master',
    'Veg Master',
    'Food Hero'
  ];

  const METRIC_LABELS = [
    'คะแนน',
    'ความแม่นยำ',
    'คอมโบสูงสุด',
    'ตอบถูก',
    'Best Score',
    'Best Combo',
    'Badge Collected',
    'Avg Response',
    'Items Seen',
    'Decoy Dodged'
  ];

  function compactBadges(root){
    if (!root) return;

    const all = Array.from(root.querySelectorAll('*'));

    all.forEach(el => {
      const t = String(el.innerText || '').replace(/\s+/g, ' ').trim();
      if (!t) return;

      const isBadge =
        BADGE_NAMES.some(name => t === name || t.includes(name)) &&
        t.length <= 42;

      if (!isBadge) return;

      el.classList.add('hha-summary-badge-chip');

      const p = el.parentElement;
      if (p && p !== root && !p.classList.contains('hha-summary-root')) {
        p.classList.add('hha-summary-badge-wrap');
      }
    });
  }

  function compactMetricCards(root){
    if (!root) return;

    const all = Array.from(root.querySelectorAll('*'));

    all.forEach(el => {
      const t = String(el.innerText || '').replace(/\s+/g, ' ').trim();
      if (!t) return;

      const hasMetric = METRIC_LABELS.some(label => t.includes(label));
      if (!hasMetric) return;

      const r = el.getBoundingClientRect();
      if (r.width < 80 || r.height < 30) return;

      let card = el;
      for (let i = 0; i < 3; i++) {
        if (!card.parentElement || card.parentElement === root) break;

        const pr = card.parentElement.getBoundingClientRect();
        const pt = String(card.parentElement.innerText || '');

        if (
          pr.width >= r.width &&
          pr.width <= Math.min(window.innerWidth * .95, 650) &&
          pr.height <= 190 &&
          pt.length <= 120
        ) {
          card = card.parentElement;
        } else {
          break;
        }
      }

      card.classList.add('hha-summary-metric-card');
    });
  }

  function patchActionButtons(root){
    if (!root) return;

    const zone = nutritionZoneUrl();
    const replay = replayUrl();

    const items = Array.from(root.querySelectorAll('a,button,[role="button"],div,span'))
      .filter(el => {
        const t = String(el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();
        if (!t) return false;
        if (t.length > 60) return false;
        return (
          t.includes('เล่นอีกครั้ง') ||
          t.includes('Replay') ||
          t.includes('Play Again') ||
          t.includes('กลับ Nutrition Zone') ||
          t.includes('Nutrition Zone')
        );
      });

    let actionParent = null;

    items.forEach(el => {
      const t = String(el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();

      const isReplay =
        t.includes('เล่นอีกครั้ง') ||
        t.includes('Replay') ||
        t.includes('Play Again');

      const isZone =
        t.includes('กลับ Nutrition Zone') ||
        t === 'Nutrition Zone' ||
        t.includes('Nutrition Zone');

      if (!isReplay && !isZone) return;

      el.classList.add('hha-summary-action-btn');
      el.setAttribute('role', 'button');
      el.setAttribute('tabindex', '0');

      if (!actionParent && el.parentElement) actionParent = el.parentElement;

      const target = isReplay ? replay : zone;

      if (el.tagName === 'A') {
        el.href = target;
      }

      el.addEventListener('click', function(ev){
        ev.preventDefault();
        ev.stopPropagation();
        location.href = target;
      }, true);

      el.addEventListener('keydown', function(ev){
        if (ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault();
          location.href = target;
        }
      }, true);
    });

    if (actionParent) {
      actionParent.classList.add('hha-summary-action-row');
    }
  }

  function hideFloatingGameplayButtons(root){
    if (!root) return;

    const controls = Array.from(document.querySelectorAll('button,a,div,[role="button"]'));

    controls.forEach(el => {
      if (!el || root.contains(el)) return;
      if (el.classList.contains('hha-summary-floating-hide')) return;

      const st = getComputedStyle(el);
      if (st.position !== 'fixed' && st.position !== 'sticky') return;

      const r = el.getBoundingClientRect();

      const isRoundSmall =
        r.width >= 38 &&
        r.width <= 96 &&
        r.height >= 38 &&
        r.height <= 96;

      const isBottomFloating =
        r.bottom >= window.innerHeight - 170 &&
        r.right >= window.innerWidth - 210;

      const text = String(el.innerText || el.textContent || '').trim();

      const looksGameplayIcon =
        text === '' ||
        text === '🔎' ||
        text === '🌿' ||
        text === '🔇' ||
        text === '🔊' ||
        text.length <= 4;

      if (isRoundSmall && isBottomFloating && looksGameplayIcon) {
        el.classList.add('hha-summary-floating-hide');
      }
    });
  }

  function markSummaryMode(){
    if (!isSummaryVisible()) return false;

    document.body.classList.add('hha-groups-summary-mode');

    const root = findSummaryRoot();
    if (!root) return false;

    root.classList.add('hha-summary-root');

    compactBadges(root);
    compactMetricCards(root);
    patchActionButtons(root);
    hideFloatingGameplayButtons(root);

    return true;
  }

  function scan(){
    markSummaryMode();
  }

  function boot(){
    addStyle();

    scan();
    setTimeout(scan, 250);
    setTimeout(scan, 800);
    setTimeout(scan, 1600);

    const mo = new MutationObserver(() => {
      clearTimeout(window.__HHA_GROUPS_SUMMARY_SCAN_TIMER__);
      window.__HHA_GROUPS_SUMMARY_SCAN_TIMER__ = setTimeout(scan, 80);
    });

    mo.observe(document.body, {
      childList:true,
      subtree:true,
      characterData:true
    });

    console.info('[HeroHealth Groups Solo]', PATCH_ID, 'ready', {
      view: VIEW,
      zone: nutritionZoneUrl()
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, {once:true});
  } else {
    boot();
  }

})();
