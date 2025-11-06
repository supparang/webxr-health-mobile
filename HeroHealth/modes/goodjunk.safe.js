// === modes/goodjunk.safe.js (Good vs Junk Mode, 2025-11-06, slot+cap) ===
// เป้าหมาย: คลิก "ของดี (GOOD)" เลี่ยง "ของขยะ (JUNK)"
// อัปเดต: จำกัดจำนวนเป้าพร้อมกัน, ใช้ slot grid กันซ้อน, และ scheduler กันสปอนถี่เกิน
// API: export async function boot({ host, duration=60, difficulty='normal', goal=40 })

import Difficulty       from '../vr/difficulty.js';
import Emoji            from '../vr/emoji-sprite.js';
import { Fever }        from '../vr/fever.js';
import MiniQuest        from '../vr/miniquest.js';
import { MissionDeck }  from '../vr/mission.js';
import { Particles }    from '../vr/particles.js';
import { SFX }          from '../vr/sfx.js';

const $ = s => document.querySelector(s);
const sample = arr => arr[Math.floor(Math.random()*arr.length)];
const clamp  = (n,a,b)=>Math.max(a,Math.min(b,n));

// ---------- Pools: 20 รายการ ----------
const GOOD = [
  '🍎','🍏','🍇','🍓','🍍','🍉','🍐','🍊','🫐','🥝',
  '🍋','🍒','🍈','🥭','🍑','🥗','🐟','🥜','🍚','🍞'
];
const JUNK = [
  '🍔','🍟','🍕','🌭','🍗','🥓','🍩','🍪','🧁','🍰',
  '🍫','🍬','🍭','🥤','🧋','🍹','🍨','🍧','🍿','🥮'
];

// ---------- Spawn controls (NEW) ----------
const MAX_ACTIVE_BY_DIFF     = { easy: 6, normal: 8, hard: 10 }; // เพดานเป้าพร้อมกันบนจอ
const SPAWN_BUDGET_PER_SEC   = { easy: 6, normal: 8, hard: 10 }; // สปอน/วินาทีสูงสุด
const GOOD_RATE              = 0.66; // สัดส่วน GOOD : JUNK

// ---------- Emoji helper ----------
function makeEmoji(char, {size=96, scale=0.55, glow=true, shadow=true} = {}){
  if (typeof Emoji?.fromChar === 'function') {
    return Emoji.fromChar(char, { size, scale, glow, shadow });
  }
  if (typeof Emoji?.create === 'function') {
    const type = GOOD.includes(char) ? 'GOOD' : (JUNK.includes(char) ? 'JUNK' : 'STAR');
    return Emoji.create({ type, size: scale });
  }
  const el = document.createElement('a-entity');
  el.setAttribute('text', { value: char, align: 'center', width: 2.2*scale, color: '#fff' });
  return el;
}

// ---------- Slot grid (NEW, กันซ้อน) ----------
function buildSlots() {
  const xs = [-0.70,-0.42,-0.14, 0.14, 0.42, 0.70];
  const ys = [ 1.00, 1.22, 1.44, 1.66, 1.88 ];
  const slots = [];
  for (const x of xs) for (const y of ys)
    slots.push({ x, y, z: -(1.2 + Math.random()*0.5), used:false });
  return slots;
}
function takeFreeSlot(slots) {
  const free = slots.filter(s => !s.used);
  if (!free.length) return null;
  const s = free[Math.floor(Math.random()*free.length)];
  s.used = true; return s;
}
function releaseSlot(slots, slot){ if (slot) slot.used = false; }

export async function boot({ host, duration=60, difficulty='normal', goal=40 } = {}) {
  // ---------- Host safety ----------
  if (!host){
    const wrap = $('a-scene') || document.body;
    const auto = document.createElement('a-entity');
    auto.id = 'spawnHost';
    wrap.appendChild(auto);
    host = auto;
  }

  // ---------- Systems ----------
  const sfx = new SFX('../assets/audio/');
  await sfx.unlock();
  sfx.attachPageVisibilityAutoMute();

  const scene = $('a-scene') || document.body;
  const fever = new Fever(scene, null, { durationMs: 10000 });

  const mq = new MiniQuest(
    { tQ1: $('#tQ1'), tQ2: $('#tQ2'), tQ3: $('#tQ3') },
    { coach_start: $('#coach_start'), coach_good: $('#coach_good'),
      coach_warn: $('#coach_warn'), coach_fever: $('#coach_fever'),
      coach_quest: $('#coach_quest'), coach_clear: $('#coach_clear') }
  );
  mq.start(goal);

  const missions = new MissionDeck();
  missions.draw3();

  // ---------- Difficulty ----------
  const diff = new Difficulty();
  const cfgByLevel = (diff?.config && diff.config[difficulty]) || diff?.config?.normal || { size:0.6, rate:520, life:2000 };
  let spawnRateMs = cfgByLevel.rate;   // ระยะห่างพื้นฐานระหว่างการ spawn
  let lifetimeMs  = cfgByLevel.life;   // อายุของเป้า
  let sizeFactor  = cfgByLevel.size;   // ขนาดของเป้า

  // ---------- State ----------
  let running = true;
  let missionGood = 0;
  let score = 0;
  let combo = 0;
  let streak = 0;
  let totalSpawn = 0;

  // ---------- NEW: caps & slots & scheduler ----------
  const MAX_ACTIVE     = MAX_ACTIVE_BY_DIFF[difficulty]   || 8;
  const BUDGET_PER_SEC = SPAWN_BUDGET_PER_SEC[difficulty] || 8;

  const active = new Set();         // เก็บ element ที่ยังอยู่บนจอ
  const slots  = buildSlots();      // ช่องวางเป้า
  let issuedThisSecond = 0;         // ตัวนับ “สปอนต่อวินาที”
  let spawnTicker;                  // ตัวตั้งเวลาอัจฉริยะ

  // ล้าง budget ทุกวินาที
  const budgetTimer = setInterval(()=>{ issuedThisSecond = 0; }, 1000);

  function scheduleSpawnLoop(){
    clearTimeout(spawnTicker);
    const tick = () => {
      if (running && active.size < MAX_ACTIVE && issuedThisSecond < BUDGET_PER_SEC) spawnOne();
      spawnTicker = setTimeout(tick, spawnRateMs);
    };
    tick();
  }
  scheduleSpawnLoop();

  // ---------- Spawn ----------
  function spawnOne(){
    if (!running) return;
    if (active.size >= MAX_ACTIVE || issuedThisSecond >= BUDGET_PER_SEC) return;

    const slot = takeFreeSlot(slots);
    if (!slot) return; // ไม่มีช่องว่าง → ข้ามรอบนี้

    issuedThisSecond++;
    totalSpawn++;

    const isGood = Math.random() < GOOD_RATE;
    const char = isGood ? sample(GOOD) : sample(JUNK);

    const el = makeEmoji(char, { size: 96, scale: clamp(sizeFactor, 0.48, 0.85), glow: true, shadow: true });
    el.setAttribute('position', `${slot.x} ${slot.y} ${slot.z}`);
    active.add(el);

    const ttl = Math.round(lifetimeMs * (0.9 + Math.random()*0.3)); // life ผันแปรเล็กน้อย
    const killer = setTimeout(()=>{
      if (GOOD.includes(char)) { // พลาดของดี
        streak = 0;
        combo  = 0;
        mq.junk();
        missions.onJunk();
      }
      cleanup();
    }, ttl);

    el.addEventListener('click', ()=>{
      clearTimeout(killer);
      onHit({ el, char, pos: {x:slot.x, y:slot.y, z:slot.z} });
      cleanup();
    }, { once:true });

    host.appendChild(el);

    function cleanup(){
      try { el.remove(); } catch {}
      active.delete(el);
      releaseSlot(slots, slot);
    }
  }

  function onHit({ el, char, pos }){
    const isGood = GOOD.includes(char);

    if (isGood){
      const gain = fever.active ? 2 : 1;
      missionGood += 1;
      score += 10 * gain;
      combo += 1;
      streak += 1;

      sfx.popGood();
      Particles.burst(host, pos, '#69f0ae');

      if (streak % 6 === 0) fever.add(8);

      mq.good({ score, combo, streak, missionGood });
      missions.onGood();
      missions.updateScore?.(score);
      missions.updateCombo?.(combo);

      if (missionGood >= goal) {
        mq.mission(missionGood);
        if (missionGood === goal){
          sfx.star();
          Particles.spark(host, {x:0, y:1.4, z:-1.4}, '#ffe066');
        }
      }
    } else {
      score = Math.max(0, score - 5);
      combo = 0;
      streak = 0;

      sfx.popBad();
      Particles.smoke(host, pos);
      mq.junk();
      missions.onJunk();
    }
  }

  // ---------- Timers ----------
  const secondTimer = setInterval(()=>{
    if (!running) return;
    mq.second();
    missions.second?.();
  }, 1000);

  const endTimer = setTimeout(()=> endGame('timeout'), duration * 1000);

  // Fever hook (ชะลอสปอนช่วง Fever เล็กน้อยให้อ่านเกมได้)
  window.addEventListener('hha:fever', (e)=>{
    if (e?.detail?.state === 'start'){
      mq.fever();
      missions.onFeverStart?.();
      spawnRateMs = Math.round(cfgByLevel.rate * 1.2); // ช้าลงตอน Fever
    } else if (e?.detail?.state === 'end'){
      spawnRateMs = cfgByLevel.rate; // กลับค่าปกติ
    }
  });

  function endGame(reason='stop'){
    if (!running) return;
    running = false;

    clearTimeout(spawnTicker);
    clearInterval(secondTimer);
    clearInterval(budgetTimer);
    clearTimeout(endTimer);

    fever.end();
    sfx.playCoach('clear');

    const detail = {
      reason,
      score,
      missionGood,
      goal,
      totalSpawn,
      quests: mq.serialize?.().quests || [],
      missions: missions.summary?.()
    };
    try { window.dispatchEvent(new CustomEvent('hha:end', { detail })); } catch {}
  }

  // ---------- Public API ----------
  return {
    pause(){
      if (!running) return;
      running = false;
      clearTimeout(spawnTicker);
      mq.pause?.();
    },
    resume(){
      if (running) return;
      running = true;
      scheduleSpawnLoop();
      mq.resume?.();
    },
    stop(){ endGame('stop'); }
  };
}
