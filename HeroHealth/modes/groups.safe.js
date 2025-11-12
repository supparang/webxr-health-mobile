// === /HeroHealth/modes/groups.safe.js (Food Groups + Fever + Power-ups + Wave Quests) ===
import { boot as factoryBoot } from '../vr/mode-factory.js';
import { MissionDeck } from '../vr/mission.js';
import { questHUDInit, questHUDUpdate, questHUDDispose } from '../vr/quest-hud.js';
import { ensureFeverBar, setFever, setFeverActive, setShield } from '../vr/ui-fever.js';
import { Particles } from '../vr/particles.js';

export async function boot(cfg = {}) {
  const diff = String(cfg.difficulty || 'normal');
  const dur  = Number(cfg.duration != null ? cfg.duration : 60);

  // กลุ่มอาหาร (ดี) และตัวล่อ/ขยะ (ไม่ดี)
  const GROUPS = ['🥩','🥚','🐟','🥛','🧀','🥦','🥕','🍅','🍇','🍌','🍚','🍞','🥜','🌽','🍠'];
  const LURE   = ['🥤','🧋','🍰','🍩','🍫','🍔','🍟','🌭','🍕'];

  // Power-ups
  const STAR='⭐', DIA='💎', SHIELD='🛡️', FIRE='🔥';
  const BONUS=[STAR,DIA,SHIELD,FIRE];

  // เควสต์สำหรับโหมด Groups
  const pool = [
    { id:'g_pick20', level:'easy',   label:'เก็บอาหารหมู่ให้ครบ 20 ชิ้น', check:s=>s.goodCount>=20, prog:s=>Math.min(20,s.goodCount), target:20 },
    { id:'g_combo12',level:'normal', label:'ทำคอมโบ 12',                 check:s=>s.comboMax>=12,  prog:s=>Math.min(12,s.comboMax),  target:12 },
    { id:'g_score700',level:'normal',label:'ทำคะแนนรวม 700+',            check:s=>s.score>=700,    prog:s=>Math.min(700,s.score),    target:700 },
    { id:'g_nomiss8', level:'normal',label:'ไม่พลาด 8 วิ',               check:s=>s.noMissTime>=8, prog:s=>Math.min(8,s.noMissTime), target:8 },
    { id:'g_avoid8',  level:'easy',   label:'เลี่ยงของล่อ 8 ชิ้น',        check:s=>s.junkMiss>=8,   prog:s=>Math.min(8,s.junkMiss),   target:8 },
    { id:'g_star2',   level:'hard',   label:'เก็บดาว ⭐ 2 ดวง',            check:s=>s.star>=2,       prog:s=>Math.min(2,s.star),       target:2 },
    { id:'g_dia1',    level:'hard',   label:'เก็บเพชร 💎 1 เม็ด',          check:s=>s.diamond>=1,    prog:s=>Math.min(1,s.diamond),    target:1 },
    { id:'g_fever2',  level:'normal', label:'เข้าโหมด Fever 2 ครั้ง',      check:s=>s.feverCount>=2, prog:s=>Math.min(2,s.feverCount), target:2 },
  ];

  // เป้าแต้มรวมตามระดับ
  const GOAL_SCORE = (diff==='easy') ? 400 : (diff==='hard' ? 800 : 600);
  const goalObj = (score)=>({ label: 'ทำคะแนนให้ถึงเป้า ('+diff+')', prog: score, target: GOAL_SCORE });

  // เตรียม HUD fever/shield
  try { ensureFeverBar(); setFever(0); setFeverActive(false); setShield(0); } catch(_) {}

  // เควสต์สำรับ
  const deck = new MissionDeck({ pool }); if (deck.draw3) deck.draw3();

  let wave = 1, totalCleared = 0;
  const questHistory = [];
  questHUDInit(); questHUDUpdate(deck, `Wave ${wave}`);

  // สถิติ/สถานะ
  let score=0, combo=0, shield=0;
  let fever=0, feverActive=false, feverCount=0;
  let star=0, diamond=0, shieldTotal=0;

  function mult(){ return feverActive ? 2 : 1; }
  function syncDeckStats(){
    deck.stats = deck.stats || {};
    deck.stats.score=score; deck.stats.combo=combo;
    deck.stats.star=star; deck.stats.diamond=diamond; deck.stats.feverCount=feverCount;
    if (deck.updateScore) deck.updateScore(score);
    if (deck.updateCombo) deck.updateCombo(combo);
  }
  function gainFever(n){
    fever = Math.max(0, Math.min(100, fever + n));
    try{ setFever(fever); }catch(_){}
    if (!feverActive && fever>=100){
      feverActive = true; try{ setFeverActive(true); }catch(_){}
      feverCount++; if (deck.onFeverStart) deck.onFeverStart();
    }
  }
  function decayFever(base){
    const d = feverActive ? 10 : base;
    const was = feverActive;
    fever = Math.max(0, fever - d);
    try{ setFever(fever); }catch(_){}
    if (was && fever<=0){ feverActive=false; try{ setFeverActive(false); }catch(_){} }
  }

  function pushQuestHUD(hint){
    let mini=null, cur=deck.getCurrent?deck.getCurrent():null;
    if (cur){
      const prog=deck.getProgress?deck.getProgress():[];
      let now=null; for(let i=0;i<prog.length;i++){ if(prog[i] && prog[i].id===cur.id){ now=prog[i]; break; } }
      mini={ label:cur.label, prog:(now&&isFinite(now.prog)?now.prog:0), target:(now&&isFinite(now.target)?now.target:((now&&now.done)?1:0)) };
    }
    try{ window.dispatchEvent(new CustomEvent('hha:quest',{detail:{goal:goalObj(score),mini}})); }catch(_){}
    questHUDUpdate(deck, hint || ('Wave '+wave));
  }

  function captureWave(){
    const progList = deck.getProgress ? deck.getProgress() : [];
    for (let i=0;i<progList.length;i++){
      const q = progList[i]; if (!q) continue;
      questHistory.push({
        label:q.label, level:q.level, done:!!q.done,
        prog:(typeof q.prog==='number'?q.prog:0),
        target:(typeof q.target==='number'?q.target:0),
        wave
      });
    }
  }

  // ----- การตัดสินคลิก -----
  function judge(ch, ctx){
    const cx = (ctx && (ctx.clientX??ctx.cx))|0;
    const cy = (ctx && (ctx.clientY??ctx.cy))|0;
    const burst=(theme)=>{ try{ Particles.burstShards(null,null,{screen:{x:cx,y:cy},theme}); }catch(_){ } };
    const pop  =(txt,pos)=>{ try{ Particles.scorePop(cx,cy,String(txt),!!pos); }catch(_){ } };

    // Power-ups
    if (ch===STAR){ const d=40*mult(); score+=d; star++; gainFever(10); burst('goodjunk');  pop('+'+d,true); syncDeckStats(); pushQuestHUD(); return {good:true,scoreDelta:d}; }
    if (ch===DIA){  const d=80*mult(); score+=d; diamond++; gainFever(30); burst('groups');    pop('+'+d,true); syncDeckStats(); pushQuestHUD(); return {good:true,scoreDelta:d}; }
    if (ch===SHIELD){
      shield=Math.min(3,shield+1); try{ setShield(shield); }catch(_){}
      shieldTotal++;
      const d=20; score+=d; burst('hydration'); pop('+'+d,true); syncDeckStats(); pushQuestHUD(); return {good:true,scoreDelta:d};
    }
    if (ch===FIRE){
      feverActive=true; try{ setFeverActive(true); }catch(_){}
      fever=Math.max(fever,60); try{ setFever(fever); }catch(_){}
      const d=25; score+=d; burst('plate'); pop('+'+d,true); syncDeckStats(); pushQuestHUD(); return {good:true,scoreDelta:d};
    }

    const isGood = GROUPS.includes(ch);
    if (isGood){
      const base=20+combo*2, delta=base*mult();
      score+=delta; combo+=1; gainFever(8+combo*0.6);
      if (deck.onGood) deck.onGood();
      burst('groups'); pop('+'+delta,true); syncDeckStats(); pushQuestHUD();
      return {good:true,scoreDelta:delta};
    }else{
      if (shield>0){ shield=Math.max(0,shield-1); try{ setShield(shield); }catch(_){}
        burst('hydration'); pop('0',false); pushQuestHUD(); return {good:false,scoreDelta:0}; }
      const d=-15; score=Math.max(0,score+d); combo=0; decayFever(18);
      deck.stats=deck.stats||{}; deck.stats.noMissTime=0; deck.onJunk && deck.onJunk();
      burst('plate'); pop(String(d),false); syncDeckStats(); pushQuestHUD();
      return {good:false,scoreDelta:d};
    }
  }

  // ----- ไอเท็มหมดอายุ -----
  function onExpire(ev){
    if (!ev) return;
    if (ev.isGood){ deck.stats=deck.stats||{}; deck.stats.noMissTime=0; decayFever(6); }
    else {
      gainFever(4);
      deck.stats=deck.stats||{}; const prevNo=deck.stats.noMissTime||0, prevJ=deck.stats.junkMiss||0;
      deck.onJunk && deck.onJunk(); deck.stats.noMissTime=prevNo; deck.stats.junkMiss=(deck.stats.junkMiss||prevJ)+1;
    }
    syncDeckStats(); pushQuestHUD('Wave '+wave);
  }

  function refillIfCleared(){
    if (deck.isCleared && deck.isCleared()){
      captureWave(); totalCleared += 3;
      if (deck.draw3) deck.draw3();
      wave += 1; pushQuestHUD('Wave '+wave);
    }
  }

  function onHitScreen(){ pushQuestHUD('Wave '+wave); refillIfCleared(); }
  function onSec(){ decayFever(combo<=0?6:2); deck.second&&deck.second(); syncDeckStats(); pushQuestHUD('Wave '+wave); }

  // ----- ฟังอีเวนต์จากโรงงาน -----
  try{
    window.addEventListener('hha:hit-screen', onHitScreen);
    window.addEventListener('hha:expired',    onExpire);
    window.addEventListener('hha:time',       onSec);
  }catch(_){}

  // ----- สรุปผลเมื่อจบ -----
  function endSummary(){
    try{
      window.removeEventListener('hha:hit-screen', onHitScreen);
      window.removeEventListener('hha:expired',    onExpire);
      window.removeEventListener('hha:time',       onSec);
    }catch(_){}

    const current = deck.getProgress ? deck.getProgress() : [];
    const curSummary = current.map(q=>q?({
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

    window.dispatchEvent(new CustomEvent('hha:end',{detail:{
      mode:'groups', difficulty:diff, score,
      comboMax, misses, hits,
      duration:dur,
      goalCleared:(score>=GOAL_SCORE), goalTarget:GOAL_SCORE,
      questsCleared, questsTotal, questsSummary,
      // aliases ให้หน้า result เดิม
      miniQuests:questsSummary, quests:questsSummary, questsDone:questsCleared, quests_total:questsTotal,
      shieldTotal
    }}));
  }

  // เริ่มโรงงาน
  return factoryBoot({
    difficulty:diff,
    duration  :dur,
    pools     : { good: GROUPS.concat(BONUS), bad: LURE.slice() },
    goodRate  : 0.65,
    powerups  : BONUS,
    powerRate : 0.08,
    powerEvery: 7,
    judge     : (ch,ctx)=>judge(ch,{ cx:(ctx?.clientX??ctx?.cx), cy:(ctx?.clientY??ctx?.cy) }),
    onExpire
  }).then(ctrl=>{
    try{
      window.addEventListener('hha:time', e=>{
        let sec = 0; if (e && e.detail && e.detail.sec!=null) sec = e.detail.sec|0;
        if (sec<=0) endSummary();
      });
    }catch(_){}
    return ctrl;
  });
}

export default { boot };
