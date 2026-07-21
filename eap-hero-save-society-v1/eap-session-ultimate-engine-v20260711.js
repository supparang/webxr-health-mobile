/* =========================================================
   EAP Hero Session Ultimate Engine v20260711
   Phase A1 — Core Session Contract Foundation
   - Covers S1-S15 normal sessions only. Boss B1-B5 remain on Boss Engine V5.
   - First play 8 tasks, replay 11 tasks, elite replay 13 tasks.
   - Provides Brief -> Challenge -> Pressure -> Mini Rescue -> Reflection plan.
   - Tracks per-session run count, adaptive CEFR band, combo, hint/retry signals,
     and no-repeat history contracts for source/item/prompt/cue selection.
   - Exposes a stable API for Phase A2 multi-task execution and Phase B content bank.
   - Does NOT alter scores, pass/fail, Sheet sync, evidence, teacher review, or unlock.
========================================================= */
(function(){
  'use strict';

  var VERSION = 'v20260711-EAP-SESSION-ULTIMATE-ENGINE-A1';
  var STATE_KEY = 'EAP_SESSION_ULTIMATE_STATE_V1';
  var CURRENT_KEY = 'EAP_SESSION_ULTIMATE_CURRENT_V1';
  var STYLE_ID = 'eap-session-ultimate-engine-style-v1';
  var timer = null;

  var SESSION_SKILLS = {
    S1:['Reading','Speaking'], S2:['Reading','Writing'], S3:['Reading','Writing'],
    S4:['Reading','Listening'], S5:['Reading','Speaking'], S6:['Writing','Reading'],
    S7:['Writing','Speaking'], S8:['Reading','Writing'], S9:['Writing','Speaking'],
    S10:['Reading','Writing'], S11:['Writing','Speaking'], S12:['Reading','Writing'],
    S13:['Listening','Writing'], S14:['Speaking','Writing'], S15:['Writing','Speaking']
  };

  var MODE = {
    first:{key:'first',label:'First Mission',tasks:8,core:[3,3],exposure:1,reflection:1},
    replay:{key:'replay',label:'Replay Remix',tasks:11,core:[4,4],exposure:2,reflection:1},
    elite:{key:'elite',label:'Elite Remix',tasks:13,core:[5,5],exposure:2,reflection:1}
  };

  function now(){ return new Date().toISOString(); }
  function text(v){ return String(v == null ? '' : v).replace(/\s+/g,' ').trim(); }
  function clone(v){ return JSON.parse(JSON.stringify(v)); }
  function read(){
    try { return JSON.parse(localStorage.getItem(STATE_KEY) || '{}'); }
    catch(_){ return {}; }
  }
  function write(state){
    try { localStorage.setItem(STATE_KEY, JSON.stringify(state || {})); } catch(_) {}
    return state || {};
  }
  function sessionId(v){
    var m = String(v == null ? '' : v).toUpperCase().match(/S?(1[0-5]|[1-9])/);
    return m ? 'S' + Number(m[1]) : '';
  }
  function modeFor(runCount){ return runCount <= 1 ? MODE.first : runCount === 2 ? MODE.replay : MODE.elite; }
  function skillsFor(sid){ return (SESSION_SKILLS[sid] || ['Reading','Writing']).slice(); }

  function defaultSession(){
    return {
      runs:0, accuracySamples:[], responseMsSamples:[], hints:0, retries:0,
      bestCombo:0, lastCombo:0, weakSkills:{}, histories:{source:[],item:[],prompt:[],cue:[]},
      lastRun:null, updatedAt:''
    };
  }
  function ensureSession(state,sid){
    state.sessions = state.sessions || {};
    state.sessions[sid] = Object.assign(defaultSession(), state.sessions[sid] || {});
    state.sessions[sid].histories = Object.assign(defaultSession().histories, state.sessions[sid].histories || {});
    return state.sessions[sid];
  }

  function average(list){
    var valid = (list || []).map(Number).filter(function(n){ return Number.isFinite(n); });
    if(!valid.length) return 0;
    return valid.reduce(function(a,b){ return a+b; },0) / valid.length;
  }
  function adaptiveLevel(record){
    var acc = average((record.accuracySamples || []).slice(-12));
    var speed = average((record.responseMsSamples || []).slice(-12));
    var pressure = Number(record.hints || 0) + Number(record.retries || 0);
    if(acc >= 88 && (!speed || speed <= 18000) && pressure <= 3) return 'B1+';
    if(acc >= 75 && pressure <= 7) return 'B1';
    if(acc >= 60) return 'A2+';
    return 'A2';
  }

  function buildPlan(sid, runCount){
    var mode = modeFor(runCount);
    var skills = skillsFor(sid);
    var plan = [];
    var index = 1;
    function add(stage,skill,role,count,pressure){
      for(var i=0;i<count;i++){
        plan.push({
          taskNo:index++, stage:stage, skill:skill, role:role,
          pressure:!!pressure, required:role === 'core',
          taskId:sid + '-' + mode.key + '-' + stage.toLowerCase().replace(/\s+/g,'-') + '-' + skill.toLowerCase() + '-' + (i+1)
        });
      }
    }
    add('Brief', skills[0], 'core', 1, false);
    add('Challenge', skills[0], 'core', Math.max(1, mode.core[0]-1), false);
    add('Challenge', skills[1], 'core', Math.max(1, mode.core[1]-1), false);
    add('Pressure Round', skills[1], 'core', 1, true);
    add('Mini Rescue', exposureSkill(skills), 'exposure', mode.exposure, true);
    add('Reflection', 'Reflection', 'reflection', mode.reflection, false);
    return plan.slice(0, mode.tasks);
  }
  function exposureSkill(core){
    var all = ['Reading','Listening','Writing','Speaking'];
    return all.find(function(s){ return core.indexOf(s) < 0; }) || 'Listening';
  }

  function beginRun(rawSid, options){
    var sid = sessionId(rawSid);
    if(!sid || !SESSION_SKILLS[sid]) return null;
    options = options || {};
    var state = read();
    var record = ensureSession(state,sid);
    var forceNew = options.forceNew === true;
    var active = record.lastRun;
    if(!forceNew && active && active.status === 'active') return clone(active);

    record.runs = Number(record.runs || 0) + 1;
    var mode = modeFor(record.runs);
    var run = {
      engineVersion:VERSION, runId:sid + '-run-' + record.runs + '-' + Date.now(),
      sessionId:sid, runNo:record.runs, mode:mode.key, modeLabel:mode.label,
      taskCount:mode.tasks, coreSkills:skillsFor(sid), adaptiveLevel:adaptiveLevel(record),
      plan:buildPlan(sid,record.runs), completedTaskIds:[], combo:0, bestCombo:0,
      startedAt:now(), updatedAt:now(), status:'active'
    };
    record.lastRun = run;
    record.updatedAt = now();
    state.version = VERSION;
    write(state);
    try { localStorage.setItem(CURRENT_KEY, JSON.stringify(run)); } catch(_) {}
    window.dispatchEvent(new CustomEvent('eap:session-ultimate-run-start',{detail:clone(run)}));
    return clone(run);
  }

  function current(rawSid){
    var sid = sessionId(rawSid);
    var state = read();
    var rec = sid && state.sessions && state.sessions[sid];
    return rec && rec.lastRun ? clone(rec.lastRun) : null;
  }

  function recordSignal(rawSid, signal){
    var sid = sessionId(rawSid);
    if(!sid) return null;
    signal = signal || {};
    var state = read();
    var rec = ensureSession(state,sid);
    if(Number.isFinite(Number(signal.accuracy))) rec.accuracySamples.push(Number(signal.accuracy));
    if(Number.isFinite(Number(signal.responseMs))) rec.responseMsSamples.push(Number(signal.responseMs));
    if(signal.hintUsed) rec.hints = Number(rec.hints || 0) + 1;
    if(signal.retry) rec.retries = Number(rec.retries || 0) + 1;
    if(signal.correct === true) rec.lastCombo = Number(rec.lastCombo || 0) + 1;
    if(signal.correct === false) rec.lastCombo = 0;
    rec.bestCombo = Math.max(Number(rec.bestCombo || 0), Number(rec.lastCombo || 0));
    rec.accuracySamples = rec.accuracySamples.slice(-30);
    rec.responseMsSamples = rec.responseMsSamples.slice(-30);
    rec.updatedAt = now();
    write(state);
    return {adaptiveLevel:adaptiveLevel(rec),combo:rec.lastCombo,bestCombo:rec.bestCombo};
  }

  function remember(rawSid,type,id,windowSize){
    var sid = sessionId(rawSid);
    if(!sid || !id) return false;
    var state = read();
    var rec = ensureSession(state,sid);
    var key = ['source','item','prompt','cue'].indexOf(type) >= 0 ? type : 'item';
    var limit = Number(windowSize || ({source:6,item:24,prompt:12,cue:12}[key]));
    var list = (rec.histories[key] || []).filter(function(x){ return x !== id; });
    list.push(id);
    rec.histories[key] = list.slice(-limit);
    rec.updatedAt = now();
    write(state);
    return true;
  }

  function chooseFresh(rawSid,type,pool,getId){
    var sid = sessionId(rawSid);
    var list = Array.isArray(pool) ? pool.slice() : [];
    if(!sid || !list.length) return null;
    getId = typeof getId === 'function' ? getId : function(x){ return x && (x.id || x.itemId || x.tag) || String(x); };
    var state = read();
    var rec = ensureSession(state,sid);
    var history = rec.histories[type] || [];
    var fresh = list.filter(function(item){ return history.indexOf(String(getId(item))) < 0; });
    var candidates = fresh.length ? fresh : list;
    var picked = candidates[Math.floor(Math.random()*candidates.length)];
    remember(sid,type,String(getId(picked)));
    return picked;
  }

  function completeTask(rawSid,taskId,signal){
    var sid = sessionId(rawSid);
    if(!sid || !taskId) return null;
    var state = read();
    var rec = ensureSession(state,sid);
    var run = rec.lastRun;
    if(!run || run.status !== 'active') run = beginRun(sid,{forceNew:true});
    state = read(); rec = ensureSession(state,sid); run = rec.lastRun;
    if(run.completedTaskIds.indexOf(taskId) < 0) run.completedTaskIds.push(taskId);
    if(signal && signal.correct === true){ run.combo = Number(run.combo || 0)+1; run.bestCombo = Math.max(run.bestCombo,run.combo); }
    if(signal && signal.correct === false) run.combo = 0;
    run.updatedAt = now();
    if(run.completedTaskIds.length >= run.taskCount){ run.status='complete'; run.completedAt=now(); }
    rec.lastRun = run; rec.updatedAt=now(); write(state);
    window.dispatchEvent(new CustomEvent('eap:session-ultimate-task',{detail:{sessionId:sid,taskId:taskId,run:clone(run)}}));
    return clone(run);
  }

  function addStyle(){
    if(document.getElementById(STYLE_ID)) return;
    var s=document.createElement('style'); s.id=STYLE_ID;
    s.textContent='.eap-ultimate-run-chip{display:flex;gap:7px;flex-wrap:wrap;align-items:center;margin:8px 0 12px;padding:9px 11px;border:1px solid rgba(14,165,233,.25);border-radius:12px;background:rgba(240,249,255,.82);font:800 12px/1.25 system-ui,-apple-system,"Segoe UI",sans-serif;color:#075985}.eap-ultimate-run-chip span{padding:4px 8px;border-radius:999px;background:#fff;border:1px solid #dbeafe}';
    document.head.appendChild(s);
  }
  function inferSessionFromPage(){
    var t=text(document.getElementById('app') && document.getElementById('app').innerText || '');
    var m=t.match(/(?:Session\s*|Week\s*|\bS)(1[0-5]|[1-9])\b/i);
    return m ? 'S'+Number(m[1]) : '';
  }
  function decorate(){
    addStyle();
    var app=document.getElementById('app'); if(!app) return;
    var sid=inferSessionFromPage(); if(!sid || /Boss Gate|Boss Battle/i.test(text(app.innerText))) return;
    var run=current(sid); if(!run) return;
    var host=app.querySelector('.session-path-panel,.panel,main section,section'); if(!host) return;
    var chip=host.querySelector('.eap-ultimate-run-chip');
    var html='<span>🎯 '+run.modeLabel+'</span><span>'+run.taskCount+' tasks</span><span>'+run.adaptiveLevel+'</span><span>'+run.coreSkills.join(' + ')+'</span>';
    if(!chip){ chip=document.createElement('div'); chip.className='eap-ultimate-run-chip'; host.insertBefore(chip,host.firstChild); }
    chip.innerHTML=html;
  }
  function schedule(){ clearTimeout(timer); timer=setTimeout(decorate,90); }

  function patchOpenSkill(){
    if(!window.EAPHero || typeof window.EAPHero.openSkillMission !== 'function' || window.EAPHero.__ultimateSessionA1) return false;
    var original=window.EAPHero.openSkillMission;
    window.EAPHero.openSkillMission=function(rawSession,skill){
      var sid=sessionId(rawSession);
      if(sid) beginRun(sid,{forceNew:false});
      return original.apply(this,arguments);
    };
    window.EAPHero.__ultimateSessionA1=true;
    return true;
  }

  window.EAPSessionUltimateEngine={
    version:VERSION, phase:'A1', sessionSkills:clone(SESSION_SKILLS), modes:clone(MODE),
    beginRun:beginRun, current:current, buildPlan:buildPlan, recordSignal:recordSignal,
    completeTask:completeTask, remember:remember, chooseFresh:chooseFresh,
    adaptiveLevel:function(sid){ var st=read(),rec=ensureSession(st,sessionId(sid)); return adaptiveLevel(rec); },
    state:function(){ return clone(read()); }
  };

  var wait=setInterval(function(){ if(patchOpenSkill()) clearInterval(wait); },100);
  window.addEventListener('load',schedule);
  window.addEventListener('eap:session-ultimate-run-start',schedule);
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true,characterData:true});
  schedule();
})();