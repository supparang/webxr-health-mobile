/* CSAI2601 UX Quest • Result Auto Sheet Sync v4
 * Single responsibility: silently submit mission_completed when the result screen appears.
 * Artifact submission/status belongs exclusively to uxq-production-support-v2.js.
 * No mission status card is rendered, preventing duplicate status messages in the result UI.
 */
(() => {
  'use strict';

  const SENT_KEY = 'csai2601.uxq.mission.sheet.sent.v4';
  const q = () => new URLSearchParams(location.search || '');
  const nodeId = () => String(q().get('node') || q().get('id') || 'W1').toUpperCase();
  const nodeKey = () => nodeId().toLowerCase();
  const config = () => window.UXQ_CLASSROOM_CONFIG || {};
  const endpoint = () => String(config().receiverUrl || '').trim();
  const clean = (value, max) => String(value == null ? '' : value).trim().slice(0, max || 500);

  function readJson(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || sessionStorage.getItem(key) || ''); }
    catch (error) { return fallback; }
  }
  function writeJson(key, value) {
    const text = JSON.stringify(value);
    try { localStorage.setItem(key, text); return true; } catch (error) {}
    try { sessionStorage.setItem(key, text); return true; } catch (error) {}
    return false;
  }
  function stableId(parts) {
    return parts.map((part) => clean(part, 90).replace(/[^a-z0-9ก-๙_-]+/gi, '-'))
      .filter(Boolean).join('-').slice(0, 160);
  }
  function profile() {
    let stored = {};
    try { stored = window.UXQIdentity?.get?.() || readJson('uxq.classroom.profile.v1', {}) || {}; }
    catch (error) { stored = readJson('uxq.classroom.profile.v1', {}) || {}; }
    const section = clean(stored.section || q().get('section') || q().get('class') || config().defaultSection || '', 80);
    return {
      studentId: clean(stored.studentId || q().get('studentId') || q().get('sid') || q().get('pid') || '', 80),
      studentName: clean(stored.studentName || q().get('studentName') || q().get('name') || '', 120),
      section
    };
  }
  function lastResult() {
    try { return window.UXQProgress?.get?.()?.missions?.[nodeKey()]?.lastResult || {}; }
    catch (error) { return {}; }
  }
  function recentCaseId() {
    const recent = readJson(`csai2601.uxq.canonical.recent.${nodeKey()}.v3`, []);
    return Array.isArray(recent) && recent.length ? clean(recent[0], 100) : '';
  }
  function missionTitle() {
    return clean(
      document.querySelector('.brand span:last-child')?.textContent ||
      document.querySelector('.results h1, .case h1, .title')?.textContent ||
      nodeId(),
      180
    );
  }
  function payload() {
    const result = lastResult();
    if (!result || !Number(result.total || 0)) return null;
    const p = profile();
    if (!p.studentId || !p.studentName || !p.section) return null;
    const now = new Date().toISOString();
    const node = nodeId();
    const courseId = clean(config().courseId || 'UXQ-ACT1-2026', 120);
    const completedAt = clean(result.completedAt || now, 80);
    const eventId = stableId(['mission', courseId, p.section, p.studentId, node.toLowerCase(), completedAt, result.score, result.stars]);
    const caseId = recentCaseId();
    return {
      app: 'ux-quest', schema: 'uxq.mission.v4', eventType: 'mission_completed',
      eventId, attemptId: eventId, occurredAt: now, startedAt: '', completedAt,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Bangkok',
      pageUrl: clean(location.href, 500), courseId,
      courseLabel: clean(config().courseLabel || 'CSAI2601 • UX Quest', 160),
      studentId: p.studentId, studentName: p.studentName, section: p.section,
      nodeId: node, missionId: node.toLowerCase(), missionTitle: missionTitle(),
      caseId, caseIds: caseId ? [caseId] : [],
      score: Number(result.score || 0), stars: Number(result.stars || 0),
      accuracy: Number(result.accuracy || 0), correct: Number(result.correct || 0),
      total: Number(result.total || 0), hints: Number(result.hints || 0),
      durationSec: Number(result.durationSec || 0), passed: Boolean(result.passed),
      verifiedCorrect: Number(result.correct || 0), verifiedTotal: Number(result.total || 0),
      verifiedAccuracy: Number(result.accuracy || 0), maxCombo: Number(result.correct || 0),
      attemptNo: 0, badge: clean(result.badge || `${node} ${missionTitle()}`, 120),
      answers: [], source: 'csai2601-result-autosheet-v4-mission-silent'
    };
  }
  function post(item) {
    const url = endpoint();
    if (!item || !url) return Promise.resolve({ state: 'not_configured' });
    return fetch(url, {
      method: 'POST', mode: 'no-cors', cache: 'no-store', keepalive: true,
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      body: JSON.stringify(item)
    }).then(() => ({ state: 'dispatched_unverified' }))
      .catch((error) => ({ state: 'error', error: String(error?.message || error) }));
  }
  function removeLegacyStatus() {
    document.querySelectorAll('[data-mission-sheet-status-v3],[data-mission-sheet-status-v4]').forEach((el) => el.remove());
  }
  function autoMission() {
    removeLegacyStatus();
    if (!document.querySelector('.results')) return;
    const item = payload();
    if (!item) return;
    const sent = readJson(SENT_KEY, {});
    if (sent && sent[item.eventId]) return;
    sent[item.eventId] = new Date().toISOString();
    writeJson(SENT_KEY, sent);
    post(item);
  }

  let timer = 0;
  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(autoMission, 80);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', schedule, { once: true });
  else schedule();
  new MutationObserver(schedule).observe(document.getElementById('uxqCanonicalNode') || document.body, { childList: true, subtree: true });
  window.CSAI2601UXQAutoSheet = Object.freeze({ payload, autoMission });
})();
