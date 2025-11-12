// === /HeroHealth/modes/groups.safe.js (2025-11-12 stable) ===
// Food Groups — เก็บอาหาร 5 หมู่ (โปรตีน/ผัก/ผลไม้/ธัญพืช/นม) หลบของล่อ + Fever/PowerUps
// - Goal: ทำคะแนนให้ถึงเป้าตามระดับ
// - Mini Quests: สุ่ม 3 ใบ/รอบ (Wave) จากพูล 10 ใบ เติมใหม่เมื่อเคลียร์ครบ
// - ส่ง hha:quest ตลอดเกมเพื่ออัปเดต HUD และสรุปผลด้วย hha:end

import { boot as factoryBoot } from '../vr/mode-factory.js';
import { MissionDeck } from '../vr/mission.js';
import { questHUDInit, questHUDUpdate, questHUDDispose } from '../vr/quest-hud.js';
import { ensureFeverBar, setFever, setFeverActive, setShield } from '../vr/ui-fever.js';
import { Particles } from '../vr/particles.js';

export async function boot(cfg = {}) {
  const diff = String(cfg.difficulty || 'normal');
  const dur  = Number(cfg.duration   || 60);

  // ----- หมวดอาหาร 5 หมู่ -----
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

  // ----- Goal คะแนนตามระดับ -----
  const GOAL_SCORE = (diff==='easy') ? 450 : (diff==='hard' ? 900 : 650);

  // ----- Mini-Quests (10 ใบ → สุ่ม 3/รอบ) -----
  const pool10 = [
    { id:'g_combo15', level:'hard',   label:'คอมโบ 15',            check:s=>s.comboMax>=15,  prog:s=>Math.min(15,s.comboMax),  target:15 },
    { id:'g_score700',level:'normal', label:'คะแนน 700+',          check:s=>s.score>=700,    prog:s=>Math.min(700,s.score),    target:700 },
    { id:'g_protein4',level:'normal', label:'โปรตีน 4 ชิ้น',        check:s=>s.cat_protein>=4,prog:s=>Math.min(4,s.cat_protein), target:4 },
    { id:'g_veggie5', level:'hard',   label:'ผัก 5 ชิ้น',           check:s=>s.cat_veggie>=5, prog:s=>Math.min(5,s.cat_veggie), target:5 },
    { id:'g_fruit4',  level:'normal', label:'ผลไม้ 4 ชิ้น',         check:s=>s.cat_fruit>=4,  prog:s=>Math.min(4,s.cat_fruit),  target:4 },
    { id:'g_grain3',  level:'easy',   label:'ธัญพืช 3 ชิ้น',        check:s=>s.cat_grain>=3,  prog:s=>Math.min(3,s.cat_grain),  target:3 },
    { id:'g_dairy2',  level:'easy',   label:'นม/ชีส 2 ชิ้น',        check:s=>s.cat_dairy>=2,  prog:s=>Math.min(2,s.cat_dairy),  target:2 },
    { id:'g_nomiss12',level:'normal', label:'ไม่พลาด 12 วินาที',    check:s=>s.noMissTime>=12,prog:s=>Math.min(12,s.noMissTime), target:12 },
    { id:'g_star2',   level:'hard',   label:'⭐ 2 ดวง',              check:s=>s.star>=2,       prog:s=>Math.min(2,s.star),       target:2 },
    { id:'g_diamond1',level:'hard',   label:'💎 1 เม็ด',             check:s=>s.diamond>=1,    prog:s=>Math.min(1,s.diamond),    target:1 },
  ];

  // ----- HUD & Deck -----
  ensureFeverBar(); setFever(0); setShield(0);
  const deck = new MissionDeck({ pool: pool10 }); deck.draw3();
  questHUDInit();

  let wave=1, totalQuestsCleared=0; const questHistory=[];
  function toCat(e){
    if (CAT.protein.has(e)) return 'protein';
    if (CAT.veggie.has(e))  return 'veggie';
    if (CAT.fruit.has(e))   return 'fruit';
    if (CAT.grain.has(e))   return 'grain';
    if (CAT.dairy.has(e))   return 'dairy';
    return null;
  }

  // ----- สถานะคะแนน/คอมโบ/Fever/นับรายหมู่ -----
  let score=0, combo=0, shield=0;
  let fever=0, feverActive=false;
  let star=0, diamond=0;
  const catCount = { protein:0, veggie:0, fruit:0, grain:0, dairy:0 };

  function mult(){ return feverActive?2:1; }
  function gainFever(n){ fever=Math.max(0,Math.min(100,fever+n)); setFever(fever); if(!feverActive&&fever>=100){feverActive=true; setFeverActive(true);} }
  function decayFever(base){ const d=feverActive?10:base; fever=Math.max(0,fever-d); setFever(fever); if(feverActive&&fever<=0){feverActive=false; setFeverActive(false);} }
  function syncStats(){
    deck.stats = deck.stats||{};
    deck.stats.score=score; deck.stats.combo=combo;
    deck.stats.cat_protein=catCount.protein;
    deck.stats.cat_veggie =catCount.veggie;
    deck.stats.cat_fruit  =catCount.fruit;
    deck.stats.cat_grain  =catCount.grain;
    deck.stats.cat_dairy  =catCount.dairy;
    deck.stats.star=star; deck.stats.diamond=diamond;
    deck.updateScore && deck.updateScore(score);
    deck.updateCombo && deck.updateCombo(combo);
  }

  // ----- HUD: goal + mini -----
  function pushQuest(hint){
    const cur = deck.getCurrent && deck.getCurrent();
    let mini=null;
    if (cur){
      const p=(deck.getProgress && deck.getProgress())||[];
      const now=p.find(x=>x && x.id===cur.id) || {};
      mini = { label:cur.label, prog:(+now.prog||0), target:(+now.target||((now.done)?1:0)) };
    }
    const goal = { label:`ทำคะแนนให้ถึงเป้า (${diff})`, prog:score, target:GOAL_SCORE };
    window.dispatchEvent(new CustomEvent('hha:quest',{detail:{goal, mini}}));
    questHUDUpdate(deck, hint||`Wave ${wave}`);
  }
  function captureWave(){
    const p=(deck.getProgress && deck.getProgress())||[];
    p.forEach(q=>{
      if(!q) return;
      questHistory.push({ label:q.label, level:q.level, done:!!q.done,
        prog:(+q.prog||0), target:(+q.target||0), wave });
    });
  }

  // ----- การตัดสินเมื่อคลิก -----
  function judge(ch, ctx){
    const cx=(ctx.clientX??ctx.cx)|0, cy=(ctx.clientY??ctx.cy)|0;
    const burst=(theme)=>{ try{ Particles.burstShards(null,null,{screen:{x:cx,y:cy},theme}); }catch{} }

    // Power-ups
    if (ch===STAR){ const d=35*mult(); score+=d; gainFever(10); star++; burst('groups'); syncStats(); pushQuest(); return {good:true,scoreDelta:d}; }
    if (ch===DIA){  const d=70*mult(); score+=d; gainFever(28); diamond++; burst('plate'); syncStats(); pushQuest(); return {good:true,scoreDelta:d}; }
    if (ch===SHIELD){ shield=Math.min(3,shield+1); setShield(shield); score+=18; burst('hydration'); syncStats(); pushQuest(); return {good:true,scoreDelta:18}; }
    if (ch===FIRE){ feverActive=true; setFeverActive(true); fever=Math.max(fever,60); setFever(fever); score+=20; burst('goodjunk'); syncStats(); pushQuest(); return {good:true,scoreDelta:20}; }

    const cat = toCat(ch);
    if (cat){ // ของดี
      const delta=(16 + combo*2) * mult();
      score+=delta; combo+=1; gainFever(7 + combo*0.5);
      catCount[cat] = (catCount[cat]||0) + 1;
      deck.onGood && deck.onGood(); syncStats(); burst('groups'); pushQuest();
      return { good:true, scoreDelta:delta };
    } else {  // ของล่อ
      if (shield>0){ shield--; setShield(shield); burst('groups'); pushQuest(); return {good:false,scoreDelta:0}; }
      const delta=-12; score=Math.max(0,score+delta); combo=0; decayFever(16);
      deck.onJunk && deck.onJunk(); syncStats(); burst('plate'); pushQuest();
      return { good:false, scoreDelta:delta };
    }
  }

  function onExpire(ev){
    if (!ev || ev.isGood) return;
    // หลีกของล่อได้ → โบนัสเล็กน้อย
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

  // ----- สรุปผลเมื่อหมดเวลา -----
  function endSummary(){
    try{
      window.removeEventListener('hha:hit-screen', onHitScreen);
      window.removeEventListener('hha:expired',    onExpire);
      window.removeEventListener('hha:time',       onSec);
    }catch{}
    const cur=(deck.getProgress && deck.getProgress())||[];
    const curSum = cur.map(q=>q?({label:q.label,level:q.level,done:!!q.done,prog:(+q.prog||0),target:(+q.target||0),wave}):null).filter(Boolean);
    const questsSummary = questHistory.concat(curSum);
    const questsCleared = questsSummary.filter(q=>q.done).length;
    const questsTotal   = questsSummary.length;

    questHUDDispose();

    const comboMax = deck.stats?.comboMax||0;
    const misses   = deck.stats?.junkMiss||0;
    const hits     = deck.stats?.goodCount||0;

    window.dispatchEvent(new CustomEvent('hha:end',{detail:{
      mode:'groups', difficulty:diff, score, comboMax, misses, hits, duration:dur,
      goalCleared: score >= GOAL_SCORE,
      goalTargetScore: GOAL_SCORE,
      questsCleared, questsTotal,
      questsSummary,
      // aliases for compatibility
      miniQuests: questsSummary, quests: questsSummary, questsDone: questsCleared, quests_total: questsTotal
    }}));
  }

  return factoryBoot({
    difficulty: diff,
    duration:   dur,
    pools:      { good: GOOD.concat(BONUS), bad: LURE.slice() },
    goodRate:   0.65,
    powerups:   BONUS,
    powerRate:  0.08,
    powerEvery: 7,
    judge:      (ch,ctx)=>judge(ch,{ cx:(ctx?.clientX??ctx?.cx), cy:(ctx?.clientY??ctx?.cy) }),
    onExpire
  }).then(ctrl=>{
    window.addEventListener('hha:time', e=>{ const s=e?.detail?.sec|0; if(s<=0) endSummary(); });
    // เริ่มต้น HUD ครั้งแรก
    pushQuest(`Wave ${wave}`);
    return ctrl;
  });
}

export default { boot };
