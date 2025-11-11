// === Good vs Junk — DOM spawn via mode-factory, with Goal + Mini Quests ===
import { boot as baseBoot } from '../vr/mode-factory.js';

export async function boot(cfg={}){
  const diff = String(cfg.difficulty||'normal');
  const dur  = Number(cfg.duration||60);

  // Pools
  const GOOD = ['🥦','🥕','🍎','🐟','🥛','🍊','🍌','🍇','🥬','🍚','🥜','🍞','🍓','🍍','🥝','🍐'];
  const JUNK = ['🍔','🍟','🍕','🍩','🍪','🧁','🥤','🧋','🍫','🌭','🍰','🍬'];
  const STAR='⭐', DIA='💎', SHIELD='🛡️';

  // Difficulty → rate
  const goodRate = (diff==='easy')?0.78:(diff==='hard')?0.62:0.70;

  // ---- Goal & Quests state ----
  const goalTarget = 25; // เก็บของดี 25 ชิ้น
  let goalProg = 0;

  // สุ่ม 3 mini quests
  const POOL = [
    { id:'g10', label:'เก็บของดี 10 ชิ้น', target:10, prog:0, check:s=>s.prog>=10 },
    { id:'combo10', label:'ทำคอมโบ 10', target:10, prog:0, check:s=>s.comboMax>=10 },
    { id:'dia1', label:'เก็บเพชร 💎 1 เม็ด', target:1, prog:0, check:s=>s.prog>=1, type:'diamond' },
    { id:'star3', label:'เก็บดาว ⭐ 3', target:3, prog:0, check:s=>s.prog>=3, type:'star' },
    { id:'nomiss10', label:'ไม่พลาด 10 วิ', target:10, prog:0, check:s=>s.noMiss>=10, type:'timer' }
  ];
  function draw3(){
    const a = POOL.slice().sort(()=>Math.random()-0.5).slice(0,3);
    // reset prog
    a.forEach(q=>{ q.prog=0; });
    return a;
  }
  let deck = draw3(); let qIdx = 0;
  function postQuest(){
    const q = deck[qIdx];
    window.dispatchEvent(new CustomEvent('hha:quest',{detail:{label:`Quest ${qIdx+1}/3 — ${q.label}`, prog:q.prog, target:q.target}}));
  }
  window.dispatchEvent(new CustomEvent('hha:goal',{detail:{label:`เป้า: เก็บของดีให้ได้ ${goalTarget} ชิ้น — คืบหน้า ${goalProg}/${goalTarget}`,progress:goalProg,target:goalTarget}}));
  postQuest();

  // timer for "no miss"
  let noMiss = 0; const noMissId = setInterval(()=>{ noMiss=Math.min(999,noMiss+1); },1000);

  // local highs
  let comboMax=0;

  // ---- judge hook ----
  function judge(ch, state){
    // specials
    if(ch===STAR){ deck.forEach(q=>{ if(q.type==='star'){ q.prog++; }}); postQuest(); return {good:true, scoreDelta:40}; }
    if(ch===DIA){  deck.forEach(q=>{ if(q.type==='diamond'){ q.prog++; }}); postQuest(); return {good:true, scoreDelta:80}; }
    if(ch===SHIELD){ return {good:true, scoreDelta:0}; }

    const isGood = GOOD.includes(ch);
    if(isGood){
      goalProg++; 
      window.dispatchEvent(new CustomEvent('hha:goal',{detail:{label:`เป้า: เก็บของดีให้ได้ ${goalTarget} ชิ้น — คืบหน้า ${goalProg}/${goalTarget}`,progress:goalProg,target:goalTarget}}));
      // quest progress tie-ins
      const q = deck[qIdx];
      if(q && q.id==='g10'){ q.prog++; postQuest(); }
      // combo max will be updated by state.combo later; track for quest
      comboMax = Math.max(comboMax, state.combo+1);
      checkQuestDone();
      noMiss = 0; // เก็บถือว่ารีเซ็ต "ไม่พลาด" หรือจะไม่นับก็ได้
      return {good:true, scoreDelta: 20 + state.combo*2};
    } else {
      // miss junk ⇒ noMiss reset
      noMiss = 0;
      // quest timer-based
      const tQ = deck[qIdx]; if(tQ && tQ.type==='timer'){ tQ.prog = 0; postQuest(); }
      return {good:false, scoreDelta:-15};
    }
  }

  function checkQuestDone(){
    // update combo-based quest
    const q = deck[qIdx];
    if(!q) return;
    if(q.id==='combo10') { q.prog = Math.max(q.prog, comboMax); }
    if(q.type==='timer') { q.prog = Math.max(q.prog, noMiss); }
    // done?
    if(q.prog>=q.target){
      qIdx++;
      if(qIdx>=3){
        // เคลียร์ครบ 3 → ถ้าเวลาเหลือ ให้สุ่มชุดใหม่
        deck = draw3(); qIdx = 0;
      }
      postQuest();
    }
  }

  // relay for score HUD (state ส่งมาจาก factory)
  window.addEventListener('hha:score', e=>{
    const d = e.detail||{};
    comboMax = Math.max(comboMax, d.combo||0);
    // timer quest tick
    const q = deck[qIdx]; if(q && q.type==='timer'){ q.prog = Math.max(q.prog, noMiss); postQuest(); }
  });

  // จบเกม → สรุป
  const onEnd = (e)=>{
    clearInterval(noMissId);
    const goalDone = goalProg>=goalTarget;
    window.dispatchEvent(new CustomEvent('hha:quest-summary',{detail:{
      mode:'Good vs Junk',
      score:e.detail?.score||0,
      combo:e.detail?.combo||0,
      goalDone,
      questsCleared:3, questsTotal:3
    }}));
    window.removeEventListener('hha:end', onEnd);
  };
  window.addEventListener('hha:end', onEnd, {once:true});

  // start base
  return baseBoot({
    difficulty: diff,
    duration: dur,
    goodRate,
    pools:{ good:GOOD, bad:JUNK, star:[STAR], diamond:[DIA], shield:[SHIELD] },
    judge
  });
}

export default { boot };