/**
 * HeroHealth Fitness • Student Context Bridge
 * File: /fitness/fitness-student-context-bridge.js
 * Version: v20260620-STUDENT-CONTEXT-BRIDGE-V1
 *
 * Include once in each Fitness game page:
 * <script src="./fitness-student-context-bridge.js"></script>
 *
 * Before sending a result:
 * payload = window.FitnessStudentContext.apply(payload);
 */

(function (global) {
  'use strict';

  const STORAGE_KEY = 'herohealth:fitness:student-context:v1';

  function clean(value) {
    return String(value == null ? '' : value).trim();
  }

  function params() {
    try {
      return new URLSearchParams(global.location.search || '');
    } catch (_) {
      return new URLSearchParams();
    }
  }

  function loadSaved() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') || {};
    } catch (_) {
      return {};
    }
  }

  function fromQuery() {
    const q = params();
    return {
      studentId: clean(q.get('studentId') || q.get('sid') || q.get('student_id')),
      studentName: clean(q.get('studentName') || q.get('name') || q.get('student_name')),
      classId: clean(q.get('classId') || q.get('class') || q.get('classGroup') || q.get('group')),
      section: clean(q.get('section') || q.get('sec')),
      playerId: clean(q.get('playerId') || q.get('pid') || q.get('player_id'))
    };
  }

  function merge() {
    const saved = loadSaved();
    const query = fromQuery();

    return {
      studentId: query.studentId || clean(saved.studentId),
      studentName: query.studentName || clean(saved.studentName),
      classId: query.classId || clean(saved.classId),
      section: query.section || clean(saved.section),
      playerId: query.playerId || clean(saved.playerId)
    };
  }

  function identityStatus(ctx) {
    if (ctx.studentId) return 'student_id';
    if (ctx.playerId) return 'player_id';
    if (ctx.studentName) return 'name_only';
    return 'missing';
  }

  function save(next) {
    const old = loadSaved();
    const value = Object.assign({}, old, next || {});
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    return value;
  }

  function get() {
    return merge();
  }

  function apply(payload) {
    const ctx = merge();
    payload = Object.assign({}, payload || {});

    payload.studentId = clean(payload.studentId || payload.student_id || ctx.studentId);
    payload.studentName = clean(payload.studentName || payload.student_name || payload.player || payload.name || ctx.studentName);
    payload.classId = clean(payload.classId || payload.class_id || payload.classGroup || ctx.classId);
    payload.section = clean(payload.section || payload.sec || ctx.section);
    payload.playerId = clean(payload.playerId || payload.player_id || payload.pid || ctx.playerId);

    payload.identitySource = payload.studentId ? 'studentId' : (payload.playerId ? 'playerId' : 'nameOnly');
    payload.timestamp = payload.timestamp || new Date().toISOString();
    payload.timestampLocal = payload.timestampLocal || new Date().toLocaleString('sv-SE', {
      timeZone: 'Asia/Bangkok',
      hour12: false
    }).replace(' ', 'T');

    return payload;
  }

  function isReady() {
    const ctx = merge();
    return !!(ctx.studentId || ctx.playerId) && !!ctx.studentName;
  }

  global.FitnessStudentContext = {
    get: get,
    save: save,
    apply: apply,
    isReady: isReady,
    identityStatus: function () { return identityStatus(merge()); },
    clear: function () { localStorage.removeItem(STORAGE_KEY); }
  };
})(window);
