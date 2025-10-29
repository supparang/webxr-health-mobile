// === Hero Health Academy — game/main.js (2025-10-30) ===
// Unified loop: HUD, Score, PowerUp, MissionSystem, Quests, Leaderboard, VRInput

/* ----- Imports (core) ----- */
import { HUD }            from './core/hud.js';
import { SFX, sfx }       from './core/sfx.js';
import { ScoreSystem }    from './core/score.js';
import { PowerUpSystem }  from './core/powerup.js';
import { MissionSystem }  from './core/mission-system.js';
import { Quests }         from './core/quests.js';
import { Progress }       from './core/progression.js';
import { Leaderboard }    from './core/leaderboard.js';
import { VRInput }        from './core/vrinput.js';

/* ----- Mode adapters (DOM-spawn) ----- */
import * as goodjunk   from './modes/goodjunk.js';
import * as groups     from './modes/groups.js';
import * as hydration  from './modes/hydration.js';
import * as plate      from './modes/plate.js';

/* ----- Shorthands / DOM ----- */
const $  = (s)=>document.querySelector(s);
const $$ = (s)=>[...document.querySelectorAll(s)];
const setText = (sel, txt)=>{ const el=$(sel); if(el) el.textContent = txt; };

/* ----- Globals ----- */
const App = {
  mode: (document.body.getAttribute('data-mode') || 'goodjunk'),
  diff: (document.body.getAttribute('data-diff') || 'Normal'),
  lang: (document.documentElement.getAttribute('data-hha-lang') || 'TH').toUpperCase(),
  secs: 45,

  running: false,
  timeLeft: 45,
  timers: { sec: 0, raf: 0 },

  // Systems
  hud: null,
  score: null,
  power: null,
  missionSys: null,
  leader: null,

  engine: { score:null, sfx, fx:{ popText(txt,{x,y,ms=720}){ popText(txt,x,y,ms); } } },
  modeCtrl: null,
};

/* ========================= Boot ========================= */
boot();

function boot(){
  // HUD
  App.hud = new HUD();

  // Score
  App.score = new ScoreSystem();
  App.score.setHandlers({
    change: (val,{delta,meta})=>{
      App.hud.setScore(val|0);
      // combo feed (ถ้ามี element คอมโบ จะผูกใน hud)
      // feed quests: good/perfect/bad
      if (meta?.kind){
        Quests.event('hit', {
          result: meta.kind,
          comboNow: App.score.combo|0,
          meta: { good: meta.kind==='good' || meta.kind==='perfect', golden: !!meta.golden, isTarget: !!meta.isTarget, groupId: meta.groupId }
        });
      }
    }
  });

  // Power-ups
  App.power = new PowerUpSystem();
  App.power.attachToScore(App.score);
  App.power.onChange(() => {
    const t = App.power.getCombinedTimers ? App.power.getCombinedTimers() : App.power.getTimers?.();
    App.hud.setPowerTimers(t || {});
  });

  // Missions
  App.missionSys = new MissionSystem();

  // Leaderboard
  App.leader = new Leaderboard({ key: 'hha_board_v2', maxKeep: 500, retentionDays: 365 });

  // Progress & Quests HUD binding
  Progress.init();
  Quests.bindToMain({ hud: App.hud });
  Quests.setLang(App.lang);

  // VR/Gaze
  VRInput.init({ sfx });
  VRInput.setAimHost($('#gameLayer'));
  VRInput.setDwellMs(900);

  // Export engine refs for modes
  App.engine.score = App.score;

  // UI bindings
  bindMenu();
  bindResultModal();
  bindHelpModal();
  bindToggles();

  // Pause on blur/visibility
  window.addEventListener('blur', pauseGame, { passive:true });
  document.addEventListener('visibilitychange', ()=> document.hidden ? pauseGame() : resumeGame(), { passive:true });

  reflectMenu();

  // expose for quick debug
  try { window.__HHA_APP__ = App; } catch{}
}

/* ========================= UI: Menu & Controls ========================= */
function bindMenu(){
  $('#m_goodjunk')  ?.addEventListener('click', ()=> setMode('goodjunk'));
  $('#m_groups')    ?.addEventListener('click', ()=> setMode('groups'));
  $('#m_hydration') ?.addEventListener('click', ()=> setMode('hydration'));
  $('#m_plate')     ?.addEventListener('click', ()=> setMode('plate'));

  $('#d_easy')  ?.addEventListener('click', ()=> setDiff('Easy'));
  $('#d_normal')?.addEventListener('click', ()=> setDiff('Normal'));
  $('#d_hard')  ?.addEventListener('click', ()=> setDiff('Hard'));

  $('#langToggle')?.addEventListener('click', ()=>{
    App.lang = (App.lang==='TH') ? 'EN' : 'TH';
    setText('#langToggle', App.lang);
    Quests.setLang(App.lang);
  });

  $('#btn_start')?.addEventListener('click', startGame, { capture:true });
}
function reflectMenu(){
  // tiles
  $$('.tile').forEach(t=> t.classList.remove('active'));
  $('#m_'+App.mode)?.classList.add('active');
  setText('#modeName', tileName(App.mode));
  // diff
  $$('#d_easy,#d_normal,#d_hard').forEach(c=> c.classList.remove('active'));
  if (App.diff==='Easy')   $('#d_easy')?.classList.add('active');
  if (App.diff==='Normal') $('#d_normal')?.classList.add('active');
  if (App.diff==='Hard')   $('#d_hard')?.classList.add('active');
  setText('#difficulty', App.diff);
}
function setMode(m){ App.mode=m; reflectMenu(); }
function setDiff(d){ App.diff=d; App.secs = (d==='Easy')?50:(d==='Hard'?40:45); reflectMenu(); }
function tileName(m){
  return (m==='goodjunk') ? 'Good vs Junk'
       : (m==='groups') ? '5 Food Groups'
       : (m==='hydration') ? 'Hydration'
       : (m==='plate') ? 'Healthy Plate' : m;
}

function bindToggles(){
  $('#soundToggle')?.addEventListener('click', ()=>{
    const on = !sfx.isEnabled?.();
    sfx.setEnabled?.(on);
    setText('#soundToggle', on ? '🔊' : '🔇');
  });
  $('#gfxToggle')?.addEventListener('click', ()=>{
    const v = document.body.getAttribute('data-gfx')==='1' ? '0' : '1';
    document.body.setAttribute('data-gfx', v);
  });
}

/* ========================= Help & Result ========================= */
function bindHelpModal(){
  $('#btn_ok')?.addEventListener('click', ()=> hideModal('#help'));
  document.querySelectorAll('[data-modal-open]').forEach(el=>{
    el.addEventListener('click', ()=>{
      const sel = el.getAttribute('data-modal-open');
      if (sel) showModal(sel);
    });
  });
}
function bindResultModal(){
  document.querySelectorAll('#result [data-result]').forEach(btn=>{
    btn.addEventListener('click', (e)=>{
      const act = e.currentTarget.getAttribute('data-result');
      hideModal('#result');
      if (act==='replay'){ startGame(); } else { goHome(); }
    });
  });
}
function showModal(sel){ const el=document.querySelector(sel); if(el) el.style.display='flex'; }
function hideModal(sel){ const el=document.querySelector(sel); if(el) el.style.display='none'; }
function goHome(){ $('#menuBar')?.scrollIntoView({ behavior:'smooth', block:'start' }); }

/* ========================= Run Loop ========================= */
function startGame(){
  if (App.running) endGame(true);

  // Reset UI/state
  $('#result')?.style && ( $('#result').style.display = 'none' );
  App.hud.dispose();
  App.hud.setScore(0);
  App.hud.setTime(App.secs);
  App.hud.toast(App.lang==='TH' ? 'เริ่มเกม!' : 'Let’s go!', 900);

  // Reset systems
  App.score.reset();
  App.power.dispose?.();
  Progress.beginRun(App.mode, App.diff, App.lang);

  // Quests (3 random)
  Quests.beginRun(App.mode, App.diff, App.lang, App.secs);

  // MissionSystem legacy (optional usage by modes)
  const run = App.missionSys.start(App.mode, { difficulty:App.diff, lang:App.lang, seconds:App.secs, count:3 });
  App.missionSys.attachToState(run, {});

  // Mode controller
  App.modeCtrl?.cleanup?.();
  App.modeCtrl = createMode(App.mode);
  App.modeCtrl?.start?.();

  // Tick
  App.timeLeft = App.secs|0;
  clearInterval(App.timers.sec);
  App.timers.sec = setInterval(onTick1s, 1000);

  App.running = true;
  loopRAF(); // lightweight per-frame update for spawners
}

function onTick1s(){
  if (!App.running) return;
  App.timeLeft = Math.max(0, (App.timeLeft|0)-1);
  App.hud.setTime(App.timeLeft);

  // Quests tick (reach_score + timeout)
  Quests.tick({ score: App.score.get() });

  if (App.timeLeft <= 0) endGame(false);
}

function loopRAF(){
  cancelAnimationFrame(App.timers.raf);
  const step = (t)=>{
    if (!App.running) return;
    // Update current mode dom-spawn
    App.modeCtrl?.update?.(0.016, {
      hit:(ev)=> handleHit(ev),
      miss:(ev)=> handleMiss(ev)
    });
    App.timers.raf = requestAnimationFrame(step);
  };
  App.timers.raf = requestAnimationFrame(step);
}

function endGame(isAbort=false){
  if (!App.running) return;
  App.running = false;
  clearInterval(App.timers.sec);
  cancelAnimationFrame(App.timers.raf);

  // finalize mode
  App.modeCtrl?.stop?.();

  // Summary
  const scoreNow = App.score.get();
  const { stars, grade } = App.score.getGrade?.() || { stars:0, grade:'-' };
  const quests = Quests.endRun({ score: scoreNow });

  // Progression
  Progress.endRun({ score: scoreNow, bestCombo: App.score.bestCombo|0, timePlayed: (App.secs|0), acc: 0 });

  // Leaderboard
  App.leader.submit(App.mode, App.diff, scoreNow, { name: ($('#playerName')?.value||'').trim()||undefined, meta:{ stars, grade } });

  // Result UI
  setText('#resultText', (App.lang==='TH'
    ? `คะแนน: ${scoreNow}  ★${stars}  [${grade}]`
    : `Score: ${scoreNow}  ★${stars}  [${grade}]`));
  showModal('#result');
}

/* ========================= Mode glue ========================= */
function createMode(key){
  const ctx = { engine:App.engine, hud:App.hud, coach:{ onStart(){ App.hud.say(App.lang==='TH'?'เริ่ม!':'Start!', 700); }, onGood(){}, onBad(){} } };
  if (key==='goodjunk')  return (goodjunk.create?.(ctx)   || fallbackMode());
  if (key==='groups')    return (groups.create?.(ctx)     || fallbackMode());
  if (key==='hydration') return (hydration.create?.(ctx)  || fallbackMode());
  if (key==='plate')     return (plate.create?.(ctx)      || fallbackMode());
  return fallbackMode();
}
function fallbackMode(){
  let running=false;
  return {
    start(){ running=true; },
    stop(){ running=false; },
    update(){ /* no-op */ },
    cleanup(){ running=false; }
  };
}

/* ========================= Gameplay event sinks ========================= */
function handleHit({ kind='good', points=10, ui={}, meta={} }={}){
  if (kind==='perfect'){ App.score.addKind?.('perfect', meta); }
  else if (kind==='good'){ App.score.addKind?.('good', meta); }
  else { App.score.addKind?.('ok', meta); }

  if (ui && ui.x){ popText(`+${points}${kind==='perfect'?' ✨':''}`, ui.x, ui.y, 720); }
  Quests.event('hit', { result:kind, comboNow:App.score.combo|0, meta });
}
function handleMiss({ meta={} }={}){
  // shield?
  if (App.power.consumeShield?.()){
    App.hud.toast(App.lang==='TH'?'🛡 กันความเสียหาย':'🛡 Shielded', 900);
  }else{
    App.score.addKind?.('bad', meta);
    App.hud.flashDanger();
    Quests.event('hit', { result:'bad', comboNow:App.score.combo|0, meta });
  }
}

/* ========================= Utilities ========================= */
function popText(text, x, y, ms=700){
  const el = document.createElement('div');
  el.style.cssText = `position:fixed;left:${x}px;top:${y}px;transform:translate(-50%,-50%);
    font:900 16px ui-rounded;color:#eaf6ff;text-shadow:0 2px 8px #000;
    background:#102038d0;border:1px solid #1a2c47;padding:4px 8px;border-radius:999px;pointer-events:none;z-index:120`;
  el.textContent = text;
  document.body.appendChild(el);
  const t0 = performance.now();
  const tick = ()=>{
    const dt = performance.now()-t0; const p=Math.min(1, dt/ms);
    el.style.opacity = String(1-p);
    el.style.top = `${y-24*p}px`;
    if (p<1) requestAnimationFrame(tick); else el.remove();
  };
  requestAnimationFrame(tick);
}
