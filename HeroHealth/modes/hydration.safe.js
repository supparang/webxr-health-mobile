// === modes/hydration.safe.js (Hydration Mode, 2025-11-06) ===
// เป้าหมาย: เก็บ "เครื่องดื่มดีต่อสุขภาพ" ให้ได้ตามเป้า เลี่ยง "เครื่องดื่มน้ำตาล/ขยะ"
// รองรับ: Emoji สีจริง, Fever, MiniQuest, MissionDeck, SFX, Particles
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
const clamp = (n,a,b)=>Math.max(a,Math.min(b,n));

// ---------- เครื่องดื่ม (20 อย่างต่อกลุ่ม) ----------
const GOOD_DRINKS = [
  '💧','🫗','🫖','🍵','☕','🥛','🍼','🧊','🍶','🫖', // tea pot dup is ok for variety render
  '🥥','🧉','🧃','🍋','🍵','🫧','🍵','🫖','🥛','💧' // include lemon water/foam/bubbles icon
];
const JUNK_DRINKS = [
  '🥤','🧋','🍹','🍸','🍷','🍾','🍻','🍺','🍷','🍹',
  '🧃','🥤','🧋','🍹','🍸','🍧','🍨','🧁','🍰','🍫'
];
// หมายเหตุ: ในเกม เราใช้ mapping ง่ายๆ: GOOD_DRINKS = น้ำ/ชา/นม/น้ำเต้าหู้/มะพร้าว, JUNK_DRINKS = น้ำหวาน/ไข่มุก/แอลกอฮอล์/ของหวานดื่มได้
// สามารถปรับชุดอีโมจิให้ตรงตามหลักสูตร/อายุผู้เล่นได้ภายหลัง

// ---------- ผู้ช่วย: สร้างอีโมจิแบบสีจริง ----------
function makeEmoji(char, {size=96, scale=0.55, glow=true, shadow=true} = {}){
  if (typeof Emoji?.fromChar === 'function') {
    return Emoji.fromChar(char, { size, scale, glow, shadow });
  }
  if (typeof Emoji?.create === 'function') {
    // ไม่ได้ใช้ type เคร่งครัดในโหมดนี้ (เน้น char เดี่ยว)
    return Emoji.create({ type:'GOOD', size: scale });
  }
  const el = document.createElement('a-entity');
  el.setAttribute('text', { value: char, align: 'center', width: 2.2*scale, color: '#fff' });
  return el;
}

export async function boot({ host, duration=60, difficulty='normal', goal=40 } = {}) {
  // ---------- Host ----------
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
  const fever = new Fever(scene, null, { durationMs: 9000 });

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
  const cfg = (diff?.config && diff.config[difficulty]) || diff?.config?.normal || { size:0.6, rate:520, life:2000 };
  let spawnRateMs = cfg.rate;
  let lifetimeMs  = cfg.life;
  let sizeFactor  = cfg.size;

  // ---------- State ----------
  let running = true;
  let missionGood = 0;      // จำนวนเครื่องดื่มดีที่เก็บได้ (เป้าหมายหลัก)
  let score = 0;
  let combo = 0;
  let streak = 0;

  // เกจ "Hydration" (0–100) เติมเมื่อเก็บเครื่องดื่มดี, ลดเล็กน้อยเมื่อพลาด
  let hydration = 0;

  const startAt = performance.now();
  const HUD_HYDRATION = $('#hydrationLabel'); // ถ้ามีใน HUD จะอัปเดตข้อความให้

  function updateHydration(v){
    hydration = clamp(hydration + v, 0, 100);
    if (HUD_HYDRATION){
      try {
        if (HUD_HYDRATION.hasAttribute('troika-text'))
          HUD_HYDRATION.setAttribute('troika-text','value', `Hydration: ${hydration}%`);
        else if (HUD_HYDRATION.getAttribute('text')!=null)
          HUD_HYDRATION.setAttribute('text', { value: `Hydration: ${hydration}%` });
        else HUD_HYDRATION.textContent = `Hydration: ${hydration}%`;
      }catch{}
    }
    // โบนัสเล็ก: ถ้าเต็ม 100 แล้ว ให้เติม Fever + ส่งเสียง
    if (hydration >= 100) {
      fever.add(100);
      sfx.star();
      Particles.spark(host, {x:0, y:1.5, z:-1.4}, '#8be9fd');
      hydration = 0; // รีเซ็ตรอบใหม่
    }
  }

  // ---------- Spawn ----------
  // GOOD : JUNK ≈ 70 : 30
  const GOOD_RATE = 0.70;

  function spawnOne(){
    if (!running) return;

    const roll = Math.random();
    const isGood = roll < GOOD_RATE;
    const char = isGood ? sample(GOOD_DRINKS) : sample(JUNK_DRINKS);

    const el = makeEmoji(char, { size: 96, scale: clamp(sizeFactor, 0.45, 0.9), glow: true, shadow: true });

    // โปรยด้านหน้า
    const px=(Math.random()*1.4-0.7);
    const py=(Math.random()*0.8+1.0);
    const pz=-(Math.random()*0.6+1.2);
    el.setAttribute('position', `${px} ${py} ${pz}`);

    const killer = setTimeout(()=>{
      // ถ้า GOOD หายเอง → ถือว่าพลาด (รีคอมโบ/สตรีค)
      if (GOOD_DRINKS.includes(char)) {
        combo = 0; streak = 0;
        mq.junk(); missions.onJunk();
        updateHydration(-3);
      }
      el.remove();
    }, lifetimeMs);

    el.addEventListener('click', ()=>{
      clearTimeout(killer);
      onHit({ isGood, pos: {x:px,y:py,z:pz} });
      el.remove();
    }, { once:true });

    host.appendChild(el);
  }

  function onHit({ isGood, pos }){
    if (isGood){
      const gain = fever.active ? 2 : 1;
      missionGood += 1;
      score += 10 * gain;
      combo += 1; streak += 1;

      updateHydration(5 + (fever.active ? 3 : 0)); // เก็บดี → เพิ่มเกจ

      sfx.popGood();
      Particles.burst(host, pos, '#69f0ae');

      if (streak % 6 === 0) fever.add(8);

      mq.good({ score, combo, streak, missionGood });
      missions.onGood();
      missions.updateScore(score);
      missions.updateCombo(combo);

      if (missionGood >= goal) {
        mq.mission(missionGood);
        if (missionGood === goal) {
          sfx.star();
          Particles.spark(host, {x:0, y:1.45, z:-1.4}, '#a3ffac');
        }
      }
    } else {
      score = Math.max(0, score - 5);
      combo = 0; streak = 0;

      updateHydration(-6); // ดื่มหวาน → ลดเกจมากขึ้น

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
    // ค่อยๆ ลดเกจเล็กน้อยเพื่อกระตุ้นการเก็บ (ถ้าไม่ได้เก็บ)
    updateHydration(-0.5);
  }, 1000);
  const endTimer = setTimeout(()=> endGame('timeout'), duration * 1000);

  // Fever hook
  window.addEventListener('hha:fever', (e)=>{
    if (e?.detail?.state === 'start'){
      mq.fever();
      missions.onFeverStart();
    }
  });

  function endGame(reason='stop'){
    if (!running) return;
    running = false;
    clearInterval(spawnTimer);
    clearInterval(secondTimer);
    clearTimeout(endTimer);

    fever.end();
    sfx.playCoach('clear');

    const detail = {
      reason,
      score,
      missionGood,
      goal,
      hydration: Math.round(hydration),
      quests: mq.serialize?.().quests || [],
      missions: missions.summary()
    };
    try { window.dispatchEvent(new CustomEvent('hha:end', { detail })); } catch {}
  }

  // ---------- Public API ----------
  return {
    pause(){
      if (!running) return;
      running = false;
      clearInterval(spawnTimer);
      mq.pause?.();
      // fever.pause() ถ้าคุณมีสถานะ pause แยกใน Fever
    },
    resume(){
      if (running) return;
      running = true;
      setInterval(spawnOne, spawnRateMs);
      mq.resume?.();
      // fever.resume() ถ้าคุณมีสถานะ resume ใน Fever
    },
    stop(){ endGame('stop'); }
  };
}
