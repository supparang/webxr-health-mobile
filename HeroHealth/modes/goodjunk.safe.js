// === /HeroHealth/modes/goodjunk.safe.js (DOM mode via mode-factory) ===
import { boot as domBoot } from '../vr/mode-factory.js';
import { MissionDeck } from '../vr/mission.js';
import { questHUDInit, questHUDUpdate, questHUDDispose } from '../vr/quest-hud.js';
import { floatScoreScreen, burstAtScreen } from '../vr/ui-water.js'; // ใช้เอฟเฟกต์จอ

export async function boot(cfg = {}) {
  const diff = String(cfg.difficulty || 'normal');
  const dur  = Number(cfg.duration   || (diff==='easy'?90:diff==='hard'?45:60));

  // Pools
  const GOOD = ['🥦','🥕','🍎','🐟','🥛','🍊','🍌','🍇','🥬','🍚','🥜','🍞','🍓','🍍','🥝','🍐'];
  const JUNK = ['🍔','🍟','🍕','🍩','🍪','🧁','🥤','🧋','🍫','🌭','🍰','🍬'];
  const STAR='⭐', DIA='💎', SHIELD='🛡️'; // ไอคอน (ไม่สุ่มใน DOM-factory; ใช้เป็นคะแนนโบนัสใน judge ได้)

  // Difficulty
  const tune = { easy:{goodRate:.76}, normal:{goodRate:.65}, hard:{goodRate:.55} };
  const goodRate = (tune[diff]||tune.normal).goodRate;

  // Quests HUD
  const deck = new MissionDeck();
  deck.draw3();
  questHUDInit(); questHUDUpdate(deck, 'ทำเควสต์ทีละใบ ▶️');

  // สถิติเกมฝั่งโหมด (เก็บไว้ทำ quest + summary)
  let score=0, combo=0, misses=0;
  let secLeft = dur;
  let secTick = setInterval(()=>{
    secLeft = Math.max(0, secLeft-1);
    deck.second();              // นับ no-miss ภายในเด็ค
    questHUDUpdate(deck);
    if (deck.isCleared() && secLeft>0) { deck.draw3(); questHUDUpdate(deck, 'Mini Quest ชุดใหม่!'); }
    if (secLeft<=0) { clearInterval(secTick); }
  },1000);

  // แปลงพิกัด event เป็นจอ เพื่อปล่อยเอฟเฟกต์
  function screenPt(ev){
    const x = (ev.touches && ev.touches[0] ? ev.touches[0].clientX : ev.clientX);
    const y = (ev.touches && ev.touches[0] ? ev.touches[0].clientY : ev.clientY);
    return {x,y};
  }

  // Judge — คืน {good, scoreDelta}
  function judge(ch, st){
    const goodFood = GOOD.includes(ch);
    // คะแนนพื้นฐาน
    let delta = 0, good = false;
    if (goodFood){ good=true; delta = 20 + Math.min(40, st.combo*2); }
    else { good=false; delta = -15; }

    return { good, scoreDelta: delta };
  }

  // onExpire: ขยะหมดอายุ = “หลีกขยะ” → deck.stats.junkMiss++ (ไม่รีเซ็ต noMiss)
  function onExpire(ev){
    if (!ev || ev.isGood) return;
    deck.stats.junkMiss = (deck.stats.junkMiss||0)+1;
    questHUDUpdate(deck);
  }

  // ฟังผลจาก HUD score/time เพื่อ sync deck
  window.addEventListener('hha:score', (e)=>{
    if(!e||!e.detail) return;
    score = e.detail.score||0;
    combo = e.detail.combo||0;
    deck.updateScore(score);
    deck.updateCombo(combo);
    questHUDUpdate(deck);
  });
  window.addEventListener('hha:miss',  ()=>{ misses++; /* noMiss ภายใน deck ถูกนับที่ second() */ });

  // เอฟเฟกต์ตอนคลิกเป้า (ฝั่ง DOM factory จะยิงคลิก element มาให้; เราเพิ่มเอฟเฟกต์ด้วยการฟังทั้งคลิก)
  document.body.addEventListener('click', (ev)=>{
    const t = ev.target;
    if (!t || !t.classList || !t.classList.contains('hha-tgt')) return;
    const ch = t.textContent||'';
    const pt = screenPt(ev);
    if (GOOD.includes(ch)){
      burstAtScreen(pt.x, pt.y, {color:'#22c55e', count:16});
      floatScoreScreen(pt.x, pt.y, '+'+(20 + Math.min(40, Math.max(0, combo-1)*2)));
      deck.onGood(); deck.updateScore(score); deck.updateCombo(combo+1);
    } else if (JUNK.includes(ch)){
      burstAtScreen(pt.x, pt.y, {color:'#ef4444', count:12});
      floatScoreScreen(pt.x, pt.y, '-15', '#ffb4b4');
      // คลิกโดนขยะ = พลาด → ให้รีเซ็ตนับ no-miss ภายใน second() โดยไม่ต้องแก้ตรงนี้
      deck.updateScore(score); deck.updateCombo(0);
    }
    questHUDUpdate(deck);
  }, {passive:true});

  // สรุปตอนจบ
  const endOnce = (e)=>{
    try { clearInterval(secTick); } catch {}
    const prog = deck.getProgress();
    const cleared = prog.filter(p=>p.done).length;
    const detail = e && e.detail ? e.detail : {};
    // ส่งซ้ำ event เดิมพร้อม quest
    window.dispatchEvent(new CustomEvent('hha:end', {
      detail:{
        ...detail,
        mode:'Good vs Junk',
        difficulty:diff,
        score, comboMax:combo, misses,
        duration:dur,
        questsCleared: cleared, questsTotal: 3
      }
    }));
    questHUDDispose();
    window.removeEventListener('hha:end', endOnce);
  };
  window.addEventListener('hha:end', endOnce, {once:true});

  // เริ่มเกมผ่าน DOM factory
  const ctrl = await domBoot({
    host: cfg.host,
    difficulty: diff,
    duration: dur,
    goodRate,
    pools: { good: GOOD, bad: JUNK },
    judge,
    onExpire
  });

  return {
    stop(){ try{ ctrl.stop(); }catch{} questHUDDispose(); },
    pause(){ try{ ctrl.pause(); }catch{} },
    resume(){ try{ ctrl.resume(); }catch{} }
  };
}
export default { boot };