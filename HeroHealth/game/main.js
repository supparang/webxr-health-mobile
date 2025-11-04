// === Hero Health Academy — game/main.js (robust start + timer/spawn watchdog) ===

// เคลียร์อินสแตนซ์เดิมถ้ามี
if (window.HHA?.__stopLoop) { try{ window.HHA.__stopLoop(); }catch{} delete window.HHA; }

// ---------- Imports ----------
import { Engine } from './core/engine.js';
import { HUD } from './core/hud.js';
import { Coach } from './core/coach.js';
import { SFX } from './core/sfx.js';
import { ScoreSystem } from './core/score.js';
import { PowerUpSystem } from './core/powerup.js';
import { Quests } from './core/quests.js';
import { MissionSystem } from './core/mission-system.js';
import { Leaderboard } from './core/leaderboard.js';
import { VRInput } from './core/vrinput.js';
import * as FX from './core/fx.js';
import * as goodjunk from './modes/goodjunk.js';

// ---------- State ----------
const MODES = { goodjunk };
const $  = (s)=>document.querySelector(s);
const sleep = (ms)=>new Promise(r=>setTimeout(r,ms));
const clamp = (n,a,b)=>Math.max(a,Math.min(b,n));
const pnow = ()=>performance.now?performance.now():Date.now();

let playing=false, rafId=0, activeMode=null;
let wallSecondsTotal=45, wallSecondsLeft=45;
let lastFrameMs=0;
let tickTimerId=null;
let spawnGuardId=null;
let guardTimerId=null;
let currentModeKey='goodjunk', currentDiff='Normal';

// watchdog markers
let lastTimerTickMs = 0;
let lastSpawnSeenMs = 0;

// ---------- Core ----------
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

// FEVER hook
power.onFever(v=>{
  const fill = hud.$powerFill;
  if (fill) fill.style.width = Math.max(0, Math.min(100, v)) + '%';
  if (v >= 100) { hud.showFever(true); sfx.power(); setTimeout(()=>{ hud.showFever(false); power.resetFever(); }, 5000); }
});

// ---------- BUS ----------
const BUS={
  hit(e){
    const pts=e?.points|0;
    const kind=(e?.kind==='perfect')?'perfect':'good';
    score.add(pts,{kind});
    hud.updateHUD(score.get(),score.combo|0);
    if(e?.ui) hud.showFloatingText?.(e.ui.x,e.ui.y,`+${pts}`);
    if(kind==='perfect') coach.onPerfect(); else coach.onGood();
    mission.onEvent(kind,{count:1},stateRef);
    if (e?.meta?.golden) power.add(20);
  },
  miss(){ score.add(0); coach.onMiss(); mission.onEvent('miss',{count:1},stateRef); },
  bad(){  score.add(0); coach.onJunk(); mission.onEvent('wrong_group',{count:1},stateRef); },
  sfx:{ good(){sfx.good();}, bad(){sfx.bad();}, perfect(){sfx.perfect();}, power(){sfx.power();} }
};

// ---------- Utils ----------
function ensureSpawnHost(){
  let host = document.getElementById('spawnHost');
  if (!host){
    host = document.createElement('div');
    host.id = 'spawnHost';
    host.style.cssText = 'position:fixed;inset:0;z-index:5000;pointer-events:auto';
    document.body.appendChild(host);
  }
  // แคนวาสอย่าบังคลิก
  document.querySelectorAll('canvas').forEach(c=>{ try{ c.style.pointerEvents='none'; c.style.zIndex='1'; }catch{} });
  return host;
}

// ---------- Flow ----------
async function preCountdown(){
  hud.showBig('3'); sfx.tick(); await sleep(650);
  hud.showBig('2'); sfx.tick(); await sleep(650);
  hud.showBig('1'); sfx.tick(); await sleep(650);
  hud.showBig('GO!'); sfx.tick(); await sleep(420);
}

function armSpawnGuard(){
  clearTimeout(spawnGuardId);
  spawnGuardId = setTimeout(()=>{
    if(!playing) return;
    const hasAny = document.querySelector('#spawnHost .gj-it');
    if (hasAny){ lastSpawnSeenMs = pnow(); return; }
    try{ activeMode?.start?.({ difficulty: currentDiff }); }catch{}
  }, 1800);
}

function beginRun({modeKey,diff='Normal',seconds=45}){
  ensureSpawnHost();
  document.body.setAttribute('data-playing','1');
  playing=true;

  // reset run
  score.reset(); power.resetFever();
  wallSecondsTotal = clamp(seconds|0,10,300);
  wallSecondsLeft  = wallSecondsTotal;
  lastFrameMs = pnow();
  lastTimerTickMs = 0;
  lastSpawnSeenMs = pnow();

  hud.setTop({mode:shortMode(modeKey), diff});
  hud.resetBars?.();
  hud.setTimer(wallSecondsLeft);
  coach.onStart();

  // missions
  const run = mission.start(modeKey,{ seconds:wallSecondsTotal, count:3, lang:'TH', singleActive:true });
  mission.attachToState(run, stateRef);
  const chips = mission.tick(stateRef, { score:0 }, null, { hud, coach, lang:'TH' });
  if (chips?.[0]) hud.showMiniQuest?.(chips[0].label);

  // start mode
  activeMode = MODES[modeKey];
  activeMode?.start?.({ difficulty: diff });

  // solid 1s timer
  clearInterval(tickTimerId);
  tickTimerId = setInterval(()=>{
    if(!playing) return;
    if (wallSecondsLeft>0){
      wallSecondsLeft = Math.max(0, wallSecondsLeft - 1);
      hud.setTimer(wallSecondsLeft);
      lastTimerTickMs = pnow();
      sfx.tick();
      power.drain(0.5);
      mission.tick(stateRef, { score: score.get() }, null, { hud, coach, lang:'TH' });
      if (wallSecondsLeft===0) endRun();
    }
  }, 1000);

  // spawn guard & watchdog
  armSpawnGuard();
  clearInterval(guardTimerId);
  guardTimerId = setInterval(()=>armSpawnGuard(), 3000);

  // after GO ถ้าตัวจับเวลา/สปอนไม่เดิน ให้คิกซ้ำ
  setTimeout(()=>{
    if(!playing) return;
    const noTimer = (lastTimerTickMs===0);
    const noSpawn = (pnow()-lastSpawnSeenMs>2500);
    if (noTimer || noSpawn){
      try{ activeMode?.start?.({ difficulty: currentDiff }); }catch{}
      if (noTimer){ // kick timer อีกชั้น
        clearInterval(tickTimerId);
        lastTimerTickMs = 0;
        tickTimerId = setInterval(()=>{
          if(!playing) return;
          if (wallSecondsLeft>0){
            wallSecondsLeft = Math.max(0, wallSecondsLeft - 1);
            hud.setTimer(wallSecondsLeft);
            lastTimerTickMs = pnow();
            power.drain(0.5);
            mission.tick(stateRef, { score: score.get() }, null, { hud, coach, lang:'TH' });
            if (wallSecondsLeft===0) endRun();
          }
        }, 1000);
      }
    }
  }, 1200);

  loop();
}

function endRun(){
  if(!playing) return;
  playing=false;

  try{ cancelAnimationFrame(rafId); }catch{}
  clearInterval(tickTimerId); tickTimerId=null;
  clearInterval(guardTimerId); guardTimerId=null;
  clearTimeout(spawnGuardId); spawnGuardId=null;

  try{ activeMode?.stop?.(); }catch{}
  try{ activeMode?.cleanup?.(); }catch{}
  const host=document.getElementById('spawnHost'); if(host) host.innerHTML='';

  mission.stop(stateRef);

  const finalScore = score.get()|0;
  const bestCombo  = score.bestCombo|0;
  const finalChips = (stateRef.missions||[]).map(m=>({ key:m.key, ok:!!m.success, need:m.target|0, got:m.progress|0 }));
  const extra = finalChips.map(c=>{
    const icon = ({collect_goods:'🍎',count_perfect:'🌟',count_golden:'🟡',reach_combo:'🔥',no_miss:'❌',score_reach:'🏁',target_hits:'🎯'})[c.key] || '⭐';
    const name = mission.describe({key:c.key,target:c.need}, 'TH');
    const mark = c.ok ? '✅' : '❌';
    return `${mark} ${icon} ${name} — ${c.got}/${c.need}`;
  });

  try{ board.submit(currentModeKey, currentDiff, finalScore, { meta:{ bestCombo } }); }catch{}

  hud.showResult({
    title:'สรุปผล',
    desc:`โหมด: ${shortMode(currentModeKey)} • ระดับ: ${currentDiff}`,
    stats:[`คะแนน: ${finalScore}`, `คอมโบสูงสุด: ${bestCombo}`],
    extra
  });

  hud.onHome = ()=>{
    try{
      const mb = $('#menuBar'); if (mb){ mb.removeAttribute('data-hidden'); mb.style.display='flex'; }
      hud.hideResult?.(); hud.resetBars?.(); document.body.removeAttribute('data-playing');
      const host=document.getElementById('spawnHost'); if(host) host.innerHTML=''; 
      // โฟกัสกลับเมนู
      setTimeout(()=>$('#btn_start')?.focus(),100);
    }catch{ location.reload(); }
  };
  hud.onRetry= ()=>{
    hud.hideResult?.(); hud.resetBars?.(); mission.reset(stateRef); power.resetFever();
    beginRun({ modeKey: currentModeKey, diff: currentDiff, seconds: wallSecondsTotal });
  };

  document.body.removeAttribute('data-playing'); hud.showFever?.(false);
}

function loop(){
  if(!playing) return;
  rafId=requestAnimationFrame(loop);
  const nowMs = pnow(); let dt = (nowMs - lastFrameMs) / 1000;
  if (!(dt>0) || dt>1.5) dt = 0.016; lastFrameMs = nowMs;
  try{ activeMode?.update?.(dt, BUS); }catch(e){ /* แทนที่จะค้าง ให้ log แล้วไปต่อ */ console.warn(e); }
}

// ---------- Public ----------
async function startGame(){
  ensureSpawnHost();
  currentModeKey=document.body.getAttribute('data-mode')||'goodjunk';
  currentDiff=document.body.getAttribute('data-diff')||'Normal';
  if (!MODES[currentModeKey]){ alert('Mode not found: '+currentModeKey); return; }

  // ซ่อนเมนูถ้ามี
  const mb = $('#menuBar'); if (mb){ mb.setAttribute('data-hidden','1'); mb.style.display='none'; }

  await preCountdown();
  beginRun({ modeKey: currentModeKey, diff: currentDiff, seconds: 45 });
}

// ให้เรียกคิกเกมซ้ำได้ (กรณี GO แล้วเงียบ)
function kick(){
  if (playing) return;
  try{ startGame(); }catch(e){ console.error(e); }
}

function stopLoop(){
  try{ cancelAnimationFrame(rafId); }catch{}
  clearInterval(tickTimerId); tickTimerId=null;
  clearInterval(guardTimerId); guardTimerId=null;
  clearTimeout(spawnGuardId); spawnGuardId=null;
  playing=false;
}

function shortMode(m){
  if(m==='goodjunk') return 'Good vs Junk';
  if(m==='groups') return '5 Groups';
  if(m==='hydration') return 'Hydration';
  if(m==='plate') return 'Healthy Plate';
  return String(m||'');
}

// auto-ensure canvases ไม่บังคลิก
setTimeout(()=>document.querySelectorAll('canvas').forEach(c=>{ try{ c.style.pointerEvents='none'; c.style.zIndex='1'; }catch{} }),0);

// expose
window.HHA = { startGame, kick, __stopLoop: stopLoop };
console.log('[HeroHealth] main.js — robust start + watchdog');
