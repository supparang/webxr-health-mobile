/* CSAI2601 UX Quest • Sheet Sync v1
 * Sends the post-game artifact/debrief note to the configured Google Apps Script receiver.
 * The canonical player still saves locally first; this patch adds classroom Sheet dispatch.
 */
(() => {
  'use strict';

  const QUEUE_KEY = 'csai2601.uxq.artifact.sheet.queue.v1';
  const LAST_KEY = 'csai2601.uxq.artifact.sheet.last.v1';
  const params = () => new URLSearchParams(location.search || '');
  const nodeId = () => String(params().get('node') || params().get('id') || 'W1').toUpperCase();
  const nodeKey = () => nodeId().toLowerCase();
  const config = () => window.UXQ_CLASSROOM_CONFIG || {};
  const endpoint = () => String(config().receiverUrl || '').trim();

  function uid(prefix) {
    const rnd = (window.crypto && crypto.getRandomValues)
      ? (() => { const a = new Uint32Array(2); crypto.getRandomValues(a); return `${a[0].toString(36)}${a[1].toString(36)}`; })()
      : Math.random().toString(36).slice(2);
    return `${prefix || 'uxq'}-${Date.now().toString(36)}-${rnd}`;
  }

  function readJson(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || sessionStorage.getItem(key) || ''); }
    catch (error) { return fallback; }
  }

  function writeJson(key, value) {
    const text = JSON.stringify(value);
    try { localStorage.setItem(key, text); return true; }
    catch (error) {}
    try { sessionStorage.setItem(key, text); return true; }
    catch (error) {}
    return false;
  }

  function profile() {
    const fromIdentity = (() => { try { return window.UXQIdentity?.get?.() || null; } catch (error) { return null; } })();
    const stored = fromIdentity || readJson('uxq.classroom.profile.v1', {}) || {};
    const q = params();
    return {
      studentId: String(stored.studentId || q.get('studentId') || q.get('sid') || q.get('pid') || '').trim().slice(0, 80),
      studentName: String(stored.studentName || q.get('studentName') || q.get('name') || '').trim().slice(0, 120),
      section: String(stored.section || q.get('section') || q.get('class') || config().defaultSection || '').trim().slice(0, 80)
    };
  }

  function recentCaseId() {
    const recent = readJson(`csai2601.uxq.canonical.recent.${nodeKey()}.v3`, []);
    return Array.isArray(recent) && recent.length ? String(recent[0] || '') : '';
  }

  function lastResult() {
    try {
      const mission = window.UXQProgress?.get?.()?.missions?.[nodeKey()] || {};
      return mission.lastResult || {};
    } catch (error) { return {}; }
  }

  function collectArtifact() {
    const values = {};
    const labels = [];
    document.querySelectorAll('textarea[data-artifact-field]').forEach((area) => {
      const idx = String(area.dataset.artifactField || '0');
      values[idx] = String(area.value || '').trim().slice(0, 1500);
      const label = area.closest('label')?.querySelector('b')?.textContent || '';
      labels.push({ index: idx, label: String(label).trim().slice(0, 160), value: values[idx] });
    });
    return { values, labels };
  }

  function payload() {
    const p = profile();
    const result = lastResult();
    const artifact = collectArtifact();
    const now = new Date().toISOString();
    const node = nodeId();
    const problem = artifact.values['0'] || '';
    const why = artifact.values['1'] || '';
    const fixTest = artifact.values['2'] || '';
    return {
      app: 'ux-quest',
      schema: 'uxq.artifact.v1',
      eventType: 'artifact_submitted',
      eventId: uid('artifact'),
      attemptId: uid('artifact-attempt'),
      occurredAt: now,
      completedAt: now,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Bangkok',
      pageUrl: String(location.href || '').slice(0, 500),
      courseId: String(config().courseId || 'UXQ-ACT1-2026').slice(0, 120),
      courseLabel: String(config().courseLabel || 'CSAI2601 • UX Quest').slice(0, 160),
      studentId: p.studentId,
      studentName: p.studentName,
      section: p.section,
      nodeId: node,
      missionId: node.toLowerCase(),
      missionTitle: document.querySelector('.brand span:last-child')?.textContent || node,
      caseId: recentCaseId(),
      artifactSubmitted: true,
      artifactType: 'postgame_debrief_3min',
      reflection: [problem, why, fixTest].filter(Boolean).join(' | ').slice(0, 3000),
      learnedPoint: why.slice(0, 1500),
      problemSeen: problem,
      uxReason: why,
      fixAndTest: fixTest,
      artifactFields: artifact.labels,
      score: Number(result.score || 0),
      stars: Number(result.stars || 0),
      accuracy: Number(result.accuracy || 0),
      correct: Number(result.correct || 0),
      total: Number(result.total || 0),
      hints: Number(result.hints || 0),
      durationSec: Number(result.durationSec || 0),
      passed: Boolean(result.passed),
      source: 'csai2601-canonical-node-sheet-sync-v1'
    };
  }

  function queue(item) {
    const list = readJson(QUEUE_KEY, []);
    const next = (Array.isArray(list) ? list : []).concat([item]).slice(-20);
    writeJson(QUEUE_KEY, next);
    return next.length;
  }

  function submit(item) {
    const url = endpoint();
    if (!url) return Promise.resolve({ state: 'local_only', reason: 'receiver_not_configured' });
    return fetch(url, {
      method: 'POST',
      mode: 'no-cors',
      cache: 'no-store',
      keepalive: true,
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      body: JSON.stringify(item)
    }).then(() => ({ state: 'dispatched_unverified' }))
      .catch((error) => ({ state: 'queued', queued: queue(item), error: String(error?.message || error) }));
  }

  function setStatus(message) {
    const status = document.querySelector('[data-save-status]');
    if (status) status.textContent = message;
  }

  function bindButton() {
    document.querySelectorAll('[data-save-artifact]').forEach((button) => {
      if (button.dataset.sheetSyncBound === '1') return;
      button.dataset.sheetSyncBound = '1';
      button.addEventListener('click', () => {
        const item = payload();
        writeJson(LAST_KEY, item);
        setStatus('บันทึกในเครื่องแล้ว • กำลังส่งเข้า Sheet...');
        window.setTimeout(() => {
          submit(item).then((outcome) => {
            if (outcome.state === 'dispatched_unverified') setStatus('บันทึกในเครื่องแล้ว • ส่งคำขอเข้า Sheet แล้ว');
            else if (outcome.state === 'queued') setStatus(`บันทึกในเครื่องแล้ว • รอส่งเข้า Sheet (${outcome.queued || 1})`);
            else setStatus('บันทึกในเครื่องแล้ว • ยังไม่ได้ตั้งค่า Sheet receiver');
          });
        }, 60);
      });
    });
  }

  function flushQueue() {
    const list = readJson(QUEUE_KEY, []);
    if (!Array.isArray(list) || !list.length || !endpoint()) return;
    writeJson(QUEUE_KEY, []);
    list.reduce((chain, item) => chain.then(() => submit(item).then((outcome) => {
      if (outcome.state === 'queued') queue(item);
    })), Promise.resolve());
  }

  let timer = 0;
  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(bindButton, 30);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', schedule, { once: true });
  else schedule();
  window.addEventListener('online', flushQueue);
  window.addEventListener('pageshow', flushQueue);
  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
  window.CSAI2601UXQSheetSync = Object.freeze({ payload, submit, flushQueue });
})();
