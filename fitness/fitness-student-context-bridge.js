/**
 * HeroHealth Fitness • Student Context Bridge
 * File: /fitness/fitness-student-context-bridge.js
 * Version: v20260620-STUDENT-CONTEXT-BRIDGE-V2-AUTO-SUBMIT
 *
 * Load this file BEFORE each Fitness game script.
 * It automatically enriches Fitness result payloads with student identity
 * and Bangkok-local timestamps before fetch() or sendBeacon() is called.
 */
(function (global) {
  'use strict';

  const STORAGE_KEY = 'herohealth:fitness:student-context:v2';
  const FITNESS_RE = /jumpduck|jump-duck|balancehold|balance-hold|rhythmboxer|rhythm-boxer|shadowbreaker|shadow-breaker|\/fitness\//i;

  function clean(value) {
    return String(value == null ? '' : value).trim();
  }

  function query() {
    try { return new URLSearchParams(global.location.search || ''); }
    catch (_) { return new URLSearchParams(); }
  }

  function loadSaved() {
    try { return JSON.parse(global.localStorage.getItem(STORAGE_KEY) || '{}') || {}; }
    catch (_) { return {}; }
  }

  function fromQuery() {
    const q = query();
    return {
      studentId: clean(q.get('studentId') || q.get('sid') || q.get('student_id')),
      studentName: clean(q.get('studentName') || q.get('name') || q.get('student_name')),
      classId: clean(q.get('classId') || q.get('class') || q.get('classGroup') || q.get('group')),
      section: clean(q.get('section') || q.get('sec')),
      playerId: clean(q.get('playerId') || q.get('pid') || q.get('player_id'))
    };
  }

  function get() {
    const saved = loadSaved();
    const q = fromQuery();
    return {
      studentId: q.studentId || clean(saved.studentId),
      studentName: q.studentName || clean(saved.studentName),
      classId: q.classId || clean(saved.classId),
      section: q.section || clean(saved.section),
      playerId: q.playerId || clean(saved.playerId)
    };
  }

  function save(next) {
    const value = Object.assign({}, loadSaved(), next || {});
    try { global.localStorage.setItem(STORAGE_KEY, JSON.stringify(value)); } catch (_) {}
    return value;
  }

  function bangkokTimestamp() {
    try {
      return new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Bangkok', hour12: false }).replace(' ', 'T');
    } catch (_) { return new Date().toISOString(); }
  }

  function apply(payload) {
    const ctx = get();
    const out = Object.assign({}, payload || {});
    out.studentId = clean(out.studentId || out.student_id || ctx.studentId);
    out.studentName = clean(out.studentName || out.student_name || out.playerName || out.player_name || out.player || out.name || ctx.studentName);
    out.classId = clean(out.classId || out.class_id || out.classGroup || out.class_group || out.class || out.group || ctx.classId);
    out.section = clean(out.section || out.sec || ctx.section);
    out.playerId = clean(out.playerId || out.player_id || out.pid || out.uid || ctx.playerId);
    out.identitySource = out.studentId ? 'studentId' : (out.playerId ? 'playerId' : 'nameOnly');
    out.timestamp = out.timestamp || out.tsIso || new Date().toISOString();
    out.timestampLocal = out.timestampLocal || out.localTimestamp || bangkokTimestamp();
    return out;
  }

  function looksLikeFitness(payload, url) {
    const p = payload || {};
    const source = [url, p.api, p.game, p.gameId, p.game_id, p.routeName, p.sourceUrl, p.version, p.app]
      .map(clean).join(' ');
    if (String(p.api || '').toLowerCase() === 'fitness' || String(p.api || '').toLowerCase() === 'fitness_ar') return true;
    return FITNESS_RE.test(source);
  }

  function decorateObject(body, url) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) return body;
    if (looksLikeFitness(body, url)) return apply(body);
    const copy = Object.assign({}, body);
    if (copy.payload && typeof copy.payload === 'object' && looksLikeFitness(copy.payload, url)) {
      copy.payload = apply(copy.payload);
      return copy;
    }
    if (copy.row && typeof copy.row === 'object' && looksLikeFitness(copy.row, url)) {
      copy.row = apply(copy.row);
      return copy;
    }
    return body;
  }

  function decorateText(body, url) {
    if (typeof body !== 'string') return body;
    try {
      const parsed = JSON.parse(body);
      const decorated = decorateObject(parsed, url);
      return decorated === parsed ? body : JSON.stringify(decorated);
    } catch (_) { return body; }
  }

  function patchFetch() {
    if (typeof global.fetch !== 'function' || global.__fitnessStudentContextFetchPatched) return;
    const original = global.fetch.bind(global);
    global.fetch = function(input, init) {
      const url = typeof input === 'string' ? input : (input && input.url ? input.url : '');
      if (init && init.body !== undefined) {
        const next = Object.assign({}, init, { body: decorateText(init.body, url) });
        return original(input, next);
      }
      return original(input, init);
    };
    global.__fitnessStudentContextFetchPatched = true;
  }

  function patchBeacon() {
    if (!global.navigator || typeof global.navigator.sendBeacon !== 'function' || global.__fitnessStudentContextBeaconPatched) return;
    const original = global.navigator.sendBeacon.bind(global.navigator);
    global.navigator.sendBeacon = function(url, data) {
      return original(url, typeof data === 'string' ? decorateText(data, url) : data);
    };
    global.__fitnessStudentContextBeaconPatched = true;
  }

  global.FitnessStudentContext = {
    get: get,
    save: save,
    apply: apply,
    isReady: function() {
      const ctx = get();
      return !!ctx.studentName && !!(ctx.studentId || ctx.playerId);
    },
    clear: function() { try { global.localStorage.removeItem(STORAGE_KEY); } catch (_) {} }
  };

  patchFetch();
  patchBeacon();
})(window);
