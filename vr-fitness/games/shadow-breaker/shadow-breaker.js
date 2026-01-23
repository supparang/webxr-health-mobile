// =======================================================
// HHA-STYLE LOGGER (Flush-hardened) — no Apps Script required
// If ?log= is provided => try sendBeacon/fetch keepalive
// Always keeps local backup queue (localStorage) for safety
// =======================================================
const SB_LOG_ENDPOINT = (qs('log','')||'').trim();
const SB_STUDY_ID = (qs('studyId','')||'').trim();
const SB_COND_GROUP = (qs('conditionGroup','')||'').trim();
const SB_VIEW = (qs('view','')||'').trim();

const SB_SESSION_ID = (() => {
  // stable per page load
  const base = Date.now().toString(36) + Math.random().toString(36).slice(2,8);
  return `${SB_GAME_ID}-${base}`;
})();

const SB_LOG_KEY = 'HHA_LOG_QUEUE_shadowbreaker_v1';

const sbLog = {
  seq: 0,
  queue: [],
  flushing: false,
  lastFlushAt: 0,
};

function sbNowISO(){ return new Date().toISOString(); }

function sbCtxBase(){
  return {
    gameId: SB_GAME_ID,
    gameVersion: SB_GAME_VERSION,
    sessionId: SB_SESSION_ID,

    phase: sbPhase,
    mode: sbMode,
    diff: sbDiff,
    timeSec: (sbMode==='endless') ? 0 : sbTimeSec,

    view: SB_VIEW || null,
    seed: SB_SEED || null,

    research: SB_IS_RESEARCH ? 1 : 0,
    studyId: SB_STUDY_ID || null,
    conditionGroup: SB_COND_GROUP || null,

    ua: navigator.userAgent || '',
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone || '',
  };
}

function sbLogLoad(){
  try{
    const raw = localStorage.getItem(SB_LOG_KEY);
    if(raw){
      const arr = JSON.parse(raw);
      if(Array.isArray(arr)) sbLog.queue = arr;
    }
  }catch(_){}
}
function sbLogSave(){
  try{ localStorage.setItem(SB_LOG_KEY, JSON.stringify(sbLog.queue)); }catch(_){}
}

function sbLogEnqueue(type, payload){
  const ev = {
    v: 1,
    seq: (++sbLog.seq),
    type,
    ts: sbNowISO(),
    tMs: Math.round(performance.now()),
    elapsedMs: Math.round(sbState.elapsedMs || 0),

    ctx: sbCtxBase(),
    meta: sbState.sessionMeta || null, // studentId/school/class etc.
    data: payload || {},
  };

  // keep queue bounded
  sbLog.queue.push(ev);
  if(sbLog.queue.length > 2000) sbLog.queue.splice(0, sbLog.queue.length - 2000);

  sbLogSave();
  return ev;
}

function sbPostBatch(batch){
  // If no endpoint => just keep local
  if(!SB_LOG_ENDPOINT) return Promise.resolve({ ok:false, localOnly:true });

  const body = JSON.stringify({
    kind: 'hha_log_batch',
    createdAt: sbNowISO(),
    count: batch.length,
    items: batch,
  });

  // Prefer sendBeacon (best for unload), fallback fetch keepalive
  try{
    if(navigator.sendBeacon){
      const ok = navigator.sendBeacon(SB_LOG_ENDPOINT, new Blob([body], {type:'application/json'}));
      return Promise.resolve({ ok, beacon:true });
    }
  }catch(_){}

  return fetch(SB_LOG_ENDPOINT, {
    method:'POST',
    headers:{ 'Content-Type':'application/json' },
    body,
    keepalive:true,
    mode:'cors',
  }).then(r=>({ ok:r.ok, status:r.status })).catch(()=>({ ok:false }));
}

async function sbLogFlush(reason='manual'){
  if(sbLog.flushing) return;
  sbLog.flushing = true;

  // throttle a bit
  const now = performance.now();
  if(now - sbLog.lastFlushAt < 300 && reason!=='end' && reason!=='pagehide'){
    sbLog.flushing = false;
    return;
  }
  sbLog.lastFlushAt = now;

  // enqueue flush marker (lightweight)
  sbLogEnqueue('hha:flush', { reason });

  // snapshot batch
  const batch = sbLog.queue.slice(0, 80); // small chunks
  if(!batch.length){
    sbLog.flushing = false;
    return;
  }

  const res = await sbPostBatch(batch);

  // If sent ok => remove sent items
  if(res && res.ok){
    sbLog.queue.splice(0, batch.length);
    sbLogSave();
  }

  sbLog.flushing = false;
}

// auto flush on risky moments
window.addEventListener('visibilitychange', ()=>{
  if(document.visibilityState === 'hidden') sbLogFlush('hidden');
});
window.addEventListener('pagehide', ()=> sbLogFlush('pagehide'));
window.addEventListener('beforeunload', ()=> sbLogFlush('beforeunload'));

// init
sbLogLoad();