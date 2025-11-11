// === /HeroHealth/modes/hydration.quest.js (DOM mode + Water Gauge + quests) ===
import { boot as domBoot } from '../vr/mode-factory.js';
import { MissionDeck } from '../vr/mission.js';
import { questHUDInit, questHUDUpdate, questHUDDispose } from '../vr/quest-hud.js';
import { ensureWaterGauge, destroyWaterGauge, setWaterGauge, zoneFrom, floatScoreScreen, burstAtScreen } from '../vr/ui-water.js';

export async function boot(cfg = {}) {
  const diff = String(cfg.difficulty || 'normal');
  const dur  = Number(cfg.duration   || (diff==='easy'?90:diff==='hard'?45:60));

  const GOOD = ['💧','🚰','🥛','🍊','🍋']; // น้ำ/นม/ผลไม้ฉ่ำน้ำ
  const BAD  = ['🧋','🥤','🍹','🧃','🍺']; // เครื่องดื่มหวาน/ขับน้ำ

  const rate = { easy:.74, normal:.62, hard:.52 }[diff] || .62;
  let water = 55; ensureWaterGauge(); setWaterGauge(water);

  const deck = new MissionDeck(); deck.draw3();
  questHUDInit(); questHUDUpdate(deck, 'รักษาน้ำให้สมดุล + ทำมินิเควสต์');

  let score=0, combo=0, misses=0;
  let secLeft = dur;
  const secTick = setInterval(()=>{
    secLeft = Math.max(0, secLeft-1);
    deck.second();
    questHUDUpdate(deck);
    if (deck.isCleared() && secLeft>0) { deck.draw3(); questHUDUpdate(deck, 'Mini Quest ชุดใหม่!'); }
    if (secLeft<=0) clearInterval(secTick);
  },1000);

  function judge(ch, st){
    const good = GOOD.includes(ch);
    let delta = 0;
    if (good){
      delta = 20 + Math.min(40, st.combo*2);
    } else {
      const z = zoneFrom(water);
      delta = (z==='HIGH') ? +5 : -20;
    }
    return { good, scoreDelta: delta };
  }
  function onExpire(ev){
    if(!ev || ev.isGood) return;
    // junk หมดอายุ = เลี่ยงขยะสำเร็จ
    deck.stats.junkMiss = (deck.stats.junkMiss||0)+1;
    questHUDUpdate(deck);
  }

  function onHitVisual(ch, pt){
    if (GOOD.includes(ch)){
      water = Math.min(100, water+6);
      setWaterGauge(water);
      burstAtScreen(pt.x, pt.y, {color:'#22c55e', count:16});
      floatScoreScreen(pt.x, pt.y, '+', '#a7f3d0');
      deck.onGood();
    } else if (BAD.includes(ch)){
      const z = zoneFrom(water);
      if (z==='HIGH'){ score+=5; floatScoreScreen(pt.x, pt.y, '+5 (High)'); }
      else { score=Math.max(0, score-20); combo=0; floatScoreScreen(pt.x, pt.y, '-20', '#ffb4b4'); }
      water = Math.max(0, water-8); setWaterGauge(water);
      burstAtScreen(pt.x, pt.y, {color:'#ef4444', count:12});
    }
    questHUDUpdate(deck);
  }
  function screenPt(ev){ const x=(ev.touches?.[0]?.clientX||ev.clientX), y=(ev.touches?.[0]?.clientY||ev.clientY); return {x,y}; }

  // Sync คะแนน/คอมโบจาก factory
  window.addEventListener('hha:score', (e)=>{
    if(!e?.detail) return;
    score = e.detail.score||0;
    combo = e.detail.combo||0;
    deck.updateScore(score);
    deck.updateCombo(combo);
    questHUDUpdate(deck);
  });
  window.addEventListener('hha:miss', ()=>{ misses++; });

  // เอฟเฟกต์ตอนตี
  const clickHandler = (ev)=>{
    const t=ev.target; if(!t?.classList?.contains('hha-tgt')) return;
    const ch=t.textContent||''; const pt=screenPt(ev);
    onHitVisual(ch, pt);
  };
  document.body.addEventListener('click', clickHandler, {passive:true});

  const endOnce=(e)=>{
    try{ clearInterval(secTick); }catch{}
    document.body.removeEventListener('click', clickHandler);
    const cleared = deck.getProgress().filter(p=>p.done).length;
    const detail = e?.detail||{};
    window.dispatchEvent(new CustomEvent('hha:end', {
      detail:{ ...detail, mode:'Hydration', difficulty:diff, score, comboMax:combo, misses, duration:dur, questsCleared:cleared, questsTotal:3 }
    }));
    destroyWaterGauge(); questHUDDispose();
    window.removeEventListener('hha:end', endOnce);
  };
  window.addEventListener('hha:end', endOnce, {once:true});

  const ctrl = await domBoot({
    host: cfg.host, difficulty: diff, duration: dur,
    goodRate: rate, pools:{good:GOOD, bad:BAD}, judge, onExpire
  });

  return {
    stop(){ try{ctrl.stop();}catch{} destroyWaterGauge(); questHUDDispose(); },
    pause(){ try{ctrl.pause();}catch{} },
    resume(){ try{ctrl.resume();}catch{} }
  };
}
export default { boot };