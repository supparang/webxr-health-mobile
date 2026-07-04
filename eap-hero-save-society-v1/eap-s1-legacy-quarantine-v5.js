/* =========================================================
   EAP Hero S1 Legacy Quarantine v5
   One-time repair for a malformed browser-only S1 migration.
   Runs before eap-hero.js. It:
   1) archives and removes old V1/V2 compact stores so the core migration
      cannot re-inject placeholder evidence;
   2) removes only known placeholder portfolio rows;
   3) resets the affected S1 local progress so the learner can complete
      S1 again with real Reading/Speaking evidence.
   It does not alter server/Sheet records or any session other than S1.
========================================================= */
(function(){
  'use strict';

  var PRIMARY = 'EAP_HERO_PROGRESS_V3';
  var LEGACY = ['EAP_HERO_SAVE_SOCIETY_V2_COMPACT','EAP_HERO_SAVE_SOCIETY_V1'];
  var ARCHIVE = 'EAP_HERO_LEGACY_ARCHIVE_V5';
  var DONE = 'EAP_HERO_S1_LEGACY_QUARANTINE_V5_DONE';

  function parse(value){ try { return JSON.parse(value); } catch(_) { return null; } }
  function stringify(value){ try { return JSON.stringify(value); } catch(_) { return ''; } }
  function text(value){ return String(value == null ? '' : value).replace(/\s+/g,' ').trim(); }
  function plain(value){ return value && typeof value === 'object' && !Array.isArray(value); }
  function isObject(value){ return value && typeof value === 'object'; }

  function outputOf(row){
    if(!plain(row)) return '';
    var candidates=[row.output,row.answer,row.studentAnswer,row.response,row.transcript,row.speakingNote,row.note,row.reflection,row.text,row.value];
    for(var i=0;i<candidates.length;i++){
      var value=text(candidates[i]);
      if(value) return value;
    }
    return '';
  }

  function sessionText(row){
    return text(row && (row.sessionId || row.session || row.sessionCode || row.sessionKey || row.taskId || row.rawEvidenceId || row.evidenceId || ''));
  }

  function isS1(row){
    var value=sessionText(row);
    return /(?:^|\b)S(?:ession)?\s*0?1(?:\b|_)/i.test(value) || value === '1';
  }

  function placeholder(row){
    var body=outputOf(row).toLowerCase();
    return /completed legacy evidence retained after browser-storage migration|legacy evidence retained|browser-storage migration|^saved activity evidence\.?$/.test(body);
  }

  function looksLikeRecord(row){
    return plain(row) && !!(
      row.score != null || row.skill || row.session || row.sessionId || row.evidenceType || row.taskId || row.rawEvidenceId || row.output != null || row.answer != null
    );
  }

  function purgeRows(value, seen){
    if(!isObject(value)) return false;
    seen=seen||[];
    if(seen.indexOf(value)>=0) return false;
    seen.push(value);
    var changed=false;
    if(Array.isArray(value)){
      var kept=[];
      value.forEach(function(item){
        if(looksLikeRecord(item) && placeholder(item)){
          /* These records are generated migration placeholders; remove them
             irrespective of an accidentally inherited score. */
          changed=true;
          return;
        }
        if(purgeRows(item,seen)) changed=true;
        kept.push(item);
      });
      if(kept.length!==value.length) value.splice.apply(value,[0,value.length].concat(kept));
      return changed;
    }
    Object.keys(value).forEach(function(key){
      if(isObject(value[key]) && purgeRows(value[key],seen)) changed=true;
    });
    return changed;
  }

  function resetS1Maps(node, parentKey, seen){
    if(!isObject(node)) return false;
    seen=seen||[];
    if(seen.indexOf(node)>=0) return false;
    seen.push(node);
    var changed=false;
    var parentIsSessionMap=/(session|progress|result|score|skill|attempt|evidence|portfolio|record|summary|complete)/i.test(String(parentKey||''));

    if(Array.isArray(node)){
      node.forEach(function(item){ if(resetS1Maps(item,parentKey,seen)) changed=true; });
      return changed;
    }

    Object.keys(node).forEach(function(key){
      var value=node[key];
      var isS1Key=/^(?:s?0?1)$/i.test(String(key));
      if(parentIsSessionMap && isS1Key && isObject(value)){
        /* The only local session state known to be contaminated is S1. Remove
           it fully so its real core/support path can be attempted again. */
        delete node[key];
        changed=true;
        return;
      }
      if(isObject(value) && resetS1Maps(value,key,seen)) changed=true;
    });
    return changed;
  }

  function archiveAndDisableLegacy(){
    if(localStorage.getItem(DONE)) return;
    var archive={at:new Date().toISOString(),stores:{}};
    LEGACY.forEach(function(key){
      var raw=localStorage.getItem(key);
      if(raw){ archive.stores[key]=raw; localStorage.removeItem(key); }
    });
    if(Object.keys(archive.stores).length){
      try { localStorage.setItem(ARCHIVE,stringify(archive)); } catch(_) {}
    }
  }

  function repair(){
    archiveAndDisableLegacy();
    var raw=localStorage.getItem(PRIMARY);
    var state=parse(raw);
    var changed=false;
    if(state && typeof state==='object'){
      if(purgeRows(state,[])) changed=true;
      if(resetS1Maps(state,'root',[])) changed=true;
      if(changed) localStorage.setItem(PRIMARY,stringify(state));
    }
    try { localStorage.setItem(DONE,JSON.stringify({at:new Date().toISOString(),changed:changed})); } catch(_) {}
  }

  repair();
  window.EAPS1LegacyQuarantineV5={run:repair};
})();
