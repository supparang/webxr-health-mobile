// === /fitness/js/ai-pattern.js ===
// Pattern Generator (seedable; fair; avoids impossible clusters)
// ✅ Export: AIPattern
// - nextTargetType(diff, state) => 'normal'|'decoy'|'bomb'|'heal'|'shield'|'bossface'
// - sizePx(diff) base target size per difficulty

'use strict';

function clamp(v,a,b){ return Math.max(a, Math.min(b, Number(v)||0)); }

export class AIPattern {
  constructor(opts = {}){
    this.cfg = Object.assign({
      // base chances (will be modulated)
      pDecoy: 0.08,
      pBomb: 0.06,
      pHeal: 0.06,
      pShield: 0.06,

      // constraints
      maxBadStreak: 2,
      healIfHpBelow: 0.42,
      shieldIfLow: 0.30,

      // size (px)
      sizeEasy: 150,
      sizeNormal: 125,
      sizeHard: 110
    }, opts||{});

    this.reset();
  }

  reset(){
    this.badStreak = 0;
    this.lastType = 'normal';
  }

  sizePx(diff){
    const d = (diff||'normal').toLowerCase();
    if (d === 'easy') return this.cfg.sizeEasy;
    if (d === 'hard') return this.cfg.sizeHard;
    return this.cfg.sizeNormal;
  }

  nextTargetType(diff, s = {}){
    const youHp = clamp(s.youHpPct ?? 1, 0, 1);
    const bossHp = clamp(s.bossHpPct ?? 1, 0, 1);
    const fever = clamp(s.feverPct ?? 0, 0, 1);
    const shield = clamp((s.shield ?? 0) / 3, 0, 1);

    // If boss nearly dead → sometimes show bossface (one-shot)
    if (bossHp <= 0.12 && !s.bossfaceShown) {
      this.lastType = 'bossface';
      this.badStreak = 0;
      return 'bossface';
    }

    // helpers / survival
    if (youHp < this.cfg.healIfHpBelow) {
      this.lastType = 'heal';
      this.badStreak = 0;
      return 'heal';
    }
    if (youHp < this.cfg.shieldIfLow && shield < 0.34) {
      this.lastType = 'shield';
      this.badStreak = 0;
      return 'shield';
    }

    // reduce “bad” targets if already streaking bad
    const badCap = this.badStreak >= this.cfg.maxBadStreak ? 0.02 : 1.0;

    let pDecoy = this.cfg.pDecoy * badCap;
    let pBomb  = this.cfg.pBomb  * badCap;

    // during FEVER → prefer normal for reward feeling
    if (fever > 0.85) {
      pDecoy *= 0.45;
      pBomb  *= 0.45;
    }

    // difficulty modulation
    const d = (diff||'normal').toLowerCase();
    if (d === 'easy') { pDecoy *= 0.70; pBomb *= 0.65; }
    if (d === 'hard') { pDecoy *= 1.25; pBomb *= 1.30; }

    const pHeal  = this.cfg.pHeal  * (youHp < 0.70 ? 1.15 : 0.85);
    const pShield= this.cfg.pShield* (shield < 0.40 ? 1.10 : 0.80);

    const r = Math.random();
    const p0 = pBomb;
    const p1 = p0 + pDecoy;
    const p2 = p1 + pHeal;
    const p3 = p2 + pShield;

    let type = 'normal';
    if (r < p0) type = 'bomb';
    else if (r < p1) type = 'decoy';
    else if (r < p2) type = 'heal';
    else if (r < p3) type = 'shield';

    // track streak
    if (type === 'bomb' || type === 'decoy') this.badStreak++;
    else this.badStreak = Math.max(0, this.badStreak - 1);

    this.lastType = type;
    return type;
  }
}