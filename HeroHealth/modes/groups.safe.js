// === /HeroHealth/modes/groups.safe.js (2025-11-13 adaptive focus + scorePop + toast) ===
import { boot as factoryBoot } from '../vr/mode-factory.js';
import { MissionDeck } from '../vr/mission.js';
import { ensureFeverBar, setFever, setFeverActive, setShield } from '../vr/ui-fever.js';
import { Particles } from '../vr/particles.js';

export async function boot(cfg = {}) {
  const diff = String(cfg.difficulty || 'normal');
  const dur  = Number(cfg.duration || 60);

  const GROUPS = ['🥩','🥚','🐟','🥛','🧀','🥦','🥕','🍅','🍇','🍌','🍚','🍞','🥜','🌽','🍠'];
  const LURE   = ['🥤','🧋','🍰','🍩','🍫','🍔','🍟','🌭'];
  const STAR='⭐', DIA='💎', SHIELD='🛡️', FIRE='🔥';
  const BONUS=[STAR,DIA,SHIELD,FIRE];

  ensureFeverBar(); setFever(0); setShield(0);

  // adaptive number of focus categories per round
  const baseFocus = (diff==='easy'?1:(diff==='hard'?3:2));
  let focusCount = baseFocus; // 1..3
  const maxFocus = 3;
  let roundGoodStreak = 0; // increase focus when player keeps doing good hits

  function toast(msg){
    try{
      const id='grpToast';
      let t=document.getElementById(id);
      if(!t){ t=document.createElement('div'); t.id=id; document.body.appendChild(t); }
      t.textContent=msg;
      t.style.cssText='position:fixed;left:50%;top:80px;transform:translateX(-50%);z-index:580;background:#111827cc;color:#e5e7eb;border:1px solid #334155;border-radius:12px;padding:8px 14px;font:800 12px system-ui;box-shadow:0 10px 30px rgba(0,0,0,.45)';
      setTimeout(()=>{ try{t.remove();}catch(_){}} , 900);
    }catch(_){}
  }

  function pickN(arr,n){
    const src=[...arr], out=[];
    for(let i=0;i<n && src.length;i++){ out.push(src.splice((Math.random()*src.length)|0,1)[0]); }
    return out;
  }

  // Build deck: goals = “collect X of current focus set”, mini uses general missions
  const MINI_POOL = [
    { id:'m_combo10',  label:'คอมโบต่อเนื่อง 10', level:'normal', target:10,  check:s=>s.comboMax>=10, prog:s=>Math.min(10,s.comboMax) },
    { id:'m_score700', label:'ทำคะแนนรวม 700+',  level:'easy',   target:700, check:s=>s.score>=700,   prog:s=>Math.min(700,s.score) },
    { id:'m_score1200',label:'ทำคะแนนรวม 1200+', level:'normal', target:1200,check:s=>s.score>=1200,  prog:s=>Math.min(1200,s.score) },
    { id:'m_good20',   label:'เก็บของดี 20 ชิ้น', level:'normal', target:20,  check:s=>s.goodCount>=20,prog:s=>Math.min(20,s.goodCount) },
    { id:'m_under6',   label:'พลาดไม่เกิน 6 ครั้ง', level:'normal', target:0, check:s=>s.junkMiss<=6,  prog:s=>Math.max(0,6-s.junkMiss) },
    { id:'m_star2',    label:'เก็บ ⭐ 2 ดวง',       level:'hard',   target:2,  check:s=>s.star>=2,      prog:s=>Math.min(2,s.star|0) },
    { id:'m_dia1',     label:'เก็บ 💎 1 เม็ด',      level:'hard',   target:1,  check:s=>s.diamond>=1,   prog:s=>Math.min(1,s.diamond|0) },
    { id:'m_time25',   label:'อยู่รอดเกิน 25 วินาที', level:'easy', target:25, check:s=>s.tick>=25,     prog:s=>Math.min(25,s.tick) },
    { id:'m_combo16',  label:'คอมโบสูงสุด ≥ 16',   level:'hard',   target:16, check:s=>s.comboMax>=16, prog:s=>Math.min(16,s.comboMax) },
    { id:'m_goodStreak',label:'ทำดีติดกัน 8 ครั้ง', level:'normal', target:8,  check:s=>s.combo>=8,     prog:s=>Math.min(8,s.combo) },
  ];
  const deck = new MissionDeck({ miniPool: MINI_POOL });
  deck.draw3();

  // dynamic goal from current focus set
  let focusSet = pickN(GROUPS, focusCount);
  let goalNeed = (diff==='easy'?8:(diff==='hard'?14:11));
  let goalHave = 0;
  function pushGoalMini(){
    const goal = {
      id:'g_focus',
      label:`โฟกัส: ${focusSet.join(' ')}  (เก็บให้ครบ ${goalNeed})`,
      target: goalNeed,
      prog: goalHave,
      check: ()=>goalHave>=goalNeed
    };
    const miniCur = deck.getCurrent('mini');
    const mini = miniCur ? miniCur : null;
    const data = {
      goal: { id:goal.id, label:goal.label, target:goal.target, prog:goal.prog, done:goal.check() },
      mini: mini
    };
    window.dispatchEvent(new CustomEvent('hha:quest',{detail:data}));
    window.dispatchEvent(new CustomEvent('quest:update',{detail:data}));
  }
  pushGoalMini();

  // state
  let score=0, combo=0, shield=0, fever=0, feverActive=false;
  let star=0, diamond=0;
  function mult(){ return feverActive ? 2 : 1; }
  function gainFever(n){ fever=Math.max(0,Math.min(100,fever+n)); setFever(fever); if(!feverActive && fever>=100){feverActive=true; setFeverActive(true);} }
  function decayFever(base){ const d=feverActive?10:base; fever=Math.max(0,fever-d); setFever(fever); if(feverActive && fever<=0){feverActive=false; setFeverActive(false);} }
  function syncDeck(){ deck.updateScore(score); deck.updateCombo(combo); deck.stats.star=star; deck.stats.diamond=diamond; }

  function levelUpIfReady(){
    // เพิ่มจำนวนหมู่ที่ต้องโฟกัสเมื่อผู้เล่นทำดีต่อเนื่อง (soft)
    if (roundGoodStreak>=8 && focusCount<maxFocus){
      focusCount++;
      focusSet = pickN(GROUPS, focusCount);
      goalNeed = Math.round(goalNeed * 1.15); // ยากขึ้นนิด
      toast(`โฟกัสเพิ่มเป็น ${focusCount} หมู่!`);
      roundGoodStreak = 0;
      pushGoalMini();
    }
  }

  function judge(ch, ctx){
    const x=ctx.clientX||ctx.cx, y=ctx.clientY||ctx.cy;

    // powerups
    if(ch===STAR){ const d=35*mult(); score+=d; gainFever(10); star++;
      Particles.burstShards(null,null,{screen:{x,y},theme:'groups'}); Particles.scorePop({x,y}, d);
      deck.onGood(); syncDeck(); pushGoalMini(); return {good:true,scoreDelta:d}; }
    if(ch===DIA){ const d=70*mult(); score+=d; gainFever(28); diamond++;
      Particles.burstShards(null,null,{screen:{x,y},theme:'groups'}); Particles.scorePop({x,y}, d);
      deck.onGood(); syncDeck(); pushGoalMini(); return {good:true,scoreDelta:d}; }
    if(ch===SHIELD){ shield=Math.min(3, shield+1); setShield(shield); const d=18;
      Particles.burstShards(null,null,{screen:{x,y},theme:'goodjunk'}); Particles.scorePop({x,y}, d);
      deck.onGood(); syncDeck(); pushGoalMini(); return {good:true,scoreDelta:d}; }
    if(ch===FIRE){ feverActive=true; setFeverActive(true); fever=Math.max(fever,60); setFever(fever); const d=20;
      Particles.burstShards(null,null,{screen:{x,y},theme:'plate'}); Particles.scorePop({x,y}, d);
      deck.onGood(); syncDeck(); pushGoalMini(); return {good:true,scoreDelta:d}; }

    const isFocus = GROUPS.includes(ch) && focusSet.includes(ch);
    const isGood  = GROUPS.includes(ch);

    if(isGood){
      const base=18 + combo*2;
      const delta = base * mult();
      score += delta; combo += 1; roundGoodStreak += 1;
      gainFever(7 + combo*0.55);
      if (isFocus){ goalHave = Math.min(goalNeed, goalHave+1); }
      deck.onGood(); syncDeck();
      Particles.burstShards(null,null,{screen:{x,y},theme:'groups'}); Particles.scorePop({x,y}, delta);
      pushGoalMini();
      levelUpIfReady();
      return { good:true, scoreDelta: delta };
    }else{
      if(shield>0){
        shield-=1; setShield(shield);
        Particles.burstShards(null,null,{screen:{x,y},theme:'groups'}); Particles.scorePop({x,y}, 0);
        syncDeck(); pushGoalMini(); return {good:false, scoreDelta:0};
      }
      const delta=-14;
      score=Math.max(0, score+delta); combo=0; roundGoodStreak=0;
      decayFever(18);
      deck.onJunk(); syncDeck();
      Particles.burstShards(null,null,{screen:{x,y},theme:'goodjunk'}); Particles.scorePop({x,y}, delta);
      pushGoalMini();
      return { good:false, scoreDelta: delta };
    }
  }

  function onExpire(ev){
    if(!ev || ev.isGood) return;
    // ล่อ (LURE) หมายถึงของไม่ดี → เลี่ยงสำเร็จเพิ่ม fever เล็กน้อย
    gainFever(4);
    deck.onJunk(); // นับเป็น "ไม่โดน" junk hit แต่ใช้สถิติเดียวกันเพื่อความง่าย
    syncDeck(); pushGoalMini();
  }
  function onSec(){
    if(combo<=0) decayFever(6); else decayFever(2);
    deck.second(); syncDeck(); pushGoalMini();
    if (deck.isCleared('mini')) { deck.draw3(); pushGoalMini(); }
    // หากทำครบ goal ปัจจุบันก่อนหมดเวลา → สุ่ม focus ใหม่ ยากขึ้นเล็กน้อย
    if (goalHave>=goalNeed){
      focusSet = pickN(GROUPS, focusCount);
      goalNeed = Math.round(goalNeed * 1.12);
      goalHave = 0;
      toast('ชุดโฟกัสใหม่!');
      pushGoalMini();
    }
  }
  window.addEventListener('hha:expired', onExpire);
  window.addEventListener('hha:time', (e)=>{ if((e.detail?.sec|0)>=0) onSec(); });

  return factoryBoot({
    difficulty: diff, duration: dur,
    pools:{ good:[...GROUPS, ...BONUS], bad:[...LURE] },
    goodRate:0.60, powerups:BONUS, powerRate:0.08, powerEvery:7,
    judge:(ch,ctx)=>judge(ch, { ...ctx, cx:(ctx.clientX||ctx.cx), cy:(ctx.clientY||ctx.cy) }),
    onExpire
  }).then(ctrl=>{
    window.addEventListener('hha:time', (e)=>{ if((e.detail?.sec|0)<=0){
      const goalCleared = goalHave>=Math.min(goalNeed, goalNeed); // cleared if last set complete
      window.dispatchEvent(new CustomEvent('hha:end',{detail:{
        mode:'Food Groups', difficulty:diff, score,
        comboMax:deck.stats.comboMax, misses:deck.stats.junkMiss, hits:deck.stats.goodCount,
        duration:dur, goalCleared,
        questsCleared: deck.getProgress('mini').filter(m=>m.done).length,
        questsTotal  : (deck.mini||[]).length
      }}));
    }});
    return ctrl;
  });
}
export default { boot };
