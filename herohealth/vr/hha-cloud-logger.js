// === /herohealth/vr/hha-cloud-logger.js ===
// Hero Health VR Cloud Logger (Apps Script friendly / CORS-safe)
// ✅ Payload = { projectTag, sessions:[...], events:[...] }  (ตรงกับชีต sessions/events)
// ✅ sendBeacon(text/plain) first, fallback fetch(no-cors,text/plain,keepalive)
// ✅ bind listeners once (กัน init ซ้ำแล้ว log ซ้ำ)
// ✅ emits: hha:logger { ok:boolean, msg:string }

'use strict';

let CONFIG = {
  endpoint: '',
  projectTag: 'HeroHealth',
  debug: false
};

let sessionId = null;
let sessionStart = 0;
let lastScoreLogAt = 0;

let sessionRow = {};       // row to push into "sessions"
let eventQueue = [];       // rows to push into "events"
let bound = false;

function uuid(){
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c=>{
    const r = Math.random()*16|0, v = c==='x'?r:(r&0x3|0x8);
    return v.toString(16);
  });
}

function emitLogger(ok, msg){
  window.dispatchEvent(new CustomEvent('hha:logger', { detail:{ ok, msg } }));
  if (CONFIG.debug) console.log('[HHA Logger]', ok, msg);
}

function packPayload(final=false){
  // ✅ shape ที่ Apps Script รุ่น "sessions/events" ใช้กันบ่อยสุด
  const sessions = [ {
    ...sessionRow,
    sessionId,
    projectTag: CONFIG.projectTag,
    ts: Date.now(),
    final: !!final
  } ];

  const events = eventQueue.slice(0, 800).map(ev => ({
    projectTag: CONFIG.projectTag,
    sessionId,
    ...ev
  }));

  return { projectTag: CONFIG.projectTag, sessions, events };
}

async function send(payload){
  if (!CONFIG.endpoint) throw new Error('No endpoint');

  const body = JSON.stringify(payload);

  // 1) sendBeacon (เหมาะกับ Apps Script + cross-origin + ตอนปิดหน้า)
  if (navigator.sendBeacon){
    try{
      const ok = navigator.sendBeacon(
        CONFIG.endpoint,
        new Blob([body], { type:'text/plain;charset=utf-8' })
      );
      if (ok){
        emitLogger(true, payload.sessions?.[0]?.final ? 'logger: sent(final/beacon)' : 'logger: sent(beacon)');
        return true;
      }
    }catch(_){}
  }

  // 2) fetch no-cors (อ่าน response ไม่ได้ แต่ยิงได้)
  await fetch(CONFIG.endpoint, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type':'text/plain;charset=utf-8' },
    body,
    keepalive: true
  });

  emitLogger(true, payload.sessions?.[0]?.final ? 'logger: sent(final/no-cors)' : 'logger: sent(no-cors)');
  return true;
}

function flush(final=false){
  if (!sessionId) return;

  // ถ้าไม่มี event และไม่ใช่ final → ไม่ต้องยิง
  if (!eventQueue.length && !final) return;

  const payload = packPayload(final);

  // ✅ เคลียร์คิวหลัง “เริ่มส่ง” (กัน payload โต)
  const backup = eventQueue.slice();
  eventQueue = [];

  send(payload).catch(err=>{
    // ✅ ถ้าส่งพัง เอาคิวกลับ (กันข้อมูลหาย)
    eventQueue = backup.concat(eventQueue);
    emitLogger(false, 'logger: send failed (check console)');
    console.warn('[HHA Logger] send failed', err);
  });
}

function pushEvent(type, data){
  eventQueue.push({
    type,
    ts: Date.now(),
    data: data || {}
  });

  // ส่งเป็นช่วง ๆ
  if (eventQueue.length >= 30) flush(false);
}

function bindListenersOnce(){
  if (bound) return;
  bound = true;

  window.addEventListener('hha:score', (e)=>{
    const t = Date.now();
    if (t - lastScoreLogAt < 450) return;
    lastScoreLogAt = t;
    pushEvent('score', e.detail || {});
  });

  window.addEventListener('hha:judge', (e)=> pushEvent('judge', e.detail||{}));
  window.addEventListener('hha:miss',  (e)=> pushEvent('miss',  e.detail||{}));
  window.addEventListener('quest:update', (e)=> pushEvent('quest', e.detail||{}));
  window.addEventListener('hha:fever', (e)=> pushEvent('fever', e.detail||{}));
  window.addEventListener('hha:lives', (e)=> pushEvent('lives', e.detail||{}));
  window.addEventListener('hha:adaptive', (e)=> pushEvent('adaptive', e.detail||{}));
  window.addEventListener('hha:mode', (e)=> pushEvent('mode', e.detail||{}));
  window.addEventListener('quest:power', (e)=> pushEvent('power', e.detail||{}));
  window.addEventListener('quest:block', (e)=> pushEvent('block', e.detail||{}));
  window.addEventListener('quest:boss', (e)=> pushEvent('boss', e.detail||{}));
  window.addEventListener('quest:bossClear', (e)=> pushEvent('bossClear', e.detail||{}));

  window.addEventListener('hha:end', (e)=>{
    const endTs = Date.now();
    sessionRow.endTs = endTs;
    sessionRow.durationMs = endTs - sessionStart;
    sessionRow.result = e.detail || {};
    pushEvent('end', e.detail || {});
    flush(true);
  });

  // ✅ ปิดหน้า/เปลี่ยนหน้า → flush final เพิ่มอีกชั้น
  window.addEventListener('pagehide', ()=>{
    try{ flush(true); }catch(_){}
  });
}

export function initCloudLogger(opts = {}){
  CONFIG = {
    endpoint: opts.endpoint || sessionStorage.getItem('HHA_LOG_ENDPOINT') || '',
    projectTag: opts.projectTag || 'HeroHealth',
    debug: !!opts.debug
  };

  sessionId = uuid();
  sessionStart = Date.now();
  lastScoreLogAt = 0;

  // ✅ row ที่จะไปลงชีต "sessions"
  sessionRow = {
    mode: opts.mode || '',
    runMode: opts.runMode || '',
    diff: opts.diff || '',
    challenge: opts.challenge || '',
    durationSec: (typeof opts.durationSec === 'number') ? opts.durationSec : null,
    studentKey: opts.studentKey || null,
    profile: opts.profile || null,
    ua: navigator.userAgent || ''
  };

  bindListenersOnce();

  if (!CONFIG.endpoint){
    emitLogger(false, 'logger: no endpoint (hub?)');
  } else {
    emitLogger(true, 'logger: ready');
  }

  // start marker
  pushEvent('start', { startedAt: sessionStart });
  flush(false);
}

export function logEvent(type, data){
  pushEvent(type, data);
}

export function flushNow(){
  flush(false);
}
