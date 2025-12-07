// === /herohealth/plate/plate.safe.js
// MISS = กดของไม่ดีเท่านั้น + โค้ช ป.5 + multi-plate + cleanup hha:time listener
import { boot as factoryBoot } from '../vr/mode-factory.js';
import { ensureFeverBar, setFever, setFeverActive, setShield } from '../vr/ui-fever.js';
import { createPlateQuest, QUOTA } from './plate.quest.js';

// ใช้ Particles จาก global ที่มาจาก /vr/particles.js (IIFE)
const ROOT = (typeof window !== 'undefined' ? window : globalThis);
// === Particles (shared) ===
const Particles =
  (window.HHA_PARTICLES) ||
  (window.GAME_MODULES && window.GAME_MODULES.Particles) || {
    scorePop(){},
    burstAt(){}
  };
function spawnHitFx(el, isGood, scoreDelta) {
  // แปลงตำแหน่งเป้า → พิกัดจอ (อย่างน้อยเอาใกล้ ๆ กลางจอไว้ก่อนก็ได้)
  const x = window.innerWidth  / 2;
  const y = window.innerHeight / 2;

  // effect แตกกระจาย
  Particles.burstAt(x, y, {
    color: isGood ? '#22c55e' : '#f97316',
    count: 16,
    radius: 60
  });

  // คะแนนเด้ง
  const text = (scoreDelta > 0 ? '+' : '') + scoreDelta;
  Particles.scorePop(x, y, text, { good: isGood });
}

const GROUPS = {
  1: ['🍚','🍙','🍞','🥯','🥐'],                  // ข้าว-แป้ง
  2: ['🥩','🍗','🍖','🥚','🧀'],                  // โปรตีน
  3: ['🥦','🥕','🥬','🌽','🥗','🍅'],             // ผัก
  4: ['🍎','🍌','🍇','🍉','🍊','🍓','🍍'],         // ผลไม้
  5: ['🥛','🧈','🧀','🍨']                        // นม/ผลิตภัณฑ์นม
};

const GOOD = Object.values(GROUPS).flat();
const BAD  = ['🍔','🍟','🍕','🍩','🍪','🧋','🥤','🍫','🍬','🥓'];

const STAR   = '⭐';
const DIA    = '💎';
const SHIELD = '🛡️';
const FIRE   = '🔥';
const BONUS  = [STAR, DIA, SHIELD, FIRE];

function foodGroup(emo) {
  for (const [g, arr] of Object.entries(GROUPS)) {
    if (arr.includes(emo)) return +g;
  }
  return 0;
}

// ---- Coach helper ----
let lastCoachAt = 0;
function coach(text, minGap = 2200) {
  if (!text) return;
  const now = Date.now();
  if (now - lastCoachAt < minGap) return;
  lastCoachAt = now;
  try {
    window.dispatchEvent(new CustomEvent('hha:coach', { detail: { text } }));
  } catch {}
}

export async function boot(cfg = {}) {
  const diffRaw = String(cfg.difficulty || 'normal').toLowerCase();
  const diff = (diffRaw === 'easy' || diffRaw === 'hard' || diffRaw === 'normal')
    ? diffRaw : 'normal';

  let dur = Number(cfg.duration || 60);
  if (!Number.isFinite(dur) || dur <= 0) dur = 60;
  if (dur < 20) dur = 20;
  if (dur > 180) dur = 180;

  // HUD เริ่มต้น
  ensureFeverBar();
  setFever(0);
  setFeverActive(false);
  setShield(0);

  // Quest deck
  const deck = createPlateQuest(diff);
  deck.drawGoals(2);
  deck.draw3();

  const need = QUOTA[diff] || QUOTA.normal;      // โควตาใน "หนึ่งจาน"
  const totalNeed = need.reduce((a, b) => a + b, 0);

  // gCounts = เก็บรวมทั้งเกม (aggregate สำหรับวิจัย)
  const gCounts = [0, 0, 0, 0, 0];
  // plateCounts = นับเฉพาะ “จานปัจจุบัน”
  const plateCounts = [0, 0, 0, 0, 0];
  let platesDone = 0;

  let accMiniDone = 0;
  let accGoalDone = 0;

  // State หลัก
  let score = 0;
  let combo = 0;
  let comboMax = 0;
  let misses = 0;
  let star = 0;
  let diamond = 0;
  let shield = 0;
  let fever = 0;
  let feverActive = false;

  function mult() { return feverActive ? 2 : 1; }

  function emitStat(extra = {}) {
    try {
      window.dispatchEvent(new CustomEvent('hha:stat', {
        detail: {
          mode: 'Balanced Plate',
          difficulty: diff,
          score,
          combo,
          misses,
          fever,
          feverActive,
          platesDone,
          plateCounts: [...plateCounts],
          totalCounts: [...gCounts],
          ...extra
        }
      }));
    } catch {}
  }

  function gainFever(n) {
    fever = Math.max(0, Math.min(100, fever + n));
    setFever(fever);
    if (!feverActive && fever >= 100) {
      feverActive = true;
      setFeverActive(true);
      coach('จานพลังพิเศษ ✨ เก็บให้ครบ 5 หมู่เลย!');
    }
    emitStat();
  }

  function decayFever(n) {
    const d = feverActive ? 10 : n;
    fever = Math.max(0, fever - d);
    setFever(fever);
    if (feverActive && fever <= 0) {
      feverActive = false;
      setFeverActive(false);
    }
    emitStat();
  }

  function syncDeck() {
    deck.updateScore(score);
    deck.updateCombo(combo);
    // ส่งสถิติรวม (ทั้งเกม) ให้ deck
    deck.stats.gCounts = [...gCounts];
    deck.stats.star    = star;
    deck.stats.diamond = diamond;
    emitStat();
  }

  function pushQuest(hint) {
    const goals = deck.getProgress('goals');
    const minis = deck.getProgress('mini');
    const gtxt = `โควตาใน 1 จาน: [${need.join(', ')}] | จานนี้ทำได้: [${plateCounts.join(', ')}]`;
    window.dispatchEvent(new CustomEvent('quest:update', {
      detail: {
        goal: goals.find(g => !g.done) || goals[0] || null,
        mini: minis.find(m => !m.done) || minis[0] || null,
        goalsAll: goals,
        minisAll: minis,
        hint: hint || gtxt
      }
    }));
  }

  function scoreFX(x, y, val, good) {
    try {
      Particles.scorePop(x, y, (val > 0 ? '+' : '') + val, { good, bad: !good });
      Particles.burstAt(x, y, { good, bad: !good });
    } catch {}
  }

  // ===== Logic สำหรับ "จานปัจจุบัน" =====
  function plateProgress() {
    // ใช้ plateCounts (เฉพาะจานนี้) เทียบกับ need
    return plateCounts.reduce((sum, v, i) => {
      const quota = need[i] ?? 0;
      return sum + Math.min(v, quota);
    }, 0);
  }

  function weakestGroup() {
    // หาหมู่ที่ "ยังขาด" ในจานปัจจุบัน
    let minDiff = Infinity;
    let idx = -1;
    for (let i = 0; i < need.length; i++) {
      const d = (need[i] ?? 0) - (plateCounts[i] ?? 0);
      if (d > 0 && d < minDiff) {
        minDiff = d;
        idx = i;
      }
    }
    return idx; // 0..4 หรือ -1
  }

  function resetCurrentPlate() {
    for (let i = 0; i < plateCounts.length; i++) {
      plateCounts[i] = 0;
    }
    emitStat();
  }

  function maybeCoachCombo() {
    if (combo === 3) coach('จานเริ่มสวยแล้ว 🍽️ เก็บให้ครบทุกหมู่เลย!');
    if (combo === 7) coach('คอมโบยาวสุด ๆ ⭐ ใกล้ครบโควตาแล้ว');
  }

  // ===== Judge =====
  function judge(ch, ctx) {
    const x = ctx?.clientX ?? ctx?.cx ?? 0;
    const y = ctx?.clientY ?? ctx?.cy ?? 0;

    // ---- Power-ups ----
    if (ch === STAR) {
      const d = 40 * mult();
      score += d; star++;
      gainFever(10);
      deck.onGood();
      combo++; comboMax = Math.max(comboMax, combo);
      syncDeck(); pushQuest();
      scoreFX(x, y, d, true);
      maybeCoachCombo();
      return { good: true, scoreDelta: d };
    }
    if (ch === DIA) {
      const d = 80 * mult();
      score += d; diamond++;
      gainFever(30);
      deck.onGood();
      combo++; comboMax = Math.max(comboMax, combo);
      syncDeck(); pushQuest();
      scoreFX(x, y, d, true);
      maybeCoachCombo();
      return { good: true, scoreDelta: d };
    }
    if (ch === SHIELD) {
      shield = Math.min(3, shield + 1);
      setShield(shield);
      const d = 20;
      score += d;
      deck.onGood();
      syncDeck(); pushQuest();
      scoreFX(x, y, d, true);
      coach('ได้เกราะจาน 🛡️ เผื่อเผลอแตะของทอด');
      return { good: true, scoreDelta: d };
    }
    if (ch === FIRE) {
      feverActive = true;
      setFeverActive(true);
      fever = Math.max(fever, 60);
      setFever(fever);
      const d = 25;
      score += d;
      deck.onGood();
      syncDeck(); pushQuest();
      scoreFX(x, y, d, true);
      coach('โหมดไฟ 🍽️ เก็บอาหารดีให้ครบทุกหมู่เลย!');
      return { good: true, scoreDelta: d };
    }

    const g = foodGroup(ch);

    // ---- แตะอาหาร 5 หมู่ (GOOD) ----
    if (g > 0) {
      const d = (16 + combo * 2) * mult();
      score += d;
      combo++; comboMax = Math.max(comboMax, combo);
      gainFever(6 + combo * 0.4);

      // รวมทั้งเกม
      gCounts[g - 1] = (gCounts[g - 1] | 0) + 1;
      // นับเฉพาะจานนี้
      plateCounts[g - 1] = (plateCounts[g - 1] | 0) + 1;

      deck.onGood();
      syncDeck(); pushQuest();
      scoreFX(x, y, d, true);
      maybeCoachCombo();

      const prog = plateProgress();
      if (prog >= Math.ceil(totalNeed * 0.5) && prog < totalNeed) {
        const w = weakestGroup();
        if (w >= 0) {
          coach(`จานนี้เหลือหมู่ ${w + 1} อีกนิดเดียวก็ครบแล้ว 💡`, 4000);
        }
      }

      if (prog >= totalNeed) {
        // จานนี้ครบโควตาแล้ว → เสิร์ฟ + เริ่มจานใหม่
        platesDone += 1;
        coach(`จานสมดุลแล้ว ครบ 5 หมู่เลย 🎉 เสิร์ฟจานที่ ${platesDone} แล้ว!`, 3000);
        resetCurrentPlate();
        pushQuest(`เริ่มจัดจานที่ ${platesDone + 1}`);
      }

      return { good: true, scoreDelta: d };
    }

    // ---- แตะของไม่ดี (MISS นับที่นี่เท่านั้น) ----
    if (shield > 0) {
      shield--; setShield(shield);
      decayFever(6);
      syncDeck(); pushQuest();
      scoreFX(x, y, 0, false);
      coach('เกราะช่วยกันของทอด/ของหวานให้แล้ว 🍟➡️🛡️', 3500);
      return { good: false, scoreDelta: 0 };
    }

    const d = -12;
    score = Math.max(0, score + d);
    combo = 0;
    misses++;              // ✅ MISS = แตะของไม่ดี
    decayFever(16);
    deck.onJunk();         // ✅ junkMiss = แตะของไม่ดีเท่านั้น
    syncDeck(); pushQuest();
    scoreFX(x, y, d, false);
    if (misses === 1) {
      coach('จานเริ่มมีของหวานเยอะไปนิด 🍩 ลองเก็บผักกับผลไม้เพิ่ม');
    } else if (misses === 3) {
      coach('ของทอด/หวานเยอะแล้วนะ ลองกลับมาเก็บอาหารหลัก 5 หมู่แทน 🍚🥩🥦🍎🥛', 4000);
    }
    return { good: false, scoreDelta: d };
  }

  // ✅ ปล่อยของเสียหลุดจอ “ไม่ถือว่าพลาด”
  function onExpire(ev) {
    if (!ev || ev.isGood) return;
    decayFever(4);
    syncDeck();
    pushQuest();
  }

  function onSec() {
    if (combo <= 0) decayFever(6);
    else            decayFever(2);

    deck.second(); // ให้ MissionDeck นับ tick/time ภายใน
    syncDeck();

    const g = deck.getProgress('goals');
    const m = deck.getProgress('mini');

    if (g.length > 0 && g.every(x => x.done)) {
      accGoalDone += g.length;
      deck.drawGoals(2);
      pushQuest('Goal ใหม่ (รวมทั้งเกม)');
      coach('ภารกิจจานสมดุลรวมผ่านอีกชุดแล้ว 🎉', 4000);
    }
    if (m.length > 0 && m.every(x => x.done)) {
      accMiniDone += m.length;
      deck.draw3();
      pushQuest('Mini ใหม่');
      coach('Mini quest จานข้าวสำเร็จแล้ว เก่งมาก! 🌟', 4000);
    }
  }

  // ---- สรุปเมื่อจบเกม ----
  let ended = false;
  function finish() {
    if (ended) return;
    ended = true;

    const g = deck.getProgress('goals');
    const m = deck.getProgress('mini');

    const goalCleared = g.length > 0 && g.every(x => x.done);
    const goalsTotal  = accGoalDone + g.length;
    const goalsDone   = accGoalDone + g.filter(x => x.done).length;
    const miniTotal   = accMiniDone + m.length;
    const miniDone    = accMiniDone + m.filter(x => x.done).length;

    emitStat({ ended: true });

    window.dispatchEvent(new CustomEvent('hha:end', {
      detail: {
        mode: 'Balanced Plate',
        difficulty: diff,
        score,
        misses,
        comboMax,
        duration: dur,
        goalCleared,
        goalsCleared: goalsDone,
        goalsTotal,
        questsCleared: miniDone,
        questsTotal: miniTotal,
        platesDone,
        // รวมทั้งเกม (ใช้วิเคราะห์พฤติกรรมเลือกหมู่)
        groupCounts: [...gCounts]
      }
    }));
  }

  // ใช้ clock กลาง hha:time พร้อม cleanup
  const onTime = (e) => {
    const sec = (e.detail?.sec | 0);
    if (sec >= 0) onSec();
    if (sec === 20) coach('เหลือ 20 วิ ลองดูว่าจานนี้ยังขาดหมู่ไหน 🌈');
    if (sec === 10) coach('10 วิ สุดท้าย เสิร์ฟให้ครบอีก 1 จานนะ ✨');
    if (sec === 0) {
      finish();
      window.removeEventListener('hha:time', onTime);
    }
  };
  window.addEventListener('hha:time', onTime);

  // ให้ factoryBoot จัดการ spawn/เวลา/ฮิตพื้นฐาน
  const ctrl = await factoryBoot({
    difficulty: diff,
    duration:   dur,
    pools:      { good: [...GOOD, ...BONUS], bad: [...BAD] },
    goodRate:   0.64,
    powerups:   BONUS,
    powerRate:  0.10,
    powerEvery: 7,
    judge:  (ch, ctx) => judge(ch, ctx),
    onExpire
  });

  // เพิ่ม cleanup ตอน stop() เผื่อออกกลางคัน
  if (ctrl && typeof ctrl.stop === 'function') {
    const origStop = ctrl.stop.bind(ctrl);
    ctrl.stop = (...args) => {
      window.removeEventListener('hha:time', onTime);
      return origStop(...args);
    };
  }

  // แสดงเควสต์ + โค้ชตั้งแต่เริ่ม
  resetCurrentPlate();
  pushQuest('เริ่มจัดจานที่ 1');
  coach('จัดจานให้ครบ 5 หมู่ 🍚🥩🥦🍎🥛 แล้วพยายามเสิร์ฟให้ได้หลายจานที่สุด เลี่ยงของทอดกับของหวานนะ');

  // ยิง stat เริ่มต้นให้ HUD
  emitStat();

  return ctrl;
}

export default { boot };
