// === /HeroHealth/modes/plate.safe.js (2025-11-12 stable) ===
// Healthy Plate — โควตาต่อหมู่ + Mini Quests (สุ่ม 3 ต่อ wave, เติมได้) + Fever/Power-ups
import { boot as factoryBoot } from '../vr/mode-factory.js';
import { MissionDeck } from '../vr/mission.js';
import { questHUDInit, questHUDUpdate, questHUDDispose } from '../vr/quest-hud.js';
import { ensureFeverBar, setFever, setFeverActive, setShield } from '../vr/ui-fever.js';
import { Particles } from '../vr/particles.js';

export async function boot(cfg = {}) {
  const diff = String(cfg.difficulty || 'normal');
  const dur  = Number(cfg.duration   || 60);

  // ----- หมวดอาหาร -----
  const CAT = {
    protein : new Set(['🥩','🥚','🐟','🍗','🫘']),
    veggie  : new Set(['🥦','🥕','🥬','🍅','🌽','🍆']),
    fruit   : new Set(['🍎','🍌','🍇','🍊','🍓','🍍','🥝','🍐']),
    grain   : new Set(['🍚','🍞','🥖','🌾','🥐']),
    dairy   : new Set(['🥛','🧀'])
  };
  const ALL = ['protein','veggie','fruit','grain','dairy'];
  const GOOD = [...CAT.protein, ...CAT.veggie, ...CAT.fruit, ...CAT.grain, ...CAT.dairy];
  const LURE = ['🍔','🍟','🍕','🍩','🍪','🧁','🥤','🧋','🍫','🌭','🍰','🍬'];

  // ----- Power-ups -----
  const STAR='⭐', DIA='💎', SHIELD='🛡️', FIRE='🔥';
  const BONUS=[STAR,DIA,SHIELD,FIRE];

  // ----- โควตาต่อหมู่ตาม diff -----
  const QUOTAS = {
    easy   : { protein:2, veggie:3, fruit:3, grain:2, dairy:1 },
    normal : { protein:3, veggie:3, fruit:3, grain:3, dairy:2 },
    hard   : { protein:4, veggie:4, fruit:4, grain:3, dairy:2 },
  };
  const GOAL = QUOTAS[diff] || QUOTAS.normal;
  const catCount = { protein:0, veggie:0, fruit:0, grain:0, dairy:0 };
  const goalTargetUnits = Object.values(GOAL).reduce((a,b)=>a+b,0);

  const toCat = (e)=>{
    if (CAT.protein.has(e)) return 'protein';
    if (CAT.veggie.has(e))  return 'veggie';
    if (CAT.fruit.has(e))   return 'fruit';
    if (CAT.grain.has(e))   return 'grain';
    if (CAT.dairy.has(e))   return 'dairy';
    return null;
  };
  const goalProgressUnits = ()=>ALL.reduce((s,k)=>s+Math.min(catCount[k],GOAL[k]),0);
  const goalCleared = ()=>ALL.every(k=>catCount[k]>=GOAL[k]);
  const goalBreakdown = ()=>ALL.map(k=>({cat:k,have:catCount[k],need:GOAL[k]}));

  // ----- Mini-Quests (10 ใบ → สุ่ม 3) -----
  const pool10 = [
    { id:'p_combo12',  level:'normal', label:'คอมโบ 12',            check:s=>s.comboMax>=12,   prog:s=>Math.min(12,s.comboMax),   target:12 },
    { id:'p_score450', level:'hard',   label:'คะแนนรวม 450+',        check:s=>s.score>=450,     prog:s=>Math.min(450,s.score),     target:450 },
    { id:'p_protein3', level:'easy',   label:'โปรตีน 3 ชิ้น',         check:s=>s.cat_protein>=3, prog:s=>Math.min(3,s.cat_protein), target:3 },
    { id:'p_veggie4',  level:'normal', label:'ผัก 4 ชิ้น',            check:s=>s.cat_veggie>=4,  prog:s=>Math.min(4,s.cat_veggie),  target:4 },
    { id:'p_fruit4',   level:'normal', label:'ผลไม้ 4 ชิ้น',         check:s=>s.cat_fruit>=4,   prog:s=>Math.min(4,s.cat_fruit),   target:4 },
    { id:'p_grain3',   level:'easy',   label:'ธัญพืช 3 ชิ้น',         check:s=>s.cat_grain>=3,   prog:s=>Math.min(3,s.cat_grain),   target:3 },
    { id:'p_dairy2',   level:'easy',   label:'นม/ชีส 2 ชิ้น',         check:s=>s.cat_dairy>=2,   prog:s=>Math.min(2,s.cat_dairy),   target:2 },
    { id:'p_nomiss15', level:'normal', label:'ไม่พลาด 15 วินาที',     check:s=>s.noMissTime>=15, prog:s=>Math.min(15,s.noMissTime), target:15 },
    { id:'p_star2',    level:'hard',   label:'⭐ 2 ดวง',              check:s=>s.star>=2,        prog:s=>Math.min(2,s.star),        target:2 },
    { id:'p_diamond1', level:'hard',   label:'💎 1 เม็ด',             check:s=>s.diamond>=1,     prog:s=>Math.min(1,s.diamond),     target:1 },
  ];

  // ----- HUD & Deck -----
  ensureFeverBar(); setFever(0); setShield(0);
  const deck = new MissionDeck({ pool: pool10 }); deck.draw3();
  let wave=1, totalQuestsCleared=0; const questHistory=[];

  questHUDInit();

  function pushQuest(hint){
    const cur = deck.getCurrent && deck.getCurrent();
    let mini=null;
    if (cur){
      const p = (deck.getProgress && deck.getProgress()) || [];
      const now = p.find(x=>x && x.id===cur.id) || {};
      mini = { label:cur.label, prog:(+now.prog||0), target:(+now.target||((now.done)?1:0)) };
    }
    const goal = {
      label: `จัดครบตามโควตา (ระดับ: ${diff})`,
      prog:  goalProgressUnits(),
      target: goalTargetUnits,
      breakdown: goalBreakdown()
    };
    window.dispatchEvent(new CustomEvent('hha:quest',{detail:{goal, mini}}));
    questHUDUpdate(deck, hint || `Wave ${wave}`);
  }
  function captureWave(){
    const prog = (deck.getProgress && deck.getProgress())||[];
    prog.forEach(q=>{
      if(!q) return;
      questHistory.push({ label:q.label, level:q.level, done:!!q.done,
        prog:(+q.prog||0), target:(+q.target||0), wave });
    });
  }

  // ----- คะแนน/คอมโบ/Fever -----
  let score=0, combo=0, shield=0;
  let fever=0, feverActive=false;
  let star=0, diamond=0;

  function mult(){ return feverActive?2:1; }
  function gainFever(n){
    fever=Math.max(0,Math.min(100,fever+n)); setFever(fever);
    if(!feverActive && fever>=100){ feverActive=true; setFeverActive(true); }
  }
  function decayFever(base){
    const d=feverActive?10:base; fever=Math.max(0,fever-d); setFever(fever);
    if(feverActive && fever<=0){ feverActive=false; setFeverActive(false); }
  }
  function syncStats(){
    deck.stats = deck.stats||{};
    deck.stats.score=score; deck.stats.combo=combo;
    deck.stats.cat_protein = catCount.protein;
    deck.stats.cat_veggie  = catCount.veggie;
    deck.stats.cat_fruit   = catCount.fruit;
    deck.stats.cat_grain   = catCount.grain;
    deck.stats.cat_dairy   = catCount.dairy;
    deck.stats.star=star; deck.stats.diamond=diamond;
    deck.updateScore && deck.updateScore(score);
    deck.updateCombo && deck.updateCombo(combo);
  }

  function judge(ch, ctx){
    const cx=(ctx.clientX??ctx.cx)|0, cy=(ctx.clientY??ctx.cy)|0;
    const burst=(theme)=>{try{Particles.burstShards(null,null,{screen:{x:cx,y:cy},theme});}catch{}}

    // Power-ups
    if (ch===STAR){ const d=40*mult(); score+=d; gainFever(10); star++; burst('plate'); syncStats(); pushQuest(); return {good:true,scoreDelta:d}; }
    if (ch===DIA){  const d=80*mult(); score+=d; gainFever(30); diamond++; burst('groups'); syncStats(); pushQuest(); return {good:true,scoreDelta:d}; }
    if (ch===SHIELD){ shield=Math.min(3,shield+1); setShield(shield); score+=20; burst('hydration'); syncStats(); pushQuest(); return {good:true,scoreDelta:20}; }
    if (ch===FIRE){ feverActive=true; setFeverActive(true); fever=Math.max(fever,60); setFever(fever); score+=25; burst('goodjunk'); syncStats(); pushQuest(); return {good:true,scoreDelta:25}; }

    const cat = toCat(ch);
    if (cat){ // good
      const delta = (18 + combo*2) * mult();
      score+=delta; combo+=1; gainFever(7 + combo*0.55);
      if (catCount[cat] < GOAL[cat]) catCount[cat]++; // นับไม่เกินโควตา
      deck.onGood && deck.onGood();
      syncStats(); burst('plate'); pushQuest();
      return { good:true, scoreDelta:delta };
    } else {   // lure
      if (shield>0){ shield--; setShield(shield); burst('plate'); pushQuest(); return {good:false, scoreDelta:0}; }
      const delta=-14; score=Math.max(0,score+delta); combo=0; decayFever(18);
      deck.onJunk && deck.onJunk(); syncStats(); burst('groups'); pushQuest();
      return { good:false, scoreDelta:delta };
    }
  }

  function onExpire(ev){
    if (!ev || ev.isGood) return;
    gainFever(4); deck.onJunk && deck.onJunk(); syncStats(); pushQuest(`Wave ${wave}`);
  }
  function refillIfCleared(){
    if (deck.isCleared && deck.isCleared()){
      captureWave(); totalQuestsCleared += 3;
      deck.draw3 && deck.draw3();
      pushQuest(`Wave ${++wave}`);
    }
  }
  function onHitScreen(){ pushQuest(`Wave ${wave}`); refillIfCleared(); }
  function onSec(){ decayFever(combo<=0?6:2); deck.second && deck.second(); syncStats(); pushQuest(`Wave ${wave}`); }

  window.addEventListener('hha:hit-screen', onHitScreen);
  window.addEventListener('hha:expired',    onExpire);
  window.addEventListener('hha:time',       onSec);

  function endSummary(){
    try{
      window.removeEventListener('hha:hit-screen', onHitScreen);
      window.removeEventListener('hha:expired',    onExpire);
      window.removeEventListener('hha:time',       onSec);
    }catch{}
    const cur = (deck.getProgress && deck.getProgress())||[];
    const curSum = cur.map(q=>q?({label:q.label,level:q.level,done:!!q.done,prog:(+q.prog||0),target:(+q.target||0),wave}):null).filter(Boolean);
    const questsSummary = questHistory.concat(curSum);
    const questsCleared = questsSummary.filter(q=>q.done).length;
    const questsTotal   = questsSummary.length;

    questHUDDispose();

    const comboMax = deck.stats?.comboMax||0;
    const misses   = deck.stats?.junkMiss||0;
    const hits     = deck.stats?.goodCount||0;

    // รายงานครบชุด (มี field สำรองเพื่อความเข้ากันได้)
    window.dispatchEvent(new CustomEvent('hha:end',{detail:{
      mode:'plate', difficulty:diff, score, comboMax, misses, hits, duration:dur,
      goalCleared: goalCleared(),
      goalProgressUnits: goalProgressUnits(),
      goalTargetUnits,
      goalBreakdown: goalBreakdown(),
      questsCleared, questsTotal,
      questsSummary,                 // ใช้โดย overlay รุ่นใหม่
      miniQuests: questsSummary,     // alias เผื่อโค้ดเก่า
      quests:       questsSummary,   // alias เผื่อโค้ดเก่า
      questsDone:   questsCleared,   // alias
      quests_total: questsTotal      // alias
    }}));
  }

  return factoryBoot({
    difficulty: diff,
    duration:   dur,
    pools:      { good: GOOD.concat(BONUS), bad: LURE.slice() },
    goodRate:   0.62,
    powerups:   BONUS,
    powerRate:  0.08,
    powerEvery: 7,
    judge:      (ch,ctx)=>judge(ch,{ cx:(ctx?.clientX??ctx?.cx), cy:(ctx?.clientY??ctx?.cy) }),
    onExpire
  }).then(ctrl=>{
    window.addEventListener('hha:time', e=>{ const s=e?.detail?.sec|0; if(s<=0) endSummary(); });
    return ctrl;
  });
}
export default { boot };
