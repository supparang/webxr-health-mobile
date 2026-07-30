(() => {
  'use strict';

  const VERSION = '20260730-ASSESSMENT-JSONP-SUBMIT-V84';
  const QUEUE_KEY = 'HH_ASSESSMENT_SYNC_QUEUE_V4';
  const DURABLE_PREFIX = 'HH_ASSESSMENT_LAST_V4:';
  const DEFAULT_ENDPOINT = 'https://script.google.com/macros/s/AKfycbwa-OSdqWS7uPne01wNr5a42PgKfAoxmUUm7yMcUx2D0C0OnbjrbppNUHkfjUxm79Fz/exec';

  function endpoint() {
    const q = new URLSearchParams(location.search);
    const configured = String(window.HH_CONFIG?.assessmentApiUrl || '').trim();
    return String(q.get('sheet') || configured || DEFAULT_ENDPOINT).trim();
  }

  function readJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw == null ? fallback : JSON.parse(raw);
    } catch (_) {
      return fallback;
    }
  }

  function profile() {
    return readJson('herohealth_learning_platform_rc2', {})?.profile || {};
  }

  function enrich(raw) {
    const p = profile();
    return {
      ...raw,
      clientSubmitVersion: VERSION,
      studentName: raw.studentName || p.fullName || p.name || '',
      section: raw.section || p.section || '',
      groupCode: raw.groupCode || p.group || p.groupCode || ''
    };
  }

  function toReceiverEvent(payload) {
    const sid = String(payload.studentId || '').trim();
    const mode = String(payload.mode || '').toLowerCase();
    const assessmentType = mode === 'post' ? 'posttest' : 'pretest';
    const attemptId = String(payload.attemptId || `${assessmentType}-${sid}-${Date.now()}`);

    return {
      eventId: `HH-ASSESSMENT-${attemptId}`,
      eventType: 'assessment',
      studentId: sid,
      fullName: payload.studentName || '',
      section: payload.section || '',
      group: payload.groupCode || '',
      profile: {
        fullName: payload.studentName || '',
        section: payload.section || '',
        group: payload.groupCode || ''
      },
      assessment: {
        type: assessmentType,
        form: payload.form || '',
        score: Number(payload.score || 0),
        total: Number(payload.total || 0),
        responses: Array.isArray(payload.responses) ? payload.responses : [],
        attemptId,
        assessmentVersion: payload.assessmentVersion || '',
        engineVersion: payload.engineVersion || '',
        bankVersion: payload.bankVersion || '',
        studyId: payload.studyId || '',
        blueprint: payload.blueprint || {},
        researchMetadata: payload.researchMetadata || {},
        rawPayload: payload
      },
      clientTs: payload.submittedAt || new Date().toISOString()
    };
  }

  function readQueue() {
    return readJson(QUEUE_KEY, []);
  }

  function writeQueue(items) {
    try {
      localStorage.setItem(QUEUE_KEY, JSON.stringify(items.slice(-30)));
    } catch (_) {}
  }

  function queue(payload) {
    const items = readQueue();
    const fingerprint = [payload.studentId, payload.mode, payload.attemptId || '', payload.form || ''].join('|');
    if (!items.some(item => item.fingerprint === fingerprint)) {
      items.push({ payload, fingerprint, queuedAt: new Date().toISOString() });
    }
    writeQueue(items);
  }

  function persistCompleted(payload) {
    try {
      const sid = String(payload.studentId || '').trim();
      const mode = String(payload.mode || '').toLowerCase();
      if (!sid || !['pre', 'post'].includes(mode)) return;
      localStorage.setItem(DURABLE_PREFIX + sid + ':' + mode, JSON.stringify({
        ...payload,
        persistedAt: new Date().toISOString(),
        classroomAuthorityPending: true
      }));
    } catch (_) {}
  }

  function jsonp(url, params, timeoutMs = 30000) {
    return new Promise((resolve, reject) => {
      const cb = 'HHAS_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10);
      const script = document.createElement('script');
      let settled = false;

      const cleanup = () => {
        clearTimeout(timer);
        script.onerror = null;
        setTimeout(() => {
          try { delete window[cb]; } catch (_) {}
          try { script.remove(); } catch (_) {}
        }, 100);
      };

      const finish = (error, data) => {
        if (settled) return;
        settled = true;
        cleanup();
        error ? reject(error) : resolve(data);
      };

      const timer = setTimeout(() => finish(new Error('sheet_timeout')), timeoutMs);
      window[cb] = data => finish(null, data);
      script.onerror = () => finish(new Error('sheet_load_failed'));

      const query = new URLSearchParams({
        ...params,
        callback: cb,
        _: String(Date.now()),
        transport: 'jsonp',
        clientVersion: VERSION
      });

      script.async = true;
      script.src = url + (url.includes('?') ? '&' : '?') + query.toString();
      (document.body || document.head || document.documentElement).appendChild(script);
    });
  }

  function assessmentConfirmed(api, payload) {
    if (!api || api.ok !== true) return false;
    const mode = String(payload.mode || '').toLowerCase();
    const completed = api.authoritativeState?.completed || api.completed || {};
    const scores = api.authoritativeState?.scores || api.scores || {};
    if (mode === 'pre') {
      return completed.pretest === true || Number.isFinite(Number(scores.pretest));
    }
    if (mode === 'post') {
      return completed.posttest === true || Number.isFinite(Number(scores.posttest));
    }
    return false;
  }

  async function submitEvent(url, payload) {
    const event = toReceiverEvent(payload);
    const result = await jsonp(url, {
      action: 'submit',
      payload: JSON.stringify(event)
    }, 35000);

    if (!result || result.ok !== true) {
      throw new Error(result?.error || 'assessment_submit_failed');
    }

    if (result.eventId && result.eventId !== event.eventId) {
      throw new Error('assessment_event_mismatch');
    }

    return result;
  }

  async function verify(url, payload) {
    const api = await jsonp(url, {
      action: 'student',
      studentId: String(payload.studentId || '').trim(),
      reconcile: '1'
    }, 30000);

    return assessmentConfirmed(api, payload)
      ? { ok: true, api }
      : { ok: false, api, reason: 'sheet_not_confirmed' };
  }

  async function sendAndVerify(url, payload) {
    let lastError = null;

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const submitResult = await submitEvent(url, payload);
        const check = await verify(url, payload);
        if (check.ok) {
          return {
            ok: true,
            confirmed: true,
            attempt,
            submitResult,
            api: check.api
          };
        }
      } catch (error) {
        lastError = error;
        console.error('[HeroHealth assessment sync]', error);
      }

      if (attempt < 3) {
        await new Promise(resolve => setTimeout(resolve, 1200 * attempt));
      }
    }

    return {
      ok: false,
      confirmed: false,
      reason: 'sheet_not_confirmed',
      error: String(lastError?.message || lastError || '')
    };
  }

  async function submit(rawPayload) {
    const payload = enrich(rawPayload);
    persistCompleted(payload);

    const url = endpoint();
    if (!url) {
      queue(payload);
      return { ok: false, configured: false, queued: true, confirmed: false, reason: 'endpoint_missing' };
    }

    const result = await sendAndVerify(url, payload);
    if (result.ok) {
      try {
        const sid = String(payload.studentId || '').trim();
        const mode = String(payload.mode || '').toLowerCase();
        localStorage.setItem(DURABLE_PREFIX + sid + ':' + mode + ':CONFIRMED', JSON.stringify({
          attemptId: payload.attemptId,
          score: payload.score,
          total: payload.total,
          confirmedAt: new Date().toISOString(),
          sheetVersion: result.api?.version || ''
        }));
      } catch (_) {}

      return {
        ok: true,
        configured: true,
        queued: false,
        confirmed: true,
        attempt: result.attempt,
        version: VERSION
      };
    }

    queue(payload);
    return {
      ok: false,
      configured: true,
      queued: true,
      confirmed: false,
      reason: result.reason,
      error: result.error
    };
  }

  async function flush() {
    const url = endpoint();
    if (!url) return { ok: false, configured: false, sent: 0 };

    const items = readQueue();
    if (!items.length) return { ok: true, configured: true, sent: 0, remaining: 0 };

    let sent = 0;
    const remaining = [];

    for (const item of items) {
      const result = await sendAndVerify(url, item.payload);
      if (result.ok) sent += 1;
      else remaining.push(item);
    }

    writeQueue(remaining);
    return {
      ok: remaining.length === 0,
      configured: true,
      sent,
      remaining: remaining.length,
      version: VERSION
    };
  }

  window.HHAssessmentSync = {
    submit,
    flush,
    endpoint,
    verify,
    toReceiverEvent,
    version: VERSION
  };

  addEventListener('online', () => {
    flush().catch(error => console.error('[HeroHealth assessment queue]', error));
  });
})();