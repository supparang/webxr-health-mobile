// === /HeroHealth/modes/plate.safe.js (Healthy Plate) ===
import { boot as factoryBoot } from '../vr/mode-factory.js';
import { MissionDeck } from '../vr/mission.js';
import { questHUDInit, questHUDUpdate, questHUDDispose } from '../vr/quest-hud.js';
import { Particles } from '../vr/particles.js';
import { ensureFeverBar, setFever, setFeverActive, setShield } from '../vr/ui-fever.js';

export async function boot(cfg = {}) {
  const diff = String(cfg.difficulty || 'normal');
  const dur  = Number(cfg.duration || 60);

  const PROTEIN = ['🐟','🍗','🥚','🥜'];
  const VEGFRUIT = ['🥦','🥕','🍅','🍎','🍓','🍌'];
  const GRAIN = ['🍚','🍞'];
  const DAIRY = ['🥛','🧀'];
  const GOOD = [...PROTEIN, ...VEGFRUIT, ...GRAIN, ...DAIRY];
  const JUNK = ['🍔','🍟','🍕','🍩','🍪','🧁','🍬','🍫'];
  const STAR='⭐', DIA='💎', SHIELD='🛡️';
  const BONUS=[STAR,DIA,SHIELD];

  ensureFeverBar(); setFever(0); setShield(0);

  const deck = new MissionDeck(); deck.draw3();
  let wave = 1;
  questHUDInit();

  // เป้า: รวบรวมให้ครบ 3 หมวดที่ต่างกัน
  const GOAL_LABEL = 'จัดให้ครบ 3 หมวดอาหาร';
  const GOAL_TARGET = 3;
  const have = new Set();
  const goalProg = () => Math.min(GOAL_TARGET, have.size);

  const pushPanels = () => {
    const cur = deck.getCurrent();
    questHUDUpdate(deck, `Wave ${wave}`);
    window.dispatchEvent(new CustomEvent('hha:quest', {
      detail: {
        text: cur ? `Mini Quest — ${cur.label}` : 'Mini Quest — กำลังเริ่ม…',
        goal: { label: GOAL_LABEL, prog: goalProg(), target: GOAL_TARGET },
        mini: cur ? { label: cur.label, prog: cur.prog(deck.stats), target: cur.target } : null
      }
    }));
  };

  let score=0, combo=0, shield=0;
  let fever=0, feverActive=false;
  const mult = () => (feverActive ? 2 : 1);
  const gainFever = (n) => { fever=Math.max(0,Math.min(100,fever+n)); setFever(fever); if(!feverActive&&fever>=100){feverActive=true; setFeverActive(true);} };
  const decayFever = (base) => { const d=feverActive?10:base; fever=Math.max(0,fever-d); setFever(fever); if(feverActive&&fever<=0){feverActive=false; setFeverActive(false);} };
  const fx = (cx,cy,theme='plate') => Particles.burstShards(null, null, { screen:{x:cx,y:cy}, theme });

  function groupOf(ch){
    if (PROTEIN.includes(ch)) return 'PROTEIN';
    if (VEGFRUIT.includes(ch)) return 'VEG/FRUIT';
    if (GRAIN.includes(ch))   return 'GRAIN';
    if (DAIRY.includes(ch))   return 'DAIRY';
    return 'JUNK';
    }

  function judge(ch, ctx){
    const cx = ctx.cx ?? ctx.clientX ?? 0;
    const cy = ctx.cy ?? ctx.clientY ?? 0;

    if (ch===STAR){ const d=30*mult(); score+=d; gainFever(10); fx(cx,cy); return {good:true, scoreDelta:d}; }
    if (ch===DIA){  const d=70*mult(); score+=d; gainFever(30); fx(cx,cy,'groups'); return {good:true, scoreDelta:d}; }
    if (ch===SHIELD){ shield=Math.min(3, shield+1); setShield(shield); score+=15; return {good:true, scoreDelta:15}; }

    const isGood = GOOD.includes(ch);
    if (isGood){
      const delta = (15 + combo*2) * mult();
      score += delta; combo += 1;
      have.add(groupOf(ch));
      gainFever(6 + combo*0.5);
      deck.onGood(); deck.updateCombo(combo); deck.updateScore(score);
      fx(cx,cy,'plate'); pushPanels();
      return {good:true, scoreDelta:delta};
    }else{
      if (shield>0){ shield-=1; setShield(shield); fx(cx,cy,'hydration'); pushPanels(); return {good:false, scoreDelta:0}; }
      const delta = -12;
      score = Math.max(0, score + delta); combo = 0;
      decayFever(18);
      deck.onJunk(); deck.updateCombo(combo); deck.updateScore(score);
      fx(cx,cy,'goodjunk'); pushPanels();
      return {good:false, scoreDelta:delta};
    }
  }

  function onExpire(ev){ if(!ev || ev.isGood) return; gainFever(3); deck.onJunk(); deck.updateScore(score); pushPanels(); }
  function onHitScreen(){ if(deck.isCleared()){ wave+=1; deck.draw3(); } pushPanels(); }
  function onSec(){ decayFever(combo<=0?6:2); deck.second(); deck.updateScore(score); pushPanels(); }

  window.addEventListener('hha:hit-screen', onHitScreen);
  window.addEventListener('hha:expired',    onExpire);
  window.addEventListener('hha:time',       onSec);

  const onEnd = () => {
    window.removeEventListener('hha:hit-screen', onHitScreen);
    window.removeEventListener('hha:expired',    onExpire);
    window.removeEventListener('hha:time',       onSec);
    questHUDDispose();

    const progNow       = deck.getProgress();
    const clearedNow    = progNow.filter(q => q.done).length;
    const totalCleared  = (wave-1)*3 + clearedNow;
    const totalPossible = wave*3;

    window.dispatchEvent(new CustomEvent('hha:end',{detail:{
      mode:'plate', difficulty:diff, score,
      comboMax:deck.stats.comboMax, misses:deck.stats.junkMiss, hits:deck.stats.goodCount,
      duration:dur, goalCleared: goalProg()>=GOAL_TARGET,
      questsCleared: totalCleared, questsTotal: totalPossible
    }}));
  };

  return factoryBoot({
    difficulty: diff, duration: dur,
    pools: { good:[...GOOD, ...BONUS], bad:[...JUNK] },
    goodRate: 0.65, judge: (ch,ctx)=>judge(ch,{...ctx,cx:(ctx.clientX||ctx.cx),cy:(ctx.clientY||ctx.cy)}),
    onExpire
  }).then(ctrl=>{
    window.addEventListener('hha:time', (e)=>{ if((e.detail?.sec|0)<=0) onEnd(); });
    pushPanels();
    return ctrl;
  });
}
export default { boot };
