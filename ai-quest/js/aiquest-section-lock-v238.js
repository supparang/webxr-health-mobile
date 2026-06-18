/*
  CSAI2102 AI Quest
  PATCH v2.3.8 Section 101 Lock
  ------------------------------------------------------------
  ใช้ Section = 101 เท่านั้น
  classId = CSAI2102-2569-101
*/
(function(){
  'use strict';

  const VERSION = 'v2.3.8-section-101-lock';
  const COURSE_ID = 'CSAI2102';
  const TERM = '1/2569';
  const SECTION_LOCK = '101';
  const CLASS_ID_LOCK = 'CSAI2102-2569-101';

  function $(id){ return document.getElementById(id); }

  function patchDataContract(){
    if(!window.AIQuestDataContract || window.AIQuestDataContract.__section101Locked) return;

    const api = window.AIQuestDataContract;
    const oldLoad = api.loadConfig ? api.loadConfig.bind(api) : null;
    const oldSave = api.saveConfig ? api.saveConfig.bind(api) : null;

    function lockConfig(c){
      return Object.assign({}, c || {}, {
        courseId: COURSE_ID,
        term: (c && c.term) || TERM,
        classId: CLASS_ID_LOCK,
        section: SECTION_LOCK
      });
    }

    if(oldLoad){
      api.loadConfig = function(){
        return lockConfig(oldLoad());
      };
    }

    if(oldSave){
      api.saveConfig = function(config){
        return oldSave(lockConfig(config));
      };
    }

    try{
      if(oldSave && oldLoad){
        oldSave(lockConfig(oldLoad()));
      }
    }catch(error){}

    api.__section101Locked = true;
  }

  function patchStorage(){
    if(!window.AIQuestStorage || window.AIQuestStorage.__section101Locked) return;

    const api = window.AIQuestStorage;
    const oldGet = api.getProfile ? api.getProfile.bind(api) : null;
    const oldSave = api.saveProfile ? api.saveProfile.bind(api) : null;

    if(oldGet){
      api.getProfile = function(){
        return Object.assign({}, oldGet(), {section: SECTION_LOCK});
      };
    }

    if(oldSave){
      api.saveProfile = function(profile){
        return oldSave(Object.assign({}, profile || {}, {section: SECTION_LOCK}));
      };

      try{
        const p = oldGet ? oldGet() : {};
        oldSave(Object.assign({}, p, {section: SECTION_LOCK}));
      }catch(error){}
    }

    api.__section101Locked = true;
  }

  function patchInputs(){
    const sectionInput = $('sectionInput') || $('section');
    const classIdInput = $('classId');

    if(sectionInput){
      sectionInput.value = SECTION_LOCK;
      sectionInput.readOnly = true;
      sectionInput.setAttribute('data-section-lock', '101');
      sectionInput.title = 'ล็อก Section เป็น 101 เท่านั้น';
    }

    if(classIdInput){
      classIdInput.value = CLASS_ID_LOCK;
      classIdInput.readOnly = true;
      classIdInput.setAttribute('data-section-lock', '101');
      classIdInput.title = 'ล็อก Class ID ตาม Section 101';
    }

    const courseInput = $('courseId');
    if(courseInput) courseInput.value = COURSE_ID;

    const termInput = $('term');
    if(termInput && !termInput.value) termInput.value = TERM;
  }

  function patchConfigNow(){
    patchDataContract();
    patchStorage();
    patchInputs();
  }

  function boot(){
    patchConfigNow();
    setTimeout(patchConfigNow, 100);
    setTimeout(patchConfigNow, 500);
    setTimeout(patchConfigNow, 1200);

    const observer = new MutationObserver(patchInputs);
    observer.observe(document.body, {childList:true, subtree:true});

    window.AIQuestSectionLock = {
      VERSION,
      COURSE_ID,
      TERM,
      SECTION_LOCK,
      CLASS_ID_LOCK,
      patchConfigNow
    };

    console.log('[AIQuest] ' + VERSION + ' loaded: section=' + SECTION_LOCK);
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot);
  }else{
    boot();
  }
})();
