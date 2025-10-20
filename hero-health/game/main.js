// ./game/main.js — HERO HEALTH ACADEMY (Unified Build)
import { Engine } from './core/engine.js';
import { HUD } from './core/hud.js';
import { Coach } from './core/coach.js';
import { ScoreSystem } from './core/score.js';
import { FeverSystem } from './core/fever.js';
import { PowerUpSystem } from './core/powerup.js';
import { MissionSystem } from './core/mission.js';
import { Leaderboard } from './core/leaderboard.js';
import * as GJ from './modes/goodjunk.js';
import * as GR from './modes/groups.js';
import * as HY from './modes/hydration.js';
import * as PL from './modes/plate.js';
import { FloatingFX } from './ui/floatingfx.js';

const THREE = window?.THREE;
window.__HHA_BOOT = true;

// ===== Config =====
const SETTINGS = {
  lang: (navigator.language||'th').toLowerCase().startsWith('th') ? 'TH' : 'EN',
  sound: true,
  quality: 'High'
};
const DIFFS = {
  Easy:   { time:70, spawnBase:820, life:4200, trapRate:0.03, powerRate:0.10, hydWaterRate:0.78 },
  Normal: { time:60, spawnBase:700, life:3000, trapRate:0.05, powerRate:0.08, hydWaterRate:0.66 },
  Hard:   { time:50, spawnBase:560, life:1900, trapRate:0.07, powerRate:0.06, hydWaterRate:0.55 }
};
const MODES = { goodjunk:GJ, groups:GR, hydration:HY, plate:PL };

// ===== State =====
let engine, hud, floating, systems, coach;
const state = {
  modeKey:'goodjunk',
  difficulty:'Normal',
  diffCfg: DIFFS.Normal,
  running:false, paused:false,
  timeLeft:60,
  ACTIVE:new Set(),
  lane:{},
  ctx:{
    bestStreak:0,currentStreak:0,goodHits:0,junkCaught:0,
    targetHitsTotal:0,groupWrong:0,waterHits:0,sweetMiss:0,
    overHydPunish:0,lowSweetPunish:0,plateFills:0,perfectPlates:0,
    overfillCount:0,trapsHit:0,powersUsed:0,timeMinus:0,timePlus:0
  },
  hydMin:45, hydMax:65, hyd:50
};

// ===== I18N helpers =====
function applyLanguage(){
  const map = (SETTINGS.lang==='TH'
    ? { goodjunk:'🥗 ดี vs ขยะ', groups:'🍽️ จาน 5 หมู่', hydration:'💧 สมดุลน้ำ', plate:'🍱 จัดจานสุขภาพ',
        start:'▶ เริ่มเกม', pause:'⏸ พัก', restart:'↻ เริ่มใหม่', help:'❓ วิธีเล่น',
        diff:{Easy:'ง่าย',Normal:'ปกติ',Hard:'ยาก'}, helpTitle:'วิธีเล่น (How to Play)', resultTitle:'สรุปผล' }
    : { goodjunk:'🥗 Healthy vs Junk', groups:'🍽️ Food Groups', hydration:'💧 Hydration', plate:'🍱 Healthy Plate',
        start:'▶ Start', pause:'⏸ Pause', restart:'↻ Restart', help:'❓ Help',
        diff:{Easy:'Easy',Normal:'Normal',Hard:'Hard'}, helpTitle:'How to Play', resultTitle:'Results' }
  );
  document.querySelector('.brand div')?.replaceChildren('HERO HEALTH ACADEMY');
  for(const k of ['goodjunk','groups','hydration','plate']){
    const b=document.querySelector(`button[data-action="mode"][data-value="${k}"]`);
    if(b) b.textContent = map[k];
  }
  for(const d of ['Easy','Normal','Hard']){
    const b=document.querySelector(`button[data-action="diff"][data-value="${d}"]`);
    if(b) b.textContent = map.diff[d];
  }
  const m=document.getElementById('modeName'); if(m) m.textContent=map[state.modeKey]||state.modeKey;
  const df=document.getElementById('difficulty'); if(df) df.textContent=map.diff[state.difficulty];
  document.querySelector('button[data-action="start"]')?.replaceChildren(map.start);
  document.querySelector('button[data-action="pause"]')?.replaceChildren(map.pause);
  document.querySelector('button[data-action="restart"]')?.replaceChildren(map.restart);
  document.querySelector('button[data-action="help"]')?.replaceChildren(map.help);
  document.querySelector('#help h2')?.replaceChildren(map.helpTitle);
  document.getElementById('resTitle')?.replaceChildren(map.resultTitle);
}
function applySound(){
  document.querySelectorAll('audio').forEach(a=>a.muted=!SETTINGS.sound);
  const t=document.getElementById('soundToggle'); if(t) t.textContent=SETTINGS.sound?'🔊':'🔇';
}
function applyQuality(){
  const q=SETTINGS.quality;
  const dpr=q==='High'?(devicePixelRatio||1):q==='Medium'?Math.max(0.75,(devicePixelRatio||1)*0.75):0.5;
  try{ engine.renderer.setPixelRatio(dpr); engine.onResize?.(); }catch{}
}

function openHelpFor(modeKey){
  const isTH = SETTINGS.lang==='TH';
  const common = isTH
    ? `• เลือกโหมด/ความยากแล้วกด ▶ เริ่มเกม<br/>• แตะ/คลิกไอคอนอาหารเพื่อเก็บคะแนน (เข้า VR ได้ถ้ารองรับ)`
    : `• Choose mode/difficulty then ▶ Start<br/>• Tap/Click food icons to score (VR supported where available)`;
  const perTH = {
    goodjunk: '🥗 ดี vs ขยะ: เก็บของ “ดี” (+5) เลี่ยงของ “ขยะ” (−2)',
    groups: '🍽️ จาน 5 หมู่: ดู 🎯 หมวดเป้าหมายบน HUD แล้วเก็บให้ตรง (+7)',
    hydration: '💧 สมดุลน้ำ: คุม 45–65%; เก็บ 💧 (+5) เลี่ยง 🧋 (−3)',
    plate: '🍱 จัดจานสุขภาพ: เติมโควตาแต่ละหมวดให้ครบ ได้โบนัส'
  };
  const perEN = {
    goodjunk: '🥗 Good vs Junk: pick “good” (+5), avoid junk (−2)',
    groups: '🍽️ Food Groups: watch 🎯 target, collect matching (+7)',
    hydration: '💧 Hydration: keep 45–65%; 💧 (+5), 🧋 (−3)',
    plate: '🍱 Healthy Plate: fill each quota; bonus on completion'
  };
  document.getElementById('helpBody').innerHTML = common + '<br/><br/>' + (isTH? perTH[modeKey]: perEN[modeKey]);
  document.getElementById('help').style.display='flex';
}

// ===== Menus / Events =====
document.addEventListener('click',(e)=>{
  const btn=e.target.closest('#menuBar button'); if(!btn) return;
  e.preventDefault(); e.stopPropagation();
  const act=btn.getAttribute('data-action')||'', val=btn.getAttribute('data-value')||'';
  if(act==='diff'){ state.difficulty=val; state.diffCfg=DIFFS[state.difficulty]; applyLanguage(); return; }
  if(act==='mode'){ state.modeKey=val; applyLanguage(); return; }
  if(act==='start') start();
  else if(act==='pause') pause();
  else if(act==='restart'){ end(); start(); }
  else if(act==='help'){ openHelpFor(state.modeKey); }
}, false);

document.getElementById('help')?.addEventListener('click',(e)=>{
  if(e.target.getAttribute('data-action')==='helpClose' || e.target.id==='help') e.currentTarget.style.display='none';
});
document.getElementById('result')?.addEventListener('click',(e)=>{
  const b=e.target.closest('button'); if(!b) return;
  const a=b.getAttribute('data-result');
  if(a==='replay'){ document.getElementById('result').style.display='none'; start(); }
  if(a==='home'){ document.getElementById('result').style.display='none'; }
});

// ===== Lanes / Spawn =====
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
function maybeSpecialMeta(base){ const r=Math.random(), p=state.diffCfg?.powerRate??0.08; if(r<p) return POWER_ITEMS[Math.floor(Math.random()*POWER_ITEMS.length)]; return base; }

function spawnOnce(){
  const lane=pickLane(); if(!lane) return;
  let meta = MODES[state.modeKey].pickMeta(state.diffCfg,state);
  meta = maybeSpecialMeta(meta);
  const m=engine.makeBillboard(meta.char);
  m.position.set(lane.x,lane.y,lane.z);
  m.userData={lane:lane.key,meta};
  engine.group.add(m); state.ACTIVE.add(m);

  const life=state.diffCfg?.life||3000;
  m.userData.timer=setTimeout(()=>{ if(!m.parent) return; updateHUD(); destroy(m); }, life + Math.floor(Math.random()*500-250));
}

function destroy(obj){
  if(obj.userData?.timer) clearTimeout(obj.userData.timer);
  if(obj.parent) obj.parent.remove(obj);
  state.ACTIVE.delete(obj);
  if(obj.userData?.lane) releaseLane(obj.userData.lane);
}

// ===== Hit =====
function hit(obj){
  const meta=obj.userData.meta;
  const baseAdd=systems.score.add.bind(systems.score);
  systems.score.add=(v)=>baseAdd(v*(systems.fever.active?2:1)*(1+systems.power.scoreBoost));

  // onHit ของโหมด
  if(MODES[state.modeKey].onHit) MODES[state.modeKey].onHit(meta, systems, state, hud);

  // Power-ups
  if(meta.type==='power'){
    state.ctx.powersUsed++;
    if(meta.kind==='slow') systems.power.apply('slow');
    if(meta.kind==='boost') systems.power.apply('boost');
    if(meta.kind==='shield') systems.power.apply('shield');
    coach?.onPower?.(meta.kind);
  }

  // FX float text
  const mult=(systems.fever.active?2:1)*(1+systems.power.scoreBoost);
  const fmt=v=>`<b>${v>0?'+':''}${Math.round(v)}</b>`;
  let txt='', kind='good';
  if(meta.type==='gj'){ txt=meta.good?fmt(5*mult):fmt(-2); kind=meta.good?'good':'bad'; }
  else if(meta.type==='groups'){ txt=fmt(7*mult); }
  else if(meta.type==='hydra'){ txt=meta.water?fmt(5*mult):fmt(-3); kind=meta.water?'good':'bad'; }
  else if(meta.type==='plate'){ txt=fmt(6*mult); }
  else if(meta.type==='power'){ txt=meta.kind.toUpperCase(); }
  (floating ||= new FloatingFX(engine)).spawn3D(obj, txt, kind);

  systems.score.add = baseAdd;
  updateHUD(); destroy(obj);
}

// ===== Input =====
function onCanvasClick(ev){
  if(!state.running || state.paused) return;
  const x=ev.clientX ?? (ev.touches&&ev.touches[0].clientX);
  const y=ev.clientY ?? (ev.touches&&ev.touches[0].clientY);
  const inter=engine.raycastFromClient(x,y); if(inter.length) hit(inter[0].object);
}

// ===== HUD / Result =====
function updateHUD(){
  const sc=systems?.score?.score ?? 0, cb=systems?.score?.combo ?? 1, tl=state?.timeLeft ?? 0;
  hud.setScore(sc); hud.setCombo(cb); hud.setTime(tl);
  const diffName = (SETTINGS.lang==='TH'? {Easy:'ง่าย',Normal:'ปกติ',Hard:'ยาก'}:{Easy:'Easy',Normal:'Normal',Hard:'Hard'})[state.difficulty];
  const modeName = (SETTINGS.lang==='TH'
    ? {goodjunk:'🥗 ดี vs ขยะ',groups:'🍽️ จาน 5 หมู่',hydration:'💧 สมดุลน้ำ',plate:'🍱 จัดจานสุขภาพ'}
    : {goodjunk:'🥗 Healthy vs Junk',groups:'🍽️ Food Groups',hydration:'💧 Hydration',plate:'🍱 Healthy Plate'})[state.modeKey];
  hud.setDiff(diffName); hud.setMode(modeName);
  if (typeof hud.fever === 'function') hud.fever(!!systems?.fever?.active);
}

function presentResult(finalScore){
  const isTH = SETTINGS.lang==='TH';
  const core = `${isTH?'คะแนน':'Score'}: <b>${finalScore}</b> | ${isTH?'เวลาเหลือ':'Time Left'}: <b>${Math.max(0,state.timeLeft|0)}s</b> | ${isTH?'คอมโบสูงสุด':'Best Combo'}: <b>x${systems.score.bestCombo||systems.score.combo||1}</b>`;
  document.getElementById('resCore').innerHTML = core;
  const tip = isTH? 'คุมเป้าหมาย และเลี่ยงกับดัก' : 'Focus objectives, avoid traps';
  document.getElementById('resTips').textContent = (isTH?'เคล็ดลับ':'Tips')+': '+tip;
  document.getElementById('result').style.display='flex';
}

// ===== Loop / Timers =====
let spawnTimer=null,timeTimer=null,spawnCount=0,lastTs=performance.now();
function loop(){ const ts=performance.now(), dt=ts-lastTs; lastTs=ts; systems.fever.update(dt); systems.power.tick(dt); updateHUD(); }
function runSpawn(){ if(!state.running || state.paused) return; spawnOnce(); spawnCount++; const base=state.diffCfg?.spawnBase||700; const accel=Math.max(0.5,1-(spawnCount/120)); const next=Math.max(280, base*accel*systems.power.timeScale); spawnTimer=setTimeout(runSpawn,next); }
function runTimer(){ if(!state.running || state.paused) return; timeTimer=setTimeout(()=>{ state.timeLeft--; if(state.timeLeft<=0){ end(); } else runTimer(); updateHUD(); },1000); }

// ===== Game State =====
function start(){
  document.getElementById('help').style.display='none';
  coach?.onStart?.(state.modeKey);

  state.diffCfg=DIFFS[state.difficulty]||DIFFS.Normal;
  state.running=true; state.paused=false;
  state.timeLeft=state.diffCfg.time; spawnCount=0;
  systems.score.reset(); setupLanes();

  // reset ctx
  state.ctx={
    bestStreak:0,currentStreak:0,goodHits:0,junkCaught:0,
    targetHitsTotal:0,groupWrong:0,waterHits:0,sweetMiss:0,
    overHydPunish:0,lowSweetPunish:0,plateFills:0,perfectPlates:0,
    overfillCount:0,trapsHit:0,powersUsed:0,timeMinus:0,timePlus:0
  };

  // ✅ เรียก init ของโหมดเสมอ
  if (MODES[state.modeKey]?.init){
    MODES[state.modeKey].init(state, hud, state.diffCfg);
  }

  // ✅ แสดง/ซ่อน HUD ตามโหมด — target ใช้ทั้ง groups และ plate
  document.getElementById('hydroWrap').style.display  = (state.modeKey==='hydration' ? 'block' : 'none');
  document.getElementById('targetWrap').style.display = ((state.modeKey==='groups' || state.modeKey==='plate') ? 'block' : 'none');
  document.getElementById('plateTracker').style.display = (state.modeKey==='plate' ? 'block' : 'none');

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
  coach?.onEnd?.(systems.score.score|0, null, state);
  presentResult(systems.score.score);
  [...state.ACTIVE].forEach(obj => destroy(obj));
}

// ===== Boot =====
function boot(){
  const canvas=document.getElementById('c');
  engine=new Engine(THREE,canvas); hud=new HUD(); floating=new FloatingFX(engine); coach = new Coach({ lang:'L3' });
  systems={ score:new ScoreSystem(), fever:new FeverSystem(), power:new PowerUpSystem(), mission:new MissionSystem(), board:new Leaderboard() };

  // top-right controls
  document.getElementById('langToggle')?.addEventListener('click', ()=>{ SETTINGS.lang=SETTINGS.lang==='TH'?'EN':'TH'; applyLanguage(); });
  document.getElementById('soundToggle')?.addEventListener('click', ()=>{ SETTINGS.sound=!SETTINGS.sound; applySound(); });
  document.getElementById('gfxSelect')?.addEventListener('change', (e)=>{ SETTINGS.quality=e.target.value||'High'; applyQuality(); });

  // input
  const canvasEl=document.getElementById('c');
  canvasEl.addEventListener('click', onCanvasClick, {passive:true});
  canvasEl.addEventListener('touchstart', e=>{ const t=e.touches&&e.touches[0]; if(!t) return; onCanvasClick({clientX:t.clientX, clientY:t.clientY}); }, {passive:true});

  engine.startLoop(loop);
  applyLanguage(); applySound(); applyQuality();

  // error overlay
  window.onerror=(m,s,l,c)=>{ const mk=()=>{ const d=document.getElementById('errors')||document.createElement('div'); d.id='errors'; d.style.cssText='position:fixed;top:8px;right:8px;background:rgba(30,0,0,.85);color:#ffb;border:1px solid #f66;padding:6px 10px;border-radius:8px;z-index:9999;max-width:60ch;white-space:pre-wrap'; if(!d.parentNode) document.body.appendChild(d); return d; }; const d=mk(); d.textContent='Errors: '+m+' @'+(s||'inline')+':'+l+':'+c; d.style.display='block'; };
}
if(document.readyState==='loading'){ window.addEventListener('DOMContentLoaded', boot); } else { boot(); }
