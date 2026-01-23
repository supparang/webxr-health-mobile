// === /herohealth/vr-groups/flush-log.js ===
// Flush-hardened Logger (optional)
// ✅ active only if ?log= is provided
// ✅ captures: hha:start, hha:time, hha:score, hha:rank, hha:judge, hha:end, quest:update, groups:power, groups:progress
// ✅ flush on: hha:end, pagehide, visibilitychange(hidden), beforeunload
// ✅ sendBeacon -> fetch(keepalive)

(function(){
  'use strict';
  const WIN = window;
  const DOC = document;

  function qs(k, d=null){
    try{ return new URL(location.href).searchParams.get(k) ?? d; }catch{ return d; }
  }
  const endpoint = String(qs('log','')||'').trim();
  if (!endpoint) return;

  const MAX_EVENTS = 600;
  const BUF = [];
  const sid = 'GVR-' + Math.random().toString(16).slice(2) + '-' + Date.now();
  const t0 = Date.now();

  function baseCtx(){
    return {
      sessionId: sid,
      projectTag: 'HeroHealth',
      gameTag: 'GroupsVR',
      url: location.href,
      ua: navigator.userAgent || '',
      ts0: t0,
      run: String(qs('run','play')||'play'),
      diff: String(qs('diff','normal')||'normal'),
      view: String(qs('view','mobile')||'mobile'),
      style: String(qs('style','mix')||'mix'),
      seed: String(qs('seed','')||''),
      studyId: String(qs('studyId','')||''),
      conditionGroup: String(qs('conditionGroup','')||'')
    };
  }

  function push(type, detail){
    if (BUF.length >= MAX_EVENTS) BUF.shift();
    BUF.push({
      type,
      t: Date.now(),
      dt: Date.now() - t0,
      detail: detail || null
    });
  }

  function safeDetail(ev){
    const d = (ev && ev.detail) ? ev.detail : {};
    // light sanitize: avoid huge objects
    try{
      return JSON.parse(JSON.stringify(d));
    }catch{
      return { note:'detail_unserializable' };
    }
  }

  async function sendPayload(payload){
    const body = JSON.stringify(payload);
    try{
      if (navigator.sendBeacon){
        const ok = navigator.sendBeacon(endpoint, new Blob([body], {type:'application/json'}));
        if (ok) return true;
      }
    }catch(_){}

    try{
      const res = await fetch(endpoint, {
        method:'POST',
        headers:{'content-type':'application/json'},
        body,
        keepalive:true,
        mode:'cors'
      });
      return !!res && (res.ok || res.status===0);
    }catch(_){
      return false;
    }
  }

  let flushing = false;
  async function flush(reason){
    if (flushing) return;
    flushing = true;

    const payload = {
      kind: 'hha_log',
      reason: String(reason||'flush'),
      ctx: baseCtx(),
      events: BUF.splice(0, BUF.length)
    };

    try{ await sendPayload(payload); }catch(_){}
    flushing = false;
  }

  // public hook: bindFlushOnLeave(() => lastSummary)
  WIN.GroupsVR = WIN.GroupsVR || {};
  WIN.GroupsVR.bindFlushOnLeave = function(getLastSummary){
    // attach summary snapshot on flush
    const oldFlush = flush;
    flush = async function(reason){
      if (flushing) return;
      flushing = true;

      let summary = null;
      try{ summary = (typeof getLastSummary === 'function') ? getLastSummary() : null; }catch(_){}

      const payload = {
        kind: 'hha_log',
        reason: String(reason||'flush'),
        ctx: baseCtx(),
        summary: summary || null,
        events: BUF.splice(0, BUF.length)
      };

      try{ await sendPayload(payload); }catch(_){}
      flushing = false;
    };
  };

  // listeners
  const events = [
    'hha:start','hha:time','hha:score','hha:rank','hha:judge','hha:end',
    'quest:update','groups:power','groups:progress'
  ];

  events.forEach((name)=>{
    WIN.addEventListener(name, (ev)=>{
      push(name, safeDetail(ev));
      if (name === 'hha:end') flush('hha:end');
    }, {passive:true});
  });

  // flush-hardened on leave
  WIN.addEventListener('pagehide', ()=> flush('pagehide'), {passive:true});
  WIN.addEventListener('beforeunload', ()=> flush('beforeunload'), {passive:true});
  DOC.addEventListener('visibilitychange', ()=>{
    if (DOC.visibilityState === 'hidden') flush('hidden');
  }, {passive:true});

})();