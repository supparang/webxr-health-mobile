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
  const now = () => Date.now();

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
      '.board'
    ],
    mission: [
      '.mission-card',
      '.goal-card',
      '.task-card',
      '.quest-card',
      '.coach-card',
      '.instruction-card',
      '.prompt-card',
      '.mini-panel'
    ],
    hudCards: [
      '.hud-card',
      '.stat-card',
      '.score-card',
      '.time-card',
      '.panel-card'
    ],
    target: [
      '.target',
      '.food-target',
      '.food-item',
      '.spawn-item',
      '.token',
      '.floating-item',
      '[data-target]',
      '[data-role="target"]',
      '[data-food]',
      '[data-kind="food"]'
    ],
    summary: [
      '.summary',
      '.summary-card',
      '.result-overlay',
      '.end-overlay',
      '.final-summary',
      '[data-summary]',
      '[data-role="summary"]'
    ]
  };

  const state = {
    playfield: null,
    mission: null,
    safeRect: null,
    observer: null,
    visibleTargets: 0,
    lastValidTargetAt: 0,
    blockedMiss: 0,
    rawMiss: 0,
    shownMiss: 0,
    missNode: null,
    summaryPatchedAt: 0
  };

  W.__HHA_GROUPS_RACE_GUARD__ = {
    getBlockedMiss: () => state.blockedMiss,
    getCorrectedMiss: () => Math.max(0, state.rawMiss - state.blockedMiss),
    getVisibleTargets: () => state.visibleTargets,
    getLastValidTargetAt: () => state.lastValidTargetAt
  };

  boot();

  function boot() {
    injectStyles();
    findCoreNodes();
    updateSafeRect();
    watchDom();
    startLoops();

    W.addEventListener('resize', onRelayout, { passive: true });
    W.addEventListener('orientationchange', onRelayout, { passive: true });
  }

  function onRelayout() {
    findCoreNodes();
    updateSafeRect();
    scanTargets(true);
  }

  function startLoops() {
    setInterval(() => {
      findCoreNodes();
      updateSafeRect();
      scanTargets(false);
      guardMissHud();
      patchSummaryMiss();
    }, 180);
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
  }

  function guessPlayfield() {
    const candidates = [
      ...$$('.playfield, .game-area, .board, .arena'),
      ...$$('main > section, main > div, .app > section, .app > div')
    ].filter((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 220 && r.height > 240;
    });

    candidates.sort((a, b) => {
      const ra = a.getBoundingClientRect();
      const rb = b.getBoundingClientRect();
      return (rb.width * rb.height) - (ra.width * ra.height);
    });

    return candidates[0] || null;
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
      const missionVisible = mr.width > 40 && mr.height > 40 && !isHidden(state.mission);
      if (missionVisible) {
        topBlock = Math.max(topBlock, mr.bottom - pr.top + 8);
      }
    }

    pickAll(SEL.hudCards).forEach((el) => {
      const r = el.getBoundingClientRect();
      const overlaps = r.bottom > pr.top && r.top < pr.bottom;
      if (overlaps) {
        topBlock = Math.max(topBlock, r.bottom - pr.top + 8);
      }
    });

    state.safeRect = {
      left: sidePad,
      top: clamp(topBlock, 8, Math.max(8, pr.height - 88)),
      right: Math.max(sidePad + 90, pr.width - sidePad),
      bottom: Math.max(topBlock + 90, pr.height - bottomPad),
      width: pr.width,
      height: pr.height
    };

    return state.safeRect;
  }

  function watchDom() {
    if (state.observer) {
      try { state.observer.disconnect(); } catch (_) {}
    }

    const root = state.playfield || D.body;
    state.observer = new MutationObserver((mutations) => {
      let recalc = false;
      let touchedTargets = [];

      for (const m of mutations) {
        if (m.type === 'childList') {
          m.addedNodes.forEach((node) => {
            if (!(node instanceof HTMLElement)) return;

            if (matchesTarget(node)) touchedTargets.push(node);
            node.querySelectorAll?.(SEL.target.join(',')).forEach((el) => touchedTargets.push(el));

            if (matchesMission(node)) recalc = true;
          });
        } else if (m.type === 'attributes') {
          if (m.target instanceof HTMLElement && matchesTarget(m.target)) {
            touchedTargets.push(m.target);
          }
        }
      }

      if (recalc) {
        findCoreNodes();
        updateSafeRect();
      }

      if (touchedTargets.length) {
        requestAnimationFrame(() => {
          touchedTargets.forEach((el) => keepTargetPlayable(el));
          guardMissHud();
        });
      }
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

  function scanTargets(forceMove) {
    if (!state.playfield) {
      state.visibleTargets = 0;
      return;
    }

    const targets = pickAll(SEL.target, state.playfield);
    let validCount = 0;

    targets.forEach((el) => {
      const ok = keepTargetPlayable(el, forceMove);
      if (ok) validCount += 1;
    });

    state.visibleTargets = validCount;
    if (validCount > 0) {
      state.lastValidTargetAt = now();
    }
  }

  function keepTargetPlayable(el, forceMove = false) {
    if (!(el instanceof HTMLElement)) return false;
    if (!state.playfield) return false;

    const pr = state.playfield.getBoundingClientRect();
    const safe = state.safeRect || updateSafeRect();
    if (!safe) return false;

    const cs = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    const width = Math.max(30, rect.width || parseFloat(cs.width) || 56);
    const height = Math.max(30, rect.height || parseFloat(cs.height) || 56);

    if (isHidden(el)) return false;

    if (!/absolute|fixed|relative/.test(cs.position)) {
      el.style.position = 'absolute';
    }
    el.style.zIndex = '8';

    let left = parseFloat(el.style.left);
    let top = parseFloat(el.style.top);

    if (!Number.isFinite(left)) left = rect.left - pr.left;
    if (!Number.isFinite(top)) top = rect.top - pr.top;

    const minLeft = safe.left;
    const maxLeft = Math.max(minLeft, safe.right - width);
    const minTop = safe.top;
    const maxTop = Math.max(minTop, safe.bottom - height);

    const fullyOutside =
      rect.right < pr.left + safe.left ||
      rect.left > pr.left + safe.right ||
      rect.bottom < pr.top + safe.top ||
      rect.top > pr.top + safe.bottom;

    const partlyOutside =
      left < minLeft ||
      left > maxLeft ||
      top < minTop ||
      top > maxTop;

    if (forceMove || fullyOutside || partlyOutside) {
      left = rand(minLeft, maxLeft);
      top = rand(minTop, maxTop);
      el.style.left = `${Math.round(left)}px`;
      el.style.top = `${Math.round(top)}px`;
      el.style.right = 'auto';
      el.style.bottom = 'auto';
      el.dataset.hhaGuardMoved = '1';
    }

    const after = el.getBoundingClientRect();
    const visible =
      after.width > 20 &&
      after.height > 20 &&
      after.left >= pr.left + safe.left - 2 &&
      after.top >= pr.top + safe.top - 2 &&
      after.right <= pr.left + safe.right + 2 &&
      after.bottom <= pr.top + safe.bottom + 2;

    if (visible) {
      el.dataset.hhaPlayable = '1';
      el.dataset.hhaPlayableAt = String(now());
      return true;
    }

    return false;
  }

  function guardMissHud() {
    const missNode = findMissValueNode();
    if (!missNode) return;

    state.missNode = missNode;

    const raw = parseInt((missNode.textContent || '').match(/\d+/)?.[0] || '0', 10);
    if (!Number.isFinite(raw)) return;

    if (raw < state.rawMiss) {
      state.rawMiss = raw;
      state.blockedMiss = 0;
    } else if (raw > state.rawMiss) {
      const delta = raw - state.rawMiss;
      for (let i = 0; i < delta; i++) {
        if (shouldBlockMiss()) {
          state.blockedMiss += 1;
        }
      }
      state.rawMiss = raw;
    } else {
      state.rawMiss = raw;
    }

    const corrected = Math.max(0, state.rawMiss - state.blockedMiss);
    state.shownMiss = corrected;

    if (String(corrected) !== cleanInlineText(missNode.textContent || '')) {
      missNode.textContent = String(corrected);
      missNode.dataset.hhaGuardedMiss = '1';
    }
  }

  function shouldBlockMiss() {
    const t = now();
    const sinceValid = t - (state.lastValidTargetAt || 0);
    const noVisibleTargets = state.visibleTargets <= 0;
    return noVisibleTargets || sinceValid > 260;
  }

  function patchSummaryMiss() {
    const summaries = pickAll(SEL.summary);
    if (!summaries.length) return;

    const corrected = Math.max(0, state.rawMiss - state.blockedMiss);
    const stamp = `${corrected}:${state.blockedMiss}:${state.rawMiss}`;
    if (state.summaryPatchedAt === stamp) return;

    summaries.forEach((box) => {
      if (isHidden(box)) return;

      // กรณีมี label MISS แยกชัด
      const missValue = findValueNearLabelInside(box, ['miss', 'พลาด']);
      if (missValue && missValue.node) {
        missValue.node.textContent = String(corrected);
        missValue.node.dataset.hhaGuardedMiss = '1';
      }

      // กรณีเป็นบรรทัด CORRECT / WRONG / MISS และค่าบรรทัดเดียว 0/0/10
      const textNodes = $$('*', box);
      textNodes.forEach((el) => {
        const txt = cleanInlineText(el.textContent || '');
        if (!/^\d+\s*\/\s*\d+\s*\/\s*\d+$/.test(txt)) return;

        const near = cleanInlineText((el.parentElement?.innerText || box.innerText || '').toLowerCase());
        if (!/correct|wrong|miss|ถูก|ผิด|พลาด/.test(near)) return;

        const parts = txt.split('/').map((x) => parseInt(x.trim(), 10));
        if (parts.length === 3 && parts.every(Number.isFinite)) {
          el.textContent = `${parts[0]} / ${parts[1]} / ${corrected}`;
          el.dataset.hhaGuardedTriplet = '1';
        }
      });
    });

    state.summaryPatchedAt = stamp;
  }

  function findMissValueNode() {
    return findValueNearLabelInside(D.body, ['miss', 'พลาด'])?.node || null;
  }

  function findValueNearLabelInside(root, labels) {
    const all = $$('*', root);

    for (const label of labels) {
      const low = String(label).toLowerCase();

      for (const el of all) {
        const txt = cleanInlineText(el.textContent || '').toLowerCase();
        if (txt !== low) continue;

        const card = el.closest('div,section,article') || el.parentElement;
        if (!card) continue;

        const candidates = $$('*', card)
          .filter((n) => n !== el)
          .map((n) => ({
            node: n,
            text: cleanInlineText(n.textContent || '')
          }))
          .filter((x) => /^\d+$/.test(x.text) || /^\d+\s*%$/.test(x.text));

        const numeric = candidates.find((x) => /^\d+$/.test(x.text));
        if (numeric) return numeric;

        const directText = cleanInlineText(card.innerText || '');
        const m = directText.match(/(\d+)/);
        if (m) {
          return {
            node: el.nextElementSibling || card,
            text: m[1]
          };
        }
      }
    }

    return null;
  }

  function isHidden(el) {
    if (!(el instanceof HTMLElement)) return true;
    const s = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return (
      s.display === 'none' ||
      s.visibility === 'hidden' ||
      s.opacity === '0' ||
      r.width < 8 ||
      r.height < 8
    );
  }

  function cleanInlineText(v) {
    return String(v == null ? '' : v).replace(/\s+/g, ' ').trim();
  }

  function injectStyles() {
    const style = D.createElement('style');
    style.id = 'hha-groups-race-guard-patch-style';
    style.textContent = `
      [data-hha-guarded-miss="1"]{
        color: inherit !important;
      }

      [data-hha-guarded-triplet="1"]{
        letter-spacing: .01em;
      }
    `;
    D.head.appendChild(style);
  }
})();