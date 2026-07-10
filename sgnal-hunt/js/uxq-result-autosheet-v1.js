/* CSAI2601 UX Quest • Result Auto Sheet Sync v1
 * Sends mission_completed automatically when the result screen appears.
 * Also sends artifact_submitted when the debrief button is clicked and fields are filled.
 * Keeps existing local-save behavior; this is a safety layer for classroom Sheet logging.
 */
(() => {
  'use strict';

  const SENT_KEY = 'csai2601.uxq.mission.sheet.sent.v1';
  const ARTIFACT_LAST_KEY = 'csai2601.uxq.artifact.sheet.autosync.last.v1';
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
  function uid(prefix) {
    const rnd = Math.random().toString(36).slice(2, 9);
    return `${prefix || 'uxq'}-${Date.now().toString(36)}-${rnd}`;
  }
  function stableId(parts) {
    return parts.map((part) => clean(part, 90).replace(/[^a-z0-9ก-๙_-]+/gi, '-')).filter(Boolean).join('-').slice(0, 160) || uid('mission');
  }
  function profile() {
    const stored = (() => {
      try { return window.UXQIdentity?.get?.() || readJson('uxq.classroom.profile.v1', {}) || {}; }
      catch (error) { return readJson('uxq.classroom.profile.v1', {}) || {}; }
    })();
    const section = clean(stored.section || q().get('section') || q().get('class') || config().defaultSection || '101', 80);
    return {
      studentId: clean(stored.studentId || q().get('studentId') || q().get('sid') || q().get('pid') || `TEST-${section}`, 80),
      studentName: clean(stored.studentName || q().get('studentName') || q().get('name') || 'UX Quest Test Learner', 120),
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
    const brand = document.querySelector('.brand span:last-child')?.textContent || '';
    const h1 = document.querySelector('.results h1, .case h1, .title')?.textContent || '';
    return clean(brand || h1 || nodeId(), 180);
  }
  function base(eventType, schema) {
    const p = profile();
    const now = new Date().toISOString();
    const node = nodeId();
    return {
      app: 'ux-quest', schema, eventType,
      occurredAt: now,
      completedAt: now,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Bangkok',
      pageUrl: clean(location.href, 500),
      courseId: clean(config().courseId || 'UXQ-ACT1-2026', 120),
      courseLabel: clean(config().courseLabel || 'CSAI2601 • UX Quest', 160),
      studentId: p.studentId,
      studentName: p.studentName,
      section: p.section,
      nodeId: node,
      missionId: node.toLowerCase(),
      missionTitle: missionTitle(),
      caseId: recentCaseId()
    };
  }
  function missionPayload() {
    const result = lastResult();
    if (!result || !Number(result.total || 0)) return null;
    const common = base('mission_completed', 'uxq.mission.v2');
    const id = stableId(['mission', common.courseId, common.section, common.studentId, common.missionId, result.completedAt || common.completedAt, result.score, result.stars]);
    return Object.assign(common, {
      eventId: id,
      attemptId: id,
      startedAt: '',
      completedAt: clean(result.completedAt || common.completedAt, 80),
      score: Number(result.score || 0),
      stars: Number(result.stars || 0),
      accuracy: Number(result.accuracy || 0),
      correct: Number(result.correct || 0),
      total: Number(result.total || 0),
      hints: Number(result.hints || 0),
      durationSec: Number(result.durationSec || 0),
      passed: Boolean(result.passed),
      verifiedCorrect: Number(result.correct || 0),
      verifiedTotal: Number(result.total || 0),
      verifiedAccuracy: Number(result.accuracy || 0),
      maxCombo: Number(result.correct || 0),
      attemptNo: 0,
      badge: clean(result.badge || `${common.nodeId} ${common.missionTitle}`, 120),
      caseIds: common.caseId ? [common.caseId] : [],
      answers: [],
      source: 'csai2601-result-autosheet-v1'
    });
  }
  function collectArtifact() {
    const values = {};
    const labels = [];
    Array.from(document.querySelectorAll('.artifact textarea, textarea[data-artifact-field], textarea[data-debrief-index]')).forEach((area, position) => {
      const idx = String(area.dataset.artifactField || area.dataset.debriefIndex || position);
      if (values[idx] != null) return;
      values[idx] = clean(area.value, 1500);
      const label = area.closest('label')?.querySelector('b')?.textContent || `field ${idx}`;
      labels.push({ index: idx, label: clean(label, 160), value: values[idx] });
    });
    return { values, labels };
  }
  function artifactPayload() {
    const result = lastResult();
    const artifact = collectArtifact();
    const problem = artifact.values['0'] || '';
    const why = artifact.values['1'] || '';
    const fixTest = artifact.values['2'] || '';
    const reflection = [problem, why, fixTest].filter(Boolean).join(' | ');
    if (!reflection) return null;
    return Object.assign(base('artifact_submitted', 'uxq.artifact.v2'), {
      eventId: uid('artifact'),
      attemptId: uid('artifact-attempt'),
      artifactSubmitted: true,
      artifactType: 'postgame_debrief_3min',
      problemSeen: problem,
      uxReason: why,
      fixAndTest: fixTest,
      reflection: clean(reflection, 3000),
      learnedPoint: clean(why || problem, 1500),
      artifactFields: artifact.labels,
      score: Number(result.score || 0),
      stars: Number(result.stars || 0),
      accuracy: Number(result.accuracy || 0),
      correct: Number(result.correct || 0),
      total: Number(result.total || 0),
      hints: Number(result.hints || 0),
      durationSec: Number(result.durationSec || 0),
      passed: Boolean(result.passed),
      source: 'csai2601-result-autosheet-v1'
    });
  }
  function status(text) {
    const el = document.querySelector('[data-save-status]');
    if (el) el.textContent = text;
  }
  function post(item) {
    const url = endpoint();
    if (!item || !url) return Promise.resolve({ state:'local_only' });
    return fetch(url, {
      method: 'POST',
      mode: 'no-cors',
      cache: 'no-store',
      keepalive: true,
      headers: { 'Content-Type':'text/plain;charset=UTF-8' },
      body: JSON.stringify(item)
    }).then(() => ({ state:'dispatched_unverified' }))
      .catch((error) => ({ state:'error', error:String(error?.message || error) }));
  }
  function autoMission() {
    if (!document.querySelector('.results')) return;
    const item = missionPayload();
    if (!item) return;
    const sent = readJson(SENT_KEY, {});
    if (sent && sent[item.eventId]) return;
    sent[item.eventId] = new Date().toISOString();
    writeJson(SENT_KEY, sent);
    post(item).then((outcome) => {
      if (outcome.state === 'dispatched_unverified') status('ส่งผลการเล่นเข้า Sheet แล้ว • กรอก debrief แล้วกดบันทึกได้');
      else status('บันทึกผลในเครื่องแล้ว • ยังส่ง Sheet ไม่ได้');
    });
  }
  function bindArtifactButton() {
    document.querySelectorAll('[data-save-artifact]').forEach((button) => {
      if (button.dataset.autoSheetBound === '1') return;
      button.dataset.autoSheetBound = '1';
      button.addEventListener('click', () => {
        const item = artifactPayload();
        if (!item) { status('ผลการเล่นส่งเข้า Sheet แล้ว • ถ้าจะส่ง debrief ให้กรอกอย่างน้อย 1 ช่อง'); return; }
        writeJson(ARTIFACT_LAST_KEY, item);
        status('กำลังส่ง debrief เข้า Sheet...');
        post(item).then((outcome) => {
          if (outcome.state === 'dispatched_unverified') status('ส่งผลการเล่น + debrief เข้า Sheet แล้ว');
          else status('บันทึก debrief ในเครื่องแล้ว • ยังส่ง Sheet ไม่ได้');
        });
      }, true);
    });
  }
  let timer = 0;
  function run() { clearTimeout(timer); timer = setTimeout(() => { autoMission(); bindArtifactButton(); }, 80); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run, { once:true }); else run();
  new MutationObserver(run).observe(document.documentElement, { childList:true, subtree:true });
  window.CSAI2601UXQAutoSheet = Object.freeze({ missionPayload, artifactPayload, autoMission });
})();