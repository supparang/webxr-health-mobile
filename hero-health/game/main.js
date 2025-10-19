// ============================================================
// game/main.js — HERO HEALTH ACADEMY (FULL VERSION)
// รวมแล้ว: 4 โหมด + สลับภาษา TH/EN + ปิดเสียง + กราฟิก + Hydration + Plate Penalty
// ============================================================

// ===== Imports =====
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

import * as M1 from './modes/goodjunk.js';
import * as M2 from './modes/groups.js';
import * as M3 from './modes/hydration.js';
import * as M4 from './modes/plate.js';

// ===== SETTINGS =====
const SETTINGS = {
  lang: 'TH',          // TH | EN
  sound: true,         // เปิดเสียง?
  quality: 'High'      // High | Medium | Low
};

// ===== ภาษา (I18N) =====
const I18N = {
  TH: {
    brand: "HERO HEALTH ACADEMY",
    modes:{goodjunk:"🥗 ดี vs ขยะ",groups:"🍽️ จาน 5 หมู่",hydration:"💧 สมดุลน้ำ",plate:"🍱 จัดจานสุขภาพ"},
    diff:{Easy:"ง่าย",Normal:"ปกติ",Hard:"ยาก"},
    hud:{score:"คะแนน",combo:"คอมโบ",time:"เวลา",best:"สถิติ"},
    helpTitle:"วิธีเล่น (How to Play)",
    buttons:{start:"▶ เริ่มเกม",pause:"⏸ พัก",restart:"↻ เริ่มใหม่",help:"❓ วิธีเล่น"},
    result:{title:"สรุปผล",mode:"โหมด",difficulty:"ความยาก",timeLeft:"เวลาเหลือ",combo:"คอมโบสูงสุด",tips:"เคล็ดลับ"}
  },
  EN: {
    brand: "HERO HEALTH ACADEMY",
    modes:{goodjunk:"🥗 Healthy vs Junk",groups:"🍽️ Food Groups",hydration:"💧 Hydration",plate:"🍱 Healthy Plate"},
    diff:{Easy:"Easy",Normal:"Normal",Hard:"Hard"},
    hud:{score:"Score",combo:"Combo",time:"Time",best:"Best"},
    helpTitle:"How to Play",
    buttons:{start:"▶ Start",pause:"⏸ Pause",restart:"↻ Restart",help:"❓ Help"},
    result:{title:"Results",mode:"Mode",difficulty:"Difficulty",timeLeft:"Time Left",combo:"Best Combo",tips:"Tips"}
  }
};

// ===== Boot เกม =====
const canvas = document.getElementById("c");
const engine  = new Engine(THREE, canvas);
const hud     = new HUD();
const coach   = new Coach();
const floating= new FloatingFX(engine);

// ===== ระบบ SFX =====
const sfx = {
  ding(){ if(!SETTINGS.sound) return; let s=document.getElementById('sfx-ding'); s.currentTime=0; s.play(); },
  thud(){ if(!SETTINGS.sound) return; let s=document.getElementById('sfx-thud'); s.currentTime=0; s.play(); },
  tick(){ if(!SETTINGS.sound) return; let s=document.getElementById('sfx-tick'); s.currentTime=0; s.play(); },
  hero(){ if(!SETTINGS.sound) return; let s=document.getElementById('sfx-hero'); s.currentTime=0; s.play(); },
  fever(){if(!SETTINGS.sound) return; let s=document.getElementById('sfx-fever');s.currentTime=0; s.play(); },
  perfect(){if(!SETTINGS.sound) return; let s=document.getElementById('sfx-perfect');s.currentTime=0; s.play(); }
};

// ===== Systems =====
const systems = {
  score  : new ScoreSystem(),
  fever  : new FeverSystem(),
  power  : new PowerUpSystem(),
  mission: new MissionSystem(),
  board  : new Leaderboard(),
  fx     : sfx
};

// ===== Graphic Quality =====
function applyQuality(){
  const q = SETTINGS.quality;
  if(q === "Low"){ engine.renderer.setPixelRatio(0.5); }
  else if(q === "Medium"){ engine.renderer.setPixelRatio(0.8); }
  else{ engine.renderer.setPixelRatio(window.devicePixelRatio || 1); }
}

// ===== Toggle Sound =====
function applySound(){
  const btn = document.getElementById("soundToggle");
  btn.textContent = SETTINGS.sound ? "🔊" : "🔇";
}

// ===== Language Switch =====
function applyLanguage(){
  const L = I18N[SETTINGS.lang];

  document.querySelector(".brand div").textContent = L.brand;

  document.querySelector('button[data-value="goodjunk"]').textContent  = L.modes.goodjunk;
  document.querySelector('button[data-value="groups"]').textContent     = L.modes.groups;
  document.querySelector('button[data-value="hydration"]').textContent  = L.modes.hydration;
  document.querySelector('button[data-value="plate"]').textContent      = L.modes.plate;

  document.querySelector('button[data-value="Easy"]').textContent   = L.diff.Easy;
  document.querySelector('button[data-value="Normal"]').textContent = L.diff.Normal;
  document.querySelector('button[data-value="Hard"]').textContent   = L.diff.Hard;

  document.querySelector('button[data-action="start"]').textContent   = L.buttons.start;
  document.querySelector('button[data-action="pause"]').textContent   = L.buttons.pause;
  document.querySelector('button[data-action="restart"]').textContent = L.buttons.restart;
  document.querySelector('button[data-action="help"]').textContent    = L.buttons.help;

  document.getElementById("resTitle").textContent = L.result.title;
}

// ===== APPLY ครั้งแรก =====
applyLanguage();
applySound();
applyQuality();

// ===== MODES Map =====
const MODES = { goodjunk: M1, groups: M2, hydration: M3, plate: M4 };

// ===== Difficulty Presets =====
const DIFFS = {
  Easy:   { time:70, spawnBase:820, life:4200, trapRate:0.03, powerRate:0.10, hydWaterRate:0.78 },
  Normal: { time:60, spawnBase:700, life:3000, trapRate:0.05, powerRate:0.08, hydWaterRate:0.66 },
  Hard:   { time:50, spawnBase:560, life:1900, trapRate:0.07, powerRate:0.06, hydWaterRate:0.55 },
};

// ===== Global State =====
const state = {
  modeKey: 'goodjunk',
  difficulty: 'Normal',
  diffCfg: DIFFS.Normal,
  running:false, paused:false,
  timeLeft:60,
  ACTIVE:new Set(),
  lane:{},
  ctx:{
    // ทั่วไป
    bestStreak:0, currentStreak:0,
    // ดี vs ขยะ
    goodHits:0, junkCaught:0,
    // 5 หมู่
    targetHitsTotal:0, groupWrong:0,
    // สมดุลน้ำ
    waterHits:0, sweetMiss:0, overHydPunish:0, lowSweetPunish:0,
    // จัดจาน
    plateFills:0, perfectPlates:0, overfillCount:0,
    // อื่น ๆ
    trapsHit:0, powersUsed:0, timeMinus:0, timePlus:0
  },
  // Hydration range (ใช้ใน HUD)
  hydMin:45, hydMax:65, hyd:50,
  __plateLast:null
};

// ===== Help (สองภาษา) =====
const HELP_TH = {
  goodjunk:`<h3>🥗 ดี vs ขยะ</h3><ul><li>เก็บอาหารดี (+5) หลีกเลี่ยงขยะ (−2)</li><li>ปล่อยขยะผ่านได้ (+1)</li><li>⭐Boost ⏳Slow 🛡️Shield ⏱±Time | Trap: 💣 🎭</li></ul>`,
  groups:`<h3>🍽️ จาน 5 หมู่</h3><ul><li>เก็บให้ตรง 🎯 บน HUD</li><li>ถูกหมวด +7 | ผิด −2 | ครบ 3 ชิ้น เปลี่ยนเป้า</li></ul>`,
  hydration:`<h3>💧 สมดุลน้ำ</h3><ul><li>รักษา 45–65%</li><li>💧 เพิ่ม | 🧋 ลด</li><li>น้ำมากไป+เก็บน้ำ=โทษ | น้ำน้อยไป+เก็บหวาน=โทษ</li></ul>`,
  plate:`<h3>🍱 จัดจานสุขภาพ</h3><ul><li>เติมโควตาแต่ละหมู่ให้ครบ</li><li>ของที่ขาด +6 | ครบจาน +14</li><li>เกินโควตา: −2 / −1s และคอมโบแตก</li></ul>`
};
const HELP_EN = {
  goodjunk:`<h3>🥗 Healthy vs Junk</h3><ul><li>Pick healthy (+5), avoid junk (−2)</li><li>Let junk pass (+1)</li><li>Power-ups: ⭐ ⏳ 🛡️ ⏱ | Traps: 💣 🎭</li></ul>`,
  groups:`<h3>🍽️ Food Groups</h3><ul><li>Collect items matching 🎯 on HUD</li><li>Correct +7 | Wrong −2 | 3 hits → new target</li></ul>`,
  hydration:`<h3>💧 Hydration</h3><ul><li>Keep 45–65%</li><li>💧 increases | 🧋 decreases</li><li>Too high + water = penalty | Too low + sweet = penalty</li></ul>`,
  plate:`<h3>🍱 Healthy Plate</h3><ul><li>Fill each quota</li><li>Needed +6 | PERFECT +14</li><li>Overfill: −2 / −1s & combo reset</li></ul>`
};

function openHelpFor(modeKey){
  const useEN = (SETTINGS.lang === 'EN');
  const key = modeKey || state.modeKey;
  const html = (useEN? HELP_EN : HELP_TH)[key] || '<p>-</p>';
  document.getElementById('helpBody').innerHTML = html;
  document.querySelector('#help h2').textContent = I18N[SETTINGS.lang].helpTitle;
  document.getElementById('help').style.display = 'flex';
}

// ===== Lanes (ตำแหน่งเกิด) =====
function setupLanes(){
  const X=[-1.1,-0.55,0,0.55,1.1], Y=[-0.2,0.0,0.18,0.32], Z=-2.2;
  state.lane={X,Y,Z, occupied:new Set(), cooldown:new Map(), last:null};
}
function now(){ return performance.now(); }
function isAdj(r,c){ const last=state.lane.last; if(!last) return false; const [pr,pc]=last; return Math.abs(pr-r)<=1 && Math.abs(pc-c)<=1; }
function pickLane(){
  const {X,Y,Z,occupied,cooldown}=state.lane;
  const cand=[];
  for(let r=0;r<Y.length;r++){
    for(let c=0;c<X.length;c++){
      const k=r+','+c, cd=cooldown.get(k)||0, free=!occupied.has(k)&&now()>cd&&!isAdj(r,c);
      if(free) cand.push({r,c,k});
    }
  }
  if(!cand.length) return null;
  const p=cand[Math.floor(Math.random()*cand.length)];
  occupied.add(p.k); state.lane.last=[p.r,p.c];
  return {x:X[p.c], y:1.6+Y[p.r], z:Z-0.1*Math.abs(p.c-2), key:p.k};
}
function releaseLane(k){ const {occupied,cooldown}=state.lane; occupied.delete(k); cooldown.set(k, now()+800); }

// ===== Specialized Items =====
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
  const {trapRate, powerRate} = state.diffCfg || DIFFS.Normal;
  if(roll < powerRate) return POWER_ITEMS[Math.floor(Math.random()*POWER_ITEMS.length)];
  if(roll < powerRate + trapRate) return TRAP_ITEMS[Math.floor(Math.random()*TRAP_ITEMS.length)];
  return baseMeta;
}

// ===== Spawn One =====
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

  // วัตถุ 3D (บิลบอร์ดตัวอักษร/อิโมจิ)
  const m = engine.makeBillboard(meta.char);
  m.position.set(lane.x,lane.y,lane.z);
  m.userData={lane:lane.key, meta};
  engine.group.add(m); state.ACTIVE.add(m);

  // อายุไอคอนตามความยาก + พฤติกรรมหมดอายุ
  const life = (state.diffCfg && state.diffCfg.life) || 3000;
  m.userData.timer = setTimeout(()=>{ if(!m.parent) return;
    if(meta.type==='gj' && meta.good===false){ systems.score.add(1); } // ปล่อยขยะผ่าน = +1
    if(meta.type==='groups'){
      if(state.currentTarget && meta.group===state.currentTarget){ systems.score.bad(); }
      else { state.ctx.groupWrong++; } // พลาดทางอ้อม
    }
    if(meta.type==='hydra' && meta.water===false){ systems.score.add(1); state.ctx.sweetMiss++; }
    updateHUD(); destroy(m);
  }, life + Math.floor(Math.random()*500-250));
}

function destroy(obj){ if(obj.parent) obj.parent.remove(obj); state.ACTIVE.delete(obj); releaseLane(obj.userData.lane); }

// ====== HIT LOGIC & FEEDBACK ======
function hit(obj){
  const meta = obj.userData.meta;

  // คูณคะแนนด้วย Fever/Boost ชั่วคราว
  const baseAdd = systems.score.add.bind(systems.score);
  systems.score.add = (base)=> baseAdd(base * systems.fever.scoreMul() * (1+systems.power.scoreBoost));

  // เรียก handler ตามโหมด
  MODES[state.modeKey].onHit(meta, systems, state, hud);

  // ===== โทษพิเศษ Hydration =====
  // A) มากไปแล้วเก็บน้ำ → −4 คะแนน / −3s
  if(state.modeKey==='hydration' && meta.type==='hydra' && meta.water===true && state.hyd > (state.hydMax||65)){
    systems.score.add(-4); systems.score.bad(); systems.fever.onBad();
    state.timeLeft = Math.max(0, state.timeLeft-3);
    systems.fx.thud();
    floating.spawn3D(obj,'<b>Over-hydration −4 / −3s</b>','bad');
    state.ctx.currentStreak=0;
    state.ctx.overHydPunish++; state.ctx.timeMinus+=3;
  }
  // B) น้อยไปแล้วเก็บหวาน → −2 คะแนน / −2s
  if(state.modeKey==='hydration' && meta.type==='hydra' && meta.water===false && state.hyd < (state.hydMin||45)){
    systems.score.add(-2);
    state.timeLeft = Math.max(0, state.timeLeft-2);
    systems.fx.thud();
    floating.spawn3D(obj,'<b>Dehydrated −2 / −2s</b>','bad');
    state.ctx.lowSweetPunish++; state.ctx.timeMinus+=2;
  }

  // ===== Power-ups & Traps (นับสถิติ) =====
  if(meta.type==='power'){
    state.ctx.powersUsed++;
    if(meta.kind==='slow'){ systems.power.apply('slow'); systems.fx.tick(); }
    if(meta.kind==='boost'){ systems.power.apply('boost'); systems.fx.ding(); }
    if(meta.kind==='shield'){ systems.power.apply('shield'); systems.fx.ding(); }
    if(meta.kind==='timeplus'){ state.timeLeft=Math.min(120,state.timeLeft+5); systems.fx.ding(); state.ctx.timePlus+=5; }
    if(meta.kind==='timeminus'){ state.timeLeft=Math.max(0,state.timeLeft-5); systems.fx.thud(); state.ctx.timeMinus+=5; }
  }else if(meta.type==='trap'){
    state.ctx.trapsHit++;
    if(meta.kind==='bomb'){ if(!systems.power.consumeShield()){ systems.score.add(-6); systems.score.bad(); systems.fever.onBad(); systems.fx.thud(); state.ctx.currentStreak=0; } }
    if(meta.kind==='bait'){ if(!systems.power.consumeShield()){ systems.score.add(-4); systems.score.bad(); systems.fever.onBad(); systems.fx.thud(); state.ctx.currentStreak=0; } }
  }

  // ===== ตัวนับตามโหมด =====
  if(meta.type==='gj'){
    if(meta.good){ state.ctx.goodHits++; state.ctx.currentStreak++; state.ctx.bestStreak=Math.max(state.ctx.bestStreak,state.ctx.currentStreak); }
    else{ state.ctx.junkCaught++; state.ctx.currentStreak=0; }
  }
  if(meta.type==='groups'){
    const ok = (state.currentTarget && meta.group===state.currentTarget);
    if(ok){ state.ctx.targetHitsTotal++; state.ctx.currentStreak++; state.ctx.bestStreak=Math.max(state.ctx.bestStreak,state.ctx.currentStreak); }
    else{ state.ctx.groupWrong++; state.ctx.currentStreak=0; }
  }
  if(meta.type==='hydra'){
    if(meta.water){ state.ctx.waterHits++; state.ctx.currentStreak++; state.ctx.bestStreak=Math.max(state.ctx.bestStreak,state.ctx.currentStreak); }
    else{ state.ctx.currentStreak=0; }
  }
  if(meta.type==='plate'){
    const over = state.__plateLast && state.__plateLast.overfill;
    if(over){ state.ctx.overfillCount++; }
    else{ state.ctx.plateFills++; state.ctx.currentStreak++; state.ctx.bestStreak=Math.max(state.ctx.bestStreak,state.ctx.currentStreak); }
    state.__plateLast=null;
  }

  // ===== Floating score ปกติ =====
  const mult = systems.fever.scoreMul() * (1+systems.power.scoreBoost);
  const fmt  = (v)=>`<b>${v>0?'+':''}${Math.round(v)}</b>`;
  let txt='', kind='good';

  if(meta.type==='gj'){ txt = meta.good? fmt(5*mult) : fmt(-2); kind = meta.good?'good':'bad'; }
  else if(meta.type==='groups'){ const ok=(state.currentTarget && meta.group===state.currentTarget); txt = ok? fmt(7*mult): fmt(-2); kind= ok?'good':'bad'; }
  else if(meta.type==='hydra'){ txt = meta.water? fmt(5*mult): fmt(-3); kind = meta.water?'good':'bad'; }
  else if(meta.type==='plate'){
    // ถ้าเพิ่งถูกตั้ง overfill จาก plate.js จะถูกนับด้านบนแล้ว
    txt = fmt(6*mult); kind='good';
  }
  else if(meta.type==='power'){ txt = meta.kind==='timeplus'? '<b>+5s</b>' : meta.kind==='timeminus'? '<b>-5s</b>' : meta.kind.toUpperCase(); kind = meta.kind==='timeminus'?'bad':'good'; }
  else if(meta.type==='trap'){ txt = meta.kind==='bomb'? fmt(-6) : fmt(-4); kind='bad'; }

  floating.spawn3D(obj, txt, kind);

  if(systems.score.combo===3||systems.score.combo===5) coach.onCombo(systems.score.combo);
  if(systems.fever.active){ systems.fx.fever(); coach.onFever(); }

  // คืนฟังก์ชันคะแนนเดิม
  systems.score.add = baseAdd;

  updateHUD();
  destroy(obj);
}

// ===== INPUT (คลิก/ทัช) =====
function onClick(ev){
  if(!state.running || state.paused) return;
  const x = ev.clientX ?? (ev.touches && ev.touches[0].clientX);
  const y = ev.clientY ?? (ev.touches && ev.touches[0].clientY);
  if(x==null||y==null) return;
  const inter = engine.raycastFromClient(x,y);
  if(inter.length){ hit(inter[0].object); }
}

// ===== HUD / RESULT =====
function updateHUD(){
  hud.setScore(systems.score.score);
  hud.setCombo(systems.score.combo);
  hud.setTime(state.timeLeft);
  hud.setDiff(state.difficulty);
  hud.setMode(MODES[state.modeKey].name || state.modeKey);
  hud.fever(systems.fever.active);
}

// breakdown รายโหมด + tips
function buildBreakdownAndTips(){
  const m=state.modeKey, c=state.ctx;
  let html='', tip='';
  if(m==='goodjunk'){
    html=`<ul>
      <li>ของดีที่เก็บ: <b>${c.goodHits}</b></li>
      <li>ของขยะที่กดโดน: <b>${c.junkCaught}</b></li>
      <li>Power-ups: <b>${c.powersUsed}</b> | Trap: <b>${c.trapsHit}</b></li>
      <li>สตรีคดีที่สุด: <b>${c.bestStreak}</b></li>
    </ul>`;
    tip='เล็งของดีต่อเนื่อง ดันคอมโบ/FEVER และเลี่ยง Trap';
  }else if(m==='groups'){
    html=`<ul>
      <li>ตรงหมวดเป้าหมาย: <b>${c.targetHitsTotal}</b></li>
      <li>เก็บผิดหมวด/พลาด: <b>${c.groupWrong}</b></li>
      <li>สตรีคดีที่สุด: <b>${c.bestStreak}</b></li>
    </ul>`;
    tip='เช็ค 🎯 บน HUD ก่อนคลิก จัดตำแหน่งให้เข้าเลนเป้า';
  }else if(m==='hydration'){
    const hydNow = Math.round(state.hyd ?? 0);
    html=`<ul>
      <li>เก็บน้ำ: <b>${c.waterHits}</b> | หวานพลาด: <b>${c.sweetMiss}</b></li>
      <li>โทษ Over-hydration: <b>${c.overHydPunish}</b> | โทษ Dehydration: <b>${c.lowSweetPunish}</b></li>
      <li>เวลาถูกหักรวม: <b>${c.timeMinus}s</b> | เพิ่มเวลา: <b>${c.timePlus}s</b></li>
      <li>มิเตอร์สุดท้าย: <b>${hydNow}%</b></li>
    </ul>`;
    tip='รักษา 45–65% ให้เสถียร; เกิน/ขาดอย่าเก็บผิดฝั่ง';
  }else if(m==='plate'){
    html=`<ul>
      <li>เติมชิ้นในจาน: <b>${c.plateFills}</b> | PERFECT: <b>${c.perfectPlates||0}</b></li>
      <li>เกินโควตา (โดนโทษ): <b>${c.overfillCount}</b></li>
      <li>สตรีคดีที่สุด: <b>${c.bestStreak}</b></li>
    </ul>`;
    tip='ดูโควตาใน HUD ให้ครบทีละหมู่—เต็มแล้วเลี่ยงคลิกซ้ำ';
  }
  return {html, tip};
}

function presentResult(finalScore){
  const L = I18N[SETTINGS.lang];
  const res = document.getElementById('result');

  document.getElementById('resTitle').textContent = L.result.title;
  document.getElementById('resScore').textContent = finalScore;
  document.getElementById('resTime').textContent  = Math.max(0, state.timeLeft|0);
  document.getElementById('resMode').textContent  = (MODES[state.modeKey].name || state.modeKey);
  document.getElementById('resDiff').textContent  = state.difficulty;
  document.getElementById('resCombo').textContent = 'x' + (systems.score.bestCombo || systems.score.combo || 1);

  const {html, tip} = buildBreakdownAndTips();
  document.getElementById('resBreakdown').innerHTML = html;
  document.getElementById('resTips').textContent    = (L.result.tips + ': ' + tip);

  res.style.display = 'flex';
}

// ====== MAIN LOOP & TIMERS ======
let spawnTimer=null, timeTimer=null, spawnCount=0, lastTs=performance.now();

function loop(){
  const ts=performance.now(); const dt=ts-lastTs; lastTs=ts;
  systems.fever.update(dt);
  systems.power.tick(dt);

  // Hydration: decay + HUD (เฉพาะโหมดน้ำ)
  if(state.running && state.modeKey==='hydration'){
    state.hyd = Math.max(0, Math.min(100, state.hyd - 0.0003 * dt * (systems.power.timeScale||1)));

    if(!loop._hydTick) loop._hydTick=0;
    loop._hydTick += dt;

    const min = state.hydMin, max = state.hydMax;
    const z = state.hyd < min ? 'low' : (state.hyd > max ? 'high' : 'ok');

    if(!loop._lowAccum) loop._lowAccum=0;
    if(z==='low'){ loop._lowAccum += dt; } else { loop._lowAccum=0; }

    if(loop._hydTick>1000){
      loop._hydTick=0;
      if(z==='ok'){ systems.score.add(1); }
      hud.setHydration(state.hyd, z);
    }

    if(loop._lowAccum>=4000){
      loop._lowAccum=0;
      systems.score.add(-1);
      state.timeLeft = Math.max(0, state.timeLeft-1);
      systems.fx.thud();
      try{ coach.say('น้ำน้อยไป ดื่มเพิ่มอีกหน่อย!'); }catch{}
      state.ctx.timeMinus += 1;
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

// ====== STATE: start / pause / end ======
function start(){
  document.getElementById('help').style.display='none';
  state.diffCfg = DIFFS[state.difficulty] || DIFFS.Normal;

  state.running=true; state.paused=false;
  state.timeLeft = state.diffCfg.time;
  spawnCount=0; systems.score.reset(); setupLanes();

  state.ctx={
    bestStreak:0, currentStreak:0,
    goodHits:0, junkCaught:0,
    targetHitsTotal:0, groupWrong:0,
    waterHits:0, sweetMiss:0, overHydPunish:0, lowSweetPunish:0,
    plateFills:0, perfectPlates:0, overfillCount:0,
    trapsHit:0, powersUsed:0, timeMinus:0, timePlus:0
  };
  state.__plateLast=null;

  systems.mission.roll(state.modeKey);
  const M = MODES[state.modeKey]; if(M.init) M.init(state, hud, state.difficulty);

  if(state.modeKey!=='hydration'){ hud.hideHydration?.(); }
  if(state.modeKey!=='groups') hud.hideTarget();
  if(state.modeKey!=='plate')  hud.hidePills();

  updateHUD();
  setTimeout(spawnOnce, 200);
  runSpawn(); runTimer();
  canvas.style.pointerEvents='auto';
}

function pause(){
  if(!state.running) return;
  state.paused=!state.paused;
  if(!state.paused){ runSpawn(); runTimer(); }
}

function end(){
  state.running=false; state.paused=false;
  clearTimeout(spawnTimer); clearTimeout(timeTimer);
  canvas.style.pointerEvents='none';

  const bonus = systems.mission.evaluate({...state.ctx, combo: systems.score.combo});
  if(bonus>0){ systems.score.score += bonus; }
  systems.board.submit(state.modeKey, state.difficulty, systems.score.score);
  coach.onEnd(); systems.fx.perfect();

  presentResult(systems.score.score);
}

// ====== LANDING & MENUS ======
bindLanding(()=>{
  coach.onStart();
  openHelpFor(state.modeKey);
}, coach);

document.getElementById('menuBar').addEventListener('click', (e)=>{
  const btn=e.target.closest('button'); if(!btn) return;
  const act=btn.getAttribute('data-action'); const val=btn.getAttribute('data-value');
  e.preventDefault(); e.stopPropagation();

  if(act==='diff'){
    state.difficulty = val;
    state.diffCfg = DIFFS[state.difficulty] || DIFFS.Normal;
    hud.setDiff(state.difficulty);
    // อัปเดตชื่อภาษาในแถบแสดงผล
    document.getElementById('difficulty')?.replaceChildren(document.createTextNode(I18N[SETTINGS.lang].diff[state.difficulty]||state.difficulty));
    document.getElementById('modeName')?.replaceChildren(document.createTextNode(I18N[SETTINGS.lang].modes[state.modeKey]||state.modeKey));
    return;
  }

  if(act==='start') start();
  else if(act==='pause') pause();
  else if(act==='restart'){ end(); start(); }
  else if(act==='help'){ openHelpFor(state.modeKey); }
  else if(act==='mode'){
    state.modeKey=val;
    if(val!=='plate')  document.getElementById('plateTracker').style.display='none';
    if(val!=='groups') document.getElementById('targetWrap').style.display='none';
    if(val!=='hydration'){ hud.hideHydration?.(); }
    // อัปเดตชื่อภาษาในแถบแสดงผล
    document.getElementById('difficulty')?.replaceChildren(document.createTextNode(I18N[SETTINGS.lang].diff[state.difficulty]||state.difficulty));
    document.getElementById('modeName')?.replaceChildren(document.createTextNode(I18N[SETTINGS.lang].modes[state.modeKey]||state.modeKey));
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

// ====== MAIN LOOP & TIMERS ======
let spawnTimer=null, timeTimer=null, spawnCount=0, lastTs=performance.now();

function loop(){
  const ts=performance.now(); const dt=ts-lastTs; lastTs=ts;
  systems.fever.update(dt);
  systems.power.tick(dt);

  // Hydration: decay + HUD (เฉพาะโหมดน้ำ)
  if(state.running && state.modeKey==='hydration'){
    state.hyd = Math.max(0, Math.min(100, state.hyd - 0.0003 * dt * (systems.power.timeScale||1)));

    if(!loop._hydTick) loop._hydTick=0;
    loop._hydTick += dt;

    const min = state.hydMin, max = state.hydMax;
    const z = state.hyd < min ? 'low' : (state.hyd > max ? 'high' : 'ok');

    if(!loop._lowAccum) loop._lowAccum=0;
    if(z==='low'){ loop._lowAccum += dt; } else { loop._lowAccum=0; }

    if(loop._hydTick>1000){
      loop._hydTick=0;
      if(z==='ok'){ systems.score.add(1); }
      hud.setHydration(state.hyd, z);
    }

    if(loop._lowAccum>=4000){
      loop._lowAccum=0;
      systems.score.add(-1);
      state.timeLeft = Math.max(0, state.timeLeft-1);
      systems.fx.thud();
      try{ coach.say('น้ำน้อยไป ดื่มเพิ่มอีกหน่อย!'); }catch{}
      state.ctx.timeMinus += 1;
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

// ====== STATE: start / pause / end ======
function start(){
  document.getElementById('help').style.display='none';
  state.diffCfg = DIFFS[state.difficulty] || DIFFS.Normal;

  state.running=true; state.paused=false;
  state.timeLeft = state.diffCfg.time;
  spawnCount=0; systems.score.reset(); setupLanes();

  state.ctx={
    bestStreak:0, currentStreak:0,
    goodHits:0, junkCaught:0,
    targetHitsTotal:0, groupWrong:0,
    waterHits:0, sweetMiss:0, overHydPunish:0, lowSweetPunish:0,
    plateFills:0, perfectPlates:0, overfillCount:0,
    trapsHit:0, powersUsed:0, timeMinus:0, timePlus:0
  };
  state.__plateLast=null;

  systems.mission.roll(state.modeKey);
  const M = MODES[state.modeKey]; if(M.init) M.init(state, hud, state.difficulty);

  if(state.modeKey!=='hydration'){ hud.hideHydration?.(); }
  if(state.modeKey!=='groups') hud.hideTarget();
  if(state.modeKey!=='plate')  hud.hidePills();

  updateHUD();
  setTimeout(spawnOnce, 200);
  runSpawn(); runTimer();
  canvas.style.pointerEvents='auto';
}

function pause(){
  if(!state.running) return;
  state.paused=!state.paused;
  if(!state.paused){ runSpawn(); runTimer(); }
}

function end(){
  state.running=false; state.paused=false;
  clearTimeout(spawnTimer); clearTimeout(timeTimer);
  canvas.style.pointerEvents='none';

  const bonus = systems.mission.evaluate({...state.ctx, combo: systems.score.combo});
  if(bonus>0){ systems.score.score += bonus; }
  systems.board.submit(state.modeKey, state.difficulty, systems.score.score);
  coach.onEnd(); systems.fx.perfect();

  presentResult(systems.score.score);
}

// ====== LANDING & MENUS ======
bindLanding(()=>{
  coach.onStart();
  openHelpFor(state.modeKey);
}, coach);

document.getElementById('menuBar').addEventListener('click', (e)=>{
  const btn=e.target.closest('button'); if(!btn) return;
  const act=btn.getAttribute('data-action'); const val=btn.getAttribute('data-value');
  e.preventDefault(); e.stopPropagation();

  if(act==='diff'){
    state.difficulty = val;
    state.diffCfg = DIFFS[state.difficulty] || DIFFS.Normal;
    hud.setDiff(state.difficulty);
    // อัปเดตชื่อภาษาในแถบแสดงผล
    document.getElementById('difficulty')?.replaceChildren(document.createTextNode(I18N[SETTINGS.lang].diff[state.difficulty]||state.difficulty));
    document.getElementById('modeName')?.replaceChildren(document.createTextNode(I18N[SETTINGS.lang].modes[state.modeKey]||state.modeKey));
    return;
  }

  if(act==='start') start();
  else if(act==='pause') pause();
  else if(act==='restart'){ end(); start(); }
  else if(act==='help'){ openHelpFor(state.modeKey); }
  else if(act==='mode'){
    state.modeKey=val;
    if(val!=='plate')  document.getElementById('plateTracker').style.display='none';
    if(val!=='groups') document.getElementById('targetWrap').style.display='none';
    if(val!=='hydration'){ hud.hideHydration?.(); }
    // อัปเดตชื่อภาษาในแถบแสดงผล
    document.getElementById('difficulty')?.replaceChildren(document.createTextNode(I18N[SETTINGS.lang].diff[state.difficulty]||state.difficulty));
    document.getElementById('modeName')?.replaceChildren(document.createTextNode(I18N[SETTINGS.lang].modes[state.modeKey]||state.modeKey));
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
