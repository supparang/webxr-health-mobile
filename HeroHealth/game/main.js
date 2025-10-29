// === Hero Health Academy — game/main.js (2025-10-29 r3) ===
import { HUD, fx as HUDfx, coach as HUDcoach } from './core/hud.js';
import { sfx }            from './core/sfx.js';
import { ScoreSystem }    from './core/score.js';
import { PowerUpSystem }  from './core/powerup.js';
import { MissionSystem }  from './core/mission-system.js';
import { Quests }         from './core/quests.js';
import { Progress }       from './core/progression.js';
import { Leaderboard }    from './core/leaderboard.js';
import { VRInput }        from './core/vrinput.js';

import * as goodjunk  from './modes/goodjunk.js';
import * as groups    from './modes/groups.js';
import * as hydration from './modes/hydration.js';
import * as plate     from './modes/plate.js';

const $ = (s)=>document.querySelector(s);
const setText = (sel, v)=>{ const el=$(sel); if (el) el.textContent = v; };

const MODS = { goodjunk, groups, hydration, plate };

const App = {
  mode:(document.body.getAttribute('data-mode')||'goodjunk'),
  diff:(document.body.getAttribute('data-diff')||'Normal'),
  lang:(document.documentElement.getAttribute('data-hha-lang')||'TH').toUpperCase(),
  secs:45,

  running:false, timeLeft:45, secTimer:0, raf:0, lastT:0,

  hud:null, score:null, power:null, mission:null, leader:null, currentMode:null
};

boot();

function boot(){
  App.hud   = new HUD();
  App.score = new ScoreSystem();
  App.power = new PowerUpSystem();
  App.mission = new MissionSystem();
  App.leader  = new Leaderboard({ key:'hha_board_v2', maxKeep:500, retentionDays:365 });

  App.power.attachToScore(App.score);
  App.power.onChange(()=> App.hud.setPowerTimers(App.power.getCombinedTimers?.()||{}));

  Progress.init();
  Quests.bindToMain({ hud: App.hud });
  Quests.setLang(App.lang);

  App.score.setHandlers({
    change:(val,{meta})=>{
      App.hud.setScore(val|0);
      App.hud.setCombo('x'+(App.score.combo|0));
      if (meta?.kind){
        Quests.event('hit', {
          result: meta.kind,
          comboNow: App.score.combo|0,
          meta: { good: meta.kind==='good'||meta.kind==='perfect',
                  golden: !!meta.golden, isTarget: !!meta.isTarget, groupId: meta.groupId }
        });
      }
    }
  });

  VRInput.init({ sfx }); VRInput.setAimHost($('#gameLayer')); VRInput.setDwellMs(900);

  bindMenu();
  bindModals();
  reflectMenu();

  // เผื่อหน้าอื่นเรียก
  try {
    window.HHA = window.HHA || {};
    window.HHA.startGame = ()=> startGame();
  } catch {}
}

/* ---------- UI ---------- */
function bindMenu(){
  $('#m_goodjunk') ?.addEventListener('click', ()=> setMode('goodjunk'));
  $('#m_groups')   ?.addEventListener('click', ()=> setMode('groups'));
  $('#m_hydration')?.addEventListener('click', ()=> setMode('hydration'));
  $('#m_plate')    ?.addEventListener('click', ()=> setMode('plate'));
  $('#d_easy')  ?.addEventListener('click', ()=> setDiff('Easy'));
  $('#d_normal')?.addEventListener('click', ()=> setDiff('Normal'));
  $('#d_hard')  ?.addEventListener('click', ()=> setDiff('Hard'));
  $('#langToggle')?.addEventListener('click', ()=>{
    App.lang = (App.lang==='TH'?'EN':'TH'); setText('#langToggle', App.lang); Quests.setLang(App.lang);
  });
  $('#soundToggle')?.addEventListener('click', ()=>{
    const on = !sfx.isEnabled(); sfx.setEnabled(on); setText('#soundToggle', on?'🔊':'🔇');
  });
  $('#btn_start')?.addEventListener('click', startGame, { capture:true });
}
function bindModals(){
  $('#btn_ok')?.addEventListener('click', ()=> hide('#help'));
  $('#result')?.addEventListener('click', (e)=>{
    const act = e.target?.getAttribute?.('data-result');
    if (!act) return; hide('#result'); if (act==='replay'){ startGame(); }
  });
  $('#btn_open_board')?.addEventListener('click', ()=> show('#boardModal'));
  $('#lb_close')?.addEventListener('click', ()=> hide('#boardModal'));
}
function show(sel){ const el=document.querySelector(sel); if (el) el.style.display='flex'; }
function hide(sel){ const el=document.querySelector(sel); if (el) el.style.display='none'; }

function reflectMenu(){
  const map = {goodjunk:'Good vs Junk',groups:'5 Food Groups',hydration:'Hydration',plate:'Healthy Plate'};
  document.querySelectorAll('.tile').forEach(t=>t.classList.remove('active'));
  document.getElementById('m_'+App.mode)?.classList.add('active');
  setText('#modeName', map[App.mode]||App.mode);

  ['#d_easy','#d_normal','#d_hard'].forEach(id=>document.querySelector(id)?.classList.remove('active'));
  ({Easy:'#d_easy',Normal:'#d_normal',Hard:'#d_hard'}[App.diff] && document.querySelector({Easy:'#d_easy',Normal:'#d_normal',Hard:'#d_hard'}[App.diff])?.classList.add('active'));
  setText('#difficulty', App.diff);
}
function setMode(m){ App.mode=m; reflectMenu(); }
function setDiff(d){ App.diff=d; App.secs = (d==='Easy')?50:(d==='Hard'?40:45); reflectMenu(); }

/* ---------- Game Flow ---------- */
function startGame(){
  // เคลียร์ก่อน
  stopLoop();
  try{ App.currentMode?.cleanup?.(); }catch{}

  // บังคับให้ HUD/เมนูที่จำเป็น “มองเห็นได้” (กันถูก CSS อื่นซ่อน)
  try{
    const hudWrap = document.getElementById('hudWrap');
    if (hudWrap){ hudWrap.style.pointerEvents='none'; hudWrap.style.display='block'; }
    const result = document.getElementById('result');
    if (result){ result.style.display='none'; }
  }catch{}

  // รีเซ็ต UI
  App.hud.dispose();
  App.hud.setScore(0);
  App.hud.setTime(App.secs);
  App.hud.toast(App.lang==='TH'?'เริ่มเกม!':'Let’s go!', 850);

  // รีเซ็ตระบบ
  App.score.reset();
  App.power.dispose();
  Progress.beginRun(App.mode, App.diff, App.lang);
  Quests.beginRun(App.mode, App.diff, App.lang, App.secs);
  App.hud.setQuestChips(['Mission A','Mission B','Mission C']); // กันจอว่าง ถ้า MissionSystem ยังไม่ยิง

  // ให้โหมดเข้าถึงค่าพื้นฐาน
  window.__HHA_DIFF = App.diff; window.__HHA_TIME = App.secs;

  // สร้างอินสแตนซ์โหมด
  const mod = MODS[App.mode];
  App.currentMode = mod?.create?.({ engine:{ score:App.score, sfx, fx:HUDfx }, hud:App.hud, coach:HUDcoach }) || null;
  App.currentMode?.start?.();

  // ตั้งเวลา
  App.timeLeft = App.secs|0;
  clearInterval(App.secTimer);
  App.secTimer = setInterval(onTick1s, 1000);

  // เริ่ม loop
  App.running = true;
  App.lastT = performance.now();
  App.raf = requestAnimationFrame(loop);
}

function loop(ts){
  if (!App.running) return;
  const dt = Math.max(0, (ts - App.lastT)/1000); App.lastT = ts;

  // Bus: ให้โหมดส่งผลกลับระบบ
  const Bus = {
    hit: ({ kind='good', points=10, ui={}, meta={} }={})=>{
      App.score.addKind(kind, meta);
      // (optional) ปล่อยเอฟเฟกต์ข้อความ
      if (ui?.x!=null && ui?.y!=null) HUDfx.popText(`+${points}`, { x:ui.x, y:ui.y, ms:720 });
      App.mission.onEvent('good',{count:1},{});
    },
    miss: ({ meta={} }={})=>{
      App.score.addKind('bad', meta);
      App.mission.onEvent('miss',{count:1},{});
      App.hud.flashDanger();
    }
  };

  try{ App.currentMode?.update?.(dt, Bus); }catch{}
  App.raf = requestAnimationFrame(loop);
}

function onTick1s(){
  if (!App.running) return;
  App.timeLeft = Math.max(0, (App.timeLeft|0)-1);
  App.hud.setTime(App.timeLeft);

  // ให้ Quests เดิน
  Quests.tick({ score: App.score.get() });

  // Mission mini-quests (ถ้ามี)
  App.mission.tick({}, { score: App.score.get() }, (ev)=>{
    if (ev?.success) App.hud.toast(App.lang==='TH'?'✓ ภารกิจสำเร็จ':'✓ Quest!', 900);
  }, { hud: App.hud, coach: { onQuestDone(){}, onQuestFail(){}, onQuestProgress(){} }, lang: App.lang });

  if (App.timeLeft <= 0) endGame();
}

function endGame(){
  if (!App.running) return;
  App.running = false;
  clearInterval(App.secTimer);
  stopLoop();

  const score = App.score.get();
  const { stars, grade } = App.score.getGrade();
  Quests.endRun({ score });
  Progress.endRun({ score, bestCombo: App.score.bestCombo|0, timePlayed:(App.secs|0), acc:0 });

  App.leader.submit(App.mode, App.diff, score, {
    name: ($('#playerName')?.value||'').trim()||undefined, meta:{ stars, grade }
  });

  // Result
  setText('#resultText', `Score ${score}  ★${stars}  [${grade}]`);
  const res = document.getElementById('result');
  if (res){ res.style.display='flex'; res.focus?.(); }
  App.power.dispose();
  try{ App.currentMode?.cleanup?.(); }catch{}
}

function stopLoop(){ cancelAnimationFrame(App.raf); App.raf = 0; }

/* debug */
try{ window.__HHA_APP__ = App; }catch{}
