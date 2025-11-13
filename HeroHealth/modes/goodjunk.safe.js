// === /HeroHealth/modes/goodjunk.safe.js (2025-11-13 DYNAMIC + COACH) ===
// โหมด Good vs Junk
// - Goal 5 เป้า + Mini Quest 3 จาก 10 (เติมใหม่อัตโนมัติ)
// - ขยับความยากอัตโนมัติจาก tier 1 → 2 → 3 ตามฝีมือ (hits / accuracy)
// - ส่ง coach toast ผ่าน event 'coach:toast'
// - ใช้ Particles.burstShards + Particles.scorePop ตรงจุดคลิก

import { boot as factoryBoot } from '../vr/mode-factory.js';
import { MissionDeck } from '../vr/mission.js';
import { ensureFeverBar, setFever, setFeverActive, setShield } from '../vr/ui-fever.js';
import { Particles } from '../vr/particles.js';

export async function boot(cfg = {}) {
  const diff = String(cfg.difficulty || 'normal');
  const dur  = Number(cfg.duration || 60);

  // ---------- Pools ----------
  const GOOD = ['🥦','🥕','🍎','🍌','🥗','🐟','🥜','🍚','🍞','🥛','🍇','🍓','🍊','🍅','🥬','🥝','🍍','🍐','🍑'];
  const JUNK = ['🍔','🍟','🌭','🍕','🍩','🍪','🍰','🧋','🥤','🍫','🍬','🥓'];
  const STAR   = '⭐';
  const DIA    = '💎';
  const SHIELD = '🛡️';
  const FIRE   = '🔥';
  const BONUS  = [STAR, DIA, SHIELD, FIRE];

  // Fever bar & shield
  ensureFeverBar(); setFever(0); setShield(0);
  let fever = 0, feverActive = false, shield = 0;

  function mult(){ return feverActive ? 2 : 1; }
  function gainFever(n){
    fever = Math.max(0, Math.min(100, fever + n));
    setFever(fever);
    if (!feverActive && fever >= 100){
      feverActive = true; setFeverActive(true);
      toast('เข้าสู่โหมด FEVER! คะแนน x2');
    }
  }
  function decayFever(base){
    const d = feverActive ? 10 : base;
    fever = Math.max(0, fever - d);
    setFever(fever);
    if (feverActive && fever <= 0){
      feverActive = false; setFeverActive(false);
      toast('Fever หมดแล้ว ลองต่อคอมโบใหม่!');
    }
  }

  // ---------- Coach toast helper ----------
  let lastToastTs = 0;
  function toast(text){
    const now = Date.now();
    if (now - lastToastTs < 1200) return; // กัน spam หน่อย
    lastToastTs = now;
    try{
      window.dispatchEvent(new CustomEvent('coach:toast', {
        detail:{ text, mode:'goodjunk', ts: now }
      }));
    }catch(_){}
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
    { id:'g_good20',  label:'เก็บของดีให้ได้ 20 ชิ้น', level:'easy',
      target:20,  check:s=>G.good(s)>=20,  prog:s=>Math.min(20,G.good(s)) },
    { id:'g_good28',  label:'เก็บของดีให้ได้ 28 ชิ้น', level:'normal',
      target:28,  check:s=>G.good(s)>=28,  prog:s=>Math.min(28,G.good(s)) },
    { id:'g_good34',  label:'เก็บของดีให้ได้ 34 ชิ้น', level:'hard',
      target:34,  check:s=>G.good(s)>=34,  prog:s=>Math.min(34,G.good(s)) },

    { id:'g_score800', label:'ทำคะแนนรวม 800+',       level:'easy',
      target:800, check:s=>G.score(s)>=800, prog:s=>Math.min(800,G.score(s)) },
    { id:'g_score1500',label:'ทำคะแนนรวม 1500+',      level:'normal',
      target:1500,check:s=>G.score(s)>=1500,prog:s=>Math.min(1500,G.score(s)) },
    { id:'g_score2200',label:'ทำคะแนนรวม 2200+',      level:'hard',
      target:2200,check:s=>G.score(s)>=2200,prog:s=>Math.min(2200,G.score(s)) },

    { id:'g_combo16', label:'คอมโบสูงสุด ≥ 16',       level:'normal',
      target:16,  check:s=>G.comboMax(s)>=16, prog:s=>Math.min(16,G.comboMax(s)) },
    { id:'g_combo24', label:'คอมโบสูงสุด ≥ 24',       level:'hard',
      target:24,  check:s=>G.comboMax(s)>=24, prog:s=>Math.min(24,G.comboMax(s)) },

    { id:'g_time30',  label:'อยู่รอดเกิน 30 วินาที',  level:'easy',
      target:30,  check:s=>G.tick(s)>=30,     prog:s=>Math.min(30,G.tick(s)) },

    // เควสต์ “พลาดไม่เกิน 6 ครั้ง” — prog ใช้ 6 - junkMiss เพื่อให้เห็นว่ากำลังจะไม่ผ่าน
    { id:'g_nojunk6', label:'พลาด (โดนของเสีย) ≤ 6', level:'normal',
      target:6,   check:s=>G.junk(s)<=6,      prog:s=>Math.max(0, 6 - G.junk(s)) }
  ];

  const MINI_POOL = [
    { id:'m_combo12',  label:'คอมโบต่อเนื่อง 12',      level:'normal',
      target:12,  check:s=>G.comboMax(s)>=12,  prog:s=>Math.min(12,G.comboMax(s)) },
    { id:'m_combo18',  label:'คอมโบต่อเนื่อง 18',      level:'hard',
      target:18,  check:s=>G.comboMax(s)>=18,  prog:s=>Math.min(18,G.comboMax(s)) },

    { id:'m_score600', label:'ทำคะแนนรวม 600+',        level:'easy',
      target:600, check:s=>G.score(s)>=600,    prog:s=>Math.min(600,G.score(s)) },
    { id:'m_score1200',label:'ทำคะแนนรวม 1200+',       level:'normal',
      target:1200,check:s=>G.score(s)>=1200,   prog:s=>Math.min(1200,G.score(s)) },

    { id:'m_good10',   label:'เก็บของดี 10 ชิ้น',       level:'easy',
      target:10,  check:s=>G.good(s)>=10,      prog:s=>Math.min(10,G.good(s)) },
    { id:'m_good18',   label:'เก็บของดี 18 ชิ้น',       level:'normal',
      target:18,  check:s=>G.good(s)>=18,      prog:s=>Math.min(18,G.good(s)) },

    { id:'m_nomiss12', label:'ไม่พลาด 12 วินาที',        level:'normal',
      target:12,  check:s=>G.tick(s)>=12 && s.combo>0, prog:s=>Math.min(12,G.tick(s)) },

    { id:'m_star2',    label:'เก็บ ⭐ 2 ดวง',            level:'hard',
      target:2,   check:s=>s.star>=2,          prog:s=>Math.min(2,s.star|0) },
    { id:'m_dia1',     label:'เก็บ 💎 1 เม็ด',           level:'hard',
      target:1,   check:s=>s.diamond>=1,       prog:s=>Math.min(1,s.diamond|0) },

    { id:'m_under6',   label:'พลาดไม่เกิน 6 ครั้ง',      level:'normal',
      target:6,   check:s=>G.junk(s)<=6,       prog:s=>Math.max(0, 6-G.junk(s)) },
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
      detail:{ goal: focusGoal, mini: focusMini, goalsAll: goals, minisAll: minis, hint }
    }));
  }

  // ---------- Dynamic difficulty tier ----------
  // tier 1 = เบา, 2 = ปานกลาง, 3 = โหด (spawn ยังอยู่ที่ mode-factory, ที่นี่ปรับ "โทษ/โบนัส" + coach)
  let tier = 1;

  function tierLabel(){
    return tier === 1 ? 'ระดับเบา'
         : tier === 2 ? 'ระดับท้าทาย'
         : 'ระดับโหด!';
  }

  function checkTier() {
    const hits = deck.stats.goodCount|0;
    const miss = deck.stats.junkMiss|0;
    const acc  = (hits+miss) > 0 ? hits/(hits+miss) : 1;

    // กติกาคร่าว ๆ ปรับได้:
    if (tier === 1 && hits >= 18 && acc >= 0.78) {
      tier = 2;
      toast('เก่งมาก! ปรับเป็นระดับท้าทาย (Tier 2)');
    } else if (tier === 2 && hits >= 36 && acc >= 0.8) {
      tier = 3;
      toast('เทพแล้ว! ปรับเป็นระดับโหด (Tier 3)');
    }
  }

  function tieredBonus(base){
    if (tier === 1) return base;
    if (tier === 2) return Math.round(base * 1.1);
    return Math.round(base * 1.2);
  }

  function tieredPenalty(base){
    if (tier === 1) return base * 0.7;
    if (tier === 2) return base;
    return base * 1.4;
  }

  // ---------- Score state ----------
  let score=0, combo=0, star=0, diamond=0;

  function syncDeck(){
    deck.updateScore(score);
    deck.updateCombo(combo);
    deck.stats.star    = star;
    deck.stats.diamond = diamond;
  }

  // ---------- Judge ----------
  function scorePop(x,y,val){
    try{
      if (Particles && typeof Particles.scorePop === 'function'){
        Particles.scorePop(x,y,val);
      }
    }catch(_){}
  }

  function judge(ch, ctx){
    const x = ctx.clientX || ctx.cx || 0;
    const y = ctx.clientY || ctx.cy || 0;

    // Power-ups
    if (ch === STAR){
      const d = tieredBonus(40 * mult());
      score += d; gainFever(10); star++;
      deck.onGood(); syncDeck(); pushQuest();
      Particles?.burstShards?.(null,null,{screen:{x,y},theme:'goodjunk'});
      scorePop(x,y,'+'+d);
      toast('เก็บดาว! คะแนนพิเศษ');
      checkTier();
      return { good:true, scoreDelta:d };
    }
    if (ch === DIA){
      const d = tieredBonus(80 * mult());
      score += d; gainFever(30); diamond++;
      deck.onGood(); syncDeck(); pushQuest();
      Particles?.burstShards?.(null,null,{screen:{x,y},theme:'groups'});
      scorePop(x,y,'+'+d);
      toast('เก็บเพชรได้! เยี่ยมมาก');
      checkTier();
      return { good:true, scoreDelta:d };
    }
    if (ch === SHIELD){
      shield = Math.min(3, shield+1);
      setShield(shield);
      const d = tieredBonus(20);
      score += d; deck.onGood(); syncDeck(); pushQuest();
      Particles?.burstShards?.(null,null,{screen:{x,y},theme:'hydration'});
      scorePop(x,y,'+'+d);
      toast('ได้โล่ป้องกัน 1 ชั้น');
      checkTier();
      return { good:true, scoreDelta:d };
    }
    if (ch === FIRE){
      feverActive = true; setFeverActive(true);
      fever = Math.max(fever, 60); setFever(fever);
      const d = tieredBonus(25);
      score += d; deck.onGood(); syncDeck(); pushQuest();
      Particles?.burstShards?.(null,null,{screen:{x,y},theme:'plate'});
      scorePop(x,y,'+'+d);
      toast('โหมดไฟลุก! เก็บให้ทัน!');
      checkTier();
      return { good:true, scoreDelta:d };
    }

    const isGood = GOOD.includes(ch);
    if (isGood){
      const base  = 16 + combo*2;
      const delta = tieredBonus(base) * mult();
      score += delta; combo += 1;
      gainFever(7 + combo*0.5);
      deck.onGood(); syncDeck(); pushQuest();
      Particles?.burstShards?.(null,null,{screen:{x,y},theme:'goodjunk'});
      scorePop(x,y,'+'+delta);

      if (combo === 5)  toast('ดีมาก! คอมโบ 5 แล้ว');
      if (combo === 10) toast('สุดยอด! คอมโบสองหลักแล้ว!');
      checkTier();
      return { good:true, scoreDelta:delta };
    } else {
      // ใช้โล่ก่อน ถ้ามี
      if (shield > 0){
        shield -= 1; setShield(shield);
        Particles?.burstShards?.(null,null,{screen:{x,y},theme:'goodjunk'});
        scorePop(x,y,'0');
        toast('โล่ช่วยกันความเสียหายไว้!');
        syncDeck(); pushQuest(); checkTier();
        return { good:false, scoreDelta:0 };
      }

      const base  = -12;
      const delta = Math.round(tieredPenalty(base));
      score = Math.max(0, score + delta);
      combo = 0;
      decayFever(16);
      deck.onJunk(); syncDeck(); pushQuest();
      Particles?.burstShards?.(null,null,{screen:{x,y},theme:'groups'});
      scorePop(x,y,delta);
      toast('พลาดไปนิด ลองโฟกัสของดีให้มากขึ้น');
      checkTier();
      return { good:false, scoreDelta:delta };
    }
  }

  // ---------- Expire ----------
  function onExpire(ev){
    if (!ev) return;
    if (!ev.isGood){
      // เลี่ยงของเสียได้ → โบนัสนิดหน่อย
      gainFever(4);
      syncDeck(); pushQuest();
    } else {
      // ปล่อยของดีหลุดมือ
      combo = 0;
      decayFever(8);
      deck.onJunk(); syncDeck(); pushQuest();
    }
    checkTier();
  }

  // ---------- Per second ----------
  function onSec(){
    if (combo <= 0) decayFever(6); else decayFever(2);
    deck.second(); syncDeck(); pushQuest();

    // เติม quest อัตโนมัติถ้าเคลียร์หมด
    if (deck.isCleared('mini'))  { deck.draw3();  pushQuest('Mini ใหม่'); }
    if (deck.isCleared('goals')) { deck.drawGoals(5); pushQuest('Goal ใหม่'); }

    checkTier();
  }

  window.addEventListener('hha:expired', onExpire);
  window.addEventListener('hha:time', (e)=>{
    const sec = (e.detail?.sec|0);
    if (sec >= 0) onSec();
  });

  // ---------- Boot mode-factory ----------
  return factoryBoot({
    difficulty : diff,
    duration   : dur,
    pools      : { good:[...GOOD, ...BONUS], bad:[...JUNK] },
    goodRate   : 0.62,
    powerups   : BONUS,
    powerRate  : 0.10,
    powerEvery : 7,
    judge      : (ch, ctx)=>judge(ch, { ...ctx, cx:(ctx.clientX||ctx.cx), cy:(ctx.clientY||ctx.cy) }),
    onExpire
  }).then(ctrl=>{
    // hook end summary
    window.addEventListener('hha:end',(e)=>{
      const goals = deck.getProgress('goals');
      const minis = deck.getProgress('mini');
      const goalCleared = goals.length>0 && goals.every(g=>g.done);
      const d = e.detail || {};
      d.mode        = d.mode        || 'Good vs Junk';
      d.difficulty  = d.difficulty  || diff;
      d.score       = d.score       != null ? d.score       : score;
      d.comboMax    = d.comboMax    != null ? d.comboMax    : deck.stats.comboMax;
      d.misses      = d.misses      != null ? d.misses      : deck.stats.junkMiss;
      d.duration    = d.duration    != null ? d.duration    : dur;
      d.goalCleared = d.goalCleared != null ? d.goalCleared : goalCleared;
      d.questsCleared = d.questsCleared != null ? d.questsCleared : minis.filter(m=>m.done).length;
      d.questsTotal   = d.questsTotal   != null ? d.questsTotal   : minis.length;
      // ส่งซ้ำให้ main.js ใช้สรุปเวอร์ชันเต็ม
      window.dispatchEvent(new CustomEvent('hha:end',{detail:d}));
    }, { once:true });

    pushQuest('เริ่ม');
    toast('แตะของดี เก็บคอมโบยาว ๆ แล้วเลี่ยงของเสียให้ได้มากที่สุด!');
    return ctrl;
  });
}

export default { boot };