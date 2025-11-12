// === /HeroHealth/modes/plate.quest.js (LATEST) ===
// Healthy Plate with per-category quotas by difficulty + Mini quest 10 pool
import { boot as factoryBoot } from '../vr/mode-factory.js';
import { MissionDeck } from '../vr/mission.js';
import { ensureFeverBar, setFever, setFeverActive, setShield } from '../vr/ui-fever.js';
import { Particles } from '../vr/particles.js';

export async function boot(cfg = {}) {
  const diff = String(cfg.difficulty || 'normal');
  const dur  = Number(cfg.duration || 60);

  const CAT = {
    protein : new Set(['🥩','🥚','🐟','🍗','🫘']),
    veggie  : new Set(['🥦','🥕','🥬','🍅','🌽','🍆']),
    fruit   : new Set(['🍎','🍌','🍇','🍊','🍓','🍍','🥝','🍐']),
    grain   : new Set(['🍚','🍞','🥖','🌾','🥐']),
    dairy   : new Set(['🥛','🧀'])
  };
  const ALL = ['protein','veggie','fruit','grain','dairy'];
  const PLATE_GOOD = [...CAT.protein, ...CAT.veggie, ...CAT.fruit, ...CAT.grain, ...CAT.dairy];
  const LURE       = ['🍔','🍟','🍕','🍩','🍪','🧁','🥤','🧋','🍫','🌭','🍰','🍬'];

  const STAR='⭐', DIA='💎', SHIELD='🛡️', FIRE='🔥';
  const BONUS=[STAR,DIA,SHIELD,FIRE];

  const QUOTAS = {
    easy   : { protein:2, veggie:3, fruit:3, grain:2, dairy:1 },
    normal : { protein:3, veggie:3, fruit:3, grain:3, dairy:2 },
    hard   : { protein:4, veggie:4, fruit:4, grain:3, dairy:2 },
  };
  const GOALQ = QUOTAS[diff] || QUOTAS.normal;
  const targetUnits = Object.values(GOALQ).reduce((a,b)=>a+b,0);
  const cnt = { protein:0, veggie:0, fruit:0, grain:0, dairy:0 };

  function toCat(e){
    if (CAT.protein.has(e)) return 'protein';
    if (CAT.veggie.has(e))  return 'veggie';
    if (CAT.fruit.has(e))   return 'fruit';
    if (CAT.grain.has(e))   return 'grain';
    if (CAT.dairy.has(e))   return 'dairy';
    return null;
  }
  function goalUnits(){
    let s=0; for(const k of ALL) s += Math.min(cnt[k], GOALQ[k]); return s;
  }
  function goalCleared(){
    return ALL.every(k=>cnt[k] >= GOALQ[k]);
  }
  function goalBreakdown(){
    return ALL.map(k=>({cat:k, have:cnt[k], need:GOALQ[k]}));
  }

  ensureFeverBar(); setFever(0); setShield(0);

  const G = { score:s=>s.score|0, comboMax:s=>s.comboMax|0, good:s=>s.goodCount|0, junk:s=>s.junkMiss|0, tick:s=>s.tick|0 };
  const GOAL_POOL = [
    { id:'g_units11',   label:'จัดจานให้ครบหน่วยเป้า', level:diff, target:targetUnits, check:()=>goalCleared(), prog:()=>goalUnits() },
    { id:'g_good24',    label:'เก็บของดี 24 ชิ้น',      level:'easy',   target:24, check:s=>G.good(s)>=24,  prog:s=>Math.min(24,G.good(s)) },
    { id:'g_good30',    label:'เก็บของดี 30 ชิ้น',      level:'normal', target:30, check:s=>G.good(s)>=30,  prog:s=>Math.min(30,G.good(s)) },
    { id:'g_score1400', label:'ทำคะแนน 1400+',          level:'easy',   target:1400,check:s=>G.score(s)>=1400,prog:s=>Math.min(1400,G.score(s)) },
    { id:'g_score2000', label:'ทำคะแนน 2000+',          level:'normal', target:2000,check:s=>G.score(s)>=2000,prog:s=>Math.min(2000,G.score(s)) },
    { id:'g_combo16',   label:'คอมโบสูงสุด ≥ 16',       level:'normal', target:16,  check:s=>G.comboMax(s)>=16, prog:s=>Math.min(16,G.comboMax(s)) },
    { id:'g_time40',    label:'อยู่รอดเกิน 40 วินาที',  level:'easy',   target:40,  check:s=>G.tick(s)>=40,     prog:s=>Math.min(40,G.tick(s)) },
    { id:'g_nojunk6',   label:'พลาด ≤ 6 ครั้ง',         level:'normal', target:0,   check:s=>G.junk(s)<=6,      prog:s=>Math.max(0,6-G.junk(s)) },
    { id:'g_dairy2',    label:'เก็บนม/ชีส 2 ชิ้น',       level:'easy',   target:2,  check:()=>cnt.dairy>=2,     prog:()=>Math.min(2,cnt.dairy) },
    { id:'g_veggie4',   label:'เก็บผัก 4 ชิ้น',          level:'normal', target:4,  check:()=>cnt.veggie>=4,    prog:()=>Math.min(4,cnt.veggie) },
  ];

  const MINI_POOL = [
    { id:'m_combo12',   label:'คอมโบต่อเนื่อง 12', level:'normal', target:12, check:s=>G.comboMax(s)>=12,  prog:s=>Math.min(12,G.comboMax(s)) },
    { id:'m_combo18',   label:'คอมโบต่อเนื่อง 18', level:'hard',   target:18, check:s=>G.comboMax(s)>=18,  prog:s=>Math.min(18,G.comboMax(s)) },
    { id:'m_score900',  label:'ทำคะแนน 900+',      level:'easy',   target:900,check:s=>G.score(s)>=900,    prog:s=>Math.min(900,G.score(s)) },
    { id:'m_score1500', label:'ทำคะแนน 1500+',     level:'normal', target:1500,check:s=>G.score(s)>=1500,  prog:s=>Math.min(1500,G.score(s)) },
    { id:'m_good18',    label:'เก็บของดี 18',       level:'normal', target:18, check:s=>G.good(s)>=18,      prog:s=>Math.min(18,G.good(s)) },
    { id:'m_nomiss12',  label:'ไม่พลาด 12 วินาที',  level:'normal', target:12, check:s=>G.tick(s)>=12 && s.combo>0, prog:s=>Math.min(12,G.tick(s)) },
    { id:'m_star2',     label:'เก็บ ⭐ 2',           level:'hard',   target:2,  check:s=>s.star>=2,          prog:s=>Math.min(2,s.star|0) },
    { id:'m_dia1',      label:'เก็บ 💎 1',           level:'hard',   target:1,  check:s=>s.diamond>=1,       prog:s=>Math.min(1,s.diamond|0) },
    { id:'m_under6',    label:'พลาดไม่เกิน 6 ครั้ง', level:'normal', target:0,  check:s=>G.junk(s)<=6,       prog:s=>Math.max(0,6-G.junk(s)) },
    { id:'m_dairy2',    label:'เก็บหมวดนม 2',        level:'easy',   target:2,  check:()=>cnt.dairy>=2,      prog:()=>Math.min(2,cnt.dairy) },
  ];

  const deck = new MissionDeck({ goalPool: GOAL_POOL, miniPool: MINI_POOL });
  deck.drawGoals(5);
  deck.draw3();

  function pushQuest(hint){
    const goals = deck.getProgress('goals');
    const minis = deck.getProgress('mini');
    const focusGoal = goals.find(g=>!g.done) || goals[0] || null;
    const focusMini = minis.find(m=>!m.done) || minis[0] || null;
    window.dispatchEvent(new CustomEvent('quest:update', {
      detail: { goal: focusGoal, mini: focusMini, goalsAll: goals, minisAll: minis, hint }
    }));
  }

  // State
  let score=0, combo=0, shield=0, fever=0, feverActive=false;
  let star=0, diamond=0;

  function mult(){ return feverActive ? 2 : 1; }
  function gainFever(n){ fever=Math.max(0,Math.min(100,fever+n)); setFever(fever); if(!feverActive&&fever>=100){feverActive=true; setFeverActive(true);} }
  function decayFever(base){ const d=feverActive?10:base; fever=Math.max(0,fever-d); setFever(fever); if(feverActive&&fever<=0){feverActive=false; setFeverActive(false);} }
  function syncDeck(){ deck.updateScore(score); deck.updateCombo(combo); deck.stats.star=star; deck.stats.diamond=diamond; }

  function judge(ch, ctx){
    const x = ctx.clientX||ctx.cx, y = ctx.clientY||ctx.cy;
    if (ch==='⭐'){ const d=40*mult(); score+=d; star++; gainFever(10); syncDeck(); deck.onGood(); Particles.burstShards(null,null,{screen:{x,y},theme:'plate'}); Particles.scorePop(x,y,`+${d}`); pushQuest(); return {good:true,scoreDelta:d}; }
    if (ch==='💎'){ const d=80*mult(); score+=d; diamond++; gainFever(30); syncDeck(); deck.onGood(); Particles.burstShards(null,null,{screen:{x,y},theme:'groups'}); Particles.scorePop(x,y,`+${d}`); pushQuest(); return {good:true,scoreDelta:d}; }
    if (ch==='🛡️'){ shield=Math.min(3,shield+1); score+=20; setShield(shield); syncDeck(); deck.onGood(); Particles.burstShards(null,null,{screen:{x,y},theme:'hydration'}); Particles.scorePop(x,y,`+20`); pushQuest(); return {good:true,scoreDelta:20}; }
    if (ch==='🔥'){ feverActive=true; setFeverActive(true); fever=Math.max(fever,60); setFever(fever); score+=25; syncDeck(); deck.onGood(); Particles.burstShards(null,null,{screen:{x,y},theme:'goodjunk'}); Particles.scorePop(x,y,`+25`); pushQuest(); return {good:true,scoreDelta:25}; }

    const cat = toCat(ch);
    const isGood = !!cat;
    if (isGood){
      const base = 18 + combo*2;
      const delta = base*mult();
      score += delta; combo += 1;
      gainFever(7 + combo*0.55);
      if (cnt[cat] < GOALQ[cat]) cnt[cat]++;

      deck.onGood(); syncDeck();
      Particles.burstShards(null,null,{screen:{x,y},theme:'plate'});
      Particles.scorePop(x,y,`+${delta|0}`);
      pushQuest();
      return { good:true, scoreDelta:delta };
    }else{
      if (shield>0){ shield-=1; setShield(shield); syncDeck(); Particles.burstShards(null,null,{screen:{x,y},theme:'plate'}); pushQuest(); return {good:false, scoreDelta:0}; }
      const delta = -14;
      score = Math.max(0, score + delta); combo = 0;
      decayFever(18);
      deck.onJunk(); syncDeck();
      Particles.burstShards(null,null,{screen:{x,y},theme:'groups'});
      Particles.scorePop(x,y,`${delta}`);
      pushQuest();
      return { good:false, scoreDelta:delta };
    }
  }

  function onExpire(ev){
    if (!ev || ev.isGood) return;
    gainFever(4); deck.onJunk(); syncDeck(); pushQuest();
  }

  function perSecond(){
    decayFever(combo<=0 ? 6 : 2);
    deck.second(); syncDeck(); pushQuest();
    if (deck.isCleared('mini'))  { deck.draw3(); pushQuest('Mini ใหม่'); }
    if (deck.isCleared('goals')) { deck.drawGoals(5); pushQuest('Goal ใหม่'); }
  }

  window.addEventListener('hha:expired', onExpire);
  window.addEventListener('hha:time', (e)=>{ if((e.detail?.sec|0)>=0) perSecond(); });

  return factoryBoot({
    difficulty: diff,
    duration  : dur,
    pools     : { good:[...PLATE_GOOD, ...BONUS], bad:[...LURE] },
    goodRate  : 0.62,
    powerups  : BONUS,
    powerRate : 0.08,
    powerEvery: 7,
    judge     : (ch, ctx)=>judge(ch, { ...ctx, cx:(ctx.clientX||ctx.cx), cy:(ctx.clientY||ctx.cy) }),
    onExpire
  }).then(ctrl=>{
    window.addEventListener('hha:time', (e)=>{ if((e.detail?.sec|0)<=0){
      const goals = deck.getProgress('goals');
      const minis = deck.getProgress('mini');
      window.dispatchEvent(new CustomEvent('hha:end',{detail:{
        mode:'Healthy Plate', difficulty:diff, score,
        comboMax:deck.stats.comboMax, misses:deck.stats.junkMiss, hits:deck.stats.goodCount,
        duration:dur,
        goalCleared: goalCleared(),
        goalProgressUnits: goalUnits(),
        goalTargetUnits: targetUnits,
        goalBreakdown: goalBreakdown(),
        questsCleared: minis.filter(m=>m.done).length, questsTotal: deck.miniPresented|0
      }}));
    }});
    pushQuest('เริ่ม');
    return ctrl;
  });
}
export default { boot };
