// === Hero Health Academy — game/main.js (2025-10-29, unified latest) ===
// Modes: goodjunk | groups | hydration | plate  (DOM-spawn)
// Systems: HUD, ScoreSystem, PowerUpSystem, MissionSystem, Quests, Progress, Leaderboard, SFX, VRInput
// Fixes: start delay after layout, RAF loop, spawnHost absolute, result modal, pause/blur

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

/* ----- Shorthands / DOM ----- */
const $  = (s)=>document.querySelector(s);
const $$ = (s)=>[...document.querySelectorAll(s)];
const setText = (sel, txt)=>{ const el=$(sel); if(el) el.textContent = txt; };

/* ----- Lazy loaders for modes ----- */
const MODE_LOADERS = {
  goodjunk:  ()=>import('./modes/goodjunk.js'),
  groups:    ()=>import('./modes/groups.js'),
  hydration: ()=>import('./modes/hydration.js'),
  plate:     ()=>import('./modes/plate.js'),
};

/* ----- Globals ----- */
const App = {
  mode: (document.body.getAttribute('data-mode') || 'goodjunk'),
  diff: (document.body.getAttribute('data-diff') || 'Normal'),
  lang: (document.documentElement.getAttribute('data-hha-lang') || 'TH').toUpperCase(),
  secs: 45,

  running: false,
  timeLeft: 45,
  timers: { sec: 0 },
  rafId: 0,
  lastTs: 0,

  // Systems
  hud: null,
  score: null,
  power: null,
  missionSys: null,
  leader: null,

  // Mode instance
  modeInst: null,

  // State for missions/fever (lightweight)
  state: { ctx:{}, missions:[], fever01:0 }
};

/* ========================= Boot ========================= */
boot();

function boot(){
  // HUD
  App.hud = new HUD();

  // Score
  App.score = new ScoreSystem();
  App.score.setHandlers({
    change: (val,{meta})=>{
      App.hud.setScore(val|0);
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

  // Power-ups
  App.power = new PowerUpSystem();
  App.power.attachToScore(App.score);
  App.power.onChange(()=>{
    const t = App.power.getCombinedTimers ? App.power.getCombinedTimers() : App.power.getTimers?.();
    App.hud.setPowerTimers(t || {});
  });

  // Missions
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

  // UI bindings
  bindMenu();
  bindResultModal();
  bindHelpModal();
  bindToggles();

  // Autoplay guard
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
  $('#m_goodjunk') ?.addEventListener('click', ()=> setMode('goodjunk'));
  $('#m_groups')   ?.addEventListener('click', ()=> setMode('groups'));
  $('#m_hydration')?.addEventListener('click', ()=> setMode('hydration'));
  $('#m_plate')    ?.addEventListener('click', ()=> setMode('plate'));

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
  $$('.tile').forEach(t=> t.classList.remove('active'));
  $('#m_'+App.mode)?.classList.add('active');
  setText('#modeName', tileName(App.mode));

  $$('#d_easy,#d_normal,#d_hard').forEach(c=> c.classList.remove('active'));
  if (App.diff==='Easy')   $('#d_easy')?.classList.add('active');
  if (App.diff==='Normal') $('#d_normal')?.classList.add('active');
  if (App.diff==='Hard')   $('#d_hard')?.classList.add('active');
  setText('#difficulty', App.diff);
}

function setMode(m){
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
  $('#soundToggle')?.addEventListener('click', ()=>{
    const on = !sfx.isEnabled();
    sfx.setEnabled(on);
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
      if (act==='replay'){ startGame(); }
    });
  });
  $('#btn_open_board')?.addEventListener('click', ()=>{
    hideModal('#result'); showModal('#boardModal');
  });
}
function showModal(sel){ const el = document.querySelector(sel); if (el){ el.style.display='flex'; } }
function hideModal(sel){ const el = document.querySelector(sel); if (el){ el.style.display='none'; } }

/* ========================= Run Loop ========================= */
async function startGame(){
  try{
    // guard
    if (App.running) endGame(true);

    // UI reset
    $('#result') && ( $('#result').style.display = 'none' );
    App.hud.dispose();
    App.hud.setScore(0);
    App.hud.setTime(App.secs);
    App.hud.toast(App.lang==='TH' ? 'เริ่มเกม!' : 'Let’s go!', 900);

    // core resets
    App.score.reset();
    App.power.dispose();
    App.state = { ctx:{}, missions:[], fever01:0 };

    // expose diff/time to modes (DOM factory)
    window.__HHA_DIFF = App.diff;
    window.__HHA_TIME = App.secs;

    // progression & quests
    Progress.beginRun(App.mode, App.diff, App.lang);
    Quests.beginRun(App.mode, App.diff, App.lang, App.secs);

    // legacy MissionSystem chips (optional)
    const run = App.missionSys.start(App.mode, { difficulty:App.diff, lang:App.lang, seconds:App.secs, count:3 });
    App.missionSys.attachToState(run, App.state);

    // load & create current mode
    const mod = await (MODE_LOADERS[App.mode]?.() || MODE_LOADERS.goodjunk());
    App.modeInst?.stop?.();
    App.modeInst = mod.create?.({
      engine: { score: App.score, sfx, fx: App.hud },
      hud: App.hud,
      coach: {
        onStart(){ App.hud.say(App.lang==='TH'?'เริ่ม!':'Start!', 700); },
        onGood(){ /* optional cue */ },
        onBad(){  App.hud.flashDanger(); }
      }
    }) || null;
    App.modeInst?.start?.();

    // timer
    App.timeLeft = App.secs|0;
    clearInterval(App.timers.sec);
    App.timers.sec = setInterval(onTick1s, 1000);

    // RAF with 1-frame layout delay
    cancelAnimationFrame(App.rafId);
    App.lastTs = 0;

    const Bus = {
      hit:(e={})=>{
        const kind = e.kind || 'good';
        App.score.addKind(kind, { ...(e.meta||{}), kind });
        App.missionSys.onEvent('good',{count:1},App.state);
      },
      miss:(e={})=>{
        App.score.addKind('bad', { ...(e.meta||{}), kind:'bad' });
        App.missionSys.onEvent('miss',{count:1},App.state);
      }
    };

    const step = (ts)=>{
      if (!App.lastTs) App.lastTs = ts;
      const dt = Math.min(0.06, (ts - App.lastTs) / 1000);
      App.lastTs = ts;

      App.modeInst?.update?.(dt, Bus);
      App.rafId = requestAnimationFrame(step);
    };
    requestAnimationFrame(()=>{ App.running = true; App.rafId = requestAnimationFrame(step); });

    // Easy gift
    if (App.diff==='Easy') App.power.apply('shield', 5);

  }catch(err){
    console.warn('[main] start error', err);
    try{ window.HHA_BOOT?.reportError?.(err); }catch{}
  }
}

function onTick1s(){
  if (!App.running) return;
  App.timeLeft = Math.max(0, (App.timeLeft|0)-1);
  App.hud.setTime(App.timeLeft);

  // FEVER UI (dummy)
  App.state.fever01 = Math.max(0, App.state.fever01 - 0.06);
  App.hud.setFeverProgress(App.state.fever01);

  // MissionSystem tick + coach hooks
  App.missionSys.tick(App.state, { score: App.score.get() }, (ev)=>{
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

function endGame(){
  if (!App.running) return;
  App.running = false;
  clearInterval(App.timers.sec);
  cancelAnimationFrame(App.rafId);

  // finalize quests
  const scoreNow = App.score.get();
  const { stars, grade } = App.score.getGrade();
  Quests.endRun({ score: scoreNow });

  // progression
  Progress.endRun({ score: scoreNow, bestCombo: App.score.bestCombo|0, timePlayed: (App.secs|0), acc: 0 });

  // leaderboard
  const name = ($('#playerName')?.value || '').trim() || undefined;
  App.leader.submit(App.mode, App.diff, scoreNow, { name, meta:{ stars, grade } });

  // show result
  setText('#finalScore', `${scoreNow}  ★${stars}  [${grade}]`);
  const t = $('#result'); if (t) t.style.display = 'flex';

  App.power.dispose();
}

/* ========================= Autoplay guard ========================= */
function onFirstInteract(){
  try {
    sfx.unlock?.();
    const bgm = $('#bgm-main'); if (bgm && bgm.src) bgm.play().catch(()=>{});
  } catch {}
}

/* ========================= Pause / Resume ========================= */
function pauseGame(){
  if (!App.running) return;
  VRInput.pause?.();
  clearInterval(App.timers.sec);
  cancelAnimationFrame(App.rafId);
  App.hud.say(App.lang==='TH'?'พักเกมชั่วคราว':'Paused', 900);
}
function resumeGame(){
  if (!App.running) return;
  if (!document.hidden){
    VRInput.resume?.();
    clearInterval(App.timers.sec);
    App.timers.sec = setInterval(onTick1s, 1000);

    cancelAnimationFrame(App.rafId);
    App.lastTs = 0;
    const step = (ts)=>{
      if (!App.lastTs) App.lastTs = ts;
      const dt = Math.min(0.06, (ts - App.lastTs) / 1000);
      App.lastTs = ts;
      App.modeInst?.update?.(dt, { hit:()=>{}, miss:()=>{} });
      App.rafId = requestAnimationFrame(step);
    };
    App.rafId = requestAnimationFrame(step);

    App.hud.say(App.lang==='TH'?'ต่อกันเลย!':'Resumed', 800);
  }
}

/* ========================= Public debug (optional) ========================= */
try { window.__HHA_APP__ = App; } catch {}
