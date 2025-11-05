// === Hero Health Academy — game/main.js (CLASSIC-LITE)

if (window.HHA?.__stopLoop) { try{ window.HHA.__stopLoop(); }catch{} delete window.HHA; }

import { HUD } from './core/hud.js';
import { Coach } from './core/coach.js';
import { SFX } from './core/sfx.js';
import { ScoreSystem } from './core/score.js';
import { PowerUpSystem } from './core/powerup.js';
import { Quests } from './core/quests.js';
import { MissionSystem } from './core/mission-system.js';
import { Leaderboard } from './core/leaderboard.js';
import * as goodjunk from './modes/goodjunk.js';

const RUN_SECONDS = 45;

const MODES = { goodjunk };
const $  = (s)=>document.querySelector(s);
const sleep = (ms)=>new Promise(r=>setTimeout(r,ms));

let playing=false, countingDown=false, activeMode=null;
let wallSecondsLeft=RUN_SECONDS, tickTimer=null;

const hud=new HUD(), coach=new Coach({lang:'TH'}), sfx=new SFX();
const score=new ScoreSystem(), power=new PowerUpSystem();
const board=new Leaderboard({key:'hha_board', maxKeep:300, retentionDays:180});
const mission=new MissionSystem(); const stateRef={ missions:[], ctx:{} };

Quests.bindToMain({hud,coach}); power.attachToScore(score);
power.onFever(v=>{ const f=hud.$powerFill; if(f) f.style.width=Math.max(0,Math.min(100,v))+'%'; });

const BUS={
  hit(e){ const pts=e?.points|0; const kind=(e?.kind==='perfect')?'perfect':'good';
    score.add(pts,{kind}); hud.updateHUD(score.get(),score.combo|0);
    if(e?.ui) hud.showFloatingText?.(e.ui.x,e.ui.y,`+${pts}`);
    if(kind==='perfect') coach.onPerfect(); else coach.onGood();
    mission.onEvent(kind,{count:1},stateRef); if(e?.meta?.golden) power.add(20);
  },
  miss(){ score.add(0); coach.onMiss(); mission.onEvent('miss',{count:1},stateRef); },
  bad(){  score.add(0); coach.onJunk(); mission.onEvent('wrong_group',{count:1},stateRef); },
  sfx:{ good(){sfx.good();}, bad(){sfx.bad();}, perfect(){sfx.perfect();}, power(){sfx.power();} }
};

function ensureSpawnHost(){
  let host=document.getElementById('spawnHost');
  if(!host){ host=document.createElement('div'); host.id='spawnHost'; host.style.cssText='position:fixed;inset:0;z-index:5000;pointer-events:auto'; document.body.appendChild(host); }
  document.querySelectorAll('canvas').forEach(c=>{ try{ c.style.pointerEvents='none'; c.style.zIndex='1'; }catch{} });
}

async function preCountdown(){
  if(countingDown) return; countingDown=true;
  hud.showBig('3'); sfx.tick(); await sleep(500);
  hud.showBig('2'); sfx.tick(); await sleep(500);
  hud.showBig('1'); sfx.tick(); await sleep(500);
  hud.showBig('GO!'); sfx.tick(); await sleep(350);
  countingDown=false;
}

function startTimer(){
  clearInterval(tickTimer);
  wallSecondsLeft=RUN_SECONDS; hud.setTimer(wallSecondsLeft);
  tickTimer=setInterval(()=>{
    if(!playing) return;
    wallSecondsLeft=Math.max(0, wallSecondsLeft-1);
    hud.setTimer(wallSecondsLeft); sfx.tick(); power.drain(0.5);
    mission.tick(stateRef,{score:score.get()},null,{hud,coach,lang:'TH'});
    if(wallSecondsLeft===0) endRun();
  },1000);
}

function beginRun({modeKey,diff='Normal'}){
  ensureSpawnHost();
  document.body.setAttribute('data-playing','1');
  playing=true; score.reset(); power.resetFever(); hud.hideResult?.();

  hud.setTop({mode:shortMode(modeKey), diff}); hud.resetBars?.(); startTimer(); coach.onStart();

  try{
    const run = mission.start(modeKey,{seconds:RUN_SECONDS,count:3,lang:'TH',singleActive:true});
    mission.attachToState(run,stateRef);
    const chips=mission.tick(stateRef,{score:0},null,{hud,coach,lang:'TH'});
    if(chips?.[0]) hud.showMiniQuest?.(chips[0].label);
  }catch{}

  activeMode = MODES[modeKey];
  try{ activeMode?.start?.({difficulty:diff}); }catch{}

  // ไม่ใช้ watchdog ซ้อนชั้น: ปล่อยให้โหมดจัดการสปอนเองแบบเดิม
  // main loop ไม่จำเป็นใน legacy เพราะโหมดใช้ interval
}

function endRun(){
  if(!playing) return; playing=false;
  clearInterval(tickTimer);
  try{ activeMode?.stop?.(); activeMode?.cleanup?.(); }catch{}
  const host=document.getElementById('spawnHost'); if(host) host.innerHTML='';
  mission.stop(stateRef);

  const finalScore=score.get()|0, bestCombo=score.bestCombo|0;
  try{ board.submit('goodjunk', document.body.getAttribute('data-diff')||'Normal', finalScore, {meta:{bestCombo}}); }catch{}
  hud.showResult({ title:'สรุปผล', desc:`โหมด: ${shortMode('goodjunk')} • ระดับ: ${document.body.getAttribute('data-diff')||'Normal'}`,
    stats:[`คะแนน: ${finalScore}`, `คอมโบสูงสุด: ${bestCombo}`], extra:[] });

  hud.onHome=()=>{
    try{
      const mb=$('#menuBar'); if(mb){ mb.removeAttribute('data-hidden'); mb.style.display='flex'; }
      hud.hideResult?.(); hud.resetBars?.(); document.body.removeAttribute('data-playing');
      const host=document.getElementById('spawnHost'); if(host) host.innerHTML='';
      setTimeout(()=>$('#btn_start')?.focus(),100);
    }catch{ location.reload(); }
  };
  hud.onRetry=()=>{ hud.hideResult?.(); hud.resetBars?.(); mission.reset(stateRef); power.resetFever(); beginRun({modeKey:'goodjunk', diff: document.body.getAttribute('data-diff')||'Normal'}); };
}

function shortMode(m){ return m==='goodjunk' ? 'Good vs Junk' : String(m||''); }

async function startGame(){
  if(playing||countingDown) return;
  const mb=$('#menuBar'); if(mb){ mb.setAttribute('data-hidden','1'); mb.style.display='none'; }
  await preCountdown(); beginRun({modeKey:document.body.getAttribute('data-mode')||'goodjunk', diff:document.body.getAttribute('data-diff')||'Normal'});
}

function stopLoop(){ clearInterval(tickTimer); playing=false; countingDown=false; }

window.HHA = { startGame, __stopLoop: stopLoop };
console.log('[HeroHealth] main.js — CLASSIC-LITE (legacy stable)');
