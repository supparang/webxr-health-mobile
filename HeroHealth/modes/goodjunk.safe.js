// === /HeroHealth/modes/goodjunk.safe.js (2025-11-12 GOALS+QUEST+SCORE-POP) ===
import { boot as factoryBoot } from '../vr/mode-factory.js';
import { MissionDeck } from '../vr/mission.js';
import { questHUDInit, questHUDUpdate, questHUDDispose } from '../vr/quest-hud.js';
import { ensureFeverBar, setFever, setFeverActive, setShield } from '../vr/ui-fever.js';
import { Particles } from '../vr/particles.js';

export async function boot(cfg = {}) {
  const diff = String(cfg.difficulty || 'normal');
  const dur  = Number(cfg.duration || 60);

  // ----- Pools -----
  const GOOD = ['🥦','🥕','🍎','🍌','🥗','🐟','🥜','🍚','🍞','🥛','🍇','🍓','🍊','🍅','🍆','🥬','🥝','🍍','🍐','🍑'];
  const JUNK = ['🍔','🍟','🌭','🍕','🍩','🍪','🍰','🧋','🥤','🍫','🍬'];
  const STAR='⭐', DIA='💎', SHIELD='🛡️', FIRE='🔥';
  const BONUS=[STAR,DIA,SHIELD,FIRE];

  // ----- HUD base -----
  ensureFeverBar(); setFever(0); setShield(0);
  questHUDInit();

  // ----- Stats -----
  let score=0, combo=0, comboMax=0, shield=0;
  let fever=0, feverActive=false, feverEnter=0;
  let goodHit=0, junkAvoid=0, star=0, diamond=0;
  let noMissTime=0;    // นับวินาทีที่ไม่โดน Junk
  let lastSecSeen=-1;

  function mult(){ return feverActive ? 2 : 1; }
  function gainFever(n){ fever = Math.max(0, Math.min(100, fever + n)); setFever(fever); if(!feverActive && fever>=100){ feverActive=true; setFeverActive(true); feverEnter++; } }
  function decayFever(base){ const d = feverActive ? 10 : base; fever = Math.max(0, fever - d); setFever(fever); if (feverActive && fever<=0){ feverActive=false; setFeverActive(false); } }

  // ----- Goals (5 from 10) -----
  const GOAL_POOL = [
    // id, label, target resolver by diff, progress getter, checker
    { id:'g_collect_good',   label:(t)=>`เก็บของดีให้ได้ ${t} ชิ้น`,
      target:(d)=> d==='easy'?14 : d==='hard'?22 : 20,
      prog:()=>goodHit,  done:(t)=>goodHit>=t },
    { id:'g_combo',          label:(t)=>`คอมโบสูงสุด ≥ ${t}`,
      target:(d)=> d==='easy'?8 : d==='hard'?16 : 12,
      prog:()=>comboMax, done:(t)=>comboMax>=t },
    { id:'g_avoid_junk',     label:(t)=>`หลีกของขยะให้ได้ ${t} ครั้ง`,
      target:(d)=> d==='easy'?8 : d==='hard'?14 : 10,
      prog:()=>junkAvoid, done:(t)=>junkAvoid>=t },
    { id:'g_star',           label:(t)=>`เก็บดาว ⭐ ให้ได้ ${t} ดวง`,
      target:(d)=> d==='easy'?1 : d==='hard'?3 : 2,
      prog:()=>star,      done:(t)=>star>=t },
    { id:'g_diamond',        label:(t)=>`เก็บเพชร 💎 ให้ได้ ${t} เม็ด`,
      target:(d)=> d==='easy'?1 : d==='hard'?2 : 1,
      prog:()=>diamond,   done:(t)=>diamond>=t },
    { id:'g_fever_enter',    label:(t)=>`เข้า Fever ${t} ครั้ง`,
      target:(d)=> d==='easy'?1 : d==='hard'?3 : 2,
      prog:()=>feverEnter,done:(t)=>feverEnter>=t },
    { id:'g_no_miss_time',   label:(t)=>`ไม่พลาดต่อเนื่อง ${t}s`,
      target:(d)=> d==='easy'?8 : d==='hard'?15 : 12,
      prog:()=>noMissTime,done:(t)=>noMissTime>=t },
    { id:'g_score',          label:(t)=>`ทำคะแนนรวมให้ได้ ${t}`,
      target:(d)=> d==='easy'?600 : d==='hard'?1200 : 900,
      prog:()=>score,     done:(t)=>score>=t },
    { id:'g_shield',         label:(t)=>`สะสมโล่ 🛡️ ให้ได้ ${t} อัน (ระหว่างเกม)`,
      target:(d)=> d==='easy'?1 : d==='hard'?3 : 2,
      prog:()=>Math.max(0,shield), done:(t)=>shield>=t },
    { id:'g_hit_streak',     label:(t)=>`เก็บของดีติดกัน ${t} ครั้ง`,
      target:(d)=> d==='easy'?8 : d==='hard'?18 : 12,
      prog:()=>combo,    done:(t)=>combo>=t },
  ];
  function pickN(arr, n){
    const a=[...arr]; for(let i=a.length-1;i>0;i--){ const j=(Math.random()*(i+1))|0; [a[i],a[j]]=[a[j],a[i]]; }
    return a.slice(0,n);
  }
  const GOALS = pickN(GOAL_POOL.map(g=>{
    const t = g.target(diff);
    return { ...g, targetVal:t, labelText:g.label(t) };
  }), 5);
  let goalIdx = 0; // โชว์ทีละเป้า
  function currentGoal(){ return GOALS[goalIdx] || null; }
  function goalMeta(){ return { cleared: Math.min(goalIdx, GOALS.length), total: GOALS.length }; }

  // ----- Mini quests (3 from 10, refill) -----
  const deck = new MissionDeck({ pool: [
    { id:'q_combo10', label:'คอมโบ ≥ 10', target:10,   prog:()=>combo,      done:()=>combo>=10 },
    { id:'q_combo15', label:'คอมโบ ≥ 15', target:15,   prog:()=>combo,      done:()=>combo>=15 },
    { id:'q_fever1',  label:'เข้า Fever 1 ครั้ง', target:1, prog:()=>feverEnter, done:()=>feverEnter>=1 },
    { id:'q_star2',   label:'เก็บดาว ⭐ 2', target:2,   prog:()=>star,       done:()=>star>=2 },
    { id:'q_great20', label:'เก็บของดี 20', target:20, prog:()=>goodHit,    done:()=>goodHit>=20 },
    { id:'q_avoid6',  label:'หลีกของขยะ 6', target:6, prog:()=>junkAvoid,  done:()=>junkAvoid>=6 },
    { id:'q_score800',label:'คะแนนถึง 800', target:800,prog:()=>score,      done:()=>score>=800 },
    { id:'q_dia1',    label:'เพชร 💎 1',   target:1,   prog:()=>diamond,    done:()=>diamond>=1 },
    { id:'q_shield1', label:'โล่ 🛡️ 1',    target:1,   prog:()=>Math.max(0,shield), done:()=>shield>=1 },
    { id:'q_nomiss8', label:'ไม่พลาด 8s',  target:8,   prog:()=>noMissTime, done:()=>noMissTime>=8 },
  ]});
  function drawMini3(){ deck.draw3(); }
  drawMini3();

  // ----- Push HUD -----
  function pushQuest(goalHint){
    const g = currentGoal();
    const goalPack = g ? {
      label : g.labelText,
      prog  : g.prog(),
      target: g.targetVal,
      meta  : goalMeta()
    } : null;

    // current mini = ใบแรกที่ยังไม่จบ
    const progList = deck.getProgress();
    const curMini = progList.find(x=>!x.done) || progList[0] || null;
    const miniPack = curMini ? {
      label : curMini.label,
      prog  : curMini.prog ?? curMini.progVal ?? curMini.progress ?? 0,
      target: curMini.target ?? 0
    } : null;

    window.dispatchEvent(new CustomEvent('hha:quest',{ detail:{ goal:goalPack, mini:miniPack } }));
    questHUDUpdate(deck, goalHint || '');
  }

  // ----- Judge & events -----
  function onGoodClick(cx, cy){
    const base  = 18 + combo*2;
    const delta = base * mult();
    score += delta; combo += 1; comboMax = Math.max(comboMax, combo);
    gainFever(7 + combo*0.5);
    goodHit++;
    Particles.scorePop(cx, cy, `+${delta|0}`);
    Particles.burstShards(null, null, { screen:{x:cx,y:cy}, emoji:'💥', size:36 });
  }
  function onJunkClick(cx, cy){
    if (shield>0){ shield -= 1; setShield(shield); Particles.burstShards(null, null, { screen:{x:cx,y:cy}, emoji:'🛡️', size:34 }); return; }
    score = Math.max(0, score - 14);
    combo = 0;
    decayFever(18);
    Particles.scorePop(cx, cy, `-14`);
  }

  function judge(ch, ctx){
    const cx = ctx.cx ?? ctx.clientX, cy = ctx.cy ?? ctx.clientY;

    // Power-ups
    if (ch===STAR){ const d=40*mult(); score+=d; star++; gainFever(10);
      Particles.scorePop(cx, cy, `+${d|0}`); Particles.burstShards(null, null, { screen:{x:cx,y:cy}, emoji:'⭐' }); return {good:true, scoreDelta:d}; }
    if (ch===DIA){  const d=80*mult(); score+=d; diamond++; gainFever(30);
      Particles.scorePop(cx, cy, `+${d|0}`); Particles.burstShards(null, null, { screen:{x:cx,y:cy}, emoji:'💎' }); return {good:true, scoreDelta:d}; }
    if (ch===SHIELD){ shield=Math.min(3, shield+1); setShield(shield); score+=20;
      Particles.scorePop(cx, cy, `+20`); Particles.burstShards(null, null, { screen:{x:cx,y:cy}, emoji:'🛡️' }); return {good:true, scoreDelta:20}; }
    if (ch===FIRE){ feverActive=true; setFeverActive(true); fever=Math.max(fever,60); setFever(fever); score+=25;
      Particles.scorePop(cx, cy, `+25`); Particles.burstShards(null, null, { screen:{x:cx,y:cy}, emoji:'🔥' }); return {good:true, scoreDelta:25}; }

    if (GOOD.includes(ch)){ onGoodClick(cx,cy); deck.onGood(); pushQuest(); return {good:true, scoreDelta:0}; }
    if (JUNK.includes(ch)){ onJunkClick(cx,cy); deck.onJunk(); pushQuest(); return {good:false, scoreDelta:0}; }
    return {good:true, scoreDelta:1}; // default
  }

  function onExpire(ev){
    if (!ev) return;
    // ถ้าเป็น junk หมดอายุ = หลีกได้
    if (!ev.isGood){ junkAvoid++; deck.onJunk(); }
    pushQuest();
  }

  function onSec(e){
    const sec = e?.detail?.sec|0;
    if (sec !== lastSecSeen){
      lastSecSeen = sec;
      // no-miss time: รีเซ็ตเมื่อคอมโบ 0 จากการโดน junk
      if (combo>0) noMissTime = Math.min(99, noMissTime + 1);
      else noMissTime = Math.max(0, noMissTime - 1);

      // fever decay
      decayFever(combo<=0 ? 6 : 2);

      // อัปเดต deck internals ต่อวินาที
      deck.second();
      pushQuest();

      // เช็ค clear mini ทั้งชุด → เติมใหม่ถ้ามีเวลา
      if (deck.isCleared() && sec>5){ drawMini3(); pushQuest('Refill'); }
    }

    // เช็คเป้าหมายหลักปัจจุบัน
    const g = currentGoal();
    if (g && g.done(g.targetVal)) {
      goalIdx = Math.min(goalIdx + 1, GOALS.length);
      pushQuest(`Goal ${goalIdx}/${GOALS.length}`);
    }
  }

  window.addEventListener('hha:expired', onExpire);
  window.addEventListener('hha:time',    onSec);

  // เริ่มต้น
  setFever(0); setShield(0);
  pushQuest('start');

  // จบเกม → สรุปพร้อมส่งค่าที่ HUD ต้องใช้
  const onEnd = () => {
    try{
      window.removeEventListener('hha:expired', onExpire);
      window.removeEventListener('hha:time',    onSec);
      questHUDDispose();
      const clearedGoals = Math.min(goalIdx, GOALS.length);
      const progList = (deck.getProgress && deck.getProgress()) || [];
      const questsCleared = progList.filter(x=>x.done).length;
      window.dispatchEvent(new CustomEvent('hha:end',{detail:{
        mode:'Good vs Junk', difficulty:diff, score,
        comboMax, misses:0, hits:goodHit, duration:dur,
        goalCleared: clearedGoals>=GOALS.length,
        goalProgressUnits: clearedGoals, goalTargetUnits: GOALS.length,
        questsCleared, questsTotal: Math.max(3, progList.length)
      }}));
    }catch{}
  };

  return factoryBoot({
    difficulty: diff,
    duration  : dur,
    pools     : { good:[...GOOD, ...BONUS], bad:[...JUNK] },
    goodRate  : 0.62,
    powerups  : BONUS,
    powerRate : 0.08,
    powerEvery: 7,
    judge,
    onExpire
  }).then(ctrl=>{
    window.addEventListener('hha:time', (e)=>{ if((e.detail?.sec|0)<=0) onEnd(); });
    return ctrl;
  });
}
export default { boot };
