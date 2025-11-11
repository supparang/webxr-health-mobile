// === /HeroHealth/modes/goodjunk.safe.js (wave quests; cumulative summary) ===
import { boot as factoryBoot } from '../vr/mode-factory.js';
import { MissionDeck } from '../vr/mission.js';
import { questHUDInit, questHUDUpdate, questHUDDispose } from '../vr/quest-hud.js';
import { Particles } from '../vr/particles.js';

export async function boot(cfg = {}) {
  const diff = String(cfg.difficulty || 'normal');
  const dur  = Number(cfg.duration || 60);

  // Pools
  const GOOD = ['🥦','🥕','🍎','🐟','🥛','🍊','🍌','🍇','🥬','🍚','🥜','🍞','🍓','🍍','🥝','🍐'];
  const JUNK = ['🍔','🍟','🍕','🍩','🍪','🧁','🥤','🧋','🍫','🌭','🍰','🍬'];
  // Power-ups (แสดงเป็นเป้าเหมือนกัน ให้ judge จัดการ)
  const STAR='⭐', DIA='💎', SHIELD='🛡️';
  const BONUS = [STAR, DIA, SHIELD];

  // --- Quest deck (wave-based) ---
  const deck = new MissionDeck(); deck.draw3();
  let wave = 1;

  // Stats (เกมนี้ใช้สรุปจาก deck เป็นหลัก)
  let score = 0;

  questHUDInit();
  questHUDUpdate(deck, `Wave ${wave}`);

  // คอมโบ & fever (แบบเบา ๆ ใน DOM — สื่อสารผ่านคะแนนและเอฟเฟกต์)
  let combo = 0;

  // ==== Judge ====
  function judge(ch, ctx){
    // พลังพิเศษ
    if (ch === STAR)   { score += 40; Particles.burstShards(null, {x:ctx.cx||0,y:ctx.cy||0,z:0}, {theme:'goodjunk'}); return { good:true,  scoreDelta: 40 }; }
    if (ch === DIA)    { score += 80; Particles.burstShards(null, {x:ctx.cx||0,y:ctx.cy||0,z:0}, {theme:'groups'});   return { good:true,  scoreDelta: 80 }; }
    if (ch === SHIELD) { /* เกม DOM ไม่ใช้เกราะจริง แต่ให้ +20 */ score += 20; return { good:true, scoreDelta:20 }; }

    const isGood = GOOD.includes(ch);
    if (isGood) {
      const delta = 20 + combo*2;
      score += delta;
      combo += 1;
      deck.onGood();
      deck.updateCombo(combo);
      deck.updateScore(score);
      Particles.burstShards(null, {x:ctx.cx||0,y:ctx.cy||0,z:0}, {theme:'goodjunk'});
      return { good:true, scoreDelta: delta };
    } else {
      // junk โดนตี = โทษ
      const delta = -15;
      score = Math.max(0, score + delta);
      combo = 0;
      deck.onJunk();
      deck.updateCombo(combo);
      deck.updateScore(score);
      Particles.burstShards(null, {x:ctx.cx||0,y:ctx.cy||0,z:0}, {theme:'plate'});
      return { good:false, scoreDelta: delta };
    }
  }

  // ==== onExpire: “หลบขยะ” สำเร็จ ====
  function onExpire(ev){
    if (!ev || ev.isGood) return;
    // นับการหลีกของขยะเป็นความคืบหน้า mini quest
    deck.onJunk();           // ออกแบบ deck ให้ quest "หลีกขยะ" ใช้ junkMiss
    deck.updateScore(score);
    questHUDUpdate(deck, `Wave ${wave}`);
  }

  // ==== Event bridge จาก mode-factory ====
  function onHitScreen(e){
    // แค่ไว้รับตำแหน่งจอเพื่อทำเอฟเฟกต์ฟองคะแนนแบบ DOM ก็ทำใน judge แล้ว
    questHUDUpdate(deck, `Wave ${wave}`);
    // เคลียร์ครบ 3 ใบ → สุ่มเวฟใหม่
    if (deck.isCleared()) {
      wave += 1;
      deck.draw3();
      questHUDUpdate(deck, `Wave ${wave}`);
    }
  }

  // เดินเข็ม noMissTime 1 วิ/ครั้ง (ใช้ time จาก factory)
  function onSec(){ deck.second(); questHUDUpdate(deck, `Wave ${wave}`); }

  window.addEventListener('hha:hit-screen', onHitScreen);
  window.addEventListener('hha:expired',    onExpire);
  window.addEventListener('hha:time',       onSec);

  // ==== END SUMMARY (สะสมเควสต์ทุกเวฟ) ====
  const onEnd = () => {
    try {
      window.removeEventListener('hha:hit-screen', onHitScreen);
      window.removeEventListener('hha:expired',    onExpire);
      window.removeEventListener('hha:time',       onSec);
      questHUDDispose();

      const progNow       = deck.getProgress();
      const clearedNow    = progNow.filter(q => q.done).length;
      const totalCleared  = (wave - 1) * 3 + clearedNow;
      const totalPossible = wave * 3;

      window.dispatchEvent(new CustomEvent('hha:end', {
        detail: {
          mode: 'Good vs Junk',
          difficulty: diff,
          score,
          comboMax: deck.stats.comboMax,
          misses: deck.stats.junkMiss,
          hits: deck.stats.goodCount,
          duration: dur,
          goalCleared: score >= 500,   // เป้าหมายเบื้องต้น
          questsCleared: totalCleared,
          questsTotal: totalPossible,
          reason: 'timeout'
        }
      }));
    } catch {}
  };

  // ==== เริ่มโหมดผ่าน mode-factory ====
  return factoryBoot({
    difficulty: diff,
    duration  : dur,
    pools     : { good:[...GOOD, ...BONUS], bad:[...JUNK] },
    goodRate  : 0.65,
    judge     : (ch, ctx) => {
      // เติมพิกัดจอให้ judge ใช้เอฟเฟกต์
      const res = judge(ch, { ...ctx, cx: (ctx.clientX||ctx.cx), cy:(ctx.clientY||ctx.cy) });
      return res;
    },
    onExpire  : onExpire
  }).then(ctrl => {
    // hook end เมื่อเวลาหมด (factory ยิง hha:end แล้ว index สรุป แต่เรายิงแบบกำหนด detail เอง)
    window.addEventListener('hha:time', (e)=>{ if ((e.detail?.sec|0) <= 0) onEnd(); });
    return ctrl;
  });
}

export default { boot };
