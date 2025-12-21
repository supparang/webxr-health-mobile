// === /herohealth/vr/hha-cloud-logger.js ===
// Hero Health — Global Cloud Logger (IIFE, NO-CORS friendly)
// ✅ Auto-init from ?log= or sessionStorage.HHA_LOGGER_ENDPOINT
// ✅ Listens: hha:log_session, hha:log_event, hha:log_profile
// ✅ sendBeacon first, then fetch(no-cors), debounce flush

(function (root) {
  'use strict';

  const URLX = new URL(location.href);
  const endpoint =
    (URLX.searchParams.get('log') || '') ||
    (sessionStorage.getItem('HHA_LOGGER_ENDPOINT') || '') ||
    '';

  const debug = (URLX.searchParams.get('debug') === '1');

  const S = {
    endpoint: String(endpoint || ''),
    debug,
    bound: false,
    sessionsQueue: [],
    eventsQueue: [],
    profilesQueue: [],
    flushTimer: null,
    FLUSH_DELAY: 900
  };

  function nowIso(){ return new Date().toISOString(); }
  function safeObj(x){ return (x && typeof x === 'object') ? x : {}; }

  function scheduleFlush() {
    if (S.flushTimer) return;
    S.flushTimer = setTimeout(() => flushNow(false), S.FLUSH_DELAY);
  }

  async function flushNow(isFinal) {
    S.flushTimer = null;
    if (!S.endpoint) return;
    if (!S.sessionsQueue.length && !S.eventsQueue.length && !S.profilesQueue.length) return;

    const payload = {
      projectTag: 'HeroHealth',
      timestampIso: nowIso(),
      sessions: S.sessionsQueue.splice(0),
      events: S.eventsQueue.splice(0),
      studentsProfile: S.profilesQueue.splice(0)
    };

    const body = JSON.stringify(payload);

    try {
      if (navigator.sendBeacon) {
        const ok = navigator.sendBeacon(S.endpoint, new Blob([body], { type: 'text/plain;charset=utf-8' }));
        if (S.debug) console.log('[HHACloudLogger] beacon', ok, payload);
        if (ok) return;
      }
    } catch (e) {
      if (S.debug) console.warn('[HHACloudLogger] beacon failed', e);
    }

    try {
      await fetch(S.endpoint, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body
      });
      if (S.debug) console.log('[HHACloudLogger] fetch(no-cors) sent', payload);
    } catch (err) {
      // network error only -> requeue
      S.sessionsQueue = payload.sessions.concat(S.sessionsQueue);
      S.eventsQueue = payload.events.concat(S.eventsQueue);
      S.profilesQueue = payload.studentsProfile.concat(S.profilesQueue);
      if (S.debug) console.warn('[HHACloudLogger] flush error', err);
    }

    if (isFinal && (S.sessionsQueue.length || S.eventsQueue.length || S.profilesQueue.length)) {
      try {
        if (navigator.sendBeacon) {
          navigator.sendBeacon(S.endpoint, new Blob([JSON.stringify({
            projectTag: 'HeroHealth',
            timestampIso: nowIso(),
            sessions: S.sessionsQueue.splice(0),
            events: S.eventsQueue.splice(0),
            studentsProfile: S.profilesQueue.splice(0)
          })], { type: 'text/plain;charset=utf-8' }));
        }
      } catch(_) {}
    }
  }

  function init(opts = {}) {
    S.endpoint = String(opts.endpoint || S.endpoint || '');
    if (S.endpoint) {
      try { sessionStorage.setItem('HHA_LOGGER_ENDPOINT', S.endpoint); } catch(_) {}
    }
    if (typeof opts.debug === 'boolean') S.debug = !!opts.debug;

    if (S.bound) return;
    S.bound = true;

    root.addEventListener('hha:log_session', (e) => {
      S.sessionsQueue.push(safeObj(e.detail));
      scheduleFlush();
    });

    root.addEventListener('hha:log_event', (e) => {
      S.eventsQueue.push(safeObj(e.detail));
      scheduleFlush();
    });

    root.addEventListener('hha:log_profile', (e) => {
      S.profilesQueue.push(safeObj(e.detail));
      scheduleFlush();
    });

    root.addEventListener('pagehide', () => flushNow(true));
    root.addEventListener('visibilitychange', () => { if (document.hidden) flushNow(true); });

    if (S.debug) console.log('[HHACloudLogger] init', S.endpoint);
  }

  // expose
  root.HHACloudLogger = {
    init,
    flushNow,
    get endpoint(){ return S.endpoint; }
  };

  // auto init
  init({ endpoint: S.endpoint, debug: S.debug });

})(window);
