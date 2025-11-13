// === /HeroHealth/modes/groups.safe.js (2025-11-13 GROUPS QUEST + DYNAMIC FOCUS) ===
// เกมจัดหมู่อาหารตาม "หมู่เป้าหมาย" 1–5, เพิ่มความยากอัตโนมัติ, มี Goal + Mini Quest + Coach

import { boot as factoryBoot } from '../vr/mode-factory.js';
import { MissionDeck }        from '../vr/mission.js';
import { setFever, setFeverActive } from '../vr/ui-fever.js';
import { Particles }          from '../vr/particles.js';

// ---------- Emoji Pools & Groups ----------
// กลุ่มอาหารตามหมู่ (1–5) แบบง่าย ๆ
const GROUP_EMO = {
  1: ['🍚','🍙','🍞','🥖','🥐','🥯','🫓'],            // ข้าว-แป้ง
  2: ['🥩','🍗','🍖','🥓','🥚','🧆','🐟','🍤'],        // เนื้อสัตว์/โปรตีน
  3: ['🥦','🥕','🥬','🍅','🌽','🧅','🫑'],            // ผัก
  4: ['🍎','🍌','🍇','🍓','🍊','🍉','🍍','🍐'],        // ผลไม้
  5: ['🥛','🧀','🍳','🧈'],                          // นม/ผลิตภัณฑ์นม
};

// อาหาร "ผิดหมู่"/junk ให้ใช้เป็น BAD
const JUNK = ['🍔','🍟','🌭','🍕','🍩','🍪','🍰','🧋','🥤','🍫','🍬','🍭'];

// รวม emoji ทั้งหมดที่กดได้ในเกมนี้ (GOOD pool ตามกลุ่ม + JUNK เป็น bad)
const ALL_GOOD = Array.from(
  new Set([].concat(...Object.values(GROUP_EMO)))
);

// หา group id ของ emoji ตัวหนึ่ง (ถ้าไม่อยู่ในหมู่จะคืน 0)
function groupOf(ch){
  for (const [gid, arr] of Object.entries(GROUP_EMO)){
    if (arr.includes(ch)) return Number(gid);
  }
  return 0;
}

// ---------- Goal & Mini Quest Pools ----------
function buildGoalPool(diff){
  return [
    {
      id:'g_groups_good18',
      label:'เก็บอาหารหมู่เป้าหมายรวม 18 ชิ้น',
      level:'easy',
      target:18,
      check:s => (s.goodCount|0) >= 18,
      prog :s => Math.min(18, s.goodCount|0)
    },
    {
      id:'g_groups_good26',
      label:'เก็บอาหารหมู่เป้าหมายรวม 26 ชิ้น',
      level:'normal',
      target:26,
      check:s => (s.goodCount|0) >= 26,
      prog :s => Math.min(26, s.goodCount|0)
    },
    {
      id:'g_groups_good34',
      label:'เก็บอาหารหมู่เป้าหมายรวม 34 ชิ้น',
      level:'hard',
      target:34,
      check:s => (s.goodCount|0) >= 34,
      prog :s => Math.min(34, s.goodCount|0)
    },
    {
      id:'g_groups_combo14',
      label:'ทำคอมโบต่อเนื่องสูงสุด ≥ 14',
      level:'normal',
      target:14,
      check:s => (s.comboMax|0) >= 14,
      prog :s => Math.min(14, s.comboMax|0)
    },
    {
      id:'g_groups_score1500',
      label:'ทำคะแนนรวม ≥ 1500',
      level:'normal',
      target:1500,
      check:s => (s.score|0) >= 1500,
      prog :s => Math.min(1500, s.score|0)
    },
    {
      id:'g_groups_miss_le6',
      label:'พลาดไม่เกิน 6 ครั้ง',
      level:'normal',
      target:6,
      check:s => (s.junkMiss|0) <= 6,
      // prog = เหลือโควต้ากี่ครั้ง (6 → 0 ค่อยหมด)
      prog :s => Math.max(0, 6 - (s.junkMiss|0))
    },
  ];
}

function buildMiniPool(diff){
  return [
    {
      id:'m_groups_combo10',
      label:'ทำคอมโบต่อเนื่อง 10',
      level:'easy',
      target:10,
      check:s => (s.comboMax|0) >= 10,
      prog :s => Math.min(10, s.comboMax|0)
    },
    {
      id:'m_groups_combo16',
      label:'ทำคอมโบต่อเนื่อง 16',
      level:'normal',
      target:16,
      check:s => (s.comboMax|0) >= 16,
      prog :s => Math.min(16, s.comboMax|0)
    },
    {
      id:'m_groups_good12',
      label:'เก็บอาหารหมู่เป้าหมาย 12 ชิ้น',
      level:'easy',
      target:12,
      check:s => (s.goodCount|0) >= 12,
      prog :s => Math.min(12, s.goodCount|0)
    },
    {
      id:'m_groups_good20',
      label:'เก็บอาหารหมู่เป้าหมาย 20 ชิ้น',
      level:'normal',
      target:20,
      check:s => (s.goodCount|0) >= 20,
      prog :s => Math.min(20, s.goodCount|0)
    },
    {
      id:'m_groups_miss_le6',
      label:'พลาดไม่เกิน 6 ครั้ง',
      level:'normal',
      target:6,
      check:s => (s.junkMiss|0) <= 6,
      prog :s => Math.max(0, 6 - (s.junkMiss|0))
    },
  ];
}

// ---------- Mode Boot ----------
export async function boot(cfg = {}) {
  const diff = String(cfg.difficulty || 'normal');
  const dur  = Number(cfg.duration || 60);

  // Reset fever เริ่มต้น
  setFever(0);
  setFeverActive(false);

  // ----- Mission Deck -----
  const deck = new MissionDeck({
    goalPool: buildGoalPool(diff),
    miniPool: buildMiniPool(diff)
  });
  deck.drawGoals(2);
  deck.draw3();

  // helper ส่งข้อมูลให้ HUD Goal/Mini
  function pushQuest(hint){
    const goals = deck.getProgress('goals');
    const minis = deck.getProgress('mini');
    const focusGoal = goals.find(g => !g.done) || goals[0] || null;
    const focusMini = minis.find(m => !m.done) || minis[0] || null;

    window.dispatchEvent(new CustomEvent('hha:quest', {
      detail: { goal: focusGoal, mini: focusMini, goalsAll: goals, minisAll: minis, hint }
    }));
  }

  // ---------- Dynamic Focus / Difficulty ----------
  let score  = 0;
  let combo  = 0;
  let comboMax = 0;
  let focusGroups = [1];        // เริ่มโฟกัสหมู่ 1
  let stage = 1;                // ระดับปัจจุบัน (ใช้เปลี่ยนจำนวนหมู่)
  const maxFocusByDiff =
    diff === 'easy'   ? 2 :
    diff === 'hard'   ? 4 :
                        3;      // normal = 3

  function coach(text){
    window.dispatchEvent(new CustomEvent('hha:coach', { detail:{ text } }));
  }

  function updateStats(){
    deck.updateScore(score);
    deck.updateCombo(combo);
  }

  function levelUpIfNeeded(){
    const s = deck.stats;
    // เงื่อนไขเลื่อนระดับ: เก็บถูกเยอะ + เวลาเดินไปหน่อย
    if (stage === 1 && s.goodCount >= 10 && s.tick >= 10 && focusGroups.length < maxFocusByDiff){
      stage = 2;
      if (!focusGroups.includes(2)) focusGroups.push(2);
      coach('โฟกัสเพิ่มเป็น 2 หมู่! เลือกให้ตรงหมู่เป้าหมายให้ดีนะ');
      pushQuest('เปลี่ยนระดับ → 2 หมู่');
    } else if (stage === 2 && s.goodCount >= 22 && s.tick >= 25 && focusGroups.length < maxFocusByDiff){
      stage = 3;
      const extra = [3,4,5].find(g => !focusGroups.includes(g));
      if (extra) focusGroups.push(extra);
      coach(`โฟกัสเพิ่มเป็น ${focusGroups.length} หมู่แล้ว!`);
      pushQuest('เปลี่ยนระดับ → เพิ่มหมู่โฟกัส');
    }
  }

  // ---------- Judge ----------
  function judge(ch, ctx){
    const x = ctx.clientX || ctx.cx || 0;
    const y = ctx.clientY || ctx.cy || 0;

    const gid = groupOf(ch);
    const isInFocus = gid && focusGroups.includes(gid);
    const isHealthy = ALL_GOOD.includes(ch);
    const isGoodHit = isHealthy && isInFocus;

    let delta = 0;
    if (isGoodHit){
      const base  = 14 + combo * 2;
      delta       = base;
      score      += delta;
      combo      += 1;
      if (combo > comboMax) comboMax = combo;

      deck.onGood();           // goodCount++
      updateStats();
      levelUpIfNeeded();

      // เอฟเฟกต์ตรงเป้า
      Particles.burstShards(null, null, { screen:{x,y}, theme:'groups' });
      Particles.scorePop({ x, y, text:`+${delta}`, good:true });
    } else {
      // กดผิดหมู่หรือ junk
      delta  = -10;
      score  = Math.max(0, score + delta);
      combo  = 0;

      deck.onJunk();           // junkMiss++ + combo reset
      updateStats();
      levelUpIfNeeded();

      Particles.burstShards(null, null, { screen:{x,y}, theme:'goodjunk' });
      Particles.scorePop({ x, y, text:`${delta}`, good:false });
    }

    // ส่ง event ให้ HUD
    window.dispatchEvent(new CustomEvent('hha:score', {
      detail:{
        delta,
        total   : score,
        good    : isGoodHit,
        combo   : combo,
        comboMax: comboMax
      }
    }));
    window.dispatchEvent(new CustomEvent('hha:combo', {
      detail:{ combo, comboMax }
    }));

    pushQuest(); // refresh HUD

    return { good:isGoodHit, scoreDelta:delta };
  }

  // ---------- onExpire ----------
  function onExpire(ev){
    // ถ้าเป้าหมายเป็น emoji ของกลุ่มเป้าหมาย → ถือว่าพลาด
    const gid = groupOf(ev?.ch || ev?.char || '');
    const isInFocus = gid && focusGroups.includes(gid);
    if (!isInFocus) return;

    deck.onJunk();
    combo = 0;
    updateStats();
    levelUpIfNeeded();
    pushQuest();
  }

  // ---------- ต่อวินาที ----------
  function onSec(){
    deck.second();
    updateStats();
    levelUpIfNeeded();
    pushQuest();
  }

  window.addEventListener('hha:time', (e)=>{
    if ((e.detail?.sec|0) >= 0) onSec();
  });

  // โค้ชเริ่มเกม
  coach('โหมด Food Groups: เลือกอาหารตามหมู่ที่กำหนดให้เท่านั้น!');

  // ----- Start factory -----
  return factoryBoot({
    difficulty: diff,
    duration  : dur,
    pools     : { good: ALL_GOOD, bad: JUNK },
    goodRate  : 0.7,              // ส่วนใหญ่เป็นอาหาร (ทั้งในและนอกหมู่)
    judge,
    onExpire
  }).then(ctrl=>{
    // สรุปตอนหมดเวลา
    window.addEventListener('hha:time', (e)=>{
      if ((e.detail?.sec|0) <= 0){
        const goals = deck.getProgress('goals');
        const minis = deck.getProgress('mini');
        const goalCleared   = goals.length>0 && goals.every(g => g.done);
        const questsCleared = minis.filter(m => m.done).length;
        const questsTotal   = minis.length;

        window.dispatchEvent(new CustomEvent('hha:end', {
          detail:{
            mode       : 'Food Groups',
            difficulty : diff,
            score,
            comboMax   : deck.stats.comboMax,
            misses     : deck.stats.junkMiss,
            hits       : deck.stats.goodCount,
            duration   : dur,
            goalCleared,
            questsCleared,
            questsTotal
          }
        }));
      }
    });

    // kick HUD
    pushQuest('เริ่ม');

    return ctrl;
  });
}

export default { boot };
