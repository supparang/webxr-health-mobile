// === /HeroHealth/modes/groups.safe.js (2025-11-13 LATEST) ===
// โหมด "Food Groups" — เลือกอาหารตามหมู่ที่ระบบโฟกัส (1–5)
// - Tier ความยาก: โฟกัส 1 หมู่ → 2 หมู่ → 3 หมู่ (auto ตามฝีมือ)
// - ใช้ MissionDeck เหมือน goodjunk (Goal + Mini)
// - คะแนน / เอฟเฟกต์ / คอมโบ / โค้ช ครบ

import { boot as factoryBoot } from '../vr/mode-factory.js';
import { MissionDeck } from '../vr/mission.js';
import { ensureFeverBar, setFever, setFeverActive, setShield } from '../vr/ui-fever.js';
import { Particles } from '../vr/particles.js';

export async function boot(cfg = {}) {
  const diff = String(cfg.difficulty || 'normal');
  const dur  = Number(cfg.duration || 60);

  // ---------- Food groups mapping (1–5) ----------
  const FG = {
    1: ['🍚','🍙','🍞','🥖','🥐','🥯'],                      // ข้าว-แป้ง
    2: ['🥦','🥕','🥬','🥒','🧅','🍆'],                      // ผัก
    3: ['🍎','🍓','🍌','🍊','🍐','🍍','🍉','🥝','🫐'],        // ผลไม้
    4: ['🍗','🍖','🥩','🐟','🍤','🥚','🫘'],                  // โปรตีน
    5: ['🥛','🧀','🍦','🧈','🥛'],                           // นม/ผลิตภัณฑ์นม
  };

  const JUNK = ['🍔','🍟','🌭','🍕','🍩','🍪','🍰','🧋','🥤','🍫','🍬','🥓'];

  const ALL_GOOD = [...new Set(Object.values(FG).flat())];

  // reverse map emoji -> group
  const GROUP_BY_EMO = {};
  Object.keys(FG).forEach(k=>{
    FG[k].forEach(e=>{ GROUP_BY_EMO[e] = Number(k); });
  });

  // ---------- HUD base ----------
  ensureFeverBar();
  setFever(0);
  setShield(0);
  setFeverActive(false);

  // ---------- MissionDeck ----------
  const G = {
    score   : s => s.score     | 0,
    comboMax: s => s.comboMax  | 0,
    goodHit : s => s.goodCount | 0,
    miss    : s => s.junkMiss  | 0,
    tick    : s => s.tick      | 0,
    groupHit: s => s.groupHit  | 0,
    wrong   : s => s.groupWrong| 0
  };

  const GOAL_POOL = [
    { id:'g_grp15', label:'เลือกอาหารหมู่เป้าหมายให้ได้ 15 ชิ้น',
      target:15, level:'easy',
      check:s=>G.groupHit(s)>=15, prog:s=>Math.min(15,G.groupHit(s)) },

    { id:'g_grp24', label:'เลือกอาหารหมู่เป้าหมายให้ได้ 24 ชิ้น',
      target:24, level:'normal',
      check:s=>G.groupHit(s)>=24, prog:s=>Math.min(24,G.groupHit(s)) },

    { id:'g_grp30', label:'เลือกอาหารหมู่เป้าหมายให้ได้ 30 ชิ้น',
      target:30, level:'hard',
      check:s=>G.groupHit(s)>=30, prog:s=>Math.min(30,G.groupHit(s)) },

    { id:'g_score1200', label:'ทำคะแนนรวม 1200+',
      target:1200, level:'normal',
      check:s=>G.score(s)>=1200, prog:s=>Math.min(1200,G.score(s)) },

    { id:'g_score2000', label:'ทำคะแนนรวม 2000+',
      target:2000, level:'hard',
      check:s=>G.score(s)>=2000, prog:s=>Math.min(2000,G.score(s)) },

    { id:'g_combo18', label:'คอมโบสูงสุด ≥ 18',
      target:18, level:'hard',
      check:s=>G.comboMax(s)>=18, prog:s=>Math.min(18,G.comboMax(s)) },

    { id:'g_cleanMiss', label:'เลือกผิด (หมู่อื่น/ของเสีย) ≤ 8 ครั้ง',
      target:8, level:'normal',
      check:s=>G.miss(s)<=8, prog:s=>Math.min(8,G.miss(s)) },

    { id:'g_time30', label:'อยู่รอดเกิน 30 วินาที',
      target:30, level:'easy',
      check:s=>G.tick(s)>=30, prog:s=>Math.min(30,G.tick(s)) },

    { id:'g_focus3', label:'ผ่านระดับโฟกัส 3 หมู่',
      target:1, level:'hard',
      check:s=>s.tier>=3, prog:s=>Math.min(1,s.tier>=3?1:0) },

    { id:'g_balanced', label:'เลือกหมู่เป้าหมายทุกหมู่ ≥ 5 ชิ้น',
      target:5, level:'normal',
      check:s=>{
        const g = s.perGroup || {};
        return [1,2,3,4,5].every(k => (g[k]|0) >= 5);
      },
      prog:s=>{
        const g = s.perGroup || {};
        const m = Math.min(...[1,2,3,4,5].map(k=>g[k]|0));
        return Math.min(5, m);
      }
    }
  ];

  const MINI_POOL = [
    { id:'m_combo10', label:'คอมโบต่อเนื่อง 10',
      target:10, level:'easy',
      check:s=>G.comboMax(s)>=10, prog:s=>Math.min(10,G.comboMax(s)) },

    { id:'m_combo16', label:'คอมโบต่อเนื่อง 16',
      target:16, level:'normal',
      check:s=>G.comboMax(s)>=16, prog:s=>Math.min(16,G.comboMax(s)) },

    { id:'m_grp10', label:'เลือกหมู่เป้าหมาย 10 ชิ้น',
      target:10, level:'easy',
      check:s=>G.groupHit(s)>=10, prog:s=>Math.min(10,G.groupHit(s)) },

    { id:'m_grp18', label:'เลือกหมู่เป้าหมาย 18 ชิ้น',
      target:18, level:'normal',
      check:s=>G.groupHit(s)>=18, prog:s=>Math.min(18,G.groupHit(s)) },

    { id:'m_under6', label:'เลือกผิด (ของเสีย/หมู่อื่น) ไม่เกิน 6 ครั้ง',
      target:6, level:'normal',
      check:s=>G.miss(s)<=6, prog:s=>Math.min(6,G.miss(s)) },

    { id:'m_timeNoMiss', label:'ช่วง 12 วิ โดยไม่เลือกผิด',
      target:12, level:'hard',
      check:s=>G.tick(s)>=12 && G.wrong(s)<=2,
      prog:s=>Math.min(12,G.tick(s)) },

    { id:'m_groupSpread', label:'หมู่เป้าหมายอย่างน้อย 3 หมู่มี ≥ 4 ชิ้น',
      target:3, level:'hard',
      check:s=>{
        const g = s.perGroup || {};
        return [1,2,3,4,5].filter(k => (g[k]|0)>=4).length >= 3;
      },
      prog:s=>{
        const g = s.perGroup || {};
        return Math.min(3,[1,2,3,4,5].filter(k => (g[k]|0)>=4).length);
      }
    }
  ];

  const deck = new MissionDeck({ goalPool: GOAL_POOL, miniPool: MINI_POOL });
  deck.drawGoals(5);
  deck.draw3();

  // extra stats
  deck.stats.groupHit   = 0;
  deck.stats.groupWrong = 0;
  deck.stats.tier       = 1;
  deck.stats.perGroup   = {1:0,2:0,3:0,4:0,5:0};

  // ---------- Coach ----------
  function coachSay(key, extra){
    let text = '';
    switch(key){
      case 'start': text = 'เริ่มจากโฟกัสหมู่เดียวก่อน เลือกให้ตรงหมู่ที่กำหนด!'; break;
      case 'tier2': text = 'เก่งมาก! ตอนนี้โฟกัส 2 หมู่แล้ว เลือกให้ไวและแม่นขึ้น'; break;
      case 'tier3': text = 'สุดยอด! โฟกัส 3 หมู่พร้อมกัน ลองรักษาคอมโบให้ได้'; break;
      case 'miss':  text = 'พลาดหมู่ไปบ้าง ไม่เป็นไร มองป้ายหมู่ให้ดีแล้วลองใหม่'; break;
      case 'danger':text = 'เวลาใกล้หมดแล้ว เลือกหมู่ให้ถูก อย่าเผลอคลิกของเสีย!'; break;
    }
    if (extra && extra.info) text += ' ' + extra.info;
    if (!text) return;
    try {
      window.dispatchEvent(new CustomEvent('coach:line', {
        detail:{ text, mode:'groups' }
      }));
    } catch(_) {}
  }

  // ---------- Focus groups (tier) ----------
  let focusGroups = [1]; // เริ่ม 1 หมู่
  let tier = 1;

  function pickFocus(n){
    const all = [1,2,3,4,5];
    const out = [];
    const pool = [...all];
    for(let i=0;i<n && pool.length;i++){
      const k = (Math.random()*pool.length)|0;
      out.push(pool.splice(k,1)[0]);
    }
    return out.sort();
  }

  function updateFocus(newTier){
    tier = Math.max(1, Math.min(3, newTier));
    deck.stats.tier = tier;
    focusGroups = pickFocus(tier);

    const label = 'โฟกัสหมู่อาหาร: ' + focusGroups.join(', ');
    window.dispatchEvent(new CustomEvent('quest:update', {
      detail:{
        focusGroups,
        goal: deck.getCurrent('goals'),
        mini: deck.getCurrent('mini'),
        hint: label
      }
    }));

    if (tier === 1) coachSay('start', {info:`โฟกัสหมู่ ${focusGroups.join(', ')}`});
    if (tier === 2) coachSay('tier2', {info:`ตอนนี้โฟกัสหมู่ ${focusGroups.join(', ')}`});
    if (tier === 3) coachSay('tier3', {info:`โฟกัสหมู่ ${focusGroups.join(', ')}`});
  }

  updateFocus(1);

  // ---------- Mode state ----------
  let score = 0;
  let combo = 0;
  let fever = 0;
  let feverActive = false;

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
    const d = feverActive ? 10 : base;
    fever = Math.max(0, fever - d);
    setFever(fever);
    if (feverActive && fever <= 0){
      feverActive = false;
      setFeverActive(false);
    }
  }

  function syncDeck(){
    deck.updateScore(score);
    deck.updateCombo(combo);
  }
  function emitCombo(){
    try{
      window.dispatchEvent(new CustomEvent('hha:combo',{detail:{combo}}));
    }catch(_){}
  }

  function pushQuest(){
    const goals = deck.getProgress('goals');
    const minis = deck.getProgress('mini');
    window.dispatchEvent(new CustomEvent('quest:update',{
      detail:{
        goal: goals.find(g=>!g.done)||goals[0]||null,
        mini: minis.find(m=>!m.done)||minis[0]||null,
        goalsAll:goals,
        minisAll:minis,
        focusGroups
      }
    }));
  }

  // ---------- Scoring ----------
  function judge(emo, ctx){
    const x = ctx.clientX || ctx.cx || 0;
    const y = ctx.clientY || ctx.cy || 0;

    const g = GROUP_BY_EMO[emo] || 0;
    const isGoodEmoji = !!g;
    const isJunk       = JUNK.includes(emo);

    // correct focus
    if (isGoodEmoji && focusGroups.includes(g)){
      let base = 14;
      if (diff === 'easy')  base = 12;
      if (diff === 'hard')  base = 16;
      const delta = (base + combo * 2) * mult();

      score += delta;
      combo++;
      emitCombo();
      gainFever(6 + combo * 0.4);

      deck.onGood();
      deck.stats.groupHit++;
      deck.stats.perGroup[g] = (deck.stats.perGroup[g]||0) + 1;
      syncDeck();

      Particles.burstShards(null,null,{screen:{x,y},theme:'groups'});
      Particles.scorePop?.(x,y,delta,{good:true});

      pushQuest();
      return { good:true, scoreDelta:delta };
    }

    // wrong group or junk
    let delta = -10;
    if (diff === 'easy') delta = -8;
    if (diff === 'hard') delta = -12;

    score = Math.max(0, score + delta);
    combo = 0;
    emitCombo();
    decayFever(12);

    deck.onJunk();
    deck.stats.groupWrong++;
    syncDeck();

    Particles.burstShards(null,null,{screen:{x,y},theme:'goodjunk'});
    Particles.scorePop?.(x,y,delta,{good:false});

    coachSay('miss');
    pushQuest();
    return { good:false, scoreDelta:delta };
  }

  function onExpire(ev){
    if (!ev) return;
    // หมดเวลาโดยไม่ได้เลือก → ถือเป็นพลาดเล็ก ๆ
    deck.onJunk();
    deck.stats.groupWrong++;
    combo = 0;
    emitCombo();
    decayFever(8);
    syncDeck();
    coachSay('miss');
    pushQuest();
  }

  function onSec(){
    if (combo <= 0) decayFever(6); else decayFever(2);
    deck.second();
    syncDeck();

    // ปรับ tier โดยดูผลรวมทุก ๆ ~12 วิ
    if (deck.stats.tick % 12 === 0){
      const good = deck.stats.goodCount|0;
      const miss = deck.stats.junkMiss|0;

      if (tier === 1 && good >= 14 && miss <= 5) updateFocus(2);
      else if (tier === 2 && good >= 26 && miss <= 7) updateFocus(3);
    }

    if (deck.isCleared('mini')){
      deck.draw3();
    }
    if (deck.isCleared('goals')){
      deck.drawGoals(5);
    }
    pushQuest();
  }

  // time listener
  window.addEventListener('hha:time',(e)=>{
    const sec = (e.detail?.sec|0);
    if (sec > 0) onSec();
    if (sec === 10) coachSay('danger');
    if (sec === 0){
      const goals = deck.getProgress('goals');
      const minis = deck.getProgress('mini');
      const goalsCleared = goals.filter(g=>g.done).length;
      const goalCleared  = goalsCleared > 0;
      const questsCleared = minis.filter(m=>m.done).length;

      window.dispatchEvent(new CustomEvent('hha:end',{
        detail:{
          mode        : 'Food Groups',
          difficulty  : diff,
          score,
          comboMax    : deck.stats.comboMax,
          misses      : deck.stats.junkMiss,
          hits        : deck.stats.goodCount,
          duration    : dur,
          goalCleared,
          goalsCleared,
          goalsTotal  : goals.length,
          questsCleared,
          questsTotal : minis.length
        }
      }));
    }
  });

  // ---------- Call factory ----------
  const controller = await factoryBoot({
    difficulty: diff,
    duration  : dur,
    pools     : { good: ALL_GOOD, bad: JUNK },
    goodRate  : 0.65,
    judge,
    onExpire
  });

  pushQuest();
  coachSay('start',{info:`โฟกัสหมู่ ${focusGroups.join(', ')}`});

  return controller;
}

export default { boot };