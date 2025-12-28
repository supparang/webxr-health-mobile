// === /herohealth/vr/hha-cloud-logger.js ===
// HeroHealth — Cloud Logger (Google Apps Script Web App)
// Usage: add ?log=<WEB_APP_EXEC_URL>
// BATCH payload -> { projectTag, sessions:[...], events:[...], studentsProfile:[...] }
// ✅ supports old payload styles too

(function (root) {
  'use strict';

  const doc = root.document;
  if (!doc) return;

  function getEndpoint(){
    try{
      const u = new URL(location.href);
      const ep = u.searchParams.get('log');
      return ep ? String(ep) : null;
    }catch(_){ return null; }
  }

  const ENDPOINT = getEndpoint();
  const Q = { sessions: [], events: [], studentsProfile: [] };
  let flushing = false;
  let _debug = false;

  function nowIso(){ return new Date().toISOString(); }

  function post(payload){
    if (!ENDPOINT) return Promise.resolve(false);

    const body = JSON.stringify(payload);
    try{
      if (navigator.sendBeacon){
        const ok = navigator.sendBeacon(ENDPOINT, new Blob([body], { type: 'application/json' }));
        if (ok) return Promise.resolve(true);
      }
    }catch(_){}

    return fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
      mode: 'no-cors'
    }).then(()=>true).catch(()=>false);
  }

  function isObj(x){ return x && typeof x === 'object'; }

  // ---- Normalizers ----
  function normalizeEvent(detail){
    // 1) already batched
    if (isObj(detail) && Array.isArray(detail.events)) return detail.events.filter(isObj);

    // 2) new style: row with eventType
    if (isObj(detail) && detail.eventType) return [detail];

    // 3) old style: {type, data, ctx} or {ctx, data:{eventType}}
    if (isObj(detail) && isObj(detail.data) && isObj(detail.ctx)){
      const d = detail.data || {};
      const c = detail.ctx || {};
      const eventType = d.eventType || detail.type || 'event';
      const row = Object.assign({}, c, d, {
        eventType,
        timestampIso: c.timestampIso || d.timestampIso || nowIso()
      });
      return [row];
    }

    // 4) fallback: ignore
    return [];
  }

  function normalizeSession(detail){
    if (isObj(detail) && Array.isArray(detail.sessions)) return detail.sessions.filter(isObj);
    if (isObj(detail) && (detail.sessionId || detail.gameMode || detail.game)) return [detail];
    return [];
  }

  function normalizeProfile(detail){
    if (isObj(detail) && Array.isArray(detail.studentsProfile)) return detail.studentsProfile.filter(isObj);
    if (isObj(detail) && detail.studentKey) return [detail];
    return [];
  }

  function enqueue(kind, detail){
    if (!ENDPOINT) return;

    try{
      if (kind === 'session'){
        const rows = normalizeSession(detail);
        for (const r of rows) Q.sessions.push(r);
      } else if (kind === 'event'){
        const rows = normalizeEvent(detail);
        for (const r of rows) Q.events.push(r);
      } else if (kind === 'profile'){
        const rows = normalizeProfile(detail);
        for (const r of rows) Q.studentsProfile.push(r);
      } else if (kind === 'end'){
        // treat end as a helpful event row (optional)
        if (isObj(detail)){
          const row = Object.assign({}, detail.ctx || {}, detail.summary || {}, {
            eventType: 'end',
            timestampIso: nowIso(),
            extra: detail
          });
          Q.events.push(row);
        }
      }
    }catch(_){}
    flushSoon();
  }

  function flushSoon(){
    if (flushing) return;
    flushing = true;

    setTimeout(async () => {
      try{
        // send in chunks to avoid giant payload
        while (Q.sessions.length || Q.events.length || Q.studentsProfile.length){
          const payload = {
            projectTag: null,
            sessions: Q.sessions.splice(0, 10),
            events: Q.events.splice(0, 80),
            studentsProfile: Q.studentsProfile.splice(0, 2)
          };

          // try infer projectTag
          payload.projectTag =
            (payload.sessions[0] && payload.sessions[0].projectTag) ||
            (payload.events[0] && payload.events[0].projectTag) ||
            (payload.studentsProfile[0] && payload.studentsProfile[0].projectTag) ||
            null;

          if (_debug) console.log('[HHACloudLogger] post', payload);
          await post(payload);
        }
      } finally {
        flushing = false;
      }
    }, 140);
  }

  function flushNow(){
    if (!ENDPOINT) return Promise.resolve();
    if (_debug) console.log('[HHACloudLogger] flushNow()');
    return (async ()=>{
      while (Q.sessions.length || Q.events.length || Q.studentsProfile.length){
        const payload = {
          projectTag: null,
          sessions: Q.sessions.splice(0, 10),
          events: Q.events.splice(0, 80),
          studentsProfile: Q.studentsProfile.splice(0, 2)
        };
        payload.projectTag =
          (payload.sessions[0] && payload.sessions[0].projectTag) ||
          (payload.events[0] && payload.events[0].projectTag) ||
          (payload.studentsProfile[0] && payload.studentsProfile[0].projectTag) ||
          null;
        await post(payload);
      }
    })();
  }

  function init(opts){
    _debug = !!(opts && opts.debug);
  }

  root.addEventListener('hha:log_session', (e) => enqueue('session', e.detail || {}));
  root.addEventListener('hha:log_event',   (e) => enqueue('event',   e.detail || {}));
  root.addEventListener('hha:profile',     (e) => enqueue('profile', e.detail || {}));
  root.addEventListener('hha:end',         (e) => enqueue('end',     e.detail || {}));

  root.HHACloudLogger = { flushNow, init };
  root.GAME_MODULES = root.GAME_MODULES || {};
  root.GAME_MODULES.HHACloudLogger = root.HHACloudLogger;

})(window);
