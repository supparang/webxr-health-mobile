// === /herohealth/vr/hha-cloud-logger.js ===
// Hero Health — Cloud Logger (Sessions + Events) v4 Research
// ใช้กับ GoodJunkVR / โหมดอื่น ๆ ที่ยิง hha:session / hha:event

'use strict';

let CONFIG = {
  endpoint: '',
  projectTag: 'HeroHealth-GoodJunkVR',
  mode: 'GoodJunkVR',
  diff: 'normal',
  durationSec: 0,
  debug: false,
  playerProfile: null
};

let sessionQueue = [];
let eventQueue   = [];
let flushTimer   = null;
const FLUSH_DELAY = 2000; // ms

export function initCloudLogger(opts = {}) {
  CONFIG = {
    endpoint: opts.endpoint || CONFIG.endpoint || '',
    projectTag: opts.projectTag || CONFIG.projectTag || 'HeroHealth-GoodJunkVR',
    mode: opts.mode || CONFIG.mode || 'GoodJunkVR',
    diff: opts.diff || CONFIG.diff || 'normal',
    durationSec: opts.durationSec || CONFIG.durationSec || 0,
    debug: !!opts.debug,
    playerProfile: opts.playerProfile || CONFIG.playerProfile || null
  };

  if (CONFIG.debug) {
    console.log('[HHA CloudLogger] init', CONFIG);
  }

  // ฟัง session/event แค่ครั้งเดียว
  window.removeEventListener('hha:session', handleSessionEvent);
  window.removeEventListener('hha:event', handleGameEvent);

  window.addEventListener('hha:session', handleSessionEvent);
  window.addEventListener('hha:event', handleGameEvent);
}

function flatProfile() {
  const p = CONFIG.playerProfile || {};
  return {
    playerId:   p.playerId   || p.studentId || '',
    playerName: p.playerName || p.name      || '',
    school:     p.school     || '',
    classRoom:  p.classRoom  || p.class     || '',
    group:      p.group      || '',
    phase:      p.phase      || '',
    profileJson: Object.keys(p).length ? JSON.stringify(p) : ''
  };
}

function handleSessionEvent(e) {
  const d = e.detail || {};
  const nowIso = new Date().toISOString();
  const pf = flatProfile();

  const payload = Object.assign(
    {},
    {
      projectTag: CONFIG.projectTag,
      tsIso: nowIso,
      mode: d.mode || CONFIG.mode,
      difficulty: d.difficulty || CONFIG.diff,
      durationSecPlanned: CONFIG.durationSec
    },
    pf,
    d
  );

  sessionQueue.push(payload);

  if (CONFIG.debug) {
    console.log('[HHA CloudLogger] queue session', payload);
  }

  scheduleFlush();
}

function handleGameEvent(e) {
  const d = e.detail || {};
  const nowIso = new Date().toISOString();
  const pf = flatProfile();

  const payload = Object.assign(
    {},
    {
      projectTag: CONFIG.projectTag,
      tsIso: nowIso,
      mode: d.mode || CONFIG.mode,
      difficulty: d.difficulty || CONFIG.diff,
      playerId: pf.playerId,
      phase: pf.phase
    },
    d
  );

  eventQueue.push(payload);

  if (CONFIG.debug) {
    console.log('[HHA CloudLogger] queue event', payload);
  }

  scheduleFlush();
}

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flushNow();
  }, FLUSH_DELAY);
}

function flushNow() {
  if (!CONFIG.endpoint) {
    if (CONFIG.debug) {
      console.warn('[HHA CloudLogger] no endpoint, skip flush');
    }
    sessionQueue = [];
    eventQueue = [];
    return;
  }

  if (!sessionQueue.length && !eventQueue.length) return;

  const payload = {
    projectTag: CONFIG.projectTag,
    sessions: sessionQueue.slice(),
    events: eventQueue.slice()
  };

  sessionQueue = [];
  eventQueue = [];

  if (CONFIG.debug) {
    console.log('[HHA CloudLogger] flushing', payload);
  }

  try {
    fetch(CONFIG.endpoint, {
      method: 'POST',
      mode: 'no-cors',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    }).catch(err => {
      if (CONFIG.debug) {
        console.error('[HHA CloudLogger] fetch error', err);
      }
    });
  } catch (err) {
    if (CONFIG.debug) {
      console.error('[HHA CloudLogger] flush error', err);
    }
  }
}
