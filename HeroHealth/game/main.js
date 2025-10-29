// === Hero Health Academy — game/main.js (2025-10-29r2)
// Wire-up ครบ: RAF loop + Bus -> Score/Mission/Quests/HUD/Result

/* ----- Imports (core) ----- */
import { HUD }            from './core/hud.js';
import { sfx }            from './core/sfx.js';
import { ScoreSystem }    from './core/score.js';
import { PowerUpSystem }  from './core/powerup.js';
import { MissionSystem }  from './core/mission-system.js';
import { Quests }         from './core/quests.js';
import { Progress }       from './core/progression.js';
import { Leaderboard }    from './core/leaderboard.js';
import { VRInput }        from './core/vrinput.js';

/* ----- Modes (DOM-spawn factories) ----- */
import * as goodjunk  from './modes/goodjunk.js';
import * as groups    from './modes/groups.js';
import * as hydration from './modes/hydration.js';
import * as plate     from './modes/plate.js';

/* ----- DOM helpers ----- */
const $  = (s)=>document.querySelector(s);
const $$ = (s)=>[...document.querySelectorAll(s)];
const setText = (sel, txt)=>{ const el=$(sel); if(el) el.textContent = txt; };

/* ----- App ----- */
const App = {
  mode: (document.body.getAttribute('data-mode') || 'goodjunk'),
  diff: (document.body.getAttribute('data-diff') || 'Normal'),
  lang: (document.documentElement.getAttribute('data-hha-lang') || 'TH').toUpperCase(),
  secs: 45,

  running:false,
  timeLeft:45,
  secTimer:0,
  raf:0,
  lastT:0,

  hud:null,
  score:null,
  power:null,
  mission:null,
  leader:null,
  currentMode:null,      // factory instance { start, update(dt, Bus), stop, cleanup }
};

const MODS = { goodjunk, groups, hydration, plate };

/* ========================= Boot ========================= */
boot();

function boot(){
  App.hud   = new HUD();
  App.score = new ScoreSystem();
  App.power = new PowerUpSystem();
  App.mission = new MissionSystem();
  App.leader  = new Leaderboard({ key:'hha_board_v2', maxKeep:500, retentionDays:365 });

  App.power.attachToScore(App.score);
  App.power.onChange(() => {
    const t = App.power.getCombinedTimers ? App.power.getCombinedTimers() : App.power.getTimers?.();
    App.hud.setPowerTimers(t || {});
  });

  Progress.init();
  Quests.bindToMain({ hud: App.hud });
  Quests.setLang(App.lang);

  // Score → HUD + Quests
  App.score.setHandlers({
    change: (val,{meta})=>{
      App.hud.setScore(val|0);
      App.hud.setCombo('x'+(App.score.combo|0));
      if (meta?.kind){
        Quests.event('hit', {
          result: meta.kind,
          comboNow: App.score.combo|0,
          meta: { good: meta.kind==='good'||meta.kind==='perfect',
                  golden: !!meta.golden,
                  isTarget: !!meta.isTarget,
                  groupId: meta.groupId }
        });
      }
    }
  });

  VRInput.init({ sfx }); VRInput.setAimHost($('#gameLayer')); VRInput.setDwellMs(900);

  bindMenu();
  bindHelpAndResult();
  reflectMenu();
}

/* ========================= Menu ========================= */
function bindMenu(){
  $('#m_goodjunk') ?.addEventListener('click', ()=> setMode('goodjunk'));
  $('#m_groups')   ?.addEventListener('click', ()=> setMode('groups'));
  $('#m_hydration')?.addEventListener('click', ()=> setMode('hydration'));
  $('#m_plate')    ?.addEventListener('click', ()=> setMode('plate'));

  $('#d_easy')  ?.addEventListener('click', ()=> setDiff('Easy'));
  $('#d_normal')?.addEventListener('click', ()=> setDiff('Normal'));
  $('#d_hard')  ?.addEventListener('click', ()=> setDiff('Hard'));

  $('#langToggle')?.addEventListener('click', ()=>{
    App.lang = (App.lang==='TH'?'EN':'TH');
    setText('#langToggle', App.lang);
    Quests.setLang(App.lang);
  });

  $('#soundToggle')?.addEventListener('click', ()=>{
    const on = !sfx.isEnabled(); sfx.setEnabled(on);
    setText('#soundToggle', on?'🔊':'🔇');
  });

  $('#btn_start')?.addEventListener('click', startGame, { capture:true });
}

function reflectMenu(){
  $$('.tile').forEach(t=>t.classList.remove('active'));
  $('#m_'+App.mode)?.classList.add('active');
  setText('#modeName', {goodjunk:'Good vs Junk',groups:'5 Food Groups',hydration:'Hydration',plate:'Healthy Plate'}[App.mode]||App.mode);

  $$('#d_easy,#d_normal,#d_hard').forEach(c=>c.classList.remove('active'));
  ({Easy:'#d_easy',Normal:'#d_normal',Hard:'#d_hard'}[App.diff] && $( {Easy:'#d_easy',Normal:'#d_normal',Hard:'#d_hard'}[App.diff] ).classList.add('active'));
  setText('#difficulty', App.diff);
}
function setMode(m){ App.mode=m; reflectMenu(); }
function setDiff(d){ App.diff=d; App.secs=(d==='Easy')?50:(d==='Hard'?40:45); reflectMenu(); }

/* ========================= Help + Result ========================= */
function bindHelpAndResult(){
  $('#btn_ok')?.addEventListener('click', ()=> hideModal('#help'));
  $('#btn_open_board')?.addEventListener('click', ()=> showModal('#boardModal'));
  $('#lb_close')?.addEventListener('click', ()=> hideModal('#boardModal'));

  // Result actions
  $('#result')?.addEventListener('click', (e)=>{
    const act = e.target?.getAttribute?.('data-result');
    if (!act) return;
    hideModal('#result');
    if (act==='replay') startGame(); // same mode/diff
  });
}
function showModal(sel){ const el=document.querySelector(sel); if (el) el.style.display='flex'; }
function hideModal(sel){ const el=document.querySelector(sel); if (el) el.style.display='none'; }

/* ========================= Game Flow ========================= */
function startGame(){
  // cleanup instance if any
  stopLoop();
  try { App.currentMode?.cleanup?.(); } catch {}

  // HUD reset
  App.hud.setScore(0);
  App.hud.setTime(App.secs);
  App.hud.toast(App.lang==='TH'?'เริ่มเกม!':'Let’s go!', 900);

  // Systems reset
  App.score.reset();
  App.power.dispose();
  Progress.beginRun(App.mode, App.diff, App.lang);
  Quests.beginRun(App.mode, App.diff, App.lang, App.secs);

  // expose to modes
  window.__HHA_DIFF = App.diff; window.__HHA_TIME = App.secs;

  // create mode
  const mod = MODS[App.mode];
  App.currentMode = mod?.create?.({ engine:{ score:App.score, sfx, fx:HUD.fx }, hud:App.hud, coach:HUD.coach }) || null;
  App.currentMode?.start?.();

  // timers
  App.timeLeft = App.secs|0;
  clearInterval(App.secTimer);
  App.secTimer = setInterval(onTick1s, 1000);

  App.running = true;
  App.lastT = performance.now();
  App.raf = requestAnimationFrame(loop);
}

function loop(ts){
  if (!App.running) return;
  const dt = Math.max(0, (ts - App.lastT)/1000); // seconds
  App.lastT = ts;

  // ---- Bus: mode → systems
  const Bus = {
    hit: ({ kind='good', points=10, ui={}, meta={} }={})=>{
      // map to ScoreSystem kinds
      App.score.addKind(kind, meta);
      // Mission mini-quests
      App.mission.onEvent('good', { count:1 }, {});
      // pop text already handled by mode via HUD.fx, but ok
    },
    miss: ({ meta={} }={})=>{
      // shield is handled in main hits usually, here do soft penalty
      App.score.addKind('bad', meta);
      App.mission.onEvent('miss', { count:1 }, {});
      App.hud.flashDanger();
    }
  };

  try{ App.currentMode?.update?.(dt, Bus); }catch{}

  App.raf = requestAnimationFrame(loop);
}

function onTick1s(){
  if (!App.running) return;

  // time
  App.timeLeft = Math.max(0, (App.timeLeft|0) - 1);
  App.hud.setTime(App.timeLeft);

  // FEED Quests with current score context
  Quests.tick({ score: App.score.get() });

  // MissionSystem tick + coach hooks
  App.mission.tick({}, { score: App.score.get() }, (ev)=>{
    if (ev?.success) App.hud.toast(App.lang==='TH'?'✓ ภารกิจสำเร็จ':'✓ Quest!', 900);
  }, { hud: App.hud, coach: {
        onQuestDone(){ App.hud.say(App.lang==='TH'?'สำเร็จภารกิจ!':'Quest complete!', 900); },
        onQuestFail(){ App.hud.say(App.lang==='TH'?'พลาดภารกิจ':'Quest failed', 900); },
        onQuestProgress(t,p,n){ App.hud.say(`${t} (${p}/${n})`, 700); }
      }, lang: App.lang });

  if (App.timeLeft <= 0) endGame();
}

function endGame(){
  if (!App.running) return;
  App.running = false;

  clearInterval(App.secTimer);
  stopLoop();

  const score = App.score.get();
  const { stars, grade } = App.score.getGrade();
  const quests = Quests.endRun({ score });

  Progress.endRun({ score, bestCombo: App.score.bestCombo|0, timePlayed: (App.secs|0), acc: 0 });
  App.leader.submit(App.mode, App.diff, score, { name: ($('#playerName')?.value||'').trim()||undefined, meta:{ stars, grade } });

  // Result UI
  setText('#resultText', `Score ${score}  ★${stars}  [${grade}]`);
  showModal('#result');

  App.power.dispose();
  try { App.currentMode?.cleanup?.(); } catch {}
}

function stopLoop(){ cancelAnimationFrame(App.raf); App.raf = 0; }

try { window.__HHA_APP__ = App; } catch {}
