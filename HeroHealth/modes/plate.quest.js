// === /HeroHealth/modes/plate.quest.js (DOM mode + รอบ “ครบ 5 หมู่”) ===
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
  const rate = { easy:.66, normal:.58, hard:.50 }[diff] || .58;

  let round = {veg:false,fruit:false,grain:false,protein:false,dairy:false};
  function roundCleared(){ return Object.values(round).every(Boolean); }

  const deck = new MissionDeck(); deck.draw3();
  questHUDInit(); questHUDUpdate(deck, 'จัดครบ 5 หมู่');

  let score=0, combo=0, misses=0;
  let secLeft=dur;
  const secTick=setInterval(()=>{
    secLeft=Math.max(0, secLeft-1);
    deck.second(); questHUDUpdate(deck);
    if (deck.isCleared() && secLeft>0){ deck.draw3(); questHUDUpdate(deck, 'Mini Quest ชุดใหม่!'); }
    if (secLeft<=0) clearInterval(secTick);
  },1000);

  function refreshGoalHUD(){
    const done = Object.keys(round).filter(k=>round[k]).length;
    window.dispatchEvent(new CustomEvent('hha:quest', {
      detail:{ goal:{label:'เป้า: จัดครบ 5 หมู่', prog:done, target:5} }
    }));
  }
  refreshGoalHUD();

  function groupOf(ch){ return Object.keys(GROUPS).find(k=>GROUPS[k].includes(ch)); }

  function judge(ch, st){
    const gk = groupOf(ch);
    let good=false, delta=0;
    if(gk){ good=true; delta = 22 + Math.min(40, st.combo*2); }
    else { good=false; delta=-10; }
    return { good, scoreDelta:delta };
  }
  function onExpire(){ /* ไม่มีขยะจริงในโหมดนี้; ข้าม */ }

  function onHit(ch, pt){
    const gk = groupOf(ch);
    if(gk){
      round[gk]=true;
      burstAtScreen(pt.x, pt.y, {color:'#22c55e', count:16});
      floatScoreScreen(pt.x, pt.y, '+', '#bbf7d0');
      if (roundCleared()){
        score += 100;
        floatScoreScreen(pt.x, pt.y, 'ROUND +100', '#fde68a');
        round = {veg:false,fruit:false,grain:false,protein:false,dairy:false};
      }
    } else {
      burstAtScreen(pt.x, pt.y, {color:'#ef4444', count:12});
      floatScoreScreen(pt.x, pt.y, '-10', '#ffb4b4');
    }
    refreshGoalHUD();
  }
  function screenPt(ev){ const x=(ev.touches?.[0]?.clientX||ev.clientX), y=(ev.touches?.[0]?.clientY||ev.clientY); return {x,y}; }

  window.addEventListener('hha:score',(e)=>{
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
      detail:{ ...detail, mode:'Healthy Plate', difficulty:diff, score, comboMax:combo, misses, duration:dur, questsCleared:cleared, questsTotal:3 }
    }));
    questHUDDispose();
    window.removeEventListener('hha:end', endOnce);
  };
  window.addEventListener('hha:end', endOnce, {once:true});

  const ctrl = await domBoot({
    host: cfg.host, difficulty: diff, duration: dur,
    goodRate: rate, pools:{good:ALL, bad:[]}, judge, onExpire
  });

  return {
    stop(){ try{ctrl.stop();}catch{} questHUDDispose(); },
    pause(){ try{ctrl.pause();}catch{} },
    resume(){ try{ctrl.resume();}catch{} }
  };
}
export default { boot };