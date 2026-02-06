// === /herohealth/log/hha-log.js ===
// HHA Log Helper — flush-hardened (GET ?log=)
// ✅ queues events/sessions
// ✅ sendBeacon first, fallback fetch keepalive
// ✅ flush on pagehide/visibilitychange/beforeunload
'use strict';

function nowIso(){ return new Date().toISOString(); }

export function createHHALogger(ctx = {}){
  const QS = (()=>{ try{return new URL(location.href).searchParams;}catch{return new URLSearchParams();} })();
  const logUrl = QS.get('log') || ctx.log || '';

  const queue = [];
  let flushing = false;

  function canSend(){ return !!logUrl; }

  function push(row){
    if (!row) return;
    queue.push(row);
  }

  function payload(){
    return {
      v: 1,
      time_iso: nowIso(),
      ctx,
      rows: queue.splice(0, queue.length)
    };
  }

  async function flush(reason='flush'){
    if (flushing) return;
    if (!canSend()) return;
    if (!queue.length) return;
    flushing = true;

    const body = JSON.stringify({ reason, ...payload() });

    try{
      // prefer beacon
      if (navigator.sendBeacon){
        const ok = navigator.sendBeacon(logUrl, new Blob([body], {type:'application/json'}));
        if (ok){ flushing = false; return; }
      }
    }catch{}

    try{
      await fetch(logUrl, {
        method:'POST',
        headers:{'content-type':'application/json'},
        body,
        keepalive:true,
        mode:'cors'
      });
    }catch(e){
      // ถ้าส่งไม่สำเร็จ—ไม่ throw เพื่อไม่ทำให้เกมค้าง
      console.warn('HHA_LOG flush failed:', e);
    }finally{
      flushing = false;
    }
  }

  function bindFlush(){
    const doFlush = ()=>flush('auto');
    window.addEventListener('pagehide', doFlush, {passive:true});
    window.addEventListener('beforeunload', doFlush, {passive:true});
    document.addEventListener('visibilitychange', ()=>{
      if (document.visibilityState === 'hidden') doFlush();
    }, {passive:true});
  }

  bindFlush();

  return { push, flush, canSend };
}