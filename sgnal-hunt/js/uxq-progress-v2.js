/* UX Quest • Act I Progress Store v2
   Local-first progress for W1 → W2 → W3 → B1.
   Storage-safe: localStorage → sessionStorage → memory fallback.
*/
(() => {
  'use strict';

  const KEY = 'uxq.act1.progress.v2';
  const LEGACY_KEY = 'uxq.act1.progress.v1';
  const MISSION_IDS = ['w1', 'w2', 'w3', 'b1'];
  const memory = new Map();
  let storageMode = 'local';

  function fresh(){
    return {
      version: 2,
      updatedAt: null,
      missions: {},
      act1: { completed: false, bestScore: 0, totalStars: 0 }
    };
  }

  function safeRead(area, key){
    try { return area.getItem(key); }
    catch (error) { return null; }
  }

  function getItem(key){
    // Session data wins during this tab session, allowing a quota fallback to stay current.
    const session = safeRead(window.sessionStorage, key);
    if (session !== null) return session;
    const local = safeRead(window.localStorage, key);
    if (local !== null) return local;
    return memory.has(key) ? memory.get(key) : null;
  }

  function setItem(key, value){
    const text = String(value);
    try {
      window.localStorage.setItem(key, text);
      try { window.sessionStorage.removeItem(key); } catch (error) {}
      memory.delete(key);
      storageMode = 'local';
      return storageMode;
    } catch (error) {}

    try {
      window.sessionStorage.setItem(key, text);
      memory.delete(key);
      storageMode = 'session';
      return storageMode;
    } catch (error) {}

    memory.set(key, text);
    storageMode = 'memory';
    return storageMode;
  }

  function removeItem(key){
    try { window.sessionStorage.removeItem(key); } catch (error) {}
    try { window.localStorage.removeItem(key); } catch (error) {}
    memory.delete(key);
  }

  const storage = Object.freeze({ getItem, setItem, removeItem, getMode: () => storageMode });

  function clean(value){
    const base = fresh();
    if (!value || typeof value !== 'object') return base;
    const missions = value.missions && typeof value.missions === 'object' ? value.missions : {};
    base.missions = missions;
    base.updatedAt = value.updatedAt || null;
    base.act1 = Object.assign(base.act1, value.act1 || {});
    return base;
  }

  function parse(raw){
    try { return clean(JSON.parse(raw)); }
    catch (error) { return null; }
  }

  function get(){
    // Prefer v2, then read v1 once so existing learners do not lose progress after the hotfix.
    return parse(storage.getItem(KEY)) || parse(storage.getItem(LEGACY_KEY)) || fresh();
  }

  function save(progress){
    const next = clean(progress);
    next.version = 2;
    next.updatedAt = new Date().toISOString();
    const missions = next.missions || {};
    const all = MISSION_IDS.map(id => missions[id] || {});
    next.act1 = {
      completed: MISSION_IDS.every(id => Number(missions[id]?.bestStars || 0) >= 2),
      bestScore: Math.max(0, ...all.map(m => Number(m.bestScore || 0))),
      totalStars: all.reduce((sum, m) => sum + Math.max(0, Number(m.bestStars || 0)), 0)
    };
    // The result remains available even when persistent browser storage is unavailable.
    storage.setItem(KEY, JSON.stringify(next));
    storage.removeItem(LEGACY_KEY);
    window.dispatchEvent(new CustomEvent('uxq-progress-updated', { detail: next }));
    return next;
  }

  function recordMission(id, result){
    if (!MISSION_IDS.includes(id)) throw new Error(`Unknown UX Quest mission: ${id}`);
    const progress = get();
    const previous = progress.missions[id] || {};
    const attempt = {
      completedAt: result.completedAt || new Date().toISOString(),
      score: Number(result.score || 0),
      stars: Number(result.stars || 0),
      accuracy: Number(result.accuracy || 0),
      correct: Number(result.correct || 0),
      total: Number(result.total || 0),
      hints: Number(result.hints || 0),
      durationSec: Number(result.durationSec || 0),
      passed: Boolean(result.passed),
      badge: String(result.badge || '')
    };
    // Retain only the latest three summaries; this is enough for replay reflection without growing storage.
    const history = Array.isArray(previous.history) ? previous.history.slice(-2) : [];
    history.push(attempt);
    progress.missions[id] = {
      id,
      attempts: Number(previous.attempts || 0) + 1,
      completed: Boolean(previous.completed || attempt.passed),
      bestScore: Math.max(Number(previous.bestScore || 0), attempt.score),
      bestStars: Math.max(Number(previous.bestStars || 0), attempt.stars),
      bestAccuracy: Math.max(Number(previous.bestAccuracy || 0), attempt.accuracy),
      bestCorrect: Math.max(Number(previous.bestCorrect || 0), attempt.correct),
      lastResult: attempt,
      lastCompletedAt: attempt.completedAt,
      history
    };
    return save(progress);
  }

  function missionPassed(id){
    return Number(get().missions?.[id]?.bestStars || 0) >= 2;
  }

  function resetAct1(){
    removeItem(KEY);
    removeItem(LEGACY_KEY);
    MISSION_IDS.forEach(id => {
      removeItem(`uxq.recent.${id}.v1`);
      removeItem(`uxq.recent.${id}.v2`);
      removeItem(`uxq.run.${id}.v1`);
      removeItem(`uxq.run.${id}.v2`);
    });
    window.dispatchEvent(new CustomEvent('uxq-progress-updated', { detail: fresh() }));
  }

  window.UXQProgress = Object.freeze({
    KEY,
    LEGACY_KEY,
    get,
    save,
    recordMission,
    missionPassed,
    resetAct1,
    storage
  });
})();
