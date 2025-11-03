// === Hero Health Academy — game/main.js (Finish flow fixed: real stop + summary + buttons) ===

// ถ้ามี HHA เก่าอยู่ ให้หยุดลูปและเคลียร์ก่อน (กัน re-import แล้ว loop ซ้ำ)
if (window.HHA?.__stopLoop) {
  try { window.HHA.__stopLoop(); } catch(e){}
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
const now = ()=>performance.now?performance.now():Date.now();

let playing=false, rafId=0, activeMode=null;
let wallSecondsTotal=45, wallSecondsLeft=45, lastWallMs=0;
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

// ---------- BUS (เชื่อมโหมดเกมกับระบบหลัก) ----------
const BUS={
  hit(e){
    const pts=e?.points|0;
    const kind=(e?.kind==='perfect')?'perfect':'good';
    score.add(pts,{kind});
    hud.updateHUD(score.get(),score.combo|0);
    if(e?.ui) hud.showFloatingText(e.ui.x,e.ui.y,`+${pts}`);
    if(kind==='perfect') coach.onPerfect(); else coach.onGood();
    // เควสต์นับความคืบหน้า
    mission.onEvent(kind,{count:1},stateRef);
  },
  miss(){
    score.add(0); coach.onMiss();
    mission.onEvent('miss',{count:1},stateRef);
  },
  bad(){
    score.add(0); coach.onJunk();
    // ใน goodjunk: treat เป็นผิดหมวด (เพื่อให้ no_miss/score_reach มีผลทางอ้อม)
    mission.onEvent('wrong_group',{count:1},stateRef);
  },
  sfx:{ good(){sfx.good();}, bad(){sfx.bad();}, perfect(){sfx.perfect();}, power(){sfx.power();} }
};

// ---------- Flow ----------
async function preCountdown(){
  hud.showBig('3'); sfx.tick(); await sleep(650);
  hud.showBig('2'); sfx.tick(); await sleep(650);
  hud.showBig('1'); sfx.tick(); await sleep(650);
  hud.showBig('GO!'); sfx.tick(); await sleep(450);
}

function beginRun({modeKey,diff='Normal',seconds=45}){
  document.body.setAttribute('data-playing','1');
  playing=true;

  // reset run
  score.reset();
  wallSecondsTotal = clamp(seconds|0,10,300);
  wallSecondsLeft  = wallSecondsTotal;
  lastWallMs = now();

  hud.setTop({mode:shortMode(modeKey), diff});
  hud.resetBars?.();
  coach.onStart();

  // ภารกิจแบบ single-active (แสดงทีละอัน)
  const run = mission.start(modeKey,{ seconds:wallSecondsTotal, count:3, lang:'TH', singleActive:true });
  mission.attachToState(run, stateRef);

  // ให้ HUD แสดงเควสต์ตัวแรกทันที
  const chips = mission.tick(stateRef, { score:0 }, null, { hud, coach, lang:'TH' });
  if (chips?.[0]) hud.showMiniQuest?.(chips[0].label);

  // start mode
  activeMode = MODES[modeKey];
  activeMode?.start?.({ difficulty: diff });

  loop();
}

function endRun(){
  if(!playing) return;

  // --- hard stop ---
  playing=false;
  try{ cancelAnimationFrame(rafId); }catch{}
  try{ activeMode?.stop?.(); }catch{}
  try{ activeMode?.cleanup?.(); }catch{}
  const host=document.getElementById('spawnHost'); if(host) host.innerHTML='';

  // --- finalize missions ---
  mission.stop(stateRef);

  // --- summary data ---
  const finalScore = score.get()|0;
  const bestCombo  = score.bestCombo|0;

  // รวบรวมสถานะ mini-quest สุดท้าย
  const finalChips = (stateRef.missions||[]).map(m=>({
    key:m.key, ok:!!m.success, need:m.target|0, got:m.progress|0
  }));

  const extra = finalChips.map(c=>{
    const icon = ({collect_goods:'🍎',count_perfect:'🌟',count_golden:'🟡',reach_combo:'🔥',no_miss:'❌',score_reach:'🏁',target_hits:'🎯'})[c.key] || '⭐';
    const name = mission.describe({key:c.key,target:c.need}, 'TH');
    const mark = c.ok ? '✅' : '❌';
    return `${mark} ${icon} ${name} — ${c.got}/${c.need}`;
  });

  // --- leaderboard (optional) ---
  try{ board.submit(currentModeKey, currentDiff, finalScore, { meta:{ bestCombo } }); }catch{}

  // --- show result modal + ปุ่มทำงานจริง ---
  hud.showResult({
    title:'สรุปผล',
    desc:`โหมด: ${shortMode(currentModeKey)} • ระดับ: ${currentDiff}`,
    stats:[`คะแนน: ${finalScore}`, `คอมโบสูงสุด: ${bestCombo}`],
    extra
  });

  hud.onHome = ()=>{
    try{
      // แสดงเมนูหลักกลับมา
      const mb = $('#menuBar');
      if (mb){ mb.removeAttribute('data-hidden'); mb.style.display='flex'; }
      hud.hideResult?.();
      hud.resetBars?.();
      document.body.removeAttribute('data-playing');
      // ล้างสแปน/สไปน์ที่อาจค้าง
      const host=document.getElementById('spawnHost'); if(host) host.innerHTML='';
    }catch{
      location.reload();
    }
  };

  hud.onRetry= ()=>{
    hud.hideResult?.();
    hud.resetBars?.();
    mission.reset(stateRef);
    beginRun({ modeKey: currentModeKey, diff: currentDiff, seconds: wallSecondsTotal });
  };

  // ถอนสถานะเล่น + ปิดเอฟเฟกต์ไข้
  document.body.removeAttribute('data-playing');
  hud.showFever?.(false);
}

function loop(){
  if(!playing) return;
  rafId=requestAnimationFrame(loop);

  // wall-clock timer เดินทุกวินาที (ไม่ชนกับ mini-quest)
  const t=now();
  const dtMs=t-lastWallMs;
  if (dtMs >= 1000){
    const step = Math.floor(dtMs/1000);
    wallSecondsLeft = Math.max(0, wallSecondsLeft - step);
    lastWallMs += step*1000;
    hud.setTimer(wallSecondsLeft);
    sfx.tick();

    // tick missions (single-active) — ให้ HUD อัปเดต progress ชิปเดียว
    mission.tick(stateRef, { score: score.get() }, null, { hud, coach, lang:'TH' });
  }

  // per-frame ของโหมด
  try{ activeMode?.update?.(dtMs/1000, BUS); }catch(e){ console.warn(e); }

  // หมดเวลา => จบเกม
  if (wallSecondsLeft <= 0){
    endRun();
  }
}

// ---------- Public ----------
async function startGame(){
  currentModeKey=document.body.getAttribute('data-mode')||'goodjunk';
  currentDiff=document.body.getAttribute('data-diff')||'Normal';
  if (!MODES[currentModeKey]){ alert('Mode not found: '+currentModeKey); return; }

  // ซ่อนเมนู
  const mb = $('#menuBar'); if (mb){ mb.setAttribute('data-hidden','1'); mb.style.display='none'; }

  await preCountdown();
  beginRun({ modeKey: currentModeKey, diff: currentDiff, seconds: 45 });
}

function stopLoop(){
  try{ cancelAnimationFrame(rafId); }catch{}
  playing=false;
}

function shortMode(m){
  if(m==='goodjunk') return 'Good vs Junk';
  if(m==='groups') return '5 Groups';
  if(m==='hydration') return 'Hydration';
  if(m==='plate') return 'Healthy Plate';
  return String(m||'');
}

window.HHA = { startGame, __stopLoop: stopLoop };
console.log('[HeroHealth] main.js — finish flow fixed');
