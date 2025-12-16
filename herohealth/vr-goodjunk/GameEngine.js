// === /herohealth/vr-goodjunk/GameEngine.js ===
// Good vs Junk VR — FIX v4 (target visible + correct camera + quest progress)
// - Flat emoji targets via canvas texture on plane (always visible)
// - Click/touch + VR gaze/fuse (root has data-hha-tgt + geometry collider)
// - MISS counts ONLY when player hits JUNK (no timeout miss)
// - Waits for a-scene loaded before spawning
// - Emits: hha:score, hha:miss, hha:judge, hha:end, hha:life, quest:update
//
// NOTE: No imports to avoid module path issues.

'use strict';

const ROOT = (typeof window !== 'undefined' ? window : globalThis);

function clamp(v, a, b) { v = +v || 0; return Math.max(a, Math.min(b, v)); }
function r(min, max) { return min + Math.random() * (max - min); }
function now() { return (ROOT.performance && performance.now) ? performance.now() : Date.now(); }

function dispatch(name, detail) {
  ROOT.dispatchEvent(new CustomEvent(name, { detail: detail || {} }));
}

// --- optional FX (from /vr/particles.js IIFE) ---
function getParticles() {
  const gm = ROOT.GAME_MODULES || {};
  return gm.Particles || ROOT.Particles || null;
}

// --- A-Frame / THREE safe ---
function getAFRAME() { return ROOT.AFRAME || null; }
function getTHREE()  {
  const A = getAFRAME();
  return ROOT.THREE || (A && A.THREE) || null;
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
    return {
      spawnMs: 900,
      ttlMs: 1500,
      maxActive: 4,
      scale: 1.25,
      goodRatio: 0.72,
      bonusRatio: 0.10,
      missPerHeart: 3,
      // quest tuning
      goalGoodTarget: 14,
      goalMaxJunkHit: 3,
      miniComboTarget: 6,
      miniScoreTarget: 650,
      miniBonusTarget: 2
    };
  }
  if (d === 'hard') {
    return {
      spawnMs: 650,
      ttlMs: 1050,
      maxActive: 5,
      scale: 1.10,
      goodRatio: 0.60,
      bonusRatio: 0.12,
      missPerHeart: 3,
      goalGoodTarget: 16,
      goalMaxJunkHit: 2,
      miniComboTarget: 10,
      miniScoreTarget: 900,
      miniBonusTarget: 3
    };
  }
  return {
    spawnMs: 760,
    ttlMs: 1300,
    maxActive: 5,
    scale: 1.18,
    goodRatio: 0.66,
    bonusRatio: 0.11,
    missPerHeart: 3,
    goalGoodTarget: 15,
    goalMaxJunkHit: 3,
    miniComboTarget: 8,
    miniScoreTarget: 780,
    miniBonusTarget: 2
  };
}

// -------------------- Scene helpers --------------------
function ensureScene() {
  const scene = document.querySelector('a-scene');
  if (!scene) throw new Error('a-scene not found');
  return scene;
}

// ✅ FIX: find active camera automatically
function ensureCam() {
  // prefer your id
  let cam = document.querySelector('#gj-camera');
  if (cam) return cam;

  // active a-camera
  cam = document.querySelector('a-camera');
  if (cam) return cam;

  // any entity with camera component
  cam = document.querySelector('[camera]');
  if (cam) return cam;

  throw new Error('No active camera found');
}

// create a layer that is parented to camera so it's always in the same "view space"
function ensureLayerOnCamera(camEl) {
  let layer = camEl.querySelector('#gj-target-layer');
  if (!layer) {
    layer = document.createElement('a-entity');
    layer.id = 'gj-target-layer';
    // keep slightly in front of camera space; targets will be placed further by z
    layer.setAttribute('position', '0 0 -0.01');
    camEl.appendChild(layer);
  }
  return layer;
}

// -------------------- Emoji texture helper (canvas -> material map) --------------------
function makeEmojiTexture(emoji, opts = {}) {
  const THREE = getTHREE();
  if (!THREE) return null;

  const size = opts.size || 256;
  const pad  = opts.pad  || 16;

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  // transparent bg
  ctx.clearRect(0, 0, size, size);

  // soft glow ring (optional)
  ctx.save();
  ctx.globalAlpha = 0.18;
  ctx.beginPath();
  ctx.arc(size/2, size/2, (size/2) - pad, 0, Math.PI*2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.restore();

  // emoji
  const fontSize = Math.floor(size * 0.62);
  ctx.font = `${fontSize}px system-ui, "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji"`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // shadow
  ctx.save();
  ctx.globalAlpha = 0.95;
  ctx.shadowColor = 'rgba(0,0,0,0.45)';
  ctx.shadowBlur = 18;
  ctx.fillText(String(emoji || '❓'), size/2, size/2 + 2);
  ctx.restore();

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  return tex;
}

// -------------------- Target factory --------------------
function makeTargetEntity() {
  // root = collider + children
  const root = document.createElement('a-entity');
  root.className = 'gj-target';
  root.setAttribute('data-hha-tgt', '1');

  // IMPORTANT: collider must have geometry so raycaster can hit
  root.setAttribute('geometry', 'primitive: circle; radius: 0.30');
  root.setAttribute('material', 'shader: flat; opacity: 0; transparent: true; side: double');

  // visible plane (emoji texture)
  const plane = document.createElement('a-plane');
  plane.className = 'gj-face';
  plane.setAttribute('width', '0.80');
  plane.setAttribute('height', '0.80');
  plane.setAttribute('position', '0 0 0.02');
  plane.setAttribute('material', 'shader: flat; transparent: true; opacity: 1; side: double;');

  // subtle ring
  const ring = document.createElement('a-entity');
  ring.className = 'gj-ring';
  ring.setAttribute('geometry', 'primitive: ring; radiusInner: 0.34; radiusOuter: 0.38');
  ring.setAttribute('material', 'shader: flat; opacity: 0.20; transparent: true; color: #ffffff; side: double');
  ring.setAttribute('position', '0 0 0.01');

  root.appendChild(plane);
  root.appendChild(ring);

  return root;
}

function applyEmojiToTarget(targetEl, emojiChar) {
  const A = getAFRAME();
  const THREE = getTHREE();
  if (!A || !THREE) return;

  const plane = targetEl.querySelector('.gj-face');
  if (!plane) return;

  // create / reuse texture
  const tex = makeEmojiTexture(emojiChar, { size: 256, pad: 18 });
  if (!tex) return;

  // wait for mesh
  const apply = () => {
    const mesh = plane.getObject3D('mesh');
    if (!mesh || !mesh.material) return false;

    // ensure material is MeshBasicMaterial-like
    mesh.material.transparent = true;
    mesh.material.opacity = 1;
    mesh.material.map = tex;
    mesh.material.needsUpdate = true;
    return true;
  };

  if (!apply()) {
    plane.addEventListener('object3dset', function onSet() {
      if (apply()) {
        plane.removeEventListener('object3dset', onSet);
      }
    });
  }
}

// Safe pop in/out (no animation component)
function popIn(el) {
  if (!el || !el.object3D) return;
  el.object3D.scale.set(0.001, 0.001, 0.001);
  const t0 = now();
  const dur = 140;

  function step() {
    const p = clamp((now() - t0) / dur, 0, 1);
    const s = 0.22 + 0.78 * (1 - Math.pow(1 - p, 3));
    el.object3D.scale.set(s, s, s);
    if (p < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

function popOutAndRemove(el, removeFn) {
  if (!el || !el.object3D) { removeFn && removeFn(); return; }
  const t0 = now();
  const dur = 120;
  const s0 = el.object3D.scale.x || 1;

  function step() {
    const p = clamp((now() - t0) / dur, 0, 1);
    const s = s0 * (1 - p);
    el.object3D.scale.set(Math.max(0.001, s), Math.max(0.001, s), Math.max(0.001, s));
    if (p < 1) requestAnimationFrame(step);
    else removeFn && removeFn();
  }
  requestAnimationFrame(step);
}

// -------------------- Quest system (2 Goals + 3 Minis) --------------------
function makeQuestState(cfg) {
  const goals = [
    {
      id: 'G1',
      label: `เก็บอาหารดีให้ครบ ${cfg.goalGoodTarget} ชิ้น`,
      target: cfg.goalGoodTarget,
      prog: 0,
      done: false
    },
    {
      id: 'G2',
      label: `ตีของขยะให้น้อยกว่า/เท่ากับ ${cfg.goalMaxJunkHit} ครั้ง`,
      target: cfg.goalMaxJunkHit,
      prog: 0, // junk hits
      done: false
    }
  ];

  const minis = [
    {
      id: 'M1',
      label: `ทำคอมโบให้ถึง ${cfg.miniComboTarget}`,
      target: cfg.miniComboTarget,
      prog: 0,
      done: false
    },
    {
      id: 'M2',
      label: `ทำคะแนนให้ถึง ${cfg.miniScoreTarget}`,
      target: cfg.miniScoreTarget,
      prog: 0,
      done: false
    },
    {
      id: 'M3',
      label: `เก็บบонус (⭐/💎/🛡️) ให้ครบ ${cfg.miniBonusTarget}`,
      target: cfg.miniBonusTarget,
      prog: 0,
      done: false
    }
  ];

  return {
    goals,
    minis,
    activeMiniIndex: 0
  };
}

function emitQuestUpdate(qs) {
  // active goal: show the first not-done goal, else null
  const goal = qs.goals.find(g => !g.done) || null;

  // active mini: show current mini (even if done -> advance handled elsewhere)
  const mini = qs.minis[qs.activeMiniIndex] || null;

  let hint = '';
  if (goal && goal.id === 'G2') hint = 'หลีกเลี่ยงการตีของขยะ 🍔🍟';
  if (goal && goal.id === 'G1') hint = 'โฟกัสผัก ผลไม้ นม 🥦🍎🥛';
  if (!goal) hint = 'Goals ครบแล้ว! ไปปิด Mini ให้ครบ ✅';

  dispatch('quest:update', {
    goal,
    mini,
    hint,
    goalsAll: qs.goals,
    minisAll: qs.minis
  });
}

function advanceMiniIfDone(qs) {
  const m = qs.minis[qs.activeMiniIndex];
  if (m && m.done) {
    // advance to next not-done mini
    while (qs.activeMiniIndex < qs.minis.length && qs.minis[qs.activeMiniIndex].done) {
      qs.activeMiniIndex++;
    }
    // clamp
    if (qs.activeMiniIndex >= qs.minis.length) qs.activeMiniIndex = qs.minis.length - 1;
  }
}

// -------------------- Main Engine --------------------
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
  let misses = 0;       // junk hits count as MISS
  let goodHits = 0;
  let junkHits = 0;
  let bonusHits = 0;

  // hearts (hard)
  const HEARTS_MAX = 3;
  let heartsLeft = HEARTS_MAX;

  // quest
  let qs = makeQuestState(cfg);

  function resetStats() {
    score = 0;
    combo = 0;
    comboMax = 0;
    misses = 0;
    goodHits = 0;
    junkHits = 0;
    bonusHits = 0;
    heartsLeft = HEARTS_MAX;

    qs = makeQuestState(cfg);

    dispatch('hha:score', { score, combo, misses });
    dispatch('hha:judge', { label: '' });
    dispatch('hha:life', {
      diff,
      heartsLeft,
      heartsMax: HEARTS_MAX,
      perHeart: cfg.missPerHeart
    });

    emitQuestUpdate(qs);
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
    // MISS = hitting junk only
    misses = (misses + 1) | 0;
    junkHits = misses;

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

      if (heartsLeft <= 0) stop('no-hearts');
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

  function updateQuestFromStats() {
    // Goals
    const g1 = qs.goals[0];
    if (g1 && !g1.done) {
      g1.prog = goodHits;
      if (g1.prog >= g1.target) g1.done = true;
    }

    const g2 = qs.goals[1];
    if (g2 && !g2.done) {
      g2.prog = junkHits;
      // goal2 done = still within limit at end? (we treat as "pass if <= target" realtime)
      // show as progress until exceed => fail-like (we keep not done, but cap)
      if (g2.prog <= g2.target) {
        // allow showing as "ok", but not mark done until end
        // we keep done=false; HUD will show it ongoing
      }
      if (g2.prog > g2.target) {
        // exceeded = cannot clear this goal anymore (mark done=false but clamp bar visually)
        // We'll still show progress and let user see they exceeded.
      }
    }

    // Minis (sequential)
    const m1 = qs.minis[0];
    if (m1 && !m1.done) {
      m1.prog = Math.max(m1.prog, comboMax);
      if (m1.prog >= m1.target) m1.done = true;
    }

    const m2 = qs.minis[1];
    if (m2 && !m2.done) {
      m2.prog = score;
      if (m2.prog >= m2.target) m2.done = true;
    }

    const m3 = qs.minis[2];
    if (m3 && !m3.done) {
      m3.prog = bonusHits;
      if (m3.prog >= m3.target) m3.done = true;
    }

    advanceMiniIfDone(qs);
    emitQuestUpdate(qs);
  }

  function spawnOne() {
    if (!running) return;
    if (active.size >= (cfg.maxActive | 0)) return;

    const THREE = getTHREE();
    if (!THREE) return;

    // Place in camera-local space because layer is parented to camera.
    // Use small spread. z negative means in front of camera.
    const z = -r(2.2, 4.2);
    const x = r(-1.10, 1.10);
    const y = r(-0.35, 0.65); // camera-local (0 = center)

    const t = makeTargetEntity();
    t.dataset.kind = kindRoll();

    // set emoji texture
    applyEmojiToTarget(t, emojiFor(t.dataset.kind));

    // scale per diff
    const s = cfg.scale || 1.15;
    t.object3D.scale.set(s, s, s);

    // position in camera-local coordinates
    t.setAttribute('position', `${x} ${y} ${z}`);

    // face camera (because parented to camera, just no rotation needed)
    t.setAttribute('rotation', '0 0 0');

    // click handler
    const onHit = (ev) => {
      ev && ev.stopPropagation && ev.stopPropagation();
      if (!active.has(t)) return;

      const kind = String(t.dataset.kind || '');

      // FX
      const P = getParticles();
      if (P && P.burstAt) {
        P.burstAt(window.innerWidth / 2, window.innerHeight * 0.34, { count: 16, good: (kind !== 'junk') });
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

        // update hit counters
        if (kind === 'good') goodHits += 1;
        else bonusHits += 1;

        setCombo(combo + 1);
        addScore(gain, (combo >= 8 ? 'PERFECT' : 'GOOD'));
      }

      // update quests after scoring
      updateQuestFromStats();

      removeTarget(t);
    };

    t.addEventListener('click', onHit);

    // life timer (ttl) -> just disappear (NO MISS)
    const ttl = cfg.ttlMs | 0;
    setTimeout(() => {
      if (!running) return;
      if (!active.has(t)) return;
      // timeout: vanish only
      removeTarget(t);
    }, ttl);

    layer.appendChild(t);
    active.add(t);
    popIn(t);
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

  function finalizeGoalsForEnd() {
    // Goal1: goodHits >= target
    const g1 = qs.goals[0];
    if (g1) {
      g1.prog = goodHits;
      g1.done = (g1.prog >= g1.target);
    }

    // Goal2: junkHits <= limit
    const g2 = qs.goals[1];
    if (g2) {
      g2.prog = junkHits;
      g2.done = (g2.prog <= g2.target);
    }

    // minis already computed (sequential), but mark each correctly
    qs.minis[0].prog = Math.max(qs.minis[0].prog, comboMax);
    qs.minis[0].done = (qs.minis[0].prog >= qs.minis[0].target);

    qs.minis[1].prog = score;
    qs.minis[1].done = (qs.minis[1].prog >= qs.minis[1].target);

    qs.minis[2].prog = bonusHits;
    qs.minis[2].done = (qs.minis[2].prog >= qs.minis[2].target);

    emitQuestUpdate(qs);
  }

  function start(diffKey) {
    diff = String(diffKey || 'normal').toLowerCase();
    cfg = diffCfg(diff);

    // wait for scene loaded (important on mobile)
    try {
      scene = ensureScene();
    } catch (err) {
      console.error('[GoodJunkVR] start failed:', err);
      return;
    }

    const begin = () => {
      try {
        cam = ensureCam();
        layer = ensureLayerOnCamera(cam);
      } catch (err) {
        console.error('[GoodJunkVR] start camera/layer failed:', err);
        return;
      }

      running = true;
      resetStats();

      // show at least 2 targets immediately
      spawnOne();
      spawnOne();
      loopSpawn();

      console.log('[GoodJunkVR] started diff=', diff, cfg, '(camera-local layer)');
    };

    if (scene.hasLoaded) {
      begin();
    } else {
      scene.addEventListener('loaded', function onLoaded() {
        scene.removeEventListener('loaded', onLoaded);
        begin();
      });
    }
  }

  function stop(reason) {
    if (!running) return;
    running = false;

    clearInterval(spawnTimer);
    spawnTimer = null;

    // finalize quest status for summary
    finalizeGoalsForEnd();

    const goalsTotal = qs.goals.length;
    const miniTotal  = qs.minis.length;
    const goalsCleared = qs.goals.filter(g => g && g.done).length;
    const miniCleared  = qs.minis.filter(m => m && m.done).length;

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