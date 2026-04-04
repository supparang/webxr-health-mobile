// /herohealth/vr-groups/ai-hooks.js
// Groups Solo AI Hooks
// PATCH v20260404-groups-aihooks-r1

export const GROUPS_PATCH_AI = 'v20260404-groups-aihooks-r1';

export function createGroupsAiHooks(config = {}){
  const enabled = !!config.enabled;
  const adaptive = !!config.adaptive;
  const coach = !!config.coach;
  const deterministic = !!config.deterministic;

  function onRoundStart(ctx){
    return {
      enabled,
      adaptive,
      coach,
      deterministic,
      note: 'round-start'
    };
  }

  function adjustSpawn(preset, live = {}){
    if (!enabled || !adaptive) return preset;

    const wrong = Number(live.wrong || 0);
    const streak = Number(live.streak || 0);
    const next = { ...preset };

    if (wrong >= 5 && streak <= 1){
      next.spawnMs = Math.round(next.spawnMs * 1.08);
      next.speedMin = Math.max(16, Math.round(next.speedMin * 0.95));
      next.speedMax = Math.max(next.speedMin + 4, Math.round(next.speedMax * 0.95));
    } else if (streak >= 7){
      next.spawnMs = Math.round(next.spawnMs * 0.95);
      next.speedMin = Math.round(next.speedMin * 1.04);
      next.speedMax = Math.round(next.speedMax * 1.04);
    }

    return next;
  }

  function coachTip(live = {}){
    if (!enabled || !coach) return '';

    const streak = Number(live.streak || 0);
    const wrong = Number(live.wrong || 0);
    const miss = Number(live.miss || 0);

    if (streak >= 8) return 'โค้ช AI: แม่นมาก ลองเก็บให้ไวขึ้นอีกนิด ⚡';
    if ((wrong + miss) >= 6) return 'โค้ช AI: มองชื่อหมู่ด้านบนก่อนแตะ จะช่วยได้มาก 💡';
    return '';
  }

  return {
    onRoundStart,
    adjustSpawn,
    coachTip
  };
}