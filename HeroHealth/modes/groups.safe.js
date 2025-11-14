// === /HeroHealth/modes/groups.safe.js (2025-11-14 QUEST INTEGRATION) ===
// เกม Groups: เลือกอาหารให้เข้ากับ "หมู่เป้าหมาย" ที่กำหนด
// ใช้งานร่วมกับ groups.quest.js + quest-hud.js + particles.js

import { burstAt, scorePop } from '../vr/particles.js';
import { createGroupsQuest } from './groups.quest.js';

// 5 หมู่หลัก
const GROUPS = {
  1: ['🍚','🍙','🍞','🥐','🥖','🥯'],              // ข้าว-แป้ง
  2: ['🥩','🍗','🍖','🥚','🧀','🥓'],              // เนื้อ/โปรตีน
  3: ['🥦','🥕','🍅','🥬','🌽','🥗'],              // ผัก
  4: ['🍎','🍌','🍇','🍉','🍊','🍓','🍍'],          // ผลไม้
  5: ['🥛','🧈','🧀','🍨']                         // นม/แคลเซียม
};

const ALL_EMOJI = Object.values(GROUPS).flat();

function foodGroup(emo){
  for (const [g, list] of Object.entries(GROUPS)){
    if (list.includes(emo)) return Number(g);
  }
  return 0;
}

// ความยาก / จังหวะ spawn
const diffCfg = {
  easy:   { spawn: 950, life: 2200, focusGroups: 1 },
  normal: { spawn: 800, life: 2000, focusGroups: 2 },
  hard:   { spawn: 650, life: 1800, focusGroups: 3 }
};

// ---------------------------------------------------------------------------
// boot
// ---------------------------------------------------------------------------
export async function boot(opts = {}) {
  const diff = (opts.difficulty || 'normal').toLowerCase();
  const cfg  = diffCfg[diff] || diffCfg.normal;
  const dur  = (opts.duration | 0) || 60;

  const host = document.getElementById('spawnHost') || makeHost();
  host.innerHTML = '';

  // state หลัก
  let score      = 0;
  let combo      = 0;
  let comboMax   = 0;
  let misses     = 0;
  let hits       = 0;
  let goodHits   = 0;          // จำนวนที่กดถูก "หมู่เป้าหมาย"
  let groupsDone = 0;          // จัดครบทั้ง 5 หมู่กี่รอบแล้ว
  let timeLeft   = dur;

  let spawnTimer = null;
  let tickTimer  = null;

  // active groups ที่ให้โฟกัส และปรับเพิ่มกลางเกม
  let activeGroups = pickGroups(cfg.focusGroups);
  let focusLevel   = 1;

  // coverage สำหรับนับครบ 5 หมู่ = 1 รอบ
  let coverage = new Set();

  // ---------- QUEST DIRECTOR ----------
  const quest = createGroupsQuest(diff);

  function getState(){
    return {
      score,
      goodHits,
      miss      : misses,
      comboMax,
      timeLeft,
      groupsDone
    };
  }

  function pushQuest(){
    try{ quest.update(getState()); }catch(_){}
  }

  function coach(text){
    window.dispatchEvent(new CustomEvent('hha:coach',{ detail:{ text } }));
  }

  // ---------- SCORE / EFFECT ----------
  function emitScore(delta, isGood, targetHit, ev){
    score = Math.max(0, score + (delta | 0));

    if (isGood){
      combo++;
      hits++;
      comboMax = Math.max(comboMax, combo);
      if (targetHit){
        goodHits++;
      }
    } else {
      combo = 0;
      misses++;
    }

    // นับรอบ "ครบ 5 หมู่" จากเป้าที่ถูกหมู่เป้าหมาย
    if (isGood && targetHit){
      const g = Number(ev?.target?.dataset?.group || ev?.target?.getAttribute?.('data-group') || 0);
      if (g) coverage.add(g);
      if (coverage.size >= 5){
        coverage.clear();
        groupsDone++;
        coach('เยี่ยม! จัดครบทั้ง 5 หมู่ได้อีก 1 รอบแล้ว');
      }
    }

    window.dispatchEvent(new CustomEvent('hha:score', {
      detail: {
        delta,
        total   : score,
        combo,
        comboMax,
        good    : isGood
      }
    }));

    if (ev){
      const x = ev.clientX;
      const y = ev.clientY;
      burstAt(x, y, { color: isGood ? '#22c55e' : '#f97316' });
      scorePop(x, y, (delta > 0 ? '+' : '') + delta, { good: isGood });
    }

    // ปรับความโหด: เพิ่มจำนวนหมู่ที่ต้องโฟกัส
    if (goodHits >= 12 && focusLevel === 1 && cfg.focusGroups >= 2){
      focusLevel = 2;
      activeGroups = pickGroups(2);
      coach('เก่งมาก! ตอนนี้ให้โฟกัส 2 หมู่พร้อมกัน');
    } else if (goodHits >= 24 && focusLevel === 2 && cfg.focusGroups >= 3){
      focusLevel = 3;
      activeGroups = pickGroups(3);
      coach('สุดยอด! โฟกัส 3 หมู่พร้อมกันเลย!');
    }

    pushQuest();
  }

  // ---------- SPAWN ----------
  function spawnOne(){
    if (timeLeft <= 0) return;

    // bias ให้ spawn ตามหมู่เป้าหมายมากกว่า
    const targetBias = 0.7;
    let emoji, g;

    if (Math.random() < targetBias){
      const tg = activeGroups[(Math.random() * activeGroups.length) | 0];
      emoji = randomFrom(GROUPS[tg]);
      g = tg;
    } else {
      emoji = randomFrom(ALL_EMOJI);
      g = foodGroup(emoji);
    }

    const el = document.createElement('div');
    el.textContent   = emoji;
    el.dataset.group = g;
    Object.assign(el.style, {
      position: 'absolute',
      left    : (10 + Math.random() * 80) + '%',
      top     : (18 + Math.random() * 60) + '%',
      transform: 'translate(-50%,-50%)',
      font    : '900 46px system-ui',
      textShadow: '0 6px 18px rgba(0,0,0,.55)',
      cursor  : 'pointer',
      pointerEvents: 'auto',
      userSelect   : 'none'
    });

    const life = cfg.life;
    const kill = ()=>{ if (el.parentNode) try{ host.removeChild(el); }catch(_){}; };

    el.addEventListener('click',(ev)=>{
      if (!el.parentNode) return;
      kill();
      const groupHit = Number(el.dataset.group || 0);
      const isTarget = activeGroups.includes(groupHit);

      if (isTarget){
        emitScore(140, true, true, ev);
      } else {
        emitScore(-120, false, false, ev);
        coach('อันนี้ไม่ใช่หมู่เป้าหมาย ลองสังเกตให้ดี ๆ นะ');
      }
    });

    host.appendChild(el);
    setTimeout(kill, life);
  }

  // ---------- TIMER ----------
  function tick(){
    timeLeft--;
    window.dispatchEvent(new CustomEvent('hha:time',{ detail:{ sec: timeLeft }}));

    pushQuest();

    if (timeLeft <= 0){
      stopAll();
      finish();
    }
  }

  function stopAll(){
    if (spawnTimer){ clearInterval(spawnTimer); spawnTimer = null; }
    if (tickTimer){  clearInterval(tickTimer);  tickTimer  = null; }
  }

  function finish(){
    const sum = quest.summary ? quest.summary() : {
      goalsCleared: 0, goalsTotal: 0, miniCleared: 0, miniTotal: 0
    };

    const goalCleared = sum.goalsTotal
      ? (sum.goalsCleared >= sum.goalsTotal)
      : false;

    window.dispatchEvent(new CustomEvent('hha:end',{
      detail:{
        mode       : 'groups',
        difficulty : diff,
        score,
        misses,
        comboMax,
        duration   : dur,
        goalCleared,
        questsCleared: sum.miniCleared || 0,
        questsTotal  : sum.miniTotal  || 0
      }
    }));
  }

  // ---------- public controller ----------
  return {
    start(){
      // reset state
      score = 0; combo = 0; comboMax = 0; misses = 0; hits = 0;
      goodHits = 0; groupsDone = 0; timeLeft = dur;
      coverage = new Set();
      activeGroups = pickGroups(cfg.focusGroups);
      focusLevel   = 1;

      window.dispatchEvent(new CustomEvent('hha:time',{ detail:{ sec: timeLeft }}));

      // เริ่ม quest ชุดแรก
      try{ quest.start(getState()); }catch(_){}

      coach('เก็บอาหารให้ตรงหมู่เป้าหมาย ถ้าจัดครบทั้ง 5 หมู่จะได้นับเป็น 1 รอบ!');

      spawnTimer = setInterval(spawnOne, cfg.spawn);
      tickTimer  = setInterval(tick, 1000);
    },
    stop(){
      stopAll();
    }
  };
}

export default { boot };

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------
function randomFrom(arr){ return arr[(Math.random() * arr.length) | 0]; }

function pickGroups(n){
  const all = [1,2,3,4,5];
  const out = [];
  while (out.length < n && all.length){
    const i = (Math.random() * all.length) | 0;
    out.push(all.splice(i,1)[0]);
  }
  return out;
}

function makeHost(){
  const h = document.createElement('div');
  h.id = 'spawnHost';
  Object.assign(h.style, {
    position:'absolute',
    inset   :0,
    pointerEvents:'none',
    zIndex : 650
  });
  document.body.appendChild(h);
  return h;
}