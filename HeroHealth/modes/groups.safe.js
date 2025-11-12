// === /HeroHealth/modes/groups.safe.js (2025-11-13 dynamic focus 1→3 + toast) ===
import { boot as factoryBoot } from '../vr/mode-factory.js';
import { MissionDeck } from '../vr/mission.js';
import { ensureFeverBar, setFever, setFeverActive, setShield } from '../vr/ui-fever.js';
import { Particles } from '../vr/particles.js';

export async function boot(cfg = {}) {
  const diff = String(cfg.difficulty || 'normal');
  const dur  = Number(cfg.duration || 60);

  // Cat pools
  const PRO  = ['🥩','🥚','🐟','🍗','🫘'];
  const VEG  = ['🥦','🥕','🥬','🍅','🌽','🍆'];
  const FRU  = ['🍎','🍌','🍇','🍊','🍓','🍍','🥝','🍐'];
  const GRA  = ['🍚','🍞','🥖','🌾','🥐'];
  const DAIR = ['🥛','🧀'];
  const CATS = { protein:PRO, veggie:VEG, fruit:FRU, grain:GRA, dairy:DAIR };
  const ALLC = Object.keys(CATS);

  // Lures
  const LURE = ['🥤','🧋','🍰','🍩','🍫','🍔','🍟','🌭'];

  const STAR='⭐', DIA='💎', SHIELD='🛡️', FIRE='🔥';
  const BONUS=[STAR,DIA,SHIELD,FIRE];

  ensureFeverBar(); setFever(0); setShield(0);

  // Wave & focus logic
  let wave=1, focusN = 1;             // start with 1 cat focus
  let waveStreak=0;                    // consecutive clear waves
  let focusCats = pickCats(focusN);

  function pickCats(n){
    const arr=[...ALLC]; const out=[];
    for(let i=0;i<n && arr.length;i++){ out.push(arr.splice((Math.random()*arr.length)|0,1)[0]); }
    return out;
  }
  function focusLabel(){ return focusCats.map(k=>cap(k)).join(', '); }
  function cap(s){ return s.charAt(0).toUpperCase()+s.slice(1); }

  // Goal units per wave (per cat) based on diff
  const PER_CAT = (diff==='easy'? 2 : (diff==='hard'? 4 : 3));
  let catCount = { protein:0, veggie:0, fruit:0, grain:0, dairy:0 };

  // MissionDeck (only minis here)
  const G = { score:s=>s.score|0, combo:s=>s.comboMax|0, miss:s=>s.junkMiss|0, good:s=>s.goodCount|0, tick:s=>s.tick|0 };
  const MINI_POOL = [
    { id:'m_combo12', label:'คอมโบต่อเนื่อง 12', target:12,  check:s=>G.combo(s)>=12, prog:s=>Math.min(12,G.combo(s)) },
    { id:'m_score900',label:'ทำคะแนนรวม 900+',  target:900, check:s=>G.score(s)>=900, prog:s=>Math.min(900,G.score(s)) },
    { id:'m_score1500',label:'ทำคะแนนรวม 1500+',target:1500,check:s=>G.score(s)>=1500,prog:s=>Math.min(1500,G.score(s)) },
    { id:'m_good16',  label:'เก็บของดี 16 ชิ้น', target:16,  check:s=>G.good(s)>=16,   prog:s=>Math.min(16,G.good(s)) },
    { id:'m_under6',  label:'พลาดไม่เกิน 6 ครั้ง',target:0,  check:s=>G.miss(s)<=6,    prog:s=>Math.max(0,6-G.miss(s)) },
    { id:'m_time25',  label:'อยู่รอดเกิน 25 วิ',  target:25,  check:s=>G.tick(s)>=25,  prog:s=>Math.min(25,G.tick(s)) },
    { id:'m_star2',   label:'เก็บ ⭐ 2 ดวง',       target:2,   check:s=> (s.star|0)>=2, prog:s=>Math.min(2,s.star|0) },
    { id:'m_dia1',    label:'เก็บ 💎 1 เม็ด',      target:1,   check:s=> (s.diamond|0)>=1, prog:s=>Math.min(1,s.diamond|0) },
    { id:'m_combo18', label:'คอมโบต่อเนื่อง 18',  target:18,  check:s=>G.combo(s)>=18, prog:s=>Math.min(18,G.combo(s)) },
    { id:'m_good24',  label:'เก็บของดี 24 ชิ้น',  target:24,  check:s=>G.good(s)>=24,  prog:s=>Math.min(24,G.good(s)) },
  ];
  const deck = new MissionDeck({ miniPool: MINI_POOL });
  deck.draw3();

  function goalUnitsHave(){ return focusCats.reduce((a,k)=> a + Math.min(catCount[k], PER_CAT), 0); }
  function goalUnitsNeed(){ return focusCats.length * PER_CAT; }
  function goalClearedWave(){ return goalUnitsHave() >= goalUnitsNeed(); }

  function pushQuest(){
    const mini = deck.getProgress('mini');
    const focusMini = mini.find(m=>!m.done) || mini[0] || null;
    const goal = {
      label: `โฟกัสหมู่: ${focusLabel()} (รอบ ${wave})`,
      prog: goalUnitsHave(),
      target: goalUnitsNeed()
    };
    const payload = { goal, mini:focusMini };
    window.dispatchEvent(new CustomEvent('hha:quest',{detail:payload}));
    window.dispatchEvent(new CustomEvent('quest:update',{detail:payload}));
  }

  // State
  let score=0, combo=0, shield=0, fever=0, feverActive=false;
  let star=0, diamond=0;

  const mult = ()=> feverActive ? 2 : 1;
  function gainFever(n){ fever=Math.max(0,Math.min(100,fever+n)); setFever(fever); if(!feverActive&&fever>=100){feverActive=true; setFeverActive(true);} }
  function decayFever(base){ const d=feverActive?10:base; fever=Math.max(0,fever-d); setFever(fever); if(feverActive&&fever<=0){feverActive=false; setFeverActive(false);} }
  function syncDeck(){ deck.updateScore(score); deck.updateCombo(combo); deck.stats.star=star; deck.stats.diamond=diamond; }

  function isFocusEmoji(ch){
    for(const k of focusCats){ if (CATS[k].includes(ch)) return k; }
    return null;
  }

  function judge(ch, ctx){
    const x = ctx.clientX||ctx.cx, y = ctx.clientY||ctx.cy;

    if (ch===STAR){ const d=35*mult(); score+=d; star++; gainFever(10);
      Particles.burstShards(null,null,{screen:{x,y},theme:'groups'}); Particles.scorePop({x,y,delta:d});
      deck.onGood(); syncDeck(); pushQuest(); return {good:true,scoreDelta:d}; }
    if (ch===DIA){  const d=70*mult(); score+=d; diamond++; gainFever(28);
      Particles.burstShards(null,null,{screen:{x,y},theme:'groups'}); Particles.scorePop({x,y,delta:d});
      deck.onGood(); syncDeck(); pushQuest(); return {good:true,scoreDelta:d}; }
    if (ch===SHIELD){ shield=Math.min(3, shield+1); setShield(shield); const d=18; score+=d;
      Particles.burstShards(null,null,{screen:{x,y},theme:'hydration'}); Particles.scorePop({x,y,delta:d});
      deck.onGood(); syncDeck(); pushQuest(); return {good:true,scoreDelta:d}; }
    if (ch===FIRE){ feverActive=true; setFeverActive(true); fever=Math.max(fever,60); setFever(fever); const d=20; score+=d;
      Particles.burstShards(null,null,{screen:{x,y},theme:'plate'}); Particles.scorePop({x,y,delta:d});
      deck.onGood(); syncDeck(); pushQuest(); return {good:true,scoreDelta:d}; }

    const cat = isFocusEmoji(ch);
    if (cat){
      const d = (18 + combo*2)*mult();
      score += d; combo += 1; deck.onGood(); syncDeck();
      if (catCount[cat] < PER_CAT) catCount[cat]++; // count up to target
      gainFever(7 + combo*0.55);
      Particles.burstShards(null,null,{screen:{x,y},theme:'groups'}); Particles.scorePop({x,y,delta:d});
      pushQuest();
      return { good:true, scoreDelta:d };
    } else if (LURE.includes(ch)){
      if (shield>0){ shield-=1; setShield(shield);
        Particles.burstShards(null,null,{screen:{x,y},theme:'groups'}); Particles.scorePop({x,y,delta:0});
        syncDeck(); pushQuest(); return {good:false,scoreDelta:0}; }
      const d=-14; score=Math.max(0,score+d); combo=0; deck.onJunk(); syncDeck();
      decayFever(18);
      Particles.burstShards(null,null,{screen:{x,y},theme:'groups'}); Particles.scorePop({x,y,delta:d});
      pushQuest();
      return { good:false, scoreDelta:d };
    } else {
      // good emoji not in focus: ให้คะแนนน้อยลงเล็กน้อย (soft hint)
      if (Object.values(CATS).some(arr=>arr.includes(ch))){
        const d = (8 + combo)*mult();
        score += d; combo += 1; deck.onGood(); syncDeck();
        gainFever(4 + combo*0.3);
        Particles.burstShards(null,null,{screen:{x,y},theme:'groups'}); Particles.scorePop({x,y,delta:d});
        pushQuest();
        return { good:true, scoreDelta:d };
      }
      // unknown -> treat as lure
      const d=-10; score=Math.max(0,score+d); combo=0; deck.onJunk(); syncDeck();
      Particles.scorePop({x,y,delta:d}); pushQuest(); return {good:false,scoreDelta:d};
    }
  }

  function onExpire(ev){
    if (!ev || ev.isGood) return; // bad expired → good (avoid), but do not increment miss
    gainFever(4); syncDeck(); pushQuest();
  }

  function maybeLevelUp(){
    if (goalClearedWave()){
      waveStreak++;
      // เลื่อนระดับทุก 2 wave ที่เคลียร์ติดกัน
      if (waveStreak>=2 && focusN<3){
        focusN++; focusCats = pickCats(focusN);
        waveStreak=0;
        window.dispatchEvent(new CustomEvent('hha:toast',{detail:`โฟกัสเพิ่มเป็น ${focusN} หมู่!`}));
      }else{
        // เปลี่ยนหมู่โฟกัส (แม้ไม่เลื่อนระดับ) เพื่อความสดใหม่
        focusCats = pickCats(focusN);
      }
      // reset progress per wave
      catCount = { protein:0, veggie:0, fruit:0, grain:0, dairy:0 };
      wave++;
      pushQuest();
    }
  }

  function onSec(){
    decayFever(combo<=0?6:2);
    deck.second(); syncDeck(); pushQuest();
    if (deck.isCleared('mini')){ deck.draw3(); pushQuest(); }
    maybeLevelUp();
  }

  window.addEventListener('hha:expired', onExpire);
  window.addEventListener('hha:time', (e)=>{ if((e.detail?.sec|0)>=0) onSec(); });

  return factoryBoot({
    difficulty: diff,
    duration  : dur,
    pools     : { good:[...PRO,...VEG,...FRU,...GRA,...DAIR,...BONUS], bad:[...LURE] },
    goodRate  : (diff==='easy'?0.68:(diff==='hard'?0.55:0.60)),
    powerups  : BONUS,
    powerRate : (diff==='easy'?0.10:(diff==='hard'?0.08:0.09)),
    powerEvery: 7,
    lifeMs    : (diff==='easy'?2300:(diff==='hard'?1700:2000)),
    baseGap   : (diff==='easy'?420:(diff==='hard'?280:340)),
    maxOnScreen: (diff==='easy'?4:(diff==='hard'?6:5)),
    judge     : (ch, ctx)=>judge(ch, { ...ctx, cx:(ctx.clientX||ctx.cx), cy:(ctx.clientY||ctx.cy) }),
    onExpire
  }).then(ctrl=>{
    window.addEventListener('hha:time', (e)=>{
      if((e.detail?.sec|0)<=0){
        const miniProg = deck.getProgress('mini');
        const goalCleared = goalClearedWave(); // สถานะล่าสุดของ wave
        window.dispatchEvent(new CustomEvent('hha:end',{detail:{
          mode:'Food Groups', difficulty:diff, score,
          comboMax:deck.stats.comboMax, misses:deck.stats.junkMiss, hits:deck.stats.goodCount,
          duration:dur, goalCleared,
          questsCleared: miniProg.filter(m=>m.done).length,
          questsTotal  : deck.miniPresented
        }}));
      }
    });
    pushQuest();
    return ctrl;
  });
}
export default { boot };
