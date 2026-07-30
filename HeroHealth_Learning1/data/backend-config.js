window.HH_CONFIG = window.HH_CONFIG || {};

window.HH_CONFIG.backend = {
  enabled: true,
  webAppUrl: "https://script.google.com/macros/s/AKfycbwa-OSdqWS7uPne01wNr5a42PgKfAoxmUUm7yMcUx2D0C0OnbjrbppNUHkfjUxm79Fz/exec",
  queueOffline: true,
  duplicateGuard: true,
  syncIntervalMs: 15000
};

window.HH_CONFIG.teacherAccess = {
  sessionKey: "herohealth_teacher_authorized_v1",
  pin: "7319"
};

/*
 * Game Shell Core-First Transport R37
 * - Intercepts only large action=submit game JSONP requests.
 * - Sends a compact Core Result first so Passport can unlock quickly.
 * - Keeps the original full payload in a separate analytics queue.
 * - Uses sendBeacon, hidden-form POST and no-cors fetch as fallbacks.
 * - Confirms the exact eventId from HH_Events before replying to Game Shell.
 */
(() => {
  'use strict';

  const VERSION = '20260730-GAME-CORE-FIRST-R37';
  const ANALYTICS_QUEUE_KEY = 'HH_GAME_ANALYTICS_QUEUE_V1';
  const shellPath = /\/HeroHealth_Learning1\/game-shell-once\.html$/;

  if (!shellPath.test(location.pathname)) return;
  if (window.__HH_GAME_CORE_FIRST_R37__) return;
  window.__HH_GAME_CORE_FIRST_R37__ = VERSION;

  const endpoint = String(window.HH_CONFIG?.backend?.webAppUrl || '').trim();
  if (!endpoint) return;

  const endpointUrl = new URL(endpoint, location.href);
  const originalAppendChild = Node.prototype.appendChild;
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

  function sameEndpoint(url) {
    return url.origin === endpointUrl.origin && url.pathname === endpointUrl.pathname;
  }

  function originalAppend(parent, node) {
    return originalAppendChild.call(parent, node);
  }

  function readJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw == null ? fallback : JSON.parse(raw);
    } catch (_) {
      return fallback;
    }
  }

  function preserveFullAnalytics(payload) {
    try {
      const queue = readJson(ANALYTICS_QUEUE_KEY, []);
      const eventId = String(payload?.eventId || '').trim();
      if (!eventId || queue.some(item => item.eventId === eventId)) return;
      queue.push({
        eventId,
        studentId: String(payload?.studentId || '').trim(),
        zone: String(payload?.zone || payload?.game?.zone || ''),
        gameId: String(payload?.gameId || payload?.game?.gameId || ''),
        queuedAt: new Date().toISOString(),
        payload
      });
      localStorage.setItem(ANALYTICS_QUEUE_KEY, JSON.stringify(queue.slice(-12)));
    } catch (error) {
      console.warn('[HeroHealth analytics queue]', error);
    }
  }

  function scalar(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function corePayload(payload) {
    const game = payload?.game || {};
    const zone = String(payload?.zone || game.zone || '').trim();
    const gameId = String(payload?.gameId || game.gameId || game.game_id || '').trim();
    const profile = payload?.profile || game.profile || {};
    const handwash = gameId === 'handwash';

    const coreGame = {
      studentId: String(payload?.studentId || game.studentId || '').trim(),
      profile: {
        fullName: String(profile.fullName || payload?.fullName || ''),
        section: String(profile.section || payload?.section || ''),
        group: String(profile.group || payload?.group || '')
      },
      zone,
      gameId,
      game_id: gameId,
      game_key: gameId,
      score: scalar(game.score ?? payload?.score),
      accuracy: scalar(game.accuracy ?? payload?.accuracy),
      scoreAvailable: game.scoreAvailable === true || game.score != null,
      passed: game.passed === true || payload?.passed === true,
      completed: game.completed === true || payload?.completed === true,
      procedureCompleted: game.procedureCompleted === true || payload?.procedureCompleted === true,
      progressionEligible: game.progressionEligible === true || payload?.progressionEligible === true,
      finishedAt: game.finishedAt || payload?.clientTs || new Date().toISOString(),
      durationSec: scalar(game.durationSec ?? game.elapsedSec),
      inputMode: String(game.inputMode || game.mode || 'classroom-ar'),
      gameVersion: String(game.gameVersion || game.version || ''),
      sessionId: String(game.sessionId || ''),
      singleAttemptPolicy: true,
      retryRequired: false,
      completionPolicy: String(game.completionPolicy || 'one-classroom-round-completes'),
      skillCriteriaMet: game.skillCriteriaMet === true,
      originalPassed: game.originalPassed === true,
      analyticsSchemaVersion: String(game.analyticsSchemaVersion || 'HH-UNIFIED-GAME-ANALYTICS-V2'),
      metricCompletenessPct: scalar(game.metricCompletenessPct),
      coreResultOnly: !handwash,
      fullAnalyticsQueued: true,
      transportVersion: VERSION
    };

    if (handwash) {
      coreGame.completedRubSteps = scalar(game.completedRubSteps ?? game.whoStepsCompleted);
      coreGame.totalWhoRubSteps = scalar(game.totalWhoRubSteps ?? game.totalRubSteps ?? game.whoStepsTotal);
      coreGame.completedProcessSteps = scalar(game.completedProcessSteps);
      coreGame.totalProcessSteps = scalar(game.totalProcessSteps);
      coreGame.wristsPassed = game.wristsPassed === true;
      coreGame.steps = Array.isArray(game.steps)
        ? game.steps.slice(0, 20)
        : Array.isArray(game.stepResults)
          ? game.stepResults.slice(0, 20)
          : [];
      coreGame.events = Array.isArray(game.events)
        ? game.events.slice(0, 30)
        : Array.isArray(game.eventLog)
          ? game.eventLog.slice(0, 30)
          : [];
      coreGame.coreResultOnly = false;
    }

    return {
      eventType: 'game',
      type: 'game',
      eventId: String(payload?.eventId || '').trim(),
      studentId: String(payload?.studentId || game.studentId || '').trim(),
      zone,
      gameId,
      completed: coreGame.completed,
      procedureCompleted: coreGame.procedureCompleted,
      progressionEligible: coreGame.progressionEligible,
      passed: coreGame.passed,
      profile: coreGame.profile,
      clientTs: payload?.clientTs || new Date().toISOString(),
      currentStep: payload?.currentStep || `${zone}:${gameId}`,
      status: `Core result submitted first for ${zone}:${gameId}`,
      game: coreGame
    };
  }

  function shortJsonp(params, timeoutMs = 14000) {
    return new Promise((resolve, reject) => {
      const callback = 'HHGCORE_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
      const script = document.createElement('script');
      let settled = false;

      const finish = (error, data) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        script.onerror = null;
        try { delete window[callback]; } catch (_) {}
        try { script.remove(); } catch (_) {}
        error ? reject(error) : resolve(data);
      };

      const timer = setTimeout(() => finish(new Error('sheet_timeout')), timeoutMs);
      window[callback] = data => finish(null, data);
      script.onerror = () => finish(new Error('sheet_load_failed'));
      script.async = true;
      script.src = endpoint + '?' + new URLSearchParams({
        ...params,
        callback,
        transport: 'jsonp-short-core-r37',
        clientVersion: VERSION,
        _: String(Date.now())
      }).toString();

      originalAppend(document.head || document.body || document.documentElement, script);
    });
  }

  function beaconPost(payload) {
    try {
      if (!navigator.sendBeacon) return false;
      return navigator.sendBeacon(
        endpoint,
        new Blob([JSON.stringify(payload)], { type: 'text/plain;charset=UTF-8' })
      );
    } catch (_) {
      return false;
    }
  }

  function hiddenFormPost(payload) {
    return new Promise((resolve, reject) => {
      try {
        const targetName = 'HH_GAME_CORE_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
        const iframe = document.createElement('iframe');
        const form = document.createElement('form');

        iframe.name = targetName;
        iframe.style.cssText = 'position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;border:0;left:-9999px;top:-9999px';
        iframe.setAttribute('aria-hidden', 'true');

        form.method = 'POST';
        form.action = endpoint;
        form.target = targetName;
        form.acceptCharset = 'UTF-8';
        form.enctype = 'application/x-www-form-urlencoded';
        form.style.display = 'none';

        const fields = {
          action: 'submit',
          payload: JSON.stringify(payload),
          transport: 'hidden-form-core-r37',
          clientVersion: VERSION,
          _: String(Date.now())
        };

        Object.entries(fields).forEach(([name, value]) => {
          const input = document.createElement('input');
          input.type = 'hidden';
          input.name = name;
          input.value = value;
          form.appendChild(input);
        });

        originalAppend(document.body || document.documentElement, iframe);
        originalAppend(document.body || document.documentElement, form);
        form.submit();

        setTimeout(() => resolve(true), 300);
        setTimeout(() => {
          try { form.remove(); } catch (_) {}
          try { iframe.remove(); } catch (_) {}
        }, 45000);
      } catch (error) {
        reject(error);
      }
    });
  }

  async function fetchNoCors(payload) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      await fetch(endpoint, {
        method: 'POST',
        mode: 'no-cors',
        cache: 'no-store',
        redirect: 'follow',
        credentials: 'omit',
        headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      return true;
    } finally {
      clearTimeout(timer);
    }
  }

  async function eventFound(eventId) {
    const api = await shortJsonp({ action: 'event', eventId }).catch(() => null);
    return api?.ok === true && api?.found === true;
  }

  async function waitForEvent(eventId) {
    const delays = [650, 850, 1050, 1350, 1700, 2200, 2900];
    for (const baseDelay of delays) {
      await sleep(baseDelay + Math.floor(Math.random() * 300));
      if (await eventFound(eventId)) return true;
    }
    return false;
  }

  async function submitCore(core) {
    if (await eventFound(core.eventId)) return true;

    beaconPost(core);
    if (await waitForEvent(core.eventId)) return true;

    await hiddenFormPost(core);
    if (await waitForEvent(core.eventId)) return true;

    await fetchNoCors(core).catch(() => false);
    return waitForEvent(core.eventId);
  }

  async function confirmSubmission(fullPayload, callbackName, interceptedScript) {
    const core = corePayload(fullPayload);
    const eventId = core.eventId;
    const studentId = core.studentId;

    const reply = data => {
      const callback = window[callbackName];
      if (typeof callback === 'function') {
        callback(data);
      } else if (typeof interceptedScript.onerror === 'function') {
        interceptedScript.onerror(new Event('error'));
      }
    };

    try {
      if (!eventId || !studentId || !core.zone || !core.gameId) {
        throw new Error('missing_game_event_identity');
      }

      preserveFullAnalytics(fullPayload);

      const found = await submitCore(core);
      if (!found) throw new Error('core_event_not_found_after_all_transports');

      const studentApi = await shortJsonp({
        action: 'student',
        studentId,
        reconcile: '1'
      }).catch(() => null);

      reply({
        ...(studentApi && typeof studentApi === 'object' ? studentApi : {}),
        ok: true,
        eventId,
        studentId,
        transport: 'core-first-r37',
        fullAnalyticsQueued: true,
        version: studentApi?.version || VERSION
      });
    } catch (error) {
      console.error('[HeroHealth game core-first]', error);
      reply({
        ok: false,
        eventId,
        studentId,
        error: String(error?.message || error),
        transport: 'core-first-r37',
        version: VERSION
      });
    }
  }

  Node.prototype.appendChild = function patchedAppendChild(node) {
    try {
      if (node?.tagName === 'SCRIPT' && node.src) {
        const url = new URL(node.src, location.href);
        const action = String(url.searchParams.get('action') || '');
        const payloadText = url.searchParams.get('payload');
        const callbackName = String(url.searchParams.get('callback') || '');

        if (sameEndpoint(url) && action === 'submit' && payloadText && callbackName) {
          const payload = JSON.parse(payloadText);
          if (String(payload?.eventType || payload?.type || '').toLowerCase() === 'game') {
            node.dataset.hhTransport = VERSION;
            confirmSubmission(payload, callbackName, node);
            return node;
          }
        }
      }
    } catch (error) {
      console.warn('[HeroHealth game transport interception]', error);
    }

    return originalAppendChild.call(this, node);
  };

  console.info('[HeroHealth] game core-first transport installed', VERSION);
})();