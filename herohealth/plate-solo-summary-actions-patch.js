/* =========================================================
   HeroHealth • Plate Solo Summary Actions Patch
   File: /herohealth/plate-solo-summary-actions-patch.js
   PATCH v20260512-PLATE-SOLO-SUMMARY-ACTIONS-RC1

   ใช้ต่อท้าย:
   1) plate-solo.js
   2) plate-solo-final-flow-patch.js
   3) ไฟล์นี้

   ✅ ถ้า Summary ไม่มีปุ่ม จะสร้างให้เอง
   ✅ ปุ่มกลับ Nutrition Zone ถูกหน้า
   ✅ ปุ่มทำ Cooldown ไป warmup-gate.html?phase=cooldown
   ✅ ปุ่มเล่นอีกครั้ง reload พร้อม seed ใหม่
   ✅ กันอาหาร/เป้าลอยหลังจบซ้ำอีกชั้น
   ✅ เหมาะกับการปิด Plate Solo ก่อนเข้า FINAL QA
   ========================================================= */

(function(){
  'use strict';

  const VERSION = 'v20260512-PLATE-SOLO-SUMMARY-ACTIONS-RC1';
  const WIN = window;
  const DOC = document;

  const SUMMARY_SELECTORS = [
    '#summaryModal',
    '#resultModal',
    '.summary-modal',
    '.result-modal',
    '.modal'
  ].join(',');

  const CARD_SELECTORS = [
    '.summary-card',
    '.result-card',
    '.modal-card',
    '.overlay-card',
    '.card'
  ].join(',');

  const FOOD_SELECTORS = [
    '.food',
    '.food-item',
    '.falling-food',
    '.target',
    '.food-target',
    '.spawn-item',
    '.draggable-food',
    '[data-food]',
    '[data-target]'
  ].join(',');

  const qs = (s, root = DOC) => root.querySelector(s);
  const qsa = (s, root = DOC) => Array.from(root.querySelectorAll(s));

  function params(){
    return new URLSearchParams(WIN.location.search || '');
  }

  function heroHealthBaseUrl(){
    const path = WIN.location.pathname;
    const marker = '/herohealth/';
    const i = path.indexOf(marker);

    if (i >= 0) {
      return WIN.location.origin + path.slice(0, i + marker.length);
    }

    return new URL('./', WIN.location.href).href;
  }

  function keepCommonParams(url){
    const p = params();

    [
      'pid',
      'name',
      'studentId',
      'studentName',
      'classSection',
      'diff',
      'time',
      'view',
      'log',
      'api',
      'studyId',
      'conditionGroup'
    ].forEach(k => {
      const v = p.get(k);
      if (v !== null && v !== '') url.searchParams.set(k, v);
    });

    const hub = p.get('hub');
    if (hub) {
      url.searchParams.set('hub', hub);
    } else {
      url.searchParams.set('hub', new URL('hub.html', heroHealthBaseUrl()).href);
    }

    return url;
  }

  function buildNutritionZoneUrl(){
    const url = keepCommonParams(new URL('nutrition-zone.html', heroHealthBaseUrl()));

    url.searchParams.set('zone', 'nutrition');
    url.searchParams.set('from', 'plate-solo');
    url.searchParams.set('game', 'plate');
    url.searchParams.set('mode', 'solo');

    return url.href;
  }

  function buildCooldownUrl(){
    const url = keepCommonParams(new URL('warmup-gate.html', heroHealthBaseUrl()));

    url.searchParams.set('phase', 'cooldown');
    url.searchParams.set('zone', 'nutrition');
    url.searchParams.set('game', 'plate');
    url.searchParams.set('mode', 'solo');
    url.searchParams.set('from', 'plate-solo');
    url.searchParams.set('next', buildNutritionZoneUrl());

    return url.href;
  }

  function buildReplayUrl(){
    const url = new URL(WIN.location.href);

    url.searchParams.set('run', 'play');
    url.searchParams.set('zone', 'nutrition');
    url.searchParams.set('game', 'plate');
    url.searchParams.set('mode', 'solo');
    url.searchParams.set('seed', String(Date.now()));

    url.searchParams.delete('phase');
    url.searchParams.delete('from');
    url.searchParams.delete('next');

    return url.href;
  }

  function safeLeave(url, reason){
    DOC.body.classList.add('plate-leaving');

    try {
      WIN.dispatchEvent(new CustomEvent('hha:before-leave', {
        detail:{
          game:'plate',
          mode:'solo',
          reason:reason || 'summary-action',
          to:url,
          version:VERSION
        }
      }));
    } catch (_) {}

    try {
      if (typeof WIN.HHA_FLUSH === 'function') {
        WIN.HHA_FLUSH(reason || 'summary-action');
      }
    } catch (_) {}

    setTimeout(() => {
      WIN.location.assign(url);
    }, 80);
  }

  function stopFoods(){
    DOC.body.classList.add('plate-ended', 'is-ended');

    qsa(FOOD_SELECTORS).forEach(el => {
      try {
        el.style.pointerEvents = 'none';
        el.style.opacity = '0';
        el.style.transform = 'scale(.55)';
        el.setAttribute('aria-hidden', 'true');

        setTimeout(() => {
          if (el && el.parentNode) el.parentNode.removeChild(el);
        }, 320);
      } catch (_) {}
    });
  }

  function isVisible(el){
    if (!el) return false;

    const st = WIN.getComputedStyle(el);

    return (
      el.classList.contains('show') ||
      el.classList.contains('open') ||
      el.getAttribute('aria-hidden') === 'false' ||
      st.display === 'flex' ||
      st.display === 'grid' ||
      st.visibility === 'visible' && st.opacity !== '0'
    );
  }

  function findSummary(){
    return qsa(SUMMARY_SELECTORS).find(isVisible) || qs(SUMMARY_SELECTORS);
  }

  function findCard(summary){
    if (!summary) return null;
    return qs(CARD_SELECTORS, summary) || summary;
  }

  function makeButton(className, text, href, onClick){
    const a = DOC.createElement('a');

    a.className = className;
    a.href = href;
    a.setAttribute('role', 'button');
    a.textContent = text;

    a.addEventListener('click', ev => {
      ev.preventDefault();
      onClick();
    }, true);

    return a;
  }

  function ensureSummaryActions(){
    const summary = findSummary();
    if (!summary) return;

    const card = findCard(summary);
    if (!card) return;

    stopFoods();

    let actions = qs('[data-plate-summary-actions="1"]', card);

    if (!actions) {
      actions = DOC.createElement('div');
      actions.className = 'plate-summary-actions-final';
      actions.setAttribute('data-plate-summary-actions', '1');

      const note = DOC.createElement('div');
      note.className = 'plate-summary-note-final';
      note.innerHTML = `
        <strong>จบเกม Plate Solo แล้ว!</strong>
        <span>เลือกทำ Cooldown หรือกลับ Nutrition Zone ได้เลย</span>
      `;

      const row = DOC.createElement('div');
      row.className = 'plate-summary-actions-row-final';

      const cooldownUrl = buildCooldownUrl();
      const zoneUrl = buildNutritionZoneUrl();
      const replayUrl = buildReplayUrl();

      const cooldownBtn = makeButton(
        'plate-summary-btn-final primary',
        '🧘 ทำ Cooldown',
        cooldownUrl,
        () => safeLeave(cooldownUrl, 'cooldown')
      );

      const zoneBtn = makeButton(
        'plate-summary-btn-final zone',
        '🥗 กลับ Nutrition Zone',
        zoneUrl,
        () => safeLeave(zoneUrl, 'nutrition-zone')
      );

      const replayBtn = makeButton(
        'plate-summary-btn-final replay',
        '🔁 เล่นอีกครั้ง',
        replayUrl,
        () => safeLeave(replayUrl, 'replay')
      );

      row.appendChild(cooldownBtn);
      row.appendChild(zoneBtn);
      row.appendChild(replayBtn);

      actions.appendChild(note);
      actions.appendChild(row);
      card.appendChild(actions);
    }

    bindExistingButtons();
  }

  function bindExistingButtons(){
    const zoneUrl = buildNutritionZoneUrl();
    const cooldownUrl = buildCooldownUrl();
    const replayUrl = buildReplayUrl();

    const zoneSelectors = [
      '#backZoneBtn',
      '#backToZone',
      '#zoneBtn',
      '#nutritionZoneBtn',
      '[data-action="zone"]',
      '[data-action="back-zone"]',
      '[data-go="zone"]',
      '.back-zone',
      '.zone-btn'
    ].join(',');

    const cooldownSelectors = [
      '#cooldownBtn',
      '#goCooldownBtn',
      '[data-action="cooldown"]',
      '[data-go="cooldown"]',
      '.cooldown-btn'
    ].join(',');

    const replaySelectors = [
      '#replayBtn',
      '#restartBtn',
      '[data-action="replay"]',
      '[data-action="restart"]',
      '.replay-btn',
      '.restart-btn'
    ].join(',');

    qsa(zoneSelectors).forEach(btn => {
      if (btn.tagName === 'A') btn.href = zoneUrl;
      btn.dataset.href = zoneUrl;

      if (btn.__plateSummaryZoneBound) return;
      btn.__plateSummaryZoneBound = true;

      btn.addEventListener('click', ev => {
        ev.preventDefault();
        safeLeave(zoneUrl, 'nutrition-zone');
      }, true);
    });

    qsa(cooldownSelectors).forEach(btn => {
      if (btn.tagName === 'A') btn.href = cooldownUrl;
      btn.dataset.href = cooldownUrl;

      if (btn.__plateSummaryCooldownBound) return;
      btn.__plateSummaryCooldownBound = true;

      btn.addEventListener('click', ev => {
        ev.preventDefault();
        safeLeave(cooldownUrl, 'cooldown');
      }, true);
    });

    qsa(replaySelectors).forEach(btn => {
      if (btn.tagName === 'A') btn.href = replayUrl;
      btn.dataset.href = replayUrl;

      if (btn.__plateSummaryReplayBound) return;
      btn.__plateSummaryReplayBound = true;

      btn.addEventListener('click', ev => {
        ev.preventDefault();
        safeLeave(replayUrl, 'replay');
      }, true);
    });
  }

  function addStyle(){
    if (qs('#plateSoloSummaryActionsPatchStyle')) return;

    const style = DOC.createElement('style');
    style.id = 'plateSoloSummaryActionsPatchStyle';

    style.textContent = `
      .plate-summary-actions-final{
        margin-top:16px;
        padding:14px;
        border-radius:24px;
        border:1px dashed rgba(75,179,255,.48);
        background:
          radial-gradient(circle at top left, rgba(255,232,122,.36), transparent 38%),
          linear-gradient(180deg, rgba(244,252,255,.92), rgba(255,255,255,.92));
      }

      .plate-summary-note-final{
        display:flex;
        flex-direction:column;
        gap:4px;
        text-align:center;
        color:#24465d;
        font-weight:900;
        line-height:1.35;
        margin-bottom:12px;
      }

      .plate-summary-note-final strong{
        font-size:18px;
        font-weight:1000;
      }

      .plate-summary-note-final span{
        color:#6f8da0;
        font-size:13px;
        font-weight:800;
      }

      .plate-summary-actions-row-final{
        display:flex;
        flex-wrap:wrap;
        justify-content:center;
        gap:10px;
      }

      .plate-summary-btn-final{
        min-height:46px;
        display:inline-flex;
        align-items:center;
        justify-content:center;
        gap:8px;
        padding:12px 16px;
        border-radius:999px;
        color:#24465d;
        text-decoration:none;
        font-weight:1000;
        line-height:1;
        box-shadow:0 10px 24px rgba(56,109,140,.14);
        border:0;
        transition:transform .15s ease, filter .15s ease, box-shadow .15s ease;
      }

      .plate-summary-btn-final:hover{
        transform:translateY(-1px);
        filter:brightness(1.02);
      }

      .plate-summary-btn-final:active{
        transform:translateY(1px) scale(.98);
      }

      .plate-summary-btn-final.primary{
        background:linear-gradient(180deg,#8ff7a0,#4edb68);
        color:#07304c;
      }

      .plate-summary-btn-final.zone{
        background:linear-gradient(180deg,#9ee4ff,#55bdff);
        color:#07304c;
      }

      .plate-summary-btn-final.replay{
        background:linear-gradient(180deg,#fff,#fff2bf);
        color:#4e3600;
      }

      body.plate-ended .food,
      body.plate-ended .food-item,
      body.plate-ended .falling-food,
      body.plate-ended .target,
      body.plate-ended .food-target,
      body.plate-ended .spawn-item,
      body.plate-ended .draggable-food{
        pointer-events:none !important;
      }

      body.plate-leaving{
        cursor:progress;
      }

      body.plate-leaving *{
        pointer-events:none !important;
      }

      @media (max-width: 560px){
        .plate-summary-actions-row-final{
          display:grid;
          grid-template-columns:1fr;
        }

        .plate-summary-btn-final{
          width:100%;
        }
      }
    `;

    DOC.head.appendChild(style);
  }

  function patchEndHooks(){
    const hookNames = [
      'endGame',
      'finishGame',
      'showSummary',
      'openSummary',
      'renderSummary'
    ];

    hookNames.forEach(name => {
      const fn = WIN[name];

      if (typeof fn !== 'function') return;
      if (fn.__plateSummaryActionsPatched) return;

      const patched = function(){
        const result = fn.apply(this, arguments);

        setTimeout(() => {
          stopFoods();
          ensureSummaryActions();
        }, 80);

        setTimeout(ensureSummaryActions, 300);

        return result;
      };

      patched.__plateSummaryActionsPatched = true;
      WIN[name] = patched;
    });
  }

  function observeSummary(){
    const mo = new MutationObserver(() => {
      bindExistingButtons();

      const summary = findSummary();
      if (summary && isVisible(summary)) {
        ensureSummaryActions();
      }
    });

    mo.observe(DOC.documentElement, {
      childList:true,
      subtree:true,
      attributes:true,
      attributeFilter:['class', 'style', 'aria-hidden']
    });

    WIN.__PLATE_SOLO_SUMMARY_ACTIONS_OBSERVER__ = mo;
  }

  function boot(){
    DOC.body.classList.add('plate-summary-actions-ready');

    addStyle();
    bindExistingButtons();
    patchEndHooks();
    observeSummary();

    setTimeout(bindExistingButtons, 120);
    setTimeout(ensureSummaryActions, 400);

    WIN.PlateSoloSummaryActionsPatch = {
      version:VERSION,
      zoneUrl:buildNutritionZoneUrl,
      cooldownUrl:buildCooldownUrl,
      replayUrl:buildReplayUrl,
      refresh(){
        bindExistingButtons();
        ensureSummaryActions();
      },
      stopFoods
    };
  }

  WIN.addEventListener('hha:game-end', () => {
    stopFoods();
    setTimeout(ensureSummaryActions, 80);
  });

  WIN.addEventListener('hha:summary', () => {
    stopFoods();
    setTimeout(ensureSummaryActions, 80);
  });

  WIN.addEventListener('hha:plate:end', () => {
    stopFoods();
    setTimeout(ensureSummaryActions, 80);
  });

  WIN.addEventListener('DOMContentLoaded', boot);

  if (DOC.readyState === 'interactive' || DOC.readyState === 'complete') {
    boot();
  }

})();
