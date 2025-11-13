// === /HeroHealth/modes/groups.safe.js (2025-11-13 GROUP-FOCUS) ===
// โหมด Food Groups
// - แตะเฉพาะ "หมู่ที่กำหนด" เป็นเป้าหมาย (target groups)
// - ผิดหมู่ = พลาด / คอมโบหลุด / นับ miss
// - ปรับความยากอัตโนมัติ: เพิ่มจำนวนหมู่ที่ต้องโฟกัส 1 → 2 → 3 ตามฝีมือ
// - ส่ง Goal / Mini quest ผ่าน MissionDeck + quest-hud.js

import { boot as factoryBoot } from '../vr/mode-factory.js';
import { MissionDeck } from '../vr/mission.js';
import { ensureFeverBar, setFever, setFeverActive, setShield } from '../vr/ui-fever.js';
import { Particles } from '../vr/particles.js';

// --------- Coach helper (HUD ฝั่ง DOM จะไปฟัง event coach:say / coach:toast เอง) ---------
function coach(msg, tier = 'info') {
  try {
    window.dispatchEvent(new CustomEvent('coach:say', { detail: { msg, tier } }));
  } catch (_) {}
}
function coachToast(msg) {
  try {
    window.dispatchEvent(new CustomEvent('coach:toast', { detail: { msg } }));
  } catch (_) {}
}

// --------- Food Groups (หมู่ 1–5) ----------
const GROUPS = {
  1: {
    id: 1,
    name: 'หมู่ 1 โปรตีน',
    emojis: ['🍗','🍖','🥩','🍳','🧀','🥚','🐟','🍤','🥛','🍣']
  },
  2: {
    id: 2,
    name: 'หมู่ 2 ผัก',
    emojis: ['🥦','🥕','🥬','🍅','🧄','🧅','🌽','🥒','🍆']
  },
  3: {
    id: 3,
    name: 'หมู่ 3 ผลไม้',
    emojis: ['🍎','🍌','🍓','🍊','🍇','🍍','🥝','🍉','🍐','🍑']
  },
  4: {
    id: 4,
    name: 'หมู่ 4 ข้าว-แป้ง',
    emojis: ['🍚','🍙','🍞','🥖','🥐','🥨','🥯','🥞','🧇','🍝','🍜']
  },
  5: {
    id: 5,
    name: 'หมู่ 5 ขนม/น้ำตาล',
    emojis: ['🍔','🍟','🍕','🍩','🍪','🍰','🍫','🍬','🧁','🥤','🧋']
  }
};

// map emoji → หมู่
const CHAR_GROUP = new Map();
Object.values(GROUPS).forEach(g => {
  g.emojis.forEach(ch => CHAR_GROUP.set(ch, g.id));
});

// รวมพูลทั้งหมด
const ALL_EMOJIS = Object.values(GROUPS).flatMap(g => g.emojis);

// --------- Goal / Mini Quest ผ่าน MissionDeck ----------
const G = {
  target: s => s.goodTarget | 0,   // แตะถูก "หมู่เป้าหมาย"
  off:    s => s.goodOff | 0,      // แตะถูกแต่ "ผิดหมู่"
  miss:   s => s.miss | 0,         // ผิดหมู่ + พลาดเป้า
  combo:  s => s.comboMax | 0,
  score:  s => s.score | 0,
  tick:   s => s.tick | 0
};

const GOAL_POOL = [
  {
    id:'g_target16',
    label:'เลือกหมู่เป้าหมายให้ถูก 16 ชิ้น',
    level:'easy',
    target:16,
    check:s => G.target(s) >= 16,
    prog :s => Math.min(16, G.target(s))
  },
  {
    id:'g_target26',
    label:'เลือกหมู่เป้าหมายให้ถูก 26 ชิ้น',
    level:'normal',
    target:26,
    check:s => G.target(s) >= 26,
    prog :s => Math.min(26, G.target(s))
  },
  {
    id:'g_target34',
    label:'เลือกหมู่เป้าหมายให้ถูก 34 ชิ้น',
    level:'hard',
    target:34,
    check:s => G.target(s) >= 34,
    prog :s => Math.min(34, G.target(s))
  },
  {
    id:'g_score1500',
    label:'ทำคะแนนรวม 1500+',
    level:'normal',
    target:1500,
    check:s => G.score(s) >= 1500,
    prog :s => Math.min(1500, G.score(s))
  },
  {
    id:'g_combo18',
    label:'คอมโบสูงสุด ≥ 18',
    level:'hard',
    target:18,
    check:s => G.combo(s) >= 18,
    prog :s => Math.min(18, G.combo(s))
  },
  {
    id:'g_miss6',
    label:'พลาดไม่เกิน 6 ครั้ง',
    level:'normal',
    target:6,
    check:s => G.miss(s) <= 6,
    prog :s => Math.max(0, 6 - G.miss(s))
  }
];

const MINI_POOL = [
  {
    id:'m_target12',
    label:'เลือกหมู่เป้าหมายให้ถูก 12 ชิ้น',
    level:'easy',
    target:12,
    check:s => G.target(s) >= 12,
    prog :s => Math.min(12, G.target(s))
  },
  {
    id:'m_combo10',
    label:'คอมโบต่อเนื่อง 10',
    level:'normal',
    target:10,
    check:s => G.combo(s) >= 10,
    prog :s => Math.min(10, G.combo(s))
  },
  {
    id:'m_score900',
    label:'ทำคะแนนรวม 900+',
    level:'easy',
    target:900,
    check:s => G.score(s) >= 900,
    prog :s => Math.min(900, G.score(s))
  },
  {
    id:'m_miss4',
    label:'พลาดไม่เกิน 4 ครั้ง',
    level:'normal',
    target:4,
    check:s => G.miss(s) <= 4,
    prog :s => Math.max(0, 4 - G.miss(s))
  }
];

// --------- ฟังก์ชันสุ่มหมู่เป้าหมาย / ความยาก ----------
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export async function boot(cfg = {}) {
  const diff = String(cfg.difficulty || 'normal');
  const dur  = Number(cfg.duration  || 60);

  ensureFeverBar(); setFever(0); setShield(0); setFeverActive(false);

  const deck = new MissionDeck({ goalPool: GOAL_POOL, miniPool: MINI_POOL });
  deck.drawGoals(3);
  deck.draw3();

  // สถิติเพิ่มของ groups
  deck.stats.goodTarget = 0; // แตะถูกหมู่เป้าหมาย
  deck.stats.goodOff    = 0; // แตะถูกแต่คนละหมู่
  deck.stats.miss       = 0; // ผิดหมู่ / ปล่อยเป้าหมายหลุด

  // สถานะเกม
  let score = 0, combo = 0, fever = 0, feverActive = false;

  function mult() { return feverActive ? 2 : 1; }
  function syncStats() {
    deck.updateScore(score);
    deck.updateCombo(combo);
  }

  function gainFever(n) {
    fever = Math.max(0, Math.min(100, fever + n));
    setFever(fever);
    if (!feverActive && fever >= 100) {
      feverActive = true;
      setFeverActive(true);
      coach('FEVER! แตะหมู่เป้าหมายให้ยับเลย!', 'good');
    }
  }
  function decayFever(n) {
    const d = feverActive ? 10 : n;
    fever = Math.max(0, fever - d);
    setFever(fever);
    if (feverActive && fever <= 0) {
      feverActive = false;
      setFeverActive(false);
    }
  }

  // ---- หมู่ที่ต้องโฟกัส ณ ปัจจุบัน ----
  let focusCount = diff === 'easy' ? 1 : (diff === 'hard' ? 3 : 2); // เริ่ม 1/2/3 ตามระดับ
  let activeGroups = new Set([1]); // จะถูก random ด้านล่าง
  let lastFocusKey = '';

  function pickActiveGroups() {
    const ids = shuffle(Object.keys(GROUPS).map(Number));
    const use = ids.slice(0, focusCount);
    activeGroups = new Set(use);
    const names = use.map(id => GROUPS[id]?.name || `หมู่ ${id}`).join(' + ');
    const key = use.join(',');
    if (key !== lastFocusKey) {
      lastFocusKey = key;
      coach(`รอบนี้ให้โฟกัส: ${names}`, 'info');
      coachToast(`โฟกัสเพิ่มเป็น ${use.length} หมู่`);
    }
  }

  pickActiveGroups();

  // ส่ง quest ไปให้ HUD (เอาตัวแรกที่ยังไม่เสร็จของแต่ละชุด)
  function pushQuest(hint) {
    const goals = deck.getProgress('goals');
    const minis = deck.getProgress('mini');
    const focusGoal = goals.find(g => !g.done) || goals[0] || null;
    const focusMini = minis.find(m => !m.done) || minis[0] || null;

    window.dispatchEvent(new CustomEvent('quest:update', {
      detail: {
        goal: focusGoal,
        mini: focusMini,
        goalsAll: goals,
        minisAll: minis,
        hint,
        mode: 'groups'
      }
    }));
  }

  pushQuest('เริ่มรอบหมู่เป้าหมาย');

  // ---------- Judge: ตัดสินจากหมู่ ----------
  function judge(ch, ctx) {
    const gx = CHAR_GROUP.get(ch) || 0;
    const isTarget = activeGroups.has(gx);

    const x = ctx.clientX || ctx.cx || 0;
    const y = ctx.clientY || ctx.cy || 0;

    let delta = 0;
    let good = false;

    if (isTarget) {
      // ถูกหมู่เป้าหมาย
      const base = 18 + combo * 2;
      delta = base * mult();
      score += delta;
      combo += 1;
      deck.stats.goodTarget += 1;
      gainFever(7 + combo * 0.4);
      Particles.burstShards?.(null, null, { screen:{x,y}, theme:'groups' });
      Particles.scorePop?.(x, y, delta, true);
      coach('ยอดเยี่ยม! เลือกหมู่ถูกต้อง', 'good');
      good = true;
    } else {
      // ผิดหมู่
      delta = -14;
      score = Math.max(0, score + delta);
      combo = 0;
      deck.stats.miss += 1;
      decayFever(16);
      Particles.burstShards?.(null, null, { screen:{x,y}, theme:'bad' });
      Particles.scorePop?.(x, y, delta, false);
      coach('อันนี้ไม่ใช่หมู่เป้าหมายนะ ลองดูดี ๆ', 'warn');
      good = false;
    }

    syncStats();
    pushQuest();

    return { good, scoreDelta: delta };
  }

  // ---------- onExpire: เป้าหมายหลุดจอ ----------
  function onExpire(info) {
    const ch = info?.ch || info?.char;
    const gx = CHAR_GROUP.get(ch) || 0;
    const isTarget = activeGroups.has(gx);

    if (!isTarget) return; // ไม่ใช่เป้า ไม่ถือว่าพลาด

    deck.stats.miss += 1;
    combo = 0;
    decayFever(10);
    syncStats();
    pushQuest();
  }

  // ---------- tick ต่อวินาที ----------
  function onSec() {
    if (combo <= 0) decayFever(6);
    else decayFever(2);

    deck.second();
    syncStats();
    pushQuest();

    // ขยับความยาก: เพิ่มจำนวนหมู่ที่ต้องโฟกัสเมื่อเล่นดี
    const t = deck.stats.goodTarget | 0;
    if (t >= 30 && focusCount < 3) {
      focusCount = 3;
      pickActiveGroups();
    } else if (t >= 16 && focusCount < 2) {
      focusCount = 2;
      pickActiveGroups();
    }
  }

  window.addEventListener('hha:expired', onExpire);
  window.addEventListener('hha:time', (e) => {
    const sec = e.detail?.sec | 0;
    if (sec >= 0) onSec();
  });

  // ---------- เริ่มโรงงาน spawn ----------
  return factoryBoot({
    difficulty : diff,
    duration   : dur,
    pools      : { good: ALL_EMOJIS, bad: [] }, // ทุกอันคือ "อาหาร" แยกโดยหมู่
    goodRate   : 1.0,      // ไม่มีของเสียแบบ goodjunk
    judge      : (ch, ctx) => judge(ch, { ...ctx, cx:(ctx.clientX || ctx.cx), cy:(ctx.clientY || ctx.cy) }),
    onExpire
  }).then(ctrl => {
    // ส่งสรุปเมื่อหมดเวลา
    window.addEventListener('hha:time', (e) => {
      const sec = e.detail?.sec | 0;
      if (sec <= 0) {
        const goals = deck.getProgress('goals');
        const goalCleared = goals.length > 0 && goals.every(g => g.done);
        const minis = deck.getProgress('mini');

        window.dispatchEvent(new CustomEvent('hha:end', {
          detail: {
            mode: 'groups',
            difficulty: diff,
            score,
            comboMax: deck.stats.comboMax,
            misses: deck.stats.miss,
            hits: deck.stats.goodTarget,
            duration: dur,
            goalCleared,
            questsCleared: minis.filter(m => m.done).length,
            questsTotal: minis.length
          }
        }));
      }
    });

    pushQuest('เริ่มรอบแรกของหมู่เป้าหมาย');
    return ctrl;
  });
}

export default { boot };