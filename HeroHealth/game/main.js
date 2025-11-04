// === Hero Health Academy — game/main.js (Mission v4 + reliable timer + spawn guard) ===

// เคลียร์อินสแตนซ์เก่าถ้ามี
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

// โหมดที่เปิดใช้ (ตอนนี้ Good vs Junk)
import * as goodjunk from './modes/goodjunk.js';

// ---------- Helpers ----------
const MODES = { goodjunk };
const $  = (s)=>document.querySelector(s);
const sleep = (ms)=>new Promise(r=>setTimeout(r,ms));
const clamp = (n,a,b)=>Math.max(a,Math.min(b,n));
const nowMs = ()=>performance.now?performance.now():Date.now();

// ---------- State ----------
let playing = false;
let rafId = 0;
let lastFrame = 0;
let tickTimerId = null;    // จับเวลานับถอยหลังแบบ 1 วินาที
let guardTimerId = null;   // ตรวจว่าไอเท็มเกิดจริง
let spawnGuardId = null;

let activeMode = null;
let wallSecondsTotal = 45;
let wallSecondsLeft  = 45;

let currentModeKey = 'goodjunk';
let currentDiff    = 'Normal';

// ---------- Core instances ----------
const engine  = new Engine();
const hud     = new HUD();
const coach   = new Coach({lang:'TH'});
const sfx     = new SFX();
const score   = new ScoreSystem();
const power   = new PowerUpSystem();
const board   = new Leaderboard({key:'hha_board', maxKeep:300, retentionDays:180});
const mission = new MissionSystem();
const stateRef = { missions:[], ctx:{} };

Quests.bindToMain({hud, coach});
power.attachToScore(score);
hud.bindPower?.(power);

// ---------- Fever hooks ----------
power.onFever(v=>{
  // HUD.setFever ถูก bind ไว้แล้วผ่าน hud.bindPower()
  if (v >= 100){
    hud.showFever(true);
    sfx.power();
    setTimeout(()=>{ hud.showFever(false); power.resetFever(); }, 5000);
  }
});

// ---------- Game BUS (คะแนน/เควสต์/เสียง) ----------
const BUS = {
  hit(e){
    const pts  = e?.points|0;
    const kind = (e?.kind==='perfect') ? 'perfect' : 'good';

    score.add(pts, { kind });
    hud.updateHUD(score.get(), score.combo|0);

    // floating text
    if (e?.ui) hud.showFloatingText?.(e.ui.x, e.ui.y, `+${pts}`);

    // coach cue
    if (kind==='perfect') coach.onPerfect(); else coach.onGood();

    // ส่ง event เข้า mission
    mission.onEvent(kind, { count:1 }, stateRef);
    mission.onEvent('combo', { combo: score.combo|0 }, stateRef);  // <— สำคัญสำหรับ reach_combo

    // ⭐ Golden → เติม fever + แจ้ง mission
    if (e?.meta?.golden){
      power.add(20);
      mission.onEvent('golden', { fever:20 }, stateRef);
      sfx.power();
    } else {
      sfx.good();
    }
  },
  miss(){
    score.add(0);
    coach.onMiss();
    mission.onEvent('miss', { count:1 }, stateRef);
    sfx.bad();
  },
  bad(){
    score.add(0);
    coach.onJunk();
    mission.onEvent('wrong_group', { count:1 }, stateRef);
    sfx.bad();
  },
  sfx:{
    good(){ sfx.good(); },
    bad(){ sfx.bad(); },
    perfect(){ sfx.perfect(); },
    power(){ sfx.power(); }
  }
};

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
    if (!playing) return;
    const hasAny = document.querySelector('#spawnHost .gj-it');
    if (!hasAny){
      // ถ้ายังไม่เกิดเลย ให้สั่ง start mode ซ้ำเพื่อ bootstrap
      try { activeMode?.start?.({ difficulty: currentDiff }); } catch {}
    }
  }, 1800);
}

function beginRun({ modeKey, diff='Normal', seconds=45 }){
  document.body.setAttribute('data-playing','1');
  playing = true;

  // reset run
  score.reset();
  power.resetFever();
  wallSecondsTotal = clamp(seconds|0, 10, 300);
  wallSecondsLeft  = wallSecondsTotal;
  lastFrame = nowMs();

  hud.setTop({ mode: shortMode(modeKey), diff });
  hud.resetBars?.();
  hud.setTimer(wallSecondsLeft);
  coach.onStart();

  // prepare missions (3 เควสต์, ไม่ซ้ำ, ทีละ 1)
  const run = mission.start(
    modeKey,
    { seconds: wallSecondsTotal, count: 3, lang: 'TH', singleActive: true, diff }
  );
  mission.attachToState(run, stateRef);
  mission.tick(stateRef, { score:0, combo:0 }, null, { hud, coach, lang:'TH' });
  // โชว์เควสต์ตัวแรก
  if (stateRef.missions?.[0]) hud.showMiniQuest?.(stateRef.missions[0].label);

  // start mode
  activeMode = MODES[modeKey];
  activeMode?.start?.({ difficulty: diff });

  // solid 1s timer (เป็นแหล่งนับเวลาหลัก)
  clearInterval(tickTimerId);
  tickTimerId = setInterval(()=>{
    if (!playing) return;
    if (wallSecondsLeft > 0){
      wallSecondsLeft = Math.max(0, wallSecondsLeft - 1);
      hud.setTimer(wallSecondsLeft);
      sfx.tick();
      power.drain(0.5);

      // ส่ง snapshot ให้ mission (รวม score + combo)
      mission.tick(
        stateRef,
        { score: score.get(), combo: score.combo|0 },
        null,
        { hud, coach, lang:'TH' }
      );

      if (wallSecondsLeft === 0) endRun();
    }
  }, 1000);

  // spawn guard ครั้งแรก + ตรวจซ้ำทุก 4 วิ.
  armSpawnGuard();
  clearInterval(guardTimerId);
  guardTimerId = setInterval(armSpawnGuard, 4000);

  loop();
}

function endRun(){
  if (!playing) return;
  playing = false;

  try { cancelAnimationFrame(rafId); } catch {}
  clearInterval(tickTimerId); tickTimerId = null;
  clearInterval(guardTimerId); guardTimerId = null;
  clearTimeout(spawnGuardId); spawnGuardId = null;

  try { activeMode?.stop?.(); }   catch {}
  try { activeMode?.cleanup?.(); }catch {}
  const host = document.getElementById('spawnHost'); if (host) host.innerHTML = '';

  // สรุป mission แบบสุดท้าย (สำหรับ no_miss / avoid_junk / fever_fill)
  mission.finalize(stateRef);

  // summary
  const finalScore = score.get()|0;
  const bestCombo  = score.bestCombo|0;

  const extra = (stateRef.missions||[]).map(m=>{
    const mark = m.done && !m.fail ? '✅' : '❌';
    const icon = m.icon || '⭐';
    const text = `${mark} ${icon} ${m.label} — ${m.progress|0}/${m.need|0}`;
    return text;
  });

  try { board.submit(currentModeKey, currentDiff, finalScore, { meta:{ bestCombo } }); } catch {}

  hud.showResult({
    title: 'สรุปผล',
    desc:  `โหมด: ${shortMode(currentModeKey)} • ระดับ: ${currentDiff}`,
    stats: [`คะแนน: ${finalScore}`, `คอมโบสูงสุด: ${bestCombo}`],
    extra
  });

  // ปุ่ม Home/Retry
  hud.onHome = ()=>{
    try{
      const mb = $('#menuBar');
      if (mb){ mb.removeAttribute('data-hidden'); mb.style.display='flex'; }
      hud.hideResult?.();
      hud.resetBars?.();
      document.body.removeAttribute('data-playing');
      const host=document.getElementById('spawnHost'); if(host) host.innerHTML='';
    }catch{
      location.reload();
    }
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
  if (!playing) return;
  rafId = requestAnimationFrame(loop);

  const t = nowMs();
  let dt = (t - lastFrame) / 1000;
  if (!(dt>0) || dt>1.5) dt = 0.016;
  lastFrame = t;

  try { activeMode?.update?.(dt, BUS); } catch (e){ console.warn(e); }
}

// ---------- Public ----------
async function startGame(){
  currentModeKey = document.body.getAttribute('data-mode') || 'goodjunk';
  currentDiff    = document.body.getAttribute('data-diff') || 'Normal';
  if (!MODES[currentModeKey]){ alert('Mode not found: '+currentModeKey); return; }

  const mb = $('#menuBar'); if (mb){ mb.setAttribute('data-hidden','1'); mb.style.display='none'; }

  await preCountdown();
  beginRun({ modeKey: currentModeKey, diff: currentDiff, seconds: 45 });
}

function stopLoop(){
  try { cancelAnimationFrame(rafId); } catch {}
  clearInterval(tickTimerId); tickTimerId = null;
  clearInterval(guardTimerId); guardTimerId = null;
  clearTimeout(spawnGuardId); spawnGuardId = null;
  playing = false;
}

function shortMode(m){
  if (m==='goodjunk')  return 'Good vs Junk';
  if (m==='groups')    return '5 Groups';
  if (m==='hydration') return 'Hydration';
  if (m==='plate')     return 'Healthy Plate';
  return String(m||'');
}

// ---------- Auto-bootstrap (สำหรับ debug/ทางลัดจาก index) ----------
window.HHA = { startGame, __stopLoop: stopLoop };
console.log('[HeroHealth] main.js — Mission v4 wired + reliable timer + spawn guard');
