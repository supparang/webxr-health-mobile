import { Engine } from './core/engine.js';
import { HUD } from './core/hud.js';
import { FloatingFX } from './core/fx.js';
import { FeverSystem } from './core/fever.js';
import { PowerUpSystem } from './core/powerup.js';
import { MissionSystem } from './core/mission.js';
import { Leaderboard } from './core/leaderboard.js';
import { ScoreSystem } from './core/score.js';
import { Coach } from './core/coach.js';

import * as GJ from './modes/goodjunk.js';
import * as GP from './modes/groups.js';
import * as HY from './modes/hydration.js';
import * as PL from './modes/plate.js';

const THREE = window?.THREE;
window.__HHA_BOOT = true;

// ===== Settings & I18N =====
const SETTINGS={lang:'TH',sound:true,quality:'High'};
const I18N={
  TH:{brand:'HERO HEALTH ACADEMY',
    modes:{goodjunk:'🥗 ดี vs ขยะ',groups:'🍽️ จาน 5 หมู่',hydration:'💧 สมดุลน้ำ',plate:'🍱 จัดจานสุขภาพ'},
    diff:{Easy:'ง่าย',Normal:'ปกติ',Hard:'ยาก'},
    labels:{score:'คะแนน',combo:'คอมโบ',time:'เวลา',best:'สถิติ',target:'หมวดเป้าหมาย',quota:'โควตา',hydro:'สมดุลน้ำ'},
    buttons:{start:'▶ เริ่มเกม',pause:'⏸ พัก',restart:'↻ เริ่มใหม่',help:'❓ วิธีเล่น'},
    result:{title:'สรุปผล',tips:'เคล็ดลับ',mode:'โหมด',difficulty:'ความยาก',timeLeft:'เวลาเหลือ',bestCombo:'คอมโบสูงสุด'},
    misc:{ok:'พอดี',low:'น้อยไป',high:'มากไป'}
  },
  EN:{brand:'HERO HEALTH ACADEMY',
    modes:{goodjunk:'🥗 Healthy vs Junk',groups:'🍽️ Food Groups',hydration:'💧 Hydration',plate:'🍱 Healthy Plate'},
    diff:{Easy:'Easy',Normal:'Normal',Hard:'Hard'},
    labels:{score:'Score',combo:'Combo',time:'Time',best:'Best',target:'Target',quota:'Quota',hydro:'Hydration'},
    buttons:{start:'▶ Start',pause:'⏸ Pause',restart:'↻ Restart',help:'❓ Help'},
    result:{title:'Results',tips:'Tips',mode:'Mode',difficulty:'Difficulty',timeLeft:'Time left',bestCombo:'Best combo'},
    misc:{ok:'OK',low:'Low',high:'High'}
  }
};
const DIFFS={
  Easy:{time:70, spawnBase:820, life:4200, trapRate:0.03, powerRate:0.10, hydWaterRate:0.78},
  Normal:{time:60, spawnBase:700, life:3000, trapRate:0.05, powerRate:0.08, hydWaterRate:0.66},
  Hard:{time:50, spawnBase:560, life:1900, trapRate:0.07, powerRate:0.06, hydWaterRate:0.55}
};
const MODES = { goodjunk:GJ, groups:GP, hydration:HY, plate:PL };

// ===== State =====
let engine,hud,floating,systems,coach;
const state={ modeKey:'goodjunk', difficulty:'Normal', diffCfg:DIFFS.Normal,
  running:false, paused:false, timeLeft:60, ACTIVE:new Set(), lane:{},
  ctx:{}, hydMin:45,hydMax:65,hyd:50, L:'TH',
  totals:{spawns:0, clicks:0, hits:0, misses:0, powers:0}
};

// ===== Helpers =====
const L = () => I18N[state.L] || I18N.TH;
const rand = a => a[Math.floor(Math.random()*a.length)];

// ===== HUD & UI =====
function applyLanguage(){
  const lang = L();
  document.documentElement.lang = (state.L==='TH'?'th':'en');
  document.querySelector('.brand div').textContent = lang.brand;
  [['.lbl-score',lang.labels.score],['.lbl-combo',lang.labels.combo],['.lbl-time',lang.labels.time],['.lbl-best',lang.labels.best],['.lbl-target',lang.labels.target],['.lbl-quota',lang.labels.quota],['.lbl-hydro',lang.labels.hydro]].forEach(([sel,txt])=>{ const el=document.querySelector(sel); if(el) el.textContent=txt; });
  Object.keys(L().modes).forEach(k=>{ const b=document.querySelector(`button[data-action="mode"][data-value="${k}"]`); if(b) b.textContent = L().modes[k]; });
  ['Easy','Normal','Hard'].forEach(d=>{ const b=document.querySelector(`button[data-action="diff"][data-value="${d}"]`); if(b) b.textContent = L().diff[d]; });
  document.getElementById('modeName').textContent = lang.modes[state.modeKey];
  document.getElementById('difficulty').textContent = lang.diff[state.difficulty];
  const btns=L().buttons;
  const setText=(sel,txt)=>{ const el=document.querySelector(`button[data-action="${sel}"]`); if(el) el.textContent=txt; };
  setText('start', btns.start); setText('pause', btns.pause); setText('restart', btns.restart); setText('help', btns.help);
}
function applySound(){
  const muted = !SETTINGS.sound;
  document.querySelectorAll('audio').forEach(a=>a.muted=muted);
  const btn=document.getElementById('soundToggle');
  if(btn) btn.textContent = SETTINGS.sound ? '🔊' : '🔇';
}
function applyQuality(){
  const q=SETTINGS.quality;
  const dpr=q==='High'?(devicePixelRatio||1):q==='Medium'?Math.max(0.75,(devicePixelRatio||1)*0.75):0.5;
  try{ engine.renderer.setPixelRatio(dpr); engine.onResize?.(); }catch{}
  document.body.style.filter=(q==='Low')?'saturate(0.95) brightness(0.98)':(q==='Medium')?'saturate(1.0) brightness(1.0)':'';
}
function updateHUD(){
  hud.setScore(systems?.score?.score||0);
  hud.setCombo(systems?.score?.combo||1);
  hud.setTime(state.timeLeft|0);
  hud.setDiff(L().diff[state.difficulty]||state.difficulty);
  hud.setMode(L().modes[state.modeKey]||state.modeKey);
  hud.fever(!!systems?.fever?.active);
}

// ===== LANES / SPAWN =====
function setupLanes(){ const X=[-1.1,-0.55,0,0.55,1.1], Y=[-0.2,0.0,0.18,0.32], Z=-2.2; state.lane={X,Y,Z,occupied:new Set(),cooldown:new Map(),last:null}; }
const now=()=>performance.now();
const isAdj=(r,c)=>{ const last=state.lane.last; if(!last) return false; const [pr,pc]=last; return Math.abs(pr-r)<=1 && Math.abs(pc-c)<=1; };
function pickLane(){
  const {X,Y,Z,occupied,cooldown}=state.lane; const cand=[];
  for(let r=0;r<Y.length;r++)for(let c=0;c<X.length;c++){
    const k=r+','+c,cd=cooldown.get(k)||0,free=!occupied.has(k)&&now()>cd&&!isAdj(r,c);
    if(free) cand.push({r,c,k});
  }
  if(!cand.length) return null;
  const p=cand[Math.floor(Math.random()*cand.length)];
  occupied.add(p.k); state.lane.last=[p.r,p.c];
  return {x:X[p.c],y:1.6+Y[p.r],z:Z-0.1*Math.abs(p.c-2),key:p.k};
}
function releaseLane(k){ const {occupied,cooldown}=state.lane; occupied.delete(k); cooldown.set(k, now()+800); }

const POWER_ITEMS=[{type:'power',kind:'slow',char:'⏳'},{type:'power',kind:'boost',char:'⭐'},{type:'power',kind:'shield',char:'🛡️'}];
function maybeSpecialMeta(base){
  const r=Math.random(), p=state.diffCfg?.powerRate??0.08;
  if(r<p) { state.totals.powers++; return POWER_ITEMS[Math.floor(Math.random()*POWER_ITEMS.length)]; }
  return base;
}

function spawnOnce(){
  const lane=pickLane(); if(!lane) return;
  let meta = MODES[state.modeKey].pickMeta(state.diffCfg,state);
  meta = maybeSpecialMeta(meta);
  const m=engine.makeBillboard(meta.char);
  m.position.set(lane.x,lane.y,lane.z);
  m.userData={lane:lane.key,meta};
  engine.group.add(m); state.ACTIVE.add(m);
  state.totals.spawns++;
  const life=state.diffCfg?.life||3000;
  m.userData.timer=setTimeout(()=>{ if(!m.parent) return; destroy(m); state.totals.misses++; }, life + Math.floor(Math.random()*500-250));
}

function destroy(obj){ if(obj.userData?.timer) { clearTimeout(obj.userData.timer); obj.userData.timer=null; } if(obj.parent) obj.parent.remove(obj); state.ACTIVE.delete(obj); if (obj.userData?.lane) releaseLane(obj.userData.lane); }

// ===== HIT =====
function hit(obj){
  const meta=obj.userData.meta;
  const baseAdd=systems.score.add.bind(systems.score);
  systems.score.add=(v)=>baseAdd(v*(systems.fever.active?2:1)*(1+systems.power.scoreBoost));

  MODES[state.modeKey].onHit(meta, systems, state, hud);

  if(meta.type==='power'){
    if(meta.kind==='slow'){ systems.power.apply('slow'); coach?.onPower?.('slow'); }
    if(meta.kind==='boost'){ systems.power.apply('boost'); coach?.onPower?.('boost'); }
    if(meta.kind==='shield'){ systems.power.apply('shield'); coach?.onPower?.('shield'); }
  }

  state.totals.hits++; state.totals.clicks++;
  systems.score.add = baseAdd;
  updateHUD(); destroy(obj);
}

// ===== INPUT =====
function onCanvasClick(ev){
  if(!state.running || state.paused) return;
  const x=ev.clientX ?? (ev.touches&&ev.touches[0].clientX);
  const y=ev.clientY ?? (ev.touches&&ev.touches[0].clientY);
  const inter=engine.raycastFromClient(x,y);
  if(inter.length) hit(inter[0].object);
  else state.totals.clicks++;
}

// ===== LOOP / TIMER =====
let spawnTimer=null,timeTimer=null,spawnCount=0,lastTs=performance.now();
function loop(){
  const ts=performance.now(), dt=ts-lastTs; lastTs=ts;
  systems.fever.update(dt); systems.power.tick(dt);
  if(state.running && state.modeKey==='hydration'){
    state.hyd = Math.max(0, Math.min(100, state.hyd - 0.0003*dt*(systems.power.timeScale||1)));
    const z=state.hyd<45?'low':(state.hyd>65?'high':'ok');
    if(loop._lastHydZone!==z){ coach?.onHydrationZoneChange?.(z); loop._lastHydZone=z; }
    hud.setHydration(state.hyd,z);
  }
  updateHUD();
}
function runSpawn(){
  if(!state.running || state.paused) return;
  spawnOnce(); spawnCount++;
  const base=state.diffCfg?.spawnBase||700;
  const next=Math.max(280, base*1.0*systems.power.timeScale);
  spawnTimer=setTimeout(runSpawn,next);
}
function runTimer(){
  if(!state.running || state.paused) return;
  timeTimer=setTimeout(()=>{ state.timeLeft--; if(state.timeLeft<=0){ end(); } else runTimer(); updateHUD(); },1000);
}

// ===== RESULT BUILDER =====

function buildResult(){
  const lang=L(), r=lang.result;
  const accuracy = state.totals.hits>0 ? Math.round(100*state.totals.hits/Math.max(1,state.totals.clicks)) : 0;
  const parts = [
    `${r.mode}: <b>${lang.modes[state.modeKey]}</b>`,
    `${r.difficulty}: <b>${lang.diff[state.difficulty]}</b>`,
    `${lang.labels.score}: <b>${systems.score.score|0}</b>`,
    `${r.timeLeft}: <b>${Math.max(0,state.timeLeft|0)}s</b>`,
    `${r.bestCombo}: <b>x${systems.score.bestCombo||systems.score.combo||1}</b>`,
    `Accuracy: <b>${accuracy}%</b> (hits ${state.totals.hits}/${state.totals.clicks})`
  ];
  const core = parts.join(' | ');

  // per-mode breakdown
  let bd = '';
  if(state.modeKey==='goodjunk'){
    bd = `<ul><li>Good hits: <b>${state.ctx.goodHits||0}</b></li><li>Junk hits: <b>${state.ctx.junkHits||0}</b></li><li>Power-ups seen: <b>${state.totals.powers||0}</b></li></ul>`;
  }else if(state.modeKey==='groups'){
    bd = `<ul><li>Target hits: <b>${state.ctx.targetHitsTotal||0}</b></li><li>Wrong group: <b>${state.ctx.groupWrong||0}</b></li></ul>`;
  }else if(state.modeKey==='hydration'){
    const zone = state.hyd<45?lang.misc.low:(state.hyd>65?lang.misc.high:lang.misc.ok);
    bd = `<ul><li>Water hits: <b>${state.ctx.waterHits||0}</b></li><li>Sugary misses: <b>${state.ctx.sweetHits||0}</b></li><li>Final meter: <b>${Math.round(state.hyd)}% (${zone})</b></li></ul>`;
  }else if(state.modeKey==='plate'){
    bd = `<ul><li>Pieces filled: <b>${state.ctx.plateFills||0}</b></li><li>PERFECT plates: <b>${state.ctx.perfectPlates||0}</b></li><li>Overfills: <b>${state.ctx.overfillCount||0}</b></li></ul>`;
  }

  // Rubric + grade
  const rb = computeRubric();
  const rubricHTML = `
  <div style="margin-top:8px;border-top:1px dashed #0ff;padding-top:8px">
    <div><b>Rubric</b> → Composite: <b>${rb.composite}</b> / 100 • Grade: <b>${rb.grade}</b></div>
    <div style="font-size:0.95em;opacity:.9">
      Accuracy <b>${rb.accuracyPct}%</b> • Objectives <b>${rb.objectivesPct}%</b> • Combo <b>${rb.comboPct}%</b> • Time <b>${rb.timePct}%</b> • Discipline <b>${rb.disciplinePct}%</b>
    </div>
  </div>`;

  // Tips
  const tipsMapTH={goodjunk:'เล็งของดี เลี่ยงของขยะ',groups:'สังเกต 🎯 ที่ HUD ก่อนคลิก',hydration:'คุมมิเตอร์ที่ 45–65%',plate:'เติมตามโควตาให้ครบเพื่อโบนัส'};
  const tipsMapEN={goodjunk:'Aim for good, avoid junk',groups:'Watch the 🎯 target on HUD',hydration:'Keep meter within 45–65%',plate:'Fill each quota to earn bonus'};
  const tip = (state.L==='TH'?tipsMapTH:tipsMapEN)[state.modeKey]||'';

  return {core,bd:bd+rubricHTML,tip, rb};
}

// ===== GAME STATE =====
function resetCtx(){
  state.ctx={goodHits:0,junkHits:0,targetHitsTotal:0,groupWrong:0,waterHits:0,sweetHits:0,plateFills:0,perfectPlates:0,overfillCount:0};
  state.totals={spawns:0, clicks:0, hits:0, misses:0, powers:0};
}
function start(){ document.getElementById('help').style.display='none'; coach?.onStart?.(state.modeKey);
  state.diffCfg=DIFFS[state.difficulty]||DIFFS.Normal;
  state.running=true; state.paused=false;
  state.timeLeft=state.diffCfg.time; spawnCount=0; resetCtx();
  systems.score.reset(); setupLanes();
  document.getElementById('hydroWrap').style.display='none';
  document.getElementById('targetWrap').style.display='none';
  document.getElementById('plateTracker').style.display='none';
  if (MODES[state.modeKey].init) MODES[state.modeKey].init(state,hud,state.diffCfg);
  updateHUD();
  setTimeout(spawnOnce,200);
  runSpawn(); runTimer();
  document.getElementById('c').style.pointerEvents='auto';
}
function pause(){ if(!state.running) return; state.paused=!state.paused; if(!state.paused){ runSpawn(); runTimer(); } }
function end(){
  state.running=false; state.paused=false;
  clearTimeout(spawnTimer); clearTimeout(timeTimer);
  document.getElementById('c').style.pointerEvents='none';
  systems.board.submit(state.modeKey, state.difficulty, systems.score.score);
  const lang=L();
  document.getElementById('resTitle').textContent=lang.result.title;
  const {core,bd,tip,rb}=buildResult();
  try{ coach?.onEnd?.(systems.score.score|0, rb, state); }catch{}
  document.getElementById('resCore').innerHTML = core;
  const career = updateCareer(systems.score.score|0, rb);
  const careerHTML = `<div style="margin-top:8px;border-top:1px dashed #0ff;padding-top:8px">
    <b>Career Stats</b> — Sessions: <b>${career.sessions||1}</b> • Best Score: <b>${career.bestScore||0}</b> • Best Grade: <b>${career.bestGrade||'E'}</b> • Avg Accuracy: <b>${career.avgAccuracy||0}%</b>
  </div>`;
  document.getElementById('resBreakdown').innerHTML = bd + careerHTML;
  document.getElementById('resTips').textContent = lang.result.tips+': '+tip;
  document.getElementById('result').style.display='flex';
}

// ===== BOOT =====
function boot(){
  const canvas=document.getElementById('c');
  const THREEwin = window.THREE;
  engine=new Engine(THREEwin,canvas);
  hud=new HUD(); floating=new FloatingFX(engine); coach=new Coach({persona:'C5', lang:'L3'});
  systems={ score:new ScoreSystem(), fever:new FeverSystem(), power:new PowerUpSystem(), mission:new MissionSystem(), board:new Leaderboard() };

  document.getElementById('langToggle')?.addEventListener('click', ()=>{ state.L = state.L==='TH' ? 'EN' : 'TH'; SETTINGS.lang=state.L; applyLanguage(); });
  document.getElementById('soundToggle')?.addEventListener('click', ()=>{ SETTINGS.sound=!SETTINGS.sound; applySound(); });
  document.getElementById('gfxSelect')?.addEventListener('change', (e)=>{ SETTINGS.quality=e.target.value||'High'; applyQuality(); });

  Object.keys(MODES).forEach(k=>{
    document.querySelector(`button[data-action="mode"][data-value="${k}"]`)?.addEventListener('click', ()=>{ state.modeKey=k; document.getElementById('modeName').textContent=L().modes[k]; });
  });
  ['Easy','Normal','Hard'].forEach(d=>{
    document.querySelector(`button[data-action="diff"][data-value="${d}"]`)?.addEventListener('click', ()=>{ state.difficulty=d; document.getElementById('difficulty').textContent=L().diff[d]; });
  });

  document.querySelector('button[data-action="start"]')?.addEventListener('click', start);
  document.querySelector('button[data-action="pause"]')?.addEventListener('click', pause);
  document.querySelector('button[data-action="restart"]')?.addEventListener('click', ()=>{ end(); start(); });
  document.querySelector('button[data-action="help"]')?.addEventListener('click', ()=>{
    const isTH = state.L==='TH';
    const common = isTH
      ? `• เลือกโหมด/ความยาก กด ▶ เริ่มเกม<br/>• แตะ/คลิกไอคอนอาหารเพื่อเก็บคะแนน<br/>• ⏸ พัก, ↻ เริ่มใหม่, 🇹🇭/🇬🇧 สลับภาษา, 🔊 ปิด/เปิดเสียง, Graphics ปรับคุณภาพ`
      : `• Choose mode/difficulty, press ▶ Start<br/>• Tap/Click food icons to score<br/>• ⏸ Pause, ↻ Restart, 🇹🇭/🇬🇧 language, 🔊 sound, Graphics quality`;
    const per = isTH
      ? {goodjunk:'🥗 ดี vs ขยะ: เก็บของดี (+5) เลี่ยงของขยะ (−2)',
         groups:'🍽️ จาน 5 หมู่: ดู 🎯 แล้วเก็บให้ตรง (+7)',
         hydration:'💧 สมดุลน้ำ: คุม 45–65%; 💧 (+5), 🧋 (−3)',
         plate:'🍱 จัดจานสุขภาพ: เติมโควตาแต่ละหมวดให้ครบ ได้โบนัส'}
      : {goodjunk:'🥗 Good vs Junk: pick good (+5), avoid junk (−2)',
         groups:'🍽️ Food Groups: watch 🎯 then collect matching (+7)',
         hydration:'💧 Hydration: keep 45–65%; 💧 (+5), 🧋 (−3)',
         plate:'🍱 Healthy Plate: fill quota of each group for bonus'};
    document.getElementById('helpBody').innerHTML = common + '<br/><br/>' + (per[state.modeKey]||'');
    document.getElementById('help').style.display='flex';
  });
  document.getElementById('help')?.addEventListener('click',(e)=>{ if(e.target.getAttribute('data-action')==='helpClose' || e.target.id==='help') e.currentTarget.style.display='none'; });
  document.getElementById('result')?.addEventListener('click',(e)=>{
    const b=e.target.closest('button'); if(!b) return; const a=b.getAttribute('data-result');
    if(a==='replay'){ document.getElementById('result').style.display='none'; start(); }
    if(a==='home'){ document.getElementById('result').style.display='none'; }
  });

  const canvasEl=document.getElementById('c');
  canvasEl.addEventListener('click', onCanvasClick, {passive:true});
  canvasEl.addEventListener('touchstart', e=>{ const t=e.touches&&e.touches[0]; if(!t) return; onCanvasClick({clientX:t.clientX, clientY:t.clientY}); }, {passive:true});

  engine.startLoop(loop);
  applyLanguage(); applySound(); applyQuality();
}
if(document.readyState==='loading'){ window.addEventListener('DOMContentLoaded', boot); } else { boot(); }
