// === /herohealth/vr/hha-cloud-logger.js ===
// PROD schema logger: sessions + events
// ✅ รองรับ event 2 ชุด:
//    - ใหม่: hha:event (events) + hha:end (sessions)
//    - เดิม: hha:log_event + hha:log_session
// ✅ ส่งแบบ text/plain;charset=utf-8 เพื่อลดโอกาส CORS preflight กับ Google Apps Script
// ✅ กันส่งซ้ำ/คิวบวม + retry แบบนิ่ม ๆ

'use strict';

let CONFIG = {
  endpoint: '',
  debug: false,
  projectTag: '',
  flushDelayMs: 1200,
  maxQueue: 2000,
  keepalive: true
};

let sessionsQueue = [];
let eventsQueue   = [];
let flushTimer = null;
let inFlight = false;
let failCount = 0;

const sessionDraft = new Map(); // sessionId -> draft object (optional)

function safeObj(x){ return (x && typeof x === 'object') ? x : {}; }
function nowIso(){ return new Date().toISOString(); }

export function initCloudLogger(opts = {}) {
  CONFIG.endpoint = String(opts.endpoint || CONFIG.endpoint || '');
  CONFIG.debug = !!opts.debug;
  CONFIG.projectTag = String(opts.projectTag || CONFIG.projectTag || '');
  CONFIG.flushDelayMs = Math.max(300, Math.min(8000, parseInt(opts.flushDelayMs || CONFIG.flushDelayMs, 10) || 1200));
  CONFIG.maxQueue = Math.max(200, Math.min(20000, parseInt(opts.maxQueue || CONFIG.maxQueue, 10) || 2000));
  CONFIG.keepalive = (opts.keepalive === undefined) ? CONFIG.keepalive : !!opts.keepalive;

  if (!window.__HHA_LOGGER_BOUND__) {
    window.__HHA_LOGGER_BOUND__ = true;

    // ---- legacy explicit events ----
    window.addEventListener('hha:log_session', (e) => {
      enqueueSession(safeObj(e.detail));
    });

    window.addEventListener('hha:log_event', (e) => {
      enqueueEvent(safeObj(e.detail));
    });

    // ---- unified events used by Plate/GoodJunk/etc. ----
    window.addEventListener('hha:event', (e) => {
      const row = safeObj(e.detail);
      // ถ้าเกมส่งมาเป็น event กลาง -> ลง events sheet
      enqueueEvent(row);

      // เก็บ draft session จาก session_start (เผื่ออยากเติม sessions sheet ตอนจบ)
      const t = String(row.type || '');
      const sid = String(row.sessionId || '');
      if (t === 'session_start' && sid) {
        // draft ขั้นต่ำ
        sessionDraft.set(sid, {
          projectTag: row.projectTag || CONFIG.projectTag || '',
          sessionId: sid,
          mode: row.mode || '',
          difficulty: row.difficulty || '',
          runMode: row.runMode || '',
          startedAt: row.sessionStartIso || row.timestampIso || nowIso(),
          durationSec: row.durationSec || row.duration || row.gameDuration || ''
        });
      }
    });

    // summary end -> sessions sheet
    window.addEventListener('hha:end', (e) => {
      const row = safeObj(e.detail);
      const sid = String(row.sessionId || '');
      const base = sid && sessionDraft.has(sid) ? sessionDraft.get(sid) : {};
      const merged = Object.assign({}, base, row, {
        projectTag: row.projectTag || base.projectTag || CONFIG.projectTag || '',
        endedAt: row.endedAt || nowIso()
      });

      if (sid) sessionDraft.delete(sid);
      enqueueSession(merged);
    });

    // ถ้าอยากเก็บ pause ก็เป็น event ด้วย (optional)
    window.addEventListener('hha:pause', (e) => enqueueEvent(safeObj(e.detail)));

    // กันข้อมูลค้างนาน: ถ้าปิดแท็บ ให้พยายาม flush แบบ keepalive
    window.addEventListener('pagehide', () => { tryFlushNow(true); });
    window.addEventListener('beforeunload', () => { tryFlushNow(true); });
  }

  if (CONFIG.debug) console.log('[HHA-Logger] init', CONFIG);
}

function capQueues(){
  // กันคิวบวม: ตัดทิ้งหัวเก่า
  if (eventsQueue.length > CONFIG.maxQueue) {
    eventsQueue.splice(0, eventsQueue.length - CONFIG.maxQueue);
  }
  if (sessionsQueue.length > Math.max(200, Math.floor(CONFIG.maxQueue / 10))) {
    sessionsQueue.splice(0, sessionsQueue.length - Math.max(200, Math.floor(CONFIG.maxQueue / 10)));
  }
}

function enqueueSession(row){
  row = safeObj(row);
  if (!row.projectTag) row.projectTag = CONFIG.projectTag || row.projectTag || '';
  if (!row.timestampIso) row.timestampIso = nowIso();
  sessionsQueue.push(row);
  capQueues();
  scheduleFlush();
}

function enqueueEvent(row){
  row = safeObj(row);
  if (!row.projectTag) row.projectTag = CONFIG.projectTag || row.projectTag || '';
  if (!row.timestampIso) row.timestampIso = nowIso();
  eventsQueue.push(row);
  capQueues();
  scheduleFlush();
}

function scheduleFlush(){
  if (!CONFIG.endpoint) return;
  if (flushTimer) return;

  const delay = CONFIG.flushDelayMs + Math.min(4000, failCount * 600);
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flushNow(false);
  }, delay);
}

function tryFlushNow(forceKeepalive){
  // ใช้กับ pagehide/beforeunload
  if (!CONFIG.endpoint) return;
  if (!sessionsQueue.length && !eventsQueue.length) return;

  // ไม่ await เพราะกำลังจะ unload
  flushNow(!!forceKeepalive);
}

async function flushNow(forceKeepalive = false){
  if (inFlight) { scheduleFlush(); return; }
  if (!CONFIG.endpoint) return;
  if (!sessionsQueue.length && !eventsQueue.length) return;

  inFlight = true;

  const payload = {
    projectTag: CONFIG.projectTag || (sessionsQueue[0]?.projectTag) || (eventsQueue[0]?.projectTag) || '',
    timestampIso: nowIso(),
    sessions: sessionsQueue.splice(0),
    events: eventsQueue.splice(0)
  };

  try{
    const res = await fetch(CONFIG.endpoint, {
      method: 'POST',
      // ✅ text/plain ลดโอกาสโดน preflight บน GAS WebApp
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
      // keepalive ช่วยส่งตอนปิดแท็บ (ถ้า browser รองรับ)
      keepalive: forceKeepalive || CONFIG.keepalive
    });

    if (CONFIG.debug) console.log('[HHA-Logger] flush', res.status, payload);

    // ถ้า GAS ตอบไม่ใช่ 2xx ให้ถือว่า fail
    if (!res.ok) throw new Error('HTTP ' + res.status);

    failCount = 0;
  }catch(err){
    // ถ้าส่งไม่สำเร็จ -> คืนกลับคิว (คงลำดับเดิม)
    sessionsQueue = payload.sessions.concat(sessionsQueue);
    eventsQueue   = payload.events.concat(eventsQueue);

    failCount = Math.min(10, failCount + 1);
    if (CONFIG.debug) console.warn('[HHA-Logger] flush error', err);

    // retry อีกทีแบบนิ่ม ๆ
    scheduleFlush();
  }finally{
    inFlight = false;
  }
}
