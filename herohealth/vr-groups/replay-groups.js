/* === /herohealth/vr-groups/replay-groups.js ===
GroupsVR Replay Timeline (deterministic)
- record events: spawn, hit, expire, boss_move, storm_on/off, clutch_on/off
- store last timeline in localStorage: HHA_LAST_TIMELINE_GROUPS
- replay by: ?replay=1  (loads last timeline)
  or ?replay=1&tl=<base64json> (optional)
*/
(function(root){
  'use strict';
  root.GroupsVR = root.GroupsVR || {};

  const LS_TL = 'HHA_LAST_TIMELINE_GROUPS';

  function safeJsonParse(s, fb=null){ try{ return JSON.parse(s); }catch{ return fb; } }
  function b64ToStr(b64){
    try{ return decodeURIComponent(escape(atob(String(b64||'')))); }catch{ return ''; }
  }
  function strToB64(str){
    try{ return btoa(unescape(encodeURIComponent(String(str||'')))); }catch{ return ''; }
  }

  function makeRecorder(meta){
    meta = meta || {};
    const t0 = Date.now();
    const evs = [];
    function tms(){ return Date.now() - t0; }

    function push(type, data){
      evs.push({ t: tms(), type: String(type||'ev'), d: data||{} });
    }
    function exportJson(){
      return {
        v: 1,
        meta: Object.assign({ startedAtIso: new Date(t0).toISOString() }, meta),
        events: evs
      };
    }
    function saveToLocal(){
      const payload = exportJson();
      try{ localStorage.setItem(LS_TL, JSON.stringify(payload)); }catch{}
      return payload;
    }
    return { push, exportJson, saveToLocal };
  }

  function loadTimelineFromParams(){
    const u = new URL(location.href);
    const tl = u.searchParams.get('tl');
    if (tl){
      const s = b64ToStr(tl);
      const j = safeJsonParse(s, null);
      if (j && j.events) return j;
    }
    const j = safeJsonParse(localStorage.getItem(LS_TL)||'', null);
    if (j && j.events) return j;
    return null;
  }

  function makeReplayer(timeline){
    timeline = timeline || loadTimelineFromParams();
    const t0 = Date.now();
    let i = 0;
    let done = false;

    function reset(){ i=0; done=false; }
    function nowMs(){ return Date.now() - t0; }

    function nextDue(){
      if (!timeline || !timeline.events) return null;
      while (i < timeline.events.length){
        const e = timeline.events[i];
        if (e && typeof e.t === 'number') return e;
        i++;
      }
      return null;
    }

    // Call this frequently (e.g., every 30–50ms)
    function poll(onEvent){
      if (done) return;
      if (!timeline || !timeline.events){ done=true; return; }

      const t = nowMs();
      let guard = 0;

      while (guard++ < 50){
        const e = nextDue();
        if (!e){ done=true; break; }
        if (e.t > t) break;
        i++;
        if (onEvent) onEvent(e);
      }
    }

    function isDone(){ return done; }

    return { timeline, reset, poll, isDone };
  }

  root.GroupsVR.Replay = {
    LS_TL,
    strToB64,
    makeRecorder,
    loadTimelineFromParams,
    makeReplayer
  };

})(typeof window!=='undefined'?window:globalThis);