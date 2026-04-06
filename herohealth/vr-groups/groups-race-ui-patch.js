(() => {
  'use strict';

  const W = window;
  const D = document;
  const qs = new URLSearchParams(location.search);

  const isRace = qs.get('mode') === 'race' || qs.get('race') === '1';
  if (!isRace) return;

  const $ = (s, r = D) => r.querySelector(s);
  const $$ = (s, r = D) => Array.from(r.querySelectorAll(s));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rand = (a, b) => a + Math.random() * (b - a);

  const SEL = {
    playfield: [
      '#playfield',
      '#gameArea',
      '#gameBoard',
      '#arena',
      '.playfield',
      '.game-area',
      '.game-board',
      '.arena',
      '.board',
      '#stage',
      '.stage'
    ],
    title: [
      '.game-title',
      '.title',
      '.hero-title',
      '.top-title',
      '.brand h1',
      'h1'
    ],
    subtitle: [
      '.game-subtitle',
      '.subtitle',
      '.hero-subtitle',
      '.top-subtitle',
      '.meta',
      '.mode-line',
      '#ctxLine'
    ],
    mission: [
      '.mission-card',
      '.goal-card',
      '.task-card',
      '.quest-card',
      '.coach-card',
      '.instruction-card',
      '.prompt-card',
      '.mini-panel',
      '.goalCard'
    ],
    missionStageBadge: [
      '.stage-badge',
      '.phase-badge',
      '.mode-badge',
      '.practice-badge',
      '.mission-stage',
      '#phaseTag'
    ],
    hudCards: [
      '.hud-card',
      '.stat-card',
      '.score-card',
      '.time-card',
      '.panel-card',
      '.chip',
      '.stat'
    ],
    summaryTitle: [
      '.summary-title',
      '.result-title',
      '.end-title',
      '.summary-card h2',
      '.summary h2',
      '#summaryOverlay h2'
    ],
    target: [
      '.target',
      '.food-target',
      '.food-item',
      '.spawn-item',
      '.token',
      '.floating-item',
      '.item',
      '[data-target]',
      '[data-role="target"]',
      '[data-food]',
      '[data-kind="food"]'
    ]
  };

  const state = {
    playfield: null,
    mission: null,
    lastCompactAt: 0,
    observer: null,
    safeRect: null
  };

  injectStyles();
  boot();

  function boot() {
    setModeTexts();
    findCoreNodes();
    compactMissionCard();
    updateSafeRect();
    relocateAllTargets();
    setupObservers();

    W.addEventListener('resize', onRelayout, { passive: true });
    W.addEventListener('orientationchange', onRelayout, { passive: true });

    let tries = 0;
    const timer = setInterval(() => {
      tries += 1;
      setModeTexts();
      findCoreNodes();
      compactMissionCard();
      updateSafeRect();
      relocateAllTargets();
      if (tries >= 16) clearInterval(timer);
    }, 700);
  }

  function onRelayout() {
    compactMissionCard();
    updateSafeRect();
    relocateAllTargets();
  }

  function pick(selectors, root = D) {
    for (const s of selectors) {
      const el = root.querySelector(s);
      if (el) return el;
    }
    return null;
  }

  function pickAll(selectors, root = D) {
    const out = [];
    selectors.forEach((s) => {
      root.querySelectorAll(s).forEach((el) => out.push(el));
    });
    return [...new Set(out)];
  }

  function findCoreNodes() {
    state.playfield = pick(SEL.playfield) || guessPlayfield();
    state.mission = pick(SEL.mission, state.playfield || D) || pick(SEL.mission);

    if (state.playfield) {
      state.playfield.classList.add('hha-race-playfield');
    }
    if (state.mission) {
      state.mission.classList.add('hha-race-mission');
    }
  }

  function guessPlayfield() {
    const candidates = [
      ...$$('.playfield, .game-area, .board, .arena, .stage, #stage'),
      ...$$('main > section, main > div, .app > section, .app > div')
    ].filter((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 220 && r.height > 220;
    });

    candidates.sort((a, b) => {
      const ra = a.getBoundingClientRect();
      const rb = b.getBoundingClientRect();
      return (rb.width * rb.height) - (ra.width * ra.height);
    });

    return candidates[0] || D.body;
  }

  function setModeTexts() {
    const title = pick(SEL.title);
    const subtitle = pick(SEL.subtitle);
    const summaryTitle = pick(SEL.summaryTitle);

    if (title && /Food Groups Solo|Groups Solo|Solo/i.test(title.textContent || '')) {
      title.textContent = 'Food Groups Race';
    }

    if (subtitle) {
      const txt = String(subtitle.textContent || '');
      let next = txt
        .replace(/\bmode=[^•|]+/gi, '')
        .replace(/\bsolo\b/gi, 'race')
        .trim();

      if (!/mode=race/i.test(next)) {
        next = `mode=race • ${next}`.replace(/^•\s*/, '');
      }

      subtitle.textContent = next.replace(/\s{2,}/g, ' ');
    }

    if (summaryTitle && /Solo/i.test(summaryTitle.textContent || '')) {
      summaryTitle.textContent = String(summaryTitle.textContent).replace(/Solo/g, 'Race');
    }

    pickAll(SEL.missionStageBadge).forEach((el) => {
      const t = (el.textContent || '').trim();
      if (/Practice/i.test(t)) el.textContent = 'Race Ready';
      else if (/Main Run/i.test(t)) el.textContent = 'Race Run';
      else if (/Solo/i.test(t)) el.textContent = 'Race';
    });
  }

  function compactMissionCard() {
    if (!state.mission) return;

    state.mission.classList.add('hha-race-mission');

    if (W.innerWidth <= 900) {
      state.mission.classList.add('hha-race-mission-compact');
    } else {
      state.mission.classList.remove('hha-race-mission-compact');
    }

    state.mission.style.pointerEvents = 'none';
    state.mission.style.zIndex = '4';

    const ageMs = Date.now() - state.lastCompactAt;
    if (!state.lastCompactAt || ageMs > 10000) {
      state.lastCompactAt = Date.now();

      state.mission.classList.remove('hha-race-mission-collapsed');
      setTimeout(() => {
        if (state.mission) {
          state.mission.classList.add('hha-race-mission-collapsed');
          updateSafeRect();
          relocateAllTargets();
        }
      }, 3400);
    }

    pickAll(SEL.hudCards).forEach((el) => el.classList.add('hha-race-hud-card'));
  }

  function updateSafeRect() {
    if (!state.playfield) {
      state.safeRect = null;
      return null;
    }

    const pr = state.playfield.getBoundingClientRect();
    const sidePad = W.innerWidth <= 900 ? 10 : 14;
    const bottomPad = W.innerWidth <= 900 ? 10 : 14;
    let topBlock = 8;

    if (state.mission) {
      const mr = state.mission.getBoundingClientRect();
      const overlapTop = Math.max(0, mr.bottom - pr.top + 8);
      const missionIsVisible =
        mr.width > 40 &&
        mr.height > 40 &&
        !state.mission.classList.contains('hha-race-mission-collapsed');
      if (missionIsVisible) topBlock = Math.max(topBlock, overlapTop);
    }

    const huds = pickAll(SEL.hudCards);
    huds.forEach((el) => {
      const r = el.getBoundingClientRect();
      const overlapsPlayfield = r.bottom > pr.top && r.top < pr.bottom;
      if (overlapsPlayfield) {
        topBlock = Math.max(topBlock, r.bottom - pr.top + 8);
      }
    });

    const safe = {
      left: sidePad,
      top: clamp(topBlock, 8, Math.max(8, pr.height - 80)),
      right: Math.max(sidePad + 80, pr.width - sidePad),
      bottom: Math.max(topBlock + 80, pr.height - bottomPad),
      width: pr.width,
      height: pr.height
    };

    state.safeRect = safe;
    state.playfield.style.setProperty('--hha-safe-top', `${Math.round(safe.top)}px`);
    state.playfield.style.setProperty('--hha-safe-left', `${Math.round(safe.left)}px`);
    state.playfield.style.setProperty('--hha-safe-right', `${Math.round(pr.width - safe.right)}px`);
    state.playfield.style.setProperty('--hha-safe-bottom', `${Math.round(pr.height - safe.bottom)}px`);
    return safe;
  }

  function setupObservers() {
    if (state.observer) {
      try { state.observer.disconnect(); } catch (_) {}
    }

    const root = state.playfield || D.body;
    state.observer = new MutationObserver((mutations) => {
      let needsRecalc = false;
      const addedTargets = [];

      for (const m of mutations) {
        if (m.type === 'childList') {
          m.addedNodes.forEach((node) => {
            if (!(node instanceof HTMLElement)) return;

            if (matchesTarget(node)) addedTargets.push(node);
            node.querySelectorAll?.(SEL.target.join(',')).forEach((el) => addedTargets.push(el));

            if (matchesMission(node) || node.querySelector?.(SEL.mission.join(','))) {
              needsRecalc = true;
            }
          });
        } else if (m.type === 'attributes') {
          const el = m.target;
          if (el instanceof HTMLElement && matchesTarget(el)) {
            addedTargets.push(el);
          }
        }
      }

      if (needsRecalc) {
        findCoreNodes();
        compactMissionCard();
        updateSafeRect();
      }

      if (addedTargets.length) {
        requestAnimationFrame(() => {
          addedTargets.forEach(ensureTargetVisible);
        });
      }

      setModeTexts();
    });

    state.observer.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class']
    });
  }

  function matchesMission(el) {
    return SEL.mission.some((s) => {
      try { return el.matches(s); } catch (_) { return false; }
    });
  }

  function matchesTarget(el) {
    return SEL.target.some((s) => {
      try { return el.matches(s); } catch (_) { return false; }
    });
  }

  function relocateAllTargets() {
    if (!state.playfield) return;
    pickAll(SEL.target, state.playfield).forEach(ensureTargetVisible);
  }

  function ensureTargetVisible(el) {
    if (!(el instanceof HTMLElement)) return;
    if (!state.playfield) return;

    const pr = state.playfield.getBoundingClientRect();
    const safe = state.safeRect || updateSafeRect();
    if (!safe) return;

    const cs = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    const width = Math.max(28, rect.width || parseFloat(cs.width) || 56);
    const height = Math.max(28, rect.height || parseFloat(cs.height) || 56);

    el.style.zIndex = '8';
    if (!/absolute|fixed|relative/.test(cs.position)) {
      el.style.position = 'absolute';
    }

    const currentLeft = parseFloat(el.style.left);
    const currentTop = parseFloat(el.style.top);

    let left = Number.isFinite(currentLeft) ? currentLeft : (rect.left - pr.left);
    let top = Number.isFinite(currentTop) ? currentTop : (rect.top - pr.top);

    const minLeft = safe.left;
    const maxLeft = Math.max(minLeft, safe.right - width);
    const minTop = safe.top;
    const maxTop = Math.max(minTop, safe.bottom - height);

    const fullyOut =
      rect.right < pr.left + safe.left ||
      rect.left > pr.left + safe.right ||
      rect.bottom < pr.top + safe.top ||
      rect.top > pr.top + safe.bottom;

    const partlyOut =
      left < minLeft ||
      left > maxLeft ||
      top < minTop ||
      top > maxTop;

    if (fullyOut || partlyOut) {
      left = rand(minLeft, maxLeft);
      top = rand(minTop, maxTop);
      el.style.left = `${Math.round(left)}px`;
      el.style.top = `${Math.round(top)}px`;
      el.style.right = 'auto';
      el.style.bottom = 'auto';
      el.dataset.hhaPatched = '1';
    }

    if (!el.dataset.hhaTargetSeenAt) {
      el.dataset.hhaTargetSeenAt = String(Date.now());
    }
  }

  function injectStyles() {
    const css = `
      .hha-race-playfield{
        position: relative !important;
        overflow: hidden !important;
        min-height: clamp(360px, 52vh, 760px);
      }

      .hha-race-playfield .target-layer,
      .hha-race-playfield .targets,
      .hha-race-playfield .spawn-layer{
        z-index: 8 !important;
      }

      .hha-race-playfield .item{
        z-index: 8 !important;
      }

      .hha-race-mission{
        max-width: min(720px, calc(100% - 24px)) !important;
        border-radius: 24px !important;
        box-shadow: 0 14px 36px rgba(0,0,0,.12) !important;
        transition: transform .22s ease, opacity .22s ease, max-height .22s ease !important;
      }

      .hha-race-mission *{
        pointer-events: none !important;
      }

      .hha-race-mission-compact{
        padding: 10px 12px !important;
        min-height: auto !important;
      }

      .hha-race-mission-compact h2,
      .hha-race-mission-compact h3,
      .hha-race-mission-compact .title,
      .hha-race-mission-compact #goalTitle{
        font-size: 1.05rem !important;
        line-height: 1.2 !important;
        margin-bottom: 6px !important;
      }

      .hha-race-mission-compact p,
      .hha-race-mission-compact .subtitle,
      .hha-race-mission-compact .coach-line,
      .hha-race-mission-compact .desc,
      .hha-race-mission-compact #goalSub,
      .hha-race-mission-compact #coachBubble{
        font-size: .92rem !important;
        line-height: 1.35 !important;
      }

      .hha-race-mission-collapsed{
        opacity: .92 !important;
        transform: scale(.985) !important;
      }

      .hha-race-mission-collapsed .subtitle,
      .hha-race-mission-collapsed .coach-line,
      .hha-race-mission-collapsed .desc,
      .hha-race-mission-collapsed .hint,
      .hha-race-mission-collapsed p,
      .hha-race-mission-collapsed #goalSub{
        display: none !important;
      }

      .hha-race-hud-card{
        min-height: 72px !important;
      }

      @media (max-width: 900px){
        .hha-race-playfield{
          min-height: 48vh !important;
        }

        .hha-race-hud-card{
          min-height: 62px !important;
          padding: 10px 12px !important;
        }

        .hha-race-hud-card .label,
        .hha-race-hud-card .k,
        .hha-race-hud-card .name,
        .hha-race-hud-card .chipLabel,
        .hha-race-hud-card .statLabel{
          font-size: .78rem !important;
        }

        .hha-race-hud-card .value,
        .hha-race-hud-card .v,
        .hha-race-hud-card .chipValue,
        .hha-race-hud-card .statValue{
          font-size: 1.05rem !important;
          line-height: 1.15 !important;
        }

        .hha-race-mission{
          top: 8px !important;
          left: 8px !important;
          right: 8px !important;
          margin: 0 !important;
          max-width: calc(100% - 16px) !important;
        }
      }
    `.trim();

    const style = D.createElement('style');
    style.id = 'hha-groups-race-ui-patch-style';
    style.textContent = css;
    D.head.appendChild(style);
  }
})();