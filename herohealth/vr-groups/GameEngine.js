// === /herohealth/vr-groups/GameEngine.js ===
// Food Groups VR — Emoji Targets + Quest + HUD Stat
// ใช้ร่วมกับ:
//   - difficulty.foodgroups.js   (HeroHealth.foodGroupsDifficulty.get())
//   - quest-manager.js           (GAME_MODULES.GroupsQuestManager)
//   - ui-fever.js                (FeverUI.*)
//   - groups-vr.html            (import { GameEngine } from './vr-groups/GameEngine.js')

const ROOT = (typeof window !== 'undefined' ? window : globalThis);
const A = ROOT.AFRAME;

// ถ้าไม่มี A-Frame ให้จบก่อน (กัน error บนหน้าอื่น)
if (!A) {
  console.error('[GroupsVR] AFRAME not found');
}

// ---- Helper & Config ----

function clamp (v, min, max) {
  v = Number(v) || 0;
  if (v < min) return min;
  if (v > max) return max;
  return v;
}

function randRange (min, max) {
  return min + Math.random() * (max - min);
}

// ตารางหมู่ 5 หมู่เดียวกับ Plate
const GROUPS = {
  1: ['🍚', '🍙', '🍞', '🥯', '🥐'],                 // ข้าว-แป้ง
  2: ['🥩', '🍗', '🍖', '🥚', '🧀'],                 // โปรตีน
  3: ['🥦', '🥕', '🥬', '🌽', '🥗', '🍅'],            // ผัก
  4: ['🍎', '🍌', '🍇', '🍉', '🍊', '🍓', '🍍'],      // ผลไม้
  5: ['🥛', '🧈', '🧀', '🍨']                         // นม / ผลิตภัณฑ์นม
};

const GOOD_EMOJI = Object.values(GROUPS).flat();
const BAD_EMOJI  = ['🍔', '🍟', '🍕', '🍩', '🍪', '🧋', '🥤', '🍫', '🍬', '🥓'];

function classifyEmoji (ch) {
  for (const [gid, list] of Object.entries(GROUPS)) {
    if (list.includes(ch)) {
      return { isGood: true, groupId: Number(gid) };
    }
  }
  return { isGood: false, groupId: 0 };
}

// difficulty จาก HeroHealth.foodGroupsDifficulty
function pickDifficulty (diffKey) {
  const ns = ROOT.HeroHealth || (ROOT.HeroHealth = {});
  if (ns.foodGroupsDifficulty && typeof ns.foodGroupsDifficulty.get === 'function') {
    return ns.foodGroupsDifficulty.get(diffKey);
  }
  // fallback เผื่อไม่ได้โหลดไฟล์ difficulty
  const table = {
    easy:   { spawnInterval: 1300, lifetime: 2800, maxActive: 3, scale: 1.25, feverGainHit: 8, feverLossMiss: 12 },
    normal: { spawnInterval: 1000, lifetime: 2200, maxActive: 4, scale: 1.00, feverGainHit: 7, feverLossMiss: 16 },
    hard:   { spawnInterval: 800,  lifetime: 1900, maxActive: 5, scale: 0.90, feverGainHit: 6, feverLossMiss: 22 }
  };
  const key = String(diffKey || 'normal').toLowerCase();
  return table[key] || table.normal;
}

// เกรดง่าย ๆ: เน้นภารกิจ + คะแนน รวมกับ miss นิดหน่อย
function computeGrade (stats, qSummary) {
  const score     = Number(stats.score)     || 0;
  const misses    = Number(stats.misses)    || 0;
  const comboMax  = Number(stats.comboMax)  || 0;

  const cleared   = Number(qSummary.cleared)   || 0;
  const total     = Number(qSummary.total)     || 0;
  const questRate = total > 0 ? cleared / total : 0;

  const scoreNorm = Math.min(1, score / 500);     // 500 = ดี
  const comboNorm = Math.min(1, comboMax / 10);   // combo 10 = ดี
  const missPenalty = Math.min(0.4, misses * 0.03);

  let idx = 0;
  idx += questRate * 0.5;
  idx += scoreNorm * 0.3;
  idx += comboNorm * 0.2;
  idx -= missPenalty;
  idx = clamp(idx, 0, 1);

  if (idx >= 0.88) return 'SSS';
  if (idx >= 0.78) return 'SS';
  if (idx >= 0.68) return 'S';
  if (idx >= 0.58) return 'A';
  if (idx >= 0.42) return 'B';
  return 'C';
}

// Fever UI (ถ้ามีโหลด ui-fever.js)
const FeverUI =
  (ROOT.GAME_MODULES && ROOT.GAME_MODULES.FeverUI) ||
  ROOT.FeverUI ||
  {
    ensureFeverBar () {},
    setFever () {},
    setFeverActive () {},
    setShield () {}
  };

const { ensureFeverBar, setFever, setFeverActive } = FeverUI;

const FEVER_MAX = 100;

// QuestManager จาก quest-manager.js
function createQuestManager () {
  const gm = ROOT.GAME_MODULES && ROOT.GAME_MODULES.GroupsQuestManager;
  if (!gm) return null;
  return new gm();
}

// -------------------------------------------------------------------------
// Engine หลัก
// -------------------------------------------------------------------------

export async function start (options = {}) {
  const diffKeyRaw = String(options.difficulty || 'normal').toLowerCase();
  const diffKey = (diffKeyRaw === 'easy' || diffKeyRaw === 'hard' || diffKeyRaw === 'normal')
    ? diffKeyRaw
    : 'normal';

  let duration = Number(options.duration || 60);
  if (!Number.isFinite(duration) || duration <= 0) duration = 60;
  if (duration < 20) duration = 20;
  if (duration > 180) duration = 180;

  const sceneEl = ROOT.document && ROOT.document.querySelector('a-scene');
  if (!sceneEl) {
    console.error('[GroupsVR] <a-scene> not found');
    return { stop () {} };
  }

  const diffCfg = pickDifficulty(diffKey);

  // เรียก Fever gauge ให้พร้อม
  ensureFeverBar();
  setFever(0);
  setFeverActive(false);

  // Quest manager สำหรับ goal + mini
  const questMgr = createQuestManager();
  if (questMgr && typeof questMgr.start === 'function') {
    questMgr.start(diffKey, {
      quest: { goalsPick: 2, miniPick: 3 }
    });
  }

  // ----- State หลัก -----
  let score = 0;
  let combo = 0;
  let comboMax = 0;
  let misses = 0;
  let fever = 0;

  let ended = false;
  let spawnTimer = null;
  let durationTimer = null;

  const targets = []; // เก็บเป้าที่ยังอยู่ในฉาก

  // ------------------------------------------------------
  // Helper: Quest summary + ยิง hha:stat
  // ------------------------------------------------------
  function getQuestSummary () {
    if (!questMgr || typeof questMgr.getSummary !== 'function') {
      return {
        cleared: 0,
        total: 0,
        clearedGoals: 0,
        clearedMinis: 0,
        totalGoals: 0,
        totalMinis: 0
      };
    }
    return questMgr.getSummary();
  }

  function emitStat () {
    const q = getQuestSummary();
    const grade = computeGrade(
      { score, misses, comboMax },
      { cleared: q.cleared, total: q.total }
    );

    const detail = {
      mode: 'Food Groups',
      difficulty: diffKey,
      score,
      combo,
      misses,
      fever,
      feverActive: fever >= FEVER_MAX,
      grade,
      goalsCleared: q.clearedGoals || 0,
      goalsTotal: q.totalGoals || 0,
      questsCleared: q.clearedMinis || 0,
      questsTotal: q.totalMinis || 0
    };

    try {
      ROOT.dispatchEvent(new CustomEvent('hha:stat', { detail }));
    } catch (err) {
      console.warn('[GroupsVR] hha:stat dispatch failed', err);
    }
  }

  function updateFever (delta) {
    fever = clamp(fever + delta, 0, FEVER_MAX);
    setFever(fever);
    setFeverActive(fever >= FEVER_MAX);
  }

  // ------------------------------------------------------
  // สร้างเป้า
  // ------------------------------------------------------
  function pickEmojiForSpawn () {
    // goodRate = 0.7 (อาหารดีมากกว่าของควรลด)
    const GOOD_RATE = 0.7;
    const isGood = Math.random() < GOOD_RATE;
    let emoji;
    if (isGood) {
      emoji = GOOD_EMOJI[Math.floor(Math.random() * GOOD_EMOJI.length)];
    } else {
      emoji = BAD_EMOJI[Math.floor(Math.random() * BAD_EMOJI.length)];
    }
    const cls = classifyEmoji(emoji);
    return { emoji, isGood: cls.isGood, groupId: cls.groupId };
  }

  function createTargetData () {
    const { emoji, isGood, groupId } = pickEmojiForSpawn();

    // ตำแหน่งด้านหน้า player
    const pos = {
      x: randRange(-1.4, 1.4),
      y: randRange(1.2, 2.1),
      z: randRange(-3.4, -2.3)
    };

    return {
      emoji,
      isGood,
      groupId,
      pos,
      el: null,
      dead: false,
      expireTimer: null
    };
  }

  function handleHit (target, ev) {
    if (ended || target.dead) return;
    target.dead = true;
    if (target.expireTimer) {
      clearTimeout(target.expireTimer);
      target.expireTimer = null;
    }

    if (target.el) {
      target.el.setAttribute('visible', false);
      target.el.removeAttribute('data-hha-tgt');
      target.el.classList.remove('hha-target');
    }

    if (target.isGood) {
      combo += 1;
      comboMax = Math.max(comboMax, combo);
      const gain = 10 + combo * 2;
      score += gain;
      updateFever(diffCfg.feverGainHit || 6);
    } else {
      // นับเป็น miss
      combo = 0;
      misses += 1;
      score = Math.max(0, score - 8);
      updateFever(-(diffCfg.feverLossMiss || 14));
    }

    // ส่งให้ Quest manager
    if (questMgr && typeof questMgr.onHit === 'function') {
      try {
        questMgr.onHit({
          emoji: target.emoji,
          isGood: !!target.isGood,
          groupId: target.groupId || 0,
          pos: target.pos,
          time: performance.now()
        });
      } catch (err) {
        console.warn('[GroupsVR] questMgr.onHit error', err);
      }
    }

    emitStat();
  }

  function handleExpire (target) {
    if (ended || target.dead) return;
    target.dead = true;
    if (target.expireTimer) {
      clearTimeout(target.expireTimer);
      target.expireTimer = null;
    }
    if (target.el) {
      target.el.setAttribute('visible', false);
      target.el.removeAttribute('data-hha-tgt');
      target.el.classList.remove('hha-target');
    }
    // เป้าหลุดจอ = ไม่ถือว่า miss แค่หายไปเฉย ๆ
    emitStat();
  }

  function createTargetEntity (target) {
    const el = ROOT.document.createElement('a-entity');

    const scale = diffCfg.scale || 1.0;
    const radius = 0.28 * scale;

    el.setAttribute('geometry', `primitive: circle; radius: ${radius}`);
    // ใช้ text component ในการแสดง emoji จะไม่เจอปัญหา shader อีก
    el.setAttribute('material', 'shader: flat; color: #ffffff; side: double');
    el.setAttribute('text', `value: ${target.emoji}; align: center; color: #000000; width: 2; zOffset: 0.01`);
    el.setAttribute('position', `${target.pos.x} ${target.pos.y} ${target.pos.z}`);
    el.setAttribute('data-hha-tgt', '1');
    el.classList.add('hha-target');

    // แอนิเมชันลอยขึ้นเล็กน้อย (ใช้ animation component แบบง่าย ๆ)
    const toY = target.pos.y + 0.35;
    el.setAttribute('animation__move', {
      property: 'position',
      to: `${target.pos.x} ${toY} ${target.pos.z}`,
      dur: diffCfg.lifetime || 2200,
      dir: 'alternate',
      loop: 1,
      easing: 'easeOutQuad'
    });

    // คลิกด้วย cursor raycaster
    el.addEventListener('click', (ev) => {
      handleHit(target, ev);
    });

    sceneEl.appendChild(el);
    target.el = el;

    // ตั้งเวลาให้หายไปเอง (ไม่ถือว่า miss)
    const life = diffCfg.lifetime || 2200;
    target.expireTimer = setTimeout(() => {
      handleExpire(target);
    }, life);

    console.log('[GroupsVR] spawn target', {
      emoji: target.emoji,
      isGood: target.isGood,
      gId: target.groupId,
      pos: target.pos
    });
  }

  function spawnLoop () {
    if (ended) return;
    const alive = targets.filter(t => !t.dead);
    if (alive.length >= (diffCfg.maxActive || 4)) return;

    const t = createTargetData();
    targets.push(t);
    createTargetEntity(t);
  }

  function stopAll (reason) {
    if (ended) return;
    ended = true;

    if (spawnTimer) {
      clearInterval(spawnTimer);
      spawnTimer = null;
    }
    if (durationTimer) {
      clearTimeout(durationTimer);
      durationTimer = null;
    }

    targets.forEach(t => {
      t.dead = true;
      if (t.expireTimer) clearTimeout(t.expireTimer);
      if (t.el) {
        t.el.setAttribute('visible', false);
        t.el.removeAttribute('data-hha-tgt');
        t.el.classList.remove('hha-target');
      }
    });

    ROOT.removeEventListener('hha:time', onTimeTick);

    const q = getQuestSummary();
    const grade = computeGrade(
      { score, misses, comboMax },
      { cleared: q.cleared, total: q.total }
    );

    // ยิง stat รอบสุดท้าย
    try {
      ROOT.dispatchEvent(new CustomEvent('hha:stat', {
        detail: {
          mode: 'Food Groups',
          difficulty: diffKey,
          score,
          combo,
          misses,
          fever,
          feverActive: fever >= FEVER_MAX,
          grade,
          goalsCleared: q.clearedGoals || 0,
          goalsTotal: q.totalGoals || 0,
          questsCleared: q.clearedMinis || 0,
          questsTotal: q.totalMinis || 0,
          ended: true,
          reason: reason || 'time'
        }
      }));
    } catch (err) {
      console.warn('[GroupsVR] final hha:stat failed', err);
    }

    // ส่ง hha:end ให้หน้าจอสรุปใช้
    try {
      ROOT.dispatchEvent(new CustomEvent('hha:end', {
        detail: {
          mode: 'Food Groups',
          difficulty: diffKey,
          score,
          misses,
          comboMax,
          duration,
          grade,
          goalsCleared: q.clearedGoals || 0,
          goalsTotal: q.totalGoals || 0,
          questsCleared: q.clearedMinis || 0,
          questsTotal: q.totalMinis || 0
        }
      }));
    } catch (err) {
      console.warn('[GroupsVR] hha:end dispatch failed', err);
    }
  }

  // ให้จับ hha:time จากตัวนับเวลาหลัก (hub)
  function onTimeTick (ev) {
    if (!ev || !ev.detail) return;
    const sec = ev.detail.sec | 0;
    if (sec === 0) {
      stopAll('time');
    }
  }

  ROOT.addEventListener('hha:time', onTimeTick);

  // เริ่ม spawn loop + timer ภายใน (กันกรณีไม่มี hha:time)
  spawnTimer = setInterval(spawnLoop, diffCfg.spawnInterval || 1000);
  durationTimer = setTimeout(() => {
    stopAll('time');
  }, duration * 1000);

  // ยิง stat เริ่มต้น
  emitStat();

  return {
    stop () {
      stopAll('stop');
    }
  };
}

// object สำหรับ import { GameEngine } ...
export const GameEngine = { start };

export default { start };
