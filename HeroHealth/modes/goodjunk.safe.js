// === /HeroHealth/modes/goodjunk.safe.js (LATEST: Goals 10→5 + MiniQuest refill + scorePop precise) ===
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

  // ---------- Mini Quest: 10 ใบ (สุ่ม 3) ----------
  var miniPool10 = [
    { id:'g_good15',   level:'easy',   label:'เก็บของดี 15 ชิ้น',     check:function(s){return s.goodCount>=15;},  prog:function(s){return Math.min(15,s.goodCount);},  target:15 },
    { id:'g_good25',   level:'normal', label:'เก็บของดี 25 ชิ้น',     check:function(s){return s.goodCount>=25;},  prog:function(s){return Math.min(25,s.goodCount);},  target:25 },
    { id:'g_combo12',  level:'normal', label:'ทำคอมโบ 12',            check:function(s){return s.comboMax>=12;},   prog:function(s){return Math.min(12,s.comboMax);},   target:12 },
    { id:'g_score500', level:'hard',   label:'ทำคะแนนรวม 500+',       check:function(s){return s.score>=500;},     prog:function(s){return Math.min(500,s.score);},     target:500 },
    { id:'g_nomiss10', level:'normal', label:'ไม่พลาด 10 วินาที',     check:function(s){return s.noMissTime>=10;}, prog:function(s){return Math.min(10,s.noMissTime);}, target:10 },
    { id:'g_avoid5',   level:'easy',   label:'หลีกของขยะ 5 ครั้ง',    check:function(s){return s.junkMiss>=5;},    prog:function(s){return Math.min(5,s.junkMiss);},    target:5 },
    { id:'g_star2',    level:'hard',   label:'เก็บดาว ⭐ 2 ดวง',        check:function(s){return s.star>=2;},        prog:function(s){return Math.min(2,s.star);},        target:2 },
    { id:'g_dia1',     level:'hard',   label:'เก็บเพชร 💎 1 เม็ด',      check:function(s){return s.diamond>=1;},     prog:function(s){return Math.min(1,s.diamond);},     target:1 },
    { id:'g_streak20', level:'hard',   label:'คอมโบสูงสุด 20',         check:function(s){return s.comboMax>=20;},   prog:function(s){return Math.min(20,s.comboMax);},   target:20 },
    { id:'g_fever2',   level:'normal', label:'เข้าโหมด Fever 2 ครั้ง',  check:function(s){return s.feverCount>=2;},  prog:function(s){return Math.min(2,s.feverCount);},  target:2 },
  ];

  // ---------- Goals (หลัก): 10 ต่อระดับ → สุ่มใช้ 5 ----------
  function goalsPoolByDiff(level){
    if (level==='easy') return [
      { id:'E1', label:'เก็บของดี ≥ 15',      target:15, check:function(s){return s.goodCount>=15;},  prog:function(s){return Math.min(15,s.goodCount);} },
      { id:'E2', label:'หลีกของขยะ ≥ 5',      target:5,  check:function(s){return s.junkMiss>=5;},    prog:function(s){return Math.min(5,s.junkMiss);} },
      { id:'E3', label:'ทำคะแนนรวม ≥ 350',    target:350,check:function(s){return s.score>=350;},     prog:function(s){return Math.min(350,s.score);} },
      { id:'E4', label:'คอมโบสูงสุด ≥ 8',     target:8,  check:function(s){return s.comboMax>=8;},   prog:function(s){return Math.min(8,s.comboMax);} },
      { id:'E5', label:'เก็บดาว ⭐ ≥ 1',       target:1,  check:function(s){return s.star>=1;},        prog:function(s){return Math.min(1,s.star);} },
      { id:'E6', label:'ไม่พลาด ≥ 8 วินาที',   target:8,  check:function(s){return s.noMissTime>=8;}, prog:function(s){return Math.min(8,s.noMissTime);} },
      { id:'E7', label:'เข้า Fever ≥ 1 ครั้ง', target:1,  check:function(s){return s.feverCount>=1;}, prog:function(s){return Math.min(1,s.feverCount);} },
      { id:'E8', label:'ทำคะแนน 200 ใน 25s',  target:200,check:function(s){return s.score25>=200;},   prog:function(s){return Math.min(200,s.score25||0);} },
      { id:'E9', label:'ทำสกอร์คอมโบรวด 120', target:120,check:function(s){return s.comboSum>=120;}, prog:function(s){return Math.min(120,s.comboSum||0);} },
      { id:'E10',label:'เก็บของดีครบ 5 หมู่', target:5,  check:function(s){return s.groupKinds>=5;}, prog:function(s){return Math.min(5,s.groupKinds||0);} },
    ];
    if (level==='hard') return [
      { id:'H1', label:'ทำคะแนนรวม ≥ 750',    target:750,check:function(s){return s.score>=750;},     prog:function(s){return Math.min(750,s.score);} },
      { id:'H2', label:'คอมโบสูงสุด ≥ 20',    target:20, check:function(s){return s.comboMax>=20;},   prog:function(s){return Math.min(20,s.comboMax);} },
      { id:'H3', label:'ไม่พลาด ≥ 20 วินาที',  target:20, check:function(s){return s.noMissTime>=20;},prog:function(s){return Math.min(20,s.noMissTime);} },
      { id:'H4', label:'เก็บของดี ≥ 40',       target:40, check:function(s){return s.goodCount>=40;}, prog:function(s){return Math.min(40,s.goodCount);} },
      { id:'H5', label:'หลีกของขยะ ≥ 15',     target:15, check:function(s){return s.junkMiss>=15;},   prog:function(s){return Math.min(15,s.junkMiss);} },
      { id:'H6', label:'เก็บดาว ⭐ ≥ 3',       target:3,  check:function(s){return s.star>=3;},        prog:function(s){return Math.min(3,s.star);} },
      { id:'H7', label:'เก็บเพชร 💎 ≥ 2',       target:2,  check:function(s){return s.diamond>=2;},     prog:function(s){return Math.min(2,s.diamond);} },
      { id:'H8', label:'เข้า Fever ≥ 3',       target:3,  check:function(s){return s.feverCount>=3;},  prog:function(s){return Math.min(3,s.feverCount);} },
      { id:'H9', label:'เฉลี่ย ≥10 คะแนน/วินาที', target:10,check:function(s){return s.avgPerSec>=10;}, prog:function(s){return Math.min(10,s.avgPerSec||0);} },
      { id:'H10',label:'ทำ 600 ภายใน 40s',    target:600,check:function(s){return s.score40>=600;},   prog:function(s){return Math.min(600,s.score40||0);} },
    ];
    // normal
    return [
      { id:'N1', label:'ทำคะแนนรวม ≥ 550',    target:550,check:function(s){return s.score>=550;},     prog:function(s){return Math.min(550,s.score);} },
      { id:'N2', label:'คอมโบสูงสุด ≥ 12',    target:12, check:function(s){return s.comboMax>=12;},   prog:function(s){return Math.min(12,s.comboMax);} },
      { id:'N3', label:'เก็บของดี ≥ 25',       target:25, check:function(s){return s.goodCount>=25;}, prog:function(s){return Math.min(25,s.goodCount);} },
      { id:'N4', label:'เก็บดาว ⭐ ≥ 2',       target:2,  check:function(s){return s.star>=2;},        prog:function(s){return Math.min(2,s.star);} },
      { id:'N5', label:'หลีกของขยะ ≥ 10',     target:10, check:function(s){return s.junkMiss>=10;},   prog:function(s){return Math.min(10,s.junkMiss);} },
      { id:'N6', label:'ไม่พลาด ≥ 12 วินาที',  target:12, check:function(s){return s.noMissTime>=12;},prog:function(s){return Math.min(12,s.noMissTime);} },
      { id:'N7', label:'เข้า Fever ≥ 2',       target:2,  check:function(s){return s.feverCount>=2;},  prog:function(s){return Math.min(2,s.feverCount);} },
      { id:'N8', label:'เฉลี่ย ≥ 8 คะแนน/วินาที', target:8, check:function(s){return s.avgPerSec>=8;},  prog:function(s){return Math.min(8,s.avgPerSec||0);} },
      { id:'N9', label:'เก็บเพชร 💎 ≥ 1',       target:1,  check:function(s){return s.diamond>=1;},     prog:function(s){return Math.min(1,s.diamond);} },
      { id:'N10',label:'ทำ 300 ภายใน 30s',    target:300,check:function(s){return s.score30>=300;},   prog:function(s){return Math.min(300,s.score30||0);} },
    ];
  }

  function shuffle(arr){
    for (var i=arr.length-1;i>0;i--){
      var j=(Math.random()*(i+1))|0; var t=arr[i]; arr[i]=arr[j]; arr[j]=t;
    }
    return arr;
  }

  function pickGoals(level){
    var pool = goalsPoolByDiff(level).slice();
    shuffle(pool);
    // enrich runtime fields
    for (var i=0;i<pool.length;i++){ pool[i]._done=false; pool[i]._prog=0; }
    return pool.slice(0,5);
  }

  // ---------- HUD / Fever ----------
  try{ ensureFeverBar(); setFever(0); setFeverActive(false); setShield(0); }catch(_){}

  // ---------- Mission deck (Mini Quest) ----------
  var deck = new MissionDeck({ pool: miniPool10 });
  if (deck && deck.draw3) deck.draw3();
  var wave=1, totalQuestsCleared=0;
  var questHistory=[]; // snapshots of each wave
  questHUDInit();

  // ---------- Goals pick ----------
  var activeGoals = pickGoals(diff); // 5 เป้าหมาย
  function evaluateGoals(stats){
    var cleared=0;
    for (var i=0;i<activeGoals.length;i++){
      var g = activeGoals[i]; if (!g) continue;
      try{
        g._prog = (typeof g.prog==='function') ? g.prog(stats) : (g._prog||0);
        if (!g._done && g.check && g.check(stats)) g._done = true;
        if (g._done) cleared++;
      }catch(_){}
    }
    return { cleared:cleared, total:activeGoals.length };
  }

  // ---------- Game state ----------
  var score=0, combo=0, shield=0;
  var fever=0, feverActive=false, feverCount=0;
  var star=0, diamond=0;
  var shieldTotal=0;
  var secElapsed=0;
  var scoreAt25=0, scoreAt30=0, scoreAt40=0;
  var comboSum=0; // สมมุติฐาน: ผลรวมสกอร์ช่วงติดคอมโบ
  var groupKinds=0; // นับชนิด GOOD อย่างน้อย 5 ประเภท
  var seenGoodKinds = {};

  function syncDeckStats(){
    deck.stats = deck.stats || {};
    deck.stats.star       = star;
    deck.stats.diamond    = diamond;
    deck.stats.feverCount = feverCount;
    deck.stats.score      = score;
    deck.stats.comboMax   = deck.stats.comboMax||0;
    deck.stats.comboMax   = Math.max(deck.stats.comboMax, combo);
    deck.updateScore && deck.updateScore(score);
    deck.updateCombo && deck.updateCombo(combo);
  }

  function mult(){ return feverActive?2:1; }
  function gainFever(n){
    fever=Math.max(0,Math.min(100,fever+n)); try{ setFever(fever); }catch(_){}
    if(!feverActive && fever>=100){ feverActive=true; try{ setFeverActive(true); }catch(_){ } feverCount++; if(deck.onFeverStart) deck.onFeverStart(); }
  }
  function decayFever(base){
    var d=feverActive?10:base; var was=feverActive;
    fever=Math.max(0,fever-d); try{ setFever(fever); }catch(_){}
    if(was && fever<=0){ feverActive=false; try{ setFeverActive(false); }catch(_){ } }
  }

  // ---------- HUD push ----------
  function pushQuestHUD(hintText){
    // mini quest (current)
    var mini=null; var cur = deck.getCurrent ? deck.getCurrent() : null;
    if (cur){
      var progList = deck.getProgress ? deck.getProgress() : [];
      var now=null; for (var i=0;i<progList.length;i++){ if(progList[i] && progList[i].id===cur.id){ now=progList[i]; break; } }
      mini = {
        label: cur.label,
        prog:  (now && isFinite(now.prog)) ? now.prog : 0,
        target:(now && isFinite(now.target)) ? now.target : ((now && now.done)?1:0)
      };
    }

    // goals (aggregate)
    var goalsEval = evaluateGoals(deck.stats||{});
    var goal = {
      label : 'เป้าหมายหลัก',
      prog  : goalsEval.cleared,
      target: goalsEval.total,
      list  : activeGoals.map(function(g){
        return { label:g.label, prog:g._prog||0, target:g.target||0, done:!!g._done };
      })
    };

    try {
      window.dispatchEvent(new CustomEvent('hha:quest',{ detail:{ goal:goal, mini:mini } }));
    } catch(_){}
    questHUDUpdate(deck, hintText || ('Wave '+wave));
  }

  // ---------- capture quest wave snapshot ----------
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

  // ---------- End summary ----------
  function onEnd(){
    try{
      try{
        window.removeEventListener('hha:hit-screen', onHitScreen);
        window.removeEventListener('hha:expired',    onExpire);
        window.removeEventListener('hha:time',       onSec);
      }catch(_){}

      // Mini quests summary (ทุกคลื่น)
      var currentProg = deck.getProgress ? deck.getProgress() : [];
      var curSummary=currentProg.map(function(q){ return q?({label:q.label,level:q.level,done:!!q.done,prog:(+q.prog||0),target:(+q.target||0),wave:wave}):null; }).filter(Boolean);
      var questsSummary = questHistory.concat(curSummary);
      var questsCleared = 0; for(var i=0;i<questsSummary.length;i++){ if(questsSummary[i].done) questsCleared++; }
      var questsTotal   = questsSummary.length;

      // Goals summary
      var goalsEval = evaluateGoals(deck.stats||{});
      var goalsSummary = activeGoals.map(function(g){ return { label:g.label, done:!!g._done, prog:g._prog||0, target:g.target||0 }; });

      try{ questHUDDispose(); }catch(_){}

      var comboMax = deck.stats ? (deck.stats.comboMax||0) : 0;
      var misses   = deck.stats ? (deck.stats.junkMiss||0) : 0;
      var hits     = deck.stats ? (deck.stats.goodCount||0) : 0;

      window.dispatchEvent(new CustomEvent('hha:end',{detail:{
        mode:'goodjunk', difficulty:diff, score:score,
        comboMax:comboMax, misses:misses, hits:hits,
        duration:dur,
        // mini quests
        questsCleared:questsCleared, questsTotal:questsTotal, questsSummary:questsSummary,
        miniQuests:questsSummary, quests:questsSummary, questsDone:questsCleared, quests_total:questsTotal,
        // goals
        goalsCleared:goalsEval.cleared, goalsTotal:goalsEval.total, goalsSummary:goalsSummary,
        // shields
        shieldTotal:shieldTotal
      }}));
    }catch(_){}
  }

  // ---------- Judge ----------
  function judge(ch, ctx){
    ctx = ctx || {};
    var cx=(typeof ctx.clientX==='number')?ctx.clientX:(typeof ctx.cx==='number'?ctx.cx:0);
    var cy=(typeof ctx.clientY==='number')?ctx.clientY:(typeof ctx.cy==='number'?ctx.cy:0);
    try{ if(window.visualViewport && window.visualViewport.offsetTop){ cy -= window.visualViewport.offsetTop; } }catch(_){}

    function burst(theme){ try{ Particles.burstShards(null,null,{screen:{x:cx,y:cy},theme:theme}); }catch(_){ } }
    function pop(txt,pos){ try{ Particles.scorePop(cx,cy,String(txt),!!pos); }catch(_){ } }

    // Power-ups
    if (ch===STAR){ var d1=40*mult(); score+=d1; star++; gainFever(10); burst('goodjunk'); pop('+'+d1,true); syncDeckStats(); pushQuestHUD(); return {good:true, scoreDelta:d1}; }
    if (ch===DIA){  var d2=80*mult(); score+=d2; diamond++; gainFever(30); burst('groups');   pop('+'+d2,true); syncDeckStats(); pushQuestHUD(); return {good:true, scoreDelta:d2}; }
    if (ch===SHIELD){
      shield=Math.min(3,shield+1); try{ setShield(shield); }catch(_){}
      shieldTotal+=1; try{ addShield(1); }catch(_){}
      var d3=20; score+=d3; burst('hydration'); pop('+'+d3,true); syncDeckStats(); pushQuestHUD(); return {good:true, scoreDelta:d3};
    }
    if (ch===FIRE){ feverActive=true; try{ setFeverActive(true); }catch(_){}
      fever=Math.max(fever,60); try{ setFever(fever); }catch(_){}
      var d4=25; score+=d4; burst('plate'); pop('+'+d4,true); syncDeckStats(); pushQuestHUD(); return {good:true, scoreDelta:d4}; }

    var isGood = (GOOD.indexOf(ch)!==-1);
    if (isGood){
      if (!seenGoodKinds[ch]){ seenGoodKinds[ch]=1; groupKinds = Object.keys(seenGoodKinds).length; }
      var base=20+combo*2, delta=base*mult(); score+=delta; combo+=1;
      comboSum += delta>0 ? delta : 0;
      gainFever(8+combo*0.6);
      if (deck.onGood) deck.onGood();
      burst('goodjunk'); pop('+'+delta,true); syncDeckStats(); pushQuestHUD();
      return {good:true, scoreDelta:delta};
    }else{
      if (shield>0){ shield=Math.max(0,shield-1); try{ setShield(shield); }catch(_){}
        burst('hydration'); pop('0',false); pushQuestHUD(); return {good:false, scoreDelta:0}; }
      var dneg=-15; score=Math.max(0,score+dneg); combo=0; decayFever(18);
      deck.stats = deck.stats || {}; deck.stats.noMissTime = 0; // พลาดจริง
      burst('plate'); pop(String(dneg),false);
      syncDeckStats(); pushQuestHUD(); return {good:false, scoreDelta:dneg};
    }
  }

  // ---------- Events ----------
  function onExpire(ev){
    if (!ev) return;
    if (ev.isGood){
      deck.stats = deck.stats || {};
      deck.stats.noMissTime = 0;
      decayFever(6);
      syncDeckStats(); pushQuestHUD('Wave '+wave); return;
    }
    // JUNK expired = หลีกสำเร็จ
    gainFever(4);
    deck.stats = deck.stats || {};
    var prevNoMiss = deck.stats.noMissTime || 0;
    var prevJunk   = deck.stats.junkMiss || 0;
    if (deck.onJunk) deck.onJunk();
    deck.stats.noMissTime = prevNoMiss;
    deck.stats.junkMiss   = (deck.stats.junkMiss||prevJunk)+1;
    syncDeckStats(); pushQuestHUD('Wave '+wave);
  }

  function refillWaveIfCleared(){
    if (deck && deck.isCleared && deck.isCleared()){
      captureWaveToHistory();
      totalQuestsCleared += 3;
      if (deck.draw3) deck.draw3();
      wave += 1;
      pushQuestHUD('Wave '+wave);
    }
  }

  function onHitScreen(){ pushQuestHUD('Wave '+wave); refillWaveIfCleared(); }
  function onSec(){
    secElapsed += 1;
    if (secElapsed===25) scoreAt25 = score;
    if (secElapsed===30) scoreAt30 = score;
    if (secElapsed===40) scoreAt40 = score;

    // คำนวณ metric เสริมสำหรับ goal
    deck.stats = deck.stats || {};
    deck.stats.time = secElapsed;
    deck.stats.avgPerSec = secElapsed>0 ? (score/secElapsed) : 0;
    deck.stats.score25 = scoreAt25;
    deck.stats.score30 = scoreAt30;
    deck.stats.score40 = scoreAt40;
    deck.stats.comboSum = comboSum;
    deck.stats.groupKinds = groupKinds;

    decayFever(combo<=0?6:2);
    if (deck.second) deck.second();
    syncDeckStats();
    pushQuestHUD('Wave '+wave);
  }

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
    try{
      window.addEventListener('hha:time', function(e){
        var sec=0; if(e && e.detail && e.detail.sec!=null) sec=e.detail.sec|0;
        if(sec<=0) onEnd();
      });
    }catch(_){}
    return ctrl;
  });
}

export default { boot };
