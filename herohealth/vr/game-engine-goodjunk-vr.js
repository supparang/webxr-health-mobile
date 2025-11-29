// --- 7. GameEngine.js (สมองใหม่ - ตัวเชื่อมต่อ + Cross-device input) ---
(function(exports, imports) {
  'use strict';

  const { setFever, setFeverActive, setShield, ensureFeverBar } = imports;
  const { Difficulty }   = imports;
  const { emojiImage }   = imports;
  const { burstAt, floatScore, setShardMode } = imports;
  const { Quest }        = imports;
  const { setupCrossDeviceInput } = imports;

  // --- Game Variables (shared กับ Quest.js) ---
  window.score         = 0;
  window.combo         = 0;
  window.misses        = 0;
  window.FEVER_ACTIVE  = false;
  window.running       = false;

  let shield = 0;
  let fever  = 0;

  let gameTimer   = null;
  let spawnTimer  = null;
  let sceneEl     = null;
  let targetRoot  = null;
  let gameConfig  = null;
  let difficulty  = new Difficulty();

  const GOOD = ['🥦','🥕','🍎','🐟','🥛','🍊','🍌','🍇','🥬','🍚','🥜','🍞','🍓','🍍','🥝','🍐'];
  const JUNK = ['🍔','🍟','🍕','🍩','🍪','🧁','🥤','🧋','🍫','🌭','🍰','🍬'];
  const STAR = '⭐', DIA='💎', SHIELD_EMOJI='🛡️', FIRE='🔥';
  const BONUS = [STAR, DIA, SHIELD_EMOJI, FIRE];

  // --- Global helpers ให้ Quest.js ใช้ ---
  window.emit = function(name, detail) {
    try {
      window.dispatchEvent(new CustomEvent(name, { detail }));
    } catch(e) {}
  };

  window.feverStart = function() {
    if (window.FEVER_ACTIVE) return;
    fever = 100;
    setFever(fever);
    window.FEVER_ACTIVE = true;
    setFeverActive(true);
    Quest.onFever();
    window.emit('hha:fever', { state: 'start' });
  };

  window.popupText = function(text, pos, color = '#fff') {
    const worldPos = { x: 0, y: (pos && pos.y) || 1.4, z: -1.5 };
    floatScore(sceneEl, worldPos, text, color);
  };

  // --- Fever & score util ---
  function mult() {
    return window.FEVER_ACTIVE ? 2 : 1;
  }

  function gainFever(n) {
    if (window.FEVER_ACTIVE) return;
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

  // --- สร้าง emoji เป้าใหม่ ---
  function spawnTarget() {
    if (!window.running) return;

    const cfg      = gameConfig;
    const isGood   = Math.random() < 0.65;
    const usePower = Math.random() < 0.08;

    let char, type, palette;

    if (usePower) {
      char    = BONUS[(Math.random() * BONUS.length) | 0];
      type    = 'good';
      palette = 'groups';
    } else if (isGood) {
      char    = GOOD[(Math.random() * GOOD.length) | 0];
      type    = 'good';
      palette = 'goodjunk';
    } else {
      char    = JUNK[(Math.random() * JUNK.length) | 0];
      type    = 'bad';
      palette = 'plate';
    }

    const scale = gameConfig.size * 0.6;
    const el    = emojiImage(char, scale);
    el.dataset.type    = type;
    el.dataset.char    = char;
    el.dataset.palette = palette;
    el.setAttribute('data-hha-tgt', '1');

    // ตำแหน่งสุ่มด้านหน้าผู้เล่น
    const x = (Math.random() - 0.5) * 4;        // -2..+2
    const y = 1.0 + Math.random() * 1.0;        // 1.0..2.0
    const z = -2.5 - Math.random() * 1.0;       // -2.5..-3.5
    el.setAttribute('position', `${x} ${y} ${z}`);

    targetRoot.appendChild(el);

    // อายุของเป้า
    setTimeout(() => {
      if (!el.parentNode) return;
      if (type === 'good') {
        // พลาดของดี
        window.misses++;
        window.combo = 0;
        window.emit('hha:miss', {});
      } else {
        // หลบของขยะ → fever ขึ้นเบา ๆ
        gainFever(4);
      }
      el.remove();
    }, cfg.life);

    // นัด spawn ครั้งถัดไป
    spawnTimer = setTimeout(spawnTarget, cfg.rate);
  }

  // --- ตีเป้า / คำนวณคะแนน ---
  function onHitTarget(targetEl) {
    if (!targetEl || !targetEl.parentNode) return;

    const type    = targetEl.dataset.type;
    const char    = targetEl.dataset.char;
    const palette = targetEl.dataset.palette;

    const pos = targetEl.object3D.getWorldPosition(new THREE.Vector3());
    let scoreDelta = 0;

    if (type === 'good') {
      // ✅ Power-ups
      if (char === STAR) {
        scoreDelta = 40 * mult();
        gainFever(10);
      } else if (char === DIA) {
        scoreDelta = 80 * mult();
        gainFever(30);
      } else if (char === SHIELD_EMOJI) {
        scoreDelta = 20;
        shield = Math.min(3, shield + 1);
        setShield(shield);
      } else if (char === FIRE) {
        scoreDelta = 25;
        window.feverStart();
      } else {
        // ของดีทั่วไป
        scoreDelta = (20 + window.combo * 2) * mult();
        gainFever(8 + window.combo * 0.6);
      }

      window.score += scoreDelta;
      window.combo++;
      Quest.onGood();

      burstAt(sceneEl, pos, { mode: palette });
      floatScore(sceneEl, pos, `+${scoreDelta}`, '#22c55e');

    } else {
      // ❌ ของขยะ
      if (shield > 0) {
        shield--;
        setShield(shield);
        burstAt(sceneEl, pos, { mode: 'hydration' });
        floatScore(sceneEl, pos, 'SHIELDED!', '#60a5fa');
      } else {
        scoreDelta   = -15;
        window.score = Math.max(0, window.score + scoreDelta);
        window.combo = 0;
        decayFever(18);
        Quest.onBad();
        window.emit('hha:miss', {});
        burstAt(sceneEl, pos, { mode: palette });
        floatScore(sceneEl, pos, `${scoreDelta}`, '#ef4444');
      }
    }

    window.emit('hha:score', {
      score: window.score,
      combo: window.combo,
      delta: scoreDelta
    });

    targetEl.remove();
  }

  function gameTick() {
    if (!window.running) return;
    decayFever(window.combo <= 0 ? 6 : 2);
  }

  // --- Public Controller ---
  exports.GameEngine = {
    start(level) {
      sceneEl = document.querySelector('a-scene');
      if (!sceneEl) {
        console.error('A-Frame scene not found!');
        return;
      }

      // 1) ตั้งค่า input ข้ามแพลตฟอร์ม
      setupCrossDeviceInput(sceneEl);

      // 2) ล้าง targetRoot เก่า / สร้างใหม่
      if (targetRoot) targetRoot.remove();
      targetRoot = document.createElement('a-entity');
      targetRoot.id = 'targetRoot';
      sceneEl.appendChild(targetRoot);

      // 3) ตั้งค่า UI / FX
      ensureFeverBar();
      setShardMode('goodjunk');

      // 4) reset state
      window.score        = 0;
      window.combo        = 0;
      window.misses       = 0;
      shield              = 0;
      fever               = 0;
      window.FEVER_ACTIVE = false;
      window.running      = true;

      setFever(0);
      setShield(0);
      setFeverActive(false);

      // 5) difficulty
      difficulty.set(level);
      gameConfig = difficulty.get(); // { size, rate, life }

      // 6) timer
      if (gameTimer)  clearInterval(gameTimer);
      if (spawnTimer) clearTimeout(spawnTimer);
      gameTimer  = setInterval(gameTick, 1000);
      spawnTimer = setTimeout(spawnTarget, 1000);

      // 7) Quest
      Quest.start();

      // 8) ยิงเป้าด้วย click (รองรับ VR controller + gaze)
      sceneEl.addEventListener('click', (e) => {
        const el = e.target;
        if (el && el.dataset && el.dataset.hhaTgt) {
          onHitTarget(el);
        }
      });

      // 9) Fallback สำหรับ PC: คลิก mouse กลางจอ
      const cursor = document.getElementById('cursor');
      if (sceneEl.canvas && cursor && cursor.components && cursor.components.raycaster) {
        sceneEl.canvas.addEventListener('mousedown', () => {
          if (!window.running) return;
          const raycaster = cursor.components.raycaster;
          const hit = raycaster.intersectedEls && raycaster.intersectedEls[0];
          if (hit && hit.dataset && hit.dataset.hhaTgt) {
            onHitTarget(hit);
          }
        });
      }

      // แจ้งเริ่มเกม ให้ coach / HUD ใช้งาน
      window.emit('hha:score', { score: 0, combo: 0, delta: 0 });
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
        try { targetRoot.remove(); } catch {}
      }
      targetRoot = null;

      // ล้าง UI พวก fever bar / coach bubble ฯลฯ
      document.querySelectorAll('[data-hha-ui]').forEach(el => {
        try { el.remove(); } catch {}
      });

      window.emit('hha:end', { score: window.score });
    }
  };

})(GAME_MODULES, GAME_MODULES);
