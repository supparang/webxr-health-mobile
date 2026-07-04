/* EAP Hero Writing Evidence Guard v1 */
(function(){
  'use strict';
  var syncPatched = false;
  var heroPatched = false;
  var STORE = 'EAP_HERO_PROGRESS_V3';

  function clean(v){ return String(v == null ? '' : v).replace(/\s+/g,' ').trim(); }
  function box(){ return document.getElementById('writingOutput'); }
  function pageText(){ return String((document.getElementById('app') || document.body).innerText || ''); }
  function currentSession(){
    var m = pageText().match(/(?:Session\s*|\bS)(1[0-5]|[1-9])\b/i);
    return Number(m && m[1] || 0);
  }
  function writingPage(){ return /Writing Mission/i.test(pageText()); }
  function promptLike(v){
    var s = clean(v).toLowerCase();
    return !s || /write its simple meaning|write one short academic sentence|choose one academic word from context|answer briefly in english|saved activity evidence/.test(s);
  }
  function acceptable(v){
    var value = clean(v);
    return value.split(/\s+/).filter(Boolean).length >= 4 && !promptLike(value);
  }
  function valid(){ return acceptable(box() && box().value); }
  function notice(){
    var old = document.getElementById('eapWritingGuardNotice');
    if(old) old.remove();
    var node = document.createElement('div');
    node.id = 'eapWritingGuardNotice';
    node.textContent = 'Write one short answer of your own before submitting. The instruction itself is not writing evidence.';
    node.style.cssText = 'position:fixed;z-index:100020;left:50%;bottom:22px;transform:translateX(-50%);padding:10px 14px;border-radius:12px;background:#8d2b10;color:#fff;font:700 14px system-ui';
    document.body.appendChild(node);
    setTimeout(function(){ node.remove(); }, 3200);
  }
  function sameSession(row, sid){
    var value = clean(row && (row.sessionId || row.session || row.taskId || row.rawEvidenceId || ''));
    return new RegExp('(?:^|\\b)S?0?' + Number(sid) + '(?:\\b|_)','i').test(value);
  }
  function isWritingRow(row, sid){
    var skill = clean(row && (row.skill || row.skillName || row.evidenceType || row.taskId || '')).toLowerCase();
    return !!row && typeof row === 'object' && /writing/.test(skill) && sameSession(row,sid);
  }
  function timestamp(row){
    var value = row && (row.at || row.occurredAt || row.createdAt || row.submittedAt || row.timestamp || 0);
    var time = new Date(value).getTime();
    return Number.isFinite(time) ? time : 0;
  }
  function repairPortfolio(value, sid){
    if(!acceptable(value) || !sid) return;
    var state;
    try { state = JSON.parse(localStorage.getItem(STORE) || 'null'); } catch(_) { state = null; }
    if(!state) return;
    var rows = [], seen = [];
    function walk(node){
      if(!node || typeof node !== 'object' || seen.indexOf(node) >= 0) return;
      seen.push(node);
      if(isWritingRow(node,sid)) rows.push(node);
      if(Array.isArray(node)) node.forEach(walk);
      else Object.keys(node).forEach(function(key){ walk(node[key]); });
    }
    walk(state);
    rows.sort(function(a,b){ return timestamp(b) - timestamp(a); });
    var target = rows[0];
    if(!target) return;
    var old = clean(target.output || target.answer || target.studentAnswer);
    if(promptLike(old)){
      target.output = value;
      target.answer = value;
      target.studentAnswer = value;
      target.evidenceOutputSource = 'writingOutput';
      try { localStorage.setItem(STORE, JSON.stringify(state)); } catch(_) {}
    }
  }
  function patchEvidenceSync(){
    var sync = window.EAPEvidenceSyncV130 || window.EAPEvidenceSyncV129;
    if(!sync || syncPatched || typeof sync.submitRaw !== 'function') return;
    var original = sync.submitRaw;
    sync.submitRaw = function(entry,state,extras){
      var skill = clean(entry && entry.skill).toLowerCase();
      var value = clean(box() && box().value);
      if(writingPage() && skill === 'writing' && acceptable(value)){
        entry = Object.assign({},entry,{output:value,answer:value,studentAnswer:value});
        extras = Object.assign({},extras || {},{output:value});
      }
      return original.call(this,entry,state,extras);
    };
    syncPatched = true;
  }
  function patchHero(){
    var api = window.EAPHero;
    if(!api || heroPatched || typeof api.submitWriting !== 'function') return;
    var original = api.submitWriting.bind(api);
    api.submitWriting = function(){
      var sid = currentSession();
      var value = clean(box() && box().value);
      if(writingPage() && !acceptable(value)){
        notice();
        var field = box();
        if(field) field.focus();
        return false;
      }
      var result = original.apply(api,arguments);
      if(writingPage() && acceptable(value)){
        setTimeout(function(){ repairPortfolio(value,sid); },0);
        setTimeout(function(){ repairPortfolio(value,sid); },160);
      }
      return result;
    };
    heroPatched = true;
  }
  document.addEventListener('click', function(event){
    var button = event.target && event.target.closest && event.target.closest('button');
    if(!button || !/submit writing/i.test(clean(button.textContent)) || !writingPage()) return;
    if(!valid()){
      event.preventDefault();
      event.stopImmediatePropagation();
      notice();
      var field = box();
      if(field) field.focus();
    }
  }, true);
  var timer = setInterval(function(){
    patchEvidenceSync();
    patchHero();
    if(syncPatched && heroPatched) clearInterval(timer);
  },100);
  window.EAPWritingEvidenceGuardV1 = {valid:valid,repair:repairPortfolio};
})();
