// === Hero Health Academy — game/main.js (unified, stable) ===
import { HUD }            from './core/hud.js';
import { SFX, sfx }       from './core/sfx.js';
import { ScoreSystem }    from './core/score.js';
import { PowerUpSystem }  from './core/powerup.js';
import { MissionSystem }  from './core/mission-system.js';
import { Quests }         from './core/quests.js';
import { Progress }       from './core/progression.js';
import { Leaderboard }    from './core/leaderboard.js';
import { VRInput }        from './core/vrinput.js';

// Modes (DOM-spawn factory style)
import * as mode_goodjunk  from './modes/goodjunk.js';
import * as mode_groups    from './modes/groups.js';
import * as mode_hydration from './modes/hydration.js';
import * as mode_plate     from './modes/plate.js';

const $  = (s)=>document.querySelector(s);
const $$ = (s)=>[...document.querySelectorAll(s)];
const setText=(sel,txt)=>{ const el=$(sel); if(el) el.textContent=txt; };

const App = {
  mode: (document.body.getAttribute('data-mode') || 'goodjunk'),
  diff: (document.body.getAttribute('data-diff') || 'Normal'),
  lang: (document.documentElement.getAttribute('data-hha-lang') || 'TH').toUpperCase(),
  secs: 45,

  running:false,
  timeLeft:45,
  timers:{ sec:0, raf:0 },

  hud:null, score:null, power:null, missionSys:null, leader:null,
  game:null, // active factory {start,stop,update,...}

  state:{ fever01:0, ctx:{} }
};

boot();

function boot(){
  // Core systems
  App.hud = new HUD();
  App.score = new ScoreSystem();
  App.score.setHandlers({
    change:(val,{delta,meta})=>{
      App.hud.setScore(val|0);
      App.hud.setCombo(`x${App.score.combo|0}`);
      if (meta?.kind){
        Quests.event('hit', {
          result: meta.kind,
          comboNow: App.score.combo|0,
          meta: { good: meta.kind==='good'||meta.kind==='perfect', golden: !!meta.golden, isTarget: !!meta.isTarget, groupId: meta.groupId }
        });
      }
    }
  });

  App.power = new PowerUpSystem();
  App.power.attachToScore(App.score);
  App.power.onChange(()=>{
    const t = App.power.getCombinedTimers ? App.power.getCombinedTimers() : App.power.getTimers?.();
    App.hud.setPowerTimers(t||{});
  });

  App.missionSys = new MissionSystem();
  App.leader = new Leaderboard({ key:'hha_board_v2', maxKeep:500, retentionDays:365 });

  Progress.init();
  Quests.bindToMain({ hud: App.hud });
  Quests.setLang(App.lang);

  VRInput.init({ sfx });
  VRInput.setAimHost($('#gameLayer'));
  VRInput.setDwellMs(900);
  VRInput.setCooldown(350);
  VRInput.setReticleStyle({ size: 30, border:'#eaf6ff', progress:'#42f9da' });

  bindUI();
  reflectMenu();

  document.addEventListener('pointerdown', onFirstInteract, { once:true, passive:true });
  document.addEventListener('keydown',     onFirstInteract, { once:true, passive:true });

  window.addEventListener('blur', onPauseIntent, { passive:true });
  document.addEventListener('visibilitychange', ()=> document.hidden ? onPauseIntent() : onResumeIntent(), { passive:true });

  // Expose debug
  try{ window.__HHA_APP__ = App; }catch{}
}

function bindUI(){
  $('#m_goodjunk') ?.addEventListener('click', ()=> setMode('goodjunk'));
  $('#m_groups')   ?.addEventListener('click', ()=> setMode('groups'));
  $('#m_hydration')?.addEventListener('click', ()=> setMode('hydration'));
  $('#m_plate')    ?.addEventListener('click', ()=> setMode('plate'));

  $('#d_easy')  ?.addEventListener('click', ()=> setDiff('Easy'));
  $('#d_normal')?.addEventListener('click', ()=> setDiff('Normal'));
  $('#d_hard')  ?.addEventListener('click', ()=> setDiff('Hard'));

  $('#langToggle')?.addEventListener('click', ()=>{
    App.lang = (App.lang==='TH')?'EN':'TH';
    setText('#langToggle', App.lang);
    Quests.setLang(App.lang);
  });

  $('#btn_start')?.addEventListener('click', startGame);

  // Result modal actions
  document.querySelectorAll('#result [data-result]').forEach(btn=>{
    btn.addEventListener('click', (e)=>{
      const act = e.currentTarget.getAttribute('data-result');
      hideModal('#result');
      if (act==='replay') startGame();
    });
  });

  // Board modal toggles
  $('#btn_board')?.addEventListener('click', ()=> showModal('#boardModal'));
  $('#lb_close') ?.addEventListener('click', ()=> hideModal('#boardModal'));
}

function reflectMenu(){
  $$('.tile').forEach(t=>t.classList.remove('active'));
  $('#m_'+App.mode)?.classList.add('active');
  setText('#modeName', tileName(App.mode));

  $$('#d_easy,#d_normal,#d_hard').forEach(c=>c.classList.remove('active'));
  (App.diff==='Easy'   ? $('#d_easy'):
   App.diff==='Hard'   ? $('#d_hard') : $('#d_normal'))?.classList.add('active');
  setText('#difficulty', App.diff);
}

function setMode(m){ App.mode=m; reflectMenu(); }
function setDiff(d){ App.diff=d; App.secs = (d==='Easy')?50:(d==='Hard'?40:45); reflectMenu(); }
function tileName(m){
  return (m==='goodjunk')?'Good vs Junk':(m==='groups')?'5 Food Groups':(m==='hydration')?'Hydration':(m==='plate')?'Healthy Plate':m;
}

function showModal(sel){ const el=document.querySelector(sel); if(el) el.style.display='flex'; }
function hideModal(sel){ const el=document.querySelector(sel); if(el) el.style.display='none'; }

function onFirstInteract(){ try{ sfx.unlock?.(); }catch{} }

export function onPauseIntent(){
  if (!App.running) return;
  cancelAnimationFrame(App.timers.raf);
  clearInterval(App.timers.sec);
  App.hud.say(App.lang==='TH'?'พักเกมชั่วคราว':'Paused', 900);
}
export function onResumeIntent(){
  if (!App.running) return;
  if (!document.hidden){
    clearInterval(App.timers.sec);
    App.timers.sec = setInterval(onTick1s, 1000);
    loop(); // resume RAF
    App.hud.say(App.lang==='TH'?'ต่อกันเลย!':'Resumed', 800);
  }
}

function startGame(){
  if (App.running) endGame(true);

  $('#result')?.style && ( $('#result').style.display='none' );

  App.hud.dispose();
  App.hud.setScore(0);
  App.hud.setTime(App.secs);
  App.hud.setCombo('x0');
  App.hud.toast(App.lang==='TH'?'เริ่มเกม!':'Let’s go!', 900);

  App.score.reset();
  App.power.dispose();
  App.state = { fever01:0, ctx:{} };

  Progress.beginRun(App.mode, App.diff, App.lang);
  Quests.beginRun(App.mode, App.diff, App.lang, App.secs);

  const run = App.missionSys.start(App.mode, { difficulty:App.diff, lang:App.lang, seconds:App.secs, count:3 });
  App.missionSys.attachToState(run, App.state);

  App.timeLeft = App.secs|0;
  clearInterval(App.timers.sec);
  App.timers.sec = setInterval(onTick1s, 1000);

  // switch & create mode
  if (App.game?.cleanup) { try{ App.game.cleanup(); }catch{} }
  const factory = (App.mode==='goodjunk')  ? mode_goodjunk
                 : (App.mode==='groups')   ? mode_groups
                 : (App.mode==='hydration')? mode_hydration
                 :                            mode_plate;
  App.game = factory.create?.({ engine:{ score:App.score, sfx, fx:App.hud }, hud:App.hud, coach:App.hud });
  App.game?.start?.();

  App.running = true;
  loop();
}

function onTick1s(){
  if (!App.running) return;
  App.timeLeft = Math.max(0, (App.timeLeft|0)-1);
  App.hud.setTime(App.timeLeft);

  // FEVER placeholder
  App.state.fever01 = Math.max(0, App.state.fever01 - 0.06);
  App.hud.setFeverProgress(App.state.fever01);

  // Missions 1s tick
  App.missionSys.tick(App.state, { score: App.score.get() }, (ev)=>{
    if (ev?.success){ Progress.addMissionDone(App.mode); App.hud.toast('✓ Quest!', 900); }
  }, { hud: App.hud, coach: {
        onQuestDone(){ App.hud.say(App.lang==='TH'?'สำเร็จภารกิจ!':'Quest complete!', 900); },
        onQuestFail(){ App.hud.say(App.lang==='TH'?'พลาดภารกิจ':'Quest failed', 900); },
        onQuestProgress(txt,prog,need){ App.hud.say(`${txt} (${prog}/${need})`, 700); }
      }, lang: App.lang });

  Quests.tick({ score: App.score.get() });

  if (App.timeLeft <= 0) endGame(false);
}

function loop(){
  if (!App.running) return;
  const t0 = performance.now();
  let last = t0;
  function step(){
    if (!App.running) return;
    const now = performance.now();
    const dt = Math.min(0.06, Math.max(0.001, (now - last)/1000)); // ~sec
    last = now;
    App.game?.update?.(dt, { hit:onBusHit, miss:onBusMiss });
    App.timers.raf = requestAnimationFrame(step);
  }
  step();
}

function onBusHit({ kind='good', points=10, ui, meta }={}){
  if (kind==='perfect'){ App.state.fever01 = Math.min(1, App.state.fever01 + 0.1); }
  App.score.addKind(kind, { ...meta, kind });
}
function onBusMiss(){
  if (App.power.consumeShield?.()) App.hud.toast(App.lang==='TH'?'🛡 กันความเสียหาย':'🛡 Shielded', 900);
  else { App.score.addKind('bad', {}); App.hud.flashDanger(); }
}

function endGame(isAbort=false){
  if (!App.running) return;
  App.running = false;
  clearInterval(App.timers.sec);
  cancelAnimationFrame(App.timers.raf);

  const scoreNow = App.score.get();
  const { stars, grade } = App.score.getGrade();
  const quests = Quests.endRun({ score: scoreNow });

  Progress.endRun({ score: scoreNow, bestCombo: App.score.bestCombo|0, timePlayed: (App.secs|0), acc: 0 });
  App.leader.submit(App.mode, App.diff, scoreNow, { name: ($('#playerName')?.value||'Player'), meta:{ stars, grade } });

  setText('#resultText', `${App.lang==='TH'?'คะแนน':'Score'}: ${scoreNow}  ★${stars} [${grade}]`);
  showModal('#result');

  App.power.dispose();
}
