// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — PRODUCTION (JS-only)
// ✅ ใช้ global ./vr/hha-cloud-logger.js (ไม่มี inline logger)
// ✅ ส่ง intersection ให้ onHit() ใน click ของ cursor
// ✅ เป้าเป็น “emoji texture” บน plane (canvas → THREE.CanvasTexture) เพื่อให้แสดง emoji ได้จริงใน A-Frame
// ✅ เป้าอยู่ใน world space → หมุนจอ/หมุนกล้องแล้วเป้าจะ “เลื่อน” เหมือน VR จริง
// ✅ มี Plate Rush mini + warning ใกล้หมดเวลา (กระพริบ/ติ๊ก/สั่นเบา ๆ)
// ✅ เกรด SSS/SS/S/A/B/C แบบ real-time + ยิง hha:stat (goalsCleared/questsCleared/grade)

'use strict';

import { boot as factoryBoot } from '../vr/mode-factory.js';

// ---------- Root & Globals ----------
const ROOT = (typeof window !== 'undefined' ? window : globalThis);
const A = ROOT.AFRAME;

const Particles =
  (ROOT.GAME_MODULES && ROOT.GAME_MODULES.Particles) ||
  ROOT.Particles ||
  { scorePop () {}, burstAt () {}, judgeText () {}, celebrate () {} };

// ---------- Utils ----------
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rnd = (a, b) => a + Math.random() * (b - a);
const rndi = (a, b) => Math.floor(rnd(a, b + 1));
const pick = (arr) => arr[(Math.random() * arr.length) | 0];

function nowIso () { return new Date().toISOString(); }
function uid (prefix = 'p') {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

function safeJson (s, fallback = null) {
  try { return JSON.parse(s); } catch (_) { return fallback; }
}

function emit (name, detail) {
  try { ROOT.dispatchEvent(new CustomEvent(name, { detail })); } catch (_) {}
}

// ---------- HUB / Profile / Session common ----------
function readHubCommon () {
  const u = new URL(location.href);

  // URL params
  const p = Object.fromEntries(u.searchParams.entries());

  // sessionStorage profile (ถ้ามี)
  const prof = safeJson(sessionStorage.getItem('HHA_PROFILE') || '', {}) || {};
  const hub = safeJson(sessionStorage.getItem('HHA_HUB') || '', {}) || {};

  const studentId =
    p.studentId || p.student || prof.studentId || hub.studentId || sessionStorage.getItem('HHA_student_id') || '';

  const schoolId =
    p.schoolId || p.school || prof.schoolId || hub.schoolId || sessionStorage.getItem('HHA_school_id') || '';

  const classId =
    p.classId || p.class || prof.classId || hub.classId || sessionStorage.getItem('HHA_class_id') || '';

  const teacherId =
    p.teacherId || prof.teacherId || hub.teacherId || sessionStorage.getItem('HHA_teacher_id') || '';

  const mode =
    (p.mode || p.runMode || hub.runMode || sessionStorage.getItem('HHA_runMode') || 'play').toLowerCase();

  const diff =
    (p.diff || hub.diff || sessionStorage.getItem('HHA_diff') || 'normal').toLowerCase();

  // research mode: ห้าม adaptive
  const isResearch = (mode === 'research') || (p.research === '1');

  // endpoints: global logger จะ init จาก HTML แล้ว
  return {
    ts: nowIso(),
    studentId, schoolId, classId, teacherId,
    runMode: isResearch ? 'research' : 'play',
    diff,
    params: p
  };
}

// ---------- Difficulty ----------
const DIFF = {
  easy:   { spawnMs: 980, lifeMs: 1900, scale: 0.56, maxActive: 5, baseScore: 110, feverHit: 9, feverJunk: 16, rushEverySec: 24 },
  normal: { spawnMs: 820, lifeMs: 1650, scale: 0.52, maxActive: 6, baseScore: 120, feverHit: 8, feverJunk: 18, rushEverySec: 22 },
  hard:   { spawnMs: 700, lifeMs: 1450, scale: 0.48, maxActive: 7, baseScore: 130, feverHit: 7, feverJunk: 20, rushEverySec: 20 }
};

function pickDiff (k) {
  k = String(k || 'normal').toLowerCase();
  return DIFF[k] || DIFF.normal;
}

// ---------- Game Data ----------
const GROUPS = [
  { id: 'g1', name: 'โปรตีน',   emoji: '🥚', items: ['🥚','🥛','🐟','🍗','🫘','🥜'] },
  { id: 'g2', name: 'ข้าวแป้ง', emoji: '🍚', items: ['🍚','🍞','🥖','🍜','🥔','🌽'] },
  { id: 'g3', name: 'ผัก',      emoji: '🥦', items: ['🥦','🥬','🥒','🥕','🍅','🫑'] },
  { id: 'g4', name: 'ผลไม้',    emoji: '🍎', items: ['🍎','🍌','🍊','🍉','🍇','🍍'] },
  { id: 'g5', name: 'ไขมัน',    emoji: '🥑', items: ['🥑','🫒','🥥','🧀','🍶'] }
];

const JUNK = ['🍔','🍟','🍕','🌭','🍩','🍪','🍫','🧁','🥤','🧋','🍬'];

function mapEmojiToGroup (emoji) {
  for (const g of GROUPS) if (g.items.includes(emoji)) return g;
  return null;
}

// ---------- Grade ----------
function calcGrade ({ score, miss, comboMax, goalsCleared, questsCleared, perfect }) {
  // สูตร “เล่นสนุก” เน้นทำภารกิจ + ไม่พลาด
  const penalty = miss * 160;
  const questBonus = (goalsCleared * 500) + (questsCleared * 380);
  const perfBonus = (perfect * 35) + (Math.min(comboMax, 25) * 25);
  const total = score + questBonus + perfBonus - penalty;

  if (goalsCleared >= 2 && questsCleared >= 2 && miss <= 2 && total >= 4200) return 'SSS';
  if (goalsCleared >= 2 && questsCleared >= 1 && miss <= 4 && total >= 3300) return 'SS';
  if (goalsCleared >= 1 && questsCleared >= 1 && miss <= 6 && total >= 2600) return 'S';
  if (total >= 1900 && miss <= 9) return 'A';
  if (total >= 1200) return 'B';
  return 'C';
}

// ---------- Emoji Texture Cache ----------
function makeEmojiTextureFactory (sceneEl) {
  const THREE = (A && A.THREE) || (ROOT.THREE);
  const cache = new Map();
  if (!THREE) {
    return {
      get: () => null,
      hasThree: false
    };
  }

  function get (emoji) {
    emoji = String(emoji || '❓');

    if (cache.has(emoji)) return cache.get(emoji);

    const size = 256;
    const c = document.createElement('canvas');
    c.width = size; c.height = size;
    const ctx = c.getContext('2d');

    // transparent background
    ctx.clearRect(0, 0, size, size);

    // draw emoji
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '180px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji","Twemoji Mozilla",system-ui';
    ctx.fillText(emoji, size/2, size/2 + 6);

    const tex = new THREE.CanvasTexture(c);
    tex.needsUpdate = true;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;

    cache.set(emoji, tex);
    return tex;
  }

  return { get, hasThree: true, THREE };
}

// ---------- UI helper (safe) ----------
function $(id) { return document.getElementById(id); }

function setText (id, v) {
  const el = $(id);
  if (!el) return;
  el.textContent = String(v);
}

function setBar (id, pct) {
  const el = $(id);
  if (!el) return;
  el.style.width = `${clamp(pct, 0, 100)}%`;
}

function show (id, on) {
  const el = $(id);
  if (!el) return;
  el.style.display = on ? '' : 'none';
}

function flashWarnEdge (on) {
  // กระพริบขอบจอแบบเบา ๆ (ถ้ามี layer ของ Particles ก็ให้ judgeText)
  if (on) {
    try { Particles.judgeText && Particles.judgeText('⏳ ใกล้หมดเวลา!', 'WARN'); } catch(_) {}
    document.documentElement.style.filter = 'brightness(1.05)';
  } else {
    document.documentElement.style.filter = '';
  }
}

function microShake (ms = 260) {
  const b = document.body;
  if (!b) return;
  b.style.transition = 'transform 60ms linear';
  const t0 = Date.now();
  const timer = setInterval(() => {
    const t = Date.now() - t0;
    if (t > ms) {
      clearInterval(timer);
      b.style.transform = '';
      return;
    }
    const dx = rnd(-1.2, 1.2);
    const dy = rnd(-0.8, 0.8);
    b.style.transform = `translate(${dx}px, ${dy}px)`;
  }, 60);
}

// ---------- FX mapping: intersection -> screen XY ----------
function projectToScreen (sceneEl, worldPoint) {
  try {
    const cam = sceneEl && sceneEl.camera;
    const renderer = sceneEl && sceneEl.renderer;
    if (!cam || !renderer || !worldPoint) return null;

    const THREE = A.THREE;
    const v = new THREE.Vector3(worldPoint.x, worldPoint.y, worldPoint.z);
    v.project(cam);

    const w = renderer.domElement.clientWidth;
    const h = renderer.domElement.clientHeight;

    const x = (v.x * 0.5 + 0.5) * w;
    const y = (-v.y * 0.5 + 0.5) * h;
    return { x, y };
  } catch (_) {
    return null;
  }
}

// ---------- Quest System ----------
function makeGoals () {
  // 2 goals/run
  const defs = [
    {
      id: 'goal_fill1',
      label: 'เติมจานให้ครบ 5 หมู่ 1 ครั้ง 🍽️',
      hint: 'เก็บให้ครบ 5 หมู่',
      eval: (s) => s.platesFilled,
      target: 1
    },
    {
      id: 'goal_score',
      label: 'ทำคะแนนให้ได้ตามเป้า ⭐',
      hint: 'ตีให้ต่อเนื่อง + เก็บครบหมู่',
      eval: (s) => s.score,
      targetByDiff: { easy: 1500, normal: 1900, hard: 2300 }
    },
    {
      id: 'goal_combo',
      label: 'ทำคอมโบสูงสุดให้ถึงเป้า 🔥',
      hint: 'อย่าโดนขยะ!',
      eval: (s) => s.comboMax,
      targetByDiff: { easy: 10, normal: 14, hard: 18 }
    },
    {
      id: 'goal_miss',
      label: 'จบเกมโดย MISS ไม่เกินเป้า 💥',
      hint: 'หลบขยะให้ได้',
      eval: (s) => s.miss,
      targetByDiff: { easy: 8, normal: 6, hard: 4 },
      inverse: true
    }
  ];

  // random pick 2 ต่างกัน
  const a = pick(defs);
  let b = pick(defs);
  let guard = 0;
  while (b.id === a.id && guard++ < 10) b = pick(defs);
  return [a, b];
}

function goalTarget (g, diffKey) {
  if (typeof g.target === 'number') return g.target;
  const t = g.targetByDiff || {};
  return (t[String(diffKey)] ?? t.normal ?? 1);
}

function goalPassed (g, v, tgt) {
  if (g.inverse) return v <= tgt;
  return v >= tgt;
}

// ---------- Mini Quest: Plate Rush ----------
function makeRushMini (diffKey) {
  const secs = (diffKey === 'hard') ? 7 : (diffKey === 'easy' ? 9 : 8);
  return {
    id: 'mini_rush',
    label: `Plate Rush ⚡ เก็บครบ 5 หมู่ใน ${secs} วิ`,
    hint: 'ห้ามโดนขยะระหว่างทำ!',
    durationSec: secs,
    failOnJunk: true
  };
}

// ---------- Main ----------
function bootPlateVR () {
  if (!A) {
    console.error('[PlateVR] AFRAME not found');
    return;
  }

  const common = readHubCommon();
  const diffCfg = pickDiff(common.diff);

  // scene references
  const sceneEl = document.querySelector('a-scene');
  const camEl = document.getElementById('cam') || document.querySelector('[camera]');
  const targetRoot = document.getElementById('targetRoot') || sceneEl;

  if (!sceneEl || !camEl) {
    console.error('[PlateVR] scene/camera missing');
    return;
  }

  // texture factory
  const texFactory = makeEmojiTextureFactory(sceneEl);

  // state
  const S = {
    runId: uid('plate'),
    startedAt: nowIso(),
    endedAt: null,
    isPaused: false,
    isEnded: false,

    diff: common.diff,
    runMode: common.runMode,

    // timing
    timeTotal: Number(common.params.time || common.params.t || 70) || 70,
    timeLeft: 0,
    lastTickMs: 0,

    // scoring
    score: 0,
    combo: 0,
    comboMax: 0,
    miss: 0,
    perfect: 0,

    // fever
    fever: 0, // 0-100
    feverMax: 100,

    // plate progress
    groupsHave: new Set(),
    platesFilled: 0,

    // quests
    goals: makeGoals(),
    goalIndex: 0,
    goalsCleared: 0,

    rush: makeRushMini(common.diff),
    rushActive: false,
    rushEndsAt: 0,
    rushNoJunk: true,
    rushLastWarn: 0,
    questsCleared: 0,

    // spawn
    spawnMs: diffCfg.spawnMs,
    lifeMs: diffCfg.lifeMs,
    scaleBase: diffCfg.scale,
    maxActive: diffCfg.maxActive,
    active: new Set(),
    lastSpawnMs: 0,

    // adaptive (play mode เท่านั้น)
    adaptive: (common.runMode === 'play'),
    adaptScore: 0,
    adaptHits: 0,
    adaptJunk: 0,
    adaptLastAt: 0,

    // audio (optional)
    beepOk: null,
    beepBad: null,
    tick: null
  };

  // init time
  S.timeLeft = S.timeTotal;
  S.lastTickMs = performance.now();
  S.adaptLastAt = performance.now();

  // optional audio (เบามาก)
  function makeBeep (freq = 660, dur = 0.06, type = 'sine', gain = 0.03) {
    try {
      const AC = ROOT.AudioContext || ROOT.webkitAudioContext;
      if (!AC) return null;
      const ac = new AC();
      return () => {
        const o = ac.createOscillator();
        const g = ac.createGain();
        o.type = type;
        o.frequency.value = freq;
        g.gain.value = gain;
        o.connect(g);
        g.connect(ac.destination);
        o.start();
        o.stop(ac.currentTime + dur);
      };
    } catch (_) { return null; }
  }
  S.beepOk = makeBeep(740, 0.05, 'triangle', 0.028);
  S.beepBad = makeBeep(220, 0.07, 'sawtooth', 0.020);
  S.tick   = makeBeep(980, 0.03, 'square', 0.015);

  // ---------- Cloud log emitters (global logger จะเป็นคนส่งขึ้น Sheet) ----------
  function logEvent (name, extra = {}) {
    const payload = {
      type: name,
      ts: nowIso(),
      game: 'plate',
      runId: S.runId,
      ...common,
      state: {
        score: S.score,
        miss: S.miss,
        combo: S.combo,
        comboMax: S.comboMax,
        timeLeft: Math.max(0, Math.ceil(S.timeLeft)),
        fever: Math.round(S.fever),
        groups: S.groupsHave.size,
        platesFilled: S.platesFilled,
        goalsCleared: S.goalsCleared,
        questsCleared: S.questsCleared
      },
      ...extra
    };
    emit('hha:log_event', payload);
  }

  function logSession (reason = 'end') {
    const endedAt = nowIso();
    const grade = calcGrade({
      score: S.score, miss: S.miss, comboMax: S.comboMax,
      goalsCleared: S.goalsCleared, questsCleared: S.questsCleared,
      perfect: S.perfect
    });

    const payload = {
      type: 'session',
      ts: endedAt,
      game: 'plate',
      runId: S.runId,
      reason,
      startedAt: S.startedAt,
      endedAt,
      ...common,
      result: {
        score: S.score,
        miss: S.miss,
        comboMax: S.comboMax,
        perfect: S.perfect,
        fever: Math.round(S.fever),
        platesFilled: S.platesFilled,
        goalsCleared: S.goalsCleared,
        questsCleared: S.questsCleared,
        grade
      }
    };
    emit('hha:log_session', payload);
  }

  // ---------- HUD & events ----------
  function updateHud () {
    // DOM (ถ้ามี)
    setText('hudTime', Math.max(0, Math.ceil(S.timeLeft)));
    setText('hudScore', S.score);
    setText('hudCombo', S.combo);
    setText('hudMiss', S.miss);
    setText('hudGroupsHave', `${S.groupsHave.size}/5`);
    setText('hudPerfectCount', S.perfect);

    const grade = calcGrade({
      score: S.score, miss: S.miss, comboMax: S.comboMax,
      goalsCleared: S.goalsCleared, questsCleared: S.questsCleared,
      perfect: S.perfect
    });
    setText('hudGrade', grade);

    setText('hudMode', S.runMode === 'research' ? 'Research' : 'Play');
    setText('hudDiff', (S.diff || 'normal').toUpperCase());

    setBar('hudFever', (S.fever / S.feverMax) * 100);
    setText('hudFeverPct', `${Math.round((S.fever / S.feverMax) * 100)}%`);

    show('hudPaused', !!S.isPaused);

    // emit ให้ HUD กลาง (ถ้ามี hha-hud.js)
    emit('hha:score', {
      game: 'plate',
      score: S.score,
      combo: S.combo,
      miss: S.miss,
      timeLeft: Math.max(0, Math.ceil(S.timeLeft)),
      groupsHave: S.groupsHave.size,
      perfect: S.perfect
    });

    emit('hha:fever', { game: 'plate', value: Math.round(S.fever), max: S.feverMax });

    emit('hha:stat', {
      game: 'plate',
      goalsCleared: S.goalsCleared,
      questsCleared: S.questsCleared,
      grade
    });

    // quest line
    const g = S.goals[S.goalIndex] || S.goals[S.goals.length - 1];
    if (g) {
      const tgt = goalTarget(g, S.diff);
      const v = g.eval(S);
      const line = `${g.label} — ${g.inverse ? `${v}/${tgt} (ต้อง ≤)` : `${v}/${tgt}`}`;
      setText('hudGoalLine', line);
      emit('quest:update', {
        game: 'plate',
        goal: { id: g.id, label: g.label, value: v, target: tgt, inverse: !!g.inverse },
        mini: rushMiniPublic()
      });
    } else {
      setText('hudGoalLine', '—');
    }

    // mini panel
    const miniLine = S.rushActive
      ? `⚡ Plate Rush: เหลือ ${Math.max(0, Math.ceil((S.rushEndsAt - performance.now())/1000))} วิ`
      : `🧩 Plate Rush: รออีก ${Math.max(0, Math.ceil(timeToNextRush()))} วิ`;
    setText('hudMiniLine', miniLine);
    setText('hudMiniHint', S.rushActive ? S.rush.hint : 'เตรียมตัว! จะเคลียร์จานให้ทันเวลา');

    // push to result modal (ถ้าเปิด)
    if ($('resultBackdrop') && $('resultBackdrop').style.display !== 'none') {
      fillResultModal();
    }
  }

  function rushMiniPublic () {
    return {
      active: S.rushActive,
      label: S.rush.label,
      hint: S.rush.hint,
      remainingSec: S.rushActive ? Math.max(0, Math.ceil((S.rushEndsAt - performance.now()) / 1000)) : null
    };
  }

  // ---------- Buttons ----------
  const btnEnterVR = $('btnEnterVR');
  if (btnEnterVR) {
    btnEnterVR.addEventListener('click', () => {
      try { sceneEl.enterVR(); } catch (_) {}
    });
  }
  const btnPause = $('btnPause');
  if (btnPause) btnPause.addEventListener('click', () => togglePause());
  const btnRestart = $('btnRestart');
  if (btnRestart) btnRestart.addEventListener('click', () => location.reload());
  const btnPlayAgain = $('btnPlayAgain');
  if (btnPlayAgain) btnPlayAgain.addEventListener('click', () => location.reload());

  window.addEventListener('keydown', (e) => {
    const k = (e.key || '').toLowerCase();
    if (k === 'p' || k === ' ') togglePause();
    if (k === 'r') location.reload();
  });

  function togglePause () {
    if (S.isEnded) return;
    S.isPaused = !S.isPaused;
    logEvent(S.isPaused ? 'pause' : 'resume');
    updateHud();
  }

  // ---------- Targets ----------
  // spawn region (world space): อยู่หน้า camera origin (0,1.6,0) แต่กระจายซ้าย/ขวา/ขึ้นลงแบบไม่ไปสุดขอบ (กันทับ HUD)
  // NOTE: world coords จะทำให้ “หมุนจอแล้วเป้าเลื่อน” ตามที่ต้องการ
  const SAFE = {
    x: { min: -1.05, max: 1.05 },
    y: { min: 0.95,  max: 2.15 },
    z: { min: -2.25, max: -1.05 }
  };

  function chooseEmoji () {
    // สลับดี/ขยะ: โอกาสขยะ ~ 25% (hard จะเพิ่ม)
    const junkChance = (S.diff === 'hard') ? 0.34 : (S.diff === 'easy' ? 0.22 : 0.28);
    if (Math.random() < junkChance) return pick(JUNK);

    // เลือกจากกลุ่มที่ยังไม่ครบก่อน เพื่อให้รู้สึก “มีทางชนะ”
    const missing = GROUPS.filter(g => !S.groupsHave.has(g.id));
    const poolGroup = (missing.length ? pick(missing) : pick(GROUPS));
    return pick(poolGroup.items);
  }

  function makePlaneWithEmoji (emoji) {
    const el = document.createElement('a-entity');
    el.classList.add('plateTarget');
    el.setAttribute('class', 'plateTarget'); // ให้ raycaster="objects:.plateTarget" ยิงเจอ
    el.dataset.emoji = emoji;

    // base plane
    const w = 0.48, h = 0.48;
    el.setAttribute('geometry', `primitive:plane; width:${w}; height:${h}`);
    el.setAttribute('material', 'shader:flat; transparent:true; opacity:1; side:double');

    // outline glow เบา ๆ
    el.setAttribute('animation__pop', 'property: scale; from: 0.001 0.001 0.001; to: 1 1 1; dur: 110; easing: easeOutBack');
    el.setAttribute('animation__float', 'property: position; dir: alternate; dur: 900; loop: true; easing: easeInOutSine; to: 0 0.06 0');
    el.setAttribute('animation__fade', `property: material.opacity; from: 1; to: 0; dur: 220; easing:easeInQuad; startEvents: hha:fade`);

    // apply emoji texture after mesh ready
    el.addEventListener('loaded', () => {
      if (!texFactory.hasThree) return;
      const mesh = el.getObject3D('mesh');
      if (!mesh || !mesh.material) return;
      const tex = texFactory.get(emoji);
      if (!tex) return;
      mesh.material.map = tex;
      mesh.material.needsUpdate = true;
    });

    return el;
  }

  function spawnTarget () {
    if (S.isPaused || S.isEnded) return;
    if (S.active.size >= S.maxActive) return;

    const emoji = chooseEmoji();
    const el = makePlaneWithEmoji(emoji);

    // random world pos
    const pos = {
      x: rnd(SAFE.x.min, SAFE.x.max),
      y: rnd(SAFE.y.min, SAFE.y.max),
      z: rnd(SAFE.z.min, SAFE.z.max)
    };
    el.setAttribute('position', `${pos.x} ${pos.y} ${pos.z}`);

    // look-at camera (ให้หันเข้าหากล้องเสมอ)
    el.setAttribute('look-at', '#cam');

    // scale by diff + (adaptive)
    let scale = S.scaleBase;
    if (S.adaptive && S.runMode === 'play') {
      // ปรับเล็กน้อยตาม performance
      scale = clamp(scale + (S.adaptScore * 0.04), 0.44, 0.64);
    }
    el.setAttribute('scale', `${scale} ${scale} ${scale}`);

    // click handler: ✅ ส่ง intersection ไป onHit
    el.addEventListener('click', (e) => {
      const inter = (e && e.detail && e.detail.intersection) ? e.detail.intersection : null;
      onHit(el, 'cursor', inter);
    });

    // lifetime: appear -> auto fade -> remove
    const born = performance.now();
    el.dataset.born = String(born);

    const life = S.lifeMs + rndi(-120, 160);
    const tFade = Math.max(320, life - 220);

    const fadeTimer = setTimeout(() => {
      try { el.emit('hha:fade'); } catch (_) {}
    }, tFade);

    const killTimer = setTimeout(() => {
      try { clearTimeout(fadeTimer); } catch(_) {}
      despawn(el, 'timeout');
    }, life);

    el.dataset.fadeTimer = String(fadeTimer);
    el.dataset.killTimer = String(killTimer);

    // attach
    (targetRoot || sceneEl).appendChild(el);
    S.active.add(el);

    return el;
  }

  function despawn (el, reason = 'remove') {
    if (!el) return;
    if (S.active.has(el)) S.active.delete(el);

    try {
      const ft = Number(el.dataset.fadeTimer || 0);
      const kt = Number(el.dataset.killTimer || 0);
      if (ft) clearTimeout(ft);
      if (kt) clearTimeout(kt);
    } catch (_) {}

    try { el.parentNode && el.parentNode.removeChild(el); } catch (_) {}

    if (reason !== 'hit') {
      logEvent('target_despawn', { reason, emoji: el.dataset.emoji || '' });
    }
  }

  // ---------- Hit logic ----------
  function onHit (el, src = 'cursor', intersection = null) {
    if (!el || S.isPaused || S.isEnded) return;

    // guard: double hit
    if (el.dataset.dead === '1') return;
    el.dataset.dead = '1';

    const emoji = el.dataset.emoji || '❓';
    const group = mapEmojiToGroup(emoji);
    const isJunk = !group;

    // compute screen xy for fx
    let fxXY = null;
    if (intersection && intersection.point) {
      fxXY = projectToScreen(sceneEl, intersection.point);
    } else {
      // fallback: use entity world position
      const p = el.object3D && el.object3D.position;
      if (p) fxXY = projectToScreen(sceneEl, p);
    }

    const born = Number(el.dataset.born || 0);
    const aliveMs = born ? (performance.now() - born) : 9999;
    const isPerfect = aliveMs <= 700; // หน้าต่าง perfect
    const baseScore = DIFF[S.diff]?.baseScore ?? 120;

    let delta = 0;
    let kind = 'GOOD';
    let judge = 'GOOD';

    if (isJunk) {
      kind = 'JUNK';
      judge = 'MISS';
      S.miss += 1;
      S.combo = 0;
      S.fever = clamp(S.fever - diffCfg.feverJunk, 0, S.feverMax);

      if (S.rushActive && S.rush.failOnJunk) {
        S.rushNoJunk = false;
      }

      try { S.beepBad && S.beepBad(); } catch(_) {}
      emit('hha:coach', { mood: 'sad', text: 'โอ๊ย! นั่นขยะนะ 😵‍💫 ระวังด้วย!' });

      if (fxXY) {
        try { Particles.scorePop(fxXY.x, fxXY.y, '💥 MISS', 'MISS'); } catch(_) {}
        try { Particles.burstAt(fxXY.x, fxXY.y, 'JUNK'); } catch(_) {}
      }
    } else {
      // good item
      S.combo += 1;
      S.comboMax = Math.max(S.comboMax, S.combo);

      // fever up
      S.fever = clamp(S.fever + diffCfg.feverHit, 0, S.feverMax);

      // plate progress
      const had = S.groupsHave.has(group.id);
      if (!had) {
        S.groupsHave.add(group.id);
        delta = baseScore + Math.min(120, S.combo * 3);
        judge = isPerfect ? 'PERFECT' : 'GREAT';
      } else {
        delta = Math.floor(baseScore * 0.35) + Math.min(60, S.combo * 2);
        judge = isPerfect ? 'NICE' : 'GOOD';
      }

      if (isPerfect) S.perfect += 1;

      S.score += delta;

      // adaptive stats (play mode only)
      if (S.adaptive && S.runMode === 'play') {
        S.adaptHits += 1;
        S.adaptScore += (isPerfect ? 0.12 : 0.06);
      }

      // plate filled?
      if (S.groupsHave.size >= 5) {
        S.platesFilled += 1;
        S.groupsHave.clear();
        // reward
        S.score += 260;
        S.fever = clamp(S.fever + 8, 0, S.feverMax);
        try { Particles.celebrate && Particles.celebrate('🍽️ จานครบ 5 หมู่! +260'); } catch(_) {}
        emit('hha:coach', { mood: 'happy', text: 'เยี่ยม! ครบ 5 หมู่แล้ว 🎉' });

        // progress might clear goal
        checkGoal();
        // if rush active, it also completes rush
        if (S.rushActive) checkRushComplete();
      } else {
        // small coach nudge when close
        if (S.groupsHave.size === 4) {
          emit('hha:coach', { mood: 'neutral', text: 'อีกหมู่เดียว! รีบเก็บให้ครบ 🏁' });
        }
      }

      try { S.beepOk && S.beepOk(); } catch(_) {}

      if (fxXY) {
        try { Particles.scorePop(fxXY.x, fxXY.y, `+${delta}`, judge); } catch(_) {}
        try { Particles.burstAt(fxXY.x, fxXY.y, kind); } catch(_) {}
      }
    }

    // log hit
    logEvent('hit', {
      src,
      emoji,
      isJunk,
      groupId: group ? group.id : '',
      groupName: group ? group.name : '',
      delta,
      judge,
      perfect: isPerfect,
      intersection: intersection && intersection.point
        ? { x: intersection.point.x, y: intersection.point.y, z: intersection.point.z }
        : null
    });

    // cleanup target
    despawn(el, 'hit');

    // update
    updateHud();
  }

  // ---------- Goals ----------
  function checkGoal () {
    const g = S.goals[S.goalIndex];
    if (!g) return;

    const tgt = goalTarget(g, S.diff);
    const v = g.eval(S);

    if (goalPassed(g, v, tgt)) {
      S.goalsCleared += 1;

      emit('hha:coach', { mood: 'happy', text: `สำเร็จ! ${g.label} ✅` });
      try { Particles.celebrate && Particles.celebrate(`✅ GOAL CLEAR: ${g.label}`); } catch(_) {}

      logEvent('goal_clear', { goalId: g.id, label: g.label, value: v, target: tgt });

      // next goal
      S.goalIndex += 1;

      // if all goals cleared => bonus
      if (S.goalIndex >= S.goals.length) {
        S.score += 500;
        try { Particles.celebrate && Particles.celebrate('🏁 เคลียร์ GOAL ครบ! +500'); } catch(_) {}
        emit('hha:coach', { mood: 'happy', text: 'สุดยอด! เคลียร์ภารกิจหลักครบแล้ว 🌟' });
      }

      updateHud();
    }
  }

  // ---------- Rush Mini ----------
  function timeToNextRush () {
    // รันเป็น “คาบ” ทุก N วิ ตาม difficulty (ทำให้คาดเดาได้เล็กน้อย)
    const period = (DIFF[S.diff]?.rushEverySec ?? 22);
    const t = (S.timeTotal - S.timeLeft); // elapsed in sec
    const next = period - (t % period);
    return next;
  }

  function maybeStartRush () {
    if (S.rushActive || S.isPaused || S.isEnded) return;

    const period = (DIFF[S.diff]?.rushEverySec ?? 22);
    const elapsed = (S.timeTotal - S.timeLeft);

    // เริ่มใกล้ ๆ จุด period (ให้ stable)
    if (elapsed > 2 && Math.abs((elapsed % period) - 0) < 0.12) {
      startRush();
    }
  }

  function startRush () {
    S.rushActive = true;
    S.rushNoJunk = true;

    // เคลียร์จานเพื่อเริ่มแข่ง
    S.groupsHave.clear();

    const durMs = (S.rush.durationSec | 0) * 1000;
    S.rushEndsAt = performance.now() + durMs;

    emit('hha:coach', { mood: 'neutral', text: `⚡ Plate Rush! เก็บให้ครบ 5 หมู่ใน ${S.rush.durationSec} วิ!` });
    logEvent('mini_start', { miniId: S.rush.id, label: S.rush.label, durationSec: S.rush.durationSec });

    try { Particles.celebrate && Particles.celebrate('⚡ PLATE RUSH START!'); } catch(_) {}
    updateHud();
  }

  function failRush (reason = 'timeout') {
    if (!S.rushActive) return;

    S.rushActive = false;
    S.groupsHave.clear();

    emit('hha:coach', { mood: 'sad', text: `พลาดแล้ว! Plate Rush ไม่สำเร็จ 😵 (${reason})` });
    logEvent('mini_fail', { miniId: S.rush.id, reason });

    flashWarnEdge(false);
    updateHud();
  }

  function winRush () {
    if (!S.rushActive) return;

    S.rushActive = false;
    S.questsCleared += 1;

    // reward
    const bonus = (S.diff === 'hard') ? 900 : (S.diff === 'easy' ? 700 : 800);
    S.score += bonus;

    // time bonus เล็กน้อย
    S.timeLeft = clamp(S.timeLeft + 5, 0, S.timeTotal);

    // fever boost
    S.fever = clamp(S.fever + 12, 0, S.feverMax);

    emit('hha:coach', { mood: 'happy', text: `สุดยอด! Plate Rush สำเร็จ 🎉 +${bonus} (+5s)` });
    logEvent('mini_clear', { miniId: S.rush.id, bonus });

    try { Particles.celebrate && Particles.celebrate(`⚡ RUSH CLEAR! +${bonus} (+5s)`); } catch(_) {}

    flashWarnEdge(false);
    updateHud();
  }

  function checkRushComplete () {
    if (!S.rushActive) return;
    if (!S.rushNoJunk) {
      failRush('hit_junk');
      return;
    }
    if (S.groupsHave.size >= 5) {
      winRush();
    }
  }

  function tickRushWarning () {
    if (!S.rushActive) return;
    const remain = (S.rushEndsAt - performance.now()) / 1000;

    if (remain <= 0) {
      failRush('timeout');
      return;
    }

    // ใกล้หมดเวลา: กระพริบ/ติ๊ก/สั่นเบา ๆ
    if (remain <= 2.8) {
      const now = performance.now();
      if (now - S.rushLastWarn > 260) {
        S.rushLastWarn = now;
        flashWarnEdge(true);
        try { S.tick && S.tick(); } catch(_) {}
        microShake(120);
      }
    } else {
      flashWarnEdge(false);
    }
  }

  // ---------- End ----------
  function fillResultModal () {
    const grade = calcGrade({
      score: S.score, miss: S.miss, comboMax: S.comboMax,
      goalsCleared: S.goalsCleared, questsCleared: S.questsCleared,
      perfect: S.perfect
    });

    setText('rMode', S.runMode === 'research' ? 'Research' : 'Play');
    setText('rGrade', grade);
    setText('rScore', S.score);
    setText('rMaxCombo', S.comboMax);
    setText('rMiss', S.miss);
    setText('rPerfect', S.perfect);

    setText('rGoals', `${S.goalsCleared}/${S.goals.length}`);
    setText('rMinis', `${S.questsCleared}/∞`);

    // แสดงจำนวน “ครั้งที่เก็บครบหมู่” แทน G1..G5 (คง ids ไว้ให้ไม่ error)
    setText('rG1', '—'); setText('rG2', '—'); setText('rG3', '—'); setText('rG4', '—'); setText('rG5', '—');
    setText('rGTotal', `${S.platesFilled} plates`);
  }

  function endGame (reason = 'timeup') {
    if (S.isEnded) return;
    S.isEnded = true;
    S.endedAt = nowIso();

    // clear targets
    for (const el of Array.from(S.active)) {
      despawn(el, 'end');
    }
    S.active.clear();

    // final grade + emit
    const grade = calcGrade({
      score: S.score, miss: S.miss, comboMax: S.comboMax,
      goalsCleared: S.goalsCleared, questsCleared: S.questsCleared,
      perfect: S.perfect
    });

    emit('hha:end', {
      game: 'plate',
      reason,
      score: S.score,
      miss: S.miss,
      comboMax: S.comboMax,
      perfect: S.perfect,
      fever: Math.round(S.fever),
      platesFilled: S.platesFilled,
      goalsCleared: S.goalsCleared,
      questsCleared: S.questsCleared,
      grade
    });

    emit('hha:stat', { game: 'plate', goalsCleared: S.goalsCleared, questsCleared: S.questsCleared, grade });

    // show modal if exists
    if ($('resultBackdrop')) {
      fillResultModal();
      $('resultBackdrop').style.display = 'flex';
    }

    try { Particles.celebrate && Particles.celebrate(`🏁 END! Grade ${grade}`); } catch(_) {}
    emit('hha:coach', { mood: 'happy', text: `จบแล้ว! เกรด ${grade} ✅` });

    logSession(reason);
    logEvent('end', { reason, grade });

    updateHud();
  }

  // ---------- Adaptive tuning (play only) ----------
  function adaptiveTick () {
    if (!S.adaptive || S.runMode !== 'play' || S.isPaused || S.isEnded) return;

    const now = performance.now();
    if (now - S.adaptLastAt < 6000) return; // ทุก ~6 วิ

    S.adaptLastAt = now;

    // ถ้าพลาดเยอะ → ขยายเป้า/ชะลอ spawn เล็กน้อย
    const missRate = S.miss / Math.max(1, (S.adaptHits + S.miss));
    if (missRate >= 0.36) {
      S.adaptScore = clamp(S.adaptScore - 0.18, -0.35, 0.35);
      S.spawnMs = clamp(S.spawnMs + 70, 720, 1100);
    } else if (S.comboMax >= 16 && S.miss <= 3) {
      // ถ้าเทพ → ลดขนาด/เพิ่มความถี่เล็กน้อย
      S.adaptScore = clamp(S.adaptScore + 0.12, -0.35, 0.35);
      S.spawnMs = clamp(S.spawnMs - 45, 540, 980);
    } else {
      // ค่อย ๆ คืนสู่ค่ากลาง
      S.adaptScore *= 0.72;
      S.spawnMs = clamp(S.spawnMs + (diffCfg.spawnMs - S.spawnMs) * 0.25, 540, 1100);
    }

    logEvent('adaptive', { adaptScore: S.adaptScore, spawnMs: Math.round(S.spawnMs) });
  }

  // ---------- Main loop ----------
  function loop () {
    if (S.isEnded) return;

    const now = performance.now();
    const dt = Math.min(0.2, Math.max(0.0, (now - S.lastTickMs) / 1000));
    S.lastTickMs = now;

    if (!S.isPaused) {
      // time
      S.timeLeft -= dt;

      // rush schedule
      maybeStartRush();
      tickRushWarning();

      // spawn
      if (now - S.lastSpawnMs >= S.spawnMs) {
        S.lastSpawnMs = now;
        spawnTarget();
      }

      // goal checks (บาง goal ไม่ต้องรอ plate ครบ)
      checkGoal();

      // adaptive
      adaptiveTick();

      // end by time
      if (S.timeLeft <= 0) {
        S.timeLeft = 0;
        endGame('timeup');
        return;
      }
    }

    // HUD update (ลดความถี่ให้ลื่น)
    if ((now | 0) % 180 < 20) updateHud();

    requestAnimationFrame(loop);
  }

  // ---------- Factory boot (optional) ----------
  // (เพื่อให้สอดคล้องกับระบบกลาง แต่ไม่ผูกแน่น)
  try {
    factoryBoot({
      game: 'plate',
      runMode: S.runMode,
      diff: S.diff
    });
  } catch (_) {}

  // ---------- Start ----------
  logEvent('start', { timeTotal: S.timeTotal, diff: S.diff, runMode: S.runMode });
  emit('hha:coach', { mood: 'neutral', text: 'พร้อมแล้ว! เก็บอาหารให้ครบ 5 หมู่ 🍽️' });

  updateHud();
  requestAnimationFrame(loop);

  // flush session when leaving
  window.addEventListener('pagehide', () => { try { if (!S.isEnded) logSession('pagehide'); } catch(_) {} }, { once: true });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      try { if (!S.isEnded) logSession('hidden'); } catch(_) {}
    }
  }, { passive: true });
}

// ---------- DOM Ready ----------
window.addEventListener('DOMContentLoaded', () => {
  bootPlateVR();
});
