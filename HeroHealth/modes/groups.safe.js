// === /HeroHealth/modes/groups.safe.js (DOM mode + goal = เลือกให้ถูกหมู่ × 1→2→3) ===
import { boot as domBoot } from '../vr/mode-factory.js';
import { MissionDeck } from '../vr/mission.js';
import { questHUDInit, questHUDUpdate, questHUDDispose } from '../vr/quest-hud.js';
import { floatScoreScreen, burstAtScreen } from '../vr/ui-water.js';

export async function boot(cfg = {}) {
  const diff = String(cfg.difficulty || 'normal');
  const dur  = Number(cfg.duration   || (diff==='easy'?90:diff==='hard'?45:60));

  const GROUPS = {
    veg: ['🥦','🥕','🥬','🍅','🌽'],
    fruit: ['🍎','🍓','🍇','🍊','🍍','🍌','🍐'],
    grain: ['🍞','🥖','🍚','🍘','🥯'],
    protein: ['🐟','🍗','🥚','🫘','🥜'],
    dairy: ['🥛','🧀','🍨']
  };
  const ALL = Object.values(GROUPS).flat();
  const keys = Object.keys(GROUPS);

  const rate = { easy:.70, normal:.60, hard:.52 }[diff] || .60; // สุ่มเป้าที่ "อยู่หมู่เป้าหมาย" ให้เจอบ่อยพอ

  // เลือกหมู่เป้าหมาย + goal size 1→2→3
  let target = keys[(Math.random()*keys.length)|0];
  let need = 1, got = 0;

  const deck = new MissionDeck(); deck.draw3();
  questHUDInit(); questHUDUpdate(deck, 'เลือกให้ถูกหมู่');

  let score=0, combo=0, misses=0;
  let secLeft=dur;
  const secTick=setInterval(()=>{
    secLeft=Math.max(0, secLeft-1);
    deck.second(); questHUDUpdate(deck);
    if (deck.isCleared() && secLeft>0){ deck.draw3(); questHUDUpdate(deck, 'Mini Quest ชุดใหม่!'); }
    if (secLeft<=0) clearInterval(secTick);
  },1000);

  function refreshGoalHUD(){
    window.dispatchEvent(new CustomEvent('hha:quest', {
      detail:{ goal:{label:`เป้า: เลือกหมู่ ${target.toUpperCase()} × ${need}`, prog:got, target:need} }
    }));
  }
  refreshGoalHUD();

  function judge(ch, st){
    const inTarget = GROUPS[target].includes(ch);
    let delta = 0, good=false;
    if (inTarget){ good=true; delta = 25 + Math.min(40, st.combo*2); }
    else { good=false; delta = -12; }
    return { good, scoreDelta: delta };
  }
  function onExpire(ev){
    if(!ev || ev.isGood) return; // ขยะ = นอกหมู่? ในโหมดนี้ถือ "ไม่นับหลีกขยะ" เพราะทุกอย่างเป็นอาหาร
  }

  function onHit(ch, pt){
    const inTarget = GROUPS[target].includes(ch);
    if(inTarget){
      got++;
      burstAtScreen(pt.x, pt.y, {color:'#22c55e', count:16});
      floatScoreScreen(pt.x, pt.y, '+', '#bbf7d0');
      if (got>=need){
        // เป้าสำเร็จ → เพิ่มระดับเป้า และสุ่มหมู่ใหม่
        need = Math.min(3, need+1);
        got = 0;
        target = keys[(Math.random()*keys.length)|0];
      }
    }else{
      burstAtScreen(pt.x, pt.y, {color:'#ef4444', count:12});
      floatScoreScreen(pt.x, pt.y, '-12', '#ffb4b4');
    }
    refreshGoalHUD();
  }
  function screenPt(ev){ const x=(ev.touches?.[0]?.clientX||ev.clientX), y=(ev.touches?.[0]?.clientY||ev.clientY); return {x,y}; }

  window.addEventListener('hha:score', (e)=>{
    if(!e?.detail) return;
    score=e.detail.score||0; combo=e.detail.combo||0;
    deck.updateScore(score); deck.updateCombo(combo); questHUDUpdate(deck);
  });
  window.addEventListener('hha:miss', ()=>{ misses++; });

  const clickHandler=(ev)=>{
    const t=ev.target; if(!t?.classList?.contains('hha-tgt')) return;
    const ch=t.textContent||''; const pt=screenPt(ev);
    onHit(ch, pt);
  };
  document.body.addEventListener('click', clickHandler, {passive:true});

  const endOnce=(e)=>{
    try{ clearInterval(secTick); }catch{}
    document.body.removeEventListener('click', clickHandler);
    const cleared = deck.getProgress().filter(p=>p.done).length;
    const detail = e?.detail||{};
    window.dispatchEvent(new CustomEvent('hha:end', {
      detail:{ ...detail, mode:'Food Groups', difficulty:diff, score, comboMax:combo, misses, duration:dur, questsCleared:cleared, questsTotal:3 }
    }));
    questHUDDispose();
    window.removeEventListener('hha:end', endOnce);
  };
  window.addEventListener('hha:end', endOnce, {once:true});

  const ctrl = await domBoot({
    host: cfg.host, difficulty: diff, duration: dur,
    goodRate: rate,
    pools: { 
      good: ALL.filter(ch=>GROUPS[target].includes(ch)), // ใส่กลุ่มเป้าเยอะขึ้นจาก rate
      bad:  ALL.filter(ch=>!GROUPS[target].includes(ch))
    },
    judge, onExpire
  });

  return {
    stop(){ try{ctrl.stop();}catch{} questHUDDispose(); },
    pause(){ try{ctrl.pause();}catch{} },
    resume(){ try{ctrl.resume();}catch{} }
  };
}
export default { boot };