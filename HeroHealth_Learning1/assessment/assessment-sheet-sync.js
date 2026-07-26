(() => {
  'use strict';

  const queueKey = 'HH_ASSESSMENT_SYNC_QUEUE_V1';

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
        sourceUrl: location.href
      }
    };
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
    items.push({ payload, queuedAt: new Date().toISOString() });
    writeQueue(items);
  }

  async function post(url, payload) {
    await fetch(url, {
      method: 'POST',
      mode: 'no-cors',
      cache: 'no-store',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'assessment_submit', payload })
    });
  }

  async function flush() {
    const url = endpoint();
    if (!url) return { ok: false, configured: false, sent: 0 };
    const items = readQueue();
    if (!items.length) return { ok: true, configured: true, sent: 0 };
    let sent = 0;
    const remaining = [];
    for (const item of items) {
      try { await post(url, item.payload); sent += 1; }
      catch (_) { remaining.push(item); }
    }
    writeQueue(remaining);
    return { ok: remaining.length === 0, configured: true, sent, remaining: remaining.length };
  }

  async function submit(rawPayload) {
    const payload = enrich(rawPayload);
    const url = endpoint();
    if (!url) {
      queue(payload);
      return { ok: false, configured: false, queued: true };
    }
    try {
      await flush();
      await post(url, payload);
      return { ok: true, configured: true, queued: false };
    } catch (error) {
      queue(payload);
      return { ok: false, configured: true, queued: true, error: String(error) };
    }
  }

  window.HHAssessmentSync = { submit, flush, endpoint };
  addEventListener('online', () => { flush().catch(() => {}); });
})();