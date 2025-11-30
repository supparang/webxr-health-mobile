// === /herohealth/vr/hha-cloud-logger.js (Cloud Logger for Hero Health VR) ===
'use strict';

/**
 * initCloudLogger(options)
 *  - endpoint   : URL ของ Google Apps Script (web app /exec)
 *  - projectTag : ชื่อโปรเจกต์ เช่น 'HeroHealth-GoodJunkVR'
 *  - debug      : true = log ใน console ด้วย
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

  if (debug) {
    console.log('[HHA-CloudLogger] init', { endpoint, projectTag });
  }

  // ป้องกันถูก init ซ้ำ
  if (window.__HHA_CLOUD_LOGGER_INIT__) return;
  window.__HHA_CLOUD_LOGGER_INIT__ = true;

  /**
   * ส่ง payload ไป Apps Script
   */
  async function sendPayload(payload) {
    const body = JSON.stringify(payload || {});
    if (debug) {
      console.log('[HHA-CloudLogger] sending', payload);
    }
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        mode: 'cors',
        headers: {
          'Content-Type': 'application/json'
        },
        body
      });
      if (debug) {
        console.log('[HHA-CloudLogger] response status', res.status);
      }
    } catch (err) {
      console.error('[HHA-CloudLogger] send error', err);
    }
  }

  /**
   * แปลง event.detail → payload
   */
  function normalizeSession(detail = {}) {
    const d = detail || {};
    const now = new Date();

    return {
      project    : projectTag,
      // ถ้า sessionId ฝั่งเกมสร้างมาแล้ว ให้ใช้ต่อเลย
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
      scoreFinal : toIntSafe(d.scoreFinal ?? d.scoreFinal ?? d.score),
      comboMax   : toIntSafe(d.comboMax),
      misses     : toIntSafe(d.misses),

      // optional stats (ถ้า Engine ส่งมาก็เก็บ)
      goodHits      : toIntSafe(d.goodHits),
      junkHits      : toIntSafe(d.junkHits),
      feverCount    : toIntSafe(d.feverCount),
      questsCleared : toIntSafe(d.questsCleared),
      questsTotal   : toIntSafe(d.questsTotal),
      goalsCleared  : toIntSafe(d.goalsCleared),
      goalsTotal    : toIntSafe(d.goalsTotal),

      reason     : d.reason || '',
      createdIso : now.toISOString()
    };
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
    } catch(_) {
      return 'unknown';
    }
  }

  // ===== Listen: hha:session =====
  window.addEventListener('hha:session', (ev) => {
    const detail = (ev && ev.detail) || {};
    const payload = normalizeSession(detail);
    sendPayload(payload);
  });

  if (debug) {
    console.log('[HHA-CloudLogger] ready, listening for hha:session');
  }
}

export default { initCloudLogger };
