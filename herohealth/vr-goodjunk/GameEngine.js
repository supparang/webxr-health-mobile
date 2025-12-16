// === /herohealth/vr-goodjunk/GameEngine.js ===
// Good vs Junk VR — Production-safe spawn engine (emoji always visible)
// - emoji targets rendered via CanvasTexture (no A-Frame text/msdf dependency)
// - clickable by mouse/touch + VR gaze/fuse
// - dispatch events: hha:score, hha:miss, hha:judge, hha:end, hha:life
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

// ===== Emoji sets =====
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

// --- A-Frame refs ---
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

// ===== Emoji as CanvasTexture (works on mobile reliably) =====
function makeEmojiTexture(emoji, px = 256) {
  const c = document.createElement('canvas');
  c.width = px; c.height = px;
  const g = c.getContext('2d');
  if (!g) return null;

  g.clearRect(0, 0, px, px);
  g.textAlign = 'center';
  g.textBaseline = 'middle';

  // shadow
  g.font = `900 ${Math.floor(px * 0.70)}px system-ui, "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji"`;
  g.fillStyle = 'rgba(0,0,0,0.35)';
  g.fillText(String(emoji || '❓'), px / 2 + 4, px / 2 + 6);

  // emoji
  g.fillStyle = '#ffffff';
  g.fillText(String(emoji || '❓'), px / 2, px / 2);

  // THREE may not be ready yet (rare) -> guard
  if (!ROOT.THREE) return null;
  const tex = new ROOT.THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  tex.minFilter = ROOT.THREE.LinearFilter;
  tex.magFilter = ROOT.THREE.LinearFilter;
  return tex;
}

function setPlaneEmoji(planeEl, emoji) {
  if (!planeEl) return;

  // when THREE not ready, fallback: hide nothing (but keep ring)
  if (!ROOT.THREE) return;

  const tex = makeEmojiTexture(emoji, 256);
  if (!tex) return;

  const apply = () => {
    const mesh = planeEl.getObject3D && planeEl.getObject3D('mesh');
    if (mesh && mesh.material) {
      // dispose old map (best-effort)
      try { mesh.material.map && mesh.material.map.dispose && mesh.material.map.dispose(); } catch (_) {}
      mesh.material.map = tex;
      mesh.material.transparent = true;
      mesh.material.opacity = 1;
      mesh.material.needsUpdate = true;
    }
  };

  // mesh may exist already; if not, wait until loaded
  try { apply(); } catch (_) {}
  planeEl.addEventListener('loaded', apply, { once: true });
}

// --- Target factory ---
// clickable root with invisible collider + emoji plane (texture) + ring
function makeTargetEntity() {
  const root = document.createElement('a-entity');
  root.className = 'gj-target';
  root.setAttribute('data-hha-tgt', '1');

  // collider (raycaster will hit this)
  root.setAttribute('geometry', 'primitive: circle; radius: 0.28');
  root.setAttribute('material', 'shader: flat; opacity: 0; transparent: true; side: double');

  // emoji plane
  const face = document.createElement('a-plane');
  face.className = 'gj-emoji-plane';
  face.setAttribute('width', '0.62');
  face.setAttribute('height', '0.62');
  face.setAttribute('position', '0 0 0.02');
  face.setAttribute('material', 'shader: flat; transparent: true; opacity: 1; side: double');
  root.appendChild(face);

  // subtle ring to help aim
  const ring = document.createElement('a-entity');
  ring.className = 'gj-ring';
  ring.setAttribute('geometry', 'primitive: ring; radiusInner: 0.32; radiusOuter: 0.36');
  ring.setAttribute('material', 'shader: flat; opacity: 0.18; transparent: true; color: #ffffff');
  ring.setAttribute('position', '0 0 0.01');
  root.appendChild(ring);

  return root;
}

// Safe animation helpers
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

// ===== Main Engine =====
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

    if (diff === 'hard') {
      const lost = Math.floor(misses / (cfg.missPerHeart || 3));
      heartsLeft = Math.max(0, HEARTS_MAX - lost);

      dispatch('hha:life', {
        diff,
        heartsLeft,
        heartsMax: HEARTS_MAX,
        perHeart: cfg.missPerHeart
      });

      if (heartsLeft <= 0) stop('no-hearts');
    }
  }

  function kindRoll() {
    const p = Math.random();

    if (p < (cfg.bonusRatio || 0.1)) {
      const q = Math.random();
      if (q < 0.45) return 'star';
      if (q < 0.85) return 'diamond';
      return 'shield';
    }
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

  function removeTarget(t) {
    if (!t) return;
    if (!active.has(t)) return;

    active.delete(t);

    const removeNow = () => {
      try { t.parentNode && t.parentNode.removeChild(t); } catch (_) {}
    };

    popOutAndRemove(t, removeNow);
  }

  function spawnOne() {
    if (!running) return;
    if (active.size >= (cfg.maxActive | 0)) return;

    // place in front
    const z = -r(2.6, 4.2);
    const x = r(-1.15, 1.15);
    const y = r(0.9, 2.2);

    const t = makeTargetEntity();
    const kind = kindRoll();
    t.dataset.kind = kind;

    // set emoji texture
    const face = t.querySelector('.gj-emoji-plane');
    if (face) setPlaneEmoji(face, emojiFor(kind));

    // scale per diff
    const s = cfg.scale || 1.15;
    t.object3D.scale.set(s, s, s);

    t.setAttribute('position', `${x} ${y} ${z}`);

    // face camera
    try {
      const v = new ROOT.THREE.Vector3();
      cam.object3D.getWorldPosition(v);
      t.object3D.lookAt(v);
    } catch (_) {}

    // click handler
    const onHit = (ev) => {
      ev && ev.stopPropagation && ev.stopPropagation();
      if (!active.has(t)) return;

      const k = String(t.dataset.kind || '');
      const P = getParticles();

      // FX (best-effort)
      if (P && P.burstAt) P.burstAt(window.innerWidth / 2, window.innerHeight * 0.34, { count: 14, good: (k !== 'junk') });
      if (P && P.scorePop) P.scorePop(window.innerWidth / 2, window.innerHeight * 0.32, (k === 'junk' ? 'OOPS!' : 'NICE!'), {
        judgment: k.toUpperCase(),
        good: (k !== 'junk')
      });

      if (k === 'junk') {
        addMiss();
        setJudge('MISS');
      } else {
        let gain = 50;
        if (k === 'good') gain = 60;
        if (k === 'star') gain = 120;
        if (k === 'diamond') gain = 150;
        if (k === 'shield') gain = 90;

        setCombo(combo + 1);
        addScore(gain, (combo >= 8 ? 'PERFECT' : 'GOOD'));
      }

      removeTarget(t);
    };

    t.addEventListener('click', onHit);

    // TTL timeout
    const ttl = cfg.ttlMs | 0;
    layer.appendChild(t);
    active.add(t);
    popIn(t);

    setTimeout(() => {
      if (!running) return;
      if (!active.has(t)) return;
      addMiss();
      setJudge('MISS');
      removeTarget(t);
    }, ttl);
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
      try { t.parentNode && t.parentNode.removeChild(t); } catch (_) {}
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

    // spawn immediately so user sees targets
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

    // finalize (HUD expects totals)
    const goalsTotal = 2, miniTotal = 3;
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

    clearAllTargets();
    console.log('[GoodJunkVR] stopped reason=', reason);
  }

  return { start, stop };
})();