/* UX Quest • Progress Store v4
 * Shared local-first progress for the full CSAI2601 campaign.
 * Keeps existing uxq.act1.progress.v2 data so current learners retain progress.
 */
(() => {
  'use strict';

  const KEY = 'uxq.act1.progress.v2';
  const LEGACY_KEY = 'uxq.act1.progress.v1';
  const ACT1_IDS = ['w1', 'w2', 'w3', 'b1'];
  const ACT2_IDS = ['w4', 'w5', 'w6', 'b2'];
  const ACT3_IDS = ['w7', 'b3'];
  const ACT4_IDS = ['w9', 'w10', 'w11', 'b4'];
  const ACT5_IDS = ['w12', 'w13', 'w14', 'b5'];
  const MISSION_IDS = [...ACT1_IDS, ...ACT2_IDS, ...ACT3_IDS, ...ACT4_IDS, ...ACT5_IDS];
  const memory = new Map();
  let storageMode = 'local';

  function fresh(){
    return {
      version: 4,
      updatedAt: null,
      missions: {},
      act1: { completed: false, bestScore: 0, totalStars: 0 },
      act2: { completed: false, bestScore: 0, totalStars: 0 },
      act3: { completed: false, bestScore: 0, totalStars: 0 },
      act4: { completed: false, bestScore: 0, totalStars: 0 },
      act5: { completed: false, bestScore: 0, totalStars: 0 },
      quest: { completedNodes: 0, bestScore: 0, totalStars: 0 }
    };
  }

  function safeRead(area, key){
    try { return area.getItem(key); }
    catch (error) { return null; }
  }

  function getItem(key){
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
    base.missions = value.missions && typeof value.missions === 'object' ? value.missions : {};
    base.updatedAt = value.updatedAt || null;
    base.act1 = Object.assign(base.act1, value.act1 || {});
    base.act2 = Object.assign(base.act2, value.act2 || {});
    base.act3 = Object.assign(base.act3, value.act3 || {});
    base.act4 = Object.assign(base.act4, value.act4 || {});
    base.act5 = Object.assign(base.act5, value.act5 || {});
    base.quest = Object.assign(base.quest, value.quest || {});
    return base;
  }

  function parse(raw){
    try { return clean(JSON.parse(raw)); }
    catch (error) { return null; }
  }

  function get(){
    return parse(storage.getItem(KEY)) || parse(storage.getItem(LEGACY_KEY)) || fresh();
  }

  function statFor(ids, missions){
    const rows = ids.map((id) => missions[id] || {});
    return {
      completed: ids.every((id) => Number(missions[id]?.bestStars || 0) >= 2),
      bestScore: Math.max(0, ...rows.map((row) => Number(row.bestScore || 0))),
      totalStars: rows.reduce((sum, row) => sum + Math.max(0, Number(row.bestStars || 0)), 0)
    };
  }

  function save(progress){
    const next = clean(progress);
    next.version = 4;
    next.updatedAt = new Date().toISOString();
    const missions = next.missions || {};
    next.act1 = statFor(ACT1_IDS, missions);
    next.act2 = statFor(ACT2_IDS, missions);
    next.act3 = statFor(ACT3_IDS, missions);
    next.act4 = statFor(ACT4_IDS, missions);
    next.act5 = statFor(ACT5_IDS, missions);
    const all = MISSION_IDS.map((id) => missions[id] || {});
    next.quest = {
      completedNodes: MISSION_IDS.filter((id) => Number(missions[id]?.bestStars || 0) >= 2).length,
      bestScore: Math.max(0, ...all.map((row) => Number(row.bestScore || 0))),
      totalStars: all.reduce((sum, row) => sum + Math.max(0, Number(row.bestStars || 0)), 0)
    };
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

  function resetQuest(){
    removeItem(KEY);
    removeItem(LEGACY_KEY);
    MISSION_IDS.forEach((id) => {
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
    ACT1_IDS,
    ACT2_IDS,
    ACT3_IDS,
    ACT4_IDS,
    ACT5_IDS,
    MISSION_IDS,
    get,
    save,
    recordMission,
    missionPassed,
    resetQuest,
    resetAct1: resetQuest,
    storage
  });
})();
