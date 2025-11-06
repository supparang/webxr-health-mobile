// === modes/goodjunk.safe.js (Good vs Junk Mode, 2025-11-06) ===
// เป้าหมาย: คลิก "ของดี (GOOD)" เลี่ยง "ของขยะ (JUNK)"
// รองรับ: Emoji สีจริง, Fever, MiniQuest, MissionDeck, SFX, Particles
// API: export async function boot({ host, duration=60, difficulty='normal', goal=40 })

import Difficulty     from '../vr/difficulty.js';
import Emoji          from '../vr/emoji-sprite.js';
import { Fever }      from '../vr/fever.js';
import MiniQuest      from '../vr/miniquest.js';
import { MissionDeck } from '../vr/mission.js';
import { Particles }  from '../vr/particles.js';
import { SFX }        from '../vr/sfx.js';

// ---------- Pools: 20 รายการต่อกลุ่ม ----------
const GOOD = [
  '🍎','🍏','🍇','🍓','🍍','🍉','🍐','🍊','🫐','🥝',
  '🍋','🍒','🍈','🥭','🍑','🥗','🐟','🥜','🍚','🍞'
];
const JUNK = [
  '🍔','🍟','🍕','🌭','🍗','🥓','🍩','🍪','🧁','🍰',
  '🍫','🍬','🍭','🥤','🧋','🍹','🍨','🍧','🍿','🥮'
];

const $ = s => document.querySelector(s);
const sample = arr => arr[Math.floor(Math.random()*arr.length)];
const clamp = (n,a,b)=>Math.max(a,Math.min(b,n));

// สร้างอีโมจิแบบ “สีจริง” ให้ทำงานได้ทั้งเวอร์ชัน EmojiSprite เก่า/ใหม่
function makeEmoji(char, {size=96, scale=0.55, glow=true, shadow=true} = {}){
  if (typeof Emoji?.fromChar === 'function') {
    return Emoji.fromChar(char, { size, scale, glow, shadow });
  }
  // Fallback: รุ่นเก่า (SDF text จะไม่ได้สีจริง) — ยังคงเล่นได้
  if (typeof Emoji?.create === 'function') {
    const type = GOOD.includes(char) ? 'GOOD' : (JUNK.includes(char) ? 'JUNK' : 'STAR');
    return Emoji.create({ type, size: scale });
  }
  // สุดท้าย: ใช้ a-text ง่าย ๆ
  const el = document.createElement('a-entity');
  el.setAttribute('text', { value: char, align: 'center', width: 2.2*scale, color: '#fff' });
  return el;
}

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
  // ใช้โครงสร้าง config จาก vr/difficulty.js ของคุณโดยตรง
  const diff = new Difficulty();
  const cfgByLevel = (diff?.config && diff.config[difficulty]) || diff?.config?.normal || { size:0.6, rate:520, life:2000 };
  let spawnRateMs = cfgByLevel.rate;   // ระยะห่างการเกิดเป้า
  let lifetimeMs  = cfgByLevel.life;   // อายุเป้าก่อนหาย
  let sizeFactor  = cfgByLevel.size;   // ขนาดเป้า

  // ---------- Game State ----------
  let running = true;
  let missionGood = 0; // จำนวนที่เก็บ GOOD สำเร็จ (ใช้เช็คภารกิจหลัก/goal)
  let score = 0;
  let combo = 0;
  let streak = 0;
  let totalSpawn = 0;
  const startAt = performance.now();

  // ---------- Spawn Logic ----------
  // อัตราส่วน: 68% GOOD / 32% JUNK (ปรับง่ายตรงนี้)
  const GOOD_RATE = 0.68;

  function spawnOne(){
    if (!running) return;

    totalSpawn++;
    const roll = Math.random();
    const char = (roll < GOOD_RATE) ? sample(GOOD) : sample(JUNK);

    const el = makeEmoji(char, { size: 96, scale: clamp(sizeFactor, 0.45, 0.9), glow: true, shadow: true });

    // กระจายตำแหน่งด้านหน้า
    const px=(Math.random()*1.4-0.7);
    const py=(Math.random()*0.8+1.0);
    const pz=-(Math.random()*0.6+1.2);
    el.setAttribute('position', `${px} ${py} ${pz}`);

    // อายุเป้า
    const ttl = lifetimeMs;
    const killer = setTimeout(()=>{
      // ถ้า GOOD หายไปเอง → ถือว่า "พลาด" เบา ๆ: รีสตรีคอย่างเดียว (ไม่หักคะแนน)
      if (GOOD.includes(char)) {
        streak = 0;
        combo  = 0;
        mq.junk();          // ใช้เสียงเตือนเดียวกันเพื่อ feedback
        missions.onJunk();  // นับ miss ใน deck
      }
      el.remove();
    }, ttl);

    // คลิก
    el.addEventListener('click', ()=>{
      clearTimeout(killer);
      onHit({ el, char, pos: {x:px, y:py, z:pz} });
    }, { once:true });

    host.appendChild(el);
  }

  function onHit({ el, char, pos }){
    el.remove();
    const isGood = GOOD.includes(char);

    if (isGood){
      const gain = fever.active ? 2 : 1;
      missionGood += 1;
      score += 10 * gain;
      combo += 1;
      streak += 1;

      sfx.popGood();
      Particles.burst(host, pos, '#69f0ae');

      // เติม Fever ตามสตรีค
      if (streak % 6 === 0) fever.add(8);

      mq.good({ score, combo, streak, missionGood });
      missions.onGood();
      missions.updateScore(score);
      missions.updateCombo(combo);

      // ผ่านเป้าหมายหลัก
      if (missionGood >= goal) {
        mq.mission(missionGood);
        if (missionGood === goal) { // เฉลิมฉลองครั้งแรกที่ถึงเป้า
          sfx.star();
          Particles.spark(host, {x:0, y:1.4, z:-1.4}, '#ffe066');
        }
      }
    } else {
      // JUNK
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
  const spawnTimer = setInterval(spawnOne, spawnRateMs);
  const secondTimer = setInterval(()=>{
    if (!running) return;
    mq.second();
    missions.second();
  }, 1000);
  const endTimer = setTimeout(()=> endGame('timeout'), duration * 1000);

  function endGame(reason='stop'){
    if (!running) return;
    running = false;
    clearInterval(spawnTimer);
    clearInterval(secondTimer);
    clearTimeout(endTimer);

    fever.end();
    sfx.playCoach('clear');

    // สรุปผลสำหรับ HUD/Modal
    const detail = {
      reason,
      score,
      missionGood,
      goal,
      totalSpawn,
      quests: mq.serialize?.().quests || [],
      missions: missions.summary()
    };
    try { window.dispatchEvent(new CustomEvent('hha:end', { detail })); } catch {}
  }

  // Fever hook → แจ้ง MiniQuest/Mission
  window.addEventListener('hha:fever', (e)=>{
    if (e?.detail?.state === 'start'){
      mq.fever();
      missions.onFeverStart();
    }
  });

  // ---------- Public API ----------
  return {
    pause(){
      if (!running) return;
      running = false;
      clearInterval(spawnTimer);
      // หมายเหตุ: หากต้องหยุด Fever UI ด้วย ให้เพิ่ม fever.pause() ตามระบบของคุณ
      mq.pause?.();
    },
    resume(){
      if (running) return;
      running = true;
      // รีสตาร์ท spawn ใหม่ตามระดับเดิม
      setInterval(spawnOne, spawnRateMs);
      mq.resume?.();
    },
    stop(){ endGame('stop'); }
  };
}
