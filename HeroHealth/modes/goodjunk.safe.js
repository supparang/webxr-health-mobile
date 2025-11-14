// === /HeroHealth/modes/goodjunk.safe.js (2025-11-14 STAR+FEVER RESTORE) ===
// โหมด Good vs Junk + Power-ups (⭐ 💎 🛡️ 🔥) + Fever bar + Coach + Goal/Mini

import { burstAt, scorePop } from '../vr/particles.js';
import { ensureFeverBar, setFever, setFeverActive, setShield } from '../vr/ui-fever.js';

const GOOD = [
  '🥦','🥕','🍎','🍌','🥗','🐟','🥜','🍚','🍞','🥛',
  '🍇','🍓','🍊','🍅','🥬','🥝','🍍','🍐','🍑'
];
const JUNK = [
  '🍔','🍟','🌭','🍕','🍩','🍪','🍰','🧋','🥤','🍫','🍬','🥓'
];

// Power-ups
const STAR   = '⭐';
const DIA    = '💎';
const SHIELD = '🛡️';
const FIRE   = '🔥';
const POWER  = [STAR, DIA, SHIELD, FIRE];

const diffCfg = {
  easy:   { spawn:900, life:2300, base:18, step:4,  penalty:14, targetGood:20, comboMini:8  },
  normal: { spawn:780, life:2100, base:20, step:5,  penalty:18, targetGood:28, comboMini:12 },
  hard:   { spawn:650, life:1900, base:22, step:6,  penalty:22, targetGood:34, comboMini:16 }
};

function getXY(ev){
  if (!ev) return { x: 0, y: 0 };
  if (ev.changedTouches && ev.changedTouches[0])
    return { x: ev.changedTouches[0].clientX, y: ev.changedTouches[0].clientY };
  if (ev.touches && ev.touches[0])
    return { x: ev.touches[0].clientX, y: ev.touches[0].clientY };
  return { x: ev.clientX || 0, y: ev.clientY || 0 };
}

export async function boot(opts = {}) {
  const diff = (opts.difficulty || 'normal').toLowerCase();
  const cfg  = diffCfg[diff] || diffCfg.normal;
  const dur  = (opts.duration|0) || 60;

  // ---- HUD / Fever ----
  ensureFeverBar();
  let fever = 0;
  let feverActive = false;
  let shield = 0;
  function syncFever(){
    setFever(fever);
    setFeverActive(feverActive);
    setShield(shield);
  }
  syncFever();

  // ---- Host ----
  const host = document.getElementById('spawnHost') || makeHost();
  host.innerHTML = '';

  // ---- State ----
  let score = 0, combo = 0, comboMax = 0;
  let misses = 0, hits = 0;
  let goodHits = 0;          // เก็บของดีสำเร็จกี่ครั้ง
  let timeLeft = dur;
  let spawnTimer = null, tickTimer = null;

  // ---- Quest (Goal + Mini แบบง่าย) ----
  const goalCfg = {
    label  : `เก็บของดีให้ครบ ${cfg.targetGood} ชิ้น`,
    target : cfg.targetGood
  };
  const miniCfg = {
    label  : `คอมโบสูงสุด ${cfg.comboMini} ครั้ง`,
    target : cfg.comboMini
  };

  function goalDone(){ return goodHits >= goalCfg.target; }
  function miniDone(){ return comboMax >= miniCfg.target; }

  function updateQuest(){
    window.dispatchEvent(new CustomEvent('hha:quest',{
      detail:{
        goal:{
          label : goalCfg.label,
          target: goalCfg.target,
          prog  : goodHits,
          done  : goalDone()
        },
        mini:{
          label : miniCfg.label,
          target: miniCfg.target,
          prog  : comboMax,
          done  : miniDone()
        }
      }
    }));
  }

  // ---- Coach ----
  function coach(text){
    window.dispatchEvent(new CustomEvent('hha:coach',{ detail:{ text } }));
  }

  // ---- Fever helpers ----
  function mult(){ return feverActive ? 2 : 1; }

  function gainFever(n){
    fever = Math.max(0, Math.min(100, fever + n));
    if (!feverActive && fever >= 100){
      fever = 100;
      feverActive = true;
      coach('Fever Mode! แตะของดีรัว ๆ เลย!');
    }
    if (feverActive && fever <= 0){
      feverActive = false;
    }
    syncFever();
  }

  function decayFever(base){
    const d = feverActive ? 10 : base;
    fever = Math.max(0, fever - d);
    if (feverActive && fever <= 0){
      feverActive = false;
      coach('Fever หมดแล้ว เก็บคอมโบใหม่!');
    }
    syncFever();
  }

  // ---- Score emit ----
  function emitScore(delta, good, ev, specialLabel){
    score = Math.max(0, score + (delta|0));

    if (good){
      combo++;
      hits++;
      comboMax = Math.max(comboMax, combo);
      goodHits++;   // นับ “ของดี” ทุกครั้งที่ให้เป็น good
    }else{
      combo = 0;
      misses++;
    }

    // ส่งไป HUD กลาง
    window.dispatchEvent(new CustomEvent('hha:score',{
      detail:{
        delta,
        total: score,
        combo,
        comboMax,
        good
      }
    }));

    // เอฟเฟกต์ตรงจุดคลิก
    if (ev){
      const { x, y } = getXY(ev);
      burstAt(x, y, { color: good ? '#4ade80' : '#f97316' });
      const label = (delta>0 ? '+' : '') + delta + (specialLabel ? ` ${specialLabel}` : '');
      if (delta !== 0) scorePop(x, y, label, { good });
    }

    // Coaching เล็กน้อย
    if (combo === 8)  coach('ยอดเยี่ยม! คอมโบ 8 แล้ว ลองไปให้ถึงเป้าหมายดู!');
    if (combo === 15) coach('เทพมาก! คอมโบต่อเนื่องสุด ๆ!');

    if (goalDone()) coach('ถึงเป้าหมายจำนวนชิ้นแล้ว ลองดันคอมโบเพิ่ม!');
    if (miniDone()) coach('Mini Quest คอมโบสำเร็จแล้ว!');

    updateQuest();
  }

  function registerMiss(ev){
    if (shield > 0){
      shield = Math.max(0, shield-1);
      syncFever();
      coach('เกราะกันพลาดให้รอบนี้แล้ว!');
      emitScore(0, false, ev, 'Guard');
      return;
    }
    const penalty = cfg.penalty;
    decayFever(14);
    emitScore(-penalty, false, ev);
  }

  // ---- Spawn logic ----
  function spawnOne(){
    if (timeLeft <= 0) return;

    const el = document.createElement('div');

    // ชนิดตัวที่ออก (GOOD / JUNK / POWER)
    let ch, kind;
    const r = Math.random();
    if (r < 0.12){
      ch = POWER[(Math.random()*POWER.length)|0]; // Power-ups
      kind = 'power';
    }else if (r < 0.12 + 0.6){
      ch = GOOD[(Math.random()*GOOD.length)|0];
      kind = 'good';
    }else{
      ch = JUNK[(Math.random()*JUNK.length)|0];
      kind = 'junk';
    }

    el.textContent = ch;
    el.dataset.kind = kind;

    Object.assign(el.style,{
      position:'absolute',
      left:(12 + Math.random()*76) + '%',
      top:(20 + Math.random()*60) + '%',
      transform:'translate(-50%,-50%)',
      font:'900 56px system-ui',
      textShadow:'0 6px 18px rgba(0,0,0,.55)',
      cursor:'pointer',
      pointerEvents:'auto',
      userSelect:'none',
      WebkitUserSelect:'none'
    });

    const life = cfg.life;
    const kill = ()=>{ if (el.parentNode) try{host.removeChild(el);}catch(_){ } };

    el.addEventListener('click',(ev)=>{
      if (!el.parentNode) return;
      kill();

      // Handle Power-ups ก่อน
      if (ch === STAR){
        const delta = 40 * mult();
        gainFever(14);
        emitScore(delta, true, ev, '⭐');
        return;
      }
      if (ch === DIA){
        const delta = 80 * mult();
        gainFever(26);
        emitScore(delta, true, ev, '💎');
        return;
      }
      if (ch === SHIELD){
        shield = Math.min(3, shield + 1);
        syncFever();
        emitScore(0, true, ev, '🛡️');
        coach('ได้เกราะป้องกัน 1 ชั้นแล้ว!');
        return;
      }
      if (ch === FIRE){
        feverActive = true;
        fever = Math.max(fever, 70);
        syncFever();
        emitScore(25, true, ev, '🔥');
        coach('โหมดไฟลุก! แตะให้ไวที่สุด!');
        return;
      }

      // GOOD / JUNK ปกติ
      const isGood = GOOD.includes(ch);
      if (isGood){
        const base  = cfg.base + combo * cfg.step;
        const delta = base * mult();
        gainFever(6 + combo*0.4);
        emitScore(delta, true, ev);
      }else{
        registerMiss(ev);
      }
    });

    host.appendChild(el);
    setTimeout(kill, life);
  }

  function tick(){
    timeLeft--;
    if (timeLeft < 0) return;
    window.dispatchEvent(new CustomEvent('hha:time',{ detail:{ sec: timeLeft } }));

    // Decay fever ถ้าคอมโบตก
    if (combo <= 0) decayFever(6); else decayFever(2);

    updateQuest();

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
    updateQuest();
    const gDone = goalDone();
    const mDone = miniDone();
    const questsTotal   = 2;
    const questsCleared = (gDone?1:0) + (mDone?1:0);

    window.dispatchEvent(new CustomEvent('hha:end',{
      detail:{
        mode:'goodjunk',
        difficulty:diff,
        score,
        misses,
        comboMax,
        duration:dur,
        goalCleared:gDone,
        questsCleared,
        questsTotal
      }
    }));
  }

  // ---- Public controller ----
  return {
    start(){
      score=0; combo=0; comboMax=0; misses=0; hits=0; goodHits=0;
      timeLeft = dur;
      fever=0; feverActive=false; shield=0; syncFever();

      host.innerHTML = '';
      window.dispatchEvent(new CustomEvent('hha:time',{ detail:{ sec: timeLeft } }));

      updateQuest();
      coach('แตะของดีต่อเนื่อง สะสม ⭐ 💎 เปิดโหมดไฟลุกให้ได้!');

      spawnTimer = setInterval(spawnOne, cfg.spawn);
      tickTimer  = setInterval(tick, 1000);
    },
    stop(){
      stopAll();
    }
  };
}

export default { boot };

function makeHost(){
  const h = document.createElement('div');
  h.id = 'spawnHost';
  Object.assign(h.style,{
    position:'absolute',
    inset:0,
    pointerEvents:'none',
    zIndex:650
  });
  document.body.appendChild(h);
  return h;
}