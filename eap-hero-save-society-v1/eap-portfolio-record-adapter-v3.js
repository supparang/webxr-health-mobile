/* =========================================================
   EAP Hero Portfolio Record Adapter v3
   Runs BEFORE the core app reads browser progress.
   Normalizes record aliases from legacy/current evidence shapes so
   the core Recent Portfolio renderer receives:
      session: 1..15, sessionId: S1..S15, skill, output, at
   It removes only entries that have no recoverable session identity
   or are explicit zero-score migration markers.
   ========================================================= */
(function(){
  'use strict';

  var KEYS = [
    'EAP_HERO_PROGRESS_V3',
    'EAP_HERO_SAVE_SOCIETY_V2_COMPACT',
    'EAP_HERO_SAVE_SOCIETY_V1'
  ];
  var VERSION_KEY = 'EAP_HERO_PORTFOLIO_RECORD_ADAPTER_V3';
  var RELOAD_KEY = 'EAP_HERO_PORTFOLIO_RECORD_ADAPTER_RELOAD_V3';
  var baseSetItem = Storage.prototype.setItem;
  var internal = false;

  function parse(value){ try { return JSON.parse(value); } catch(_) { return null; } }
  function stringify(value){ try { return JSON.stringify(value); } catch(_) { return ''; } }
  function text(value){ return String(value == null ? '' : value).replace(/\s+/g,' ').trim(); }
  function isObject(value){ return value && typeof value === 'object'; }
  function isPlainObject(value){ return isObject(value) && !Array.isArray(value); }

  function isValidDate(value){
    var date = value instanceof Date ? value : new Date(value);
    return !Number.isNaN(date.getTime());
  }

  function iso(value){
    if(value == null || value === '') return new Date().toISOString();
    if(typeof value === 'number'){
      var n = value < 100000000000 ? value * 1000 : value;
      var fromNumber = new Date(n);
      return isValidDate(fromNumber) ? fromNumber.toISOString() : new Date().toISOString();
    }
    var parsed = new Date(String(value));
    return isValidDate(parsed) ? parsed.toISOString() : new Date().toISOString();
  }

  function extractSession(entry){
    if(!entry || typeof entry !== 'object') return null;
    var candidates = [
      entry.session,
      entry.sessionId,
      entry.sessionCode,
      entry.sessionKey,
      entry.sessionTitle,
      entry.taskId,
      entry.abilityTaskId,
      entry.rawEvidenceId,
      entry.evidenceId,
      entry.title,
      entry.prompt
    ];
    for(var i=0;i<candidates.length;i++){
      var value = text(candidates[i]);
      if(!value) continue;
      var boss = value.match(/(?:^|\b)(?:BG|B)([1-5])(?:\b|_)/i);
      if(boss) return {type:'boss', value:'B' + Number(boss[1])};
      var regular = value.match(/(?:^|\b)S(?:ession)?\s*0?([1-9]|1[0-5])(?:\b|_)/i);
      if(regular) return {type:'session', value:Number(regular[1])};
      if(/^0?([1-9]|1[0-5])$/.test(value)) return {type:'session', value:Number(value)};
    }
    if(entry.boss && entry.boss.gate) return {type:'boss', value:'B' + Number(entry.boss.gate)};
    return null;
  }

  function candidateOutput(entry){
    if(!entry || typeof entry !== 'object') return '';
    var direct = [
      entry.output, entry.answer, entry.studentAnswer, entry.response,
      entry.transcript, entry.speakingNote, entry.note, entry.reflection,
      entry.text, entry.value, entry.writtenResponse, entry.userResponse
    ];
    for(var i=0;i<direct.length;i++){
      var result = text(direct[i]);
      if(result) return result;
    }
    var nested = [entry.evidence, entry.result, entry.task, entry.data, entry.payload];
    for(var j=0;j<nested.length;j++){
      if(isPlainObject(nested[j])){
        var inside = candidateOutput(nested[j]);
        if(inside) return inside;
      }
    }
    return '';
  }

  function normalizedSkill(entry){
    var raw = text(entry.skill || entry.skillName || entry.type || '');
    var match = raw.match(/\b(reading|writing|listening|speaking)\b/i);
    if(match) return match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase();
    var evidence = text(entry.evidenceType || entry.taskId || entry.rawEvidenceId || '');
    var found = evidence.match(/(reading|writing|listening|speaking)/i);
    return found ? found[1].charAt(0).toUpperCase() + found[1].slice(1).toLowerCase() : raw;
  }

  function looksLikeS1Goal(entry, output){
    var session = extractSession(entry);
    var skill = normalizedSkill(entry).toLowerCase();
    var body = text(output).toLowerCase();
    return session && session.type === 'session' && session.value === 1 && skill === 'reading' &&
      /my academic goal is/.test(body) && /(i will practi[cs]e by|practice action|each week)/.test(body);
  }

  function explicitLegacyMarker(entry, output){
    return Number(entry.score) === 0 && /completed legacy evidence retained after browser-storage migration|legacy evidence retained|browser-storage migration/.test(text(output).toLowerCase());
  }

  function recordLike(entry){
    if(!isPlainObject(entry)) return false;
    return !!(
      entry.score != null || entry.output != null || entry.answer != null ||
      entry.studentAnswer != null || entry.evidenceType || entry.taskId ||
      entry.rawEvidenceId || entry.sessionId || entry.session || entry.skill
    );
  }

  function normalizeRecord(entry){
    if(!recordLike(entry)) return {drop:false, changed:false};
    var session = extractSession(entry);
    var output = candidateOutput(entry);
    if(explicitLegacyMarker(entry, output)) return {drop:true, changed:false};
    if(!session) return {drop:true, changed:false};

    var changed = false;
    if(session.type === 'session'){
      if(Number(entry.session) !== session.value){ entry.session = session.value; changed = true; }
      if(entry.sessionId !== 'S' + session.value){ entry.sessionId = 'S' + session.value; changed = true; }
    } else {
      if(entry.session !== session.value){ entry.session = session.value; changed = true; }
      if(entry.sessionId !== session.value){ entry.sessionId = session.value; changed = true; }
    }

    var skill = normalizedSkill(entry);
    if(looksLikeS1Goal(entry, output)) skill = 'Speaking';
    if(skill && entry.skill !== skill){ entry.skill = skill; changed = true; }

    if(output && entry.output !== output){ entry.output = output; changed = true; }
    if(!entry.output && (entry.score != null || entry.evidenceType)){
      entry.output = 'Saved activity evidence.';
      changed = true;
    }

    var timestamp = entry.at || entry.occurredAt || entry.createdAt || entry.submittedAt || entry.timestamp || entry.time || entry.date;
    var stable = iso(timestamp);
    if(entry.at !== stable){ entry.at = stable; changed = true; }
    if(!entry.occurredAt){ entry.occurredAt = stable; changed = true; }
    return {drop:false, changed:changed};
  }

  function visit(value, seen){
    if(!isObject(value)) return {changed:false};
    seen = seen || [];
    if(seen.indexOf(value) >= 0) return {changed:false};
    seen.push(value);
    var changed = false;

    if(Array.isArray(value)){
      var next = [];
      value.forEach(function(item){
        if(isPlainObject(item)){
          var verdict = normalizeRecord(item);
          if(verdict.drop){ changed = true; return; }
          if(verdict.changed) changed = true;
        }
        var child = visit(item, seen);
        if(child.changed) changed = true;
        next.push(item);
      });
      if(next.length !== value.length){ value.splice.apply(value,[0,value.length].concat(next)); }
      return {changed:changed};
    }

    Object.keys(value).forEach(function(key){
      var child = value[key];
      if(isObject(child)){
        var result = visit(child, seen);
        if(result.changed) changed = true;
      }
    });
    return {changed:changed};
  }

  function normalizeState(raw){
    var state = typeof raw === 'string' ? parse(raw) : raw;
    if(!state || typeof state !== 'object') return {state:state, changed:false};
    var result = visit(state, []);
    return {state:state, changed:result.changed};
  }

  function repairAll(){
    var changed = false;
    KEYS.forEach(function(key){
      var raw = localStorage.getItem(key);
      if(!raw) return;
      var result = normalizeState(raw);
      if(result.changed){
        internal = true;
        try { baseSetItem.call(localStorage,key,stringify(result.state)); }
        finally { internal = false; }
        changed = true;
      }
    });
    try { localStorage.setItem(VERSION_KEY, JSON.stringify({at:new Date().toISOString(), changed:changed})); } catch(_) {}
    return changed;
  }

  function interceptFutureWrites(){
    if(Storage.prototype.setItem.__eapPortfolioRecordAdapterV3) return;
    var original = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value){
      if(!internal && KEYS.indexOf(key) >= 0 && typeof value === 'string'){
        var result = normalizeState(value);
        if(result.changed) value = stringify(result.state);
      }
      return original.call(this,key,value);
    };
    Storage.prototype.setItem.__eapPortfolioRecordAdapterV3 = true;
  }

  function hideAnyRemainingGhostRows(){
    Array.prototype.slice.call(document.querySelectorAll('#app tr')).forEach(function(row){
      var cells = Array.prototype.slice.call(row.querySelectorAll('td'));
      var body = text(row.textContent).toLowerCase();
      if(/sundefined|snull|snan/.test(body)) row.remove();
      else if(cells.length >= 5 && !text(cells[1].textContent) && /^(reading|writing|listening|speaking)$/i.test(text(cells[2].textContent))) row.remove();
    });
  }

  function boot(){
    interceptFutureWrites();
    var changed = repairAll();
    hideAnyRemainingGhostRows();
    if(changed && !sessionStorage.getItem(RELOAD_KEY)){
      sessionStorage.setItem(RELOAD_KEY,'1');
      setTimeout(function(){ location.reload(); }, 100);
    }
  }

  var timer;
  function schedule(){ clearTimeout(timer); timer = setTimeout(boot, 30); }
  window.EAPPortfolioRecordAdapterV3 = {run:boot, normalize:normalizeState};
  schedule();
  window.addEventListener('load', schedule);
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
})();
