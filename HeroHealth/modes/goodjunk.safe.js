// === /HeroHealth/modes/goodjunk.safe.js (2025-11-13 LATEST + score FX) ===
// Good vs Junk — คลิกของดี เก็บคะแนน / คอมโบ / Fever / Quest ครบ
// - ใช้ MissionDeck สำหรับ Goal / Mini Quest
// - ส่ง event ให้ HUD/Coach + เอฟเฟกต์คะแนนเด้งตรงเป้าแน่นอน

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
  // พยายามใช้จุดที่ pointer คลิกก่อน
  let x = ctx && (ctx.clientX ?? ctx.pageX ?? ctx.x);
  let y = ctx && (ctx.clientY ?? ctx.pageY ?? ctx.y);

  // ถ้าไม่มี ให้ใช้กลางเป้า (host / node)
  if ((!x && !y) && ctx && (ctx.host || ctx.node)){
    const el = ctx.host || ctx.node;
    const r = el && el.getBoundingClientRect ? el.getBoundingClientRect() : null;
    if (r){
      x = r.left + r.width / 2;
      y = r.top  + r.height / 2;
    }
  }

  // fallback กลางจอ
  if (!x && !y){
    x = window.innerWidth  / 2;
    y = window.innerHeight / 2;
  }
  return { x, y };
}

function scoreFX(x, y, delta, isGood){
  // ถ้ามีระบบ Particles เดิม → ใช้ก่อน
  if (Particles && typeof Particles.scorePop === 'function'){
    try{
      Particles.scorePop(x, y, delta, { good:isGood });
      return;
    }catch(_){}
  }
  // fallback DOM (ตัวเลขคะแนนเด้งขึ้น)
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
  setTimeout(()=>{ try{el.remove();}catch(_){ } }, 500);
}

// ---------- Coach ----------
function coachSay(key){
  let text = '';
  switch(key){
    case 'start': text = 'เก็บของดีให้ได้ต่อเนื่อง คอมโบจะยิ่งแรงขึ้น!'; break;
    case 'streak': text = 'คอมโบยาวมากแล้ว รักษาจังหวะนี้ต่อไป!'; break;
    case 'miss': text = 'โดนของเสียสะดุดคอมโบ ลองโฟกัสดูดี ๆ ก่อนคลิก'; break;
    case 'danger': text = 'เวลาใกล้หมดแล้ว เก็บของดีรัว ๆ ให้ทะลุเป้า!'; break;
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
  const dur  = Number(cfg.duration || 60);

  ensureFeverBar();
  setFever(0);
  setFeverActive(false);

  // ---------- MissionDeck config ----------
  const G = {
    score   : s => s.score     | 0,
    comboMax: s => s.comboMax  | 0,
    goodHit : s => s.goodCount | 0,
    miss    : s => s.junkMiss  | 0,
    tick    : s => s.tick      | 0
  };

  const GOAL_POOL = [
    { id:'g_score800', label:'ทำคะแนนรวม 800+',
      target:800, level:'easy',
      check:s=>G.score(s)>=800, prog:s=>Math.min(800,G.score(s)) },

    { id:'g_score1600', label:'ทำคะแนนรวม 1600+',
      target:1600, level:'normal',
      check:s=>G.score(s)>=1600, prog:s=>Math.min(1600,G.score(s)) },

    { id:'g_score2200', label:'ทำคะแนนรวม 2200+',
      target:2200, level:'hard',
      check:s=>G.score(s)>=2200, prog:s=>Math.min(2200,G.score(s)) },

    { id:'g_combo16', label:'คอมโบสูงสุด ≥ 16',
      target:16, level:'normal',
      check:s=>G.comboMax(s)>=16, prog:s=>Math.min(16,G.comboMax(s)) },

    { id:'g_combo22', label:'คอมโบสูงสุด ≥ 22',
      target:22, level:'hard',
      check:s=>G.comboMax(s)>=22, prog:s=>Math.min(22,G.comboMax(s)) },

    { id:'g_good25', label:'เก็บของดีให้ได้ 25 ชิ้น',
      target:25, level:'easy',
      check:s=>G.goodHit(s)>=25, prog:s=>Math.min(25,G.goodHit(s)) },

    { id:'g_good35', label:'เก็บของดีให้ได้ 35 ชิ้น',
      target:35, level:'normal',
      check:s=>G.goodHit(s)>=35, prog:s=>Math.min(35,G.goodHit(s)) },

    { id:'g_miss8', label:'โดนของเสียไม่เกิน 8 ครั้ง',
      target:8, level:'normal',
      check:s=>G.miss(s)<=8, prog:s=>Math.min(8,G.miss(s)) },

    { id:'g_time45', label:'อยู่รอดเกิน 45 วินาที',
      target:45, level:'easy',
      check:s=>G.tick(s)>=45, prog:s=>Math.min(45,G.tick(s)) }
  ];

  const MINI_POOL = [
    { id:'m_combo10', label:'คอมโบต่อเนื่อง 10',
      target:10, level:'easy',
      check:s=>G.comboMax(s)>=10, prog:s=>Math.min(10,G.comboMax(s)) },

    { id:'m_combo14', label:'คอมโบต่อเนื่อง 14',
      target:14, level:'normal',
      check:s=>G.comboMax(s)>=14, prog:s=>Math.min(14,G.comboMax(s)) },

    { id:'m_combo18', label:'คอมโบต่อเนื่อง 18',
      target:18, level:'hard',
      check:s=>G.comboMax(s)>=18, prog:s=>Math.min(18,G.comboMax(s)) },

    { id:'m_miss6', label:'พลาด (โดนของเสีย) ไม่เกิน 6 ครั้ง',
      target:6, level:'normal',
      check:s=>G.miss(s)<=6, prog:s=>Math.min(6,G.miss(s)) },

    { id:'m_good18', label:'เก็บของดี 18 ชิ้น',
      target:18, level:'easy',
      check:s=>G.goodHit(s)>=18, prog:s=>Math.min(18,G.goodHit(s)) }
  ];

  const deck = new MissionDeck({ goalPool:GOAL_POOL, miniPool:MINI_POOL });
  deck.drawGoals(5);
  deck.draw3();

  // ---------- Mode state ----------
  let score = 0;
  let combo = 0;
  let fever = 0;
  let feverActive = false;

  function mult(){
    return feverActive ? 2 : 1;
  }

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
        goal: goals.find(g=>!g.done) || goals[0] || null,
        mini: minis.find(m=>!m.done) || minis[0] || null,
        goalsAll:goals,
        minisAll:minis
      }
    }));
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

      Particles.burstShards(null, null, { screen:{x,y}, theme:'goodjunk' });
      scoreFX(x, y, delta, true);

      if (combo === 10 || combo === 15 || combo === 20) coachSay('streak');

      pushQuest();
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

      Particles.burstShards(null, null, { screen:{x,y}, theme:'goodjunk' });
      scoreFX(x, y, delta, false);

      coachSay('miss');
      pushQuest();
      return { good:false, scoreDelta:delta };
    }

    // คลิกอื่น ๆ / พลาดไม่โดนเป้า → ไม่เปลี่ยนคะแนน แต่อาจตัดคอมโบเบา ๆ
    combo = 0;
    emitCombo();
    decayFever(6);
    syncDeck();
    pushQuest();
    return { good:false, scoreDelta:0 };
  }

  function onExpire(ev){
    if (!ev) return;
    // เป้าหลุดไปเฉย ๆ → ถือว่าพลาดเล็กน้อย
    deck.onJunk();
    combo = 0;
    emitCombo();
    decayFever(8);
    syncDeck();
    pushQuest();
  }

  function onSec(){
    if (combo <= 0) decayFever(6);
    else decayFever(2);

    deck.second();
    syncDeck();

    const goals = deck.getProgress('goals');
    const minis = deck.getProgress('mini');
    if (deck.isCleared('mini')) deck.draw3();
    if (deck.isCleared('goals')) deck.drawGoals(5);

    pushQuest();
  }

  // ---------- Time events ----------
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
          mode        : 'Good vs Junk',
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

  // ---------- Factory boot ----------
  const controller = await factoryBoot({
    difficulty: diff,
    duration  : dur,
    pools     : { good:GOOD, bad:JUNK },
    goodRate  : 0.7,
    judge,
    onExpire
  });

  pushQuest();
  coachSay('start');
  return controller;
}

export default { boot };