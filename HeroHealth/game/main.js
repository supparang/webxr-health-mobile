// === Hero Health Academy — game/main.js (FINAL: mini-quest one-at-a-time + safe re-import) ===

// ถ้ามี HHA เก่าอยู่ ให้หยุดลูปและเคลียร์ก่อน (กัน "Identifier 'loop' declared" และลูปรันซ้อน)
if (window.HHA?.__stopLoop) {
  try { window.HHA.__stopLoop(); } catch(e){}
  try { delete window.HHA; } catch(e){}
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

// ---------- Registry / helpers ----------
const MODES = { goodjunk };
const $  = (s)=>document.querySelector(s);
const sleep = (ms)=>new Promise(r=>setTimeout(r,ms));
const clamp = (n,a,b)=>Math.max(a,Math.min(b,n));
const now = ()=> (performance?.now?.() ?? Date.now());

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

// ---------- Run-state ----------
let playing=false, rafId=0, activeMode=null;
let wallSecondsLeft=45, lastWallMs=0;
let currentModeKey='goodjunk', currentDiff='Normal';
let currentQuest=null; // ภารกิจย่อยที่ active อยู่

// ---------- Mission/quest state ----------
const stateRef = { missions:[], ctx:{}, lang:'TH' };

// ---------- BUS (bridge from modes -> systems) ----------
const BUS = {
  hit(e){
    const pts = e?.points|0;
    const kind = (e?.kind==='perfect') ? 'perfect' : 'good';
    score.add(pts, { kind });
    hud.updateHUD(score.get(), score.combo|0);
    if (e?.ui) {
      hud.showFloatingText(e.ui.x, e.ui.y, `+${pts}`);
      try { FX.shatter3D(e.ui.x, e.ui.y); } catch {}
    }
    if (kind==='perfect') coach.onPerfect(); else coach.onGood();

    // missions
    mission.onEvent(kind, { count:1 }, stateRef);
    // combo สูงสุด (หาก ScoreSystem มีคอมโบ)
    if ((score.combo|0)>0) mission.onEvent('combo', { value: score.combo|0 }, stateRef);
    // golden meta
    if (e?.meta?.gold || e?.meta?.golden) mission.onEvent('golden', { count:1 }, stateRef);
  },
  miss(){
    score.add(0); coach.onMiss();
    mission.onEvent('miss', { count:1 }, stateRef);
  },
  bad(){
    score.add(0); coach.onJunk();
    // โหมด goodjunk ถือเป็นผิด (ไม่ต้องนับพิเศษ)
  },
  power(kind){
    if (kind==='shield' || kind==='gold') sfx.power();
  },
  sfx: {
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
  hud.showBig('GO!'); sfx.tick(); await sleep(450);
}

function shortMode(m){
  if(m==='goodjunk') return 'Good vs Junk';
  if(m==='groups')   return '5 Groups';
  if(m==='hydration')return 'Hydration';
  if(m==='plate')    return 'Healthy Plate';
  return String(m||'');
}

function beginRun({ modeKey, diff='Normal', seconds=45 }){
  playing = true;
  document.body.setAttribute('data-playing','1');

  // reset score & wall clock
  score.reset?.();
  wallSecondsLeft = clamp(seconds|0, 10, 300);
  lastWallMs = now();

  // HUD top
  hud.setTop({ mode: shortMode(modeKey), diff });

  // start coach + quests
  coach.onStart?.();
  Quests.beginRun?.(modeKey, diff, 'TH', wallSecondsLeft);

  // missions: เตรียมชุด 3 เควสต์ แล้ว active ทีละอัน
  const run = mission.start(modeKey, { seconds: wallSecondsLeft, count: 3, lang: 'TH' });
  mission.attachToState(run, stateRef);
  // เปิดเควสต์แรก
  currentQuest = mission.activateNext(stateRef);
  if (currentQuest) {
    hud.showMiniQuest(currentQuest.label || mission.describe(currentQuest, stateRef.lang));
  }
  hud.setQuestChips(
    (stateRef.missions||[]).map(m=>({
      key:m.key, icon:m.icon, need:m.target, progress:m.progress|0,
      remain:m.remainSec|0, done:!!m.done, fail:!!m.done && !m.success,
      label: mission.describe(m, stateRef.lang)
    }))
  );

  // start mode
  activeMode?.start?.({ difficulty: diff, fever:false });

  // start loop
  rafId = requestAnimationFrame(loop);
}

function endRun(){
  if (!playing) return;
  playing = false;
  try { cancelAnimationFrame(rafId); } catch {}

  // stop mode & clear spawns
  try{ activeMode?.stop?.(); }catch{}
  try{ activeMode?.cleanup?.(); }catch{}
  const host = document.getElementById('spawnHost'); if (host) host.innerHTML='';

  // finalize quests
  mission.stop(stateRef);
  Quests?.endRun?.({ _score: score.get?.()|0 });

  // submit board (optional)
  try {
    board.submit?.(currentModeKey, currentDiff, score.get?.()|0, { name:'Player', meta:{ comboBest: score.bestCombo|0 } });
  } catch {}

  // build mission summary lines
  const lines = [];
  if (Array.isArray(stateRef.missions)) {
    for (const m of stateRef.missions) {
      const ok = !!m.success;
      const label = mission.describe(m, stateRef.lang);
      const prog = `${m.progress|0}/${m.target|0}`;
      lines.push(`${ok?'✅':'❌'} ${label} • ${prog}`);
    }
  }

  // show result
  hud.showResult({
    title: 'Result',
    desc: `Mode: ${shortMode(currentModeKey)} • Diff: ${currentDiff}`,
    stats: [
      `Score: ${score.get?.()|0}`,
      `Best Combo: ${score.bestCombo|0}`
    ],
    extra: lines
  });

  // wire buttons
  hud.onHome  = ()=>{ location.href = location.href; };
  hud.onRetry = ()=>{ location.reload(); };
}

function onQuestTickCallback(ev){
  // ev: { success, key, index }
  if (!currentQuest) return;
  const activeKey = currentQuest.key;
  if (ev?.key !== activeKey) return;

  if (ev.success) {
    // แสดงสำเร็จ + ไปภารกิจถัดไป (ทีละอัน)
    hud.showMiniQuestComplete(mission.describe(currentQuest, stateRef.lang));
    sfx.power();
    setTimeout(()=>{
      currentQuest = mission.activateNext(stateRef);
      if (currentQuest) {
        hud.showMiniQuest(mission.describe(currentQuest, stateRef.lang));
      }
    }, 900);
  } else {
    // ล้มเหลวเมื่อหมดเวลา (no_* cases) → ไปภารกิจถัดไป
    hud.showMiniQuestComplete('❌ ' + mission.describe(currentQuest, stateRef.lang));
    setTimeout(()=>{
      currentQuest = mission.activateNext(stateRef);
      if (currentQuest) {
        hud.showMiniQuest(mission.describe(currentQuest, stateRef.lang));
      }
    }, 900);
  }
}

function loop(){
  if (!playing) return;
  rafId = requestAnimationFrame(loop);

  const t = now();
  const dtMs = t - lastWallMs;

  // 1s wall-clock
  if (dtMs >= 1000){
    const step = Math.floor(dtMs / 1000);
    wallSecondsLeft = Math.max(0, wallSecondsLeft - step);
    lastWallMs += step*1000;

    hud.setTimer(wallSecondsLeft);
    sfx.tick();

    // per-second systems
    try {
      const chips = mission.tick(stateRef, { score: score.get?.()|0 }, onQuestTickCallback, { hud, coach, lang:'TH' });
      // ให้ HUD render chips ล่าสุด (ซ้ำได้ ปลอดภัย)
      hud.setQuestChips(chips);
    } catch(e){ console.warn('[mission.tick]', e); }

    // Quests legacy (ถ้าใช้)
    try { Quests.tick?.({ score: score.get?.()|0, dt: step*1000, fever: !!score?.fever?.active }); } catch {}

    if (wallSecondsLeft <= 0) { endRun(); return; }
  }

  // Fever UI sync ถ้ามี
  try { hud.showFever(!!(score?.fever?.active)); } catch {}

  // Mode update (dt in seconds จากรอบนี้)
  try { activeMode?.update?.(dtMs/1000, BUS); } catch(e){ console.warn('[mode.update]', e); }
}

// ---------- Public API ----------
async function startGame(){
  currentModeKey = document.body.getAttribute('data-mode') || 'goodjunk';
  currentDiff    = document.body.getAttribute('data-diff') || 'Normal';
  activeMode     = MODES[currentModeKey];
  if (!activeMode){ alert('Mode not found: '+currentModeKey); return; }

  // hide menu (ถ้ายังแสดง)
  const mb = $('#menuBar'); if (mb){ mb.setAttribute('data-hidden','1'); mb.style.display='none'; }

  // countdown + begin
  await preCountdown();
  beginRun({ modeKey: currentModeKey, diff: currentDiff, seconds: 45 });
}

function stopLoop(){
  try { cancelAnimationFrame(rafId); } catch {}
  playing = false;
}

window.HHA = { startGame, __stopLoop: stopLoop };
console.log('[HeroHealth] main.js loaded (final)');
