// === /herohealth/vr-groups/flush-log.js ===
// GroupsVR Logger Glue — PRODUCTION (HHA Standard-ish)
// ✅ Uses window.HHA_LOGGER from ../vr/hha-cloud-logger.js if available
// ✅ Sends session summary on hha:end
// ✅ Optional event stream (events=1 OR run=research)
// ✅ Flush-hardened: pagehide/visibilitychange/beforeunload

(function(){
  'use strict';
  const WIN = window;
  const DOC = document;

  const NS = WIN.GroupsVR = WIN.GroupsVR || {};

  function qs(k, def=null){
    try{ return new URL(location.href).searchParams.get(k) ?? def; }catch{ return def; }
  }
  function boolQ(k, def=false){
    const v = String(qs(k, def ? '1' : '0') || '');
    return (v==='1' || v==='true' || v==='yes');
  }

  const runMode = String(qs('run','play')||'play').toLowerCase();
  const eventsOn = boolQ('events', false) || (runMode === 'research');

  function ctx(){
    try{
      const get = NS.getResearchCtx;
      return (typeof get === 'function') ? (get() || {}) : {};
    }catch{ return {}; }
  }

  function base(){
    return Object.assign({
      projectTag: 'HeroHealth',
      gameTag: 'GroupsVR',
      runMode: runMode,
      diff: String(qs('diff','normal')||'normal'),
      style: String(qs('style','mix')||'mix'),
      view: String(qs('view','mobile')||'mobile'),
      seed: String(qs('seed','')||''),
      studyId: String(qs('studyId','')||''),
      conditionGroup: String(qs('cond','')||''),
      sessionOrder: String(qs('order','')||''),
      siteCode: String(qs('site','')||''),
      schoolCode: String(qs('schoolCode','')||''),
      schoolName: String(qs('schoolName','')||''),
      classRoom: String(qs('classRoom','')||''),
      studentKey: String(qs('studentKey','')||''),
    }, ctx());
  }

  // -------- HHA_LOGGER adaptor --------
  function getLogger(){
    // hha-cloud-logger.js อาจ expose เป็น WIN.HHA_LOGGER หรือ WIN.GAME_MODULES.HHA_LOGGER
    return WIN.HHA_LOGGER || (WIN.GAME_MODULES && WIN.GAME_MODULES.HHA_LOGGER) || null;
  }

  NS.postSummary = function(summary){
    const L = getLogger();
    if (!L || !L.enqueue) return false;
    try{
      // ส่งเป็น session record
      L.enqueue({ type:'session', payload: summary });
      return true;
    }catch{ return false; }
  };

  NS.postEvent = function(evt){
    if (!eventsOn) return false;
    const L = getLogger();
    if (!L || !L.enqueue) return false;
    try{
      L.enqueue({ type:'event', payload: evt });
      return true;
    }catch{ return false; }
  };

  // flush-hardened binding
  NS.bindFlushOnLeave = function(getLastSummary){
    const L = getLogger();
    if (!L) return;
    function flush(reason){
      try{
        // เผื่อ summary ล่าสุดยังไม่ส่ง
        const last = (typeof getLastSummary === 'function') ? getLastSummary() : null;
        if (last) NS.postSummary(last);

        if (L.flush) L.flush(reason || 'leave');
      }catch{}
    }
    WIN.addEventListener('pagehide', ()=>flush('pagehide'), {passive:true});
    DOC.addEventListener('visibilitychange', ()=>{
      if (DOC.visibilityState === 'hidden') flush('hidden');
    }, {passive:true});
    WIN.addEventListener('beforeunload', ()=>flush('beforeunload'), {passive:true});
  };

  // -------- Event taps (optional) --------
  function stamp(){
    return { timestampMs: Date.now(), timestampIso: new Date().toISOString() };
  }
  function post(name, detail){
    const evt = Object.assign(base(), stamp(), { eventName: name }, detail || {});
    NS.postEvent(evt);
  }

  // ส่ง “บางอย่างที่มีประโยชน์จริง” ไม่ถี่เกิน
  if (eventsOn){
    WIN.addEventListener('hha:judge', (ev)=>{
      const d = ev.detail || {};
      post('hha:judge', {
        kind: d.kind || '',
        text: d.text || '',
        x: d.x ?? null,
        y: d.y ?? null
      });
    }, {passive:true});

    WIN.addEventListener('quest:update', (ev)=>{
      const d = ev.detail || {};
      post('quest:update', {
        goalNow: d.goalNow ?? null,
        goalTotal: d.goalTotal ?? null,
        miniNow: d.miniNow ?? null,
        miniTotal: d.miniTotal ?? null,
        miniTimeLeftSec: d.miniTimeLeftSec ?? null,
        groupKey: d.groupKey ?? '',
        groupName: d.groupName ?? ''
      });
    }, {passive:true});

    WIN.addEventListener('groups:progress', (ev)=>{
      const d = ev.detail || {};
      post('groups:progress', d);
    }, {passive:true});
  }
})();