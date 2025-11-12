// === /HeroHealth/modes/hydration.quest.js (Water gauge + Fever + Power-ups + Wave Quests) ===
import { boot as factoryBoot } from '../vr/mode-factory.js';
import { MissionDeck } from '../vr/mission.js';
import { questHUDInit, questHUDUpdate, questHUDDispose } from '../vr/quest-hud.js';
import { ensureFeverBar, setFever, setFeverActive, setShield } from '../vr/ui-fever.js';
import { ensureWaterGauge, setWaterGauge, zoneFrom } from '../vr/ui-water.js';
import { Particles } from '../vr/particles.js';

export async function boot(cfg = {}) {
  const diff = String(cfg.difficulty || 'normal');
  const dur  = Number(cfg.duration != null ? cfg.duration : 60);

  // ไอคอน “ดี” = เพิ่มน้ำ , “ล่อแห้ง” = ไม่ดี
  const WATER = ['💧','🚰','🥤','🧊'];
  const DRY   = ['☕','🍵','🍺','🥫','🍷','🥨'];

  // Power-ups
  const STAR='⭐', DIA='💎', SHIELD='🛡️', FIRE='🔥';
  const BONUS=[STAR,DIA,SHIELD,FIRE];

  // เป้าแต้มรวม (ตามระดับ)
  const GOAL_SCORE = (diff==='easy')?400:(diff==='hard'?800:600);
  const goalObj = (score)=>({ label:'ทำคะแนนให้ถึงเป้า ('+diff+')', prog:score, target:GOAL_SCORE });

  // เตรียม UI
  try{ ensureFeverBar(); setFever(0); setFeverActive(false); setShield(0); }catch(_){}
  try{ ensureWaterGauge(); setWaterGauge(55); }catch(_){}

  // สำรับเควสต์: ใช้พูลดีฟอลต์ + ข้างล่างเฉพาะโหมดน้ำ
  const pool = [
    { id:'h_waterKeep', level:'normal', label:'รักษาโซน GREEN 8 วิ', check:s=>s.keepGreen>=8, prog:s=>Math.min(8,s.keepGreen), target:8 },
    { id:'h_collect18', level:'easy',   label:'เก็บ 💧 อย่างน้อย 18 ชิ้น', check:s=>s.goodCount>=18, prog:s=>Math.min(18,s.goodCount), target:18 },
    { id:'h_score650',  level:'normal', label:'ทำคะแนนรวม 650+', check:s=>s.score>=650, prog:s=>Math.min(650,s.score), target:650 },
    { id:'h_avoid10',   level:'normal', label:'เลี่ยงของแห้ง 10 ชิ้น', check:s=>s.junkMiss>=10, prog:s=>Math.min(10,s.junkMiss), target:10 },
    { id:'h_combo14',   level:'hard',   label:'ทำคอมโบ 14', check:s=>s.comboMax>=14, prog:s=>Math.min(14,s.comboMax), target:14 },
    { id:'h_star2',     level:'hard',   label:'เก็บ ⭐ 2 ดวง', check:s=>s.star>=2, prog:s=>Math.min(2,s.star), target:2 },
    { id:'h_fever2',    level:'normal', label:'เข้า Fever 2 ครั้ง', check:s=>s.feverCount>=2, prog:s=>Math.min(2,s.feverCount), target:2 },
  ];

  const deck = new MissionDeck({ pool }); if (deck.draw3) deck.draw3();

  // --- สถานะ ---
  let wave=1, totalCleared=0; const questHistory=[];
  questHUDInit(); questHUDUpdate(deck, `Wave ${wave}`);

  let score=0, combo=0, shield=0, shieldTotal=0;
  let fever=0, feverActive=false, feverCount=0;
  let star=0, diamond=0;
  let water=55; // 0..100
  let keepGreen=0; // วินาทีที่อยู่โซนเขียวต่อเนื่อง

  // helpers
  function clamp(n,a,b){ return Math.max(a, Math.min(b,n)); }
  function setWater(n){ water = clamp(n,0,100); try{ setWaterGauge(water); }catch(_){} }
  function mult(){ return feverActive ? 2 : 1; }
  function syncDeckStats(){
    deck.stats = deck.stats || {};
    deck.stats.score=score; deck.stats.combo=combo;
    deck.stats.star=star; deck.stats.diamond=diamond; deck.stats.feverCount=feverCount;
    deck.stats.keepGreen=keepGreen;
    deck.updateScore && deck.updateScore(score);
    deck.updateCombo && deck.updateCombo(combo);
  }
  function gainFever(n){
    fever = clamp(fever+n, 0, 100); try{ setFever(fever); }catch(_){}
    if (!feverActive && fever>=100){ feverActive=true; try{ setFeverActive(true);}catch(_){}; feverCount++; deck.onFeverStart && deck.onFeverStart(); }
  }
  function decayFever(base){
    const d = feverActive ? 10 : base;
    const was = feverActive;
    fever = clamp(fever-d, 0, 100); try{ setFever(fever); }catch(_){}
    if (was && fever<=0){ feverActive=false; try{ setFeverActive(false);}catch(_){} }
  }
  function pushQuestHUD(hint){
    let mini=null, cur=deck.getCurrent?deck.getCurrent():null;
    if (cur){
      const prog=deck.getProgress?deck.getProgress():[];
      let now=null; for(let i=0;i<prog.length;i++){ if(prog[i] && prog[i].id===cur.id){ now=prog[i]; break; } }
      mini={ label:cur.label, prog:(now&&isFinite(now.prog)?now.prog:0), target:(now&&isFinite(now.target)?now.target:((now&&now.done)?1:0)) };
    }
    try{ window.dispatchEvent(new CustomEvent('hha:quest',{detail:{goal:goalObj(score),mini}})); }catch(_){}
    questHUDUpdate(deck, hint||(`Wave ${wave}`));
  }
  function captureWave(){
    const progList = deck.getProgress?deck.getProgress():[];
    for (let i=0;i<progList.length;i++){
      const q=progList[i]; if(!q) continue;
      questHistory.push({ label:q.label, level:q.level, done:!!q.done,
        prog:(typeof q.prog==='number'?q.prog:0), target:(typeof q.target==='number'?q.target:0), wave });
    }
  }

  // ---- judge ----
  function judge(ch, ctx){
    const cx = (ctx && (ctx.clientX??ctx.cx))|0;
    const cy = (ctx && (ctx.clientY??ctx.cy))|0;
    const burst=(theme)=>{try{Particles.burstShards(null,null,{screen:{x:cx,y:cy},theme});}catch(_){}};
    const pop=(txt,pos)=>{try{Particles.scorePop(cx,cy,String(txt),!!pos);}catch(_){}};

    if (ch===STAR){ const d=35*mult(); score+=d; star++; gainFever(10);  burst('hydration'); pop('+'+d,true); syncDeckStats(); pushQuestHUD(); return {good:true,scoreDelta:d}; }
    if (ch===DIA){  const d=70*mult(); score+=d; diamond++; gainFever(28); burst('groups');    pop('+'+d,true); syncDeckStats(); pushQuestHUD(); return {good:true,scoreDelta:d}; }
    if (ch===SHIELD){ shield=Math.min(3,shield+1); try{ setShield(shield);}catch(_){}
      shieldTotal++; const d=18; score+=d; burst('goodjunk'); pop('+'+d,true); syncDeckStats(); pushQuestHUD(); return {good:true,scoreDelta:d}; }
    if (ch===FIRE){ feverActive=true; try{ setFeverActive(true);}catch(_){}
      fever=Math.max(fever,60); try{ setFever(fever);}catch(_){}
      const d=20; score+=d; burst('plate'); pop('+'+d,true); syncDeckStats(); pushQuestHUD(); return {good:true,scoreDelta:d}; }

    const isWater = WATER.includes(ch);
    if (isWater){
      const add = (diff==='easy'?8:(diff==='hard'?5:6));
      setWater(water + add);
      const base=16+combo*2, delta=base*mult();
      score+=delta; combo+=1; gainFever(7+combo*0.5);
      deck.onGood && deck.onGood(); burst('hydration'); pop('+'+delta,true);
      syncDeckStats(); pushQuestHUD();
      return { good:true, scoreDelta:delta };
    } else {
      if (shield>0){ shield=Math.max(0,shield-1); try{ setShield(shield);}catch(_){}
        burst('plate'); pop('0',false); pushQuestHUD(); return {good:false,scoreDelta:0}; }
      const sub = (diff==='easy'?6:(diff==='hard'?10:8));
      setWater(water - sub);
      const delta=-12; score=Math.max(0,score+delta); combo=0; decayFever(16);
      deck.stats=deck.stats||{}; deck.stats.noMissTime=0; deck.onJunk && deck.onJunk();
      burst('groups'); pop(String(delta),false); syncDeckStats(); pushQuestHUD();
      return { good:false, scoreDelta:delta };
    }
  }

  // ---- expiry/time/hit handlers ----
  function onExpire(ev){
    if (!ev) return;
    if (ev.isGood){ deck.stats=deck.stats||{}; deck.stats.noMissTime=0; decayFever(6); }
    else { gainFever(4); deck.onJunk && deck.onJunk(); }
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
  function onSec(){
    // น้ำเข้าสู่สมดุลช้า ๆ
    if (water>55) setWater(water-1); else if (water<55) setWater(water+1);
    // นับเวลา GREEN zone
    keepGreen += (zoneFrom(water)==='GREEN') ? 1 : 0;
    // ลด Fever
    decayFever(combo<=0?6:2);
    deck.second && deck.second(); syncDeckStats(); pushQuestHUD('Wave '+wave);
  }

  try{
    window.addEventListener('hha:hit-screen', onHitScreen);
    window.addEventListener('hha:expired',    onExpire);
    window.addEventListener('hha:time',       onSec);
  }catch(_){}

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
    const goalOK   = (score>=GOAL_SCORE); // ใช้เกณฑ์เดียวกับโหมดอื่นให้ overlay แสดงได้เสมอ

    // ส่งออกให้ main.js/result overlay
    window.dispatchEvent(new CustomEvent('hha:end',{detail:{
      mode:'hydration', difficulty:diff, score,
      comboMax, misses, hits, duration:dur,
      goalCleared:goalOK, goalTarget:GOAL_SCORE,
      questsCleared, questsTotal, questsSummary,
      miniQuests:questsSummary, quests:questsSummary, questsDone:questsCleared, quests_total:questsTotal,
      keepGreen, shieldTotal
    }}));
  }

  // start factory
  return factoryBoot({
    difficulty:diff, duration:dur,
    pools:{ good: WATER.concat(BONUS), bad: DRY.slice() },
    goodRate:0.60, powerups:BONUS, powerRate:0.08, powerEvery:7,
    judge:(ch,ctx)=>judge(ch,{ cx:(ctx?.clientX??ctx?.cx), cy:(ctx?.clientY??ctx?.cy) }),
    onExpire
  }).then(ctrl=>{
    try{
      window.addEventListener('hha:time', e=>{
        const sec = (e && e.detail && e.detail.sec!=null) ? (e.detail.sec|0) : 0;
        if (sec<=0) endSummary();
      });
    }catch(_){}
    return ctrl;
  });
}

export default { boot };
