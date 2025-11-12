// === /HeroHealth/modes/goodjunk.safe.js (2025-11-12 FIXED: no deck.drawGoals; Goals self-managed) ===
import { boot as factoryBoot } from '../vr/mode-factory.js';
import { MissionDeck } from '../vr/mission.js';
import { questHUDInit, questHUDUpdate, questHUDDispose } from '../vr/quest-hud.js';
import { ensureFeverBar, setFever, setFeverActive, setShield, addShield } from '../vr/ui-fever.js';
import { Particles } from '../vr/particles.js';

export async function boot(cfg = {}) {
  const diff = String(cfg.difficulty || 'normal');
  const dur  = Number(cfg.duration != null ? cfg.duration : 60) | 0;

  // --- Pools ---
  const GOOD   = ['🥦','🥕','🍎','🐟','🥛','🍊','🍌','🍇','🥬','🍚','🥜','🍞','🍓','🍍','🥝','🍐'];
  const JUNK   = ['🍔','🍟','🍕','🍩','🍪','🧁','🥤','🧋','🍫','🌭','🍰','🍬'];
  const STAR   = '⭐', DIA='💎', SHIELD='🛡️', FIRE='🔥';
  const BONUS  = [STAR, DIA, SHIELD, FIRE];

  // --- HUD prep ---
  try { ensureFeverBar(); setFever(0); setFeverActive(false); setShield(0); } catch {}

  // --- Stats (สะท้อนให้ MissionDeck อ่านได้ด้วย) ---
  let score=0, combo=0, comboMax=0, shield=0;
  let fever=0, feverActive=false, feverCount=0;
  let star=0, diamond=0;
  let goodCount=0, junkMiss=0, noMissTime=0; // สำหรับ goal/quest

  function mult(){ return feverActive ? 2 : 1; }
  function gainFever(n){
    fever = Math.max(0, Math.min(100, fever + n));
    try{ setFever(fever); }catch{}
    if(!feverActive && fever>=100){ feverActive=true; feverCount++; try{ setFeverActive(true);}catch{}; }
  }
  function decayFever(base){
    const d = feverActive ? 10 : base;
    const was = feverActive;
    fever = Math.max(0, fever - d);
    try{ setFever(fever); }catch{}
    if (was && fever<=0){ feverActive=false; try{ setFeverActive(false);}catch{}; }
  }

  // ----- GOAL หลัก: 10 ใบ → สุ่ม 5 ใบ ตาม diff (easy ⊆ normal ⊆ hard) -----
  // ใช้ s = snapshot ของสถานะล่าสุด (อ่านจากตัวแปรด้านบน)
  function snap(){
    return {
      score, comboMax, goodCount, junkMiss, noMissTime, star, diamond, feverCount
    };
  }
  const goalPool10 = [
    { id:'g_score350', level:'easy',   label:'ทำคะแนนรวม ≥ 350', check:s=>s.score>=350, prog:s=>Math.min(350,s.score), target:350 },
    { id:'g_score550', level:'normal', label:'ทำคะแนนรวม ≥ 550', check:s=>s.score>=550, prog:s=>Math.min(550,s.score), target:550 },
    { id:'g_score750', level:'hard',   label:'ทำคะแนนรวม ≥ 750', check:s=>s.score>=750, prog:s=>Math.min(750,s.score), target:750 },

    { id:'g_good20',   level:'easy',   label:'เก็บของดีให้ได้ 20 ชิ้น', check:s=>s.goodCount>=20, prog:s=>Math.min(20,s.goodCount), target:20 },
    { id:'g_good30',   level:'normal', label:'เก็บของดีให้ได้ 30 ชิ้น', check:s=>s.goodCount>=30, prog:s=>Math.min(30,s.goodCount), target:30 },

    { id:'g_combo12',  level:'normal', label:'คอมโบสูงสุด ≥ 12', check:s=>s.comboMax>=12, prog:s=>Math.min(12,s.comboMax), target:12 },
    { id:'g_combo20',  level:'hard',   label:'คอมโบสูงสุด ≥ 20', check:s=>s.comboMax>=20, prog:s=>Math.min(20,s.comboMax), target:20 },

    { id:'g_nomiss10', level:'normal', label:'ไม่พลาดต่อเนื่อง 10 วินาที', check:s=>s.noMissTime>=10, prog:s=>Math.min(10,s.noMissTime), target:10 },
    { id:'g_avoid7',   level:'easy',   label:'หลีกเลี่ยงขยะ 7 ครั้ง', check:s=>s.junkMiss>=7, prog:s=>Math.min(7,s.junkMiss), target:7 },

    { id:'g_fever2',   level:'normal', label:'เข้า Fever อย่างน้อย 2 ครั้ง', check:s=>s.feverCount>=2, prog:s=>Math.min(2,s.feverCount), target:2 },
  ];

  function levelOK(item){
    if (diff==='easy')   return item.level==='easy';
    if (diff==='normal') return item.level!=='hard';
    return true; // hard = ทั้งหมด
  }
  function sampleN(arr, n){
    const a = arr.slice(); for(let i=a.length-1;i>0;i--){ const j=(Math.random()*(i+1))|0; [a[i],a[j]]=[a[j],a[i]]; }
    return a.slice(0, n);
  }
  let currentGoals = sampleN(goalPool10.filter(levelOK), 5).map(g=>({...g, done:false, prog:0}));
  let goalsClearedSets = 0; // กี่ชุดที่ผ่านครบแล้ว (ถ้าเวลาเหลือ จะสุ่มชุดใหม่มาอีก)

  function updateGoals(){
    const s = snap();
    let allDone = true;
    currentGoals.forEach(g=>{
      g.prog = typeof g.prog==='function' ? g.prog(s) : (g.progFn ? g.progFn(s) : (g.prog||0));
      const p = (typeof g.prog==='number') ? g.prog : (g.prog||0);
      const t = (typeof g.target==='number') ? g.target : 1;
      g.done  = !!g.check(s);
      allDone = allDone && g.done;
    });
    if (allDone){
      goalsClearedSets++;
      // สุ่มชุดใหม่ 5 ใบ หากเวลาเหลือ
      currentGoals = sampleN(goalPool10.filter(levelOK), 5).map(g=>({...g, done:false, prog:0}));
    }
  }
  function goalsSummary(){
    const s = snap();
    return currentGoals.map(g=>({
      id:g.id, label:g.label, level:g.level,
      done:!!g.check(s),
      prog: (typeof g.prog==='number') ? g.prog : (g.prog||0),
      target: (typeof g.target==='number') ? g.target : 1
    }));
  }
  function goalsClearedCount(){
    // นับภายในชุดปัจจุบัน
    const s = snap();
    const cur = currentGoals.reduce((acc,g)=> acc + (g.check(s)?1:0), 0);
    return goalsClearedSets*5 + cur;
  }

  // ----- Mini Quest: ใช้ MissionDeck (สุ่ม 3 จาก 10; เติมใหม่เมื่อครบ) -----
  const miniPool10 = [
    { id:'m_star2',   level:'hard',   label:'เก็บ ⭐ 2 ดวง',        check:s=>s.star>=2,          prog:s=>Math.min(2,s.star),          target:2 },
    { id:'m_dia1',    level:'hard',   label:'เก็บ 💎 1 เม็ด',       check:s=>s.diamond>=1,       prog:s=>Math.min(1,s.diamond),       target:1 },
    { id:'m_combo10', level:'easy',   label:'ทำคอมโบ 10',          check:s=>s.comboMax>=10,     prog:s=>Math.min(10,s.comboMax),     target:10 },
    { id:'m_combo15', level:'normal', label:'ทำคอมโบ 15',          check:s=>s.comboMax>=15,     prog:s=>Math.min(15,s.comboMax),     target:15 },
    { id:'m_score300',level:'easy',   label:'ทำคะแนน ≥ 300',        check:s=>s.score>=300,       prog:s=>Math.min(300,s.score),       target:300 },
    { id:'m_good15',  level:'easy',   label:'เก็บของดี 15',         check:s=>s.goodCount>=15,    prog:s=>Math.min(15,s.goodCount),    target:15 },
    { id:'m_nomiss8', level:'normal', label:'ไม่พลาด 8 วิ',         check:s=>s.noMissTime>=8,    prog:s=>Math.min(8,s.noMissTime),    target:8 },
    { id:'m_avoid5',  level:'easy',   label:'หลีกขยะ 5',            check:s=>s.junkMiss>=5,      prog:s=>Math.min(5,s.junkMiss),      target:5 },
    { id:'m_fever1',  level:'easy',   label:'เข้า Fever 1 ครั้ง',   check:s=>s.feverCount>=1,    prog:s=>Math.min(1,s.feverCount),    target:1 },
    { id:'m_fever2',  level:'normal', label:'เข้า Fever 2 ครั้ง',   check:s=>s.feverCount>=2,    prog:s=>Math.min(2,s.feverCount),    target:2 },
  ];
  const deck = new MissionDeck({ pool: miniPool10 });
  deck.draw3();

  // HUD init
  questHUDInit();

  function pushQuestHUD(hint){
    // โฟกัสทีละ Goal: เอา goal ตัวแรกที่ยังไม่ done
    const s = snap();
    const focusGoal = currentGoals.find(g=>!g.check(s)) || currentGoals[0] || null;
    const gProg = goalsSummary();
    const gCleared = gProg.filter(x=>x.done).length + goalsClearedSets*5;
    const gTotal   = goalsClearedSets*5 + 5;

    const goalObj = focusGoal ? {
      label : focusGoal.label,
      prog  : (typeof focusGoal.prog==='number' ? focusGoal.prog : (focusGoal.prog||0)),
      target: (typeof focusGoal.target==='number' ? focusGoal.target : 1),
      meta  : { cleared:gCleared, total:gTotal } // ให้ HUD ใช้แสดง “Goal X/Y”
    } : null;

    // โฟกัสทีละ Mini quest: ใช้ current ของ MissionDeck
    const cur = deck.getCurrent && deck.getCurrent();
    let mini = null;
    if (cur){
      const progList = deck.getProgress && deck.getProgress() || [];
      const now = progList.find(x=>x.id===cur.id) || {};
      mini = {
        label: cur.label,
        prog : Number.isFinite(now.prog)? now.prog : 0,
        target: Number.isFinite(now.target)? now.target : (now.done?1:0)
      };
    }

    try{
      window.dispatchEvent(new CustomEvent('hha:quest', { detail: { goal:goalObj, mini } }));
    }catch{}
    questHUDUpdate(deck, hint || `Wave ${wave}`);
  }

  // ----- Judge / Click -----
  function burst(theme, cx, cy){
    try{ Particles.burstShards(null, null, { screen:{x:cx,y:cy}, theme }); }catch{}
  }
  function scorePop(delta, good, cx, cy){
    try{
      const txt = delta>0? `+${delta}` : `${delta}`;
      if (Particles.scorePop) Particles.scorePop({ x:cx, y:cy, text:txt, good:!!good });
    }catch{}
  }

  function judge(ch, ctx){
    ctx = ctx || {};
    const cx = ctx.clientX ?? ctx.cx ?? 0;
    const cy = ctx.clientY ?? ctx.cy ?? 0;

    // Power-ups
    if (ch===STAR){ const d=40*mult(); score+=d; star++; gainFever(10);
      deck.updateScore && deck.updateScore(score);
      burst('goodjunk', cx, cy); scorePop(d, true, cx, cy); updateGoals(); pushQuestHUD(); return {good:true, scoreDelta:d}; }
    if (ch===DIA){  const d=80*mult(); score+=d; diamond++; gainFever(30);
      deck.updateScore && deck.updateScore(score);
      burst('groups',   cx, cy); scorePop(d, true, cx, cy); updateGoals(); pushQuestHUD(); return {good:true, scoreDelta:d}; }
    if (ch===SHIELD){ shield=Math.min(3,shield+1); try{ setShield(shield); addShield?.(1);}catch{}; score+=20;
      deck.updateScore && deck.updateScore(score);
      burst('hydration',cx, cy); scorePop(20, true, cx, cy); updateGoals(); pushQuestHUD(); return {good:true, scoreDelta:20}; }
    if (ch===FIRE){ feverActive=true; try{ setFeverActive(true);}catch{}; fever=Math.max(fever,60); try{ setFever(fever);}catch{}; score+=25;
      deck.updateScore && deck.updateScore(score);
      burst('plate',    cx, cy); scorePop(25, true, cx, cy); updateGoals(); pushQuestHUD(); return {good:true, scoreDelta:25}; }

    const isGood = GOOD.includes(ch);
    if (isGood){
      goodCount++;
      const base  = 20 + combo*2;
      const delta = base * mult();
      score += delta; combo += 1; comboMax = Math.max(comboMax, combo);
      gainFever(8 + combo*0.6);
      deck.onGood && deck.onGood();
      deck.updateCombo && deck.updateCombo(combo);
      deck.updateScore && deck.updateScore(score);
      noMissTime += 1; // คลิกสำเร็จต่อเนื่อง (ประมาณเชิงนับ)
      burst('goodjunk', cx, cy); scorePop(delta, true, cx, cy);
      updateGoals(); pushQuestHUD();
      return { good:true, scoreDelta:delta };
    } else {
      // junk
      if (shield>0){
        shield = Math.max(0, shield-1);
        try{ setShield(shield); }catch{}
        burst('hydration', cx, cy); scorePop(0, false, cx, cy);
        updateGoals(); pushQuestHUD();
        return { good:false, scoreDelta:0 };
      }
      const dneg = -15;
      score = Math.max(0, score + dneg); combo = 0; noMissTime = 0;
      decayFever(18);
      deck.onJunk && deck.onJunk();
      deck.updateCombo && deck.updateCombo(combo);
      deck.updateScore && deck.updateScore(score);
      burst('plate', cx, cy); scorePop(dneg, false, cx, cy);
      updateGoals(); pushQuestHUD();
      return { good:false, scoreDelta:dneg };
    }
  }

  // ----- Expire / Time / Wave refill for mini quests -----
  let wave = 1, miniClearedTotal = 0;

  function onExpire(ev){
    if (!ev) return;
    if (ev.isGood){
      // พลาดของดี
      noMissTime = 0; decayFever(6);
    }else{
      // หลีกขยะสำเร็จ
      junkMiss += 1; gainFever(4);
    }
    updateGoals(); pushQuestHUD(`Wave ${wave}`);
  }

  function refillMiniIfCleared(){
    if (deck.isCleared && deck.isCleared()){
      miniClearedTotal += 3;
      deck.draw3 && deck.draw3();
      wave += 1;
      pushQuestHUD(`Wave ${wave}`);
    }
  }

  function onHitScreen(){
    refillMiniIfCleared();
  }

  function onSec(){
    // เวลาผ่าน 1 วิ: ลด/คง fever + เพิ่ม noMissTime เล็กน้อยเมื่อไม่ได้พลาดล่าสุด
    if (combo<=0) decayFever(6); else decayFever(2);
    // ความต่อเนื่อง (ถ้าไม่เพิ่งพลาด junk)
    // (ไม่แก้ noMissTime ตรงนี้แล้ว เพราะอัปเดตใน judge)
    deck.second && deck.second();
    deck.updateScore && deck.updateScore(score);
    updateGoals(); pushQuestHUD(`Wave ${wave}`);
  }

  window.addEventListener('hha:hit-screen', onHitScreen);
  window.addEventListener('hha:expired',    onExpire);
  window.addEventListener('hha:time',       onSec);

  // ----- End & result -----
  function onEnd(){
    try{
      window.removeEventListener('hha:hit-screen', onHitScreen);
      window.removeEventListener('hha:expired',    onExpire);
      window.removeEventListener('hha:time',       onSec);
    }catch{}
    const s = snap();
    const goalsNow   = goalsSummary();
    const gCleared   = goalsClearedCount();
    const gTotal     = goalsClearedSets*5 + 5; // ชุดที่ผ่านไปแล้ว + ชุดปัจจุบัน
    const miniProg   = deck.getProgress ? deck.getProgress() : [];
    const miniDone   = miniProg.filter(q=>q && q.done).length + miniClearedTotal;
    const miniTotal  = (wave-1)*3 + (miniProg.filter(Boolean).length||3);

    try{
      questHUDDispose();
    }catch{}

    // ส่งผลสรุปกลับให้ main.js ทำ overlay
    try{
      window.dispatchEvent(new CustomEvent('hha:end', { detail: {
        mode: 'goodjunk',
        difficulty: diff,
        score,
        comboMax,
        misses: (deck.stats && deck.stats.junkMiss) || 0,
        hits  : (deck.stats && deck.stats.goodCount) || goodCount,
        duration: dur,
        // Goal summary
        goalCleared: (gCleared % 5) === 0, // ชุดปัจจุบันสำเร็จครบ 5
        goalsCleared: gCleared,
        goalsTotal  : gTotal,
        // Mini quests
        questsCleared: miniDone,
        questsTotal  : miniTotal
      }}));
    }catch{}
  }

  // ----- Start factory -----
  return factoryBoot({
    difficulty: diff,
    duration  : dur,
    pools     : { good: GOOD.concat(BONUS), bad: JUNK.slice() },
    goodRate  : 0.65,
    powerups  : BONUS,
    powerRate : 0.08,
    powerEvery: 7,
    judge     : (ch, ctx)=>judge(ch, { cx:(ctx.clientX||ctx.cx), cy:(ctx.clientY||ctx.cy) }),
    onExpire
  }).then(ctrl=>{
    // จบเมื่อเวลาหมด
    window.addEventListener('hha:time', (e)=>{
      const sec = (e?.detail?.sec|0);
      if (sec<=0) onEnd();
    });
    // เริ่ม HUD รอบแรก
    updateGoals();
    pushQuestHUD(`Wave ${wave}`);
    return ctrl;
  });
}

export default { boot };
