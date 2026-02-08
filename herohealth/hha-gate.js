<!-- === /herohealth/hha-gate.js ===
HHA Gate — zone/day warmup gate (per pid)
✅ requireWarmup({ zoneId, warmupHref, targetHref, autoStart })
✅ Mark done per day/zone: HHA_GATE_DONE::<pid>::<zone>::<YYYY-MM-DD>
✅ Pass-through pid/run/diff/time/seed/studyId/phase/conditionGroup/log/view + hub
-->
<script>
(function(){
  'use strict';

  const WIN = window;
  if (WIN.HHA_GATE) return;

  const TZ = 'Asia/Bangkok';
  const PASS_KEYS = ['pid','run','diff','time','seed','studyId','phase','conditionGroup','log','view','hub'];

  function pageUrl(){ return location.href.split('#')[0]; }
  function qs(k, def=null){
    try{
      const v = new URL(pageUrl()).searchParams.get(k);
      return (v==null || String(v).trim()==='') ? def : v;
    }catch{ return def; }
  }

  function getTodayKey(){
    // YYYY-MM-DD in Bangkok
    try{
      const d = new Date();
      const s = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year:'numeric', month:'2-digit', day:'2-digit' }).format(d);
      return s; // en-CA gives 2026-02-08
    }catch(_){
      // fallback local date
      const d = new Date();
      const y = d.getFullYear();
      const m = String(d.getMonth()+1).padStart(2,'0');
      const da= String(d.getDate()).padStart(2,'0');
      return `${y}-${m}-${da}`;
    }
  }

  function readPid(){
    // Prefer pid in URL; fallback to ctx if you have HHA_CTX
    const p = qs('pid', null);
    if (p) return p;
    try{
      if (WIN.HHA_CTX && typeof WIN.HHA_CTX.readCtx === 'function'){
        const ctx = WIN.HHA_CTX.readCtx() || {};
        if (ctx.pid) return ctx.pid;
      }
    }catch(_){}
    return 'ANON';
  }

  function doneKey(pid, zoneId){
    const day = getTodayKey();
    return `HHA_GATE_DONE::${pid}::${zoneId}::${day}`;
  }

  function isDone(pid, zoneId){
    try{ return localStorage.getItem(doneKey(pid, zoneId)) === '1'; }
    catch{ return false; }
  }

  function markDone(pid, zoneId){
    try{ localStorage.setItem(doneKey(pid, zoneId), '1'); }catch(_){}
  }

  function buildWarmupUrl(warmupHref, zoneId, targetHref){
    const u = new URL(warmupHref, location.href);
    // zone
    if (!u.searchParams.has('zone')) u.searchParams.set('zone', zoneId);

    // target = "เกมที่ผู้เล่นเลือก"
    if (targetHref){
      const t = new URL(targetHref, location.href);
      // เติม hub ให้ target ถ้ายังไม่มี (ไม่ override)
      if (!t.searchParams.has('hub') || String(t.searchParams.get('hub')||'').trim()===''){
        const hub = qs('hub', null) || new URL('./hub.html', location.href).toString();
        t.searchParams.set('hub', hub);
      }
      u.searchParams.set('target', t.toString());
    }

    // pass-through (อย่า override ที่ warmup มีอยู่แล้ว)
    const cur = new URL(pageUrl()).searchParams;
    PASS_KEYS.forEach(k=>{
      if (!u.searchParams.has(k) && cur.has(k)){
        const v = cur.get(k);
        if (v!=null && String(v).trim()!=='') u.searchParams.set(k, v);
      }
    });

    // ensure hub exists on warmup
    if (!u.searchParams.has('hub') || String(u.searchParams.get('hub')||'').trim()===''){
      u.searchParams.set('hub', qs('hub', null) || new URL('./hub.html', location.href).toString());
    }

    return u.toString();
  }

  function requireWarmup(opts){
    const zoneId = String(opts?.zoneId || '').trim();
    const warmupHref = String(opts?.warmupHref || './quest-gate.html').trim();
    const targetHref = String(opts?.targetHref || '').trim();
    const autoStart = (opts?.autoStart !== false);

    if (!zoneId){
      console.warn('[HHA_GATE] missing zoneId');
      return { status:'error', reason:'missing zoneId' };
    }

    const pid = readPid();

    if (isDone(pid, zoneId)){
      return { status:'skip', pid, zoneId };
    }

    const url = buildWarmupUrl(warmupHref, zoneId, targetHref);

    if (autoStart){
      location.replace(url);
      return { status:'redirect', url, pid, zoneId };
    }
    return { status:'need', url, pid, zoneId };
  }

  WIN.HHA_GATE = {
    getTodayKey,
    readPid,
    isDone,
    markDone,
    requireWarmup
  };
})();
</script>
