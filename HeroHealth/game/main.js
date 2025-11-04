// === Hero Health Academy — game/main.js
// (hard-crash guard: try/catch around beginRun + global traps + safe-fallback) ===

if (window.HHA?.__stopLoop) { try{ window.HHA.__stopLoop(); }catch{} delete window.HHA; }

// ----- Imports -----
import { Engine } from './core/engine.js';
import { HUD } from './core/hud.js';
import { Coach } from './core/coach.js';
import { SFX } from './core/sfx.js';
import { ScoreSystem } from './core/score.js';
import { PowerUpSystem } from './core/powerup.js';
import { Quests } from './core/quests.js';
import { MissionSystem } from './core/mission-system.js';
import { Leaderboard } from './core/leaderboard.js';
import * as goodjunk from './modes/goodjunk.js';

// ----- State -----
const MODES = { goodjunk };
const $ = (s)=>document.querySelector(s);
const sleep = (ms)=>new Promise(r=>setTimeout(r,ms));
const clamp = (n,a,b)=>Math.max(a,Math.min(b,n));

let booting=false, playing=false;
let rafId=0, tick1sId=null, modeTickId=null, guardId=null, guardLoopId=null;
let activeMode=null;

let wallSecondsTotal=45, wallSecondsLeft=45;
let currentModeKey='goodjunk', currentDiff='Normal';

// ----- Core -----
const engine=new Engine();
const hud=new HUD();
const coach=new Coach({lang:'TH'});
const sfx=new SFX();
const score=new ScoreSystem();
const power=new PowerUpSystem();
const board=new Leaderboard({key:'hha_board', maxKeep:300, retentionDays:180});
const mission=new MissionSystem();
const stateRef={ missions:[], ctx:{} };

Quests.bindToMain({hud,coach});
power.attachToScore(score);
hud.bindPower?.(power);

// ----- Global error traps (โชว์ให้เห็นว่าพังตรงไหน) -----
window.onerror = (msg, src, line, col, err)=>{
  try{ hud.toast(String(msg||'Error') + (line?` @${line}:${col||0}`:'')); }catch{}
};
window.onunhandledrejection = (e)=>{
  try{ hud.toast('Promise error: ' + (e?.reason?.message || e?.reason || e)); }catch{}
};

// ----- BUS -----
const BUS={
  hit(e){
    const pts=e?.points|0;
    const kind=(e?.kind==='perfect')?'perfect':'good';
    score.add(pts,{kind});
    hud.updateHUD(score.get(),score.combo|0);
    if(e?.ui) hud.showFloatingText?.(e.ui.x,e.ui.y,`+${pts}`);
    if(kind==='perfect') coach.onPerfect(); else coach.onGood();
    try{ mission.onEvent(kind,{count:1},stateRef); }catch{}
    if(e?.meta?.golden) power.add(20);
  },
  miss(){ score.add(0); coach.onMiss(); try{ mission.onEvent('miss',{count:1},stateRef); }catch{} },
  bad(){  score.add(0); coach.onJunk(); try{ mission.onEvent('wrong_group',{count:1},stateRef); }catch{} },
  sfx:{ good(){sfx.good();}, bad(){sfx.bad();}, perfect(){sfx.perfect();}, power(){sfx.power();} }
};

// ----- Flow -----
async function preCountdown(){
  hud.showBig('3'); sfx.tick(); await sleep(650);
  hud.showBig('2'); sfx.tick(); await sleep(650);
  hud.showBig('1'); sfx.tick(); await sleep(650);
  hud.showBig('GO!'); sfx.tick(); await sleep(420);
}

function startTimers(){
  // 1s wall timer
  clearInterval(tick1sId);
  tick1sId = setInterval(()=>{
    if(!playing) return;
    wallSecondsLeft = Math.max(0, wallSecondsLeft - 1);
    hud.setTimer(wallSecondsLeft);
    sfx.tick();
    power.drain?.(0.5);
    try{ mission.tick(stateRef, { score: score.get() }, null, { hud, coach, lang:'TH' }); }catch{}
    if (wallSecondsLeft<=0) endRun();
  }, 1000);

  // mode tick 12fps — ไม่พึ่ง rAF
  clearInterval(modeTickId);
  modeTickId = setInterval(()=>{
    if(!playing) return;
    try{ activeMode?.update?.(0.083, BUS); }catch(e){ console.warn(e); }
  }, 83);
}

function armGuards(){
  // ถ้าหลัง GO 1.2s ยังไม่มีของ → re-start โหมด
  clearTimeout(guardId); clearInterval(guardLoopId);
  guardId = setTimeout(()=>{
    if (!document.querySelector('#spawnHost .gj-it')) {
      try{ activeMode?.start?.({ difficulty: currentDiff, bus: BUS }); }catch{}
    }
  }, 1200);
  // ทุก 2.5s ถ้าไม่มีของหรือ timer ไม่ขยับ → re-arm
  let lastShownTime = hud.$time?.textContent || '';
  guardLoopId = setInterval(()=>{
    if(!playing) return;
    const hasAny = !!document.querySelector('#spawnHost .gj-it');
    const ttxt = hud.$time?.textContent || '';
    const timeStuck = (ttxt === lastShownTime);
    lastShownTime = ttxt;
    if(!hasAny || timeStuck){
      try{ activeMode?.start?.({ difficulty: currentDiff, bus: BUS }); }catch{}
    }
  }, 2500);
}

// “เริ่มแบบเต็มฟีเจอร์ แต่ไม่ให้เกมตกถ้าบางระบบพัง”
function beginRunFull({modeKey,diff='Normal',seconds=45}){
  playing=true;
  score.reset(); power.resetFever();
  wallSecondsTotal = clamp(seconds|0,10,300);
  wallSecondsLeft  = wallSecondsTotal;

  document.body.setAttribute('data-playing','1');
  hud.setTop({mode:shortName(modeKey), diff});
  hud.resetBars?.(); hud.setTimer(wallSecondsLeft);
  coach.onStart();

  // Missions (กันพังเป็นรายขั้น)
  try{
    const run = mission.start(modeKey,{ seconds:wallSecondsTotal, count:3, lang:'TH', singleActive:true });
    mission.attachToState(run, stateRef);
    try{
      const chips = mission.tick(stateRef, { score:0 }, null, { hud, coach, lang:'TH' });
      if (chips?.[0]) hud.showMiniQuest?.(chips[0].label);
    }catch{}
  }catch(e){
    hud.toast('Mission disabled');
  }

  // Mode
  activeMode = MODES[modeKey] || MODES.goodjunk;
  try{ activeMode.start?.({ difficulty: diff, bus: BUS }); }
  catch(e){ hud.toast('Mode start fail'); }

  startTimers();
  armGuards();
  loop();
}

// fallback ultra-safe (ข้าม mission/board ทุกอย่าง)
function beginRunSafe({modeKey='goodjunk', diff='Normal', seconds=45}={}){
  playing=true;
  score.reset(); power.resetFever();
  wallSecondsTotal = clamp(seconds|0,10,300);
  wallSecondsLeft  = wallSecondsTotal;

  document.body.setAttribute('data-playing','1');
  hud.setTop({mode:shortName(modeKey), diff});
  hud.resetBars?.(); hud.setTimer(wallSecondsLeft);

  activeMode = MODES[modeKey] || MODES.goodjunk;
  try{ activeMode.start?.({ difficulty: diff, bus: BUS }); }catch{}

  startTimers();
  armGuards();
  loop();
}

function endRun(){
  if(!playing) return;
  playing=false;

  try{ cancelAnimationFrame(rafId); }catch{}
  clearInterval(tick1sId); tick1sId=null;
  clearInterval(modeTickId); modeTickId=null;
  clearTimeout(guardId); guardId=null;
  clearInterval(guardLoopId); guardLoopId=null;

  try{ activeMode?.stop?.(); }catch{}
  try{ activeMode?.cleanup?.(); }catch{}
  const host=document.getElementById('spawnHost'); if(host) host.innerHTML='';

  try{ mission.stop(stateRef); }catch{}

  const finalScore = score.get()|0;
  const bestCombo  = score.bestCombo|0;

  hud.showResult({
    title:'สรุปผล',
    desc:`โหมด: ${shortName(currentModeKey)} • ระดับ: ${currentDiff}`,
    stats:[`คะแนน: ${finalScore}`, `คอมโบสูงสุด: ${bestCombo}`],
    extra:[]
  });

  hud.onHome = ()=>{
    try{
      const mb = $('#menuBar'); if (mb){ mb.removeAttribute('data-hidden'); mb.style.display='flex'; }
      hud.hideResult?.(); hud.resetBars?.(); document.body.removeAttribute('data-playing');
      const host=document.getElementById('spawnHost'); if(host) host.innerHTML='';
    }catch{ location.reload(); }
  };
  hud.onRetry= ()=>{
    hud.hideResult?.(); hud.resetBars?.(); power.resetFever();
    beginRunSafe({ modeKey: currentModeKey, diff: currentDiff, seconds: wallSecondsTotal });
  };

  document.body.removeAttribute('data-playing');
  hud.showFever?.(false);
}

function loop(){ if(!playing) return; rafId=requestAnimationFrame(loop); }

// ----- Public -----
async function startGame(){
  if (booting || playing) return;
  booting=true;

  currentModeKey=document.body.getAttribute('data-mode')||'goodjunk';
  currentDiff=document.body.getAttribute('data-diff')||'Normal';
  const mb = $('#menuBar'); if (mb){ mb.setAttribute('data-hidden','1'); mb.style.display='none'; }

  await preCountdown();

  // เริ่มแบบเต็มก่อน ถ้าพังจะมี watchdog เปลี่ยนเป็น safe เอง
  try{
    beginRunFull({ modeKey: currentModeKey, diff: currentDiff, seconds: 45 });
  }catch(e){
    hud.toast('Full run failed → safe mode');
    beginRunSafe({ modeKey: currentModeKey, diff: currentDiff, seconds: 45 });
  }

  // ถ้า 1.2s แล้วยังไม่มีเวลา/เป้า → ไป safe ทันที
  setTimeout(()=>{
    if (!document.querySelector('#spawnHost .gj-it')) {
      hud.toast('Recover: safe mode');
      try{ __stopLoop(); }catch{}
      beginRunSafe({ modeKey: currentModeKey, diff: currentDiff, seconds: 45 });
    }
  }, 1200);

  booting=false;
}

function __stopLoop(){
  try{ cancelAnimationFrame(rafId); }catch{}
  clearInterval(tick1sId); tick1sId=null;
  clearInterval(modeTickId); modeTickId=null;
  clearTimeout(guardId); guardId=null;
  clearInterval(guardLoopId); guardLoopId=null;
  playing=false; booting=false;
}

function shortName(m){
  if(m==='goodjunk') return 'Good vs Junk';
  if(m==='groups')   return '5 Groups';
  if(m==='hydration')return 'Hydration';
  if(m==='plate')    return 'Healthy Plate';
  return String(m||'');
}

// ----- Autostart -----
function autoBoot(){ if(!playing && !booting) startGame(); }
if (document.readyState==='complete' || document.readyState==='interactive') setTimeout(autoBoot,0);
else { document.addEventListener('DOMContentLoaded', ()=>setTimeout(autoBoot,0), {once:true}); window.addEventListener('load', ()=>setTimeout(autoBoot,0), {once:true}); }
setTimeout(()=>{ if(!playing) autoBoot(); }, 1500);
window.addEventListener('keydown',(e)=>{ if((e.code==='Space'||e.key===' ')&&!playing&&!booting){ e.preventDefault(); autoBoot(); }});

window.HHA = { startGame, __stopLoop: __stopLoop };
console.log('[HeroHealth] main.js — hard-crash guard + safe fallback + watchdog');
