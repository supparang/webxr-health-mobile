/* =========================================================
   EAP Hero Core Safe Boot v7
   Stops the old V1/V2 browser migration from being read by the core
   game when an S1 goal response has been mislabelled as Reading.

   The old state is archived locally. The learner profile is retained.
   A clean V3 state is supplied to the core so only new, actual mission
   evidence can determine Reading/Speaking completion.
   ========================================================= */
(function(){
  'use strict';

  var PROGRESS = 'EAP_HERO_PROGRESS_V3';
  var PROFILE = 'EAP_HERO_PLAYER_PROFILE_V1';
  var LEGACY = ['EAP_HERO_SAVE_SOCIETY_V2_COMPACT','EAP_HERO_SAVE_SOCIETY_V1'];
  var ARCHIVE = 'EAP_HERO_SAFE_BOOT_ARCHIVE_V7';
  var DONE = 'EAP_HERO_SAFE_BOOT_V7_DONE';
  var RELOAD = 'EAP_HERO_SAFE_BOOT_V7_RELOAD';
  var nativeGet = Storage.prototype.getItem;
  var nativeSet = Storage.prototype.setItem;

  function parse(value){ try { return JSON.parse(value); } catch (_) { return null; } }
  function json(value){ try { return JSON.stringify(value); } catch (_) { return ''; } }
  function clean(value){ return String(value == null ? '' : value).replace(/\s+/g,' ').trim(); }
  function plain(value){ return value && typeof value === 'object' && !Array.isArray(value); }
  function object(value){ return value && typeof value === 'object'; }

  function profileFromState(){
    var direct = parse(nativeGet.call(localStorage, PROFILE)) || {};
    var candidates = [
      direct,
      parse(nativeGet.call(localStorage, PROGRESS)) || {}
    ];
    for(var i=0;i<candidates.length;i++){
      var root = candidates[i];
      var p = root.profile || root.player || root.user || root;
      var id = clean(p.studentId || p.id || root.studentId || root.id);
      var name = clean(p.studentName || p.name || root.studentName || root.name || root.playerName);
      if(id || name){
        return {
          studentId:id,
          studentName:name,
          id:id,
          name:name,
          section:clean(p.section || root.section || '122') || '122'
        };
      }
    }
    return {};
  }

  function textOf(row){
    if(!plain(row)) return '';
    var keys=['output','answer','studentAnswer','response','transcript','speakingNote','note','reflection','text','value'];
    for(var i=0;i<keys.length;i++){
      var value=clean(row[keys[i]]);
      if(value) return value;
    }
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

  function containsLegacyMarker(value, seen){
    if(value == null) return false;
    if(typeof value === 'string') return /completed legacy evidence retained after browser-storage migration|legacy evidence retained|browser-storage migration/i.test(value);
    if(!object(value)) return false;
    seen = seen || [];
    if(seen.indexOf(value) >= 0) return false;
    seen.push(value);
    if(Array.isArray(value)) return value.some(function(item){ return containsLegacyMarker(item, seen); });
    return Object.keys(value).some(function(key){ return containsLegacyMarker(value[key], seen); });
  }

  function containsSuspect(value, seen){
    if(!object(value)) return false;
    seen = seen || [];
    if(seen.indexOf(value) >= 0) return false;
    seen.push(value);
    if(plain(value) && suspectRow(value)) return true;
    if(Array.isArray(value)) return value.some(function(item){ return containsSuspect(item, seen); });
    return Object.keys(value).some(function(key){ return containsSuspect(value[key], seen); });
  }

  function currentNeedsCleanBoot(){
    var state = parse(nativeGet.call(localStorage, PROGRESS));
    var rawLegacy = LEGACY.map(function(key){ return nativeGet.call(localStorage,key) || ''; }).join('\n');
    return containsSuspect(state,[]) || containsLegacyMarker(state,[]) || /completed legacy evidence retained after browser-storage migration/i.test(rawLegacy);
  }

  function archiveAndReset(){
    var profile = profileFromState();
    var archive = {at:new Date().toISOString(),reason:'S1 goal evidence was incorrectly migrated as Reading',stores:{}};
    var keys=[];
    for(var i=0;i<localStorage.length;i++){
      var key=localStorage.key(i);
      if(key && (/^EAP_HERO_/i.test(key) || /^EAP_/i.test(key))) keys.push(key);
    }
    keys.forEach(function(key){ archive.stores[key]=nativeGet.call(localStorage,key); });
    try { nativeSet.call(localStorage,ARCHIVE,json(archive)); } catch (_) {}

    keys.forEach(function(key){
      if(key !== PROFILE && key !== ARCHIVE){ try { localStorage.removeItem(key); } catch (_) {} }
    });

    if(profile.studentId || profile.studentName){
      nativeSet.call(localStorage,PROFILE,json(profile));
    }

    /* Deliberately minimal: the core app creates its own default shape.
       No historic score, completion, or portfolio evidence is retained. */
    nativeSet.call(localStorage,PROGRESS,json({
      profile:profile,
      player:profile,
      portfolio:[],
      evidence:[],
      attempts:[],
      completedSessions:{},
      sessionProgress:{},
      migratedLegacyDisabled:true,
      resetAt:new Date().toISOString()
    }));
    nativeSet.call(localStorage,DONE,json({at:new Date().toISOString(),profileKept:!!(profile.studentId || profile.studentName)}));
  }

  var reset = currentNeedsCleanBoot();
  if(reset) archiveAndReset();

  /* Hide only the legacy keys while the core starts. This prevents its old
     built-in migration from re-creating fabricated Reading/Speaking records. */
  Storage.prototype.getItem = function(key){
    if(LEGACY.indexOf(key) >= 0) return null;
    return nativeGet.call(this,key);
  };
  setTimeout(function(){ Storage.prototype.getItem = nativeGet; }, 1500);

  if(reset && !sessionStorage.getItem(RELOAD)){
    sessionStorage.setItem(RELOAD,'1');
    setTimeout(function(){ location.reload(); },0);
  }

  window.EAPCoreSafeBootV7={suspectRow:suspectRow,reset:reset};
})();
