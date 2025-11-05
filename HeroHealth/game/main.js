// === Hero Health Academy — game/main.js (watchdog reinforced) ===

// เคลียร์อินสแตนซ์เดิมถ้ามี
if (window.HHA?.__stopLoop) { try{ window.HHA.__stopLoop(); }catch{} delete window.HHA; }

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

const PAUSE_ON_BLUR = true;
const RUN_SECONDS   = 45;
const SPAWN_KICK_MS = 1200;    // เข้มขึ้น
const TIMER_KICK_MS = 800;

const MODES = { goodjunk };
const $  = (s)=>document.querySelector(s);
const sleep = (ms)=>new Promise(r=>setTimeout(r,ms));
const clamp = (n,a,b)=>Math.max(a,Math.min(b,n));
const nowMs = ()=>performance?.now?.() ?? Date.now();

let playing=false, paused=false, countingDown=false;
let rafId=0, activeMode=null;

let wallSecondsTotal=RUN_SECONDS, wallSecondsLeft=RUN_SECONDS;
let lastFrameMs=0, tickTimerId=null, guardTimerId=null, spawnGuardId=null, emgSpawnerId=null;

let currentModeKey='goodjunk', currentDiff='Normal';
let lastTimerTickAt = 0, lastSpawnSeenAt = 0, spawnObserver = null;

const engine=new Engine(), hud=new HUD(), coach=new Coach({lang:'TH'});
const sfx=new SFX(), score=new ScoreSystem(), power=new PowerUpSystem();
const board=new Leaderboard({key:'hha_board', maxKeep:300, retentionDays:180});
const mission=new MissionSystem(); const stateRef={ missions:[], ctx:{} };

Quests.bindToMain({hud,coach}); power.attachToScore(score);

power.onFever(v=>{
  const fill = hud.$powerFill;
  if (fill) fill.style.width = Math.max(0, Math.min(100, v)) + '%';
  if (v >= 100) { hud.showFever(true); sfx.power(); setTimeout(()=>{ hud.showFever(false); power.resetFever(); }, 5000); }
});

const BUS={
  hit(e){ const pts=e?.points|0; const kind=(e?.kind==='perfect')?'perfect':'good';
    score.add(pts,{kind}); hud.updateHUD(score.get(),score.combo|0);
    if(e?.ui) hud.showFloatingText?.(e.ui.x,e.ui.y,`+${pts}`);
    if(kind==='perfect') coach.onPerfect(); else coach.onGood();
    mission.onEvent(kind,{count:1},stateRef); if (e?.meta?.golden) power.add(20);
    lastSpawnSeenAt = nowMs();
  },
  miss(){ score.add(0); coach.onMiss(); mission.onEvent('miss',{count:1},stateRef); },
  bad(){  score.add(0); coach.onJunk(); mission.onEvent('wrong_group',{count:1},stateRef); },
  sfx:{ good(){sfx.good();}, bad(){sfx.bad();}, perfect(){sfx.perfect();}, power(){sfx.power();} }
};

function ensureSpawnHost(){
  let host = document.getElementById('spawnHost');
  if (!host){
    host = document.createElement('div');
    host.id = 'spawnHost';
    host.style.cssText = 'position:fixed;inset:0;z-index:5000;pointer-events:auto';
    document.body.appendChild(host);
  }
  document.querySelectorAll('canvas').forEach(c=>{ try{ c.style.pointerEvents='none'; c.style.zIndex='1'; }catch{} });
  return host;
}

function observeSpawn(){
  const host = ensureSpawnHost();
  if (spawnObserver) { try{ spawnObserver.disconnect(); }catch{} }
  spawnObserver = new MutationObserver(()=>{
    if (host.querySelector('.gj-it')){
      lastSpawnSeenAt = nowMs();
      clearInterval(emgSpawnerId);
    }
  });
  spawnObserver.observe(host, { childList:true });
}

function emergencySpawner(on){
  clearInterval(emgSpawnerId);
  if(!on) return;
  const host = ensureSpawnHost();
  emgSpawnerId = setInterval(()=>{
    if(!playing || paused) return;
    if (host.querySelector('.gj-it')) { clearInterval(emgSpawnerId); return; }
    const d = document.createElement('div');
    d.className='gj-it'; d.textContent='⭐';
    d.style.cssText=`position:absolute;left:${Math.random()*85+5}vw;top:${Math.random()*70+15}vh;font-size:44px;filter:drop-shadow(0 0 8px #0008);cursor:pointer;user-select:none`;
    d.onpointerdown=()=>{ d.remove(); lastSpawnSeenAt=nowMs(); BUS.hit?.({points:50,kind:'perfect',meta:{golden:true}}); };
    host.appendChild(d); lastSpawnSeenAt=nowMs();
  }, 700); // เร็วขึ้นเล็กน้อย
}

function clearAllTimers(){
  try{ cancelAnimationFrame(rafId); }catch{}
  clearInterval(tickTimerId); tickTimerId=null;
  clearInterval(guardTimerId); guardTimerId=null;
  clearTimeout(spawnGuardId);  spawnGuardId=null;
  clearInterval(emgSpawnerId); emgSpawnerId=null;
}

async function preCountdown(){
  if (countingDown) return; countingDown = true;
  hud.showBig('3'); sfx.tick(); await sleep(500);
  hud.showBig('2'); sfx.tick(); await sleep(500);
  hud.showBig('1'); sfx.tick(); await sleep(500);
  hud.showBig('GO!'); sfx.tick(); await sleep(350);
  countingDown = false;
}

function armSpawnGuard(){
  clearTimeout(spawnGuardId);
  spawnGuardId = setTimeout(()=>{
    if(!playing || paused) return;
    const hasAny = document.querySelector('#spawnHost .gj-it');
    if (hasAny){ lastSpawnSeenAt = nowMs(); return; }
    try{ activeMode?.start?.({ difficulty: currentDiff }); }catch{}
  }, SPAWN_KICK_MS);
}

function startTimer(){
  clearInterval(tickTimerId);
  tickTimerId = setInterval(()=>{
    if(!playing || paused) return;
    if (wallSecondsLeft>0){
      wallSecondsLeft = Math.max(0, wallSecondsLeft - 1);
      hud.setTimer(wallSecondsLeft);
      lastTimerTickAt = nowMs();
      sfx.tick(); power.drain(0.5);
      mission.tick(stateRef, { score: score.get() }, null, { hud, coach, lang:'TH' });
      if (wallSecondsLeft===0) endRun();
    }
  }, 1000);
}

function bindPauseResume(){
  if (!PAUSE_ON_BLUR) return;
  const onVisible = ()=>{
    if (document.visibilityState==='visible'){
      paused=false;
      setTimeout(()=>{
        if (playing && (lastTimerTickAt===0 || (nowMs()-lastSpawnSeenAt>SPAWN_KICK_MS+200))){
          try{ activeMode?.start?.({difficulty:currentDiff}); }catch{}
          startTimer(); emergencySpawner(true);
        }
      }, 120);
    }else{ paused=true; }
  };
  document.removeEventListener('visibilitychange', onVisible);
  document.addEventListener('visibilitychange', onVisible, { passive:true });
}

function beginRun({modeKey,diff='Normal',seconds=RUN_SECONDS}){
  ensureSpawnHost(); observeSpawn(); bindPauseResume();

  document.body.setAttribute('data-playing','1');
  playing=true; paused=false;

  score.reset(); power.resetFever(); hud.hideResult?.();
  const host=document.getElementById('spawnHost'); if(host) host.innerHTML='';

  wallSecondsTotal = clamp(seconds|0,10,300);
  wallSecondsLeft  = wallSecondsTotal;
  lastFrameMs = nowMs(); lastTimerTickAt = 0; lastSpawnSeenAt = nowMs();

  hud.setTop({mode:shortMode(modeKey), diff}); hud.resetBars?.(); hud.setTimer(wallSecondsLeft);
  coach.onStart();

  try{
    const run = mission.start(modeKey,{ seconds:wallSecondsTotal, count:3, lang:'TH', singleActive:true });
    mission.attachToState(run, stateRef);
    const chips = mission.tick(stateRef, { score:0 }, null, { hud, coach, lang:'TH' });
    if (chips?.[0]) hud.showMiniQuest?.(chips[0].label);
  }catch(e){ console.warn('mission init failed', e); }

  activeMode = MODES[modeKey];
  try{ activeMode?.start?.({ difficulty: diff }); }catch(e){ console.warn('mode.start failed', e); }

  startTimer(); armSpawnGuard();
  clearInterval(guardTimerId);
  guardTimerId = setInterval(()=>armSpawnGuard(), 3000);

  // “คิกซ้ำ” จนกว่าจะมีเป้าจริง
  const ensureRealSpawn = ()=>{
    if(!playing) return;
    const hasAny = document.querySelector('#spawnHost .gj-it');
    if (!hasAny){
      try{ activeMode?.start?.({ difficulty: currentDiff }); }catch{}
      emergencySpawner(true);
      setTimeout(ensureRealSpawn, 600);
    }
  };
  setTimeout(ensureRealSpawn, 400);

  loop();
}

function endRun(){
  if(!playing) return;
  playing=false; paused=false;

  clearAllTimers();
  try{ spawnObserver?.disconnect?.(); }catch{}

  try{ activeMode?.stop?.(); }catch{}
  try{ activeMode?.cleanup?.(); }catch{}
  const host=document.getElementById('spawnHost'); if(host) host.innerHTML='';

  mission.stop(stateRef);

  const finalScore = score.get()|0;
  const bestCombo  = score.bestCombo|0;
  const finalChips = (stateRef.missions||[]).map(m=>({ key:m.key, ok:!!m.success, need:m.target|0, got:m.progress|0 }));
  const extra = finalChips.map(c=>{
    const icon = ({collect_goods:'🍎',count_perfect:'🌟',count_golden:'🟡',reach_combo:'🔥',no_miss:'❌',score_reach:'🏁',target_hits:'🎯'})[c.key] || '⭐';
    const name = mission.describe({key:c.key,target:c.need}, 'TH'); const mark = c.ok ? '✅' : '❌';
    return `${mark} ${icon} ${name} — ${c.got}/${c.need}`;
  });

  try{ board.submit(currentModeKey, currentDiff, finalScore, { meta:{ bestCombo } }); }catch{}

  hud.showResult({ title:'สรุปผล', desc:`โหมด: ${shortMode(currentModeKey)} • ระดับ: ${currentDiff}`, stats:[`คะแนน: ${finalScore}`, `คอมโบสูงสุด: ${bestCombo}`], extra });

  hud.onHome = ()=>{
    try{
      const mb = $('#menuBar'); if (mb){ mb.removeAttribute('data-hidden'); mb.style.display='flex'; }
      hud.hideResult?.(); hud.resetBars?.(); document.body.removeAttribute('data-playing');
      const host=document.getElementById('spawnHost'); if(host) host.innerHTML='';
      setTimeout(()=>$('#btn_start')?.focus(),100);
    }catch{ location.reload(); }
  };
  hud.onRetry= ()=>{ hud.hideResult?.(); hud.resetBars?.(); mission.reset(stateRef); power.resetFever(); beginRun({ modeKey: currentModeKey, diff: currentDiff, seconds: wallSecondsTotal }); };

  document.body.removeAttribute('data-playing'); hud.showFever?.(false);
}

function loop(){
  if(!playing || paused) return;
  rafId=requestAnimationFrame(loop);
  const t = nowMs(); let dt = (t - lastFrameMs) / 1000;
  if (!(dt>0) || dt>1.5) dt = 0.016; lastFrameMs = t;
  try{ activeMode?.update?.(dt, BUS); }catch(e){ console.warn(e); }
}

async function startGame(){
  if (playing || countingDown) return;
  ensureSpawnHost();
  currentModeKey=document.body.getAttribute('data-mode')||'goodjunk';
  currentDiff=document.body.getAttribute('data-diff')||'Normal';
  if (!MODES[currentModeKey]){ alert('Mode not found: '+currentModeKey); return; }
  const mb = $('#menuBar'); if (mb){ mb.setAttribute('data-hidden','1'); mb.style.display='none'; }
  hud.hideResult?.();
  await preCountdown();
  beginRun({ modeKey: currentModeKey, diff: currentDiff, seconds: RUN_SECONDS });
}

function kick(){ if (!playing && !countingDown) { try{ startGame(); }catch(e){ console.error(e); } } }
function stopLoop(){ clearAllTimers(); try{ spawnObserver?.disconnect?.(); }catch{} playing=false; paused=false; countingDown=false; }

function shortMode(m){ if(m==='goodjunk') return 'Good vs Junk'; if(m==='groups') return '5 Groups'; if(m==='hydration') return 'Hydration'; if(m==='plate') return 'Healthy Plate'; return String(m||''); }

setTimeout(()=>document.querySelectorAll('canvas').forEach(c=>{ try{ c.style.pointerEvents='none'; c.style.zIndex='1'; }catch{} }),0);

window.HHA = { startGame, kick, __stopLoop: stopLoop };
console.log('[HeroHealth] main.js — reinforced watchdog');
