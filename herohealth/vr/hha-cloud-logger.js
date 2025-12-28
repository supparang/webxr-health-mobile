// === /herohealth/vr/hha-cloud-logger.js ===
// HeroHealth — Cloud Logger (Google Apps Script Web App)
// Usage: add ?log=<WEB_APP_EXEC_URL>
// Listens:
//  - hha:log_session
//  - hha:log_event
//  - hha:end
// Sends: { op, sheet, ...flatRow, row: flatRow }  (backward compatible)
// Uses sendBeacon then fetch fallback

(function (root) {
  'use strict';

  const doc = root.document;
  if (!doc) return;

  function getEndpoint(){
    try{
      const u = new URL(location.href);
      const ep = u.searchParams.get('log');
      return ep ? String(ep) : null;
    }catch(_){ return null; }
  }

  const ENDPOINT = getEndpoint();
  const Q = [];
  let flushing = false;

  // ---------- utils ----------
  const isObj = (v)=>v && typeof v === 'object' && !Array.isArray(v);
  const pick1 = (...xs)=>{ for(const x of xs){ if(x!==undefined && x!==null && String(x)!=='') return x; } return ''; };
  const numOrBlank = (v)=>{
    if (v===undefined || v===null || v==='') return '';
    const n = Number(v);
    return Number.isFinite(n) ? n : '';
  };
  const isoNow = ()=>{ try{ return new Date().toISOString(); }catch(_){ return ''; } };
  const safeJson = (v)=>{
    try{
      if (v == null) return '';
      if (typeof v === 'string') return v;
      return JSON.stringify(v);
    }catch(_){ return ''; }
  };

  // ---------- schema normalizers ----------
  // Accepts:
  //  A) { ctx:{...}, data:{...}, type:'spawn' }  (new)
  //  B) flat row already {timestampIso, projectTag, ...} (legacy)
  //  C) { sheet:'Events', row:{...} } (pre-normalized)
  function normalizeEvent(detail){
    // already normalized
    if (isObj(detail) && (detail.sheet || detail.row)) {
      const row0 = isObj(detail.row) ? detail.row : detail;
      if (!row0.timestampIso) row0.timestampIso = isoNow();
      return { sheet: detail.sheet || 'Events', row: row0 };
    }

    const ctx  = (isObj(detail) && isObj(detail.ctx)) ? detail.ctx : (isObj(detail) ? detail : {});
    const data = (isObj(detail) && isObj(detail.data)) ? detail.data : {};

    // event type
    const eventType = String(
      pick1(
        data.eventType,
        detail && detail.eventType,
        detail && detail.type,
        data.type,
        'event'
      )
    );

    // common ids/time
    const sessionId = pick1(data.sessionId, detail && detail.sessionId, ctx.sessionId);
    const timeFromStartMs = pick1(
      data.timeFromStartMs,
      detail && detail.timeFromStartMs,
      detail && detail.t,
      data.t
    );

    // item fields
    const itemType = pick1(data.itemType, data.kind, detail && detail.itemType, detail && detail.kind);
    const emoji    = pick1(data.emoji, detail && detail.emoji);
    const targetId = pick1(data.targetId, detail && detail.targetId);

    // judgment/rt
    const judgment = pick1(data.judgment, detail && detail.judgment);
    const rtMs = pick1(data.rtMs, detail && detail.rtMs);

    // score/combo
    const totalScore = pick1(data.totalScore, detail && detail.totalScore, detail && detail.score, data.score);
    const combo = pick1(data.combo, detail && detail.combo);

    // fever
    const feverState = pick1(
      data.feverState,
      detail && detail.feverState,
      (detail && detail.feverOn) ? 'on' : ''
    );
    const feverValue = pick1(data.feverValue, detail && detail.feverValue, detail && detail.fever);

    // goal/mini
    const goalProgress = pick1(data.goalProgress, detail && detail.goalProgress);
    const miniProgress = pick1(data.miniProgress, detail && detail.miniProgress);

    // isGood
    const isGood = (data.isGood === 1 || data.isGood === true) ? 1
                : (data.isGood === 0 || data.isGood === false) ? 0 : '';

    const row = {
      // context columns (Events)
      timestampIso: pick1(ctx.timestampIso, data.timestampIso, isoNow()),
      projectTag: pick1(ctx.projectTag, data.projectTag),
      runMode: pick1(ctx.runMode, data.runMode),
      studyId: pick1(ctx.studyId, data.studyId),
      phase: pick1(ctx.phase, data.phase),
      conditionGroup: pick1(ctx.conditionGroup, data.conditionGroup),
      sessionId,

      // required event columns
      eventType,
      gameMode: pick1(data.gameMode, detail && detail.gameMode, detail && detail.game, ctx.gameMode, 'plate'),
      diff: pick1(data.diff, detail && detail.diff, ctx.diff),
      timeFromStartMs: numOrBlank(timeFromStartMs),

      targetId: String(targetId || ''),
      emoji: String(emoji || ''),
      itemType: String(itemType || ''),
      lane: pick1(data.lane, detail && detail.lane, ''),

      rtMs: numOrBlank(rtMs),
      judgment: String(judgment || ''),
      totalScore: numOrBlank(totalScore),
      combo: numOrBlank(combo),

      isGood,
      feverState: String(feverState || ''),
      feverValue: numOrBlank(feverValue),

      goalProgress: String(goalProgress || ''),
      miniProgress: String(miniProgress || ''),
      extra: safeJson(pick1(data.extra, detail && detail.extra, data, detail)),

      // minimal profile keys (Events schema)
      studentKey: pick1(ctx.studentKey, data.studentKey),
      schoolCode: pick1(ctx.schoolCode, data.schoolCode),
      classRoom: pick1(ctx.classRoom, data.classRoom),
      studentNo: pick1(ctx.studentNo, data.studentNo),
      nickName: pick1(ctx.nickName, data.nickName),
    };

    return { sheet: 'Events', row };
  }

  function normalizeSession(detail){
    // already normalized
    if (isObj(detail) && (detail.sheet || detail.row)) {
      const row0 = isObj(detail.row) ? detail.row : detail;
      if (!row0.timestampIso) row0.timestampIso = isoNow();
      return { sheet: detail.sheet || 'Sessions', row: row0 };
    }

    const row = Object.assign({}, (detail || {}));
    if (!row.timestampIso) row.timestampIso = isoNow();

    // make sure common names exist (do not overwrite if already present)
    if (!row.gameMode && row.game) row.gameMode = row.game;
    return { sheet: 'Sessions', row };
  }

  // ---------- transport ----------
  function post(payload){
    if (!ENDPOINT) return;

    const body = JSON.stringify(payload);
    try{
      if (navigator.sendBeacon){
        const ok = navigator.sendBeacon(ENDPOINT, new Blob([body], { type: 'application/json' }));
        if (ok) return true;
      }
    }catch(_){}
    return fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true
    }).then(()=>true).catch(()=>false);
  }

  function wrapForSend(op, normalized){
    const sheet = normalized.sheet || (op === 'event' ? 'Events' : 'Sessions');
    const row = normalized.row || {};
    // Backward compatible: include BOTH flat keys and row object
    return Object.assign(
      { op, type: op, sheet, row },
      row
    );
  }

  function enqueue(op, detail){
    if (!ENDPOINT) return;

    let normalized;
    if (op === 'event') normalized = normalizeEvent(detail || {});
    else normalized = normalizeSession(detail || {});

    const payload = wrapForSend(op, normalized);
    Q.push({ op, payload, ts: Date.now() });
    flushSoon();
  }

  function flushSoon(){
    if (flushing) return;
    flushing = true;
    setTimeout(async () => {
      try{
        while(Q.length){
          const item = Q.shift();
          await post(item.payload);
        }
      } finally {
        flushing = false;
      }
    }, 120);
  }

  function flushNow(){
    if (!ENDPOINT) return Promise.resolve();
    return (async () => {
      while(Q.length){
        const item = Q.shift();
        await post(item.payload);
      }
    })();
  }

  // ---------- listeners ----------
  root.addEventListener('hha:log_session', (e) => enqueue('session', e.detail || {}));
  root.addEventListener('hha:log_event', (e) => enqueue('event', e.detail || {}));

  // hha:end บางเกมยิงแบบสรุป (ให้ถือเป็น session ด้วยเพื่อไม่ตกหล่น)
  root.addEventListener('hha:end', (e) => enqueue('session', e.detail || {}));

  root.HHACloudLogger = { flushNow };
  root.GAME_MODULES = root.GAME_MODULES || {};
  root.GAME_MODULES.HHACloudLogger = root.HHACloudLogger;

})(window);
