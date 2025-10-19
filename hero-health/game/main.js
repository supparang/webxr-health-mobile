// game/main.js — HERO HEALTH ACADEMY
// รวมครบ: 4 โหมด, Help รายโหมด, Hydration Meter + โทษน้ำมาก/น้อย, โทษเกินโควตาใน Plate,
// Difficulty Easy/Normal/Hard, Floating Score, Power/Trap, Mission/Leaderboard, Result Modal

import { Engine } from './core/engine.js';
import { HUD } from './ui/hud.js';
import { Coach } from './ui/coach.js';
import { bindLanding } from './ui/landing.js';
import { FloatingFX } from './fx/floating.js';
import { ScoreSystem } from './systems/score.js';
import { FeverSystem } from './systems/fever.js';
import { PowerUpSystem } from './systems/powerups.js';
import { MissionSystem } from './systems/missions.js';
import { Leaderboard } from './systems/leaderboard.js';

// โหมดเกม
import * as M1 from './modes/goodjunk.js';
import * as M2 from './modes/groups.js';
import * as M3 from './modes/hydration.js';
import * as M4 from './modes/plate.js';

// ---------- Boot ----------
const canvas = document.getElementById('c');
const engine = new Engine(THREE, canvas);
const hud = new HUD();
const floating = new FloatingFX(engine);
const coach = new Coach();

const sfx = {
  ding(){ const el=document.getElementById('sfx-ding'); try{ el.currentTime=0; el.play(); }catch{} },
  thud(){ const el=document.getElementById('sfx-thud'); try{ el.currentTime=0; el.play(); }catch{} },
  tick(){ const el=document.getElementById('sfx-tick'); try{ el.currentTime=0; el.play(); }catch{} },
  fever(){ const el=document.getElementById('sfx-fever'); try{ el.currentTime=0; el.play(); }catch{} },
  perfect(){ const el=document.getElementById('sfx-perfect'); try{ el.currentTime=0; el.play(); }catch{} },
};

// ---------- Systems ----------
const systems = {
  score: new ScoreSystem(),
  fever: new FeverSystem(),
  power: new PowerUpSystem(),
  mission: new MissionSystem(),
  board: new Leaderboard(),
  fx: sfx
};

const MODES = { goodjunk:M1, groups:M2, hydration:M3, plate:M4 };

// ---------- Difficulty presets ----------
const DIFFS = {
  Easy:   { time:70, spawnBase:820, life:4200, trapRate:0.03, powerRate:0.10, hydWaterRate:0.78 },
  Normal: { time:60, spawnBase:700, life:3000, trapRate:0.05, powerRate:0.08, hydWaterRate:0.66 },
  Hard:   { time:50, spawnBase:560, life:1900, trapRate:0.07, powerRate:0.06, hydWaterRate:0.55 },
};

// ---------- State ----------
const state = {
  modeKey:'goodjunk',
  difficulty:'Normal',
  diffCfg: DIFFS['Normal'],
  running:false, paused:false,
  timeLeft:60,
  ACTIVE:new Set(),
  lane:{},
  ctx:{goodHits:0, targetHitsTotal:0, bestStreak:0, currentStreak:0, waterHits:0, sweetMiss:0, perfectPlates:0, plateFills:0},
  __plateLast:null // flag สำหรับผลลัพธ์จาก plate (เกินโควตา)
};

// ---------- วิธีเล่นรายโหมด ----------
const HELP = {
  goodjunk: `
    <h3>🥗 ดี vs ขยะ (Healthy vs Junk)</h3>
    <ul>
      <li>เก็บ <b>อาหารดี</b> เช่น 🥦🍎 (+5)</li>
      <li>อย่าเก็บ <b>ขยะ</b> เช่น 🍟🍔 (−2)</li>
      <li>ปล่อยขยะไหลผ่านเองได้ (+1)</li>
      <li>Power-ups: ⭐Boost, ⏳Slow, 🛡️Shield, ⏱±Time</li>
      <li>Traps: 💣 ระเบิด (−6), 🎭 ตัวล่อ (−4)</li>
      <li>คอมโบ + FEVER ช่วยคูณคะแนน 🔥</li>
    </ul>
  `,
  groups: `
    <h3>🍽️ จาน 5 หมู่ (Food Groups)</h3>
    <ul>
      <li>เก็บเฉพาะ <b>หมวดเป้าหมาย 🎯</b> บน HUD</li>
      <li>ถูกหมวด +7 | ผิดหมวด −2 | ครบ 3 ชิ้น → เปลี่ยนเป้าหมาย</li>
    </ul>
  `,
  hydration: `
    <h3>💧 สมดุลน้ำ (Hydration)</h3>
    <ul>
      <li>ดูมิเตอร์ 💧: โซน <b>พอดี 45–65%</b> ดีที่สุด</li>
      <li>น้ำ 💧/🚰 เพิ่มเปอร์เซ็นต์ (ได้คะแนนมากสุดเมื่ออยู่โซนพอดี)</li>
      <li>หวาน 🧋 ลดเปอร์เซ็นต์ (−3)</li>
      <li><b>ถ้าอยู่โซน “มากไป” แล้วเก็บน้ำ</b> → โทษพิเศษ</li>
      <li><b>ถ้าอยู่โซน “น้อยไป” แล้วเก็บหวาน</b> → โทษพิเศษ</li>
    </ul>
  `,
  plate: `
    <h3>🍱 จัดจานสุขภาพ (Healthy Plate)</h3>
    <ul>
      <li>เติมโควตาใน HUD: ธัญพืช ผัก โปรตีน ผลไม้ นม</li>
      <li>ของที่ยังขาด +6 | ครบจาน = PERFECT! +14</li>
      <li><b>ถ้าเกินโควตา</b> → โทษ: −2 คะแนน / −1s และคอมโบแตก</li>
    </ul>
  `
};

function openHelpFor(modeKey){
  const key = modeKey || state.modeKey;
  const html = HELP[key] || '<p>เลือกโหมดเพื่อดูวิธีเล่น</p>';
  document.getElementById('helpBody').innerHTML = html;
  document.getElementById('help').style.display = 'flex';
}

// ---------- Lanes ----------
function setupLanes(){
  const X=[-1.1,-0.55,0,0.55,1.1], Y=[-0.2,0.0,0.18,0.32], Z=-2.2;
  state.lane={X,Y,Z, occupied:new Set(), cooldown:new Map(), last:null};
}
function now(){ return performance.now(); }
function isAdj(r,c){ const last=state.lane.last; if(!last) return false; const [pr,pc]=last; return Math.abs(pr-r)<=1 && Math.abs(pc-c)<=1; }
function pickLane(){
  const {X,Y,Z,occupied,cooldown}=state.lane;
  const cand=[]; for(let r=0;r<Y.length;r++){ for(let c=0;c<X.length;c++){
    const k=r+','+c,cd=cooldown.get(k)||0,free=!occupied.has(k)&&now()>cd&&!isAdj(r,c);
    if(free) cand.push({r,c,k});
  } }
  if(!cand.length) return null;
  const p=cand[Math.floor(Math.random()*cand.length)];
  occupied.add(p.k); state.lane.last=[p.r,p.c];
  return {x:X[p.c], y:1.6+Y[p.r], z:Z-0.1*Math.abs(p.c-2), key:p.k};
}
function releaseLane(k){ const {occupied,cooldown}=state.lane; occupied.delete(k); cooldown.set(k, now()+800); }

// ---------- Items & Specials ----------
const POWER_ITEMS = [
  {type:'power', kind:'slow', char:'⏳'},
  {type:'power', kind:'boost', char:'⭐'},
  {type:'power', kind:'shield', char:'🛡️'},
  {type:'power', kind:'timeplus', char:'⏱️➕'},
  {type:'power', kind:'timeminus', char:'⏱️➖'}
];
const TRAP_ITEMS = [
  {type:'trap', kind:'bomb', char:'💣'},
  {type:'trap', kind:'bait', char:'🎭'}
];

function maybeSpecialMeta(baseMeta){
  const roll=Math.random();
  const {trapRate, powerRate} = state.diffCfg || DIFFS['Normal'];
  if(roll < powerRate) return POWER_ITEMS[Math.floor(Math.random()*POWER_ITEMS.length)];
  if(roll < powerRate + trapRate) return TRAP_ITEMS[Math.floor(Math.random()*TRAP_ITEMS.length)];
  return baseMeta;
}

// ---------- Spawn ----------
function spawnOnce(){
  const lane=pickLane(); if(!lane) return;

  // meta จากโหมด
  let meta = MODES[state.modeKey].pickMeta(state.difficulty, state);

  // Hydration: bias น้ำตามความยาก
  if(state.modeKey==='hydration'){
    const rate = (state.diffCfg && state.diffCfg.hydWaterRate) || 0.66;
    const water = Math.random() < rate;
    meta = { type:'hydra', water, char: water ? '💧' : '🧋' };
  }

  // แทรก Power/Trap
  meta = maybeSpecialMeta(meta);

  // สร้างอ็อบเจกต์
  const m = engine.makeBillboard(meta.char);
  m.position.set(lane.x,lane.y,lane.z);
  m.userData={lane:lane.key, meta};
  engine.group.add(m); state.ACTIVE.add(m);

  // อายุไอคอนตามความยาก
  const life = (state.diffCfg && state.diffCfg.life) || 3000;
  m.userData.timer = setTimeout(()=>{ if(!m.parent) return;
    if(meta.type==='gj' && meta.good===false){ systems.score.add(1); }
    if(meta.type==='groups' && state.currentTarget && meta.group===state.currentTarget){ systems.score.bad(); }
    if(meta.type==='hydra' && meta.water===false){ systems.score.add(1); state.ctx.sweetMiss++; }
    updateHUD(); destroy(m);
  }, life + Math.floor(Math.random()*500-250));
}

function destroy(obj){ if(obj.parent) obj.parent.remove(obj); state.ACTIVE.delete(obj); releaseLane(obj.userData.lane); }

// ---------- Hit ----------
function hit(obj){
  const meta=obj.userData.meta;

  // ทำให้คะแนนคูณด้วย Fever/Boost ชั่วคราว
  const baseAdd = systems.score.add.bind(systems.score);
  systems.score.add = (base)=> baseAdd(base * systems.fever.scoreMul() * (1+systems.power.scoreBoost));

  // ผลตามโหมด
  MODES[state.modeKey].onHit(meta, systems, state, hud);

  // ===== โทษพิเศษ Hydration =====
  // A) อยู่ "มากไป" แล้วเก็บน้ำ → โทษ −4 และ −3s
  if(
    state.modeKey==='hydration' &&
    meta.type==='hydra' && meta.water===true &&
    (state.hydMax ?? 65) !== undefined &&
    state.hyd > (state.hydMax ?? 65)
  ){
    systems.score.add(-4);
    systems.score.bad();
    state.timeLeft = Math.max(0, state.timeLeft - 3);
    systems.fx.thud();
    floating.spawn3D(obj, '<b>Over-hydration! −4 / −3s</b>', 'bad');
    state.ctx.currentStreak = 0;
  }

  // B) อยู่ "น้อยไป" แล้วเก็บหวาน → โทษ −2 และ −2s (คอมโบไม่หัก)
  if(
    state.modeKey==='hydration' &&
    meta.type==='hydra' && meta.water===false
  ){
    const min = (state.hydMin ?? 45);
    if (state.hyd < min){
      systems.score.add(-2);
      state.timeLeft = Math.max(0, state.timeLeft - 2);
      systems.fx.thud();
      floating.spawn3D(obj, '<b>Dehydrated! −2 / −2s</b>', 'bad');
    }
  }

  // ===== Power-ups & Traps =====
  if(meta.type==='power'){
    if(meta.kind==='slow'){ systems.power.apply('slow'); systems.fx.tick(); }
    if(meta.kind==='boost'){ systems.power.apply('boost'); systems.fx.ding(); }
    if(meta.kind==='shield'){ systems.power.apply('shield'); systems.fx.ding(); }
    if(meta.kind==='timeplus'){ state.timeLeft = Math.min(120, state.timeLeft+5); systems.fx.ding(); }
    if(meta.kind==='timeminus'){ state.timeLeft = Math.max(0, state.timeLeft-5); systems.fx.thud(); }
  } else if(meta.type==='trap'){
    if(meta.kind==='bomb'){ if(!systems.power.consumeShield()){ systems.score.add(-6); systems.score.bad(); systems.fever.onBad(); systems.fx.thud(); state.ctx.currentStreak=0; } }
    if(meta.kind==='bait'){ if(!systems.power.consumeShield()){ systems.score.add(-4); systems.score.bad(); systems.fever.onBad(); systems.fx.thud(); state.ctx.currentStreak=0; } }
  }

  // ===== Floating feedback ปกติ =====
  const mult = systems.fever.scoreMul() * (1+systems.power.scoreBoost);
  const fmt = (v)=>`<b>${v>0?'+':''}${Math.round(v)}</b>`;
  let kind='good', txt='';
  if(meta.type==='gj'){ txt = meta.good? fmt(5*mult) : fmt(-2); kind = meta.good?'good':'bad'; }
  else if(meta.type==='groups'){ const ok=(state.currentTarget && meta.group===state.currentTarget); txt = ok? fmt(7*mult): fmt(-2); kind= ok?'good':'bad'; }
  else if(meta.type==='hydra'){ txt = meta.water? fmt(5*mult): fmt(-3); kind = meta.water?'good':'bad'; }
  else if(meta.type==='plate'){
    // รองรับโทษ "เกินโควตา" (ตั้ง flag จาก plate.js)
    const over = state.__plateLast && state.__plateLast.overfill;
    if(over){
      const d = state.__plateLast.delta || -2;
      txt = `<b>${d}</b>`; kind='bad';
    }else{
      txt = fmt(6*mult); kind='good';
    }
    state.__plateLast = null;
  }
  else if(meta.type==='power'){ txt = meta.kind==='timeplus'? '<b>+5s</b>' : meta.kind==='timeminus'? '<b>-5s</b>' : meta.kind.toUpperCase(); kind = meta.kind==='timeminus'?'bad':'good'; }
  else if(meta.type==='trap'){ txt = meta.kind==='bomb'? fmt(-6):fmt(-4); kind='bad'; }

  floating.spawn3D(obj, txt, kind);

  if(systems.score.combo===3||systems.score.combo===5) coach.onCombo(systems.score.combo);
  if(systems.fever.active){ systems.fx.fever(); coach.onFever(); }

  // คืนฟังก์ชันคะแนน
  systems.score.add = baseAdd;
  updateHUD();

  // ทำลายอ็อบเจกต์ที่โดน
  destroy(obj);
}

// ---------- Input ----------
function onClick(ev){
  if(!state.running || state.paused) return;
  const inter = engine.raycastFromClient(ev.clientX, ev.clientY);
  if(inter.length){ const o=inter[0].object; hit(o); }
}

// ---------- HUD / Timer / Loop ----------
function updateHUD(){
  hud.setScore(systems.score.score);
  hud.setCombo(systems.score.combo);
  hud.setTime(state.timeLeft);
  hud.setDiff(state.difficulty);
  hud.setMode(MODES[state.modeKey].name || state.modeKey);
  hud.fever(systems.fever.active);
}

// Result modal helpers
function buildBreakdownAndTips(){
  const m = state.modeKey;
  const c = state.ctx;
  let html='', tip='';

  if(m==='goodjunk'){
    html = `
      <ul>
        <li>ของดีที่เก็บ: <b>${c.goodHits}</b></li>
        <li>สตรีคดีที่สุด: <b>${c.bestStreak}</b></li>
      </ul>`;
    tip = 'โฟกัสไอเท็มดีต่อเนื่องเพื่อดันคอมโบและเข้า FEVER เร็วขึ้น';
  }
  else if(m==='groups'){
    html = `
      <ul>
        <li>เก็บตรงหมวดเป้าหมาย: <b>${c.targetHitsTotal}</b></li>
        <li>สตรีคดีที่สุด: <b>${c.bestStreak}</b></li>
      </ul>`;
    tip = 'มอง HUD 🎯 ตลอด เปลี่ยนเลนล่วงหน้าให้เข้าแถวเป้า';
  }
  else if(m==='hydration'){
    const hydNow = Math.round(state.hyd ?? 0);
    html = `
      <ul>
        <li>เก็บน้ำ: <b>${c.waterHits}</b></li>
        <li>พลาดเครื่องดื่มหวาน: <b>${c.sweetMiss}</b></li>
        <li>สถานะมิเตอร์สุดท้าย: <b>${hydNow}%</b></li>
      </ul>`;
    tip = 'รักษา 💧 ไว้ช่วง 45–65% ถ้าเกิน/ขาด อย่าเก็บผิดฝั่งจะโดนโทษ';
  }
  else if(m==='plate'){
    html = `
      <ul>
        <li>เติมชิ้นในจาน: <b>${c.plateFills}</b></li>
        <li>จาน PERFECT: <b>${c.perfectPlates||0}</b></li>
      </ul>`;
    tip = 'สังเกตโควตาใน HUD ให้ครบทีละหมู่ หลีกเลี่ยงเกินโควตา (มีโทษ)';
  }

  return { html, tip };
}
function presentResult(finalScore){
  const res = document.getElementById('result');
  document.getElementById('resTitle').textContent = 'สรุปผลการเล่น';
  document.getElementById('resScore').textContent = finalScore;
  document.getElementById('resTime').textContent = Math.max(0, state.timeLeft|0);
  document.getElementById('resMode').textContent = (MODES[state.modeKey].name || state.modeKey);
  const {html, tip} = buildBreakdownAndTips();
  document.getElementById('resBreakdown').innerHTML = html;
  document.getElementById('resTips').textContent = 'Tips: ' + tip;
  res.style.display = 'flex';
}

let spawnTimer=null, timeTimer=null, spawnCount=0, lastTs=performance.now();
function loop(){
  const ts=performance.now(); const dt=ts-lastTs; lastTs=ts;
  systems.fever.update(dt);
  systems.power.tick(dt);

  // Hydration: decay + HUD update (เฉพาะโหมดน้ำ)
  if(state.running && state.modeKey==='hydration'){
    // ลดตามเวลาเล็กน้อย
    state.hyd = Math.max(0, Math.min(100, state.hyd - 0.0003 * dt * (systems.power.timeScale||1)));

    // tick ~1s สำหรับ HUD/รางวัลเมื่อพอดี
    if(!loop._hydTick) loop._hydTick=0;
    loop._hydTick += dt;

    const min = (state.hydMin ?? 45), max = (state.hydMax ?? 65);
    const z = state.hyd < min ? 'low' : (state.hyd > max ? 'high' : 'ok');

    // สะสมเวลาอยู่ในโซนต่ำ เพื่อเตือนเป็นพัก ๆ
    if(!loop._lowAccum) loop._lowAccum = 0;
    if(z==='low'){ loop._lowAccum += dt; } else { loop._lowAccum = 0; }

    if(loop._hydTick > 1000){
      loop._hydTick = 0;
      if(z==='ok'){ systems.score.add(1); } // รางวัลเล็กน้อยเมื่อรักษาพอดี
      hud.setHydration(state.hyd, z);
    }

    // ต่ำต่อเนื่อง ≥4s → โทษเบา ๆ + เตือนโค้ช
    if(loop._lowAccum >= 4000){
      loop._lowAccum = 0;
      systems.score.add(-1);
      state.timeLeft = Math.max(0, state.timeLeft - 1);
      systems.fx.thud();
      try{ coach.say('น้ำน้อยไป ดื่มเพิ่มอีกหน่อย!'); }catch{}
    }
  }

  updateHUD();
}

function runSpawn(){
  if(!state.running || state.paused) return;
  spawnOnce(); spawnCount++;
  const base = (state.diffCfg && state.diffCfg.spawnBase) || 700;
  const accel=Math.max(0.5,1-(spawnCount/120));
  const feverBoost = systems.fever.active ? 0.82 : 1.0;
  const next=Math.max(280, base*accel*feverBoost*systems.power.timeScale);
  spawnTimer=setTimeout(runSpawn, next);
}
function runTimer(){
  if(!state.running || state.paused) return;
  timeTimer=setTimeout(()=>{
    state.timeLeft--;
    if(state.timeLeft<=0){ end(); }
    else runTimer();
    updateHUD();
  }, 1000);
}

// ---------- Game State ----------
function start(){
  document.getElementById('help').style.display='none';

  // ตั้งคอนฟิกความยาก
  state.diffCfg = DIFFS[state.difficulty] || DIFFS['Normal'];

  state.running=true; state.paused=false;
  state.timeLeft = state.diffCfg.time;
  spawnCount=0; systems.score.reset(); setupLanes();
  state.ctx={goodHits:0, targetHitsTotal:0, bestStreak:0, currentStreak:0, waterHits:0, sweetMiss:0, perfectPlates:0, plateFills:0};
  state.__plateLast=null;

  systems.mission.roll(state.modeKey);
  const M = MODES[state.modeKey]; if(M.init) M.init(state, hud, state.difficulty);

  if(state.modeKey!=='hydration'){ hud.hideHydration?.(); }
  if(state.modeKey!=='groups') hud.hideTarget();
  if(state.modeKey!=='plate') hud.hidePills();

  updateHUD(); setTimeout(spawnOnce,200); runSpawn(); runTimer();
  canvas.style.pointerEvents='auto';
}
function pause(){ if(!state.running) return; state.paused=!state.paused; if(!state.paused){ runSpawn(); runTimer(); } }
function end(){
  state.running=false; state.paused=false;
  clearTimeout(spawnTimer); clearTimeout(timeTimer);
  canvas.style.pointerEvents='none';

  const bonus = systems.mission.evaluate({...state.ctx, combo: systems.score.combo});
  if(bonus>0){ systems.score.score += bonus; }
  systems.board.submit(state.modeKey, state.difficulty, systems.score.score);
  coach.onEnd(); systems.fx.perfect();

  // แสดงหน้าสรุปผล
  presentResult(systems.score.score);
}

// ---------- Landing & Menu ----------
bindLanding(()=>{
  coach.onStart();
  openHelpFor(state.modeKey); // ปิด Landing แล้วแสดงวิธีเล่นของโหมดปัจจุบัน
  // รอผู้เล่นกด ▶ เริ่มเกม จากเมนู
}, coach);

document.getElementById('menuBar').addEventListener('click', (e)=>{
  const btn=e.target.closest('button'); if(!btn) return;
  const act=btn.getAttribute('data-action'); const val=btn.getAttribute('data-value'); e.preventDefault(); e.stopPropagation();

  if(act==='diff'){
    state.difficulty = val;
    state.diffCfg = DIFFS[state.difficulty] || DIFFS['Normal'];  // มีผลกับสปอน/ไอคอนถัดไปทันที
    hud.setDiff(state.difficulty);
    return;
  }

  if(act==='start') start();
  else if(act==='pause') pause();
  else if(act==='restart'){ end(); start(); }
  else if(act==='help'){ openHelpFor(state.modeKey); }
  else if(act==='mode'){
    state.modeKey=val;
    if(val!=='plate') document.getElementById('plateTracker').style.display='none';
    if(val!=='groups') document.getElementById('targetWrap').style.display='none';
    if(val!=='hydration'){ hud.hideHydration?.(); }
    updateHUD();
  }
}, false);

// Help close
document.getElementById('help').addEventListener('click',(e)=>{
  if(e.target.getAttribute('data-action')==='helpClose' || e.target.id==='help') e.currentTarget.style.display='none';
});

// Result modal actions
document.getElementById('result').addEventListener('click',(e)=>{
  const b = e.target.closest('button'); if(!b) return;
  const act = b.getAttribute('data-result');
  if(act==='replay'){ document.getElementById('result').style.display='none'; start(); }
  if(act==='home'){ document.getElementById('result').style.display='none'; /* กลับเมนู */ }
});

// ---------- Input ----------
canvas.addEventListener('click', onClick);
canvas.addEventListener('touchstart',(e)=>{ if(e.touches&&e.touches[0]) onClick({clientX:e.touches[0].clientX, clientY:e.touches[0].clientY}); }, {passive:true});

// ---------- Render Loop ----------
engine.startLoop(loop);

// ---------- Error Box ----------
window.onerror=(msg,src,line,col)=>{
  const mk=()=>{ const d=document.createElement('div'); d.id='errors'; d.style.cssText='position:fixed;top:8px;right:8px;background:rgba(30,0,0,.85);color:#ffb;border:1px solid #f66;padding:6px 10px;border-radius:8px;z-index:9'; document.body.appendChild(d); return d; };
  (document.getElementById('errors')||mk()).textContent='Errors: '+msg+' @'+(src||'inline')+':'+line+':'+col;
  (document.getElementById('errors')||mk()).style.display='block';
};
