// === Hero Health Academy — game/main.js (2025-10-29, unified latest) ===
// - Modes: goodjunk | groups | hydration | plate
// - Difficulty: Easy | Normal | Hard
// - Systems: HUD, ScoreSystem, PowerUpSystem(v3 stacks+shield), MissionSystem, Quests(10/โมด), Progress, Leaderboard, SFX, VRInput
// - Features: pause on blur, autoplay guard, result modal, daily mission ping, power HUD, quests HUD

/* ----- Imports (core) ----- */
import { HUD }            from './core/hud.js';
import { SFX, sfx }       from './core/sfx.js';
import { ScoreSystem }    from './core/score.js';
import { PowerUpSystem }  from './core/powerup.js';      // v3 (stacking + shield)
import { MissionSystem }  from './core/mission-system.js';
import { Quests }         from './core/quests.js';
import { Progress }       from './core/progression.js';
import { Leaderboard }    from './core/leaderboard.js';
import { VRInput }        from './core/vrinput.js';

/* ----- Shorthands / DOM ----- */
const $  = (s)=>document.querySelector(s);
const $$ = (s)=>[...document.querySelectorAll(s)];
const setText = (sel, txt)=>{ const el=$(sel); if(el) el.textContent = txt; };
const byAction = (el)=> el?.closest?.('[data-action]') || null;

/* ----- Globals ----- */
const App = {
  mode: (document.body.getAttribute('data-mode') || 'goodjunk'),
  diff: (document.body.getAttribute('data-diff') || 'Normal'),
  lang: (document.documentElement.getAttribute('data-hha-lang') || 'TH').toUpperCase(),
  secs: 45,

  running: false,
  timeLeft: 45,
  timers: { main: 0, sec: 0 },
  lastInteractAt: 0,

  // Systems
  hud: null,
  score: null,
  power: null,
  missionSys: null,
  leader: null,

  // State for modes (lightweight; real gameplay handled in each mode file)
  state: {
    ctx: {},         // counters for MissionSystem
    missions: [],    // mission chips (legacy/multi)
    fever01: 0
  }
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
      // simple combo feed (optional)
      App.hud.setCombo(`x${App.score.combo|0}`);
      // feed quests on hit kinds (ok/good/perfect/bad)
      if (meta?.kind){
        Quests.event('hit', {
          result: meta.kind,
          comboNow: App.score.combo|0,
          meta: { good: meta.kind==='good' || meta.kind==='perfect', golden: !!meta.golden, isTarget: !!meta.isTarget, groupId: meta.groupId }
        });
      }
    }
  });

  // Power-ups (v3: stacks + shield)
  App.power = new PowerUpSystem();
  App.power.attachToScore(App.score);
  App.power.onChange((/*timers*/) => {
    // HUD power bar: expects {x2, freeze, sweep, shield}
    const t = App.power.getCombinedTimers ? App.power.getCombinedTimers() : App.power.getTimers?.();
    App.hud.setPowerTimers(t || {});
  });

  // Missions (legacy mini-quest set API)
  App.missionSys = new MissionSystem();

  // Leaderboard
  App.leader = new Leaderboard({ key: 'hha_board_v2', maxKeep: 500, retentionDays: 365 });

  // Progression & Daily
  Progress.init();

  // Quests HUD binding
  Quests.bindToMain({ hud: App.hud });
  Quests.setLang(App.lang);

  // VR/Gaze
  VRInput.init({ sfx });
  VRInput.setAimHost($('#gameLayer'));
  VRInput.setDwellMs(900);
  VRInput.setCooldown(350);
  VRInput.setReticleStyle({ size: 30, border:'#eaf6ff', progress:'#42f9da' });

  // UI bindings
  bindMenu();
  bindResultModal();
  bindHelpModal();
  bindToggles();

  // Autoplay guard: require first user gesture to start audio safely
  document.addEventListener('pointerdown', onFirstInteract, { once:true, passive:true });
  document.addEventListener('keydown',     onFirstInteract, { once:true, passive:true });

  // Pause on blur/visibility
  window.addEventListener('blur', pauseGame, { passive:true });
  document.addEventListener('visibilitychange', ()=> document.hidden ? pauseGame() : resumeGame(), { passive:true });

  // Paint initial UI
  reflectMenu();
}

/* ========================= UI: Menu & Controls ========================= */
function bindMenu(){
  // Mode tiles
  $('#m_goodjunk')?.addEventListener('click', ()=> setMode('goodjunk','Good vs Junk'));
  $('#m_groups')  ?.addEventListener('click', ()=> setMode('groups','5 Food Groups'));
  $('#m_hydration')?.addEventListener('click',()=> setMode('hydration','Hydration'));
  $('#m_plate')   ?.addEventListener('click', ()=> setMode('plate','Healthy Plate'));

  // Difficulty chips
  $('#d_easy')  ?.addEventListener('click', ()=> setDiff('Easy'));
  $('#d_normal')?.addEventListener('click', ()=> setDiff('Normal'));
  $('#d_hard')  ?.addEventListener('click', ()=> setDiff('Hard'));

  // Lang toggle
  $('#langToggle')?.addEventListener('click', ()=>{
    App.lang = (App.lang==='TH') ? 'EN' : 'TH';
    setText('#langToggle', App.lang);
    Quests.setLang(App.lang);
  });

  // Start
  $('#btn_start')?.addEventListener('click', startGame);
}

function reflectMenu(){
  // active tile
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

function setMode(m, label){
  App.mode = m;
  reflectMenu();
}
function setDiff(d){
  App.diff = d;
  App.secs = (d==='Easy') ? 50 : (d==='Hard' ? 40 : 45);
  reflectMenu();
}
function tileName(m){
  return (m==='goodjunk') ? 'Good vs Junk'
       : (m==='groups') ? '5 Food Groups'
       : (m==='hydration') ? 'Hydration'
       : (m==='plate') ? 'Healthy Plate'
       : m;
}

function bindToggles(){
  // sound toggle
  $('#soundToggle')?.addEventListener('click', ()=>{
    const on = !sfx.isEnabled();
    sfx.setEnabled(on);
    setText('#soundToggle', on ? '🔊' : '🔇');
  });
  // gfx toggle (placeholder flag in body)
  $('#gfxToggle')?.addEventListener('click', ()=>{
    const v = document.body.getAttribute('data-gfx')==='1' ? '0' : '1';
    document.body.setAttribute('data-gfx', v);
  });
}

/* ========================= Help & Result ========================= */
function bindHelpModal(){
  $('#btn_ok')?.addEventListener('click', ()=> hideModal('#help'));
  // open via data-modal-open="#help" (VRInput long-press supported)
  $$('.chip[data-modal-open], [data-modal-open]').forEach(el=>{
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
      if (act==='replay'){ startGame(); }
      else { goHome(); }
    });
  });
}
function showModal(sel){ const el = document.querySelector(sel); if (el){ el.style.display='flex'; } }
function hideModal(sel){ const el = document.querySelector(sel); if (el){ el.style.display='none'; } }
function goHome(){
  // show menu, hide game-only HUD bits
  $('#menuBar')?.scrollIntoView({ behavior:'smooth', block:'start' });
}

/* ========================= Run Loop ========================= */
function startGame(){
  if (App.running) endGame(true);
  // Reset UI & state
  $('#result')?.style && ( $('#result').style.display = 'none' );
  App.hud.dispose(); // clears coach/toast timeouts safely
  App.hud.setScore(0);
  App.hud.setTime(App.secs);
  App.hud.toast(App.lang==='TH' ? 'เริ่มเกม!' : 'Let’s go!', 900);

  App.score.reset();
  App.power.dispose(); // clear timers & boost
  App.state = { ctx:{}, missions:[], fever01:0 };

  // Daily/Progress begin
  Progress.beginRun(App.mode, App.diff, App.lang);

  // Quests (3 random)
  Quests.beginRun(App.mode, App.diff, App.lang, App.secs);

  // Legacy MissionSystem (3 chips attach)
  const run = App.missionSys.start(App.mode, { difficulty:App.diff, lang:App.lang, seconds:App.secs, count:3 });
  App.missionSys.attachToState(run, App.state);

  // Timer
  App.timeLeft = App.secs|0;
  clearInterval(App.timers.sec);
  App.timers.sec = setInterval(onTick1s, 1000);

  App.running = true;
  // hide menu? (design keeps menu visible; gameplay spawns in #gameLayer anyway)

  // Optional: minor opening power gift for Easy
  if (App.diff==='Easy') App.power.apply('shield', 5);
}

function onTick1s(){
  if (!App.running) return;
  App.timeLeft = Math.max(0, (App.timeLeft|0)-1);
  App.hud.setTime(App.timeLeft);

  // FEVER decay placeholder (0..1 UI progress)
  App.state.fever01 = Math.max(0, App.state.fever01 - 0.06);
  App.hud.setFeverProgress(App.state.fever01);

  // Feed MissionSystem tick (eval + HUD chips)
  App.missionSys.tick(App.state, { score: App.score.get() }, (ev)=>{
    // on mission done/fail
    if (ev?.success){ Progress.addMissionDone(App.mode); App.hud.toast('✓ Quest!', 900); }
  }, { hud: App.hud, coach: { 
        onQuestDone(){ App.hud.say(App.lang==='TH'?'สำเร็จภารกิจ!':'Quest complete!', 900); },
        onQuestFail(){ App.hud.say(App.lang==='TH'?'พลาดภารกิจ':'Quest failed', 900); },
        onQuestProgress(txt,prog,need){ App.hud.say(`${txt} (${prog}/${need})`, 700); }
      }, lang: App.lang });

  // Quests tick (score context)
  Quests.tick({ score: App.score.get() });

  if (App.timeLeft <= 0) endGame(false);
}

function endGame(isAbort=false){
  if (!App.running) return;
  App.running = false;
  clearInterval(App.timers.sec);

  // Finalize quests & summary
  const scoreNow = App.score.get();
  const { stars, grade } = App.score.getGrade();
  const quests = Quests.endRun({ score: scoreNow });

  // Progression / XP
  Progress.endRun({ score: scoreNow, bestCombo: App.score.bestCombo|0, timePlayed: (App.secs|0), acc: 0 });

  // Leaderboard submit
  App.leader.submit(App.mode, App.diff, scoreNow, { name: undefined, meta:{ stars, grade } });

  // Show result
  setText('#finalScore', `${scoreNow}  ★${stars}  [${grade}]`);
  showModal('#result');

  // Tiny toast for daily
  const d = Progress.getDaily?.();
  if (d?.missions?.length){
    App.hud.toast(App.lang==='TH' ? 'อัปเดตภารกิจรายวันแล้ว' : 'Daily missions updated', 1100);
  }

  // Clean power state
  App.power.dispose();
}

/* ========================= Gameplay Hooks (examples) =========================
   Call these from each mode’s game logic when events occur.
   Here we expose minimal helpers so current DOM-spawn modes can call them.
============================================================================= */
window.HHA = {
  hitGood(meta={}){ App.score.addKind('good', meta); Quests.event('hit', { result:'good', comboNow:App.score.combo|0, meta }); App.missionSys.onEvent('good',{count:1},App.state); },
  hitPerfect(meta={}){ 
    App.score.addKind('perfect', meta); 
    App.state.fever01 = Math.min(1, App.state.fever01 + 0.1);
    Quests.event('hit', { result:'perfect', comboNow:App.score.combo|0, meta:{...meta, golden:!!meta.golden} });
    App.missionSys.onEvent('good',{count:1},App.state);
  },
  hitBad(meta={}){ 
    // shield absorbs first bad
    if (App.power.consumeShield?.()) {
      App.hud.toast(App.lang==='TH'?'🛡 กันความเสียหาย':'🛡 Shielded', 900);
    } else {
      App.score.addKind('bad', meta); 
      App.hud.flashDanger();
      App.missionSys.onEvent('miss',{count:1},App.state);
    }
  },
  targetHit(meta={}){ // groups/plate correct target
    App.score.addKind('good', { ...meta, isTarget:true });
    App.missionSys.onEvent('target_hit',{count:1},App.state);
    Quests.event('hit', { result:'good', comboNow:App.score.combo|0, meta:{...meta, isTarget:true} });
  },
  wrongGroup(){ App.missionSys.onEvent('wrong_group',{count:1},App.state); },
  feverStart(){ Quests.event('fever',{kind:'start'}); },
  feverEnd(){ Quests.event('fever',{kind:'end'}); },
  platePerfect(){ App.missionSys.onEvent('plate_perfect',{count:1},App.state); },
  plateOver(){ App.missionSys.onEvent('over_quota',{count:1},App.state); },
  hydrationTick(zone){ App.missionSys.onEvent('hydration_zone',{z:String(zone||'')},App.state); Quests.event('hydro_tick',{zone:String(zone||'')}); },
  hydrationCross(from,to){ Quests.event('hydro_cross',{from:String(from||''), to:String(to||'')}); },
  hydrationTreatHighSweet(){ Quests.event('hydro_click',{zoneBefore:'HIGH', kind:'sweet'}); },
  groupFull(){ Quests.event('group_full'); },
  targetCycle(){ Quests.event('target_cleared'); },

  // Power pickups
  power(type){ 
    if (type==='x2' || type==='freeze' || type==='sweep' || type==='magnet' || type==='boost' || type==='shield'){
      App.power.apply(type);
      sfx.power();
      App.hud.toast(App.lang==='TH' ? `พลัง ${type}` : `Power ${type}`, 850);
    }
  }
};

/* ========================= Autoplay guard ========================= */
function onFirstInteract(){
  try {
    const bgm = $('#bgm-main');
    if (bgm && !bgm.src) {
      // (optional) set a BGM url here if available
      // bgm.src = 'assets/audio/bgm_main.mp3';
    }
    sfx.unlock?.();
  } catch {}
}

/* ========================= Pause / Resume ========================= */
function pauseGame(){
  if (!App.running) return;
  VRInput.pause?.();
  // stop second tick
  clearInterval(App.timers.sec);
  App.hud.say(App.lang==='TH'?'พักเกมชั่วคราว':'Paused', 900);
}
function resumeGame(){
  if (!App.running) return;
  if (!document.hidden){
    VRInput.resume?.();
    clearInterval(App.timers.sec);
    App.timers.sec = setInterval(onTick1s, 1000);
    App.hud.say(App.lang==='TH'?'ต่อกันเลย!':'Resumed', 800);
  }
}

/* ========================= Public debug (optional) ========================= */
try { window.__HHA_APP__ = App; } catch {}
