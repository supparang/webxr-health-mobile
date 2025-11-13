// === /HeroHealth/modes/goodjunk.safe.js (2025-11-13 FULL) ===
// โหมด Good vs Junk + Goal 5/สุ่มจาก 10 + Mini 3/สุ่มจาก 10
// - Dynamic fever + combo
// - เอฟเฟกต์คะแนนเด้งตรงกลางเป้า (ใช้ host จาก mode-factory)
// - โค้ชใต้ Fever bar

import { boot as factoryBoot } from '../vr/mode-factory.js';
import { MissionDeck } from '../vr/mission.js';
import { ensureFeverBar, setFever, setFeverActive, setShield } from '../vr/ui-fever.js';
import { Particles } from '../vr/particles.js';

const fire = (name, detail) => { try{ window.dispatchEvent(new CustomEvent(name,{detail})); }catch(_){} };

// ใช้ center ของเป้าเป็นหลัก ถ้ามี host/node
function screenPoint(ctx){
  if (ctx && (ctx.host || ctx.node)){
    const el = ctx.host || ctx.node;
    try{
      const r = el.getBoundingClientRect();
      const x = r.left + r.width  / 2;
      const y = r.top  + r.height / 2;
      return { x, y };
    }catch(_){}
  }
  let x = ctx && (ctx.clientX ?? ctx.pageX ?? ctx.x);
  let y = ctx && (ctx.clientY ?? ctx.pageY ?? ctx.y);
  if (!x && !y){
    x = window.innerWidth  / 2;
    y = window.innerHeight / 2;
  }
  return { x, y };
}

// เอฟเฟกต์แตกกระจาย + คะแนนเด้ง
function fxHit(x,y, delta, good, theme){
  try{
    if (Particles && typeof Particles.burstShards === 'function'){
      Particles.burstShards(null, null, {
        screen: { x, y },
        theme: theme || (good ? 'goodjunk' : 'groups')
      });
    }
  }catch(_){}
  try{
    if (Particles && typeof Particles.scorePop === 'function'){
      Particles.scorePop(x, y, delta, { good: !!good });
    }
  }catch(_){}
}

// โค้ชใต้ Fever bar
function ensureCoach(){
  let wrap = document.getElementById('hhaCoachWrap');
  if (wrap) return wrap;
  const dock = document.getElementById('feverBarDock') || document.querySelector('.score-box');
  wrap = document.createElement('div');
  wrap.id = 'hhaCoachWrap';
  wrap.style.marginTop = '6px';
  wrap.style.font = '800 11px system-ui';
  wrap.style.color = '#a5b4fc';
  wrap.style.minHeight = '16px';
  wrap.innerHTML = '<span id="hhaCoachTxt">พร้อมเริ่ม!</span>';
  if (dock && dock.parentNode){
    dock.parentNode.insertBefore(wrap, dock.nextSibling);
  }else{
    document.body.appendChild(wrap);
  }
  return wrap;
}
function coachSay(msg){
  const wrap = ensureCoach();
  const el = wrap.querySelector('#hhaCoachTxt');
  if (el && msg) el.textContent = msg;
}

export async function boot(cfg = {}) {
  const diff = String(cfg.difficulty || 'normal');
  const dur  = Number(cfg.duration || 60);

  // อาหารดี/เสีย + โบนัส
  const GOOD = ['🥦','🥕','🍎','🍌','🥗','🐟','🥜','🍚','🍞','🥛','🍇','🍓','🍊','🍅','🥬','🥝','🍍','🍐','🍑'];
  const JUNK = ['🍔','🍟','🌭','🍕','🍩','🍪','🍰','🧋','🥤','🍫','🍬','🥓'];
  const STAR   = '⭐';
  const DIA    = '💎';
  const SHIELD = '🛡️';
  const FIRE   = '🔥';
  const BONUS  = [STAR, DIA, SHIELD, FIRE];

  // Fever bar เริ่มต้น
  ensureFeverBar();
  setFever(0);
  setFeverActive(false);
  setShield(0);
  coachSay('โฟกัสของดี เลี่ยงของเสียให้ได้มากที่สุด!');

  // ---------- GOAL / MINI QUEST ----------
  const G = {
    good: s=>s.goodCount|0,
    junk: s=>s.junkMiss|0,
    score: s=>s.score|0,
    comboMax: s=>s.comboMax|0,
    tick: s=>s.tick|0
  };

  const GOAL_POOL = [
    { id:'g_good20',   label:'เก็บของดีให้ได้ 20 ชิ้น',       level:'easy',   target:20,  check:s=>G.good(s)>=20,           prog:s=>Math.min(20,G.good(s)) },
    { id:'g_good28',   label:'เก็บของดีให้ได้ 28 ชิ้น',       level:'normal', target:28,  check:s=>G.good(s)>=28,           prog:s=>Math.min(28,G.good(s)) },
    { id:'g_good34',   label:'เก็บของดีให้ได้ 34 ชิ้น',       level:'hard',   target:34,  check:s=>G.good(s)>=34,           prog:s=>Math.min(34,G.good(s)) },
    { id:'g_score800', label:'ทำคะแนนรวม 800+',               level:'easy',   target:800, check:s=>G.score(s)>=800,         prog:s=>Math.min(800,G.score(s)) },
    { id:'g_score1500',label:'ทำคะแนนรวม 1500+',              level:'normal', target:1500,check:s=>G.score(s)>=1500,        prog:s=>Math.min(1500,G.score(s)) },
    { id:'g_score2200',label:'ทำคะแนนรวม 2200+',              level:'hard',   target:2200,check:s=>G.score(s)>=2200,        prog:s=>Math.min(2200,G.score(s)) },
    { id:'g_combo16',  label:'คอมโบสูงสุด ≥ 16',              level:'normal', target:16,  check:s=>G.comboMax(s)>=16,       prog:s=>Math.min(16,G.comboMax(s)) },
    { id:'g_combo24',  label:'คอมโบสูงสุด ≥ 24',              level:'hard',   target:24,  check:s=>G.comboMax(s)>=24,       prog:s=>Math.min(24,G.comboMax(s)) },
    { id:'g_time30',   label:'อยู่รอดเกิน 30 วินาที',         level:'easy',   target:30,  check:s=>G.tick(s)>=30,           prog:s=>Math.min(30,G.tick(s)) },
    // เน้น "พลาดไม่เกิน 6 ครั้ง" นับจากการเลือกผิด/พลาดของดี
    { id:'g_nojunk6',  label:'พลาด (เลือกผิด/พลาดของดี) ≤ 6', level:'normal', target:6,   check:s=>G.junk(s)<=6,            prog:s=>Math.max(0,6-G.junk(s)) }
  ];

  const MINI_POOL = [
    { id:'m_combo12',  label:'คอมโบต่อเนื่อง 12',           level:'normal', target:12,  check:s=>G.comboMax(s)>=12, prog:s=>Math.min(12,G.comboMax(s)) },
    { id:'m_combo18',  label:'คอมโบต่อเนื่อง 18',           level:'hard',   target:18,  check:s=>G.comboMax(s)>=18, prog:s=>Math.min(18,G.comboMax(s)) },
    { id:'m_score600', label:'ทำคะแนนรวม 600+',             level:'easy',   target:600, check:s=>G.score(s)>=600,   prog:s=>Math.min(600,G.score(s)) },
    { id:'m_score1200',label:'ทำคะแนนรวม 1200+',            level:'normal', target:1200,check:s=>G.score(s)>=1200,  prog:s=>Math.min(1200,G.score(s)) },
    { id:'m_good10',   label:'เก็บของดี 10 ชิ้น',            level:'easy',   target:10,  check:s=>G.good(s)>=10,     prog:s=>Math.min(10,G.good(s)) },
    { id:'m_good18',   label:'เก็บของดี 18 ชิ้น',            level:'normal', target:18,  check:s=>G.good(s)>=18,     prog:s=>Math.min(18,G.good(s)) },
    { id:'m_nomiss12', label:'ไม่พลาดติดกัน 12 วินาที',       level:'normal', target:12,  check:s=>G.tick(s)>=12 && s.combo>0, prog:s=>Math.min(12,G.tick(s)) },
    { id:'m_star2',    label:'เก็บ ⭐ 2 ดวง',                 level:'hard',   target:2,   check:s=>(s.star||0)>=2,     prog:s=>Math.min(2,s.star||0) },
    { id:'m_dia1',     label:'เก็บ 💎 1 เม็ด',                level:'hard',   target:1,   check:s=>(s.diamond||0)>=1,  prog:s=>Math.min(1,s.diamond||0) },
    // mini "พลาดไม่เกิน 6 ครั้ง" ใช้อีกที (นับจาก junkMiss เช่นกัน)
    { id:'m_under6',   label:'พลาดไม่เกิน 6 ครั้ง',           level:'normal', target:6,   check:s=>G.junk(s)<=6,     prog:s=>Math.max(0,6-G.junk(s)) }
  ];

  const deck = new MissionDeck({ goalPool: GOAL_POOL, miniPool: MINI_POOL });
  deck.drawGoals(5);
  deck.draw3();

  function pushQuest(hint){
    const goals = deck.getProgress('goals');
    const minis = deck.getProgress('mini');
    const focusGoal = goals.find(g=>!g.done) || goals[0] || null;
    const focusMini = minis.find(m=>!m.done) || minis[0] || null;

    fire('hha:quest', {
      goal: focusGoal,
      mini: focusMini,
      goalsAll: goals,
      minisAll: minis,
      hint
    });
  }

  // ---------- สถานะเกม ----------
  let score = 0;
  let combo = 0;
  let comboMax = 0;
  let shield = 0;
  let fever = 0;
  let feverActive = false;
  let star = 0;
  let diamond = 0;

  function emitCombo(){
    fire('hha:combo', { combo, comboMax });
  }

  function updateFeverVisual(){
    setFever(fever);
    setFeverActive(!!feverActive);
  }
  function gainFever(n){
    fever = Math.max(0, Math.min(100, fever + n));
    if (fever >= 100 && !feverActive){
      feverActive = true;
      coachSay('โหมด Fever! คะแนน x2 ลุยเลย!');
    }
    updateFeverVisual();
  }
  function decayFever(base){
    const d = feverActive ? 10 : base;
    fever = Math.max(0, fever - d);
    if (fever <= 0 && feverActive){
      feverActive = false;
      coachSay('Fever หมดแล้ว ลองต่อคอมโบใหม่!');
    }
    updateFeverVisual();
  }
  const mult = () => feverActive ? 2 : 1;

  function syncDeck(){
    deck.updateScore(score);
    deck.updateCombo(combo);
    deck.stats.star    = star;
    deck.stats.diamond = diamond;
  }

  // ---------- Judge คลิก ----------
  function judge(ch, rawCtx){
    const ctx = { ...rawCtx };
    const { x, y } = screenPoint(ctx);

    // โบนัสพิเศษ
    if (ch === STAR){
      const delta = 40 * mult();
      score += delta;
      gainFever(10);
      star++;
      deck.onGood(); syncDeck();
      fxHit(x,y,delta,true,'goodjunk');
      pushQuest('เก็บดาวเพิ่มแล้ว!');
      coachSay('ดีมาก! ⭐ ช่วยดันคะแนนขึ้นไวมาก');
      return { good:true, scoreDelta:delta };
    }
    if (ch === DIA){
      const delta = 80 * mult();
      score += delta;
      gainFever(30);
      diamond++;
      deck.onGood(); syncDeck();
      fxHit(x,y,delta,true,'groups');
      pushQuest('เก็บเพชรสำเร็จ!');
      coachSay('สุดยอด! 💎 โบนัสใหญ่เข้าแล้ว');
      return { good:true, scoreDelta:delta };
    }
    if (ch === SHIELD){
      shield = Math.min(3, shield + 1);
      setShield(shield);
      const delta = 20;
      score += delta;
      deck.onGood(); syncDeck();
      fxHit(x,y,delta,true,'hydration');
      pushQuest('เกราะเพิ่ม 1 ชั้น');
      coachSay('ได้เกราะเพิ่ม! พลาดหนึ่งครั้งยังรอดได้');
      return { good:true, scoreDelta:delta };
    }
    if (ch === FIRE){
      feverActive = true;
      fever = Math.max(fever, 60);
      updateFeverVisual();
      const delta = 25;
      score += delta;
      deck.onGood(); syncDeck();
      fxHit(x,y,delta,true,'plate');
      pushQuest('จุดไฟ Fever แล้ว!');
      coachSay('ไฟลุก! 🔥 รีบเก็บของดีให้ได้เยอะที่สุด');
      return { good:true, scoreDelta:delta };
    }

    const isGood = GOOD.includes(ch);

    if (isGood){
      const base  = 16 + combo * 2;
      const delta = base * mult();
      score += delta;
      combo += 1;
      if (combo > comboMax) comboMax = combo;
      emitCombo();
      gainFever(7 + combo * 0.5);
      deck.onGood(); syncDeck();
      fxHit(x,y,delta,true,'goodjunk');
      if (combo === 5)  coachSay('คอมโบเริ่มมาแล้ว! ลองไปให้ถึง 10 ดูไหม');
      if (combo === 10) coachSay('คอมโบ 10! สุดยอด ไปต่อให้ถึง 15!');
      pushQuest();
      return { good:true, scoreDelta:delta };
    } else {
      // เลือกของเสีย
      if (shield > 0){
        shield -= 1;
        setShield(shield);
        fxHit(x,y,0,false,'goodjunk');
        coachSay('เกราะช่วยกันไว้ได้ 1 ครั้ง ระวังเลือกของดีให้มากขึ้นนะ');
        syncDeck(); pushQuest();
        return { good:false, scoreDelta:0 };
      }
      const delta = -12;
      score = Math.max(0, score + delta);
      combo = 0;
      emitCombo();
      decayFever(16);
      deck.onJunk(); // นับ "พลาด" เพิ่ม 1
      syncDeck();
      fxHit(x,y,delta,false,'groups');
      coachSay('พลาดไปหนึ่งครั้ง ลองโฟกัสที่อาหารสุขภาพให้มากขึ้น!');
      pushQuest();
      return { good:false, scoreDelta:delta };
    }
  }

  // ---------- หมดเวลาเป้า (ไม่ได้คลิก) ----------
  function onExpire(ev){
    if (!ev) return;
    // ถ้าปล่อย "ของดี" หายไป → นับเป็นพลาด
    if (ev.isGood){
      deck.onJunk();
      combo = 0;
      emitCombo();
      decayFever(8);
      coachSay('พลาดของดีไป ลองโฟกัสให้ทันก่อนหายจากจอ');
    }else{
      // เลี่ยงของเสียได้ → ให้ fever เบา ๆ แต่ไม่เพิ่ม junkMiss
      gainFever(4);
    }
    syncDeck();
    pushQuest();
  }

  // ---------- tick ต่อวินาที ----------
  function onSecondTick(sec){
    // ง่าย/ปกติ/ยาก ปรับความแรง decay นิดหน่อย
    const baseDecay = (diff === 'easy') ? 4 : (diff === 'hard' ? 7 : 6);
    if (combo <= 0) decayFever(baseDecay); else decayFever(baseDecay - 2);

    deck.second();
    syncDeck();
    pushQuest();

    // เติมเควสต์เมื่อเคลียร์หมด
    if (deck.isCleared('mini')){
      deck.draw3();
      pushQuest('Mini ใหม่!');
      coachSay('Mini quest ชุดใหม่มาแล้ว ลองทำให้ครบดูนะ');
    }
    if (deck.isCleared('goals')){
      deck.drawGoals(5);
      pushQuest('Goal ใหม่!');
      coachSay('ทำเป้าหมายชุดนี้ครบแล้ว เยี่ยมมาก! ชุดใหม่เริ่มต้นแล้ว');
    }
  }

  // ผูกกับ event เวลา
  const timeHandler = (e)=>{
    const sec = (e.detail?.sec|0);
    if (sec >= 0) onSecondTick(sec);
  };
  window.addEventListener('hha:time', timeHandler);

  // ---------- Start factory ----------
  const controller = await factoryBoot({
    difficulty: diff,
    duration  : dur,
    pools     : { good:[...GOOD, ...BONUS], bad:[...JUNK] },
    goodRate  : 0.62,
    powerups  : BONUS,
    powerRate : 0.10,
    powerEvery: 7,
    judge     : (ch, ctx)=>judge(ch, ctx),
    onExpire
  });

  // สรุปผลเมื่อหมดเวลา
  const endHandler = (e)=>{
    const sec = (e.detail?.sec|0);
    if (sec > 0) return;
    window.removeEventListener('hha:time', timeHandler);
    window.removeEventListener('hha:time', endHandler);

    const goals = deck.getProgress('goals');
    const minis = deck.getProgress('mini');
    const goalCleared = goals.length>0 && goals.every(g=>g.done);
    const miniCleared = minis.filter(m=>m.done).length;
    const miniTotal   = minis.length;

    fire('hha:end', {
      mode          : 'Good vs Junk',
      difficulty    : diff,
      score,
      comboMax      : deck.stats.comboMax,
      misses        : deck.stats.junkMiss,
      hits          : deck.stats.goodCount,
      duration      : dur,
      goalCleared,
      questsCleared : miniCleared,
      questsTotal   : miniTotal
    });
  };
  window.addEventListener('hha:time', endHandler);

  // เริ่มต้น Quest HUD + โค้ช
  pushQuest('เริ่ม');
  coachSay('แตะเลือกอาหารสุขภาพ เลี่ยงของเสีย คอมโบสูง ๆ จะได้คะแนนพุ่ง!');

  return controller;
}

export default { boot };