// === /herohealth/vr-goodjunk/GameEngine.js ===
// Good vs Junk VR — FIX v4 (emoji + spawn in view + quest progress)
// - emoji targets on plane via CanvasTexture (no more white block)
// - spawn in front of camera direction (so target ALWAYS appears)
// - clickable by mouse/touch + VR gaze/fuse (data-hha-tgt + geometry collider)
// - dispatch: hha:score, hha:miss, hha:judge, hha:fever(optional), hha:end, quest:update
//
// NOTE: intentionally NO imports (avoid GH pages path issues)

'use strict';

const ROOT = (typeof window !== 'undefined' ? window : globalThis);

function clamp(v, a, b) { v = +v || 0; return Math.max(a, Math.min(b, v)); }
function r(min, max) { return min + Math.random() * (max - min); }

function dispatch(name, detail) {
  try { ROOT.dispatchEvent(new CustomEvent(name, { detail: detail || {} })); } catch (_) {}
}

function getParticles() {
  const gm = ROOT.GAME_MODULES || {};
  return gm.Particles || ROOT.Particles || null;
}

function getTHREE() {
  // A-Frame exposes THREE globally
  return ROOT.THREE || (ROOT.AFRAME && ROOT.AFRAME.THREE) || null;
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
      spawnMs: 920, ttlMs: 1700, maxActive: 4,
      scale: 1.18,
      goodRatio: 0.72, bonusRatio: 0.11,
      // quests
      goalGoodTarget: 14, junkLimit: 4,
      miniComboTarget: 6, miniBonusTarget: 2, miniPerfectStreak: 5
    };
  }
  if (d === 'hard') {
    return {
      spawnMs: 650, ttlMs: 1150, maxActive: 5,
      scale: 1.03,
      goodRatio: 0.60, bonusRatio: 0.13,
      // quests
      goalGoodTarget: 16, junkLimit: 3,
      miniComboTarget: 8, miniBonusTarget: 3, miniPerfectStreak: 7
    };
  }
  return {
    spawnMs: 780, ttlMs: 1400, maxActive: 5,
    scale: 1.10,
    goodRatio: 0.66, bonusRatio: 0.12,
    // quests
    goalGoodTarget: 15, junkLimit: 4,
    miniComboTarget: 7, miniBonusTarget: 2, miniPerfectStreak: 6
  };
}

// ---------- A-Frame scene helpers ----------
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
    // keep it at origin in world
    layer.setAttribute('position', '0 0 0');
    scene.appendChild(layer);
  }
  return layer;
}

// ---------- emoji texture ----------
function makeEmojiTexture(char, opts) {
  const THREE = getTHREE();
  if (!THREE) return null;

  const o = opts || {};
  const size = o.size || 256;
  const pad  = o.pad  || 18;

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.clearRect(0, 0, size, size);

  // subtle glow background
  ctx.save();
  ctx.globalAlpha = 0.18;
  ctx.beginPath();
  ctx.arc(size/2, size/2, size*0.42, 0, Math.PI*2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.restore();

  // emoji
  const fontPx = Math.floor(size - pad * 2);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `${fontPx}px system-ui, "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji"`;
  ctx.fillText(String(char || '❓'), size/2, size/2 + 6);

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;

  // three compatibility: r152+ uses colorSpace, older uses encoding
  try {
    if ('colorSpace' in tex) tex.colorSpace = THREE.SRGBColorSpace;
    else if ('encoding' in tex) tex.encoding = THREE.sRGBEncoding;
  } catch (_) {}

  // crisp on mobile
  try {
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.anisotropy = 1;
  } catch (_) {}

  return tex;
}

// ---------- target factory (plane + collider) ----------
function makeTargetEntity() {
  // root is clickable collider (invisible)
  const root = document.createElement('a-entity');
  root.className = 'gj-target';
  root.setAttribute('data-hha-tgt', '1'); // matches raycaster objects: [data-hha-tgt]

  // collider (invisible but MUST have geometry)
  root.setAttribute('geometry', 'primitive: circle; radius: 0.28');
  root.setAttribute('material', 'shader: flat; opacity: 0; transparent: true; side: double');

  // visible face (plane)
  const face = document.createElement('a-plane');
  face.className = 'gj-face';
  face.setAttribute('width', '0.80');
  face.setAttribute('height', '0.80');
  face.setAttribute('position', '0 0 0.02');
  face.setAttribute('material', 'shader: flat; transparent: true; opacity: 1; side: double;');
  root.appendChild(face);

  // subtle ring
  const ring = document.createElement('a-entity');
  ring.className = 'gj-ring';
  ring.setAttribute('geometry', 'primitive: ring; radiusInner: 0.32; radiusOuter: 0.36');
  ring.setAttribute('material', 'shader: flat; opacity: 0.18; transparent: true; color: #ffffff');
  ring.setAttribute('position', '0 0 0.01');
  root.appendChild(ring);

  return root;
}

// apply emoji texture (FIX: create new MeshBasicMaterial after mesh ready)
function applyEmojiToTarget(targetEl, emojiChar) {
  const THREE = getTHREE();
  if (!THREE) return;

  const face = targetEl.querySelector('.gj-face');
  if (!face) return;

  const tex = makeEmojiTexture(emojiChar, { size: 256, pad: 18 });
  if (!tex) return;

  function applyNow() {
    const mesh = face.getObject3D('mesh');
    if (!mesh) return false;

    mesh.material = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      opacity: 1,
      side: THREE.DoubleSide
    });
    mesh.material.needsUpdate = true;
    return true;
  }

  if (!applyNow()) {
    face.addEventListener('object3dset', function onSet() {
      if (applyNow()) face.removeEventListener('object3dset', onSet);
    });
  }
}

// ---------- safe pop in/out ----------
function popIn(el) {
  if (!el || !el.object3D) return;
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
  if (!el || !el.object3D) { removeFn && removeFn(); return; }
  const t0 = performance.now();
  const dur = 120;
  const s0 = el.object3D.scale.x || 1;
  function step() {
    const p = clamp((performance.now() - t0) / dur, 0, 1);
    const s = s0 * (1 - p);
    el.object3D.scale.set(Math.max(0.001, s), Math.max(0.001, s), Math.max(0.001, s));
    if (p < 1) requestAnimationFrame(step);
    else removeFn && removeFn();
  }
  requestAnimationFrame(step);
}

// ---------- spawn math: ALWAYS in camera view ----------
function spawnPoseInFrontOfCamera(camEl) {
  const THREE = getTHREE();
  if (!THREE || !camEl || !camEl.object3D) {
    // fallback (world)
    return { x: r(-1.1, 1.1), y: r(1.0, 2.1), z: -r(2.8, 4.0) };
  }

  const camObj = camEl.object3D;
  const camPos = new THREE.Vector3();
  camObj.getWorldPosition(camPos);

  const dir = new THREE.Vector3();
  camObj.getWorldDirection(dir); // forward
  dir.normalize();

  const up = new THREE.Vector3(0, 1, 0);
  const right = new THREE.Vector3().crossVectors(dir, up).normalize();
  const realUp = new THREE.Vector3().crossVectors(right, dir).normalize();

  const dist = r(2.2, 3.8);
  const offX = r(-0.95, 0.95);
  const offY = r(-0.25, 0.65);

  const p = camPos.clone()
    .add(dir.clone().multiplyScalar(dist))
    .add(right.clone().multiplyScalar(offX))
    .add(realUp.clone().multiplyScalar(offY));

  return { x: p.x, y: Math.max(0.6, p.y), z: p.z };
}

function faceCamera(targetEl, camEl) {
  const THREE = getTHREE();
  if (!THREE || !targetEl || !camEl) return;
  try {
    const camPos = new THREE.Vector3();
    camEl.object3D.getWorldPosition(camPos);
    targetEl.object3D.lookAt(camPos);
  } catch (_) {}
}

// ---------- Quest system ----------
function makeQuestState(cfg) {
  return {
    // counters
    goodHit: 0,
    junkHit: 0,
    bonusHit: 0, // star/diamond/shield
    comboBest: 0,
    perfectStreak: 0,
    // goals (2)
    goals: [
      { id:'G1', label:`เก็บอาหารดีให้ครบ ${cfg.goalGoodTarget} ชิ้น`, target: cfg.goalGoodTarget, prog: 0, done:false, hint:'โฟกัสผัก ผลไม้ นม 🥦🍎🥛' },
      { id:'G2', label:`อย่าเก็บของขยะเกิน ${cfg.junkLimit} ครั้ง`, target: cfg.junkLimit, prog: 0, done:false, hint:'เลี่ยง 🍟🍔🍕' }
    ],
    // minis (3)
    minis: [
      { id:'M1', label:`ทำคอมโบให้ถึง ${cfg.miniComboTarget}`, target: cfg.miniComboTarget, prog: 0, done:false },
      { id:'M2', label:`เก็บโบนัสให้ครบ ${cfg.miniBonusTarget} (⭐/💎/🛡️)`, target: cfg.miniBonusTarget, prog: 0, done:false },
      { id:'M3', label:`ยิงติดกัน (ไม่พลาด) ${cfg.miniPerfectStreak} ครั้ง`, target: cfg.miniPerfectStreak, prog: 0, done:false }
    ]
  };
}

function pickActiveGoalMini(qs) {
  // goal: show first not done, else null
  const goal = qs.goals.find(g => !g.done) || null;
  // mini: show first not done, else null
  const mini = qs.minis.find(m => !m.done) || null;
  return { goal, mini };
}

function emitQuestUpdate(qs) {
  const { goal, mini } = pickActiveGoalMini(qs);

  dispatch('quest:update', {
    goal: goal ? { label: goal.label, prog: goal.prog, target: goal.target } : null,
    mini: mini ? { label: mini.label, prog: mini.prog, target: mini.target } : null,
    hint: goal && goal.hint ? goal.hint : '',
    goalsAll: qs.goals.map(g => ({ id:g.id, done:!!g.done })),
    minisAll: qs.minis.map(m => ({ id:m.id, done:!!m.done }))
  });
}

function updateQuestOnHit(qs, cfg, kind, comboNow) {
  if (!qs) return;

  // counters
  if (kind === 'good') qs.goodHit++;
  if (kind === 'junk') qs.junkHit++;
  if (kind === 'star' || kind === 'diamond' || kind === 'shield') qs.bonusHit++;

  qs.comboBest = Math.max(qs.comboBest, comboNow);

  // perfect streak counts ONLY when hit non-junk
  if (kind === 'junk') qs.perfectStreak = 0;
  else qs.perfectStreak++;

  // --- Goal 1: goodHit
  const g1 = qs.goals[0];
  g1.prog = qs.goodHit;
  if (!g1.done && g1.prog >= g1.target) g1.done = true;

  // --- Goal 2: keep junkHit <= junkLimit (prog shows junkHit)
  const g2 = qs.goals[1];
  g2.prog = qs.junkHit;
  if (!g2.done && g2.prog <= g2.target) {
    // only mark done at end, but we can mark as "still pass" dynamically by not done
    // We'll mark done at end only if still within limit.
  }
  // minis
  const m1 = qs.minis[0];
  m1.prog = qs.comboBest;
  if (!m1.done && m1.prog >= m1.target) m1.done = true;

  const m2 = qs.minis[1];
  m2.prog = qs.bonusHit;
  if (!m2.done && m2.prog >= m2.target) m2.done = true;

  const m3 = qs.minis[2];
  m3.prog = qs.perfectStreak;
  if (!m3.done && m3.prog >= m3.target) m3.done = true;

  emitQuestUpdate(qs);
}

function finalizeQuestAtEnd(qs, cfg) {
  if (!qs) return { goalsCleared:0, goalsTotal:0, miniCleared:0, miniTotal:0 };

  // finalize goal 2 pass/fail at end
  const g2 = qs.goals[1];
  if (!g2.done && qs.junkHit <= cfg.junkLimit) g2.done = true;

  const goalsTotal = qs.goals.length;
  const miniTotal  = qs.minis.length;
  const goalsCleared = qs.goals.filter(g => g.done).length;
  const miniCleared  = qs.minis.filter(m => m.done).length;

  emitQuestUpdate(qs);

  return { goalsCleared, goalsTotal, miniCleared, miniTotal };
}

// ---------- Main Engine ----------
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

  // quest
  let qs = null;

  function resetStats() {
    score = 0;
    combo = 0;
    comboMax = 0;
    misses = 0;

    dispatch('hha:score', { score, combo, misses });
    dispatch('hha:judge', { label: '' });

    // init quest state + first update
    qs = makeQuestState(cfg);
    emitQuestUpdate(qs);
  }

  function setJudge(label) {
    dispatch('hha:judge', { label: String(label || '') });
  }

  function emitScore() {
    dispatch('hha:score', { score, combo, misses });
  }

  function addScore(delta, label) {
    score = (score + (delta | 0)) | 0;
    emitScore();
    if (label) setJudge(label);
  }

  function setCombo(c) {
    combo = c | 0;
    comboMax = Math.max(comboMax, combo);
    emitScore();
  }

  function addMiss(label) {
    misses = (misses + 1) | 0;
    emitScore();
    dispatch('hha:miss', { misses });
    setCombo(0);
    if (label) setJudge(label);

    // break perfect streak in quest
    if (qs) {
      qs.perfectStreak = 0;
      // update quest UI (mini M3)
      const m3 = qs.minis[2];
      if (m3 && !m3.done) {
        m3.prog = 0;
        emitQuestUpdate(qs);
      }
    }
  }

  function kindRoll() {
    const p = Math.random();

    // bonus sometimes
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

  function clearAllTargets() {
    active.forEach(t => {
      try { t.parentNode && t.parentNode.removeChild(t); } catch(_) {}
    });
    active.clear();
  }

  function removeTarget(t) {
    if (!t) return;
    if (!active.has(t)) return;

    active.delete(t);

    const removeNow = () => {
      try { t.parentNode && t.parentNode.removeChild(t); } catch(_) {}
    };
    popOutAndRemove(t, removeNow);
  }

  function spawnOne() {
    if (!running) return;
    if (active.size >= (cfg.maxActive | 0)) return;

    const t = makeTargetEntity();
    t.dataset.kind = kindRoll();

    // position ALWAYS in camera view
    const pos = spawnPoseInFrontOfCamera(cam);
    t.setAttribute('position', `${pos.x} ${pos.y} ${pos.z}`);

    // scale per diff
    const s = cfg.scale || 1.10;
    t.object3D.scale.set(s, s, s);

    // face camera
    faceCamera(t, cam);

    // apply emoji texture
    applyEmojiToTarget(t, emojiFor(t.dataset.kind));

    // click handler
    const onHit = (ev) => {
      ev && ev.stopPropagation && ev.stopPropagation();
      if (!active.has(t)) return;

      const kind = String(t.dataset.kind || '');

      // FX
      const P = getParticles();
      if (P && P.burstAt) {
        P.burstAt(window.innerWidth / 2, window.innerHeight * 0.34, {
          count: 16,
          good: (kind !== 'junk')
        });
      }
      if (P && P.scorePop) {
        P.scorePop(window.innerWidth / 2, window.innerHeight * 0.32,
          (kind === 'junk' ? 'OOPS!' : 'NICE!'),
          { judgment: kind.toUpperCase(), good: (kind !== 'junk') }
        );
      }

      if (kind === 'junk') {
        // hit junk = miss
        addMiss('MISS');
        // quest update (counts junkHit)
        if (qs) updateQuestOnHit(qs, cfg, kind, combo);
      } else {
        // score rules
        let gain = 50;
        if (kind === 'good') gain = 60;
        if (kind === 'star') gain = 120;
        if (kind === 'diamond') gain = 150;
        if (kind === 'shield') gain = 90;

        setCombo(combo + 1);

        // judge label
        const j = (combo >= 8) ? 'PERFECT' : 'GOOD';
        addScore(gain, j);

        // quest update (counts good/bonus + combo/streak)
        if (qs) updateQuestOnHit(qs, cfg, kind, combo);
      }

      removeTarget(t);
    };

    t.addEventListener('click', onHit);

    // life timer (ttl)
    const born = performance.now();
    const ttl = cfg.ttlMs | 0;

    t.__gj = { born, ttl, onHit };

    layer.appendChild(t);
    active.add(t);

    popIn(t);

    // timeout rule (FIX: count miss ONLY if GOOD target times out)
    setTimeout(() => {
      if (!running) return;
      if (!active.has(t)) return;

      const kind = String(t.dataset.kind || '');
      // only punish if good/bonus timed out (player "missed chance")
      if (kind !== 'junk') {
        addMiss('MISS');
      }
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

  function waitSceneReady(cb) {
    // mobile sometimes: scene exists but not loaded yet
    const s = ensureScene();
    if (s.hasLoaded) return cb();
    s.addEventListener('loaded', () => cb(), { once: true });
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

    waitSceneReady(() => {
      running = true;
      resetStats();

      // spawn immediately so user sees it right away
      spawnOne();
      spawnOne();

      loopSpawn();
      console.log('[GoodJunkVR] started diff=', diff, cfg);
    });
  }

  function stop(reason) {
    if (!running) return;
    running = false;

    clearInterval(spawnTimer);
    spawnTimer = null;

    // finalize quest
    const qsum = finalizeQuestAtEnd(qs, cfg);

    dispatch('hha:end', {
      reason: String(reason || 'stop'),
      scoreFinal: score,
      comboMax: comboMax,
      misses: misses,
      goalsCleared: qsum.goalsCleared,
      goalsTotal:   qsum.goalsTotal,
      miniCleared:  qsum.miniCleared,
      miniTotal:    qsum.miniTotal
    });

    clearAllTargets();

    console.log('[GoodJunkVR] stopped reason=', reason);
  }

  return { start, stop };
})();
