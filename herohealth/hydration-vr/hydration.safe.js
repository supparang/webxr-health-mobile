// ======================================================
  //  จบเกม (เรียกเมื่อ sec = 0 หรือเคลียร์หมดก่อนเวลา)
  // ======================================================
  let ended = false;
  function finish(durationSec) {
    if (ended) return;
    ended = true;

    const greenTick    = deck.stats.greenTick | 0;
    const waterEnd     = waterPct;
    const waterZoneEnd = zoneFrom(waterPct);

    // ★ ใช้จำนวน "เซ็ต" ในการสรุป
    const goalsClearedSets = goalSetsDone;
    const goalsTotalSets   = GOAL_SETS_PER_RUN;
    const miniClearedSets  = miniSetsDone;
    const miniTotalSets    = MINI_SETS_PER_RUN;

    const goalClearedAll = goalsClearedSets >= goalsTotalSets;

    try {
      ROOT.dispatchEvent(new CustomEvent('hha:end', {
        detail: {
          mode: 'Hydration',
          modeLabel: 'Hydration',
          difficulty: diff,
          score,
          misses,
          comboMax,
          duration: durationSec,
          greenTick,

          // ★ สนใจว่า “เคลียร์ครบทุก goal set หรือยัง”
          goalCleared: goalClearedAll,

          // ★ field เดิม แต่เปลี่ยนให้เป็น “เซ็ต” แทนแก้วรวม
          goalsCleared: goalsClearedSets,
          goalsTotal:   goalsTotalSets,
          miniCleared:  miniClearedSets,
          miniTotal:    miniTotalSets,

          // ★ field ใหม่ (กันพลาด / เผื่อใช้ที่อื่น)
          goalSetsDone:   goalsClearedSets,
          goalSetsTotal:  goalsTotalSets,
          miniSetsDone:   miniClearedSets,
          miniSetsTotal:  miniTotalSets,

          waterStart,
          waterEnd,
          waterZoneEnd
        }
      }));
    } catch {}

    // ปิดท้ายด้วย status ended ให้ HUD / logger
    pushHudScore({ ended: true });
  }