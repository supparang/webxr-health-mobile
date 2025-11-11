// === modes/plate.quest.js — Healthy Plate (ครบ 5 หมู่ = 1 รอบ) ===
import { boot as factoryBoot } from '../vr/mode-factory.js';
import { MissionDeck } from '../vr/mission.js';
import { questHUDInit, questHUDUpdate, questHUDDispose } from '../vr/quest-hud.js';
import { burstAtScreen, floatScoreScreen } from '../vr/ui-water.js';

// ใช้หมวดเดียวกับ groups
const G = {
  FRUIT:   ['🍎','🍐','🍊','🍋','🍓','🍇','🍉','🥝','🥭','🍍','🍑'],
  VEG:     ['🥦','🥬','🥕','🌽','🥒','🍅','🥔'],
  GRAIN:   ['🍞','🥖','🥐','🍚','🍝','🥯'],
  PROTEIN: ['🍗','🍖','🥩','🍤','🍣','🥚','🥜','🫘'],
  DAIRY:   ['🥛','🧀','🍨','🍦'],
  JUNK:    ['🍔','🍟','🍕','🍩','🧁','🍫','🍬','🥤','🧋']
};
const ALL_GOOD = [...G.FRUIT,...G.VEG,...G.GRAIN,...G.PROTEIN,...G.DAIRY];

function findGroup(ch){
  for (const [k,arr] of Object.entries(G)) if (arr.includes(ch)) return k;
  return null;
}

export async function boot({host, difficulty='normal', duration=60} = {}){
  questHUDDispose(); questHUDInit();

  // เป้าหลัก: “จัดครบ 5 หมู่ X รอบ”
  const ROUNDS = (difficulty==='easy') ? 1 : (difficulty==='hard' ? 3 : 2);
  const goal = { label:`เป้า: จัดครบ 5 หมู่ ${ROUNDS} รอบ`, prog:0, target:ROUNDS };

  const deck = new MissionDeck(); deck.draw3();

  let set = new Set();  // เก็บหมวดปัจจุบัน
  function addGroup(g){
    if (!g) return;
    set.add(g);
    if (set.size>=5){
      goal.prog = Math.min(goal.target, goal.prog+1);
      set = new Set(); // เริ่มรอบใหม่
    }
  }

  function pushHUD(){
    const cur = deck.getCurrent();
    const prog = deck.getProgress();
    const sub = `หมู่ที่ได้: ${Array.from(set).length}/5`;
    window.dispatchEvent(new CustomEvent('hha:quest',{
      detail:{
        text: cur ? `Mini Quest — ${cur.label}` : 'Mini Quest — กำลังเริ่ม…',
        goal: { label: `${goal.label} — ${sub}`, prog: goal.prog, target: goal.target },
        mini: cur ? { label: cur.label, prog:(prog.find(p=>p.id===cur.id)?.prog)||0, target:cur.target||0 } : null
      }
    }));
    questHUDUpdate(deck, sub);
  }
  pushHUD();

  let feverUntil=0, shieldUntil=0;

  function judge(char){
    const now=performance.now();
    if (char==='⭐') return {good:true, scoreDelta:70};
    if (char==='💎'){ deck.onDiamond(); return {good:true, scoreDelta:120}; }
    if (char==='🛡️'){ shieldUntil=now+5000; return {good:true, scoreDelta:30}; }
    if (char==='🔥'){ deck.onFeverStart(); feverUntil=now+6000; return {good:true, scoreDelta:40}; }

    if (G.JUNK.includes(char)) return { good:false, scoreDelta:-14 };
    const grp = findGroup(char);
    const mul = (feverUntil>performance.now()) ? 2 : 1;
    const ok  = !!grp;
    if (ok) addGroup(grp);
    return { good:ok, scoreDelta:(ok?12:-10)*mul };
  }

  function onHit(e){
    const d=e.detail||{};
    if (d.good) deck.onGood(); else deck.onJunk();
    floatScoreScreen(d.x||0,d.y||0,(d.delta>0?'+':'')+d.delta,d.good?'#a7f3d0':'#fecaca');
    burstAtScreen(d.x||0,d.y||0,{count:d.good?18:10,color:d.good?'#22c55e':'#f97316'});
    pushHUD();
  }
  function onScore(e){ const s=e.detail||{}; deck.updateScore(s.score||0); deck.updateCombo(s.combo||0); pushHUD(); }
  function onTime(){ deck.second(); pushHUD(); }
  function onExpired(){ deck.onJunk(); pushHUD(); }

  window.addEventListener('hha:hit-screen', onHit);
  window.addEventListener('hha:score', onScore);
  window.addEventListener('hha:time', onTime);
  window.addEventListener('hha:expired', onExpired);

  const onEndOnce = (ev)=>{
    window.removeEventListener('hha:hit-screen', onHit);
    window.removeEventListener('hha:score', onScore);
    window.removeEventListener('hha:time', onTime);
    window.removeEventListener('hha:expired', onExpired);

    const cleared = deck.getProgress().filter(q=>q.done).length;
    const total   = deck.getProgress().length;
    const base    = ev.detail||{};
    window.dispatchEvent(new CustomEvent('hha:end',{
      detail:{ ...base, questsCleared:cleared, questsTotal:total, goalCleared:(goal.prog>=goal.target) }
    }));
  };
  window.addEventListener('hha:end', onEndOnce, { once:true });

  const poolGood = [...ALL_GOOD, '⭐','💎','🛡️','🔥'];
  const poolBad  = [...G.JUNK];

  return factoryBoot({
    host, difficulty, duration,
    pools:{ good: poolGood, bad: poolBad },
    goodRate: 0.76,
    judge,
    onExpire: (ev)=>{ if(ev && ev.isGood===false) window.dispatchEvent(new CustomEvent('hha:expired',{detail:ev})); }
  });
}

export default { boot };
