/*
  CSAI2102 AI Quest
  v2.1b.1 — Gameplay Run Mode / Save Status Runtime
  ------------------------------------------------------------
  Restores the runtime expected by the student engine. Practice mode stays
  separate from graded evidence; it never replaces a graded session result.
*/
(function(){
  'use strict';

  const VERSION = 'v2.1b.1-gameplay-lockdown-runtime';
  const KEY = 'CSAI2102_AIQUEST_RUN_MODE_V21B';
  const ALLOWED = new Set(['graded','practice','challenge']);

  function read(){
    try{
      const stored = JSON.parse(localStorage.getItem(KEY) || '{}');
      return stored && typeof stored === 'object' ? stored : {};
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

  function getRunMode(){
    const value = String(read().runMode || 'graded').toLowerCase();
    return ALLOWED.has(value) ? value : 'graded';
  }

  function setRunMode(mode){
    const normalized = String(mode || 'graded').toLowerCase();
    const runMode = ALLOWED.has(normalized) ? normalized : 'graded';
    const value = read();
    value.runMode = runMode;
    value.updatedAt = new Date().toISOString();
    write(value);
    return runMode;
  }

  function getRunModeInfo(){
    const runMode = getRunMode();
    const info = {
      graded:{label:'GRADED', thai:'ประเมินผล', countsForProgress:true},
      practice:{label:'PRACTICE', thai:'ฝึกฝน', countsForProgress:false},
      challenge:{label:'CHALLENGE', thai:'ท้าทาย', countsForProgress:true}
    }[runMode];
    return Object.assign({runMode}, info);
  }

  function setSaveStatus(status, attemptId, extra){
    const value = read();
    value.saveStatus = {
      status:String(status || 'idle'),
      attemptId:String(attemptId || ''),
      extra:extra || {},
      updatedAt:new Date().toISOString()
    };
    write(value);
    const box = document.getElementById('saveStatusBox');
    if(box){
      const label = value.saveStatus.status === 'saved' ? 'บันทึกแล้ว' : value.saveStatus.status === 'failed' ? 'รอซิงก์อีกครั้ง' : 'กำลังบันทึก';
      box.textContent = 'Save Status: ' + label;
    }
    return value.saveStatus;
  }

  function getSaveStatus(){
    return read().saveStatus || {status:'idle', attemptId:'', extra:{}};
  }

  window.AIQuestGameplayLockdown = {
    VERSION,
    getRunMode,
    setRunMode,
    getRunModeInfo,
    setSaveStatus,
    getSaveStatus
  };

  console.log('[AIQuest] ' + VERSION + ' loaded');
})();
