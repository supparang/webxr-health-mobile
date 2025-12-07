// === /herohealth/vr-groups/GameEngine.js ===
// Food Groups VR — Game Engine (DOM targets + Goal / Mini quest + Fever + FX)
// 2025-12-07

(function (ns, global) {
  'use strict';

  const A = global.AFRAME;
  if (!A) {
    console.error('[GroupsVR] AFRAME not found');
    return;
  }

  // ----- Fever UI (shared global) -----
  const FeverUI =
    (global.GAME_MODULES && global.GAME_MODULES.FeverUI) ||
    global.FeverUI || {
      ensureFeverBar() {},
      setFever() {},
      setFeverActive() {},
      setShield() {}
    };

  // ----- FX (particles.js: HHA_PARTICLES) -----
  const Particles =
    global.HHA_PARTICLES ||
    (global.GAME_MODULES && global.GAME_MODULES.Particles) || {
      scorePop() {},
      burstAt() {}
    };

  const FEVER_MAX       = 100;
  const FEVER_HIT_GAIN  = 10;
  const FEVER_MISS_LOSS = 25;

  // ---------- Difficulty helper ----------
  function getDiffConfig(diffKey) {
    diffKey = String(diffKey || 'normal').toLowerCase();

    // ถ้ามีไฟล์ difficulty.js แยกไว้ ให้ลองใช้ก่อน
    const diffSrc =
      (ns.foodGroupsDifficulty) ||
      (global.foodGroupsDifficulty);
    if (diffSrc && typeof diffSrc.get === 'function') {
      const cfg = diffSrc.get(diffKey);
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

  // ---------- Emoji helper (good / junk) ----------
  const GOOD_EMOJI = ['🥦', '🍎', '🍚', '🍳', '🥛', '🍌', '🍇', '🥕', '🍊'];
  const JUNK_EMOJI = ['🍩', '🍟', '🍕', '🥤', '🍰', '🍫', '🍭', '🧃'];

  function pickEmoji(isGood) {
    const src = ns.emojiImage || global.emojiImage;
    if (src && typeof src.pick === 'function') {
      return src.pick(isGood ? 'good' : 'junk');
    }
    const arr = isGood ? GOOD_EMOJI : JUNK_EMOJI;
    return arr[Math.floor(Math.random() * arr.length)];
  }

  // ---------- Random position (กลางจอหลบ HUD+โค้ช) ----------
  function randomScreenPos() {
    const w = global.innerWidth || 1280;
    const h = global.innerHeight || 720;

    const topSafe    = 140; // พ้น HUD บน
    const bottomSafe = 170; // พ้น coach + fever ด้านล่าง

    const left  = w * 0.14;
    const right = w * 0.86;

    const x = left + Math.random() * (right - left);
    const y = topSafe + Math.random() * (h - topSafe - bottomSafe);
    return { x, y };
  }

  // ---------- Coach helper ----------
  function coachSay(text) {
    if (!text) return;
    global.dispatchEvent(
      new CustomEvent('fg-coach', { detail: { text } })
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
      this.elScore    = document.getElementById('hud-score');
      this.elTime     = document.getElementById('hud-time-label');
      this.elGoalMain = document.getElementById('hud-goal-main');
      this.elGoalProg = document.getElementById('hud-goal-progress');
      this.elMiniMain = document.getElementById('hud-mini-main');
      this.elMiniProg = document.getElementById('hud-mini-progress');
      this.elMiss     = document.getElementById('hud-miss'); // ถ้ามีใน HUD ให้ใช้

      // state
      this.running    = false;   // จะเป็น true หลังเคานต์ดาวน์จบ
      this.elapsed    = 0;
      this.timeLimit  = 60000;   // ms
      this.spawnTimer = 0;
      this.targets    = [];
      this.score      = 0;
      this.goodHits   = 0;
      this.missCount  = 0;

      // goal / mini quest
      this.goalTargetScore = 150;
      this.miniTargetGood  = 12;

      this.diffKey = 'normal';
      this.diffCfg = getDiffConfig(this.diffKey);

      // Fever state
      this.fever       = 0;
      this.feverActive = false;
      FeverUI.ensureFeverBar();
      FeverUI.setFever(0);
      FeverUI.setFeverActive(false);
      FeverUI.setShield(0);

      this._introTimers = [];

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
      // ล้าง timeout ของ intro รอบก่อน
      if (this._introTimers && this._introTimers.length) {
        this._introTimers.forEach(clearTimeout);
        this._introTimers.length = 0;
      }

      this.diffKey = String(diffKey || 'normal').toLowerCase();
      this.diffCfg = getDiffConfig(this.diffKey);

      this.clearTargets();
      this.running    = false; // จะเปิดหลังเคานต์ดาวน์
      this.elapsed    = 0;
      this.spawnTimer = 0;
      this.score      = 0;
      this.goodHits   = 0;
      this.missCount  = 0;

      this.timeLimit  = (Number(durationSec) || 60) * 1000;

      // ปรับเป้าตามระดับความยาก + ผูกกับ "หมู่" โดยคร่าว ๆ
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

      if (this.elScore) this.elScore.textContent = '0';
      if (this.elTime)  this.elTime.textContent  = Math.ceil(this.timeLimit / 1000) + 's';
      if (this.elMiss)  this.elMiss.textContent  = '0';

      // reset fever
      this.fever       = 0;
      this.feverActive = false;
      FeverUI.ensureFeverBar();
      FeverUI.setFever(0);
      FeverUI.setFeverActive(false);
      FeverUI.setShield(0);

      this.updateQuestText();
      this.updateQuestProgress();

      console.log('[GroupsVR] startGame', this.diffKey, this.diffCfg);

      // sequence อธิบายหมู่ + count down
      this.runIntroSequence();
    },

    runIntroSequence: function () {
      const timers = this._introTimers;

      function addTimer(fn, delay) {
        const id = setTimeout(fn, delay);
        timers.push(id);
      }

      // อธิบายหมู่ตามระดับ
      if (this.diffKey === 'easy') {
        coachSay('วันนี้เราจะโฟกัสหมู่ 1 + 2 นะ: ข้าวแป้ง และผักผลไม้ 🍚🥦');
        addTimer(() => {
          coachSay('เลือกอาหารดีจากหมู่ที่กำหนด เลี่ยงของขยะให้ได้มากที่สุด 💪');
        }, 1400);
      } else if (this.diffKey === 'hard') {
        coachSay('วันนี้จัดเต็มหมู่ 1 + 2 + 3: ข้าวแป้ง ผักผลไม้ และเนื้อสัตว์ให้ครบเลยนะ 🍚🥦🍗');
        addTimer(() => {
          coachSay('ยิ่งเลือกได้หลากหลายหมู่อาหารดี คะแนนยิ่งพุ่งเลย! 🌟');
        }, 1400);
      } else {
        coachSay('วันนี้หมู่ 1 + 2 + 3 เหมือนกัน แต่ความเร็วจะไวขึ้นหน่อยนะ ✨');
        addTimer(() => {
          coachSay('โฟกัสอาหารดีให้ทันเวลา เลี่ยงของหวานและของทอดให้ดี ๆ 😉');
        }, 1400);
      }

      // เคานต์ดาวน์ 3–2–1–Go ก่อนเริ่ม spawn เป้า
      let t = 2600;
      addTimer(() => { coachSay('เตรียมตัวนะ... 3'); }, t);
      t += 700;
      addTimer(() => { coachSay('2'); }, t);
      t += 700;
      addTimer(() => { coachSay('1'); }, t);
      t += 700;
      addTimer(() => {
        coachSay('Go! เล็งอาหารดีจากหมู่ที่กำหนดให้ทันเลย! 🥦🔥');
        this.running = true;
      }, t);
    },

    endGame: function () {
      if (!this.running && this.elapsed > 0) {
        // ถ้าเกมไม่ได้วิ่งแล้ว และเคยเล่นไปแล้ว ก็ไม่ต้องซ้ำ
        return;
      }

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
        goal: `ทำคะแนนให้ได้อย่างน้อย ${this.goalTargetScore} คะแนน (${this.score} / ${this.goalTargetScore})`,
        miniQuest: `เก็บอาหารดีอย่างน้อย ${this.miniTargetGood} ชิ้น (${this.goodHits} / ${this.miniTargetGood})`
      };

      scene.emit('fg-game-over', detail);
      console.log('[GroupsVR] game over', detail);

      if (goalOK && miniOK) {
        coachSay('สุดยอด! จัดหมู่อาหารได้ตรงเป้า ภารกิจวันนี้ผ่านสวยมาก 🎉');
      } else if (goalOK || miniOK) {
        coachSay('ทำได้ใกล้เคียงมากแล้ว ครั้งหน้าลองโฟกัสให้ครบทุกหมู่ดูนะ 💪');
      } else {
        coachSay('ไม่เป็นไร ไว้มาลองใหม่อีกครั้ง เลือกหมู่อาหารดีให้มากขึ้นนะ 😊');
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
      const now = this.elapsed;
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

      // ใช้ emoji เป็น text จริง (แก้ปัญหา mobile ไม่แสดง ::before)
      el.setAttribute('data-emoji', emoji);
      el.textContent = emoji;

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

        if (judgment === 'PERFECT' && Math.random() < 0.25) {
          coachSay('สุดยอด! เลือกอาหารดีได้ตรงเป้าสุด ๆ เลย 🌟');
        }
      } else {
        // ตีโดน junk → MISS + หักคะแนน + เพิ่ม missCount
        judgment = 'MISS';
        delta    = -8;
        this.missCount += 1;
        this.updateFever(-FEVER_MISS_LOSS);

        if (this.missCount === 3) {
          coachSay('เริ่มพลาดของขยะบ่อยแล้วนะ ลองโฟกัสอาหารดีมากขึ้นหน่อย 😉');
        }
      }

      this.score = Math.max(0, this.score + delta);
      if (this.elScore) this.elScore.textContent = String(this.score);
      if (this.elMiss)  this.elMiss.textContent  = String(this.missCount);

      this.updateQuestProgress();

      // เอฟเฟกต์แตกกระจาย + คะแนนเด้ง + label
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
        if (this.diffKey === 'easy') {
          this.elGoalMain.textContent =
            'จัดหมู่อาหารดีหมู่ 1+2 (ข้าวแป้ง + ผักผลไม้) ให้ได้ตามเป้า';
        } else if (this.diffKey === 'hard') {
          this.elGoalMain.textContent =
            'จัดหมู่อาหารดีหมู่ 1+2+3 ให้ครบหลาย ๆ ชิ้นตามเป้า';
        } else {
          this.elGoalMain.textContent =
            'จัดหมู่อาหารดีจากหมู่ที่กำหนด ให้ได้คะแนนตามเป้า';
        }
      }
      if (this.elMiniMain) {
        this.elMiniMain.textContent =
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
      if (this._introTimers && this._introTimers.length) {
        this._introTimers.forEach(clearTimeout);
        this._introTimers.length = 0;
      }
    }
  });

  ns.foodGroupsGame = ns.foodGroupsGame || {};
})(window.GAME_MODULES || (window.GAME_MODULES = {}), window);