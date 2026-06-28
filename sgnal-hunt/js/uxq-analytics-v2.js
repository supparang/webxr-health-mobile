/* UX Quest • Classroom Analytics v3
   Queue-safe, write-only mission summaries with truthful submission receipts.
   Important: a no-cors browser request can confirm only that dispatch was attempted;
   it cannot confirm that Apps Script or Google Sheets stored the row.
*/
(() => {
  'use strict';

  const KEY = 'uxq.classroom.queue.v1';
  const RECEIPT_KEY = 'uxq.classroom.last-receipt.v1';
  const memory = new Map();
  const config = () => window.UXQ_CLASSROOM_CONFIG || {};
  let lastReceipt = null;

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
  function receiptMessage(receipt){
    if (!receipt) return 'ผลของรอบนี้เก็บไว้ในอุปกรณ์นี้';
    const code = receipt.attemptId ? ` • รหัสรอบ ${receipt.attemptId}` : '';
    if (receipt.state === 'confirmed') return `ยืนยันการบันทึกจากระบบแล้ว${code}`;
    if (receipt.state === 'dispatched_unverified') return `บันทึกในอุปกรณ์แล้ว • ส่งคำขอไปยังระบบชั้นเรียนแล้ว (ยังไม่ยืนยันการบันทึกจากหน้านี้)${code}`;
    if (receipt.state === 'queued') return `บันทึกในอุปกรณ์แล้ว • รอส่งเข้าสู่ระบบชั้นเรียนเมื่อเชื่อมต่อ${code}`;
    if (receipt.state === 'profile_incomplete') return `บันทึกความคืบหน้าในอุปกรณ์นี้แล้ว • กรอกข้อมูลผู้เรียนให้ครบก่อนส่งผลเข้าชั้นเรียน${code}`;
    return `บันทึกในอุปกรณ์นี้แล้ว${code}`;
  }
  function readReceipt(){
    if (lastReceipt) return lastReceipt;
    const raw = safeGet(window.localStorage, RECEIPT_KEY) || safeGet(window.sessionStorage, RECEIPT_KEY) || memory.get(RECEIPT_KEY);
    if (!raw) return null;
    try { lastReceipt = JSON.parse(raw); return lastReceipt; }
    catch (error) { return null; }
  }
  function saveReceipt(receipt){
    const next = Object.assign({}, receipt || {}, {
      updatedAt: new Date().toISOString()
    });
    lastReceipt = next;
    const text = JSON.stringify(next);
    if (!safeSet(window.localStorage, RECEIPT_KEY, text)) {
      if (!safeSet(window.sessionStorage, RECEIPT_KEY, text)) memory.set(RECEIPT_KEY, text);
    }
    try { window.dispatchEvent(new CustomEvent('uxq:submission-receipt', { detail: next })); }
    catch (error) {}
    return next;
  }
  function statusText(){
    const receipt = readReceipt();
    if (receipt) return receiptMessage(receipt);
    if (!config().receiverUrl) return 'ผลของรอบนี้เก็บไว้ในอุปกรณ์นี้ — ยังไม่ได้เปิดการเชื่อมต่อชั้นเรียน';
    if (!canRecord()) return 'บันทึกความคืบหน้าในอุปกรณ์นี้แล้ว — กรอกข้อมูลผู้เรียนให้ครบเพื่อส่งผลเข้าชั้นเรียน';
    const queued = getQueue().length;
    return queued ? `บันทึกในอุปกรณ์แล้ว • มี ${queued} รอบรอส่งเมื่อเชื่อมต่อ` : 'บันทึกในอุปกรณ์แล้ว • พร้อมส่งเข้าสู่ระบบชั้นเรียน';
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
  function enqueue(payload){
    const queue = getQueue();
    queue.push(payload);
    putQueue(queue);
    return getQueue().length;
  }
  function submit(payload){
    const endpoint = String(config().receiverUrl || '').trim();
    if (!endpoint || !payload) return Promise.resolve({ state: 'local_only', queued: false, verified: false });
    return fetch(endpoint, {
      method: 'POST',
      mode: 'no-cors',
      cache: 'no-store',
      keepalive: true,
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      body: JSON.stringify(payload)
    }).then(() => ({ state: 'dispatched_unverified', queued: false, verified: false }))
      .catch((error) => ({
        state: 'queued',
        queued: true,
        verified: false,
        queueLength: enqueue(payload),
        error: String(error?.message || error)
      }));
  }
  function flush(){
    if (!canRecord()) return Promise.resolve({ skipped: true, sent: 0, queued: getQueue().length });
    const queue = getQueue();
    if (!queue.length) return Promise.resolve({ skipped: false, sent: 0, queued: 0 });
    putQueue([]);
    return queue.reduce((chain, item) => chain.then((summary) => submit(item).then((outcome) => {
      summary.sent += outcome.state === 'dispatched_unverified' ? 1 : 0;
      summary.queued += outcome.state === 'queued' ? 1 : 0;
      return summary;
    })), Promise.resolve({ skipped: false, sent: 0, queued: 0 }));
  }
  function makeReceipt(payload, state, extra){
    return Object.assign({
      receiptId: id('receipt'),
      app: payload.app,
      attemptId: payload.attemptId,
      eventId: payload.eventId,
      missionId: payload.missionId,
      missionTitle: payload.missionTitle,
      state,
      verified: state === 'confirmed',
      createdAt: new Date().toISOString()
    }, extra || {});
  }
  function recordMissionComplete(data){
    const payload = buildAttempt(data || {});
    const endpoint = String(config().receiverUrl || '').trim();
    let receipt;

    if (!endpoint) {
      receipt = saveReceipt(makeReceipt(payload, 'local_only', { reason: 'receiver_not_configured' }));
      return { queued: false, skipped: true, message: receiptMessage(receipt), attemptId: payload.attemptId, eventId: payload.eventId, receipt };
    }
    if (!canRecord()) {
      receipt = saveReceipt(makeReceipt(payload, 'profile_incomplete', { reason: 'profile_incomplete' }));
      return { queued: false, skipped: true, message: receiptMessage(receipt), attemptId: payload.attemptId, eventId: payload.eventId, receipt };
    }

    receipt = saveReceipt(makeReceipt(payload, 'dispatching', { reason: 'request_started' }));
    const delivery = flush()
      .catch(() => ({ skipped: false, sent: 0, queued: 0 }))
      .then(() => submit(payload))
      .then((outcome) => {
        const updated = saveReceipt(Object.assign({}, receipt, {
          state: outcome.state,
          verified: false,
          queueLength: outcome.queueLength || 0,
          deliveryError: outcome.error || ''
        }));
        return updated;
      });

    return {
      queued: false,
      skipped: false,
      message: 'บันทึกในอุปกรณ์แล้ว • กำลังส่งคำขอไปยังระบบชั้นเรียน',
      attemptId: payload.attemptId,
      eventId: payload.eventId,
      receipt,
      delivery
    };
  }

  window.addEventListener('online', () => { flush(); });
  window.addEventListener('pageshow', () => { flush(); });

  window.UXQSubmissionReceipt = Object.freeze({ getLast: readReceipt, message: receiptMessage });
  window.UXQAnalytics = Object.freeze({ KEY, RECEIPT_KEY, id, canRecord, statusText, flush, recordMissionComplete });
})();
