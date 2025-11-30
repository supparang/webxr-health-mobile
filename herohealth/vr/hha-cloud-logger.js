// === /herohealth/vr/hha-cloud-logger.js ===
// ส่งข้อมูล Session + Event ไป Google Sheet ผ่าน Apps Script

let cfg = null;
let sessionQueue = [];
let eventQueue   = [];
let flushTimer   = null;

export function initCloudLogger(options = {}) {
  cfg = {
    endpoint:   options.endpoint,
    projectTag: options.projectTag || 'HeroHealth',
    debug:      !!options.debug,
  };
  if (!cfg.endpoint) {
    console.warn('[HHA-Logger] ไม่มี endpoint');
    return;
  }

  window.addEventListener('hha:session', onSession);
  window.addEventListener('hha:event',   onEvent);

  if (cfg.debug) {
    console.log('[HHA-Logger] init', cfg);
  }
}

function onSession(ev) {
  if (!cfg) return;
  const s = ev.detail || {};
  const row = [
    new Date().toISOString(),       // 1 timestamp
    cfg.projectTag,                 // 2 projectTag

    s.sessionId || '',              // 3 sessionId
    s.game || '',                   // 4 game
    s.mode || '',                   // 5 mode
    s.difficulty || '',             // 6 difficulty

    s.playerId || '',               // 7 playerId
    s.group || '',                  // 8 group
    s.prePost || '',                // 9 pre/post
    s.className || '',              //10 class
    s.school || '',                 //11 school

    s.device || '',                 //12 device
    s.userAgent || '',              //13 userAgent

    s.durationSecPlanned || 0,      //14 planned
    s.durationSecPlayed  || 0,      //15 played

    s.scoreFinal || 0,              //16 score
    s.comboMax   || 0,              //17 comboMax
    s.misses     || 0,              //18 misses

    s.goodHits    || 0,             //19 goodHits
    s.junkHits    || 0,             //20 junkHits
    s.starHits    || 0,             //21 star
    s.diamondHits || 0,             //22 diamond
    s.shieldHits  || 0,             //23 shield
    s.fireHits    || 0,             //24 fire

    s.feverActivations  || 0,       //25 feverCount
    s.feverTimeTotalSec || 0        //26 feverTime
  ];
  sessionQueue.push(row);
  scheduleFlush();
}

function onEvent(ev) {
  if (!cfg) return;
  const e = ev.detail || {};
  const row = [
    new Date().toISOString(),            // 1 timestamp
    cfg.projectTag,                      // 2 projectTag

    e.sessionId  || '',                  // 3 sessionId
    e.eventType  || 'hit',               // 4 eventType
    e.emoji      || '',                  // 5 emoji
    e.lane != null ? e.lane : '',        // 6 lane
    e.rtMs  != null ? e.rtMs  : '',      // 7 RT ms

    e.hitType    || '',                  // 8 hitType
    e.scoreDelta || 0,                   // 9 scoreDelta
    e.comboAfter || 0,                   //10 comboAfter
    e.isGood ? 1 : 0                     //11 isGoodFlag
  ];
  eventQueue.push(row);
  scheduleFlush();
}

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(flush, 3000); // รวมทีละก้อนทุก 3 วิ
}

async function flush() {
  if (!cfg || !cfg.endpoint) return;

  const sessions = sessionQueue;
  const events   = eventQueue;
  sessionQueue = [];
  eventQueue   = [];
  flushTimer   = null;

  if (!sessions.length && !events.length) return;

  const payload = { projectTag: cfg.projectTag, sessions, events };

  if (cfg.debug) {
    console.log('[HHA-Logger] flush →', payload);
  }

  try {
    // ใช้ mode: 'no-cors' เพื่อหลบปัญหา CORS ระหว่าง GitHub Pages ↔ Apps Script
    await fetch(cfg.endpoint, {
      method: 'POST',
      mode: 'no-cors', // <— จุดสำคัญ
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: JSON.stringify(payload),
    });

    if (cfg.debug) {
      console.log('[HHA-Logger] sent payload (no-cors, อ่าน status ไม่ได้)');
    }
  } catch (err) {
    console.warn('[HHA-Logger] error', err);
  }
}
