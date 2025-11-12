// === /HeroHealth/modes/goodjunk.safe.js (2025-11-12 ROTATING GOALS + MINI QUESTS) ===
import { boot as factoryBoot } from '../vr/mode-factory.js';
import { ensureFeverBar, setFever, setFeverActive, setShield } from '../vr/ui-fever.js';
import { questHUDUpdate } from '../vr/quest-hud.js';
import { Particles } from '../vr/particles.js';

export async function boot(cfg = {}) {
  const diff = String(cfg.difficulty || 'normal');
  const dur  = Number(cfg.duration || 60);

  // ---------- Pools ----------
  const GOOD = ['🥦','🥕','🍎','🍌','🥗','🐟','🥜','🍚','🍞','🥛','🍇','🍓','🍊','🍅','🍆','🥬','🥝','🍍','🍐','🍑'];
  const JUNK = ['🍔','🍟','🌭','🍕','🍩','🍪','🍰','🧋','🥤','🍫','🥓'];
  const STAR='⭐', DIA='💎', SHIELD='🛡️', FIRE='🔥';
  const BONUS=[STAR,DIA,SHIELD,FIRE];

  // ---------- HUD base ----------
  ensureFeverBar(); setFever(0); setShield(0);

  // ---------- Stats (ใช้กับตัวตรวจ quest) ----------
  const S = {
    score:0, combo:0, comboMax:0, goodCount:0, junkMiss:0,
    star:0, diamond:0, shield:0, fever:0
  };
  function mult(){ return feverActive ? 2 : 1; }
  function setFeverVal(v){ S.fever = Math.max(0, Math.min(100, v)); setFever(S.fever); }
  function gainFever(n){ setFeverVal(S.fever + n); if(!feverActive && S.fever>=100){ feverActive=true; setFeverActive(true);} }
  function decayFever(base){ const d = feverActive?10:base; setFeverVal(S.fever - d); if(feverActive && S.fever<=0){ feverActive=false; setFeverActive(false); } }

  let feverActive=false;

  // ---------- Deck helper (สุ่ม N ใบ, โฟกัสทีละใบ) ----------
  function makeDeck(pool, pickN){
    let wave=1, clearedTotal=0, focus=0, cur=[];
    function draw(){
      // สุ่ม N ใบไม่ซ้ำ
      const bag = pool.slice();
      cur = [];
      for(let i=0;i<pickN && bag.length;i++){
        const k=(Math.random()*bag.length)|0;
        const it=bag.splice(k,1)[0];
        cur.push({...it, done:false, prog:0});
      }
      focus = 0;
    }
    function progressOne(it){
      try{
        it.prog  = Math.min(it.target ?? Infinity, (it.progFn? it.progFn(S) : 0));
        it.done  = !!it.check?.(S);
      }catch{}
    }
    function progressAll(){ cur.forEach(progressOne); }
    function firstIncompleteIdx(){ return cur.findIndex(x=>!x.done); }
    function isCleared(){ return cur.every(x=>x.done); }
    function refillIfDone(){
      if (isCleared()){
        clearedTotal += cur.length;
        wave += 1;
        draw();
      }
    }
    function getUI(){
      // แสดงทีละ “ใบเดียว” (อันที่ยังไม่เสร็จ ถ้าทั้งชุดเสร็จให้โชว์ใบแรกของชุดใหม่)
      let idx = firstIncompleteIdx();
      if (idx<0) idx = 0;
      const it = cur[idx] || null;
      return it ? { label: it.label, prog: it.prog|0, target: it.target|0, wave } : null;
    }
    function next(){ focus=(focus+1)%cur.length; }
    function prev(){ focus=(focus-1+cur.length)%cur.length; }

    draw();               // สุ่มชุดแรก
    progressAll();        // คำนวณครั้งแรก

    return {
      wave, get waveNo(){return wave;},
      get clearedTotal(){return clearedTotal;},
      draw, progressAll, refillIfDone, getUI, next, prev
    };
  }

  // ---------- Goal 10 ใบ (สุ่มมา 5 ตาม diff) ----------
  const goalPool10 = (()=> {
    // เป้าหมายแตกต่างตามระดับ
    const needScore  = (diff==='easy'? 400 : diff==='hard'? 900 : 700);
    const needCombo  = (diff==='easy'?   6 : diff==='hard'? 14  : 10);
    const goodClicks = (diff==='easy'?  10 : diff==='hard'? 22  : 16);
    const junkAvoid  = (diff==='easy'?   5 : diff==='hard'? 12  : 8);

    return [
      { id:'g_score',   label:`ทำคะแนนถึง ${needScore}`,     target:needScore, check:s=>s.score>=needScore,   progFn:s=>s.score },
      { id:'g_combo',   label:`คอมโบสูงสุด ≥ ${needCombo}`,  target:needCombo, check:s=>s.comboMax>=needCombo,progFn:s=>s.comboMax },
      { id:'g_goods',   label:`เก็บของดีให้ได้ ${goodClicks}`,target:goodClicks,check:s=>s.goodCount>=goodClicks, progFn:s=>s.goodCount },
      { id:'g_avoid',   label:`หลีกของขยะ ${junkAvoid} ครั้ง`,target:junkAvoid,check:s=>s.junkMiss>=junkAvoid, progFn:s=>s.junkMiss },
      { id:'g_star1',   label:'เก็บดาว ⭐ 1 ดวง',             target:1, check:s=>s.star>=1,    progFn:s=>s.star },
      { id:'g_dia1',    label:'เก็บเพชร 💎 1 เม็ด',           target:1, check:s=>s.diamond>=1, progFn:s=>s.diamond },
      { id:'g_shield2', label:'สะสมโล่ 🛡️ ถึง 2',             target:2, check:s=>s.shield>=2,  progFn:s=>s.shield },
      { id:'g_fever',   label:'เปิดโหมดไฟลุก (Fever) 1 ครั้ง',target:1, check:s=>s.fever>=100, progFn:s=>Math.min(100,s.fever) },
      { id:'g_combo8',  label:'ทำคอมโบต่อเนื่อง 8',           target:8, check:s=>s.comboMax>=8, progFn:s=>s.comboMax },
      { id:'g_score2',  label:'ทำคะแนนเพิ่มอีก 300',           target:300, check:s=>s.score>=300, progFn:s=>s.score },
    ];
  })();

  // ---------- Mini-quest 10 ใบ (สุ่มทีละ 3) ----------
  const miniPool10 = [
    { id:'m_nomiss5',  label:'หลีกของขยะ 5 ครั้ง', target:5, check:s=>s.junkMiss>=5,  progFn:s=>s.junkMiss },
    { id:'m_combo12',  label:'คอมโบ ≥ 12',         target:12,check:s=>s.comboMax>=12,progFn:s=>s.comboMax },
    { id:'m_star2',    label:'เก็บ ⭐ 2 ดวง',       target:2, check:s=>s.star>=2,     progFn:s=>s.star },
    { id:'m_dia1',     label:'เก็บ 💎 1 เม็ด',      target:1, check:s=>s.diamond>=1,  progFn:s=>s.diamond },
    { id:'m_points',   label:'ทำแต้มเพิ่ม 500',     target:500,check:s=>s.score>=500, progFn:s=>s.score },
    { id:'m_goods8',   label:'คลิกของดี 8 ชิ้น',    target:8, check:s=>s.goodCount>=8,progFn:s=>s.goodCount },
    { id:'m_shield1',  label:'สะสมโล่ 1',           target:1, check:s=>s.shield>=1,   progFn:s=>s.shield },
    { id:'m_fever',    label:'เข้า Fever 1 ครั้ง',   target:1, check:s=>s.fever>=100,  progFn:s=>Math.min(100,s.fever) },
    { id:'m_combo8',   label:'คอมโบ ≥ 8',           target:8, check:s=>s.comboMax>=8, progFn:s=>s.comboMax },
    { id:'m_goods12',  label:'คลิกของดี 12 ชิ้น',   target:12,check:s=>s.goodCount>=12,progFn:s=>s.goodCount },
  ];

  // เด็คจริง
  const goals = makeDeck(goalPool10, 5);
  const minis = makeDeck(miniPool10, 3);

  // ---------- HUD push (แสดงทีละรายการ) ----------
  function pushHUD(caption){
    goals.progressAll();
    minis.progressAll();

    // ถ้าเคลียร์ทั้งชุด → หมุนชุดใหม่
    goals.refillIfDone();
    minis.refillIfDone();

    const goalUI = goals.getUI();
    const miniUI = minis.getUI();

    window.dispatchEvent(new CustomEvent('hha:quest', { detail: {
      goal: goalUI ? { label:goalUI.label, prog:goalUI.prog, target:goalUI.target, caption:`Wave ${goalUI.wave}` } : null,
      mini: miniUI ? { label:miniUI.label, prog:miniUI.prog, target:miniUI.target, caption:`Wave ${miniUI.wave}` } : null
    }}));

    // อัปเดตป้ายคะแนน/คอมโบผ่านอีเวนต์เดิม (main.js จะฟังอยู่แล้ว)
  }

  // ---------- Judge ----------
  function judge(ch, ctx){
    const cx = ctx.cx ?? ctx.clientX, cy = ctx.cy ?? ctx.clientY;

    // Power-ups
    if (ch===STAR){ const d=40*mult(); S.score+=d; S.star++;  gainFever(10);
      Particles.burstShards(null,null,{screen:{x:cx,y:cy},theme:'goodjunk'}); pushHUD(); return {good:true, scoreDelta:d}; }
    if (ch===DIA){  const d=80*mult(); S.score+=d; S.diamond++; gainFever(30);
      Particles.burstShards(null,null,{screen:{x:cx,y:cy},theme:'groups'});   pushHUD(); return {good:true, scoreDelta:d}; }
    if (ch===SHIELD){ S.shield=Math.min(3,S.shield+1); setShield(S.shield); S.score+=20;
      Particles.burstShards(null,null,{screen:{x:cx,y:cy},theme:'hydration'}); pushHUD(); return {good:true, scoreDelta:20}; }
    if (ch===FIRE){ feverActive=true; setFeverActive(true); setFeverVal(Math.max(S.fever,60)); S.score+=25;
      Particles.burstShards(null,null,{screen:{x:cx,y:cy},theme:'plate'});     pushHUD(); return {good:true, scoreDelta:25}; }

    // ของดี/ของขยะ
    const isGood = GOOD.includes(ch);
    if (isGood){
      const delta = (16 + S.combo*2) * mult();
      S.score += delta; S.combo += 1; S.comboMax = Math.max(S.comboMax, S.combo); S.goodCount += 1;
      gainFever(7 + S.combo*0.5);
      Particles.burstShards(null,null,{screen:{x:cx,y:cy},theme:'goodjunk'});
      pushHUD();
      return {good:true, scoreDelta:delta};
    }else{
      if (S.shield>0){
        S.shield -= 1; setShield(S.shield);
        Particles.burstShards(null,null,{screen:{x:cx,y:cy},theme:'plate'});
        pushHUD();
        return {good:false, scoreDelta:0};
      }
      S.score = Math.max(0, S.score - 12);
      S.combo = 0;
      decayFever(16);
      Particles.burstShards(null,null,{screen:{x:cx,y:cy},theme:'groups'});
      pushHUD();
      return {good:false, scoreDelta:-12};
    }
  }

  // ---------- Expire / per-second ----------
  function onExpire(ev){
    if (!ev || !ev.isGood) return; // ของดีหมดอายุ = พลาด (ไม่นับหลีก)
    // นับเป็นพลาดของดี (ถือเป็น miss)
  }
  function onHitScreen(){ pushHUD(); }
  function onSec(){
    if (S.combo<=0) decayFever(6); else decayFever(2);
    // “หลีกของขยะ” = นับตอนเป้าขยะหมดอายุโดยไม่คลิกก็ได้ (มาจาก mode-factory ผ่าน hha:expired)
    // ที่นี่เรานับแบบง่าย: ทุกรอบวินาทีไม่เปลี่ยนค่า
    pushHUD();
  }

  window.addEventListener('hha:hit-screen', onHitScreen);
  window.addEventListener('hha:expired',    (e)=>{ if(e?.detail && !e.detail.isGood){ S.junkMiss++; pushHUD(); }});
  window.addEventListener('hha:time',       (e)=>{ if((e.detail?.sec|0)>0) onSec(); });

  // ---------- Finish ----------
  const onEnd = () => {
    try{
      window.removeEventListener('hha:hit-screen', onHitScreen);
      window.removeEventListener('hha:expired',    onExpire);
      window.removeEventListener('hha:time',       onSec);
      window.dispatchEvent(new CustomEvent('hha:end',{detail:{
        mode:'Good vs Junk', difficulty:diff, score:S.score,
        comboMax:S.comboMax, misses:S.junkMiss, hits:S.goodCount,
        duration:dur,
        // สรุป mini quests (สะสมทั้งที่สำเร็จระหว่างเล่น)
        questsCleared: 0,           // (ถ้าต้องนับสะสมใน UI ให้ต่อยอดจาก minis.clearedTotal)
        questsTotal  : 0
      }}));
    }catch{}
  };

  // ---------- Start factory ----------
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
    // ปิดเกมเมื่อเวลาหมด → ยิงสรุป
    window.addEventListener('hha:time', (e)=>{ if((e.detail?.sec|0)<=0) onEnd(); });
    pushHUD('Wave 1');
    return ctrl;
  });
}

export default { boot };
