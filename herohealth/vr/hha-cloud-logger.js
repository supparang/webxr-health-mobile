// === /herohealth/vr/hha-cloud-logger.js ===
// HeroHealth Cloud Logger — ส่ง hha:session ไปเก็บบน Google Sheet ผ่าน Apps Script

// ✅ ตรงนี้ให้เปลี่ยนเป็น URL ของ Google Apps Script ที่จะสร้างในขั้นตอนถัดไป
const DEFAULT_ENDPOINT = 'https://script.google.com/macros/s/AKfycbxNor4osZ3NI_pGtYd8hGlwyMRTF9J2I4kCFiHUO-G_4VBj2ZqtTXiqsFU8KWDqRSTQ/exec';

const RETRY_KEY = 'hha_cloud_retry_queue_v1';

function loadQueue() {
  try {
    const raw = localStorage.getItem(RETRY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch (e) {
    return [];
  }
}

function saveQueue(q) {
  try {
    localStorage.setItem(RETRY_KEY, JSON.stringify(q || []));
  } catch (e) {
    // ถ้าเก็บไม่ได้ก็ปล่อยไป
  }
}

function enqueue(payload) {
  const q = loadQueue();
  q.push({ payload, at: Date.now() });
  // จำกัดคิวไม่เกิน 50 รายการ
  while (q.length > 50) q.shift();
  saveQueue(q);
}

async function flushQueue(endpoint, debug) {
  const q = loadQueue();
  if (!q.length) return;
  const remain = [];
  for (const item of q) {
    try {
      /* eslint-disable no-await-in-loop */
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item.payload)
      });
      if (!res.ok) {
        if (debug) console.warn('Cloud logger retry failed status', res.status);
        remain.push(item);
      }
    } catch (e) {
      if (debug) console.warn('Cloud logger retry error', e);
      remain.push(item);
    }
  }
  saveQueue(remain);
}

/**
 * initCloudLogger(options)
 * - endpoint: URL ของ Google Apps Script (ต้องแก้ DEFAULT_ENDPOINT หรือส่งใน options)
 * - projectTag: ชื่อโปรเจกต์/เกม (เช่น 'HeroHealth-GoodJunkVR')
 * - debug: true/false (log ใน console)
 */
export function initCloudLogger(options = {}) {
  if (window.__HHA_CLOUD_LOGGER_INITED) return;
  window.__HHA_CLOUD_LOGGER_INITED = true;

  const endpoint   = options.endpoint   || DEFAULT_ENDPOINT;
  const projectTag = options.projectTag || 'HeroHealth-GoodJunkVR';
  const debug      = !!options.debug;

  if (!endpoint || endpoint.includes('XXXXXXXX')) {
    console.warn('[HHA Cloud] ยังไม่ได้ตั้งค่า endpoint Google Apps Script');
    // ยังไม่มี endpoint ก็แค่ไม่ส่ง แต่ logger จะไม่พังเกม
  }

  // ถ้าออนไลน์ ลอง flush คิวเก่า (กรณีเคยส่งไม่สำเร็จ)
  if (endpoint && navigator.onLine) {
    flushQueue(endpoint, debug);
  }

  // ฟัง event hha:session จาก GameEngine
  window.addEventListener('hha:session', (ev) => {
    const detail = ev && ev.detail ? ev.detail : {};
    const payload = {
      project: projectTag,
      sentAtIso: new Date().toISOString(),
      // เอาทุก field จาก sessionStats ใส่ไปเลย
      ...detail
    };

    if (!endpoint || endpoint.includes('XXXXXXXX')) {
      if (debug) console.log('[HHA Cloud] mock send (no endpoint)', payload);
      return;
    }

    // ยิงขึ้น Apps Script
    fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(res => {
      if (!res.ok) {
        if (debug) console.warn('[HHA Cloud] send failed status', res.status);
        enqueue(payload);
      } else {
        if (debug) console.log('[HHA Cloud] send ok');
      }
    }).catch(err => {
      if (debug) console.warn('[HHA Cloud] send error', err);
      enqueue(payload);
    });
  });

  // ถ้าหลุดเน็ตแล้วกลับมาออนไลน์ ลอง flush ใหม่
  window.addEventListener('online', () => {
    if (!endpoint || endpoint.includes('XXXXXXXX')) return;
    flushQueue(endpoint, debug);
  });

  if (debug) {
    console.log('[HHA Cloud] logger initialized', { endpoint, projectTag });
  }
}

export default { initCloudLogger };
