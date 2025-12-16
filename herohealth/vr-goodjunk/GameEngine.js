// === /herohealth/vr-goodjunk/GameEngine.js ===
// Good vs Junk VR — Production-safe (emoji targets) + Quest progress
// FIX v3 (โผล่ชัวร์):
// 1) สร้าง layer เป้าเป็น "ลูกของกล้อง" (local space) => เป้าอยู่ตรงหน้ากล้องเสมอ
// 2) รอ a-scene loaded ก่อนเริ่ม spawn
// 3) ทำเป้าเป็น plane+ring “แบนๆ” แบบที่ต้องการ + emoji คืนมา
//
// dispatch: hha:score, hha:miss, hha:judge, hha:end, hha:life, quest:update

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
  if (d === 'easy') return { spawnMs: 980, ttlMs: 1750, maxActive: 4, scale: 1.18, goodRatio: 0.72, bonusRatio: 0.10, missPerHeart: 3 };
  if (d === 'hard') return { spawnMs: 680, ttlMs: 1200, maxActive: 5, scale: 1.05, goodRatio: 0.60, bonusRatio: 0.12, missPerHeart: 3 };
  return { spawnMs: 820, ttlMs: 1450, maxActive: 5, scale: 1.12, goodRatio: 0.66, bonusRatio: 0.11, missPerHeart: 3 };
}

// ---------- Ensure refs ----------
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

// layer “ติดกับกล้อง” (local space)
function ensureLayerOnCamera(camEl) {
  let layer = camEl.querySelector('#gj-target-layer');
  if (!layer) {
    layer = document.createElement('a-entity');
    layer.id = 'gj-target-layer';
    // ยก layer ออกมานิดนึงกันชนกับ cursor
    layer.setAttribute('position', '0 0 0');
    camEl.appendChild(layer);
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

function kindColors(kind) {
  const k = String(kind || '').toLowerCase();
  if (k === 'good') return { rim: '#22c55e', glow: '#22c55e' };
  if (k === 'junk') return { rim: '#f97316', glow: '#f97316' };
  if (k === 'star') return { rim: '#facc15', glow: '#facc15' };
  if (k === 'diamond') return { rim: '#38bdf8', glow: '#38bdf8' };
  if (k === 'shield') return { rim: '#60a5fa', glow: '#60a5fa' };
  return { rim: '#e5e7eb', glow: '#94a3b8' };
}

function setPlaneEmoji(planeEl, emoji) {
  if (!planeEl) return;
  const url = emojiDataURL(emoji, 256);
  planeEl.setAttribute('material', `shader: flat; transparent: true; opacity: 1; side: double; src: ${url}`);
}

// ---------- Target entity (แบนๆ + emoji) ----------
function makeTargetEntity() {
  const root = document.createElement('a-entity');
  root.className = 'gj-target';
  root.setAttribute('data-hha-tgt', '1');

  // collider (สำคัญมาก ให้ raycaster เจอ)
  root.setAttribute('geometry', 'primitive: circle; radius: 0.30');
  root.setAttribute('material', 'shader: flat; opacity: 0; transparent: true; side: double');

  // ring
  const rim = document.createElement('a-entity');
  rim.className = 'gj-rim';
  rim.setAttribute('geometry', 'primitive: ring; radiusInner: 0.32; radiusOuter: 0.36');
  rim.setAttribute('material', 'shader: flat; color: #ffffff; opacity: 0.22; transparent: true; side: double');
  rim.setAttribute('position', '0 0 0.01');
  root.appendChild(rim);

  // glow plane
  const glow = document.createElement('a-plane');
  glow.className = 'gj-glow';
  glow.setAttribute('width', '0.90');
  glow.setAttribute('height', '0.90');
  glow.setAttribute('position', '0 0 0.005');
  glow.setAttribute('material', 'shader: flat; color: #22c55e; opacity: 0.10; transparent: true; side: double');
  root.appendChild(glow);

  // emoji plane
  const face = document.createElement('a-plane');
  face.className = 'gj-emoji-plane';
  face.setAttribute('width', '0.66');
  face.setAttribute('height', '0.66');
  face.setAttribute('position', '0 0 0.02');
  face.setAttribute('material', 'shader: flat; transparent: true; opacity: 1; side: double');
  root.appendChild(face);

  // pop in/out animation (A-Frame animation component exists by default)
  root.setAttribute('scale', '0.001 0.001 0.001');
  root.setAttribute('animation__in', 'property: scale; dur: 160; easing: easeOutCubic; to: 1 1 1');

  return root;
}

function popOutAndRemove(el, removeFn) {
  if (!el) { removeFn && removeFn(); return; }
  try {
    el.setAttribute('animation__out', 'property: scale; dur: 130; easing: easeInCubic; to: 0.001 0.001 0.001');
    setTimeout(() => removeFn && removeFn(), 140);
  } catch (_) {
    removeFn && removeFn();
  }
}

export const GameEngine = (function () {
  let scene, cam, layer;
  let running = false;

  let cfg = diffCfg('normal');
  let diff = 'normal';

  let spawnTimer = null;
  let secTimer = null;
  const active = new Set();

  // stats
  let score = 0, combo = 0, comboMax = 0, misses = 0;
  const HEARTS_MAX = 3;
  let heartsLeft = HEARTS_MAX;

  // quest stats
  let goodHits = 0, junkHits = 0, starHits = 0, diamondHits = 0, shieldHits = 0;
  let miniIndex = 0, minisClearedCount = 0, noMissSec = 0;

  function setJudge(label) { dispatch('hha:judge', { label: String(label || '') }); }
  function emitScore() { dispatch('hha:score', { score, combo, misses }); }

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

  function addMiss() {
    misses = (misses + 1) | 0;
    emitScore();
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

  // ===== Quest definitions =====
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
    const minisAll = [
      ...Array.from({ length: minisClearedCount }).map((_, i) => ({ key: 'M' + (i + 1), label: 'ผ่านแล้ว', prog: 1, target: 1, done: true })),
      { key: 'M_NOW', label: m.label, prog: mProg, target: m.target, done: (mProg >= m.target) }
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

  // ✅ spawn แบบ local space ของกล้อง => โผล่แน่นอน
  function spawnOne() {
    if (!running) return;
    if (active.size >= (cfg.maxActive | 0)) return;

    const t = makeTargetEntity();
    const kind = kindRoll();
    t.dataset.kind = kind;

    // สีตามชนิด
    const col = kindColors(kind);
    const rim = t.querySelector('.gj-rim');
    const glow = t.querySelector('.gj-glow');
    if (rim) rim.setAttribute('material', `shader: flat; color: ${col.rim}; opacity: 0.24; transparent: true; side: double`);
    if (glow) glow.setAttribute('material', `shader: flat; color: ${col.glow}; opacity: 0.12; transparent: true; side: double`);

    // emoji คืนมา
    const plane = t.querySelector('.gj-emoji-plane');
    setPlaneEmoji(plane, emojiFor(kind));

    // scale ตาม diff
    const s = cfg.scale || 1.12;
    t.setAttribute('scale', `${s} ${s} ${s}`);

    // ตำแหน่ง “หน้ากล้อง” (local)
    const z = -r(1.8, 2.8);
    const x = r(-0.65, 0.65);
    const y = r(-0.15, 0.55);
    t.setAttribute('position', `${x} ${y} ${z}`);

    // click handler
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

    // add
    layer.appendChild(t);
    active.add(t);

    // ttl: หมดเวลา => นับ miss เฉพาะ "good/bonus" (ของขยะปล่อยผ่าน)
    const ttl = cfg.ttlMs | 0;
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
      try { spawnOne(); } catch (err) { console.warn('[GoodJunkVR] spawn error:', err); }
    }, cfg.spawnMs | 0);
  }

  function clearAllTargets() {
    active.forEach(t => { try { t.parentNode && t.parentNode.removeChild(t); } catch (_) {} });
    active.clear();
  }

  function resetStats() {
    score = 0; combo = 0; comboMax = 0; misses = 0;
    heartsLeft = HEARTS_MAX;
    goodHits = junkHits = starHits = diamondHits = shieldHits = 0;
    miniIndex = 0; minisClearedCount = 0; noMissSec = 0;

    emitScore();
    setJudge('');
    dispatch('hha:life', { diff, heartsLeft, heartsMax: HEARTS_MAX, perHeart: cfg.missPerHeart });
    emitQuestUpdate();
  }

  function startWhenReady(diffKey) {
    scene = ensureScene();
    cam = ensureCam();

    const begin = () => {
      layer = ensureLayerOnCamera(cam);

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

      // spawn ทันทีให้เห็นแน่
      spawnOne();
      spawnOne();
      loopSpawn();

      console.log('[GoodJunkVR] started (camera-local layer) diff=', diff, cfg);
    };

    // ✅ รอ scene loaded
    if (scene.hasLoaded) begin();
    else scene.addEventListener('loaded', begin, { once: true });
  }

  function start(diffKey) {
    try {
      startWhenReady(diffKey);
    } catch (err) {
      console.error('[GoodJunkVR] start failed:', err);
    }
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