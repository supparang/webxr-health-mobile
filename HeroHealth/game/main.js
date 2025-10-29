// === Hero Health Academy — game/main.js (2025-10-30, quests+result solid) ===
import { HUD }            from './core/hud.js';
import { SFX, sfx }       from './core/sfx.js';
import { ScoreSystem }    from './core/score.js';
import { PowerUpSystem }  from './core/powerup.js';
import { MissionSystem }  from './core/mission-system.js';
import { Quests }         from './core/quests.js';
import { Progress }       from './core/progression.js';
import { Leaderboard }    from './core/leaderboard.js';
import { VRInput }        from './core/vrinput.js';

const $  = (s)=>document.querySelector(s);
const $$ = (s)=>[...document.querySelectorAll(s)];
const setText = (sel, t)=>{ const el=$(sel); if (el) el.textContent = t; };

const App = {
  mode: (document.body.getAttribute('data-mode') || 'goodjunk'),
  diff: (document.body.getAttribute('data-diff') || 'Normal'),
  lang: (document.documentElement.getAttribute('data-hha-lang') || 'TH').toUpperCase(),
  secs: 45,
  running:false, timeLeft:45, timers:{sec:0},

  hud:null, score:null, power:null, missionSys:null, leader:null,
  state:{ ctx:{}, missions:[], fever01:0 }
};

boot();

function boot(){
  // HUD + Systems
  App.hud = new HUD();

  App.score = new ScoreSystem();
  App.score.setHandlers({
    change: (val,{meta})=>{
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
  App.power.onChange(()=> App.hud.setPowerTimers(App.power.getCombinedTimers?.()||{}));

  App.missionSys = new MissionSystem();
  App.leader = new Leaderboard({ key:'hha_board_v2', maxKeep:500, retentionDays:365 });

  Progress.init();

  // Quests HUD binding + ภาษา
  Quests.bindToMain({ hud: App.hud });
  Quests.setLang(App.lang);

  // VR input safe
  VRInput.init({ sfx }); VRInput.setAimHost($('#gameLayer')); VRInput.setDwellMs(900); VRInput.setCooldown(350);

  // UI
  bindMenu(); bindHelpModal(); bindResultModal(); bindToggles();
  reflectMenu();

  // pause/visibility
  window.addEventListener('blur', pauseGame, {passive:true});
  document.addEventListener('visibilitychange', ()=> document.hidden?pauseGame():resumeGame(), {passive:true});

  // unlock sound on first gesture
  document.addEventListener('pointerdown', ()=>sfx.unlock?.(), {once:true,passive:true});
  document.addEventListener('keydown',     ()=>sfx.unlock?.(), {once:true,passive:true});
}

/* ---------------- UI ---------------- */
function bindMenu(){
  $('#m_goodjunk')?.addEventListener('click', ()=> setMode('goodjunk'));
  $('#m_groups')  ?.addEventListener('click', ()=> setMode('groups'));
  $('#m_hydration')?.addEventListener('click',()=> setMode('hydration'));
  $('#m_plate')   ?.addEventListener('click', ()=> setMode('plate'));
  $('#d_easy')    ?.addEventListener('click', ()=> setDiff('Easy'));
  $('#d_normal')  ?.addEventListener('click', ()=> setDiff('Normal'));
  $('#d_hard')    ?.addEventListener('click', ()=> setDiff('Hard'));
  $('#langToggle')?.addEventListener('click', ()=>{ App.lang=(App.lang==='TH'?'EN':'TH'); Quests.setLang(App.lang); setText('#langToggle',App.lang); });
  $('#btn_start') ?.addEventListener('click', startGame);
}

function bindHelpModal(){
  $('#btn_ok')?.addEventListener('click', ()=> hideModal('#help'));
  document.querySelectorAll('[data-modal-open]').forEach(el=>{
    el.addEventListener('click', ()=>{ const sel=el.getAttribute('data-modal-open'); if(sel) showModal(sel); });
  });
}
function bindResultModal(){
  document.querySelectorAll('#result [data-result]').forEach(btn=>{
    btn.addEventListener('click',(e)=>{
      const act=e.currentTarget.getAttribute('data-result');
      hideModal('#result');
      if (act==='replay') startGame();
      else $('#menuBar')?.scrollIntoView({behavior:'smooth'});
    });
  });
}
function bindToggles(){
  $('#soundToggle')?.addEventListener('click', ()=>{ const on=!sfx.isEnabled(); sfx.setEnabled(on); setText('#soundToggle', on?'🔊':'🔇'); });
  $('#gfxToggle')?.addEventListener('click', ()=>{ const v=document.body.getAttribute('data-gfx')==='1'?'0':'1'; document.body.setAttribute('data-gfx',v); });
}
function showModal(sel){ const el=document.querySelector(sel); if(el) el.style.display='flex'; }
function hideModal(sel){ const el=document.querySelector(sel); if(el) el.style.display='none'; }

function reflectMenu(){
  $$('.tile').forEach(t=>t.classList.remove('active'));
  $('#m_'+App.mode)?.classList.add('active');
  setText('#modeName', nameOf(App.mode));
  $$('#d_easy,#d_normal,#d_hard').forEach(c=>c.classList.remove('active'));
  ({Easy:'#d_easy',Normal:'#d_normal',Hard:'#d_hard'}[App.diff]) && $({Easy:'#d_easy',Normal:'#d_normal',Hard:'#d_hard'}[App.diff])?.classList.add('active');
  setText('#difficulty', App.diff);
}
function nameOf(m){ return m==='goodjunk'?'Good vs Junk':m==='groups'?'5 Food Groups':m==='hydration'?'Hydration':m==='plate'?'Healthy Plate':m; }
function setMode(m){ App.mode=m; reflectMenu(); }
function setDiff(d){ App.diff=d; App.secs=(d==='Easy')?50:(d==='Hard'?40:45); reflectMenu(); }

/* --------------- Game Loop --------------- */
function startGame(){
  if (App.running) endGame(true);

  // reset HUD/score/time
  App.hud.dispose();
  App.hud.setScore(0);
  App.hud.setTime(App.secs);
  App.hud.toast(App.lang==='TH'?'เริ่มเกม!':'Let’s go!', 900);

  App.score.reset();
  App.power.dispose();
  App.state = { ctx:{}, missions:[], fever01:0 };

  // begin progression/quests
  Progress.beginRun(App.mode, App.diff, App.lang);
  Quests.beginRun(App.mode, App.diff, App.lang, App.secs);

  // legacy mission system (chipsแยก)
  const run = App.missionSys.start(App.mode, { difficulty:App.diff, lang:App.lang, seconds:App.secs, count:3 });
  App.missionSys.attachToState(run, App.state);

  // timer
  App.timeLeft = App.secs|0;
  clearInterval(App.timers.sec);
  App.timers.sec = setInterval(onTick1s, 1000);

  App.running = true;

  // (Easy) ของขวัญเล็ก
  if (App.diff==='Easy') App.power.apply('shield', 5);
}

function onTick1s(){
  if (!App.running) return;
  App.timeLeft = Math.max(0, (App.timeLeft|0)-1);
  App.hud.setTime(App.timeLeft);

  // decay fever UI (ถ้าใช้)
  App.state.fever01 = Math.max(0, App.state.fever01 - 0.06);
  App.hud.setFeverProgress(App.state.fever01);

  // tick missions & quests
  App.missionSys.tick(App.state, { score: App.score.get() }, null, { hud: App.hud, lang: App.lang });
  Quests.tick({ score: App.score.get() });

  if (App.timeLeft<=0) endGame(false);
}

function endGame(isAbort=false){
  if (!App.running) return;
  App.running = false;
  clearInterval(App.timers.sec);

  const scoreNow = App.score.get();
  const { stars, grade } = App.score.getGrade?.() || {stars:0, grade:'C'};

  // ปิด Quests เพื่อสรุป
  const quests = Quests.endRun({ score: scoreNow });

  Progress.endRun({ score: scoreNow, bestCombo: App.score.bestCombo|0, timePlayed: (App.secs|0), acc: 0 });

  // เพิ่มสรุปและเปิด modal
  const res = document.getElementById('result');
  const p  = document.getElementById('resultText');
  if (p) p.textContent = `Score ${scoreNow}  ★${stars}  [${grade}]  — Quests ✓${quests.filter(q=>q.done).length}/${quests.length}`;
  if (res) res.style.display = 'flex';

  App.power.dispose();
}

/* --------------- Pause / Resume --------------- */
function pauseGame(){ if (!App.running) return; clearInterval(App.timers.sec); App.hud.say(App.lang==='TH'?'พักเกมชั่วคราว':'Paused', 900); }
function resumeGame(){ if (!App.running) return; if (!document.hidden){ clearInterval(App.timers.sec); App.timers.sec=setInterval(onTick1s,1000); App.hud.say(App.lang==='TH'?'ต่อกันเลย!':'Resumed',800);} }

// expose for mode files
try{ window.__HHA_APP__=App; window.HHA={
  hitGood(meta={}){ App.score.addKind('good', meta); Quests.event('hit',{result:'good',comboNow:App.score.combo|0,meta}); App.missionSys.onEvent('good',{count:1},App.state); },
  hitPerfect(meta={}){ App.score.addKind('perfect', meta); App.state.fever01=Math.min(1, App.state.fever01+0.1);
    Quests.event('hit',{result:'perfect',comboNow:App.score.combo|0,meta:{...meta,golden:!!meta.golden}}); App.missionSys.onEvent('good',{count:1},App.state); },
  hitBad(meta={}){ App.score.addKind('bad', meta); App.hud.flashDanger(); App.missionSys.onEvent('miss',{count:1},App.state); },
  targetHit(meta={}){ App.score.addKind('good',{...meta,isTarget:true}); Quests.event('hit',{result:'good',comboNow:App.score.combo|0,meta:{...meta,isTarget:true}}); App.missionSys.onEvent('target_hit',{count:1},App.state); },
  groupFull(){ Quests.event('group_full'); }, targetCycle(){ Quests.event('target_cleared'); },
  feverStart(){ Quests.event('fever',{kind:'start'}); }, feverEnd(){ Quests.event('fever',{kind:'end'}); },
  hydrationTick(zone){ Quests.event('hydro_tick',{zone:String(zone||'')}); }, hydrationCross(f,t){ Quests.event('hydro_cross',{from:String(f||''),to:String(t||'')}); },
  hydrationTreatHighSweet(){ Quests.event('hydro_click',{zoneBefore:'HIGH',kind:'sweet'}); },
  platePerfect(){ App.missionSys.onEvent('plate_perfect',{count:1},App.state); },
  plateOver(){ App.missionSys.onEvent('over_quota',{count:1},App.state); },
  power(type){ /* as needed */ }
}; }catch{}
