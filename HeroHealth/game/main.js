// ===== Hero Health Academy — game/main.js (LATEST, pure ESM) =====

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

const MODES = { goodjunk };

const $ = (s)=>document.querySelector(s);
const now = ()=> (performance.now ? performance.now() : Date.now());
const sleep = (ms)=> new Promise(r=>setTimeout(r, ms));
const clamp = (n,a,b)=> Math.max(a, Math.min(b,n));

// ---------- Singletons ----------
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

// ---------- Run State ----------
let playing = false;
let rafId   = 0;
let activeMode = null;
let wallSecondsTotal = 45;
let wallSecondsLeft  = 45;
let lastWallMs = 0;

let currentModeKey = 'goodjunk';
let currentDiff    = 'Normal';

// ---------- BUS (mode -> main) ----------
const stateRef = { missions: [], ctx:{} };
const BUS = {
  hit(e){
    const pts  = e?.points|0;
    const kind = (e?.kind==='perfect') ? 'perfect' : 'good';
    score.add(pts, { kind });
    hud.updateHUD(score.get(), score.combo|0);
    if (e?.ui){ hud.showFloatingText(e.ui.x, e.ui.y, `+${pts}`); }
    if (kind==='perfect') coach.onPerfect(); else coach.onGood();
    if (kind==='perfect') mission.onEvent('perfect', {count:1}, stateRef);
    else                   mission.onEvent('good',    {count:1}, stateRef);
    if (e?.meta?.golden)  mission.onEvent('golden',  {count:1}, stateRef);
  },
  miss(){
    score.add(0);
    coach.onMiss();
    mission.onEvent('miss', {count:1}, stateRef);
  },
  bad(){
    score.add(0);
    coach.onJunk();
  },
  power(kind){ /* shield/gold already handled in mode or hit() */ },
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
  document.body.setAttribute('data-playing','1');
  playing = true;

  score.reset();
  wallSecondsTotal = clamp(seconds|0, 10, 300);
  wallSecondsLeft  = wallSecondsTotal;
  lastWallMs = now();

  hud.setTop({ mode: shortMode(modeKey), diff });
  coach.onStart();

  Quests.beginRun(modeKey, diff, 'TH', wallSecondsTotal);
  const run = mission.start(modeKey, { seconds: wallSecondsTotal, count:3, lang:'TH' });
  mission.attachToState(run, stateRef);

  activeMode?.start?.({ difficulty: diff, fever: false });
  loop();
}

function endRun(){
  if (!playing) return;
  playing = false;
  document.body.removeAttribute('data-playing');

  try{ activeMode?.stop?.(); }catch{}
  try{ activeMode?.cleanup?.(); }catch{}

  const host = document.getElementById('spawnHost'); if (host) host.innerHTML='';

  const finalScore = score.get();
  const comboBest  = score.bestCombo|0;
  const questSum   = Quests.endRun({ _score: finalScore });
  mission.stop(stateRef);

  board.submit(currentModeKey, currentDiff, finalScore, { name:'Player', meta:{ comboBest } });

  hud.showResult({
    title: 'Result',
    desc: `Mode: ${shortMode(currentModeKey)} • Diff: ${currentDiff}`,
    stats: [`Score: ${finalScore}`, `Best Combo: ${comboBest}`],
    extra: questSum?.lines || []
  });

  hud.onHome = ()=> { location.href = location.href; };
  hud.onRetry= ()=> { location.reload(); };
}

function loop(){
  if (!playing) return;
  rafId = requestAnimationFrame(loop);

  const t    = now();
  const dtMs = t - lastWallMs;

  if (dtMs >= 1000){
    const step = Math.floor(dtMs/1000);
    wallSecondsLeft = Math.max(0, wallSecondsLeft - step);
    lastWallMs += step*1000;

    hud.setTimer(wallSecondsLeft);
    sfx.tick();

    Quests.tick({ score: score.get(), dt: step*1000, fever: score.fever.active });
    mission.tick(stateRef, { score: score.get() }, null, { hud, coach, lang:'TH' });
  }

  score.tick(dtMs/1000);
  hud.showFever(!!score.fever.active);

  try{ activeMode?.update?.(dtMs/1000, BUS); }catch(e){ console.error('[mode.update]', e); }

  if (wallSecondsLeft <= 0){
    cancelAnimationFrame(rafId);
    endRun();
  }
}

// ---------- Public API ----------
async function startGame(){
  currentModeKey = document.body.getAttribute('data-mode') || 'goodjunk';
  currentDiff    = document.body.getAttribute('data-diff') || 'Normal';

  activeMode = MODES[currentModeKey];
  if (!activeMode){ alert('Mode not found: '+currentModeKey); return; }

  const mb = $('#menuBar'); if (mb){ mb.setAttribute('data-hidden','1'); mb.style.display='none'; }

  await preCountdown();
  beginRun({ modeKey: currentModeKey, diff: currentDiff, seconds: 45 });
}

window.HHA = Object.assign({}, window.HHA||{}, { startGame });
