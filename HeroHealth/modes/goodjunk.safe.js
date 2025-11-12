// === /HeroHealth/modes/goodjunk.safe.js (2025-11-12 ROTATING GOALS + MINIS + FOCUSED HUD) ===
import { boot as factoryBoot } from '../vr/mode-factory.js';
import { ensureFeverBar, setFever, setFeverActive, setShield } from '../vr/ui-fever.js';
import { Particles } from '../vr/particles.js';

export async function boot(cfg = {}) {
  const diff = String(cfg.difficulty || 'normal');
  const dur  = Number(cfg.duration   || 60);

  // ---------- Pools ----------
  const GOOD = ['🥦','🥕','🍎','🍌','🥗','🐟','🥜','🍚','🍞','🥛','🍇','🍓','🍊','🍅','🍆','🥬','🥝','🍍','🍐','🍑'];
  const JUNK = ['🍔','🍟','🌭','🍕','🍩','🍪','🍰','🧋','🥤','🍫','🥓'];
  const STAR='⭐', DIA='💎', SHIELD='🛡️', FIRE='🔥';
  const BONUS=[STAR,DIA,SHIELD,FIRE];

  // ---------- HUD base ----------
  ensureFeverBar(); setFever(0); setShield(0);

  // ---------- Stats ----------
  const S = {
    score:0, combo:0, comboMax:0, goodCount:0, junkAvoid:0,
    star:0, diamond:0, shield:0, fever:0
  };
  let feverActive=false;
  const clamp = (n,a,b)=>Math.max(a,Math.min(b,n));
  const mult  = ()=> feverActive ? 2 : 1;
  const setF  = v => { S.fever = clamp(v,0,100); setFever(S.fever); };
  const gainF = n => { setF(S.fever+n); if(!feverActive && S.fever>=100){ feverActive=true; setFeverActive(true);} };
  const decF  = b => { const d = feverActive?10:b; setF(S.fever-d); if(feverActive && S.fever<=0){ feverActive=false; setFeverActive(false);} };

  // ---------- Deck helper ----------
  function makeDeck(pool, pickN){
    let wave=1, clearedTotal=0, cur=[];
    function draw(){
      const bag = pool.slice();
      cur = [];
      for(let i=0;i<pickN && bag.length;i++){
        const k=(Math.random()*bag.length)|0;
        const it=bag.splice(k,1)[0];
        cur.push({...it, done:false, prog:0});
      }
    }
    function progressOne(it){
      try{ it.prog = Math.min(it.target ?? Infinity, (it.progFn? it.progFn(S) : 0)); it.done = !!it.check?.(S); }catch{}
    }
    function progressAll(){ cur.forEach(progressOne); }
    function isCleared(){ return cur.every(x=>x.done); }
    function refillIfDone(){
      if(isCleared()){ clearedTotal += cur.length; wave+=1; draw(); progressAll(); }
    }
    function firstIncomplete(){ return cur.find(x=>!x.done) || cur[0] || null; }
    draw(); progressAll();
    return {
      get wave(){return wave;}, get clearedTotal(){return clearedTotal;},
      getProgress:()=>cur, progressAll, refillIfDone, firstIncomplete
    };
  }

  // ---------- Goal 10 (pick 5) ----------
  const goalPool10 = (()=>{
    const needScore  = (diff==='easy'? 400 : diff==='hard'? 900 : 700);
    const needCombo  = (diff==='easy'?   6 : diff==='hard'? 14  : 10);
    const goodClicks = (diff==='easy'?  10 : diff==='hard'? 22  : 16);
    const junkAvoid  = (diff==='easy'?   5 : diff==='hard'? 12  : 8);
    return [
      { id:'g_score',   label:`ทำคะแนนถึง ${needScore}`,      target:needScore,  check:s=>s.score>=needScore,    progFn:s=>s.score },
      { id:'g_combo',   label:`คอมโบสูงสุด ≥ ${needCombo}`,   target:needCombo,  check:s=>s.comboMax>=needCombo, progFn:s=>s.comboMax },
      { id:'g_goods',   label:`เก็บของดีให้ได้ ${goodClicks}`, target:goodClicks, check:s=>s.goodCount>=goodClicks, progFn:s=>s.goodCount },
      { id:'g_avoid',   label:`หลีกของขยะ ${junkAvoid} ครั้ง`, target:junkAvoid,  check:s=>s.junkAvoid>=junkAvoid, progFn:s=>s.junkAvoid },
      { id:'g_star1',   label:'เก็บ ⭐ 1 ดวง',                  target:1,          check:s=>s.star>=1,      progFn:s=>s.star },
      { id:'g_dia1',    label:'เก็บ 💎 1 เม็ด',                 target:1,          check:s=>s.diamond>=1,   progFn:s=>s.diamond },
      { id:'g_shield2', label:'สะสมโล่ 🛡️ ถึง 2',               target:2,          check:s=>s.shield>=2,    progFn:s=>s.shield },
      { id:'g_fever',   label:'เข้าโหมดไฟลุก 1 ครั้ง',          target:100,        check:s=>s.fever>=100,   progFn:s=>Math.min(100,s.fever) },
      { id:'g_combo8',  label:'คอมโบต่อเนื่อง 8',              target:8,          check:s=>s.comboMax>=8,  progFn:s=>s.comboMax },
      { id:'g_score2',  label:'ทำแต้มเพิ่มอีก 300',             target:300,        check:s=>s.score>=300,   progFn:s=>s.score },
    ];
  })();

  // ---------- Mini 10 (pick 3) ----------
  const miniPool10 = [
    { id:'m_nomiss5',  label:'หลีกของขยะ 5 ครั้ง', target:5,  check:s=>s.junkAvoid>=5,  progFn:s=>s.junkAvoid },
    { id:'m_combo12',  label:'คอมโบ ≥ 12',         target:12, check:s=>s.comboMax>=12, progFn:s=>s.comboMax },
    { id:'m_star2',    label:'เก็บ ⭐ 2 ดวง',       target:2,  check:s=>s.star>=2,      progFn:s=>s.star },
    { id:'m_dia1',     label:'เก็บ 💎 1 เม็ด',      target:1,  check:s=>s.diamond>=1,   progFn:s=>s.diamond },
    { id:'m_points',   label:'ทำแต้มเพิ่ม 500',     target:500,check:s=>s.score>=500,  progFn:s=>s.score },
    { id:'m_goods8',   label:'คลิกของดี 8 ชิ้น',    target:8,  check:s=>s.goodCount>=8,progFn:s=>s.goodCount },
    { id:'m_shield1',  label:'สะสมโล่ 1',           target:1,  check:s=>s.shield>=1,    progFn:s=>s.shield },
    { id:'m_fever',    label:'เข้าไฟลุก 1 ครั้ง',   target:100,check:s=>s.fever>=100,   progFn:s=>Math.min(100,s.fever) },
    { id:'m_combo8',   label:'คอมโบ ≥ 8',           target:8,  check:s=>s.comboMax>=8,  progFn:s=>s.comboMax },
    { id:'m_goods12',  label:'คลิกของดี 12 ชิ้น',   target:12, check:s=>s.goodCount>=12,progFn:s=>s.goodCount },
  ];

  const goals = makeDeck(goalPool10, 5);
  const minis = makeDeck(miniPool10, 3);

  // ---------- Push HUD (ทีละรายการ) ----------
  function pushHUD(){
    goals.progressAll(); minis.progressAll();
    goals.refillIfDone(); minis.refillIfDone();

    const g = goals.firstIncomplete();
    const m = minis.firstIncomplete();

    window.dispatchEvent(new CustomEvent('hha:quest', { detail: {
      goal: g ? { label:g.label, prog:g.prog|0, target:g.target|0, caption:`Wave ${goals.wave}` } : null,
      mini: m ? { label:m.label, prog:m.prog|0, target:m.target|0, caption:`Wave ${minis.wave}` } : null
    }}));
  }

  // ---------- Judge ----------
  function judge(ch, ctx){
    const cx = ctx.cx ?? ctx.clientX, cy = ctx.cy ?? ctx.clientY;

    // Power-ups
    if (ch===STAR){ const d=40*mult(); S.score+=d; S.star++;  gainF(10);
      Particles.burstShards(null,null,{screen:{x:cx,y:cy},theme:'goodjunk'}); pushHUD(); return {good:true, scoreDelta:d}; }
    if (ch===DIA){  const d=80*mult(); S.score+=d; S.diamond++; gainF(30);
      Particles.burstShards(null,null,{screen:{x:cx,y:cy},theme:'groups'});   pushHUD(); return {good:true, scoreDelta:d}; }
    if (ch===SHIELD){ S.shield=Math.min(3,S.shield+1); setShield(S.shield); S.score+=20;
      Particles.burstShards(null,null,{screen:{x:cx,y:cy},theme:'hydration'}); pushHUD(); return {good:true, scoreDelta:20}; }
    if (ch===FIRE){ feverActive=true; setFeverActive(true); setF(Math.max(S.fever,60)); S.score+=25;
      Particles.burstShards(null,null,{screen:{x:cx,y:cy},theme:'plate'});     pushHUD(); return {good:true, scoreDelta:25}; }

    // Good/Junk
    if (GOOD.includes(ch)){
      const delta = (16 + S.combo*2) * mult();
      S.score += delta; S.combo+=1; S.comboMax = Math.max(S.comboMax,S.combo); S.goodCount++;
      gainF(7 + S.combo*0.5);
      Particles.burstShards(null,null,{screen:{x:cx,y:cy},theme:'goodjunk'});
      pushHUD();
      return {good:true, scoreDelta:delta};
    }else{
      // junk
      S.junkAvoid++;                        // นับ "หลีก junk" เมื่อไม่ได้คลิกมันจนหมดอายุ — ก็จะนับจาก expired ด้วยเช่นกัน
      if (S.shield>0){ S.shield--; setShield(S.shield);
        Particles.burstShards(null,null,{screen:{x:cx,y:cy},theme:'plate'}); pushHUD(); return {good:false, scoreDelta:0}; }
      S.score = Math.max(0, S.score-12); S.combo=0; decF(16);
      Particles.burstShards(null,null,{screen:{x:cx,y:cy},theme:'groups'}); pushHUD();
      return {good:false, scoreDelta:-12};
    }
  }

  // หมดอายุของเป้า (ของขยะ) = นับเลี่ยง
  window.addEventListener('hha:expired', (e)=>{ if(e?.detail && !e.detail.isGood){ S.junkAvoid++; pushHUD(); }});
  window.addEventListener('hha:hit-screen', ()=>pushHUD());
  window.addEventListener('hha:time', (e)=>{
    if((e.detail?.sec|0)>0){ if(S.combo<=0) decF(6); else decF(2); pushHUD(); }
  });

  // ---------- Finish ----------
  const onEnd = () => {
    try{
      const miniNow = minis.getProgress().filter(x=>x.done).length;
      const questsCleared = minis.clearedTotal + miniNow;
      const questsTotal   = (minis.wave-1)*3 + minis.getProgress().length;

      window.dispatchEvent(new CustomEvent('hha:end',{detail:{
        mode:'Good vs Junk', difficulty:diff, score:S.score,
        comboMax:S.comboMax, misses:0, hits:S.goodCount,
        duration:dur, questsCleared, questsTotal
      }}));
    }catch{}
  };

  // ---------- Start ----------
  return factoryBoot({
    difficulty: diff,
    duration  : dur,
    pools     : { good:[...GOOD, ...BONUS], bad:[...JUNK] },
    goodRate  : 0.62,
    powerups  : BONUS,
    powerRate : 0.08,
    powerEvery: 7,
    judge
  }).then(ctrl=>{
    window.addEventListener('hha:time', (e)=>{ if((e.detail?.sec|0)<=0) onEnd(); });
    pushHUD();
    return ctrl;
  });
}

export default { boot };
