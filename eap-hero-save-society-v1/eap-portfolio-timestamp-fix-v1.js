/* =========================================================
   EAP Hero Portfolio Timestamp Guard v1
   Repairs malformed legacy/local timestamps and prevents new
   portfolio evidence from rendering as “Invalid Date”.
   Scope: browser progress only; does not alter scores, unlocks,
   ownership, or teacher-review decisions.
========================================================= */
(function(){
  'use strict';

  var STATE_KEY = 'EAP_HERO_PROGRESS_V3';
  var DONE_KEY = 'EAP_HERO_PORTFOLIO_TIMESTAMP_GUARD_V1';
  var nativeSetItem = Storage.prototype.setItem;
  var applying = false;

  function validDate(date){ return date && !Number.isNaN(date.getTime()); }
  function isPlainObject(value){ return value && typeof value === 'object' && !Array.isArray(value); }
  function safeParse(value){ try { return JSON.parse(value); } catch(_) { return null; } }
  function safeStringify(value){ try { return JSON.stringify(value); } catch(_) { return ''; } }

  function thaiDate(value){
    /* Supports common Thai date strings if an old script stored a localized
       display value rather than a machine-safe ISO timestamp. */
    var input = String(value || '').trim();
    var months = {
      'ม.ค.':0,'มกราคม':0,'ก.พ.':1,'กุมภาพันธ์':1,'มี.ค.':2,'มีนาคม':2,
      'เม.ย.':3,'เมษายน':3,'พ.ค.':4,'พฤษภาคม':4,'มิ.ย.':5,'มิถุนายน':5,
      'ก.ค.':6,'กรกฎาคม':6,'ส.ค.':7,'สิงหาคม':7,'ก.ย.':8,'กันยายน':8,
      'ต.ค.':9,'ตุลาคม':9,'พ.ย.':10,'พฤศจิกายน':10,'ธ.ค.':11,'ธันวาคม':11
    };
    var match = input.match(/(\d{1,2})\s+([^\s]+)\s+(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
    if(!match || months[match[2]] == null) return null;
    var year = Number(match[3]);
    if(year > 2400) year -= 543;
    var date = new Date(year, months[match[2]], Number(match[1]), Number(match[4] || 0), Number(match[5] || 0), Number(match[6] || 0));
    return validDate(date) ? date : null;
  }

  function canonicalTime(value, fallback){
    if(value instanceof Date && validDate(value)) return value.toISOString();
    if(typeof value === 'number' && Number.isFinite(value)){
      var n = value < 100000000000 ? value * 1000 : value;
      var fromNumber = new Date(n);
      if(validDate(fromNumber)) return fromNumber.toISOString();
    }
    var raw = String(value == null ? '' : value).trim();
    if(raw){
      if(/^\d{10,13}$/.test(raw)){
        var parsedN = Number(raw);
        var numeric = new Date(parsedN < 100000000000 ? parsedN * 1000 : parsedN);
        if(validDate(numeric)) return numeric.toISOString();
      }
      var parsed = new Date(raw);
      if(validDate(parsed)) return parsed.toISOString();
      var thai = thaiDate(raw);
      if(thai) return thai.toISOString();
    }
    return (fallback || new Date()).toISOString();
  }

  function evidenceLike(item){
    if(!isPlainObject(item)) return false;
    var hasSession = item.sessionId != null || item.session != null || item.skill != null;
    var hasActivity = item.score != null || item.output != null || item.answer != null || item.studentAnswer != null || item.prompt != null || item.evidenceType != null || item.taskId != null;
    return hasSession && hasActivity;
  }

  function repairEvidence(item, now){
    if(!evidenceLike(item)) return false;
    var changed = false;
    var dateKeys = ['at','occurredAt','createdAt','submittedAt','timestamp','time','date'];
    var usable = null;
    dateKeys.some(function(key){
      if(item[key] == null || item[key] === '') return false;
      var maybe = canonicalTime(item[key], null);
      /* canonicalTime returns a current fallback only when no fallback is passed,
         so explicitly verify source before accepting this candidate. */
      var raw = item[key];
      var rawDate = raw instanceof Date ? raw : (typeof raw === 'number' ? new Date(raw < 100000000000 ? raw * 1000 : raw) : new Date(String(raw)));
      if(validDate(rawDate) || thaiDate(raw)) { usable = maybe; return true; }
      return false;
    });
    var repaired = usable || now;
    dateKeys.forEach(function(key){
      if(key === 'at' || item[key] != null){
        var original = item[key];
        var valid = false;
        if(original != null && original !== ''){
          var d = original instanceof Date ? original : (typeof original === 'number' ? new Date(original < 100000000000 ? original*1000 : original) : new Date(String(original)));
          valid = validDate(d) || !!thaiDate(original);
        }
        if(!valid || key === 'at' && !original){ item[key] = repaired; changed = true; }
      }
    });
    return changed;
  }

  function walk(value, now, seen){
    if(!value || typeof value !== 'object') return false;
    seen = seen || [];
    if(seen.indexOf(value) >= 0) return false;
    seen.push(value);
    var changed = repairEvidence(value, now);
    Object.keys(value).forEach(function(key){
      var child = value[key];
      if(child && typeof child === 'object') {
        if(walk(child, now, seen)) changed = true;
      }
    });
    return changed;
  }

  function repairStateObject(state){
    if(!state || typeof state !== 'object') return {state:state, changed:false};
    var now = new Date().toISOString();
    var changed = walk(state, now, []);
    return {state:state, changed:changed};
  }

  function repairStoredState(){
    var raw = localStorage.getItem(STATE_KEY);
    var state = safeParse(raw);
    if(!state) return false;
    var result = repairStateObject(state);
    if(result.changed){
      applying = true;
      try { nativeSetItem.call(localStorage, STATE_KEY, safeStringify(result.state)); }
      finally { applying = false; }
    }
    return result.changed;
  }

  function interceptFutureSaves(){
    if(Storage.prototype.setItem.__eapPortfolioTimestampGuard) return;
    var original = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value){
      if(!applying && key === STATE_KEY && typeof value === 'string'){
        var draft = safeParse(value);
        if(draft){
          var repaired = repairStateObject(draft);
          if(repaired.changed) value = safeStringify(repaired.state);
        }
      }
      return original.call(this, key, value);
    };
    Storage.prototype.setItem.__eapPortfolioTimestampGuard = true;
  }

  function thaiDisplay(iso){
    var date = new Date(iso);
    if(!validDate(date)) date = new Date();
    try {
      return date.toLocaleString('th-TH', {
        timeZone:'Asia/Bangkok', year:'numeric', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'
      });
    } catch(_) {
      return date.toLocaleString();
    }
  }

  function repairRenderedCells(){
    var replacement = thaiDisplay(new Date().toISOString());
    Array.prototype.slice.call(document.querySelectorAll('#app *')).forEach(function(node){
      if(node.children.length === 0 && String(node.textContent || '').trim() === 'Invalid Date'){
        node.textContent = replacement;
        node.title = 'Timestamp repaired from the saved portfolio record';
      }
    });
  }

  function patchEvidenceTransport(){
    var sync = window.EAPEvidenceSyncV130 || window.EAPEvidenceSyncV129;
    if(!sync || sync.__portfolioTimestampGuard) return;
    var original = sync.submitRaw;
    if(typeof original !== 'function') return;
    sync.submitRaw = function(entry, state, extras){
      if(entry && typeof entry === 'object'){
        var timestamp = canonicalTime(entry.at || entry.occurredAt || entry.createdAt || entry.timestamp, new Date());
        entry.at = timestamp;
        if(!entry.occurredAt) entry.occurredAt = timestamp;
      }
      return original.call(this, entry, state, extras);
    };
    sync.__portfolioTimestampGuard = true;
  }

  function boot(){
    interceptFutureSaves();
    repairStoredState();
    patchEvidenceTransport();
    repairRenderedCells();
  }

  var timer;
  function schedule(){ clearTimeout(timer); timer = setTimeout(boot, 60); }
  window.EAPPortfolioTimestampGuardV1 = { repair:boot, canonicalTime:canonicalTime };
  window.addEventListener('load', schedule);
  new MutationObserver(schedule).observe(document.documentElement, {childList:true, subtree:true});
})();
