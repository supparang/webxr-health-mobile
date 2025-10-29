// === Hero Health Academy — game/main.js (2025-10-29, unified + START/Loop fix) ===
// - Modes: goodjunk | groups | hydration | plate (DOM-spawn)
// - Adds: mode imports + MODE_MAP + engine Bus + RAF game loop
// - Features: pause on blur, autoplay guard, result modal, daily mission ping, power HUD, quests HUD

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

/* ----- Imports (modes) ----- */
import * as goodjunk   from './modes/goodjunk.js';
import * as groups     from './modes/groups.js';
import * as hydration  from './modes/hydration.js';
import * as plate      from './modes/plate.js';

const MODE_MAP = { goodjunk, groups, hydration, plate };

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
  timers: { sec: 0 },
  rafId: 0,
  lastTs: 0,

  // Systems
  hud: null,
  score: null,
  power: null,
  missionSys: null,
  leader: null,

  // Current mode instance
  modeInst: null,

  // Shared state
  state: { ctx:{}, missions:[], fever01:0 },

  // FX helpers for modes
  fx: {
    popText(txt, {x,y,ms=700}={}){
      const n=document.createElement('div');
      n.textContent=txt;
      n.style.cssText=`position:fixed;left:${x|0}px;top:${y|0}px;transform:translate(-50%,-50%);
        font:900 14px ui-rounded;color:#eaf6ff;background:#102038e6;border:1px solid #1b2e4b;
        padding:6px 10px;border-radius:10px;pointer-events:none;z-index:120;opacity:0;transition:opacity .08s, transform .7s`;
      document.body.appendChild(n);
      requestAnimationFrame(()=>{ n.style.opacity='1'; n.style.transform=`translate(-50%,-70%)`; });
      setTimeout(()=>{ try{ n.remove(); }catch{} }, ms);
    }
  },

  sfx
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
      App.hud.setCombo?.(`x${App.score.combo|0}`);
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
  App.power.onChange(()=> {
    const t = App.power.getCombinedTimers ? App.power.getCombinedTimers() : App.power.getTimers?.();
    App.hud.setPowerTimers?.(t || {});
  });

  // Missions / Leaderboard / Progress / Quests
  App.missionSys = new MissionSystem();
  App.leader     = new Leaderboard({ key:'hha_board_v2', maxKeep:500, retentionDays:365 });
  Progress.init?.();
  Quests.bindToMain({ hud: App.hud });
  Quests.setLang(App.lang);

  // VR/Gaze (optional chaining to guard versions)
  VRInput.init?.({ sfx });
  VRInput.setAimHost?.($('#gameLayer'));
  VRInput.setDwellMs?.(900);
  VRInput.setCooldown?.(350);
  VRInput.setReticleStyle?.({ size: 30, border:'#eaf6ff', progress:'#42f9da' });

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

  // Expose starters
  exposeStarters();
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

  $('#btn_start')?.addEventListener('click', startGame);
}

function reflectMenu(){
  $$('.tile').forEach(t=> t.classList.remove('active'));
  $('#m_'+App.mode)?.classList.add('active');
  setText('#modeName', tileName(App.mode));

  ['#d_easy','#d_normal','#d_hard'].forEach(sel=> $(sel)?.classList.remove('active'));
  if (App.diff==='Easy')   $('#d_easy')?.classList.add('active');
  if (App.diff==='Normal') $('#d_normal')?.classList.add('active');
  if (App.diff==='Hard')   $('#d_hard')?.classList.add('active');
  setText('#difficulty', App.diff);
}

function setMode(m){ App.mode = m; reflectMenu(); }
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
  document.querySelectorAll('.chip[data-modal-open], [data-modal-open]').forEach(el=>{
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
function showModal(sel){ const el = document.querySelector(sel); if (el){ el.style.display='flex'; } }
function hideModal(sel){ const el = document.querySelector(sel); if (el){ el.style.display='none'; } }
function goHome(){ $('#menuBar')?.scrollIntoView({ behavior:'smooth', block:'start' }); }

/* ========================= Run Loop + Mode wiring ========================= */
function startGame(){
  if (App.running) endGame(true);

  // Announce time/diff to modes (plate/hydration use)
  window.__HHA_TIME = App.secs|0;
  window.__HHA_DIFF = App.diff;

  // Reset UI & state
  $('#result')?.style && ( $('#result').style.display = 'none' );
  App.hud.dispose();
  App.hud.setScore(0);
  App.hud.setTime(App.secs);
  App.hud.toast(App.lang==='TH' ? 'เริ่มเกม!' : 'Let’s go!', 900);

  App.score.reset();
  App.power.dispose();
  App.state = { ctx:{}, missions:[], fever01:0 };

  // Begin systems
  Progress.beginRun?.(App.mode, App.diff, App.lang);
  Quests.beginRun(App.mode, App.diff, App.lang, App.secs);

  // MissionSystem legacy
  const run = App.missionSys.start(App.mode, { difficulty:App.diff, lang:App.lang, seconds:App.secs, count:3 });
  App.missionSys.attachToState(run, App.state);

  // Build engine for modes
  const engine = {
    score: App.score,
    sfx: App.sfx || sfx,
    fx: App.fx,
    fever: { get active(){ return App.state.fever01>0.75; } }
  };

  // Create mode instance
  const mod = MODE_MAP[App.mode];
  if (!mod || typeof mod.create!=='function'){
    console.warn('[main] Mode missing or no create():', App.mode, mod);
    App.hud.say('Mode not ready', 1000);
    return;
  }
  App.modeInst?.stop?.();
  App.modeInst = mod.create({
    engine,
    hud: App.hud,
    coach: {
      onStart(){ /* hook if needed */ },
      onGood(){ /* optional voice/coach */ },
      onBad(){  /* optional voice/coach */ }
    }
  });
  App.modeInst.start?.();

  // Timer (seconds)
  App.timeLeft = App.secs|0;
  clearInterval(App.timers.sec);
  App.timers.sec = setInterval(onTick1s, 1000);

  // RAF loop
  cancelAnimationFrame(App.rafId);
  App.lastTs = 0;
  const Bus = {
    hit({ kind='good', points=10, ui, meta }={}){
      if (kind==='perfect') HHA.hitPerfect?.(meta||{});
      else HHA.hitGood?.(meta||{});
    },
    miss({ meta }={}){ HHA.hitBad?.(meta||{}); }
  };
  const step = (ts)=>{
    if (!App.running) return;
    if (!App.lastTs) App.lastTs = ts;
    const dt = Math.min(0.1, (ts - App.lastTs)/1000); // clamp dt
    App.lastTs = ts;

    // Update current mode
    App.modeInst?.update?.(dt, Bus);

    App.rafId = requestAnimationFrame(step);
  };
  App.running = true;
  App.rafId = requestAnimationFrame(step);

  // Small gift on Easy
  if (App.diff==='Easy') App.power.apply('shield', 5);
}

function onTick1s(){
  if (!App.running) return;
  App.timeLeft = Math.max(0, (App.timeLeft|0)-1);
  App.hud.setTime(App.timeLeft);

  // FEVER decay placeholder (0..1 UI progress)
  App.state.fever01 = Math.max(0, App.state.fever01 - 0.06);
  App.hud.setFeverProgress?.(App.state.fever01);

  // Mission & Quests tick
  App.missionSys.tick(App.state, { score: App.score.get() }, (ev)=>{
    if (ev?.success){ Progress.addMissionDone?.(App.mode); App.hud.toast('✓ Quest!', 900); }
  }, { hud: App.hud, coach: {
        onQuestDone(){ App.hud.say(App.lang==='TH'?'สำเร็จภารกิจ!':'Quest complete!', 900); },
        onQuestFail(){ App.hud.say(App.lang==='TH'?'พลาดภารกิจ':'Quest failed', 900); },
        onQuestProgress(txt,prog,need){ App.hud.say(`${txt} (${prog}/${need})`, 700); }
      }, lang: App.lang });

  Quests.tick({ score: App.score.get() });

  if (App.timeLeft <= 0) endGame(false);
}

function endGame(isAbort=false){
  if (!App.running) return;
  App.running = false;

  clearInterval(App.timers.sec);
  cancelAnimationFrame(App.rafId);
  App.rafId = 0;

  // Stop mode
  App.modeInst?.stop?.();
  App.modeInst = null;

  const scoreNow = App.score.get();
  const { stars, grade } = App.score.getGrade();
  Quests.endRun({ score: scoreNow });
  Progress.endRun?.({ score: scoreNow, bestCombo: App.score.bestCombo|0, timePlayed: (App.secs|0), acc: 0 });

  const name = $('#playerName')?.value?.trim() || undefined;
  App.leader.submit(App.mode, App.diff, scoreNow, { name, meta:{ stars, grade } });

  setText('#finalScore', `${scoreNow}  ★${stars}  [${grade}]`);
  showModal('#result');

  App.power.dispose();
}

/* ========================= Gameplay Hooks (for modes) ========================= */
window.HHA = Object.assign(window.HHA || {}, {
  hitGood(meta={}){ App.score.addKind('good', meta); Quests.event('hit', { result:'good', comboNow:App.score.combo|0, meta }); App.missionSys.onEvent('good',{count:1},App.state); },
  hitPerfect(meta={}){ 
    App.score.addKind('perfect', meta); 
    App.state.fever01 = Math.min(1, App.state.fever01 + 0.1);
    Quests.event('hit', { result:'perfect', comboNow:App.score.combo|0, meta:{...meta, golden:!!meta.golden} });
    App.missionSys.onEvent('good',{count:1},App.state);
  },
  hitBad(meta={}){ 
    if (App.power.consumeShield?.()) {
      App.hud.toast(App.lang==='TH'?'🛡 กันความเสียหาย':'🛡 Shielded', 900);
    } else {
      App.score.addKind('bad', meta); 
      App.hud.flashDanger?.();
      App.missionSys.onEvent('miss',{count:1},App.state);
    }
  },
  targetHit(meta={}){ App.score.addKind('good', { ...meta, isTarget:true }); App.missionSys.onEvent('target_hit',{count:1},App.state); Quests.event('hit', { result:'good', comboNow:App.score.combo|0, meta:{...meta, isTarget:true} }); },
  wrongGroup(){ App.missionSys.onEvent('wrong_group',{count:1},App.state); },
  feverStart(){ Quests.event('fever',{kind:'start'}); },
  feverEnd(){ Quests.event('fever',{kind:'end'}); },
  platePerfect(){ App.missionSys.onEvent('plate_perfect',{count:1},App.state); },
  plateOver(){ App.missionSys.onEvent('over_quota',{count:1},App.state); },
  hydrationTick(zone){ App.missionSys.onEvent('hydration_zone',{z:String(zone||'')},App.state); Quests.event('hydro_tick',{zone:String(zone||'')}); },
  hydrationCross(from,to){ Quests.event('hydro_cross',{from:String(from||''), to:String(to||'')}); },
  hydrationTreatHighSweet(){ Quests.event('hydro_click',{zoneBefore:'HIGH', kind:'sweet'}); },
  groupFull(){ Quests.event('group_full'); },
  targetCycle(){ Quests.event('target_cleared'); }
});

/* ========================= Autoplay guard ========================= */
function onFirstInteract(){
  try {
    const bgm = $('#bgm-main');
    if (bgm && !bgm.src) {
      // bgm.src = 'assets/audio/bgm_main.mp3';
    }
    sfx.unlock?.();
  } catch {}
}

/* ========================= Pause / Resume ========================= */
function pauseGame(){
  if (!App.running) return;
  VRInput.pause?.();
  clearInterval(App.timers.sec);
  App.hud.say(App.lang==='TH'?'พักเกมชั่วคราว':'Paused', 900);
}
function resumeGame(){
  if (!App.running) return;
  if (!document.hidden){
    VRInput.resume?.();
    clearInterval(App.timers.sec);
    App.timers.sec = setInterval(onTick1s, 1000);
    // resume RAF
    cancelAnimationFrame(App.rafId);
    App.lastTs = 0;
    const step = (ts)=>{
      if (!App.running) return;
      if (!App.lastTs) App.lastTs = ts;
      const dt = Math.min(0.1, (ts - App.lastTs)/1000);
      App.lastTs = ts;
      App.modeInst?.update?.(dt, { hit:({kind,points,ui,meta})=>{ if(kind==='perfect') HHA.hitPerfect?.(meta); else HHA.hitGood?.(meta); }, miss:({meta}={})=>HHA.hitBad?.(meta) });
      App.rafId = requestAnimationFrame(step);
    };
    App.rafId = requestAnimationFrame(step);
    App.hud.say(App.lang==='TH'?'ต่อกันเลย!':'Resumed', 800);
  }
}

/* ========================= Expose starters for ui.js (CRITICAL) ========================= */
function exposeStarters(){
  try {
    window.HHA = window.HHA || {};
    window.HHA.startGame = startGame;
    window.HHA.endGame   = endGame;
    window.HHA.goHome    = goHome;
    window.preStartFlow  = () => startGame();
  } catch {}
}

/* ========================= Public debug (optional) ========================= */
try { window.__HHA_APP__ = App; } catch {}
