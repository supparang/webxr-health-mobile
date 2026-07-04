/* =========================================================
   EAP Hero Core Safe Boot v8
   Removes only corrupt legacy artefacts without wiping verified
   player-scoped progress restored from Google Sheet.

   Why v8:
   v7 reset the entire EAP state whenever it detected a legacy marker.
   That also deleted the fresh player-resume cache, causing Map to show
   S1 = 0 again after a successful Sheet sync.
========================================================= */
(function(){
  'use strict';

  var PROGRESS = 'EAP_HERO_PROGRESS_V3';
  var PROFILE = 'EAP_HERO_PLAYER_PROFILE_V1';
  var LEGACY = ['EAP_HERO_SAVE_SOCIETY_V2_COMPACT','EAP_HERO_SAVE_SOCIETY_V1'];
  var ARCHIVE = 'EAP_HERO_SAFE_BOOT_ARCHIVE_V8';
  var DONE = 'EAP_HERO_SAFE_BOOT_V8_DONE';
  var nativeGet = Storage.prototype.getItem;
  var nativeSet = Storage.prototype.setItem;

  function parse(value){ try { return JSON.parse(value); } catch (_) { return null; } }
  function json(value){ try { return JSON.stringify(value); } catch (_) { return ''; } }
  function clean(value){ return String(value == null ? '' : value).replace(/\s+/g,' ').trim(); }
  function plain(value){ return value && typeof value === 'object' && !Array.isArray(value); }
  function object(value){ return value && typeof value === 'object'; }

  function profileFromState(){
    var direct = parse(nativeGet.call(localStorage, PROFILE)) || {};
    var candidates = [direct, parse(nativeGet.call(localStorage, PROGRESS)) || {}];
    for(var i=0;i<candidates.length;i++){
      var root = candidates[i];
      var p = root.profile || root.player || root.user || root;
      var id = clean(p.studentId || p.id || root.studentId || root.id);
      var name = clean(p.studentName || p.name || root.studentName || root.name || root.playerName);
      if(id || name) return {studentId:id,studentName:name,id:id,name:name,section:clean(p.section || root.section || '122') || '122'};
    }
    return {};
  }

  function textOf(row){
    if(!plain(row)) return '';
    var keys=['output','answer','studentAnswer','response','transcript','speakingNote','note','reflection','text','value'];
    for(var i=0;i<keys.length;i++){ var value=clean(row[keys[i]]); if(value) return value; }
    return '';
  }

  function sessionOf(row){
    if(!plain(row)) return '';
    return clean(row.sessionId || row.session || row.sessionCode || row.sessionKey || row.taskId || row.rawEvidenceId || row.evidenceId || row.missionId || row.id || '');
  }

  function skillOf(row){ return clean(row && (row.skill || row.skillName || row.type || '')); }

  function suspectRow(row){
    if(!plain(row)) return false;
    var output = textOf(row).toLowerCase();
    var session = sessionOf(row).toUpperCase();
    var skill = skillOf(row).toLowerCase();
    var goal = /my academic goal is/.test(output) && /(i will practi[cs]e by|practice action|each week)/.test(output);
    var isS1 = /(?:^|\b)S(?:ESSION)?\s*0?1(?:\b|_)/i.test(session) || session === '1';
    return goal && isS1 && skill === 'reading';
  }

  function legacyMarker(value){
    return /completed legacy evidence retained after browser-storage migration|legacy evidence retained|browser-storage migration/i.test(String(value == null ? '' : value));
  }

  function corruptEntry(value){
    if(!plain(value)) return false;
    return suspectRow(value) || legacyMarker(textOf(value)) || legacyMarker(value.output);
  }

  function pruneArray(list, removed){
    if(!Array.isArray(list)) return list;
    return list.filter(function(item){
      if(corruptEntry(item)){ removed.push(item); return false; }
      return true;
    });
  }

  function stateNeedsRepair(state){
    if(!object(state)) return false;
    var lists=[state.portfolio,state.evidence,state.attempts];
    return lists.some(function(list){ return Array.isArray(list) && list.some(corruptEntry); });
  }

  function repairState(){
    var state = parse(nativeGet.call(localStorage, PROGRESS));
    if(!object(state)) return false;
    if(!stateNeedsRepair(state)) return false;

    var removed=[];
    var archive={at:new Date().toISOString(),reason:'removed corrupt legacy migration entries; preserved verified resume state',removed:[]};
    state.portfolio=pruneArray(state.portfolio,removed) || [];
    state.evidence=pruneArray(state.evidence,removed) || [];
    state.attempts=pruneArray(state.attempts,removed) || [];
    archive.removed=removed;

    /* Keep identity, serverResume, scoped state, real Sheet records,
       completions, and unlocked sessions untouched. */
    state.migratedLegacyDisabled=true;
    state.legacyRepairAt=new Date().toISOString();
    try { nativeSet.call(localStorage,ARCHIVE,json(archive)); } catch (_) {}
    nativeSet.call(localStorage,PROGRESS,json(state));
    nativeSet.call(localStorage,DONE,json({at:new Date().toISOString(),removedCount:removed.length,preservedResume:!!state.serverResume}));
    return true;
  }

  /* Remove only old migration source stores. The active V3 store survives. */
  LEGACY.forEach(function(key){ try { localStorage.removeItem(key); } catch (_) {} });
  var repaired = repairState();

  /* Hide only legacy keys while the core starts. */
  Storage.prototype.getItem = function(key){
    if(LEGACY.indexOf(key) >= 0) return null;
    return nativeGet.call(this,key);
  };
  setTimeout(function(){ Storage.prototype.getItem = nativeGet; }, 1500);

  window.EAPCoreSafeBootV8={suspectRow:suspectRow,repaired:repaired};
})();
