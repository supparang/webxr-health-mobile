// === /HeroHealth/modes/groups.safe.js (2025-11-13) ===
// โหมด Food Groups (เลือกหมู่อาหารที่กำหนด)
// - เริ่มจากโฟกัส 1 หมู่ → ขยับเป็น 2 / 3 หมู่ตามฝีมือ
// - ใช้ MissionDeck สำหรับ Goal + Mini Quest
// - ส่ง event 'coach:toast' เมื่อเลื่อนระดับ (ให้ HUD ไปทำ popup เอง)

import { boot as factoryBoot } from '../vr/mode-factory.js';
import { MissionDeck } from '../vr/mission.js';
import { ensureFeverBar, setFever, setFeverActive, setShield } from '../vr/ui-fever.js';
import { Particles } from '../vr/particles.js';

export async function boot(cfg = {}) {
  const diff = String(cfg.difficulty || 'normal');
  const dur  = Number(cfg.duration || 60);

  // ---------- Food groups & mapping ----------
  // กำหนดหมู่อาหาร (1–5) → emoji
  const GROUPS = {
    1: ['🍚','🍞','🥖','🥐','🥨','🥯'],                  // ข้าว-แป้ง
    2: ['🥩','🍗','🍖','🥚','🐟','🧆'],                  // เนื้อ-โปรตีน
    3: ['🥦','🥕','🥒','🍅','🥬','🫑'],                  // ผัก
    4: ['🍎','🍌','🍇','🍓','🍊','🍍','🍐'],              // ผลไม้
    5: ['🥛','🧀','🥛','🧈','🍨']                        // นม-ผลิตภัณฑ์นม
  };
  const ALL_CHARS = Object.values(GROUPS).flat();
  const charToGroup = {};
  Object.keys(GROUPS).forEach(g => {
    GROUPS[g].forEach(ch => { charToGroup[ch] = Number(g); });
  });
  function groupOf(ch){ return charToGroup[ch] || null; }

  const allGroupIds = Object.keys(GROUPS).map(n => Number(n));

  function pickN(arr, n){
    const src = [...arr]; const out=[];
    for(let i=0;i<n && src.length;i++){
      const k = (Math.random()*src.length)|0;
      out.push(src.splice(k,1)[0]);
    }
    return out;
  }

  // ---------- Fever / shield ----------
  ensureFeverBar(); setFever(0); setShield(0);
  let fever = 0, feverActive = false, shield = 0;

  function mult(){ return feverActive ? 2 : 1; }
  function gainFever(n){
    fever = Math.max(0, Math.min(100, fever + n));
    setFever(fever);
    if (!feverActive && fever >= 100){
      feverActive = true; setFeverActive(true);
    }
  }
  function decayFever(base){
    const d = feverActive ? 10 : base;
    fever = Math.max(0, fever - d);
    setFever(fever);
    if (feverActive && fever <= 0){
      feverActive = false; setFeverActive(false);
    }
  }

  // ---------- Mission / Quest ----------
  const G = {
    good     : s => s.goodCount|0,
    junk     : s => s.junkMiss|0,
    score    : s => s.score|0,
    comboMax : s => s.comboMax|0,
    tick     : s => s.tick|0
  };

  const GOAL_POOL = [
    { id:'gg_hit15',   label:'เลือกหมู่อาหารที่ถูกต้อง 15 ครั้ง', level:'easy',
      target:15,  check:s=>G.good(s)>=15,  prog:s=>Math.min(15, G.good(s)) },
    { id:'gg_hit28',   label:'เลือกหมู่อาหารที่ถูกต้อง 28 ครั้ง', level:'normal',
      target:28,  check:s=>G.good(s)>=28,  prog:s=>Math.min(28, G.good(s)) },
    { id:'gg_hit36',   label:'เลือกหมู่อาหารที่ถูกต้อง 36 ครั้ง', level:'hard',
      target:36,  check:s=>G.good(s)>=36,  prog:s=>Math.min(36, G.good(s)) },
    { id:'gg_score900',label:'ทำคะแนนรวม 900+',              level:'easy',
      target:900, check:s=>G.score(s)>=900, prog:s=>Math.min(900,G.score(s)) },
    { id:'gg_score1600',label:'ทำคะแนนรวม 1600+',             level:'normal',
      target:1600, check:s=>G.score(s)>=1600, prog:s=>Math.min(1600,G.score(s)) },
    { id:'gg_combo14', label:'คอมโบสูงสุด ≥ 14',              level:'normal',
      target:14,  check:s=>G.comboMax(s)>=14, prog:s=>Math.min(14,G.comboMax(s)) },
    { id:'gg_combo20', label:'คอมโบสูงสุด ≥ 20',              level:'hard',
      target:20,  check:s=>G.comboMax(s)>=20, prog:s=>Math.min(20,G.comboMax(s)) },
    { id:'gg_time30',  label:'อยู่รอดเกิน 30 วินาที',         level:'easy',
      target:30,  check:s=>G.tick(s)>=30,     prog:s=>Math.min(30,G.tick(s)) },
    { id:'gg_miss6',   label:'พลาดไม่เกิน 6 ครั้ง',            level:'normal',
      target:6,   check:s=>G.junk(s)<=6,      prog:s=>Math.max(0, 6-G.junk(s)) }
  ];

  const MINI_POOL = [
    { id:'gm_hit12',   label:'เลือกถูก 12 ครั้ง',         level:'easy',
      target:12,  check:s=>G.good(s)>=12,   prog:s=>Math.min(12,G.good(s)) },
    { id:'gm_hit20',   label:'เลือกถูก 20 ครั้ง',         level:'normal',
      target:20,  check:s=>G.good(s)>=20,   prog:s=>Math.min(20,G.good(s)) },
    { id:'gm_combo10', label:'คอมโบต่อเนื่อง 10',         level:'normal',
      target:10,  check:s=>G.comboMax(s)>=10, prog:s=>Math.min(10,G.comboMax(s)) },
    { id:'gm_score700',label:'ทำคะแนนรวม 700+',           level:'easy',
      target:700, check:s=>G.score(s)>=700,  prog:s=>Math.min(700,G.score(s)) },
    { id:'gm_nomiss6', label:'พลาดไม่เกิน 6 ครั้ง',        level:'normal',
      target:6,   check:s=>G.junk(s)<=6,     prog:s=>Math.max(0, 6-G.junk(s)) },
    { id:'gm_time20',  label:'เล่นครบ 20 วินาที',          level:'easy',
      target:20,  check:s=>G.tick(s)>=20,    prog:s=>Math.min(20,G.tick(s)) },
  ];

  const deck = new MissionDeck({ goalPool: GOAL_POOL, miniPool: MINI_POOL });
  deck.drawGoals(5);
  deck.draw3();

  function pushQuest(hint){
    const goals = deck.getProgress('goals');
    const minis = deck.getProgress('mini');
    const focusGoal = goals.find(g=>!g.done) || goals[0] || null;
    const focusMini = minis.find(m=>!m.done) || minis[0] || null;

    window.dispatchEvent(new CustomEvent('quest:update', {
      detail: { goal: focusGoal, mini: focusMini, goalsAll: goals, minisAll: minis, hint }
    }));
  }

  // ---------- Difficulty & focus groups ----------
  let tier = 1;                         // 1 → 2 → 3 กลุ่มที่ต้องโฟกัส
  let focusGroups = pickN(allGroupIds, tier);
  let lastTierToast = 0;

  function isFocusGroup(g){ return g && focusGroups.indexOf(g) !== -1; }

  function toast(msg){
    try{
      window.dispatchEvent(new CustomEvent('coach:toast',{
        detail:{ text: msg, mode:'groups', ts: Date.now() }
      }));
    }catch(_){}
  }

  function rerollFocus(reason){
    focusGroups = pickN(allGroupIds, tier);
    toast(`โฟกัสหมู่ ${focusGroups.join(', ')} ${reason||''}`.trim());
  }

  // เริ่มต้นบอกหมู่ที่ต้องโฟกัส
  rerollFocus('(เริ่มเกม)');

  // ---------- Score state ----------
  let score = 0, combo = 0;

  function syncDeck(){
    deck.updateScore(score);
    deck.updateCombo(combo);
  }

  function levelCheck(){
    const hits  = deck.stats.goodCount|0;
    const miss  = deck.stats.junkMiss|0;
    const acc   = (hits+miss)>0 ? hits/(hits+miss) : 1;
    const now   = Date.now();

    if (now - lastTierToast < 1500) return; // กัน spam

    if (tier === 1 && hits >= 14 && acc >= 0.78){
      tier = 2; lastTierToast = now;
      rerollFocus('(เลื่อนระดับเป็น 2 หมู่)');
      toast('โฟกัสเพิ่มเป็น 2 หมู่!');
    } else if (tier === 2 && hits >= 30 && acc >= 0.8){
      tier = 3; lastTierToast = now;
      rerollFocus('(เลื่อนระดับเป็น 3 หมู่)');
      toast('โฟกัสเพิ่มเป็น 3 หมู่!');
    }
  }

  // ---------- Judge & expire ----------
  function judge(ch, ctx){
    const x = ctx.clientX || ctx.cx || 0;
    const y = ctx.clientY || ctx.cy || 0;
    const g = groupOf(ch);

    if (!g){
      // ไม่รู้กลุ่ม → ถือเป็น distractor เบา ๆ
      Particles?.burstShards?.(null,null,{screen:{x,y},theme:'groups'});
      try{ if (Particles && typeof Particles.scorePop === 'function') Particles.scorePop(x,y,0); }catch(_){}
      return { good:false, scoreDelta:0 };
    }

    const target = isFocusGroup(g);

    // ป้องกัน expo โหดเกิน: ถ้ามีโล่ ให้ใช้โล่ก่อน
    if (!target && shield>0){
      shield -= 1; setShield(shield);
      Particles?.burstShards?.(null,null,{screen:{x,y},theme:'goodjunk'});
      try{ if (Particles && typeof Particles.scorePop === 'function') Particles.scorePop(x,y,0); }catch(_){}
      syncDeck(); pushQuest();
      return { good:false, scoreDelta:0 };
    }

    if (target){
      const base  = 18 + combo*2;
      const delta = base * mult();
      score += delta; combo += 1;
      gainFever(6 + combo*0.4);
      deck.onGood(); syncDeck();
      Particles?.burstShards?.(null,null,{screen:{x,y},theme:'groups'});
      try{ if (Particles && typeof Particles.scorePop === 'function') Particles.scorePop(x,y, '+'+delta); }catch(_){}
      pushQuest();
      levelCheck();
      return { good:true, scoreDelta: delta };
    } else {
      const delta = -10;
      score = Math.max(0, score + delta);
      combo = 0;
      decayFever(14);
      deck.onJunk(); syncDeck();
      Particles?.burstShards?.(null,null,{screen:{x,y},theme:'goodjunk'});
      try{ if (Particles && typeof Particles.scorePop === 'function') Particles.scorePop(x,y, delta); }catch(_){}
      pushQuest();
      levelCheck();
      return { good:false, scoreDelta: delta };
    }
  }

  function onExpire(ev){
    if (!ev) return;
    const ch = ev.char;
    const g  = groupOf(ch);
    if (!g) return;

    if (isFocusGroup(g)){
      // พลาดเป้าจริง ๆ
      combo = 0;
      decayFever(10);
      deck.onJunk(); syncDeck();
      pushQuest();
    } else {
      // เลี่ยงของล่อได้ → โบนัสนิดหน่อย
      gainFever(2);
      syncDeck(); pushQuest();
    }
    levelCheck();
  }

  // ต่อวินาที (ปรับ Fever / Quest / auto-refill)
  function onSec(){
    if (combo <= 0) decayFever(6); else decayFever(3);
    deck.second(); syncDeck(); pushQuest();
    // ถ้า mini หรือ goal เคลียร์หมด → เติมใหม่
    if (deck.isCleared('mini'))  { deck.draw3(); pushQuest('Mini ใหม่'); }
    if (deck.isCleared('goals')) { deck.drawGoals(5); pushQuest('Goal ใหม่'); }
  }

  window.addEventListener('hha:expired', onExpire);
  window.addEventListener('hha:time', (e)=>{
    const sec = (e.detail && e.detail.sec) | 0;
    if (sec >= 0) onSec();
  });

  // ---------- Boot factory ----------
  return factoryBoot({
    difficulty : diff,
    duration   : dur,
    pools      : { good:[...ALL_CHARS], bad:[...ALL_CHARS] }, // ใช้ทุกหมู่ ทั้งเป็นเป้า/ตัวล่อ
    goodRate   : 0.58,   // มีเป้าโผล่บ่อยพอประมาณ
    powerups   : [],     // ถ้าจะเพิ่ม power-up ภายหลังค่อยเติม
    powerRate  : 0.0,
    powerEvery : 999,
    judge,
    onExpire
  }).then(ctrl => {
    // จบเกม → ส่งสรุป
    window.addEventListener('hha:end', (e)=>{
      const d = e.detail || {};
      const goals = deck.getProgress('goals');
      const minis = deck.getProgress('mini');
      const goalCleared = goals.length>0 && goals.every(g=>g.done);

      d.mode        = d.mode        || 'Food Groups';
      d.difficulty  = d.difficulty  || diff;
      d.score       = d.score       != null ? d.score       : score;
      d.comboMax    = d.comboMax    != null ? d.comboMax    : deck.stats.comboMax;
      d.misses      = d.misses      != null ? d.misses      : deck.stats.junkMiss;
      d.duration    = d.duration    != null ? d.duration    : dur;
      d.goalCleared = d.goalCleared != null ? d.goalCleared : goalCleared;
      d.questsCleared = d.questsCleared != null ? d.questsCleared : minis.filter(m=>m.done).length;
      d.questsTotal   = d.questsTotal   != null ? d.questsTotal   : minis.length;

      // ส่งซ้ำอีกครั้งให้ main.js เก็บค่าสรุปล่าสุด
      window.dispatchEvent(new CustomEvent('hha:end',{detail:d}));
    }, { once:true });

    pushQuest('เริ่ม');
    return ctrl;
  });
}

export default { boot };