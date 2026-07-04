/* =========================================================
   EAP Hero Corrupt Legacy State Reset v6
   Deterministic recovery for the exact broken migration signature:
   "Completed legacy evidence retained after browser-storage migration."

   The signature means the browser has generated placeholder records, not
   valid learner evidence. When found, archive the corrupt client state,
   preserve the player profile, and start the EAP Hero browser state fresh.
   This does NOT alter Google Sheet / Teacher Dashboard records.
   ========================================================= */
(function(){
  'use strict';

  var MARKER = /completed legacy evidence retained after browser-storage migration/i;
  var PROFILE_KEY = 'EAP_HERO_PLAYER_PROFILE_V1';
  var PROGRESS_KEY = 'EAP_HERO_PROGRESS_V3';
  var ARCHIVE_KEY = 'EAP_HERO_DIAGNOSTIC_ARCHIVE_CORRUPT_V6';
  var RESET_KEY = 'EAP_HERO_CORRUPT_LEGACY_RESET_V6';
  var RELOAD_KEY = 'EAP_HERO_CORRUPT_LEGACY_RESET_V6_RELOAD';

  function parse(value){ try { return JSON.parse(value); } catch(_) { return null; } }
  function stringify(value){ try { return JSON.stringify(value); } catch(_) { return ''; } }
  function clean(value){ return String(value == null ? '' : value).replace(/\s+/g, ' ').trim(); }

  function savedProfile(){
    var direct = parse(localStorage.getItem(PROFILE_KEY)) || {};
    if(clean(direct.studentId || direct.id) && clean(direct.studentName || direct.name)){
      return {
        studentId: clean(direct.studentId || direct.id),
        studentName: clean(direct.studentName || direct.name),
        section: clean(direct.section || '122') || '122',
        id: clean(direct.studentId || direct.id),
        name: clean(direct.studentName || direct.name)
      };
    }
    var progress = parse(localStorage.getItem(PROGRESS_KEY)) || {};
    var candidate = progress.profile || progress.player || progress.user || {};
    var id = clean(candidate.studentId || candidate.id || progress.studentId || progress.id);
    var name = clean(candidate.studentName || candidate.name || progress.studentName || progress.name || progress.playerName);
    if(!id || !name) return null;
    return {studentId:id,studentName:name,section:clean(candidate.section || progress.section || '122') || '122',id:id,name:name};
  }

  function markerFound(){
    for(var i=0;i<localStorage.length;i++){
      var key = localStorage.key(i);
      if(!key) continue;
      var value = localStorage.getItem(key) || '';
      if(MARKER.test(value)) return true;
    }
    return false;
  }

  function archive(){
    var data = {at:new Date().toISOString(), reason:'corrupt legacy placeholder migration marker', keys:{}};
    for(var i=0;i<localStorage.length;i++){
      var key = localStorage.key(i);
      if(key && /^EAP_HERO_/i.test(key) && key !== ARCHIVE_KEY) data.keys[key] = localStorage.getItem(key);
    }
    try { localStorage.setItem(ARCHIVE_KEY, stringify(data)); } catch(_) {}
  }

  function clearHeroRuntimeKeys(){
    var keys=[];
    for(var i=0;i<localStorage.length;i++){
      var key=localStorage.key(i);
      if(key && /^EAP_HERO_/i.test(key) && key !== PROFILE_KEY && key !== ARCHIVE_KEY) keys.push(key);
    }
    keys.forEach(function(key){ try { localStorage.removeItem(key); } catch(_) {} });
  }

  function reset(){
    if(!markerFound()) return false;
    var profile = savedProfile();
    archive();
    clearHeroRuntimeKeys();
    if(profile) localStorage.setItem(PROFILE_KEY, stringify(profile));
    localStorage.setItem(RESET_KEY, JSON.stringify({at:new Date().toISOString(), preservedProfile:!!profile}));
    return true;
  }

  var changed = reset();
  if(changed && !sessionStorage.getItem(RELOAD_KEY)){
    sessionStorage.setItem(RELOAD_KEY,'1');
    setTimeout(function(){ location.reload(); }, 0);
  }

  window.EAPCorruptLegacyStateResetV6 = { markerFound:markerFound, reset:reset };
})();
