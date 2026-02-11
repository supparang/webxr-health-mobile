// === /herohealth/fitness-planner/fp.safe.js ===
// FitnessPlanner SAFE Logger+Badges — v1.0.0 (HHA Standard)
// ✅ daily gate + badges + session/event logging
// ✅ does NOT require changing planner logic (optional hooks)
// Emits: hha:ready, hha:start, fp:change, fp:save, fp:badge, hha:end

(function(){
  'use strict';
  const WIN = window, DOC = document;

  // ---------- qs / ctx ----------
  function getQS(){ try{ return new URL(location.href).searchParams; } catch{ return new URLSearchParams(); } }
  const QS = getQS();
  const q = (k, def='') => (QS.get(k) ?? def);

  const CTX = WIN.HHA_CTX = WIN.HHA_CTX || {};
  CTX.projectTag = CTX.projectTag || 'HHA_FITNESSPLANNER';
  CTX.hub = CTX.hub || q('hub','');
  CTX.run = CTX.run || location.href;
  CTX.view = CTX.view || q('view','pc');
  CTX.diff = CTX.diff || q('diff','normal');
  CTX.mode = CTX.mode || q('mode','play');
  CTX.seed = CTX.seed || q('seed','');
  CTX.log = CTX.log || q('log','');

  CTX.studyId = CTX.studyId || q('studyId','');
  CTX.phase = CTX.phase || q('phase','');
  CTX.conditionGroup = CTX.conditionGroup || q('conditionGroup','');
  CTX.pid = CTX.pid || q('pid', q('studentKey',''));
  CTX.reason = CTX.reason || q('reason','');

  const DIFF = (String(CTX.diff||'normal').toLowerCase());
  const DIFF_KEY = (DIFF==='easy'||DIFF==='hard'||DIFF==='normal') ? DIFF : 'normal';
  const MODE = (String(CTX.mode||'play').toLowerCase());
  const RUN_MODE = (MODE==='research'||MODE==='practice'||MODE==='play') ? MODE : 'play';

  function getPid(){
    const pid = String(CTX.pid||'').trim();
    if(pid) return pid;
    try{
      const v = localStorage.getItem('HHA_PID') || localStorage.getItem('pid') || '';
      if(v) return String(v);
    }catch(_){}
    return 'anon';
  }
  const PID = getPid();

  function todayKey(){
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  const DAILY_KEY = `HHA_DAILY_FITNESSPLANNER_${PID}_${todayKey()}_${DIFF_KEY}`;
  function alreadyPlayedToday(){ try{ return localStorage.getItem(DAILY_KEY)==='1'; }catch(_){ return false; } }
  function markPlayedToday(){ try{ localStorage.setItem(DAILY_KEY,'1'); }catch(_){}
  }

  // ---------- badges storage ----------
  function badgeKey(pid){ return `HHA_BADGES_V1_${pid||'anon'}`; }
  function readBadges(pid){
    try{
      const raw = localStorage.getItem(badgeKey(pid));
      if(!raw) return {};
      const j = JSON.parse(raw);
      return (j && typeof j==='object') ? j : {};
    }catch(_){ return {}; }
  }
  function writeBadges(pid, obj){ try{ localStorage.setItem(badgeKey(pid), JSON.stringify(obj||{})); }catch(_){}
  }
  function awardBadge(pid, id, meta){
    const b = readBadges(pid);
    if(b[id]) return false;
    b[id] = Object.assign({ at: new Date().toISOString() }, meta||{});
    writeBadges(pid, b);
    return true;
  }

  // ---------- logger ----------
  const LOG_ENDPOINT = (CTX.log||'').trim();
  const LOGQ = [];
  let FLUSHING = false;

  function isoNow(){ return new Date().toISOString(); }
  function baseEvent(){
    return {
      timestampIso: isoNow(),
      projectTag: CTX.projectTag,
      runMode: RUN_MODE,
      studyId: CTX.studyId || '',
      phase: CTX.phase || '',
      conditionGroup: CTX.conditionGroup || '',
      sessionId: STATE.sessionId || '',
      device: (CTX.view||'pc'),
      view: (CTX.view||''),
      diff: DIFF_KEY,
      seed: String(CTX.seed||''),
      gameVersion: STATE.gameVersion,
      pid: PID,
    };
  }

  function pushEvent(eventType, data){
    LOGQ.push(Object.assign(baseEvent(), { eventType, game:'fitnessplanner', __data: data||{} }));
  }

  async function postJSON(url, payload){
    try{
      const blob = new Blob([JSON.stringify(payload)], {type:'application/json'});
      if(navigator.sendBeacon){
        const ok = navigator.sendBeacon(url, blob);
        if(ok) return true;
      }
    }catch(_){}
    try{
      await fetch(url, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload), keepalive:true });
      return true;
    }catch(_){ return false; }
  }

  async function flush(reason){
    if(!LOG_ENDPOINT) return;
    if(FLUSHING) return;
    if(!LOGQ.length) return;
    FLUSHING = true;
    const batch = LOGQ.splice(0, LOGQ.length);
    await postJSON(LOG_ENDPOINT, { reason: reason||'flush', batch });
    FLUSHING = false;
  }

  // ---------- state ----------
  const STATE = {
    gameVersion: 'fp.safe.js v1.0.0',
    sessionId: '',
    started: false,
    startIso: '',
    startT: 0,
    planHash: '',
    planSaveCount: 0,
    lastChangeIso: '',
    earnedBadges: [],
    dailyRepeat: alreadyPlayedToday(),
  };

  function newSessionId(){
    return `fp_${Date.now().toString(36)}_${Math.floor(Math.random()*1e9).toString(36)}`;
  }

  function safeHash(str){
    // lightweight non-crypto hash
    let h = 2166136261>>>0;
    for(let i=0;i<str.length;i++){
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619)>>>0;
    }
    return (h>>>0).toString(16);
  }

  function start(){
    if(STATE.started) return;
    STATE.started = true;
    STATE.sessionId = newSessionId();
    STATE.startIso = isoNow();
    STATE.startT = performance.now();

    pushEvent('hha:start', { hub: CTX.hub, run: CTX.run, dailyRepeat: STATE.dailyRepeat, dailyKey: DAILY_KEY });
  }

  function end(reason){
    if(!STATE.started) start();
    markPlayedToday();

    const dur = (performance.now() - STATE.startT)/1000;
    pushEvent('hha:end', {
      reason: reason || 'leave',
      durationPlayedSec: +dur.toFixed(2),
      planSaveCount: STATE.planSaveCount,
      planHash: STATE.planHash,
      earnedBadges: STATE.earnedBadges.slice(),
      dailyKey: DAILY_KEY
    });

    // save last summary
    try{
      localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify({
        projectTag: CTX.projectTag,
        sessionId: STATE.sessionId,
        endTimeIso: isoNow(),
        game: 'fitnessplanner',
        version: STATE.gameVersion,
        planSaveCount: STATE.planSaveCount,
        earnedBadges: STATE.earnedBadges,
        dailyKey: DAILY_KEY
      }));
    }catch(_){}

    flush('end');
  }

  function award(id, meta){
    const ok = awardBadge(PID, id, Object.assign({ sessionId: STATE.sessionId }, meta||{}));
    if(ok){
      STATE.earnedBadges.push(id);
      pushEvent('fp:badge', { badgeId:id, meta: meta||{} });
    }
    return ok;
  }

  // ---------- public API (planner calls these optionally) ----------
  // call on any form change: HHA_FP.onChange({field:'week1', value:'...'}) etc
  // call on save/submit: HHA_FP.onSave(planJson)
  WIN.HHA_FP = {
    start,
    end,
    flush,
    ctx: CTX,
    state: STATE,
    dailyKey: DAILY_KEY,
    isDailyRepeat: ()=>STATE.dailyRepeat,

    onChange(payload){
      if(!STATE.started) start();
      STATE.lastChangeIso = isoNow();
      pushEvent('fp:change', payload||{});
    },

    onSave(planObj){
      if(!STATE.started) start();
      STATE.planSaveCount += 1;

      let text = '';
      try{ text = JSON.stringify(planObj||{}); }catch(_){ text = String(planObj||''); }
      STATE.planHash = safeHash(text);

      pushEvent('fp:save', { planSaveCount: STATE.planSaveCount, planHash: STATE.planHash });

      // ---- badges logic (simple + measurable) ----
      // FP_FIRST_SAVE: save once
      award('FP_FIRST_SAVE', { planSaveCount: STATE.planSaveCount });

      // FP_WEEKLY_PLAN: if plan has 5+ sessions in a week (heuristic)
      let n = 0;
      try{
        const p = planObj||{};
        // count array-like sessions
        if(Array.isArray(p.sessions)) n = p.sessions.length;
        else if(p.week && Array.isArray(p.week.sessions)) n = p.week.sessions.length;
        else if(p.days && Array.isArray(p.days)) n = p.days.filter(Boolean).length;
      }catch(_){}
      if(n >= 5) award('FP_WEEKLY_PLAN', { nSessions:n });

      // FP_BALANCED: includes strength + cardio + flexibility (heuristic tags)
      try{
        const s = text.toLowerCase();
        const hasCardio = /cardio|run|walk|aerobic|jump|boxing|rhythm/.test(s);
        const hasStrength = /strength|weight|resistance|squat|push|plank/.test(s);
        const hasFlex = /stretch|flex|yoga|balance|mobility/.test(s);
        if(hasCardio && hasStrength && hasFlex){
          award('FP_BALANCED', { cardio:true, strength:true, flexibility:true });
        }
      }catch(_){}

      flush('save');
    }
  };

  // ---------- lifecycle ----------
  // Ready event
  pushEvent('hha:ready', { pid: PID, diff: DIFF_KEY, mode: RUN_MODE, dailyRepeat: STATE.dailyRepeat, dailyKey: DAILY_KEY });

  // Start on first interaction (gentle)
  DOC.addEventListener('pointerdown', ()=>start(), {once:true, passive:true});
  DOC.addEventListener('keydown', ()=>start(), {once:true, passive:true});

  // End + flush on leave
  WIN.addEventListener('pagehide', ()=>end('pagehide'), {capture:true});
  WIN.addEventListener('beforeunload', ()=>end('beforeunload'), {capture:true});
})();