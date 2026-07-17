/* CSAI2601 UX Quest • Result Auto Sheet Sync v4.2
 * Single responsibility: silently submit mission_completed when the result screen appears.
 * Artifact submission/status belongs exclusively to uxq-production-support-v2.js.
 * Google Sheet remains the sole authority for official progress and unlocking.
 * v4.2: tolerate legacy/special-node results that omit total; infer canonical 5-item total.
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
  function normalizedResult(raw) {
    const result = raw || {};
    const stars = Number(result.stars || 0);
    const correct = Number(result.correct || 0);
    const passed = Boolean(result.passed || stars >= 2);
    let total = Number(result.total || result.verifiedTotal || 0);
    if (!total && correct > 0) total = Math.max(5, correct);
    if (!total && passed) total = 5;
    const accuracy = Number(result.accuracy || (total ? Math.round((correct / total) * 100) : 0));
    return { ...result, stars, correct, passed, total, accuracy };
  }
  function payload() {
    const result = normalizedResult(lastResult());
    if (!result || !result.total) return null;
    const p = profile();
    if (!p.studentId || !p.studentName || !p.section) return null;
    const now = new Date().toISOString();
    const node = nodeId();
    const courseId = clean(config().courseId || 'UXQ-ACT1-2026', 120);
    const completedAt = clean(result.completedAt || now, 80);
    const eventId = stableId(['mission', courseId, p.section, p.studentId, node.toLowerCase(), completedAt, result.score, result.stars]);
    const caseId = recentCaseId();
    return {
      app: 'ux-quest', schema: 'uxq.mission.v4.2', eventType: 'mission_completed',
      eventId, attemptId: eventId, occurredAt: now, startedAt: '', completedAt,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Bangkok',
      pageUrl: clean(location.href, 500), courseId,
      courseLabel: clean(config().courseLabel || 'CSAI2601 • UX Quest', 160),
      studentId: p.studentId, studentName: p.studentName, section: p.section,
      nodeId: node, missionId: node.toLowerCase(), missionTitle: missionTitle(),
      caseId, caseIds: caseId ? [caseId] : [],
      score: Number(result.score || 0), stars: result.stars,
      accuracy: result.accuracy, correct: result.correct,
      total: result.total, hints: Number(result.hints || 0),
      durationSec: Number(result.durationSec || 0), passed: result.passed,
      verifiedCorrect: result.correct, verifiedTotal: result.total,
      verifiedAccuracy: result.accuracy, maxCombo: Number(result.maxCombo || result.correct || 0),
      attemptNo: Number(result.attemptNo || 0), badge: clean(result.badge || `${node} ${missionTitle()}`, 120),
      answers: Array.isArray(result.answers) ? result.answers : [], source: 'csai2601-result-autosheet-v4.2-mission-silent'
    };
  }
  function post(item) {
    const url = endpoint();
    if (!item || !url) return Promise.resolve({ state: item ? 'not_configured' : 'no_payload' });
    return fetch(url, {
      method: 'POST', mode: 'no-cors', cache: 'no-store', keepalive: true,
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      body: JSON.stringify(item)
    }).then(() => ({ state: 'dispatched_unverified', eventId: item.eventId }))
      .catch((error) => ({ state: 'error', error: String(error?.message || error), eventId: item.eventId }));
  }
  function removeLegacyStatus() {
    document.querySelectorAll('[data-mission-sheet-status-v3],[data-mission-sheet-status-v4]').forEach((el) => el.remove());
  }
  async function autoMission(options = {}) {
    removeLegacyStatus();
    if (!document.querySelector('.results')) return { state: 'no_results' };
    const item = payload();
    if (!item) return { state: 'no_payload' };
    const force = Boolean(options && options.force);
    const sent = readJson(SENT_KEY, {});
    if (!force && sent && sent[item.eventId]) return { state: 'cached', eventId: item.eventId };

    const outcome = await post(item);
    if (outcome.state === 'dispatched_unverified') {
      sent[item.eventId] = new Date().toISOString();
      writeJson(SENT_KEY, sent);
      window.dispatchEvent(new CustomEvent('uxq-mission-sheet-dispatched', { detail:{ item, outcome, force } }));
    }
    return outcome;
  }

  let timer = 0;
  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(() => { autoMission(); }, 80);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', schedule, { once: true });
  else schedule();
  new MutationObserver(schedule).observe(document.getElementById('uxqCanonicalNode') || document.body, { childList: true, subtree: true });
  window.CSAI2601UXQAutoSheet = Object.freeze({ version:'4.2', payload, post, autoMission });
})();