/* === /herohealth/vr-groups/GameEngine.js ===
Food Groups VR — GameEngine (IIFE / PRODUCTION)
- Expose: window.GroupsVR.GameEngine
- Works with groups-vr.html (your listeners):
  - hha:score, hha:time, hha:rank, hha:coach
  - quest:update
  - groups:reticle, groups:lock
- Play: random + adaptive + boss/decoy/rage/rush
- Research: fixed order + fixed minis + fixed RNG (controlled variables)
*/

(function (root) {
  'use strict';

  // ---------------- Utils ----------------
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const now = () => (performance && performance.now ? performance.now() : Date.now());
  const rndId = () => Math.random().toString(16).slice(2) + Math.random().toString(16).slice(2);

  function dispatch(name, detail) {
    try {
      root.dispatchEvent(new CustomEvent(name, { detail }));
    } catch (_) {}
  }

  function getCSSVarPx(name, fallbackPx) {
    try {
      const s = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
      if (!s) return fallbackPx;
      if (s.endsWith('px')) return parseFloat(s);
      const n = parseFloat(s);
      return Number.isFinite(n) ? n : fallbackPx;
    } catch {
      return fallbackPx;
    }
  }

  // seeded rng (mulberry32)
  function xmur3(str) {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return function () {
      h = Math.imul(h ^ (h >>> 16), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      h ^= h >>> 16;
      return h >>> 0;
    };
  }
  function mulberry32(a) {
    return function () {
      let t = (a += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function makeRng(seedStr) {
    const seedFn = xmur3(seedStr || 'seed');
    return mulberry32(seedFn());
  }

  function pick(arr, rng) {
    if (!arr || !arr.length) return null;
    const r = rng ? rng() : Math.random();
    return arr[Math.floor(r * arr.length)];
  }

  // ---------------- Modules (optional) ----------------
  const Particles =
    (root.GAME_MODULES && root.GAME_MODULES.Particles) ||
    root.Particles ||
    { scorePop() {}, burstAt() {}, celebrate() {} };

  const FeverUI =
    (root.GAME_MODULES && root.GAME_MODULES.FeverUI) ||
    root.FeverUI ||
    { setFever() {}, pulse() {} };

  // Logger (optional): hha-cloud-logger.js listens to these
  function logSession(payload) { dispatch('hha:log_session', payload); }
  function logEvent(payload)   { dispatch('hha:log_event', payload); }
  function logProfile(payload) { dispatch('hha:log_profile', payload); }

  // ---------------- Game content ----------------
  const GROUPS = [
    { key: 1, name: 'หมู่ 1 โปรตีน', icon: '💪', pool: ['🍗','🥩','🥚','🥛','🧀','🫘'] },
    { key: 2, name: 'หมู่ 2 คาร์บ',   icon: '⚡', pool: ['🍚','🍞','🥔','🍠','🍜','🥨'] },
    { key: 3, name: 'หมู่ 3 ผัก',     icon: '🥦', pool: ['🥦','🥕','🥬','🥒','🍅'] },
    { key: 4, name: 'หมู่ 4 ผลไม้',   icon: '🍎', pool: ['🍎','🍌','🍊','🍉','🍇'] },
    { key: 5, name: 'หมู่ 5 ไขมัน',   icon: '🥑', pool: ['🥑','🥜','🧈','🫒','🥥'] },
  ];
  const JUNK = ['🍩','🍟','🍔','🍕','🍫','🥤','🍬','🧁'];

  function groupByKey(k) { return GROUPS.find(g => g.key === k) || GROUPS[0]; }

  // ---------------- Difficulty tuning ----------------
  const DIFF = {
    easy:   { size: 1.10, life: 2.10, spawnMs: 880, maxAlive: 2, lockMs: 850, chargeMs: 1200, burst: 2, coneMax: 4 },
    normal: { size: 1.00, life: 1.85, spawnMs: 740, maxAlive: 3, lockMs: 800, chargeMs: 1150, burst: 3, coneMax: 5 },
    hard:   { size: 0.92, life: 1.55, spawnMs: 610, maxAlive: 4, lockMs: 750, chargeMs: 1050, burst: 3, coneMax: 6 },
  };

  // ---------------- Engine state ----------------
  let layerEl = null;
  let camEl = null;

  let running = false;
  let runMode = 'play';
  let diffKey = 'normal';
  let cfg = DIFF.normal;

  let rng = Math.random;

  let totalSec = 70;
  let timeLeft = 70;
  let lastTickSec = -1;
  let tStart = 0;

  let rafId = 0;
  let spawnTimer = 0;
  let secTimer = 0;

  let gazeOn = true;

  // score/stats
  let score = 0;
  let combo = 0;
  let comboMax = 0;
  let misses = 0;
  let shield = 0;

  // fever (0..1)
  let fever = 0; // raises on streak/perfect, drops on miss/wrong

  // targets
  const alive = new Map(); // id -> target
  let aliveCount = 0;

  // gaze lock tracking
  let focusId = null;
  let focusAt = 0;
  let lockedFired = false;
  let chargedFired = false;

  // quest
  let goal = null;  // {groupKey, target, prog}
  let goalQueue = []; // order of group keys
  let goalIndex = 0;

  let mini = null; // {type,label,target,prog, t0, failFlag, extra}
  let miniQueue = []; // fixed for research

  // DOM refs (optional)
  let edgePulseEl = null;

  // ---------------- Helpers: Safe spawn zone ----------------
  function safeRect() {
    const w = innerWidth || 360;
    const h = innerHeight || 640;

    const hudTop = getCSSVarPx('--hudTop', 110);
    const hudBottom = getCSSVarPx('--hudBottom', 150);

    const padX = 0.08;
    const padTop = clamp((hudTop + 18) / h, 0.12, 0.40);
    const padBottom = clamp((hudBottom + 16) / h, 0.12, 0.42);

    return {
      x0: padX,
      x1: 1 - padX,
      y0: padTop,
      y1: 1 - padBottom
    };
  }

  function tooClose(x, y, minD) {
    for (const t of alive.values()) {
      const dx = (t.x - x);
      const dy = (t.y - y);
      if ((dx*dx + dy*dy) < (minD*minD)) return true;
    }
    return false;
  }

  function pickSpawnXY(sizeScale) {
    const R = safeRect();
    const tries = 14;
    const minD = 0.13 * (1 / clamp(sizeScale, 0.7, 1.3));
    for (let i = 0; i < tries; i++) {
      const x = R.x0 + (R.x1 - R.x0) * rng();
      const y = R.y0 + (R.y1 - R.y0) * rng();
      if (!tooClose(x, y, minD)) return { x, y };
    }
    return { x: 0.5, y: (R.y0 + R.y1) * 0.5 };
  }

  // ---------------- Target creation ----------------
  function createTarget(data) {
    if (!layerEl) return null;

    const id = 't_' + rndId();
    const el = document.createElement('div');
    el.className = 'fg-target spawn';

    // kind class
    if (data.kind === 'junk') el.classList.add('fg-junk');
    else if (data.kind === 'decoy') el.classList.add('fg-decoy');
    else if (data.kind === 'boss') el.classList.add('fg-boss');
    else el.classList.add('fg-good');

    // content: emoji (fallback) OR image if provided
    if (data.img) {
      const img = document.createElement('img');
      img.src = data.img;
      img.alt = data.label || '';
      img.draggable = false;
      img.style.width = '74%';
      img.style.height = '74%';
      img.style.objectFit = 'contain';
      img.style.filter = 'drop-shadow(0 8px 16px rgba(0,0,0,.25))';
      el.appendChild(img);
    } else {
      el.textContent = data.emoji || '🍀';
    }

    // boss hp bar
    if (data.kind === 'boss') {
      const bar = document.createElement('div');
      bar.className = 'bossbar';
      const fill = document.createElement('div');
      fill.className = 'bossbar-fill';
      fill.style.width = '100%';
      bar.appendChild(fill);
      el.appendChild(bar);
      el._bossFill = fill;
    }

    // positioning
    el.style.setProperty('--x', Math.round(data.x * 1000) / 10 + '%');
    el.style.setProperty('--y', Math.round(data.y * 1000) / 10 + '%');
    el.style.setProperty('--s', String(data.s));

    // pointer hit
    el.addEventListener('pointerdown', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      if (!running) return;
      onHit(id, 'tap', { px: ev.clientX, py: ev.clientY });
    }, { passive: false });

    layerEl.appendChild(el);

    // reveal
    requestAnimationFrame(() => {
      el.classList.remove('spawn');
      el.classList.add('show');
    });

    const t = {
      id,
      el,
      kind: data.kind,
      groupKey: data.groupKey || 0,
      x: data.x,
      y: data.y,
      s: data.s,
      born: now(),
      lifeMs: data.lifeMs,
      hp: data.hp || 1,
      maxHp: data.hp || 1,
      locked: false
    };

    alive.set(id, t);
    aliveCount++;

    return t;
  }

  function destroyTarget(t, why) {
    if (!t || !t.el) return;
    alive.delete(t.id);
    aliveCount = Math.max(0, aliveCount - 1);

    const el = t.el;
    el.classList.remove('show');
    if (why === 'hit') el.classList.add('hit');
    else el.classList.add('out');

    setTimeout(() => {
      try { el.remove(); } catch (_) {}
    }, 220);
  }

  function clearAllTargets() {
    for (const t of alive.values()) {
      try { t.el.remove(); } catch (_) {}
    }
    alive.clear();
    aliveCount = 0;
  }

  // ---------------- Reticle / Gaze utilities ----------------
  function targetAtPoint(px, py) {
    // find top-most target containing point
    let found = null;
    for (const t of alive.values()) {
      const r = t.el.getBoundingClientRect();
      if (px >= r.left && px <= r.right && py >= r.top && py <= r.bottom) {
        found = t;
      }
    }
    return found;
  }

  function nearestToPoint(px, py) {
    let best = null;
    let bestD = 1e18;
    for (const t of alive.values()) {
      const r = t.el.getBoundingClientRect();
      const cx = (r.left + r.right) * 0.5;
      const cy = (r.top + r.bottom) * 0.5;
      const dx = (cx - px), dy = (cy - py);
      const d2 = dx*dx + dy*dy;
      if (d2 < bestD) { bestD = d2; best = t; }
    }
    return best;
  }

  function setReticle(state) {
    dispatch('groups:reticle', { state });
  }

  function setLockUI(on, t, lockProg, chargeProg) {
    if (!on || !t) {
      dispatch('groups:lock', { on: false });
      return;
    }
    // locate center pixel of target
    const r = t.el.getBoundingClientRect();
    const x = (r.left + r.right) * 0.5;
    const y = (r.top + r.bottom) * 0.5;
    dispatch('groups:lock', {
      on: true,
      x, y,
      prog: clamp(lockProg, 0, 1),
      charge: clamp(chargeProg, 0, 1)
    });
  }

  // ---------------- Quest system ----------------
  function buildGoalQueue(mode) {
    const order = [1,2,3,4,5];
    if (mode === 'research') {
      // FIX: เหมือนกันเป๊ะ
      return order;
    }
    // play: shuffle
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    return order;
  }

  function startNextGoal() {
    const key = goalQueue[goalIndex % goalQueue.length] || 1;
    const g = groupByKey(key);

    // targets for each goal depends on diff + time
    const base = (diffKey === 'easy') ? 7 : (diffKey === 'hard' ? 10 : 8);
    const target = base + (runMode === 'play' ? Math.floor(rng()*3) : 0);

    goal = {
      groupKey: key,
      target,
      prog: 0,
      label: `${g.name} ${g.icon}`
    };

    coach(`เริ่มเลย! หมู่ปัจจุบัน: ${g.name} ${g.icon}`);

    emitQuestUpdate();
    logEvent({ kind:'goal_start', groupKey:key, target, mode:runMode, diff:diffKey, t: timeLeft });
  }

  function finishGoal() {
    const g = groupByKey(goal.groupKey);
    coach(`✅ GOAL ผ่าน! ${g.name} ${g.icon}`);
    logEvent({ kind:'goal_clear', groupKey:goal.groupKey, score, comboMax, misses, t: timeLeft });

    // reward shield
    shield += 1;
    dispatchScore();

    goalIndex++;
    startNextGoal();
  }

  function buildMiniQueueResearch() {
    // FIX SEQUENCE เพื่อวิจัย
    return [
      { type:'collect', n:4 },
      { type:'avoid', sec:9 },
      { type:'streak', n:3 },
      { type:'rush', n:5, sec:8, noJunk:true },
    ];
  }

  function startMini(def) {
    if (!def) { mini = null; emitQuestUpdate(); return; }

    if (def.type === 'collect') {
      mini = {
        type:'collect',
        label:`เก็บหมู่ปัจจุบัน ${def.n} ชิ้น`,
        target:def.n,
        prog:0,
        t0: now()
      };
      coach(`⭐ MINI: ${mini.label}`);
    } else if (def.type === 'avoid') {
      mini = {
        type:'avoid',
        label:`ห้ามโดนขยะ ${def.sec} วิ`,
        target:def.sec,
        prog:0,
        t0: now(),
        fail:false
      };
      coach(`⭐ MINI: ${mini.label}`);
    } else if (def.type === 'streak') {
      mini = {
        type:'streak',
        label:`Perfect ติดกัน ${def.n} ครั้ง`,
        target:def.n,
        prog:0,
        t0: now()
      };
      coach(`⭐ MINI: ${mini.label}`);
    } else if (def.type === 'rush') {
      mini = {
        type:'rush',
        label:`Plate Rush: ครบ ${def.n} ใน ${def.sec} วิ`,
        target:def.n,
        prog:0,
        t0: now(),
        sec:def.sec,
        noJunk: !!def.noJunk,
        fail:false
      };
      coach(`⭐ MINI: ${mini.label}${mini.noJunk ? ' (ห้ามโดนขยะ!)' : ''}`);
    } else {
      mini = null;
    }

    emitQuestUpdate();
    logEvent({ kind:'mini_start', type: mini ? mini.type : 'none', label: mini ? mini.label : '', t: timeLeft });
  }

  function finishMini(ok) {
    if (!mini) return;

    if (ok) {
      coach('⭐ MINI ผ่าน!');
      logEvent({ kind:'mini_clear', type: mini.type, score, comboMax, misses, t: timeLeft });
      // reward
      shield += 1;
      dispatchScore();
      // celebration
      dispatch('hha:celebrate', { kind:'mini', type:'mini' });
    } else {
      coach('❌ MINI ไม่ผ่าน ลองใหม่!');
      logEvent({ kind:'mini_fail', type: mini.type, score, comboMax, misses, t: timeLeft });
    }

    // next mini
    if (runMode === 'research') {
      const nextDef = miniQueue.shift();
      startMini(nextDef);
    } else {
      // play: random pick
      const defs = [
        { type:'collect', n: (diffKey==='hard'?5:4) },
        { type:'avoid', sec: 9 },
        { type:'streak', n: 3 },
        { type:'rush', n: (diffKey==='hard'?6:5), sec: 8, noJunk:true }
      ];
      startMini(pick(defs, rng));
    }
  }

  function emitQuestUpdate() {
    const g = goal ? groupByKey(goal.groupKey) : null;

    const gLabel = goal ? `${goal.label}` : '—';
    const gProg = goal ? goal.prog : 0;
    const gTar  = goal ? goal.target : 0;

    const mLabel = mini ? mini.label : '—';
    const mProg  = mini ? mini.prog : 0;
    const mTar   = mini ? mini.target : 0;

    // IMPORTANT: HTML ของคุณอ่าน d.goal / d.mini แบบนี้
    dispatch('quest:update', {
      goal: goal ? { label: gLabel, prog: gProg, target: gTar, groupKey: goal.groupKey, groupName: g ? g.name : '' } : null,
      mini: mini ? { label: mLabel, prog: mProg, target: mTar, type: mini.type } : null
    });
  }

  // ---------------- Coach / Score / Rank ----------------
  function coach(text) { dispatch('hha:coach', { text: String(text || '') }); }

  function dispatchScore() {
    dispatch('hha:score', { score, combo, misses, shield });
  }

  function gradeFrom() {
    const hits = Math.max(0, scoreHitsGood + scoreHitsJunk + scoreHitsDecoy + scoreHitsBoss);
    const good = scoreHitsGood + scoreHitsBoss;
    const acc = hits > 0 ? good / hits : 0;

    // very simple SSS..C
    // emphasize accuracy + combo
    const v = (acc * 0.72) + (clamp(comboMax / 18, 0, 1) * 0.28);

    if (v >= 0.92) return 'SSS';
    if (v >= 0.86) return 'SS';
    if (v >= 0.78) return 'S';
    if (v >= 0.66) return 'A';
    if (v >= 0.54) return 'B';
    return 'C';
  }

  function dispatchRank() {
    dispatch('hha:rank', { grade: gradeFrom() });
  }

  // ---------------- Fever ----------------
  function setFever(p) {
    fever = clamp(p, 0, 1);
    try { FeverUI.setFever(fever); } catch (_) {}
    dispatch('hha:fever', { pct: fever });
  }

  function bumpFever(up) {
    setFever(fever + up);
    try { FeverUI.pulse && FeverUI.pulse(); } catch (_) {}
  }

  // ---------------- Hit / Miss logic ----------------
  let scoreHitsGood = 0;
  let scoreHitsJunk = 0;
  let scoreHitsDecoy = 0;
  let scoreHitsBoss = 0;
  let perfectStreak = 0;

  function isGoodTarget(t) {
    return t && (t.kind === 'good' || t.kind === 'boss') && goal && t.groupKey === goal.groupKey;
  }

  function isWrongTarget(t) {
    // junk/decoy หรือ good ที่ไม่ใช่หมู่ปัจจุบัน
    if (!t) return false;
    if (t.kind === 'junk' || t.kind === 'decoy') return true;
    if (t.kind === 'good' && goal && t.groupKey !== goal.groupKey) return true;
    if (t.kind === 'boss' && goal && t.groupKey !== goal.groupKey) return true;
    return false;
  }

  function award(points, isPerfect) {
    score += points;
    combo += 1;
    comboMax = Math.max(comboMax, combo);

    if (isPerfect) {
      perfectStreak += 1;
      bumpFever(0.06);
    } else {
      perfectStreak = 0;
      bumpFever(0.03);
    }

    // shield every 10 combo
    if (combo > 0 && combo % 10 === 0) {
      shield += 1;
    }

    dispatchScore();
    dispatchRank();
  }

  function penalize() {
    // miss consumes combo
    combo = 0;
    perfectStreak = 0;
    setFever(fever - 0.14);
    dispatchScore();
    dispatchRank();
  }

  function countMiss(reason) {
    misses += 1;
    penalize();
    logEvent({ kind:'miss', reason, score, misses, t: timeLeft });
  }

  function hitFX(t, points, judge, px, py) {
    const w = innerWidth || 360;
    const h = innerHeight || 640;
    const x = (typeof px === 'number') ? px : (t.x * w);
    const y = (typeof py === 'number') ? py : (t.y * h);

    try { Particles.burstAt && Particles.burstAt(x, y, judge); } catch (_) {}
    try { Particles.scorePop && Particles.scorePop(`+${points}`, x, y, judge); } catch (_) {}
  }

  function onHit(id, via, meta) {
    const t = alive.get(id);
    if (!t || !running) return;

    // perfect heuristic: tap close to center OR gaze lock shot
    let perfect = false;
    if (via === 'gaze') perfect = true;
    else if (meta && typeof meta.px === 'number') {
      const r = t.el.getBoundingClientRect();
      const cx = (r.left + r.right) * 0.5;
      const cy = (r.top + r.bottom) * 0.5;
      const dx = meta.px - cx;
      const dy = meta.py - cy;
      const dist = Math.sqrt(dx*dx + dy*dy);
      const rad = Math.max(28, Math.min(r.width, r.height) * 0.35);
      perfect = dist <= rad * 0.35;
    }

    // wrong target?
    if (isWrongTarget(t)) {
      // shield blocks wrong
      if (shield > 0) {
        shield -= 1;
        dispatchScore();
        coach('🛡️ Shield กันพลาด!');
        hitFX(t, 0, 'BLOCK', meta && meta.px, meta && meta.py);
        destroyTarget(t, 'hit');
        logEvent({ kind:'blocked', via, targetKind:t.kind, groupKey:t.groupKey, t: timeLeft });
        return;
      }

      // count miss
      setReticle('miss');
      hitFX(t, 0, 'MISS', meta && meta.px, meta && meta.py);
      destroyTarget(t, 'hit');
      countMiss('wrong_hit');
      // mini fail conditions
      if (mini && mini.type === 'avoid') mini.fail = true;
      if (mini && mini.type === 'rush' && mini.noJunk) mini.fail = true;
      emitQuestUpdate();
      return;
    }

    // good/boss handling
    setReticle(perfect ? 'perfect' : 'ok');

    // boss hp
    if (t.kind === 'boss') {
      t.hp -= (via === 'charge') ? 2 : 1;
      scoreHitsBoss += 1;

      if (t._bossFill) {
        const pct = clamp(t.hp / t.maxHp, 0, 1);
        t._bossFill.style.width = Math.round(pct * 100) + '%';
      }

      if (t.hp > 0) {
        // still alive → small reward
        const pts = perfect ? 14 : 10;
        award(pts, perfect);
        hitFX(t, pts, perfect ? 'PERFECT' : 'GOOD', meta && meta.px, meta && meta.py);
        logEvent({ kind:'boss_hit', via, hp:t.hp, score, combo, t: timeLeft });
        return;
      }
      // boss down
      const pts = perfect ? 34 : 28;
      award(pts, perfect);
      hitFX(t, pts, 'BOSS', meta && meta.px, meta && meta.py);
      destroyTarget(t, 'hit');
      logEvent({ kind:'boss_down', via, score, combo, t: timeLeft });
    } else {
      scoreHitsGood += 1;

      const pts = perfect ? 16 : 12;
      award(pts, perfect);
      hitFX(t, pts, perfect ? 'PERFECT' : 'GOOD', meta && meta.px, meta && meta.py);
      destroyTarget(t, 'hit');

      logEvent({ kind:'hit_good', via, perfect, groupKey:t.groupKey, score, combo, t: timeLeft });
    }

    // goal progress
    if (goal && t.groupKey === goal.groupKey) {
      goal.prog += 1;
      if (goal.prog >= goal.target) {
        finishGoal();
      } else {
        emitQuestUpdate();
      }
    }

    // mini progress
    if (mini) {
      if (mini.type === 'collect') {
        mini.prog += 1;
        if (mini.prog >= mini.target) finishMini(true);
      }
      else if (mini.type === 'streak') {
        if (perfect) mini.prog += 1;
        else mini.prog = 0;
        if (mini.prog >= mini.target) finishMini(true);
      }
      else if (mini.type === 'rush') {
        if (mini.fail) {
          finishMini(false);
        } else {
          mini.prog += 1;
          const dt = (now() - mini.t0) / 1000;
          if (dt > mini.sec) {
            finishMini(mini.prog >= mini.target);
          } else if (mini.prog >= mini.target) {
            finishMini(true);
          } else {
            emitQuestUpdate();
          }
        }
      }
    }
  }

  function handleExpiry(t) {
    if (!t || !running) return;

    // expire: if it's "good for current goal" and not hit → miss
    const wasGoalRelevant = goal && t.groupKey === goal.groupKey && (t.kind === 'good' || t.kind === 'boss');

    destroyTarget(t, 'out');

    if (wasGoalRelevant) {
      setReticle('miss');
      countMiss('good_expired');
    }

    // mini rush timer check
    if (mini && mini.type === 'rush') {
      const dt = (now() - mini.t0) / 1000;
      if (dt > mini.sec) {
        finishMini(mini.prog >= mini.target && !mini.fail);
      } else {
        emitQuestUpdate();
      }
    }
  }

  // ---------------- Spawning ----------------
  function decideKind() {
    if (runMode === 'research') {
      // FIX: no random boss/decoy variability, still have junk occasionally but deterministic
      const r = rng();
      if (r < 0.18) return 'junk';
      return 'good';
    }

    // play
    const r = rng();
    const f = fever; // higher fever -> more chaos
    const bossChance = 0.06 + 0.06 * f;
    const decoyChance = 0.10 + 0.08 * f;
    const junkChance = 0.20 + 0.08 * f;

    if (r < bossChance) return 'boss';
    if (r < bossChance + decoyChance) return 'decoy';
    if (r < bossChance + decoyChance + junkChance) return 'junk';
    return 'good';
  }

  function pickGroupForTarget(kind) {
    if (!goal) return 1;

    if (kind === 'good' || kind === 'boss') {
      // mostly current group; in play sometimes wrong-group "good" as trick
      if (runMode === 'play' && rng() < 0.14) {
        const others = GROUPS.map(g => g.key).filter(k => k !== goal.groupKey);
        return pick(others, rng) || goal.groupKey;
      }
      return goal.groupKey;
    }

    if (kind === 'decoy') {
      const others = GROUPS.map(g => g.key).filter(k => k !== goal.groupKey);
      return pick(others, rng) || goal.groupKey;
    }

    // junk has no group, but keep groupKey = 0
    return 0;
  }

  function pickSticker(kind, groupKey) {
    // if user provided external quest API (optional), allow override
    const Q = root.GroupsQuests || root.GROUPS_QUESTS || null;
    try {
      if (Q && typeof Q.pickSticker === 'function') {
        const o = Q.pickSticker({ kind, groupKey, diff: diffKey, mode: runMode, rng });
        if (o && (o.emoji || o.img)) return o;
      }
    } catch (_) {}

    if (kind === 'junk') return { emoji: pick(JUNK, rng), label: 'junk' };

    const g = groupByKey(groupKey || 1);
    const emoji = pick(g.pool, rng) || '🍀';
    return { emoji, label: g.name };
  }

  function spawnOne() {
    if (!running) return;
    if (!layerEl) return;
    if (aliveCount >= cfg.maxAlive) return;

    const kind = decideKind();
    const gk = pickGroupForTarget(kind);

    // size
    let s = cfg.size;

    // play adaptive tweaks
    if (runMode === 'play') {
      // a bit smaller when fever high
      s *= (1 - 0.10 * fever);
      // a bit smaller when combo high
      s *= (1 - 0.06 * clamp(combo / 15, 0, 1));
      s = clamp(s, 0.78, 1.18);
    }

    const pos = pickSpawnXY(s);
    const sticker = pickSticker(kind, gk);

    // life
    let life = cfg.life * 1000;
    if (kind === 'boss') life *= 1.35;
    if (runMode === 'play' && fever > 0.65) life *= 0.88;

    // boss hp
    const hp = (kind === 'boss') ? (diffKey === 'hard' ? 3 : 2) : 1;

    const t = createTarget({
      kind,
      groupKey: gk,
      x: pos.x,
      y: pos.y,
      s,
      lifeMs: life,
      hp,
      emoji: sticker.emoji,
      img: sticker.img,
      label: sticker.label
    });

    if (!t) return;

    // rage (visual) in play mode when fever high
    if (runMode === 'play' && fever > 0.72 && (kind === 'boss' || rng() < 0.18)) {
      t.el.classList.add('rage');
    }
  }

  function startSpawning() {
    stopSpawning();
    spawnTimer = setInterval(() => {
      if (!running) return;

      // research: single target cadence & stable count
      if (runMode === 'research') {
        if (aliveCount < 1) spawnOne();
        return;
      }

      // play: spawn up to maxAlive with pacing
      spawnOne();
      if (diffKey === 'hard' && rng() < 0.22) spawnOne();
      if (fever > 0.70 && rng() < 0.25) spawnOne();
    }, cfg.spawnMs);
  }

  function stopSpawning() {
    if (spawnTimer) { clearInterval(spawnTimer); spawnTimer = 0; }
  }

  // ---------------- Time + clutch ----------------
  function edgePulse(on, beat) {
    if (!edgePulseEl) edgePulseEl = document.getElementById('edgePulse');
    if (!edgePulseEl) return;

    if (!on) {
      edgePulseEl.classList.remove('on', 'beat');
      return;
    }
    edgePulseEl.classList.add('on');
    if (beat) {
      edgePulseEl.classList.remove('beat');
      // reflow
      void edgePulseEl.offsetWidth;
      edgePulseEl.classList.add('beat');
    }
  }

  function tickSecond() {
    if (!running) return;
    timeLeft = Math.max(0, timeLeft - 1);
    dispatch('hha:time', { left: timeLeft });

    // mini avoid progress (seconds survived without junk)
    if (mini && mini.type === 'avoid') {
      if (mini.fail) {
        finishMini(false);
      } else {
        mini.prog = Math.min(mini.target, mini.prog + 1);
        emitQuestUpdate();
        if (mini.prog >= mini.target) finishMini(true);
      }
    }

    // rush time check
    if (mini && mini.type === 'rush') {
      const dt = (now() - mini.t0) / 1000;
      if (dt > mini.sec) {
        finishMini(mini.prog >= mini.target && !mini.fail);
      }
    }

    // clutch last 3 seconds
    if (timeLeft <= 3 && timeLeft > 0) {
      edgePulse(true, true);
      coach(`⏳ ${timeLeft}...`);
      try { navigator.vibrate && navigator.vibrate(35); } catch (_) {}
    } else if (timeLeft === 0) {
      edgePulse(false, false);
    } else {
      edgePulse(false, false);
    }

    if (timeLeft <= 0) {
      stop('time_up');
    }
  }

  function startTimer() {
    stopTimer();
    dispatch('hha:time', { left: timeLeft });
    secTimer = setInterval(tickSecond, 1000);
  }

  function stopTimer() {
    if (secTimer) { clearInterval(secTimer); secTimer = 0; }
  }

  // ---------------- Adaptive (play) ----------------
  let adaptAt = 0;
  let hitsWindow = 0;
  let wrongWindow = 0;

  function onWindowHit(isWrong) {
    hitsWindow++;
    if (isWrong) wrongWindow++;
  }

  function adaptiveUpdate(ts) {
    if (runMode !== 'play') return;
    if (ts - adaptAt < 5000) return;
    adaptAt = ts;

    const acc = hitsWindow > 0 ? (hitsWindow - wrongWindow) / hitsWindow : 0.75;

    // adjust spawn pace + size gently
    if (acc > 0.86 && comboMax >= 6) {
      cfg.spawnMs = Math.max(520, cfg.spawnMs - 40);
      cfg.size = Math.max(0.80, cfg.size - 0.02);
    } else if (acc < 0.62) {
      cfg.spawnMs = Math.min(980, cfg.spawnMs + 45);
      cfg.size = Math.min(1.18, cfg.size + 0.03);
    }

    hitsWindow = 0;
    wrongWindow = 0;
  }

  // ---------------- Gaze loop ----------------
  function gazeLoop(ts) {
    if (!running) return;

    // expire check
    for (const t of alive.values()) {
      if (ts - t.born > t.lifeMs) {
        handleExpiry(t);
      }
    }

    // adaptive
    adaptiveUpdate(ts);

    // gaze lock
    if (gazeOn) {
      const cx = (innerWidth || 360) * 0.5;
      const cy = (innerHeight || 640) * 0.5;
      const t = targetAtPoint(cx, cy);

      if (!t) {
        focusId = null;
        focusAt = 0;
        lockedFired = false;
        chargedFired = false;
        setLockUI(false);
      } else {
        if (focusId !== t.id) {
          focusId = t.id;
          focusAt = ts;
          lockedFired = false;
          chargedFired = false;
        }

        const dt = ts - focusAt;
        const lockProg = clamp(dt / cfg.lockMs, 0, 1);
        const chargeProg = clamp((dt - cfg.lockMs) / cfg.chargeMs, 0, 1);

        // lock UI + visual lock class
        setLockUI(true, t, lockProg, chargeProg);
        t.el.classList.toggle('lock', lockProg >= 0.15);

        // fire burst at lock complete (once)
        if (lockProg >= 1 && !lockedFired) {
          lockedFired = true;
          fireBurstAt(t, 'gaze');
        }

        // fire charged cone (once)
        if (chargeProg >= 1 && !chargedFired) {
          chargedFired = true;
          fireConeAt(t);
        }
      }
    } else {
      setLockUI(false);
    }

    rafId = requestAnimationFrame(gazeLoop);
  }

  function fireBurstAt(tCenter, via) {
    if (!tCenter || !running) return;

    // choose closest targets around center
    const r0 = tCenter.el.getBoundingClientRect();
    const cx = (r0.left + r0.right) * 0.5;
    const cy = (r0.top + r0.bottom) * 0.5;

    const list = [];
    for (const t of alive.values()) {
      const r = t.el.getBoundingClientRect();
      const tx = (r.left + r.right) * 0.5;
      const ty = (r.top + r.bottom) * 0.5;
      const dx = tx - cx, dy = ty - cy;
      const d2 = dx*dx + dy*dy;
      list.push({ t, d2, tx, ty });
    }
    list.sort((a,b)=>a.d2 - b.d2);

    const n = cfg.burst;
    for (let i=0; i<Math.min(n, list.length); i++) {
      const it = list[i];
      // treat as gaze hits
      onHit(it.t.id, via, { px: it.tx, py: it.ty });
    }

    coach('🔒 LOCK ยิงเป็นชุด!');
    logEvent({ kind:'lock_burst', n: Math.min(n, list.length), t: timeLeft, score, combo });
  }

  function fireConeAt(tCenter) {
    if (!tCenter || !running) return;

    const r0 = tCenter.el.getBoundingClientRect();
    const cx = (r0.left + r0.right) * 0.5;
    const cy = (r0.top + r0.bottom) * 0.5;

    // cone radius based on diff
    const rad = (diffKey === 'hard') ? 180 : (diffKey === 'easy' ? 150 : 165);

    const hits = [];
    for (const t of alive.values()) {
      const r = t.el.getBoundingClientRect();
      const tx = (r.left + r.right) * 0.5;
      const ty = (r.top + r.bottom) * 0.5;
      const dx = tx - cx, dy = ty - cy;
      if ((dx*dx + dy*dy) <= rad*rad) {
        hits.push({ id: t.id, tx, ty });
      }
    }

    // cap
    const capped = hits.slice(0, cfg.coneMax);
    for (const it of capped) {
      onHit(it.id, 'charge', { px: it.tx, py: it.ty });
    }

    coach('⚡ CHARGE! Piercing แบบ Cone!');
    logEvent({ kind:'charge_cone', n: capped.length, t: timeLeft, score, combo });
  }

  // ---------------- Tap-anywhere ----------------
  function onLayerPointerDown(ev) {
    if (!running) return;
    const px = ev.clientX, py = ev.clientY;
    const t = nearestToPoint(px, py);
    if (!t) return;

    // classify wrong/good for adaptive window stats quickly
    onWindowHit(isWrongTarget(t));

    onHit(t.id, 'tap', { px, py });
  }

  // ---------------- Public API ----------------
  function resetStats() {
    score = 0; combo = 0; comboMax = 0; misses = 0; shield = 0;
    fever = 0;
    scoreHitsGood = 0;
    scoreHitsJunk = 0;
    scoreHitsDecoy = 0;
    scoreHitsBoss = 0;
    perfectStreak = 0;

    hitsWindow = 0;
    wrongWindow = 0;

    dispatchScore();
    dispatchRank();
    setFever(0);
  }

  function initRng() {
    if (runMode === 'research') {
      // FIX seed: เหมือนกันเป๊ะทุกคน
      rng = makeRng('HHA_GROUPS_RESEARCH_' + diffKey);
    } else {
      // play: seed varies (still reproducible if you want)
      const sid = (() => {
        try {
          const p = JSON.parse(sessionStorage.getItem('HHA_STUDENT_PROFILE') || '{}');
          return p.studentId || p.sid || '';
        } catch { return ''; }
      })();
      const salt = String(Date.now());
      rng = makeRng('HHA_GROUPS_PLAY_' + diffKey + '_' + sid + '_' + salt);
    }
  }

  function start(_diffKey, opts) {
    if (running) stop('restart');
    diffKey = (String(_diffKey || 'normal').toLowerCase());
    if (!DIFF[diffKey]) diffKey = 'normal';

    runMode = (opts && String(opts.runMode || 'play').toLowerCase() === 'research') ? 'research' : 'play';

    // base cfg copy
    cfg = Object.assign({}, DIFF[diffKey]);
    initRng();

    edgePulseEl = document.getElementById('edgePulse');

    resetStats();
    clearAllTargets();

    // quests
    goalQueue = buildGoalQueue(runMode);
    goalIndex = 0;
    startNextGoal();

    miniQueue = (runMode === 'research') ? buildMiniQueueResearch() : [];
    if (runMode === 'research') startMini(miniQueue.shift());
    else startMini(pick([{type:'collect',n:4},{type:'avoid',sec:9},{type:'streak',n:3}], rng));

    running = true;
    tStart = now();
    adaptAt = tStart;

    // bind layer tap-anywhere
    if (layerEl) {
      layerEl.addEventListener('pointerdown', onLayerPointerDown, { passive: true });
    }

    // timers
    startTimer();
    startSpawning();

    rafId = requestAnimationFrame(gazeLoop);

    coach(runMode === 'research'
      ? `โหมดวิจัย: FIX ตัวแปร (เหมือนกันเป๊ะ) ✅`
      : `โหมดเล่น: สุ่ม + Adaptive + Rush/Boss/Decoy 🔥`
    );

    logSession({
      game: 'GroupsVR',
      mode: runMode,
      diff: diffKey,
      timeTotal: totalSec,
      startedAt: Date.now()
    });

    logEvent({ kind:'start', mode:runMode, diff:diffKey, timeTotal: totalSec });
  }

  function stop(reason) {
    if (!running) return;
    running = false;

    stopSpawning();
    stopTimer();

    if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }

    // unbind tap-anywhere
    if (layerEl) {
      layerEl.removeEventListener('pointerdown', onLayerPointerDown);
    }

    setLockUI(false);
    edgePulse(false, false);

    // final rank
    dispatchRank();

    // end event for HUD binder if needed
    dispatch('hha:end', {
      reason: reason || 'stop',
      score, comboMax, misses, shield,
      grade: gradeFrom(),
      mode: runMode,
      diff: diffKey
    });

    coach(`จบแล้ว! คะแนน ${score} | เกรด ${gradeFrom()}`);

    logEvent({
      kind:'end',
      reason: reason || 'stop',
      score, comboMax, misses, shield,
      grade: gradeFrom(),
      mode: runMode,
      diff: diffKey,
      playedSec: Math.max(0, (totalSec - timeLeft))
    });

    clearAllTargets();
  }

  function setLayerEl(el) { layerEl = el || null; }
  function setCameraEl(el) { camEl = el || null; }
  function setGaze(on) { gazeOn = !!on; if (!gazeOn) setLockUI(false); }
  function setTimeLeft(sec) {
    totalSec = clamp(parseInt(sec || 70, 10) || 70, 20, 600);
    timeLeft = totalSec;
    lastTickSec = -1;
    dispatch('hha:time', { left: timeLeft });
  }

  // Export
  root.GroupsVR = root.GroupsVR || {};
  root.GroupsVR.GameEngine = {
    start,
    stop,
    setLayerEl,
    setCameraEl,
    setGaze,
    setTimeLeft
  };

})(typeof window !== 'undefined' ? window : globalThis);