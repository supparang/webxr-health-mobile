// === /herohealth/vr-groups/GameEngine.js ===
// Food Groups VR — Game Engine (DOM targets + Goal/Mini quest + Fever + FX)
// 2025-12-07

'use strict';

(function (ns) {
  const A = window.AFRAME;
  if (!A) {
    console.error('[GroupsVR] AFRAME not found');
    return;
  }

  // ----- Fever UI (shared global) -----
  const FeverUI =
    (window.GAME_MODULES && window.GAME_MODULES.FeverUI) ||
    window.FeverUI || {
      ensureFeverBar() {},
      setFever() {},
      setFeverActive() {},
      setShield() {}
    };

  // ----- Particles FX (global จาก vr/particles.js) -----
  const Particles =
    window.HHA_PARTICLES ||
    (window.GAME_MODULES && window.GAME_MODULES.Particles) || {
      scorePop () {},
      burstAt () {}
    };

  const FEVER_MAX       = 100;
  const FEVER_HIT_GAIN  = 10;
  const FEVER_MISS_LOSS = 25;

  // ----- Difficulty helper -----
  function getDiffConfig (diffKey) {
    diffKey = String(diffKey || 'normal').toLowerCase();

    // ถ้ามีไฟล์ difficulty.js แยกไว้ ให้ลองใช้ก่อน
    if (
      ns.foodGroupsDifficulty &&
      typeof ns.foodGroupsDifficulty.get === 'function'
    ) {
      const cfg = ns.foodGroupsDifficulty.get(diffKey);
      if (cfg) return cfg;
    }

    // fallback ภายในไฟล์นี้
    if (diffKey === 'easy') {
      return {
        spawnInterval: 1300,
        maxActive: 3,
        sizeFactor: 1.15,
        targetLifetime: 2800
      };
    }
    if (diffKey === 'hard') {
      return {
        spawnInterval: 850,
        maxActive: 5,
        sizeFactor: 0.9,
        targetLifetime: 2200
      };
    }
    // normal
    return {
      spawnInterval: 1100,
      maxActive: 4,
      sizeFactor: 1.0,
      targetLifetime: 2500
    };
  }

  // ----- Emoji helper (good / junk) -----
  const GOOD_EMOJI = ['🥦', '🍎', '🍚', '🍳', '🥛', '🍌', '🍇', '🥕', '🍊'];
  const JUNK_EMOJI = ['🍩', '🍟', '🍕', '🥤', '🍰', '🍫', '🍭', '🧃'];

  function pickEmoji (isGood) {
    // ถ้ามีโมดูล emoji-image ให้มันเลือก
    if (ns.emojiImage && typeof ns.emojiImage.pick === 'function') {
      return ns.emojiImage.pick(isGood ? 'good' : 'junk');
    }
    const arr = isGood ? GOOD_EMOJI : JUNK_EMOJI;
    return arr[Math.floor(Math.random() * arr.length)];
  }

  // ----- ข้อความ concept หมู่อาหารตามระดับ -----
  function getGroupConcept (diffKey) {
    switch (diffKey) {
      case 'easy':
        return {
          goalText:
            'โฟกัสหมู่ที่ 1 (ข้าว-แป้ง-ธัญพืช) + หมู่ที่ 2 (เนื้อสัตว์/ถั่วเมล็ดแห้ง) ให้ได้คะแนนตามเป้า',
          miniText:
            'เลือกอาหารดีจากหมู่ 1–2 ให้ได้จำนวนชิ้นตามที่กำหนด เลี่ยงของขยะ'
        };
      case 'hard':
        return {
          goalText:
            'จัดหมู่อาหารครบ 5 หมู่ เน้นหมู่ 2 (โปรตีน) + หมู่ 3 (ผัก) + หมู่ 4 (ผลไม้) ให้แต้มสูงสุด',
          miniText:
            'เก็บอาหารดีจากหมู่ 2–4 ให้ได้จำนวนชิ้นสูง ๆ และพลาดของขยะให้น้อยที่สุด'
        };
      default:
        return {
          goalText:
            'เน้นหมู่ 1–3 (ข้าว-โปรตีน-ผัก) ให้ได้คะแนนรวมตามเป้า เลี่ยงของขยะ',
          miniText:
            'เก็บอาหารดีจากหมู่ 1–3 ให้ครบจำนวนที่กำหนด และคุมจำนวน Miss ให้ต่ำ'
        };
    }
  }

  // ----- Random position (กลางจอหลบ HUD + โค้ช + Fever) -----
  function randomScreenPos () {
    const w = window.innerWidth || 1280;
    const h = window.innerHeight || 720;

    const topSafe    = 140;  // ให้พ้น HUD บน
    const bottomSafe = 180;  // ให้พ้น coach + fever ด้านล่าง

    const left  = w * 0.14;
    const right = w * 0.86;

    const x = left + Math.random() * (right - left);
    const y = topSafe + Math.random() * (h - topSafe - bottomSafe);
    return { x, y };
  }

  // ----- helper coach (ยิง event ให้ HTML ไปแสดง bubble + mood) -----
  function coachSay (text, mood) {
    if (!text) return;
    window.dispatchEvent(
      new CustomEvent('fg-coach', { detail: { text, mood } })
    );
  }

  // ================== Component main ==================
  A.registerComponent('food-groups-game', {
    schema: {},

    init: function () {
      const scene = this.el.sceneEl;
      this.scene = scene;

      // DOM layer สำหรับเป้า
      this.layer = document.getElementById('fg-layer');
      if (!this.layer) {
        this.layer = document.createElement('div');
        this.layer.id = 'fg-layer';
        document.body.appendChild(this.layer);
      }

      // HUD elements
      this.elScore      = document.getElementById('hud-score');
      this.elTime       = document.getElementById('hud-time-label');
      this.elGoalMain   = document.getElementById('hud-goal-main');
      this.elGoalProg   = document.getElementById('hud-goal-progress');
      this.elMiniMain   = document.getElementById('hud-mini-main');
      this.elMiniProg   = document.getElementById('hud-mini-progress');
      this.elMiss       = document.getElementById('hud-miss'); // ถ้ามีให้ใช้

      // state
      this.running    = false;
      this.elapsed    = 0;
      this.timeLimit  = 60000; // ms
      this.spawnTimer = 0;
      this.targets    = [];
      this.score      = 0;
      this.goodHits   = 0;
      this.missCount  = 0;

      // quest & concept
      this.goalTargetScore = 150;
      this.miniTargetGood  = 12;
      this.goalText = '';
      this.miniText = '';

      this.diffKey = 'normal';
      this.diffCfg = getDiffConfig(this.diffKey);

      // Fever state
      this.fever       = 0;
      this.feverActive = false;
      FeverUI.ensureFeverBar();
      FeverUI.setFever(0);
      FeverUI.setFeverActive(false);
      FeverUI.setShield(0);

      // รอ event เริ่มเกมจาก HTML glue
      const startHandler = (e) => {
        const diff = (e.detail && e.detail.diff) || 'normal';
        const dur  = (e.detail && e.detail.duration) || 60;
        this.startGame(diff, dur);
      };
      scene.addEventListener('fg-start', startHandler);

      console.log('[GroupsVR] Game component initialized');
    },

    // ---------- Fever ----------
    updateFever: function (delta) {
      this.fever = (this.fever || 0) + delta;
      if (this.fever < 0) this.fever = 0;
      if (this.fever > FEVER_MAX) this.fever = FEVER_MAX;

      if (typeof FeverUI.setFever === 'function') {
        FeverUI.setFever(this.fever);
      }
      const active = this.fever >= FEVER_MAX;
      if (typeof FeverUI.setFeverActive === 'function') {
        FeverUI.setFeverActive(active);
      }
    },

    // ---------- Game flow ----------
    startGame: function (diffKey, durationSec) {
      this.diffKey = String(diffKey || 'normal').toLowerCase();
      this.diffCfg = getDiffConfig(this.diffKey);

      this.clearTargets();
      this.running    = true;
      this.elapsed    = 0;
      this.spawnTimer = 0;
      this.score      = 0;
      this.goodHits   = 0;
      this.missCount  = 0;

      this.timeLimit  = (Number(durationSec) || 60) * 1000;

      // ปรับเป้าตามระดับความยาก
      if (this.diffKey === 'easy') {
        this.goalTargetScore = 120;
        this.miniTargetGood  = 10;
      } else if (this.diffKey === 'hard') {
        this.goalTargetScore = 200;
        this.miniTargetGood  = 16;
      } else {
        this.goalTargetScore = 160;
        this.miniTargetGood  = 12;
      }

      // concept หมู่อาหารตามระดับ
      const concept = getGroupConcept(this.diffKey);
      this.goalText = concept.goalText;
      this.miniText = concept.miniText;

      if (this.elScore) this.elScore.textContent = '0';
      if (this.elTime)  this.elTime.textContent  = Math.ceil(this.timeLimit / 1000) + 's';
      if (this.elMiss)  this.elMiss.textContent  = '0';

      this.updateQuestText();
      this.updateQuestProgress();

      // reset fever
      this.fever       = 0;
      this.feverActive = false;
      FeverUI.ensureFeverBar();
      FeverUI.setFever(0);
      FeverUI.setFeverActive(false);
      FeverUI.setShield(0);

      console.log('[GroupsVR] startGame', this.diffKey, this.diffCfg);
      coachSay(
        'วันนี้โฟกัสการจัดหมู่อาหารตามโจทย์นะ เลือกอาหารดีจากหมู่ที่กำหนดแล้วเลี่ยงของขยะให้ได้มากที่สุด! 🥦',
        'hype'
      );
    },

    endGame: function () {
      if (!this.running) return;
      this.running = false;
      this.clearTargets();

      const scene = this.scene;
      if (!scene) return;

      const goalOK = this.score    >= this.goalTargetScore;
      const miniOK = this.goodHits >= this.miniTargetGood;

      const detail = {
        score: this.score,
        goodHits: this.goodHits,
        missCount: this.missCount,
        questsCleared: (goalOK ? 1 : 0) + (miniOK ? 1 : 0),
        questsTotal: 2,
        goal: `${this.goalText || 'ทำคะแนนให้ถึงเป้าหมาย'} (${this.score} / ${this.goalTargetScore})`,
        miniQuest: `${this.miniText || 'เก็บอาหารดีให้ครบตามจำนวน'} (${this.goodHits} / ${this.miniTargetGood})`
      };

      scene.emit('fg-game-over', detail);
      console.log('[GroupsVR] game over', detail);

      if (goalOK && miniOK) {
        coachSay(
          'สุดยอด! จัดหมู่อาหารได้ตรงตามโจทย์ แถมคะแนนก็ถึงเป้าด้วย ภารกิจวันนี้ผ่านสวยงามเลย 🎉',
          'hype'
        );
      } else if (goalOK || miniOK) {
        coachSay(
          'ทำได้ดีแล้ว เหลืออีกนิดเดียวเอง ครั้งหน้าลองโฟกัสให้ครบทุกหมู่และคุม Miss ให้ดีกว่านี้นะ 💪',
          'good'
        );
      } else {
        coachSay(
          'ไม่เป็นไร ไว้มาลองใหม่ เลือกอาหารดีจากหมู่ที่กำหนดให้มากขึ้น แล้วค่อย ๆ ลดของขยะลงก็พอ 😊',
          'bad'
        );
      }
    },

    // ---------- Tick loop ----------
    tick: function (time, dt) {
      if (!this.running) return;

      dt = dt || 16;
      this.elapsed    += dt;
      this.spawnTimer += dt;

      // เวลา
      const remain = Math.max(0, this.timeLimit - this.elapsed);
      if (this.elTime) {
        this.elTime.textContent = Math.ceil(remain / 1000) + 's';
      }
      if (remain <= 0) {
        this.endGame();
        return;
      }

      // spawn เป้าใหม่
      if (this.spawnTimer >= this.diffCfg.spawnInterval) {
        this.spawnTimer = 0;
        this.spawnTarget();
      }

      // เช็คอายุเป้า → ถ้าหมดเวลาให้ MISS แล้วลบ
      const now    = this.elapsed;
      const lifeMs = this.diffCfg.targetLifetime || 2500;
      for (let i = this.targets.length - 1; i >= 0; i--) {
        const t = this.targets[i];
        if (!t || t.consumed) continue;
        const age = now - t.spawnAt;
        if (age >= (t.lifeMs || lifeMs)) {
          this.handleTimeout(t);
        }
      }
    },

    // ---------- Target spawn / remove ----------
    spawnTarget: function () {
      if (!this.layer) return;
      if (this.targets.length >= this.diffCfg.maxActive) return;

      // 65% good, 35% junk พอให้มีโอกาสพลาด
      const isGood = Math.random() < 0.65;
      const emoji  = pickEmoji(isGood);
      const pos    = randomScreenPos();
      const lifeMs = this.diffCfg.targetLifetime || 2500;

      const el = document.createElement('div');
      el.className = 'fg-target ' + (isGood ? 'fg-good' : 'fg-junk');
      el.setAttribute('data-emoji', emoji);
      el.style.left = pos.x + 'px';
      el.style.top  = pos.y + 'px';

      const baseScale = this.diffCfg.sizeFactor || 1.0;
      el.style.transform = 'translate(-50%, -50%) scale(' + baseScale + ')';

      const targetObj = {
        el,
        isGood,
        spawnAt: this.elapsed,
        lifeMs,
        consumed: false
      };
      this.targets.push(targetObj);

      const onHit = (ev) => {
        ev.stopPropagation();
        ev.preventDefault();
        this.handleHit(targetObj);
      };

      el.addEventListener('click', onHit);
      el.addEventListener('pointerdown', onHit);

      this.layer.appendChild(el);
    },

    handleHit: function (target) {
      if (!this.running) return;
      if (!target || target.consumed) return;

      const el = target.el;
      if (!el || !el.parentNode) return;

      target.consumed = true;

      const now   = this.elapsed;
      const life  = target.lifeMs || this.diffCfg.targetLifetime || 2500;
      const age   = Math.max(0, now - target.spawnAt);
      const ratio = Math.min(1, age / life);

      let judgment = 'MISS';
      let delta    = 0;
      let goodHit  = false;

      if (target.isGood) {
        // ตีโดนอาหารดี → PERFECT / GOOD / LATE
        if (ratio <= 0.35) {
          judgment = 'PERFECT';
          delta    = 15;
        } else if (ratio <= 0.8) {
          judgment = 'GOOD';
          delta    = 10;
        } else {
          judgment = 'LATE';
          delta    = 5;
        }
        goodHit = true;
        this.goodHits += 1;
        this.updateFever(FEVER_HIT_GAIN + (judgment === 'PERFECT' ? 5 : 0));

        if (judgment === 'PERFECT' && Math.random() < 0.3) {
          coachSay('สุดยอด! เลือกอาหารดีได้เป๊ะเลยแบบหมู่ตัวอย่างเลย 🌟', 'hype');
        } else if (judgment === 'GOOD' && Math.random() < 0.25) {
          coachSay('ดีมาก! เก็บอาหารดีได้ตรงหมู่แล้ว ลองขยับไป PERFECT ดูนะ 💚', 'good');
        }
      } else {
        // ตีโดน junk → MISS
        judgment = 'MISS';
        delta    = -8;
        this.missCount += 1;
        this.updateFever(-FEVER_MISS_LOSS);

        if (this.missCount === 3 || this.missCount === 5) {
          coachSay('ของขยะเริ่มเยอะแล้วนะ ลองโฟกัสหมู่อาหารดีให้มากขึ้น 😉', 'bad');
        }
      }

      this.score = Math.max(0, this.score + delta);
      if (this.elScore) this.elScore.textContent = String(this.score);
      if (this.elMiss)  this.elMiss.textContent  = String(this.missCount);

      this.updateQuestProgress();

      // เอฟเฟกต์แตกกระจาย + คะแนนเด้ง + label Miss/Late/Good/Perfect
      try {
        const rect = el.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top  + rect.height / 2;

        const label = `${judgment} ${delta > 0 ? '+' + delta : delta}`;
        Particles.scorePop(x, y, label, { good: delta > 0 });
        Particles.burstAt(x, y, {
          color: goodHit ? '#22c55e' : '#f97316',
          count: goodHit ? 16 : 12,
          radius: 60
        });
      } catch (err) {
        console.warn('[GroupsVR] FX error', err);
      }

      // ลบ DOM
      el.classList.add('hit');
      setTimeout(() => {
        if (el.parentNode) el.parentNode.removeChild(el);
      }, 140);

      this.targets = this.targets.filter((t) => t !== target);
    },

    handleTimeout: function (target) {
      if (!this.running) return;
      if (!target || target.consumed) return;

      const el = target.el;
      target.consumed = true;

      this.missCount += 1;
      if (this.elMiss) this.elMiss.textContent = String(this.missCount);
      this.updateFever(-FEVER_MISS_LOSS);

      // FX Miss
      try {
        if (el) {
          const rect = el.getBoundingClientRect();
          const x = rect.left + rect.width / 2;
          const y = rect.top  + rect.height / 2;
          Particles.scorePop(x, y, 'MISS 0', { good: false });
          Particles.burstAt(x, y, { color: '#f97316', count: 10, radius: 50 });
        }
      } catch (err) {}

      if (el && el.parentNode) {
        el.classList.add('hit');
        setTimeout(() => {
          if (el.parentNode) el.parentNode.removeChild(el);
        }, 120);
      }

      this.targets = this.targets.filter((t) => t !== target);
    },

    clearTargets: function () {
      if (!this.layer) return;
      this.targets.forEach((t) => {
        if (t && t.el && t.el.parentNode) {
          t.el.parentNode.removeChild(t.el);
        }
      });
      this.targets = [];
    },

    // ---------- Quest HUD ----------
    updateQuestText: function () {
      if (this.elGoalMain) {
        this.elGoalMain.textContent =
          this.goalText ||
          'จัดหมู่อาหารดีจากหมู่ที่กำหนดให้ได้ตามเป้า';
      }
      if (this.elMiniMain) {
        this.elMiniMain.textContent =
          this.miniText ||
          'เก็บอาหารดีให้ครบจำนวน เลี่ยงของขยะให้ได้มากที่สุด';
      }
    },

    updateQuestProgress: function () {
      if (this.elGoalProg) {
        const s = Math.min(this.score, this.goalTargetScore);
        this.elGoalProg.textContent = `${s} / ${this.goalTargetScore}`;
      }
      if (this.elMiniProg) {
        const g = Math.min(this.goodHits, this.miniTargetGood);
        this.elMiniProg.textContent = `${g} / ${this.miniTargetGood}`;
      }
    },

    remove: function () {
      this.clearTargets();
      this.running = false;
    }
  });

  ns.foodGroupsGame = ns.foodGroupsGame || {};
})(window.GAME_MODULES || (window.GAME_MODULES = {}));
