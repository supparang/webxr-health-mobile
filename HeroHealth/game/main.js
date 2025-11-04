// === Hero Health Academy — game/main.js (v4.3 single-active quests + solid timer + spawn-guard) ===

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

// ---------- Small utils ----------
const MODES = { goodjunk };
const $  = (s)=>document.querySelector(s);
const sleep = (ms)=>new Promise(r=>setTimeout(r,ms));
const clamp = (n,a,b)=>Math.max(a,Math.min(b,n));
const nowMs = ()=>performance?.now?.() ?? Date.now();

// ---------- State ----------
let playing=false, rafId=0, activeMode=null;
let wallSecondsTotal=45, wallSecondsLeft=45;
let lastFrameMs=0;
let tickTimerId=null;       // ตัวจับเวลา 1s
let guardTimerId=null;      // watchdog
let spawnGuardId=null;      // กรณีไม่มีเป้าเกิด
let currentModeKey='goodjunk', currentDiff='Normal';

// ---------- Core singletons ----------
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
hud.bindPower?.(power);   // bind Fever เข้ากับ HUD โดยตรง

// ---------- Fever visuals ----------
power.onFever((v)=>{
  // HUD มี setFever อยู่ภายใน bind แล้ว (ซ้ำได้ไม่เป็นไร)
  hud.setFever?.(Math.max(0,Math.min(100,v)));
  if (v >= 100){
    hud.showFever?.(true);
    sfx.power();
    setTimeout(()=>{ hud.showFever?.(false); power.resetFever(); }, 5000);
  }
});

// ---------- BUS (gameplay events ที่โหมดเรียกใช้) ----------
const BUS={
  hit(e){
    const pts = e?.points|0;
    const kind = (e?.kind==='perfect')?'perfect':'good';
    score.add(pts,{kind});
    hud.updateHUD(score.get(), score.combo|0);
    if(e?.ui) hud.showFloatingText?.(e.ui.x, e.ui.y, `+${pts}`);

    if (kind==='perfect') coach.onPerfect(); else coach.onGood();

    // แจ้ง mission
    mission.onEvent(kind, {count:1}, stateRef);
    if (e?.meta?.golden){ mission.onEvent('golden', {count:1}, stateRef); power.add(20); }

    // อัปเดตคอมโบ/สกอร์เข้า mission เสมอ
    mission.onEvent('combo', {combo: score.combo|0}, stateRef);
    mission.onEvent('score', {score: score.get()|0}, stateRef);
    mission.tick(stateRef, { score: score.get() }, null, { hud, coach, lang:'TH' });
    mission.ensureAdvance({ hud, coach });

    // SFX
    if (e?.meta?.golden) BUS.sfx.power(); else BUS.sfx.good();
  },
  miss(){
    score.add(0); coach.onMiss();
    mission.onEvent('miss', {count:1}, stateRef);
    mission.onEvent('combo', {combo: score.combo|0}, stateRef);
    mission.tick(stateRef, { score: score.get() }, null, { hud, coach, lang:'TH' });
    mission.ensureAdvance({ hud, coach });
  },
  bad(){
    score.add(0); coach.onJunk();
    mission.onEvent('wrong_group', {count:1}, stateRef);
    mission.onEvent('miss', {count:1}, stateRef);
    mission.onEvent('combo', {combo: score.combo|0}, stateRef);
    mission.tick(stateRef, { score: score.get() }, null, { hud, coach, lang:'TH' });
    mission.ensureAdvance({ hud, coach });
  },
  sfx:{
    good(){sfx.good();}, bad(){sfx.bad();}, perfect(){sfx.perfect();}, power(){sfx.power();}
  }
};

// ---------- Countdown ----------
async function preCountdown(){
  hud.showBig('3'); sfx.tick(); await sleep(650);
  hud.showBig('2'); sfx.tick(); await sleep(650);
  hud.showBig('1'); sfx.tick(); await sleep(650);
  hud.showBig('GO!'); sfx.tick(); await sleep(450);
}

// ---------- Guards ----------
function armSpawnGuard(){
  clearTimeout(spawnGuardId);
  spawnGuardId = setTimeout(()=>{
    if(!playing) return;
    const hasAny = document.querySelector('#spawnHost .gj-it');
    if (!hasAny){ try{ activeMode?.start?.({ difficulty: currentDiff }); }catch{} }
  }, 2200);
}

// ---------- Begin / End / Loop ----------
function beginRun({modeKey,diff='Normal',seconds=45}){
  document.body.setAttribute('data-playing','1');
  playing=true;

  // reset
  score.reset();
  power.resetFever();
  wallSecondsTotal = clamp(seconds|0,10,300);
  wallSecondsLeft  = wallSecondsTotal;
  lastFrameMs = nowMs();

  hud.setTop({mode:shortMode(modeKey), diff});
  hud.resetBars?.();
  hud.setTimer(wallSecondsLeft);
  coach.onStart();

  // Missions (single-active, 3 ชุดต่อเกม)
  const run = mission.start(modeKey, { seconds:wallSecondsTotal, count:3, lang:'TH', singleActive:true, diff });
  mission.attachToState(run, stateRef);
  const chips = mission.tick(stateRef, { score:0 }, null, { hud, coach, lang:'TH' });
  if (chips?.length) hud.showMiniQuest?.(chips[0].label);

  // Mode start
  currentModeKey = modeKey;
  currentDiff    = diff;
  activeMode = MODES[modeKey];
  activeMode?.start?.({ difficulty: diff });

  // Solid 1s wall timer
  clearInterval(tickTimerId);
  tickTimerId = setInterval(()=>{
    if(!playing) return;
    if (wallSecondsLeft>0){
      wallSecondsLeft = Math.max(0, wallSecondsLeft - 1);
      hud.setTimer(wallSecondsLeft);
      sfx.tick();
      power.drain(0.5);

      mission.tick(stateRef, { score: score.get() }, null, { hud, coach, lang:'TH' });
      mission.ensureAdvance({ hud, coach });

      if (wallSecondsLeft===0) endRun();
    }
  }, 1000);

  // Watchdogs
  armSpawnGuard();
  clearInterval(guardTimerId);
  guardTimerId = setInterval(()=>armSpawnGuard(), 4000);

  loop();
}

function endRun(){
  if(!playing) return;
  playing=false;

  try{ cancelAnimationFrame(rafId); }catch{}
  clearInterval(tickTimerId); tickTimerId=null;
  clearInterval(guardTimerId); guardTimerId=null;
  clearTimeout(spawnGuardId);  spawnGuardId=null;

  try{ activeMode?.stop?.(); }catch{}
  try{ activeMode?.cleanup?.(); }catch{}
  const host=document.getElementById('spawnHost'); if(host) host.innerHTML='';

  mission.stop(stateRef);

  // summary
  const finalScore = score.get()|0;
  const bestCombo  = score.bestCombo|0;
  const finalChips = (stateRef.missions||[]).map(m=>({
    key:m.key, ok:!!m.done && !m.fail, need:m.target|0, got:m.progress|0, fail:!!m.fail
  }));

  const extra = finalChips.map(c=>{
    const icon = ({collect_goods:'🍎',count_perfect:'🌟',count_golden:'🟡',reach_combo:'🔥',no_miss:'❌',score_reach:'🏁',target_hits:'🎯',streak_keep:'🧊',timed_survive:'⏱️',quick_start:'⚡'})[c.key] || '⭐';
    const name = mission.describe({ key:c.key, target:c.need });
    const mark = c.ok ? '✅' : (c.fail ? '❌' : '✖');
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
      const mb = $('#menuBar');
      if (mb){ mb.removeAttribute('data-hidden'); mb.style.display='flex'; }
      hud.hideResult?.();
      hud.resetBars?.();
      document.body.removeAttribute('data-playing');
      const host=document.getElementById('spawnHost'); if(host) host.innerHTML='';
    }catch{ location.reload(); }
  };
  hud.onRetry = ()=>{
    hud.hideResult?.();
    hud.resetBars?.();
    mission.reset(stateRef);
    power.resetFever();
    beginRun({ modeKey: currentModeKey, diff: currentDiff, seconds: wallSecondsTotal });
  };

  document.body.removeAttribute('data-playing');
  hud.showFever?.(false);
}

function loop(){
  if(!playing) return;
  rafId = requestAnimationFrame(loop);
  const t = nowMs();
  let dt = (t - lastFrameMs)/1000;
  if (!(dt>0) || dt>1.5) dt = 0.016;
  lastFrameMs = t;

  try{ activeMode?.update?.(dt, BUS); }catch(e){ console.warn(e); }

  if (wallSecondsLeft <= 0){ endRun(); }
}

// ---------- Public ----------
async function startGame(){
  currentModeKey=document.body.getAttribute('data-mode')||'goodjunk';
  currentDiff=document.body.getAttribute('data-diff')||'Normal';
  if (!MODES[currentModeKey]){ alert('Mode not found: '+currentModeKey); return; }

  const mb = $('#menuBar'); if (mb){ mb.setAttribute('data-hidden','1'); mb.style.display='none'; }
  await preCountdown();
  beginRun({ modeKey: currentModeKey, diff: currentDiff, seconds: 45 });
}

function stopLoop(){
  try{ cancelAnimationFrame(rafId); }catch{}
  clearInterval(tickTimerId); tickTimerId=null;
  clearInterval(guardTimerId); guardTimerId=null;
  clearTimeout(spawnGuardId);  spawnGuardId=null;
  playing=false;
}

function shortMode(m){
  if(m==='goodjunk') return 'Good vs Junk';
  if(m==='groups') return '5 Groups';
  if(m==='hydration') return 'Hydration';
  if(m==='plate') return 'Healthy Plate';
  return String(m||'');
}

// ---------- Hotkeys ----------
window.addEventListener('keydown', (e)=>{
  if ((e.code==='Space' || e.key===' ') && !playing) { e.preventDefault(); startGame(); }
});

// ---------- Expose ----------
window.HHA = { startGame, __stopLoop: stopLoop };
console.log('[HeroHealth] main.js — v4.3 loaded');
