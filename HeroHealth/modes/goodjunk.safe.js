// === /HeroHealth/modes/goodjunk.safe.js
// full-wave quest summary + scorePop precise + shield sum + safe listeners
// ใช้ร่วมกับ: vr/mode-factory.js, vr/mission.js, vr/quest-hud.js, vr/particles.js, vr/ui-fever.js

import { boot as factoryBoot } from '../vr/mode-factory.js';
import { MissionDeck } from '../vr/mission.js';
import { questHUDInit, questHUDUpdate, questHUDDispose } from '../vr/quest-hud.js';
import { Particles } from '../vr/particles.js';
import { ensureFeverBar, setFever, setFeverActive, setShield, addShield } from '../vr/ui-fever.js';

export async function boot(cfg){
  cfg = cfg || {};
  var diff = String((cfg && cfg.difficulty) || 'normal');
  var dur  = Number((cfg && cfg.duration!=null) ? cfg.duration : 60);

  // ---------- Pools ----------
  var GOOD = ['🥦','🥕','🍎','🐟','🥛','🍊','🍌','🍇','🥬','🍚','🥜','🍞','🍓','🍍','🥝','🍐'];
  var JUNK = ['🍔','🍟','🍕','🍩','🍪','🧁','🥤','🧋','🍫','🌭','🍰','🍬'];
  var STAR='⭐', DIA='💎', SHIELD='🛡️', FIRE='🔥';
  var BONUS=[STAR,DIA,SHIELD,FIRE];

  // ---------- Goal ----------
  var GOAL_SCORE = (diff==='easy') ? 350 : (diff==='hard' ? 750 : 550);
  function goalObj(score){ return { label:'ทำคะแนนให้ถึงเป้า ('+diff+')', prog:score, target:GOAL_SCORE }; }

  // ---------- Mini quest pool ----------
  var pool = [
    { id:'g_good15',   level:'easy',   label:'เก็บของดี 15 ชิ้น',     check:function(s){return s.goodCount>=15;},  prog:function(s){return Math.min(15,s.goodCount);},  target:15 },
    { id:'g_good25',   level:'normal', label:'เก็บของดี 25 ชิ้น',     check:function(s){return s.goodCount>=25;},  prog:function(s){return Math.min(25,s.goodCount);},  target:25 },
    { id:'g_combo12',  level:'normal', label:'ทำคอมโบ 12',            check:function(s){return s.comboMax>=12;},   prog:function(s){return Math.min(12,s.comboMax);},   target:12 },
    { id:'g_score500', level:'hard',   label:'ทำคะแนนรวม 500+',       check:function(s){return s.score>=500;},     prog:function(s){return Math.min(500,s.score);},     target:500 },
    { id:'g_nomiss10', level:'normal', label:'ไม่พลาด 10 วินาที',     check:function(s){return s.noMissTime>=10;}, prog:function(s){return Math.min(10,s.noMissTime);}, target:10 },
    // JUNK หมดอายุ = “หลีกขยะ”
    { id:'g_avoid5',   level:'easy',   label:'หลีกของขยะ 5 ครั้ง',    check:function(s){return s.junkMiss>=5;},    prog:function(s){return Math.min(5,s.junkMiss);},    target:5 },
    { id:'g_star2',    level:'hard',   label:'เก็บดาว ⭐ 2 ดวง',        check:function(s){return s.star>=2;},        prog:function(s){return Math.min(2,s.star);},        target:2 },
    { id:'g_dia1',     level:'hard',   label:'เก็บเพชร 💎 1 เม็ด',      check:function(s){return s.diamond>=1;},     prog:function(s){return Math.min(1,s.diamond);},     target:1 },
    { id:'g_streak20', level:'hard',   label:'คอมโบสูงสุด 20',         check:function(s){return s.comboMax>=20;},   prog:function(s){return Math.min(20,s.comboMax);},   target:20 },
    { id:'g_fever2',   level:'normal', label:'เข้าโหมด Fever 2 ครั้ง',  check:function(s){return s.feverCount>=2;},  prog:function(s){return Math.min(2,s.feverCount);},  target:2 },
  ];

  // ---------- HUD / Fever ----------
  try{ ensureFeverBar(); setFever(0); setFeverActive(false); setShield(0); }catch(_){}

  // ---------- Mission deck ----------
  var deck = new MissionDeck({ pool: pool });
  if (deck && deck.draw3) deck.draw3();
  var wave=1;
  var questHistory=[];       // เก็บ snapshot ของทุกคลื่นก่อนหน้า

  questHUDInit();

  // ---------- Game state ----------
  var score=0, combo=0, shield=0;
  var fever=0, feverActive=false, feverCount=0;
  var star=0, diamond=0, shieldTotal=0;

  // ให้ deck เห็นค่าสถิติสำคัญ
  function syncDeckStats(){
    deck.stats = deck.stats || {};
    deck.stats.star       = star;
    deck.stats.diamond    = diamond;
    deck.stats.feverCount = feverCount;
    if (deck.updateScore) deck.updateScore(score);
    if (deck.updateCombo) deck.updateCombo(combo);
  }

  function mult(){ return feverActive ? 2 : 1; }
  function gainFever(n){
    fever = Math.max(0, Math.min(100, fever + n));
    try{ setFever(fever); }catch(_){}
    if (!feverActive && fever>=100){
      feverActive=true; try{ setFeverActive(true); }catch(_){}
      feverCount++;
      if (deck.onFeverStart) deck.onFeverStart();
    }
  }
  function decayFever(base){
    var d = feverActive ? 10 : base;
    var was = feverActive;
    fever = Math.max(0, fever - d);
    try{ setFever(fever); }catch(_){}
    if (was && fever<=0){ feverActive=false; try{ setFeverActive(false); }catch(_){ } }
  }

  // ---------- HUD push ----------
  function pushQuestHUD(hint){
    var mini=null;
    var cur = deck.getCurrent ? deck.getCurrent() : null;
    if (cur){
      var prog = deck.getProgress ? deck.getProgress() : [];
      var now=null;
      for (var i=0;i<prog.length;i++){ if (prog[i] && prog[i].id===cur.id){ now=prog[i]; break; } }
      mini = {
        label: cur.label,
        prog : (now && isFinite(now.prog)) ? now.prog : 0,
        target: (now && isFinite(now.target)) ? now.target : ((now && now.done)?1:0)
      };
    }
    var g = goalObj(score);
    try{ window.dispatchEvent(new CustomEvent('hha:quest',{detail:{goal:g, mini:mini}})); }catch(_){}
    questHUDUpdate(deck, hint || ('Wave '+wave));
  }

  // ---------- เก็บเควสต์ของคลื่นปัจจุบันลงประวัติ ----------
  function captureWaveToHistory(){
    var progList = deck.getProgress ? deck.getProgress() : [];
    for (var i=0;i<progList.length;i++){
      var q=progList[i]; if(!q) continue;
      questHistory.push({
        label:q.label, level:q.level, done:!!q.done,
        prog:(typeof q.prog==='number'?q.prog:0),
        target:(typeof q.target==='number'?q.target:0),
        wave: wave
      });
    }
  }

  // ---------- สรุปท้ายเกม ----------
  function onEnd(){
    try{
      // ปลด event listeners โหมดนี้
      try{
        window.removeEventListener('hha:hit-screen', onHitScreen);
        window.removeEventListener('hha:expired',    onExpire);
        window.removeEventListener('hha:time',       onSec);
      }catch(_){}

      // รวมเควสต์: history + คลื่นสุดท้าย
      var current = deck.getProgress ? deck.getProgress() : [];
      var curSummary = [];
      for (var j=0;j<current.length;j++){
        var cq = current[j]; if(!cq) continue;
        curSummary.push({
          label:cq.label, level:cq.level, done:!!cq.done,
          prog:(+cq.prog||0), target:(+cq.target||0), wave: wave
        });
      }
      var questsSummary = questHistory.concat(curSummary);
      var questsCleared = 0;
      for (var k=0;k<questsSummary.length;k++) if (questsSummary[k].done) questsCleared++;
      var questsTotal = questsSummary.length;

      try{ questHUDDispose(); }catch(_){}

      var comboMax = deck && deck.stats ? (deck.stats.comboMax||0) : 0;
      var misses   = deck && deck.stats ? (deck.stats.junkMiss||0) : 0;
      var hits     = deck && deck.stats ? (deck.stats.goodCount||0) : 0;

      // แจ้ง main.js ให้เปิด Result overlay
      try{
        window.dispatchEvent(new CustomEvent('hha:end',{detail:{
          mode:'goodjunk',
          difficulty:diff,
          score:score,
          comboMax:comboMax,
          misses:misses,
          hits:hits,
          duration:dur,
          goalCleared:(score>=GOAL_SCORE),
          goalTarget:GOAL_SCORE,
          questsCleared:questsCleared,
          questsTotal:questsTotal,
          questsSummary:questsSummary,
          // aliases (รองรับโค้ดเดิม)
          miniQuests:questsSummary,
          quests:questsSummary,
          questsDone:questsCleared,
          quests_total:questsTotal,
          shieldTotal:shieldTotal
        }}));
      }catch(_){}
    }catch(_){}
  }

  // ---------- Judge (คลิก/แตะที่เป้า) ----------
  function judge(ch, ctx){
    ctx = ctx || {};
    var cx=(typeof ctx.clientX==='number')?ctx.clientX:(typeof ctx.cx==='number'?ctx.cx:0);
    var cy=(typeof ctx.clientY==='number')?ctx.clientY:(typeof ctx.cy==='number'?ctx.cy:0);
    // ปรับ offset กรณีมี visualViewport (iOS/Android)
    try{ if(window.visualViewport && window.visualViewport.offsetTop){ cy -= window.visualViewport.offsetTop; } }catch(_){}

    function burst(theme){ try{ Particles.burstShards(null,null,{screen:{x:cx,y:cy},theme:theme}); }catch(_){ } }
    function pop(txt,pos){ try{ Particles.scorePop(cx,cy,String(txt),!!pos); }catch(_){ } }

    // Power-ups
    if (ch===STAR){
      var d1 = 40 * mult(); score+=d1; star++; gainFever(10);
      burst('goodjunk'); pop('+'+d1,true); syncDeckStats(); pushQuestHUD(); return {good:true, scoreDelta:d1};
    }
    if (ch===DIA){
      var d2 = 80 * mult(); score+=d2; diamond++; gainFever(30);
      burst('groups'); pop('+'+d2,true); syncDeckStats(); pushQuestHUD(); return {good:true, scoreDelta:d2};
    }
    if (ch===SHIELD){
      shield = Math.min(3, shield+1); try{ setShield(shield); }catch(_){}
      shieldTotal += 1; try{ addShield(1); }catch(_){}
      var d3 = 20; score+=d3; burst('hydration'); pop('+'+d3,true);
      syncDeckStats(); pushQuestHUD(); return {good:true, scoreDelta:d3};
    }
    if (ch===FIRE){
      feverActive = true; try{ setFeverActive(true); }catch(_){}
      fever = Math.max(fever, 60); try{ setFever(fever); }catch(_){}
      var d4 = 25; score+=d4; burst('plate'); pop('+'+d4,true);
      syncDeckStats(); pushQuestHUD(); return {good:true, scoreDelta:d4};
    }

    // ปกติ
    var isGood = (GOOD.indexOf(ch)!==-1);
    if (isGood){
      var base  = 20 + combo*2;
      var delta = base * mult();
      score += delta; combo += 1;
      gainFever(8 + combo*0.6);
      if (deck.onGood) deck.onGood();
      burst('goodjunk'); pop('+'+delta,true);
      syncDeckStats(); pushQuestHUD();
      return {good:true, scoreDelta:delta};
    } else {
      // กันเกราะ 1 ชั้น
      if (shield>0){
        shield = Math.max(0, shield-1); try{ setShield(shield); }catch(_){}
        burst('hydration'); pop('0',false);
        pushQuestHUD();
        return {good:false, scoreDelta:0};
      }
      var dneg = -15;
      score = Math.max(0, score + dneg);
      combo = 0;
      decayFever(18);
      deck.stats = deck.stats || {};
      deck.stats.noMissTime = 0; // โดนขยะ = พลาดจริง
      burst('plate'); pop(String(dneg),false);
      syncDeckStats(); pushQuestHUD();
      return {good:false, scoreDelta:dneg};
    }
  }

  // ---------- Expire ----------
  function onExpire(ev){
    if(!ev) return;
    if (ev.isGood){
      // GOOD หมดอายุ = พลาดจริง
      deck.stats = deck.stats || {};
      deck.stats.noMissTime = 0;
      decayFever(6);
      syncDeckStats(); pushQuestHUD('Wave '+wave);
      return;
    }
    // JUNK หมดอายุ = หลีกได้
    gainFever(4);
    deck.stats = deck.stats || {};
    var prevNo = deck.stats.noMissTime||0;
    var prevJ  = deck.stats.junkMiss||0;
    if (deck.onJunk) deck.onJunk();
    // คงค่า noMissTime และบวก junkMiss เอง (กัน onJunk ไม่เพิ่ม)
    deck.stats.noMissTime = prevNo;
    deck.stats.junkMiss   = (deck.stats.junkMiss||prevJ) + 1;
    syncDeckStats(); pushQuestHUD('Wave '+wave);
  }

  // ---------- Wave refill ----------
  function refillWaveIfCleared(){
    if (deck && deck.isCleared && deck.isCleared()){
      captureWaveToHistory();
      if (deck.draw3) deck.draw3();
      wave += 1;
      pushQuestHUD('Wave '+wave);
    }
  }

  function onHitScreen(){ pushQuestHUD('Wave '+wave); refillWaveIfCleared(); }
  function onSec(){ decayFever(combo<=0?6:2); if(deck.second) deck.second(); syncDeckStats(); pushQuestHUD('Wave '+wave); }

  // ---------- Bind events ----------
  try{
    window.addEventListener('hha:hit-screen', onHitScreen);
    window.addEventListener('hha:expired',    onExpire);
    window.addEventListener('hha:time',       onSec);
  }catch(_){}

  // ---------- Boot via factory ----------
  return factoryBoot({
    difficulty: diff,
    duration  : dur,
    pools     : { good: GOOD.concat(BONUS), bad: JUNK.slice() },
    goodRate  : 0.65,
    powerups  : BONUS,
    powerRate : 0.08,
    powerEvery: 7,
    judge     : function(ch,ctx){ ctx=ctx||{}; return judge(ch,{ cx:(ctx.clientX||ctx.cx), cy:(ctx.clientY||ctx.cy) }); },
    onExpire  : onExpire
  }).then(function(ctrl){
    // จบเวลา → onEnd()
    try{
      window.addEventListener('hha:time', function(e){
        var sec = 0;
        if (e && e.detail && e.detail.sec!=null) sec = e.detail.sec|0;
        if (sec<=0) onEnd();
      });
    }catch(_){}
    return ctrl;
  });
}

export default { boot };
