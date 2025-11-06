// === modes/goodjunk.safe.js (VR-friendly: central play zone + 3D FX + score popup) ===
import { Difficulty }   from '../vr/difficulty.js';
import { Emoji }        from '../vr/emoji-sprite.js';
import { Fever }        from '../vr/fever.js';
import { MiniQuest }    from '../vr/miniquest.js';
import { MissionDeck }  from '../vr/mission.js';
import { Particles, AdvancedFX } from '../vr/particles.js';
import { SFX }          from '../vr/sfx.js';

const $ = s => document.querySelector(s);
const sample = arr => arr[Math.floor(Math.random()*arr.length)];
const clamp  = (n,a,b)=>Math.max(a,Math.min(b,n));

// 20 อย่างต่อกลุ่ม
const GOOD = ['🍎','🍏','🍇','🍓','🍍','🍉','🍐','🍊','🫐','🥝','🍋','🍒','🍈','🥭','🍑','🥗','🐟','🥜','🍚','🍞'];
const JUNK = ['🍔','🍟','🍕','🌭','🍗','🥓','🍩','🍪','🧁','🍰','🍫','🍬','🍭','🥤','🧋','🍹','🍨','🍧','🍿','🥮'];

const TIME_BY_DIFF = { easy: 45, normal: 60, hard: 75 };
const MAX_ACTIVE_BY_DIFF   = { easy: 4,  normal: 6,  hard: 8 };
const SPAWN_BUDGET_PER_SEC = { easy: 4,  normal: 6,  hard: 8 };
const GOOD_RATE            = 0.70;

// สร้างอีโมจิ/ฟอนต์แบบ fallback
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

// ===== เป้าอยู่ “ล่างกลางจอ” (host.y=0.4 → world ≈ 1.0–1.6) =====
function buildSlots(yBase = 0.60) {
  const xs = [-0.70,-0.42,-0.14, 0.14, 0.42, 0.70];
  const ys = [ yBase, yBase+0.15, yBase+0.30, yBase+0.45, yBase+0.60 ];
  const slots = [];
  for (const x of xs) for (const y of ys)
    slots.push({ x, y, z: -(1.20 + Math.random()*0.30), used:false }); // z = -1.20..-1.50
  return slots;
}
function takeFreeSlot(slots){ const free = slots.filter(s=>!s.used); if(!free.length) return null; const s=free[Math.floor(Math.random()*free.length)]; s.used=true; return s; }
function releaseSlot(slots, slot){ if (slot) slot.used = false; }
function bindOnce(target, ev, fn, opt){ const h=e=>{target.removeEventListener(ev,h,opt); fn(e);} ; target.addEventListener(ev,h,opt); }

export async function boot({ host, duration, difficulty='normal', goal=40 } = {}) {
  // host safety
  if (!host){
    const wrap = $('a-scene') || document.body;
    const auto = document.createElement('a-entity');
    auto.id = 'spawnHost';
    wrap.appendChild(auto);
    host = auto;
  }

  const sfx = new SFX('../assets/audio/');
  if (sfx.unlock) await sfx.unlock();
  if (sfx.attachPageVisibilityAutoMute) sfx.attachPageVisibilityAutoMute();

  const scene = $('a-scene') || document.body;
  const fever = new Fever(scene, null, { durationMs: 10000 });

  // Mini Quest (แสดงทีละข้อ)
  const mq = new MiniQuest(
    { tQmain: $('#tQmain') },
    { coach_start: $('#coach_start'), coach_good: $('#coach_good'),
      coach_warn: $('#coach_warn'), coach_fever: $('#coach_fever'),
      coach_quest: $('#coach_quest'), coach_clear: $('#coach_clear') }
  );
  mq.start(goal);

  const missions = new MissionDeck();
  missions.draw3?.();

  // เวลาเล่นตามระดับ (fallback ถ้าไม่ได้ส่งมา)
  if (!duration || duration <= 0) duration = TIME_BY_DIFF[difficulty] || 60;
  $('#hudTime')?.setAttribute('troika-text','value', `เวลา: ${duration}s`);

  // difficulty config ปลอดภัย
  const diff = new Difficulty();
  const safeCfg = { size:0.60, rate:520, life:2000 };
  const baseCfg = (diff && diff.config && diff.config[difficulty]) || (diff && diff.config && diff.config.normal) || safeCfg;
  let spawnRateMs = Number(baseCfg.rate) || safeCfg.rate;
  let lifetimeMs  = Number(baseCfg.life) || safeCfg.life;
  let sizeFactor  = Number(baseCfg.size) || safeCfg.size;

  // state
  let running = true;
  let missionGood = 0;
  let score = 0;
  let combo = 0;
  let streak = 0;
  let totalSpawn = 0;

  const MAX_ACTIVE     = MAX_ACTIVE_BY_DIFF[difficulty]   ?? 6;
  const BUDGET_PER_SEC = SPAWN_BUDGET_PER_SEC[difficulty] ?? 6;
  const active = new Set();
  const slots  = buildSlots(0.60);           // << โซนกลาง
  let issuedThisSecond = 0;
  let spawnTicker;
  const budgetTimer = setInterval(()=>{ issuedThisSecond = 0; }, 1000);

  // ------- สร้างเป้า -------
  function spawnOne(){
    if (!running) return;
    if (active.size >= MAX_ACTIVE || issuedThisSecond >= BUDGET_PER_SEC) return;

    const slot = takeFreeSlot(slots);
    if (!slot) return;

    issuedThisSecond++; totalSpawn++;

    const isGood = Math.random() < GOOD_RATE;
    const char = isGood ? sample(GOOD) : sample(JUNK);

    const el = makeEmoji(char, { size: 96, scale: clamp(sizeFactor, 0.50, 0.85), glow: true, shadow: true });
    el.setAttribute('position', `${slot.x} ${slot.y} ${slot.z}`);

    // ให้เล็งโดนง่าย
    el.classList.add('hit','clickable');
    const hit = document.createElement('a-plane');
    hit.setAttribute('width',  0.50);
    hit.setAttribute('height', 0.50);
    hit.setAttribute('material','opacity:0; transparent:true; side:double');
    hit.classList.add('hit','clickable');
    el.appendChild(hit);

    active.add(el);

    // อายุเป้า
    const ttlMult = (difficulty === 'easy') ? 1.7 : (difficulty === 'hard' ? 0.9 : 1.0);
    const ttl = Math.round(lifetimeMs * ttlMult * (1.05 + Math.random()*0.35));
    const killer = setTimeout(()=>{
      if (GOOD.includes(char)) { streak = 0; combo = 0; mq.junk(); missions.onJunk?.(); }
      cleanup();
    }, ttl);

    // wiring คลิก/แตะ/ทริกเกอร์
    const fire = (ev)=>{
      ev?.stopPropagation?.(); ev?.preventDefault?.();
      clearTimeout(killer);
      const pos = {x:slot.x, y:slot.y, z:slot.z};
      onHit({ el, char, pos });
      cleanup();
    };
    const bindAll = (node)=>{
      ['click','mousedown','touchstart','triggerdown'].forEach(evt=>{
        node.addEventListener(evt, fire, {passive:false});
      });
    };
    bindAll(hit); bindAll(el);

    host.appendChild(el);

    function cleanup(){
      try { el.remove(); } catch {}
      active.delete(el);
      releaseSlot(slots, slot);
    }
  }

  function scheduleSpawnLoop(){
    clearTimeout(spawnTicker);
    const tick = () => {
      if (running && active.size < MAX_ACTIVE && issuedThisSecond < BUDGET_PER_SEC) spawnOne();
      spawnTicker = setTimeout(tick, Math.max(220, spawnRateMs|0));
    };
    tick();
  }

  // prime 3 ชิ้นแรก
  function prime(){
    setTimeout(()=>spawnOne(), 120);
    setTimeout(()=>spawnOne(), 260);
    setTimeout(()=>spawnOne(), 400);
  }

  scheduleSpawnLoop();
  prime();
  console.log('[goodjunk] loop started', {spawnRateMs, lifetimeMs, sizeFactor, MAX_ACTIVE, BUDGET_PER_SEC});

  // ------- เมื่อโดน -------
  function onHit({ el, char, pos }){
    const isGood = GOOD.includes(char);

    if (isGood){
      const gain = fever.active ? 2 : 1;
      const plus = 10 * gain;
      missionGood += 1;
      score += plus;
      combo += 1; streak += 1;

      sfx.popGood?.();
      AdvancedFX.explode3D(host, pos, '#69f0ae');
      AdvancedFX.popupScore(host, {x:pos.x, y:pos.y+0.05, z:pos.z}, `+${plus}`);
      AdvancedFX.shakeRig();

      if (streak % 6 === 0) fever.add(8);

      mq.good({ score, combo, streak, missionGood });
      missions.onGood?.();
      missions.updateScore?.(score);
      missions.updateCombo?.(combo);

      if (missionGood >= goal) {
        mq.mission(missionGood);
        if (missionGood === goal){
          sfx.star?.();
          Particles.spark(host, {x:0, y:1.6, z:-1.4}, '#ffe066');
        }
      }
    } else {
      score = Math.max(0, score - 5);
      combo = 0; streak = 0;
      sfx.popBad?.();
      Particles.smoke(host, pos);
      mq.junk();
      missions.onJunk?.();
    }

    // อัปเดต HUD
    try { window.dispatchEvent(new CustomEvent('hha:score',{detail:{score,combo}})); } catch {}
  }

  // timers
  const secondTimer = setInterval(()=>{ if (running){ mq.second(); missions.second?.(); } }, 1000);
  const endTimer = setTimeout(()=> endGame('timeout'), duration * 1000);

  // fever hooks
  window.addEventListener('hha:fever', (e)=>{
    if (e?.detail?.state === 'start'){
      mq.fever(); missions.onFeverStart?.();
      spawnRateMs = Math.round(spawnRateMs * 0.85);
    } else if (e?.detail?.state === 'end'){
      const base = Number(baseCfg.rate) || 520;
      spawnRateMs = base;
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
    sfx.playCoach?.('clear');

    try { window.dispatchEvent(new CustomEvent('hha:end', { detail: { reason, score, missionGood, goal, totalSpawn } })); } catch {}
  }

  return {
    pause(){ if (!running) return; running = false; clearTimeout(spawnTicker); mq.pause?.(); },
    resume(){ if (running) return; running = true; scheduleSpawnLoop(); mq.resume?.(); },
    stop(){ endGame('stop'); }
  };
}
