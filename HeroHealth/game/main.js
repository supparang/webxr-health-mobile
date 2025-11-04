// === Hero Health Academy — game/main.js (robust countdown + rAF/Interval dual + spawn watchdog) ===
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

const MODES = { goodjunk };
const $  = (s)=>document.querySelector(s);
const sleep = (ms)=>new Promise(r=>setTimeout(r,ms));
const clamp = (n,a,b)=>Math.max(a,Math.min(b,n));
const nowMs = ()=>performance.now?performance.now():Date.now();

let booted=false, playing=false, rafId=0, activeMode=null;
let wallSecondsTotal=45, wallSecondsLeft=45;
let startWallMs=0, endWallMs=0, lastFrameMs=0;
let currentModeKey='goodjunk', currentDiff='Normal';
let spawnGuardAt=0;
let secTimerId=null; // backup 1s timer

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

power.onFever(v=>{
  if (v>=100){ hud.showFever(true); sfx.power(); setTimeout(()=>{ hud.showFever(false); power.resetFever(); }, 5000); }
});

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

async function preCountdown(){
  hud.showBig('3'); sfx.tick(); await sleep(650);
  hud.showBig('2'); sfx.tick(); await sleep(650);
  hud.showBig('1'); sfx.tick(); await sleep(650);
  hud.showBig('GO!'); sfx.tick(); await sleep(450);
}

function armSpawnWatchdog(t0){
  spawnGuardAt = t0 + 2200; // ตรวจครั้งแรกหลังเริ่ม 2.2s
}

function beginRun({modeKey,diff='Normal',seconds=45}){
  try{
    document.body.setAttribute('data-playing','1');
    playing=true;

    score.reset(); power.resetFever();
    wallSecondsTotal = clamp(seconds|0,10,300);
    const t0 = nowMs();
    startWallMs = t0;
    endWallMs   = t0 + wallSecondsTotal*1000;
    lastFrameMs = t0;
    wallSecondsLeft = wallSecondsTotal;

    hud.setTop({mode:shortMode(modeKey), diff});
    hud.resetBars?.();
    hud.setTimer(wallSecondsLeft);     // << อัปเดตทันทีให้เห็นตัวเลข
    coach.onStart();

    const run = mission.start(modeKey,{ seconds:wallSecondsTotal, count:3, lang:'TH', singleActive:true });
    mission.attachToState(run, stateRef);
    const chips = mission.tick(stateRef, { score:0 }, null, { hud, coach, lang:'TH' });
    if (chips?.[0]) hud.showMiniQuest?.(chips[0].label);

    activeMode = MODES[modeKey];
    activeMode?.start?.({ difficulty: diff });

    // spawn watchdog
    armSpawnWatchdog(t0);

    // backup 1s timer (เผื่อ rAF สะดุดบนบางเว็บวิว)
    clearInterval(secTimerId);
    secTimerId = setInterval(()=>{
      if(!playing) return;
      const remain = Math.max(0, Math.ceil((endWallMs - nowMs())/1000));
      if (remain !== wallSecondsLeft){
        wallSecondsLeft = remain;
        hud.setTimer(wallSecondsLeft);
        sfx.tick();
        power.drain(0.5);
        mission.tick(stateRef, { score: score.get() }, null, { hud, coach, lang:'TH' });
        if (wallSecondsLeft<=0){ endRun(); }
      }
    }, 1000);

    loop();
  }catch(err){
    console.error('[HHA] beginRun error:', err);
    // ฟื้นตัวแบบง่าย: ล้างสภาพแล้วลองเริ่มโหมดใหม่
    try{ activeMode?.cleanup?.(); }catch{}
    setTimeout(()=>{ try{ MODES[modeKey]?.start?.({difficulty:diff}); }catch{}; loop(); }, 50);
  }
}

function endRun(){
  if(!playing) return;
  playing=false;

  try{ cancelAnimationFrame(rafId); }catch{}
  clearInterval(secTimerId); secTimerId=null;

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

  const t = nowMs();

  // countdown จาก endWallMs (แหล่งจริง)
  const remMs = Math.max(0, endWallMs - t);
  const newLeft = Math.ceil(remMs/1000);
  if (newLeft !== wallSecondsLeft){
    wallSecondsLeft = newLeft;
    hud.setTimer(wallSecondsLeft);
    sfx.tick();
    power.drain(0.5);
    mission.tick(stateRef, { score: score.get() }, null, { hud, coach, lang:'TH' });
    if (wallSecondsLeft<=0){ endRun(); return; }
  }

  // per-frame โหมด
  let dt = (t - lastFrameMs)/1000;
  if (!(dt>0) || dt>1.5) dt = 0.016;
  lastFrameMs = t;
  try{ activeMode?.update?.(dt, BUS); }catch(e){ console.warn(e); }

  // spawn watchdog: ถ้ายังไม่มีของ → สั่ง start ซ้ำ
  if (t >= spawnGuardAt){
    spawnGuardAt = t + 4000;
    const hasAny = document.querySelector('#spawnHost .gj-it');
    if (!hasAny){ try{ activeMode?.start?.({ difficulty: currentDiff }); }catch{} }
  }
}

async function startGame(){
  if (booted && playing) return;
  booted = true;

  currentModeKey=document.body.getAttribute('data-mode')||'goodjunk';
  currentDiff=document.body.getAttribute('data-diff')||'Normal';
  if (!MODES[currentModeKey]){ alert('Mode not found: '+currentModeKey); return; }

  const mb = $('#menuBar'); if (mb){ mb.setAttribute('data-hidden','1'); mb.style.display='none'; }
  await preCountdown();
  beginRun({ modeKey: currentModeKey, diff: currentDiff, seconds: 45 });
}

function stopLoop(){ try{ cancelAnimationFrame(rafId); }catch{} clearInterval(secTimerId); secTimerId=null; playing=false; }

function shortMode(m){
  if(m==='goodjunk') return 'Good vs Junk';
  return String(m||'');
}

// auto-boot เดียว
function autoBoot(){ if (!booted && !playing) startGame(); }
if (document.readyState === 'complete' || document.readyState === 'interactive') setTimeout(autoBoot,0);
else {
  document.addEventListener('DOMContentLoaded', ()=>setTimeout(autoBoot,0), {once:true});
  window.addEventListener('load', ()=>setTimeout(autoBoot,0), {once:true});
}
window.addEventListener('keydown', (e)=>{ if ((e.code==='Space'||e.key===' ') && !playing){ e.preventDefault(); autoBoot(); } });

window.HHA = { startGame, __stopLoop: stopLoop };
console.log('[HeroHealth] main.js — robust countdown + spawn watchdog + dual timer');