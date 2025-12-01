// === /herohealth/vr/mission.js
// Generic MissionDeck — ใช้จัดการ Goals / Mini quests
//
// new MissionDeck({ goalPool, miniPool })
//
// goalPool / miniPool แต่ละอันมีรูปแบบ:
// {
//   id: 'g_green',
//   label: '...',
//   target: 30,
//   check: (state)=>boolean,
//   prog:  (state)=>number
// }
//
// state ที่ใช้ใน quest ครอบคลุม:
// stats = {
//   score, combo, comboMax,
//   goodCount, junkMiss,
//   tick, greenTick,   // ใช้กับ Hydration
//   ... (field เพิ่มเองได้)
// }
//
// methods ที่โหมดต่าง ๆ ใช้:
// - updateScore(score)
// - updateCombo(combo)
// - onGood()
// - onJunk()
// - second()                    // เรียกทุกวินาที
// - drawGoals(n)
// - draw3()                     // mini 3 อัน
// - getProgress('goals'|'mini') // คืน array พร้อม {progress, done}

'use strict';

export class MissionDeck {
  constructor(opts = {}) {
    this.goalPool = (opts.goalPool || []).slice();
    this.miniPool = (opts.miniPool || []).slice();

    this.goals = [];
    this.minis = [];

    this.stats = {
      score: 0,
      combo: 0,
      comboMax: 0,
      goodCount: 0,
      junkMiss: 0,
      tick: 0,
      greenTick: 0   // hydration ใช้
    };
  }

  // ----- internal helpers -----

  _cloneDefs(arr) {
    return arr.map(g => ({ ...g }));
  }

  _pickN(pool, n) {
    if (!pool.length) return [];
    const copy = pool.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    if (!n || n >= copy.length) return this._cloneDefs(copy);
    return this._cloneDefs(copy.slice(0, n));
  }

  _state() {
    return this.stats;
  }

  _progressList(list) {
    const s = this._state();
    return list.map(def => {
      const target   = typeof def.target === 'number' ? def.target : 0;
      const progress = typeof def.prog === 'function' ? Number(def.prog(s)) || 0 : 0;
      let done;
      if (typeof def.check === 'function') {
        done = !!def.check(s);
      } else if (target > 0) {
        done = progress >= target;
      } else {
        done = false;
      }
      return {
        ...def,
        target,
        progress,
        done
      };
    });
  }

  // ----- external API -----

  drawGoals(n = 2) {
    this.goals = this._pickN(this.goalPool, n);
  }

  draw3() {
    this.minis = this._pickN(this.miniPool, 3);
  }

  getProgress(kind) {
    if (kind === 'goals' || kind === 'goal') {
      return this._progressList(this.goals);
    }
    if (kind === 'mini' || kind === 'minis') {
      return this._progressList(this.minis);
    }
    return [];
  }

  updateScore(score) {
    const v = Number(score) || 0;
    this.stats.score = v;
  }

  updateCombo(combo) {
    const v = Number(combo) || 0;
    this.stats.combo = v;
    if (v > (this.stats.comboMax || 0)) {
      this.stats.comboMax = v;
    }
  }

  onGood() {
    this.stats.goodCount = (this.stats.goodCount || 0) + 1;
  }

  onJunk() {
    this.stats.junkMiss = (this.stats.junkMiss || 0) + 1;
  }

  // เรียกทุกวินาทีจากโหมด (ผ่าน onSec → deck.second())
  second() {
    this.stats.tick = (this.stats.tick || 0) + 1;
  }
}

export default { MissionDeck };
