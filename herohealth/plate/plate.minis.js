// === /herohealth/plate/plate.minis.js ===
// PlateVR Minis (7) — definitions only
// ใช้กับ plate.quest.js (Quest Director)

'use strict';

export const PLATE_MINIS = [
  {
    key: 'plateRush',
    title: 'Plate Rush (8s)',
    hint: 'ครบ 5 หมู่ใน 8 วิ • ห้ามโดนขยะระหว่างทำ',
    dur: 8000,
    init(ctx, state){
      ctx.got = new Set();
      ctx.fail = false;
    },
    onHit(ctx, state, hit){
      // hit: {kind, group}
      if (!hit) return;
      if (hit.kind === 'junk' || hit.kind === 'trap' || hit.kind === 'boss' || hit.kind === 'boss_attack') ctx.fail = true;
      if (hit.kind === 'good' && hit.group >= 1 && hit.group <= 5) ctx.got.add(hit.group);
      if (hit.kind === 'gold' && hit.group >= 1 && hit.group <= 5) ctx.got.add(hit.group);
    },
    progress(ctx){
      return `${(ctx.got ? ctx.got.size : 0)}/5`;
    },
    isClear(ctx){
      return (ctx.got && ctx.got.size >= 5) && !ctx.fail;
    }
  },

  {
    key: 'perfectStreak',
    title: 'Perfect Streak',
    hint: 'PERFECT ติดกัน 5 ครั้ง',
    dur: 11000,
    init(ctx){
      ctx.st = 0;
    },
    onJudge(ctx, state, judge){
      if (judge === 'PERFECT') ctx.st++;
      else if (judge && judge !== 'HIT') ctx.st = 0;
    },
    progress(ctx){
      return `${ctx.st || 0}/5`;
    },
    isClear(ctx){
      return (ctx.st || 0) >= 5;
    }
  },

  {
    key: 'goldHunt',
    title: 'Gold Hunt (12s)',
    hint: 'เก็บ ⭐ Gold 2 อัน',
    dur: 12000,
    init(ctx){
      ctx.g = 0;
    },
    onHit(ctx, state, hit){
      if (hit && hit.kind === 'gold') ctx.g++;
    },
    progress(ctx){
      return `${ctx.g || 0}/2`;
    },
    isClear(ctx){
      return (ctx.g || 0) >= 2;
    }
  },

  {
    key: 'comboSprint',
    title: 'Combo Sprint (15s)',
    hint: 'คอมโบถึง 8 ภายใน 15 วิ',
    dur: 15000,
    init(ctx){
      ctx.best = 0;
    },
    tick(ctx, state){
      ctx.best = Math.max(ctx.best || 0, state.combo || 0);
    },
    progress(ctx, state){
      const v = Math.max(ctx.best || 0, state.combo || 0);
      return `${v}/8`;
    },
    isClear(ctx, state){
      const v = Math.max(ctx.best || 0, state.combo || 0);
      return v >= 8;
    }
  },

  {
    key: 'cleanAndCount',
    title: 'Clean & Count (10s)',
    hint: 'ของดี 4 ชิ้น • ห้ามโดนขยะ',
    dur: 10000,
    init(ctx){
      ctx.good = 0;
      ctx.fail = false;
    },
    onHit(ctx, state, hit){
      if (!hit) return;
      if (hit.kind === 'junk' || hit.kind === 'trap' || hit.kind === 'boss' || hit.kind === 'boss_attack') ctx.fail = true;
      if (hit.kind === 'good' || hit.kind === 'gold') ctx.good++;
    },
    progress(ctx){
      return `${ctx.good || 0}/4`;
    },
    isClear(ctx){
      return (ctx.good || 0) >= 4 && !ctx.fail;
    }
  },

  {
    key: 'noMiss',
    title: 'No-Miss (12s)',
    hint: '12 วิ ห้ามพลาด (รวมหมดอายุ)',
    dur: 12000,
    init(ctx, state){
      ctx.m0 = state.miss || 0;
      ctx.l0 = state.lives || 0;
    },
    isClear(ctx, state){
      return (state.miss || 0) === (ctx.m0 || 0) && (state.lives || 0) === (ctx.l0 || 0);
    }
  },

  {
    key: 'shine',
    title: 'Shine (10s)',
    hint: '10 วิ PERFECT 2 หรือ Power 1 ก็ผ่าน',
    dur: 10000,
    init(ctx){
      ctx.p = 0;
      ctx.pow = false;
    },
    onJudge(ctx, state, judge){
      if (judge === 'PERFECT') ctx.p++;
    },
    onPower(ctx){
      ctx.pow = true;
    },
    progress(ctx){
      return `P:${ctx.p || 0}/2 • POWER:${ctx.pow ? '1' : '0'}`;
    },
    isClear(ctx){
      return !!ctx.pow || (ctx.p || 0) >= 2;
    }
  },
];