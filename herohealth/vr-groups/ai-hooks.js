// /herohealth/vr-groups/ai-hooks.js
// Groups AI hooks
// PATCH v20260405-groups-ai-hooks-r1

export const GROUPS_PATCH_AI = 'v20260405-groups-ai-hooks-r1';

export function createGroupsAiHooks({
  enabled = true,
  adaptive = true,
  coach = true,
  deterministic = false
} = {}){
  function adjustSpawn(preset = {}, runtime = {}){
    if (!enabled || !adaptive) return { ...preset };

    const wrong = Number(runtime.wrong || 0);
    const miss = Number(runtime.miss || 0);
    const streak = Number(runtime.streak || 0);

    const next = { ...preset };

    if (wrong + miss >= 4){
      next.spawnMs = Math.round((next.spawnMs || 900) * 1.08);
      next.speedMin = Math.max(42, Math.round((next.speedMin || 60) * 0.94));
      next.speedMax = Math.max(next.speedMin + 6, Math.round((next.speedMax || 100) * 0.94));
      next.sizeMin = Math.round((next.sizeMin || 74) + 4);
      next.sizeMax = Math.round((next.sizeMax || 96) + 4);
    }

    if (streak >= 8){
      next.spawnMs = Math.round((next.spawnMs || 900) * 0.95);
      next.speedMin = Math.round((next.speedMin || 60) * 1.04);
      next.speedMax = Math.round((next.speedMax || 100) * 1.05);
    }

    return next;
  }

  function coachTip(runtime = {}){
    if (!enabled || !coach) return '';

    const wrong = Number(runtime.wrong || 0);
    const miss = Number(runtime.miss || 0);
    const streak = Number(runtime.streak || 0);

    if (miss >= 3) return 'โค้ช: ลองแตะเร็วขึ้นอีกนิดก่อนเป้าจะหลุดนะ';
    if (wrong >= 3) return 'โค้ช: ดูชื่อหมู่กับไอคอนก่อนแตะ จะช่วยให้แม่นขึ้น';
    if (streak >= 5) return 'โค้ช: ดีมาก รักษา streak นี้ไว้เลย';
    return '';
  }

  function onRoundStart({ ctx, state } = {}){
    return {
      enabled,
      adaptive,
      coach,
      deterministic,
      view: ctx?.view || 'mobile',
      diff: ctx?.diff || 'normal',
      seedMode: deterministic ? 'deterministic' : 'adaptive',
      priorWrong: Number(state?.wrong || 0),
      priorMiss: Number(state?.miss || 0),
      priorStreak: Number(state?.streak || 0)
    };
  }

  return {
    adjustSpawn,
    coachTip,
    onRoundStart
  };
}
