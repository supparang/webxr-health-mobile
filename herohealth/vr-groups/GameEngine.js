// === /herohealth/vr-groups/GameEngine.js ===
// Food Groups VR — Game Engine (DOM emoji targets + Goal/Mini + Fever + FX)
// 2025-12-06 (no external difficulty.js dependence)

(function (ns) {
  'use strict';

  const A = window.AFRAME;
  if (!A) {
    console.error('[GroupsVR] AFRAME not found');
    return;
  }

  // ---------- Fever UI (shared) ----------
  const FeverUI =
    (window.GAME_MODULES && window.GAME_MODULES.FeverUI) ||
    window.FeverUI || {
      ensureFeverBar() {},
      setFever() {},
      setFeverActive() {},
      setShield() {}
    };

  const FEVER_MAX       = 100;
  const FEVER_HIT_GAIN  = 10;
  const FEVER_MISS_LOSS = 20;

  // ---------- In-file FX (score pop + burst) ----------
  function ensureFxLayer() {
    let layer = document.querySelector('.hha-fx-layer');
    if (layer) return layer;

    const styleId = 'hha-fx-layer-style';
    if (!document.getElementById(styleId)) {
      const st = document.createElement('style');
      st.id = styleId;
      st.textContent = `
        .hha-fx-layer{
          position:fixed;
          inset:0;
          pointer-events:none;
          z-index:70;
          overflow:hidden;
        }
        .hha-score-pop{
          position:absolute;
          transform:translate(-50%,-50%);
          font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
          font-size:14px;
          font-weight:600;
          padding:2px 6px;
          border-radius:999px;
          background:rgba(15,23,42,0.96);
          color:#bbf7d0;
          border:1px solid rgba(34,197,94,0.9);
          opacity:0;
          white-space:nowrap;
          box-shadow:0 10px 22px rgba(15,23,42,0.95);
          transition:transform .6s ease-out, opacity .6s ease-out;
        }
        .hha-score-pop.bad{
          color:#fed7aa;
          border-color:rgba(248,113,113,0.9);
        }
        .hha-frag{
          position:absolute;
          width:6px;
          height:6px;
          border-radius:999px;
          background:#22c55e;
          opacity:0.9;
          pointer-events:none;
          transform:translate(-50%,-50%);
          transition:transform .7s ease-out, opacity .7s ease-out;
        }
      `;
      document.head.appendChild(st);
    }

    layer = document.createElement('div');
    layer.className = 'hha-fx-layer';
    document.body.appendChild(layer);
    return layer;
  }

  function scorePop(x, y, text, opts) {
    const host = ensureFxLayer();
    const el = document.createElement('div');
    el.className = 'hha-score-pop' + (opts && opts.good === false ? ' bad' : '');
    el.textContent = text;
    el.style.left = x + 'px';
    el.style.top  = y + 'px';
    host.appendChild(el);

    requestAnimationFrame(function () {
      el.style.opacity = '1';
      el.style.transform = 'translate(-50%,-120%)';
    });

    setTimeout(function () {
      el.style.opacity = '0';
      el.style.transform = 'translate(-50%,-180%)';
      setTimeout(function () {
        if (el.parentNode) el.parentNode.removeChild(el);
      }, 260);
    }, 420);
  }

  function burstAt(x, y, good) {
    const host = ensureFxLayer();
    const color = good ? '#22c55e' : '#f97316';
    const n = 12;
    const radius = 50;

    for (let i = 0; i < n; i++) {
      const el = document.createElement('div');
      el.className = 'hha-frag';
      el.style.background = color;
      el.style.left = x + 'px';
      el.style.top  = y + 'px';
      host.appendChild(el);

      const ang = (i / n) * Math.PI * 2;
      const dist = radius + Math.random() * radius * 0.7;
      const dx = Math.cos(ang) * dist;
      const dy = Math.sin(ang) * dist;

      (function (node, dx2, dy2) {
        requestAnimationFrame(function () {
          node.style.transform = 'translate(' + dx2 + 'px,' + dy2 + 'px)';
          node.style.opacity = '0';
        });
        setTimeout(function () {
          if (node.parentNode) node.parentNode.removeChild(node);
        }, 720);
      })(el, dx, dy);
    }
  }

  // ---------- Difficulty (internal only) ----------
  function getDiffConfig(diffKey) {
    diffKey = String(diffKey || 'normal').toLowerCase();

    // **ไม่ใช้ difficulty.js ภายนอก** เพื่อกัน undefined
    if (diffKey === 'easy') {
      return {
        spawnInterval: 1400,
        maxActive:     3,
        sizeFactor:    1.15,
        lifeTime:      2600,
        goodScore:     10,
        junkPenalty:   5,
        junkRatio:     0.25,
        goalScore:     120,
        goalGoodHits:  10
      };
    }
    if (diffKey === 'hard') {
      return {
        spawnInterval: 900,
        maxActive:     5,
        sizeFactor:    0.90,
        lifeTime:      2100,
        goodScore:     12,
        junkPenalty:   8,
        junkRatio:     0.38,
        goalScore:     200,
        goalGoodHits:  16
      };
    }
    // normal
    return {
      spawnInterval: 1150,
      maxActive:     4,
      sizeFactor:    1.0,
      lifeTime:      2300,
      goodScore:     10,
      junkPenalty:   6,
      junkRatio:     0.30,
      goalScore:     150,
      goalGoodHits:  12
    };
  }

  // ---------- Emoji ----------
  const GOOD_EMOJI = ['🥦', '🍎', '🍚', '🍳', '🥛', '🍌', '🍇', '🥕', '🥝'];
  const JUNK_EMOJI = ['🍩', '🍟', '🍕', '🥤', '🍰', '🍫', '🍭', '🍪'];

  function pickEmoji(isGood) {
    if (ns.emojiImage && typeof ns.emojiImage.pick === 'function') {
      return ns.emojiImage.pick(isGood ? 'good' : 'junk');
    }
    const arr = isGood ? GOOD_EMOJI : JUNK_EMOJI;
    return arr[Math.floor(Math.random() * arr.length)];
  }

  // ---------- Random position (กลางจอ, ไม่ชน HUD/โค้ช) ----------
  function randomScreenPos() {
    const w = window.innerWidth || 1280;
    const h = window.innerHeight || 720;

    const topSafe    = 140;  // กัน HUD บน
    const bottomSafe = 160;  // กันโค้ชด้านล่าง

    const left  = w * 0.15;
    const right = w * 0.85;

    const x = left + Math.random() * (right - left);
    const y = topSafe + Math.random() * (h - topSafe - bottomSafe);
    return { x: x, y: y };
  }

  function clamp(v, min, max) {
    v = Number(v) || 0;
    if (v < min) return min;
    if (v > max) return max;
    return v;
  }

  // ---------- A-Frame component ----------
  A.registerComponent('food-groups-game', {
    schema: {},

    init: function () {
      const scene = this.el.sceneEl;
      this.scene = scene;

      this.layer = document.getElementById('fg-layer');
      if (!this.layer) {
        this.layer = document.createElement('div');
        this.layer.id = 'fg-layer';
        document.body.appendChild(this.layer);
      }

      this.elScore     = document.getElementById('hud-score');
      this.elTime      = document.getElementById('hud-time-label');
      this.elGoalMain  = document.getElementById('hud-goal-main');
      this.elGoalProg  = document.getElementById('hud-goal-progress');
      this.elMiniMain  = document.getElementById('hud-mini-main');
      this.elMiniProg  = document.getElementById('hud-mini-progress');
      this.elCoach     = document.getElementById('coach-bubble');
      this.elCoachText = document.getElementById('coach-text');

      this.running    = false;
      this.elapsed    = 0;
      this.timeLimit  = 60000;
      this.spawnTimer = 0;
      this.targets    = [];
      this.score      = 0;
      this.goodHits   = 0;
      this.missCount  = 0;

      this.diffKey = 'normal';
      this.diffCfg = getDiffConfig(this.diffKey);

      this.fever = 0;
      FeverUI.ensureFeverBar();
      FeverUI.setFever(0);
      FeverUI.setShield(0);
      FeverUI.setFeverActive(false);

      const startHandler = (e) => {
        const diff = (e.detail && e.detail.diff) || 'normal';
        this.startGame(diff);
      };
      scene.addEventListener('fg-start', startHandler);

      console.log('[GroupsVR] Game component initialized');
    },

    setCoach: function (text) {
      if (!this.elCoach || !this.elCoachText) return;
      if (!text) return;
      this.elCoachText.textContent = text;
      this.elCoach.classList.add('show');
    },

    updateFever: function (delta) {
      this.fever = clamp((this.fever || 0) + delta, 0, FEVER_MAX);
      FeverUI.setFever(this.fever);
      FeverUI.setFeverActive(this.fever >= FEVER_MAX);
    },

    startGame: function (diffKey) {
      this.diffKey = String(diffKey || 'normal').toLowerCase();
      this.diffCfg = getDiffConfig(this.diffKey);

      this.clearTargets();

      this.running    = true;
      this.elapsed    = 0;
      this.spawnTimer = 0;
      this.score      = 0;
      this.goodHits   = 0;
      this.missCount  = 0;
      this.fever      = 0;

      if (this.elScore) this.elScore.textContent = '0';
      if (this.elTime)  this.elTime.textContent  = '60s';

      if (this.elGoalMain) {
        this.elGoalMain.textContent =
          'ทำคะแนนให้ได้ ' + this.diffCfg.goalScore + '+';
      }
      if (this.elMiniMain) {
        this.elMiniMain.textContent =
          'เก็บอาหารดี ' + this.diffCfg.goalGoodHits + ' ชิ้น';
      }

      this.updateGoalHUD();

      FeverUI.ensureFeverBar();
      FeverUI.setFever(0);
      FeverUI.setShield(0);
      FeverUI.setFeverActive(false);

      this.setCoach('เลือกอาหารดีให้เยอะที่สุด ระวังขยะอาหารด้วยนะ!');

      console.log('[GroupsVR] startGame', this.diffKey, this.diffCfg);
    },

    endGame: function () {
      if (!this.running) return;
      this.running = false;
      this.clearTargets();

      const scene = this.scene;
      if (!scene) return;

      let questsCleared = 0;
      const questsTotal = 2;

      if (this.score    >= this.diffCfg.goalScore)    questsCleared++;
      if (this.goodHits >= this.diffCfg.goalGoodHits) questsCleared++;

      const detail = {
        score:      this.score,
        goodHits:   this.goodHits,
        missCount:  this.missCount,
        questsCleared: questsCleared,
        questsTotal:   questsTotal,
        goal: 'คะแนน ' + this.diffCfg.goalScore +
              '+ (' + this.score + ' / ' + this.diffCfg.goalScore + ')',
        miniQuest: 'อาหารดี ' + this.diffCfg.goalGoodHits +
                   ' ชิ้น (' + this.goodHits + ' / ' + this.diffCfg.goalGoodHits + ')'
      };

      scene.emit('fg-game-over', detail);
      console.log('[GroupsVR] game over', detail);

      if (questsCleared === questsTotal) {
        this.setCoach('สุดยอด! ผ่านทั้ง Goal และ Mini quest เลย 🎉');
      } else if (questsCleared === 1) {
        this.setCoach('ดีมาก! ลองเล่นรอบต่อไปให้ผ่านทุกภารกิจดูนะ 💪');
      } else {
        this.setCoach('ไม่เป็นไร รอบหน้าเลือกอาหารดีให้มากขึ้นนะ 😊');
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

      const isJunk = Math.random() < this.diffCfg.junkRatio;
      const isGood = !isJunk;
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
        el: el,
        isGood: isGood,
        isAlive: true,
        timeoutId: null
      };
      this.targets.push(targetObj);

      const onHit = (ev) => {
        ev.stopPropagation();
        ev.preventDefault();
        this.handleHit(targetObj, ev);
      };

      el.addEventListener('click', onHit);
      el.addEventListener('pointerdown', onHit);

      this.layer.appendChild(el);

      const life = this.diffCfg.lifeTime || 2300;
      const self = this;
      targetObj.timeoutId = setTimeout(function () {
        self.handleTimeout(targetObj);
      }, life);
    },

    handleTimeout: function (target) {
      if (!target.isAlive) return;
      target.isAlive = false;

      const el = target.el;
      if (el && el.parentNode) {
        el.parentNode.removeChild(el);
      }

      this.targets = this.targets.filter(function (t) {
        return t !== target;
      });

      this.missCount += 1;
      this.updateFever(-FEVER_MISS_LOSS);
      this.setCoach('ระวังอย่าให้เป้าหมายหลุดมือบ่อยนะ 👀');
    },

    handleHit: function (target, ev) {
      if (!this.running) return;
      if (!target.isAlive) return;

      target.isAlive = false;
      if (target.timeoutId) {
        clearTimeout(target.timeoutId);
        target.timeoutId = null;
      }

      const el = target.el;
      if (!el || !el.parentNode) return;

      let x = 0;
      let y = 0;
      if (ev && ev.clientX != null) {
        x = ev.clientX;
        y = ev.clientY;
      } else {
        const rect = el.getBoundingClientRect();
        x = rect.left + rect.width / 2;
        y = rect.top  + rect.height / 2;
      }

      if (target.isGood) {
        this.score    += this.diffCfg.goodScore;
        this.goodHits += 1;
        this.updateFever(FEVER_HIT_GAIN);
        scorePop(x, y, '+' + this.diffCfg.goodScore, { good: true });
        burstAt(x, y, true);
      } else {
        const penalty = this.diffCfg.junkPenalty;
        this.score = Math.max(0, this.score - penalty);
        this.missCount += 1;
        this.updateFever(-FEVER_MISS_LOSS);
        scorePop(x, y, '-' + penalty, { good: false });
        burstAt(x, y, false);
      }

      if (this.elScore) {
        this.elScore.textContent = String(this.score);
      }
      this.updateGoalHUD();

      el.classList.add('hit');
      setTimeout(function () {
        if (el.parentNode) el.parentNode.removeChild(el);
      }, 140);

      this.targets = this.targets.filter(function (t) {
        return t !== target;
      });
    },

    updateGoalHUD: function () {
      if (this.elGoalProg) {
        this.elGoalProg.textContent =
          '(' + this.score + ' / ' + this.diffCfg.goalScore + ')';
      }
      if (this.elMiniProg) {
        this.elMiniProg.textContent =
          '(' + this.goodHits + ' / ' + this.diffCfg.goalGoodHits + ')';
      }
    },

    clearTargets: function () {
      const list = this.targets || [];
      for (let i = 0; i < list.length; i++) {
        const t = list[i];
        if (t.timeoutId) clearTimeout(t.timeoutId);
        if (t.el && t.el.parentNode) {
          t.el.parentNode.removeChild(t.el);
        }
      }
      this.targets = [];
    },

    remove: function () {
      this.clearTargets();
      this.running = false;
    }
  });

  ns.foodGroupsGame = ns.foodGroupsGame || {};
})(window.GAME_MODULES || (window.GAME_MODULES = {}));