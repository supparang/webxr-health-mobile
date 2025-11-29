// --- 7. GameEngine.js (Groups VR – Food Groups Mode) ---
(function(exports, imports) {
  'use strict';

  // === ดึงโมดูลจาก GAME_MODULES (เหมือน Good vs Junk VR เดิม) ===
  const { setFever, setFeverActive, setShield, ensureFeverBar } = imports;
  const { Difficulty } = imports;
  const { emojiImage } = imports;
  const { burstAt, floatScore, setShardMode } = imports;
  const { Quest } = imports;

  // === กลุ่มอาหาร 5 หมู่ (เหมือน groups.safe.js) ===
  const GROUPS = {
    1: ['🍚','🍙','🍞','🥐','🥖','🥯'],               // ข้าว-แป้ง
    2: ['🥩','🍗','🍖','🥚'],                         // โปรตีน
    3: ['🥦','🥕','🍅','🥬','🌽','🥗'],               // ผัก
    4: ['🍎','🍌','🍇','🍉','🍊','🍓','🍍'],          // ผลไม้
    5: ['🥛','🧈','🧀','🍨']                          // นม
  };
  const ALL_FOOD = Object.values(GROUPS).flat();

  // Power-ups
  const STAR  = '⭐';
  const DIA   = '💎';
  const SHIELD_EMOJI = '🛡️';
  const FIRE  = '🔥';
  const BONUS = [STAR, DIA, SHIELD_EMOJI, FIRE];

  function foodGroup(char) {
    for (const [g, arr] of Object.entries(GROUPS)) {
      if (arr.includes(char)) return +g;
    }
    return 0;
  }

  // config ว่าตามระดับความยากจะเริ่ม/สูงสุดกี่หมู่
  const FOCUS_CFG = {
    easy:   { start: 1, max: 2 },
    normal: { start: 1, max: 3 },
    hard:   { start: 2, max: 4 }
  };

  function pickGroups(n) {
    const pool = [1,2,3,4,5];
    const out = [];
    while (out.length < n && pool.length) {
      const idx = (Math.random() * pool.length) | 0;
      out.push(pool.splice(idx, 1)[0]);
    }
    return out;
  }

  // === ตัวแปร Global ที่ Quest.js ใช้ ===
  window.score        = 0;
  window.combo        = 0;
  window.misses       = 0;
  window.FEVER_ACTIVE = false;
  window.running      = false;

  // === ภายใน Engine ===
  let shield       = 0;
  let fever        = 0;
  let sceneEl      = null;
  let targetRoot   = null;
  let difficulty   = new Difficulty();
  let gameConfig   = null;
  let spawnTimer   = null;
  let gameTimer    = null;

  // สำหรับ mechanic “โฟกัสหมู่”
  let goodTargetHits = 0;
  let focusLevel     = 1;
  let focusMax       = 3;
  let activeGroups   = [1];

  // ---- helper: emit event กลาง ----
  window.emit = function(name, detail) {
    try {
      window.dispatchEvent(new CustomEvent(name, { detail }));
    } catch(e) {}
  };

  // popup ข้อความกลางหน้าผู้เล่น
  window.popupText = function(text, pos, color = '#fff') {
    const worldPos = { x: 0, y: (pos && pos.y) || 1.4, z: -1.5 };
    floatScore(sceneEl, worldPos, text, color);
  };

  // เริ่ม FEVER แบบ global (สำหรับ Quest)
  window.feverStart = function() {
    if (window.FEVER_ACTIVE) return;
    fever = 100;
    setFever(fever);
    window.FEVER_ACTIVE = true;
    setFeverActive(true);
    Quest.onFever();
    window.emit('hha:fever', { state: 'start' });
  };

  function mult() { return window.FEVER_ACTIVE ? 2 : 1; }

  function gainFever(n) {
    if (window.FEVER_ACTIVE) return; // ถ้าอยู่ใน FEVER แล้วให้รอหมดก่อน
    fever = Math.max(0, Math.min(100, fever + n));
    setFever(fever);
    if (fever >= 100) {
      window.feverStart();
    }
  }

  function decayFever(base) {
    const d = window.FEVER_ACTIVE ? 10 : base;
    fever = Math.max(0, fever - d);
    setFever(fever);
    if (window.FEVER_ACTIVE && fever <= 0) {
      window.FEVER_ACTIVE = false;
      setFeverActive(false);
      window.emit('hha:fever', { state: 'end' });
    }
  }

  function resetState(levelKey) {
    const lv = String(levelKey || 'normal').toLowerCase();
    const cfg = FOCUS_CFG[lv] || FOCUS_CFG.normal;

    window.score        = 0;
    window.combo        = 0;
    window.misses       = 0;
    window.FEVER_ACTIVE = false;
    window.running      = true;

    shield = 0;
    fever  = 0;
    setFever(0);
    setShield(0);
    setFeverActive(false);

    goodTargetHits = 0;
    focusLevel     = cfg.start;
    focusMax       = cfg.max;
    activeGroups   = pickGroups(focusLevel);
  }

  function labelActiveGroups() {
    return activeGroups.map(g => 'หมู่ ' + g).join(', ');
  }

  function maybeEscalate() {
    if (focusLevel >= focusMax) return;

    // ให้เพิ่มหมู่เมื่อเก็บเป้าหมายครบ ~10 ครั้งในระดับนั้น
    const threshold = focusLevel === 1 ? 10 : 18;
    if (goodTargetHits >= threshold) {
      focusLevel++;
      goodTargetHits = 0;
      activeGroups = pickGroups(focusLevel);
      window.popupText(`เพิ่มหมู่เป้าหมายเป็น ${focusLevel} หมู่!`, { y: 1.2 }, '#fbbf24');
      window.emit('hha:quest', {
        text: `ตอนนี้โฟกัส ${labelActiveGroups()} แล้ว`
      });
    }
  }

  function spawnTarget() {
    if (!window.running) return;
    const cfg = gameConfig;
    if (!cfg) return;

    const roll = Math.random();
    let char;
    let type  = 'food';
    let group = 0;

    if (roll < 0.12) {
      // 12% เป็น power-up
      char  = BONUS[(Math.random() * BONUS.length) | 0];
      type  = 'bonus';
    } else {
      const hitActivePool = (Math.random() < 0.7); // 70% เลือกจากหมู่เป้าหมาย
      if (hitActivePool && activeGroups.length) {
        const g = activeGroups[(Math.random() * activeGroups.length) | 0];
        const arr = GROUPS[g] || ALL_FOOD;
        char  = arr[(Math.random() * arr.length) | 0];
        group = g;
      } else {
        char  = ALL_FOOD[(Math.random() * ALL_FOOD.length) | 0];
        group = foodGroup(char);
      }
    }

    const scale = cfg.size * 0.6;
    const el = emojiImage(char, scale);
    el.dataset.type  = type;
    el.dataset.char  = char;
    el.dataset.group = String(group || 0);
    el.setAttribute('data-hha-tgt', '1');

    // สุ่มตำแหน่งด้านหน้า
    const x = (Math.random() - 0.5) * 4;      // -2 ถึง +2
    const y = 1.0 + Math.random() * 1.0;      // 1.0–2.0
    const z = -2.5 - Math.random() * 1.0;     // -2.5– -3.5
    el.setAttribute('position', `${x} ${y} ${z}`);

    targetRoot.appendChild(el);

    // เวลาหมดแล้วยังไม่โดน → ถ้าเป็นหมู่เป้าหมายถือว่า "พลาด"
    setTimeout(() => {
      if (!el || !el.parentNode || !window.running) return;
      const t = el.dataset.type || 'food';
      const g = Number(el.dataset.group || 0);
      if (t !== 'bonus' && g && activeGroups.includes(g)) {
        // พลาดหมู่เป้าหมาย
        window.misses++;
        window.combo = 0;
        window.emit('hha:miss', {});
      }
      el.remove();
    }, cfg.life);

    spawnTimer = setTimeout(spawnTarget, cfg.rate);
  }

  function onHitTarget(targetEl) {
    if (!targetEl || !targetEl.parentNode) return;
    const type  = targetEl.dataset.type  || 'food';
    const char  = targetEl.dataset.char  || '';
    const group = Number(targetEl.dataset.group || 0);

    const pos = targetEl.object3D
      ? targetEl.object3D.getWorldPosition(new THREE.Vector3())
      : { x:0, y:1.4, z:-2.0 };

    let scoreDelta = 0;

    // ---------- Power-ups ----------
    if (BONUS.includes(char) || type === 'bonus') {
      if (char === STAR) {
        scoreDelta = 40 * mult();
        window.score += scoreDelta;
        gainFever(10);
        window.combo++;
        Quest.onGood();
        burstAt(sceneEl, pos, { mode: 'groups' });
        floatScore(sceneEl, pos, `+${scoreDelta}`, '#22c55e');
      } else if (char === DIA) {
        scoreDelta = 80 * mult();
        window.score += scoreDelta;
        gainFever(30);
        window.combo++;
        Quest.onGood();
        burstAt(sceneEl, pos, { mode: 'groups' });
        floatScore(sceneEl, pos, `+${scoreDelta}`, '#22c55e');
      } else if (char === SHIELD_EMOJI) {
        shield = Math.min(3, shield + 1);
        setShield(shield);
        scoreDelta = 20;
        window.score += scoreDelta;
        Quest.onGood();
        burstAt(sceneEl, pos, { mode: 'hydration' });
        floatScore(sceneEl, pos, '+20', '#60a5fa');
      } else if (char === FIRE) {
        scoreDelta = 25;
        window.score += scoreDelta;
        window.feverStart();
        Quest.onGood();
        burstAt(sceneEl, pos, { mode: 'plate' });
        floatScore(sceneEl, pos, '+25', '#fbbf24');
      }
    } else {
      // ---------- ปกติ: อาหาร 5 หมู่ ----------
      const isTarget = group && activeGroups.includes(group);

      if (isTarget) {
        // เลือกหมู่เป้าหมายถูกต้อง
        scoreDelta = (18 + window.combo * 2) * mult();
        window.score += scoreDelta;
        window.combo++;
        goodTargetHits++;
        gainFever(7 + window.combo * 0.5);
        Quest.onGood();
        burstAt(sceneEl, pos, { mode: 'groups' });
        floatScore(sceneEl, pos, `+${scoreDelta}`, '#22c55e');
        maybeEscalate();
      } else {
        // แตะหมู่ที่ไม่ใช่เป้าหมาย
        if (shield > 0) {
          shield--;
          setShield(shield);
          decayFever(6);
          Quest.onBad();
          burstAt(sceneEl, pos, { mode: 'hydration' });
          floatScore(sceneEl, pos, 'SHIELD', '#60a5fa');
        } else {
          scoreDelta = -18;
          window.score = Math.max(0, window.score + scoreDelta);
          window.combo = 0;
          window.misses++;
          decayFever(16);
          Quest.onBad();
          window.emit('hha:miss', {});
          burstAt(sceneEl, pos, { mode: 'plate' });
          floatScore(sceneEl, pos, `${scoreDelta}`, '#ef4444');
        }
      }
    }

    window.emit('hha:score', {
      score: window.score,
      combo: window.combo,
      delta: scoreDelta
    });

    // ลบเป้าหมายออก
    targetEl.remove();
  }

  function gameTick() {
    if (!window.running) return;
    // ลด FEVER ตามคอมโบ
    decayFever(window.combo <= 0 ? 6 : 2);
  }

  // === Public Controller (เหมือน Good vs Junk เดิม) ===
  exports.GameEngine = {
    start(level) {
      sceneEl = document.querySelector('a-scene');
      if (!sceneEl) {
        console.error('A-Frame scene not found!');
        return;
      }

      // ล้างเป้าเก่า
      if (targetRoot) targetRoot.remove();
      targetRoot = document.createElement('a-entity');
      targetRoot.id = 'targetRoot';
      sceneEl.appendChild(targetRoot);

      // UI
      ensureFeverBar();
      setShardMode('groups');

      // รีเซ็ต state ตาม level
      const lv = String(level || 'normal').toLowerCase();
      resetState(lv);

      // ตั้งค่าความยากเรื่อง size / rate / life
      difficulty.set(lv);
      gameConfig = difficulty.get();

      if (gameTimer)  clearInterval(gameTimer);
      if (spawnTimer) clearTimeout(spawnTimer);
      gameTimer  = setInterval(gameTick, 1000);
      spawnTimer = setTimeout(spawnTarget, 1000);

      // เริ่มระบบ Quest Serial
      Quest.start();

      // ยิงเป้าด้วย click (รองรับ VR trigger + mobile gaze)
      sceneEl.addEventListener('click', (e) => {
        if (!window.running) return;
        if (e.target && e.target.dataset && e.target.dataset.hhaTgt) {
          onHitTarget(e.target);
        }
      });

      // รองรับ mouse บน PC (เพราะ click บางทีโดน fuse แย่งไป)
      if (sceneEl.canvas) {
        sceneEl.canvas.addEventListener('mousedown', () => {
          if (!window.running) return;
          const cursor = document.getElementById('cursor');
          if (!cursor) return;
          const raycaster = cursor.components && cursor.components.raycaster;
          if (!raycaster) return;
          const intersectedEl = raycaster.intersectedEls[0];
          if (intersectedEl && intersectedEl.dataset && intersectedEl.dataset.hhaTgt) {
            onHitTarget(intersectedEl);
          }
        });
      }

      window.emit('hha:score', { score: 0, combo: 0 });
      window.popupText(`โฟกัส ${labelActiveGroups()} ก่อน แล้วเลือกให้ตรงหมู่เป้าหมาย`, { y: 1.3 }, '#e5e7eb');
    },

    stop() {
      if (!window.running) return;
      window.running = false;

      if (gameTimer)  clearInterval(gameTimer);
      if (spawnTimer) clearTimeout(spawnTimer);
      gameTimer  = null;
      spawnTimer = null;

      Quest.stop();

      if (targetRoot) {
        try { targetRoot.remove(); } catch(e) {}
        targetRoot = null;
      }

      // ล้าง UI ที่ติด data-hha-ui
      document.querySelectorAll('[data-hha-ui]').forEach(el => {
        try { el.remove(); } catch(e) {}
      });

      window.emit('hha:end', { score: window.score });
    }
  };

})(GAME_MODULES, GAME_MODULES);
