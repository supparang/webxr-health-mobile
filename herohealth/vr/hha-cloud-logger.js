// === /herohealth/vr/hha-cloud-logger.js ===
// HeroHealth Cloud Logger (VR Pack) – ส่ง Session + Event ไป Google Sheet

'use strict';

let CONFIG = {
  // ★★ เปลี่ยนเป็น WebApp URL ของ Google Apps Script ของคุณ ★★
  endpoint: 'https://script.google.com/macros/s/AKfycbywOHz1nHrybbLwuVCWHW1XyJLoNio2BF5ugchDk0q0qfcgZ2z7ZSIYGQuxguyTDBU/exec',
  projectTag: 'HHA-GoodJunk-ResearchPack-v1.2.0',
  debug: false
};

let sessionQueue = [];
let eventQueue   = [];
let flushTimer   = null;
const FLUSH_DELAY = 2000; // ms

function logSession(s) {
  if (!s) return;
  sessionQueue.push(s);
  scheduleFlush();
}

function logEvent(e) {
  if (!e) return;
  eventQueue.push(e);
  scheduleFlush();
}

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(flushNow, FLUSH_DELAY);
}

async function flushNow() {
  flushTimer = null;

  if (!CONFIG.endpoint) {
    console.warn('[HHA CloudLogger] ไม่มี endpoint – ไม่ส่งอะไร');
    return;
  }
  if (sessionQueue.length === 0 && eventQueue.length === 0) return;

  const payload = {
    projectTag: CONFIG.projectTag,
    sessions:   sessionQueue,
    events:     eventQueue
  };

  // เก็บสำรองไว้ก่อน เผื่อส่งไม่สำเร็จค่อยเอากลับเข้า queue
  const toSendSessions = sessionQueue;
  const toSendEvents   = eventQueue;
  sessionQueue = [];
  eventQueue   = [];

  try {
    const res = await fetch(CONFIG.endpoint, {
      method: 'POST',
      mode: 'cors',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const txt = await res.text().catch(()=> '');
      console.warn('[HHA CloudLogger] ส่งไม่สำเร็จ', res.status, txt);
      sessionQueue = toSendSessions.concat(sessionQueue);
      eventQueue   = toSendEvents.concat(eventQueue);
      return;
    }

    if (CONFIG.debug) {
      console.log('[HHA CloudLogger] ส่งขึ้น Google Sheet แล้ว', payload);
    }
  } catch (err) {
    console.error('[HHA CloudLogger] fetch error', err);
    sessionQueue = toSendSessions.concat(sessionQueue);
    eventQueue   = toSendEvents.concat(eventQueue);
  }
}

// --- ดัก event จากเกม (GoodJunk VR + โหมดอื่น ๆ ที่ใช้ hha:* ร่วมกัน) ---

// Session summary เต็ม ๆ (ฝั่ง Engine ควรยิงตอนจบเกม)
window.addEventListener('hha:session', (e)=>{
  logSession(e.detail || {});
});

// Event ระดับช็อต (hit / miss / timeout ฯลฯ) ถ้ามีส่งมา
window.addEventListener('hha:event', (e)=>{
  logEvent(e.detail || {});
});

// กันพลาด: ถ้า engine ยิงแค่ hha:end อย่างเดียว
window.addEventListener('hha:end', (e)=>{
  const d = e.detail || {};
  if (d && Object.keys(d).length && !d.sessionId) {
    logSession(d);
  }
  scheduleFlush();
});

// ปิดแท็บ/รีเฟรช → พยายาม flush รอบสุดท้าย
window.addEventListener('beforeunload', ()=>{
  flushNow();
});

// ให้เรียกจาก console ได้ ถ้าต้องการ
window.HHACloudLogger = {
  flush: flushNow,
  config: CONFIG
};
