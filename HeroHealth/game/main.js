// === Hero Health Academy — game/main.js (Production Ready) ===
'use strict';

// ---------- Import core systems ----------
import { HUD } from '../core/hud.js';
import { Coach } from '../core/coach.js';

// ---------- Global boot ----------
window.__HHA_BOOT_OK = true;
const $ = (s)=>document.querySelector(s);
let GAME = {
  mode: 'goodjunk',
  diff: 'Normal',
  duration: 60,
  running: false,
  paused: false,
  score: 0,
  combo: 0,
  fever: false,
  feverTime: 0,
  questList: [],
  api: null,
  hud: null,
  coach: null,
  timeLeft: 0,
  lastTick: 0
};

// ---------- Load mode dynamically ----------
async function loadMode(key){
  const base = new URL('.', import.meta.url);    // → /HeroHealth/game/
  const candidates = [
    new URL(`./modes/${key}.js`, base).href,    // ✅ ใช้พาธนี้ (ภายใน game/modes/)
    new URL(`../modes/${key}.js`, base).href    // สำรอง ถ้าย้ายโครงสร้าง
  ].map(u => `${u}?v=${Date.now()}`);           // กัน cache

  for (const u of candidates){
    try {
      const mod = await import(u);
      console.log('[HHA] Mode loaded:', key, '→', u);
      return mod;
    } catch(e){ console.warn('[HHA] Failed:', u, e.message); }
  }
  throw new Error(`❌ Cannot load mode "${key}"`);
}

// ---------- Initialize ----------
async function initGame(){
  GAME.hud = new HUD();
  GAME.coach = new Coach({ lang:'TH' });
  GAME.hud.setTop({ mode: GAME.mode, diff: GAME.diff });
  try {
    const mod = await loadMode(GAME.mode);
    GAME.api = mod;
  } catch(e){
    console.error(e);
    GAME.hud.toast('Failed to load mode: '+GAME.mode);
    return;
  }
  console.log('[HHA] Ready');
}

// ---------- Start ----------
async function startGame(){
  if (!GAME.api) await initGame();
  GAME.running = true;
  GAME.paused = false;
  GAME.score = 0;
  GAME.combo = 0;
  GAME.timeLeft = GAME.duration;
  GAME.hud.updateHUD(0,0);
  GAME.api.start?.({ difficulty: GAME.diff });
  countdownStart();
}

// ---------- Countdown ----------
async function countdownStart(){
  const seq = [3,2,1,'GO!'];
  for (const s of seq){
    GAME.hud.showBig(s);
    await wait(900);
  }
  GAME.coach.onStart();
  GAME.lastTick = performance.now();
  loop();
}

// ---------- Pause / Resume ----------
function togglePause(){
  if(!GAME.running) return;
  GAME.paused = !GAME.paused;
  GAME.hud.toast(GAME.paused?'Paused':'Resumed');
}
document.addEventListener('visibilitychange',()=>{ if(document.hidden) GAME.paused = true; });

// ---------- Main Loop ----------
function loop(now=performance.now()){
  if(!GAME.running) return;
  requestAnimationFrame(loop);
  if(GAME.paused) return;
  const dt = (now - GAME.lastTick)/1000;
  GAME.lastTick = now;
  GAME.timeLeft -= dt;
  GAME.hud.setTimer(GAME.timeLeft);
  if(GAME.timeLeft<=0){ endGame(); return; }

  // FEVER timer
  if(GAME.fever){
    GAME.feverTime -= dt;
    if(GAME.feverTime<=0){ setFever(false); }
  }

  // Update mode
  GAME.api.update?.(dt, BUS);
}

// ---------- Fever ----------
function setFever(on){
  GAME.fever = on;
  GAME.hud.showFever(on);
  if(on){
    GAME.feverTime = 5;
    GAME.coach.onFever();
    playFeverSound();
    document.body.style.backgroundColor = '#4b1a00';
  } else {
    document.body.style.backgroundColor = '';
  }
}

// ---------- End ----------
function endGame(){
  GAME.running = false;
  GAME.api.stop?.();
  const stars = calcStars(GAME.score);
  GAME.hud.showResult({
    title:'สรุปผลการเล่น',
    desc:`คะแนนรวม: ${GAME.score}\nCombo สูงสุด: ${GAME.combo}\nระดับ: ${GAME.diff}`,
    stats:[`⭐ ${stars} Stars`, `Score: ${GAME.score}`, `Combo: ${GAME.combo}`],
    extra:['ดีมาก! พยายามต่อไป']
  });
  GAME.coach.onEnd(GAME.score);
}

// ---------- Scoring helpers ----------
function addScore(n){ GAME.score+=n; GAME.hud.updateHUD(GAME.score,GAME.combo); }
function addCombo(){ GAME.combo++; GAME.hud.updateHUD(GAME.score,GAME.combo); }
function resetCombo(){ GAME.combo=0; GAME.hud.updateHUD(GAME.score,GAME.combo); }
function calcStars(score){
  if(score>2000) return 5;
  if(score>1500) return 4;
  if(score>1000) return 3;
  if(score>500)  return 2;
  return 1;
}

// ---------- Sound ----------
function playFeverSound(){
  const a = new Audio('../assets/sfx/fever.mp3');
  a.volume = 0.7; a.play().catch(()=>{});
}

// ---------- Utility ----------
const wait = (ms)=>new Promise(r=>setTimeout(r,ms));

// ---------- Bus for mode events ----------
const BUS = {
  hit: (ev)=>{
    addScore(ev.points||0);
    addCombo();
    GAME.hud.showFloatingText(ev.ui.x,ev.ui.y,'+'+(ev.points||0));
    if(ev.meta?.gold) setFever(true);
  },
  miss: ()=>{
    resetCombo();
    GAME.hud.toast('MISS!');
  },
  bad: ()=>{
    resetCombo();
    GAME.hud.toast('Bad!');
  },
  power: (type)=>{
    if(type==='shield') GAME.hud.toast('🛡️ Shield!');
    if(type==='gold')   GAME.hud.toast('🌟 Gold!');
  },
  sfx: {
    good: ()=>{}, perfect: ()=>{}, bad: ()=>{}
  }
};

// ---------- Global binds ----------
window.HHA = { initGame, startGame, togglePause };
window.addEventListener('keydown',e=>{
  if(e.key==='Escape') togglePause();
});
