// === Hero Health Academy — game/main.js (production) ===
'use strict';

import { HUD }   from './core/hud.js';
import { Coach } from './core/coach.js';

// Dynamic mode loader
const MODE_PATH = function(k){ return './modes/'+k+'.js'; };
async function loadMode(key){
  const mod = await import(MODE_PATH(key));
  return {
    name    : mod.name || key,
    create  : mod.create || null,
    init    : mod.init || null,
    tick    : mod.tick || null,
    update  : mod.update || null,
    start   : mod.start || null,
    cleanup : mod.cleanup || null
  };
}

// ====== Globals / Runtime ======
const TIME_BY_MODE = { goodjunk:45, groups:60, hydration:50, plate:55 };
function getMatchTime(mode, diff){
  var m = mode || 'goodjunk';
  var d = diff || 'Normal';
  var base = TIME_BY_MODE[m]!=null ? TIME_BY_MODE[m] : 45;
  if(d==='Easy') return base+5;
  if(d==='Hard') return Math.max(20, base-5);
  return base;
}

// Quest pool (10 แบบ) — ทำงานแบบ "สุ่มเลือก 3 เควสต์/รอบ" และโฟกัสทีละอัน
const QUEST_POOL = [
  { key:'good_20',      label:'เก็บของดี 20 ชิ้น',           need:20, icon:'🥗', type:'count', path:'good' },
  { key:'perfect_8',    label:'Perfect 8 ครั้ง',              need:8,  icon:'💥', type:'count', path:'perfect' },
  { key:'gold_3',       label:'เก็บ ⭐ 3 อัน',                 need:3,  icon:'⭐', type:'count', path:'gold' },
  { key:'combo_15',     label:'ทำคอมโบถึง 15',               need:15, icon:'🧮', type:'threshold', path:'bestCombo' },
  { key:'fever_1',      label:'เข้า FEVER 1 ครั้ง',           need:1,  icon:'🔥', type:'count', path:'feverEnter' },
  { key:'score_1500',   label:'ทำคะแนนให้ถึง 1500',           need:1500, icon:'🎯', type:'threshold', path:'score' },
  { key:'time_20',      label:'อยู่รอด 20 วินาที',            need:20, icon:'⏱️', type:'threshold', path:'timeAlive' },
  { key:'avoidJunk_10', label:'อย่าคลิก Junk ระหว่างเก็บ 10', need:10, icon:'🚫🍔', type:'avoidJunk', path:'goodUntil' },
  { key:'streak_10',    label:'Good ติดกัน 10 ครั้ง',         need:10, icon:'🔗', type:'streak', path:'goodStreak' },
  { key:'missLow_2',    label:'MISS ได้ไม่เกิน 2 ครั้ง',      need:2,  icon:'🛡️', type:'maxMiss', path:'miss' }
];

function pick3Distinct(pool){
  var a = pool.slice(0);
  for(var i=a.length-1;i>0;i--){ var j=(Math.random()*(i+1))|0; var t=a[i]; a[i]=a[j]; a[j]=t; }
  return a.slice(0,3).map(function(x){ return {key:x.key,label:x.label,need:x.need,icon:x.icon,type:x.type,path:x.path,progress:0,done:false,fail:false,active:false}; });
}

var R = {
  playing:false, paused:false,
  startedAt:0, remain:45, raf:0,
  modeKey:'goodjunk', diff:'Normal', matchTime:45,

  hud:null, coach:null,
  modeAPI:null, modeInst:null, state:null,

  // score/combos
  score:0, combo:0, bestCombo:0,

  // counters
  goods:0, perfects:0, gold:0, junkClicks:0, misses:0,
  timeAlive:0,

  // fever
  fever:false, feverBreaks:0,

  // quests
  quests:[], qActiveIdx:0,

  // audio
  bgmMain:null, bgmFever:null, sfx:{good:null,bad:null,perfect:null,tick:null,power:null}
};

function bindAudios(){
  R.bgmMain = document.getElementById('bgm-main');
  R.bgmFever= document.getElementById('bgm-fever');
  R.sfx.good    = document.getElementById('sfx-good');
  R.sfx.bad     = document.getElementById('sfx-bad');
  R.sfx.perfect = document.getElementById('sfx-perfect');
  R.sfx.tick    = document.getElementById('sfx-tick');
  R.sfx.power   = document.getElementById('sfx-powerup');
}

function play(a){ try{ a && a.currentTime!=null && (a.currentTime=0); a && a.play && a.play().catch(function(){}); }catch(e){} }
function pause(a){ try{ a && a.pause && a.pause(); }catch(e){} }

function hudSetTop(){ if(R.hud){ R.hud.setTop({mode:R.modeKey,diff:R.diff}); R.hud.setTimer(R.remain); R.hud.updateHUD(R.score,R.combo); } }
function hudTickSecond(){
  if(!R.hud) return;
  R.hud.setTimer(R.remain);
  if(R.remain<=10 && R.remain>0){ R.hud.pulseCountdown(R.remain); }
}

function enterFever(){
  if(R.fever) return;
  R.fever=true; R.feverBreaks=0;
  if(R.hud) R.hud.showFever(true);
  play(R.bgmFever);
  if(R.coach && R.coach.onFever) R.coach.onFever();
  // quest event
  questEvent('feverEnter',1);
}
function exitFever(){
  if(!R.fever) return;
  R.fever=false; R.feverBreaks=0;
  if(R.hud) R.hud.showFever(false);
  pause(R.bgmFever);
}

function addScore(n){ R.score += n|0; if(R.hud) R.hud.updateHUD(R.score,R.combo); }
function setCombo(c){
  R.combo = c|0;
  if(R.combo>R.bestCombo) R.bestCombo=R.combo;
  if(R.hud) R.hud.updateHUD(R.score,R.combo);
  if(!R.fever && R.combo>=10) enterFever();
}

function questEvent(kind,val){
  // map kinds to quest paths
  if(kind==='good')        bumpQuest('good',1);
  if(kind==='perfect')     bumpQuest('perfect',1);
  if(kind==='gold')        bumpQuest('gold',1);
  if(kind==='feverEnter')  bumpQuest('feverEnter',1);
  if(kind==='miss')        bumpQuest('miss',1);
  if(kind==='junkClick')   bumpQuest('junkClick',1);
  if(kind==='tickSec')     bumpQuest('timeAlive',1);
  // threshold ones check every event
  checkThresholdQuest('bestCombo', R.bestCombo);
  checkThresholdQuest('score', R.score);
  checkAvoidJunkQuest();       // avoidJunk_10
  checkStreakQuest();          // streak_10
  updateQuestHUD();
}

function bumpQuest(path,inc){
  var q = currentQuest();
  if(!q) return;
  if(q.done || q.fail) return;
  if(q.path===path){
    q.progress += inc|0;
    if(q.type==='count' && q.progress>=q.need){ q.done=true; nextQuest(); }
    if(q.type==='maxMiss' && path==='miss' && R.misses>q.need){ q.fail=true; nextQuest(); }
  }
  // special: avoidJunk handled in checkAvoidJunkQuest
}

function checkThresholdQuest(path,val){
  var q=currentQuest(); if(!q) return;
  if(q.done || q.fail) return;
  if(q.type==='threshold' && q.path===path){
    if(val>=q.need){ q.progress=q.need; q.done=true; nextQuest(); }
  }
  if(q.type==='maxMiss' && q.path==='miss'){
    // already guarded in bumpQuest
    if(R.misses<=q.need){ q.progress = R.misses; } else { q.fail=true; nextQuest(); }
  }
  if(q.type==='count' && q.path==='timeAlive'){
    // handled by tick each second as count
  }
}

function checkAvoidJunkQuest(){
  var q=currentQuest(); if(!q) return;
  if(q.type!=='avoidJunk') return;
  // logic: เก็บ good ครบ N ชิ้นโดยไม่คลิก junk
  // เมื่อเริ่มเควสต์ รีเซ็ตตัวนับเฉพาะเควสต์นี้
  if(q._init!==1){ q._init=1; q._goodGot=0; q._junkClicked=false; }
  // reflect from global counters since last poll
  q._goodGot = R._questGoodDelta!=null ? R._questGoodDelta : q._goodGot;
  if(R._questJunkHit===1) q._junkClicked=true;

  q.progress = q._goodGot;
  if(q._junkClicked){ q.fail=true; nextQuest(); return; }
  if(q._goodGot>=q.need){ q.done=true; nextQuest(); return; }
}
function checkStreakQuest(){
  var q=currentQuest(); if(!q) return;
  if(q.type!=='streak') return;
  // ใช้ R.combo เป็นตัววัดสตรีค
  q.progress = Math.min(q.need, R.combo);
  if(R.combo>=q.need){ q.done=true; nextQuest(); }
}

function currentQuest(){
  if(R.quests.length===0) return null;
  return R.quests[R.qActiveIdx] || null;
}
function updateQuestHUD(){
  if(!R.hud) return;
  var list = [];
  for(var i=0;i<R.quests.length;i++){
    var q=R.quests[i];
    list.push({
      key:q.key,label:q.label,progress:q.progress||0,need:q.need||0,
      done:!!q.done,fail:!!q.fail,icon:q.icon||'⭐',active:(i===R.qActiveIdx)
    });
  }
  R.hud.setQuestChips(list);
}
function nextQuest(){
  // โฟกัสทีละอัน
  var cur=currentQuest();
  if(cur){
    if(R.coach && R.coach.onQuestDone) R.coach.onQuestDone();
  }
  // advance
  for(var i=R.qActiveIdx+1;i<R.quests.length;i++){
    if(!R.quests[i].done && !R.quests[i].fail){ R.qActiveIdx=i; updateQuestHUD(); return; }
  }
  // all finished (done/fail) -> nothing; HUD จะโชว์สถานะรวมท้ายเกม
  updateQuestHUD();
}

// ====== MODE BUS ======
function busFor(){
  return {
    sfx:{
      good: function(){ play(R.sfx.good); },
      bad: function(){ play(R.sfx.bad); },
      perfect: function(){ play(R.sfx.perfect); },
      power: function(){ play(R.sfx.power); }
    },
    hit: function(e){
      var pts = e && e.points ? e.points|0 : 0;
      if(pts>0) addScore(pts);
      // combo up
      setCombo(R.combo+1);
      // counters
      R.goods++;
      if(e && e.kind==='perfect') R.perfects++;
      if(e && e.meta && e.meta.golden) { R.gold++; questEvent('gold',1); }
      questEvent('good',1);
      // reset per-quest deltas
      R._questGoodDelta = (R._questGoodDelta||0)+1;
      if(R.hud && e && e.ui){ R.hud.showFloatingText(e.ui.x,e.ui.y,'+'+pts); }
    },
    miss: function(info){
      // MISS: เฉพาะ good ที่หมดเวลา (จากโหมดส่งมา source:'good-timeout')
      if(info && info.source==='good-timeout'){
        R.misses++;
        R.combo=0; if(R.hud) R.hud.updateHUD(R.score,R.combo);
        questEvent('miss',1);
        // fever break
        if(R.fever){ R.feverBreaks++; if(R.feverBreaks>=1) exitFever(); }
        if(R.coach && R.coach.onBad) R.coach.onBad();
      }
    },
    bad: function(info){
      // คลิก Junk = bad (ไม่เป็น MISS) -> reset combo, นับ junkClicks
      R.junkClicks++; R.combo=0; if(R.hud) R.hud.updateHUD(R.score,R.combo);
      questEvent('junkClick',1);
      // fever break
      if(R.fever){ R.feverBreaks++; if(R.feverBreaks>=1) exitFever(); }
      if(R.coach && R.coach.onBad) R.coach.onBad();
      play(R.sfx.bad);
      // mark per-quest junk hit
      R._questJunkHit = 1;
    },
    power: function(k){
      if(k==='shield'){ /* main ไม่เก็บสถานะเพิ่มเติม */ }
      if(k==='gold'){ /* นับจาก meta.golden ใน hit แล้ว */ }
    }
  };
}

// ====== LOOP ======
function gameTick(){
  if(!R.playing || R.paused) return;
  var tNow = performance.now();

  // per-second
  var secGone = Math.floor((tNow - R._secMark)/1000);
  if(secGone>=1){
    var s;
    for(s=0;s<secGone;s++){
      R.remain = Math.max(0,(R.remain|0)-1);
      R.timeAlive++;
      hudTickSecond();
      questEvent('tickSec',1);
      // play low-time tick
      if(R.remain<=10 && R.remain>0) play(R.sfx.tick);
      // countdown big handled by HUD
    }
    R._secMark = tNow;
  }

  // mode update
  try{
    var dt = (tNow - (R._dtMark||tNow))/1000; R._dtMark=tNow;
    if(R.modeAPI && typeof R.modeAPI.update==='function'){ R.modeAPI.update(dt,busFor()); }
    else if(R.modeInst && typeof R.modeInst.update==='function'){ R.modeInst.update(dt,busFor()); }
    else if(R.modeAPI && typeof R.modeAPI.tick==='function'){ R.modeAPI.tick(R.state||{}, {}, R.hud||{}); }
  }catch(e){ console.warn('[mode.update] error',e); }

  if(R.remain<=0){ endGame(); return; }
  R.raf = requestAnimationFrame(gameTick);
}

function endGame(){
  if(!R.playing) return;
  R.playing=false; cancelAnimationFrame(R.raf);
  exitFever();

  // ดาว 1–5: ตัวอย่างจากคะแนน+เควสต์
  var questDone=0, questFail=0;
  for(var i=0;i<R.quests.length;i++){ if(R.quests[i].done) questDone++; if(R.quests[i].fail) questFail++; }
  var stars=1;
  if(R.score>=2000) stars=2;
  if(R.score>=3000) stars=3;
  if(R.score>=3800 || R.bestCombo>=20) stars=4;
  if((questDone>=2 && R.score>=3800) || (questDone===3 && R.score>=3200)) stars=5;

  if(R.hud){
    var extra = [];
    extra.push('Quests: '+questDone+'/'+R.quests.length+(questFail>0?(' (fail '+questFail+')'):''));
    var qLines=[];
    for(var i=0;i<R.quests.length;i++){
      var q=R.quests[i];
      qLines.push((q.done?'✅':'❌')+' '+q.label+' '+(q.progress||0)+'/'+(q.need||0));
    }
    R.hud.showResult({
      title:'Result',
      desc:'Mode: '+R.modeKey+' • Diff: '+R.diff,
      stars:stars,
      stats:[
        'Score: '+R.score,
        'Best Combo: '+R.bestCombo,
        'Good: '+R.goods,
        'Perfect: '+R.perfects,
        '⭐ Gold: '+R.gold,
        'Junk Clicks: '+R.junkClicks,
        'MISS (good-timeout): '+R.misses,
        'Time: '+R.matchTime+'s'
      ],
      extra:qLines
    });
    R.hud.onHome = function(){ R.hud.hideResult(); const mb=document.getElementById('menuBar'); if(mb){ mb.removeAttribute('data-hidden'); mb.style.display='flex'; } };
    R.hud.onRetry = function(){ R.hud.hideResult(); startGame(); };
    R.hud.setStars(stars);
  }

  // clear per-quest helpers
  R._questGoodDelta=0; R._questJunkHit=0;
  window.HHA._busy=false;
  document.body.removeAttribute('data-playing');
}

// ====== START / PAUSE ======
async function startGame(){
  if(window.HHA && window.HHA._busy) return;
  if(!window.HHA) window.HHA={};
  window.HHA._busy=true;

  bindAudios();

  // read menu selections
  R.modeKey = document.body.getAttribute('data-mode') || 'goodjunk';
  R.diff    = document.body.getAttribute('data-diff') || 'Normal';
  R.matchTime = getMatchTime(R.modeKey, R.diff);
  R.remain    = R.matchTime|0;

  // HUD/Coach
  if(!R.hud) R.hud = new HUD();
  if(R.hud.hideResult) R.hud.hideResult();
  if(R.hud.setTop) R.hud.setTop({mode:R.modeKey,diff:R.diff});
  if(R.hud.updateHUD) R.hud.updateHUD(0,0);
  if(R.hud.setTimer) R.hud.setTimer(R.remain);
  R.hud.setStars(0);

  R.coach = new Coach({ lang:(localStorage.getItem('hha_lang')||'TH') });

  // Load mode
  var api=null;
  try { api = await loadMode(R.modeKey); }
  catch(e){ console.error('[HHA] Failed to load mode:',R.modeKey,e); toast('Failed to load mode: '+R.modeKey); window.HHA._busy=false; return; }
  R.modeAPI = api;

  // init stats
  R.score=0; R.combo=0; R.bestCombo=0;
  R.goods=0; R.perfects=0; R.gold=0; R.junkClicks=0; R.misses=0; R.timeAlive=0;
  R.fever=false; R.feverBreaks=0;
  R._questGoodDelta=0; R._questJunkHit=0;

  // pick quests
  R.quests = pick3Distinct(QUEST_POOL);
  R.qActiveIdx = 0;
  if(R.hud && R.hud.setQuestChips) updateQuestHUD();
  if(R.coach && R.coach.onQuestStart) { var q0=currentQuest(); if(q0) R.coach.onQuestStart(q0.label); }

  // start mode instance
  R.state = { difficulty:R.diff, lang:(localStorage.getItem('hha_lang')||'TH').toUpperCase(), ctx:{} };
  if(api && typeof api.create==='function'){
    R.modeInst = api.create({ hud:R.hud });
    if(R.modeInst && typeof R.modeInst.start==='function'){ R.modeInst.start({ time:R.matchTime, difficulty:R.diff }); }
  } else if(api && typeof api.init==='function'){
    api.init(R.state, R.hud, { time:R.matchTime, life:1600 });
  } else if(api && typeof api.start==='function'){
    api.start({ time:R.matchTime, difficulty:R.diff });
  }

  // 3-2-1-GO
  await countdown321();

  // go
  R.playing=true; R.paused=false;
  R.startedAt=performance.now();
  R._secMark =performance.now();
  R._dtMark  =performance.now();
  hudSetTop();

  // music
  play(R.bgmMain);

  const mb = document.getElementById('menuBar');
  if(mb){ mb.setAttribute('data-hidden','1'); mb.style.display='none'; }
  document.body.setAttribute('data-playing','1');

  requestAnimationFrame(gameTick);
}

function pauseGame(toggle){
  if(!R.playing) return;
  var to = (toggle===undefined)?(!R.paused):!!toggle;
  R.paused = to;
  if(R.paused){
    pause(R.bgmMain); pause(R.bgmFever);
  }else{
    play(R.bgmMain); if(R.fever) play(R.bgmFever);
    R._secMark=performance.now(); R._dtMark=performance.now(); requestAnimationFrame(gameTick);
  }
  if(R.hud) R.hud.toast(R.paused?'⏸️ Pause':'▶️ Resume');
}

function toast(text){
  var el=document.getElementById('toast');
  if(!el){ el=document.createElement('div'); el.id='toast'; el.className='toast'; document.body.appendChild(el); }
  el.textContent=String(text); el.classList.add('show'); setTimeout(function(){ el.classList.remove('show'); },1200);
}

function bindKeys(){
  window.addEventListener('keydown',function(e){
    if(e.key==='p' || e.key==='P' || e.key==='Escape'){ pauseGame(); }
  },{passive:true});
  window.addEventListener('blur',function(){ if(R.playing && !R.paused) pauseGame(true); });
}

function delay(ms){ return new Promise(function(res){ setTimeout(res,ms); }); }
async function countdown321(){
  var seq=[3,2,1,0];
  for(var i=0;i<seq.length;i++){
    var s=seq[i];
    if(R.hud && R.hud.pulseCountdown) R.hud.pulseCountdown(s);
    play(R.sfx.tick);
    await delay(420);
  }
  if(R.coach && R.coach.onStart) R.coach.onStart();
}

// ====== Expose & boot ======
window.HHA = window.HHA || {};
window.HHA.startGame = startGame;
window.HHA.pauseGame = pauseGame;

bindKeys();
setTimeout(function(){ var c=document.getElementById('c'); if(c){ c.style.pointerEvents='none'; c.style.zIndex='1'; } },0);
