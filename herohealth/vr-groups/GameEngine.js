// === /herohealth/vr-groups/GameEngine.js ===
// Food Groups VR — Game Engine (DOM targets + Goal / Mini quest HUD + Coach + Fever + FX)
// 2025-12-07 (Coach reacts on GOOD / MISS + endGame mood)

(function (ns) {
  'use strict';

  const A = window.AFRAME;
  if (!A) {
    console.error('[GroupsVR] AFRAME not found');
    return;
  }

  // ---- Fever UI (shared) ----
  const FeverUI =
    (window.GAME_MODULES && window.GAME_MODULES.FeverUI) ||
    window.FeverUI || {
      ensureFeverBar() {},
      setFever() {},
      setFeverActive() {},
      setShield() {}
    };

  // ---- FX Particles (shared) ----
  const Particles =
    (window.GAME_MODULES && window.GAME_MODULES.Particles) ||
    window.HHA_PARTICLES || null;

  const FEVER_MAX       = 100;
  const FEVER_HIT_GAIN  = 10;
  const FEVER_MISS_LOSS = 20;

  // ---- Difficulty helper ----
  function getDiffConfig(diffKey) {
    diffKey = String(diffKey || 'normal').toLowerCase();

    if (
      ns.foodGroupsDifficulty &&
      typeof ns.foodGroupsDifficulty.get === 'function'
    ) {
      const cfg = ns.foodGroupsDifficulty.get(diffKey);
      if (cfg) return cfg;
    }

    if (diffKey === 'easy') {
      return {
        spawnInterval: 1300,
        maxActive: 3,
        sizeFactor: 1.15
      };
    }
    if (diffKey === 'hard') {
      return {
        spawnInterval: 800,
        maxActive: 5,
        sizeFactor: 0.9
      };
    }
    // normal
    return {
      spawnInterval: 1100,
      maxActive: 4,
      sizeFactor: 1.0
    };
  }

  // ---- Emoji helper ----
  const GOOD_EMOJI = ['🥦', '🍎', '🍚', '🍳', '🥛', '🍌', '🍇'];
  const JUNK_EMOJI = ['🍩', '🍟', '🍕', '🥤', '🍰', '🍫', '🍭'];

  function pickEmoji(isGood) {
    if (
      ns.emojiImage &&
      typeof ns.emojiImage.pick === 'function'
    ) {
      return ns.emojiImage.pick(isGood ? 'good' : 'junk');
    }
    const arr = isGood ? GOOD_EMOJI : JUNK_EMOJI;
    return arr[Math.floor(Math.random() * arr.length)];
  }

  // ---- Random position (กลางจอ, หลบ HUD + โค้ช) ----
  function randomScreenPos() {
    const w = window.innerWidth || 1280;
    const h = window.innerHeight || 720;

    const topSafe = 120;
    const bottomSafe = 150;

    const left = w * 0.15;
    const right = w * 0.85;

    const x = left + Math.random() * (right - left);
    const y = topSafe + Math.random() * (h - topSafe - bottomSafe);

    return { x, y };
  }

  // ---- Component main ----
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

      // HUD element
      this.elScore       = document.getElementById('hud-score');
      this.elTime        = document.getElementById('hud-time-label');
      this.elGoalMain    = document.getElementById('hud-goal-main');
      this.elGoalProg    = document.getElementById('hud-goal-progress');
      this.elMiniMain    = document.getElementById('hud-mini-main');
      this.elMiniProg    = document.getElementById('hud-mini-progress');

      // Coach bubble
      this.elCoach      = document.getElementById('coach-bubble');
      this.elCoachText  = document.getElementById('coach-text');

      // state
      this.running       = false;
      this.inIntro       = false;
      this.elapsed       = 0;
      this.timeLimit     = 60000; // ms
      this.spawnTimer    = 0;
      this.targets       = [];
      this.score         = 0;
      this.goodHits      = 0;
      this.missCount     = 0;

      // goal / mini quest
      this.goalScore     = 150;
      this.goalGoodHits  = 12;
      this.goalText      = 'จัดหมู่อาหารให้ถูกตามโจทย์';
      this.miniText      = 'เลือกอาหารดีตามจำนวนที่กำหนด';

      this.diffKey       = 'normal';
      this.diffCfg       = getDiffConfig(this.diffKey);

      // Fever state
      this.fever         = 0;
      this.feverActive   = false;
      FeverUI.ensureFeverBar();
      FeverUI.setFever(0);
      FeverUI.setFeverActive(false);
      FeverUI.setShield(0);

      // Coach reaction state
      this.goodStreak        = 0;
      this.missStreak        = 0;
      this.lastCoachHintTime = 0;

      const startHandler = (e) => {
        const diff = (e.detail && e.detail.diff) || 'normal';
        this.startWithIntro(diff);
      };
      scene.addEventListener('fg-start', startHandler);

      console.log('[GroupsVR] Game component initialized');
    },

    // ---- helper: โค้ชพูด ----
    setCoachText: function (text) {
      if (!this.elCoach || !this.elCoachText) return;
      if (!text) {
        this.elCoach.classList.remove('show');
        return;
      }
      this.elCoachText.textContent = text;
      this.elCoach.classList.add('show');
    },

    // ---- helper: อัปเดต Fever ----
    updateFever: function (delta) {
      this.fever = (this.fever || 0) + delta;
      if (this.fever < 0) this.fever = 0;
      if (this.fever > FEVER_MAX) this.fever = FEVER_MAX;

      if (FeverUI && typeof FeverUI.setFever === 'function') {
        FeverUI.setFever(this.fever);
      }

      const active = this.fever >= FEVER_MAX;
      if (FeverUI && typeof FeverUI.setFeverActive === 'function') {
        FeverUI.setFeverActive(active);
      }
    },

    // ---- helper: ปรับ Coach ตาม GOOD / MISS ตอนตีเป้า ----
    handleCoachReaction: function (judgment) {
      const now = (window.performance && performance.now)
        ? performance.now()
        : Date.now();
      const COACH_COOLDOWN = 2200; // ms กันสแปม

      // อัปเดต streak
      if (judgment === 'GOOD') {
        this.goodStreak++;
        this.missStreak = 0;
      } else if (judgment === 'MISS') {
        this.missStreak++;
        this.goodStreak = 0;
      }

      // เช็กว่าจะพูดไหม (cooldown)
      if (now - (this.lastCoachHintTime || 0) < COACH_COOLDOWN) return;

      // ชมแรง ๆ ถ้าดีติดกัน
      if (judgment === 'GOOD' && this.goodStreak >= 3) {
        this.setCoachText('สุดยอด! เลือกอาหารดีติดกันหลายเป้าเลย 👏🥦');
        this.lastCoachHintTime = now;
        return;
      }

      // บ่นเบา ๆ ถ้าพลาดหลายครั้ง
      if (judgment === 'MISS' && this.missStreak >= 2) {
        if (this.diffKey === 'easy') {
          this.setCoachText('เบา ๆ กับของหวานมันเค็มนะ ลองหาอาหารหมู่ดี ๆ ให้มากขึ้นนะ 😊');
        } else {
          this.setCoachText('ระวังของขยะด้วยน้า ลองโฟกัสที่หมู่อาหารดีเป็นหลัก 💡');
        }
        this.lastCoachHintTime = now;
      }
    },

    // ---- ตั้งค่าตัวแปรก่อนเริ่มรอบ ----
    resetRound: function (diffKey) {
      this.diffKey = String(diffKey || 'normal').toLowerCase();
      this.diffCfg = getDiffConfig(this.diffKey);

      this.clearTargets();

      this.running       = false;
      this.inIntro       = true;
      this.elapsed       = 0;
      this.spawnTimer    = 0;
      this.score         = 0;
      this.goodHits      = 0;
      this.missCount     = 0;

      this.goodStreak        = 0;
      this.missStreak        = 0;
      this.lastCoachHintTime = 0;

      if (this.elScore) this.elScore.textContent = '0';
      if (this.elTime)  this.elTime.textContent  = '60s';

      // ตั้งโจทย์ Goal / Mini ให้ตรง concept จัดหมู่อาหาร
      if (this.diffKey === 'easy') {
        this.goalText     = 'จัดหมู่อาหารหมู่ 1+2 (ข้าวแป้ง + ผักผลไม้)';
        this.miniText     = 'เก็บอาหารดี 10 ชิ้น เลี่ยงของขยะให้ได้เยอะที่สุด';
        this.goalScore    = 120;
        this.goalGoodHits = 10;
      } else if (this.diffKey === 'hard') {
        this.goalText     = 'จัดหมู่อาหารหมู่ 1+2+3+4 ให้สมดุลภายในเวลา 60 วินาที';
        this.miniText     = 'เก็บอาหารดี 18 ชิ้น และพยายามไม่โดนของขยะบ่อย ๆ';
        this.goalScore    = 220;
        this.goalGoodHits = 18;
      } else {
        // normal
        this.goalText     = 'จัดหมู่อาหารหมู่ 1+2+3 ให้ครบในเวลา 60 วินาที';
        this.miniText     = 'เก็บอาหารดี 14 ชิ้น เลี่ยงของหวานมันเค็ม';
        this.goalScore    = 180;
        this.goalGoodHits = 14;
      }

      if (this.elGoalMain) this.elGoalMain.textContent = this.goalText;
      if (this.elMiniMain) this.elMiniMain.textContent = this.miniText;

      this.updateGoalHUD();

      // reset fever
      this.fever       = 0;
      this.feverActive = false;
      FeverUI.ensureFeverBar();
      FeverUI.setFever(0);
      FeverUI.setFeverActive(false);
      FeverUI.setShield(0);
    },

    // ---- Intro + โค้ชอธิบาย + countdown ----
    startWithIntro: function (diffKey) {
      this.resetRound(diffKey);

      const self = this;

      const script = [
        'วันนี้เราจะฝึก "จัดหมู่อาหาร 5 หมู่" กันนะ 🍽️',
        'หมู่ที่ 1: ข้าว แป้ง ธัญพืช → ให้พลังงาน 💪',
        'หมู่ที่ 2: ผักหลากสี → วิตามิน + ไฟเบอร์ ช่วยให้ขับถ่ายดี 🥦',
        'หมู่ที่ 3: ผลไม้ → วิตามิน + น้ำตาลธรรมชาติ แต่ก็ไม่ควรเยอะเกินไปนะ 🍎🍌',
        'หมู่ที่ 4: เนื้อสัตว์ ไข่ ถั่วเมล็ดแห้ง → เสริมโปรตีนและกล้ามเนื้อ 🍗🥚',
        'หมู่ที่ 5: นมและผลิตภัณฑ์จากนม → เสริมแคลเซียม กระดูกและฟันแข็งแรง 🥛',
        'เดี๋ยวในเกม เป้าที่เป็นอาหารดีให้แตะได้เลย ส่วนของขยะให้หลบให้ไว ๆ นะ!'
      ];

      let stepIndex = 0;

      function playNextLine() {
        if (stepIndex < script.length) {
          self.setCoachText(script[stepIndex]);
          stepIndex++;
          setTimeout(playNextLine, 2300);
        } else {
          startCountdown();
        }
      }

      function startCountdown() {
        let n = 3;
        function tickCountdown() {
          if (n > 0) {
            self.setCoachText('เตรียมตัวให้พร้อม... ' + n);
            n--;
            setTimeout(tickCountdown, 900);
          } else {
            self.setCoachText('เริ่มจัดหมู่อาหารเลย! แตะแต่อาหารดีนะ 🥦🍎');
            self.startGame(self.diffKey);
          }
        }
        tickCountdown();
      }

      playNextLine();
    },

    // ---- เริ่มเกมจริง ----
    startGame: function (diffKey) {
      if (diffKey && diffKey !== this.diffKey) {
        this.resetRound(diffKey);
      }

      this.running       = true;
      this.inIntro       = false;
      this.elapsed       = 0;
      this.spawnTimer    = 0;

      if (this.elTime) this.elTime.textContent = '60s';

      console.log('[GroupsVR] startGame (play)', this.diffKey, this.diffCfg);
    },

    endGame: function () {
      if (!this.running && !this.inIntro) return;
      this.running = false;

      this.clearTargets();

      const scene = this.scene;
      if (!scene) return;

      const detail = {
        score: this.score,
        goodHits: this.goodHits,
        missCount: this.missCount,
        questsCleared: 0,
        questsTotal: 2,
        goal: `${this.goalText} (คะแนน ${this.score} / ${this.goalScore})`,
        miniQuest: `${this.miniText} (อาหารดี ${this.goodHits} / ${this.goalGoodHits})`
      };

      const passGoal = this.score    >= this.goalScore;
      const passMini = this.goodHits >= this.goalGoodHits;
      if (passGoal) detail.questsCleared++;
      if (passMini) detail.questsCleared++;

      scene.emit('fg-game-over', detail);
      console.log('[GroupsVR] game over', detail);

      // ---- โค้ชสรุปตามผลการเล่น ----
      const totalTaps = this.goodHits + this.missCount;
      const missRate = totalTaps > 0 ? this.missCount / totalTaps : 0;

      if (passGoal && passMini && missRate <= 0.2) {
        this.setCoachText('สุดยอด! จัดหมู่อาหารได้ดีมาก แทบไม่โดนของขยะเลย 🏆✨');
      } else if (passGoal || passMini) {
        this.setCoachText('ทำได้ดีเลย! ผ่านบางภารกิจแล้ว ลองโฟกัสอาหารดีให้มากขึ้นอีกนิดนะ 💪');
      } else if (missRate > 0.5) {
        this.setCoachText('รอบนี้โดนของขยะเยอะไปหน่อย ลองสังเกตว่าหมู่ไหนคืออาหารดี แล้วลองใหม่อีกครั้งนะ 😊');
      } else {
        this.setCoachText('เกือบแล้วนะ! ลองหายใจลึก ๆ แล้วตั้งใจเลือกหมู่อาหารดีใหม่อีกรอบ 💚');
      }
    },

    tick: function (t, dt) {
      if (!this.running) return;

      dt = dt || 16;

      this.elapsed    += dt;
      this.spawnTimer += dt;

      const remain = Math.max(0, this.timeLimit - this.elapsed);
      if (this.elTime) {
        this.elTime.textContent = Math.ceil(remain / 1000) + 's';
      }
      if (remain <= 0) {
        this.endGame();
        return;
      }

      if (this.spawnTimer >= this.diffCfg.spawnInterval) {
        this.spawnTimer = 0;
        this.spawnTarget();
      }
    },

    spawnTarget: function () {
      if (!this.layer) return;
      if (this.targets.length >= this.diffCfg.maxActive) return;

      const isGood = Math.random() < 0.6;
      const emoji  = pickEmoji(isGood);
      const pos    = randomScreenPos();

      const el = document.createElement('div');
      el.className = 'fg-target ' + (isGood ? 'fg-good' : 'fg-junk');
      el.setAttribute('data-emoji', emoji);
      el.style.left = pos.x + 'px';
      el.style.top  = pos.y + 'px';

      const baseScale = this.diffCfg.sizeFactor || 1.0;
      el.style.transform = 'translate(-50%, -50%) scale(' + baseScale + ')';

      const targetObj = {
        el,
        isGood
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
      const el = target.el;
      if (!el || !el.parentNode) return;

      let scoreDelta = 0;
      let judgment   = 'MISS';

      if (target.isGood) {
        scoreDelta   = +10;
        this.score  += 10;
        this.goodHits += 1;
        this.updateFever(FEVER_HIT_GAIN);
        judgment = 'GOOD';
      } else {
        scoreDelta   = -8;
        this.score   = Math.max(0, this.score - 8);
        this.missCount += 1;
        this.updateFever(-FEVER_MISS_LOSS);
        judgment = 'MISS';
      }

      if (this.elScore) this.elScore.textContent = String(this.score);
      this.updateGoalHUD();

      // FX
      if (Particles && typeof Particles.burstAt === 'function') {
        const rect = el.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;

        const color = target.isGood ? '#22c55e' : '#f97316';
        Particles.burstAt(x, y, { color, count: 16, radius: 60 });

        if (typeof Particles.scorePop === 'function') {
          const label =
            judgment === 'GOOD' ? '+10' :
            judgment === 'MISS' ? '-8'  :
            scoreDelta > 0 ? '+' + scoreDelta : String(scoreDelta);

          Particles.scorePop(x, y, label, {
            good: !!target.isGood
          });
        }
      }

      // โค้ช React ตาม Good/Miss
      this.handleCoachReaction(judgment);

      el.classList.add('hit');
      setTimeout(() => {
        if (el.parentNode) el.parentNode.removeChild(el);
      }, 120);

      this.targets = this.targets.filter((t) => t !== target);
    },

    clearTargets: function () {
      if (!this.layer) return;
      this.targets.forEach((t) => {
        if (t.el && t.el.parentNode) {
          t.el.parentNode.removeChild(t.el);
        }
      });
      this.targets = [];
    },

    updateGoalHUD: function () {
      if (this.elGoalProg) {
        const cur = Math.min(this.score, this.goalScore);
        this.elGoalProg.textContent = cur + ' / ' + this.goalScore;
      }
      if (this.elMiniProg) {
        const curGood = Math.min(this.goodHits, this.goalGoodHits);
        this.elMiniProg.textContent = curGood + ' / ' + this.goalGoodHits;
      }
    },

    remove: function () {
      this.clearTargets();
      this.running = false;
      this.inIntro = false;
    }
  });

  ns.foodGroupsGame = ns.foodGroupsGame || {};
})(window.GAME_MODULES || (window.GAME_MODULES = {}));
