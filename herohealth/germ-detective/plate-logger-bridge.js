// plate-logger-bridge.js
// PlateLogger bridge for plates (postMessage / fetch / ws) with offline queue + flush-hardened
// Usage:
//   PlateLogger.init({ mode:'postMessage'|'fetch'|'ws', backendUrl, wsUrl, plateId, sessionId, authToken, debug });
//   PlateLogger.logEvent(name, payload);
//   PlateLogger.sendEvidence({ type, meta, dataUrl?/blob? });
//   PlateLogger.on('command', cb);

const PlateLogger = (function(){
  let cfg = {
    mode: 'postMessage', // default
    backendUrl: null,
    wsUrl: null,
    plateId: 'plate-unknown',
    sessionId: null,
    authToken: null,
    debug: false,
    maxQueue: 200
  };

  let ws = null;
  const queueKey = 'PLATE_OFFLINE_QUEUE';
  const listeners = {};

  function dlog(...args){ if(cfg.debug) console.log('[PlateLogger]', ...args); }

  function init(options = {}){
    cfg = Object.assign(cfg, options || {});
    // reconnect WS if needed
    if(cfg.mode === 'ws' && cfg.wsUrl){
      tryOpenWs();
    }
    // wire window events for hha:features_1s / hha:labels / hha:event
    window.addEventListener('hha:features_1s', ev => {
      safeLog('features_1s', ev.detail);
    }, { passive:true });
    window.addEventListener('hha:labels', ev => {
      safeLog('labels', ev.detail);
    }, { passive:true });
    window.addEventListener('hha:event', ev => {
      safeLog(ev.detail?.name || 'event', ev.detail?.payload || ev.detail);
    }, { passive:true });

    // listen postMessage from parent/hub
    window.addEventListener('message', ev=>{
      const m = ev.data;
      if(!m) return;
      if(m.type === 'hub:command'){
        emit('command', m);
      }
    }, false);

    // attempt flush stored queue if backend is reachable
    tryFlushQueue();
    dlog('init', cfg);
  }

  // envelope builder
  function envelope(type, payload){
    return {
      type,
      plateId: cfg.plateId,
      sessionId: cfg.sessionId,
      timestamp: (new Date()).toISOString(),
      payload
    };
  }

  // local offline queue helpers
  function readQueue(){
    try{ return JSON.parse(localStorage.getItem(queueKey) || '[]') || []; }catch{ return []; }
  }
  function writeQueue(q){
    try{ localStorage.setItem(queueKey, JSON.stringify(q.slice(-cfg.maxQueue))); }catch{}
  }
  function pushQueue(item){
    const q = readQueue();
    q.push(item);
    writeQueue(q);
    dlog('queued', item);
  }
  function clearQueue(){
    try{ localStorage.removeItem(queueKey); }catch{}
  }

  // send via postMessage to parent (hub)
  function sendPostMessage(msg){
    try{
      window.parent && window.parent.postMessage(msg, '*');
      dlog('postMessage -> parent', msg);
    }catch(e){ dlog('postMessage err', e); pushQueue({ mode:'postMessage', msg }); }
  }

  // send via fetch to backend
  async function sendFetch(msg){
    if(!cfg.backendUrl){
      dlog('no backendUrl'); pushQueue({ mode:'fetch', msg }); return;
    }
    try{
      const headers = { 'Content-Type': 'application/json' };
      if(cfg.authToken) headers['Authorization'] = `Bearer ${cfg.authToken}`;
      const res = await fetch(cfg.backendUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(msg),
        keepalive: true
      });
      dlog('fetch status', res.status);
      if(!res.ok) pushQueue({ mode:'fetch', msg });
    }catch(err){
      dlog('fetch err', err);
      pushQueue({ mode:'fetch', msg });
    }
  }

  // ws helpers
  function tryOpenWs(){
    if(!cfg.wsUrl) return;
    if(ws && ws.readyState === WebSocket.OPEN) return;
    try{
      ws = new WebSocket(cfg.wsUrl);
      ws.addEventListener('open', ()=> {
        dlog('ws open');
        tryFlushQueue();
      });
      ws.addEventListener('message', ev => {
        try{
          const data = JSON.parse(ev.data);
          emit('ws:message', data);
        }catch(e){ dlog('ws parse err', e); }
      });
      ws.addEventListener('close', ()=> { dlog('ws closed'); ws = null; });
      ws.addEventListener('error', e => { dlog('ws error', e); ws = null; });
    }catch(e){ dlog('ws init err', e); ws = null; }
  }

  function sendWs(msg){
    if(!ws || ws.readyState !== WebSocket.OPEN){
      pushQueue({ mode:'ws', msg }); tryOpenWs(); return;
    }
    try{ ws.send(JSON.stringify(msg)); dlog('ws send', msg); }catch(e){ dlog('ws send err', e); pushQueue({ mode:'ws', msg }); }
  }

  // safe log wrapper (decides mode)
  function safeLog(name, payload){
    const msg = envelope(name, payload);
    if(cfg.mode === 'postMessage') sendPostMessage(msg);
    else if(cfg.mode === 'fetch') sendFetch(msg);
    else if(cfg.mode === 'ws') sendWs(msg);
    else sendPostMessage(msg);
  }

  // public logging APIs
  function logEvent(name, payload = {}){
    safeLog(name, payload);
  }

  // sendEvidence: if dataUrl present and backend available use fetch multipart (handled here as JSON dataUrl)
  async function sendEvidence(evidence = {}){
    // evidence: { type, meta, dataUrl (optional), blob (optional) }
    const msg = envelope('evidence', evidence);
    // avoid posting huge dataUrls via postMessage to parent; better to send minimal meta then fetch upload if backend configured
    if(cfg.mode === 'postMessage'){
      // send meta only
      const metaOnly = Object.assign({}, msg);
      if(evidence.dataUrl) metaOnly.payload.dataUrl = '[dataUrl omitted]';
      sendPostMessage(metaOnly);
      // if backend exists, also upload
      if(cfg.backendUrl) await sendFetch(msg);
    } else {
      await safeLog('evidence', evidence);
    }
  }

  // flush queue: attempt to resend queued items via preferred channel (fetch/ws/postMessage)
  async function tryFlushQueue(){
    const q = readQueue();
    if(!q.length) return;
    dlog('flush queue len', q.length);
    for(const item of q.slice()){
      try{
        if(item.mode === 'fetch' && cfg.backendUrl){
          await sendFetch(item.msg);
        } else if(item.mode === 'ws' && cfg.wsUrl){
          tryOpenWs();
          sendWs(item.msg);
        } else if(item.mode === 'postMessage'){
          sendPostMessage(item.msg);
        } else {
          // fallback to fetch if possible
          if(cfg.backendUrl) await sendFetch(item.msg);
          else sendPostMessage(item.msg);
        }
      }catch(e){
        dlog('flush item err', e);
      }
    }
    // clear after attempt (we don't track per-item success here; keep simple)
    clearQueue();
  }

  // capture canvas helper (returns dataUrl)
  function captureCanvasDataUrl(canvas, mime='image/png', quality=0.8){
    try{ return canvas.toDataURL(mime, quality); }catch(e){ dlog('capture err', e); return null; }
  }

  // event emitter/listener
  function on(type, cb){ if(!listeners[type]) listeners[type]=[]; listeners[type].push(cb); }
  function off(type, cb){ if(!listeners[type]) return; listeners[type]=listeners[type].filter(x=>x!==cb); }
  function emit(type, payload){ if(listeners[type]) listeners[type].forEach(cb=>{ try{ cb(payload); }catch(e){ dlog('listener err', e); } }); }

  // expose API
  return {
    init,
    logEvent,
    sendEvidence,
    tryFlushQueue,
    captureCanvasDataUrl,
    on,
    off,
    _cfg: ()=> cfg
  };
})();

// expose global for non-module usage
if(typeof window !== 'undefined') window.PlateLogger = PlateLogger;
if(typeof module !== 'undefined') module.exports = PlateLogger;
