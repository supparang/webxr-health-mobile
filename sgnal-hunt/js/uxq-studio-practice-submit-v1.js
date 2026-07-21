/* CSAI2601 UX Quest • Structured Studio Submit v1
 * Sends Phase 1 studio evidence through the existing artifact_submitted receiver contract.
 * Links the studio event to the same stable mission_completed attempt ID.
 */
(() => {
  'use strict';

  const PACK = window.CSAI2601_UXQ_STUDIO_PRACTICE_V1;
  const params = new URLSearchParams(location.search || '');
  const nodeId = String(params.get('node') || params.get('id') || '').trim().toUpperCase();
  const nodeKey = nodeId.toLowerCase();
  const spec = PACK?.byId?.(nodeId);
  if (!spec) return;

  const QUEUE_KEY = 'csai2601.uxq.studio.pending.v1';
  const config = () => window.UXQ_CLASSROOM_CONFIG || {};
  const clean = (value, max = 2000) => String(value == null ? '' : value).replace(/\s+/g, ' ').trim().slice(0, max);

  function profile() {
    let stored = {};
    try { stored = window.UXQIdentity?.get?.() || {}; } catch (_) {}
    return {
      studentId:clean(stored.studentId || params.get('studentId') || params.get('sid') || '', 80),
      studentName:clean(stored.studentName || params.get('studentName') || params.get('name') || '', 120),
      section:clean(stored.section || params.get('section') || config().defaultSection || '', 80)
    };
  }

  function lastResult() {
    try { return window.UXQProgress?.get?.()?.missions?.[nodeKey]?.lastResult || {}; }
    catch (_) { return {}; }
  }

  function stableId(parts) {
    return parts.map(part => clean(part, 90).replace(/[^a-z0-9ก-๙_-]+/gi, '-'))
      .filter(Boolean).join('-').slice(0, 160);
  }

  function missionAttemptId(p, result) {
    return stableId([
      'mission',
      config().courseId || 'UXQ-ACT1-2026',
      p.section,
      p.studentId,
      nodeKey,
      result.completedAt || '',
      result.score || 0,
      result.stars || 0
    ]);
  }

  function eventId(linkedAttemptId) {
    const random = (window.crypto && crypto.getRandomValues)
      ? (() => { const a = new Uint32Array(2); crypto.getRandomValues(a); return `${a[0].toString(36)}${a[1].toString(36)}`; })()
      : Math.random().toString(36).slice(2);
    return stableId(['studio', linkedAttemptId, Date.now().toString(36), random]);
  }

  function fieldsFrom(artifact) {
    return Array.from(artifact.querySelectorAll('[data-studio-key]')).map((field, index) => ({
      index,
      key:clean(field.dataset.studioKey, 100),
      label:clean(field.dataset.studioLabel || field.dataset.studioKey, 180),
      value:String(field.value || '').trim().slice(0, 4000),
      required:field.dataset.required === '1',
      format:clean(field.dataset.format || 'text', 40)
    }));
  }

  function fieldMap(fields) {
    return fields.reduce((out, item) => {
      out[item.key] = item.value;
      return out;
    }, {});
  }

  function valuesFor(keys, map) {
    const source = Array.isArray(keys) ? keys : [keys];
    return source.map(key => map[key]).filter(Boolean).join(' | ');
  }

  function payload(artifact) {
    const p = profile();
    const result = lastResult();
    const linkedAttemptId = missionAttemptId(p, result);
    const fields = fieldsFrom(artifact);
    const map = fieldMap(fields);
    const now = new Date().toISOString();
    const evidence = spec.evidenceMap || {};
    const caseId = (() => {
      try {
        const recent = JSON.parse(localStorage.getItem(`csai2601.uxq.canonical.recent.${nodeKey}.v3`) || '[]');
        return Array.isArray(recent) && recent.length ? clean(recent[0], 100) : '';
      } catch (_) { return ''; }
    })();

    return {
      app:'ux-quest',
      schema:'uxq.studio-artifact.v1',
      eventType:'artifact_submitted',
      eventId:eventId(linkedAttemptId),
      attemptId:stableId(['studio-attempt', linkedAttemptId, Date.now().toString(36)]),
      linkedAttemptId,
      occurredAt:now,
      completedAt:now,
      timezone:Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Bangkok',
      pageUrl:clean(location.href, 500),
      courseId:clean(config().courseId || 'UXQ-ACT1-2026', 120),
      courseLabel:clean(config().courseLabel || 'CSAI2601 • UX Quest', 160),
      studentId:p.studentId,
      studentName:p.studentName,
      section:p.section,
      nodeId,
      missionId:nodeKey,
      missionTitle:`${nodeId} • ${spec.studioTitle}`,
      caseId,
      artifactSubmitted:true,
      artifactType:`${nodeKey}_studio_practice_phase1`,
      projectId:clean(map.projectId, 160),
      figmaUrl:clean(map.figmaUrl, 700),
      reviewStatus:'submitted',
      studioVersion:PACK.version,
      problemSeen:valuesFor(evidence.problemSeen || '', map).slice(0, 1500),
      uxReason:valuesFor(evidence.uxReason || '', map).slice(0, 1500),
      fixAndTest:valuesFor(evidence.fixAndTest || '', map).slice(0, 1500),
      reflection:valuesFor('reflection', map).slice(0, 3000),
      learnedPoint:valuesFor(evidence.learnedPoint || 'reflection', map).slice(0, 1500),
      artifactFields:fields,
      selfChecks:spec.selfChecks,
      canonicalArtifact:spec.canonicalArtifact,
      canonicalDashboardFields:spec.dashboardFields,
      score:Number(result.score || 0),
      stars:Number(result.stars || 0),
      accuracy:Number(result.accuracy || 0),
      correct:Number(result.correct || 0),
      total:Number(result.total || 0),
      hints:Number(result.hints || 0),
      durationSec:Number(result.durationSec || 0),
      passed:Boolean(result.passed || Number(result.stars || 0) >= 2),
      source:'csai2601-structured-studio-submit-v1'
    };
  }

  function readQueue() {
    try {
      const parsed = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) { return []; }
  }

  function writeQueue(items) {
    try { localStorage.setItem(QUEUE_KEY, JSON.stringify(items.slice(-30))); }
    catch (_) {}
  }

  function queue(item) {
    const items = readQueue();
    items.push(item);
    writeQueue(items);
    return items.length;
  }

  function send(item) {
    const endpoint = clean(config().receiverUrl || '', 800);
    if (!endpoint) return Promise.resolve({ state:'not_configured' });
    return fetch(endpoint, {
      method:'POST',
      mode:'no-cors',
      cache:'no-store',
      keepalive:true,
      headers:{ 'Content-Type':'text/plain;charset=UTF-8' },
      body:JSON.stringify(item)
    }).then(() => ({ state:'dispatched_unverified', eventId:item.eventId }))
      .catch(error => ({ state:'queued', queued:queue(item), error:String(error?.message || error) }));
  }

  function setStatus(artifact, text, tone = '') {
    const status = artifact.querySelector('[data-save-status]');
    if (!status) return;
    status.textContent = text;
    status.dataset.tone = tone;
  }

  async function submit(button) {
    const artifact = button.closest('.artifact[data-studio-practice-v1]');
    if (!artifact || button.disabled) return;
    const p = profile();
    if (!p.studentId || !p.studentName || !p.section) {
      setStatus(artifact, 'ส่งไม่ได้: โปรไฟล์ผู้เรียนไม่ครบ', 'error');
      return;
    }

    const item = payload(artifact);
    button.disabled = true;
    setStatus(artifact, 'กำลังส่ง Studio Artifact เข้า Google Sheet…');
    const outcome = await send(item);
    button.disabled = false;

    if (outcome.state === 'dispatched_unverified') {
      setStatus(artifact, `ส่งคำขอเข้า Sheet แล้ว • linked mission attempt: ${item.linkedAttemptId}`, 'ok');
      try { localStorage.removeItem(`csai2601.uxq.studio.draft.${nodeKey}.v1`); } catch (_) {}
      window.dispatchEvent(new CustomEvent('uxq-studio-artifact-dispatched', { detail:{ item, outcome } }));
    } else if (outcome.state === 'queued') {
      setStatus(artifact, `เครือข่ายมีปัญหา • เก็บคิวรอส่ง ${outcome.queued || 1} รายการ`, 'error');
    } else {
      setStatus(artifact, 'ยังไม่ได้ตั้งค่า Student Receiver', 'error');
    }
  }

  async function flushQueue() {
    const endpoint = clean(config().receiverUrl || '', 800);
    const items = readQueue();
    if (!endpoint || !items.length) return;
    writeQueue([]);
    for (const item of items) {
      const outcome = await send(item);
      if (outcome.state === 'queued') queue(item);
    }
  }

  document.addEventListener('click', event => {
    const button = event.target.closest?.('[data-studio-submit]');
    if (!button) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    submit(button);
  }, true);

  window.addEventListener('online', flushQueue);
  window.addEventListener('pageshow', flushQueue);
  window.UXQStructuredStudioSubmitV1 = Object.freeze({ version:PACK.version, payload, send, flushQueue });
})();
