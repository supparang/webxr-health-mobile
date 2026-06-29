/* =========================================================
   CSAI2102 AI Quest — S2 AR Result Bridge v4.0.6
   File: /ai-quest/js/aiquest-s2-ar-result-bridge-v406.js

   Purpose:
   - Send completed S2 AR Agent Builder evidence to session_events.
   - Recover V401 and earlier local results when the learner opens Student Page.
   - Keep S2 AR supplementary; never change S2 score, accuracy, or gate.
========================================================= */
(() => {
  'use strict';

  const VERSION = 'v4.0.6-s2-ar-reliable-event-sync';
  const RESULT_KEYS = [
    'AIQUEST_S2_AR_RESULT_V401',
    'AIQUEST_S2_AR_RESULT_V387',
    'AIQUEST_S2_AR_RESULT_V386',
    'AIQUEST_S2_AR_PRACTICE_RESULT_V386'
  ];
  const RECEIPT_KEY = 'AIQUEST_S2_AR_EVENT_SYNC_V406';
  const LEGACY_RECEIPT_KEY = 'AIQUEST_S2_AR_EVENT_SYNC_V405';
  const FALLBACK_ENDPOINT = 'https://script.google.com/macros/s/AKfycbwXSUHbhVbZtKcjNIDzs4TawAohdeInm1MxLpomVeST2JilOL3L0LWQtT4_Yb7fbJG9/exec';

  let busy = false;
  let lastSignature = '';

  function readJson(key){
    try { return JSON.parse(localStorage.getItem(key) || 'null'); }
    catch (_) { return null; }
  }

  function writeJson(key, value){
    try { localStorage.setItem(key, JSON.stringify(value || {})); }
    catch (_) {}
  }

  function getResult(){
    const direct = window.AIQUEST_S2_AR_RESULT;
    if (direct?.arCompleted && (direct.sessionId === 's2' || direct.missionId === 'm2')) return direct;

    for (const key of RESULT_KEYS) {
      const item = readJson(key);
      if (item?.arCompleted && (item.sessionId === 's2' || item.missionId === 'm2')) return item;
    }
    return null;
  }

  function evidence(){
    const result = getResult();
    if (!result?.arCompleted) return null;

    const total = Number(result.total || result.arTotal || 0);
    const correct = Number(result.correct || result.arCorrect || 0);
    const score = Math.round(Number(result.arScore ?? result.score ?? result.accuracy ?? (total ? correct * 100 / total : 0)));

    return {
      activity: 'S2 AR Practice: Agent Builder',
      supplementary: true,
      completed: true,
      score,
      accuracy: score,
      correct,
      total,
      helpUsed: Number(result.helpUsed || result.arHelpUsed || 0),
      usedSec: Number(result.usedSec || result.arUsedSec || 0),
      inputMode: String(result.inputMode || result.arInputMode || 'hand_or_mouse_touch'),
      arVersion: String(result.version || ''),
      completedAt: String(result.finishedAt || result.completedAt || new Date().toISOString())
    };
  }

  function getProfile(){
    const direct = window.AIQuestStorage?.getProfile?.() || {};
    if (direct.studentId) return direct;

    try {
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i) || '';
        if (!/aiquest|profile|classroom/i.test(key)) continue;
        const item = readJson(key);
        if (item?.studentId) return item;
      }
    } catch (_) {}

    return {};
  }

  function signature(ar){
    return [ar?.completedAt || '', ar?.score || 0, ar?.correct || 0, ar?.total || 0, ar?.helpUsed || 0].join('|');
  }

  function endpoint(){
    const config = window.AIQuestDataContract?.loadConfig?.() || {};
    return config.appsScriptUrl || FALLBACK_ENDPOINT;
  }

  function makeId(prefix){
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }

  function buildPayload(ar, profile){
    const trace = {
      activity: ar.activity,
      supplementary: true,
      completed: true,
      score: ar.score,
      accuracy: ar.accuracy,
      correct: ar.correct,
      total: ar.total,
      helpUsed: ar.helpUsed,
      usedSec: ar.usedSec,
      inputMode: ar.inputMode,
      arVersion: ar.arVersion,
      completedAt: ar.completedAt
    };

    const raw = {
      eventId: makeId('s2ar'),
      attemptId: `s2_ar_practice_${String(profile.studentId || 'anon')}_${Date.now()}`,
      studentId: String(profile.studentId || ''),
      studentName: String(profile.studentName || profile.name || ''),
      section: String(profile.section || '101'),
      sessionId: 's2',
      missionId: 'm2',
      runMode: 'practice',
      eventType: 's2_ar_complete',
      phase: 'S2 AR Practice',
      itemId: 'agent_builder',
      prompt: 'S2 AR Practice: Agent Builder',
      yourAnswer: JSON.stringify(trace),
      correctAnswer: 'completed',
      isCorrect: true,
      scoreDelta: Number(ar.score || 0),
      combo: Number(ar.correct || 0),
      helpLeft: Math.max(0, 3 - Number(ar.helpUsed || 0)),
      clientTs: ar.completedAt,
      extraJson: { eventKind: 's2_ar_practice', s2ArPractice: trace }
    };

    return window.AIQuestDataContract?.buildEvent
      ? window.AIQuestDataContract.buildEvent(raw, {
          attemptId: raw.attemptId,
          studentId: raw.studentId,
          sessionId: 's2',
          missionId: 'm2'
        })
      : raw;
  }

  function statusHost(){
    return document.getElementById('aiquestS2ArEntryV405') ||
      document.getElementById('aiquestArLauncherV401');
  }

  function renderStatus(message, tone){
    const host = statusHost();
    if (!host) return;

    let box = document.getElementById('s2ArBridgeStatusV406');
    if (!box) {
      box = document.createElement('div');
      box.id = 's2ArBridgeStatusV406';
      box.style.cssText = 'clear:both;margin-top:10px;padding:9px 11px;border-radius:13px;font-size:12px;font-weight:900;line-height:1.45';
      host.appendChild(box);
    }

    const good = tone === 'good';
    box.style.background = good ? 'rgba(16,185,129,.14)' : 'rgba(245,158,11,.14)';
    box.style.border = `1px solid ${good ? 'rgba(16,185,129,.34)' : 'rgba(245,158,11,.34)'}`;
    box.style.color = good ? '#bbf7d0' : '#fde68a';
    box.textContent = message;
  }

  function renderReceipt(){
    const ar = evidence();
    if (!ar) return;
    const receipt = readJson(RECEIPT_KEY) || {};
    const ok = receipt.signature === signature(ar) && receipt.status === 'queued';

    renderStatus(
      ok
        ? `✓ ส่งหลักฐาน S2 AR แล้ว: ${ar.correct}/${ar.total} • ${ar.score}% • Teacher Dashboard: S2 AR Practice`
        : `S2 AR ล่าสุด: ${ar.correct}/${ar.total} • ${ar.score}% • กำลังเตรียมส่งหลักฐาน`,
      ok ? 'good' : 'warn'
    );
  }

  function recoverLegacyReceipt(sig){
    const legacy = readJson(LEGACY_RECEIPT_KEY) || {};
    if (legacy.signature === sig && legacy.status === 'queued') {
      writeJson(RECEIPT_KEY, { ...legacy, bridge: VERSION, recoveredFrom: LEGACY_RECEIPT_KEY });
      return true;
    }
    return false;
  }

  async function sync(){
    const ar = evidence();
    if (!ar || busy) return false;

    const sig = signature(ar);
    const receipt = readJson(RECEIPT_KEY) || {};
    if (receipt.signature === sig && receipt.status === 'queued') return true;
    if (recoverLegacyReceipt(sig)) return true;

    const profile = getProfile();
    if (!profile.studentId) {
      renderStatus('S2 AR พบผลในเครื่อง แต่ยังไม่พบ Student Profile สำหรับส่งข้อมูล', 'warn');
      return false;
    }

    const url = endpoint();
    if (!url) {
      renderStatus('S2 AR ไม่พบ Apps Script endpoint', 'warn');
      return false;
    }

    const event = buildPayload(ar, profile);
    busy = true;
    renderStatus('กำลังส่งหลักฐาน S2 AR…', 'warn');

    try {
      await fetch(url, {
        method: 'POST',
        mode: 'no-cors',
        cache: 'no-store',
        keepalive: true,
        headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
        body: JSON.stringify({ action: 'sync_v23', kind: 'event', payload: event })
      });

      writeJson(RECEIPT_KEY, {
        signature: sig,
        status: 'queued',
        eventId: event.eventId,
        studentId: String(profile.studentId),
        queuedAt: new Date().toISOString(),
        bridge: VERSION
      });
      renderStatus(`✓ ส่งหลักฐาน S2 AR แล้ว: ${ar.correct}/${ar.total} • ${ar.score}% • Teacher Dashboard: S2 AR Practice`, 'good');
      window.dispatchEvent(new CustomEvent('aiquest:s2-ar-event-queued', { detail: { event, evidence: ar, bridge: VERSION } }));
      console.log('[AIQuest S2 AR Sync] queued s2_ar_complete event', event.eventId);
      return true;
    } catch (error) {
      console.warn('[AIQuest S2 AR Sync] event send failed', error);
      renderStatus('S2 AR ส่งไม่สำเร็จในขณะนี้ ระบบจะลองใหม่เมื่อเปิดหน้านี้อีกครั้ง', 'warn');
      return false;
    } finally {
      busy = false;
    }
  }

  function tick(){
    const ar = evidence();
    const sig = ar ? signature(ar) : '';
    if (sig !== lastSignature) {
      lastSignature = sig;
      renderReceipt();
    }
    if (ar) sync().then((ok) => { if (ok) renderReceipt(); });
  }

  function boot(){
    tick();
    setInterval(tick, 800);
    window.addEventListener('aiquest:s2-ar-start', () => { lastSignature = ''; });
    window.addEventListener('aiquest:s2-ar-complete', () => { lastSignature = ''; tick(); });
  }

  window.AIQUEST_S2_AR_RESULT_BRIDGE = Object.freeze({
    version: VERSION,
    sync,
    getResult,
    evidence
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true });
  else boot();

  console.log('[AIQuest] ' + VERSION + ' loaded');
})();
