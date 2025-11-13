// === /HeroHealth/modes/plate.quest.js (2025-11-14 CLEAR GOAL + STRICT MISS) ===
// โหมด Balanced Plate (5 หมู่)
// - Goal: จัด "จานสมดุล" ให้ครบตามจำนวน goalSets
// - Mini: พลาด (ผิดหมู่ หรือเกินโควต้า) ไม่เกิน maxMiss ครั้ง
// - ใช้ factoryBoot สปอว์นเป้าเหมือนโหมดอื่น และส่ง quest:update + hha:coach + hha:end

import { boot as factoryBoot } from '../vr/mode-factory.js';
import { Particles }           from '../vr/particles.js';

// ---------- Config (ตาม diff) ----------
const DIFF_CFG = {
  easy: {
    duration: 60,
    spawnGap: 520,
    lifeMs  : 2600,
    goalSets: 1,      // จัดให้ครบ 1 จานสมดุล
    maxMiss : 10
  },
  normal: {
    duration: 60,
    spawnGap: 420,
    lifeMs  : 2300,
    goalSets: 2,
    maxMiss : 8
  },
  hard: {
    duration: 60,
    spawnGap: 340,
    lifeMs  : 2000,
    goalSets: 3,
    maxMiss : 6
  }
};

// โควต้า “หนึ่งจานสมดุล” แบบ 5 หมู่ (1–5)
const BASE_QUOTA = { 1: 2, 2: 2, 3: 1, 4: 1, 5: 1 };
// map หมู่ → ชื่อสั้น ๆ ที่จะโชว์ใน HUD / โค้ช
const GROUP_LABEL = {
  1: 'ข้าว-แป้ง',
  2: 'ผัก',
  3: 'ผลไม้',
  4: 'โปรตีน',
  5: 'นม'
};

// emoji → หมู่ (ตัวอย่าง; ปรับเพิ่มในโปรเจกต์จริงได้)
const GROUP_EMOJI = {
  '🍚': 1, '🍞': 1, '🍙': 1, '🍝': 1,
  '🥦': 2, '🥕': 2, '🥬': 2, '🍅': 2,
  '🍎': 3, '🍊': 3, '🍇': 3, '🍌': 3,
  '🍗': 4, '🍖': 4, '🐟': 4, '🥚': 4, '🥩': 4,
  '🥛': 5, '🧀': 5, '🍦': 5 // (นับเป็นนม/นมผสมของหวาน)
};

// ---------- Helper แปลง quota → ข้อความ ----------
function quotaText(q) {
  // q: {1:2,2:2,3:1,4:1,5:1}
  const parts = [];
  Object.keys(q).sort().forEach(k => {
    const n = q[k]|0;
    if (!n) return;
    const label = GROUP_LABEL[k] || `หมู่ ${k}`;
    parts.push(`${label}${n}`);
  });
  return parts.join(' • ');
}

// ---------- HUD / Coach bridge ----------
function sendCoach(text) {
  try {
    window.dispatchEvent(new CustomEvent('hha:coach', { detail: { text } }));
  } catch(_) {}
}

function pushQuestHUD(state) {
  // state: { setsCompleted, goalSets, misses, maxMiss }
  const { setsCompleted, goalSets, misses, maxMiss } = state;
  const quotaStr = quotaText(BASE_QUOTA);

  const goalDone = setsCompleted >= goalSets;
  const miniDone = misses <= maxMiss;

  const goal = {
    id    : 'plate_goal_sets',
    label : `จัดจานสมดุลให้ครบ ${goalSets} ชุด (ต่อจาน: ${quotaStr})`,
    prog  : setsCompleted|0,
    target: goalSets|0,
    done  : goalDone
  };

  const mini = {
    id    : 'plate_miss_limit',
    label : `พลาดไม่เกิน ${maxMiss} ครั้ง (ผิดหมู่ หรือเกินโควต้านับเป็นพลาด)`,
    prog  : misses|0,
    target: maxMiss|0,
    done  : miniDone
  };

  try {
    window.dispatchEvent(new CustomEvent('quest:update', {
      detail: { goal, mini, goalsAll:[goal], minisAll:[mini] }
    }));
  } catch(_) {}
}

// ---------- main boot ----------
export async function boot(cfg = {}) {
  const diff = String(cfg.difficulty || 'normal').toLowerCase();
  const conf = DIFF_CFG[diff] || DIFF_CFG.normal;

  const duration = Number(cfg.duration || conf.duration || 60);

  // สถานะกลาง
  let score        = 0;
  let combo        = 0;
  let comboMax     = 0;
  let misses       = 0;
  let setsCompleted= 0;

  // สถานะแต่ละ “จาน” (quota ที่ยังเหลือในจานปัจจุบัน)
  let filled = {1:0,2:0,3:0,4:0,5:0};

  function resetPlate() {
    filled = {1:0,2:0,3:0,4:0,5:0};
  }

  function isPlateComplete() {
    // ครบฐาน quota เช่น 1:2,2:2,3:1,4:1,5:1
    for (const k in BASE_QUOTA) {
      if ((filled[k]|0) < (BASE_QUOTA[k]|0)) return false;
    }
    return true;
  }

  function handleHitGroup(groupId, x, y) {
    const want = BASE_QUOTA[groupId] | 0;
    const have = filled[groupId]     | 0;

    if (!want) {
      // หมู่นี้ไม่ได้อยู่ใน quota จาน → พลาด
      misses++;
      combo = 0;
      Particles.burstShards(null, null, { screen:{x,y}, theme:'plate_miss' });
      sendCoach('หมู่นี้ไม่ได้อยู่ในโควต้าจานสมดุล ลองเก็บหมู่หลักให้ครบก่อนนะ');
      return -10;
    }

    if (have >= want) {
      // โควต้าหมู่นี้เต็มแล้ว → พลาด
      misses++;
      combo = 0;
      Particles.burstShards(null, null, { screen:{x,y}, theme:'plate_over' });
      sendCoach(`${GROUP_LABEL[groupId]||'หมู่นี้'} เต็มโควต้าแล้ว ลองเก็บหมู่อื่นให้ครบจาน!`);
      return -8;
    }

    // ✅ ถูกหมู่ และไม่เกินโควต้า
    filled[groupId] = have + 1;
    combo++;
    comboMax = Math.max(comboMax, combo);
    const base = 40;
    const delta = base + combo*4;
    score += delta;

    Particles.burstShards(null, null, { screen:{x,y}, theme:'plate_good' });
    window.dispatchEvent(new CustomEvent('hha:score', {
      detail: { delta, good:true, total:score, combo, comboMax }
    }));

    // จานนี้ครบ quota แล้ว → นับครบ 1 จานสมดุล
    if (isPlateComplete()) {
      setsCompleted++;
      resetPlate();
      sendCoach(`เยี่ยม! ครบ 1 จานสมดุลแล้ว (${setsCompleted}/${conf.goalSets})`);
    }

    // อัปเดต HUD เควสต์
    pushQuestHUD({
      setsCompleted,
      goalSets: conf.goalSets,
      misses,
      maxMiss: conf.maxMiss
    });

    return delta;
  }

  // judge สำหรับ mode-factory
  function judge(ch, ctx) {
    const x = ctx.clientX || ctx.cx || 0;
    const y = ctx.clientY || ctx.cy || 0;

    const groupId = GROUP_EMOJI[ch] || 0;
    if (!groupId) {
      // ไม่รู้สังกัดหมู่ → ถือว่าเป็น miss เบา ๆ
      misses++;
      combo = 0;
      Particles.burstShards(null, null, { screen:{x,y}, theme:'plate_unknown' });
      sendCoach('อาหารนี้ไม่อยู่ในหมู่หลักของจานสมดุล ลองเลือกหมู่พื้นฐานดีกว่านะ');
      window.dispatchEvent(new CustomEvent('hha:score',{
        detail:{ delta:-5, good:false, total:score, combo, comboMax }
      }));
      pushQuestHUD({
        setsCompleted,
        goalSets: conf.goalSets,
        misses,
        maxMiss: conf.maxMiss
      });
      return { good:false, scoreDelta:-5 };
    }

    const delta = handleHitGroup(groupId, x, y);
    const good  = delta > 0;

    if (!good) {
      window.dispatchEvent(new CustomEvent('hha:score',{
        detail:{ delta, good:false, total:score, combo, comboMax }
      }));
    }
    // จุดเดียวกันนี้ Particles.scorePop ถูกเรียกจาก vr/particles.js อยู่แล้ว (ถ้าตั้งค่าไว้)

    return { good, scoreDelta: delta };
  }

  function onExpire(ev) {
    // เป้าหมายหมดเวลา:
    // - ถ้าเป็นหมู่ที่อยู่ใน quota และยังไม่เต็ม → นับเป็นพลาดเล็ก ๆ (ผู้เล่นปล่อยให้หลุด)
    if (!ev || !ev.char) return;
    const g = GROUP_EMOJI[ev.char] || 0;
    if (g && (filled[g]|0) < (BASE_QUOTA[g]|0)) {
      misses++;
      combo = 0;
      pushQuestHUD({
        setsCompleted,
        goalSets: conf.goalSets,
        misses,
        maxMiss: conf.maxMiss
      });
    }
  }

  // ฟังเวลา เพื่อ sync quest HUD (เช่น mini miss/progress)
  window.addEventListener('hha:time', (e)=>{
    const sec = (e.detail?.sec|0);
    if (sec === duration) {
      // เริ่มเกม → โชว์โควต้าชัด ๆ
      const quotaStr = quotaText(BASE_QUOTA);
      sendCoach(`จานสมดุล 1 ชุด: ${quotaStr}  รวมทั้งหมด ${conf.goalSets} จานในด่านนี้`);
      pushQuestHUD({
        setsCompleted,
        goalSets: conf.goalSets,
        misses,
        maxMiss: conf.maxMiss
      });
    }
  });

  // เรียก factoryBoot
  const ctrl = await factoryBoot({
    difficulty: diff,
    duration  : duration,
    pools     : {
      good: Object.keys(GROUP_EMOJI), // สุ่มจากอาหารที่ map หมู่ไว้
      bad : [] // ในโหมดนี้ทุกอันคือ candidate ตามหมู่
    },
    goodRate  : 1.0,
    powerups  : [],
    powerRate : 0,
    powerEvery: 99,
    judge,
    onExpire
  });

  // ตอนเวลาหมด → ส่งสรุปผลให้ main.js
  window.addEventListener('hha:time', (e)=>{
    const sec = (e.detail?.sec|0);
    if (sec <= 0) {
      const goalDone = setsCompleted >= conf.goalSets;
      const miniDone = misses <= conf.maxMiss;

      const questsCleared =
        (goalDone ? 1 : 0) +
        (miniDone ? 1 : 0);

      window.dispatchEvent(new CustomEvent('hha:end',{
        detail:{
          mode        : 'Balanced Plate',
          difficulty  : diff,
          score       : score,
          comboMax    : comboMax,
          misses      : misses,
          hits        : 0,          // ไม่ได้แยกเก็บ hits ที่เป็น count; ถ้าต้องใช้ค่อยเพิ่ม
          duration    : duration,
          goalCleared : goalDone,
          questsCleared,
          questsTotal : 2
        }
      }));
    }
  });

  // kick HUD ครั้งแรก
  pushQuestHUD({
    setsCompleted,
    goalSets: conf.goalSets,
    misses,
    maxMiss: conf.maxMiss
  });

  return ctrl;
}

export default { boot };
