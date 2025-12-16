// === /herohealth/vr-goodjunk/GameEngine.js ===
// Good vs Junk VR — Minimal but production-safe spawn engine
// - emoji targets (3D) pop-in/out
// - clickable by mouse/touch + VR gaze/fuse (entity has data-hha-tgt + geometry)
// - dispatch events: hha:score, hha:miss, hha:judge, hha:time (handled in HTML), hha:end, hha:life
//
// NOTE: This file intentionally has NO imports to avoid module path issues.

'use strict';

const ROOT = (typeof window !== 'undefined' ? window : globalThis);

function clamp(v, a, b) { v = +v || 0; return Math.max(a, Math.min(b, v)); }
function r(min, max) { return min + Math.random() * (max - min); }

function dispatch(name, detail) {
  ROOT.dispatchEvent(new CustomEvent(name, { detail: detail || {} }));
}

// --- Particle helper (optional, from /vr/particles.js IIFE) ---
function getParticles() {
  const gm = ROOT.GAME_MODULES || {};
  return gm.Particles || ROOT.Particles || null;
}

const EMOJI = {
  good:    ['🥦','🍎','🥛','🥗','🍌','🥕','🍇'],
  junk:    ['🍟','🍔','🍕','🍩','🍿','🧋','🥤'],
  star:    ['⭐'],
  diamond: ['💎'],
  shield:  ['🛡️']
};

function pick(arr) { return arr[(Math.random() * arr.length) | 0]; }

function diffCfg(diffKey) {
  const d = String(diffKey || 'normal').toLowerCase();
  if (d === 'easy') {
    return { spawnMs: 950, ttlMs: 1650, maxActive: 4, scale: 1.25, goodRatio: 0.72, bonusRatio: 0.10, missPerHeart: 3 };
  }
  if (d === 'hard') {
    return { spawnMs: 650, ttlMs: 1100, maxActive: 5, scale: 1.05, goodRatio: 0.60, bonusRatio: 0.12, missPerHeart: 3 };
  }
  return { spawnMs: 780, ttlMs: 1350, maxActive: 5, scale: 1.15, goodRatio: 0.66, bonusRatio: 0.11, missPerHeart: 3 };
}

// --- Target factory (A-Frame entities) ---
function ensureScene() {
  const scene = document.querySelector('a-scene');
  if (!scene) throw new Error('a-scene not found');
  return scene;
}

function ensureCam() {
  const cam = document.querySelector('#gj-camera');
  if (!cam) throw new Error('#gj-camera not found');
  return cam;
}

function ensureLayer(scene) {
  let layer = scene.querySelector('#gj-target-layer');
  if (!layer) {
    layer = document.createElement('a-entity');
    layer.id = 'gj-target-layer';
    scene.appendChild(layer);
  }
  return layer;
}

// Create a clickable target root with an invisible collider (geometry) + emoji text child.
function makeTargetEntity() {
  const root = document.createElement('a-entity');
  root.className = 'gj-target';
  // IMPORTANT: raycaster in HTML uses objects: [data-hha-tgt]
  root.setAttribute('data-hha-tgt', '1');

  // collider (invisible, but MUST have geometry)
  root.setAttribute('geometry', 'primitive: circle; radius: 0.28');
  root.setAttribute('material', 'shader: flat; opacity: 0; transparent: true; side: double');

  // emoji text (visible)
  const txt = document.createElement('a-entity');
  txt.className = 'gj-emoji';
  txt.setAttribute('text', 'value: 🥦; align: center; baseline: center; width: 2.8; color: #ffffff; shader: msdf');
  txt.setAttribute('position', '0 0 0.02');
  root.appendChild(txt);

  // subtle ring (optional) to help see aim
  const ring = document.createElement('a-entity');
  ring.className = 'gj-ring';
  ring.setAttribute('geometry', 'primitive: ring; radiusInner: 0.32; radiusOuter: 0.36');
  ring.setAttribute('material', 'shader: flat; opacity: 0.18; transparent: true; color: #ffffff');
  ring.setAttribute('position', '0 0 0.01');
  root.appendChild(ring);

  return root;
}

// Safe animation helpers (no dependency on animation component being present)
function popIn(el) {
  el.object3D.scale.set(0.001, 0.001, 0.001);
  const t0 = performance.now();
  const dur = 140;
  function step() {
    const p = clamp((performance.now() - t0) / dur, 0, 1);
    const s = 0.2 + 0.8 * (1 - Math.pow(1 - p, 3));
    el.object3D.scale.set(s, s, s);
    if (p < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

function popOutAndRemove(el, removeFn) {
  const t0 = performance.now();
  const dur = 120;
  const s0 = el.object3D.scale.x || 1;
  function step() {
    const p = clamp((performance.now() - t0) / dur, 0, 1);
    const s = s0 * (1 - p);
    el.object3D.scale.set(Math.max(0.001, s), Math.max(0.001, s), Math.max(0.001, s));
    if (p < 1) requestAnimationFrame(step);
    else removeFn();
  }
  requestAnimationFrame(step);
}

// --- Main Engine ---
export const GameEngine = (function () {
  let scene, cam, layer;
  let running = false;

  let cfg = diffCfg('normal');
  let diff = 'normal';

  let spawnTimer = null;
  let active = new Set();

  // stats
  let score = 0;
  let combo = 0;
  let comboMax = 0;
  let misses = 0;

  // hearts (hard)
  const HEARTS_MAX = 3;
  let heartsLeft = HEARTS_MAX;

  function resetStats() {
    score = 0;
    combo = 0;
    comboMax = 0;
    misses = 0;
    heartsLeft = HEARTS_MAX;

    dispatch('hha:score', { score, combo, misses });
    dispatch('hha:judge', { label: '' });
    dispatch('hha:life', {
      diff,
      heartsLeft,
      heartsMax: HEARTS_MAX,
      perHeart: cfg.missPerHeart
    });
  }

  function setJudge(label) {
    dispatch('hha:judge', { label: String(label || '') });
  }

  function addScore(delta, label) {
    score = (score + (delta | 0)) | 0;
    dispatch('hha:score', { score, combo, misses });
    if (label) setJudge(label);
  }

  function setCombo(c) {
    combo = c | 0;
    comboMax = Math.max(comboMax, combo);
    dispatch('hha:score', { score, combo, misses });
  }

  function addMiss() {
    misses = (misses + 1) | 0;
    dispatch('hha:score', { score, combo, misses });
    dispatch('hha:miss', { misses });
    setCombo(0);

    // hearts only for hard
    if (diff === 'hard') {
      const lost = Math.floor(misses / (cfg.missPerHeart || 3));
      heartsLeft = Math.max(0, HEARTS_MAX - lost);

      dispatch('hha:life', {
        diff,
        heartsLeft,
        heartsMax: HEARTS_MAX,
        perHeart: cfg.missPerHeart
      });

      if (heartsLeft <= 0) {
        stop('no-hearts');
      }
    }
  }

  function kindRoll() {
    const p = Math.random();

    // bonus targets sometimes
    if (p < (cfg.bonusRatio || 0.1)) {
      const q = Math.random();
      if (q < 0.45) return 'star';
      if (q < 0.85) return 'diamond';
      return 'shield';
    }
    // normal good/junk
    return (Math.random() < (cfg.goodRatio || 0.66)) ? 'good' : 'junk';
  }

  function emojiFor(kind) {
    if (kind === 'good') return pick(EMOJI.good);
    if (kind === 'junk') return pick(EMOJI.junk);
    if (kind === 'star') return pick(EMOJI.star);
    if (kind === 'diamond') return pick(EMOJI.diamond);
    if (kind === 'shield') return pick(EMOJI.shield);
    return '❓';
  }

  function spawnOne() {
    if (!running) return;
    if (active.size >= (cfg.maxActive | 0)) return;

    // place in front of camera with small spread
    const z = -r(2.6, 4.2);
    const x = r(-1.15, 1.15);
    const y = r(0.9, 2.2);

    const t = makeTargetEntity();
    t.dataset.kind = kindRoll();

    // set emoji text
    const txt = t.querySelector('.gj-emoji');
    if (txt) {
      txt.setAttribute('text', `value: ${emojiFor(t.dataset.kind)}; align: center; baseline: center; width: 2.8; color: #ffffff; shader: msdf`);
    }

    // scale per diff
    const s = cfg.scale || 1.15;
    t.object3D.scale.set(s, s, s);

    t.setAttribute('position', `${x} ${y} ${z}`);

    // face camera
    t.object3D.lookAt(cam.object3D.getWorldPosition(new THREE.Vector3()));

    // click handler
    const onHit = (ev) => {
      ev && ev.stopPropagation && ev.stopPropagation();

      // already removed?
      if (!active.has(t)) return;

      const kind = String(t.dataset.kind || '');

      // FX
      const P = getParticles();
      if (P && P.burstAt) {
        // best-effort screen coords (center-ish)
        P.burstAt(window.innerWidth / 2, window.innerHeight * 0.34, { count: 14, good: (kind !== 'junk') });
      }
      if (P && P.scorePop) {
        P.scorePop(window.innerWidth / 2, window.innerHeight * 0.32, (kind === 'junk' ? 'OOPS!' : 'NICE!'), {
          judgment: kind.toUpperCase(),
          good: (kind !== 'junk')
        });
      }

      if (kind === 'junk') {
        addMiss();
        setJudge('MISS');
      } else {
        // score rules
        let gain = 50;
        if (kind === 'good') gain = 60;
        if (kind === 'star') gain = 120;
        if (kind === 'diamond') gain = 150;
        if (kind === 'shield') gain = 90;

        setCombo(combo + 1);
        addScore(gain, (combo >= 8 ? 'PERFECT' : 'GOOD'));
      }

      // remove target immediately
      removeTarget(t, true);
    };

    t.addEventListener('click', onHit);

    // life timer (ttl)
    const born = performance.now();
    const ttl = cfg.ttlMs | 0;

    t.__gj = { born, ttl, onHit };

    layer.appendChild(t);
    active.add(t);

    // pop-in
    popIn(t);

    // if times out -> counts as miss only for GOOD targets (optional),
    // but to keep simple: timeout = miss (like "you missed chance")
    // If you want "MISS only when hit junk", change below to only addMiss() on GOOD.
    setTimeout(() => {
      if (!running) return;
      if (!active.has(t)) return;
      // timeout
      addMiss();
      setJudge('MISS');
      removeTarget(t, false);
    }, ttl);
  }

  function removeTarget(t, hit) {
    if (!t) return;
    if (!active.has(t)) return;

    active.delete(t);

    const removeNow = () => {
      try { t.parentNode && t.parentNode.removeChild(t); } catch(_) {}
    };

    // animate out a bit
    popOutAndRemove(t, removeNow);
  }

  function loopSpawn() {
    clearInterval(spawnTimer);
    spawnTimer = setInterval(() => {
      try { spawnOne(); }
      catch (err) { console.warn('[GoodJunkVR] spawn error:', err); }
    }, cfg.spawnMs | 0);
  }

  function clearAllTargets() {
    active.forEach(t => {
      try { t.parentNode && t.parentNode.removeChild(t); } catch(_) {}
    });
    active.clear();
  }

  function start(diffKey) {
    try {
      scene = ensureScene();
      cam = ensureCam();
      layer = ensureLayer(scene);
    } catch (err) {
      console.error('[GoodJunkVR] start failed:', err);
      return;
    }

    diff = String(diffKey || 'normal').toLowerCase();
    cfg = diffCfg(diff);

    running = true;
    resetStats();

    // IMPORTANT: spawn at least 1 immediately so user sees it
    spawnOne();
    spawnOne();
    loopSpawn();

    console.log('[GoodJunkVR] started diff=', diff, cfg);
  }

  function stop(reason) {
    if (!running) return;
    running = false;

    clearInterval(spawnTimer);
    spawnTimer = null;

    // finalize
    const goalsTotal = 2, miniTotal = 3; // HUD expects numbers; keep stable
    const goalsCleared = 0, miniCleared = 0;

    dispatch('hha:end', {
      reason: String(reason || 'stop'),
      scoreFinal: score,
      comboMax: comboMax,
      misses: misses,
      goalsCleared,
      goalsTotal,
      miniCleared,
      miniTotal
    });

    // clean
    clearAllTargets();

    console.log('[GoodJunkVR] stopped reason=', reason);
  }

  return { start, stop };
})();