// /herohealth/vr-brush-kids/brush.scan.js

export function createBrushScanEngine(config = {}) {
  let state = null;

  function makeTargets(targetGoal = 3) {
    const base = [
      { id: 't1', zoneId: 'upper-front', type: 'heavyPlaque', special: true },
      { id: 't2', zoneId: 'upper-left', type: 'gumRisk', special: false },
      { id: 't3', zoneId: 'lower-right', type: 'gapFood', special: false },
      { id: 't4', zoneId: 'lower-front', type: 'decoy', special: false },
      { id: 't5', zoneId: 'upper-right', type: 'heavyPlaque', special: false }
    ];
    return base.slice(0, Math.max(targetGoal + 1, 4));
  }

  return {
    start(ctx = {}) {
      state = {
        active: true,
        roundId: `scan-${Date.now()}`,
        startedAtMs: performance.now(),
        durationSec: ctx.durationSec || config.durationSec || 5,
        targetGoal: ctx.targetGoal || config.targetGoal || 3,
        targets: makeTargets(ctx.targetGoal || config.targetGoal || 3),
        picked: new Set(),
        hits: 0,
        misses: 0,
        specialHits: 0
      };
      return state;
    },
    pickTarget(targetId) {
      if (!state?.active) return { ok: false };
      if (state.picked.has(targetId)) return { ok: false, repeat: true };

      state.picked.add(targetId);
      const t = state.targets.find(x => x.id === targetId);
      if (t && t.type !== 'decoy') {
        state.hits += 1;
        if (t.special) state.specialHits += 1;
        return { ok: true, hit: true, target: t };
      }
      state.misses += 1;
      return { ok: true, hit: false, target: t || null };
    },
    tick() {
      if (!state?.active) return;
      const elapsedSec = (performance.now() - state.startedAtMs) / 1000;
      if (elapsedSec >= state.durationSec) state.active = false;
      if (state.hits >= state.targetGoal) state.active = false;
    },
    isComplete() {
      if (!state) return true;
      return !state.active || state.hits >= state.targetGoal;
    },
    buildResult() {
      if (!state) return null;
      const attempts = state.hits + state.misses;
      return {
        played: true,
        roundId: state.roundId,
        hits: state.hits,
        misses: state.misses,
        specialHits: state.specialHits,
        targetGoal: state.targetGoal,
        accuracyPercent: attempts ? Math.round((state.hits / attempts) * 100) : 0,
        completedGoal: state.hits >= state.targetGoal,
        finishedInMs: Math.round(performance.now() - state.startedAtMs)
      };
    }
  };
}
