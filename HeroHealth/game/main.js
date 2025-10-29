// === Hero Health Academy — game/main.js (2025-10-29 r3: HUD+Quests+Timer wired) ===
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
const setText=(sel,txt)=>{ const el=$(sel); if(el) el.textContent=txt; };

const App = {
  mode: (document.body.getAttribute('data-mode') || 'goodjunk'),
  diff: (document.body.getAttribute('data-diff') || 'Normal'),
  lang: (document.documentElement.getAttribute('data-hha-lang') || 'TH').toUpperCase(),
  secs: 45,

  running:false,
  timeLeft:45,
  timers:{ sec:0 },

  hud:null, score:null, power:null, missions:null, leader:null,
  state:{ ctx:{}, fever01:0 }
};

boot();

function boot(){
  // Systems
  App.hud   = new HUD();
  App.score = new ScoreSystem();
  App.power = new PowerUpSystem();
  App.missions = new MissionSystem();
  App.leader   = new Leaderboard({ key:'hha_board_v2', maxKeep:500 });

  // Score → HUD + Quests feed
  App.score.setHandlers({
    change:(val,{delta,meta})=>{
      App.hud.setScore(val|0);
      App.hud.setCombo?.(`x${App.score.combo|0}`);
      if (meta?.kind){
        Quests.event('hit', {
          result: meta.kind,
          comboNow: App.score.combo|0,
          meta
        });
      }
    }
  });

  // Power to HUD (if available)
  App.power.onChange?.(()=> {
    const t = App.power.getCombinedTimers ? App.power.getCombinedTimers() : App.power.getTimers?.();
    App.hud.setPowerTimers?.(t || {});
  });

  // Bind Quests → HUD
  Quests.bindToMain({ hud: App.hud });
  Quests.setLang(App.lang);

  // VR cursor basic
  VRInput.init?.({ sfx });
  VRInput.setAimHost?.($('#gameLayer'));
  VRInput.setDwellMs?.(900);
  VRInput.setCooldown?.(350);

  // UI
  bindMenu();
  bindHelpAndResult();
  reflectMenu();

  // First-gesture audio unlock
  document.addEventListener('pointerdown', unlockOnce, { once:true, passive:true });
  document.addEventListener('keydown',     unlockOnce, { once:true, passive:true });

  // Pause on blur
  window.addEventListener('blur', pauseGame, { passive:true });
  document.addEventListener('visibilitychange', ()=> document.hidden?pauseGame():resumeGame(), { passive:true });

  // Debug handle
  try{ window.__HHA_APP__=App; }catch{}
}

function bindMenu(){
  $('#m_goodjunk')  ?.addEventListener('click',()=> setMode('goodjunk'));
  $('#m_groups')    ?.addEventListener('click',()=> setMode('groups'));
  $('#m_hydration') ?.addEventListener('click',()=> setMode('hydration'));
  $('#m_plate')     ?.addEventListener('click',()=> setMode('plate'));

  $('#d_easy')  ?.addEventListener('click',()=> setDiff('Easy'));
  $('#d_normal')?.addEventListener('click',()=> setDiff('Normal'));
  $('#d_hard')  ?.addEventListener('click',()=> setDiff('Hard'));

  $('#langToggle')?.addEventListener('click',()=>{
    App.lang = (App.lang==='TH')?'EN':'TH';
    setText('#langToggle', App.lang);
    Quests.setLang(App.lang);
  });

  $('#btn_start')?.addEventListener('click', startGame, { capture:true });
  $('#soundToggle')?.addEventListener('click', ()=>{
    const on=!sfx.isEnabled(); sfx.setEnabled(on);
    setText('#soundToggle', on?'🔊':'🔇');
  });
  $('#gfxToggle')?.addEventListener('click', ()=>{
    const v=document.body.getAttribute('data-gfx')==='1'?'0':'1';
    document.body.setAttribute('data-gfx', v);
  });
}

function reflectMenu(){
  $$('.tile').forEach(t=>t.classList.remove('active'));
  $('#m_'+App.mode)?.classList.add('active');
  setText('#modeName', nameOf(App.mode));

  $$('#d_easy,#d_normal,#d_hard').forEach(c=>c.classList.remove('active'));
  (App.diff==='Easy'  ) && $('#d_easy')  ?.classList.add('active');
  (App.diff==='Normal') && $('#d_normal')?.classList.add('active');
  (App.diff==='Hard'  ) && $('#d_hard')  ?.classList.add('active');
  setText('#difficulty', App.diff);
}

function setMode(m){ App.mode=m; reflectMenu(); }
function setDiff(d){
  App.diff=d;
  App.secs = d==='Easy'?50 : d==='Hard'?40 : 45;
  reflectMenu();
}
function nameOf(m){ return m==='goodjunk'?'Good vs Junk':m==='groups'?'5 Food Groups':m==='hydration'?'Hydration':m==='plate'?'Healthy Plate':m; }

function bindHelpAndResult(){
  $('#btn_ok')?.addEventListener('click', ()=> hide('#help'));
  $('#btn_open_board')?.addEventListener('click', ()=> show('#boardModal'));
  $('#lb_close')?.addEventListener('click', ()=> hide('#boardModal'));

  document.querySelectorAll('#result [data-result]').forEach(btn=>{
    btn.addEventListener('click',(e)=>{
      const act=e.currentTarget.getAttribute('data-result');
      hide('#result');
      if (act==='replay') startGame(); else $('#menuBar')?.scrollIntoView({behavior:'smooth'});
    });
  });
}

function show(sel){ const el=$(sel); if(el) el.style.display='flex'; }
function hide(sel){ const el=$(sel); if(el) el.style.display='none'; }

/* ---------- Start / Tick / End ---------- */
function startGame(){
  if (App.running) endGame(true);
  App.running = true;

  // Reset HUD
  App.hud.dispose();
  App.hud.setScore(0);
  App.hud.setTime(App.secs);
  App.hud.toast(App.lang==='TH'?'เริ่มเกม!':'Let’s go!', 900);

  // Reset systems
  App.score.reset();
  App.power.dispose?.();
  App.state = { ctx:{}, fever01:0 };

  // Progress + Quests
  Progress.init?.();
  Progress.beginRun?.(App.mode, App.diff, App.lang);
  Quests.beginRun(App.mode, App.diff, App.lang, App.secs);

  // Missions (legacy line HUD ถ้า core รองรับ)
  const run = App.missions.start?.(App.mode, { difficulty:App.diff, lang:App.lang, seconds:App.secs, count:3 });
  App.missions.attachToState?.(run, App.state);

  // Timer 1s
  clearInterval(App.timers.sec);
  App.timeLeft = App.secs|0;
  App.timers.sec = setInterval(onTick1s, 1000);

  // Easy bonus
  if (App.diff==='Easy') App.power.apply?.('shield', 5);
}

function onTick1s(){
  if (!App.running) return;
  App.timeLeft = Math.max(0, (App.timeLeft|0)-1);
  App.hud.setTime(App.timeLeft);

  // FEVER (ui decay)
  App.state.fever01 = Math.max(0, App.state.fever01 - 0.06);
  App.hud.setFeverProgress?.(App.state.fever01);

  // Quests tick with score context
  Quests.tick({ score: App.score.get() });

  // Missions per-sec evaluation (ถ้ามี)
  App.missions.tick?.(App.state, { score:App.score.get() }, (ev)=>{
    if (ev?.success) App.hud.toast(App.lang==='TH'?'✓ ภารกิจ!':'✓ Quest!', 900);
  }, { hud:App.hud, lang:App.lang });

  if (App.timeLeft<=0) endGame(false);
}

function endGame(isAbort=false){
  if (!App.running) return;
  App.running=false;
  clearInterval(App.timers.sec);

  const scoreNow = App.score.get();
  const { stars, grade } = App.score.getGrade?.() || { stars:0, grade:'C' };

  // Close out quests
  const quests = Quests.endRun({ score: scoreNow });

  // Progress & board
  Progress.endRun?.({ score:scoreNow, bestCombo:App.score.bestCombo|0, timePlayed:(App.secs|0), acc:0 });
  App.leader.submit?.(App.mode, App.diff, scoreNow, { meta:{ stars, grade } });

  // Result UI
  const res = $('#resultText');
  if (res) res.textContent = (App.lang==='TH')
    ? `คะแนน: ${scoreNow}  ★${stars}  [${grade}]`
    : `Score: ${scoreNow}  ★${stars}  [${grade}]`;

  const pb = $('#pbRow');
  if (pb) pb.textContent = (App.lang==='TH') ? 'บันทึกผลเสร็จแล้ว' : 'Saved your result';

  // mini leaderboard (optional)
  const mt = $('#miniTop'); if (mt) mt.innerHTML = '';
  show('#result');

  App.power.dispose?.();
}

/* ---------- Public hooks consumed by modes ---------- */
window.HHA = {
  hitGood(meta={}){ App.score.addKind('good', meta); Quests.event('hit',{ result:'good', comboNow:App.score.combo|0, meta }); App.missions.onEvent?.('good',{count:1},App.state); },
  hitPerfect(meta={}){ App.score.addKind('perfect', meta); App.state.fever01=Math.min(1, App.state.fever01+0.1); Quests.event('hit',{ result:'perfect', comboNow:App.score.combo|0, meta:{...meta, golden:!!meta.golden} }); App.missions.onEvent?.('good',{count:1},App.state); },
  hitBad(meta={}){ if(App.power.consumeShield?.()){ App.hud.toast(App.lang==='TH'?'🛡 กันพลาด':'🛡 Shielded',900); } else { App.score.addKind('bad', meta); App.hud.flashDanger(); App.missions.onEvent?.('miss',{count:1},App.state); } },
  targetHit(meta={}){ App.score.addKind('good', { ...meta, isTarget:true }); App.missions.onEvent?.('target_hit',{count:1},App.state); Quests.event('hit',{ result:'good', comboNow:App.score.combo|0, meta:{...meta, isTarget:true} }); },
  wrongGroup(){ App.missions.onEvent?.('wrong_group',{count:1},App.state); },
  feverStart(){ Quests.event('fever',{kind:'start'}); },
  feverEnd(){ Quests.event('fever',{kind:'end'}); },
  platePerfect(){ App.missions.onEvent?.('plate_perfect',{count:1},App.state); },
  plateOver(){ App.missions.onEvent?.('over_quota',{count:1},App.state); },
  hydrationTick(zone){ App.missions.onEvent?.('hydration_zone',{z:String(zone||'')},App.state); Quests.event('hydro_tick',{ zone:String(zone||'') }); },
  hydrationCross(from,to){ Quests.event('hydro_cross',{from:String(from||''), to:String(to||'')}); },
  hydrationTreatHighSweet(){ Quests.event('hydro_click',{zoneBefore:'HIGH', kind:'sweet'}); },
  groupFull(){ Quests.event('group_full'); },
  targetCycle(){ Quests.event('target_cleared'); },
  power(type){ if (['x2','freeze','sweep','magnet','boost','shield'].includes(type)){ App.power.apply?.(type); sfx.power?.(); App.hud.toast(App.lang==='TH'?`พลัง ${type}`:`Power ${type}`, 850); } }
};

function unlockOnce(){ try{ sfx.unlock?.(); $('#bgm-main')?.play?.().catch(()=>{}); }catch{} }

function pauseGame(){
  if (!App.running) return;
  clearInterval(App.timers.sec);
  App.hud.say(App.lang==='TH'?'พักเกมชั่วคราว':'Paused', 900);
}
function resumeGame(){
  if (!App.running || document.hidden) return;
  clearInterval(App.timers.sec);
  App.timers.sec = setInterval(onTick1s, 1000);
  App.hud.say(App.lang==='TH'?'ต่อกันเลย!':'Resumed', 800);
}
