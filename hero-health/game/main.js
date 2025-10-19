// ./game/main.js — Integrated Main (imports modules)
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

const MODES = {
  goodjunk: GJ,
  groups: GP,
  hydration: HY,
  plate: PL
};

const DIFFS={
  Easy:{time:70, spawnBase:820, life:4200, trapRate:0.03, powerRate:0.10, hydWaterRate:0.78},
  Normal:{time:60, spawnBase:700, life:3000, trapRate:0.05, powerRate:0.08, hydWaterRate:0.66},
  Hard:{time:50, spawnBase:560, life:1900, trapRate:0.07, powerRate:0.06, hydWaterRate:0.55}
};
const LANGS=['TH','EN'];
const I18N={
  TH:{brand:'HERO HEALTH ACADEMY',
    modes:{goodjunk:'🥗 ดี vs ขยะ',groups:'🍽️ จาน 5 หมู่',hydration:'💧 สมดุลน้ำ',plate:'🍱 จัดจานสุขภาพ'},
    diff:{Easy:'ง่าย',Normal:'ปกติ',Hard:'ยาก'},
    helpTitle:'วิธีเล่น (How to Play)',
    buttons:{start:'▶ เริ่มเกม',pause:'⏸ พัก',restart:'↻ เริ่มใหม่',help:'❓ วิธีเล่น'},
    result:{title:'สรุปผล',tips:'เคล็ดลับ'}
  },
  EN:{brand:'HERO HEALTH ACADEMY',
    modes:{goodjunk:'🥗 Healthy vs Junk',groups:'🍽️ Food Groups',hydration:'💧 Hydration',plate:'🍱 Healthy Plate'},
    diff:{Easy:'Easy',Normal:'Normal',Hard:'Hard'},
    helpTitle:'How to Play',
    buttons:{start:'▶ Start',pause:'⏸ Pause',restart:'↻ Restart',help:'❓ Help'},
    result:{title:'Results',tips:'Tips'}
  }
};
const SETTINGS={lang:'TH',sound:true,quality:'High'};
const safeLang = v => LANGS.includes(v)?v:'TH';
const L = () => I18N[safeLang(SETTINGS.lang)] || I18N.TH;
const modeName = k => (L().modes||{})[k] || k;
const diffName = k => (L().diff||{})[k] || k;
const safeModeKey = v => (v && MODES[v]) ? v : 'goodjunk';
const safeDiffKey = v => (v && DIFFS[v]) ? v : 'Normal';

let engine,hud,floating,systems,coach;
const state={ modeKey:'goodjunk', difficulty:'Normal', diffCfg:DIFFS.Normal,
  running:false, paused:false, timeLeft:60, ACTIVE:new Set(), lane:{},
  ctx:{bestStreak:0,currentStreak:0,goodHits:0,junkCaught:0,targetHitsTotal:0,groupWrong:0,waterHits:0,sweetMiss:0,overHydPunish:0,lowSweetPunish:0,plateFills:0,perfectPlates:0,overfillCount:0,trapsHit:0,powersUsed:0,timeMinus:0,timePlus:0},
  hydMin:45,hydMax:65,hyd:50 };

const POWER_ITEMS=[{type:'power',kind:'slow',char:'⏳'},{type:'power',kind:'boost',char:'⭐'},{type:'power',kind:'shield',char:'🛡️'},{type:'power',kind:'timeplus',char:'⏱️➕'},{type:'power',kind:'timeminus',char:'⏱️➖'}];
const TRAP_ITEMS=[{type:'trap',kind:'bomb',char:'💣'},{type:'trap',kind:'bait',char:'🎭'}];

function applyLanguage(){
  document.querySelector('.brand div')?.replaceChildren(L().brand);
  ['goodjunk','groups','hydration','plate'].forEach(k=>{
    document.querySelector(`button[data-action="mode"][data-value="${k}"]`)?.replaceChildren(modeName(k));
  });
  ['Easy','Normal','Hard'].forEach(d=>{
    document.querySelector(`button[data-action="diff"][data-value="${d}"]`)?.replaceChildren(diffName(d));
  });
  document.querySelector('button[data-action="start"]')?.replaceChildren(L().buttons.start);
  document.querySelector('button[data-action="pause"]')?.replaceChildren(L().buttons.pause);
  document.querySelector('button[data-action="restart"]')?.replaceChildren(L().buttons.restart);
  document.querySelector('button[data-action="help"]')?.replaceChildren(L().buttons.help);
  document.querySelector('#help h2')?.replaceChildren(L().helpTitle);
  document.getElementById('resTitle')?.replaceChildren(L().result.title);
  document.getElementById('modeName')?.replaceChildren(modeName(state.modeKey));
  document.getElementById('difficulty')?.replaceChildren(diffName(state.difficulty));
}
function applySound(){ document.querySelectorAll('audio').forEach(a=>a.muted=!SETTINGS.sound); document.getElementById('soundToggle').textContent=SETTINGS.sound?'🔊':'🔇'; }
function applyQuality(){ const q=SETTINGS.quality; const dpr=q==='High'?(devicePixelRatio||1):q==='Medium'?Math.max(0.75,(devicePixelRatio||1)*0.75):0.5; try{ engine.renderer.setPixelRatio(dpr); engine.onResize?.(); }catch{} document.body.style.filter=(q==='Low')?'saturate(0.95) brightness(0.98)':(q==='Medium')?'saturate(1.0) brightness(1.0)':''; }

document.addEventListener('click',(e)=>{
  const btn=e.target.closest('#menuBar button'); if(!btn) return;
  e.preventDefault(); e.stopPropagation();
  const act=btn.getAttribute('data-action')||'', val=btn.getAttribute('data-value')||'';
  if(act==='diff'){ state.difficulty=safeDiffKey(val); state.diffCfg=DIFFS[state.difficulty]; document.getElementById('difficulty').replaceChildren(diffName(state.difficulty)); document.getElementById('modeName').replaceChildren(modeName(state.modeKey)); return; }
  if(act==='mode'){ state.modeKey=safeModeKey(val); document.getElementById('modeName').replaceChildren(modeName(state.modeKey)); updateHUD(); return; }
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

function openHelpFor(modeKey){
  const isTH = SETTINGS.lang==='TH';
  const title = isTH ? 'วิธีเล่น (How to Play)' : 'How to Play';
  const common = isTH
    ? `• เลือกโหมด/ความยากที่แถบล่าง แล้วกด ▶ เริ่มเกม<br/>• แตะ/คลิกไอคอนอาหารเพื่อเก็บคะแนน (เข้า VR ได้ถ้ารองรับ)<br/>• ⏸ พัก, ↻ เริ่มใหม่, 🇹🇭/🇬🇧 สลับภาษา, 🔊 ปิด/เปิดเสียง, Graphics ปรับคุณภาพ`
    : `• Choose mode/difficulty, press ▶ Start<br/>• Tap/Click food icons to score (Enter VR if supported)<br/>• ⏸ Pause, ↻ Restart, 🇹🇭/🇬🇧 toggle language, 🔊 mute, Graphics quality`;
  const perModeTH = {
    goodjunk: '🥗 ดี vs ขยะ: เก็บของ “ดี” (+5) เลี่ยงของ “ขยะ” (−2)',
    groups: '🍽️ จาน 5 หมู่: ดู 🎯 หมวดเป้าหมายบน HUD แล้วเก็บให้ตรง (+7)',
    hydration: '💧 สมดุลน้ำ: คุม 45–65%; เก็บ 💧 (+5) เลี่ยง 🧋 (−3); เกิน/ขาดโดนหักเวลา',
    plate: '🍱 จัดจานสุขภาพ: เติมโควตาแต่ละหมวดให้ครบ ได้โบนัส'
  };
  const perModeEN = {
    goodjunk: '🥗 Good vs Junk: pick “good” (+5), avoid junk (−2)',
    groups: '🍽️ Food Groups: watch 🎯 target on HUD, collect matching (+7)',
    hydration: '💧 Hydration: keep 45–65%; 💧 (+5), 🧋 (−3); over/low penalizes time',
    plate: '🍱 Healthy Plate: fill each quota; complete set for bonus'
  };
  const per = isTH ? perModeTH : perModeEN;
  const html = `<b>${title}</b><br/>${common}<br/><br/>${per[modeKey]||''}`;
  document.getElementById('helpBody').innerHTML = html;
  document.getElementById('help').style.display = 'flex';
}

// lanes / spawn
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

function rand(a){ return a[Math.floor(Math.random()*a.length)]; }
const POWER_ITEMS=[{type:'power',kind:'slow',char:'⏳'},{type:'power',kind:'boost',char:'⭐'},{type:'power',kind:'shield',char:'🛡️'},{type:'power',kind:'timeplus',char:'⏱️➕'},{type:'power',kind:'timeminus',char:'⏱️➖'}];
const TRAP_ITEMS=[{type:'trap',kind:'bomb',char:'💣'},{type:'trap',kind:'bait',char:'🎭'}];
function maybeSpecialMeta(base){ const r=Math.random(),t=state.diffCfg?.trapRate??0.05,p=state.diffCfg?.powerRate??0.08; if(r<p) return rand(POWER_ITEMS); if(r<p+t) return rand(TRAP_ITEMS); return base; }

function spawnOnce(){
  const lane=pickLane(); if(!lane) return;
  let meta = (MODES[state.modeKey].pickMeta?.(state.diffCfg,state)) || {type:'gj',good:true,char:'🍎'};
  if(state.modeKey==='hydration'){ const rate=state.diffCfg?.hydWaterRate??0.66; const water=Math.random()<rate; meta={type:'hydra',water,char:water?'💧':'🧋'}; }
  meta = maybeSpecialMeta(meta);

  const m=engine.makeBillboard(meta.char);
  m.position.set(lane.x,lane.y,lane.z);
  m.userData={lane:lane.key,meta};
  engine.group.add(m); state.ACTIVE.add(m);

  const life=state.diffCfg?.life||3000;
  m.userData.timer=setTimeout(()=>{ if(!m.parent) return;
    if(meta.type==='gj' && meta.good===false){ systems.score.add(1); }
    if(meta.type==='groups'){ if(!(state.currentTarget && meta.group===state.currentTarget)){ state.ctx.groupWrong++; } }
    if(meta.type==='hydra' && meta.water===false){ systems.score.add(1); state.ctx.sweetMiss++; }
    updateHUD(); destroy(m);
  }, life + Math.floor(Math.random()*500-250));
}
function destroy(obj){
  if(obj.userData?.timer){ clearTimeout(obj.userData.timer); obj.userData.timer=null; }
  if(obj.parent) obj.parent.remove(obj); state.ACTIVE.delete(obj); if(obj.userData?.lane) releaseLane(obj.userData.lane);
}
function hit(obj){
  const meta=obj.userData.meta;
  const baseAdd=systems.score.add.bind(systems.score);
  systems.score.add=(v)=>baseAdd(v*(systems.fever.active?2:1)*(1+systems.power.scoreBoost));
  MODES[state.modeKey].onHit?.(meta, systems, state, hud);

  if(state.modeKey==='hydration' && meta.type==='hydra' && meta.water===true && state.hyd>(state.hydMax||65)){
    systems.score.add(-4); state.timeLeft=Math.max(0,state.timeLeft-3); state.ctx.overHydPunish++; state.ctx.timeMinus+=3;
  }
  if(state.modeKey==='hydration' && meta.type==='hydra' && meta.water===false && state.hyd<(state.hydMin||45)){
    systems.score.add(-2); state.timeLeft=Math.max(0,state.timeLeft-2); state.ctx.lowSweetPunish++; state.ctx.timeMinus+=2;
  }
  if(meta.type==='power'){
    state.ctx.powersUsed++;
    if(meta.kind==='slow') systems.power.apply('slow');
    if(meta.kind==='boost') systems.power.apply('boost');
    if(meta.kind==='shield') systems.power.apply('shield');
    if(meta.kind==='timeplus'){ state.timeLeft=Math.min(120,state.timeLeft+5); state.ctx.timePlus+=5; }
    if(meta.kind==='timeminus'){ state.timeLeft=Math.max(0,state.timeLeft-5); state.ctx.timeMinus+=5; }
  }else if(meta.type==='trap'){
    state.ctx.trapsHit++;
    if(meta.kind==='bomb'){ if(!systems.power.consumeShield()){ systems.score.add(-6); } }
    if(meta.kind==='bait'){ if(!systems.power.consumeShield()){ systems.score.add(-4); } }
  }

  const mult=(systems.fever.active?2:1)*(1+systems.power.scoreBoost);
  const fmt=v=>`<b>${v>0?'+':''}${Math.round(v)}</b>`;
  let txt='', kind='good';
  if(meta.type==='gj'){ txt=meta.good?fmt(5*mult):fmt(-2); kind=meta.good?'good':'bad'; }
  else if(meta.type==='groups'){ const ok=(state.currentTarget && meta.group===state.currentTarget); txt=ok?fmt(7*mult):fmt(-2); kind=ok?'good':'bad'; }
  else if(meta.type==='hydra'){ txt=meta.water?fmt(5*mult):fmt(-3); kind=meta.water?'good':'bad'; }
  else if(meta.type==='plate'){ txt=fmt(6*mult); }
  else if(meta.type==='power'){ txt=meta.kind==='timeplus'?'<b>+5s</b>':meta.kind==='timeminus'?'<b>-5s</b>':meta.kind.toUpperCase(); kind= meta.kind==='timeminus'?'bad':'good'; }
  else if(meta.type==='trap'){ txt=meta.kind==='bomb'?fmt(-6):fmt(-4); kind='bad'; }
  (floating ||= new FloatingFX(engine)).spawn3D(obj, txt, kind);

  systems.score.add = baseAdd;
  updateHUD(); destroy(obj);
}

function onCanvasClick(ev){
  if(!state.running || state.paused) return;
  const x=ev.clientX ?? (ev.touches&&ev.touches[0].clientX);
  const y=ev.clientY ?? (ev.touches&&ev.touches[0].clientY);
  const inter=engine.raycastFromClient(x,y); if(inter.length) hit(inter[0].object);
}

function updateHUD(){
  const sc=systems?.score?.score ?? 0, cb=systems?.score?.combo ?? 1, tl=state?.timeLeft ?? 0;
  hud.setScore(sc); hud.setCombo(cb); hud.setTime(tl);
  hud.setDiff( diffName(safeDiffKey(state.difficulty)) );
  hud.setMode( modeName(safeModeKey(state.modeKey)) );
  hud.fever(!!systems?.fever?.active);
}
function buildBreakdownAndTips(){
  const m=state.modeKey,c=state.ctx; let html='',tip='';
  if(m==='goodjunk'){ html=`<ul><li>Power-ups: <b>${c.powersUsed}</b> | Trap: <b>${c.trapsHit}</b></li></ul>`; tip='เล็งของดี เลี่ยง Trap'; }
  else if(m==='groups'){ html=`<ul><li>ตรงหมวดเป้าหมาย: <b>${c.targetHitsTotal}</b></li><li>ผิดหมวด/พลาด: <b>${c.groupWrong}</b></li></ul>`; tip='ดู 🎯 บน HUD ก่อนคลิก'; }
  else if(m==='hydration'){ const h=Math.round(state.hyd||0); html=`<ul><li>น้ำ: <b>${c.waterHits||0}</b> | หวานพลาด: <b>${c.sweetMiss||0}</b></li><li>Over: <b>${c.overHydPunish||0}</b> | Low: <b>${c.lowSweetPunish||0}</b></li><li>เวลาถูกหัก: <b>${c.timeMinus||0}s</b> | เพิ่มเวลา: <b>${c.timePlus||0}s</b></li><li>มิเตอร์สุดท้าย: <b>${h}%</b></li></ul>`; tip='คุม 45–65%'; }
  else if(m==='plate'){ html=`<ul><li>เติมชิ้นในจาน: <b>${c.plateFills||0}</b> | PERFECT: <b>${c.perfectPlates||0}</b></li><li>เกินโควตา: <b>${c.overfillCount||0}</b></li></ul>`; tip='เติมตามโควตาให้ครบ'; }
  return {html,tip};
}
function presentResult(finalScore){
  document.getElementById('resTitle').textContent=L().result.title;
  document.getElementById('resScore').textContent=finalScore;
  document.getElementById('resTime').textContent=Math.max(0,state.timeLeft|0);
  document.getElementById('resMode').textContent=modeName(state.modeKey);
  document.getElementById('resDiff').textContent=diffName(state.difficulty);
  document.getElementById('resCombo').textContent='x'+(systems.score.bestCombo||systems.score.combo||1);
  const {html,tip}=buildBreakdownAndTips();
  document.getElementById('resBreakdown').innerHTML=html;
  document.getElementById('resTips').textContent=(L().result.tips+': '+tip);
  document.getElementById('result').style.display='flex';
}

// loop/timer
let spawnTimer=null,timeTimer=null,spawnCount=0,lastTs=performance.now();
function loop(){
  const ts=performance.now(), dt=ts-lastTs; lastTs=ts;
  systems.fever.update(dt); systems.power.tick(dt);
  if(state.running && state.modeKey==='hydration'){
    state.hyd = Math.max(0, Math.min(100, state.hyd - 0.0003*dt*(systems.power.timeScale||1)));
    loop._hydTick=(loop._hydTick||0)+dt;
    const z=state.hyd<state.hydMin?'low':(state.hyd>state.hydMax?'high':'ok');
    loop._lowAccum=(loop._lowAccum||0)+(z==='low'?dt:0);
    if(loop._hydTick>1000){ loop._hydTick=0; if(z==='ok'){ systems.score.add(1);} document.getElementById('hydroWrap').style.display='block'; hud.setHydration(state.hyd,z); }
    if(loop._lowAccum>=4000){ loop._lowAccum=0; systems.score.add(-1); state.timeLeft=Math.max(0,state.timeLeft-1); state.ctx.timeMinus=(state.ctx.timeMinus||0)+1; }
  }
  updateHUD();
}
function runSpawn(){
  if(!state.running || state.paused) return;
  spawnOnce(); spawnCount++;
  const base=state.diffCfg?.spawnBase||700;
  const accel=Math.max(0.5,1-(spawnCount/120));
  const feverBoost=systems.fever.active?0.82:1.0;
  const next=Math.max(280, base*accel*feverBoost*systems.power.timeScale);
  spawnTimer=setTimeout(runSpawn,next);
}
function runTimer(){
  if(!state.running || state.paused) return;
  timeTimer=setTimeout(()=>{ state.timeLeft--; if(state.timeLeft<=0){ end(); } else runTimer(); updateHUD(); },1000);
}

// state start/pause/end
function start(){
  document.getElementById('help').style.display='none';
  coach?.onStart?.();

  state.diffCfg=DIFFS[state.difficulty]||DIFFS.Normal;
  state.running=true; state.paused=false;
  state.timeLeft=state.diffCfg.time; spawnCount=0;
  systems.score.reset(); setupLanes();
  state.ctx={bestStreak:0,currentStreak:0,goodHits:0,junkCaught:0,targetHitsTotal:0,groupWrong:0,waterHits:0,sweetMiss:0,overHydPunish:0,lowSweetPunish:0,plateFills:0,perfectPlates:0,overfillCount:0,trapsHit:0,powersUsed:0,timeMinus:0,timePlus:0};

  if(state.modeKey==='hydration') document.getElementById('hydroWrap').style.display='block'; else document.getElementById('hydroWrap').style.display='none';
  if(state.modeKey!=='groups') document.getElementById('targetWrap').style.display='none';
  if(state.modeKey!=='plate')  document.getElementById('plateTracker').style.display='none';

  MODES[state.modeKey].init?.(state, hud, state.diffCfg);

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
  const bonus=systems.mission.evaluate({...state.ctx, combo: systems.score.combo}); if(bonus>0){ systems.score.score+=bonus; }
  systems.board.submit(state.modeKey, state.difficulty, systems.score.score);
  systems.score.finalizeRun({mode:state.modeKey,diff:state.difficulty});
  coach?.onEnd?.();
  presentResult(systems.score.score);
  [...state.ACTIVE].forEach(obj => destroy(obj));
}

// boot
function boot(){
  const canvas=document.getElementById('c');
  const THREEref = THREE;
  if(!THREEref) console.error('[HHA] THREE not found on window. Ensure three.min.js loads before main.js');
  engine=new Engine(THREEref,canvas);
  hud=new HUD(); floating=new FloatingFX(engine);
  coach=new Coach();

  systems={
    score:new ScoreSystem({
      getMultiplier: ()=> (systems?.fever?.scoreMul?.()||1)*(1+(systems?.power?.scoreBoost||0)),
      onCombo: (x)=> coach?.onCombo?.(x),
      onLevelUp: ({level})=> coach?.say?.(`Level up! Lv.${level}`),
      onRankUp:  ({rank}) => coach?.say?.(`Rank: ${rank}`)
    }),
    fever:new FeverSystem(),
    power:new PowerUpSystem(),
    mission:new MissionSystem(),
    board:new Leaderboard()
  };

  document.getElementById('langToggle')?.addEventListener('click', ()=>{ SETTINGS.lang=SETTINGS.lang==='TH'?'EN':'TH'; applyLanguage(); });
  document.getElementById('soundToggle')?.addEventListener('click', ()=>{ SETTINGS.sound=!SETTINGS.sound; applySound(); });
  document.getElementById('gfxSelect')?.addEventListener('change', (e)=>{ SETTINGS.quality=e.target.value||'High'; applyQuality(); });

  applyLanguage(); applySound(); applyQuality();

  const canvasEl=document.getElementById('c');
  canvasEl.addEventListener('click', onCanvasClick, {passive:true});
  canvasEl.addEventListener('touchstart', e=>{ const t=e.touches&&e.touches[0]; if(!t) return; onCanvasClick({clientX:t.clientX, clientY:t.clientY}); }, {passive:true});

  engine.startLoop(loop);

  window.onerror=(m,s,l,c)=>{
    const mk=()=>{ const d=document.getElementById('errors')||document.createElement('div'); d.id='errors'; d.style.cssText='position:fixed;top:8px;right:8px;background:rgba(30,0,0,.85);color:#ffb;border:1px solid #f66;padding:6px 10px;border-radius:8px;z-index:9999;max-width:60ch;white-space:pre-wrap'; if(!d.parentNode) document.body.appendChild(d); return d; };
    const d=mk(); d.textContent='Errors: '+m+' @'+(s||'inline')+':'+l+':'+c; d.style.display='block';
  };
}
if(document.readyState==='loading'){ window.addEventListener('DOMContentLoaded', boot); } else { boot(); }
