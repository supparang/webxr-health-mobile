/* =========================================================
   CSAI2102 AI Quest — S1 AR Result Bridge + Auto Event Sync v4.0.7
   File: /ai-quest/js/aiquest-s1-ar-result-bridge-v369.js

   Keeps the legacy AR runtime path working while using the same singleton,
   receipt key, and stable delivery ID as the current S1 bridge.
========================================================= */
(() => {
  'use strict';

  const VERSION = 'v4.0.7-s1-ar-legacy-route-dedup-sync';
  const SINGLETON_KEY = '__AIQUEST_S1_AR_BRIDGE_SINGLETON__';
  const existing = window[SINGLETON_KEY];

  if (existing?.active) {
    console.log('[AIQuest S1 AR Sync] duplicate legacy bridge skipped');
    return;
  }

  const runtime = { active: true, timer: null };
  window[SINGLETON_KEY] = runtime;

  const RESULT_KEYS = [
    'AIQUEST_S1_AR_RESULT_V368',
    'AIQUEST_S1_AR_RESULT_V366',
    'AIQUEST_S1_AR_RESULT_V365B',
    'AIQUEST_S1_AR_PRACTICE_RESULT_V365'
  ];
  const RECEIPT_KEY = 'AIQUEST_S1_AR_EVENT_SYNC_V406';
  const LEGACY_RECEIPT_KEY = 'AIQUEST_S1_AR_EVENT_SYNC_V373';
  const FALLBACK_ENDPOINT = 'https://script.google.com/macros/s/AKfycbwXSUHbhVbZtKcjNIDzs4TawAohdeInm1MxLpomVeST2JilOL3L0LWQtT4_Yb7fbJG9/exec';

  let busy = false;
  let lastVisualSignature = '';

  function asObject(value) {
    if (!value) return {};
    if (typeof value === 'object') return value;
    try { return JSON.parse(value); }
    catch (_) { return {}; }
  }

  function readJson(key) {
    try { return JSON.parse(localStorage.getItem(key) || 'null'); }
    catch (_) { return null; }
  }

  function writeJson(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value || {})); }
    catch (_) {}
  }

  function getArResult() {
    const direct = window.AIQUEST_S1_AR_RESULT || window.AIQUEST_S1_AR_PRACTICE?.getResult?.();
    if (direct?.arCompleted && (direct.sessionId === 's1' || direct.missionId === 'm1')) return direct;

    for (const key of RESULT_KEYS) {
      const item = readJson(key);
      if (item?.arCompleted && (item.sessionId === 's1' || item.missionId === 'm1')) return item;
    }
    return null;
  }

  function sessionKey(value) {
    const raw = String(value || '').toLowerCase().replace(/[\s_\-:]+/g, '');
    if (['s1', 'm1', 'session1', 'mission1', 'aiawakening'].includes(raw)) return 's1';
    return raw;
  }

  function isS1(attempt) {
    const src = attempt || {};
    return sessionKey(src.sessionId) === 's1' ||
      sessionKey(src.missionId) === 's1' ||
      sessionKey(src.missionId) === 'm1';
  }

  function evidence() {
    const ar = getArResult();
    if (!ar?.arCompleted) return null;

    const total = Number(ar.total || ar.arTotal || 0);
    const correct = Number(ar.correct || ar.arCorrect || 0);
    const score = Math.round(Number(ar.arScore ?? ar.score ?? ar.accuracy ?? (total ? correct * 100 / total : 0)));

    return {
      activity: 'S1 AR Practice: AI Object Scanner',
      supplementary: true,
      completed: true,
      score,
      accuracy: score,
      correct,
      total,
      helpUsed: Number(ar.helpUsed || ar.arHelpUsed || 0),
      usedSec: Number(ar.usedSec || ar.arUsedSec || 0),
      inputMode: String(ar.inputMode || ar.arInputMode || 'hand_or_mouse_touch'),
      arVersion: String(ar.version || ar.arVersion || ''),
      completedAt: String(ar.finishedAt || ar.completedAt || new Date().toISOString())
    };
  }

  function getProfile() {
    const direct = window.AIQuestStorage?.getProfile?.() || {};
    if (direct.studentId) return direct;

    try {
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i) || '';
        if (!/aiquest|profile|classroom/i.test(key)) continue;
        const candidate = readJson(key);
        if (candidate?.studentId) return candidate;
      }
    } catch (_) {}
    return {};
  }

  function signature(ar) {
    return [
      ar?.completedAt || '',
      ar?.score || 0,
      ar?.correct || 0,
      ar?.total || 0,
      ar?.helpUsed || 0,
      ar?.usedSec || 0,
      ar?.inputMode || ''
    ].join('|');
  }

  function hash(value) {
    let output = 2166136261;
    const text = String(value || '');
    for (let i = 0; i < text.length; i += 1) {
      output ^= text.charCodeAt(i);
      output = Math.imul(output, 16777619);
    }
    return (output >>> 0).toString(36);
  }

  function deliveryKey(ar, profile) {
    return [
      's1_ar_complete',
      String(profile?.studentId || ''),
      String(profile?.section || '101'),
      signature(ar)
    ].join('|');
  }

  function endpoint() {
    const config = window.AIQuestDataContract?.loadConfig?.() || {};
    return config.appsScriptUrl || FALLBACK_ENDPOINT;
  }

  function eventPayload(ar, profile) {
    const key = deliveryKey(ar, profile);
    const token = hash(key);
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
      completedAt: ar.completedAt,
      deliveryKey: key
    };

    const rawEvent = {
      eventId: `s1ar_${token}`,
      attemptId: `s1_ar_practice_${String(profile.studentId || 'anon')}_${token}`,
      studentId: String(profile.studentId || ''),
      studentName: String(profile.studentName || profile.name || ''),
      section: String(profile.section || '101'),
      sessionId: 's1',
      missionId: 'm1',
      runMode: 'practice',
      eventType: 's1_ar_complete',
      phase: 'S1 AR Practice',
      itemId: 'ai_object_scanner',
      prompt: 'S1 AR Practice: AI Object Scanner',
      yourAnswer: JSON.stringify(trace),
      correctAnswer: 'completed',
      isCorrect: true,
      scoreDelta: Number(ar.score || 0),
      combo: Number(ar.correct || 0),
      helpLeft: Math.max(0, 3 - Number(ar.helpUsed || 0)),
      clientTs: ar.completedAt,
      extraJson: { eventKind: 's1_ar_practice', deliveryKey: key, s1ArPractice: trace }
    };

    return window.AIQuestDataContract?.buildEvent
      ? window.AIQuestDataContract.buildEvent(rawEvent, {
          attemptId: rawEvent.attemptId,
          studentId: rawEvent.studentId,
          sessionId: 's1',
          missionId: 'm1'
        })
      : rawEvent;
  }

  function recoverLegacyReceipt(sig) {
    const legacy = readJson(LEGACY_RECEIPT_KEY) || {};
    if (legacy.signature === sig && legacy.status === 'queued') {
      writeJson(RECEIPT_KEY, { ...legacy, bridge: VERSION, recoveredFrom: LEGACY_RECEIPT_KEY });
      return true;
    }
    return false;
  }

  // Retained for normal S1 submissions; AR is still supplementary only.
  function decorate(attempt) {
    if (!attempt || typeof attempt !== 'object' || !isS1(attempt)) return attempt;
    const ar = evidence();
    if (!ar) return attempt;

    const extra = asObject(attempt.extraJson);
    if (extra.s1ArPractice?.completedAt === ar.completedAt) return attempt;

    return {
      ...attempt,
      arCompleted: true,
      arActivity: ar.activity,
      arSupplementary: true,
      arScore: ar.score,
      arAccuracy: ar.accuracy,
      arCorrect: ar.correct,
      arTotal: ar.total,
      arHelpUsed: ar.helpUsed,
      arUsedSec: ar.usedSec,
      arInputMode: ar.inputMode,
      extraJson: { ...extra, s1ArPractice: ar }
    };
  }

  function wrap(owner, method, label) {
    if (!owner || typeof owner[method] !== 'function') return;
    const original = owner[method];
    if (original.__s1ArBridgeV407) return;

    function wrapped(attempt, ...rest) {
      return original.call(this, decorate(attempt), ...rest);
    }
    wrapped.__s1ArBridgeV407 = true;
    owner[method] = wrapped;
    console.log('[AIQuest S1 AR Bridge] wrapped', label);
  }

  function installAttemptBridge() {
    wrap(window.AIQuestSync, 'submitAttempt', 'AIQuestSync.submitAttempt');
    wrap(window.AIQuestCloudLogger, 'sendAttempt', 'AIQuestCloudLogger.sendAttempt');
    ['saveAttempt', 'addAttempt', 'storeAttempt'].forEach((method) => {
      wrap(window.AIQuestStorage, method, `AIQuestStorage.${method}`);
    });
  }

  function statusHost() {
    return document.getElementById('aiquestS1ArEntryV387') ||
      document.getElementById('s1entry368') ||
      document.getElementById('s1arentry368') ||
      document.getElementById('s1arentry366');
  }

  function renderStatus(message, tone) {
    const host = statusHost();
    if (!host) return;

    let box = document.getElementById('s1ArBridgeStatusV369');
    if (!box) {
      box = document.createElement('div');
      box.id = 's1ArBridgeStatusV369';
      box.style.cssText = 'clear:both;margin-top:12px;padding:10px 12px;border-radius:14px;font-size:12px;line-height:1.45;font-weight:800';
      host.appendChild(box);
    }

    const good = tone === 'good';
    box.style.background = good ? 'rgba(16,185,129,.13)' : 'rgba(34,211,238,.12)';
    box.style.border = `1px solid ${good ? 'rgba(16,185,129,.30)' : 'rgba(34,211,238,.28)'}`;
    box.style.color = good ? '#bbf7d0' : '#cffafe';
    box.innerHTML = message;
  }

  function renderReceipt() {
    const ar = evidence();
    if (!ar) return;
    const receipt = readJson(RECEIPT_KEY) || {};
    const ok = receipt.signature === signature(ar) && receipt.status === 'queued';

    renderStatus(
      ok
        ? `<strong>✓ ส่ง AR Practice แล้ว: ${ar.correct}/${ar.total} • ${ar.score}%</strong><br>Teacher Dashboard จะแสดงเป็นกิจกรรมเสริมหลัง Refresh`
        : `<strong>AR Practice ล่าสุด: ${ar.correct}/${ar.total} • ${ar.score}%</strong><br>กำลังเตรียมส่งหลักฐานกิจกรรมเสริมไปยัง Teacher Dashboard`,
      ok ? 'good' : 'warn'
    );
  }

  async function autoSyncArEvent() {
    const ar = evidence();
    if (!ar || busy || !runtime.active) return false;

    const sig = signature(ar);
    const receipt = readJson(RECEIPT_KEY) || {};
    if (receipt.signature === sig && (receipt.status === 'sending' || receipt.status === 'queued')) return true;
    if (recoverLegacyReceipt(sig)) return true;

    const profile = getProfile();
    if (!profile.studentId) {
      console.warn('[AIQuest S1 AR Sync] profile missing; AR evidence remains local');
      return false;
    }

    const url = endpoint();
    if (!url) {
      console.warn('[AIQuest S1 AR Sync] Apps Script endpoint missing');
      return false;
    }

    const event = eventPayload(ar, profile);
    busy = true;
    writeJson(RECEIPT_KEY, {
      signature: sig,
      status: 'sending',
      eventId: event.eventId,
      studentId: String(profile.studentId),
      queuedAt: new Date().toISOString(),
      bridge: VERSION
    });
    renderStatus('<strong>กำลังส่งหลักฐาน S1 AR…</strong>', 'warn');

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
      renderReceipt();
      window.dispatchEvent(new CustomEvent('aiquest:s1-ar-event-queued', { detail: { event, evidence: ar, bridge: VERSION } }));
      console.log('[AIQuest S1 AR Sync] queued one deduplicated s1_ar_complete event', event.eventId);
      return true;
    } catch (error) {
      console.warn('[AIQuest S1 AR Sync] event send failed', error);
      writeJson(RECEIPT_KEY, {
        signature: sig,
        status: 'failed',
        eventId: event.eventId,
        studentId: String(profile.studentId),
        failedAt: new Date().toISOString(),
        bridge: VERSION
      });
      renderStatus('<strong>S1 AR ส่งไม่สำเร็จในขณะนี้</strong><br>ระบบจะลองใหม่เมื่อเปิดหน้านี้อีกครั้ง', 'warn');
      return false;
    } finally {
      busy = false;
    }
  }

  function tick() {
    if (!runtime.active) return;
    installAttemptBridge();

    const ar = evidence();
    const sig = ar ? signature(ar) : '';
    if (sig !== lastVisualSignature) {
      lastVisualSignature = sig;
      renderReceipt();
    }

    if (ar) autoSyncArEvent().then((ok) => { if (ok) renderReceipt(); });
  }

  function boot() {
    tick();
    runtime.timer = setInterval(tick, 900);
    window.addEventListener('aiquest:s1-ar-start', () => { lastVisualSignature = ''; });
    window.addEventListener('aiquest:s1-ar-complete', () => { lastVisualSignature = ''; tick(); });
  }

  window.AIQUEST_S1_AR_RESULT_BRIDGE = Object.freeze({
    version: VERSION,
    getArResult,
    getEvidence: evidence,
    decorateAttempt: decorate,
    syncNow: autoSyncArEvent,
    getSyncState: () => readJson(RECEIPT_KEY) || {},
    deliveryKey: (ar = evidence(), profile = getProfile()) => ar ? deliveryKey(ar, profile) : ''
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true });
  else boot();

  console.log('[AIQuest] ' + VERSION + ' loaded', window.AIQUEST_S1_AR_RESULT_BRIDGE);
})();
