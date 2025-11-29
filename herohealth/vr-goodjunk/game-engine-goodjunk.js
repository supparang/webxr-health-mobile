(function (global) {
  'use strict';
  const exports = global.GAME_MODULES = global.GAME_MODULES || {};

  const {
    setFever, setFeverActive, setShield, ensureFeverBar,
    Difficulty, emojiImage, burstAt, floatScore, Quest
  } = exports;

  window.score = 0;
  window.combo = 0;
  window.misses = 0;
  window.FEVER_ACTIVE = false;
  window.running = false;

  let shield = 0;
  let fever = 0;

  let gameTimer = null;
  let spawnTimer = null;
  let sceneEl = null;
  let targetRoot = null;
  let gameConfig = null;
  const difficulty = new Difficulty();

  const GOOD = ['🥦','🥕','🍎','🐟','🥛','🍊','🍌','🍇','🥬','🍚','🥜','🍞','🍓','🍍','🥝','🍐'];
  const JUNK = ['🍔','🍟','🍕','🍩','🍪','🧁','🥤','🧋','🍫','🌭','🍰','🍬'];
  const STAR='⭐', DIA='💎', SHIELD_EMOJI='🛡️', FIRE='🔥';
  const BONUS=[STAR,DIA,SHIELD_EMOJI,FIRE];

  window.emit = function (name, detail) {
    try { window.dispatchEvent(new CustomEvent(name, { detail })); } catch (e) { }
  };

  window.feverStart = function () {
    if (window.FEVER_ACTIVE) return;
    fever = 100;
    setFever(fever);
    window.FEVER_ACTIVE = true;
    setFeverActive(true);
    Quest.onFever();
    window.emit('hha:fever', { state: 'start' });
  };

  window.popupText = function (text, pos, color = '#fff') {
    const worldPos = { x: 0, y: (pos && pos.y) || 1.4, z: -1.5 };
    floatScore(sceneEl, worldPos, text, color);
  };

  function mult() { return window.FEVER_ACTIVE ? 2 : 1; }

  function gainFever(n) {
    if (window.FEVER_ACTIVE) return;
    fever = Math.max(0, Math.min(100, fever + n));
    setFever(fever);
    if (fever >= 100) window.feverStart();
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

  function spawnTarget() {
    if (!window.running) return;
    const cfg = gameConfig;
    const isGood = Math.random() < 0.65;
    const usePower = Math.random() < 0.08;

    let char, type, palette;
    if (usePower) {
      char = BONUS[(Math.random() * BONUS.length) | 0];
      type = 'good';
      palette = 'groups';
    } else if (isGood) {
      char = GOOD[(Math.random() * GOOD.length) | 0];
      type = 'good';
      palette = 'goodjunk';
    } else {
      char = JUNK[(Math.random() * JUNK.length) | 0];
      type = 'bad';
      palette = 'plate';
    }

    const scale = cfg.size * 0.6;
    const el = emojiImage(char, scale);
    el.dataset.type = type;
    el.dataset.char = char;
    el.dataset.palette = palette;
    el.setAttribute('data-hha-tgt', '1');

    const x = (Math.random() - 0.5) * 4;
    const y = 1.0 + Math.random() * 1.0;
    const z = -2.5 - Math.random() * 1.0;
    el.setAttribute('position', `${x} ${y} ${z}`);

    targetRoot.appendChild(el);

    setTimeout(() => {
      if (el && el.parentNode) {
        if (type === 'good') {
          window.misses++;
          window.combo = 0;
          window.emit('hha:miss', {});
        } else {
          gainFever(4);
        }
        el.remove();
      }
    }, cfg.life);

    spawnTimer = setTimeout(spawnTarget, cfg.rate);
  }

  function onHitTarget(targetEl) {
    if (!targetEl || !targetEl.parentNode) return;

    const type = targetEl.dataset.type;
    const char = targetEl.dataset.char;
    const palette = targetEl.dataset.palette;
    const pos = targetEl.object3D.getWorldPosition(new THREE.Vector3());

    let scoreDelta = 0;

    if (type === 'good') {
      if (char === STAR)      { scoreDelta = 40 * mult(); gainFever(10); }
      else if (char === DIA)  { scoreDelta = 80 * mult(); gainFever(30); }
      else if (char === SHIELD_EMOJI) {
        scoreDelta = 20; shield = Math.min(3, shield + 1); setShield(shield);
      }
      else if (char === FIRE) { scoreDelta = 25; window.feverStart(); }
      else {
        scoreDelta = (20 + window.combo * 2) * mult();
        gainFever(8 + window.combo * 0.6);
      }
      window.score += scoreDelta;
      window.combo++;
      Quest.onGood();
      burstAt(sceneEl, pos, { mode: palette });
      floatScore(sceneEl, pos, `+${scoreDelta}`, '#22c55e');
    } else {
      if (shield > 0) {
        shield--;
        setShield(shield);
        burstAt(sceneEl, pos, { mode: 'hydration' });
        floatScore(sceneEl, pos, 'SHIELDED!', '#60a5fa');
      } else {
        scoreDelta = -15;
        window.score = Math.max(0, window.score + scoreDelta);
        window.combo = 0;
        decayFever(18);
        Quest.onBad();
        window.emit('hha:miss', {});
        burstAt(sceneEl, pos, { mode: palette });
        floatScore(sceneEl, pos, `${scoreDelta}`, '#ef4444');
      }
    }

    window.emit('hha:score', { score: window.score, combo: window.combo, delta: scoreDelta });
    targetEl.remove();
  }

  function gameTick() {
    if (!window.running) return;
    decayFever(window.combo <= 0 ? 6 : 2);
  }

  exports.GameEngine = {
    start(level) {
      sceneEl = document.querySelector('a-scene');
      if (!sceneEl) {
        console.error('A-Frame scene not found!');
        return;
      }

      if (targetRoot) targetRoot.remove();
      targetRoot = document.createElement('a-entity');
      targetRoot.id = 'targetRoot';
      sceneEl.appendChild(targetRoot);

      ensureFeverBar();
      exports.setShardMode && exports.setShardMode('goodjunk');

      window.score = 0;
      window.combo = 0;
      window.misses = 0;
      shield = 0;
      fever = 0;
      window.FEVER_ACTIVE = false;
      window.running = true;

      setFever(0);
      setShield(0);
      setFeverActive(false);

      difficulty.set(level);
      gameConfig = difficulty.get();

      if (gameTimer) clearInterval(gameTimer);
      if (spawnTimer) clearTimeout(spawnTimer);
      gameTimer = setInterval(gameTick, 1000);
      spawnTimer = setTimeout(spawnTarget, 1000);

      Quest.start();

      sceneEl.addEventListener('click', (e) => {
        if (e.target && e.target.dataset && e.target.dataset.hhaTgt) {
          onHitTarget(e.target);
        }
      });

      const sceneCanvas = sceneEl.canvas;
      if (sceneCanvas) {
        sceneCanvas.addEventListener('mousedown', () => {
          if (!window.running) return;
          const cursor = document.getElementById('cursor');
          if (!cursor) return;
          const raycaster = cursor.components && cursor.components.raycaster;
          if (!raycaster) return;
          const intersectedEl = raycaster.intersectedEls && raycaster.intersectedEls[0];
          if (intersectedEl && intersectedEl.dataset && intersectedEl.dataset.hhaTgt) {
            onHitTarget(intersectedEl);
          }
        });
      }

      window.emit('hha:score', { score: 0, combo: 0 });
    },

    stop() {
      if (!window.running) return;
      window.running = false;
      if (gameTimer) clearInterval(gameTimer);
      if (spawnTimer) clearTimeout(spawnTimer);
      gameTimer = null;
      spawnTimer = null;
      Quest.stop();
      if (targetRoot) targetRoot.remove();
      targetRoot = null;
      document.querySelectorAll('[data-hha-ui]').forEach(el => el.remove());
      window.emit('hha:end', { score: window.score });
    }
  };

})(window);
