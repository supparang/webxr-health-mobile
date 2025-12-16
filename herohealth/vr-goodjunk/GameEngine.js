// === /herohealth/vr-goodjunk/GameEngine.js ===
// Good vs Junk VR — FIX v5.1 (stable build)
// ✅ แก้ไฟล์ขาดท้าย / SyntaxError
// ✅ Spawn หน้าเลนส์ตามทิศกล้องจริง
// ✅ Goal + Mini quest ส่ง quest:update
// ✅ timeout ลงโทษเฉพาะ good/bonus (junk หลุดไม่ลงโทษ)
// ✅ ส่ง hha:hover enter/leave เพื่อ reticle progress ทำงานชัวร์

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
      scale: 1.18, goodRatio: 0.72, bonusRatio: 0.11,
      goalGoodTarget: 14, junkLimit: 4,
      miniComboTarget: 6, miniBonusTarget: 2, miniPerfectStreak: 5
    };
  }
  if (d === 'hard') {
    return {
      spawnMs: 650, ttlMs: 1150, maxActive: 5,
      scale: 1.03, goodRatio: 0.60, bonusRatio: 0.13,
      goalGoodTarget: 16, junkLimit: 3,
      miniComboTarget: 8, miniBonusTarget: 3, miniPerfectStreak: 7
    };
  }
  return {
    spawnMs: 780, ttlMs: 1400, maxActive: 5,
    scale: 1.10, goodRatio: 0.66, bonusRatio: 0.12,
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
    layer.setAttribute('position', '0 0 0');
    scene.appendChild(layer);
  }
  return layer;
}

// ---------- spawn pose in camera view ----------
function spawnPoseInFrontOfCamera(camEl) {
  const THREE = ROOT.THREE || (ROOT.AFRAME && ROOT.AFRAME.THREE) || null;
  if (!THREE || !camEl || !camEl.object3D) {
    return { x: r(-1.1, 1.1), y: r(1.0, 2.1), z: -r(2.8, 4.0) };
  }
  const camObj = camEl.object3D;
  const camPos = new THREE.Vector3();
  camObj.getWorldPosition(camPos);

  const dir = new THREE.Vector3();
  camObj.getWorldDirection(dir);
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
  const THREE = ROOT.THREE || (ROOT.AFRAME && ROOT.AFRAME.THREE) || null;
  if (!THREE || !targetEl || !camEl) return;
  try {
    const camPos = new THREE.Vector3();
    camEl.object3D.getWorldPosition(camPos);
    targetEl.object3D.lookAt(camPos);
  } catch (_) {}
}

// ---------- target factory ----------
function makeTargetEntity() {
  const root = document.createElement('a-entity');
  root.className = 'gj-target';
  root.setAttribute('data-hha-tgt', '1');

  // collider invisible
  root.setAttribute('geometry', 'primitive: circle; radius: 0.28');
  root.setAttribute('material', 'shader: flat; opacity: 0; transparent: true; side: double');

  // base plane (almost invisible) กัน “แผ่นขาว”
  const face = document.createElement('a-plane');
  face.className = 'gj-face';
  face.setAttribute('width', '0.85');
  face.setAttribute('height', '0.85');
  face.setAttribute('position', '0 0 0.015');
  face.setAttribute('material', 'shader: flat; transparent: true; opacity: 0.001; side: double; color: #ffffff');
  root.appendChild(face);

  // NOTE: a-text emoji อาจไม่แสดงบนบางเครื่องถ้าฟอนต์ไม่รองรับ
  // (ถ้าคุณเจอ “ไม่เห็น emoji” บอกฉัน เดี๋ยวทำเวอร์ชัน canvas-texture ที่ชัวร์ 100%)
  const txt = document.createElement('a-entity');
  txt.className = 'gj-emoji';
  txt.setAttribute('text', [
    'value: 🥦',
    'align: center',
    'baseline: center',
    'color: #ffffff',
    'width: 4',
    'wrapCount: 1'
  ].join('; '));
  txt.setAttribute('position', '0 0 0.03');
  root.appendChild(txt);

  const ring = document.createElement('a-entity');
  ring.className = 'gj-ring';
  ring.setAttribute('geometry', 'primitive: ring; radiusInner: 0.32; radiusOuter: 0.36');
  ring.setAttribute('material', 'shader: flat; opacity: 0.18; transparent: true; color: #ffffff');
  ring.setAttribute('position', '0 0 0.01');
  root.appendChild(ring);

  return root;
}

// ---------- animations ----------
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

// ---------- Quest system ----------
function makeQuestState(cfg) {
  return {
    goodHit: 0, junkHit: 0, bonusHit: 0,
    comboBest: 0, perfectStreak: 0,
    goals: [
      { id:'G1', label:`เก็บอาหารดีให้ครบ ${cfg.goalGoodTarget} ชิ้น`, target: cfg.goalGoodTarget, prog: 0, done:false, hint:'โฟกัสผัก ผลไม้ นม 🥦🍎🥛' },
      { id:'G2', label:`อย่าเก็บของขยะเกิน ${cfg.junkLimit} ครั้ง`, target: cfg.junkLimit, prog: 0, done:false, hint:'เลี่ยง 🍟🍔🍕' }
    ],
    minis: [
      { id:'M1', label:`ทำคอมโบให้ถึง ${cfg.miniComboTarget}`, target: cfg.miniComboTarget, prog: 0, done:false },
      { id:'M2', label:`เก็บโบนัสให้ครบ ${cfg.miniBonusTarget} (⭐/💎/🛡️)`, target: cfg.miniBonusTarget, prog: 0, done:false },
      { id:'M3', label:`ยิงติดกัน (ไม่พลาด) ${cfg.miniPerfectStreak} ครั้ง`, target: cfg.miniPerfectStreak, prog: 0, done:false }
    ]
  };
}
function pickActiveGoalMini(qs) {
  const goal = qs.goals.find(g => !g.done) || null;
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

  if (kind === 'good') qs.goodHit++;
  if (kind === 'junk') qs.junkHit++;
  if (kind === 'star' || kind === 'diamond' || kind === 'shield') qs.bonusHit++;

  qs.comboBest = Math.max(qs.comboBest, comboNow);

  if (kind === 'junk') qs.perfectStreak = 0;
  else qs.perfectStreak++;

  const g1 = qs.goals[0];
  g1.prog = qs.goodHit;
  if (!g1.done && g1.prog >= g1.target) g1.done = true;

  const g2 = qs.goals[1];
  g2.prog = qs.junkHit;

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

  const g2 = qs.goals[1];
  if (!g2.done && qs.junkHit <= cfg.junkLimit) g2.done = true;

  const goalsTotal = qs.goals.length;
  const miniTotal  = qs.minis.length;
  const goalsCleared = qs.goals.filter(g => g.done).length;
  const miniCleared  = qs.minis.filter(m => m.done).length;

  emitQuestUpdate(qs);
  return { goalsCleared, goalsTotal, miniCleared, miniTotal };
}

// ---------- Engine ----------
export const GameEngine = (function () {
  let scene, cam, layer;
  let running = false;

  let cfg = diffCfg('normal');
  let diff = 'normal';

  let spawnTimer = null;
  let active = new Set();

  let score = 0;
  let combo = 0;
  let comboMax = 0;
  let misses = 0;

  let qs = null;

  function emitScore() { dispatch('hha:score', { score, combo, misses }); }
  function setJudge(label) { dispatch('hha:judge', { label: String(label || '') }); }

  function resetStats() {
    score = 0; combo = 0; comboMax = 0; misses = 0;
    emitScore();
    setJudge('');
    qs = makeQuestState(cfg);
    emitQuestUpdate(qs);
  }

  function setCombo(c) {
    combo = c | 0;
    comboMax = Math.max(comboMax, combo);
    emitScore();
  }

  function addScore(delta, label) {
    score = (score + (delta | 0)) | 0;
    emitScore();
    if (label) setJudge(label);
  }

  function addMiss(label) {
    misses = (misses + 1) | 0;
    emitScore();
    dispatch('hha:miss', { misses });
    setCombo(0);
    if (label) setJudge(label);

    if (qs) {
      qs.perfectStreak = 0;
      const m3 = qs.minis[2];
      if (m3 && !m3.done) { m3.prog = 0; emitQuestUpdate(qs); }
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
    if (!t || !active.has(t)) return;
    active.delete(t);
    const removeNow = () => { try { t.parentNode && t.parentNode.removeChild(t); } catch(_) {} };
    popOutAndRemove(t, removeNow);
  }

  function spawnOne() {
    if (!running) return;
    if (active.size >= (cfg.maxActive | 0)) return;

    const t = makeTargetEntity();
    t.dataset.kind = kindRoll();

    const e = t.querySelector('.gj-emoji');
    if (e) {
      e.setAttribute('text', [
        `value: ${emojiFor(t.dataset.kind)}`,
        'align: center',
        'baseline: center',
        'color: #ffffff',
        'width: 4',
        'wrapCount: 1'
      ].join('; '));
    }

    const pos = spawnPoseInFrontOfCamera(cam);
    t.setAttribute('position', `${pos.x} ${pos.y} ${pos.z}`);

    const s = cfg.scale || 1.10;
    t.object3D.scale.set(s, s, s);

    faceCamera(t, cam);

    // hover events -> reticle
    t.addEventListener('mouseenter', () => dispatch('hha:hover', { state:'enter', kind: String(t.dataset.kind || '') }));
    t.addEventListener('mouseleave', () => dispatch('hha:hover', { state:'leave', kind: String(t.dataset.kind || '') }));

    const onHit = (ev) => {
      ev && ev.stopPropagation && ev.stopPropagation();
      if (!active.has(t)) return;

      const kind = String(t.dataset.kind || '');
      const P = getParticles();
      const ok = (kind !== 'junk');

      if (P && P.burstAt) P.burstAt(window.innerWidth / 2, window.innerHeight * 0.34, { count: 16, good: ok });
      if (P && P.scorePop) P.scorePop(window.innerWidth / 2, window.innerHeight * 0.32, (ok ? 'NICE!' : 'OOPS!'), { judgment: kind.toUpperCase(), good: ok });

      if (kind === 'junk') {
        addMiss('MISS');
        if (qs) updateQuestOnHit(qs, cfg, kind, combo);
      } else {
        let gain = 50;
        if (kind === 'good') gain = 60;
        if (kind === 'star') gain = 120;
        if (kind === 'diamond') gain = 150;
        if (kind === 'shield') gain = 90;

        setCombo(combo + 1);
        addScore(gain, (combo >= 8 ? 'PERFECT' : 'GOOD'));
        if (qs) updateQuestOnHit(qs, cfg, kind, combo);
      }

      removeTarget(t);
    };

    t.addEventListener('click', onHit);

    const ttl = cfg.ttlMs | 0;
    layer.appendChild(t);
    active.add(t);
    popIn(t);

    setTimeout(() => {
      if (!running) return;
      if (!active.has(t)) return;

      const kind = String(t.dataset.kind || '');
      if (kind !== 'junk') addMiss('MISS'); // ลงโทษเฉพาะ good/bonus
      removeTarget(t);
    }, ttl);
  }

  function loopSpawn() {
    clearInterval(spawnTimer);
    spawnTimer = setInterval(() => {
      try { spawnOne(); } catch (err) { console.warn('[GoodJunkVR] spawn error:', err); }
    }, cfg.spawnMs | 0);
  }

  function waitSceneReady(cb) {
    const s = ensureScene();
    if (s.hasLoaded) return cb();
    s.addEventListener('loaded', () => cb(), { once: true });
  }

  function clearAllTargets() {
    active.forEach(t => { try { t.parentNode && t.parentNode.removeChild(t); } catch(_) {} });
    active.clear();
  }

  function start(diffKey) {
    if (running) stop('restart');

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

      // โผล่ทันที
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

    // ✅ ล้างเป้าให้หมด
    clearAllTargets();
  }

  function isRunning(){ return !!running; }

  return { start, stop, isRunning };
})();
