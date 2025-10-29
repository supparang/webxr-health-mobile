// === Hero Health Academy — game/main.js (unified) ===
import { HUD }            from './core/hud.js';
import { sfx }            from './core/sfx.js';
import { ScoreSystem }    from './core/score.js';
import { PowerUpSystem }  from './core/powerup.js';
import { MissionSystem }  from './core/mission-system.js';
import { Quests }         from './core/quests.js';
import { Progress }       from './core/progression.js';
import { Leaderboard }    from './core/leaderboard.js';
import { VRInput }        from './core/vrinput.js';

const $  = (s)=>document.querySelector(s);
const $$ = (s)=>[...document.querySelectorAll(s)];
const setText = (sel, txt)=>{ const el=$(sel); if(el) el.textContent = txt; };

const App = {
  mode: (document.body.getAttribute('data-mode') || 'goodjunk'),
  diff: (document.body.getAttribute('data-diff') || 'Normal'),
  lang: (document.documentElement.getAttribute('data-hha-lang') || 'TH').toUpperCase(),
  secs: 45,

  running:false, timeLeft:45, timers:{sec:0},

  hud:null, score:null, power:null, missionSys:null, leader:null,
  state:{ ctx:{}, missions:[], fever01:0 }
};

/* ============== Boot ============== */
boot();
function boot(){
  App.hud   = new HUD();

  App.score = new ScoreSystem();
  App.score.setHandlers({
    change: (val,{delta,meta})=>{
      App.hud.setScore(val|0);
      App.hud.setCombo(`x${App.score.combo|0}`);
      if (meta?.kind){
        Quests.event('hit', {
          result: meta.kind,
          comboNow: App.score.combo|0,
          meta: { good: meta.kind!=='bad', golden:!!meta.golden, isTarget:!!meta.isTarget, groupId:meta.groupId }
        });
      }
    }
  });

  App.power = new PowerUpSystem();
  App.power.attachToScore(App.score);
  App.power.onChange(() => { /* optional: App.hud.setPowerTimers(...) */ });

  App.missionSys = new MissionSystem();
  App.leader = new Leaderboard({ key:'hha_board_v2', maxKeep:500, retentionDays:365 });
  Progress.init();

  Quests.bindToMain({ hud: App.hud });
  Quests.setLang(App.lang);

  VRInput.init({ sfx });
  VRInput.setAimHost($('#gameLayer'));
  try{ VRInput.setDwellMs?.(900); }catch{}

  bindMenu();
  bindResultModal();
  reflectMenu();

  // autoplay guard
  document.addEventListener('pointerdown', ()=>sfx.unlock?.(), { once:true, passive:true });
  document.addEventListener('keydown',     ()=>sfx.unlock?.(), { once:true, passive:true });

  window.addEventListener('blur', pauseGame, { passive:true });
  document.addEventListener('visibilitychange', ()=> document.hidden ? pauseGame() : resumeGame(), { passive:true });

  // expose start for ui.js
  try { window.HHA = window.HHA || {}; window.HHA.startGame = startGame; window.HHA.endGame=endGame; } catch {}
}

/* ============== Menu UI ============== */
function bindMenu(){
  $('#m_goodjunk')  ?.addEventListener('click', ()=> setMode('goodjunk'));
  $('#m_groups')    ?.addEventListener('click', ()=> setMode('groups'));
  $('#m_hydration') ?.addEventListener('click', ()=> setMode('hydration'));
  $('#m_plate')     ?.addEventListener('click', ()=> setMode('plate'));

  $('#d_easy')  ?.addEventListener('click', ()=> setDiff('Easy'));
  $('#d_normal')?.addEventListener('click', ()=> setDiff('Normal'));
  $('#d_hard')  ?.addEventListener('click', ()=> setDiff('Hard'));

  $('#langToggle')?.addEventListener('click', ()=>{
    App.lang = (App.lang==='TH')?'EN':'TH';
    setText('#langToggle', App.lang);
    Quests.setLang(App.lang);
  });

  $('#btn_start')?.addEventListener('click', startGame, { capture:true });
}
function reflectMenu(){
  $$('.tile').forEach(t=> t.classList.remove('active'));
  $('#m_'+App.mode)?.classList.add('active');
  setText('#modeName', nameOf(App.mode));

  $$('#d_easy,#d_normal,#d_hard').forEach(c=> c.classList.remove('active'));
  if (App.diff==='Easy')   $('#d_easy')?.classList.add('active');
  if (App.diff==='Normal') $('#d_normal')?.classList.add('active');
  if (App.diff==='Hard')   $('#d_hard')?.classList.add('active');
  setText('#difficulty', App.diff);
}
function setMode(m){ App.mode=m; reflectMenu(); }
function setDiff(d){ App.diff=d; App.secs = (d==='Easy')?50:(d==='Hard'?40:45); reflectMenu(); }
function nameOf(m){
  return m==='goodjunk'?'Good vs Junk': m==='groups'?'5 Food Groups': m==='hydration'?'Hydration': m==='plate'?'Healthy Plate': m;
}

/* ============== Run Loop ============== */
function startGame(){
  if (App.running) endGame(true);

  // reset UI/state
  try { $('#result').style.display='none'; } catch {}
  App.hud.dispose();
  App.hud.setScore(0); App.hud.setTime(App.secs); App.hud.setCombo('x0');

  App.score.reset();
  App.power.dispose?.();
  App.state = { ctx:{}, missions:[], fever01:0 };

  Progress.beginRun(App.mode, App.diff, App.lang);
  Quests.beginRun(App.mode, App.diff, App.lang, App.secs);

  const run = App.missionSys.start(App.mode, { difficulty:App.diff, lang:App.lang, seconds:App.secs, count:3 });
  App.missionSys.attachToState(run, App.state);

  App.timeLeft = App.secs|0;
  clearInterval(App.timers.sec);
  App.timers.sec = setInterval(onTick1s, 1000);

  App.running = true;
  if (App.diff==='Easy') App.power.apply('shield', 5);
}
function onTick1s(){
  if (!App.running) return;
  App.timeLeft = Math.max(0, (App.timeLeft|0) - 1);
  App.hud.setTime(App.timeLeft);

  App.state.fever01 = Math.max(0, App.state.fever01 - 0.06);
  App.hud.setFeverProgress(App.state.fever01);

  App.missionSys.tick(App.state, { score: App.score.get() }, (ev)=>{
    if (ev?.success){ App.hud.toast('✓ Quest!', 900); }
  }, { hud: App.hud, coach:{ onQuestDone(){ App.hud.say('Quest complete!', 800); } }, lang: App.lang });

  Quests.tick({ score: App.score.get() });

  if (App.timeLeft <= 0) endGame(false);
}
function endGame(isAbort=false){
  if (!App.running) return;
  App.running = false;
  clearInterval(App.timers.sec);

  const scoreNow = App.score.get();
  const g = App.score.getGrade();
  const quests = Quests.endRun({ score: scoreNow });

  Progress.endRun({ score: scoreNow, bestCombo: App.score.bestCombo|0, timePlayed:(App.secs|0) });

  // show result
  const txt = `${scoreNow}  ★${g.stars}  [${g.grade}]`;
  const row = $('#resultText'); if (row) row.textContent = txt;
  $('#result')?.setAttribute('style','display:flex');
  App.power.dispose?.();
}

/* ============== Result modal ============== */
function bindResultModal(){
  document.querySelectorAll('#result [data-result]').forEach(btn=>{
    btn.addEventListener('click', (e)=>{
      const act = e.currentTarget.getAttribute('data-result');
      $('#result').style.display='none';
      if (act==='replay'){ startGame(); }
    });
  });
}

/* ============== Pause ============== */
function pauseGame(){ if (!App.running) return; clearInterval(App.timers.sec); VRInput.pause?.(); App.hud.say('Paused', 800); }
function resumeGame(){ if (!App.running) return; if (!document.hidden){ VRInput.resume?.(); clearInterval(App.timers.sec); App.timers.sec=setInterval(onTick1s,1000); App.hud.say('Resumed', 700);} }

/* ============== Public helpers used by mode scripts ============== */
window.HHA = Object.assign(window.HHA||{}, {
  hitGood(meta={})   { App.score.addKind('good', meta); App.missionSys.onEvent('good',{count:1},App.state); },
  hitPerfect(meta={}){ App.score.addKind('perfect', meta); App.state.fever01 = Math.min(1, App.state.fever01 + 0.1);
                        App.missionSys.onEvent('good',{count:1},App.state); },
  hitBad(meta={})    { if (App.power.consumeShield?.()){ App.hud.toast('🛡 Shielded', 900); }
                        else { App.score.addKind('bad', meta); App.hud.flashDanger(); App.missionSys.onEvent('miss',{count:1},App.state); } },
  targetHit(meta={}) { App.score.addKind('good', { ...meta, isTarget:true }); App.missionSys.onEvent('target_hit',{count:1},App.state); },
  groupFull()        { Quests.event('group_full'); },
  targetCycle()      { Quests.event('target_cleared'); },
  feverStart()       { Quests.event('fever',{kind:'start'}); },
  feverEnd()         { Quests.event('fever',{kind:'end'}); },
  platePerfect()     { App.missionSys.onEvent('plate_perfect',{count:1},App.state); },
  plateOver()        { App.missionSys.onEvent('over_quota',{count:1},App.state); },
  hydrationTick(zone){ App.missionSys.onEvent('hydration_zone',{z:String(zone||'')},App.state); Quests.event('hydro_tick',{zone:String(zone||'')}); },
  hydrationCross(f,t){ Quests.event('hydro_cross',{from:String(f||''), to:String(t||'')}); },
  hydrationTreatHigh(){ Quests.event('hydro_click',{zoneBefore:'HIGH', kind:'sweet'}); },

  power(type){ if (['x2','freeze','sweep','magnet','boost','shield'].includes(type)){ App.power.apply(type); App.hud.toast(`Power ${type}`, 800);} }
});

/* keep bindings for ui.js just in case re-assignments */
try { window.HHA.startGame = startGame; window.HHA.endGame = endGame; } catch {}
