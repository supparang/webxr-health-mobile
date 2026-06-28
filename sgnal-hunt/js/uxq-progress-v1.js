/* UX Quest • Act I Progress Store
   Local-first progress for W1 → W2 → W3 → B1.
*/
(() => {
  'use strict';

  const KEY = 'uxq.act1.progress.v1';
  const MISSION_IDS = ['w1', 'w2', 'w3', 'b1'];

  function fresh(){
    return {
      version: 1,
      updatedAt: null,
      missions: {},
      act1: { completed: false, bestScore: 0, totalStars: 0 }
    };
  }

  function clean(value){
    const base = fresh();
    if (!value || typeof value !== 'object') return base;
    const missions = value.missions && typeof value.missions === 'object' ? value.missions : {};
    base.missions = missions;
    base.updatedAt = value.updatedAt || null;
    base.act1 = Object.assign(base.act1, value.act1 || {});
    return base;
  }

  function get(){
    try { return clean(JSON.parse(localStorage.getItem(KEY))); }
    catch (error) { return fresh(); }
  }

  function save(progress){
    const next = clean(progress);
    next.updatedAt = new Date().toISOString();
    const missions = next.missions || {};
    const all = MISSION_IDS.map(id => missions[id] || {});
    next.act1 = {
      completed: MISSION_IDS.every(id => Number(missions[id]?.bestStars || 0) >= 2),
      bestScore: Math.max(0, ...all.map(m => Number(m.bestScore || 0))),
      totalStars: all.reduce((sum, m) => sum + Math.max(0, Number(m.bestStars || 0)), 0)
    };
    localStorage.setItem(KEY, JSON.stringify(next));
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
    const history = Array.isArray(previous.history) ? previous.history.slice(-7) : [];
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
    localStorage.removeItem(KEY);
    Object.keys(localStorage)
      .filter(k => k.startsWith('uxq.recent.') || k.startsWith('uxq.run.'))
      .forEach(k => localStorage.removeItem(k));
    window.dispatchEvent(new CustomEvent('uxq-progress-updated', { detail: fresh() }));
  }

  window.UXQProgress = Object.freeze({ KEY, get, save, recordMission, missionPassed, resetAct1 });
})();
