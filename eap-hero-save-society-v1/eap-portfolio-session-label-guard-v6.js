/* EAP Hero • Portfolio Session Label Guard v6
 * Last-resort display and storage guard for legacy `Sundefined` records.
 * Known legacy evidence shown in the portfolio was produced in Session 1.
 * New records are stamped from the active Session heading at save time.
 */
(function(){
  'use strict';

  var STATE_KEYS = ['EAP_HERO_PROGRESS_V3','EAP_HERO_SAVE_SOCIETY_V2_COMPACT','EAP_HERO_SAVE_SOCIETY_V1'];
  var LEGACY_SESSION = 1;
  var running = false;
  var ticks = 0;

  function text(v){ return String(v == null ? '' : v).replace(/\s+/g,' ').trim(); }
  function parse(v){ try { return JSON.parse(v); } catch(e) { return null; } }
  function stringify(v){ try { return JSON.stringify(v); } catch(e) { return ''; } }
  function isObject(v){ return !!v && typeof v === 'object' && !Array.isArray(v); }

  function activeSession(){
    var app = document.getElementById('app');
    var source = text(app && (app.innerText || app.textContent));
    var match = source.match(/Session\s*:?\s*(1[0-5]|[1-9])\s*(?::|\b)/i);
    return match ? Number(match[1]) : 0;
  }

  function cleanSession(value){
    if(typeof value === 'number' && value >= 1 && value <= 15) return Number(value);
    var raw = text(value);
    var match = raw.match(/^(?:S(?:ession)?\s*)?0?([1-9]|1[0-5])$/i);
    return match ? Number(match[1]) : 0;
  }

  function evidenceLike(item){
    if(!isObject(item)) return false;
    var skill = text(item.skill || item.skillName || item.mode).toLowerCase();
    return /^(reading|writing|listening|speaking)$/.test(skill) &&
      (item.score != null || item.latestScore != null || item.output != null || item.answer != null || item.at != null || item.createdAt != null);
  }

  function repairEntry(item, fallback){
    if(!evidenceLike(item)) return false;
    var sid = cleanSession(item.session) || cleanSession(item.sessionId);
    if(!sid) sid = fallback || LEGACY_SESSION;
    var changed = false;
    if(item.session !== sid){ item.session = sid; changed = true; }
    if(item.sessionId !== 'S' + sid){ item.sessionId = 'S' + sid; changed = true; }
    return changed;
  }

  function walk(value, fallback, seen){
    if(!value || typeof value !== 'object') return false;
    seen = seen || [];
    if(seen.indexOf(value) >= 0) return false;
    seen.push(value);
    var changed = false;
    if(Array.isArray(value)){
      value.forEach(function(item){ if(walk(item, fallback, seen)) changed = true; });
      return changed;
    }
    if(repairEntry(value, fallback)) changed = true;
    Object.keys(value).forEach(function(key){
      var child = value[key];
      if(child && typeof child === 'object' && walk(child, fallback, seen)) changed = true;
    });
    return changed;
  }

  function repairStorage(fallback){
    var changed = false;
    STATE_KEYS.forEach(function(key){
      var raw = localStorage.getItem(key);
      var state = parse(raw);
      if(!state || !walk(state, fallback, [])) return;
      localStorage.setItem(key, stringify(state));
      changed = true;
    });
    return changed;
  }

  function sessionColumn(table){
    var headers = Array.prototype.slice.call(table.querySelectorAll('thead th'));
    for(var i=0;i<headers.length;i+=1){ if(/^session$/i.test(text(headers[i].textContent))) return i; }
    return -1;
  }

  function repairRendered(){
    var app = document.getElementById('app');
    if(!app) return;
    Array.prototype.slice.call(app.querySelectorAll('table')).forEach(function(table){
      var index = sessionColumn(table);
      if(index < 0) return;
      Array.prototype.slice.call(table.querySelectorAll('tbody tr')).forEach(function(row){
        var cell = row.querySelectorAll('td')[index];
        if(!cell) return;
        var raw = text(cell.textContent);
        if(!/^(?:S)?(?:undefined|null|nan)?$/i.test(raw)) return;
        cell.textContent = 'S' + LEGACY_SESSION;
        cell.title = 'Recovered legacy session: S' + LEGACY_SESSION;
        cell.dataset.eapSessionLabelFixed = '1';
      });
    });
  }

  function interceptFutureWrites(){
    if(Storage.prototype.setItem.__eapSessionLabelGuardV6) return;
    var native = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value){
      if(!running && STATE_KEYS.indexOf(key) >= 0 && typeof value === 'string'){
        var state = parse(value);
        var sid = activeSession();
        if(state && sid && walk(state, sid, [])) value = stringify(state);
      }
      return native.call(this, key, value);
    };
    Storage.prototype.setItem.__eapSessionLabelGuardV6 = true;
  }

  function run(){
    if(running) return;
    running = true;
    try {
      /* Stored legacy evidence is known to belong to Session 1. */
      repairStorage(LEGACY_SESSION);
      repairRendered();
    } catch(error) {
      console.warn('[EAP portfolio session guard]', error);
    } finally {
      running = false;
    }
  }

  function boot(){
    interceptFutureWrites();
    run();
    var timer = setInterval(function(){
      run();
      ticks += 1;
      if(ticks > 80) clearInterval(timer);
    }, 150);
    new MutationObserver(run).observe(document.documentElement, {childList:true,subtree:true});
  }

  window.EAPPortfolioSessionLabelGuardV6 = Object.freeze({repair:run, activeSession:activeSession});
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once:true});
  else boot();
})();
