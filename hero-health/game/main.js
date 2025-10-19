// ./game/main.js — HERO HEALTH ACADEMY (FEVER = A + B + C)
import { Engine } from './core/engine.js';
import { Coach } from './core/coach.js';
import { HUD } from './core/hud.js';
import { FloatingFX } from './core/fx.js';

import * as GoodJunk   from './modes/goodjunk.js';
import * as GroupsMode from './modes/groups.js';
import * as Hydration  from './modes/hydration.js';
import * as PlateMode  from './modes/plate.js';

// ====== GLOBALS & DEBUG ======
const THREE = window?.THREE;
if (!THREE) console.error('[HHA] THREE not found on window. Ensure three.min.js loads before main.js');

const DEBUG = localStorage.getItem('hha_debug') === '1';
const D = {
  log:  (...a) => { if (DEBUG) console.log('[HHA]', ...a); },
  warn: (...a) => { if (DEBUG) console.warn('[HHA]', ...a); },
  err:  (...a) => console.error('[HHA]', ...a),
};

window.__HHA_BOOT = true;

// ====== SAFE HELPERS ======
const LANGS = ['TH','EN'];
const safeLang = v => LANGS.includes(v) ? v : 'TH';
const safeKey = (obj, key, def) => (obj && key in obj) ? obj[key] : def;
const safeModeKey = v => (v && MODES[v]) ? v : 'goodjunk';
const safeDiffKey = v => (v && DIFFS[v]) ? v : 'Normal';
const L = () => I18N[safeLang(SETTINGS.lang)] || I18N.TH;
const modeName = k => safeKey(L().modes || {}, k, k || '—');
const diffName = k => safeKey(L().diff  || {}, k, k || 'Normal');

// ====== SYSTEMS ======
class ScoreSystem{
  constructor(){ this.reset(); }
  reset(){ this.score=0; this.combo=0; this.bestCombo=0; }
  add(v){
    const before = this.combo;
    this.score += v;

    if (v > 0) {
      this.combo++;
      this.bestCombo = Math.max(this.bestCombo, this.combo);

      // (A) FEVER: ทุกคอมโบครบ 5 ถ้ายังไม่ติด ให้ติด 6 วิ
      if (this.combo > 0 && this.combo % 5 === 0 && !systems.fever.active) {
        systems.fever.activate(6000);
        coach?.onFever?.();
      }
    }

    if (v < 0) this.bad();
    return this.score;
  }
  // ใช้เมื่อทำพลาดหนัก ๆ
  bad(){
    this.combo = 0;
    systems.fever.onBad();
  }
}

class FeverSystem{
  constructor(){
    this.timer = 0;
    this.active = false;
    this.charge = 0; // 0..100 for (B)
  }
  scoreMul(){ return this.active ? 2 : 1; }
  update(dt){
    if(this.active){
      this.timer -= dt;
      if(this.timer <= 0){ this.active = false; }
    }
  }
  onBad(){ this.active = false; /* ไม่หัก charge เพื่อให้ยังลุ้นเปิดจากเกจได้ */ }
  activate(ms=6000){
    this.active = true;
    this.timer = ms;
    this.charge = 0; // ใช้เกจแล้วรีเซ็ต
    hud?.fever?.(true);
    systems.fx?.fever?.();
  }
  chargeBy(v){ // (B) เติมเกจจากเหตุการณ์ "เพอร์เฟกต์"
    this.charge = Math.max(0, Math.min(100, this.charge + (v||0)));
    // เกจเต็ม เปิด FEVER อัตโนมัติ
    if (this.charge >= 100 && !this.active){
      this.activate(6000);
      coach?.onFever?.();
    }
  }
}

class PowerUpSystem{
  constructor(){ this.timeScale=1; this.scoreBoost=0; this._shield=0; }
  apply(k){
    if(k==='slow'){ this.timeScale=0.8; setTimeout(()=>this.timeScale=1,5000); }
    if(k==='boost'){ this.scoreBoost=0.5; setTimeout(()=>this.scoreBoost=0,5000); }
    if(k==='shield'){ this._shield=Math.min(2,this._shield+1); }
    if(k==='fever'){  systems.fever.activate(6000); coach?.onFever?.(); } // (C)
  }
  tick(dt){}
  consumeShield(){ if(this._shield>0){ this._shield--; return true;} return false; }
}

class MissionSystem{ roll(mode){ this.goal={mode,target:30}; } evaluate(ctx){ return 0; } }
class Leaderboard{
  submit(mode,diff,score){
    try{
      const k='hha_board';
      const arr=JSON.parse(localStorage.getItem(k)||'[]');
      arr.push({t:Date.now(),mode,diff,score});
      localStorage.setItem(k, JSON.stringify(arr.slice(-200)));
    }catch(e){ D.warn('leaderboard store failed', e); }
  }
}

// ====== CONFIG ======
const SETTINGS={lang:'TH',sound:true,quality:'High'};
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
const DIFFS={
  Easy:{time:70, spawnBase:820, life:4200, trapRate:0.03, powerRate:0.10, hydWaterRate:0.78},
  Normal:{time:60, spawnBase:700, life:3000, trapRate:0.05, powerRate:0.08, hydWaterRate:0.66},
  Hard:{time:50, spawnBase:560, life:1900, trapRate:0.07, powerRate:0.06, hydWaterRate:0.55}
};

// ====== MODES (เชื่อมกับโมดูล) ======
const MODES={
  goodjunk:{
    pickMeta(state){ return GoodJunk.pickMeta(state.diffCfg, state); },
    onHit(meta, sys){ return GoodJunk.onHit(meta, sys); }
  },
  groups:{
    init(state, hud){ return GroupsMode.init(state, hud, state.diffCfg); },
    pickMeta(state){ return GroupsMode.pickMeta(state.diffCfg, state); },
    onHit(meta, sys, state){
      const before = state.ctx.targetHitsTotal|0;
      const r = GroupsMode.onHit(meta, sys, state);
      // (B) ถ้าทำครบ 3 ชิ้นแล้วเปลี่ยนหมวด — ให้ชาร์จเกจ 50
      if ((state.ctx.targetHitsTotal|0) > before && (state.ctx.targetHitsTotal % 3) === 0){
        systems.fever.chargeBy(50);
      }
      return r;
    }
  },
  hydration:{
    init(state, hud){ return Hydration.init(state, hud); },
    pickMeta(state){ return Hydration.pickMeta(state.diffCfg, state); },
    onHit(meta, sys, state, hud){ return Hydration.onHit(meta, sys, state, hud); }
  },
  plate:{
    init(state, hud){ return PlateMode.init(state, hud); },
    pickMeta(state){ return PlateMode.pickMeta(state.diffCfg, state); },
    onHit(meta, sys, state){
      const before = state.ctx.perfectPlates|0;
      const r = PlateMode.onHit(meta, sys, state);
      // (B) ถ้าได้ Perfect plate ให้ชาร์จเกจเต็มเปิด FEVER ทันที
      if ((state.ctx.perfectPlates|0) > before){
        systems.fever.chargeBy(100);
        coach?.say?.('Perfect plate!');
      }
      return r;
    }
  }
};

// ====== utils ======
const rand = a => a[Math.floor(Math.random()*a.length)];

// ====== GLOBAL STATE ======
let engine, hud, floating, systems, coach;
const state={ modeKey:'goodjunk', difficulty:'Normal', diffCfg:DIFFS.Normal,
  running:false, paused:false, timeLeft:60, ACTIVE:new Set(), lane:{},
  ctx:{bestStreak:0,currentStreak:0,goodHits:0,junkCaught:0,targetHitsTotal:0,groupWrong:0,waterHits:0,sweetMiss:0,overHydPunish:0,lowSweetPunish:0,plateFills:0,perfectPlates:0,overfillCount:0,trapsHit:0,powersUsed:0,timeMinus:0,timePlus:0},
  hydMin:45,hydMax:65,hyd:50 };

// ====== MENUS / UI ======
function applyLanguage(){
  SETTINGS.lang = safeLang(SETTINGS.lang);
  state.modeKey = safeModeKey(state.modeKey);
  state.difficulty = safeDiffKey(state.difficulty);

  const brandDiv = document.querySelector('.brand div'); if (brandDiv) brandDiv.textContent = L().brand;

  ['goodjunk','groups','hydration','plate'].forEach(k=>{
    const b=document.querySelector(`button[data-action="mode"][data-value="${k}"]`);
    if (b) b.textContent = modeName(k);
  });
  ['Easy','Normal','Hard'].forEach(d=>{
    const b=document.querySelector(`button[data-action="diff"][data-value="${d}"]`);
    if (b) b.textContent = diffName(d);
  });

  const btnStart=document.querySelector('button[data-action="start"]');
  const btnPause=document.querySelector('button[data-action="pause"]');
  const btnRestart=document.querySelector('button[data-action="restart"]');
  const btnHelp=document.querySelector('button[data-action="help"]');
  if(btnStart) btnStart.textContent=L().buttons.start;
  if(btnPause) btnPause.textContent=L().buttons.pause;
  if(btnRestart) btnRestart.textContent=L().buttons.restart;
  if(btnHelp) btnHelp.textContent=L().buttons.help;

  const helpH2 = document.querySelector('#help h2'); if(helpH2) helpH2.textContent=L().helpTitle;
  const resTitle = document.getElementById('resTitle'); if(resTitle) resTitle.textContent=L().result.title;
  document.getElementById('modeName')?.replaceChildren(modeName(state.modeKey));
  document.getElementById('difficulty')?.replaceChildren(diffName(state.difficulty));
}
function applySound(){
  document.querySelectorAll('audio').forEach(a=>a.muted=!SETTINGS.sound);
  document.getElementById('soundToggle').textContent=SETTINGS.sound?'🔊':'🔇';
}
function applyQuality(){
  const q=SETTINGS.quality;
  const dpr=q==='High'?(devicePixelRatio||1):q==='Medium'?Math.max(0.75,(devicePixelRatio||1)*0.75):0.5;
  try{ engine.renderer.setPixelRatio(dpr); engine.onResize?.(); }catch{}
  document.body.style.filter=(q==='Low')?'saturate(0.95) brightness(0.98)':(q==='Medium')?'saturate(1.0) brightness(1.0)':'';
}

// Menu clicks
document.addEventListener('click',(e)=>{
  const btn=e.target.closest('#menuBar button'); if(!btn) return;
  e.preventDefault(); e.stopPropagation();
  const act=btn.getAttribute('data-action')||'', val=btn.getAttribute('data-value')||'';
  if(act==='diff'){
    state.difficulty=safeDiffKey(val); state.diffCfg=DIFFS[state.difficulty];
    document.getElementById('difficulty').replaceChildren(diffName(state.difficulty));
    document.getElementById('modeName').replaceChildren(modeName(state.modeKey));
    D.log('diff ->', state.difficulty);
    return;
  }
  if(act==='mode'){
    state.modeKey=safeModeKey(val);
    document.getElementById('modeName').replaceChildren(modeName(state.modeKey));
    updateHUD();
    D.log('mode ->', state.modeKey);
    return;
  }
  if(act==='start') start();
  else if(act==='pause') pause();
  else if(act==='restart'){ end(); start(); }
  else if(act==='help'){ openHelpFor(state.modeKey); }
}, false);

// dialogs
document.getElementById('help').addEventListener('click',(e)=>{
  if(e.target.getAttribute('data-action')==='helpClose' || e.target.id==='help') e.currentTarget.style.display='none';
});
document.getElementById('result').addEventListener('click',(e)=>{
  const b=e.target.closest('button'); if(!b) return;
  const a=b.getAttribute('data-result');
  if(a==='replay'){ document.getElementById('result').style.display='none'; start(); }
  if(a==='home'){ document.getElementById('result').style.display='none'; }
});

// Help content
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

// ====== LANES / SPAWN ======
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

// เพิ่มไอเท็ม fever (C)
const POWER_ITEMS=[
  {type:'power',kind:'slow',char:'⏳'},
  {type:'power',kind:'boost',char:'⭐'},
  {type:'power',kind:'shield',char:'🛡️'},
  {type:'power',kind:'timeplus',char:'⏱️➕'},
  {type:'power',kind:'timeminus',char:'⏱️➖'},
  {type:'power',kind:'fever',char:'🔥'}
];
const TRAP_ITEMS=[{type:'trap',kind:'bomb',char:'💣'},{type:'trap',kind:'bait',char:'🎭'}];

function maybeSpecialMeta(base){
  const r=Math.random(), t=state.diffCfg?.trapRate??0.05, p=state.diffCfg?.powerRate??0.08;
  if(r<p) return rand(POWER_ITEMS);
  if(r<p+t) return rand(TRAP_ITEMS);
  return base;
}

function spawnOnce(){
  const lane=pickLane(); if(!lane) return;
  let meta;
  if (state.modeKey==='goodjunk')  meta = GoodJunk.pickMeta(state.diffCfg, state);
  if (state.modeKey==='groups')    meta = GroupsMode.pickMeta(state.diffCfg, state);
  if (state.modeKey==='hydration') meta = Hydration.pickMeta(state.diffCfg, state);
  if (state.modeKey==='plate')     meta = PlateMode.pickMeta(state.diffCfg, state);

  meta = maybeSpecialMeta(meta);

  const m=engine.makeBillboard(meta.char);
  m.position.set(lane.x,lane.y,lane.z);
  m.userData={lane:lane.key,meta};
  engine.group.add(m); state.ACTIVE.add(m);

  const life=state.diffCfg?.life||3000;
  m.userData.timer=setTimeout(()=>{ if(!m.parent) return;
    // auto-miss resolve
    if(meta.type==='gj' && meta.good===false){ systems.score.add(1); }
    if(meta.type==='groups'){ if(!(state.currentTarget && meta.group===state.currentTarget)){ state.ctx.groupWrong++; } }
    if(meta.type==='hydra' && meta.water===false){ systems.score.add(1); state.ctx.sweetMiss++; }
    updateHUD(); destroy(m);
  }, life + Math.floor(Math.random()*500-250));
}

function destroy(obj){
  if(obj.userData?.timer) { clearTimeout(obj.userData.timer); obj.userData.timer=null; }
  if(obj.onBeforeDetach) { try{ obj.onBeforeDetach(); }catch{} }
  if(obj.parent) obj.parent.remove(obj);
  state.ACTIVE.delete(obj);
  if (obj.userData?.lane) releaseLane(obj.userData.lane);
}

// ====== HIT ======
function hit(obj){
  const meta=obj.userData.meta;
  const baseAdd=systems.score.add.bind(systems.score);
  systems.score.add=(v)=>baseAdd(v*systems.fever.scoreMul()*(1+systems.power.scoreBoost));

  // delegate to mode
  if(state.modeKey==='goodjunk')   GoodJunk.onHit(meta, systems);
  if(state.modeKey==='groups')     GroupsMode.onHit(meta, systems, state);
  if(state.modeKey==='hydration')  Hydration.onHit(meta, systems, state, hud);
  if(state.modeKey==='plate')      PlateMode.onHit(meta, systems, state);

  // hydration penalties after hit
  if(state.modeKey==='hydration' && meta.type==='hydra' && meta.water===true && state.hyd>(state.hydMax||65)){
    systems.score.add(-4); state.timeLeft=Math.max(0,state.timeLeft-3); state.ctx.overHydPunish++; state.ctx.timeMinus+=3;
  }
  if(state.modeKey==='hydration' && meta.type==='hydra' && meta.water===false && state.hyd<(state.hydMin||45)){
    systems.score.add(-2); state.timeLeft=Math.max(0,state.timeLeft-2); state.ctx.lowSweetPunish++; state.ctx.timeMinus+=2;
  }

  // specials
  if(meta.type==='power'){
    state.ctx.powersUsed++;
    if(meta.kind==='slow')      systems.power.apply('slow'),  coach?.say?.('Slow time!');
    if(meta.kind==='boost')     systems.power.apply('boost'), coach?.say?.('Score boost!');
    if(meta.kind==='shield')    systems.power.apply('shield'),coach?.say?.('Shield up!');
    if(meta.kind==='timeplus'){ state.timeLeft=Math.min(120,state.timeLeft+5); state.ctx.timePlus+=5; coach?.say?.('+5s'); }
    if(meta.kind==='timeminus'){ state.timeLeft=Math.max(0,state.timeLeft-5); state.ctx.timeMinus+=5; coach?.say?.('-5s'); }
    if(meta.kind==='fever'){    systems.power.apply('fever'); } // (C)
  }else if(meta.type==='trap'){
    state.ctx.trapsHit++;
    if(meta.kind==='bomb'){ if(!systems.power.consumeShield()){ systems.score.add(-6); coach?.say?.('Boom!'); } else { coach?.say?.('Blocked!'); } }
    if(meta.kind==='bait'){ if(!systems.power.consumeShield()){ systems.score.add(-4); coach?.say?.('Baited…'); } else { coach?.say?.('Blocked!'); } }
  }

  // floating text
  const mult=systems.fever.scoreMul()*(1+systems.power.scoreBoost);
  const fmt=v=>`<b>${v>0?'+':''}${Math.round(v)}</b>`;
  let txt='', kind='good';
  if(meta.type==='gj'){ txt=meta.good?fmt(5*mult):fmt(-2); kind=meta.good?'good':'bad'; }
  else if(meta.type==='groups'){ const ok=(state.currentTarget && meta.group===state.currentTarget); txt=ok?fmt(7*mult):fmt(-2); kind=ok?'good':'bad'; }
  else if(meta.type==='hydra'){ txt=meta.water?fmt(5*mult):fmt(-3); kind=meta.water?'good':'bad'; }
  else if(meta.type==='plate'){ txt=fmt(6*mult); }
  else if(meta.type==='power'){ txt=meta.kind==='timeplus'?'<b>+5s</b>':meta.kind==='timeminus'?'<b>-5s</b>':meta.kind.toUpperCase(); kind= meta.kind==='timeminus'?'bad':'good'; }
  else if(meta.type==='trap'){ txt=meta.kind==='bomb'?fmt(-6):fmt(-4); kind='bad'; }
  floating.spawn3D(obj, txt, kind);

  systems.score.add = baseAdd;
  updateHUD(); destroy(obj);
}

// ====== INPUT ======
function onCanvasClick(ev){
  if(!state.running || state.paused) return;
  const x=ev.clientX ?? (ev.touches&&ev.touches[0].clientX);
  const y=ev.clientY ?? (ev.touches&&ev.touches[0].clientY);
  const inter=engine.raycastFromClient(x,y); if(inter.length) hit(inter[0].object);
}

// ====== HUD / RESULT ======
function updateHUD(){
  const sc=systems?.score?.score ?? 0, cb=systems?.score?.combo ?? 1, tl=state?.timeLeft ?? 0;
  hud.setScore(sc); hud.setCombo(cb); hud.setTime(tl);
  hud.setDiff( diffName(safeDiffKey(state.difficulty)) );
  hud.setMode( modeName(safeModeKey(state.modeKey)) );
  hud.fever?.(!!systems?.fever?.active);
}
function buildBreakdownAndTips(){
  const m=state.modeKey,c=state.ctx; let html='',tip='';
  if(m==='goodjunk'){ html=`<ul><li>Power-ups: <b>${c.powersUsed}</b> | Trap: <b>${c.trapsHit}</b></li></ul>`; tip=SETTINGS.lang==='TH'?'เล็งของดี เลี่ยง Trap':'Aim good, avoid traps'; }
  else if(m==='groups'){ html=`<ul><li>ตรงหมวดเป้าหมาย: <b>${c.targetHitsTotal}</b></li><li>ผิดหมวด/พลาด: <b>${c.groupWrong}</b></li></ul>`; tip=SETTINGS.lang==='TH'?'ดู 🎯 บน HUD ก่อนคลิก':'Watch 🎯 on HUD'; }
  else if(m==='hydration'){ const h=Math.round(state.hyd||0); html=`<ul><li>น้ำ: <b>${c.waterHits||0}</b> | หวานพลาด: <b>${c.sweetMiss||0}</b></li><li>Over: <b>${c.overHydPunish||0}</b> | Low: <b>${c.lowSweetPunish||0}</b></li><li>เวลาถูกหัก: <b>${c.timeMinus||0}s</b> | เพิ่มเวลา: <b>${c.timePlus||0}s</b></li><li>มิเตอร์สุดท้าย: <b>${h}%</b></li></ul>`; tip=SETTINGS.lang==='TH'?'คุม 45–65%':'Keep 45–65%'; }
  else if(m==='plate'){ html=`<ul><li>เติมชิ้นในจาน: <b>${c.plateFills||0}</b> | PERFECT: <b>${c.perfectPlates||0}</b></li><li>เกินโควตา: <b>${c.overfillCount||0}</b></li></ul>`; tip=SETTINGS.lang==='TH'?'เติมตามโควตาให้ครบ':'Fill quotas'; }
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

// ====== LOOP / TIMER ======
let spawnTimer=null,timeTimer=null,spawnCount=0,lastTs=performance.now();
function loop(){
  const ts=performance.now(), dt=ts-lastTs; lastTs=ts;
  systems.fever.update(dt); systems.power.tick(dt);

  if(state.running && state.modeKey==='hydration'){
    state.hyd = Math.max(0, Math.min(100, state.hyd - 0.0003*dt*(systems.power.timeScale||1)));
    loop._hydTick=(loop._hydTick||0)+dt;
    const z=state.hyd<state.hydMin?'low':(state.hyd>state.hydMax?'high':'ok');
    loop._lowAccum=(loop._lowAccum||0)+(z==='low'?dt:0);

    if(loop._hydTick>1000){
      loop._hydTick=0;
      if(z==='ok'){ systems.score.add(1); }
      document.getElementById('hydroWrap').style.display='block';
      hud.setHydration(state.hyd,z);
    }
    if(loop._lowAccum>=4000){
      loop._lowAccum=0; systems.score.add(-1);
      state.timeLeft=Math.max(0,state.timeLeft-1);
      state.ctx.timeMinus=(state.ctx.timeMinus||0)+1;
    }
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

// ====== GAME STATE ======
function start(){
  document.getElementById('help').style.display='none';
  coach = coach || new Coach();
  coach?.onStart?.();

  state.diffCfg=DIFFS[state.difficulty]||DIFFS.Normal;
  state.running=true; state.paused=false;
  state.timeLeft=state.diffCfg.time; spawnCount=0;
  systems.score.reset(); systems.fever.charge = 0; systems.fever.active=false; systems.fever.timer=0;
  setupLanes();

  state.ctx={bestStreak:0,currentStreak:0,goodHits:0,junkCaught:0,targetHitsTotal:0,groupWrong:0,waterHits:0,sweetMiss:0,overHydPunish:0,lowSweetPunish:0,plateFills:0,perfectPlates:0,overfillCount:0,trapsHit:0,powersUsed:0,timeMinus:0,timePlus:0};

  // hide all mode-specific HUD then init current
  document.getElementById('hydroWrap').style.display='none';
  document.getElementById('targetWrap').style.display='none';
  document.getElementById('plateTracker').style.display='none';
  if (typeof MODES[state.modeKey]?.init === 'function') MODES[state.modeKey].init(state, hud);

  updateHUD();
  setTimeout(spawnOnce,200);
  runSpawn(); runTimer();

  document.getElementById('c').style.pointerEvents='auto';
  D.log('game start', {mode:state.modeKey, diff:state.difficulty});
}
function pause(){
  if(!state.running) return;
  state.paused=!state.paused;
  if(!state.paused){ runSpawn(); runTimer(); }
  D.log('pause =', state.paused);
}
function end(){
  state.running=false; state.paused=false;
  clearTimeout(spawnTimer); clearTimeout(timeTimer);
  document.getElementById('c').style.pointerEvents='none';
  const bonus=systems.mission.evaluate({...state.ctx, combo: systems.score.combo}); if(bonus>0){ systems.score.score+=bonus; }
  systems.board.submit(state.modeKey, state.difficulty, systems.score.score);
  coach?.onEnd?.();
  presentResult(systems.score.score);
  [...state.ACTIVE].forEach(obj => destroy(obj));
  D.log('game end', {score:systems.score.score});
}

// ====== BOOT ======
function boot(){
  const canvas=document.getElementById('c');
  engine=new Engine(THREE,canvas);
  hud=new HUD();
  floating=new FloatingFX(engine);
  coach = new Coach();

  systems={
    score:new ScoreSystem(),
    fever:new FeverSystem(), // << ใช้เวอร์ชัน A+B+C
    power:new PowerUpSystem(),
    mission:new MissionSystem(),
    board:new Leaderboard(),
    fx:{
      ding(){ if(!SETTINGS.sound) return; try{ const el=document.getElementById('sfx-ding'); el.currentTime=0; el.play(); }catch{} },
      thud(){ if(!SETTINGS.sound) return; try{ const el=document.getElementById('sfx-thud'); el.currentTime=0; el.play(); }catch{} },
      tick(){ if(!SETTINGS.sound) return; try{ const el=document.getElementById('sfx-tick'); el.currentTime=0; el.play(); }catch{} },
      fever(){ if(!SETTINGS.sound) return; try{ const el=document.getElementById('sfx-fever'); el.currentTime=0; el.play(); }catch{} },
      perfect(){ if(!SETTINGS.sound) return; try{ const el=document.getElementById('sfx-perfect'); el.currentTime=0; el.play(); }catch{} },
    }
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
  window.addEventListener('unhandledrejection', e=>{
    const d=document.getElementById('errors'); if(d){ d.textContent='Promise: '+e.reason; d.style.display='block'; }
  });

  D.log('boot ok');
}
if(document.readyState==='loading'){ window.addEventListener('DOMContentLoaded', boot); } else { boot(); }
