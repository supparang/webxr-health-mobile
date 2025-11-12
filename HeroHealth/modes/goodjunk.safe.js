// === /HeroHealth/modes/goodjunk.safe.js (2025-11-12 goals+mini sequential + fever/power + hubUrl) ===
import { boot as factoryBoot } from '../vr/mode-factory.js';
import { ensureFeverBar, setFever, setFeverActive, setShield } from '../vr/ui-fever.js';
import { Particles } from '../vr/particles.js';

// ---------------- Pools ----------------
const GOOD = ['🥦','🥕','🍎','🍌','🥗','🐟','🥜','🍚','🍞','🥛','🍇','🍓','🍊','🍅','🍆','🥬','🥝','🍍','🍐','🍑'];
const JUNK = ['🍔','🍟','🌭','🍕','🍩','🍪','🍰','🧋','🥤','🍫','🍬'];
const STAR='⭐', DIA='💎', SHIELD='🛡️', FIRE='🔥';
const BONUS=[STAR,DIA,SHIELD,FIRE];

// Goals 10 ใบ/สุ่ม 5 ตามระดับ (โฟกัสทีละ 1)
const GOALS_POOL = {
  easy: [
    {id:'g_score300', label:'ทำคะแนน 300+', target:300, prog:s=>s.score},
    {id:'g_combo8',   label:'คอมโบ ≥ 8',    target:8,   prog:s=>s.comboMax},
    {id:'g_good12',   label:'เก็บของดี 12 ชิ้น', target:12, prog:s=>s.goodCount},
    {id:'g_nomiss10', label:'ไม่พลาด 10 วินาที', target:10, prog:s=>s.noMissTime},
    {id:'g_star1',    label:'เก็บดาว 1 ดวง', target:1, prog:s=>s.star},
    {id:'g_diamond1', label:'เก็บเพชร 1 เม็ด', target:1, prog:s=>s.diamond},
    {id:'g_shield1',  label:'เก็บโล่ 1 ชิ้น', target:1, prog:s=>s.shieldPick},
    {id:'g_fever1',   label:'เข้าสู่โหมด Fever 1 ครั้ง', target:1, prog:s=>s.feverEnter},
    {id:'g_streak15', label:'สะสมสตรีค 15', target:15, prog:s=>s.streak},
    {id:'g_time20',   label:'ผ่านเวลา 20s', target:20, prog:s=>s.time},
  ],
  normal: [
    {id:'g_score600', label:'ทำคะแนน 600+', target:600, prog:s=>s.score},
    {id:'g_combo12',  label:'คอมโบ ≥ 12',   target:12,  prog:s=>s.comboMax},
    {id:'g_good18',   label:'เก็บของดี 18 ชิ้น', target:18, prog:s=>s.goodCount},
    {id:'g_nomiss15', label:'ไม่พลาด 15 วินาที', target:15, prog:s=>s.noMissTime},
    {id:'g_star2',    label:'เก็บดาว 2 ดวง', target:2, prog:s=>s.star},
    {id:'g_diamond1', label:'เก็บเพชร 1 เม็ด', target:1, prog:s=>s.diamond},
    {id:'g_shield2',  label:'เก็บโล่ 2 ชิ้น', target:2, prog:s=>s.shieldPick},
    {id:'g_fever2',   label:'เข้าสู่โหมด Fever 2 ครั้ง', target:2, prog:s=>s.feverEnter},
    {id:'g_streak20', label:'สะสมสตรีค 20', target:20, prog:s=>s.streak},
    {id:'g_time40',   label:'ผ่านเวลา 40s', target:40, prog:s=>s.time},
  ],
  hard: [
    {id:'g_score900', label:'ทำคะแนน 900+', target:900, prog:s=>s.score},
    {id:'g_combo16',  label:'คอมโบ ≥ 16',   target:16,  prog:s=>s.comboMax},
    {id:'g_good24',   label:'เก็บของดี 24 ชิ้น', target:24, prog:s=>s.goodCount},
    {id:'g_nomiss20', label:'ไม่พลาด 20 วินาที', target:20, prog:s=>s.noMissTime},
    {id:'g_star3',    label:'เก็บดาว 3 ดวง', target:3, prog:s=>s.star},
    {id:'g_diamond2', label:'เก็บเพชร 2 เม็ด', target:2, prog:s=>s.diamond},
    {id:'g_shield3',  label:'เก็บโล่ 3 ชิ้น', target:3, prog:s=>s.shieldPick},
    {id:'g_fever3',   label:'เข้าสู่โหมด Fever 3 ครั้ง', target:3, prog:s=>s.feverEnter},
    {id:'g_streak25', label:'สะสมสตรีค 25', target:25, prog:s=>s.streak},
    {id:'g_time55',   label:'ผ่านเวลา 55s', target:55, prog:s=>s.time},
  ]
};

// Mini quests 10 ใบ/สุ่มทีละ 3 (ทำครบก่อนหมดเวลา → สุ่มชุดใหม่)
const MINI_POOL = [
  {id:'m_break5',  label:'หลีกของขยะ 5 ครั้ง',  target:5,  prog:s=>s.junkAvoid},
  {id:'m_combo10', label:'ทำคอมโบ 10',         target:10, prog:s=>s.comboMax},
  {id:'m_score500',label:'ทำคะแนนรวม 500+',    target:500,prog:s=>s.score},
  {id:'m_star2',   label:'เก็บดาว ⭐ 2 ดวง',     target:2,  prog:s=>s.star},
  {id:'m_dia1',    label:'เก็บเพชร 💎 1 เม็ด',   target:1,  prog:s=>s.diamond},
  {id:'m_good12',  label:'เก็บของดี 12 ชิ้น',    target:12, prog:s=>s.goodCount},
  {id:'m_noMiss10',label:'ไม่พลาด 10 วินาที',    target:10, prog:s=>s.noMissTime},
  {id:'m_shield2', label:'สะสมโล่ 2',           target:2,  prog:s=>s.shieldPick},
  {id:'m_fever',   label:'เข้า Fever 1 ครั้ง',    target:1,  prog:s=>s.feverEnter},
  {id:'m_time30',  label:'เล่นครบ 30 วินาที',    target:30, prog:s=>s.time}
];

function sampleN(arr, n){
  const a=[...arr]; const out=[];
  while(a.length && out.length<n){ out.push(a.splice((Math.random()*a.length)|0,1)[0]); }
  return out;
}

export async function boot(cfg = {}){
  const diff = String(cfg.difficulty || 'normal');
  const dur  = Number(cfg.duration  || 60);

  // HUD / fever
  ensureFeverBar(); setFever(0); setShield(0);

  // ---------- Stats ที่ใช้เช็คโปรเกรส ----------
  const S = {
    score:0, combo:0, comboMax:0,
    goodCount:0, junkHit:0, junkAvoid:0,
    star:0, diamond:0, shield:0, shieldPick:0,
    fever:0, feverEnter:0,
    time:0, noMissTime:0, streak:0
  };
  let feverActive=false;

  // ---------- Goal & Mini stacks ----------
  const goalsQueue = sampleN(GOALS_POOL[diff]||GOALS_POOL.normal, 5);
  let currentGoal = goalsQueue.shift(); let goalsCleared=0;

  let miniDeck   = sampleN(MINI_POOL, 3);
  let currentMini = miniDeck.shift();   // โฟกัสทีละ 1
  let minisCleared=0;

  function goalProgress(g){ return Math.min(g.target, Number(g.prog(S))|0); }
  function miniProgress(m){ return Math.min(m.target, Number(m.prog(S))|0); }
  function pushQuestUI(hint){
    const goal = currentGoal ? { label:currentGoal.label, prog:goalProgress(currentGoal), target:currentGoal.target } : null;
    const mini = currentMini ? { label:currentMini.label, prog:miniProgress(currentMini), target:currentMini.target } : null;
    window.dispatchEvent(new CustomEvent('hha:quest', { detail: { goal, mini, hint } }));
  }

  function mult(){ return feverActive ? 2 : 1; }
  function gainFever(n){
    S.fever = Math.max(0, Math.min(100, S.fever + n));
    setFever(S.fever);
    if (!feverActive && S.fever>=100){ feverActive=true; setFeverActive(true); S.feverEnter++; }
  }
  function decayFever(base){
    const d = feverActive ? 10 : base;
    S.fever = Math.max(0, S.fever - d); setFever(S.fever);
    if (feverActive && S.fever<=0){ feverActive=false; setFeverActive(false); }
  }

  function onGood(cx,cy,base=16){
    const delta = (base + S.combo*2) * mult();
    S.score += delta; S.combo += 1; S.comboMax = Math.max(S.comboMax, S.combo);
    S.goodCount += 1; S.streak += 1; S.noMissTime += 1; // noMiss จะรีเซ็ตเมื่อ miss
    gainFever(6 + S.combo*0.5);
    Particles.burstShards(null,null,{screen:{x:cx,y:cy},theme:'goodjunk'});
    Particles.scorePop(cx,cy,delta,true);
    return delta;
  }
  function onJunk(cx,cy){
    if (S.shield>0){ S.shield -= 1; setShield(S.shield); Particles.burstShards(null,null,{screen:{x:cx,y:cy},theme:'goodjunk'}); Particles.scorePop(cx,cy,0,false); return 0; }
    const delta = -12;
    S.score = Math.max(0, S.score + delta);
    S.combo = 0; S.streak = 0; S.noMissTime = 0;
    decayFever(16);
    S.junkHit += 1;
    Particles.burstShards(null,null,{screen:{x:cx,y:cy},theme:'goodjunk'});
    Particles.scorePop(cx,cy,delta,false);
    return delta;
  }

  function judge(ch, ctx){
    const cx = ctx.clientX ?? ctx.cx, cy = ctx.clientY ?? ctx.cy;

    // power-ups
    if (ch===STAR){ const d=35*mult(); S.score+=d; S.star++; gainFever(10); Particles.burstShards(null,null,{screen:{x:cx,y:cy}}); Particles.scorePop(cx,cy,d,true); return {good:true,scoreDelta:d}; }
    if (ch===DIA){  const d=70*mult(); S.score+=d; S.diamond++; gainFever(28); Particles.burstShards(null,null,{screen:{x:cx,y:cy}}); Particles.scorePop(cx,cy,d,true); return {good:true,scoreDelta:d}; }
    if (ch===SHIELD){ S.shield=Math.min(3,S.shield+1); S.shieldPick++; setShield(S.shield); Particles.burstShards(null,null,{screen:{x:cx,y:cy}}); Particles.scorePop(cx,cy,18,true); S.score+=18; return {good:true,scoreDelta:18}; }
    if (ch===FIRE){ feverActive=true; setFeverActive(true); S.fever=Math.max(S.fever,60); setFever(S.fever); S.score+=20; Particles.burstShards(null,null,{screen:{x:cx,y:cy}}); Particles.scorePop(cx,cy,20,true); return {good:true,scoreDelta:20}; }

    if (GOOD.includes(ch)){ const d=onGood(cx,cy); return {good:true,scoreDelta:d}; }
    if (JUNK.includes(ch)){ const d=onJunk(cx,cy); return {good:false,scoreDelta:d}; }
    return {good:false,scoreDelta:0};
  }

  function onExpired(ev){
    if (!ev || ev.isGood) return;
    // ไม่คลิก JUNK → ถือว่า "หลีกได้"
    S.junkAvoid += 1;
  }

  function evalProgress(){
    // goal (ทีละ 1)
    if (currentGoal && goalProgress(currentGoal) >= currentGoal.target){
      goalsCleared++;
      currentGoal = goalsQueue.shift() || null;
    }
    // mini (ทีละ 1 — โฟกัส)
    if (currentMini && miniProgress(currentMini) >= currentMini.target){
      minisCleared++;
      currentMini = miniDeck.shift() || null;
      if (!currentMini && S.time < dur){ // ยังมีเวลา → เติมชุดใหม่ 3 ใบ
        miniDeck = sampleN(MINI_POOL, 3);
        currentMini = miniDeck.shift();
      }
    }
    pushQuestUI();
  }

  function onSec(){
    S.time += 1;
    if (S.combo<=0) decayFever(6); else decayFever(2);
    S.noMissTime += 1; // กรณีไม่ miss ในวินาทีนั้น (ถ้า miss จะถูกรีเซ็ตใน onJunk)
    evalProgress();
  }

  window.addEventListener('hha:expired', onExpired);
  window.addEventListener('hha:time',    (e)=>{ if ((e.detail?.sec|0)>0) onSec(); });

  const onEnd = () => {
    try{
      window.removeEventListener('hha:expired', onExpired);
      // ส่งผลจบเกม (มี hubUrl ให้ overlay ใช้กลับหน้า Hub ได้ตรงพาธ)
      window.dispatchEvent(new CustomEvent('hha:end',{detail:{
        mode:'Good vs Junk',
        difficulty:diff,
        score:S.score,
        comboMax:S.comboMax,
        misses:S.junkHit,
        hits:S.goodCount,
        duration:dur,
        questsCleared:minisCleared,
        questsTotal:minisCleared + (currentMini?1:0) + (miniDeck?.length||0),
        goalsCleared,
        goalsTarget:5,
        hubUrl: '/webxr-health-mobile/HeroHealth/hub.html'
      }}));
    }catch{}
  };

  // boot factory
  return factoryBoot({
    difficulty: diff,
    duration  : dur,
    pools     : { good:[...GOOD,...BONUS], bad:[...JUNK] },
    goodRate  : 0.62,
    powerups  : BONUS,
    powerRate : 0.08,
    powerEvery: 7,
    judge,
    onExpire  : onExpired
  }).then(ctrl=>{
    // ฟังเวลาหมด
    window.addEventListener('hha:time', (e)=>{ if((e.detail?.sec|0)<=0) onEnd(); });
    // แสดงชุดแรกบน HUD
    pushQuestUI('Wave 1');
    return ctrl;
  });
}

export default { boot };
