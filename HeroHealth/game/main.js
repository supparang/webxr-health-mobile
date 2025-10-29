// === Hero Health Academy — game/main.js (2025-10-30, unified/FX-namespace/pause-fix) ===
// Modes: goodjunk | groups | hydration | plate
// Systems: HUD, Score, PowerUp(v3), MissionSystem, Quests(v2), Progress, Leaderboard, VRInput, FX namespace
// Features: pause on blur, autoplay guard, result modal, quest HUD, coach toasts

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
import FX                 from './core/fx.js'; // ★ namespace { add3DTilt, shatter3D }

/* ----- Imports (modes, DOM-spawn factories) ----- */
import * as goodjunk   from './modes/goodjunk.js';
import * as groups     from './modes/groups.js';
import * as hydration  from './modes/hydration.js';
import * as plate      from './modes/plate.js';

/* ----- Shorthands / DOM ----- */
const $  = (s)=>document.querySelector(s);
const $$ = (s)=>[...document.querySelectorAll(s)];
const setText = (sel, txt)=>{ const el=$(sel); if(el) el.textContent = txt; };

/* ========================= App State ========================= */
const App = {
  mode: (document.body.getAttribute('data-mode') || 'goodjunk'),
  diff: (document.body.getAttribute('data-diff') || 'Normal'),
  lang: (document.documentElement.getAttribute('data-hha-lang') || 'TH').toUpperCase(),
  secs: 45,

  running: false,
  timeLeft: 45,
  timers: { main: 0, sec: 0 },

  // Systems
  hud: null,
  score: null,
  power: null,
  missionSys: null,
  leader: null,

  // Active mode adapter { start, stop, update, cleanup }
  modeFactory: null,

  // Engine helpers (fx namespace mapping)
  fx: {
    popText(txt, {x,y,ms=700}={}){
      try{
        const el=document.createElement('div');
        el.textContent=txt;
        el.style.cssText=`position:fixed;left:${x}px;top:${y}px;transform:translate(-50%,-50%);
          pointer-events:none;z-index:120;font:900 14px ui-rounded;color:#dbfffb;text-shadow:0 2px 8px #0009`;
        document.body.appendChild(el);
        el.animate([{opacity:1, transform:'translate(-50%,-50%) scale(1)'},
                    {opacity:0, transform:'translate(-50%,-80%) scale(.9)'}],
                   {duration:ms, easing:'ease-out'}).onfinish=()=>{try{el.remove();}catch{}};
      }catch{}
    },
    add3DTilt: FX.add3DTilt,
    shatter3D: FX.shatter3D
  }
};

/* ========================= Pause / Resume (declare first) ========================= */
function pauseGame(){
  if (!App.running) return;
  VRInput.pause?.();
  clearInterval(App.timers.sec);
  App.hud?.say(App.lang==='TH'?'พักเกมชั่วคราว':'Paused', 900);
}
function resumeGame(){
  if (!App.running) return;
  if (!document.hidden){
    VRInput.resume?.();
    clearInterval(App.timers.sec);
    App.timers.sec = setInterval(onTick1s, 1000);
    App.hud?.say(App.lang==='TH'?'ต่อกันเลย!':'Resumed', 800);
  }
}

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
      App.hud.setCombo(`x${App.score.combo|0}`);
      if (meta?.kind){
        Quests.event('hit', {
          result: meta.kind,
          comboNow: App.score.combo|0,
          meta: { good: meta.kind==='good' || meta.kind==='perfect', golden: !!meta.golden, isTarget: !!meta.isTarget, groupId: meta.groupId }
        });
      }
    }
  });

  // Power-ups (v3)
  App.power = new PowerUpSystem();
  App.power.attachToScore(App.score);
  App.power.onChange(() => {
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

  // UI
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

  // RAF loop for DOM-spawn modes
  requestAnimationFrame(gameFrame);
}

/* ========================= UI: Menu & Controls ========================= */
function bindMenu(){
  // Mode tiles
  $('#m_goodjunk')  ?.addEventListener('click', ()=> setMode('goodjunk'));
  $('#m_groups')    ?.addEventListener('click', ()=> setMode('groups'));
  $('#m_hydration') ?.addEventListener('click', ()=> setMode('hydration'));
  $('#m_plate')     ?.addEventListener('click', ()=> setMode('plate'));

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
  // strong binding (replace node to clear old listeners)
  const b = $('#btn_start'); if (b){
    const clone=b.cloneNode(true); b.parentNode.replaceChild(clone,b);
    clone.addEventListener('click', (e)=>{ e.preventDefault(); e.stopPropagation(); startGame(); }, { capture:true });
  }
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
function goHome(){ $('#menuBar')?.scrollIntoView({ behavior:'smooth', block:'start' }); }

/* ========================= Start/End ========================= */
async function startGame(){
  if (App.running) endGame(true);

  // UI reset
  $('#result')?.style && ( $('#result').style.display = 'none' );
  App.hud.dispose(); // clears coach/toast timeouts safely
  App.hud.setScore(0);
  App.hud.setTime(App.secs);
  App.hud.toast(App.lang==='TH' ? 'เริ่มเกม!' : 'Let’s go!', 900);

  App.score.reset();
  App.power.dispose(); // clear timers & boost

  // Daily/Progress begin
  Progress.beginRun(App.mode, App.diff, App.lang);

  // Quests (3 random)
  Quests.beginRun(App.mode, App.diff, App.lang, App.secs);

  // Legacy MissionSystem (3 chips attach)
  const state = { ctx:{}, missions:[], fever01:0 };
  const run = App.missionSys.start(App.mode, { difficulty:App.diff, lang:App.lang, seconds:App.secs, count:3 });
  App.missionSys.attachToState(run, state);

  // Timer
  App.timeLeft = App.secs|0;
  clearInterval(App.timers.sec);
  App.timers.sec = setInterval(onTick1s, 1000);

  // Build mode factory
  if (App.modeFactory?.stop) { try{ App.modeFactory.stop(); }catch{} }
  App.modeFactory = createModeFactory(App.mode, { score:App.score, sfx, fx:App.fx });
  App.modeFactory?.start?.();

  App.running = true;

  // Optional: minor opening power gift for Easy
  if (App.diff==='Easy') App.power.apply('shield', 5);
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
  const pname = ($('#playerName')?.value||'').trim() || undefined;
  App.leader.submit(App.mode, App.diff, scoreNow, { name: pname, meta:{ stars, grade } });

  // Show result
  const qs = (quests||[]).map(q=>`${q.done?'✓':'–'} ${q.label} (${q.prog||0}/${q.need||0})`).join('\n');
  setText('#resultText', App.lang==='TH' ? 'สรุปผลคะแนนและเควสต์' : 'Score & quests summary');
  setText('#pbRow', `⭐ ${scoreNow}  ★${stars}  [${grade}]`);
  $('#miniTop')?.replaceChildren(document.createTextNode(qs||''));
  showModal('#result');

  // Daily ping
  const d = Progress.getDaily?.();
  if (d?.missions?.length){
    App.hud.toast(App.lang==='TH' ? 'อัปเดตภารกิจรายวันแล้ว' : 'Daily missions updated', 1100);
  }

  // Clean power + mode
  App.power.dispose();
  try{ App.modeFactory?.stop?.(); }catch{}
}

/* ========================= Ticks ========================= */
function onTick1s(){
  if (!App.running) return;
  App.timeLeft = Math.max(0, (App.timeLeft|0)-1);
  App.hud.setTime(App.timeLeft);

  // FEVER decay placeholder (0..1 UI progress) — optional if HUD supports
  try{
    const fever01 = Math.max(0, (window.__HHA_FEVER01||0) - 0.06);
    window.__HHA_FEVER01 = fever01;
    App.hud.setFeverProgress?.(fever01);
  }catch{}

  // MissionSystem tick
  App.missionSys.tick({}, { score: App.score.get() }, (ev)=>{
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

/* RAF loop calls active mode update(dt) for DOM-spawn cadence, lifetime, etc */
let _rafLast = 0;
function gameFrame(ts){
  const last = _rafLast || ts;
  const dt = Math.max(0.001, (ts - last)/1000);
  _rafLast = ts;

  if (App.running){
    try { App.modeFactory?.update?.(dt, {
      hit:  ({ kind='good', points=10, ui={}, meta={} }={}) => {
        if (kind==='perfect') App.score.addKind('perfect', meta);
        else if (kind==='good') App.score.addKind('good', meta);
        else App.score.addKind('bad', meta);
      },
      miss: ({ meta={} }={}) => {
        // shield absorbs first bad
        if (App.power.consumeShield?.()) App.hud.toast(App.lang==='TH'?'🛡 กันความเสียหาย':'🛡 Shielded', 900);
        else { App.score.addKind('bad', meta); App.hud.flashDanger?.(); }
      }
    }); } catch(e){ console.warn('[mode update error]', e); }
  }

  requestAnimationFrame(gameFrame);
}

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

/* ========================= Mode Factory Resolver ========================= */
function createModeFactory(key, engine){
  const hud = App.hud;
  const coach = { 
    onStart(){ /* optional: HUD tips */ },
    onGood(){ sfx.good?.(); },
    onBad(){ sfx.bad?.(); }
  };
  const map = { goodjunk, groups, hydration, plate };
  const mod = map[key] || goodjunk;
  // prefer DOM-spawn create(); fallback to legacy init/tick if needed
  if (typeof mod.create === 'function'){
    const f = mod.create({ engine:{...engine, score:App.score, fx:App.fx }, hud, coach });
    return f;
  }
  // very old fallback
  return {
    start(){ try{ mod.init?.({}, hud, { time:App.secs }); }catch{} },
    stop(){ try{ mod.cleanup?.(); }catch{} },
    update(dt, Bus){ try{
      // emulate spawn by calling mod.tick? (legacy modes usually handled elsewhere)
      mod.tick?.({}, { score:App.score }, hud);
    }catch{} }
  };
}

/* ========================= Public debug (optional) ========================= */
try { window.__HHA_APP__ = App; window.__HHA_FX_NS__ = App.fx; } catch {}
