// === Hero Health Academy — game/main.js (Fixed for re-import) ===

// ถ้ามี HHA เก่าอยู่ ให้หยุดลูปและเคลียร์ก่อน
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
let wallSecondsLeft=45, lastWallMs=0;
let currentModeKey='goodjunk', currentDiff='Normal';

// ---------- Core instances ----------
const engine=new Engine();
const hud=new HUD();
const coach=new Coach({lang:'TH'});
const sfx=new SFX();
const score=new ScoreSystem();
const power=new PowerUpSystem();
const board=new Leaderboard({key:'hha_board'});
const mission=new MissionSystem();
Quests.bindToMain({hud,coach});
power.attachToScore(score);

// ---------- BUS ----------
const BUS={
  hit(e){
    const pts=e?.points|0;
    const kind=(e?.kind==='perfect')?'perfect':'good';
    score.add(pts,{kind});
    hud.updateHUD(score.get(),score.combo|0);
    if(e?.ui) hud.showFloatingText(e.ui.x,e.ui.y,`+${pts}`);
    if(kind==='perfect') coach.onPerfect(); else coach.onGood();
  },
  miss(){ score.add(0); coach.onMiss(); },
  bad(){ score.add(0); coach.onJunk(); },
  sfx:{
    good(){sfx.good();},
    bad(){sfx.bad();},
    perfect(){sfx.perfect();},
    power(){sfx.power();}
  }
};

// ---------- Flow ----------
async function preCountdown(){
  hud.showBig('3'); sfx.tick(); await sleep(650);
  hud.showBig('2'); sfx.tick(); await sleep(650);
  hud.showBig('1'); sfx.tick(); await sleep(650);
  hud.showBig('GO!'); sfx.tick(); await sleep(450);
}

function beginRun({modeKey,diff='Normal',seconds=45}){
  playing=true;
  wallSecondsLeft=clamp(seconds|0,10,300);
  lastWallMs=now();
  hud.setTop({mode:modeKey,diff});
  coach.onStart();
  activeMode?.start?.({difficulty:diff});
  loop();
}

function endRun(){
  if(!playing)return;
  playing=false;
  cancelAnimationFrame(rafId);
  try{activeMode?.stop?.();}catch{}
  try{activeMode?.cleanup?.();}catch{}
  const host=document.getElementById('spawnHost'); if(host) host.innerHTML='';
  hud.showResult({title:'Result',desc:'จบเกมแล้ว'});
}

function loop(){
  if(!playing)return;
  rafId=requestAnimationFrame(loop);
  const t=now();
  const dtMs=t-lastWallMs;
  if(dtMs>=1000){
    wallSecondsLeft=Math.max(0,wallSecondsLeft-Math.floor(dtMs/1000));
    lastWallMs+=1000;
    hud.setTimer(wallSecondsLeft);
    sfx.tick();
    if(wallSecondsLeft<=0){ endRun(); return; }
  }
  try{ activeMode?.update?.(dtMs/1000,BUS); }catch(e){console.warn(e);}
}

// ---------- Public ----------
async function startGame(){
  currentModeKey=document.body.getAttribute('data-mode')||'goodjunk';
  currentDiff=document.body.getAttribute('data-diff')||'Normal';
  activeMode=MODES[currentModeKey];
  if(!activeMode){alert('mode not found');return;}
  document.body.setAttribute('data-playing','1');
  await preCountdown();
  beginRun({modeKey:currentModeKey,diff:currentDiff,seconds:45});
}

function stopLoop(){
  try{ cancelAnimationFrame(rafId); }catch{}
  playing=false;
}

window.HHA = { startGame, __stopLoop: stopLoop };
console.log('[HeroHealth] main.js loaded fresh');
