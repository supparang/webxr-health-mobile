// === /herohealth/vr-groups/GameEngine.js ===
// Food Groups VR — Game Engine (emoji targets + Fever + Quest + Stats)
// 2025-12-13

'use strict';

const ROOT = (typeof window !== 'undefined' ? window : globalThis);
const A = ROOT.AFRAME;

if (!A) {
  console.error('[GroupsVR] AFRAME not found');
}

// ----- Global helpers from other modules -----
const Particles =
  (ROOT.GAME_MODULES && ROOT.GAME_MODULES.Particles) ||
  ROOT.Particles ||
  {
    burstAt () {},
    scorePop () {}
  };

const FeverUI =
  (ROOT.GAME_MODULES && ROOT.GAME_MODULES.FeverUI) ||
  ROOT.FeverUI ||
  {
    ensureFeverBar () {},
    setFever () {},
    setFeverActive () {},
    setShield () {}
  };

const { ensureFeverBar, setFever, setFeverActive } = FeverUI;

const EmojiImage =
  (ROOT.GAME_MODULES && (ROOT.GAME_MODULES.EmojiImage || ROOT.GAME_MODULES.emojiImage)) ||
  ROOT.EmojiImage ||
  ROOT.emojiImage ||
  null;

const GroupsQuestManager =
  (ROOT.GAME_MODULES && ROOT.GAME_MODULES.GroupsQuestManager) ||
  null;

const DiffAPI =
  (ROOT.HeroHealth && ROOT.HeroHealth.foodGroupsDifficulty) ||
  null;

// ---------- ข้อมูลอาหาร 5 หมู่ ----------
const GROUPS = {
  1: ['🍚','🍙','🍞','🥯','🥐'],                  // ข้าว-แป้ง
  2: ['🥩','🍗','🍖','🥚','🧀'],                  // โปรตีน
  3: ['🥦','🥕','🥬','🌽','🥗','🍅'],             // ผัก
  4: ['🍎','🍌','🍇','🍉','🍊','🍓','🍍'],         // ผลไม้
  5: ['🥛','🧈','🧀','🍨']                        // นม/ผลิตภัณฑ์นม
};

const GOOD_EMOJI = Object.values(GROUPS).flat();
const BAD_EMOJI  = ['🍔','🍟','🍕','🍩','🍪','🧋','🥤','🍫','🍬','🥓'];

function foodGroup (emo) {
  for (const [g, arr] of Object.entries(GROUPS)) {
    if (arr.indexOf(emo) !== -1) return parseInt(g, 10);
  }
  return 0;
}

// ---- Grade helper ----
function computeGrade (metrics) {
  const {
    score = 0,
    misses = 0,
    goalsCleared = 0,
    goalsTotal = 0,
    questsCleared = 0,
    questsTotal = 0,
    diff = 'normal'
  } = metrics || {};

  const sNorm       = Math.min(1, (Number(score) || 0) / 400);
  const goalRate    = goalsTotal  > 0 ? goalsCleared  / goalsTotal  : 0;
  const questRate   = questsTotal > 0 ? questsCleared / questsTotal : 0;
  const missPenalty = Math.min(0.4, (Number(misses) || 0) * 0.03);

  let index = 0;
  index += questRate * 0.55;
  index += goalRate  * 0.25;
  index += sNorm     * 0.20;
  index -= missPenalty;

  const d = String(diff || 'normal').toLowerCase();
  if (d === 'hard')  index += 0.05;
  if (d === 'easy')  index -= 0.03;

  if (index < 0) index = 0;
  if (index > 1) index = 1;

  if (index >= 0.88) return 'SSS';
  if (index >= 0.78) return 'SS';
  if (index >= 0.68) return 'S';
  if (index >= 0.58) return 'A';
  if (index >= 0.42) return 'B';
  return 'C';
}

function coach (text) {
  if (!text) return;
  try {
    ROOT.window.dispatchEvent(new CustomEvent('hha:coach', {
      detail: { text }
    }));
  } catch (err) {
    console.warn('[GroupsVR] coach event error', err);
  }
}

function randItem (arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ------------------------------------------------------------
// GameEngine class
// ------------------------------------------------------------

class GameEngine {
  constructor (opts = {}) {
    this.diffKey = String(opts.difficulty || 'normal').toLowerCase();
    if (this.diffKey !== 'easy' && this.diffKey !== 'hard' && this.diffKey !== 'normal') {
      this.diffKey = 'normal';
    }

    let dur = Number(opts.duration || 60);
    if (!Number.isFinite(dur) || dur <= 0) dur = 60;
    if (dur < 20) dur = 20;
    if (dur > 180) dur = 180;
    this.duration = dur;

    this.sceneEl  = null;
    this.cameraEl = null;

    this.diffCfg = (DiffAPI && DiffAPI.get && DiffAPI.get(this.diffKey)) || {
      spawnInterval: 1100,
      lifetime:      2300,
      maxActive:     4,
      scale:         1.0,
      feverGainHit:  7,
      feverLossMiss: 16
    };

    // stats
    this.score     = 0;
    this.combo     = 0;
    this.comboMax  = 0;
    this.misses    = 0;
    this.fever     = 0;
    this.feverActive = false;

    this.goodHits  = 0;
    this.badHits   = 0;
    this.groupCounts = [0, 0, 0, 0, 0];

    this.targets = new Set();
    this.spawnTimer = null;
    this.ended = false;

    // quest
    this.questMgr = GroupsQuestManager ? new GroupsQuestManager() : null;
    this.goalsCleared = 0;
    this.goalsTotal   = 0;
    this.questsCleared = 0;
    this.questsTotal   = 0;

    this._onTime = this._onTime.bind(this);

    if (!EmojiImage) {
      console.warn('[GroupsVR] EmojiImage helper not found – targets will be white circles');
    }
  }

  initScene () {
    this.sceneEl = ROOT.document.querySelector('a-scene');
    if (!this.sceneEl) {
      console.error('[GroupsVR] <a-scene> not found');
      return;
    }
    this.cameraEl = this.sceneEl.querySelector('#gj-camera') ||
                    this.sceneEl.querySelector('[camera]');
  }

  start () {
    this.initScene();
    if (!this.sceneEl) return;

    ensureFeverBar();
    setFever(0);
    setFeverActive(false);
    this.fever = 0;
    this.feverActive = false;

    if (this.questMgr) {
      this.questMgr.start(this.diffKey, {
        quest: { goalsPick: 2, miniPick: 3 }
      });
      const s = this.questMgr.getSummary();
      if (s) {
        this.goalsTotal    = s.totalGoals   || 0;
        this.questsTotal   = s.totalMinis   || 0;
        this.goalsCleared  = s.clearedGoals || 0;
        this.questsCleared = s.clearedMinis || 0;
      }
    }

    this.emitStat(); // ส่งค่าสถานะเริ่มต้น

    // เริ่มยิงเป้า
    const self = this;
    this.spawnTimer = ROOT.setInterval(function () {
      self.spawnLoop();
    }, this.diffCfg.spawnInterval || 1100);

    // ฟัง clock กลาง
    ROOT.window.addEventListener('hha:time', this._onTime);

    console.log('[GroupsVR] GameEngine started', this.diffKey, this.duration);
  }

  stop () {
    if (this.spawnTimer) {
      ROOT.clearInterval(this.spawnTimer);
      this.spawnTimer = null;
    }
    ROOT.window.removeEventListener('hha:time', this._onTime);
    this.ended = true;
  }

  // --------------------------------------------------------
  // Fever & stat
  // --------------------------------------------------------
  gainFever (n) {
    this.fever = Math.max(0, Math.min(100, this.fever + n));
    setFever(this.fever);
    if (!this.feverActive && this.fever >= 100) {
      this.feverActive = true;
      setFeverActive(true);
      coach('โหมดพลังพิเศษ ✨ เก็บอาหารดีให้เยอะที่สุดเลย!');
    }
  }

  decayFever (n) {
    const d = this.feverActive ? 10 : n;
    this.fever = Math.max(0, this.fever - d);
    setFever(this.fever);
    if (this.feverActive && this.fever <= 0) {
      this.feverActive = false;
      setFeverActive(false);
    }
  }

  questSummary () {
    if (!this.questMgr || typeof this.questMgr.getSummary !== 'function') {
      return {
        goalsCleared: this.goalsCleared,
        goalsTotal:   this.goalsTotal,
        questsCleared: this.questsCleared,
        questsTotal:   this.questsTotal
      };
    }
    const s = this.questMgr.getSummary() || {};
    this.goalsCleared  = s.clearedGoals || 0;
    this.goalsTotal    = s.totalGoals   || 0;
    this.questsCleared = s.clearedMinis || 0;
    this.questsTotal   = s.totalMinis   || 0;
    return {
      goalsCleared: this.goalsCleared,
      goalsTotal:   this.goalsTotal,
      questsCleared: this.questsCleared,
      questsTotal:   this.questsTotal
    };
  }

  emitStat (extra) {
    const qs = this.questSummary();
    const grade = computeGrade({
      score: this.score,
      misses: this.misses,
      goalsCleared: qs.goalsCleared,
      goalsTotal: qs.goalsTotal,
      questsCleared: qs.questsCleared,
      questsTotal: qs.questsTotal,
      diff: this.diffKey
    });

    const detail = Object.assign({
      mode: 'Food Groups',
      difficulty: this.diffKey,
      score: this.score,
      combo: this.combo,
      comboMax: this.comboMax,
      misses: this.misses,
      fever: this.fever,
      feverActive: this.feverActive,
      groups: this.groupCounts.slice(),
      goalsCleared: qs.goalsCleared,
      goalsTotal: qs.goalsTotal,
      questsCleared: qs.questsCleared,
      questsTotal: qs.questsTotal,
      grade: grade
    }, extra || {});

    try {
      ROOT.window.dispatchEvent(new CustomEvent('hha:stat', { detail }));
    } catch (err) {
      console.warn('[GroupsVR] hha:stat error', err);
    }

    // ถ้าภารกิจครบแล้วให้จบเกม
    if (!this.ended &&
        qs.goalsTotal > 0 && qs.questsTotal > 0 &&
        qs.goalsCleared >= qs.goalsTotal &&
        qs.questsCleared >= qs.questsTotal) {
      this.finish(true);
    }
  }

  // --------------------------------------------------------
  // Spawn & entities
  // --------------------------------------------------------
  spawnLoop () {
    if (this.ended || !this.sceneEl) return;

    if (this.targets.size >= (this.diffCfg.maxActive || 4)) {
      return;
    }

    const isGood = Math.random() < 0.7;
    const emoji = isGood ? randItem(GOOD_EMOJI) : randItem(BAD_EMOJI);
    const gId = isGood ? foodGroup(emoji) : 0;

    const pos = {
      x: (Math.random() * 2.4) - 1.2,
      y: 1.2 + Math.random() * 0.9,
      z: -3.2
    };

    const target = {
      emoji,
      isGood,
      groupId: gId,
      pos,
      el: null,
      expireTimer: null
    };

    this.createTargetEntity(target);
    this.targets.add(target);

    console.log('[GroupsVR] spawn target', {
      emoji: target.emoji,
      isGood: target.isGood,
      gId: target.groupId,
      pos: target.pos
    });
  }

  createTargetEntity (target) {
    const el = ROOT.document.createElement('a-entity');

    const scale = this.diffCfg.scale || 1.0;
    const radius = 0.28 * scale;

    el.setAttribute('geometry', 'primitive: circle; radius: ' + radius);

    const mat = {
      shader: 'flat',
      side: 'double',
      transparent: true,
      alphaTest: 0.01
    };

    let texInfo = null;

    if (EmojiImage) {
      try {
        texInfo = EmojiImage(target.emoji);
      } catch (err) {
        console.warn('[GroupsVR] EmojiImage error', err);
      }
    }

    if (texInfo) {
      if (typeof texInfo === 'string') {
        mat.src = texInfo;
      } else if (typeof texInfo === 'object') {
        if (texInfo.src) mat.src = texInfo.src;
        if (texInfo.color) mat.color = texInfo.color;
        if (typeof texInfo.transparent === 'boolean') {
          mat.transparent = texInfo.transparent;
        }
      }
    } else {
      mat.color = '#ffffff';
    }

    el.setAttribute('material', mat);
    el.setAttribute(
      'position',
      target.pos.x + ' ' + target.pos.y + ' ' + target.pos.z
    );
    el.setAttribute('data-hha-tgt', '1');
    el.classList.add('hha-target');

    const toY = target.pos.y + 0.35;
    const life = this.diffCfg.lifetime || 2200;
    el.setAttribute('animation__move', {
      property: 'position',
      to: target.pos.x + ' ' + toY + ' ' + target.pos.z,
      dur: life,
      dir: 'alternate',
      loop: 1,
      easing: 'easeOutQuad'
    });

    const engine = this;
    el.addEventListener('click', function (ev) {
      engine.handleHit(target, ev);
    });

    this.sceneEl.appendChild(el);
    target.el = el;

    target.expireTimer = ROOT.setTimeout(function () {
      engine.handleExpire(target);
    }, life);
  }

  handleHit (target, ev) {
    if (this.ended) return;
    if (!target || !this.targets.has(target)) return;

    if (target.expireTimer) {
      ROOT.clearTimeout(target.expireTimer);
      target.expireTimer = null;
    }

    if (target.el && target.el.parentNode) {
      target.el.parentNode.removeChild(target.el);
    }
    this.targets.delete(target);

    const pt = ev && ev.detail && ev.detail.intersection && ev.detail.intersection.point;
    const x = pt ? pt.x : 0;
    const y = pt ? pt.y : 1.6;

    if (target.isGood) {
      this.goodHits++;
      const base = 16 + this.combo * 2;
      const mult = this.feverActive ? 2 : 1;
      const delta = base * mult;

      this.score += delta;
      this.combo++;
      if (this.combo > this.comboMax) this.comboMax = this.combo;

      this.gainFever(this.diffCfg.feverGainHit || 7);
      const g = target.groupId;
      if (g > 0 && g <= 5) {
        this.groupCounts[g - 1] = (this.groupCounts[g - 1] || 0) + 1;
      }

      if (this.questMgr) {
        this.questMgr.onHit({
          groupId: target.groupId,
          isGood: true,
          isBad: false
        });
      }

      const label = (this.feverActive || this.combo >= 10)
        ? 'PERFECT'
        : 'GOOD';

      try {
        Particles.scorePop(x, y, '+' + delta, {
          good: true,
          judgment: label
        });
        Particles.burstAt(x, y, { good: true });
      } catch (err) {}

    } else {
      this.badHits++;
      const delta = -12;
      this.score = Math.max(0, this.score + delta);
      this.combo = 0;
      this.misses++;
      this.decayFever(this.diffCfg.feverLossMiss || 16);

      if (this.questMgr) {
        this.questMgr.onHit({
          groupId: 0,
          isGood: false,
          isBad: true
        });
      }

      try {
        Particles.scorePop(x, y, String(delta), {
          good: false,
          judgment: 'MISS'
        });
        Particles.burstAt(x, y, { good: false });
      } catch (err) {}
    }

    this.emitStat();
  }

  handleExpire (target) {
    if (!target || !this.targets.has(target)) return;

    if (target.expireTimer) {
      ROOT.clearTimeout(target.expireTimer);
      target.expireTimer = null;
    }
    if (target.el && target.el.parentNode) {
      target.el.parentNode.removeChild(target.el);
    }
    this.targets.delete(target);

    // ปล่อยหลุด = ลด fever นิดหน่อย
    this.decayFever(4);
    this.emitStat();
  }

  // --------------------------------------------------------
  // Clock central
  // --------------------------------------------------------
  _onTime (ev) {
    if (this.ended) return;
    const sec = ev && ev.detail && typeof ev.detail.sec === 'number'
      ? ev.detail.sec
      : null;

    if (sec === null) return;

    if (sec > 0) {
      if (this.combo <= 0) this.decayFever(4);
      else                 this.decayFever(2);
      this.emitStat();
    }

    if (sec === 20) {
      coach('เหลือ 20 วิ ลองเก็บให้ครบหลายหมู่ 🥦🍎🍚');
    }
    if (sec === 10) {
      coach('10 วิ สุดท้าย ลองเก็บคอมโบให้ยาวที่สุด ✨');
    }

    if (sec === 0) {
      this.finish(false);
    }
  }

  finish (allCleared) {
    if (this.ended) return;
    this.ended = true;

    this.stop();

    const qs = this.questSummary();
    const grade = computeGrade({
      score: this.score,
      misses: this.misses,
      goalsCleared: qs.goalsCleared,
      goalsTotal: qs.goalsTotal,
      questsCleared: qs.questsCleared,
      questsTotal: qs.questsTotal,
      diff: this.diffKey
    });

    this.emitStat({ ended: true });

    try {
      ROOT.window.dispatchEvent(new CustomEvent('hha:end', {
        detail: {
          mode: 'Food Groups',
          difficulty: this.diffKey,
          score: this.score,
          comboMax: this.comboMax,
          misses: this.misses,
          duration: this.duration,
          goalsCleared: qs.goalsCleared,
          goalsTotal: qs.goalsTotal,
          questsCleared: qs.questsCleared,
          questsTotal: qs.questsTotal,
          groups: this.groupCounts.slice(),
          allCleared: !!allCleared,
          grade: grade
        }
      }));
    } catch (err) {
      console.warn('[GroupsVR] hha:end error', err);
    }
  }
}

// attach to namespace for non-module access
ROOT.GAME_MODULES = ROOT.GAME_MODULES || {};
ROOT.GAME_MODULES.GameEngine = GameEngine;

if (!ROOT.HeroHealth) ROOT.HeroHealth = {};
if (!ROOT.HeroHealth.GroupsVR) ROOT.HeroHealth.GroupsVR = {};
ROOT.HeroHealth.GroupsVR.GameEngine = GameEngine;

export { GameEngine };
export default GameEngine;