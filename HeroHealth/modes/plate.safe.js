// === modes/plate.safe.js (Healthy Plate Mode, 2025-11-06) ===
// เป้าหมาย: จัด "จานสุขภาพ" ให้ได้สัดส่วนที่ถูกต้องภายในเวลาที่กำหนด
// สัดส่วนแนะนำ (รวม 20 ชิ้นต่อรอบ): ผัก 8, ผลไม้ 4, ธัญพืช 4, โปรตีน 4  (นม/นมเนย = โบนัส)
// รองรับ: Emoji สีจริง, Fever, MiniQuest, MissionDeck, SFX, Particles
// API: export async function boot({ host, duration=60, difficulty='normal', goal=20 })

import Difficulty        from '../vr/difficulty.js';
import Emoji             from '../vr/emoji-sprite.js';
import { Fever }         from '../vr/fever.js';
import MiniQuest         from '../vr/miniquest.js';
import { MissionDeck }   from '../vr/mission.js';
import { Particles }     from '../vr/particles.js';
import { SFX }           from '../vr/sfx.js';

const $ = s => document.querySelector(s);
const sample = arr => arr[Math.floor(Math.random()*arr.length)];
const clamp  = (n,a,b)=>Math.max(a,Math.min(b,n));

// ---------- ชุดอีโมจิ (20 ต่อกลุ่ม) ----------
const POOLS = {
  fruits: [
    '🍎','🍏','🍌','🍇','🍓','🍍','🍉','🍐','🍊','🫐',
    '🥝','🍋','🍒','🍈','🥭','🍑','🍅','🥥','🍊','🍇'
  ],
  veggies: [
    '🥦','🥕','🥬','🌽','🍆','🧄','🧅','🥒','🥔','🍄',
    '🌶️','🍠','🥑','🫑','🥗','🥦','🥬','🫛','🥦','🥕'
  ],
  protein: [
    '🐟','🥚','🥜','🍗','🥩','🍖','🧆','🍤','🦐','🦑',
    '🍢','🍣','🥓','🍳','🫘','🍛','🍱','🥪','🍙','🍗'
  ],
  grains: [
    '🍞','🍚','🥖','🥨','🍙','🍘','🥯','🥐','🥞','🧇',
    '🍜','🍝','🥟','🍙','🍚','🥨','🍛','🍡','🥮','🍞'
  ],
  dairy: [
    '🥛','🧀','🍦','🍨','🍧','🧈','🍮','🍰','🍼','🍶',
    '🍦','🍨','🍧','🥛','🧀','🍮','🍦','🍨','🍧','🥛'
  ],
  junk: [
    '🍔','🍟','🍕','🌭','🥓','🍩','🍪','🧁','🍰','🍫',
    '🍬','🍭','🥤','🧋','🍹','🍨','🍧','🍿','🥯','🍗'
  ]
};

// ---------- ผู้ช่วย ----------
function makeEmoji(char, {size=96, scale=0.55, glow=true, shadow=true} = {}){
  if (typeof Emoji?.fromChar === 'function') {
    return Emoji.fromChar(char, { size, scale, glow, shadow });
  }
  if (typeof Emoji?.create === 'function') {
    return Emoji.create({ type:'GOOD', size: scale });
  }
  const el = document.createElement('a-entity');
  el.setAttribute('text', { value: char, align: 'center', width: 2.2*scale, color: '#fff' });
  return el;
}
function setText(el, text){
  if (!el) return;
  try{
    if (el.hasAttribute('troika-text')) el.setAttribute('troika-text','value', text);
    else if (el.getAttribute('text')!=null) el.setAttribute('text',{value:text});
    else el.textContent = text;
  }catch{}
}
function makeHudLabel(host, y, key, title){
  const wrap = document.createElement('a-entity');
  wrap.setAttribute('position', `0 ${y} -1.55`);
  const t = document.createElement('a-entity');
  t.setAttribute('troika-text', `value:${title}; align:center; color:#fff; anchor:center; fontSize:0.07;`);
  wrap.appendChild(t);
  wrap.id = key;
  host.appendChild(wrap);
  return t;
}

// แผนสัดส่วนเป้าหมาย (รวม = goal)
function makeTargets(goal=20){
  // 1/2 ผัก+ผลไม้ (ผัก 40%, ผลไม้ 20%), 1/4 ธัญพืช, 1/4 โปรตีน
  const veg = Math.round(goal * 0.40);
  const fru = Math.round(goal * 0.20);
  const gra = Math.round(goal * 0.20);
  const pro = goal - (veg+fru+gra); // ส่วนที่เหลือ
  return { veggies: veg, fruits: fru, grains: gra, protein: pro };
}

// ---------- โหมดหลัก ----------
export async function boot({ host, duration=60, difficulty='normal', goal=20 } = {}){
  // Host
  if (!host){
    const wrap = $('a-scene') || document.body;
    const auto = document.createElement('a-entity');
    auto.id='spawnHost'; wrap.appendChild(auto); host = auto;
  }

  // Systems
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

  // Difficulty
  const diff = new Difficulty();
  const cfg = (diff?.config && diff.config[difficulty]) || diff?.config?.normal || { size:0.6, rate:520, life:2000 };
  let spawnRateMs = cfg.rate;
  let lifetimeMs  = cfg.life;
  let sizeFactor  = cfg.size;

  // เป้าหมายตามสัดส่วน
  const TARGET = makeTargets(goal);
  const count  = { veggies:0, fruits:0, grains:0, protein:0 };
  let dairyBonus = 0;

  // HUD (ถ้าไม่มี ให้สร้างป้ายสั้น ๆ)
  const hudV = $('#plateV') || makeHudLabel(host, 1.75, 'plateV', '');
  const hudF = $('#plateF') || makeHudLabel(host, 1.66, 'plateF', '');
  const hudG = $('#plateG') || makeHudLabel(host, 1.57, 'plateG', '');
  const hudP = $('#plateP') || makeHudLabel(host, 1.48, 'plateP', '');
  const hudTip = $('#plateTip') || makeHudLabel(host, 1.39, 'plateTip', '');
  setText(hudTip, 'จานสุขภาพ: เลือกให้ครบตามสัดส่วน (นม = โบนัส)');

  function refreshHud(){
    setText(hudV, `ผัก: ${count.veggies}/${TARGET.veggies}`);
    setText(hudF, `ผลไม้: ${count.fruits}/${TARGET.fruits}`);
    setText(hudG, `ธัญพืช: ${count.grains}/${TARGET.grains}`);
    setText(hudP, `โปรตีน: ${count.protein}/${TARGET.protein}`);
  }
  refreshHud();

  // State
  let running = true;
  let missionGood = 0;        // ชิ้นที่ใส่ลง "จาน" อย่างถูกต้อง (รวม 4 หมวดหลัก)
  let score = 0, combo=0, streak=0;

  // การตัดสิน "ถูกต้อง" = ยังไม่เกินโควตาของหมวดนั้น ๆ
  function canAccept(kind){
    if (!(kind in TARGET)) return false;
    return count[kind] < TARGET[kind];
  }
  function allFilled(){
    return Object.keys(TARGET).every(k => count[k] >= TARGET[k]);
  }

  // Spawn
  // สุ่มหมวด: เน้นที่ยังไม่ครบสัดส่วน มากกว่าหมวดที่เต็มแล้ว
  function pickSpawnKind(){
    const weights = [];
    for (const k of ['veggies','fruits','grains','protein']){
      const need = Math.max(0, TARGET[k] - count[k]);
      if (need>0) weights.push([k, 2 + need]); // ให้ค่าน้ำหนักสูงกว่าปกติ
      else weights.push([k, 0.5]);             // ยังพอสุ่มได้บ้างเป็นตัวหลอก
    }
    // ใส่ dairy (โบนัส) และ junk (ตัวล่อ)
    weights.push(['dairy', 1.2]);
    weights.push(['junk',  1.6]);

    const sum = weights.reduce((s,[,w])=>s+w,0);
    let r = Math.random() * sum;
    for (const [k,w] of weights){
      r -= w;
      if (r<=0) return k;
    }
    return 'veggies';
  }

  function spawnOne(){
    if (!running) return;
    const kind = pickSpawnKind();
    const pool = (kind==='junk') ? POOLS.junk : POOLS[kind];
    const char = sample(pool);

    const el = makeEmoji(char, { size: 96, scale: clamp(sizeFactor, 0.45, 0.9), glow: true, shadow: true });
    const px=(Math.random()*1.4-0.7);
    const py=(Math.random()*0.8+1.0);
    const pz=-(Math.random()*0.6+1.2);
    el.setAttribute('position', `${px} ${py} ${pz}`);

    const killer = setTimeout(()=>{
      // ถ้าของ "ที่ควรเก็บ" หายไปเองและยังไม่เต็มโควตา → ถือว่าพลาดนิดหน่อย
      if (kind!=='junk' && kind!=='dairy' && canAccept(kind)){
        combo = 0; streak = 0;
        mq.junk(); missions.onJunk();
      }
      el.remove();
    }, lifetimeMs);

    el.addEventListener('click', ()=>{
      clearTimeout(killer);
      onHit({ kind, pos:{x:px,y:py,z:pz} });
      el.remove();
    }, { once:true });

    host.appendChild(el);
  }

  function onHit({ kind, pos }){
    if (kind==='junk'){
      // ผิด: หักแต้ม เบรคคอมโบ/สตรีค
      score = Math.max(0, score-6);
      combo = 0; streak = 0;
      sfx.popBad(); Particles.smoke(host, pos);
      mq.junk(); missions.onJunk();
      return;
    }

    if (kind==='dairy'){
      // โบนัส: ช่วยเติม Fever/คะแนนเล็กน้อย
      dairyBonus++;
      score += 4;
      fever.add(10);
      sfx.star(); Particles.spark(host, {x:0,y:1.45,z:-1.4}, '#ffd95a');
      return;
    }

    // 4 หมวดหลัก
    if (canAccept(kind)){
      const gain = fever.active ? 2 : 1;
      count[kind]++; missionGood++; score += 10 * gain;
      combo++; streak++;

      sfx.popGood(); Particles.burst(host, pos, '#69f0ae');
      if (streak % 6 === 0) fever.add(8);

      mq.good({ score, combo, streak, missionGood });
      missions.onGood();
      missions.updateScore(score);
      missions.updateCombo(combo);

      refreshHud();

      if (allFilled()){
        // ผ่านภารกิจหลัก
        mq.mission(missionGood);
        sfx.playCoach('clear');
        Particles.spark(host, {x:0, y:1.5, z:-1.4}, '#a3ffac');
      }
    } else {
      // เกินโควตาหมวดนั้น → นับเป็นผิด (เพื่อสอนสัดส่วน)
      score = Math.max(0, score-3);
      combo = 0; streak = 0;
      sfx.popBad(); Particles.smoke(host, pos);
      mq.junk(); missions.onJunk();
    }
  }

  // Timers
  const spawnTimer  = setInterval(spawnOne, spawnRateMs);
  const secondTimer = setInterval(()=>{
    if (!running) return;
    mq.second(); missions.second();
  }, 1000);
  const endTimer    = setTimeout(()=>endGame('timeout'), duration*1000);

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
      filled: { ...count },
      target: { ...TARGET },
      dairyBonus,
      quests: mq.serialize?.().quests || [],
      missions: missions.summary()
    };
    try { window.dispatchEvent(new CustomEvent('hha:end', { detail })); } catch {}
  }

  // API
  return {
    pause(){
      if (!running) return;
      running=false;
      clearInterval(spawnTimer);
      mq.pause?.();
    },
    resume(){
      if (running) return;
      running=true;
      setInterval(spawnOne, spawnRateMs);
      mq.resume?.();
    },
    stop(){ endGame('stop'); }
  };
}
