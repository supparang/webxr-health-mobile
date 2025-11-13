// === /HeroHealth/modes/groups.safe.js (2025-11-13 AUTO DIFF + CENTER) ===
// Food Groups mode: โฟกัสหมู่อาหารตามที่กำหนด, ปรับจำนวนหมู่ที่ต้องโฟกัสอัตโนมัติ

import { boot as factoryBoot } from '../vr/mode-factory.js';
import { MissionDeck } from '../vr/mission.js';
import { ensureFeverBar, setFever, setFeverActive } from '../vr/ui-fever.js';
import { Particles } from '../vr/particles.js';

export async function boot(cfg = {}) {
  const diff = String(cfg.difficulty || 'normal');
  const dur  = Number(cfg.duration || 60);

  // ---------- GROUP DEFINITIONS ----------
  // G1: ข้าว/แป้ง, G2: ผัก, G3: ผลไม้, G4: โปรตีน, G5: นม/อื่น ๆ
  const G1 = ['🍚','🍞','🥐','🥖','🥨','🥯','🥞','🧇','🍙'];
  const G2 = ['🥦','🥕','🥬','🧅','🧄','🌽','🍆'];
  const G3 = ['🍎','🍌','🍊','🍓','🍇','🍉','🍍','🍑','🍐','🥝'];
  const G4 = ['🥚','🍗','🍖','🥩','🥓','🍤','🍣','🐟'];
  const G5 = ['🥛','🧀','🍦','🍮','🍧'];

  const ALL = [...G1,...G2,...G3,...G4,...G5];
  const CHAR_GROUP = new Map();
  G1.forEach(c=>CHAR_GROUP.set(c,1));
  G2.forEach(c=>CHAR_GROUP.set(c,2));
  G3.forEach(c=>CHAR_GROUP.set(c,3));
  G4.forEach(c=>CHAR_GROUP.set(c,4));
  G5.forEach(c=>CHAR_GROUP.set(c,5));

  // HUD
  ensureFeverBar();
  setFever(0);

  // ---------- Mission system ----------
  const deck = new MissionDeck({
    goalPool: [
      { id:'g_target20', label:'เลือกหมู่เป้าหมายให้ถูก 20 ครั้ง', level:'easy',
        target:20, check:s=>s.goodTarget>=20, prog:s=>Math.min(20,s.goodTarget|0) },
      { id:'g_target32', label:'เลือกหมู่เป้าหมายให้ถูก 32 ครั้ง', level:'normal',
        target:32, check:s=>s.goodTarget>=32, prog:s=>Math.min(32,s.goodTarget|0) },
      { id:'g_target40', label:'เลือกหมู่เป้าหมายให้ถูก 40 ครั้ง', level:'hard',
        target:40, check:s=>s.goodTarget>=40, prog:s=>Math.min(40,s.goodTarget|0) },
      { id:'g_score1200', label:'ทำคะแนนรวม 1200+', level:'normal',
        target:1200, check:s=>s.score>=1200, prog:s=>Math.min(1200,s.score|0) },
      { id:'g_miss6', label:'พลาดไม่เกิน 6 ครั้ง', level:'normal',
        target:6, check:s=>s.miss<=6, prog:s=>Math.min(6, 6-(s.miss|0) >=0 ? 6-(s.miss|0) : 0) }
    ],
    miniPool: [
      { id:'m_combo8', label:'คอมโบต่อเนื่อง 8', level:'easy',
        target:8, check:s=>s.comboMax>=8, prog:s=>Math.min(8,s.comboMax|0) },
      { id:'m_combo14', label:'คอมโบต่อเนื่อง 14', level:'hard',
        target:14, check:s=>s.comboMax>=14, prog:s=>Math.min(14,s.comboMax|0) },
      { id:'m_target12', label:'เลือกหมู่เป้าหมายถูก 12 ครั้ง', level:'normal',
        target:12, check:s=>s.goodTarget>=12, prog:s=>Math.min(12,s.goodTarget|0) },
      { id:'m_miss4', label:'พลาดไม่เกิน 4 ครั้ง', level:'normal',
        target:4, check:s=>s.miss<=4, prog:s=>Math.min(4, 4-(s.miss|0) >=0 ? 4-(s.miss|0) : 0) }
    ]
  });

  // stats เสริม
  deck.stats.goodTarget = 0;
  deck.stats.miss       = 0;

  deck.drawGoals(3);
  deck.draw3();

  function emitQuest(hint){
    const goals = deck.getProgress('goals');
    const minis = deck.getProgress('mini');
    const focusGoal = goals.find(g=>!g.done) || goals[0] || null;
    const focusMini = minis.find(m=>!m.done) || minis[0] || null;
    window.dispatchEvent(new CustomEvent('quest:update',{
      detail:{goal:focusGoal, mini:focusMini, goalsAll:goals, minisAll:minis, hint}
    }));
  }

  function emitCoach(msg, tone='info'){
    try{
      window.dispatchEvent(new CustomEvent('hha:coach',{detail:{msg,tone,mode:'groups'}}));
    }catch(_){}
  }

  function emitToast(msg){
    try{
      window.dispatchEvent(new CustomEvent('hha:toast',{detail:{msg,mode:'groups'}}));
    }catch(_){}
  }

  function emitCombo(combo, comboMax){
    try{
      window.dispatchEvent(new CustomEvent('hha:combo',{detail:{combo,comboMax}}));
    }catch(_){}
  }

  // ---------- Difficulty tiers ----------
  let tier = (diff==='hard'?3 : diff==='normal'?2 : 1); // จำนวนหมู่ที่ต้องโฟกัส
  const maxTier = 3;
  let activeGroups = new Set([1]);      // จะถูก overwrite ด้านล่าง
  let levelUpAnnounced = false;

  function randomPick(arr, n){
    const src=[...arr], out=[];
    for(let i=0;i<n && src.length;i++){
      const k=(Math.random()*src.length)|0;
      out.push(src.splice(k,1)[0]);
    }
    return out;
  }

  function rebuildTargets(){
    const base=[1,2,3,4,5];
    const list = randomPick(base, tier);
    activeGroups = new Set(list);
    const txt = `โฟกัสหมู่: ${[...list].sort().join(', ')}`;
    emitCoach(txt,'info');
    emitQuest('โฟกัสหมู่ '+[...list].sort().join(','));
  }

  rebuildTargets();

  // ---------- Runtime ----------
  let score=0, combo=0;
  let fever=0, feverActive=false;

  function mult(){ return feverActive ? 2 : 1; }

  function gainFever(n){
    fever = Math.max(0, Math.min(100, fever + n));
    setFever(fever);
    if (!feverActive && fever>=100){
      feverActive=true; setFeverActive(true);
      emitCoach('เข้าสู่โหมด Fever แล้ว! เก็บต่อเนื่องให้ได้มากที่สุด','good');
    }
  }
  function decayFever(base){
    const d = feverActive ? 10 : base;
    fever = Math.max(0, fever - d);
    setFever(fever);
    if (feverActive && fever<=0){
      feverActive=false; setFeverActive(false);
    }
  }

  function syncStats(){
    deck.updateScore(score);
    deck.updateCombo(combo);
    emitCombo(combo, deck.stats.comboMax);
  }

  // ---------- Auto difficulty (tier 1–3) ----------
  function autoDifficulty(){
    const g = deck.stats.goodTarget|0;
    const m = deck.stats.miss|0;

    let newTier = tier;
    if (g >= 30 && m <= 6) newTier = 3;
    else if (g >= 16 && m <= 8) newTier = 2;
    else newTier = 1;

    newTier = Math.max(1, Math.min(maxTier, newTier));
    if (newTier !== tier){
      tier = newTier;
      rebuildTargets();
      emitToast(`โฟกัสเพิ่มเป็น ${tier} หมู่!`);
    }
  }

  // ---------- JUDGE ----------
  function judge(ch, ctx){
    const x = (ctx.cx ?? ctx.clientX ?? ctx.hitX ?? 0);
    const y = (ctx.cy ?? ctx.clientY ?? ctx.hitY ?? 0);

    const g = CHAR_GROUP.get(ch) || 0;
    const isTarget = activeGroups.has(g);

    let delta = 0;
    let good = false;

    if (isTarget){
      const base = 18 + combo*2;
      delta = base * mult();
      score += delta;
      combo += 1;
      deck.stats.goodTarget += 1;

      gainFever(6 + combo*0.4);
      syncStats();
      Particles.burstShards?.(null,null,{screen:{x,y},theme:'groups'});
      Particles.scorePop?.(x,y,delta,true);
      emitQuest();

      if (combo===4) emitCoach('ดีมาก! เลือกหมู่ถูกต่อเนื่อง','good');
      if (combo===10 && !levelUpAnnounced){
        emitCoach('คอมโบยาวมาก ๆ ระบบจะลองเพิ่มจำนวนหมู่เป้าหมายแล้ว','good');
        levelUpAnnounced = true;
      }
      good = true;
    } else {
      delta = -14;
      score = Math.max(0, score + delta);
      combo = 0;
      deck.stats.miss += 1;
      decayFever(16);
      syncStats();
      Particles.burstShards?.(null,null,{screen:{x,y},theme:'bad'});
      Particles.scorePop?.(x,y,delta,false);
      emitQuest();
      emitCoach('อันนี้ไม่ใช่หมู่ที่กำหนด ลองดูสี/สัญลักษณ์ให้ชัด ๆ','warn');
      good = false;
    }

    autoDifficulty();
    return { good, scoreDelta:delta };
  }

  function onExpire(ev){
    // ถ้าเป็นเป้าแล้วปล่อยหลุด นับเป็น miss เล็ก ๆ
    if (!ev) return;
    const isTarget = ev.isGood === true; // จาก factory: isGood=true ถ้าอยู่ในฝั่ง good-pool
    if (isTarget){
      deck.stats.miss += 1;
      combo = 0;
      decayFever(8);
      syncStats();
      emitQuest();
      autoDifficulty();
    }
  }

  function onSec(){
    if (combo<=0) decayFever(6); else decayFever(2);
    deck.second();
    syncStats();
    emitQuest();

    if (deck.isCleared('mini'))  { deck.draw3(); emitQuest('Mini ใหม่'); }
    if (deck.isCleared('goals')) { deck.drawGoals(3); emitQuest('Goal ใหม่'); }
  }

  window.addEventListener('hha:expired', onExpire);
  window.addEventListener('hha:time', (e)=>{
    const sec = (e.detail?.sec|0);
    if (sec>=0) onSec();
  });

  // ---------- Start factory ----------
  const ctrl = await factoryBoot({
    difficulty: diff,
    duration  : dur,
    pools     : { good:ALL, bad:[] },   // ทั้งหมดเป็นของ “อาหาร” เลือกถูก/ผิดจาก group
    goodRate  : 1.0,
    judge,
    onExpire
  });

  // จบเกม
  window.addEventListener('hha:time', (e)=>{
    const sec = (e.detail?.sec|0);
    if (sec===0){
      const goals = deck.getProgress('goals');
      const minis = deck.getProgress('mini');
      const goalCleared = goals.length>0 && goals.every(g=>g.done);
      const miniDone = minis.filter(m=>m.done).length;
      window.dispatchEvent(new CustomEvent('hha:end',{detail:{
        mode:'groups',
        difficulty:diff,
        score,
        comboMax:deck.stats.comboMax,
        misses:deck.stats.miss,
        hits:deck.stats.goodTarget,
        duration:dur,
        goalCleared,
        questsCleared:miniDone,
        questsTotal:minis.length || 0
      }}));
    }
  });

  emitQuest('เริ่ม');
  emitCoach('แตะเฉพาะหมู่อาหารตามที่กำหนดด้านบน HUD ถ้าทำได้ดี ระบบจะเพิ่มจำนวนหมู่ให้ท้าทายขึ้น','info');
  emitCombo(0, deck.stats.comboMax);

  return ctrl;
}

export default { boot };