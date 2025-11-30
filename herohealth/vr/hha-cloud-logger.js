// === /herohealth/vr/hha-cloud-logger.js ===
// Cloud Logger for HeroHealth (Session + Event level)
'use strict';

/**
 * initCloudLogger(options)
 *  - endpoint   : URL ของ Google Apps Script (/exec)
 *  - projectTag : ชื่อโปรเจ็กต์ เช่น 'HeroHealth-GoodJunkVR'
 *  - debug      : true = console.log เพิ่ม
 */
export function initCloudLogger(options = {}) {
  const endpoint   = String(options.endpoint || '').trim();
  const projectTag = String(options.projectTag || 'HeroHealth').trim();
  const debug      = !!options.debug;

  if (!endpoint) {
    console.warn('[HHA-CloudLogger] endpoint not set, logger disabled');
    return;
  }
  if (!window || !window.addEventListener) {
    console.warn('[HHA-CloudLogger] window not available');
    return;
  }
  if (window.__HHA_CLOUD_LOGGER_INIT__) {
    // ป้องกัน init ซ้ำ
    return;
  }
  window.__HHA_CLOUD_LOGGER_INIT__ = true;

  if (debug) {
    console.log('[HHA-CloudLogger] init', { endpoint, projectTag });
  }

  // ========= Helper: ส่ง payload ไป Apps Script =========
  async function sendPayload(payload) {
    const body = JSON.stringify(payload || {});
    if (debug) console.log('[HHA-CloudLogger] sending', payload);

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        mode: 'cors',
        headers: { 'Content-Type': 'application/json' },
        body
      });
      if (debug) console.log('[HHA-CloudLogger] response status', res.status);
    } catch (err) {
      console.error('[HHA-CloudLogger] send error', err);
    }
  }

  function toIntSafe(v) {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(v);
    if (!Number.isFinite(n)) return null;
    return Math.round(n);
  }

  function detectDeviceType() {
    try {
      const ua = navigator.userAgent || '';
      if (navigator.xr || /Oculus|Quest|Vive|Mixed Reality|VR/i.test(ua)) return 'vr';
      if (/Android|iPhone|iPad|iPod/i.test(ua)) return 'mobile';
      return 'pc';
    } catch (_) {
      return 'unknown';
    }
  }

  // ========= Normalizer: SESSION =========
  function normalizeSession(detail = {}) {
    const d = detail || {};
    const now = new Date();

    return {
      recordType : 'session',   // <-- ใช้แยกบน Apps Script
      project    : projectTag,

      sessionId  : d.sessionId || window.hhaSessionId || '',
      playerTag  : d.playerTag || window.hhaPlayerTag || '',
      mode       : d.mode      || 'Good vs Junk (VR)',
      difficulty : d.difficulty || d.diff || 'normal',
      deviceType : d.deviceType || detectDeviceType(),
      userAgent  : d.userAgent || navigator.userAgent || '',

      startedAtIso : d.startedAtIso || '',
      endedAtIso   : d.endedAtIso   || now.toISOString(),
      durationSec  : Number.isFinite(d.durationSec) ? d.durationSec : null,

      // core performance
      scoreFinal : toIntSafe(d.scoreFinal ?? d.score),
      comboMax   : toIntSafe(d.comboMax),
      misses     : toIntSafe(d.misses),

      // optional stats ถ้ามี
      goodHits      : toIntSafe(d.goodHits),
      junkHits      : toIntSafe(d.junkHits),
      feverCount    : toIntSafe(d.feverCount),
      questsCleared : toIntSafe(d.questsCleared),
      questsTotal   : toIntSafe(d.questsTotal),
      goalsCleared  : toIntSafe(d.goalsCleared),
      goalsTotal    : toIntSafe(d.goalsTotal),

      condition   : d.condition   || '',  // เช่น pre / post / follow-up
      groupLabel  : d.groupLabel  || '',  // เช่น experimental / control
      classCode   : d.classCode   || '',  // ห้อง/โรงเรียน
      gameVersion : d.gameVersion || '',

      reason     : d.reason || '',
      createdIso : now.toISOString()
    };
  }

  // ========= Normalizer: EVENT =========
  function normalizeEvent(detail = {}) {
    const d = detail || {};
    const now = new Date();

    // timestamp ภายในเกม (ถ้ามี) เช่น msFromStart
    const tGameMs = Number.isFinite(d.tGameMs) ? Math.round(d.tGameMs) : null;

    return {
      recordType : 'event',
      project    : projectTag,

      sessionId  : d.sessionId || window.hhaSessionId || '',
      playerTag  : d.playerTag || window.hhaPlayerTag || '',
      mode       : d.mode      || 'Good vs Junk (VR)',
      difficulty : d.difficulty || d.diff || 'normal',
      deviceType : d.deviceType || detectDeviceType(),

      // time
      createdIso : now.toISOString(),
      tGameMs    : tGameMs,
      tGameSec   : tGameMs != null ? +(tGameMs / 1000).toFixed(3) : null,

      // event identity
      eventType  : d.eventType || d.type || '',   // 'hit', 'miss', 'power', 'spawn', 'questStart', ...
      eventId    : toIntSafe(d.eventId),          // running index (optional)
      trialIndex : toIntSafe(d.trialIndex),       // trial ภายใน session (optional)

      // target info
      emoji      : d.emoji || '',
      category   : d.category || '',  // 'good', 'junk', 'powerup'
      isCorrect  : (typeof d.isCorrect === 'boolean') ? d.isCorrect : null,
      isHit      : (typeof d.isHit === 'boolean') ? d.isHit : null,

      // performance metrics
      rtMs       : toIntSafe(d.rtMs),            // reaction time
      scoreBefore: toIntSafe(d.scoreBefore),
      scoreDelta : toIntSafe(d.scoreDelta),
      scoreAfter : toIntSafe(d.scoreAfter),
      comboBefore: toIntSafe(d.comboBefore),
      comboAfter : toIntSafe(d.comboAfter),
      feverActive: (typeof d.feverActive === 'boolean') ? d.feverActive : null,

      // spatial / zone (optional)
      lane       : d.lane || '',
      zoneX      : d.zoneX != null ? d.zoneX : null, // เช่น แบ่งจอซ้าย-ขวา
      zoneY      : d.zoneY != null ? d.zoneY : null,

      // quest / goal context (optional)
      questId    : d.questId || '',
      questType  : d.questType || '',
      questStep  : toIntSafe(d.questStep),
      questDone  : (typeof d.questDone === 'boolean') ? d.questDone : null
    };
  }

  // ========= Listener: Session summary =========
  window.addEventListener('hha:session', (ev) => {
    const payload = normalizeSession((ev && ev.detail) || {});
    sendPayload(payload);
  });

  // ========= Listener: Event level =========
  window.addEventListener('hha:event', (ev) => {
    const payload = normalizeEvent((ev && ev.detail) || {});
    sendPayload(payload);
  });

  if (debug) {
    console.log('[HHA-CloudLogger] ready, listening for hha:session + hha:event');
  }

  // ========= Optional global helper สำหรับฝั่งเกมเรียกตรง ๆ =========
  window.hhaLogSession = function(detail){
    const payload = normalizeSession(detail || {});
    sendPayload(payload);
  };
  window.hhaLogEvent = function(detail){
    const payload = normalizeEvent(detail || {});
    sendPayload(payload);
  };
}

export default { initCloudLogger };
