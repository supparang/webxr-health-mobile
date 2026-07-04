/* =========================================================
   EAP Hero • Portfolio Session Repair v5
   Repairs learner-side portfolio records that render as Sundefined.

   Design principles
   - Never changes scores, skill evidence, unlock decisions, or teacher review.
   - Uses the visible Session heading only to recover records created in that
     active session when their session field is absent/corrupted.
   - Repairs existing browser state, future browser saves, and the visible
     portfolio table as a final display safeguard.
   ========================================================= */
(function(){
  'use strict';

  var KEYS = [
    'EAP_HERO_PROGRESS_V3',
    'EAP_HERO_SAVE_SOCIETY_V2_COMPACT',
    'EAP_HERO_SAVE_SOCIETY_V1'
  ];
  var RELOAD_KEY = 'EAP_HERO_PORTFOLIO_SESSION_REPAIR_V5_RELOADED';
  var writing = false;
  var scheduled = false;

  function text(value){ return String(value == null ? '' : value).replace(/\s+/g, ' ').trim(); }
  function plain(value){ return value && typeof value === 'object' && !Array.isArray(value); }
  function parse(value){ try { return JSON.parse(value); } catch(error) { return null; } }
  function stringify(value){ try { return JSON.stringify(value); } catch(error) { return ''; } }

  function activeSession(){
    var root = document.getElementById('app');
    var source = text(root && root.innerText);
    var match = source.match(/\bSession\s*:?\s*(1[0-5]|[1-9])\s*(?::|\b)/i);
    return match ? Number(match[1]) : 0;
  }

  function normalizeSession(value){
    if(value === undefined || value === null) return null;
    if(typeof value === 'number' && Number.isFinite(value)){
      return value >= 1 && value <= 15 ? {kind:'session', value:Number(value)} : null;
    }
    var raw = text(value);
    if(!raw || /^(?:s)?(?:undefined|null|nan)$/i.test(raw)) return null;
    var boss = raw.match(/^(?:BG|B)\s*([1-5])$/i);
    if(boss) return {kind:'boss', value:'B' + Number(boss[1])};
    var session = raw.match(/^(?:S(?:ession)?\s*)?0?([1-9]|1[0-5])$/i);
    return session ? {kind:'session', value:Number(session[1])} : null;
  }

  function portfolioLike(entry){
    if(!plain(entry)) return false;
    var skill = text(entry.skill || entry.skillName || entry.type).toLowerCase();
    if(!/^(reading|writing|listening|speaking)$/.test(skill)) return false;
    return entry.score != null || entry.latestScore != null || entry.output != null ||
      entry.answer != null || entry.studentAnswer != null || entry.evidenceType != null ||
      entry.taskId != null || entry.rawEvidenceId != null || entry.at != null;
  }

  function repairEntry(entry, fallbackSession){
    if(!portfolioLike(entry)) return false;
    var existing = normalizeSession(entry.session != null ? entry.session : entry.sessionId);
    var changed = false;

    if(existing && existing.kind === 'session'){
      if(Number(entry.session) !== existing.value){ entry.session = existing.value; changed = true; }
      if(entry.sessionId !== 'S' + existing.value){ entry.sessionId = 'S' + existing.value; changed = true; }
      return changed;
    }

    if(existing && existing.kind === 'boss'){
      if(entry.session !== existing.value){ entry.session = existing.value; changed = true; }
      if(entry.sessionId !== existing.value){ entry.sessionId = existing.value; changed = true; }
      return changed;
    }

    if(!fallbackSession) return false;
    entry.session = fallbackSession;
    entry.sessionId = 'S' + fallbackSession;
    entry.sessionRecovered = true;
    changed = true;
    return changed;
  }

  function walk(value, fallbackSession, seen){
    if(!value || typeof value !== 'object') return false;
    seen = seen || [];
    if(seen.indexOf(value) >= 0) return false;
    seen.push(value);
    var changed = false;

    if(Array.isArray(value)){
      value.forEach(function(item){ if(walk(item, fallbackSession, seen)) changed = true; });
      return changed;
    }

    if(repairEntry(value, fallbackSession)) changed = true;
    Object.keys(value).forEach(function(key){
      if(value[key] && typeof value[key] === 'object' && walk(value[key], fallbackSession, seen)) changed = true;
    });
    return changed;
  }

  function repairStored(){
    var sid = activeSession();
    if(!sid) return false;
    var changedAny = false;
    KEYS.forEach(function(key){
      var raw = localStorage.getItem(key);
      if(!raw) return;
      var state = parse(raw);
      if(!state || typeof state !== 'object') return;
      if(!walk(state, sid, [])) return;
      writing = true;
      try { Storage.prototype.setItem.call(localStorage, key, stringify(state)); }
      catch(error) {}
      finally { writing = false; }
      changedAny = true;
    });
    return changedAny;
  }

  function interceptFutureSaves(){
    if(Storage.prototype.setItem.__eapPortfolioSessionRepairV5) return;
    var nativeSet = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value){
      if(!writing && KEYS.indexOf(key) >= 0 && typeof value === 'string'){
        var state = parse(value);
        var sid = activeSession();
        if(state && sid && walk(state, sid, [])) value = stringify(state);
      }
      return nativeSet.call(this, key, value);
    };
    Storage.prototype.setItem.__eapPortfolioSessionRepairV5 = true;
  }

  function sessionColumn(table){
    var cells = Array.prototype.slice.call(table.querySelectorAll('thead th'));
    for(var i = 0; i < cells.length; i += 1){
      if(/^session$/i.test(text(cells[i].textContent))) return i;
    }
    return -1;
  }

  function portfolioTable(table){
    if(!table) return false;
    var labels = Array.prototype.slice.call(table.querySelectorAll('thead th')).map(function(cell){ return text(cell.textContent).toLowerCase(); });
    return labels.indexOf('session') >= 0 && labels.indexOf('skill') >= 0 && labels.indexOf('score') >= 0;
  }

  function repairRendered(){
    var sid = activeSession();
    if(!sid) return;
    Array.prototype.slice.call(document.querySelectorAll('#app table')).forEach(function(table){
      if(!portfolioTable(table)) return;
      var index = sessionColumn(table);
      if(index < 0) return;
      Array.prototype.slice.call(table.querySelectorAll('tbody tr')).forEach(function(row){
        var cells = row.querySelectorAll('td');
        var cell = cells[index];
        if(!cell) return;
        var raw = text(cell.textContent);
        if(!/^(?:S)?(?:undefined|null|nan)?$/i.test(raw)) return;
        cell.textContent = 'S' + sid;
        cell.dataset.eapSessionRecovered = '1';
        cell.title = 'Recovered session label: S' + sid;
      });
    });
  }

  function schedule(){
    if(scheduled) return;
    scheduled = true;
    window.requestAnimationFrame(function(){
      scheduled = false;
      var changed = repairStored();
      repairRendered();
      if(changed){
        try {
          if(sessionStorage.getItem(RELOAD_KEY) !== '1'){
            sessionStorage.setItem(RELOAD_KEY, '1');
            window.setTimeout(function(){ location.reload(); }, 90);
          }
        } catch(error) {}
      }
    });
  }

  function boot(){
    interceptFutureSaves();
    schedule();
    new MutationObserver(schedule).observe(document.documentElement, {childList:true, subtree:true});
  }

  window.EAPPortfolioSessionRepairV5 = Object.freeze({
    repair: schedule,
    activeSession: activeSession,
    normalizeSession: normalizeSession
  });

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once:true});
  else boot();
})();
