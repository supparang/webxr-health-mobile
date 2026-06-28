/* UX Quest • Classroom Analytics v2
   Queue-safe, write-only mission summaries. No data is sent until receiverUrl is configured
   and the learner has a complete classroom profile.
*/
(() => {
  'use strict';

  const KEY = 'uxq.classroom.queue.v1';
  const memory = new Map();
  const config = () => window.UXQ_CLASSROOM_CONFIG || {};

  function id(prefix){
    const cryptoPart = window.crypto?.getRandomValues
      ? (() => { const a = new Uint32Array(2); window.crypto.getRandomValues(a); return `${a[0].toString(36)}${a[1].toString(36)}`; })()
      : Math.random().toString(36).slice(2);
    return `${prefix || 'uxq'}-${Date.now().toString(36)}-${cryptoPart}`;
  }
  function safeGet(area, key){ try { return area.getItem(key); } catch (error) { return null; } }
  function safeSet(area, key, value){ try { area.setItem(key, value); return true; } catch (error) { return false; } }
  function getQueue(){
    const raw = safeGet(window.localStorage, KEY) || safeGet(window.sessionStorage, KEY) || memory.get(KEY) || '[]';
    try { return Array.isArray(JSON.parse(raw)) ? JSON.parse(raw) : []; }
    catch (error) { return []; }
  }
  function putQueue(items){
    const limit = Math.max(1, Number(config().maxQueuedAttempts || 12));
    const next = (Array.isArray(items) ? items : []).slice(-limit);
    const text = JSON.stringify(next);
    if (!safeSet(window.localStorage, KEY, text)) {
      if (!safeSet(window.sessionStorage, KEY, text)) memory.set(KEY, text);
    }
    return next;
  }
  function profile(){
    try { return window.UXQIdentity?.get?.() || {}; }
    catch (error) { return {}; }
  }
  function canRecord(){
    const p = profile();
    return Boolean(config().receiverUrl && window.UXQIdentity?.isComplete?.(p));
  }
  function statusText(){
    if (!config().receiverUrl) return 'ผลของรอบนี้เก็บไว้ในอุปกรณ์นี้ — ยังไม่ได้เปิดการเชื่อมต่อชั้นเรียน';
    if (!canRecord()) return 'บันทึกความคืบหน้าในอุปกรณ์นี้แล้ว — กรอกข้อมูลผู้เรียนให้ครบเพื่อส่งผลเข้าชั้นเรียน';
    const queued = getQueue().length;
    return queued ? `บันทึกผลแล้ว • มี ${queued} รอบรอส่งเมื่อเชื่อมต่อ` : 'ส่งผลไปยังระบบชั้นเรียนแล้ว • ระบบกำลังประมวลผล';
  }
  function slimAnswers(items){
    return (Array.isArray(items) ? items : []).slice(0, 32).map((item) => ({
      questionId: String(item.questionId || '').slice(0, 160),
      caseId: String(item.caseId || '').slice(0, 100),
      caseName: String(item.caseName || '').slice(0, 160),
      stageKey: String(item.stageKey || '').slice(0, 80),
      correct: Boolean(item.correct),
      selected: String(item.selected || '').slice(0, 420),
      earned: Number(item.earned || 0)
    }));
  }
  function buildAttempt(data){
    const p = profile();
    const now = new Date().toISOString();
    return {
      app: 'ux-quest',
      schema: 'uxq.classroom.v1',
      eventType: 'mission_completed',
      eventId: id('evt'),
      attemptId: String(data.attemptId || id('attempt')),
      occurredAt: now,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Bangkok',
      pageUrl: String(location.href || '').slice(0, 500),
      courseId: String(config().courseId || 'UXQ-ACT1').slice(0, 120),
      courseLabel: String(config().courseLabel || 'UX Quest').slice(0, 160),
      studentId: String(p.studentId || '').slice(0, 80),
      studentName: String(p.studentName || '').slice(0, 120),
      section: String(p.section || '').slice(0, 80),
      missionId: String(data.missionId || '').slice(0, 24),
      missionTitle: String(data.missionTitle || '').slice(0, 180),
      startedAt: data.startedAt || null,
      completedAt: data.completedAt || now,
      score: Number(data.score || 0),
      stars: Number(data.stars || 0),
      accuracy: Number(data.accuracy || 0),
      correct: Number(data.correct || 0),
      total: Number(data.total || 0),
      hints: Number(data.hints || 0),
      durationSec: Number(data.durationSec || 0),
      maxCombo: Number(data.maxCombo || 0),
      attemptNo: Number(data.attemptNo || 0),
      passed: Boolean(data.passed),
      badge: String(data.badge || '').slice(0, 120),
      caseIds: (Array.isArray(data.caseIds) ? data.caseIds : []).map(v => String(v).slice(0, 100)),
      answers: slimAnswers(data.answers)
    };
  }
  function submit(payload){
    const endpoint = String(config().receiverUrl || '').trim();
    if (!endpoint || !payload) return Promise.resolve({ skipped: true });
    return fetch(endpoint, {
      method: 'POST',
      mode: 'no-cors',
      cache: 'no-store',
      keepalive: true,
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      body: JSON.stringify(payload)
    }).then(() => ({ queued: false })).catch((error) => {
      const queue = getQueue();
      queue.push(payload);
      putQueue(queue);
      return { queued: true, error: String(error?.message || error) };
    });
  }
  function flush(){
    if (!canRecord()) return Promise.resolve({ skipped: true });
    const queue = getQueue();
    if (!queue.length) return Promise.resolve({ sent: 0 });
    putQueue([]);
    return queue.reduce((chain, item) => chain.then(() => submit(item)), Promise.resolve())
      .then(() => ({ sent: queue.length }));
  }
  function recordMissionComplete(data){
    if (!canRecord()) return { queued: false, skipped: true, message: statusText() };
    const payload = buildAttempt(data || {});
    // Try prior offline attempts first, without delaying the game result screen.
    flush();
    submit(payload);
    return { queued: false, skipped: false, message: statusText(), attemptId: payload.attemptId };
  }

  window.addEventListener('online', () => { flush(); });
  window.addEventListener('pageshow', () => { flush(); });

  window.UXQAnalytics = Object.freeze({ KEY, id, canRecord, statusText, flush, recordMissionComplete });
})();
