// === Hero Health Academy — game/main.js
// (Failsafe bootstrap + solid 1s timer + rAF update + autoplay unlock + spawn watchdog)

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
import * as goodjunk from './modes/goodjunk.js';

// ---------- Shorthands ----------
const MODES = { goodjunk };
const $ = (s)=>document.querySelector(s);
const sleep = (ms)=>new Promise(r=>setTimeout(r,ms));
const clamp = (n,a,b)=>Math.max(a,Math.min(b,n));
const nowMs = ()=> (performance?.now?.() ?? Date.now());

// ---------- Core singletons ----------
const engine = new Engine();
const hud    = new HUD();
const coach  = new Coach({ lang:'TH' });
const sfx    = new SFX();
const score  = new ScoreSystem();
const power  = new PowerUpSystem();
const board  = new Leaderboard({ key:'hha_board', maxKeep:300, retentionDays:180 });
const mission= new MissionSystem();
Quests.bindToMain({ hud, coach });
power.attachToScore(score);
hud.bindPower?.(power);

// ---------- Global run state ----------
let playing=false, started=false, rafId=0;
let tickId=null, guardId=null, spawnGuardId=null;
let lastFrame=0, wallTotal=45, wallLeft=45;
let currentMode='goodjunk', currentDiff='Normal';
let active=null;
const stateRef={ missions:[], ctx:{} };

// ---------- BUS: bridge mode <-> main ----------
const BUS = {
  hit(e){
    const pts = e?.points|0;
    const kind = (e?.kind==='perfect')?'perfect':'good';
    score.add(pts,{kind});
    hud.updateHUD(score.get(), score.combo|0);
    if(e?.ui) hud.showFloatingText?.(e.ui.x,e.ui.y,`+${pts}`);
    if(kind==='perfect') coach.onPerfect(); else coach.onGood();
    mission.onEvent(kind,{count:1},stateRef);
    if(e?.meta?.golden) power.add(20);
  },
  miss(){ score.add(0); coach.onMiss(); mission.onEvent('miss',{count:1},stateRef); },
  bad(){  score.add(0); coach.onJunk(); mission.onEvent('wrong_group',{count:1},stateRef); },
  sfx:{ good(){sfx.good();}, bad(){sfx.bad();}, perfect(){sfx.perfect();}, power(){sfx.power();} }
};

// ---------- Countdown (guarded from double-run) ----------
let countdownRan=false;
async function preCountdown(){
  if (countdownRan) return;
  countdownRan = true;
  hud.showBig('3'); sfx.tick(); await sleep(650);
  hud.showBig('2'); sfx.tick(); await sleep(650);
  hud.showBig('1'); sfx.tick(); await sleep(650);
  hud.showBig('GO!'); sfx.tick(); await sleep(450);
}

// ---------- Solid 1s wall-clock timer ----------
function armWallTimer(){
  clearInterval(tickId);
  tickId = setInterval(()=>{
    if (!playing) return;
    if (wallLeft>0){
      wallLeft = Math.max(0, wallLeft-1);
      hud.setTimer(wallLeft);
      sfx.tick();
      power.drain?.(0.5);
      mission.tick(stateRef, { score: score.get() }, null, { hud, coach, lang:'TH' });
      if (wallLeft===0) endRun();
    }
  }, 1000);
}

// ---------- Spawn watchdog ----------
function armSpawnGuard(){
  clearTimeout(spawnGuardId);
  spawnGuardId = setTimeout(()=>{
    if(!playing) return;
    const hasAny = document.querySelector('#spawnHost .gj-it');
    if (!hasAny){
      try{
        active?.nudge?.(BUS);       // เติม 1–2 ชิ้น
        active?.start?.({ difficulty: currentDiff }); // รีสตาร์ตโหมดถ้าจำเป็น
      }catch{}
    }
  }, 2200);
}

// ---------- Game loop ----------
function loop(){
  if(!playing) return;
  rafId = requestAnimationFrame(loop);
  const t = nowMs();
  let dt = (t - lastFrame) / 1000;
  if (!(dt>0)) dt = 0.016;        // กัน NaN/0
  if (dt>0.5)  dt = 0.5;          // กันกระโดดเฟรม
  lastFrame = t;
  try{ active?.update?.(dt, BUS); }catch(e){ console.warn(e); }
}

// ---------- Start / End ----------
function beginRun({modeKey, diff='Normal', seconds=45}){
  document.body.setAttribute('data-playing','1');
  playing = true;

  // reset
  score.reset(); power.resetFever?.();
  wallTotal = clamp(seconds|0, 10, 300);
  wallLeft  = wallTotal;
  lastFrame = nowMs();
  hud.setTop({ mode:shortMode(modeKey), diff });
  hud.setTimer(wallLeft);
  hud.resetBars?.();
  coach.onStart();

  // missions
  const run = mission.start(modeKey,{ seconds:wallTotal, count:3, lang:'TH', singleActive:true });
  mission.attachToState(run, stateRef);
  const chips = mission.tick(stateRef, { score:0 }, null, { hud, coach, lang:'TH' });
  if (chips?.[0]) hud.showMiniQuest?.(chips[0].label);

  // mode
  active = MODES[modeKey];
  active?.start?.({ difficulty: diff });

  // timers
  armWallTimer();
  clearInterval(guardId);
  guardId = setInterval(()=>armSpawnGuard(), 4000);
  armSpawnGuard();

  // loop
  loop();
}

function endRun(){
  if(!playing) return;
  playing=false;

  try{ cancelAnimationFrame(rafId); }catch{}
  clearInterval(tickId); tickId=null;
  clearInterval(guardId); guardId=null;
  clearTimeout(spawnGuardId); spawnGuardId=null;

  try{ active?.stop?.(); }catch{}
  try{ active?.cleanup?.(); }catch{}
  const host=document.getElementById('spawnHost'); if(host) host.innerHTML='';

  mission.stop(stateRef);

  const finalScore=score.get()|0;
  const bestCombo=score.bestCombo|0;
  const finalChips=(stateRef.missions||[]).map(m=>({ key:m.key, ok:!!m.success, need:m.target|0, got:m.progress|0 }));
  const extra = finalChips.map(c=>{
    const icon=({collect_goods:'🍎',count_perfect:'🌟',count_golden:'🟡',reach_combo:'🔥',no_miss:'❌',score_reach:'🏁',target_hits:'🎯'})[c.key]||'⭐';
    const name=mission.describe({key:c.key,target:c.need}, 'TH');
    const mark=c.ok?'✅':'❌';
    return `${mark} ${icon} ${name} — ${c.got}/${c.need}`;
  });

  try{ board.submit(currentMode, currentDiff, finalScore, { meta:{ bestCombo } }); }catch{}

  hud.showResult({
    title:'สรุปผล',
    desc:`โหมด: ${shortMode(currentMode)} • ระดับ: ${currentDiff}`,
    stats:[`คะแนน: ${finalScore}`, `คอมโบสูงสุด: ${bestCombo}`],
    extra
  });

  hud.onHome = ()=>{
    try{
      const mb=$('#menuBar'); if(mb){ mb.removeAttribute('data-hidden'); mb.style.display='flex'; }
      hud.hideResult?.(); hud.resetBars?.(); document.body.removeAttribute('data-playing');
      const host=document.getElementById('spawnHost'); if(host) host.innerHTML='';
    }catch{ location.reload(); }
  };
  hud.onRetry = ()=>{
    hud.hideResult?.(); hud.resetBars?.(); mission.reset(stateRef); power.resetFever?.();
    beginRun({ modeKey: currentMode, diff: currentDiff, seconds: wallTotal });
  };

  document.body.removeAttribute('data-playing');
  hud.showFever?.(false);
}

// ---------- Public start ----------
async function startGame(){
  if (started) return;            // กันซ้ำ
  started = true;

  // โหมด/ระดับจาก <body>
  currentMode = document.body.getAttribute('data-mode') || 'goodjunk';
  currentDiff = document.body.getAttribute('data-diff') || 'Normal';
  if (!MODES[currentMode]){ alert('Mode not found: '+currentMode); return; }

  // ซ่อนเมนูถ้ามี
  const mb=$('#menuBar'); if(mb){ mb.setAttribute('data-hidden','1'); mb.style.display='none'; }

  // ปลดล็อกเสียง/อินพุต: แตะครั้งแรกที่หน้าจอ
  const unlock = ()=>{ try{ sfx.tick(); }catch{} window.removeEventListener('pointerdown', unlock); };
  window.addEventListener('pointerdown', unlock, { once:true });

  countdownRan=false;
  await preCountdown();
  beginRun({ modeKey: currentMode, diff: currentDiff, seconds: 45 });
}

// ---------- Helpers ----------
function shortMode(m){
  if(m==='goodjunk') return 'Good vs Junk';
  if(m==='groups')   return '5 Groups';
  if(m==='hydration')return 'Hydration';
  if(m==='plate')    return 'Healthy Plate';
  return String(m||'');
}

// ---------- Visibility / Pause ----------
document.addEventListener('visibilitychange', ()=>{
  if (document.hidden){ try{ cancelAnimationFrame(rafId); }catch{} }
  else if (playing){ lastFrame=nowMs(); loop(); }
});

// ---------- Robust autoboot ----------
function bootOnce(){
  if (playing || started) return startGame();
  return startGame();
}

// DOM ready paths (หลายเส้นทางเพื่อกัน race)
if (document.readyState === 'complete' || document.readyState === 'interactive'){
  setTimeout(bootOnce, 0);
}else{
  document.addEventListener('DOMContentLoaded', ()=>setTimeout(bootOnce,0), { once:true });
  window.addEventListener('load', ()=>setTimeout(bootOnce,0), { once:true });
}

// 1.5s แล้วไม่เริ่ม → บูตซ้ำ
setTimeout(()=>{ if (!playing) bootOnce(); }, 1500);

// Space เริ่มเกม (desktop) / touch จะปลดล็อกเสียง
window.addEventListener('keydown', (e)=>{
  if ((e.code==='Space'||e.key===' ') && !playing){ e.preventDefault(); bootOnce(); }
});

// ---------- Expose ----------
function stopLoop(){
  try{ cancelAnimationFrame(rafId); }catch{}
  clearInterval(tickId); tickId=null;
  clearInterval(guardId); guardId=null;
  clearTimeout(spawnGuardId); spawnGuardId=null;
  playing=false;
}
window.HHA = { startGame, __stopLoop: stopLoop };
console.log('[HeroHealth] main.js — failsafe boot + solid timer + watchdog');