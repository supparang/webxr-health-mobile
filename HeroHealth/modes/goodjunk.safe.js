// === /HeroHealth/modes/goodjunk.safe.js (2025-11-12 LATEST: full-wave summary + precise pop + stats event) ===
import { boot as factoryBoot } from '../vr/mode-factory.js';
import { MissionDeck } from '../vr/mission.js';
import { questHUDInit, questHUDUpdate, questHUDDispose } from '../vr/quest-hud.js';
import { Particles } from '../vr/particles.js';
import { ensureFeverBar, setFever, setFeverActive, setShield, addShield } from '../vr/ui-fever.js';

export async function boot(cfg = {}){
  const diff = String(cfg.difficulty || 'normal');
  const dur  = Number(cfg.duration != null ? cfg.duration : 60);

  // pools
  const GOOD = ['🥦','🥕','🍎','🐟','🥛','🍊','🍌','🍇','🥬','🍚','🥜','🍞','🍓','🍍','🥝','🍐'];
  const JUNK = ['🍔','🍟','🍕','🍩','🍪','🧁','🥤','🧋','🍫','🌭','🍰','🍬'];
  const STAR='⭐', DIA='💎', SHIELD='🛡️', FIRE='🔥';
  const BONUS=[STAR,DIA,SHIELD,FIRE];

  // goal
  const GOAL_SCORE = (diff==='easy') ? 350 : (diff==='hard' ? 750 : 550);
  const goalObj = (score)=>({ label:'ทำคะแนนให้ถึงเป้า ('+diff+')', prog:score, target:GOAL_SCORE });

  // mini quest pool (10)
  const pool = [
    { id:'g_good15', level:'easy',   label:'เก็บของดี 15 ชิ้น',   check:s=>s.goodCount>=15,  prog:s=>Math.min(15,s.goodCount),  target:15 },
    { id:'g_good25', level:'normal', label:'เก็บของดี 25 ชิ้น',   check:s=>s.goodCount>=25,  prog:s=>Math.min(25,s.goodCount),  target:25 },
    { id:'g_combo12',level:'normal', label:'ทำคอมโบ 12',          check:s=>s.comboMax>=12,   prog:s=>Math.min(12,s.comboMax),   target:12 },
    { id:'g_score500',level:'hard',  label:'ทำคะแนนรวม 500+',     check:s=>s.score>=500,     prog:s=>Math.min(500,s.score),     target:500 },
    { id:'g_nomiss10',level:'normal',label:'ไม่พลาด 10 วินาที',   check:s=>s.noMissTime>=10, prog:s=>Math.min(10,s.noMissTime), target:10 },
    { id:'g_avoid5', level:'easy',   label:'หลีกของขยะ 5 ครั้ง', check:s=>s.junkMiss>=5,    prog:s=>Math.min(5,s.junkMiss),    target:5 },
    { id:'g_star2',  level:'hard',   label:'เก็บดาว ⭐ 2 ดวง',      check:s=>s.star>=2,        prog:s=>Math.min(2,s.star),        target:2 },
    { id:'g_dia1',   level:'hard',   label:'เก็บเพชร 💎 1 เม็ด',    check:s=>s.diamond>=1,     prog:s=>Math.min(1,s.diamond),     target:1 },
    { id:'g_streak20',level:'hard',  label:'คอมโบสูงสุด 20',       check:s=>s.comboMax>=20,   prog:s=>Math.min(20,s.comboMax),   target:20 },
    { id:'g_fever2', level:'normal', label:'เข้าโหมด Fever 2 ครั้ง',check:s=>s.feverCount>=2,  prog:s=>Math.min(2,s.feverCount),  target:2 },
  ];

  // fever bar / shield HUD
  try{ ensureFeverBar(); setFever(0); setFeverActive(false); setShield(0); }catch(_){}

  // mission deck
  const deck = new MissionDeck({ pool });
  if (deck.draw3) deck.draw3();
  questHUDInit();

  let wave=1, totalQuestsCleared=0;
  const questHistory=[];

  // runtime stats
  let score=0, combo=0, star=0, diamond=0;
  let shield=0, shieldTotal=0;
  let fever=0, feverActive=false, feverCount=0;

  // expose stats to deck
  function syncDeckStats(){
    deck.stats = deck.stats || {};
    deck.stats.star=star; deck.stats.diamond=diamond; deck.stats.feverCount=feverCount;
    deck.updateScore && deck.updateScore(score);
    deck.updateCombo && deck.updateCombo(combo);
  }

  // === emit live stats for HUD ===
  function emitStats(){
    try{
      const comboMax = deck?.stats?.comboMax ?? combo;
      window.dispatchEvent(new CustomEvent('hha:stats',{
        detail:{ score, combo, comboMax }
      }));
    }catch(_){}
  }

  // fever helpers
  const mult = ()=> feverActive ? 2 : 1;
  function gainFever(n){
    fever = Math.max(0, Math.min(100, fever+n));
    try{ setFever(fever); }catch(_){}
    if(!feverActive && fever>=100){
      feverActive=true; try{ setFeverActive(true); }catch(_){}
      feverCount++; deck.onFeverStart && deck.onFeverStart();
    }
  }
  function decayFever(base){
    const d = feverActive ? 10 : base;
    const was = feverActive;
    fever = Math.max(0, fever - d);
    try{ setFever(fever); }catch(_){}
    if(was && fever<=0){ feverActive=false; try{ setFeverActive(false); }catch(_){ } }
  }

  // quest HUD
  function pushQuestHUD(hint){
    let mini=null, cur=deck.getCurrent?deck.getCurrent():null;
    if(cur){
      const prog=deck.getProgress?deck.getProgress():[];
      let now=null; for(let i=0;i<prog.length;i++){ if(prog[i] && prog[i].id===cur.id){ now=prog[i]; break; } }
      mini={ label:cur.label, prog:(now&&isFinite(now.prog)?now.prog:0), target:(now&&isFinite(now.target)?now.target:((now&&now.done)?1:0)) };
    }
    const g=goalObj(score);
    try{ window.dispatchEvent(new CustomEvent('hha:quest',{detail:{goal:g,mini}})); }catch(_){}
    questHUDUpdate(deck, hint||('Wave '+wave));
  }

  function captureWaveToHistory(){
    const progList=deck.getProgress?deck.getProgress():[];
    for(let i=0;i<progList.length;i++){
      const q=progList[i]; if(!q) continue;
      questHistory.push({
        label:q.label, level:q.level, done:!!q.done,
        prog:(typeof q.prog==='number'?q.prog:0),
        target:(typeof q.target==='number'?q.target:0),
        wave
      });
    }
  }

  function onEnd(){
    try{
      window.removeEventListener('hha:hit-screen', onHitScreen);
      window.removeEventListener('hha:expired',    onExpire);
      window.removeEventListener('hha:time',       onSec);
    }catch(_){}

    const current=deck.getProgress?deck.getProgress():[];
    const curSummary=current.map(q=>q?({
      label:q.label, level:q.level, done:!!q.done,
      prog:(+q.prog||0), target:(+q.target||0), wave
    }):null).filter(Boolean);

    const questsSummary = questHistory.concat(curSummary);
    const questsCleared = questsSummary.filter(q=>q.done).length;
    const questsTotal   = questsSummary.length;

    try{ questHUDDispose(); }catch(_){}

    const comboMax = deck.stats ? (deck.stats.comboMax||0) : 0;
    const misses   = deck.stats ? (deck.stats.junkMiss||0) : 0;
    const hits     = deck.stats ? (deck.stats.goodCount||0) : 0;

    // final stats to HUD once more
    emitStats();

    try{
      window.dispatchEvent(new CustomEvent('hha:end',{detail:{
        mode:'goodjunk', difficulty:diff, score,
        comboMax, misses, hits, duration:dur,
        goalCleared:(score>=GOAL_SCORE), goalTarget:GOAL_SCORE,
        questsCleared, questsTotal, questsSummary,
        // aliases
        miniQuests:questsSummary, quests:questsSummary, questsDone:questsCleared, quests_total:questsTotal,
        shieldTotal
      }}));
    }catch(_){}
  }

  // judge click
  function judge(ch, ctx){
    ctx=ctx||{};
    let cx=(typeof ctx.clientX==='number')?ctx.clientX:(typeof ctx.cx==='number'?ctx.cx:0);
    let cy=(typeof ctx.clientY==='number')?ctx.clientY:(typeof ctx.cy==='number'?ctx.cy:0);
    try{ if(window.visualViewport && window.visualViewport.offsetTop){ cy -= window.visualViewport.offsetTop; } }catch(_){}

    const burst=(theme)=>{ try{ Particles.burstShards(null,null,{screen:{x:cx,y:cy},theme}); }catch(_){ } };
    const pop  =(txt,pos)=>{ try{ Particles.scorePop(cx,cy,String(txt),!!pos); }catch(_){ } };

    // powerups
    if (ch===STAR){ const d=40*mult(); score+=d; star++; gainFever(10); burst('goodjunk'); pop('+'+d,true); syncDeckStats(); emitStats(); pushQuestHUD(); return {good:true, scoreDelta:d}; }
    if (ch===DIA){  const d=80*mult(); score+=d; diamond++; gainFever(30); burst('groups');   pop('+'+d,true); syncDeckStats(); emitStats(); pushQuestHUD(); return {good:true, scoreDelta:d}; }
    if (ch===SHIELD){
      shield=Math.min(3,shield+1); try{ setShield(shield);}catch(_){}
      shieldTotal+=1; try{ addShield(1);}catch(_){}
      const d=20; score+=d; burst('hydration'); pop('+'+d,true); syncDeckStats(); emitStats(); pushQuestHUD(); return {good:true, scoreDelta:d};
    }
    if (ch===FIRE){
      feverActive=true; try{ setFeverActive(true);}catch(_){}
      fever=Math.max(fever,60); try{ setFever(fever);}catch(_){}
      const d=25; score+=d; burst('plate'); pop('+'+d,true); syncDeckStats(); emitStats(); pushQuestHUD(); return {good:true, scoreDelta:d};
    }

    const isGood = GOOD.indexOf(ch)!==-1;
    if (isGood){
      const delta=(20+combo*2)*mult();
      score+=delta; combo+=1; 
      deck.stats=deck.stats||{}; deck.stats.comboMax=Math.max(deck.stats.comboMax||0, combo);
      gainFever(8+combo*0.6);
      deck.onGood && deck.onGood();
      burst('goodjunk'); pop('+'+delta,true);
      syncDeckStats(); emitStats(); pushQuestHUD();
      return {good:true, scoreDelta:delta};
    }else{
      if (shield>0){
        shield=Math.max(0,shield-1); try{ setShield(shield);}catch(_){}
        burst('hydration'); pop('0',false); pushQuestHUD(); return {good:false, scoreDelta:0};
      }
      const d=-15; score=Math.max(0,score+d); combo=0; decayFever(18);
      deck.stats=deck.stats||{}; deck.stats.noMissTime=0;
      burst('plate'); pop(String(d),false);
      syncDeckStats(); emitStats(); pushQuestHUD();
      return {good:false, scoreDelta:d};
    }
  }

  function onExpire(ev){
    if(!ev) return;
    if (ev.isGood){
      deck.stats=deck.stats||{}; deck.stats.noMissTime=0; decayFever(6);
      syncDeckStats(); emitStats(); pushQuestHUD('Wave '+wave); return;
    }
    gainFever(4);
    deck.stats=deck.stats||{};
    const prevNo=deck.stats.noMissTime||0, prevJ=deck.stats.junkMiss||0;
    deck.onJunk && deck.onJunk();
    deck.stats.noMissTime=prevNo; deck.stats.junkMiss=(deck.stats.junkMiss||prevJ)+1;
    syncDeckStats(); emitStats(); pushQuestHUD('Wave '+wave);
  }

  function refillWaveIfCleared(){
    if (deck.isCleared && deck.isCleared()){
      captureWaveToHistory();
      totalQuestsCleared += 3;
      deck.draw3 && deck.draw3();
      wave += 1;
      pushQuestHUD('Wave '+wave);
    }
  }

  function onHitScreen(){ pushQuestHUD('Wave '+wave); refillWaveIfCleared(); }
  function onSec(){ decayFever(combo<=0?6:2); deck.second && deck.second(); syncDeckStats(); emitStats(); pushQuestHUD('Wave '+wave); }

  // global listeners
  window.addEventListener('hha:hit-screen', onHitScreen);
  window.addEventListener('hha:expired',    onExpire);
  window.addEventListener('hha:time',       onSec);

  // boot factory
  return factoryBoot({
    difficulty: diff,
    duration  : dur,
    pools     : { good: GOOD.concat(BONUS), bad: JUNK.slice() },
    goodRate  : 0.65,
    powerups  : BONUS,
    powerRate : 0.08,
    powerEvery: 7,
    judge     : (ch,ctx)=>{ ctx=ctx||{}; return judge(ch,{ cx:(ctx.clientX||ctx.cx), cy:(ctx.clientY||ctx.cy) }); },
    onExpire
  }).then(ctrl=>{
    // เมื่อเวลา 0 → จบเกม (รับรองว่าหน้าสรุปขึ้นเสมอ)
    window.addEventListener('hha:time', (e)=>{
      const sec=(e && e.detail && e.detail.sec!=null) ? (e.detail.sec|0) : 0;
      if (sec<=0) onEnd();
    });
    // เปิด HUD ครั้งแรก
    syncDeckStats(); emitStats(); pushQuestHUD('Wave '+wave);
    return ctrl;
  });
}

export default { boot };
