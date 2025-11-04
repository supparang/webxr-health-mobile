// === Hero Health Academy — game/main.js (mode-tick interval + single-boot + solid timer) ===

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
const now = ()=>performance.now?performance.now():Date.now();

let booting=false, playing=false;
let rafId=0, tick1sId=null, modeTickId=null, spawnGuardId=null, spawnGuardLoopId=null;
let activeMode=null;

let wallSecondsTotal=45, wallSecondsLeft=45, lastFrameMs=0;
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
power.onFever(v=>{ if(hud.$powerFill) hud.$powerFill.style.width=Math.max(0,Math.min(100,v))+'%'; });

// ----- BUS -----
const BUS={
  hit(e){
    const pts=e?.points|0;
    const kind=(e?.kind==='perfect')?'perfect':'good';
    score.add(pts,{kind});
    hud.updateHUD(score.get(),score.combo|0);
    if(e?.ui) hud.showFloatingText?.(e.ui.x,e.ui.y,`+${pts}`);
    if(kind==='perfect') coach.onPerfect(); else coach.onGood();
    mission.onEvent(kind,{count:1},stateRef);
    if(e?.meta?.golden) power.add(20);
  },
  miss(){ score.add(0); coach.onMiss(); mission.onEvent('miss',{count:1},stateRef); },
  bad(){ score.add(0); coach.onJunk(); mission.onEvent('wrong_group',{count:1},stateRef); },
  sfx:{ good(){sfx.good();}, bad(){sfx.bad();}, perfect(){sfx.perfect();}, power(){sfx.power();} }
};

// ----- Flow -----
async function preCountdown(){
  hud.showBig('3'); sfx.tick(); await sleep(650);
  hud.showBig('2'); sfx.tick(); await sleep(650);
  hud.showBig('1'); sfx.tick(); await sleep(650);
  hud.showBig('GO!'); sfx.tick(); await sleep(420);
}

function beginRun({modeKey,diff='Normal',seconds=45}){
  playing=true;
  score.reset(); power.resetFever();
  wallSecondsTotal = clamp(seconds|0,10,300);
  wallSecondsLeft  = wallSecondsTotal;
  lastFrameMs = now();

  document.body.setAttribute('data-playing','1');
  hud.setTop({mode:shortName(modeKey), diff});
  hud.resetBars?.();
  hud.setTimer(wallSecondsLeft);
  coach.onStart();

  const run = mission.start(modeKey,{ seconds:wallSecondsTotal, count:3, lang:'TH', singleActive:true });
  mission.attachToState(run, stateRef);
  const chips = mission.tick(stateRef, { score:0 }, null, { hud, coach, lang:'TH' });
  if (chips?.[0]) hud.showMiniQuest?.(chips[0].label);

  activeMode = MODES[modeKey];
  // เริ่มโหมด (รับพารามิเตอร์เกินได้ ไม่พัง)
  activeMode?.start?.({ difficulty: diff, bus: BUS });

  // ====== ตัวจับเวลา 1 วินาที (อิสระจาก rAF) ======
  clearInterval(tick1sId);
  tick1sId = setInterval(()=>{
    if (!playing) return;
    wallSecondsLeft = Math.max(0, wallSecondsLeft - 1);
    hud.setTimer(wallSecondsLeft);
    sfx.tick();
    power.drain?.(0.5);
    mission.tick(stateRef, { score: score.get() }, null, { hud, coach, lang:'TH' });
    if (wallSecondsLeft<=0) endRun();
  },1000);

  // ====== โหมด-ทิกแบบ setInterval เพื่อการสปอว์นแน่นอน ======
  clearInterval(modeTickId);
  // 12fps (ทุก ~83ms) พอให้ลื่นและประหยัดแบต
  modeTickId = setInterval(()=>{
    if (!playing) return;
    try{ activeMode?.update?.(0.083, BUS); }catch(e){ console.warn(e); }
  }, 83);

  // ====== Spawn guard: บังคับสตาร์ทโหมดถ้าไม่มีของ ======
  clearTimeout(spawnGuardId); clearInterval(spawnGuardLoopId);
  spawnGuardId = setTimeout(()=>{
    if (!document.querySelector('#spawnHost .gj-it')) {
      try{ activeMode?.start?.({ difficulty: diff, bus: BUS }); }catch{}
    }
  }, 1200);
  spawnGuardLoopId = setInterval(()=>{
    if (!playing) return;
    if (!document.querySelector('#spawnHost .gj-it')) {
      try{ activeMode?.start?.({ difficulty: diff, bus: BUS }); }catch{}
    }
  }, 4000);

  // rAF ใช้แค่ทำงานอนิเมชันเล็ก ๆ (ไม่ critical)
  loop();
}

function endRun(){
  if(!playing) return;
  playing=false;

  try{ cancelAnimationFrame(rafId); }catch{}
  clearInterval(tick1sId); tick1sId=null;
  clearInterval(modeTickId); modeTickId=null;
  clearTimeout(spawnGuardId); spawnGuardId=null;
  clearInterval(spawnGuardLoopId); spawnGuardLoopId=null;

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
    desc:`โหมด: ${shortName(currentModeKey)} • ระดับ: ${currentDiff}`,
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

  document.body.removeAttribute('data-playing');
  hud.showFever?.(false);
}

function loop(){
  if(!playing) return;
  rafId=requestAnimationFrame(loop);
  // rAF นี้ไว้เผื่อเอฟเฟกต์ภาพอื่นในอนาคต
}

// ----- Public -----
async function startGame(){
  if (booting || playing) return;
  booting=true;

  currentModeKey=document.body.getAttribute('data-mode')||'goodjunk';
  currentDiff=document.body.getAttribute('data-diff')||'Normal';
  const mb = $('#menuBar'); if (mb){ mb.setAttribute('data-hidden','1'); mb.style.display='none'; }

  await preCountdown();
  beginRun({ modeKey: currentModeKey, diff: currentDiff, seconds: 45 });

  booting=false;
}

function stopLoop(){
  try{ cancelAnimationFrame(rafId); }catch{}
  clearInterval(tick1sId); tick1sId=null;
  clearInterval(modeTickId); modeTickId=null;
  clearTimeout(spawnGuardId); spawnGuardId=null;
  clearInterval(spawnGuardLoopId); spawnGuardLoopId=null;
  playing=false; booting=false;
}

function shortName(m){
  if(m==='goodjunk') return 'Good vs Junk';
  if(m==='groups') return '5 Groups';
  if(m==='hydration') return 'Hydration';
  if(m==='plate') return 'Healthy Plate';
  return String(m||'');
}

// ----- Single autostart -----
function autoBoot(){ if(!playing && !booting) startGame(); }
if (document.readyState==='complete' || document.readyState==='interactive') setTimeout(autoBoot,0);
else {
  document.addEventListener('DOMContentLoaded', ()=>setTimeout(autoBoot,0), {once:true});
  window.addEventListener('load', ()=>setTimeout(autoBoot,0), {once:true});
}
setTimeout(()=>{ if(!playing) autoBoot(); },1500);
window.addEventListener('keydown', (e)=>{ if((e.code==='Space'||e.key===' ')&&!playing&&!booting){ e.preventDefault(); autoBoot(); } });

window.HHA = { startGame, __stopLoop: stopLoop };
console.log('[HeroHealth] main.js — mode-tick interval + solid timer + spawn-guard + single-boot');