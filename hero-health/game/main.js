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
    buttons:{start:'▶ เริ่มเกม',pause:'⏸ พัก',restart:'↻ เริ่มใหม่',help:'❓ วิธีเล่น'}
  },
  EN:{brand:'HERO HEALTH ACADEMY',
    modes:{goodjunk:'🥗 Healthy vs Junk',groups:'🍽️ Food Groups',hydration:'💧 Hydration',plate:'🍱 Healthy Plate'},
    diff:{Easy:'Easy',Normal:'Normal',Hard:'Hard'},
    labels:{score:'Score',combo:'Combo',time:'Time',best:'Best',target:'Target',quota:'Quota',hydro:'Hydration'},
    buttons:{start:'▶ Start',pause:'⏸ Pause',restart:'↻ Restart',help:'❓ Help'}
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
  ctx:{}, hydMin:45,hydMax:65,hyd:50, L:'TH' };

// ===== Helpers =====
const L = () => I18N[state.L] || I18N.TH;

// ===== HUD & UI =====
function applyLanguage(){
  const lang = L();
  document.querySelector('.brand div').textContent = lang.brand;
  // update labels
  const map = [['.lbl-score',lang.labels.score],['.lbl-combo',lang.labels.combo],['.lbl-time',lang.labels.time],['.lbl-best',lang.labels.best],['.lbl-target',lang.labels.target],['.lbl-quota',lang.labels.quota],['.lbl-hydro',lang.labels.hydro]];
  map.forEach(([sel,txt])=>{ const el=document.querySelector(sel); if(el) el.textContent=txt; });
  // modes & diffs
  [['goodjunk','mode'],['groups','mode'],['hydration','mode'],['plate','mode']].forEach(([k])=>{
    const b=document.querySelector(`button[data-action="mode"][data-value="${k}"]`); if(b) b.textContent = L().modes[k];
  });
  ['Easy','Normal','Hard'].forEach(d=>{
    const b=document.querySelector(`button[data-action="diff"][data-value="${d}"]`); if(b) b.textContent = L().diff[d];
  });
  document.getElementById('modeName').textContent = lang.modes[state.modeKey];
  document.getElementById('difficulty').textContent = lang.diff[state.difficulty];
  // buttons
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

// ===== Lanes/Spawn =====
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
  if(r<p) return POWER_ITEMS[Math.floor(Math.random()*POWER_ITEMS.length)];
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
  const life=state.diffCfg?.life||3000;
  m.userData.timer=setTimeout(()=>{ if(!m.parent) return; destroy(m); }, life + Math.floor(Math.random()*500-250));
}
function destroy(obj){ if(obj.userData?.timer) { clearTimeout(obj.userData.timer); obj.userData.timer=null; } if(obj.parent) obj.parent.remove(obj); state.ACTIVE.delete(obj); if (obj.userData?.lane) releaseLane(obj.userData.lane); }

// ===== Hit =====
function hit(obj){
  const meta=obj.userData.meta;
  const baseAdd=systems.score.add.bind(systems.score);
  systems.score.add=(v)=>baseAdd(v*(systems.fever.active?2:1)*(1+systems.power.scoreBoost));
  // init per-mode ui visibility
  if(MODES[state.modeKey].initGuard!==true){ // controlled by start()
  }
  MODES[state.modeKey].onHit(meta, systems, state, hud);
  systems.score.add = baseAdd;
  // extra: hydration penalties
  if(state.modeKey==='hydration' && meta.type==='hydra' && meta.water===true && state.hyd>(state.hydMax||65)){
    systems.score.add(-4); state.timeLeft=Math.max(0,state.timeLeft-3);
  }
  destroy(obj);
  updateHUD();
}

// ===== Input =====
function onCanvasClick(ev){
  if(!state.running || state.paused) return;
  const x=ev.clientX ?? (ev.touches&&ev.touches[0].clientX);
  const y=ev.clientY ?? (ev.touches&&ev.touches[0].clientY);
  const inter=engine.raycastFromClient(x,y); if(inter.length) hit(inter[0].object);
}

// ===== Loop/Timer =====
let spawnTimer=null,timeTimer=null,spawnCount=0,lastTs=performance.now();
function loop(){
  const ts=performance.now(), dt=ts-lastTs; lastTs=ts;
  systems.fever.update(dt); systems.power.tick(dt);
  // Hydration passive drain + HUD update
  if(state.running && state.modeKey==='hydration'){
    state.hyd = Math.max(0, Math.min(100, state.hyd - 0.0003*dt*(systems.power.timeScale||1)));
    const z=state.hyd<45?'low':(state.hyd>65?'high':'ok');
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

// ===== Game State =====
function start(){
  document.getElementById('help').style.display='none';
  state.diffCfg=DIFFS[state.difficulty]||DIFFS.Normal;
  state.running=true; state.paused=false;
  state.timeLeft=state.diffCfg.time; spawnCount=0;
  systems.score.reset(); setupLanes();
  // per mode init
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
  document.getElementById('resTitle').textContent='Results';
  document.getElementById('resMode').textContent=L().modes[state.modeKey];
  document.getElementById('resDiff').textContent=L().diff[state.difficulty];
  document.getElementById('resScore').textContent=systems.score.score|0;
  document.getElementById('resTime').textContent=state.timeLeft|0;
  document.getElementById('resCombo').textContent='x'+(systems.score.bestCombo||systems.score.combo||1);
  document.getElementById('result').style.display='flex';
}

// ===== Boot =====
function boot(){
  const canvas=document.getElementById('c');
  engine=new Engine(THREE,canvas);
  hud=new HUD(); floating=new FloatingFX(engine); coach=new Coach();
  systems={ score:new ScoreSystem(), fever:new FeverSystem(), power:new PowerUpSystem(), mission:new MissionSystem(), board:new Leaderboard() };

  // top controls
  document.getElementById('langToggle')?.addEventListener('click', ()=>{ state.L = state.L==='TH' ? 'EN' : 'TH'; SETTINGS.lang=state.L; applyLanguage(); });
  document.getElementById('soundToggle')?.addEventListener('click', ()=>{ SETTINGS.sound=!SETTINGS.sound; applySound(); });
  document.getElementById('gfxSelect')?.addEventListener('change', (e)=>{ SETTINGS.quality=e.target.value||'High'; applyQuality(); });

  // mode/diff buttons
  ['goodjunk','groups','hydration','plate'].forEach(k=>{
    document.querySelector(`button[data-action="mode"][data-value="${k}"]`)?.addEventListener('click', ()=>{ state.modeKey=k; document.getElementById('modeName').textContent=L().modes[k]; });
  });
  ['Easy','Normal','Hard'].forEach(d=>{
    document.querySelector(`button[data-action="diff"][data-value="${d}"]`)?.addEventListener('click', ()=>{ state.difficulty=d; document.getElementById('difficulty').textContent=L().diff[d]; });
  });

  // main buttons
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

  // input
  const canvasEl=document.getElementById('c');
  canvasEl.addEventListener('click', onCanvasClick, {passive:true});
  canvasEl.addEventListener('touchstart', e=>{ const t=e.touches&&e.touches[0]; if(!t) return; onCanvasClick({clientX:t.clientX, clientY:t.clientY}); }, {passive:true});

  engine.startLoop(loop);

  applyLanguage(); applySound(); applyQuality();
}
if(document.readyState==='loading'){ window.addEventListener('DOMContentLoaded', boot); } else { boot(); }
