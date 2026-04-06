// === /herohealth/fitness-zone.jumpduck.finalize.patch.js ===
// Final cleanup / dedupe / normalize patch for JumpDuck in fitness-zone
// v20260406a-jd-fitness-finalize

(function () {
  'use strict';

  const LAST_ZONE_KEY = 'HHA_LAST_ZONE';
  const LAST_SUMMARY_KEY = 'HHA_LAST_SUMMARY';
  const JUMPDUCK_SUMMARY_KEY = 'HHA_LAST_SUMMARY_JUMPDUCK';

  const qs = new URLSearchParams(location.search);

  function safeJsonParse(raw, fallback = null) {
    try { return JSON.parse(raw); } catch (_) { return fallback; }
  }

  function readJsonKey(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? safeJsonParse(raw, null) : null;
    } catch (_) {
      return null;
    }
  }

  function readJumpDuckSummary() {
    const jd = readJsonKey(JUMPDUCK_SUMMARY_KEY);
    if (jd && String(jd.game || '').toLowerCase() === 'jumpduck') return jd;

    const generic = readJsonKey(LAST_SUMMARY_KEY);
    if (generic && String(generic.game || '').toLowerCase() === 'jumpduck') return generic;

    return null;
  }

  function qget(key, fallback = '') {
    const v = qs.get(key);
    return (v == null || v === '') ? fallback : v;
  }

  function setLastZone(zone) {
    try { localStorage.setItem(LAST_ZONE_KEY, zone); } catch (_) {}
  }

  function buildJumpDuckLauncherUrl(mode) {
    const u = new URL('./jump-duck-vr.html', location.href);

    const passthroughKeys = [
      'pid', 'name', 'nickName', 'studyId',
      'run', 'diff', 'view', 'time', 'seed',
      'debug', 'api', 'log',
      'studentKey', 'schoolCode', 'classRoom', 'studentNo',
      'conditionGroup', 'sessionNo', 'weekNo'
    ];

    passthroughKeys.forEach((k) => {
      const v = qs.get(k);
      if (v != null && v !== '') u.searchParams.set(k, v);
    });

    if (!u.searchParams.get('pid')) u.searchParams.set('pid', 'anon');
    if (!u.searchParams.get('name')) u.searchParams.set('name', qget('nickName', 'Hero'));
    if (!u.searchParams.get('diff')) u.searchParams.set('diff', 'normal');
    if (!u.searchParams.get('view')) u.searchParams.set('view', 'mobile');
    if (!u.searchParams.get('time')) u.searchParams.set('time', '90');
    if (!u.searchParams.get('seed')) u.searchParams.set('seed', String(Date.now()));

    u.searchParams.set('zone', 'fitness');
    u.searchParams.set('cat', 'fitness');
    u.searchParams.set('game', 'jumpduck');
    u.searchParams.set('gameId', 'jumpduck');
    u.searchParams.set('theme', 'jumpduck');
    u.searchParams.set('focus', 'jumpduck');
    u.searchParams.set('featured', 'jumpduck');
    u.searchParams.set('hub', location.href);

    if (mode === 'play') {
      u.searchParams.set('run', 'play');
      u.searchParams.set('gate', '1');
      u.searchParams.set('cooldown', '1');
      u.searchParams.set('returnPhase', 'cooldown');
    } else if (mode === 'quick') {
      u.searchParams.set('run', 'play');
      u.searchParams.set('gate', '0');
      u.searchParams.set('cooldown', '1');
      u.searchParams.set('returnPhase', 'cooldown');
    } else if (mode === 'research') {
      u.searchParams.set('run', 'research');
      u.searchParams.set('gate', '1');
      u.searchParams.set('cooldown', '1');
      u.searchParams.set('returnPhase', 'cooldown');
    } else if (mode === 'demo') {
      u.searchParams.set('run', 'demo');
      u.searchParams.set('diff', 'easy');
      u.searchParams.set('time', '60');
      u.searchParams.set('gate', '0');
      u.searchParams.set('cooldown', '0');
      u.searchParams.set('returnPhase', 'hub');
    }

    return u.toString();
  }

  function getJumpDuckCard() {
    return (
      document.getElementById('gameCard-jumpduck') ||
      document.querySelector('[data-game-card="jumpduck"]') ||
      document.querySelector('.jumpduck-card')
    );
  }

  function bindFitnessLinks(root) {
    if (!root) return;
    root.querySelectorAll('[data-zone-memory="fitness"]').forEach((el) => {
      if (el.__zoneMemoryBoundFinalize) return;
      el.__zoneMemoryBoundFinalize = true;
      el.addEventListener('click', function () {
        setLastZone('fitness');
      });
    });
  }

  function dedupeBySelector(root, selector, keep = 'first') {
    if (!root) return;
    const list = [...root.querySelectorAll(selector)];
    if (list.length <= 1) return;

    if (keep === 'last') {
      list.slice(0, -1).forEach((n) => n.remove());
      return;
    }
    list.slice(1).forEach((n) => n.remove());
  }

  function ensureSingleMount(id) {
    const nodes = document.querySelectorAll(`#${id}`);
    if (nodes.length <= 1) return nodes[0] || null;

    const first = nodes[0];
    [...nodes].slice(1).forEach((n) => n.remove());
    return first;
  }

  function normalizeTopFeaturedText() {
    const featuredCandidates = [
      document.getElementById('fitFeatured'),
      ...document.querySelectorAll('[data-fit-featured]')
    ].filter(Boolean);

    featuredCandidates.forEach((el) => {
      el.textContent = 'Jump Duck';
    });
  }

  function normalizeJumpDuckCardStructure() {
    const card = getJumpDuckCard();
    if (!card) return;

    card.classList.add('jumpduck-featured');

    dedupeBySelector(card, '.jumpduck-ribbon', 'first');
    dedupeBySelector(card, '.jumpduck-feature-box', 'first');
    dedupeBySelector(card, '.jumpduck-recent-box', 'first');
    dedupeBySelector(card, '.jumpduck-action-grid', 'first');

    const featureBox = card.querySelector('.jumpduck-feature-box');
    const recentBox = card.querySelector('.jumpduck-recent-box');
    const actionGrid = card.querySelector('.jumpduck-action-grid');
    const legacyActions = card.querySelector('.actions, .game-actions');

    if (featureBox) {
      const title = featureBox.querySelector('.jumpduck-feature-title');
      const sub = featureBox.querySelector('.jumpduck-feature-sub');
      if (title) title.textContent = 'JumpDuck • Rhythmic Jump Circuit';
      if (sub) {
        sub.textContent = 'ฝึก jump + duck + landing + beat สำหรับเด็ก แบบอ่านง่ายและมีสรุปผลทักษะหลังเล่น';
      }
    }

    if (actionGrid) {
      const mapping = {
        '#btnPlayJumpDuck, [data-game-play="jumpduck"]': buildJumpDuckLauncherUrl('play'),
        '#btnQuickJumpDuck, [data-game-quick="jumpduck"]': buildJumpDuckLauncherUrl('quick'),
        '#btnResearchJumpDuck, [data-game-research="jumpduck"]': buildJumpDuckLauncherUrl('research'),
        '#btnDemoJumpDuck, [data-game-demo="jumpduck"]': buildJumpDuckLauncherUrl('demo')
      };

      Object.keys(mapping).forEach((selector) => {
        actionGrid.querySelectorAll(selector).forEach((a) => {
          if (a.tagName === 'A') a.href = mapping[selector];
          a.setAttribute('data-zone-memory', 'fitness');
        });
      });

      bindFitnessLinks(actionGrid);
    }

    if (legacyActions && actionGrid) {
      legacyActions.style.display = 'none';
    }

    if (featureBox && recentBox && actionGrid) {
      const desiredOrder = [featureBox, recentBox, actionGrid];
      desiredOrder.forEach((node) => {
        if (!node) return;
        card.appendChild(node);
      });
    }

    const summary = readJumpDuckSummary();
    if (recentBox && summary) {
      const score = Number(summary.score || 0);
      const stars = Number(summary.stars || 0);
      const rhythm = Number(summary.rhythmAccuracy || 0);
      const landing = Number(summary.landingControl || 0);
      const posts = Number(summary.postsCleared || 0);

      recentBox.innerHTML = `
        <div class="jumpduck-recent-title">🕹️ JumpDuck ล่าสุด</div>
        <div class="jumpduck-recent-grid">
          <div class="jumpduck-recent-pill">
            <div class="jumpduck-recent-k">Stars</div>
            <div class="jumpduck-recent-v">${stars}⭐</div>
          </div>
          <div class="jumpduck-recent-pill">
            <div class="jumpduck-recent-k">Rhythm</div>
            <div class="jumpduck-recent-v">${rhythm}%</div>
          </div>
          <div class="jumpduck-recent-pill">
            <div class="jumpduck-recent-k">Landing</div>
            <div class="jumpduck-recent-v">${landing}%</div>
          </div>
          <div class="jumpduck-recent-pill">
            <div class="jumpduck-recent-k">Posts</div>
            <div class="jumpduck-recent-v">${posts}/7</div>
          </div>
        </div>
        <div style="font-size:13px;color:#7b7a72;font-weight:1000;">
          Score ${score} • เข้าเล่นต่อได้ทั้ง Play / Quick / Research / Demo
        </div>
      `;
    }
  }

  function normalizeHeroRecommendedMissionMounts() {
    const heroMount = ensureSingleMount('fitnessHeroFeatureMount');
    const recMount = ensureSingleMount('fitnessRecommendedMount');
    const missionMount = ensureSingleMount('fitnessMissionMount');

    [heroMount, recMount, missionMount].forEach((mount) => {
      if (!mount) return;
      bindFitnessLinks(mount);

      dedupeBySelector(mount, '.fitness-hero-feature', 'first');
      dedupeBySelector(mount, '.fitness-recommended-strip', 'first');
      dedupeBySelector(mount, '.fitness-mission-strip', 'first');
    });

    if (heroMount) {
      heroMount.querySelectorAll('a[href*="jump-duck-vr"]').forEach((a) => {
        if (/quick/i.test(a.textContent)) a.href = buildJumpDuckLauncherUrl('quick');
        else if (/research/i.test(a.textContent)) a.href = buildJumpDuckLauncherUrl('research');
        else a.href = buildJumpDuckLauncherUrl('play');
        a.setAttribute('data-zone-memory', 'fitness');
      });
    }

    if (recMount) {
      const s = readJumpDuckSummary();
      const strip = recMount.querySelector('.fitness-recommended-strip');
      if (strip && s) {
        const head = strip.querySelector('.fitness-strip-sub');
        const stats = strip.querySelectorAll('.fitness-stat-v');
        if (head) head.textContent = `${Number(s.stars || 0)}⭐ • เล่นต่อได้ทันที`;
        if (stats[0]) stats[0].textContent = String(Number(s.score || 0));
        if (stats[1]) stats[1].textContent = `${Number(s.rhythmAccuracy || 0)}%`;
        if (stats[2]) stats[2].textContent = `${Number(s.landingControl || 0)}%`;
        if (stats[3]) stats[3].textContent = `${Number(s.stars || 0)}⭐`;
      }
    }

    if (missionMount) {
      missionMount.querySelectorAll('a[href*="jump-duck-vr"]').forEach((a) => {
        const t = a.textContent.toLowerCase();
        if (t.includes('quick')) a.href = buildJumpDuckLauncherUrl('quick');
        else if (t.includes('demo')) a.href = buildJumpDuckLauncherUrl('demo');
        else if (t.includes('research')) a.href = buildJumpDuckLauncherUrl('research');
        else a.href = buildJumpDuckLauncherUrl('play');
        a.setAttribute('data-zone-memory', 'fitness');
      });
    }

    bindFitnessLinks(document);
  }

  function normalizePickerRecommendedRecentLibrary() {
    const pickerList =
      document.getElementById('pickerList') ||
      document.querySelector('.picker-list') ||
      document.querySelector('[data-picker-list]');

    if (pickerList) {
      dedupeBySelector(pickerList, '[data-picker-jumpduck="1"]', 'first');
      const item = pickerList.querySelector('[data-picker-jumpduck="1"]');
      if (item) {
        item.querySelectorAll('a').forEach((a) => {
          const t = a.textContent.toLowerCase();
          if (t.includes('quick')) a.href = buildJumpDuckLauncherUrl('quick');
          else if (t.includes('research')) a.href = buildJumpDuckLauncherUrl('research');
          else if (t.includes('demo')) a.href = buildJumpDuckLauncherUrl('demo');
          else a.href = buildJumpDuckLauncherUrl('play');
          a.setAttribute('data-zone-memory', 'fitness');
        });
      }
    }

    const hosts = [
      document.getElementById('recommendedBox'),
      document.getElementById('recommendedList'),
      document.querySelector('.recommended-box'),
      document.querySelector('.recommended-list'),
      document.querySelector('[data-recommended-list]'),
      document.getElementById('recentBox'),
      document.getElementById('recentList'),
      document.querySelector('.recent-box'),
      document.querySelector('.recent-list'),
      document.querySelector('[data-recent-list]'),
      document.getElementById('libraryBox'),
      document.querySelector('.library-box'),
      document.querySelector('[data-library-box]')
    ].filter(Boolean);

    hosts.forEach((host) => {
      dedupeBySelector(host, '[data-jd-recommended="1"]', 'first');
      dedupeBySelector(host, '[data-jd-recent="1"]', 'first');
      dedupeBySelector(host, '[data-jd-library="1"]', 'first');

      host.querySelectorAll('[data-jd-recommended="1"] a, [data-jd-recent="1"] a, [data-jd-library="1"] a').forEach((a) => {
        const t = a.textContent.toLowerCase();
        if (t.includes('quick')) a.href = buildJumpDuckLauncherUrl('quick');
        else if (t.includes('research')) a.href = buildJumpDuckLauncherUrl('research');
        else if (t.includes('demo')) a.href = buildJumpDuckLauncherUrl('demo');
        else a.href = buildJumpDuckLauncherUrl('play');
        a.setAttribute('data-zone-memory', 'fitness');
      });
    });

    bindFitnessLinks(document);
  }

  function normalizeToolbarButtons() {
    const mappings = [
      ['btnQuickRecommended', 'play'],
      ['btnQuickRecent', 'play'],
      ['btnQuickAllGames', 'quick']
    ];

    mappings.forEach(([id, mode]) => {
      const el = document.getElementById(id);
      if (!el || el.__jdFinalToolbarBound) return;

      el.__jdFinalToolbarBound = true;
      el.addEventListener('click', function (e) {
        const inFitnessPage =
          /fitness-zone/i.test(location.pathname) ||
          document.body?.dataset?.zone === 'fitness';

        if (!inFitnessPage) return;

        e.preventDefault();
        setLastZone('fitness');
        location.href = buildJumpDuckLauncherUrl(mode);
      });
    });
  }

  function normalizeBackLinks() {
    document.querySelectorAll('a[href*="jump-duck-vr"]').forEach((a) => {
      const txt = (a.textContent || '').toLowerCase();
      if (txt.includes('quick')) a.href = buildJumpDuckLauncherUrl('quick');
      else if (txt.includes('research')) a.href = buildJumpDuckLauncherUrl('research');
      else if (txt.includes('demo')) a.href = buildJumpDuckLauncherUrl('demo');
      else if (!txt.includes('fitness zone')) a.href = buildJumpDuckLauncherUrl('play');

      if (!txt.includes('fitness zone')) {
        a.setAttribute('data-zone-memory', 'fitness');
      }
    });

    bindFitnessLinks(document);
  }

  function highlightJumpDuckFromFocus() {
    const focus = String(qget('focus', '') || qget('featured', '')).toLowerCase();
    if (focus !== 'jumpduck') return;

    const card = getJumpDuckCard();
    if (!card) return;

    card.classList.add('game-card-focus');
  }

  function boot() {
    normalizeTopFeaturedText();
    normalizeJumpDuckCardStructure();
    normalizeHeroRecommendedMissionMounts();
    normalizePickerRecommendedRecentLibrary();
    normalizeToolbarButtons();
    normalizeBackLinks();
    highlightJumpDuckFromFocus();
  }

  document.addEventListener('DOMContentLoaded', boot);
  window.addEventListener('load', boot);
  window.addEventListener('focus', boot);
})();