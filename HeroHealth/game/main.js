// === Hero Health Academy — game/main.js (autostart + solid timer + spawn-guard + fever) ===

// เคลียร์อินสแตนซ์เดิมถ้ามี (กัน re-import แล้วลูปซ้อน)
if (window.HHA?.__stopLoop) {
  try { window.HHA.__stopLoop(); } catch {}
  delete window.HHA;
}

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
const pnow  = ()=>performance.now?performance.now():Date.now();

let playing=false, rafId=0, activeMode=null;
let wallSecondsTotal=45, wallSecondsLeft=45;
let lastFrameMs=0;
let tickTimerId=null;        // จับเวลา 1s (ไม่พึ่ง rAF)
let spawnGuardId=null;       // ตรวจครั้งแรกหลังเริ่ม
let guardTimerId=null;       // ตรวจซ้ำเป็นระยะ (กันเงียบ)
let currentModeKey='goodjunk', currentDiff='Normal';

// ---------- Core instances ----------
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

// ---------- Fever ----------
power.onFever(v=>{
  if (hud.$powerFill) hud.$powerFill.style.width = Math.max(0, Math.min(100, v)) + '%';
  if (v >= 100) {
    hud.showFever(true); sfx.power();
    setTimeout(()=>{ hud.showFever(false); power.resetFever(); }, 5000);
  }
});

// ---------- BUS (เชื่อมโหมด ↔ ระบบหลัก) ----------
const BUS={
  hit(e){
    const pts=e?.points|0;
    const kind=(e?.kind==='perfect')?'perfect':'good';
    score.add(pts,{kind});
    hud.updateHUD(score.get(),score.combo|0);
    if(e?.ui) hud.showFloatingText?.(e.ui.x,e.ui.y,`+${pts}`);
    if(kind==='perfect') coach.onPerfect(); else coach.onGood();
    mission.onEvent(kind,{count:1},stateRef);

    // Golden → เติม FEVER
    if (e?.meta?.golden) power.add(20);
  },
  miss(){ score.add(0); coach.onMiss(); mission.onEvent('miss',{count:1},stateRef); },
  bad(){  score.add(0); coach.onJunk(); mission.onEvent('wrong_group',{count:1},stateRef); },
  sfx:{ good(){sfx.good();}, bad(){sfx.bad();}, perfect(){sfx.perfect();}, power(){sfx.power();} }
};

// ---------- Flow helpers ----------
async function preCountdown(){
  hud.showBig('3'); sfx.tick(); await sleep(650);
  hud.showBig('2'); sfx.tick(); await sleep(650);
  hud.showBig('1'); sfx.tick(); await sleep(650);
  hud.showBig('GO!'); sfx.tick(); await sleep(450);
}

function armSpawnGuard(){
  clearTimeout(spawnGuardId);
  // หลังเริ่ม 2.5s ถ้ายังไม่มีอะไรเกิดเลย ให้สั่ง start โหมดซ้ำ
  spawnGuardId = setTimeout(()=>{
    if(!playing) return;
    const hasAny = document.querySelector('#spawnHost .gj-it');
    if (!hasAny) {
      try{ activeMode?.start?.({ difficulty: currentDiff, bus: BUS }); }catch{}
    }
  }, 2500);
}

function beginRun({modeKey,diff='Normal',seconds=45}){
  document.body.setAttribute('data-playing','1');
  playing=true;

  // reset run
  score.reset(); power.resetFever();
  wallSecondsTotal = clamp(seconds|0,10,300);
  wallSecondsLeft  = wallSecondsTotal;
  lastFrameMs = pnow();

  hud.setTop({mode:shortMode(modeKey), diff});
  hud.resetBars?.();
  hud.setTimer(wallSecondsLeft);
  coach.onStart();

  // missions
  const run = mission.start(modeKey,{ seconds:wallSecondsTotal, count:3, lang:'TH', singleActive:true });
  mission.attachToState(run, stateRef);
  const chips = mission.tick(stateRef, { score:0 }, null, { hud, coach, lang:'TH' });
  if (chips?.[0]) hud.showMiniQuest?.(chips[0].label);

  // start mode — ส่ง BUS เข้าไปด้วย (สำคัญ!)
  activeMode = MODES[modeKey];
  activeMode?.start?.({ difficulty: diff, bus: BUS });

  // จับเวลา 1 วินาที (ไม่ผูกกับ rAF)
  clearInterval(tickTimerId);
  tickTimerId = setInterval(()=>{
    if(!playing) return;
    if (wallSecondsLeft>0){
      wallSecondsLeft = Math.max(0, wallSecondsLeft - 1);
      hud.setTimer(wallSecondsLeft);
      sfx.tick();
      power.drain(0.5);
      mission.tick(stateRef, { score: score.get() }, null, { hud, coach, lang:'TH' });
      if (wallSecondsLeft===0) endRun();
    }
  },1000);

  // spawn guard (ครั้งแรก + ตรวจทุก 4 วินาที)
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

  const nowMs = pnow();
  let dt = (nowMs - lastFrameMs) / 1000;
  if (!(dt>0) || dt>1.5) dt = 0.016; // กันกระโดดเฟรม/NaN
  lastFrameMs = nowMs;

  try{ activeMode?.update?.(dt, BUS); }catch(e){ console.warn(e); }
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

// ---------- Auto-bootstrap (robust) ----------
function autoBoot(){
  if (playing) return;
  currentModeKey = document.body.getAttribute('data-mode') || 'goodjunk';
  currentDiff    = document.body.getAttribute('data-diff') || 'Normal';
  const mb = document.querySelector('#menuBar');
  if (mb){ mb.setAttribute('data-hidden','1'); mb.style.display='none'; }
  startGame();
}

if (document.readyState === 'complete' || document.readyState === 'interactive') {
  setTimeout(autoBoot, 0);
} else {
  document.addEventListener('DOMContentLoaded', () => setTimeout(autoBoot, 0), { once:true });
  window.addEventListener('load', () => setTimeout(autoBoot, 0), { once:true });
}

// เพิ่ม watchdog: ถ้า 1.5s ผ่านไปแล้วยังไม่ playing → บู๊ตซ้ำ
setTimeout(()=>{ if (!playing) autoBoot(); }, 1500);

// Hotkey fallback (Space)
window.addEventListener('keydown', (e)=>{
  if ((e.code==='Space' || e.key===' ') && !playing) { e.preventDefault(); autoBoot(); }
});

// Expose manual start
window.startHHA = autoBoot;

window.HHA = { startGame, __stopLoop: stopLoop };
console.log('[HeroHealth] main.js — autostart + solid timer + spawn-guard + fever');