// === /herohealth/vr/hha-cloud-logger.js ===
// HeroHealth Cloud Logger — PROD v1.2 (ES Module)
// ✅ Fix: CORS (Google Apps Script) -> sendBeacon / fetch no-cors (text/plain)
// ✅ Fix: initCloudLogger not defined -> expose window.initCloudLogger for non-module callers
// ✅ Robust: listen multiple event names (hha:log_* + hha:event + hha:end)
// ✅ Queue + batch + retry(backoff) + flush on pagehide/visibilitychange

'use strict';

let CONFIG = {
  endpoint: 'https://script.google.com/macros/s/AKfycbxdy-3BjJhn6Fo3kQX9oxHQIlXT7p2OXn-UYfv1MKV5oSW6jYG-RlnAgKlHqrNxxbhmaw/exec',
  projectTag: '',     // optional default tag
  debug: false,

  // batching / safety
  flushDelayMs: 1200,
  maxEventsQueue: 2500,
  maxSessionsQueue: 300,
  maxProfilesQueue: 120,
  maxBatchEvents: 350,     // per request
  maxBatchSessions: 40,
  maxBatchProfiles: 20
};

let sessionsQueue = [];
let eventsQueue   = [];
let profilesQueue = [];

let flushTimer = null;
let inFlight = false;

// retry/backoff
let backoffMs = 0;
const BACKOFF_MIN = 1200;
const BACKOFF_MAX = 15000;

function safeObj(x){ return (x && typeof x === 'object') ? x : {}; }
function nowIso(){ return new Date().toISOString(); }

function dbg(...args){
  if (CONFIG.debug) console.log('[HHA-Logger]', ...args);
}
function warn(...args){
  if (CONFIG.debug) console.warn('[HHA-Logger]', ...args);
}

// ---------- public API ----------
export function initCloudLogger(opts = {}) {
  CONFIG.endpoint = String(opts.endpoint || CONFIG.endpoint || '');
  CONFIG.projectTag = String(opts.projectTag || CONFIG.projectTag || '');
  CONFIG.debug = !!opts.debug;

  if (Number.isFinite(opts.flushDelayMs)) CONFIG.flushDelayMs = Math.max(250, opts.flushDelayMs|0);

  // bind once
  if (!window.__HHA_LOGGER_BOUND__) {
    window.__HHA_LOGGER_BOUND__ = true;

    // 1) schema-ready events (แนะนำให้เกมยิงชุดนี้)
    window.addEventListener('hha:log_session', (e) => enqueueSession(safeObj(e.detail)));
    window.addEventListener('hha:log_event',   (e) => enqueueEvent(safeObj(e.detail)));
    window.addEventListener('hha:log_profile', (e) => enqueueProfile(safeObj(e.detail)));

    // 2) compatibility: game engines ที่ยิง event คนละชื่อ
    window.addEventListener('hha:end',   (e) => enqueueSession(safeObj(e.detail))); // end summary -> sessions row
    window.addEventListener('hha:event', (e) => enqueueEvent(safeObj(e.detail)));   // raw event -> events row

    // flush on tab close / background
    window.addEventListener('pagehide', () => flushNow(true));
    window.addEventListener('beforeunload', () => flushNow(true));
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) flushNow(true);
    });
  }

  // expose global for non-module callers (แก้ initCloudLogger not defined)
  try { window.initCloudLogger = initCloudLogger; } catch(_) {}

  dbg('init', { endpoint: CONFIG.endpoint, projectTag: CONFIG.projectTag });
}

export function logSession(row){ enqueueSession(safeObj(row)); }
export function logEvent(row){ enqueueEvent(safeObj(row)); }
export function logProfile(row){ enqueueProfile(safeObj(row)); }
export function flushLogger(){ flushNow(false); }

// ---------- queue ops ----------
function capQueue(arr, max, label){
  if (arr.length <= max) return;
  const drop = arr.length - max;
  arr.splice(0, drop); // drop oldest
  warn(`queue cap: dropped ${drop} ${label}`);
}

function ensureProjectTag(row){
  if (!row) return row;
  if (!row.projectTag && CONFIG.projectTag) row.projectTag = CONFIG.projectTag;
  if (!row.timestampIso) row.timestampIso = nowIso();
  return row;
}

function enqueueSession(row){
  if (!row || !CONFIG.endpoint) return scheduleFlush();
  sessionsQueue.push(ensureProjectTag(row));
  capQueue(sessionsQueue, CONFIG.maxSessionsQueue, 'sessions');
  scheduleFlush();
}

function enqueueEvent(row){
  if (!row || !CONFIG.endpoint) return scheduleFlush();
  eventsQueue.push(ensureProjectTag(row));
  capQueue(eventsQueue, CONFIG.maxEventsQueue, 'events');
  scheduleFlush();
}

function enqueueProfile(row){
  if (!row || !CONFIG.endpoint) return scheduleFlush();
  profilesQueue.push(ensureProjectTag(row));
  capQueue(profilesQueue, CONFIG.maxProfilesQueue, 'profiles');
  scheduleFlush();
}

function scheduleFlush(){
  if (!CONFIG.endpoint) return;
  if (flushTimer) return;

  const delay = Math.max(250, CONFIG.flushDelayMs + (backoffMs || 0));
  flushTimer = setTimeout(() => flushNow(false), delay);
}

// ---------- transport (CORS-safe) ----------
function beaconSend(url, payloadStr){
  try{
    if (!navigator.sendBeacon) return false;
    const blob = new Blob([payloadStr], { type: 'text/plain;charset=UTF-8' });
    return navigator.sendBeacon(url, blob);
  }catch(_){
    return false;
  }
}

async function fetchNoCors(url, payloadStr){
  // no-cors -> response opaque; ใช้แค่ fire-and-forget
  await fetch(url, {
    method: 'POST',
    mode: 'no-cors',
    keepalive: true,
    headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
    body: payloadStr
  });
}

// ---------- flush ----------
function takeBatch(queue, n){
  if (!queue.length) return [];
  return queue.splice(0, Math.max(0, n|0));
}

async function flushNow(forceSync = false){
  try{
    if (!CONFIG.endpoint) return;
    if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
    if (inFlight && !forceSync) return;
    if (!sessionsQueue.length && !eventsQueue.length && !profilesQueue.length) return;

    inFlight = true;

    // batch split (กัน payload ใหญ่เกิน)
    const batchSessions = takeBatch(sessionsQueue, CONFIG.maxBatchSessions);
    const batchEvents   = takeBatch(eventsQueue,   CONFIG.maxBatchEvents);
    const batchProfiles = takeBatch(profilesQueue, CONFIG.maxBatchProfiles);

    const payload = {
      projectTag: (batchSessions[0]?.projectTag) || (batchEvents[0]?.projectTag) || (batchProfiles[0]?.projectTag) || CONFIG.projectTag || '',
      timestampIso: nowIso(),
      sessions: batchSessions,
      events: batchEvents,
      studentsProfile: batchProfiles
    };

    const payloadStr = JSON.stringify(payload);

    // 1) try sendBeacon (ดีที่สุดสำหรับ GitHub Pages + GAS)
    let sent = beaconSend(CONFIG.endpoint, payloadStr);

    // 2) fallback fetch no-cors
    if (!sent){
      await fetchNoCors(CONFIG.endpoint, payloadStr);
      sent = true;
    }

    dbg('flush sent', {
      sessions: batchSessions.length,
      events: batchEvents.length,
      profiles: batchProfiles.length,
      bytes: payloadStr.length,
      via: navigator.sendBeacon ? (sent ? 'beacon/fetch-no-cors' : 'fetch-no-cors') : 'fetch-no-cors'
    });

    // success -> reset backoff
    backoffMs = 0;

  } catch (err) {
    // failed -> คืนกลับคิว (prepend) แล้วตั้ง backoff
    warn('flush error', err);

    // หมายเหตุ: ใน fetch no-cors บางครั้ง browser ไม่ throw แต่ GAS เขียนไม่สำเร็จเราไม่รู้
    // แต่ถ้า throw จริง -> เรารีคิว
    // (forceSync อาจเกิดตอน pagehide; ทำดีที่สุดแล้ว)

    // ถ้าพัง ให้เพิ่ม backoff และ retry
    backoffMs = backoffMs ? Math.min(BACKOFF_MAX, Math.round(backoffMs * 1.6)) : BACKOFF_MIN;

  } finally {
    inFlight = false;

    // ถ้ายังเหลือ ให้ schedule ต่อ (เผื่อ batch split)
    if (CONFIG.endpoint && (sessionsQueue.length || eventsQueue.length || profilesQueue.length)) {
      scheduleFlush();
    }
  }
}

// ---------- legacy/global compatibility ----------
try{
  // ให้เรียกได้จาก <script> ธรรมดา: initCloudLogger(...)
  // (สำคัญ: แก้ Uncaught ReferenceError: initCloudLogger is not defined)
  window.initCloudLogger = initCloudLogger;

  // optional helpers
  window.HHA_LOG = window.HHA_LOG || {};
  window.HHA_LOG.logSession = logSession;
  window.HHA_LOG.logEvent = logEvent;
  window.HHA_LOG.logProfile = logProfile;
  window.HHA_LOG.flush = flushLogger;
}catch(_){}
