// === /herohealth/vr-goodjunk/GameEngine.js ===
// Good vs Junk VR — Production-safe spawn engine (emoji targets + Goal/MiniQuest progress)
// FIX v2: spawn “in front of camera” using camera local vectors (works on mobile touch-look + VR gaze)

'use strict';

const ROOT = (typeof window !== 'undefined' ? window : globalThis);

function clamp(v, a, b) { v = +v || 0; return Math.max(a, Math.min(b, v)); }
function r(min, max) { return min + Math.random() * (max - min); }
function dispatch(name, detail) { ROOT.dispatchEvent(new CustomEvent(name, { detail: detail || {} })); }

function getParticles() {
  const gm = ROOT.GAME_MODULES || {};
  return gm.Particles || ROOT.Particles || null;
}

const EMOJI = {
  good:    ['🥦','🍎','🥛','🥗','🍌','🥕','🍇','🍊'],
  junk:    ['🍟','🍔','🍕','🍩','🍿','🧋','🥤','🍪'],
  star:    ['⭐'],
  diamond: ['💎'],
  shield:  ['🛡️']
};
function pick(arr) { return arr[(Math.random() * arr.length) | 0]; }

function diffCfg(diffKey) {
  const d = String(diffKey || 'normal').toLowerCase();
  if (d === 'easy') return { spawnMs: 980, ttlMs: 1750, maxActive: 4, scale: 1.25, goodRatio: 0.72, bonusRatio: 0.10, missPerHeart: 3 };
  if (d === 'hard') return { spawnMs: 680, ttlMs: 1200, maxActive: 5, scale: 1.05, goodRatio: 0.60, bonusRatio: 0.12, missPerHeart: 3 };
  return { spawnMs: 820, ttlMs: 1450, maxActive: 5, scale: 1.15, goodRatio: 0.66, bonusRatio: 0.11, missPerHeart: 3 };
}

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

// ---------- Emoji texture (canvas -> dataURL) ----------
const EMOJI_TEX_CACHE = new Map();

function emojiDataURL(emoji, sizePx) {
  const key = `${emoji}__${sizePx}`;
  if (EMOJI_TEX_CACHE.has(key)) return EMOJI_TEX_CACHE.get(key);

  const s = sizePx || 256;
  const c = document.createElement('canvas');
  c.width = s; c.height = s;
  const ctx = c.getContext('2d');

  ctx.clearRect(0, 0, s, s);
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.45)';
  ctx.shadowBlur = Math.round(s * 0.08);
  ctx.shadowOffsetY = Math.round(s * 0.03);

  ctx.font = `${Math.floor(s * 0.78)}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",system-ui`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(emoji || '❓'), s / 2, s / 2 + Math.round(s * 0.02));
  ctx.restore();

  const url = c.toDataURL('image/png');
  EMOJI_TEX_CACHE.set(key, url);
  return url;
}

function setPlaneEmoji(planeEl, emoji) {
  if (!planeEl) return;
  const url = emojiDataURL(emoji, 256);
  planeEl.setAttribute('material', `shader: flat; transparent: true; opacity: 1; side: double; src: ${url}`);
}

function kindColors(kind) {
  const k = String(kind || '').toLowerCase();
  if (k === 'good') return { rim: '#22c55e', glow: '#22c55e' };
  if (k === 'junk') return { rim: '#f97316', glow: '#f97316' };
  if (k === 'star') return { rim: '#facc15', glow: '#facc15' };
  if (k === 'diamond') return { rim: '#38bdf8', glow: '#38bdf8' };
  if (k === 'shield') return { rim: '#60a5fa', glow: '#60a5fa' };
  return { rim: '#e5e7eb', glow: '#94a3b8' };
}

// root = collider + placement only; visual child can bob
function makeTargetEntity() {
  const root = document.createElement('a-entity');
  root.className = 'gj-target';
  root.setAttribute('data-hha-tgt', '1');
  root.setAttribute('geometry', 'primitive: circle; radius: 0.30');
  root.setAttribute('material', 'shader: flat; opacity: 0; transparent: true; side: double');

  const vis = document.createElement('a-entity');
  vis.className = 'gj-vis';
  vis.setAttribute('position', '0 0 0');
  vis.setAttribute('animation__bob', 'property: position; dir: alternate; dur: 650; loop: true; easing: easeInOutSine; from: 0 0 0; to: 0 0.05 0');
  root.appendChild(vis);

  const base = document.createElement('a-cylinder');
  base.setAttribute('radius', '0.34');
  base.setAttribute('height', '0.055');
  base.setAttribute('position', '0 0 -0.02');
  base.setAttribute('rotation', '90 0 0');
  base.setAttribute('material', 'shader: standard; color: #0b1220; roughness: 0.82; metalness: 0.05; opacity: 0.94; transparent: true');
  vis.appendChild(base);

  const rim = document.createElement('a-torus');
  rim.className = 'gj-rim';
  rim.setAttribute('radius', '0.35');
  rim.setAttribute('radius-tubular', '0.012');
  rim.setAttribute('rotation', '90 0 0');
  rim.setAttribute('position', '0 0 -0.01');
  rim.setAttribute('material', 'shader: standard; color: #ffffff; emissive: #22c55e; emissiveIntensity: 0.62; opacity: 0.42; transparent: true');
  vis.appendChild(rim);

  const glow = document.createElement('a-plane');
  glow.className = 'gj-glow';
  glow.setAttribute('width', '0.88');
  glow.setAttribute('height', '0.88');
  glow.setAttribute('position', '0 0 0.02');
  glow.setAttribute('material', 'shader: flat; color: #22c55e; opacity: 0.10; transparent: true; side: double');
  vis.appendChild(glow);

  const face = document.createElement('a-plane');
  face.className = 'gj-emoji-plane';
  face.setAttribute('width', '0.66');
  face.setAttribute('height', '0.66');
  face.setAttribute('position', '0 0 0.035');
  face.setAttribute('material', 'shader: flat; transparent: true; opacity: 1; side: double');
  vis.appendChild(face);

  return root;
}

function popIn(el) {
  if (!el || !el.object3D) return;
  el.object3D.scale.set(0.001, 0.001, 0.001);
  const t0 = performance.now();
  const dur = 160;
  function step() {
    const p = clamp((performance.now() - t0) / dur, 0, 1);
    const s = 0.25 + 0.75 * (1 - Math.pow(1 - p, 3));
    el.object3D.scale.set(s, s, s);
    if (p < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}
function popOutAndRemove(el, removeFn) {
  if (!el || !el.object3D) { removeFn && removeFn(); return; }
  const t0 = performance.now();
  const dur = 130;
  const s0 = el.object3D.scale.x || 1;
  function step() {
    const p = clamp((performance.now() - t0) / dur, 0, 1);
    const s = Math.max(0.001, s0 * (1 - p));
    el.object3D.scale.set(s, s, s);
    if (p < 1) requestAnimationFrame(step);
    else removeFn && removeFn();
  }
  requestAnimationFrame(step);
}

export const GameEngine = (function () {
  let scene, cam, layer;
  let running = false;

  let cfg = diffCfg('normal');
  let diff = 'normal';

  let spawnTimer = null;
  let secTimer = null;
  let active = new Set();

  // stats
  let score = 0;
  let combo = 0;
  let comboMax = 0;
  let misses = 0;

  // hearts
  const HEARTS_MAX = 3;
  let heartsLeft = HEARTS_MAX;

  // quest counters
  let goodHits = 0, junkHits = 0, starHits = 0, diamondHits = 0, shieldHits = 0;
  let miniIndex = 0, minisClearedCount = 0, noMissSec = 0;

  function setJudge(label) { dispatch('hha:judge', { label: String(label || '') }); }
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

    noMissSec = 0;
    emitQuestUpdate();

    if (diff === 'hard') {
      const lost = Math.floor(misses / (cfg.missPerHeart || 3));
      heartsLeft = Math.max(0, HEARTS_MAX - lost);
      dispatch('hha:life', { diff, heartsLeft, heartsMax: HEARTS_MAX, perHeart: cfg.missPerHeart });
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

  // ===== Quest system =====
  function questTargetsByDiff() {
    if (diff === 'easy') return { goalGood: 10, goalMaxJunk: 3 };
    if (diff === 'hard') return { goalGood: 14, goalMaxJunk: 2 };
    return { goalGood: 12, goalMaxJunk: 3 };
  }
  function currentMiniDef() {
    const list = [
      { key: 'combo8',   label: 'ทำคอมโบให้ถึง 8',           target: 8,  get: () => comboMax },
      { key: 'good6',    label: 'เก็บของดี 6 ครั้ง',          target: 6,  get: () => goodHits },
      { key: 'nomiss10', label: 'ไม่พลาดต่อเนื่อง 10 วินาที', target: 10, get: () => noMissSec },
      { key: 'bonus2',   label: 'เก็บโบนัส ⭐/💎 รวม 2',        target: 2,  get: () => (starHits + diamondHits) },
      { key: 'shield1',  label: 'เก็บโล่ 🛡️ 1 ครั้ง',          target: 1,  get: () => shieldHits }
    ];
    return list[miniIndex % list.length];
  }
  function buildQuestPayload() {
    const T = questTargetsByDiff();
    const goalsAll = [
      { key: 'G1', label: `เก็บของดีให้ครบ ${T.goalGood} ครั้ง`, prog: goodHits, target: T.goalGood, done: goodHits >= T.goalGood },
      { key: 'G2', label: `พลาดของขยะไม่เกิน ${T.goalMaxJunk} ครั้ง`, prog: junkHits, target: T.goalMaxJunk, done: junkHits <= T.goalMaxJunk }
    ];
    const goalShow = goalsAll.find(g => !g.done) || null;

    const m = currentMiniDef();
    const mProg = m.get();
    const mDone = (mProg >= m.target);

    const minisAll = [
      ...Array.from({ length: minisClearedCount }).map((_, i) => ({ key: 'M' + (i + 1), label: 'ผ่านแล้ว', prog: 1, target: 1, done: true })),
      { key: 'M_NOW', label: m.label, prog: mProg, target: m.target, done: mDone }
    ];

    let hint = '';
    if (goalShow && goalShow.key === 'G1') hint = 'โฟกัสผัก/ผลไม้/นม 🥦🍎🥛';
    if (goalShow && goalShow.key === 'G2') hint = 'เลี่ยงของขยะ 🍟🍔🍩';

    return {
      goal: goalShow ? { label: goalShow.label, prog: goalShow.prog, target: goalShow.target } : null,
      mini: { label: m.label, prog: mProg, target: m.target },
      hint,
      goalsAll,
      minisAll
    };
  }
  function emitQuestUpdate() { dispatch('quest:update', buildQuestPayload()); }
  function checkMiniAdvance() {
    const m = currentMiniDef();
    if (m.get() >= m.target) {
      minisClearedCount++;
      miniIndex++;
      noMissSec = 0;
      emitQuestUpdate();
    }
  }

  function removeTarget(t) {
    if (!t || !active.has(t)) return;
    active.delete(t);
    const removeNow = () => { try { t.parentNode && t.parentNode.removeChild(t); } catch (_) {} };
    popOutAndRemove(t, removeNow);
  }

  // ✅ FIX: spawn in front of camera (camera local vectors)
  function spawnOne() {
    if (!running) return;
    if (active.size >= (cfg.maxActive | 0)) return;

    const THREE = ROOT.THREE;
    if (!THREE || !cam || !cam.object3D) {
      // fallback (should rarely happen)
      const z = -r(2.6, 4.3);
      const x = r(-1.15, 1.15);
      const y = r(0.95, 2.25);
      spawnAtWorld(x, y, z);
      return;
    }

    const dist = r(2.2, 3.6);        // ระยะหน้า
    const offX = r(-0.55, 0.55);     // ซ้าย-ขวา (แคบลงให้โผล่แน่นอน)
    const offY = r(-0.15, 0.55);     // สูง-ต่ำ (เน้นกลางจอ)

    const camPos = cam.object3D.getWorldPosition(new THREE.Vector3());
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.object3D.quaternion).normalize();
    const right   = new THREE.Vector3(1, 0, 0).applyQuaternion(cam.object3D.quaternion).normalize();
    const up      = new THREE.Vector3(0, 1, 0).applyQuaternion(cam.object3D.quaternion).normalize();

    const worldPos = camPos
      .clone()
      .add(forward.multiplyScalar(dist))
      .add(right.multiplyScalar(offX))
      .add(up.multiplyScalar(offY));

    spawnEntityAt(worldPos, camPos);
  }

  function spawnAtWorld(x, y, z) {
    const THREE = ROOT.THREE;
    const camPos = (THREE && cam && cam.object3D) ? cam.object3D.getWorldPosition(new THREE.Vector3()) : null;
    const worldPos = camPos ? new THREE.Vector3(x, y, z) : { x, y, z };
    spawnEntityAt(worldPos, camPos);
  }

  function spawnEntityAt(worldPos, camPosVec3) {
    const t = makeTargetEntity();
    const kind = kindRoll();
    t.dataset.kind = kind;

    const plane = t.querySelector('.gj-emoji-plane');
    setPlaneEmoji(plane, emojiFor(kind));

    const col = kindColors(kind);
    const rim = t.querySelector('.gj-rim');
    const glow = t.querySelector('.gj-glow');
    if (rim) rim.setAttribute('material', `shader: standard; color: #ffffff; emissive: ${col.rim}; emissiveIntensity: 0.62; opacity: 0.42; transparent: true`);
    if (glow) glow.setAttribute('material', `shader: flat; color: ${col.glow}; opacity: 0.10; transparent: true; side: double`);

    const s = cfg.scale || 1.15;
    t.object3D.scale.set(s, s, s);

    // A-Frame expects position in world coordinates (we place at computed worldPos)
    t.setAttribute('position', `${worldPos.x} ${worldPos.y} ${worldPos.z}`);

    // face camera
    try {
      const THREE = ROOT.THREE;
      if (THREE && camPosVec3) t.object3D.lookAt(camPosVec3);
    } catch (_) {}

    const onHit = (ev) => {
      ev && ev.stopPropagation && ev.stopPropagation();
      if (!active.has(t)) return;

      const k = String(t.dataset.kind || '');
      const P = getParticles();
      if (P && P.burstAt) P.burstAt(window.innerWidth / 2, window.innerHeight * 0.34, { count: 16, good: (k !== 'junk') });
      if (P && P.scorePop) P.scorePop(window.innerWidth / 2, window.innerHeight * 0.32, (k === 'junk' ? 'OOPS!' : 'NICE!'), { judgment: k.toUpperCase(), good: (k !== 'junk') });

      if (k === 'junk') {
        junkHits++;
        addMiss();
        setJudge('MISS');
      } else {
        if (k === 'good') goodHits++;
        if (k === 'star') starHits++;
        if (k === 'diamond') diamondHits++;
        if (k === 'shield') shieldHits++;

        let gain = 50;
        if (k === 'good') gain = 60;
        if (k === 'star') gain = 120;
        if (k === 'diamond') gain = 150;
        if (k === 'shield') gain = 90;

        setCombo(combo + 1);
        addScore(gain, (combo >= 8 ? 'PERFECT' : 'GOOD'));
      }

      emitQuestUpdate();
      checkMiniAdvance();
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

      const k = String(t.dataset.kind || '');
      if (k !== 'junk') {
        addMiss();
        setJudge('MISS');
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

  function clearAllTargets() {
    active.forEach(t => { try { t.parentNode && t.parentNode.removeChild(t); } catch (_) {} });
    active.clear();
  }

  function resetStats() {
    score = 0; combo = 0; comboMax = 0; misses = 0; heartsLeft = HEARTS_MAX;
    goodHits = junkHits = starHits = diamondHits = shieldHits = 0;
    miniIndex = 0; minisClearedCount = 0; noMissSec = 0;

    dispatch('hha:score', { score, combo, misses });
    dispatch('hha:judge', { label: '' });
    dispatch('hha:life', { diff, heartsLeft, heartsMax: HEARTS_MAX, perHeart: cfg.missPerHeart });
    emitQuestUpdate();
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

    clearInterval(secTimer);
    secTimer = setInterval(() => {
      if (!running) return;
      noMissSec++;
      emitQuestUpdate();
      checkMiniAdvance();
    }, 1000);

    spawnOne();
    spawnOne();
    loopSpawn();

    console.log('[GoodJunkVR] started diff=', diff, cfg);
  }

  function stop(reason) {
    if (!running) return;
    running = false;

    clearInterval(spawnTimer); spawnTimer = null;
    clearInterval(secTimer); secTimer = null;

    const q = buildQuestPayload();
    const goalsTotal = (q.goalsAll || []).length;
    const goalsCleared = (q.goalsAll || []).filter(g => g && g.done).length;
    const miniTotal = (q.minisAll || []).length;
    const miniCleared = (q.minisAll || []).filter(m => m && m.done).length;

    dispatch('hha:end', {
      reason: String(reason || 'stop'),
      scoreFinal: score,
      comboMax: comboMax,
      misses: misses,
      goalsCleared, goalsTotal,
      miniCleared, miniTotal
    });

    clearAllTargets();
    console.log('[GoodJunkVR] stopped reason=', reason);
  }

  return { start, stop };
})();