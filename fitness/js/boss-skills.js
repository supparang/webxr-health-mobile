// === /fitness/js/boss-skills.js ===
// Boss Skills — inject excitement based on player form (PLAY only)
'use strict';

export const BOSS_SKILLS = Object.freeze({
  NONE: 'NONE',
  DECOY_STORM: 'DECOY_STORM',
  BOMB_BURST: 'BOMB_BURST',
  MIRROR_SWAP: 'MIRROR_SWAP',
  SHIELD_DRAIN: 'SHIELD_DRAIN'
});

export class BossSkillController {
  constructor(opts = {}) {
    this.cfg = Object.assign({
      cooldownMs: 6500,
      minPhase: 2
    }, opts);
    this.reset();
  }

  reset() {
    this.active = BOSS_SKILLS.NONE;
    this.until = 0;
    this.nextAllowedAt = 0;
  }

  maybeActivate(now, state, predictor, zoneInfo) {
    if (!state || !predictor) return null;
    if (state.bossPhase < this.cfg.minPhase) return null;
    if (now < this.nextAllowedAt) return null;
    if (state.feverOn) return null; // อย่าแย่ง spotlight ตอนผู้เล่น FEVER

    const p = predictor.predict();
    const all = zoneInfo?.all || zoneInfo || {};
    const struggling = (p.label === 'HIGH') || (all.missRate > 0.22) || (all.rtAvg > 560);

    // ถ้าผู้เล่นกำลังล้า -> ไม่ซ้ำเติมมาก เลือก DECOY_STORM เบา ๆ หรือ NONE
    // ถ้าผู้เล่นฟอร์มดี -> ใส่ BOMB_BURST / MIRROR_SWAP ให้สนุก
    let pick = null;

    if (!struggling) {
      if (state.bossPhase === 2) pick = Math.random() < 0.55 ? BOSS_SKILLS.DECOY_STORM : BOSS_SKILLS.BOMB_BURST;
      else pick = Math.random() < 0.55 ? BOSS_SKILLS.MIRROR_SWAP : BOSS_SKILLS.BOMB_BURST;
    } else {
      pick = Math.random() < 0.7 ? BOSS_SKILLS.DECOY_STORM : BOSS_SKILLS.NONE;
    }

    if (pick && pick !== BOSS_SKILLS.NONE) {
      this.active = pick;
      this.until = now + 3200;
      this.nextAllowedAt = now + this.cfg.cooldownMs;
      return pick;
    }
    return null;
  }

  isActive(now, skill) {
    if (now >= this.until) {
      this.active = BOSS_SKILLS.NONE;
      return false;
    }
    return this.active === skill;
  }

  label(now) {
    if (now >= this.until) return '';
    switch (this.active) {
      case BOSS_SKILLS.DECOY_STORM: return 'BOSS SKILL: DECOY STORM';
      case BOSS_SKILLS.BOMB_BURST: return 'BOSS SKILL: BOMB BURST';
      case BOSS_SKILLS.MIRROR_SWAP: return 'BOSS SKILL: MIRROR SWAP';
      case BOSS_SKILLS.SHIELD_DRAIN: return 'BOSS SKILL: SHIELD DRAIN';
      default: return '';
    }
  }
}