// === /HeroHealth/modes/goodjunk.safe.js (2025-11-13 LATEST) ===
// โหมด Good vs Junk + Goal 5/สุ่มจาก 10 + Mini 3/สุ่มจาก 10
// - เอฟเฟกต์คะแนนตรงตามที่ได้จริง (Particles.scorePop)
// - คอมโบส่ง event hha:combo ให้ HUD
// - โค้ชส่งข้อความผ่าน coach:line (ไปแสดงใต้ fever bar ได้)

import { boot as factoryBoot } from '../vr/mode-factory.js';
import { MissionDeck } from '../vr/mission.js';
import { ensureFeverBar, setFever, setFeverActive, setShield } from '../vr/ui-fever.js';
import { Particles } from '../vr/particles.js';

export async function boot(cfg = {}) {
  const diff = String(cfg.difficulty || 'normal');
  const dur  = Number(cfg.duration || 60);

  // ---------- พูลอีโมจิ ----------
  const GOOD = ['🥦','🥕','🍎','🍌','🥗','🐟','🥜','🍚','🍞','🥛',
                '🍇','🍓','🍊','🍅','🥬','🥝','🍍','🍐','🍑'];
  const JUNK = ['🍔','🍟','🌭','🍕','🍩','🍪','🍰','🧋','🥤','🍫','🍬','🥓'];

  const STAR   = '⭐';
  const DIA    = '💎';
  const SHIELD = '🛡️';
  const FIRE   = '🔥';
  const BONUS  = [STAR, DIA, SHIELD, FIRE];

  // ---------- HUD เริ่มต้น ----------
  ensureFeverBar();
  setFever(0);
  setShield(0);
  setFeverActive(false);

  // ---------- ตัวช่วยสำหรับ Goal / Mini ----------
  const G = {
    good    : s => s.goodCount | 0,
    junk    : s => s.junkMiss  | 0,
    score   : s => s.score     | 0,
    combo   : s => s.combo     | 0,
    comboMax: s => s.comboMax  | 0,
    tick    : s => s.tick      | 0
  };

  // 10 Goal ใหญ่ — เราจะสุ่มมาใช้ 5 เป้าต่อเกม
  const GOAL_POOL = [
    { id:'g_good20',    label:'เก็บของดีให้ได้ 20 ชิ้น', level:'easy',
      target:20,  check:s=>G.good(s)>=20,  prog:s=>Math.min(20,G.good(s)) },
    { id:'g_good28',    label:'เก็บของดีให้ได้ 28 ชิ้น', level:'normal',
      target:28,  check:s=>G.good(s)>=28,  prog:s=>Math.min(28,G.good(s)) },
    { id:'g_good34',    label:'เก็บของดีให้ได้ 34 ชิ้น', level:'hard',
      target:34,  check:s=>G.good(s)>=34,  prog:s=>Math.min(34,G.good(s)) },

    { id:'g_score800',  label:'ทำคะแนนรวม 800+',          level:'easy',
      target:800, check:s=>G.score(s)>=800, prog:s=>Math.min(800,G.score(s)) },
    { id:'g_score1500', label:'ทำคะแนนรวม 1500+',         level:'normal',
      target:1500,check:s=>G.score(s)>=1500,prog:s=>Math.min(1500,G.score(s)) },
    { id:'g_score2200', label:'ทำคะแนนรวม 2200+',         level:'hard',
      target:2200,check:s=>G.score(s)>=2200,prog:s=>Math.min(2200,G.score(s)) },

    { id:'g_combo16',   label:'คอมโบสูงสุด ≥ 16',         level:'normal',
      target:16,  check:s=>G.comboMax(s)>=16, prog:s=>Math.min(16,G.comboMax(s)) },
    { id:'g_combo24',   label:'คอมโบสูงสุด ≥ 24',         level:'hard',
      target:24,  check:s=>G.comboMax(s)>=24, prog:s=>Math.min(24,G.comboMax(s)) },

    { id:'g_time30',    label:'อยู่รอดเกิน 30 วินาที',    level:'easy',
      target:30,  check:s=>G.tick(s)>=30,     prog:s=>Math.min(30,G.tick(s)) },

    // เน้น "โดนของเสีย" ไม่เกิน 6 ครั้ง
    { id:'g_nojunk6',   label:'พลาด (โดนของเสีย) ≤ 6',   level:'normal',
      target:6,   check:s=>G.junk(s)<=6,      prog:s=>Math.min(6,G.junk(s)) }
  ];

  // 10 Mini Quest — สุ่มมา 3 อันระหว่างเกม
  const MINI_POOL = [
    { id:'m_combo12',  label:'คอมโบต่อเนื่อง 12',        level:'normal',
      target:12,  check:s=>G.comboMax(s)>=12, prog:s=>Math.min(12,G.comboMax(s)) },
    { id:'m_combo18',  label:'คอมโบต่อเนื่อง 18',        level:'hard',
      target:18,  check:s=>G.comboMax(s)>=18, prog:s=>Math.min(18,G.comboMax(s)) },

    { id:'m_score600', label:'ทำคะแนนรวม 600+',          level:'easy',
      target:600, check:s=>G.score(s)>=600,   prog:s=>Math.min(600,G.score(s)) },
    { id:'m_score1200',label:'ทำคะแนนรวม 1200+',         level:'normal',
      target:1200,check:s=>G.score(s)>=1200,  prog:s=>Math.min(1200,G.score(s)) },

    { id:'m_good10',   label:'เก็บของดี 10 ชิ้น',         level:'easy',
      target:10,  check:s=>G.good(s)>=10,     prog:s=>Math.min(10,G.good(s)) },
    { id:'m_good18',   label:'เก็บของดี 18 ชิ้น',         level:'normal',
      target:18,  check:s=>G.good(s)>=18,     prog:s=>Math.min(18,G.good(s)) },

    { id:'m_nomiss12', label:'ไม่พลาด 12 วินาที',          level:'normal',
      target:12,  check:s=>G.tick(s)>=12 && s.combo>0,
      prog:s=>Math.min(12,G.tick(s)) },

    { id:'m_star2',    label:'เก็บ ⭐ 2 ดวง',              level:'hard',
      target:2,   check:s=>s.star>=2,         prog:s=>Math.min(2,s.star|0) },
    { id:'m_dia1',     label:'เก็บ 💎 1 เม็ด',             level:'hard',
      target:1,   check:s=>s.diamond>=1,      prog:s=>Math.min(1,s.diamond|0) },

    { id:'m_under6',   label:'พลาด (โดนของเสีย) ไม่เกิน 6 ครั้ง', level:'normal',
      target:6,   check:s=>G.junk(s)<=6,      prog:s=>Math.min(6,G.junk(s)) }
  ];

  // เด็คเควสต์
  const deck = new MissionDeck({ goalPool: GOAL_POOL, miniPool: MINI_POOL });
  deck.drawGoals(5);
  deck.draw3();

  // ---------- โค้ช ----------
  function coachSay(key){
    let text = '';
    switch(key){
      case 'warmup':  text = 'อุ่นเครื่องก่อน เก็บของดีเรื่อย ๆ ให้ติดมือ'; break;
      case 'combo8':  text = 'ดีมาก! รักษาคอมโบให้ได้เกิน 8 เลย!'; break;
      case 'combo16': text = 'สุดยอด! คอมโบสูง ๆ แบบนี้สุขภาพดีแน่'; break;
      case 'danger':  text = 'เวลาใกล้หมดแล้ว เก็บของดีด่วน!'; break;
      case 'miss':    text = 'พลาดนิดหน่อย ไม่เป็นไร กลับมาโฟกัสดี ๆ'; break;
    }
    if (!text) return;
    try {
      window.dispatchEvent(new CustomEvent('coach:line', {
        detail: { text, mode:'goodjunk' }
      }));
    } catch(_) {}
  }

  // ส่ง goal/mini ปัจจุบันไป HUD
  function pushQuest(hint){
    const goals = deck.getProgress('goals');
    const minis = deck.getProgress('mini');
    const focusGoal = goals.find(g=>!g.done) || goals[0] || null;
    const focusMini = minis.find(m=>!m.done) || minis[0] || null;

    window.dispatchEvent(new CustomEvent('quest:update', {
      detail: {
        goal: focusGoal,
        mini: focusMini,
        goalsAll: goals,
        minisAll: minis,
        hint
      }
    }));
  }

  // ---------- สถานะหลักของโหมด ----------
  let score = 0;
  let combo = 0;
  let shield = 0;
  let fever  = 0;
  let feverActive = false;
  let star = 0;
  let diamond = 0;

  function mult(){ return feverActive ? 2 : 1; }

  function gainFever(n){
    fever = Math.max(0, Math.min(100, fever + n));
    setFever(fever);
    if (!feverActive && fever >= 100){
      feverActive = true;
      setFeverActive(true);
      coachSay('combo8');
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
    deck.stats.star    = star;
    deck.stats.diamond = diamond;
  }

  function emitCombo(){
    try {
      window.dispatchEvent(new CustomEvent('hha:combo', {
        detail: { combo }
      }));
    } catch(_) {}
  }

  // ---------- การให้คะแนน ----------
  function judge(ch, ctx){
    const x = ctx.clientX || ctx.cx || 0;
    const y = ctx.clientY || ctx.cy || 0;

    // --- Power-ups ---
    if (ch === STAR){
      const delta = 40 * mult();
      score += delta;
      star++;
      gainFever(10);
      deck.onGood();
      syncDeck();
      Particles.burstShards(null, null, { screen:{x,y}, theme:'goodjunk' });
      Particles.scorePop?.(x, y, delta, { good:true });
      combo++; emitCombo();        // ดาวถือเป็นคอมโบดี
      coachSay('warmup');
      return { good:true, scoreDelta: delta };
    }

    if (ch === DIA){
      const delta = 80 * mult();
      score += delta;
      diamond++;
      gainFever(30);
      deck.onGood();
      syncDeck();
      Particles.burstShards(null, null, { screen:{x,y}, theme:'groups' });
      Particles.scorePop?.(x, y, delta, { good:true });
      combo++; emitCombo();
      return { good:true, scoreDelta: delta };
    }

    if (ch === SHIELD){
      shield = Math.min(3, shield + 1);
      setShield(shield);
      const delta = 20;
      score += delta;
      deck.onGood();
      syncDeck();
      Particles.burstShards(null, null, { screen:{x,y}, theme:'hydration' });
      Particles.scorePop?.(x, y, delta, { good:true });
      combo++; emitCombo();
      return { good:true, scoreDelta: delta };
    }

    if (ch === FIRE){
      feverActive = true;
      setFeverActive(true);
      fever = Math.max(fever, 60);
      setFever(fever);
      const delta = 25;
      score += delta;
      deck.onGood();
      syncDeck();
      Particles.burstShards(null, null, { screen:{x,y}, theme:'plate' });
      Particles.scorePop?.(x, y, delta, { good:true });
      combo++; emitCombo();
      coachSay('combo16');
      return { good:true, scoreDelta: delta };
    }

    // --- ของดี / ของเสีย ---
    const isGood = GOOD.includes(ch);

    if (isGood){
      // ฐานคะแนนปรับตามระดับ
      let base = 14;
      if (diff === 'easy')   base = 12;
      if (diff === 'hard')   base = 16;
      const delta = (base + combo * 2) * mult();

      score += delta;
      combo += 1;
      emitCombo();
      gainFever(7 + combo * 0.5);
      deck.onGood();
      syncDeck();

      Particles.burstShards(null, null, { screen:{x,y}, theme:'goodjunk' });
      Particles.scorePop?.(x, y, delta, { good:true });

      if (combo === 8)  coachSay('combo8');
      if (combo === 16) coachSay('combo16');

      pushQuest();
      return { good:true, scoreDelta: delta };
    } else {
      // ของเสีย
      if (shield > 0){
        shield -= 1;
        setShield(shield);
        Particles.burstShards(null, null, { screen:{x,y}, theme:'goodjunk' });
        Particles.scorePop?.(x, y, 0, { good:false });
        // ไม่ถือว่า "พลาด" จริง เพราะมีเกราะ → ไม่เพิ่ม junkMiss
        syncDeck();
        pushQuest();
        return { good:false, scoreDelta: 0 };
      }

      const delta = -12;
      score = Math.max(0, score + delta);
      combo = 0;
      emitCombo();
      decayFever(16);

      deck.onJunk(); // คือ "โดนของเสีย" → นับ miss
      syncDeck();
      Particles.burstShards(null, null, { screen:{x,y}, theme:'groups' });
      Particles.scorePop?.(x, y, delta, { good:false });

      coachSay('miss');
      pushQuest();
      return { good:false, scoreDelta: delta };
    }
  }

  // ---------- เมื่อเป้าหมายหมดอายุ ----------
  function onExpire(ev){
    if (!ev) return;
    if (ev.isGood){
      // ของดีหายไปเฉย ๆ → ถือว่า "พลาด" ครั้งหนึ่ง
      deck.onJunk();
      combo = 0;
      emitCombo();
      decayFever(10);
      syncDeck();
      coachSay('miss');
      pushQuest();
    } else {
      // ของเสียหายไปเอง = เลี่ยง junk สำเร็จ → ให้ fever เล็กน้อย
      gainFever(4);
      syncDeck();
      pushQuest();
    }
  }

  // ---------- ต่อวินาที ----------
  function onSec(){
    if (combo <= 0) decayFever(6);
    else           decayFever(2);

    deck.second();
    syncDeck();
    pushQuest();

    // เติมเควสต์อัตโนมัติเมื่อเคลียร์หมด
    if (deck.isCleared('mini')){
      deck.draw3();
      pushQuest('Mini ใหม่');
    }
    if (deck.isCleared('goals')){
      deck.drawGoals(5);
      pushQuest('Goal ใหม่');
    }
  }

  // Event จากโรงงาน spawn
  window.addEventListener('hha:expired', onExpire);
  window.addEventListener('hha:time', (e)=>{
    const sec = (e.detail?.sec | 0);
    if (sec >= 0) onSec();
    if (sec === 10) coachSay('danger');
  });

  // ---------- เรียกโรงงาน spawn ----------
  const controller = await factoryBoot({
    difficulty: diff,
    duration  : dur,
    pools     : { good:[...GOOD, ...BONUS], bad:[...JUNK] },
    goodRate  : 0.62,
    powerups  : BONUS,
    powerRate : 0.10,
    powerEvery: 7,
    judge     : (ch, ctx) => judge(ch, {
      ...ctx,
      cx: (ctx.clientX || ctx.cx),
      cy: (ctx.clientY || ctx.cy)
    }),
    onExpire
  });

  // ---------- สรุปผลเมื่อหมดเวลา ----------
  window.addEventListener('hha:time', (e)=> {
    const sec = (e.detail?.sec | 0);
    if (sec > 0) return;      // ยังไม่จบเกม (เราฟังครั้งที่ sec==0 เท่านั้น)

    const goals = deck.getProgress('goals');
    const minis = deck.getProgress('mini');

    const goalsCleared = goals.filter(g => g.done).length;
    const goalCleared  = goalsCleared > 0;       // ผ่านอย่างน้อย 1 goal = "ถึงเป้า"

    const questsCleared = minis.filter(m => m.done).length;
    const questsTotal   = minis.length;          // โดยปกติคือ 3

    window.dispatchEvent(new CustomEvent('hha:end', {
      detail: {
        mode       : 'Good vs Junk',
        difficulty : diff,
        score,
        comboMax   : deck.stats.comboMax,
        misses     : deck.stats.junkMiss,
        hits       : deck.stats.goodCount,
        duration   : dur,

        goalCleared,
        goalsCleared,
        goalsTotal : goals.length,

        questsCleared,
        questsTotal
      }
    }));
  });

  // ส่งเควสต์ชุดแรก + โค้ชเปิดเกม
  pushQuest('เริ่ม');
  coachSay('warmup');

  return controller;
}

export default { boot };