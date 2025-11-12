// === /HeroHealth/modes/goodjunk.safe.js (Wave + Fever + PowerUps + HUD) ===
import { boot as factoryBoot } from '../vr/mode-factory.js';
import { MissionDeck } from '../vr/mission.js';
import { questHUDInit, questHUDUpdate, questHUDDispose } from '../vr/quest-hud.js';
import { Particles } from '../vr/particles.js';
import { ensureFeverBar, setFever, setFeverActive, setShield } from '../vr/ui-fever.js';

export async function boot(cfg = {}) {
  const diff = String(cfg.difficulty || 'normal');
  const dur  = Number(cfg.duration || 60);

  const GOOD = ['🥦','🥕','🍎','🐟','🥛','🍊','🍌','🍇','🥬','🍚','🥜','🍞','🍓','🍍','🥝','🍐'];
  const JUNK = ['🍔','🍟','🍕','🍩','🍪','🧁','🥤','🧋','🍫','🌭','🍰','🍬'];
  const STAR='⭐', DIA='💎', SHIELD='🛡️';
  const BONUS=[STAR,DIA,SHIELD];

  // Fever/Shield UI
  ensureFeverBar(); setFever(0); setShield(0);

  // Deck + HUD
  const deck = new MissionDeck(); deck.draw3();
  let wave = 1;
  questHUDInit();

  // “เป้า” หลักของโหมดนี้
  const GOAL_LABEL = 'เก็บของดีให้ได้ 25 ชิ้น';
  const GOAL_TARGET = 25;
  const goalProg = () => Math.min(GOAL_TARGET, deck.stats.goodCount);

  const pushPanels = () => {
    const cur = deck.getCurrent();
    // top-right panel (quest-hud)
    questHUDUpdate(deck, `Wave ${wave}`);

    // bottom panel (index.vr.html) expects hha:quest
    window.dispatchEvent(new CustomEvent('hha:quest', {
      detail: {
        text: cur ? `Mini Quest — ${cur.label}` : 'Mini Quest — กำลังเริ่ม…',
        goal: { label: GOAL_LABEL, prog: goalProg(), target: GOAL_TARGET },
        mini: cur ? { label: cur.label, prog: cur.prog(deck.stats), target: cur.target } : null
      }
    }));
  };

  // State
  let score=0, combo=0, shield=0;
  let fever=0, feverActive=false;

  const mult = () => (feverActive ? 2 : 1);
  const gainFever = (n) => {
    fever = Math.max(0, Math.min(100, fever + n));
    setFever(fever);
    if (!feverActive && fever >= 100) { feverActive = true; setFeverActive(true); }
  };
  const decayFever = (base) => {
    const d = feverActive ? 10 : base;
    fever = Math.max(0, fever - d);
    setFever(fever);
    if (feverActive && fever <= 0) { feverActive = false; setFeverActive(false); }
  };

  const fx = (cx,cy,theme='goodjunk') =>
    Particles.burstShards(null, null, { screen:{x:cx,y:cy}, theme });

  function judge(ch, ctx){
    const cx = ctx.cx ?? ctx.clientX ?? 0;
    const cy = ctx.cy ?? ctx.clientY ?? 0;

    // Power-ups
    if (ch===STAR){ const d=40*mult(); score+=d; gainFever(10); fx(cx,cy,'goodjunk'); return {good:true, scoreDelta:d}; }
    if (ch===DIA){  const d=80*mult(); score+=d; gainFever(30); fx(cx,cy,'groups');   return {good:true, scoreDelta:d}; }
    if (ch===SHIELD){ shield=Math.min(3, shield+1); setShield(shield); score+=20; return {good:true, scoreDelta:20}; }

    const isGood = GOOD.includes(ch);
    if (isGood){
      const base = 20 + combo*2;
      const delta = base * mult();
      score += delta; combo += 1;
      gainFever(8 + combo*0.6);

      deck.onGood(); deck.updateCombo(combo); deck.updateScore(score);
      fx(cx,cy,'goodjunk');
      pushPanels();
      return { good:true, scoreDelta: delta };
    } else {
      // Junk →
      if (shield>0){ shield-=1; setShield(shield); fx(cx,cy,'hydration'); pushPanels(); return {good:false, scoreDelta:0}; }
      const delta = -15;
      score = Math.max(0, score + delta); combo = 0;
      decayFever(18);
      deck.onJunk(); deck.updateCombo(combo); deck.updateScore(score);
      fx(cx,cy,'plate');
      pushPanels();
      return { good:false, scoreDelta: delta };
    }
  }

  function onExpire(ev){
    if (!ev || ev.isGood) return;
    // หลีกขยะ
    gainFever(4);
    deck.onJunk(); deck.updateScore(score);
    pushPanels();
  }

  function onHitScreen(){
    // เปลี่ยน wave ถ้าเคลียร์ครบ 3
    if (deck.isCleared()){ wave+=1; deck.draw3(); }
    pushPanels();
  }

  function onSec(e){
    // ลด Fever เองเมื่อไม่คอมโบ
    decayFever(combo<=0 ? 6 : 2);
    deck.second(); deck.updateScore(score);
    pushPanels();
  }

  window.addEventListener('hha:hit-screen', onHitScreen);
  window.addEventListener('hha:expired',    onExpire);
  window.addEventListener('hha:time',       onSec);

  const onEnd = () => {
    try{
      window.removeEventListener('hha:hit-screen', onHitScreen);
      window.removeEventListener('hha:expired',    onExpire);
      window.removeEventListener('hha:time',       onSec);
      questHUDDispose();

      const progNow       = deck.getProgress();
      const clearedNow    = progNow.filter(q => q.done).length;
      const totalCleared  = (wave-1)*3 + clearedNow;
      const totalPossible = wave*3;

      window.dispatchEvent(new CustomEvent('hha:end',{detail:{
        mode:'goodjunk', difficulty:diff, score,
        comboMax:deck.stats.comboMax, misses:deck.stats.junkMiss, hits:deck.stats.goodCount,
        duration:dur, goalCleared: goalProg()>=GOAL_TARGET,
        questsCleared: totalCleared, questsTotal: totalPossible
      }}));
    }catch{}
  };

  return factoryBoot({
    difficulty: diff,
    duration  : dur,
    pools     : { good:[...GOOD, ...BONUS], bad:[...JUNK] },
    goodRate  : 0.65,
    judge     : (ch, ctx)=>judge(ch, { ...ctx, cx:(ctx.clientX||ctx.cx), cy:(ctx.clientY||ctx.cy) }),
    onExpire
  }).then(ctrl=>{
    window.addEventListener('hha:time', (e)=>{ if((e.detail?.sec|0)<=0) onEnd(); });
    // เริ่มต้น push ครั้งแรก
    pushPanels();
    return ctrl;
  });
}

export default { boot };
