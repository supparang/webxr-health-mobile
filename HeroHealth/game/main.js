// === Hero Health Academy — game/main.js (v2.4-compatible, timer fixed, single-active mini-quest) ===

// กันซ้อนลูป/ชื่อซ้ำตอน re-import
if (window.HHA?.__stopLoop) {
  try { window.HHA.__stopLoop(); } catch {}
  try { delete window.HHA; } catch {}
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

// ---------- Setup ----------
const MODES = { goodjunk };
const $  = (s)=>document.querySelector(s);
const sleep = (ms)=>new Promise(r=>setTimeout(r,ms));
const clamp = (n,a,b)=>Math.max(a,Math.min(b,n));
const now   = ()=> (performance?.now?.() ?? Date.now());

// singletons
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

// run state
let playing=false, rafId=0, activeMode=null;
let wallSecondsLeft=45, lastWallMs=0;
let currentModeKey='goodjunk', currentDiff='Normal';

// mission state
const stateRef = { missions:[], ctx:{}, lang:'TH', singleActive:true, activeIndex:0 };

// BUS: events from modes
const BUS = {
  hit(e){
    const pts = e?.points|0;
    const kind = (e?.kind==='perfect') ? 'perfect' : 'good';
    score.add(pts,{kind});
    hud.updateHUD(score.get(), score.combo|0);

    if (e?.ui) {
      hud.showFloatingText(e.ui.x, e.ui.y, `+${pts}`);
      try { FX.shatter3D(e.ui.x, e.ui.y); } catch {}
    }
    if (kind==='perfect') coach.onPerfect(); else coach.onGood();

    // quests/mission counters
    mission.onEvent(kind, {count:1}, stateRef);
    if ((score.combo|0)>0) mission.onEvent('combo', {value:score.combo|0}, stateRef);
    if (e?.meta?.gold || e?.meta?.golden) mission.onEvent('golden', {count:1}, stateRef);
  },
  miss(){
    score.add(0); coach.onMiss();
    mission.onEvent('miss', {count:1}, stateRef);
  },
  bad(){ score.add(0); coach.onJunk(); },
  power(){ sfx.power(); },
  sfx:{ good(){sfx.good();}, bad(){sfx.bad();}, perfect(){sfx.perfect();}, power(){sfx.power();} }
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

  // reset + wall clock
  score.reset?.();
  wallSecondsLeft = clamp(seconds|0, 10, 300);
  lastWallMs = now();
  hud.setTop({ mode: shortMode(modeKey), diff });
  hud.setTimer(wallSecondsLeft);                 // ✅ แสดงเวลาเริ่มเกมทันที

  // start guidance
  coach.onStart?.();
  Quests.beginRun?.(modeKey, diff, 'TH', wallSecondsLeft);

  // missions: สร้างชุดใหม่แบบ single-active (v2.4)
  const run = mission.start(modeKey, { seconds: wallSecondsLeft, count:3, lang:'TH', singleActive:true });
  mission.attachToState(run, stateRef);

  // แสดง mini-quest แรกทันที
  if (stateRef.missions?.length){
    const first = stateRef.missions[0];
    hud.showMiniQuest(mission.describe(first, stateRef.lang));
    hud.setQuestChips([{
      key:first.key, icon:first.icon, need:first.target,
      progress:first.progress|0, remain:first.remainSec|0,
      done:!!first.done, fail:!!first.done && !first.success,
      label: mission.describe(first, stateRef.lang)
    }]);
  } else {
    hud.setQuestChips([]);
    hud.showMiniQuest('');
  }

  // start mode & loop
  activeMode?.start?.({ difficulty: diff, fever:false });
  rafId = requestAnimationFrame(loop);
}

function endRun(){
  if (!playing) return;
  playing = false;
  try { cancelAnimationFrame(rafId); } catch {}

  try{ activeMode?.stop?.(); }catch{}
  try{ activeMode?.cleanup?.(); }catch{}
  const host = document.getElementById('spawnHost'); if (host) host.innerHTML='';

  mission.stop(stateRef);
  Quests?.endRun?.({ _score: score.get?.()|0 });

  try {
    board.submit?.(currentModeKey, currentDiff, score.get?.()|0, { name:'Player', meta:{ comboBest: score.bestCombo|0 } });
  } catch {}

  const lines = [];
  for (const m of (stateRef.missions||[])) {
    const label = mission.describe(m, stateRef.lang);
    const prog  = `${m.progress|0}/${m.target|0}`;
    lines.push(`${m.success?'✅':'❌'} ${label} • ${prog}`);
  }

  hud.showResult({
    title:'Result',
    desc:`Mode: ${shortMode(currentModeKey)} • Diff: ${currentDiff}`,
    stats:[ `Score: ${score.get?.()|0}`, `Best Combo: ${score.bestCombo|0}` ],
    extra: lines
  });
  hud.onHome  = ()=>{ location.href = location.href; };
  hud.onRetry = ()=>{ location.reload(); };
}

function loop(){
  if (!playing) return;
  rafId = requestAnimationFrame(loop);

  const t = now();
  const dtMs = t - lastWallMs;

  // นับถอยหลังแบบวินาทีผนัง
  if (dtMs >= 1000){
    const step = Math.floor(dtMs / 1000);
    wallSecondsLeft = Math.max(0, wallSecondsLeft - step);
    lastWallMs += step*1000;

    hud.setTimer(wallSecondsLeft);
    sfx.tick();

    // ให้ MissionSystem เป็นคนจัด active quest เพียงตัวเดียว
    try {
      const chips = mission.tick(stateRef, { score: score.get?.()|0 }, /*cb*/null, { hud, coach, lang:'TH' });
      if (chips && chips.length){
        hud.setQuestChips(chips);
        if (chips[0]?.label) hud.showMiniQuest(chips[0].label);
      } else {
        hud.setQuestChips([]);
        hud.showMiniQuest('');
      }
    } catch(err){ console.warn('[mission.tick]', err); }

    Quests.tick?.({ score: score.get?.()|0, dt: step*1000, fever: !!score?.fever?.active });

    if (wallSecondsLeft <= 0) { endRun(); return; }
  }

  // ซิงก์ Fever UI
  try { hud.showFever(!!(score?.fever?.active)); } catch {}

  // อัปเดตโหมด
  try { activeMode?.update?.(dtMs/1000, BUS); } catch(e){ console.warn('[mode.update]', e); }
}

// ---------- Public ----------
async function startGame(){
  currentModeKey = document.body.getAttribute('data-mode') || 'goodjunk';
  currentDiff    = document.body.getAttribute('data-diff') || 'Normal';
  activeMode     = MODES[currentModeKey];
  if (!activeMode){ alert('Mode not found: '+currentModeKey); return; }

  const mb = $('#menuBar'); if (mb){ mb.setAttribute('data-hidden','1'); mb.style.display='none'; }

  await preCountdown();
  beginRun({ modeKey: currentModeKey, diff: currentDiff, seconds: 45 });
}

function __stopLoop(){ try { cancelAnimationFrame(rafId); } catch {} playing=false; }

window.HHA = { startGame, __stopLoop };
console.log('[HeroHealth] main.js loaded (v2.4-compatible)');
