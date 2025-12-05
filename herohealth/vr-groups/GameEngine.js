// === /herohealth/vr-groups/GameEngine.js ===
// Food Groups VR — Game Engine
// • emoji badge targets (ไม่ซ้อนกัน)
// • ขนาดเป้าตามระดับ (ง่าย/ปกติ/ยาก)
// • Goal + Mini quest พร้อม progress บน HUD
// • Coach bubble พูดอัปเดตตามความคืบหน้า
// • DOM FX: คะแนน/คำตัดสินเด้งตรงเป้า + burst วงกลม
// 2025-12-06 (progress + coach)

(function (ns) {
  'use strict';

  const A = window.AFRAME;
  if (!A) {
    console.error('[GroupsVR] AFRAME not found');
    return;
  }

  const doc = window.document;
  const USE_FEVER_UI = false;
  const FEVER_MAX = 100;

  function clamp(v, min, max) {
    v = Number(v) || 0;
    if (v < min) return min;
    if (v > max) return max;
    return v;
  }

  // ===== emoji → texture (canvas) cache =====
  const emojiTexCache = {};

  function makeEmojiTexture(emojiChar) {
    emojiChar = emojiChar || '🍎';
    if (emojiTexCache[emojiChar]) return emojiTexCache[emojiChar];

    const canvas = doc.createElement('canvas');
    const size = 256;
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.clearRect(0, 0, size, size);

    // เงาจานด้านหลัง
    ctx.fillStyle = 'rgba(15,23,42,0.35)';
    ctx.beginPath();
    ctx.arc(size / 2 + 6, size / 2 + 6, size / 2.6, 0, Math.PI * 2);
    ctx.fill();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font =
      '200px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",system-ui,sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(emojiChar, size / 2, size / 2);

    const url = canvas.toDataURL('image/png');
    emojiTexCache[emojiChar] = url;
    return url;
  }

  // ===== Difficulty (มีทั้งจาก difficulty.js และ fallback) =====
  function pickDifficulty(diffKey) {
    diffKey = String(diffKey || 'normal').toLowerCase();

    // ใช้ค่าจาก difficulty.js ถ้ามี
    if (ns.foodGroupsDifficulty && ns.foodGroupsDifficulty.get) {
      return ns.foodGroupsDifficulty.get(diffKey);
    }

    // fallback — เผื่อโหลดไฟล์ difficulty.js ไม่ได้
    if (diffKey === 'easy') {
      return {
        spawnInterval: 1400,
        fallSpeed: 0.0,
        scale: 1.3,
        maxActive: 3,
        goodRatio: 0.8
      };
    }
    if (diffKey === 'hard') {
      return {
        spawnInterval: 900,
        fallSpeed: 0.0,
        scale: 0.8,
        maxActive: 4,
        goodRatio: 0.7
      };
    }
    // normal
    return {
      spawnInterval: 1200,
      fallSpeed: 0.0,
      scale: 1.0,
      maxActive: 3,
      goodRatio: 0.75
    };
  }

  function createSessionId() {
    return (
      'FG-' +
      Date.now().toString(36) +
      '-' +
      Math.random().toString(36).slice(2, 8)
    );
  }

  // ===== fixed spawn slots (กันเป้าซ้อนกัน) =====
  const SPAWN_SLOTS = [
    { x: -0.9,  y: 1.6, z: -2.3 },
    { x:  0.0,  y: 1.7, z: -2.2 },
    { x:  0.9,  y: 1.6, z: -2.3 },
    { x: -0.45, y: 2.1, z: -2.2 },
    { x:  0.45, y: 2.1, z: -2.2 }
  ];

  function distanceSq(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const dz = a.z - b.z;
    return dx * dx + dy * dy + dz * dz;
  }

  function findSlotIndexForPos(pos) {
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < SPAWN_SLOTS.length; i++) {
      const d = distanceSq(pos, SPAWN_SLOTS[i]);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    return best;
  }

  function pickFreeSlot(activeTargets) {
    const used = new Set();
    for (let i = 0; i < activeTargets.length; i++) {
      const t = activeTargets[i];
      if (!t || !t.getAttribute) continue;
      const p = t.getAttribute('position') || { x: 0, y: 0, z: 0 };
      const idx = findSlotIndexForPos(p);
      used.add(idx);
    }

    const free = [];
    for (let i = 0; i < SPAWN_SLOTS.length; i++) {
      if (!used.has(i)) free.push(i);
    }

    if (free.length === 0) {
      return SPAWN_SLOTS[Math.floor(Math.random() * SPAWN_SLOTS.length)];
    }
    const pick = free[Math.floor(Math.random() * free.length)];
    return SPAWN_SLOTS[pick];
  }

  // ===== DOM FX layer =====
  let fxLayer = null;

  function ensureFxLayer() {
    if (fxLayer && fxLayer.parentNode) return fxLayer;
    fxLayer = doc.createElement('div');
    fxLayer.className = 'fg-fx-layer';
    doc.body.appendChild(fxLayer);
    return fxLayer;
  }

  function spawnScoreFx(screenPos, delta) {
    const layer = ensureFxLayer();
    const el = doc.createElement('div');
    el.className = 'fg-fx-score';
    if (delta > 0) el.classList.add('good');
    if (delta < 0) el.classList.add('bad');

    const sign = delta > 0 ? '+' : '';
    el.textContent = sign + String(delta);

    el.style.left = screenPos.x + 'px';
    el.style.top  = screenPos.y + 'px';

    layer.appendChild(el);
    setTimeout(() => {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 900);
  }

  function spawnJudgmentFx(screenPos, judgment) {
    const layer = ensureFxLayer();
    const el = doc.createElement('div');
    el.className = 'fg-fx-judgment';
    el.textContent = judgment || '';
    el.style.left = screenPos.x + 'px';
    el.style.top  = screenPos.y + 'px';
    layer.appendChild(el);
    setTimeout(() => {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 650);
  }

  function spawnBurstFx(screenPos, isGood) {
    const layer = ensureFxLayer();
    const el = doc.createElement('div');
    el.className = 'fg-fx-burst';
    if (isGood) el.classList.add('good');
    else el.classList.add('bad');
    el.style.left = screenPos.x + 'px';
    el.style.top  = screenPos.y + 'px';
    layer.appendChild(el);
    setTimeout(() => {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 450);
  }

  // ===== Goal config ตามระดับ =====
  const GOAL_TABLE = {
    easy:    { scoreTarget: 80,  goodTarget: 8 },
    normal:  { scoreTarget: 150, goodTarget: 12 },
    hard:    { scoreTarget: 220, goodTarget: 18 }
  };

  A.registerComponent('food-groups-game', {
    schema: {},

    init: function () {
      console.log('[GroupsVR] component init');

      this.running    = false;
      this.targets    = [];
      this.elapsed    = 0;
      this.durationMs = 60000;
      this.diffKey    = 'normal';
      this.cfg        = pickDifficulty(this.diffKey);

      this.spawnClock = 0;
      this.score      = 0;

      this.fever       = 0;
      this.feverActive = false;

      this.sessionId = createSessionId();
      this.events    = [];

      // Goal / mini quest state
      this.goalScoreTarget = 150;
      this.goalGoodTarget  = 12;
      this.goodHits        = 0;

      this.goalText = '';
      this.miniText = '';

      this.goalHalfCoachShown = false;
      this.goalDoneCoachShown = false;
      this.miniHalfCoachShown = false;
      this.miniDoneCoachShown = false;
      this.missCoachCounter   = 0;

      // HUD
      this._hudScore = doc.getElementById('hud-score');
      this._hudTime  = doc.getElementById('hud-time-label');
      this._hudGoal  = doc.getElementById('hud-goal-text');
      this._hudMini  = doc.getElementById('hud-mini-text');

      // Coach DOM
      this._coachBubble = doc.getElementById('coach-bubble');
      this._coachText   = doc.getElementById('coach-text');
      this._lastCoachKey = null;
      this._lastCoachTime = 0;

      if (USE_FEVER_UI && ns.FeverUI && ns.FeverUI.ensureFeverBar) {
        ns.FeverUI.ensureFeverBar();
        ns.FeverUI.setFever(0);
        ns.FeverUI.setFeverActive(false);
        ns.FeverUI.setShield(0);
      }

      const scene = this.el.sceneEl;
      const self  = this;

      scene.addEventListener('fg-start', function (e) {
        const diff = (e && e.detail && e.detail.diff) || 'normal';
        self.start(diff);
      });

      scene.addEventListener('fg-stop', function () {
        self.finish('stop');
      });

      this._lastLogSec = -1;
    },

    // ===== Coach helper =====
    coachSay: function (text, key) {
      const now = performance.now();
      if (!this._coachText || !this._coachBubble) return;
      // กันพูดซ้ำบ่อย ๆ
      if (key && this._lastCoachKey === key && now - this._lastCoachTime < 4000) {
        return;
      }
      this._coachText.textContent = text;
      this._coachBubble.classList.add('show');
      this._lastCoachKey = key || null;
      this._lastCoachTime = now;
    },

    updateGoalHud: function () {
      const scoreTarget = this.goalScoreTarget || 0;
      const goodTarget  = this.goalGoodTarget || 0;

      if (this._hudGoal) {
        this._hudGoal.textContent =
          'คะแนน ' + scoreTarget + '+ (' +
          this.score + ' / ' + scoreTarget + ')';
      }

      if (this._hudMini) {
        this._hudMini.textContent =
          'เก็บอาหารดี ' + goodTarget + ' ชิ้น (' +
          this.goodHits + ' / ' + goodTarget + ')';
      }
    },

    checkCoachProgress: function () {
      const scoreTarget = this.goalScoreTarget || 0;
      const goodTarget  = this.goalGoodTarget || 0;

      // goal ครึ่งหนึ่ง
      if (
        scoreTarget > 0 &&
        !this.goalHalfCoachShown &&
        this.score >= scoreTarget * 0.5
      ) {
        this.goalHalfCoachShown = true;
        this.coachSay('ดีมาก! คะแนนเกินครึ่งเป้าหมายแล้ว ✨', 'goal-half');
      }

      // goal สำเร็จ
      if (
        scoreTarget > 0 &&
        !this.goalDoneCoachShown &&
        this.score >= scoreTarget
      ) {
        this.goalDoneCoachShown = true;
        this.coachSay('เยี่ยมเลย! แตะเป้าคะแนนวันนี้แล้ว 🎉', 'goal-done');
      }

      // mini quest ครึ่งหนึ่ง
      if (
        goodTarget > 0 &&
        !this.miniHalfCoachShown &&
        this.goodHits >= Math.ceil(goodTarget * 0.5)
      ) {
        this.miniHalfCoachShown = true;
        this.coachSay('เก็บอาหารดีได้เยอะแล้ว สู้ต่ออีกนิดนะ 💪', 'mini-half');
      }

      // mini quest สำเร็จ
      if (
        goodTarget > 0 &&
        !this.miniDoneCoachShown &&
        this.goodHits >= goodTarget
      ) {
        this.miniDoneCoachShown = true;
        this.coachSay('สุดยอดเลย! เก็บอาหารดีครบตามภารกิจแล้ว 🥦', 'mini-done');
      }
    },

    start: function (diffKey) {
      this.diffKey = String(diffKey || 'normal').toLowerCase();
      this.cfg     = pickDifficulty(this.diffKey);

      this.running     = true;
      this.elapsed     = 0;
      this.spawnClock  = 0;
      this.targets.length = 0;
      this.score       = 0;
      this.fever       = 0;
      this.feverActive = false;
      this.events.length = 0;
      this.sessionId   = createSessionId();

      this.goodHits = 0;
      this.goalHalfCoachShown = false;
      this.goalDoneCoachShown = false;
      this.miniHalfCoachShown = false;
      this.miniDoneCoachShown = false;
      this.missCoachCounter   = 0;

      if (this._hudScore) this._hudScore.textContent = '0';
      if (this._hudTime) {
        const sec = (this.durationMs / 1000) | 0;
        this._hudTime.textContent = sec + 's';
      }

      // ตั้ง target ตาม diff
      const g = GOAL_TABLE[this.diffKey] || GOAL_TABLE.normal;
      this.goalScoreTarget = g.scoreTarget;
      this.goalGoodTarget  = g.goodTarget;

      // เก็บ text สำหรับสรุปตอนจบ (ไม่ต้องมี progress)
      this.goalText =
        'คะแนนอย่างน้อย ' + this.goalScoreTarget;
      this.miniText =
        'เก็บอาหารดี ' + this.goalGoodTarget + ' ชิ้น';

      this.updateGoalHud();

      if (USE_FEVER_UI && ns.FeverUI) {
        ns.FeverUI.setFever(0);
        ns.FeverUI.setFeverActive(false);
        ns.FeverUI.setShield(0);
      }

      this.coachSay('แตะเป้าอาหารให้ตรงหมวด แล้วเก็บอาหารดีให้ได้ตามภารกิจนะ!', 'start');

      console.log('[GroupsVR] start diff=', this.diffKey, 'cfg=', this.cfg);
    },

    tick: function (time, dt) {
      if (!this.running) return;
      if (!dt || dt <= 0) dt = 16;

      this.elapsed    += dt;
      this.spawnClock += dt;

      if (this.elapsed >= this.durationMs) {
        this.finish('timeout');
        return;
      }

      const cfg       = this.cfg || {};
      const interval  = cfg.spawnInterval || 1200;
      const maxActive = cfg.maxActive || 3;

      if (this.spawnClock >= interval) {
        this.spawnClock = 0;
        if (this.targets.length < maxActive) {
          this.spawnTarget();
        }
      }

      this.updateTargets(dt);

      if (this._hudTime) {
        const remainMs  = Math.max(0, this.durationMs - this.elapsed);
        const remainSec = (remainMs / 1000) | 0;
        this._hudTime.textContent = remainSec + 's';
      }

      const sec = (this.elapsed / 1000) | 0;
      if (sec !== this._lastLogSec) {
        this._lastLogSec = sec;
        console.log('[GroupsVR] tick sec=', sec, 'targets=', this.targets.length);
      }
    },

    // ===== เป้า emoji badge (ไม่ซ้อนกัน + scale ตาม diff) =====
    spawnTarget: function () {
      const emojiMod = ns.foodGroupsEmoji;
      let item = null;
      if (emojiMod && typeof emojiMod.pickRandom === 'function') {
        item = emojiMod.pickRandom();
      }
      if (!item) {
        item = { emoji: '🍎', group: 3, isGood: true, name: 'ผลไม้' };
      }

      const el = doc.createElement('a-entity');
      el.setAttribute('data-hha-tgt', '1');

      const pos = pickFreeSlot(this.targets);
      el.setAttribute('position', pos);

      const scale  = this.cfg.scale || 1.0;
      const isGood = !!item.isGood;

      // พื้นวงกลม
      el.setAttribute('geometry', {
        primitive: 'circle',
        radius: 0.40 * scale
      });
      el.setAttribute('material', {
        shader: 'flat',
        color: isGood ? '#16a34a' : '#f97316',
        opacity: 1.0,
        side: 'double'
      });

      // ขอบ
      const border = doc.createElement('a-entity');
      border.setAttribute('geometry', {
        primitive: 'ring',
        radiusInner: 0.40 * scale,
        radiusOuter: 0.46 * scale
      });
      border.setAttribute('material', {
        shader: 'flat',
        color: '#020617',
        side: 'double'
      });
      border.setAttribute('position', { x: 0, y: 0, z: 0.005 });
      el.appendChild(border);

      // emoji ตรงกลาง
      const emojiChar = item.emoji || (isGood ? '✅' : '✖️');
      const texUrl = makeEmojiTexture(emojiChar);
      if (texUrl) {
        const img = doc.createElement('a-image');
        img.setAttribute('src', texUrl);
        img.setAttribute('width',  0.64 * scale);
        img.setAttribute('height', 0.64 * scale);
        img.setAttribute('position', { x: 0, y: 0, z: 0.02 });
        el.appendChild(img);
      }

      const groupId = item && item.group != null ? item.group : 0;
      el.setAttribute('data-group', String(groupId));
      el.setAttribute('data-good', isGood ? '1' : '0');

      el._life      = 15000;
      el._age       = 0;
      el._spawnTime = performance.now();
      el._metaItem  = item || {};

      const self = this;
      el.addEventListener('click', function () {
        self.onHit(el);
      });

      this.el.sceneEl.appendChild(el);
      this.targets.push(el);

      console.log('[GroupsVR] spawnTarget', item, 'total=', this.targets.length);
    },

    updateTargets: function (dt) {
      if (!this.targets || this.targets.length === 0) return;
      for (let i = this.targets.length - 1; i >= 0; i--) {
        const t = this.targets[i];
        if (!t) continue;
        t._age = (t._age || 0) + dt;
        if (t._life && t._age >= t._life) {
          this.onMiss(t);
        }
      }
    },

    removeTarget: function (el) {
      const idx = this.targets.indexOf(el);
      if (idx !== -1) this.targets.splice(idx, 1);
      if (el && el.parentNode) el.parentNode.removeChild(el);
    },

    // ===== world → screen helper =====
    worldToScreen: function (pos) {
      try {
        if (!pos || !window.THREE) {
          return {
            x: window.innerWidth / 2,
            y: window.innerHeight / 2
          };
        }
        const scene = this.el.sceneEl;
        const cam   = scene && scene.camera;
        if (!cam) {
          return {
            x: window.innerWidth / 2,
            y: window.innerHeight / 2
          };
        }

        const v = new THREE.Vector3(pos.x, pos.y, pos.z);
        v.project(cam);

        const x = (v.x * 0.5 + 0.5) * window.innerWidth;
        const y = (-v.y * 0.5 + 0.5) * window.innerHeight;
        return { x, y };
      } catch (e) {
        return {
          x: window.innerWidth / 2,
          y: window.innerHeight / 2
        };
      }
    },

    // ===== hit / miss =====
    onHit: function (el) {
      const isGood  = el.getAttribute('data-good') === '1';
      const groupId = parseInt(el.getAttribute('data-group') || '0', 10) || 0;
      const item    = el._metaItem || {};
      const emoji   = item.emoji || '';

      const now  = performance.now();
      const rtMs = el._spawnTime ? now - el._spawnTime : null;

      let delta = isGood ? 10 : -5;
      this.score = Math.max(0, this.score + delta);
      if (this._hudScore) this._hudScore.textContent = String(this.score);

      if (isGood) {
        this.goodHits += 1;
      }

      this.updateGoalHud();
      this.checkCoachProgress();

      this.updateFeverOnHit(isGood);

      const worldPos  = this.copyWorldPos(el);
      const screenPos = this.worldToScreen(worldPos);

      const judgment = isGood ? 'GOOD' : 'MISS';
      spawnScoreFx(screenPos, delta);
      spawnJudgmentFx(screenPos, judgment);
      spawnBurstFx(screenPos, isGood);

      this.logEvent({
        type: 'hit',
        groupId,
        emoji,
        isGood: !!isGood,
        hitOrMiss: 'hit',
        rtMs,
        scoreDelta: delta,
        pos: worldPos
      });

      this.removeTarget(el);

      if (!isGood) {
        this.missCoachCounter++;
        if (this.missCoachCounter >= 3) {
          this.missCoachCounter = 0;
          this.coachSay('พลาดไปนิด ลองโฟกัสที่อาหารกลุ่มที่ใช่ดูอีกทีนะ 👀', 'miss-tip');
        }
      }
    },

    onMiss: function (el) {
      const groupId = parseInt(el.getAttribute('data-group') || '0', 10) || 0;
      const item    = el._metaItem || {};
      const emoji   = item.emoji || '';

      const now  = performance.now();
      const rtMs = el._spawnTime ? now - el._spawnTime : null;

      this.updateFeverOnMiss();

      const worldPos  = this.copyWorldPos(el);
      const screenPos = this.worldToScreen(worldPos);

      spawnJudgmentFx(screenPos, 'MISS');
      spawnBurstFx(screenPos, false);

      this.logEvent({
        type: 'miss',
        groupId,
        emoji,
        isGood: false,
        hitOrMiss: 'miss',
        rtMs,
        scoreDelta: 0,
        pos: worldPos
      });

      this.removeTarget(el);

      this.missCoachCounter++;
      if (this.missCoachCounter >= 3) {
        this.missCoachCounter = 0;
        this.coachSay('พลาดไปบ้างไม่เป็นไร ค่อย ๆ เลือกให้ตรงกลุ่มนะ 🙂', 'miss-tip');
      }
    },

    copyWorldPos: function (el) {
      if (!el || !el.object3D || !window.THREE) return null;
      const v = el.object3D.getWorldPosition(new THREE.Vector3());
      return { x: v.x, y: v.y, z: v.z };
    },

    // ===== Fever (ตอนนี้ไม่โชว์ UI แค่เก็บค่า) =====
    updateFeverOnHit: function (isGood) {
      let f = this.fever || 0;
      f += isGood ? 8 : -12;
      this.fever = clamp(f, 0, FEVER_MAX);
    },

    updateFeverOnMiss: function () {
      let f = this.fever || 0;
      f -= 5;
      this.fever = clamp(f, 0, FEVER_MAX);
    },

    // ===== Logging / Finish =====
    logEvent: function (ev) {
      this.events.push(ev);
    },

    finish: function (reason) {
      if (!this.running) return;
      this.running = false;

      for (let i = 0; i < this.targets.length; i++) {
        const el = this.targets[i];
        if (el && el.parentNode) el.parentNode.removeChild(el);
      }
      this.targets.length = 0;

      if (this._hudTime) this._hudTime.textContent = '0s';

      const scene = this.el.sceneEl;

      if (ns.foodGroupsCloudLogger && typeof ns.foodGroupsCloudLogger.send === 'function') {
        const rawSession = {
          sessionId:  this.sessionId,
          score:      this.score,
          difficulty: this.diffKey,
          durationMs: this.elapsed,
          goal:       this.goalText,
          miniQuest:  this.miniText,
          goodHits:   this.goodHits
        };
        ns.foodGroupsCloudLogger.send(rawSession, this.events);
      }

      // นับว่าผ่าน goal/mini quest กี่อัน
      let questsCleared = 0;
      let questsTotal   = 2;
      if (this.score >= this.goalScoreTarget) questsCleared++;
      if (this.goodHits >= this.goalGoodTarget) questsCleared++;

      scene.emit('fg-game-over', {
        score:        this.score,
        diff:         this.diffKey,
        reason:       reason || 'finish',
        goal:         this.goalText,
        miniQuest:    this.miniText,
        questsCleared,
        questsTotal
      });

      console.log('[GroupsVR] finish', reason, 'score=', this.score);
    }
  });
})(window.GAME_MODULES || (window.GAME_MODULES = {}));