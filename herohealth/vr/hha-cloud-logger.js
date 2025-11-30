// === /HeroHealth/vr/hha-cloud-logger.js ===
'use strict';

/**
 * initCloudLogger({
 *   endpoint: 'https://script.google.com/macros/s/XXX/exec',
 *   projectTag: 'HeroHealth-GoodJunkVR',
 *   debug: true
 * })
 */

export function initCloudLogger(cfg = {}) {
  const endpoint   = cfg.endpoint || '';
  const projectTag = cfg.projectTag || 'HeroHealth-GoodJunkVR';
  const debug      = !!cfg.debug;

  if (!endpoint) {
    console.warn('[HHA Logger] No endpoint configured, logging disabled.');
    return;
  }

  const ua = navigator.userAgent || '';
  const deviceType =
    /Quest|Oculus|VR/i.test(ua) ? 'VR-Headset' :
    /Mobile|Android|iPhone|iPad/i.test(ua) ? 'Mobile' :
    'Desktop';

  function logDebug(...args) {
    if (debug) console.log('[HHA Logger]', ...args);
  }

  async function sendPayload(data) {
    try {
      const body = JSON.stringify(data);
      logDebug('POST', data.recordType, data);
      const res = await fetch(endpoint, {
        method: 'POST',
        mode: 'no-cors', // เพื่อกัน CORS error ฝั่ง browser
        headers: { 'Content-Type': 'application/json' },
        body
      });
      // no-cors → อ่าน status ไม่ได้ ก็ไม่เป็นไร
    } catch (err) {
      console.error('[HHA Logger] Error sending data:', err);
    }
  }

  // --- ช่วยสร้าง base payload ---
  function basePayload() {
    return {
      project   : projectTag,
      deviceType,
      tzOffsetMin: new Date().getTimezoneOffset()
    };
  }

  // === 1) รับระดับ Session ผ่าน event: hha:session ===
  window.addEventListener('hha:session', (e) => {
    const d = (e && e.detail) || {};
    const payload = {
      ...basePayload(),
      ...d,
      recordType: 'session'
    };
    sendPayload(payload);
  });

  // === 2) แปลง hha:score → Event log ===
  let trialIndex = 0;
  let t0 = performance.now();

  window.addEventListener('hha:score', (e) => {
    const d = (e && e.detail) || {};
    trialIndex += 1;

    const score =
      typeof d.score === 'number' ? d.score :
      typeof d.total === 'number' ? d.total :
      (window.score | 0) || 0;

    const combo =
      typeof d.combo === 'number' ? d.combo :
      typeof window.combo === 'number' ? window.combo : 0;

    const comboMax =
      typeof d.comboMax === 'number' ? d.comboMax :
      typeof window.comboMax === 'number' ? window.comboMax : 0;

    const misses =
      typeof window.misses === 'number' ? window.misses : 0;

    const payload = {
      ...basePayload(),
      recordType : 'event',
      eventType  : 'score',
      trialIndex,
      tGameMs    : performance.now() - t0,
      score,
      combo,
      comboMax,
      misses,
      emoji      : d.emoji || '',
      category   : d.category || '',
      isCorrect  : d.good === true || d.isCorrect === true,
      feverActive: !!(window.FEVER_ACTIVE)
    };

    sendPayload(payload);
  });

  // === 3) แปลง hha:miss → Event log ===
  window.addEventListener('hha:miss', () => {
    trialIndex += 1;
    const payload = {
      ...basePayload(),
      recordType : 'event',
      eventType  : 'miss',
      trialIndex,
      tGameMs    : performance.now() - t0,
      score      : (window.score | 0)  || 0,
      combo      : (window.combo | 0)  || 0,
      comboMax   : (window.comboMax|0) || 0,
      misses     : (window.misses |0)  || 0,
      emoji      : '',
      category   : 'miss',
      isCorrect  : false,
      feverActive: !!(window.FEVER_ACTIVE)
    };
    sendPayload(payload);
  });

  // ให้ฟังก์ชัน global เผื่อเรียกตรง ๆ
  window.hhaLogSession = function(detail) {
    const payload = { ...basePayload(), ...detail, recordType: 'session' };
    sendPayload(payload);
  };

  window.hhaLogEvent = function(detail) {
    const payload = { ...basePayload(), ...detail, recordType: 'event' };
    sendPayload(payload);
  };

  logDebug('Logger initialized:', { endpoint, projectTag, deviceType });
}
