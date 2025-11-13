// === /HeroHealth/modes/groups.safe.js (2025-11-13 FULL) ===
// โหมด Food Groups (เลือกอาหารตามหมู่ที่กำหนด)
// - ใช้ MissionDeck สำหรับ GOAL + MINI
// - GOAL กำหนด "focus groups" เช่น ['g1'], ['g1','g2'], ['g2','g3','g4']
// - spawn emoji เน้นหมู่ที่เป็น focus (≈70%) ที่เหลือเป็นหมู่อื่น + JUNK
// - ส่ง hha:score (รวม total + combo) เพื่อให้ HUD แสดงคอมโบถูก
// - ส่ง quest:update / hha:coach เพื่อให้ HUD เควสต์และโค้ชทำงาน

import { boot as factoryBoot } from '../vr/mode-factory.js';
import { MissionDeck } from '../vr/mission.js';
import { ensureFeverBar, setFever, setFeverActive, setShield } from '../vr/ui-fever.js';
import { Particles } from '../vr/particles.js';

export async function boot(cfg = {}) {
  const diff = String(cfg.difficulty || 'normal');
  const dur  = Number(cfg.duration || 60);

  // ---------- FEVER / SHIELD reset ----------
  ensureFeverBar();
  setFever(0);
  setShield(0);
  setFeverActive(false);

  // ---------- Emoji ตามหมู่ ----------
  const GROUPS = [
    { id:'g1', label:'หมู่ที่ 1: ข้าว-แป้ง', emo:['🍚','🍙','🍞','🥐','🥖','🥨'] },
    { id:'g2', label:'หมู่ที่ 2: เนื้อสัตว์-โปรตีน', emo:['🍗','🥩','🥓','🥚','🐟','🍤'] },
    { id:'g3', label:'หมู่ที่ 3: ผัก', emo:['🥦','🥬','🥕','🥒','🍅','🧅'] },
    { id:'g4', label:'หมู่ที่ 4: ผลไม้', emo:['🍎','🍌','🍊','🍇','🍓','🍍'] },
    { id:'g5', label:'หมู่ที่ 5: นม-ผลิตภัณฑ์นม', emo:['🥛','🧀','🍨','🍦'] },
  ];

  const JUNK = ['🍟','🍔','🌭','🍕','🍩','🧁','🍰','🍫','🥤','🧋'];

  // แผนที่ emoji → group id
  const EMO2GROUP = {};
  GROUPS.forEach(g => {
    g.emo.forEach(ch => { EMO2GROUP[ch] = g.id; });
  });

  // ---------- Helper อ่าน stats ----------
  const G = {
    totalGood : (s)=>s.goodCount|0,
    totalJunk : (s)=>s.junkMiss|0,
    score     : (s)=>s.score|0,
    comboMax  : (s)=>s.comboMax|0,
    tick      : (s)=>s.tick|0,
    groupGood : (s, ids)=>{
      if (!s.groupHits) return 0;
      const arr = Array.isArray(ids) ? ids : [ids];
      return arr.reduce((sum, id)=>sum + (s.groupHits[id]||0), 0);
    }
  };

  function mkGoal(id, label, focusIds, target, level){
    const focus = Array.isArray(focusIds) ? focusIds : [focusIds];
    return {
      id,
      label,
      focus,
      level,
      target,
      check: (s)=> G.groupGood(s, focus) >= target,
      prog : (s)=> Math.min(target, G.groupGood(s, focus))
    };
  }

  function mkMini(id, label, focusIds, target, level){
    const focus = Array.isArray(focusIds) ? focusIds : [focusIds];
    return {
      id,
      label,
      focus,
      level,
      target,
      check: (s)=> G.groupGood(s, focus) >= target,
      prog : (s)=> Math.min(target, G.groupGood(s, focus))
    };
  }

  // ---------- GOAL / MINI quest ----------
  const GOAL_POOL = [
    mkGoal('g_g1_10', 'เก็บอาหารหมู่ 1 ให้ได้ 10 ชิ้น',          ['g1'],           10, 'easy'),
    mkGoal('g_g3_10', 'เก็บอาหารหมู่ 3 (ผัก) ให้ได้ 10 ชิ้น',     ['g3'],           10, 'easy'),
    mkGoal('g_g2g4_14', 'เก็บหมู่ 2 และ 4 รวมกัน 14 ชิ้น',        ['g2','g4'],      14, 'normal'),
    mkGoal('g_g1g3_16', 'เก็บหมู่ 1 และ 3 รวมกัน 16 ชิ้น',        ['g1','g3'],      16, 'normal'),
    mkGoal('g_g2g3g4_20', 'เก็บหมู่ 2, 3 และ 4 รวมกัน 20 ชิ้น',   ['g2','g3','g4'], 20, 'hard'),
    {
      id:'g_time30',
      label:'เล่นให้ครบ 30 วินาที โดยไม่พลาดเยอะ',
      focus:['g1','g2','g3','g4','g5'],
      level:'easy',
      target:30,
      check:(s)=> G.tick(s) >= 30 && G.totalJunk(s) <= 8,
      prog :(s)=> Math.min(30, G.tick(s))
    }
  ];

  const MINI_POOL = [
    mkMini('m_g1_6',  'เก็บหมู่ 1 ให้ได้ 6 ชิ้น',           ['g1'],      6,  'easy'),
    mkMini('m_g3_6',  'เก็บผัก (หมู่ 3) ให้ได้ 6 ชิ้น',      ['g3'],      6,  'easy'),
    mkMini('m_g4_6',  'เก็บผลไม้ (หมู่ 4) ให้ได้ 6 ชิ้น',    ['g4'],      6,  'easy'),
    mkMini('m_g2_8',  'เก็บโปรตีน (หมู่ 2) ให้ได้ 8 ชิ้น',   ['g2'],      8,  'normal'),
    mkMini('m_combo8','ทำคอมโบต่อเนื่องให้ถึง 8',            ['g1'],      8,  'normal'), // ดูจาก comboMax
    {
      id:'m_combo8_core',
      label:'ทำคอมโบต่อเนื่องให้ถึง 8',
      focus:['g1','g2','g3','g4','g5'],
      level:'normal',
      target:8,
      check:(s)=> G.comboMax(s) >= 8,
      prog :(s)=> Math.min(8, G.comboMax(s))
    },
    {
      id:'m_junk_low',
      label:'พลาดไม่เกิน 6 ครั้งตลอดเกม',
      focus:['g1','g2','g3','g4','g5'],
      level:'normal',
      target:6,
      // ผ่านถ้า junk ≤ 6
      check:(s)=> G.totalJunk(s) <= 6,
      // แสดง “จำนวนที่ใช้ไป” เพื่อเตือน (0 ถึง 6)
      prog :(s)=> Math.min(6, G.totalJunk(s))
    }
  ];

  const deck = new MissionDeck({ goalPool: GOAL_POOL, miniPool: MINI_POOL });
  deck.drawGoals(1);  // ทีละ Goal ชัด ๆ
  deck.draw3();       // Mini 3 อัน

  // ---------- สถานะคะแนน + group-hit ----------
  let score = 0;
  let combo = 0;
  let fever = 0;
  let feverActive = false;

  const groupHits = { g1:0, g2:0, g3:0, g4:0, g5:0 };

  function syncDeck(){
    deck.updateScore(score);
    deck.updateCombo(combo);
    deck.stats.groupHits = { ...groupHits };
  }

  function mult(){ return feverActive ? 2 : 1; }

  function gainFever(n){
    fever = Math.max(0, Math.min(100, fever + n));
    setFever(fever);
    if (!feverActive && fever >= 100){
      feverActive = true;
      setFeverActive(true);
    }
  }

  function decayFever(base){
    const dec = feverActive ? 10 : base;
    fever = Math.max(0, fever - dec);
    setFever(fever);
    if (feverActive && fever <= 0){
      feverActive = false;
      setFeverActive(false);
    }
  }

  // ---------- เลือกหมู่ที่ต้องโฟกัสตาม GOAL ปัจจุบัน ----------
  function pickFocusGroups(){
    const cur = deck.getCurrent('goals');
    if (!cur || !Array.isArray(cur.focus) || !cur.focus.length) return GROUPS;
    const ids = new Set(cur.focus);
    const subset = GROUPS.filter(g => ids.has(g.id));
    return subset.length ? subset : GROUPS;
  }

  // ---------- ส่งข้อมูลให้ HUD เควสต์ + โค้ช ----------
  function pushQuest(hint){
    const goals = deck.getProgress('goals');
    const minis = deck.getProgress('mini');
    const focusGoal = goals.find(g => !g.done) || goals[0] || null;
    const focusMini = minis.find(m => !m.done) || minis[0] || null;

    // ส่งให้ quest-hud.js
    window.dispatchEvent(new CustomEvent('quest:update', {
      detail: { goal: focusGoal, mini: focusMini, goalsAll: goals, minisAll: minis, hint }
    }));

    // แสดงโค้ชสั้น ๆ ตอนเปลี่ยนโฟกัส
    if (focusGoal && hint){
      const txt = `GOAL: ${focusGoal.label}`;
      window.dispatchEvent(new CustomEvent('hha:coach', { detail:{ text: txt } }));
    }
  }

  // ---------- JUDGE (ตัดสินว่าคลิกดี/ไม่ดี) ----------
  function judge(ch, ctx){
    const x = ctx.clientX || ctx.cx || 0;
    const y = ctx.clientY || ctx.cy || 0;

    const gid   = EMO2GROUP[ch] || null;
    const focus = pickFocusGroups();
    const focusIds = new Set(focus.map(g => g.id));

    const isJunk = !gid;
    const isGood = !isJunk && focusIds.has(gid);

    let delta;
    if (isGood){
      combo += 1;
      const base  = 14 + combo * 2;
      delta = base * mult();
      score += delta;

      gainFever(6 + combo * 0.4);

      if (gid && groupHits[gid] != null) groupHits[gid] += 1;
      deck.onGood();
      syncDeck();

      Particles.burstShards(null, null, { screen:{x,y}, theme:'groups' });
      Particles.scorePop(null, null, {
        screen:{x,y},
        text:`+${delta}`,
        good:true
      });
    } else {
      const before = score;
      const penalty = 12;
      delta = -penalty;
      score = Math.max(0, score - penalty);
      combo = 0;

      decayFever(12);
      deck.onJunk();
      syncDeck();

      Particles.burstShards(null, null, { screen:{x,y}, theme:'goodjunk' });
      Particles.scorePop(null, null, {
        screen:{x,y},
        text:`-${penalty}`,
        good:false
      });
    }

    // อัปเดตเควสต์ทุกครั้งที่มี Action
    pushQuest();

    // ส่งสำหรับ HUD score/combo (main.js จะอ่าน total/ combo / comboMax)
    window.dispatchEvent(new CustomEvent('hha:score', {
      detail:{
        delta,
        good:isGood,
        total:score,
        combo,
        comboMax:deck.stats.comboMax
      }
    }));

    return { good:isGood, scoreDelta:delta };
  }

  // ---------- เมื่อเป้าหมายหมดอายุ (ไม่ได้คลิก) ----------
  function onExpire(ev){
    // ถ้าอยากให้ "ปล่อยให้หลุด" มีผลยากขึ้น สามารถปรับ logic ตรงนี้ได้
    // ตอนนี้: แค่ลด Fever นิดหน่อย แล้วนับ tick ผ่าน MissionDeck ด้านล่าง
    decayFever(4);
    syncDeck();
    pushQuest();
  }

  // ---------- ต่อวินาที (ผูกกับ hha:time) ----------
  function onSec(){
    if (combo <= 0) decayFever(6); else decayFever(2);
    deck.second();
    syncDeck();
    pushQuest();

    // ถ้า Mini เคลียร์หมด → จั่วชุดใหม่
    if (deck.isCleared('mini')){
      deck.draw3();
      pushQuest('Mini ใหม่');
    }
    // ถ้า GOAL เคลียร์หมด → จั่วเป้าหมายใหม่ (โฟกัสหมู่ใหม่)
    if (deck.isCleared('goals')){
      deck.drawGoals(1);
      pushQuest('เปลี่ยนเป้าหมายใหม่');
    }
  }

  window.addEventListener('hha:time', (e)=>{
    const sec = (e.detail?.sec|0);
    if (sec >= 0) onSec();
  });

  // ---------- เริ่มโรงงาน spawn เป้า ----------
  const pools = {
    good: GROUPS.flatMap(g => g.emo),
    bad : JUNK
  };

  return factoryBoot({
    difficulty : diff,
    duration   : dur,
    pools,
    goodRate   : 0.72,   // ส่วนใหญ่เป็นอาหารที่ "อาจ" เป็นคำตอบ
    judge      : (ch, ctx)=>judge(ch, ctx),
    onExpire
  }).then(ctrl=>{
    // บอกโค้ชตอนเริ่มเกม
    window.dispatchEvent(new CustomEvent('hha:coach', {
      detail:{ text:'เลือกอาหารให้ตรงหมู่ตาม GOAL ด้านขวา 🌈' }
    }));

    // เคาะ Quest แรก
    pushQuest('เริ่ม');

    // จบเกม → ส่งสรุปไป main.js
    window.addEventListener('hha:time', (e)=>{
      const sec = (e.detail?.sec|0);
      if (sec <= 0){
        const goals = deck.getProgress('goals');
        const minis = deck.getProgress('mini');
        const goalCleared = goals.length>0 && goals.every(g => g.done);

        window.dispatchEvent(new CustomEvent('hha:end', {
          detail:{
            mode        : 'Food Groups',
            difficulty  : diff,
            score,
            comboMax    : deck.stats.comboMax,
            misses      : deck.stats.junkMiss,
            hits        : deck.stats.goodCount,
            duration    : dur,
            goalCleared,
            questsCleared: minis.filter(m => m.done).length,
            questsTotal  : minis.length
          }
        }));
      }
    });

    return ctrl;
  });
}

export default { boot };
