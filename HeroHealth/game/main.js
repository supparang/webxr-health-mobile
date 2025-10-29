// === Hero Health Academy — game/main.js (namespace FX import; no name collisions) ===
import { HUD }            from './core/hud.js';
import { SFX, sfx }       from './core/sfx.js';
import { ScoreSystem }    from './core/score.js';
import { PowerUpSystem }  from './core/powerup.js';
import { MissionSystem }  from './core/mission-system.js';
import { Quests }         from './core/quests.js';
import { Progress }       from './core/progression.js';
import { Leaderboard }    from './core/leaderboard.js';
import { VRInput }        from './core/vrinput.js';
import * as FX            from './core/fx.js'; // ★ เปลี่ยนเป็น namespace เพื่อตัดปัญหาชื่อซ้ำ

import * as goodjunk      from './modes/goodjunk.js';
import * as groups        from './modes/groups.js';
import * as hydration     from './modes/hydration.js';
import * as plate         from './modes/plate.js';

const $  = (s)=>document.querySelector(s);
const $$ = (s)=>[...document.querySelectorAll(s)];
const setText = (sel, txt)=>{ const el=$(sel); if(el) el.textContent = txt; };

const App = {
  mode: (document.body.getAttribute('data-mode') || 'goodjunk'),
  diff: (document.body.getAttribute('data-diff') || 'Normal'),
  lang: (document.documentElement.getAttribute('data-hha-lang') || 'TH').toUpperCase(),
  secs: 45,

  running:false,
  timeLeft:45,
  timers:{sec:0},

  hud:null, score:null, power:null, missionSys:null, leader:null,

  state:{ ctx:{}, missions:[], fever01:0 },

  engine:{
    score:null,
    sfx: sfx,
    fx: {
      popText(text, {x,y,ms}){
        const el=document.createElement('div');
        el.textContent=text;
        el.style.position='fixed'; el.style.left=`${x}px`; el.style.top=`${y}px`;
        el.style.transform='translate(-50%,-50%)';
        el.style.zIndex=110; el.style.pointerEvents='none';
        el.style.font='900 14px ui-rounded'; el.style.color='#eaf6ff';
        document.body.appendChild(el);
        el.animate(
          [{ opacity:1, transform:'translate(-50%,-50%) scale(1)' },
           { opacity:0, transform:'translate(-50%,-90%) scale(.85)' }],
          { duration: ms||720, easing:'ease-out' }
        ).onfinish = ()=>{ try{ el.remove(); }catch{} };
      },
      // เผย namespace FX ให้โหมดเรียกใช้
      add3DTilt: FX.add3DTilt,
      shatter3D: FX.shatter3D,
    },
    fever: { active:false }
  },

  loop: null,
  lastTs: 0,
  modeRunner: null
};

boot();

function boot(){
  App.hud = new HUD();
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

  App.power = new PowerUpSystem();
  App.power.attachToScore(App.score);
  App.power.onChange(() => {
    const t = App.power.getCombinedTimers ? App.power.getCombinedTimers() : App.power.getTimers?.();
    App.hud.setPowerTimers(t || {});
  });

  App.missionSys = new MissionSystem();
  App.leader = new Leaderboard({ key: 'hha_board_v2', maxKeep: 500, retentionDays: 365 });
  Progress.init();

  Quests.bindToMain({ hud: App.hud });
  Quests.setLang(App.lang);

  VRInput.init({ sfx });
  VRInput.setAimHost($('#gameLayer'));
  VRInput.setDwellMs(900);
  VRInput.setCooldown(350);
  VRInput.setReticleStyle({ size: 30, border:'#eaf6ff', progress:'#42f9da' });

  bindMenu();
  bindResultModal();
  bindHelpModal();
  bindToggles();

  document.addEventListener('pointerdown', onFirstInteract, { once:true, passive:true });
  document.addEventListener('keydown',     onFirstInteract, { once:true, passive:true });

  window.addEventListener('blur', ()=>{ if(App.running) pauseGame(); }, { passive:true });
  document.addEventListener('visibilitychange', ()=> document.hidden ? pauseGame() : resumeGame(), { passive:true });

  reflectMenu();

  // expose app (debug)
  try { window.__HHA_APP__ = App; } catch {}
}

/* ===== Menu / UI ===== */
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

  $$('#d_easy,#d_normal,#d_hard').forEach(c=> c.classList.remove('active'));
  if (App.diff==='Easy')   $('#d_easy')?.classList.add('active');
  if (App.diff==='Normal') $('#d_normal')?.classList.add('active');
  if (App.diff==='Hard')   $('#d_hard')?.classList.add('active');
  setText('#difficulty', App.diff);

  App.secs = (App.diff==='Easy') ? 50 : (App.diff==='Hard' ? 40 : 45);
}

function setMode(m){ App.mode = m; reflectMenu(); }
function setDiff(d){ App.diff = d; reflectMenu(); }
function tileName(m){
  return (m==='goodjunk') ? 'Good vs Junk'
       : (m==='groups')   ? '5 Food Groups'
       : (m==='hydration')? 'Hydration'
       : (m==='plate')    ? 'Healthy Plate' : m;
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
}
function showModal(sel){ const el = document.querySelector(sel); if (el){ el.style.display='flex'; } }
function hideModal(sel){ const el = document.querySelector(sel); if (el){ el.style.display='none'; } }

/* ===== Game Loop ===== */
function startGame(){
  if (App.running) endGame(true);

  $('#result')?.style && ( $('#result').style.display = 'none' );
  App.hud.dispose();
  App.hud.setScore(0);
  App.hud.setTime(App.secs);
  App.hud.toast(App.lang==='TH' ? 'เริ่มเกม!' : 'Let’s go!', 900);

  App.score.reset();
  App.power.dispose();
  App.state = { ctx:{}, missions:[], fever01:0 };

  Progress.beginRun(App.mode, App.diff, App.lang);
  Quests.beginRun(App.mode, App.diff, App.lang, App.secs);

  const run = App.missionSys.start(App.mode, { difficulty:App.diff, lang:App.lang, seconds:App.secs, count:3 });
  App.missionSys.attachToState(run, App.state);

  App.timeLeft = App.secs|0;
  clearInterval(App.timers.sec);
  App.timers.sec = setInterval(onTick1s, 1000);

  // setup runner by mode
  App.modeRunner = makeRunner(App.mode);
  App.running = true;

  // start RAF
  App.lastTs = performance.now();
  if (!App.loop){
    App.loop = (ts)=>{
      const dt = Math.min(0.5, Math.max(0, (ts - App.lastTs)/1000));
      App.lastTs = ts;
      if (App.running && App.modeRunner?.update) App.modeRunner.update(dt, makeBus());
      requestAnimationFrame(App.loop);
    };
  }
  requestAnimationFrame(App.loop);
}

function makeRunner(mode){
  const common = { engine:App.engine, hud:App.hud, coach:{
    onStart(){ App.hud.say(App.lang==='TH'?'สู้ ๆ!':'Let’s go!', 700); },
    onGood(){}, onBad(){}
  }};
  if (mode==='goodjunk')  return goodjunk.create(common);
  if (mode==='groups')    return groups.create(common);
  if (mode==='hydration') return hydration.create(common);
  if (mode==='plate')     return plate.create(common);
  return { start(){}, update(){}, cleanup(){} };
}

function makeBus(){
  return {
    hit({ kind, points, ui, meta }){
      App.score.add(points|0, { kind, ...meta });
    },
    miss(){ App.score.addKind('bad'); }
  };
}

function onTick1s(){
  if (!App.running) return;
  App.timeLeft = Math.max(0, (App.timeLeft|0)-1);
  App.hud.setTime(App.timeLeft);

  App.state.fever01 = Math.max(0, App.state.fever01 - 0.06);
  App.hud.setFeverProgress(App.state.fever01);

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

function endGame(isAbort=false){
  if (!App.running) return;
  App.running = false;
  clearInterval(App.timers.sec);

  const scoreNow = App.score.get();
  const { stars, grade } = App.score.getGrade();
  const quests = Quests.endRun({ score: scoreNow });

  Progress.endRun({ score: scoreNow, bestCombo: App.score.bestCombo|0, timePlayed: (App.secs|0), acc: 0 });

  App.leader.submit(App.mode, App.diff, scoreNow, { name: ($('#playerName')?.value||undefined), meta:{ stars, grade } });

  setText('#finalScore', `${scoreNow}  ★${stars}  [${grade}]`);
  showModal('#result');

  App.power.dispose();
}

function onFirstInteract(){
  try {
    const bgm = $('#bgm-main');
    if (bgm && !bgm.src) {
      // bgm.src = 'assets/audio/bgm_main.mp3';
    }
    sfx.unlock?.();
  } catch {}
}

function pauseGame(){
  if (!App.running) return;
  clearInterval(App.timers.sec);
  App.hud.say(App.lang==='TH'?'พักเกมชั่วคราว':'Paused', 900);
}
function resumeGame(){
  if (!App.running) return;
  if (!document.hidden){
    clearInterval(App.timers.sec);
    App.timers.sec = setInterval(onTick1s, 1000);
    App.hud.say(App.lang==='TH'?'ต่อกันเลย!':'Resumed', 800);
  }
}
