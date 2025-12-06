// === /herohealth/vr-groups/GameEngine.js ===
// Food Groups VR — Game Engine (emoji targets + quest + coach)
// 2025-12-06

(function (ns) {
  'use strict';

  const A = window.AFRAME;
  if (!A) {
    console.error('[GroupsVR] AFRAME not found');
    return;
  }

  const FEVER_MAX = 100;

  function clamp(v, min, max) {
    v = Number(v) || 0;
    if (v < min) return min;
    if (v > max) return max;
    return v;
  }

  function pickDifficulty(diffKey) {
    diffKey = String(diffKey || 'normal').toLowerCase();

    if (ns.foodGroupsDifficulty && ns.foodGroupsDifficulty.get) {
      return ns.foodGroupsDifficulty.get(diffKey);
    }

    // fallback ถ้าไม่มี difficulty.js
    let scale = 1.0;
    let spawnInterval = 1100;
    let maxActive = 4;

    if (diffKey === 'easy') {
      scale = 1.25;
      spawnInterval = 1200;
      maxActive = 3;
    } else if (diffKey === 'hard') {
      scale = 0.9;
      spawnInterval = 900;
      maxActive = 5;
    }

    return {
      spawnInterval,
      fallSpeed: 0.0,
      scale,
      maxActive,
      goodRatio: 0.75,
      quest: { goalsPick: 2, miniPick: 3 }
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

  // ---------- Quest pool ----------

  const QUEST_POOL = {
    goals: [
      { id: 'G_SCORE_150', label: 'คะแนนรวมให้ได้อย่างน้อย 150+', kind: 'score', target: 150 },
      { id: 'G_SCORE_180', label: 'ล่าแต้มให้ได้เกิน 180 คะแนน', kind: 'score', target: 180 },
      { id: 'G_SCORE_200', label: 'ภารกิจล่าแต้ม 200+', kind: 'score', target: 200 },
      { id: 'G_SCORE_140', label: 'อุ่นเครื่องที่ 140 คะแนน', kind: 'score', target: 140 },
      { id: 'G_SCORE_170', label: 'ลองเก็บคะแนน 170+ ดูสิ', kind: 'score', target: 170 },
      { id: 'G_SCORE_160', label: 'ภารกิจแต้มกลาง ๆ 160+', kind: 'score', target: 160 },
      { id: 'G_SCORE_190', label: 'ลุ้นแต้มใหญ่ 190 คะแนน', kind: 'score', target: 190 },
      { id: 'G_SCORE_130', label: 'เริ่มง่าย ๆ ที่ 130 คะแนน', kind: 'score', target: 130 },
      { id: 'G_SCORE_155', label: 'เก็บสะสมให้ถึง 155 คะแนน', kind: 'score', target: 155 },
      { id: 'G_SCORE_210', label: 'สุดยอด! ลอง 210 คะแนนดูไหม', kind: 'score', target: 210 }
    ],
    minis: [
      { id: 'M_GOOD_12', label: 'เก็บอาหารดีให้ได้ 12 ชิ้น', kind: 'goodHits', target: 12 },
      { id: 'M_GOOD_10', label: 'เริ่มจากอาหารดี 10 ชิ้น', kind: 'goodHits', target: 10 },
      { id: 'M_GOOD_14', label: 'ล่าอาหารดีกลุ่มโปรด 14 ชิ้น', kind: 'goodHits', target: 14 },
      { id: 'M_GOOD_8',  label: 'เก็บอาหารดี 8 ชิ้นแบบเน้น ๆ', kind: 'goodHits', target: 8 },
      { id: 'M_GOOD_16', label: 'ท้าทาย! อาหารดี 16 ชิ้น', kind: 'goodHits', target: 16 },
      { id: 'M_GOOD_9',  label: 'โฟกัสอาหารดีอย่างน้อย 9 ชิ้น', kind: 'goodHits', target: 9 },
      { id: 'M_GOOD_11', label: 'สะสมอาหารดีให้ได้ 11 ชิ้น', kind: 'goodHits', target: 11 },
      { id: 'M_GOOD_13', label: 'ภารกิจอาหารดี 13 ชิ้น', kind: 'goodHits', target: 13 },
      { id: 'M_GOOD_7',  label: 'วอร์มอัพ อาหารดี 7 ชิ้น', kind: 'goodHits', target: 7 },
      { id: 'M_GOOD_15', label: 'ลองเก็บอาหารดี 15 ชิ้น', kind: 'goodHits', target: 15 }
    ]
  };

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      const t = a[i];
      a[i] = a[j];
      a[j] = t;
    }
    return a;
  }

  // ---------- Coach helper ----------

  function Coach() {
    this.elBubble = document.getElementById('coach-bubble');
    this.elText = document.getElementById('coach-text');
    this.elName = document.getElementById('coach-name');
    this.elEmoji = document.getElementById('coach-emoji');
    this.lastSpeakAt = 0;

    if (this.elName) this.elName.textContent = 'โค้ชโภชนาการ';
    if (this.elEmoji) this.elEmoji.textContent = '🥦';
  }

  Coach.prototype.say = function (msg, opts) {
    const now = performance.now();
    const minGap = (opts && opts.minGapMs) || 2800;
    if (now - this.lastSpeakAt < minGap) return;

    this.lastSpeakAt = now;
    if (!this.elBubble || !this.elText) return;
    this.elText.textContent = msg || '';
    this.elBubble.classList.add('show');
  };

  // ---------- Component ----------

  A.registerComponent('food-groups-game', {
    schema: {},

    init: function () {
      console.log('[GroupsVR] component init');

      this.running = false;
      this.targets = [];
      this.elapsed = 0;
      this.durationMs = 60000; // 60s
      this.diffKey = 'normal';
      this.cfg = pickDifficulty(this.diffKey);

      this.spawnClock = 0;
      this.score = 0;

      // Fever
      this.fever = 0;
      this.feverActive = false;

      // Logging
      this.sessionId = createSessionId();
      this.events = [];

      // Quest state
      this.quest = null;

      // HUD
      this.elScore = document.getElementById('hud-score');
      this.elGoalMain = document.getElementById('hud-goal-main');
      this.elGoalProg = document.getElementById('hud-goal-progress');
      this.elMiniMain = document.getElementById('hud-mini-main');
      this.elMiniProg = document.getElementById('hud-mini-progress');

      // Coach
      this.coach = new Coach();

      // Fever bar (global)
      if (ns.FeverUI && ns.FeverUI.ensureFeverBar) {
        ns.FeverUI.ensureFeverBar();
        ns.FeverUI.setFever(0);
        ns.FeverUI.setFeverActive(false);
        ns.FeverUI.setShield(0);
      }

      const scene = this.el.sceneEl;
      const self = this;

      scene.addEventListener('fg-start', function (e) {
        const diff = (e && e.detail && e.detail.diff) || 'normal';
        self.start(diff);
      });

      scene.addEventListener('fg-stop', function () {
        self.finish('stop');
      });

      this._lastLogSec = -1;
    },

    // ---------- start / quest init ----------

    start: function (diffKey) {
      this.diffKey = String(diffKey || 'normal').toLowerCase();
      this.cfg = pickDifficulty(this.diffKey);

      this.running = true;
      this.elapsed = 0;
      this.spawnClock = 0;
      this.targets.length = 0;
      this.score = 0;
      this.fever = 0;
      this.feverActive = false;
      this.events.length = 0;
      this.sessionId = createSessionId();

      if (this.elScore) this.elScore.textContent = '0';

      if (ns.FeverUI) {
        ns.FeverUI.setFever(0);
        ns.FeverUI.setFeverActive(false);
        ns.FeverUI.setShield(0);
      }

      // init quest
      const qCfg = this.cfg.quest || { goalsPick: 2, miniPick: 3 };
      this.quest = {
        maxGoals: qCfg.goalsPick || 2,
        maxMinis: qCfg.miniPick || 3,
        goalPool: shuffle(QUEST_POOL.goals),
        miniPool: shuffle(QUEST_POOL.minis),
        currentGoal: null,
        currentMini: null,
        goalProgress: 0,
        miniProgress: 0,
        goalsCleared: 0,
        minisCleared: 0
      };
      this.pickNextGoal();
      this.pickNextMini();
      this.updateQuestUI();

      if (this.coach) {
        this.coach.say('แตะเป้าอาหารให้ตรงหมวด แล้วเก็บอาหารดีให้ได้ตามภารกิจนะ!');
      }

      console.log('[GroupsVR] start diff=', this.diffKey, 'cfg=', this.cfg);
    },

    pickNextGoal: function () {
      const q = this.quest;
      if (!q) return;
      if (q.goalsCleared >= q.maxGoals) {
        q.currentGoal = null;
        return;
      }
      q.currentGoal = q.goalPool.shift() || null;
      q.goalProgress = 0;
    },

    pickNextMini: function () {
      const q = this.quest;
      if (!q) return;
      if (q.minisCleared >= q.maxMinis) {
        q.currentMini = null;
        return;
      }
      q.currentMini = q.miniPool.shift() || null;
      q.miniProgress = 0;
    },

    updateQuestUI: function () {
      const q = this.quest;
      if (!q) return;

      // GOAL
      if (this.elGoalMain) {
        if (q.currentGoal) this.elGoalMain.textContent = q.currentGoal.label;
        else this.elGoalMain.textContent = 'ภารกิจหลักครบแล้ว เยี่ยมมาก!';
      }
      if (this.elGoalProg) {
        if (q.currentGoal) {
          const target = q.currentGoal.target || 0;
          const cur = Math.min(q.goalProgress || 0, target);
          this.elGoalProg.textContent = '(' + cur + ' / ' + target + ')';
        } else {
          this.elGoalProg.textContent = '(' + q.goalsCleared + ' / ' + q.maxGoals + ' ภารกิจ)';
        }
      }

      // MINI QUEST
      if (this.elMiniMain) {
        if (q.currentMini) this.elMiniMain.textContent = q.currentMini.label;
        else this.elMiniMain.textContent = 'มินิภารกิจครบแล้ว ลองเก็บแต้มต่อเลย!';
      }
      if (this.elMiniProg) {
        if (q.currentMini) {
          const targetM = q.currentMini.target || 0;
          const curM = Math.min(q.miniProgress || 0, targetM);
          this.elMiniProg.textContent = '(' + curM + ' / ' + targetM + ')';
        } else {
          this.elMiniProg.textContent = '(' + q.minisCleared + ' / ' + q.maxMinis + ' ภารกิจ)';
        }
      }
    },

    // ---------- tick ----------

    tick: function (time, dt) {
      if (!this.running) return;
      if (!dt || dt <= 0) dt = 16;

      this.elapsed += dt;
      this.spawnClock += dt;

      const sec = (this.elapsed / 1000) | 0;
      if (sec !== this._lastLogSec) {
        this._lastLogSec = sec;
        console.log('[GroupsVR] tick sec=', sec, 'targets=', this.targets.length);
      }

      if (this.elapsed >= this.durationMs) {
        this.finish('timeout');
        return;
      }

      const cfg = this.cfg || {};
      const interval = cfg.spawnInterval || 1200;
      const maxActive = cfg.maxActive || 4;

      if (this.spawnClock >= interval) {
        this.spawnClock = 0;
        if (this.targets.length < maxActive) {
          this.spawnTarget();
        }
      }

      this.updateTargets(dt);
    },

    // ---------- spawn target (emoji sprite) ----------

    spawnTarget: function () {
      const emojiMod = ns.foodGroupsEmoji;
      let item = null;

      if (emojiMod && typeof emojiMod.pickRandom === 'function') {
        item = emojiMod.pickRandom();
      }

      if (!item) {
        // fallback
        item = { emoji: '🍎', group: 1, isGood: true, name: 'ผลไม้' };
      }

      const scale = this.cfg.scale || 1.0;

      // สุ่มตำแหน่ง: กระจายบริเวณกลางจอ ไม่อยู่แต่ล่าง
      const xMin = -1.4;
      const xMax = 1.4;
      const yMin = 0.6;
      const yMax = 1.4;
      let x = xMin + Math.random() * (xMax - xMin);
      let y = yMin + Math.random() * (yMax - yMin);
      const z = -2.3;

      // กันไม่ให้เป้าซ้อนกันเกินไป (เช็คระยะห่างคร่าว ๆ)
      const minDist2 = 0.6 * 0.6;
      for (let tries = 0; tries < 6; tries++) {
        let ok = true;
        for (let i = 0; i < this.targets.length; i++) {
          const t = this.targets[i];
          const p = t.object3D ? t.object3D.position : t.getAttribute('position');
          if (!p) continue;
          const dx = p.x - x;
          const dy = p.y - y;
          if (dx * dx + dy * dy < minDist2) {
            ok = false;
            break;
          }
        }
        if (ok) break;
        x = xMin + Math.random() * (xMax - xMin);
        y = yMin + Math.random() * (yMax - yMin);
      }

      const el = document.createElement('a-entity');
      el.setAttribute('data-hha-tgt', '1');

      el.setAttribute('position', { x, y, z });

      // hitbox กลม ๆ
      el.setAttribute('geometry', {
        primitive: 'circle',
        radius: 0.45 * scale,
        segments: 48
      });

      // พื้นสีตาม good / junk
      const baseColor = item.isGood ? '#16a34a' : '#ea580c';
      el.setAttribute('material', {
        color: baseColor,
        opacity: 1.0,
        shader: 'flat',
        side: 'double'
      });

      // วงขอบด้านนอก
      const rim = document.createElement('a-entity');
      rim.setAttribute('geometry', {
        primitive: 'ring',
        radiusInner: 0.47 * scale,
        radiusOuter: 0.55 * scale,
        segmentsTheta: 64
      });
      rim.setAttribute('material', {
        color: '#020617',
        shader: 'flat',
        side: 'double'
      });
      rim.setAttribute('position', { x: 0, y: 0, z: 0.001 });
      el.appendChild(rim);

      // emoji image (จาก emoji-image.js ถ้ามี texture)
      if (item.texture) {
        const sprite = document.createElement('a-entity');
        sprite.setAttribute('geometry', {
          primitive: 'circle',
          radius: 0.33 * scale,
          segments: 48
        });
        sprite.setAttribute('material', {
          src: item.texture,
          transparent: true,
          side: 'double'
        });
        sprite.setAttribute('position', { x: 0, y: 0, z: 0.002 });
        el.appendChild(sprite);
      } else {
        // fallback เป็นตัวอักษร emoji
        const txt = document.createElement('a-entity');
        txt.setAttribute('text', {
          value: item.emoji || '🍎',
          align: 'center',
          color: '#ffffff',
          width: 2.2 * scale,
          baseline: 'center'
        });
        txt.setAttribute('position', { x: 0, y: 0, z: 0.01 });
        el.appendChild(txt);
      }

      const groupId = item && item.group != null ? item.group : 0;
      const isGood = item && item.isGood ? 1 : 0;

      el.setAttribute('data-group', String(groupId));
      el.setAttribute('data-good', String(isGood));

      el._life = 3200;
      el._age = 0;
      el._spawnTime = performance.now();
      el._metaItem = item || {};

      const self = this;
      el.addEventListener('click', function () {
        self.onHit(el);
      });

      this.el.sceneEl.appendChild(el);
      this.targets.push(el);
    },

    updateTargets: function (dt) {
      for (let i = this.targets.length - 1; i >= 0; i--) {
        const t = this.targets[i];
        t._age += dt;
        if (t._age >= t._life) {
          this.onMiss(t);
        }
      }
    },

    removeTarget: function (el) {
      const idx = this.targets.indexOf(el);
      if (idx !== -1) this.targets.splice(idx, 1);
      if (el.parentNode) el.parentNode.removeChild(el);
    },

    // ---------- hit / miss ----------

    onHit: function (el) {
      const isGood = el.getAttribute('data-good') === '1';
      const groupId = parseInt(el.getAttribute('data-group') || '0', 10) || 0;
      const item = el._metaItem || {};
      const emoji = item.emoji || '';

      const now = performance.now();
      const rtMs = el._spawnTime ? now - el._spawnTime : null;

      let delta = isGood ? 10 : -5;
      this.score = Math.max(0, this.score + delta);

      if (this.elScore) this.elScore.textContent = String(this.score);

      this.updateFeverOnHit(isGood);
      this.updateQuestOnHit(isGood);

      this.logEvent({
        type: 'hit',
        groupId,
        emoji,
        isGood: !!isGood,
        hitOrMiss: 'hit',
        rtMs,
        scoreDelta: delta,
        pos: this.copyWorldPos(el)
      });

      if (this.coach && isGood) {
        this.coach.say('เยี่ยมเลย! เลือกอาหารดีได้ตรงกลุ่มแล้ว 😊');
      } else if (this.coach && !isGood) {
        this.coach.say('ชิ้นนี้ไม่ค่อยดีเท่าไหร่นะ ลองเลือกกลุ่มอื่นดู ✋');
      }

      this.removeTarget(el);
    },

    onMiss: function (el) {
      const groupId = parseInt(el.getAttribute('data-group') || '0', 10) || 0;
      const item = el._metaItem || {};
      const emoji = item.emoji || '';

      const now = performance.now();
      const rtMs = el._spawnTime ? now - el._spawnTime : null;

      this.updateFeverOnMiss();
      this.updateQuestOnMiss();

      this.logEvent({
        type: 'miss',
        groupId,
        emoji,
        isGood: false,
        hitOrMiss: 'miss',
        rtMs,
        scoreDelta: 0,
        pos: this.copyWorldPos(el)
      });

      if (this.coach) {
        this.coach.say('พลาดไปนิดหน่อย ไม่เป็นไร รอบหน้าเล็งใหม่ได้ 😄');
      }

      this.removeTarget(el);
    },

    copyWorldPos: function (el) {
      if (!el || !el.object3D || !window.THREE) return null;
      const v = el.object3D.getWorldPosition(new THREE.Vector3());
      return { x: v.x, y: v.y, z: v.z };
    },

    // ---------- Fever ----------

    updateFeverOnHit: function (isGood) {
      if (!ns.FeverUI) return;

      let f = this.fever || 0;
      if (isGood) f += 8;
      else f -= 12;

      f = clamp(f, 0, FEVER_MAX);
      this.fever = f;

      if (f >= FEVER_MAX && !this.feverActive) {
        this.feverActive = true;
        ns.FeverUI.setFeverActive(true);
      }
      if (f < 30 && this.feverActive) {
        this.feverActive = false;
        ns.FeverUI.setFeverActive(false);
      }

      ns.FeverUI.setFever(f);
    },

    updateFeverOnMiss: function () {
      if (!ns.FeverUI) return;

      let f = this.fever || 0;
      f -= 5;
      f = clamp(f, 0, FEVER_MAX);
      this.fever = f;

      if (f < 30 && this.feverActive) {
        this.feverActive = false;
        ns.FeverUI.setFeverActive(false);
      }
      ns.FeverUI.setFever(f);
    },

    // ---------- Quest update ----------

    updateQuestOnHit: function (isGood) {
      const q = this.quest;
      if (!q) return;

      // goal: ใช้คะแนนรวม
      if (q.currentGoal && q.currentGoal.kind === 'score') {
        q.goalProgress = this.score;
      }

      // mini: good hits
      if (q.currentMini && q.currentMini.kind === 'goodHits' && isGood) {
        q.miniProgress = (q.miniProgress || 0) + 1;
      }

      this.checkQuestComplete();
      this.updateQuestUI();
    },

    updateQuestOnMiss: function () {
      const q = this.quest;
      if (!q) return;
      // ตอนนี้ยังไม่มี quest แบบ missMax เลยยังไม่ต้องทำอะไร
      this.updateQuestUI();
    },

    checkQuestComplete: function () {
      const q = this.quest;
      if (!q) return;

      // GOAL
      if (q.currentGoal) {
        const target = q.currentGoal.target || 0;
        if (q.goalProgress >= target) {
          q.goalsCleared++;
          if (this.coach) {
            this.coach.say('เยี่ยมมาก! ทำภารกิจหลักสำเร็จแล้ว 🎉');
          }
          this.pickNextGoal();
        }
      }

      // MINI
      if (q.currentMini) {
        const targetM = q.currentMini.target || 0;
        if (q.miniProgress >= targetM) {
          q.minisCleared++;
          if (this.coach) {
            this.coach.say('มินิภารกิจผ่านแล้วหนึ่งด่าน เก่งมาก! 🤩');
          }
          this.pickNextMini();
        }
      }
    },

    // ---------- Logging ----------

    logEvent: function (ev) {
      this.events.push(ev);
    },

    // ---------- finish ----------

    finish: function (reason) {
      if (!this.running) return;
      this.running = false;

      for (let i = 0; i < this.targets.length; i++) {
        const el = this.targets[i];
        if (el.parentNode) el.parentNode.removeChild(el);
      }
      this.targets.length = 0;

      const scene = this.el.sceneEl;

      if (ns.foodGroupsCloudLogger && typeof ns.foodGroupsCloudLogger.send === 'function') {
        const q = this.quest || {};
        const rawSession = {
          sessionId: this.sessionId,
          score: this.score,
          difficulty: this.diffKey,
          durationMs: this.elapsed,
          goalsCleared: q.goalsCleared || 0,
          goalsMax: q.maxGoals || 0,
          minisCleared: q.minisCleared || 0,
          minisMax: q.maxMinis || 0
        };
        ns.foodGroupsCloudLogger.send(rawSession, this.events);
      }

      const q = this.quest || {};
      scene.emit('fg-game-over', {
        score: this.score,
        diff: this.diffKey,
        reason: reason || 'finish',
        goalsCleared: q.goalsCleared || 0,
        goalsMax: q.maxGoals || 0,
        minisCleared: q.minisCleared || 0,
        minisMax: q.maxMinis || 0
      });

      if (this.coach) {
        if (reason === 'timeout') {
          this.coach.say('หมดเวลาแล้ว ลองเล่นอีกตาเพื่อพิชิตภารกิจใหม่นะ ⏰');
        } else {
          this.coach.say('จบเกมแล้ว ขอบคุณที่มาฝึกเลือกอาหารกับโค้ชนะ 😊');
        }
      }

      console.log('[GroupsVR] finish', reason, 'score=', this.score);
    }
  });

})(window.GAME_MODULES || (window.GAME_MODULES = {}));
