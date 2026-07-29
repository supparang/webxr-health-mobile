(() => {
  'use strict';

  const VERSION = '20260729-ASSESSMENT-MOBILE-CONFIRM-V82';
  const queueKey = 'HH_ASSESSMENT_SYNC_QUEUE_V2';
  const durablePrefix = 'HH_ASSESSMENT_LAST_V3:';
  const SEND_TIMEOUT_MS = 22000;
  const VERIFY_TIMEOUT_MS = 45000;

  function endpoint() {
    const q = new URLSearchParams(location.search);
    return String(q.get('sheet') || window.HH_CONFIG?.assessmentApiUrl || '').trim();
  }

  function profile() {
    try {
      const state = JSON.parse(localStorage.getItem('herohealth_learning_platform_rc2') || '{}');
      return state.profile || {};
    } catch (_) {
      return {};
    }
  }

  function enrich(payload) {
    const p = profile();
    return {
      ...payload,
      clientSubmitVersion: VERSION,
      studentName: payload.studentName || p.fullName || p.name || '',
      section: payload.section || p.section || '',
      groupCode: payload.groupCode || p.group || p.groupCode || '',
      meta: {
        ...(payload.meta || {}),
        studentName: payload.studentName || p.fullName || p.name || '',
        section: payload.section || p.section || '',
        groupCode: payload.groupCode || p.group || p.groupCode || '',
        device: /Mobi|Android/i.test(navigator.userAgent) ? 'mobile' : 'desktop',
        userAgent: navigator.userAgent,
        sourceUrl: location.href,
        submitVersion: VERSION
      }
    };
  }

  function persistCompleted(payload) {
    try {
      const sid = String(payload.studentId || '').trim();
      const mode = String(payload.mode || '').toLowerCase();
      if (!sid || !['pre', 'post'].includes(mode)) return;
      localStorage.setItem(durablePrefix + sid + ':' + mode, JSON.stringify({
        ...payload,
        persistedAt: new Date().toISOString(),
        classroomAuthorityPending: true
      }));
    } catch (_) {}
  }

  function readQueue() {
    try { return JSON.parse(localStorage.getItem(queueKey) || '[]'); }
    catch (_) { return []; }
  }

  function writeQueue(items) {
    try { localStorage.setItem(queueKey, JSON.stringify(items.slice(-30))); }
    catch (_) {}
  }

  function queue(payload) {
    const items = readQueue();
    const fingerprint = [payload.studentId, payload.mode, payload.attemptId || '', payload.form || ''].join('|');
    if (!items.some(item => item.fingerprint === fingerprint)) {
      items.push({ payload, fingerprint, queuedAt: new Date().toISOString() });
    }
    writeQueue(items);
  }

  function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

  async function post(url, payload, timeoutMs = SEND_TIMEOUT_MS) {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = setTimeout(() => controller?.abort(), timeoutMs);
    try {
      await fetch(url, {
        method: 'POST',
        mode: 'no-cors',
        cache: 'no-store',
        redirect: 'follow',
        keepalive: false,
        signal: controller?.signal,
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'assessment_submit', payload })
      });
      return true;
    } finally {
      clearTimeout(timer);
    }
  }

  function jsonp(url, params, timeoutMs = 18000) {
    return new Promise((resolve, reject) => {
      const cb = 'HHAV' + Date.now() + Math.random().toString(36).slice(2);
      const script = document.createElement('script');
      let done = false;
      const finish = (err, data) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        script.onerror = null;
        window[cb] = () => {};
        setTimeout(() => {
          try { delete window[cb]; } catch (_) {}
          try { script.remove(); } catch (_) {}
        }, 30000);
        err ? reject(err) : resolve(data);
      };
      const timer = setTimeout(() => finish(new Error('verify_timeout')), timeoutMs);
      window[cb] = data => finish(null, data);
      script.onerror = () => finish(new Error('verify_load_failed'));
      const query = new URLSearchParams({ ...params, callback: cb, _: String(Date.now()), mobile: '1' });
      script.async = true;
      script.referrerPolicy = 'no-referrer';
      script.src = url + (url.includes('?') ? '&' : '?') + query.toString();
      (document.head || document.documentElement).appendChild(script);
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

  async function verify(url, payload, maxMs = VERIFY_TIMEOUT_MS) {
    const started = Date.now();
    let last = null;
    while (Date.now() - started < maxMs) {
      try {
        last = await jsonp(url, { action: 'student', studentId: String(payload.studentId || '').trim() }, 16000);
        if (assessmentConfirmed(last, payload)) return { ok: true, api: last };
      } catch (_) {}
      await sleep(2500);
    }
    return { ok: false, api: last, reason: 'sheet_not_confirmed' };
  }

  async function sendAndVerify(url, payload) {
    let lastError = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await post(url, payload, SEND_TIMEOUT_MS);
      } catch (error) {
        lastError = error;
      }
      const check = await verify(url, payload, attempt === 1 ? 22000 : 15000);
      if (check.ok) return { ok: true, confirmed: true, attempt, api: check.api };
      if (attempt < 3) await sleep(1500 * attempt);
    }
    return { ok: false, confirmed: false, reason: lastError?.name === 'AbortError' ? 'timeout' : 'sheet_not_confirmed', error: String(lastError || '') };
  }

  async function flush() {
    const url = endpoint();
    if (!url) return { ok: false, configured: false, sent: 0 };
    const items = readQueue();
    if (!items.length) return { ok: true, configured: true, sent: 0 };
    let sent = 0;
    const remaining = [];
    for (const item of items) {
      const result = await sendAndVerify(url, item.payload);
      if (result.ok) sent += 1;
      else remaining.push(item);
    }
    writeQueue(remaining);
    return { ok: remaining.length === 0, configured: true, sent, remaining: remaining.length };
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
        localStorage.setItem(durablePrefix + sid + ':' + mode + ':CONFIRMED', JSON.stringify({
          attemptId: payload.attemptId,
          score: payload.score,
          total: payload.total,
          confirmedAt: new Date().toISOString(),
          sheetVersion: result.api?.version || ''
        }));
      } catch (_) {}
      return { ok: true, configured: true, queued: false, confirmed: true, attempt: result.attempt };
    }
    queue(payload);
    return { ok: false, configured: true, queued: true, confirmed: false, reason: result.reason || 'sheet_not_confirmed', error: result.error || '' };
  }

  window.HHAssessmentSync = { submit, flush, endpoint, verify, version: VERSION };
  addEventListener('online', () => { flush().catch(() => {}); });
})();