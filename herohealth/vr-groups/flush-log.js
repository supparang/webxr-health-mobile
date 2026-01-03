// === /herohealth/vr-groups/flush-log.js ===
// Flush-Hardened Logger Helpers — PRODUCTION
// ✅ GroupsVR.postSummary(summary): ส่งผลด้วย sendBeacon/fetch keepalive
// ✅ GroupsVR.bindFlushOnLeave(getSummaryFn): flush ก่อนออก/สลับแท็บ/pagehide/back
// ✅ ใช้ ?log=ENDPOINT เพื่อส่งเข้า Google Apps Script (หรือ endpoint อื่น)

(function(root){
  'use strict';
  const DOC = root.document;
  if (!DOC) return;

  const NS = root.GroupsVR = root.GroupsVR || {};

  function qs(k, def=null){
    try { return new URL(location.href).searchParams.get(k) ?? def; }
    catch { return def; }
  }

  function nowIso(){ return new Date().toISOString(); }

  function getLogEndpoint(){
    const u = String(qs('log','')||'').trim();
    return u || '';
  }

  async function postSummary(summary){
    const ep = getLogEndpoint();
    if (!ep) return false;

    let payload = summary || {};
    try{
      // บังคับมี timestamp เสมอ
      if (!payload.timestampIso) payload.timestampIso = nowIso();
    }catch(_){}

    const body = JSON.stringify(payload);

    // 1) sendBeacon (เหมาะสุดสำหรับตอนออกหน้า)
    try{
      if (navigator.sendBeacon){
        const ok = navigator.sendBeacon(ep, new Blob([body], {type:'application/json'}));
        if (ok) return true;
      }
    }catch(_){}

    // 2) fetch keepalive
    try{
      const res = await fetch(ep, {
        method:'POST',
        headers:{'content-type':'application/json'},
        body,
        keepalive:true,
        mode:'cors'
      });
      return !!res;
    }catch(_){}

    return false;
  }

  function bindFlushOnLeave(getSummaryFn){
    if (typeof getSummaryFn !== 'function') return;

    let flushed = false;
    let lastAttemptAt = 0;

    function buildPayload(reason){
      let s = null;
      try{ s = getSummaryFn() || null; }catch(_){}
      if (!s) return null;

      // ถ้ามี reason เดิมอยู่แล้ว ไม่ทับ
      try{
        if (!s.reason) s.reason = String(reason||'leave');
        if (!s.flushReason) s.flushReason = String(reason||'leave');
        if (!s.flushAtIso) s.flushAtIso = nowIso();
      }catch(_){}
      return s;
    }

    function tryFlush(reason){
      const ep = getLogEndpoint();
      if (!ep) return;
      const t = Date.now();
      if (flushed && (t - lastAttemptAt) < 400) return; // กันยิงถี่
      lastAttemptAt = t;

      const payload = buildPayload(reason);
      if (!payload) return;

      flushed = true;
      try{ postSummary(payload); }catch(_){}
    }

    // สำคัญสุด: pagehide (Safari/iOS) + visibilitychange
    root.addEventListener('pagehide', ()=> tryFlush('pagehide'), {capture:true, passive:true});
    DOC.addEventListener('visibilitychange', ()=>{
      if (DOC.visibilityState === 'hidden') tryFlush('hidden');
    }, {capture:true, passive:true});

    // beforeunload เป็น fallback
    root.addEventListener('beforeunload', ()=> tryFlush('beforeunload'), {capture:true});

    // back/forward cache / history
    root.addEventListener('popstate', ()=> tryFlush('popstate'), {capture:true, passive:true});
  }

  NS.postSummary = postSummary;
  NS.bindFlushOnLeave = bindFlushOnLeave;
})(window);