// === /HeroHealth/modes/goodjunk.safe.js (2025-11-12 full-wave quest summary) ===
import { boot as factoryBoot } from '../vr/mode-factory.js';
import { MissionDeck } from '../vr/mission.js';
import { questHUDInit, questHUDUpdate, questHUDDispose } from '../vr/quest-hud.js';
import { Particles } from '../vr/particles.js';
import { ensureFeverBar, setFever, setFeverActive, setShield, addShield } from '../vr/ui-fever.js';

export async function boot(cfg){
  cfg = cfg || {};
  var diff = String((cfg && cfg.difficulty) || 'normal');
  var dur  = Number((cfg && cfg.duration!=null) ? cfg.duration : 60);

  const GOOD=['🥦','🥕','🍎','🐟','🥛','🍊','🍌','🍇','🥬','🍚','🥜','🍞','🍓','🍍','🥝','🍐'];
  const JUNK=['🍔','🍟','🍕','🍩','🍪','🧁','🥤','🧋','🍫','🌭','🍰','🍬'];
  const STAR='⭐', DIA='💎', SHIELD='🛡️', FIRE='🔥';
  const BONUS=[STAR,DIA,SHIELD,FIRE];

  const GOAL_SCORE = (diff==='easy') ? 350 : (diff==='hard' ? 750 : 550);
  function goalObj(score){ return { label:'ทำคะแนนให้ถึงเป้า ('+diff+')', prog:score, target:GOAL_SCORE }; }

  const gjQuestPool10 = [
    { id:'g_good15',   level:'easy',   label:'เก็บของดี 15 ชิ้น',     check:s=>s.goodCount>=15,  prog:s=>Math.min(15,s.goodCount),  target:15 },
    { id:'g_good25',   level:'normal', label:'เก็บของดี 25 ชิ้น',     check:s=>s.goodCount>=25,  prog:s=>Math.min(25,s.goodCount),  target:25 },
    { id:'g_combo12',  level:'normal', label:'ทำคอมโบ 12',            check:s=>s.comboMax>=12,   prog:s=>Math.min(12,s.comboMax),   target:12 },
    { id:'g_score500', level:'hard',   label:'ทำคะแนนรวม 500+',       check:s=>s.score>=500,     prog:s=>Math.min(500,s.score),     target:500 },
    { id:'g_nomiss10', level:'normal', label:'ไม่พลาด 10 วินาที',     check:s=>s.noMissTime>=10, prog:s=>Math.min(10,s.noMissTime), target:10 },
    { id:'g_avoid5',   level:'easy',   label:'หลีกของขยะ 5 ครั้ง',    check:s=>s.junkMiss>=5,    prog:s=>Math.min(5,s.junkMiss),    target:5 },
    { id:'g_star2',    level:'hard',   label:'เก็บดาว ⭐ 2 ดวง',        check:s=>s.star>=2,        prog:s=>Math.min(2,s.star),        target:2 },
    { id:'g_dia1',     level:'hard',   label:'เก็บเพชร 💎 1 เม็ด',      check:s=>s.diamond>=1,     prog:s=>Math.min(1,s.diamond),     target:1 },
    { id:'g_streak20', level:'hard',   label:'คอมโบสูงสุด 20',         check:s=>s.comboMax>=20,   prog:s=>Math.min(20,s.comboMax),   target:20 },
    { id:'g_fever2',   level:'normal', label:'เข้าโหมด Fever 2 ครั้ง',  check:s=>s.feverCount>=2,  prog:s=>Math.min(2,s.feverCount),  target:2 },
  ];

  try{ ensureFeverBar(); setFever(0); setFeverActive(false); setShield(0); }catch(_){}

  const deck = new MissionDeck({ pool: gjQuestPool10 });
  if (deck && deck.draw3) deck.draw3();
  let wave=1, totalQuestsCleared=0;
  const questHistory=[];                 // ✅ เก็บเควสต์ทุกคลื่นที่ผ่านแล้ว
  questHUDInit();

  let score=0, combo=0, shield=0;
  let fever=0, feverActive=false, feverCount=0;
  let star=0, diamond=0;
  let shieldTotal=0;

  function syncDeckStats(){
    deck.stats = deck.stats || {};
    deck.stats.star=star; deck.stats.diamond=diamond; deck.stats.feverCount=feverCount;
    if (deck.updateScore) deck.updateScore(score);
    if (deck.updateCombo) deck.updateCombo(combo);
  }

  function mult(){ return feverActive?2:1; }
  function gainFever(n){
    fever=Math.max(0,Math.min(100,fever+n)); try{ setFever(fever); }catch(_){}
    if(!feverActive && fever>=100){ feverActive=true; try{ setFeverActive(true); }catch(_){ } feverCount++; if(deck.onFeverStart) deck.onFeverStart(); }
  }
  function decayFever(base){
    const d=feverActive?10:base; const was=feverActive;
    fever=Math.max(0,fever-d); try{ setFever(fever); }catch(_){}
    if(was && fever<=0){ feverActive=false; try{ setFeverActive(false); }catch(_){} }
  }

  function pushQuestHUD(hint){
    let mini=null, cur=deck.getCurrent?deck.getCurrent():null;
    if(cur){
      const prog=deck.getProgress?deck.getProgress():[];
      let now=null; for(let i=0;i<prog.length;i++){ if(prog[i] && prog[i].id===cur.id){ now=prog[i]; break; } }
      mini={ label:cur.label, prog:(now&&isFinite(now.prog)?now.prog:0), target:(now&&isFinite(now.target)?now.target:((now&&now.done)?1:0)) };
    }
    const g=goalObj(score);
    try{ window.dispatchEvent(new CustomEvent('hha:quest',{detail:{goal:g,mini}})); }catch(_){}
    questHUDUpdate(deck, hint || ('Wave '+wave));
  }

  function captureWaveToHistory(){
    const progList = deck.getProgress ? deck.getProgress() : [];
    for(let i=0;i<progList.length;i++){
      const q=progList[i]; if(!q) continue;
      // เก็บ snapshot ของคลื่นนี้
      questHistory.push({
        label:q.label, level:q.level, done:!!q.done,
        prog:(typeof q.prog==='number'?q.prog:0),
        target:(typeof q.target==='number'?q.target:0),
        wave: wave
      });
    }
  }

  function onEnd(){
    try{
      try{
        window.removeEventListener('hha:hit-screen', onHitScreen);
        window.removeEventListener('hha:expired',    onExpire);
        window.removeEventListener('hha:time',       onSec);
      }catch(_){}

      // รวมเควสต์: history (ทุกคลื่นก่อนหน้า) + คลื่นสุดท้าย
      const currentProg = deck.getProgress ? deck.getProgress() : [];
      const clearedNow = currentProg.filter(q=>q && q.done).length;
      const questsCleared = totalQuestsCleared + clearedNow;
      const questsTotal   = (wave-1)*3 + 3;

      const questsSummary = questHistory.concat(currentProg.map(q=>q?({
        label:q.label, level:q.level, done:!!q.done,
        prog:(typeof q.prog==='number'?q.prog:0),
        target:(typeof q.target==='number'?q.target:0),
        wave: wave
      }):null)).filter(Boolean);

      try{ questHUDDispose(); }catch(_){}

      const comboMax = deck.stats ? (deck.stats.comboMax||0) : 0;
      const misses   = deck.stats ? (deck.stats.junkMiss||0) : 0;
      const hits     = deck.stats ? (deck.stats.goodCount||0) : 0;

      window.dispatchEvent(new CustomEvent('hha:end',{detail:{
        mode:'goodjunk', difficulty:diff, score,
        comboMax, misses, hits,
        duration:dur,
        goalCleared:(score>=GOAL_SCORE), goalTarget:GOAL_SCORE,
        questsCleared, questsTotal,
        questsSummary,
        // aliases for compatibility
        miniQuests: questsSummary,
        quests: questsSummary,
        questsDone: questsCleared,
        quests_total: questsTotal,
        shieldTotal
      }}));
    }catch(_){}
  }

  function judge(ch, ctx){
    ctx = ctx || {};
    const cx = (typeof ctx.clientX==='number') ? ctx.clientX : (typeof ctx.cx==='number'?ctx.cx:0);
    const cy = (typeof ctx.clientY==='number') ? ctx.clientY : (typeof ctx.cy==='number'?ctx.cy:0);
    const burst=(theme)=>{ try{ Particles.burstShards(null,null,{screen:{x:cx,y:cy},theme}); }catch(_){} };
    const pop  =(txt,pos)=>{ try{ Particles.scorePop(cx,cy,String(txt),!!pos); }catch(_){} };

    if (ch===STAR){ const d=40*mult(); score+=d; star++; gainFever(10); burst('goodjunk'); pop('+'+d,true); syncDeckStats(); pushQuestHUD(); return {good:true, scoreDelta:d}; }
    if (ch===DIA){  const d=80*mult(); score+=d; diamond++; gainFever(30); burst('groups');   pop('+'+d,true); syncDeckStats(); pushQuestHUD(); return {good:true, scoreDelta:d}; }
    if (ch===SHIELD){
      shield=Math.min(3,shield+1); try{ setShield(shield); }catch(_){}
      shieldTotal+=1; try{ addShield(1); }catch(_){}
      const d=20; score+=d; burst('hydration'); pop('+'+d,true); syncDeckStats(); pushQuestHUD(); return {good:true, scoreDelta:d};
    }
    if (ch===FIRE){ feverActive=true; try{ setFeverActive(true); }catch(_){}
      fever=Math.max(fever,60); try{ setFever(fever); }catch(_){}
      const d=25; score+=d; burst('plate'); pop('+'+d,true); syncDeckStats(); pushQuestHUD(); return {good:true, scoreDelta:d}; }

    const isGood = GOOD.indexOf(ch)!==-1;
    if (isGood){
      const base=20+combo*2, delta=base*mult();
      score+=delta; combo+=1; gainFever(8+combo*0.6);
      if (deck.onGood) deck.onGood();
      burst('goodjunk'); pop('+'+delta,true); syncDeckStats(); pushQuestHUD();
      return {good:true, scoreDelta:delta};
    }else{
      if (shield>0){ shield=Math.max(0,shield-1); try{ setShield(shield); }catch(_){}
        burst('hydration'); pop('0',false); pushQuestHUD(); return {good:false, scoreDelta:0}; }
      const d=-15; score=Math.max(0,score+d); combo=0; decayFever(18);
      deck.stats=deck.stats||{}; deck.stats.noMissTime=0; burst('plate'); pop(String(d),false);
      syncDeckStats(); pushQuestHUD(); return {good:false, scoreDelta:d};
    }
  }

  function onExpire(ev){
    if(!ev) return;
    if (ev.isGood){
      deck.stats = deck.stats || {}; deck.stats.noMissTime=0; decayFever(6);
      syncDeckStats(); pushQuestHUD('Wave '+wave); return;
    }
    gainFever(4);
    deck.stats = deck.stats || {};
    const prevNoMiss=deck.stats.noMissTime||0, prevJunk=deck.stats.junkMiss||0;
    if (deck.onJunk) deck.onJunk();
    deck.stats.noMissTime=prevNoMiss; deck.stats.junkMiss=(deck.stats.junkMiss||prevJunk)+1;
    syncDeckStats(); pushQuestHUD('Wave '+wave);
  }

  function refillWaveIfCleared(){
    if (deck && deck.isCleared && deck.isCleared()){
      // ✅ เก็บเควสต์ของคลื่นนี้ทั้งหมดลง history ก่อนสับชุดใหม่
      captureWaveToHistory();
      totalQuestsCleared += 3;
      if (deck.draw3) deck.draw3();
      wave += 1;
      pushQuestHUD('Wave '+wave);
    }
  }

  function onHitScreen(){ pushQuestHUD('Wave '+wave); refillWaveIfCleared(); }
  function onSec(){ decayFever(combo<=0?6:2); if(deck.second) deck.second(); syncDeckStats(); pushQuestHUD('Wave '+wave); }

  try{
    window.addEventListener('hha:hit-screen', onHitScreen);
    window.addEventListener('hha:expired',    onExpire);
    window.addEventListener('hha:time',       onSec);
  }catch(_){}

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
    try{
      window.addEventListener('hha:time', e=>{
        let sec=0; if(e && e.detail && e.detail.sec!=null) sec=e.detail.sec|0; if(sec<=0) onEnd();
      });
    }catch(_){}
    return ctrl;
  });
}

export default { boot };
