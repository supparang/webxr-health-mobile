<!-- /webxr-health-mobile/HeroHealth/game/main.js  (LATEST) -->
<script type="module">
// ===== Hero Health Academy — game/main.js =====
// - Uses wall-clock countdown (HUD time decreases every second)
// - 3-2-1-GO prestart
// - Stops spawns cleanly on timeout
// - Imports from ./core/* and ./modes/*

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

// Modes
import * as goodjunk from './modes/goodjunk.js';

// ---------- Registry ----------
const MODES = {
  goodjunk
};

// ---------- Helpers ----------
const $  = (s)=>document.querySelector(s);
const now = ()=> (performance.now ? performance.now() : Date.now());
const sleep = (ms)=> new Promise(r=>setTimeout(r, ms));

function clamp(n,a,b){ return Math.max(a, Math.min(b,n)); }

// ---------- Singletons ----------
const engine = new Engine();
const hud    = new HUD();
const coach  = new Coach({ lang: 'TH' });
const sfx    = new SFX();
const score  = new ScoreSystem();
const power  = new PowerUpSystem();
const board  = new Leaderboard({ key:'hha_board', maxKeep:300, retentionDays:180 });
const mission= new MissionSystem();
Quests.bindToMain({ hud, coach });

power.attachToScore(score);
power.onChange((t)=>{ /* you may draw extra power timers here if needed */ });

// ---------- Run State ----------
let playing = false;
let rafId   = 0;
let activeMode = null;
let wallSecondsTotal = 45;
let wallSecondsLeft  = 45;
let lastWallMs = 0;

// ---------- BUS (bridge from modes -> main/core) ----------
const BUS = {
  // hit from mode
  hit(e){
    const pts = e?.points|0;
    const kind = (e?.kind==='perfect') ? 'perfect' : 'good';
    score.add(pts, { kind });
    hud.updateHUD(score.get(), score.combo|0);
    if (e?.ui){ hud.showFloatingText(e.ui.x, e.ui.y, `+${pts}`); }
    if (kind==='perfect') coach.onPerfect(); else coach.onGood();

    // quests/minimissions
    if (kind==='perfect') mission.onEvent('perfect', {count:1}, stateRef);
    else                   mission.onEvent('good',    {count:1}, stateRef);

    if (e?.meta?.golden)  mission.onEvent('golden', {count:1}, stateRef);
  },
  // when a visible good expired (treated as miss)
  miss(/*{source}*/){
    score.add(0); // soft reset combo
    coach.onMiss();
    mission.onEvent('miss', {count:1}, stateRef);
  },
  // clicked junk
  bad(/*{source}*/){
    score.add(0); // soft reset combo
    coach.onJunk();
  },
  power(kind){
    if (kind==='shield'){ /* shield handled inside mode goodjunk */ }
    if (kind==='gold'){ /* affects score via hit() already */ }
  },
  sfx: {
    good(){ sfx.good(); },
    bad(){ sfx.bad(); },
    perfect(){ sfx.perfect(); },
    power(){ sfx.power(); }
  }
};

// Mission/quest state shell (kept minimal)
const stateRef = { missions: [], ctx:{} };

// ---------- Game Flow ----------
async function preCountdown(){
  // 3-2-1-GO with HUD
  hud.showBig('3'); sfx.tick(); await sleep(650);
  hud.showBig('2'); sfx.tick(); await sleep(650);
  hud.showBig('1'); sfx.tick(); await sleep(650);
  hud.showBig('GO!'); sfx.tick(); await sleep(450);
}

function beginRun({ modeKey, diff='Normal', seconds=45 }){
  document.body.setAttribute('data-playing','1');
  playing = true;

  // Reset systems
  score.reset();
  wallSecondsTotal = clamp(seconds|0, 10, 300);
  wallSecondsLeft  = wallSecondsTotal;
  lastWallMs = now();

  // HUD top
  hud.setTop({ mode: shortMode(modeKey), diff });

  // Coach cue
  coach.onStart();

  // Quests (simple bind)
  Quests.beginRun(modeKey, diff, 'TH', wallSecondsTotal);

  // MissionSystem attach (optional, safe)
  const run = mission.start(modeKey, { seconds: wallSecondsTotal, count:3, lang:'TH' });
  mission.attachToState(run, stateRef);

  // Kick mode
  activeMode?.start?.({ difficulty: diff, fever: false });

  // Start loop
  loop();
}

function endRun(){
  if (!playing) return;
  playing = false;
  document.body.removeAttribute('data-playing');

  // Stop mode & clean DOM spawns
  try{ activeMode?.stop?.(); }catch{}
  try{ activeMode?.cleanup?.(); }catch{}
  const host = document.getElementById('spawnHost'); if (host) host.innerHTML='';

  // Finalize score & summary
  const finalScore = score.get();
  const comboBest  = score.bestCombo|0;
  const questSum   = Quests.endRun({ _score: finalScore });
  mission.stop(stateRef);

  board.submit(currentModeKey, currentDiff, finalScore, { name:'Player', meta:{ comboBest } });

  const stats = [
    `Score: ${finalScore}`,
    `Best Combo: ${comboBest}`,
  ];
  const extra = (questSum?.lines||[]);

  hud.showResult({
    title: 'Result',
    desc: `Mode: ${shortMode(currentModeKey)} • Diff: ${currentDiff}`,
    stats, extra
  });

  hud.onHome = ()=> { location.href = location.href; };
  hud.onRetry= ()=> { location.reload(); };
}

function loop(){
  if (!playing) return;
  rafId = requestAnimationFrame(loop);

  // --- wall-clock countdown ---
  const t = now();
  const dtMs = t - lastWallMs;
  if (dtMs >= 1000){
    const step = Math.floor(dtMs / 1000);
    wallSecondsLeft = Math.max(0, wallSecondsLeft - step);
    lastWallMs += step*1000;
    hud.setTimer(wallSecondsLeft);
    sfx.tick();

    // quests/missions 1s tick
    Quests.tick({ score: score.get(), dt: step*1000, fever: score.fever.active });
    mission.tick(stateRef, { score: score.get() }, /*cb*/null, { hud, coach, lang:'TH' });
  }

  // --- per-frame updates ---
  // score fever countdown
  score.tick((dtMs/1000));

  // if fever activated externally (not used here), HUD visual
  hud.showFever(!!score.fever.active);

  // mode internal update (seconds passed in seconds)
  try{
    activeMode?.update?.(dtMs/1000, BUS);
  }catch(e){
    console.error('[mode.update] failed', e);
  }

  // timeout
  if (wallSecondsLeft <= 0){
    cancelAnimationFrame(rafId);
    endRun();
  }
}

// ---------- Public API ----------
let currentModeKey = 'goodjunk';
let currentDiff    = 'Normal';

async function startGame(){
  // read menu selections from <body data-mode/diff>
  currentModeKey = document.body.getAttribute('data-mode') || 'goodjunk';
  currentDiff    = document.body.getAttribute('data-diff') || 'Normal';

  // mode module
  activeMode = MODES[currentModeKey];
  if (!activeMode){
    alert('Mode not found: '+currentModeKey);
    return;
  }

  // Hide menu (safety if loader didn’t already)
  const mb = $('#menuBar'); if (mb){ mb.setAttribute('data-hidden','1'); mb.style.display='none'; }

  // Precount + begin
  await preCountdown();
  beginRun({ modeKey: currentModeKey, diff: currentDiff, seconds: 45 });
}

function shortMode(m){
  if(m==='goodjunk') return 'Good vs Junk';
  if(m==='groups') return '5 Groups';
  if(m==='hydration') return 'Hydration';
  if(m==='plate') return 'Healthy Plate';
  return String(m||'');
}

// expose
window.HHA = Object.assign({}, window.HHA||{}, { startGame });

</script>
