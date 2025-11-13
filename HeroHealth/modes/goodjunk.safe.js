// === /HeroHealth/modes/goodjunk.safe.js (2025-11-13 QUEST+FX FIX) ===
// โหมด Good vs Junk (VR/DOM)
// - เอฟเฟกต์คะแนนเด้งตรงเป้า
// - Goal / Mini Quest หมุนชุดใหม่อัตโนมัติ
// - สรุปผล: ใช้จำนวนเควสต์ที่ "ถูกเสนอ" และ "ผ่าน" ทั้งเกม (สะสม)

import { boot as factoryBoot } from '../vr/mode-factory.js';
import { MissionDeck } from '../vr/mission.js';
import { ensureFeverBar, setFever, setFeverActive } from '../vr/ui-fever.js';
import { Particles } from '../vr/particles.js';

// ---------- Emoji pools ----------
const GOOD = [
  '🍎','🍓','🍇','🥦','🥕','🍅','🥬','🍊','🍌','🫐',
  '🍐','🍍','🍋','🍉','🥝','🍚','🥛','🍞','🐟','🥗'
];
const JUNK = [
  '🍔','🍟','🍕','🍩','🍪','🧁','🥤','🧋','🥓','🍫','🌭'
];

// ---------- Small helpers ----------
function screenPoint(ctx){
  let x = ctx && (ctx.clientX ?? ctx.pageX ?? ctx.x);
  let y = ctx && (ctx.clientY ?? ctx.pageY ?? ctx.y);

  if ((!x && !y) && ctx && (ctx.host || ctx.node)){
    const el = ctx.host || ctx.node;
    const r  = el && el.getBoundingClientRect ? el.getBoundingClientRect() : null;
    if (r){
      x = r.left + r.width / 2;
      y = r.top  + r.height / 2;
    }
  }
  if (!x && !y){
    x = window.innerWidth  / 2;
    y = window.innerHeight / 2;
  }
  return { x, y };
}

function scoreFX(x, y, delta, isGood){
  if (Particles && typeof Particles.scorePop === 'function'){
    try {
      Particles.scorePop(x, y, delta, { good:isGood, mode:'goodjunk' });
      return;
    } catch(_) {}
  }
  // fallback DOM
  const el = document.createElement('div');
  el.textContent = (delta > 0 ? '+' : '') + delta;
  Object.assign(el.style,{
    position:'fixed',
    left: x + 'px',
    top : y + 'px',
    transform:'translate(-50%,-50%)',
    font:'900 18px system-ui',
    color: isGood ? '#bbf7d0' : '#fecaca',
    textShadow:'0 2px 10px rgba(0,0,0,.7)',
    zIndex: 1100,
    pointerEvents:'none',
    opacity:'1',
    transition:'transform .45s ease, opacity .45s ease'
  });
  document.body.appendChild(el);
  requestAnimationFrame(()=>{
    el.style.transform = 'translate(-50%,-80%) scale(1.05)';
    el.style.opacity   = '0';
  });
  setTimeout(()=>{ try{el.remove();}catch(_){ } }, 520);
}

// ---------- Coach ----------
function coachSay(key){
  let text = '';
  switch(key){
    case 'start':
      text = 'เก็บของดีให้ต่อเนื่อง คอมโบจะยิ่งแรงขึ้นนะ!'; break;
    case 'streak':
      text = 'คอมโบยาวมากแล้ว รักษาจังหวะนี้ต่อไป!'; break;
    case 'miss':
      text = 'โดนของเสีย คอมโบหลุด ลองโฟกัสดูดี ๆ ก่อนคลิก'; break;
    case 'danger':
      text = 'เวลาใกล้หมดแล้ว เก็บของดีรัว ๆ ให้ทะลุเป้า!'; break;
  }
  if (!text) return;
  try {
    window.dispatchEvent(new CustomEvent('coach:line',{
      detail:{ text, mode:'goodjunk' }
    }));
  } catch(_) {}
}

// ---------- Main boot ----------
export async function boot(cfg = {}) {
  const diff = String(cfg.difficulty || 'normal');
  const dur  = Number(cfg.duration   || 60);

  ensureFeverBar();
  setFever(0);
  setFeverActive(false);

  // ---- Mission / Quest config ----
  const G = {
    score   : s => s.score     | 0,
    comboMax: s => s.comboMax  | 0,
    goodHit : s => s.goodCount | 0,
    miss    : s => s.junkMiss  | 0,
    tick    : s => s.tick      | 0
  };

  const GOAL_POOL = [
    { id:'g_score800',  label:'ทำคะแนนรวม 800+',   target:800,
      check:s=>G.score(s)>=800,  prog:s=>Math.min(800,G.score(s)) },
    { id:'g_score1600', label:'ทำคะแนนรวม 1600+',  target:1600,
      check:s=>G.score(s)>=1600, prog:s=>Math.min(1600,G.score(s)) },
    { id:'g_score2200', label:'ทำคะแนนรวม 2200+',  target:2200,
      check:s=>G.score(s)>=2200, prog:s=>Math.min(2200,G.score(s)) },

    { id:'g_combo16',   label:'คอมโบสูงสุด ≥ 16',  target:16,
      check:s=>G.comboMax(s)>=16, prog:s=>Math.min(16,G.comboMax(s)) },
    { id:'g_combo22',   label:'คอมโบสูงสุด ≥ 22',  target:22,
      check:s=>G.comboMax(s)>=22, prog:s=>Math.min(22,G.comboMax(s)) },

    { id:'g_good25',    label:'เก็บของดีให้ได้ 25 ชิ้น', target:25,
      check:s=>G.goodHit(s)>=25, prog:s=>Math.min(25,G.goodHit(s)) },
    { id:'g_good35',    label:'เก็บของดีให้ได้ 35 ชิ้น', target:35,
      check:s=>G.goodHit(s)>=35, prog:s=>Math.min(35,G.goodHit(s)) },

    { id:'g_miss8',     label:'โดนของเสียไม่เกิน 8 ครั้ง', target:8,
      check:s=>G.miss(s)<=8, prog:s=>Math.min(8,G.miss(s)) },

    { id:'g_time45',    label:'อยู่รอดเกิน 45 วินาที', target:45,
      check:s=>G.tick(s)>=45, prog:s=>Math.min(45,G.tick(s)) }
  ];

  const MINI_POOL = [
    { id:'m_combo10',   label:'คอมโบต่อเนื่อง 10',  target:10,
      check:s=>G.comboMax(s)>=10, prog:s=>Math.min(10,G.comboMax(s)) },
    { id:'m_combo14',   label:'คอมโบต่อเนื่อง 14',  target:14,
      check:s=>G.comboMax(s)>=14, prog:s=>Math.min(14,G.comboMax(s)) },
    { id:'m_combo18',   label:'คอมโบต่อเนื่อง 18',  target:18,
      check:s=>G.comboMax(s)>=18, prog:s=>Math.min(18,G.comboMax(s)) },

    { id:'m_miss6',     label:'พลาดไม่เกิน 6 ครั้ง', target:6,
      check:s=>G.miss(s)<=6, prog:s=>Math.min(6,G.miss(s)) },

    { id:'m_good18',    label:'เก็บของดี 18 ชิ้น',   target:18,
      check:s=>G.goodHit(s)>=18, prog:s=>Math.min(18,G.goodHit(s)) }
  ];

  const deck = new MissionDeck({ goalPool:GOAL_POOL, miniPool:MINI_POOL });
  deck.drawGoals(5);
  deck.draw3();

  // --- สะสมว่า "เคยแสดง" / "ผ่าน" เควสต์อะไรบ้างทั้งเกม ---
  const seenGoalIds = new Set();
  const doneGoalIds = new Set();
  const seenMiniIds = new Set();
  const doneMiniIds = new Set();

  function snapshotQuests(reason){
    let goals = deck.getProgress('goals');
    let minis = deck.getProgress('mini');

    goals.forEach(g => {
      if (g.id)  seenGoalIds.add(g.id);
      if (g.done) doneGoalIds.add(g.id);
    });
    minis.forEach(m => {
      if (m.id)  seenMiniIds.add(m.id);
      if (m.done) doneMiniIds.add(m.id);
    });

    // ถ้าเคลียร์หมด → จั่วชุดใหม่
    if (goals.length > 0 && goals.every(g=>g.done)){
      deck.drawGoals(5);
      goals = deck.getProgress('goals');
      goals.forEach(g=>{ if(g.id) seenGoalIds.add(g.id); });
    }
    if (minis.length > 0 && minis.every(m=>m.done)){
      deck.draw3();
      minis = deck.getProgress('mini');
      minis.forEach(m=>{ if(m.id) seenMiniIds.add(m.id); });
    }

    // ส่งไปให้ HUD เลือก focus (goal / mini)
    const focusGoal = goals.find(g=>!g.done) || goals[0] || null;
    const focusMini = minis.find(m=>!m.done) || minis[0] || null;

    window.dispatchEvent(new CustomEvent('quest:update',{
      detail:{ goal:focusGoal, mini:focusMini, goalsAll:goals, minisAll:minis, reason }
    }));
  }

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
    try{ window.dispatchEvent(new CustomEvent('hha:combo',{detail:{combo}})); }catch(_){}
  }

  // ---------- Judge ----------
  function judge(emo, ctx){
    const { x, y } = screenPoint(ctx);

    const isGood = GOOD.includes(emo);
    const isJunk = JUNK.includes(emo);

    if (isGood){
      let base = 16;
      if (diff === 'easy')  base = 14;
      if (diff === 'hard')  base = 18;

      const delta = (base + combo * 2) * mult();
      score += delta;
      combo++;
      emitCombo();
      gainFever(6 + combo * 0.4);

      deck.onGood();
      deck.stats.goodCount++;
      syncDeck();

      if (Particles && typeof Particles.burstShards === 'function'){
        try{ Particles.burstShards(null, null, { screen:{x,y}, theme:'goodjunk' }); }catch(_){}
      }
      scoreFX(x, y, delta, true);

      if (combo === 10 || combo === 15 || combo === 20) coachSay('streak');

      snapshotQuests('hit-good');
      return { good:true, scoreDelta:delta };
    }

    if (isJunk){
      let delta = -12;
      if (diff === 'easy') delta = -9;
      if (diff === 'hard') delta = -14;

      score = Math.max(0, score + delta);
      combo = 0;
      emitCombo();
      decayFever(12);

      deck.onJunk();
      syncDeck();

      if (Particles && typeof Particles.burstShards === 'function'){
        try{ Particles.burstShards(null, null, { screen:{x,y}, theme:'goodjunk' }); }catch(_){}
      }
      scoreFX(x, y, delta, false);

      coachSay('miss');
      snapshotQuests('hit-junk');
      return { good:false, scoreDelta:delta };
    }

    // คลิกพลาด ไม่โดน emoji
    combo = 0;
    emitCombo();
    decayFever(6);
    syncDeck();
    snapshotQuests('miss-empty');
    return { good:false, scoreDelta:0 };
  }

  function onExpire(ev){
    // เป้าหลุดจอ → ถือว่าพลาดเล็กน้อย
    deck.onJunk();
    combo = 0;
    emitCombo();
    decayFever(8);
    syncDeck();
    snapshotQuests('expire');
  }

  function onSec(){
    if (combo <= 0) decayFever(6);
    else decayFever(2);

    deck.second();
    syncDeck();
    snapshotQuests('tick');
  }

  // ---------- Time events ----------
  window.addEventListener('hha:time',(e)=>{
    const sec = (e.detail?.sec|0);
    if (sec > 0) onSec();
    if (sec === 10) coachSay('danger');

    if (sec === 0){
      // จบเกม: สรุปเควสต์จาก set สะสม
      const goalsCleared = doneGoalIds.size;
      const goalsTotal   = seenGoalIds.size;
      const questsCleared = doneMiniIds.size;
      const questsTotal   = seenMiniIds.size;

      window.dispatchEvent(new CustomEvent('hha:end',{
        detail:{
          mode       : 'Good vs Junk',
          difficulty : diff,
          score,
          comboMax   : deck.stats.comboMax,
          misses     : deck.stats.junkMiss,
          hits       : deck.stats.goodCount,
          duration   : dur,
          goalCleared: goalsCleared > 0,
          goalsCleared,
          goalsTotal,
          questsCleared,
          questsTotal
        }
      }));
    }
  });

  // ---------- Factory boot ----------
  const controller = await factoryBoot({
    difficulty: diff,
    duration  : dur,
    pools     : { good:GOOD, bad:JUNK },
    goodRate  : 0.7,
    judge,
    onExpire
  });

  snapshotQuests('start');
  coachSay('start');
  return controller;
}

export default { boot };