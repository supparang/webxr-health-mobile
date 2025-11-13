// === /HeroHealth/modes/plate.quest.js (2025-11-13 LATEST) ===
// โหมด Balanced Plate — เก็บอาหารให้ครบทั้ง 4 หมู่บนจานให้สมดุล
// - ใช้ MissionDeck วัดจำนวนแต่ละหมู่ + คะแนนรวม
// - ไม่ได้บังคับโฟกัสทีละหมู่เหมือน groups แต่เน้น "ครบและสมดุล"

import { boot as factoryBoot } from '../vr/mode-factory.js';
import { MissionDeck } from '../vr/mission.js';
import { ensureFeverBar, setFever, setFeverActive } from '../vr/ui-fever.js';
import { Particles } from '../vr/particles.js';

export async function boot(cfg = {}) {
  const diff = String(cfg.difficulty || 'normal');
  const dur  = Number(cfg.duration || 60);

  ensureFeverBar();
  setFever(0);
  setFeverActive(false);

  // ---------- Plate groups ----------
  // 1: ข้าว-แป้ง, 2: ผัก, 3: โปรตีน, 4: ผลไม้/นม
  const P = {
    1: ['🍚','🍙','🍞','🥖','🥐'],
    2: ['🥦','🥕','🥬','🥒','🍅'],
    3: ['🍗','🥩','🐟','🥚','🫘'],
    4: ['🍎','🍓','🍌','🍊','🥛','🧀']
  };
  const JUNK = ['🍔','🍟','🍕','🍩','🍪','🍫','🍬','🥤','🧋'];

  const ALL_GOOD = [...new Set(Object.values(P).flat())];
  const GROUP_BY_EMO = {};
  Object.keys(P).forEach(k=>{
    P[k].forEach(e=>{ GROUP_BY_EMO[e] = Number(k); });
  });

  // ---------- MissionDeck ----------
  const G = {
    score   : s => s.score     | 0,
    comboMax: s => s.comboMax  | 0,
    tick    : s => s.tick      | 0,
    miss    : s => s.junkMiss  | 0
  };

  const GOAL_POOL = [
    { id:'g_plateAll6', label:'เก็บอาหารแต่ละหมู่ ≥ 6 ชิ้น',
      target:6, level:'normal',
      check:s=>{
        const g = s.perGroup||{};
        return [1,2,3,4].every(k => (g[k]|0)>=6);
      },
      prog:s=>{
        const g=s.perGroup||{};
        const m=Math.min(...[1,2,3,4].map(k=>g[k]|0));
        return Math.min(6,m);
      }
    },

    { id:'g_plateCarb', label:'หมู่ข้าว-แป้ง ≥ 8 ชิ้น',
      target:8, level:'easy',
      check:s=>(s.perGroup?.[1]||0)>=8,
      prog:s=>Math.min(8,s.perGroup?.[1]||0)
    },

    { id:'g_plateVeg', label:'หมู่ผัก ≥ 8 ชิ้น',
      target:8, level:'easy',
      check:s=>(s.perGroup?.[2]||0)>=8,
      prog:s=>Math.min(8,s.perGroup?.[2]||0)
    },

    { id:'g_plateProtein', label:'หมู่โปรตีน ≥ 8 ชิ้น',
      target:8, level:'easy',
      check:s=>(s.perGroup?.[3]||0)>=8,
      prog:s=>Math.min(8,s.perGroup?.[3]||0)
    },

    { id:'g_plateFruit', label:'หมู่ผลไม้/นม ≥ 8 ชิ้น',
      target:8, level:'easy',
      check:s=>(s.perGroup?.[4]||0)>=8,
      prog:s=>Math.min(8,s.perGroup?.[4]||0)
    },

    { id:'g_score1600', label:'ทำคะแนนรวม 1600+',
      target:1600, level:'normal',
      check:s=>G.score(s)>=1600, prog:s=>Math.min(1600,G.score(s)) },

    { id:'g_score2200', label:'ทำคะแนนรวม 2200+',
      target:2200, level:'hard',
      check:s=>G.score(s)>=2200, prog:s=>Math.min(2200,G.score(s)) },

    { id:'g_combo18', label:'คอมโบสูงสุด ≥ 18',
      target:18, level:'hard',
      check:s=>G.comboMax(s)>=18, prog:s=>Math.min(18,G.comboMax(s)) },

    { id:'g_miss6', label:'เลือกของเสียไม่เกิน 6 ครั้ง',
      target:6, level:'normal',
      check:s=>G.miss(s)<=6, prog:s=>Math.min(6,G.miss(s)) },

    { id:'g_tick45', label:'อยู่รอด 45 วินาที',
      target:45, level:'easy',
      check:s=>G.tick(s)>=45, prog:s=>Math.min(45,G.tick(s)) }
  ];

  const MINI_POOL = [
    { id:'m_all3x4', label:'เก็บอาหารครบทั้ง 4 หมู่ หมู่ละ ≥ 3 ชิ้น',
      target:3, level:'normal',
      check:s=>{
        const g=s.perGroup||{};
        return [1,2,3,4].every(k => (g[k]|0)>=3);
      },
      prog:s=>{
        const g=s.perGroup||{};
        const m=Math.min(...[1,2,3,4].map(k=>g[k]|0));
        return Math.min(3,m);
      }
    },

    { id:'m_combo12', label:'คอมโบต่อเนื่อง 12',
      target:12, level:'normal',
      check:s=>G.comboMax(s)>=12, prog:s=>Math.min(12,G.comboMax(s)) },

    { id:'m_combo18', label:'คอมโบต่อเนื่อง 18',
      target:18, level:'hard',
      check:s=>G.comboMax(s)>=18, prog:s=>Math.min(18,G.comboMax(s)) },

    { id:'m_noJunk4', label:'เลือกของเสียไม่เกิน 4 ครั้ง',
      target:4, level:'hard',
      check:s=>G.miss(s)<=4, prog:s=>Math.min(4,G.miss(s)) },

    { id:'m_tick20', label:'อยู่รอด 20 วิ แรกแบบไม่พลาด',
      target:20, level:'easy',
      check:s=>G.tick(s)>=20 && G.miss(s)<=0,
      prog:s=>Math.min(20,G.tick(s)) }
  ];

  const deck = new MissionDeck({ goalPool:GOAL_POOL, miniPool:MINI_POOL });
  deck.drawGoals(5);
  deck.draw3();
  deck.stats.perGroup = {1:0,2:0,3:0,4:0};

  // ---------- Coach ----------
  function coachSay(key){
    let text='';
    switch(key){
      case 'start': text='จัดจานให้สมดุล เก็บให้ครบทั้ง 4 หมู่'; break;
      case 'veg':   text='ลองเพิ่มผักบนจานอีกหน่อย จะได้สีเขียวสวย ๆ'; break;
      case 'protein': text='อย่าลืมโปรตีน เช่น ปลา ไข่ ถั่ว'; break;
      case 'fruit': text='เติมผลไม้หรือแก้วนมเล็ก ๆ ให้จานสมบูรณ์'; break;
      case 'miss':  text='ของทอด/ขนมหวานเยอะไป ลองเลี่ยงดูหน่อย'; break;
    }
    if(!text) return;
    try{
      window.dispatchEvent(new CustomEvent('coach:line',{detail:{text,mode:'plate'}}));
    }catch(_){}
  }

  // ---------- Mode state ----------
  let score = 0;
  let combo = 0;
  let fever = 0;
  let feverActive = false;

  function mult(){ return feverActive?2:1; }

  function gainFever(n){
    fever = Math.max(0,Math.min(100,fever+n));
    setFever(fever);
    if(!feverActive && fever>=100){
      feverActive=true;
      setFeverActive(true);
    }
  }
  function decayFever(base){
    const d = feverActive?10:base;
    fever = Math.max(0,fever-d);
    setFever(fever);
    if(feverActive && fever<=0){
      feverActive=false;
      setFeverActive(false);
    }
  }

  function syncDeck(){
    deck.updateScore(score);
    deck.updateCombo(combo);
  }
  function emitCombo(){
    try{ window.dispatchEvent(new CustomEvent('hha:combo',{detail:{combo}})); }catch(_){}
  }

  function pushQuest(){
    const goals = deck.getProgress('goals');
    const minis = deck.getProgress('mini');
    window.dispatchEvent(new CustomEvent('quest:update',{
      detail:{
        goal:goals.find(g=>!g.done)||goals[0]||null,
        mini:minis.find(m=>!m.done)||minis[0]||null,
        goalsAll:goals,
        minisAll:minis
      }
    }));
  }

  // ---------- judge ----------
  function judge(emo, ctx){
    const x = ctx.clientX || ctx.cx || 0;
    const y = ctx.clientY || ctx.cy || 0;

    const g = GROUP_BY_EMO[emo] || 0;
    const isGood = !!g;
    const isJunk = JUNK.includes(emo);

    if(isGood){
      let base = 14;
      if(diff==='easy') base = 12;
      if(diff==='hard') base = 16;

      const delta = (base + combo*2) * mult();
      score += delta;
      combo++;
      emitCombo();
      gainFever(6 + combo*0.4);

      deck.onGood();
      deck.stats.perGroup[g] = (deck.stats.perGroup[g]||0)+1;
      syncDeck();

      Particles.burstShards(null,null,{screen:{x,y},theme:'plate'});
      Particles.scorePop?.(x,y,delta,{good:true});

      if(deck.stats.perGroup[2]===4) coachSay('veg');
      if(deck.stats.perGroup[3]===4) coachSay('protein');
      if(deck.stats.perGroup[4]===4) coachSay('fruit');

      pushQuest();
      return { good:true, scoreDelta:delta };
    }

    if(isJunk){
      let delta = -12;
      if(diff==='easy') delta=-9;
      if(diff==='hard') delta=-14;

      score = Math.max(0,score+delta);
      combo=0;
      emitCombo();
      decayFever(10);

      deck.onJunk();
      syncDeck();

      Particles.burstShards(null,null,{screen:{x,y},theme:'goodjunk'});
      Particles.scorePop?.(x,y,delta,{good:false});
      coachSay('miss');
      pushQuest();
      return { good:false, scoreDelta:delta };
    }

    // คลิกอื่น ๆ / miss
    return { good:false, scoreDelta:0 };
  }

  function onExpire(ev){
    if(!ev) return;
    // ของดีหายไป = พลาดเล็ก ๆ
    deck.onJunk();
    combo=0;
    emitCombo();
    decayFever(6);
    syncDeck();
    pushQuest();
  }

  function onSec(){
    if(combo<=0) decayFever(6); else decayFever(2);
    deck.second();
    syncDeck();
    pushQuest();
  }

  window.addEventListener('hha:time',(e)=>{
    const sec = (e.detail?.sec|0);
    if(sec>0) onSec();
    if(sec===0){
      const goals = deck.getProgress('goals');
      const minis = deck.getProgress('mini');
      const goalsCleared = goals.filter(g=>g.done).length;
      const goalCleared  = goalsCleared>0;
      const questsCleared = minis.filter(m=>m.done).length;

      window.dispatchEvent(new CustomEvent('hha:end',{
        detail:{
          mode       :'Balanced Plate',
          difficulty : diff,
          score,
          comboMax   : deck.stats.comboMax,
          misses     : deck.stats.junkMiss,
          hits       : deck.stats.goodCount,
          duration   : dur,
          goalCleared,
          goalsCleared,
          goalsTotal : goals.length,
          questsCleared,
          questsTotal: minis.length
        }
      }));
    }
  });

  const controller = await factoryBoot({
    difficulty: diff,
    duration  : dur,
    pools     : { good:ALL_GOOD, bad:JUNK },
    goodRate  : 0.7,
    judge,
    onExpire
  });

  pushQuest();
  coachSay('start');
  return controller;
}

export default { boot };