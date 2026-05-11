// === /herohealth/vr-groups/groups-solo-v8-polish.js ===
// HeroHealth Groups Solo — v8.0 Polish Pack
// Safe add-on patch: target balance + wave pressure + feedback + end guard + Nutrition Zone return
// PATCH v20260511-GROUPS-SOLO-V8-POLISH

(function () {
  'use strict';

  const VERSION = 'v8.0-polish-20260511';

  if (window.__HHA_GROUPS_SOLO_V8_POLISH__) {
    console.warn('[GroupsSolo v8] already installed');
    return;
  }
  window.__HHA_GROUPS_SOLO_V8_POLISH__ = true;

  const DOC = document;
  const WIN = window;

  const GROUPS = [
    { id: 1, key: 'protein', label: 'โปรตีน', icon: '🐟' },
    { id: 2, key: 'carb', label: 'ข้าว/แป้ง', icon: '🍚' },
    { id: 3, key: 'veg', label: 'ผัก', icon: '🥦' },
    { id: 4, key: 'fruit', label: 'ผลไม้', icon: '🍎' },
    { id: 5, key: 'fat', label: 'ไขมัน', icon: '🥑' }
  ];

  const state = {
    installedAt: Date.now(),
    startedAt: Date.now(),
    phase: 'warm',
    wave: 1,
    combo: 0,
    bestCombo: 0,
    correct: 0,
    miss: 0,
    fever: false,
    boss: false,
    lastJudgeAt: 0,
    lastFxAt: 0,
    endMounted: false
  };

  function qs(name, fallback = '') {
    try {
      const u = new URL(WIN.location.href);
      return u.searchParams.get(name) || fallback;
    } catch (e) {
      return fallback;
    }
  }

  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, function (m) {
      return {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      }[m];
    });
  }

  function isSoloGroupsPage() {
    const path = location.pathname.toLowerCase();
    const mode = qs('mode', 'solo').toLowerCase();
    const game = qs('game', 'groups').toLowerCase();
    return path.includes('groups') || game === 'groups' || mode === 'solo';
  }

  if (!isSoloGroupsPage()) return;

  function buildNutritionZoneUrl() {
    const base = 'https://supparang.github.io/webxr-health-mobile/herohealth/nutrition-zone.html';
    let hub = qs('hub', '');

    if (hub && hub.includes('nutrition-zone.html')) {
      return hub;
    }

    const u = new URL(base);
    const keep = [
      'pid',
      'name',
      'diff',
      'time',
      'view',
      'seed',
      'studyId',
      'conditionGroup',
      'run'
    ];

    keep.forEach(function (k) {
      const v = qs(k, '');
      if (v) u.searchParams.set(k, v);
    });

    u.searchParams.set('zone', 'nutrition');
    u.searchParams.set('from', 'groups');
    u.searchParams.set(
      'hub',
      'https://supparang.github.io/webxr-health-mobile/herohealth/hub.html'
    );

    return u.toString();
  }

  function injectStyle() {
    if (DOC.getElementById('hha-groups-v8-style')) return;

    const css = `
      :root{
        --hha-groups-v8-target: clamp(52px, 9.5vw, 76px);
        --hha-groups-v8-target-boss: clamp(66px, 12vw, 92px);
        --hha-groups-v8-safe-top: env(safe-area-inset-top, 0px);
        --hha-groups-v8-safe-bottom: env(safe-area-inset-bottom, 0px);
      }

      body.hha-groups-v8-polish{
        overscroll-behavior: none;
      }

      body.hha-groups-v8-polish .food-target,
      body.hha-groups-v8-polish .target-food,
      body.hha-groups-v8-polish .spawn-food,
      body.hha-groups-v8-polish .food-card[data-spawned="1"],
      body.hha-groups-v8-polish [data-hha-food-target="1"]{
        width: var(--hha-groups-v8-target) !important;
        height: var(--hha-groups-v8-target) !important;
        min-width: var(--hha-groups-v8-target) !important;
        min-height: var(--hha-groups-v8-target) !important;
        max-width: 86px !important;
        max-height: 86px !important;
        border-radius: 24px !important;
        display: grid !important;
        place-items: center !important;
        touch-action: manipulation !important;
        user-select: none !important;
        -webkit-user-select: none !important;
        transform-origin: center center !important;
        will-change: transform, filter, opacity;
      }

      body.hha-groups-v8-polish.hha-groups-boss [data-hha-food-target="1"]{
        width: var(--hha-groups-v8-target-boss) !important;
        height: var(--hha-groups-v8-target-boss) !important;
      }

      .hha-groups-v8-panel{
        position: fixed;
        top: calc(10px + var(--hha-groups-v8-safe-top));
        right: 10px;
        z-index: 99980;
        pointer-events: none;
        display: flex;
        flex-direction: column;
        gap: 6px;
        align-items: flex-end;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }

      .hha-groups-v8-chip{
        border: 2px solid rgba(255,255,255,.9);
        border-radius: 999px;
        padding: 7px 10px;
        background: linear-gradient(135deg, rgba(255,255,255,.92), rgba(236,250,255,.86));
        box-shadow: 0 10px 25px rgba(21,77,110,.16);
        color: #23516b;
        font-weight: 900;
        font-size: 12px;
        line-height: 1;
        backdrop-filter: blur(10px);
      }

      .hha-groups-v8-chip.urgent{
        animation: hhaGroupsPulse 0.62s ease-in-out infinite alternate;
      }

      .hha-groups-v8-chip.boss{
        background: linear-gradient(135deg, rgba(255,246,190,.95), rgba(255,217,102,.88));
        color: #6b4c00;
      }

      .hha-groups-v8-return{
        position: fixed;
        left: 10px;
        bottom: calc(10px + var(--hha-groups-v8-safe-bottom));
        z-index: 99990;
        border: 0;
        border-radius: 999px;
        padding: 11px 14px;
        background: linear-gradient(135deg, #ffffff, #e9f9ff);
        color: #23516b;
        font-weight: 950;
        font-size: 13px;
        box-shadow: 0 12px 28px rgba(21,77,110,.18);
        cursor: pointer;
      }

      .hha-groups-v8-toast{
        position: fixed;
        left: 50%;
        top: 19%;
        transform: translate(-50%, -50%) scale(.98);
        z-index: 99995;
        pointer-events: none;
        padding: 12px 18px;
        border-radius: 22px;
        background: rgba(255,255,255,.94);
        color: #244c62;
        font-weight: 1000;
        font-size: clamp(18px, 4vw, 34px);
        box-shadow: 0 18px 40px rgba(21,77,110,.18);
        opacity: 0;
      }

      .hha-groups-v8-toast.show{
        animation: hhaGroupsToast .72s ease both;
      }

      .hha-groups-v8-burst{
        position: fixed;
        z-index: 99985;
        pointer-events: none;
        transform: translate(-50%, -50%);
        font-size: 28px;
        font-weight: 1000;
        animation: hhaGroupsBurst .72s ease-out both;
      }

      body.hha-groups-storm{
        animation: hhaGroupsStormBg 1.7s ease-in-out infinite alternate;
      }

      body.hha-groups-boss{
        animation: hhaGroupsBossBg 1.2s ease-in-out infinite alternate;
      }

      body.hha-groups-fever .hha-groups-v8-panel .hha-groups-v8-chip:first-child{
        background: linear-gradient(135deg, #fff4c2, #ffffff);
      }

      @keyframes hhaGroupsPulse{
        from{ transform: scale(1); filter: saturate(1); }
        to{ transform: scale(1.06); filter: saturate(1.25); }
      }

      @keyframes hhaGroupsToast{
        0%{ opacity: 0; transform: translate(-50%, -50%) scale(.85); }
        18%{ opacity: 1; transform: translate(-50%, -50%) scale(1.06); }
        72%{ opacity: 1; transform: translate(-50%, -50%) scale(1); }
        100%{ opacity: 0; transform: translate(-50%, -65%) scale(.94); }
      }

      @keyframes hhaGroupsBurst{
        0%{ opacity: 0; transform: translate(-50%, -50%) scale(.6); }
        20%{ opacity: 1; transform: translate(-50%, -65%) scale(1.15); }
        100%{ opacity: 0; transform: translate(-50%, -110%) scale(.85); }
      }

      @keyframes hhaGroupsStormBg{
        from{ filter: saturate(1); }
        to{ filter: saturate(1.12) contrast(1.03); }
      }

      @keyframes hhaGroupsBossBg{
        from{ filter: saturate(1.05) contrast(1.02); }
        to{ filter: saturate(1.22) contrast(1.08); }
      }

      @media (max-width: 640px){
        .hha-groups-v8-chip{
          font-size: 11px;
          padding: 6px 9px;
        }

        .hha-groups-v8-return{
          font-size: 12px;
          padding: 10px 12px;
          max-width: 58vw;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
      }
    `;

    const style = DOC.createElement('style');
    style.id = 'hha-groups-v8-style';
    style.textContent = css;
    DOC.head.appendChild(style);
    DOC.body.classList.add('hha-groups-v8-polish');
  }

  function ensurePanel() {
    let panel = DOC.getElementById('hha-groups-v8-panel');
    if (panel) return panel;

    panel = DOC.createElement('div');
    panel.id = 'hha-groups-v8-panel';
    panel.className = 'hha-groups-v8-panel';
    panel.innerHTML = `
      <div id="hha-groups-v8-phase" class="hha-groups-v8-chip">🌈 Groups ${esc(VERSION)}</div>
      <div id="hha-groups-v8-combo" class="hha-groups-v8-chip">Combo x0</div>
    `;
    DOC.body.appendChild(panel);
    return panel;
  }

  function ensureToast() {
    let toast = DOC.getElementById('hha-groups-v8-toast');
    if (toast) return toast;

    toast = DOC.createElement('div');
    toast.id = 'hha-groups-v8-toast';
    toast.className = 'hha-groups-v8-toast';
    DOC.body.appendChild(toast);
    return toast;
  }

  function showToast(text) {
    const toast = ensureToast();
    toast.textContent = text;
    toast.classList.remove('show');
    void toast.offsetWidth;
    toast.classList.add('show');
  }

  function burst(text, x, y, cls) {
    const now = Date.now();
    if (now - state.lastFxAt < 80) return;
    state.lastFxAt = now;

    const b = DOC.createElement('div');
    b.className = 'hha-groups-v8-burst ' + (cls || '');
    b.textContent = text;
    b.style.left = Math.round(x || WIN.innerWidth / 2) + 'px';
    b.style.top = Math.round(y || WIN.innerHeight / 2) + 'px';
    DOC.body.appendChild(b);

    setTimeout(function () {
      b.remove();
    }, 800);
  }

  function ensureReturnButton() {
    let btn = DOC.getElementById('hha-groups-v8-return');
    if (btn) return btn;

    btn = DOC.createElement('button');
    btn.id = 'hha-groups-v8-return';
    btn.className = 'hha-groups-v8-return';
    btn.type = 'button';
    btn.textContent = '← กลับ Nutrition Zone';
    btn.addEventListener('click', function () {
      try {
        WIN.dispatchEvent(new CustomEvent('hha:flush', {
          detail: {
            reason: 'groups-v8-return-zone',
            game: 'groups',
            mode: 'solo',
            version: VERSION
          }
        }));
      } catch (e) {}

      setTimeout(function () {
        location.href = buildNutritionZoneUrl();
      }, 80);
    });

    DOC.body.appendChild(btn);
    return btn;
  }

  function updatePanel() {
    const phaseEl = DOC.getElementById('hha-groups-v8-phase');
    const comboEl = DOC.getElementById('hha-groups-v8-combo');

    if (!phaseEl || !comboEl) return;

    let label = '🌈 Wave ' + state.wave;

    if (state.phase === 'storm') label = '⚡ Storm Wave ' + state.wave;
    if (state.phase === 'boss') label = '👑 Boss Food Rush';
    if (state.fever) label += ' 🔥 Fever';

    phaseEl.textContent = label;
    phaseEl.classList.toggle('urgent', state.phase === 'storm' || state.fever);
    phaseEl.classList.toggle('boss', state.phase === 'boss');

    comboEl.textContent = 'Combo x' + state.combo + ' • Best ' + state.bestCombo;
    comboEl.classList.toggle('urgent', state.combo >= 5);
  }

  function setPhase(next) {
    if (state.phase === next) return;

    state.phase = next;

    DOC.body.classList.toggle('hha-groups-storm', next === 'storm');
    DOC.body.classList.toggle('hha-groups-boss', next === 'boss');

    if (next === 'storm') showToast('⚡ Storm! เร็วขึ้นแล้ว');
    if (next === 'boss') showToast('👑 Boss Food Rush!');
  }

  function directorTick() {
    const elapsed = Math.floor((Date.now() - state.startedAt) / 1000);
    const total = Number(qs('time', '90')) || 90;
    const remain = Math.max(0, total - elapsed);

    state.wave = Math.max(1, Math.floor(elapsed / 22) + 1);

    const bossWindow = Math.max(18, Math.floor(total * 0.28));

    if (remain <= bossWindow) {
      state.boss = true;
      setPhase('boss');
    } else if (elapsed >= 22) {
      setPhase('storm');
    } else {
      setPhase('warm');
    }

    state.fever = state.combo >= 5;
    DOC.body.classList.toggle('hha-groups-fever', state.fever);

    WIN.HHA_GROUPS_TUNING = getTuning();

    updatePanel();
    maybeMountEndGuard();
  }

  function getTuning() {
    const diff = qs('diff', 'normal').toLowerCase();

    const base = {
      version: VERSION,
      targetMinPx: 52,
      targetMaxPx: 76,
      bossTargetMaxPx: 92,
      spawnMs: 980,
      fallSpeed: 1,
      distractorRate: 0.22,
      stormRate: 0.32,
      bossRate: 0.42,
      comboFeverAt: 5,
      phase: state.phase,
      wave: state.wave,
      fever: state.fever,
      boss: state.boss
    };

    if (diff === 'easy') {
      base.spawnMs = 1120;
      base.fallSpeed = 0.88;
      base.distractorRate = 0.16;
    } else if (diff === 'hard') {
      base.spawnMs = 820;
      base.fallSpeed = 1.16;
      base.distractorRate = 0.28;
    } else if (diff === 'challenge') {
      base.spawnMs = 690;
      base.fallSpeed = 1.3;
      base.distractorRate = 0.34;
    }

    if (state.phase === 'storm') {
      base.spawnMs = Math.max(560, Math.floor(base.spawnMs * 0.82));
      base.fallSpeed += 0.18;
    }

    if (state.phase === 'boss') {
      base.spawnMs = Math.max(480, Math.floor(base.spawnMs * 0.72));
      base.fallSpeed += 0.32;
      base.distractorRate = Math.min(0.45, base.distractorRate + 0.1);
    }

    if (state.fever) {
      base.spawnMs = Math.max(450, Math.floor(base.spawnMs * 0.88));
    }

    return base;
  }

  function normalizeFoodTarget(el) {
    if (!el || el.nodeType !== 1) return;
    if (el.dataset && el.dataset.hhaV8Done === '1') return;

    const txt = (el.textContent || '').trim();

    const mayBeFood =
      /[🍎🍌🍊🍇🍉🍓🥭🥦🥬🥕🥒🍅🌽🐟🥚🍗🥩🫘🍚🍞🥔🍠🥑🥜🧈🍟🍩🍰🍬🥤]/u.test(txt) ||
      el.matches?.('.food,.food-card,.food-target,.target,.spawn,.spawn-food,.target-food,[data-food-group],[data-group],[data-kind],[data-food]');

    if (!mayBeFood) return;

    const tag = el.tagName.toLowerCase();
    if (['button', 'input', 'select', 'textarea', 'a'].includes(tag)) return;

    el.dataset.hhaFoodTarget = '1';
    el.dataset.hhaV8Done = '1';
    el.setAttribute('role', el.getAttribute('role') || 'button');
    el.setAttribute('aria-label', el.getAttribute('aria-label') || 'food target');

    if (!el.style.fontSize) {
      el.style.fontSize = 'clamp(26px, 5vw, 44px)';
    }
  }

  function scanTargets(root) {
    const base = root || DOC.body;
    if (!base) return;

    if (base.nodeType === 1) normalizeFoodTarget(base);

    const nodes = base.querySelectorAll?.(
      '.food,.food-card,.food-target,.target,.spawn,.spawn-food,.target-food,[data-food-group],[data-group],[data-kind],[data-food]'
    );

    if (!nodes) return;
    nodes.forEach(normalizeFoodTarget);
  }

  function installObserver() {
    scanTargets(DOC.body);

    const mo = new MutationObserver(function (list) {
      list.forEach(function (m) {
        m.addedNodes.forEach(function (n) {
          scanTargets(n);
        });
      });
    });

    mo.observe(DOC.body, {
      childList: true,
      subtree: true
    });
  }

  function onJudge(ok, point) {
    const now = Date.now();
    if (now - state.lastJudgeAt < 30) return;
    state.lastJudgeAt = now;

    if (ok) {
      state.correct += 1;
      state.combo += 1;
      state.bestCombo = Math.max(state.bestCombo, state.combo);

      if (state.combo === 5) showToast('🔥 Fever Combo!');
      burst('+' + Math.min(10, 1 + state.combo), point?.x, point?.y, 'ok');
    } else {
      state.miss += 1;
      state.combo = 0;
      burst('ลองใหม่!', point?.x, point?.y, 'miss');
    }

    updatePanel();
  }

  function installPointerFeedback() {
    DOC.addEventListener('pointerdown', function (ev) {
      const t = ev.target;
      if (!t || !t.closest) return;

      const food = t.closest('[data-hha-food-target="1"]');
      if (!food) return;

      food.animate(
        [
          { transform: 'scale(1)' },
          { transform: 'scale(0.88)' },
          { transform: 'scale(1.05)' },
          { transform: 'scale(1)' }
        ],
        {
          duration: 220,
          easing: 'cubic-bezier(.2,.9,.25,1)'
        }
      );

      burst('✨', ev.clientX, ev.clientY);
    }, { passive: true });
  }

  function installEventHooks() {
    WIN.addEventListener('hha:judge', function (ev) {
      const d = ev.detail || {};
      onJudge(Boolean(d.ok || d.correct || d.result === 'correct'), d.point || d);
    });

    WIN.addEventListener('groups:judge', function (ev) {
      const d = ev.detail || {};
      onJudge(Boolean(d.ok || d.correct || d.result === 'correct'), d.point || d);
    });

    WIN.addEventListener('groups:hit', function (ev) {
      const d = ev.detail || {};
      onJudge(true, d.point || d);
    });

    WIN.addEventListener('groups:miss', function (ev) {
      const d = ev.detail || {};
      onJudge(false, d.point || d);
    });

    WIN.HHA_GROUPS_V8 = {
      version: VERSION,
      groups: GROUPS.slice(),
      getState: function () {
        return Object.assign({}, state);
      },
      getTuning,
      markTarget: function (el) {
        normalizeFoodTarget(el);
        return el;
      },
      onJudge: function (payload) {
        const d = payload || {};
        onJudge(Boolean(d.ok || d.correct || d.result === 'correct'), d.point || d);
      },
      onEnd: function (summary) {
        mountSummaryGuard(summary || {});
      },
      returnToNutritionZone: function () {
        location.href = buildNutritionZoneUrl();
      }
    };
  }

  function findSummaryNode() {
    return DOC.querySelector(
      '#summary, .summary, .result, .result-screen, [data-summary], [data-screen="summary"], [data-state="ended"]'
    );
  }

  function maybeMountEndGuard() {
    if (state.endMounted) return;

    const node = findSummaryNode();
    if (!node) return;

    mountSummaryGuard({});
  }

  function mountSummaryGuard(summary) {
    if (state.endMounted) return;
    state.endMounted = true;

    const old = DOC.getElementById('hha-groups-v8-endguard');
    if (old) old.remove();

    const panel = DOC.createElement('div');
    panel.id = 'hha-groups-v8-endguard';
    panel.style.cssText = [
      'position:fixed',
      'left:50%',
      'bottom:calc(72px + env(safe-area-inset-bottom,0px))',
      'transform:translateX(-50%)',
      'z-index:99992',
      'display:flex',
      'gap:10px',
      'flex-wrap:wrap',
      'justify-content:center',
      'max-width:min(92vw,680px)',
      'font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif'
    ].join(';');

    const nutritionUrl = buildNutritionZoneUrl();

    panel.innerHTML = `
      <button type="button" data-hha-groups-v8-replay
        style="border:0;border-radius:999px;padding:12px 16px;font-weight:1000;background:#ffffff;color:#23516b;box-shadow:0 12px 28px rgba(21,77,110,.18);">
        🔁 เล่นอีกครั้ง
      </button>
      <button type="button" data-hha-groups-v8-zone
        style="border:0;border-radius:999px;padding:12px 16px;font-weight:1000;background:#dff7ff;color:#23516b;box-shadow:0 12px 28px rgba(21,77,110,.18);">
        🥗 กลับ Nutrition Zone
      </button>
    `;

    DOC.body.appendChild(panel);

    panel.querySelector('[data-hha-groups-v8-replay]').addEventListener('click', function () {
      const u = new URL(location.href);
      u.searchParams.set('run', 'play');
      u.searchParams.set('mode', 'solo');
      u.searchParams.set('seed', String(Date.now()));
      location.href = u.toString();
    });

    panel.querySelector('[data-hha-groups-v8-zone]').addEventListener('click', function () {
      try {
        WIN.dispatchEvent(new CustomEvent('hha:flush', {
          detail: {
            reason: 'groups-v8-end-zone',
            game: 'groups',
            mode: 'solo',
            version: VERSION,
            summary: summary || {}
          }
        }));
      } catch (e) {}

      setTimeout(function () {
        location.href = nutritionUrl;
      }, 80);
    });

    try {
      localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify({
        game: 'groups',
        mode: 'solo',
        version: VERSION,
        ts: new Date().toISOString(),
        correct: state.correct,
        miss: state.miss,
        bestCombo: state.bestCombo,
        phase: state.phase,
        wave: state.wave,
        summary: summary || {}
      }));
    } catch (e) {}
  }

  function init() {
    injectStyle();
    ensurePanel();
    ensureToast();
    ensureReturnButton();
    installObserver();
    installPointerFeedback();
    installEventHooks();

    updatePanel();

    setInterval(directorTick, 1000);
    setInterval(function () {
      ensureReturnButton();
      ensurePanel();
      scanTargets(DOC.body);
    }, 2200);

    console.info('[GroupsSolo v8] polish installed', VERSION, getTuning());
  }

  if (DOC.readyState === 'loading') {
    DOC.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
