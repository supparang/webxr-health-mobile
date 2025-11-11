// === /HeroHealth/modes/goodjunk.safe.js (DOM+Fever+Quests+Powers) ===
import factory from '../vr/mode-factory.js';
import { MissionDeck } from '../vr/mission.js';
import { questHUDInit, questHUDUpdate, questHUDDispose } from '../vr/quest-hud.js';
import { ensureFeverGauge, setFeverGauge, setFlame, feverBurstScreen } from '../vr/ui-fever.js';
import { floatScoreScreen, burstAtScreen } from '../vr/ui-water.js'; // reuse screen fx

export async function boot(cfg = {}) {
  // ---- Pools & rules ----
  const GOOD = ['🥦','🥕','🍎','🐟','🥛','🍊','🍌','🍇','🥬','🍚','🥜','🍞','🍓','🍍','🥝','🍐'];
  const JUNK = ['🍔','🍟','🍕','🍩','🍪','🧁','🥤','🧋','🍫','🌭','🍰','🍬'];
  // พาวเวอร์: จะรวมไปกับ good pool เพื่อให้สปอว์นได้จาก factory
  const POW  = ['⭐','💎','🛡️','🔥'];

  // Goal ง่าย ๆ ของโหมดนี้: ทำคะแนนให้ถึงเป้าตาม diff
  const scoreGoal = { easy:300, normal:500, hard:700 }[String(cfg.difficulty||'normal')] || 500;

  // ---- Fever state ----
  let fever = 0;            // 0..100
  let feverActive = false;
  let shield = 0;           // 0..3
  let score = 0;
  let combo = 0;

  // ---- Mini quests ----
  const deck = new MissionDeck({
    pool: [
      { id:'good10',    level:'easy',   label:'เก็บของดี 10 ชิ้น',  check:s=>s.goodCount>=10,  prog:s=>Math.min(10,s.goodCount), target:10 },
      { id:'combo10',   level:'normal', label:'ทำคอมโบ 10',         check:s=>s.comboMax>=10,  prog:s=>Math.min(10,s.comboMax),  target:10 },
      { id:'score500',  level:'hard',   label:'ทำคะแนน 500+',       check:s=>s.score>=500,    prog:s=>Math.min(500,s.score),    target:500 },
      { id:'star3',     level:'normal', label:'เก็บ ⭐ 3 ดวง',       check:s=>s.star>=3,       prog:s=>Math.min(3,s.star),       target:3 },
      { id:'diamond1',  level:'hard',   label:'เก็บ 💎 1 เม็ด',      check:s=>s.diamond>=1,    prog:s=>Math.min(1,s.diamond),    target:1 },
      { id:'avoid8',    level:'easy',   label:'หลีกขยะ 8 ครั้ง',     check:s=>s.junkMiss>=8,   prog:s=>Math.min(8,s.junkMiss),   target:8 },
      { id:'nomiss12',  level:'normal', label:'ไม่พลาด 12 วิ',       check:s=>s.noMissTime>=12,prog:s=>Math.min(12,s.noMissTime), target:12 },
      { id:'combo18',   level:'hard',   label:'คอมโบ 18',           check:s=>s.comboMax>=18,  prog:s=>Math.min(18,s.comboMax),  target:18 },
      { id:'good20',    level:'normal', label:'เก็บของดี 20 ชิ้น',  check:s=>s.goodCount>=20, prog:s=>Math.min(20,s.goodCount), target:20 },
      { id:'score650',  level:'hard',   label:'ทำคะแนน 650+',       check:s=>s.score>=650,    prog:s=>Math.min(650,s.score),    target:650 },
    ]
  });
  deck.draw3();
  let wave = 1; // รอบเควสต์

  // ---- Fever gauge UI ----
  ensureFeverGauge();
  setFeverGauge(0);
  setFlame(false);

  // ---- Quest HUD ----
  questHUDInit();
  questHUDUpdate(deck, `Wave ${wave}`);

  // เวลานับถอยหลังจาก factory → อัปเดต noMiss และ decay fever
  const secTimer = setInterval(()=>{
    // noMiss จะถูกรีเซ็ตใน event miss/avoid อยู่แล้ว
    deck.second();

    // fever decay (ถ้าไม่ active)
    if (!feverActive) {
      fever = Math.max(0, fever - 3); // ค่อย ๆ ลด
      setFeverGauge(fever);
    } else {
      // ระหว่าง Active ค่อย ๆ ลดช้ากว่า
      fever = Math.max(0, fever - 1);
      setFeverGauge(fever);
      if (fever<=0) { feverActive=false; setFlame(false); }
    }

    questHUDUpdate(deck, `Wave ${wave}`);
  }, 1000);

  // ---- judge (คะแนน + power handling + fever gain) ----
  function judgeChar(ch, ctx){
    // พาวเวอร์
    if (ch==='⭐') return { type:'star', good:true, scoreDelta:40, fever:+10 };
    if (ch==='💎') return { type:'diamond', good:true, scoreDelta:80, fever:+15 };
    if (ch==='🛡️') return { type:'shield', good:true, scoreDelta:0,  fever:+0 };
    if (ch==='🔥') return { type:'fever',  good:true, scoreDelta:0,  fever:+100 };

    // ปกติ
    if (GOOD.includes(ch)) return { type:'good',  good:true,  scoreDelta: 20 + ctx.combo*2, fever:+6 };
    if (JUNK.includes(ch)) return { type:'junk',  good:false, scoreDelta: shield>0 ? 0 : -15, fever:-6 };

    // ไม่รู้จัก
    return { type:'other', good:false, scoreDelta:0, fever:0 };
  }

  // สื่อสารกับ factory: pools + judge + เมื่อเป้าหมดอายุ (หลบขยะนับ quest)
  const game = await factory.boot({
    host: cfg.host,
    difficulty: cfg.difficulty || 'normal',
    duration: cfg.duration || 60,
    goodRate: 0.68,
    pools: { good: [...GOOD, ...POW], bad: [...JUNK] },
    judge: (ch, ctx) => {
      const r = judgeChar(ch, ctx);
      // ปรับคะแนน/คอมโบ/เฟเวอร์/บัฟ
      if (r.type==='shield') shield = Math.min(3, shield+1);
      if (r.type==='fever')  { fever = 100; feverActive = true; setFlame(true); feverBurstScreen(); }
      if (r.type==='junk' && shield>0){ // โดนขยะแต่มีโล่ → ไม่นับพลาด
        r.scoreDelta = 0;
      }
      // ปรับ fever เมื่อกดโดน
      fever = Math.max(0, Math.min(100, fever + (r.fever||0)));
      if (fever>=100){ feverActive=true; setFlame(true); feverBurstScreen(); }
      setFeverGauge(fever);

      // อัปเดตสถิติ mini quests
      if (r.type==='good' || r.type==='star' || r.type==='diamond') deck.onGood();
      if (r.type==='junk' && !(shield>0)) deck.onJunk();
      if (r.type==='star') deck.onStar();
      if (r.type==='diamond') deck.onDiamond();

      // อัปเดต score/combo สูงสุด
      score = Math.max(0, score + r.scoreDelta);
      combo = r.good ? Math.min(9999, (ctx.combo||0)+1) : 0;
      deck.updateScore(score);
      deck.updateCombo(combo);

      // เควสต์ครบ 3 ใบ → สุ่มกองใหม่ถ้าเวลายังเหลือ
      if (deck.isCleared()) {
        wave += 1;
        deck.draw3();
        questHUDUpdate(deck, `Wave ${wave}`);
      }

      return { good:r.good, scoreDelta:r.scoreDelta };
    },
    onExpire: ({isGood})=>{
      if (!isGood) { deck.onJunk(); questHUDUpdate(deck, `Wave ${wave}`); } // หลีกขยะสำเร็จ
    }
  });

  // เอฟเฟกต์ตอน “โดน” (ตำแหน่งจอ)
  const onHit = (e)=>{
    const d=e.detail||{}; const x=d.x||window.innerWidth/2, y=d.y||window.innerHeight/2;
    if (d.good){
      burstAtScreen(x,y,{ color:'#22c55e', count:16 });
      floatScoreScreen(x,y, (d.delta>0?`+${d.delta}`:`${d.delta}`), '#eafff5');
    } else {
      burstAtScreen(x,y,{ color:'#ef4444', count:12 });
      floatScoreScreen(x,y, `${d.delta||0}`, '#ffe4e6');
    }
  };
  window.addEventListener('hha:hit-screen', onHit);

  // แสดง Goal/Quest progress บน HUD ด้านบน (index จับ event นี้อยู่แล้ว)
  function pushQuestBanner(){
    const cur = deck.getCurrent();
    window.dispatchEvent(new CustomEvent('hha:quest',{
      detail:{
        text: `Goal: แต้มถึง ${scoreGoal.toLocaleString()} | Mini: ${cur?cur.label:'—'}`,
        goal:{ label:`แต้ม ${score}/${scoreGoal}`, prog:score, target:scoreGoal },
        mini: cur ? { label:cur.label, prog:(cur.prog?cur.prog(deck.stats):0), target:cur.target||1 } : null
      }
    }));
  }
  const questBannerTimer = setInterval(pushQuestBanner, 500);

  // enrich end summary
  const onEnd = (e)=>{
    try{
      clearInterval(secTimer); clearInterval(questBannerTimer);
      window.removeEventListener('hha:hit-screen', onHit);
      questHUDDispose();
      setFlame(false);
      const cleared = deck.summary();
      const qCleared = cleared.progress.filter(q=>q.done).length;
      window.dispatchEvent(new CustomEvent('hha:end', {
        detail:{
          mode:'Good vs Junk',
          difficulty:String(cfg.difficulty||'normal'),
          score,
          comboMax: deck.stats.comboMax,
          misses: deck.stats.junkMiss,
          hits: deck.stats.goodCount,
          spawns: 0,
          duration: Number(cfg.duration||60),
          goalCleared: score>=scoreGoal,
          questsCleared: qCleared,
          questsTotal: 3,
          reason: 'timeout'
        }
      }));
    }catch{}
  };
  window.addEventListener('hha:end', onEnd, { once:true });

  // initial banner
  pushQuestBanner();

  return {
    stop(){ try{ game.stop(); }catch{} onEnd(); },
    pause(){ try{ game.pause(); }catch{} },
    resume(){ try{ game.resume(); }catch{} }
  };
}

export default { boot };
