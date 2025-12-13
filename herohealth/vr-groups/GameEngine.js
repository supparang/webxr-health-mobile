// === /herohealth/vr-groups/GameEngine.js ===
// Food Groups VR — Game Engine (emoji targets + quest + HUD events)

'use strict';

(function (ns) {
  const ROOT = (typeof window !== 'undefined' ? window : globalThis);
  const A = ROOT.AFRAME;

  if (!A) {
    console.error('[GroupsVR] AFRAME not found');
    return;
  }

  // ---------- Difficulty ----------
  function pickDifficulty(diffKey) {
    diffKey = String(diffKey || 'normal').toLowerCase();
    if (ns.HeroHealth &&
        ns.HeroHealth.foodGroupsDifficulty &&
        typeof ns.HeroHealth.foodGroupsDifficulty.get === 'function') {
      return ns.HeroHealth.foodGroupsDifficulty.get(diffKey);
    }
    // fallback
    return {
      spawnInterval: 1100,
      lifetime: 2300,
      maxActive: 4,
      scale: 1.0,
      feverGainHit: 7,
      feverLossMiss: 15,
      questTarget: 5
    };
  }

  // ---------- Food groups + emoji sets ----------
  const GROUPS = {
    1: ['🍚','🍙','🍞','🥯','🥐'],                  // ข้าว-แป้ง
    2: ['🥩','🍗','🍖','🥚','🧀'],                  // โปรตีน
    3: ['🥦','🥕','🥬','🌽','🥗','🍅'],             // ผัก
    4: ['🍎','🍌','🍇','🍉','🍊','🍓','🍍'],         // ผลไม้
    5: ['🥛','🧈','🧀','🍨']                        // นม/ผลิตภัณฑ์นม
  };

  const GOOD = Object.values(GROUPS).flat();
  const BAD  = ['🍔','🍟','🍕','🍩','🍪','🧋','🥤','🍫','🍬','🥓'];

  function foodGroup(emo) {
    for (const [g, arr] of Object.entries(GROUPS)) {
      if (arr.includes(emo)) return +g;
    }
    return 0;
  }

  // ---------- Fever UI (ถ้าโหลดไว้จาก ui-fever.js) ----------
  const FeverUI =
    (ROOT.GAME_MODULES && ROOT.GAME_MODULES.FeverUI) ||
    ROOT.FeverUI ||
    {
      ensureFeverBar () {},
      setFever () {},
      setFeverActive () {}
    };
  const { ensureFeverBar, setFever, setFeverActive } = FeverUI;

  // ---------- Emoji texture ด้วย canvas (ไม่ใช้ emoji-image.js แล้ว) ----------
  const emojiCache = new Map();

  function emojiToDataUrl(ch) {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = 'rgba(0,0,0,0)';
    ctx.fillRect(0, 0, size, size);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '200px system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(ch, size / 2, size / 2 + 10);

    return canvas.toDataURL('image/png');
  }

  function getEmojiTexture(ch) {
    if (!emojiCache.has(ch)) {
      emojiCache.set(ch, emojiToDataUrl(ch));
    }
    return emojiCache.get(ch);
  }

  // ---------- Utils ----------
  function clamp(v, min, max) {
    v = Number(v) || 0;
    if (v < min) return min;
    if (v > max) return max;
    return v;
  }

  function randRange(min, max) {
    return min + Math.random() * (max - min);
  }

  function pick(array) {
    return array[(Math.random() * array.length) | 0];
  }

  // ---------- GameEngine ----------
  const GameEngine = (function () {
    let sceneEl = null;
    let diffKey = 'normal';
    let diffCfg = pickDifficulty('normal');

    let running = false;
    let spawnTimer = null;
    let nextId = 1;
    const activeTargets = new Map();

    // state
    let score = 0;
    let combo = 0;
    let comboMax = 0;
    let misses = 0;
    let fever = 0;
    let feverActive = false;

    // group hit count ใช้ทำ quest / วิเคราะห์
    const groupCounts = [0, 0, 0, 0, 0];
    let goodHits = 0;
    let badHits = 0;

    // quest summary (ง่าย ๆ)
    const GOAL_TOTAL  = 2;
    const MINI_TOTAL  = 3;
    let goalsCleared  = 0;
    let minisCleared  = 0;

    // ----- Event helpers -----
    function emitScore(label) {
      try {
        ROOT.dispatchEvent(new CustomEvent('hha:score', {
          detail: {
            mode: 'Food Groups',
            score,
            combo,
            misses
          }
        }));
        if (label) {
          ROOT.dispatchEvent(new CustomEvent('hha:judge', {
            detail: { label }
          }));
        }
      } catch (e) {}
    }

    function emitMiss() {
      try {
        ROOT.dispatchEvent(new CustomEvent('hha:miss', {
          detail: { mode: 'Food Groups' }
        }));
      } catch (e) {}
    }

    function emitEnd(reason) {
      try {
        ROOT.dispatchEvent(new CustomEvent('hha:end', {
          detail: {
            mode: 'Food Groups',
            reason: reason || 'end',
            score,
            misses,
            comboMax,
            goalsCleared,
            goalsTotal: GOAL_TOTAL,
            miniCleared: minisCleared,
            miniTotal: MINI_TOTAL,
            groupCounts: [...groupCounts]
          }
        }));
      } catch (e) {}
    }

    function updateFever(delta) {
      fever = clamp(fever + delta, 0, 100);
      setFever(fever);

      if (!feverActive && fever >= 100) {
        feverActive = true;
        setFeverActive(true);
        try {
          ROOT.dispatchEvent(new CustomEvent('hha:fever', {
            detail: { mode: 'Food Groups', state: 'start' }
          }));
        } catch (e) {}
      }

      if (feverActive && fever <= 0) {
        feverActive = false;
        setFeverActive(false);
        try {
          ROOT.dispatchEvent(new CustomEvent('hha:fever', {
            detail: { mode: 'Food Groups', state: 'end' }
          }));
        } catch (e) {}
      }
    }

    // ----- Quest (เวอร์ชันย่อ) -----
    function buildQuestObjects() {
      const g1Target = diffCfg.questTarget || 8;  // เก็บอาหารดีทั้งหมด
      const g2Target = 4;                         // เก็บให้ครบ 4 หมู่

      const groupsHitKinds = groupCounts.filter(c => c > 0).length;

      const goalsAll = [
        {
          id: 'g1',
          label: `เก็บอาหารดีให้ครบ ${g1Target} ชิ้น`,
          prog: goodHits,
          target: g1Target,
          done: goodHits >= g1Target
        },
        {
          id: 'g2',
          label: 'เก็บให้ครบ 4 หมู่ที่แตกต่างกัน',
          prog: groupsHitKinds,
          target: 4,
          done: groupsHitKinds >= 4
        }
      ];

      const minisAll = [
        {
          id: 'm1',
          label: 'เก็บผัก (หมู่ 3) ให้ครบ 3 ชิ้น',
          prog: groupCounts[2],
          target: 3,
          done: groupCounts[2] >= 3
        },
        {
          id: 'm2',
          label: 'เก็บผลไม้ (หมู่ 4) ให้ครบ 3 ชิ้น',
          prog: groupCounts[3],
          target: 3,
          done: groupCounts[3] >= 3
        },
        {
          id: 'm3',
          label: 'เลี่ยงของขยะให้พลาดไม่เกิน 3 ครั้ง',
          prog: Math.max(0, 3 - misses),
          target: 3,
          done: misses <= 3 && goodHits >= 3   // ต้องมีเก็บของดีด้วย
        }
      ];

      goalsCleared = goalsAll.filter(g => g.done).length;
      minisCleared = minisAll.filter(m => m.done).length;

      const goalCurrent = goalsAll.find(g => !g.done) || goalsAll[goalsAll.length - 1];
      const miniCurrent = minisAll.find(m => !m.done) || minisAll[minisAll.length - 1];

      return { goalCurrent, miniCurrent, goalsAll, minisAll };
    }

    function emitQuestUpdate(hint) {
      const q = buildQuestObjects();
      try {
        ROOT.dispatchEvent(new CustomEvent('quest:update', {
          detail: {
            goal: q.goalCurrent,
            mini: q.miniCurrent,
            goalsAll: q.goalsAll,
            minisAll: q.minisAll,
            hint: hint || ''
          }
        }));
      } catch (e) {}
    }

    // ----- Target creation -----
    function createTargetEntity(target) {
      const el = document.createElement('a-entity');

      const x = target.pos.x;
      const y = target.pos.y;
      const z = target.pos.z;

      const scale = diffCfg.scale || 1.0;
      const size = 0.7 * scale;

      const texUrl = getEmojiTexture(target.emoji);

      el.setAttribute('position', `${x} ${y} ${z}`);
      el.setAttribute('data-hha-tgt', '1');
      el.setAttribute('geometry', `primitive: plane; width: ${size}; height: ${size}`);
      el.setAttribute('material',
        `shader: flat; src: ${texUrl}; transparent: true; alphaTest: 0.05; side: double`);
      el.setAttribute('rotation', `0 0 0`);

      // ลอยเบา ๆ
      el.setAttribute('animation__float', {
        property: 'position',
        dir: 'alternate',
        easing: 'easeInOutSine',
        dur: 900,
        loop: true,
        to: `${x} ${y + 0.2} ${z}`
      });
      // fade in
      el.setAttribute('animation__fadein', {
        property: 'material.opacity',
        from: 0,
        to: 1,
        dur: 220,
        easing: 'easeOutQuad'
      });

      // hit
      el.addEventListener('click', function (ev) {
        handleHit(target.id, ev);
      });

      // expire timer
      target.expireTimer = ROOT.setTimeout(function () {
        handleExpire(target.id);
      }, diffCfg.lifetime || 2200);

      sceneEl.appendChild(el);
      target.el = el;
    }

    function destroyTarget(target) {
      if (!target) return;
      if (target.expireTimer) {
        ROOT.clearTimeout(target.expireTimer);
        target.expireTimer = null;
      }
      if (target.el && target.el.parentNode) {
        try {
          target.el.parentNode.removeChild(target.el);
        } catch (e) {}
      }
      target.el = null;
    }

    // ----- Spawn / hit / expire -----
    function spawnOne() {
      if (!running || !sceneEl) return;
      if (activeTargets.size >= (diffCfg.maxActive || 4)) return;

      const isGood = Math.random() < 0.7;
      const emoji = isGood ? pick(GOOD) : pick(BAD);
      const gId = isGood ? foodGroup(emoji) : 0;

      const pos = {
        x: randRange(-2.2, 2.2),
        y: randRange(1.2, 2.2),
        z: randRange(-3.2, -2.2)
      };

      const id = nextId++;
      const target = {
        id,
        emoji,
        isGood,
        gId,
        pos,
        el: null,
        expireTimer: null
      };

      activeTargets.set(id, target);
      console.log('[GroupsVR] spawn target', { emoji, isGood, gId, pos });

      createTargetEntity(target);
    }

    function spawnLoop() {
      if (!running) return;
      spawnOne();
      const iv = diffCfg.spawnInterval || 1000;
      spawnTimer = ROOT.setTimeout(spawnLoop, iv);
    }

    function handleHit(id /*, ev */) {
      if (!running) return;
      const target = activeTargets.get(id);
      if (!target) return;

      destroyTarget(target);
      activeTargets.delete(id);

      if (target.isGood) {
        goodHits++;
        const base = 20;
        const multi = feverActive ? 2 : 1;
        const delta = (base + combo * 2) * multi;
        score += delta;
        combo++;
        if (combo > comboMax) comboMax = combo;
        const idx = (target.gId || 0) - 1;
        if (idx >= 0 && idx < groupCounts.length) {
          groupCounts[idx] = (groupCounts[idx] | 0) + 1;
        }
        updateFever(diffCfg.feverGainHit || 8);
        emitScore(combo >= 8 || feverActive ? 'PERFECT' : 'GOOD');
      } else {
        badHits++;
        misses++;
        combo = 0;
        score = Math.max(0, score - 15);
        updateFever(- (diffCfg.feverLossMiss || 16));
        emitMiss();
        emitScore('MISS');
      }

      emitQuestUpdate();
    }

    function handleExpire(id) {
      const target = activeTargets.get(id);
      if (!target) return;
      destroyTarget(target);
      activeTargets.delete(id);
      // ปล่อยให้หลุดจอ ไม่ถือว่าพลาด แค่ลด fever นิดหน่อย
      updateFever(-4);
      emitQuestUpdate();
    }

    // ----- Public API -----
    function start(diff) {
      if (running) stop('restart');
      sceneEl = document.querySelector('a-scene');
      if (!sceneEl) {
        console.error('[GroupsVR] <a-scene> not found');
        return;
      }

      diffKey = String(diff || 'normal').toLowerCase();
      diffCfg = pickDifficulty(diffKey);

      running = true;
      score = 0;
      combo = 0;
      comboMax = 0;
      misses = 0;
      fever = 0;
      feverActive = false;
      goodHits = 0;
      badHits = 0;
      for (let i = 0; i < groupCounts.length; i++) groupCounts[i] = 0;
      goalsCleared = 0;
      minisCleared = 0;

      ensureFeverBar();
      setFever(0);
      setFeverActive(false);

      emitScore('');
      emitQuestUpdate('โฟกัสเก็บอาหารดีจากหลาย ๆ หมู่ให้ครบก่อน');

      spawnLoop();
      console.log('[GroupsVR] start', diffKey);
    }

    function stop(reason) {
      if (!running) return;
      running = false;

      if (spawnTimer) {
        ROOT.clearTimeout(spawnTimer);
        spawnTimer = null;
      }

      activeTargets.forEach(t => destroyTarget(t));
      activeTargets.clear();

      emitEnd(reason || 'stop');
      console.log('[GroupsVR] stop', reason);
    }

    return { start, stop };
  })();

  // export ไป global + ES module style
  ns.GameEngineGroups = GameEngine;
  if (typeof exports === 'object' && typeof module !== 'undefined') {
    module.exports = { GameEngine };
  } else if (typeof define === 'function' && define.amd) {
    define([], function () { return { GameEngine }; });
  } else {
    ns.GameEngine = GameEngine; // ใช้กับ import type="module" ใน groups-vr.html
  }

})(window.HeroHealth = window.HeroHealth || {});