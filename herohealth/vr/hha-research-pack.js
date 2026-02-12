// === /herohealth/vr/hha-research-pack.js ===
// HHA Research Pack — v20260211d (ADD schoolName + deviceType)
(function(){
  'use strict';
  const WIN = window, DOC = document;
  if(!DOC) return;

  function qs(k, d=''){
    try{ return new URL(location.href).searchParams.get(k) ?? d; }
    catch{ return d; }
  }
  function emit(name, detail){
    try{ WIN.dispatchEvent(new CustomEvent(name, { detail })); }catch(e){}
  }
  function csvEscape(v){
    const s = String(v ?? '');
    if(/[",\n]/.test(s)) return '"' + s.replace(/"/g,'""') + '"';
    return s;
  }

  const P = WIN.HHA_PLANNER || null;

  function detectDeviceType(){
    const view = String(P?.view ?? qs('view','')).toLowerCase();
    if(view === 'cvr' || qs('view','').toLowerCase()==='cvr') return 'cvr';
    if(view === 'vr'  || qs('view','').toLowerCase()==='vr')  return 'vr';
    const ua = navigator.userAgent || '';
    const isMobile = /Android|iPhone|iPad|iPod/i.test(ua);
    return isMobile ? 'mobile' : 'pc';
  }

  const ctx = {
    pid: (P?.pid ?? qs('pid','')) || '',
    studyId: (P?.studyId ?? qs('studyId','')) || '',
    phase: (P?.phase ?? qs('phase','')) || '',
    conditionGroup: (P?.conditionGroup ?? qs('conditionGroup','')) || '',
    mode: ((P?.mode ?? qs('mode','play')) || 'play').toLowerCase(),
    seed: (Number(P?.seed ?? qs('seed','0')) >>> 0),
    view: (P?.view ?? qs('view','')) || '',
    log: (P?.log ?? qs('log','')) || '',
    fromPlanner: !!(P?.from || (qs('from','').toLowerCase()==='planner')),
    combo: Array.isArray(P?.combo) ? P.combo.slice() : (qs('combo','') ? qs('combo','').split('|').filter(Boolean) : []),

    siteCode: (P?.siteCode ?? qs('siteCode','')) || '',
    classRoom: (P?.classRoom ?? qs('classRoom','')) || '',
    teacherId: (P?.teacherId ?? qs('teacherId','')) || '',
    schoolName: (P?.schoolName ?? qs('schoolName','')) || '',

    deviceType: detectDeviceType(), // NEW
  };
  const IS_RESEARCH = (ctx.mode === 'research' || ctx.mode === 'study');

  const SID = `HHA_${Date.now()}_${Math.floor((ctx.seed>>>0)%1e6)}`;

  function normCond(s){ return String(s||'').trim().toUpperCase(); }
  function getResearchPreset(gameId){
    const c = normCond(ctx.conditionGroup);
    const base = (c === 'A') ? { level:'easy',   targetScale: 1.12, lockPx: 44, ttlMul: 1.15, speedMul: 0.92 }
               : (c === 'B') ? { level:'normal', targetScale: 1.00, lockPx: 32, ttlMul: 1.00, speedMul: 1.00 }
               : (c === 'C') ? { level:'hard',   targetScale: 0.90, lockPx: 24, ttlMul: 0.90, speedMul: 1.08 }
               : (c === 'D') ? { level:'hard+',  targetScale: 0.86, lockPx: 20, ttlMul: 0.85, speedMul: 1.15 }
               :              { level:'normal', targetScale: 1.00, lockPx: 32, ttlMul: 1.00, speedMul: 1.00 };

    const tweak = (gameId === 'balance')
      ? { lockPx: Math.round(base.lockPx * 1.6), ttlMul: base.ttlMul * 1.10 }
      : (gameId === 'jumpduck')
      ? { ttlMul: base.ttlMul * 1.05 }
      : {};
    return Object.assign({}, base, tweak);
  }

  const EVENTS_STORE = 'HHA_FITNESS_EVENTS_LOG_V1';
  const EVENTS_CAP = 20000;

  function appendLocalEvent(row){
    try{
      const arr = JSON.parse(localStorage.getItem(EVENTS_STORE) || '[]');
      const next = Array.isArray(arr) ? arr : [];
      next.push(row);
      const trimmed = (next.length > EVENTS_CAP) ? next.slice(next.length - EVENTS_CAP) : next;
      localStorage.setItem(EVENTS_STORE, JSON.stringify(trimmed));
    }catch(_){}
  }

  const EVENTS = [];

  function ev(type, data){
    const row = {
      ts: Date.now(),
      sid: SID,
      pid: ctx.pid,
      studyId: ctx.studyId,
      phase: ctx.phase,
      conditionGroup: ctx.conditionGroup,

      schoolName: ctx.schoolName,
      siteCode: ctx.siteCode,
      classRoom: ctx.classRoom,
      teacherId: ctx.teacherId,
      deviceType: ctx.deviceType,

      game: '',
      mode: IS_RESEARCH ? 'research' : 'play',
      view: ctx.view,
      seed: ctx.seed>>>0,
      type,
      data: data || {}
    };
    EVENTS.push(row);
    appendLocalEvent(row);
    emit('hha:event', { sid: SID, ...row });
  }

  function eventsCSV(rows){
    const header = [
      'ts','sid','pid','studyId','phase','conditionGroup',
      'schoolName','siteCode','classRoom','teacherId','deviceType',
      'game','mode','view','seed','type','data_json'
    ];
    const lines = [header.join(',')];
    for(const r of (rows || EVENTS)){
      const dataJson = JSON.stringify(r.data || {});
      const vals = [
        r.ts, r.sid, r.pid, r.studyId, r.phase, r.conditionGroup,
        r.schoolName||'', r.siteCode||'', r.classRoom||'', r.teacherId||'', r.deviceType||'',
        r.game, r.mode, r.view, r.seed, r.type, dataJson
      ].map(csvEscape);
      lines.push(vals.join(','));
    }
    return lines.join('\n');
  }

  WIN.HHA_RP = { SID, ctx, IS_RESEARCH, getResearchPreset, ev, EVENTS, eventsCSV, EVENTS_STORE };

  ev('rp_ready', { fromPlanner: ctx.fromPlanner, combo: ctx.combo });
})();