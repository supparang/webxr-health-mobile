/*
  CSAI2102 AI Quest
  v2.1c.1 — Classroom Entry Runtime
  ------------------------------------------------------------
  Restores course/session context used by the data contract. It locks this
  deployment to CSAI2102 / 1-2569 / Section 101 and does not override profile
  identity or graded mission progress.
*/
(function(){
  'use strict';

  const VERSION = 'v2.1c.1-classroom-entry-runtime';
  const KEY = 'CSAI2102_AIQUEST_CLASSROOM_ENTRY_V21C';
  const COURSE_ID = 'CSAI2102';
  const TERM = '1/2569';
  const CLASS_ID = 'CSAI2102-2569-101';
  const SECTION = '101';
  const VALID_SESSIONS = new Set(['s1','s2','s3','b1','s4','s5','s6','b2']);

  function read(){
    try{
      const value = JSON.parse(localStorage.getItem(KEY) || '{}');
      return value && typeof value === 'object' ? value : {};
    }catch(error){
      return {};
    }
  }

  function write(value){
    try{
      localStorage.setItem(KEY, JSON.stringify(value || {}));
      return true;
    }catch(error){
      return false;
    }
  }

  function normalize(input){
    const current = input || {};
    const requested = String(current.sessionId || current.activeSession || 's1').toLowerCase();
    return {
      courseId:COURSE_ID,
      term:TERM,
      classId:CLASS_ID,
      section:SECTION,
      teacherId:String(current.teacherId || 'supparang'),
      sessionId:VALID_SESSIONS.has(requested) ? requested : 's1',
      mode:['graded','practice','challenge'].includes(String(current.mode || '').toLowerCase())
        ? String(current.mode).toLowerCase()
        : 'graded',
      entryConfirmed:current.entryConfirmed === true,
      updatedAt:current.updatedAt || new Date().toISOString()
    };
  }

  function getClassroom(){
    return normalize(read());
  }

  function setClassroom(input){
    const current = getClassroom();
    const next = normalize(Object.assign({}, current, input || {}, {updatedAt:new Date().toISOString()}));
    write(next);
    return next;
  }

  function confirmEntry(input){
    return setClassroom(Object.assign({}, input || {}, {entryConfirmed:true}));
  }

  function isEntryConfirmed(){
    return !!getClassroom().entryConfirmed;
  }

  function inferSession(){
    try{
      const mission = window.currentMission && window.currentMission.id;
      if(VALID_SESSIONS.has(mission)) return mission;
    }catch(error){}
    const query = new URLSearchParams(location.search);
    const requested = String(query.get('session') || '').toLowerCase();
    return VALID_SESSIONS.has(requested) ? requested : getClassroom().sessionId;
  }

  function attachProfileConfirmation(){
    const button = document.getElementById('btnSaveProfile');
    if(!button || button.__aiquestEntryV21c) return;
    button.__aiquestEntryV21c = true;
    button.addEventListener('click', function(){
      setTimeout(() => confirmEntry({sessionId:inferSession()}), 0);
    });
  }

  function boot(){
    const initial = getClassroom();
    if(!localStorage.getItem(KEY)) write(initial);
    attachProfileConfirmation();
    [250,800].forEach(ms => setTimeout(attachProfileConfirmation, ms));

    window.AIQuestClassroomEntry = {
      VERSION,
      COURSE_ID,
      TERM,
      CLASS_ID,
      SECTION,
      getClassroom,
      setClassroom,
      confirmEntry,
      isEntryConfirmed,
      inferSession
    };

    console.log('[AIQuest] ' + VERSION + ' loaded');
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
