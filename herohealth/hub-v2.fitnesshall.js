/* =========================================================
   HeroHealth Hub v2 Fitness Hall
   PATCH v20260411a-hub-clean
   ========================================================= */
(function (W, D) {
  'use strict';

  const FITNESS_LAUNCHERS = {
    shadowbreaker: {
      key: 'shadowbreaker',
      path: './shadow-breaker-vr.html',
      game: 'shadowbreaker',
      gameId: 'shadowbreaker',
      theme: 'shadowbreaker',
      mode: 'solo',
      diff: 'normal',
      time: '90',
      view: 'mobile',
      zone: 'fitness',
      cat: 'fitness'
    },
    rhythmboxer: {
      key: 'rhythmboxer',
      path: './rhythm-boxer-vr.html',
      game: 'rhythmboxer',
      gameId: 'rhythmboxer',
      theme: 'rhythmboxer',
      mode: 'solo',
      diff: 'normal',
      time: '90',
      view: 'mobile',
      zone: 'fitness',
      cat: 'fitness'
    },
    jumpduck: {
      key: 'jumpduck',
      path: './jump-duck-vr.html',
      game: 'jumpduck',
      gameId: 'jumpduck',
      theme: 'jumpduck',
      mode: 'solo',
      diff: 'normal',
      time: '90',
      view: 'mobile',
      zone: 'fitness',
      cat: 'fitness'
    },
    balancehold: {
      key: 'balancehold',
      path: './balance-hold-vr.html',
      game: 'balancehold',
      gameId: 'balancehold',
      theme: 'balancehold',
      mode: 'solo',
      diff: 'normal',
      time: '90',
      view: 'mobile',
      zone: 'fitness',
      cat: 'fitness'
    },
    fitnessplanner: {
      key: 'fitnessplanner',
      path: './fitness-planner.html',
      game: 'fitnessplanner',
      gameId: 'fitnessplanner',
      theme: 'fitnessplanner',
      mode: 'solo',
      diff: 'normal',
      time: '90',
      view: 'mobile',
      zone: 'fitness',
      cat: 'fitness'
    }
  };

  function byId(id) {
    return D.getElementById(id);
  }

  function normalizeKey(value) {
    return String(value || '').trim().toLowerCase();
  }

  function getCardKey(el) {
    if (!el) return '';
    return normalizeKey(el.getAttribute('data-fit-launcher'));
  }

  function getConfig(key) {
    const safeKey = normalizeKey(key);
    return FITNESS_LAUNCHERS[safeKey] || null;
  }

  function buildHref(cfg) {
    if (!cfg || !W.HHHubRoutes) return '';

    return W.HHHubRoutes.buildFitnessLauncherUrl({
      path: cfg.path,
      game: cfg.game,
      gameId: cfg.gameId,
      theme: cfg.theme,
      mode: cfg.mode,
      diff: cfg.diff,
      time: cfg.time,
      view: cfg.view,
      zone: cfg.zone,
      cat: cfg.cat
    });
  }

  function patchCardHref(el, href) {
    if (!el || !href) return;

    if (el.tagName === 'A') {
      el.href = href;
      return;
    }

    el.setAttribute('data-href', href);
  }

  function bindCardClick(el, href) {
    if (!el || el.__hhFitBound) return;

    el.__hhFitBound = true;

    el.addEventListener('click', function (ev) {
      if (W.HHHubRoutes) {
        W.HHHubRoutes.setLastZone('fitness');
      }

      if (el.tagName !== 'A') {
        ev.preventDefault();
        if (href) W.location.href = href;
      }
    });

    if (el.tagName !== 'A') {
      el.setAttribute('role', 'link');
      el.tabIndex = 0;
      el.style.cursor = 'pointer';

      el.addEventListener('keydown', function (ev) {
        const key = ev.key || ev.code;
        if (key === 'Enter' || key === ' ' || key === 'Spacebar') {
          ev.preventDefault();
          if (W.HHHubRoutes) {
            W.HHHubRoutes.setLastZone('fitness');
          }
          if (href) W.location.href = href;
        }
      });
    }
  }

  function bindAllCards() {
    const cards = D.querySelectorAll('[data-fit-launcher]');
    if (!cards.length) return;

    cards.forEach(function (el) {
      const key = getCardKey(el);
      const cfg = getConfig(key);
      if (!cfg) return;

      const href = buildHref(cfg);
      patchCardHref(el, href);
      bindCardClick(el, href);
    });
  }

  function patchPlannerButtons() {
    if (!W.HHHubRoutes) return;

    const launcher = W.HHHubRoutes.buildFitnessPlannerUrl('launcher');
    const quick = W.HHHubRoutes.buildFitnessPlannerUrl('quick');
    const classroom = W.HHHubRoutes.buildFitnessPlannerUrl('class');
    const weekly = W.HHHubRoutes.buildFitnessPlannerUrl('weekly');

    W.HHHubRoutes.patchAnchorHref('btnFitnessPlanner', launcher);
    W.HHHubRoutes.patchAnchorHref('btnFPLauncher', launcher);
    W.HHHubRoutes.patchAnchorHref('btnFPQuick', quick);
    W.HHHubRoutes.patchAnchorHref('btnFPClass', classroom);
    W.HHHubRoutes.patchAnchorHref('btnFPWeekly', weekly);

    [
      'btnFitnessPlanner',
      'btnFPLauncher',
      'btnFPQuick',
      'btnFPClass',
      'btnFPWeekly'
    ].forEach(function (id) {
      const el = byId(id);
      if (!el || el.__hhPlannerBound) return;

      el.__hhPlannerBound = true;
      el.addEventListener('click', function () {
        if (W.HHHubRoutes) {
          W.HHHubRoutes.setLastZone('fitness');
        }
      });
    });
  }

  function render() {
    patchPlannerButtons();
    bindAllCards();
  }

  function bind() {
    render();
  }

  function getResolvedMap() {
    const resolved = {};

    Object.keys(FITNESS_LAUNCHERS).forEach(function (key) {
      resolved[key] = buildHref(FITNESS_LAUNCHERS[key]);
    });

    return resolved;
  }

  function getDebugState() {
    return {
      launchers: FITNESS_LAUNCHERS,
      resolved: getResolvedMap(),
      planner: W.HHHubRoutes ? {
        launcher: W.HHHubRoutes.buildFitnessPlannerUrl('launcher'),
        quick: W.HHHubRoutes.buildFitnessPlannerUrl('quick'),
        class: W.HHHubRoutes.buildFitnessPlannerUrl('class'),
        weekly: W.HHHubRoutes.buildFitnessPlannerUrl('weekly')
      } : null
    };
  }

  W.HHHubFitnessHall = {
    bind,
    render,
    getConfig,
    getResolvedMap,
    getDebugState
  };
})(window, document);
