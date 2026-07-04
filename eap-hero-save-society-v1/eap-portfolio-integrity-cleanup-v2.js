/* =========================================================
   EAP Hero Portfolio Integrity Cleanup v2
   One-time safe migration for malformed browser-only portfolio rows.
   - removes session="undefined" ghost records
   - removes score-0 legacy migration markers from learner portfolio
   - corrects a very specific historical S1 Speaking goal record that
     was labelled Reading by an older router
   This script never changes Sheet history and never changes a valid
   evidence score other than that documented S1 skill-label correction.
========================================================= */
(function(){
  'use strict';

  var STATE_KEY = 'EAP_HERO_PROGRESS_V3';
  var MIGRATION_KEY = 'EAP_HERO_PORTFOLIO_INTEGRITY_CLEANUP_V2';
  var RELOAD_KEY = 'EAP_HERO_PORTFOLIO_INTEGRITY_RELOAD_V2';
  var nativeSetItem = Storage.prototype.setItem;
  var internalWrite = false;

  function parse(value){ try { return JSON.parse(value); } catch(_) { return null; } }
  function stringify(value){ try { return JSON.stringify(value); } catch(_) { return ''; } }
  function clean(value){ return String(value == null ? '' : value).replace(/\s+/g,' ').trim(); }
  function object(value){ return value && typeof value === 'object'; }
  function plain(value){ return object(value) && !Array.isArray(value); }

  function sessionOf(entry){
    return clean(entry && (entry.sessionId || entry.session || entry.sessionCode || entry.sessionKey || ''));
  }

  function skillOf(entry){
    return clean(entry && (entry.skill || entry.skillName || ''));
  }

  function outputOf(entry){
    return clean(entry && (entry.output || entry.answer || entry.studentAnswer || entry.response || entry.transcript || ''));
  }

  function evidenceLike(entry){
    if(!plain(entry)) return false;
    return !!(sessionOf(entry) || skillOf(entry)) && (
      entry.score != null || outputOf(entry) || entry.evidenceType || entry.taskId || entry.prompt || entry.answer != null
    );
  }

  function invalidSession(entry){
    var sid = sessionOf(entry).toLowerCase().replace(/\s+/g,'');
    return !sid || sid === 'undefined' || sid === 'null' || sid === 'nan' || /^s?undefined$/.test(sid);
  }

  function legacyMarker(entry){
    var output = outputOf(entry).toLowerCase();
    var score = Number(entry && entry.score);
    return score === 0 && /completed legacy evidence retained after browser-storage migration|legacy evidence retained|browser-storage migration/.test(output);
  }

  function isMislabelledS1Goal(entry){
    var sid = sessionOf(entry).toUpperCase();
    var skill = skillOf(entry).toLowerCase();
    var output = outputOf(entry).toLowerCase();
    var score = Number(entry && entry.score);
    return sid === 'S1' && skill === 'reading' && score >= 60 &&
      /my academic goal is/.test(output) &&
      /(i will practi[cs]e by|practice action|each week)/.test(output);
  }

  function correctEntry(entry){
    if(!evidenceLike(entry)) return {remove:false, changed:false};
    if(invalidSession(entry) || legacyMarker(entry)) return {remove:true, changed:false};

    if(isMislabelledS1Goal(entry)){
      entry.skill = 'Speaking';
      entry.evidenceType = entry.evidenceType || 'speaking_goal_evidence';
      entry.integrityMigration = 'S1_goal_reading_to_speaking_v2';
      return {remove:false, changed:true};
    }
    return {remove:false, changed:false};
  }

  function cleanTree(value, seen){
    if(!object(value)) return {value:value, changed:false};
    seen = seen || [];
    if(seen.indexOf(value) >= 0) return {value:value, changed:false};
    seen.push(value);
    var changed = false;

    if(Array.isArray(value)){
      var kept = [];
      value.forEach(function(item){
        if(plain(item)){
          var verdict = correctEntry(item);
          if(verdict.remove){ changed = true; return; }
          if(verdict.changed) changed = true;
        }
        var child = cleanTree(item, seen);
        if(child.changed) changed = true;
        kept.push(child.value);
      });
      if(kept.length !== value.length){
        value.splice.apply(value, [0, value.length].concat(kept));
      }
      return {value:value, changed:changed};
    }

    var own = correctEntry(value);
    if(own.changed) changed = true;
    Object.keys(value).forEach(function(key){
      var child = value[key];
      if(object(child)){
        var result = cleanTree(child, seen);
        if(result.changed) changed = true;
      }
    });
    return {value:value, changed:changed};
  }

  function repairProgressHints(state){
    /* Most current views are computed from portfolio evidence. For older
       snapshots with an explicit skill score map, remove only a zero-score
       legacy marker; do not invent or inflate scores. */
    if(!plain(state)) return false;
    var changed = false;
    function visit(node, keyPath){
      if(!object(node)) return;
      if(Array.isArray(node)){ node.forEach(function(item){ visit(item, keyPath); }); return; }
      var keys = Object.keys(node);
      var looksLikeS1 = /(^|[._-])s?1($|[._-])/i.test(String(keyPath || '')) || clean(node.sessionId || node.session || '').toUpperCase() === 'S1';
      if(looksLikeS1 && plain(node.skills) && node.skills.Reading != null && node.skills.Speaking != null){
        var reading = node.skills.Reading, speaking = node.skills.Speaking;
        if(plain(reading) && /my academic goal is/i.test(clean(reading.output || reading.answer || ''))){
          node.skills.Speaking = Object.assign({}, speaking || {}, reading, {skill:'Speaking', integrityMigration:'S1_goal_reading_to_speaking_v2'});
          node.skills.Reading = Object.assign({}, reading, {score:0, passed:false, output:'', integrityMigration:'cleared_mislabelled_s1_goal_v2'});
          changed = true;
        }
      }
      keys.forEach(function(key){ visit(node[key], String(keyPath || '') + '.' + key); });
    }
    visit(state,'root');
    return changed;
  }

  function repair(raw){
    var state = typeof raw === 'string' ? parse(raw) : raw;
    if(!state) return {state:state, changed:false};
    var tree = cleanTree(state, []);
    var hints = repairProgressHints(state);
    return {state:state, changed:!!(tree.changed || hints)};
  }

  function writeState(state){
    internalWrite = true;
    try { nativeSetItem.call(localStorage, STATE_KEY, stringify(state)); }
    finally { internalWrite = false; }
  }

  function migrateOnce(){
    var raw = localStorage.getItem(STATE_KEY);
    var state = parse(raw);
    if(!state) return false;
    var result = repair(state);
    if(result.changed) writeState(result.state);
    try { localStorage.setItem(MIGRATION_KEY, JSON.stringify({done:true, at:new Date().toISOString(), changed:result.changed})); } catch(_) {}
    return result.changed;
  }

  function intercept(){
    if(Storage.prototype.setItem.__eapPortfolioIntegrityCleanupV2) return;
    var original = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value){
      if(!internalWrite && key === STATE_KEY && typeof value === 'string'){
        var repaired = repair(value);
        if(repaired.changed) value = stringify(repaired.state);
      }
      return original.call(this, key, value);
    };
    Storage.prototype.setItem.__eapPortfolioIntegrityCleanupV2 = true;
  }

  function removeVisibleGhostRows(){
    Array.prototype.slice.call(document.querySelectorAll('#app tr')).forEach(function(row){
      var text = clean(row.innerText || '').toLowerCase();
      if(/\bsundefined\b|completed legacy evidence retained after browser-storage migration/.test(text)) row.remove();
    });
  }

  function boot(){
    intercept();
    var changed = migrateOnce();
    removeVisibleGhostRows();
    if(changed && !sessionStorage.getItem(RELOAD_KEY)){
      sessionStorage.setItem(RELOAD_KEY, '1');
      setTimeout(function(){ location.reload(); }, 120);
    }
  }

  var timer;
  function schedule(){ clearTimeout(timer); timer = setTimeout(boot, 80); }
  window.EAPPortfolioIntegrityCleanupV2 = { run:boot, repair:repair };
  window.addEventListener('load', schedule);
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
})();
