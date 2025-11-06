// === modes/goodjunk.safe.js — Production (12 fixes/features) ===
import { Difficulty }   from '../vr/difficulty.js';
import { Emoji }        from '../vr/emoji-sprite.js';
import { Fever }        from '../vr/fever.js';
import { MiniQuest }    from '../vr/miniquest.js';
import { MissionDeck }  from '../vr/mission.js';
// ป้องกันกรณีไฟล์ particles.js ยังไม่มี AdvancedFX → import เป็น namespace แล้วทำ fallback
import * as FX          from '../vr/particles.js';
import { SFX }          from '../vr/sfx.js';

const Particles  = FX.Particles || FX; // รองรับทั้งกรณี export {Particles} และ export แบบ default object
const AdvancedFX = FX.AdvancedFX || {
  explode3D(host, pos, color='#69f0ae'){ try{ Particles.burst(host, pos, color); }catch{} },
  popupScore(host, pos, text='+10'){
    try{
      const t = document.createElement('a-entity');
      t.setAttribute('troika-text', `value: ${text}; color: #fff; fontSize: 0.08; anchor: center`);
      t.setAttribute('position', `${pos.x} ${pos.y} ${pos.z+0.01}`);
      host.appendChild(t);
      t.setAttribute('animation__rise', `property: position; to: ${pos.x} ${pos.y+0.25} ${pos.z+0.01}; dur: 500; easing: ease-out`);
      t.setAttribute('animation__fade', `property: opacity; to: 0; dur: 520; easing: linear`);
      setTimeout(()=>t.remove(), 560);
    }catch{}
  },
  shakeRig(){
    try{
      const rig = document.querySelector('#rig');
      if(!rig) return;
      rig.setAttribute('animation__shake1','property: position; to: 0 0 -0.02; dur: 40; dir: alternate; easing: ease-in-out');
      rig.setAttribute('animation__shake2','property: position; to: 0 0 0; dur: 40; delay: 40; easing: ease-in-out');
      setTimeout(()=>{ rig.removeAttribute('animation__shake1'); rig.removeAttribute('animation__shake2'); }, 120);
    }catch{}
  }
};

const $      = s => document.querySelector(s);
const sample = arr => arr[Math.floor(Math.random()*arr.length)];
const clamp  = (n,a,b)=>Math.max(a,Math.min(b,n));
const now    = ()=>performance.now();

// 1) กลุ่มละ 20 อย่าง
const GOOD = ['🍎','🍏','🍇','🍓','🍍','🍉','🍐','🍊','🫐','🥝','🍋','🍒','🍈','🥭','🍑','🥗','🐟','🥜','🍚','🍞'];
const JUNK = ['🍔','🍟','🍕','🌭','🍗','🥓','🍩','🍪','🧁','🍰','🍫','🍬','🍭','🥤','🧋','🍹','🍨','🍧','🍿','🥮'];

const TIME_BY_DIFF = { easy: 45, normal: 60, hard: 75 };
const MAX_ACTIVE_BY_DIFF   = { easy: 4,  normal: 6,  hard: 8 };
const SPAWN_BUDGET_PER_SEC = { easy: 4,  normal: 6,  hard: 8 };
const GOOD_RATE            = 0.70;
const GOLDEN_RATE          = 0.07; // 11) Golden item 7%

// --- Twemoji fallback (7) ---
const USE_EMOJI_SVG = (()=>{
  try{
    const u = new URL(location.href);
    const v = (u.searchParams.get('emoji')||'').toLowerCase();
    return v==='svg'; // เปิดด้วย ?emoji=svg
  }catch{return false;}
})();
function toCodePoints(str){
  const pts=[];
  for (const ch of str){ const cp = ch.codePointAt(0).toString(16); pts.push(cp); }
  return pts.join('-');
}
function twemojiURL(ch){ return `https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/${toCodePoints(ch)}.svg`; }

// สร้างอีโมจิ (รองรับ Twemoji เมื่อเปิดโหมด svg)
function makeEmojiNode(char, {scale=0.58}={}){
  if (!USE_EMOJI_SVG){
    if (typeof Emoji?.fromChar === 'function') return Emoji.fromChar(char, { size:96, scale, glow:true, shadow:true });
    if (typeof Emoji?.create   === 'function') {
      const type = GOOD.includes(char) ? 'GOOD' : (JUNK.includes(char) ? 'JUNK' : 'STAR');
      return Emoji.create({ type, size: scale });
    }
    const el=document.createElement('a-entity');
    el.setAttribute('text', { value: char, align:'center', width: 2.2*scale, color:'#fff' });
    return el;
  } else {
    const img=document.createElement('a-image');
    img.setAttribute('src', twemojiURL(char));
    img.setAttribute('width',  0.40*scale*2.0);
    img.setAttribute('height', 0.40*scale*2.0);
    return img;
  }
}

// ===== เป้าอยู่ “ล่าง-กลางจอ” (spawnHost @ y=0.40 → local yBase ~0.58–0.62) =====
function buildSlots(yBase = 0.60) {
  const xs = [-0.70,-0.42,-0.14, 0.14, 0.42, 0.70];
  const ys = [ yBase, yBase+0.15, yBase+0.30, yBase+0.45 ];
  const slots = [];
  for (const x of xs) for (const y of ys)
    slots.push({ x, y, z: -(1.20 + Math.random()*0.30), used:false });
  return slots;
}
function takeFreeSlot(slots){ const free = slots.filter(s=>!s.used); if(!free.length) return null; const s=free[Math.floor(Math.random()*free.length)]; s.used=true; return s; }
function releaseSlot(slots, slot){ if (slot) slot.used = false; }

export async function boot({ host, duration, difficulty='normal', goal=40 } = {}) {
  // host safety
  if (!host){
    const wrap = $('a-scene') || document.body;
    const auto = document.createElement('a-entity');
    auto.id = 'spawnHost';
    wrap.appendChild(auto);
    host = auto;
  }

  // ===== SFX =====
  const sfx = new SFX('../assets/audio/');
  if (sfx.unlock) await sfx.unlock?.();
  if (sfx.attachPageVisibilityAutoMute) sfx.attachPageVisibilityAutoMute?.();

  // 9) SFX control from UI
  window.addEventListener('hha:muteToggle', e=> sfx.mute?.(!!(e.detail?.muted)));
  window.addEventListener('hha:volChange',  e=> sfx.setVolume?.(Number(e.detail?.vol)||1));

  const scene = $('a-scene') || document.body;
  const fever = new Fever(scene, null, { durationMs: 10000 });  // 4) BGM เฉพาะ Fever (ใน SFX.feverStart/End)

  // Mini Quest (บนสุด, โชว์ทีละข้อ) 5)
  const mq = new MiniQuest(
    { tQmain: $('#tQmain') },
    { coach_start: $('#coach_start'), coach_good: $('#coach_good'),
      coach_warn: $('#coach_warn'), coach_fever: $('#coach_fever'),
      coach_quest: $('#coach_quest'), coach_clear: $('#coach_clear') }
  );
  mq.start(goal);

  const missions = new MissionDeck();
  missions.draw3?.();

  // เวลาเล่นตามระดับ (fallback ถ้าไม่ส่งมา)
  if (!duration || duration <= 0) duration = TIME_BY_DIFF[difficulty] || 60;
  $('#hudTime')?.setAttribute('troika-text','value', `เวลา: ${duration}s`);

  // difficulty config ปลอดภัย
  const diff = new Difficulty();
  const safeCfg = { size:0.60, rate:520, life:2000 };
  const baseCfg = (diff?.config?.[difficulty]) || (diff?.config?.normal) || safeCfg;
  let spawnRateMs = Number(baseCfg.rate) || safeCfg.rate;
  let lifetimeMs  = Number(baseCfg.life) || safeCfg.life;
  let sizeFactor  = Number(baseCfg.size) || safeCfg.size;

  // 1) Adaptive Hitbox by difficulty
  const baseHit = (difficulty==='easy'?0.56 : difficulty==='hard'?0.44 : 0.50);

  // state
  let running = true;
  let missionGood = 0;
  let score = 0;
  let combo = 0;
  let comboMax = 0;
  let streak = 0;
  let totalSpawn = 0;
  let lastGoodAt = now();
  let questsCleared = 0;

  const MAX_ACTIVE_INIT = MAX_ACTIVE_BY_DIFF[difficulty] ?? 6;
  let MAX_ACTIVE = MAX_ACTIVE_INIT;
  const BUDGET_PER_SEC = SPAWN_BUDGET_PER_SEC[difficulty] ?? 6;

  const active = new Set();
  const slots  = buildSlots(0.60);
  let issuedThisSecond = 0;
  let spawnTicker;
  const budgetTimer = setInterval(()=>{ issuedThisSecond = 0; }, 1000);

  // 3) Adaptive Density (FPS guard)
  let frames = 0, lastT = now();
  function rafTick(t){
    frames++;
    if (t - lastT >= 1000){
      const fps = frames; frames=0; lastT=t;
      if (fps < 40){ // เฟรมตก → ชะลอ spawn
        spawnRateMs = Math.min(spawnRateMs*1.15, 900);
        MAX_ACTIVE  = Math.max(3, Math.round(MAX_ACTIVE*0.9));
      } else if (fps > 55){ // ลื่น → กลับสู่อัตราพื้นฐาน
        spawnRateMs = Math.max(spawnRateMs*0.95, baseCfg.rate||520);
        MAX_ACTIVE  = Math.min(MAX_ACTIVE_INIT, MAX_ACTIVE+1);
      }
    }
    requestAnimationFrame(rafTick);
  }
  requestAnimationFrame(rafTick);

  // 2) Combo Decay (ทุก 2 วิ ถ้าไม่มีของดีโดน)
  const comboDecay = setInterval(()=>{
    if(!running) return;
    if (now() - lastGoodAt > 2000 && combo>0){
      combo--;
      try{ window.dispatchEvent(new CustomEvent('hha:score',{detail:{score,combo}})); }catch{}
    }
  }, 1000);

  // Pause/Resume (4)
  window.addEventListener('blur',   ()=>api?.pause?.());
  window.addEventListener('focus',  ()=>api?.resume?.());
  document.addEventListener('visibilitychange', ()=> document.hidden?api?.pause?.():api?.resume?.());

  function renderQuestSingle(){
    try{
      const list = mq.quests||[];
      const curI = list.findIndex(q=>!q._done);
      const cur  = curI>=0? list[curI] : list[list.length-1];
      const title = $('#tQTitle'), main = $('#tQmain');
      if(title) title.setAttribute('troika-text','value', `Mini Quest (${Math.min((curI>=0?curI:2)+1,3)}/3)`);
      if(main){
        const tgt = (cur?.type==='mission')?1:(cur?.target||0);
        const prog = (cur?.type==='mission')? (cur? (cur.prog||0):0) : Math.min(cur?.prog||0, tgt);
        main.setAttribute('troika-text','value', `${cur? (cur._done?'✅ ':'⬜ '):''}${cur?.label||''}${cur? (cur.type!=='mission'?` (${prog}/${tgt})`: ''): ''}`);
      }
      questsCleared = list.filter(q=>q._done).length;
    }catch{}
  }

  // ------- สร้างเป้า -------
  function spawnOne(){
    if (!running) return;
    if (active.size >= MAX_ACTIVE || issuedThisSecond >= BUDGET_PER_SEC) return;

    const slot = takeFreeSlot(slots);
    if (!slot) return;

    issuedThisSecond++; totalSpawn++;

    const isGood = Math.random() < GOOD_RATE;
    let char = isGood ? sample(GOOD) : sample(JUNK);

    // 11) Golden item (เฉพาะของดี)
    const isGold = isGood && Math.random() < GOLDEN_RATE;

    const el = makeEmojiNode(char, { scale: clamp(sizeFactor, 0.50, 0.85) });
    el.setAttribute('position', `${slot.x} ${slot.y} ${slot.z}`);
    el.classList.add('hit','clickable');

    if (isGold){
      el.setAttribute('scale','1.12 1.12 1.12');
      // ฮาโลทองเล็ก ๆ
      const halo = document.createElement('a-ring');
      halo.setAttribute('radius-inner','0.18'); halo.setAttribute('radius-outer','0.22');
      halo.setAttribute('position','0 0 0.001'); halo.setAttribute('material','color:#ffe066; opacity:0.85; shader:flat');
      el.appendChild(halo);
    }

    // Hitbox ใหญ่ขึ้น/เล็กลงตามระดับ (1)
    const hit = document.createElement('a-plane');
    hit.setAttribute('width',  baseHit);
    hit.setAttribute('height', baseHit);
    hit.setAttribute('material','opacity:0; transparent:true; side:double');
    hit.classList.add('hit','clickable');
    el.appendChild(hit);

    active.add(el);

    // อายุเป้า (+เมตตา ถ้าเหลือเป้าเดียว) (10)
    const ttlMult = (difficulty === 'easy') ? 1.75 : (difficulty === 'hard' ? 0.95 : 1.10);
    let ttl = Math.round(lifetimeMs * ttlMult * (1.05 + Math.random()*0.35));
    if (active.size<=1) ttl = Math.max(ttl, 2300);

    let consumed=false;
    const killer = setTimeout(()=>{ // หมดอายุ = ถือว่า miss ของดี
      if (GOOD.includes(char)) { streak = 0; combo = 0; mq.junk(); missions.onJunk?.(); }
      cleanup();
    }, ttl);

    const fire = (ev)=>{
      if(consumed) return;
      consumed=true;
      try{ ev?.stopPropagation?.(); ev?.preventDefault?.(); }catch{}
      clearTimeout(killer);
      const pos = {x:slot.x, y:slot.y, z:slot.z};
      onHit({ el, char, pos, isGold });
      cleanup();
    };
    ['click','mousedown','touchstart','triggerdown'].forEach(evt=>{
      try{ hit.addEventListener(evt, fire, {passive:false}); }catch{}
      try{ el.addEventListener(evt, fire, {passive:false}); }catch{}
    });

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

  // Prime 3 ชิ้นแรก
  function prime(){
    setTimeout(()=>spawnOne(), 120);
    setTimeout(()=>spawnOne(), 260);
    setTimeout(()=>spawnOne(), 400);
  }

  scheduleSpawnLoop();
  prime();
  console.log('[goodjunk] loop started', {spawnRateMs, lifetimeMs, sizeFactor, MAX_ACTIVE, BUDGET_PER_SEC}); // 12) telemetry

  // ------- เมื่อโดน -------
  function onHit({ el, char, pos, isGold=false }){
    const isGood = GOOD.includes(char);

    if (isGood){
      const gain = (fever.active?2:1) * (isGold?2:1);
      const plus = 10 * gain;
      missionGood += 1;
      score += plus;
      combo += 1; streak += 1;
      comboMax = Math.max(comboMax, combo);
      lastGoodAt = now();

      sfx.popGood?.();
      AdvancedFX.explode3D(host, pos, isGold?'#ffe066':'#69f0ae');
      AdvancedFX.popupScore(host, {x:pos.x, y:pos.y+0.05, z:pos.z}, `+${plus}${isGold?' ⭐':''}`);
      AdvancedFX.shakeRig();

      if (streak % 6 === 0){
        try{ fever.add(8); }catch{}
        try{ window.dispatchEvent(new CustomEvent('hha:feverLevel',{detail:{level: clamp((streak%100)*4,0,100)}})); }catch{}
      }

      mq.good({ score, combo, streak, missionGood });
      missions.onGood?.();
      missions.updateScore?.(score);
      missions.updateCombo?.(combo);

      // เคลียร์เควส → Cheer สั้น ๆ (5)
      renderQuestSingle();
      try{
        const allDone = (mq.quests||[]).length && (mq.quests||[]).every(q=>q._done);
        if (allDone){ AdvancedFX.popupScore(host,{x:0,y:1.55,z:-1.4},'Quest Clear!'); sfx.playCoach?.('clear'); }
      }catch{}

      if (missionGood >= goal) {
        mq.mission(missionGood);
        if (missionGood === goal){
          try{ sfx.star?.(); }catch{}
          try{ Particles.spark(host, {x:0, y:1.6, z:-1.4}, '#ffe066'); }catch{}
        }
      }
    } else {
      score = Math.max(0, score - 5);
      combo = 0; streak = 0;
      try{ sfx.popBad?.(); }catch{}
      try{ Particles.smoke(host, pos); }catch{}
      mq.junk();
      missions.onJunk?.();
      renderQuestSingle();
    }

    // อัปเดต HUD
    try { window.dispatchEvent(new CustomEvent('hha:score',{detail:{score,combo}})); } catch {}
  }

  // timers
  const secondTimer = setInterval(()=>{ if (running){ mq.second(); missions.second?.(); renderQuestSingle(); } }, 1000);
  const endTimer    = setTimeout(()=> endGame('timeout'), duration * 1000);

  // fever hooks (3, BGM only in Fever)
  window.addEventListener('hha:fever', (e)=>{
    if (e?.detail?.state === 'start'){
      try{ mq.fever(); missions.onFeverStart?.(); }catch{}
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
    clearInterval(comboDecay);
    clearTimeout(endTimer);

    try{ fever.end(); }catch{}
    try{ sfx.playCoach?.('clear'); }catch{}

    // 6) ส่งผลสรุปครบถ้วน
    const list = mq.quests||[];
    questsCleared = list.filter(q=>q._done).length;
    try { window.dispatchEvent(new CustomEvent('hha:end', { detail: { reason, score, missionGood, goal, totalSpawn, comboMax, questsCleared } })); } catch {}
  }

  const api = {
    pause(){ if (!running) return; running = false; clearTimeout(spawnTicker); },
    resume(){ if (running) return; running = true; scheduleSpawnLoop(); },
    stop(){ endGame('stop'); }
  };
  return api;
}
