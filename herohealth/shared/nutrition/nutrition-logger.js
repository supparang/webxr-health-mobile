function uid(prefix = 'id') {
  const r = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${Date.now().toString(36)}-${r}`;
}

function clone(obj) {
  try {
    return JSON.parse(JSON.stringify(obj));
  } catch {
    return obj;
  }
}

export function createNutritionLogger(ctx, options = {}) {
  const events = [];
  const sessionId = options.sessionId || uid('sess');
  const source = options.source || 'herohealth';
  const api = options.api || ctx?.api || '';
  const batchType = options.batchType || 'events_batch';
  let seq = 0;
  let ended = false;

  function baseEnvelope() {
    return {
      session_id: sessionId,
      pid: ctx?.pid || 'anon',
      zone: ctx?.zone || 'nutrition',
      game: ctx?.gameId || '',
      mode: ctx?.mode || 'solo',
      view: ctx?.view || 'mobile',
      run: ctx?.run || 'play',
      diff: ctx?.diff || 'normal',
      seed: ctx?.seed || '',
      studyId: ctx?.studyId || ''
    };
  }

  function log(eventName, payload = {}) {
    if (ended) return null;

    const tsMs = Date.now();
    const ev = {
      event_id: uid('ev'),
      event_seq: ++seq,
      ts_ms: tsMs,
      ts_iso: new Date(tsMs).toISOString(),
      event_name: String(eventName || 'unknown'),
      ...baseEnvelope(),
      payload: clone(payload || {})
    };

    events.push(ev);

    try {
      window.dispatchEvent(new CustomEvent('hha:log', { detail: ev }));
    } catch {}

    return ev;
  }

  async function flush(extra = {}) {
    if (!api || events.length === 0) {
      return { ok: true, skipped: !api || events.length === 0, count: events.length };
    }

    const batch = {
      type: batchType,
      source,
      ctx: clone(ctx),
      data: {
        session_id: sessionId,
        events: clone(events),
        ...clone(extra || {})
      }
    };

    try {
      const body = JSON.stringify(batch);
      if (navigator.sendBeacon) {
        const blob = new Blob([body], { type: 'application/json' });
        navigator.sendBeacon(api, blob);
        return { ok: true, beacon: true, count: events.length };
      }

      const res = await fetch(api, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true,
        mode: 'cors'
      });

      return { ok: res.ok, status: res.status, count: events.length };
    } catch (error) {
      console.warn('[HNZS logger] flush failed', error);
      return { ok: false, error: String(error), count: events.length };
    }
  }

  function end() {
    ended = true;
  }

  function getEvents() {
    return clone(events);
  }

  function bindAutoFlush() {
    const onHide = () => {
      flush({ reason: 'pagehide' }).catch(() => {});
    };

    window.addEventListener('pagehide', onHide, { passive: true });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        flush({ reason: 'hidden' }).catch(() => {});
      }
    }, { passive: true });

    return () => {
      window.removeEventListener('pagehide', onHide);
    };
  }

  return {
    sessionId,
    log,
    flush,
    end,
    getEvents,
    bindAutoFlush
  };
}