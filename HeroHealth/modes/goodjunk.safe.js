// === modes/goodjunk.safe.js — Good vs Junk (wired to hit-screen/expired) ===
import { boot as factoryBoot } from '../vr/mode-factory.js';
import { MissionDeck } from '../vr/mission.js';
import { questHUDInit, questHUDUpdate, questHUDDispose } from '../vr/quest-hud.js';
import { burstAtScreen, floatScoreScreen } from '../vr/ui-water.js';

// พูล
const GOOD = ['🍎','🍐','🍊','🍋','🍓','🍇','🍉','🍌','🥦','🥕','🥬','🍅','🌽','🥒','🥝','🥭','🍍'];
const JUNK = ['🍔','🍟','🍕','🌭','🍩','🍪','🍰','🧁','🍫','🍬','🍭','🥤','🧋'];
const PWR = { STAR:'⭐', DIAMOND:'💎', SHIELD:'🛡️', FEVER:'🔥' };
const POWER_CHANCE = 0.08;

export async function boot({host, difficulty='normal', duration=60} = {}){
  // HUD ภารกิจ
  questHUDDispose(); questHUDInit();

  // Goal หลัก
  const GOAL_TARGET = (difficulty==='easy') ? 20 : (difficulty==='hard' ? 30 : 25);
  const goal = { label:`เป้า: เก็บของดีให้ได้ ${GOAL_TARGET} ชิ้น`, prog:0, target:GOAL_TARGET };

  // Mini quests
  const deck = new MissionDeck(); deck.draw3();

  function pushHUD(){
    const cur = deck.getCurrent();
    const prog = deck.getProgress();
    window.dispatchEvent(new CustomEvent('hha:quest',{
      detail:{
        text: cur ? `Mini Quest — ${cur.label}` : 'Mini Quest — กำลังเริ่ม…',
        goal: { label: goal.label, prog: goal.prog, target: goal.target },
        mini: cur ? { label: cur.label, prog: (prog.find(p=>p.id===cur.id)?.prog)||0, target:cur.target||0 } : null
      }
    }));
    questHUDUpdate(deck);
  }
  pushHUD();

  // สถานะพาวเวอร์
  let feverUntil=0, shieldUntil=0;

  // เอฟเฟกต์จอ
  function fx(x,y,good,delta){
    floatScoreScreen(x,y,(delta>0?'+':'')+delta,(good?'#a7f3d0':'#fecaca'));
    burstAtScreen(x,y,{count: good?18:10, color: good?'#34d399':'#f97316'});
  }

  // สุ่มพูล (ใส่พาวเวอร์บางครั้ง)
  function makePools(){
    const good=GOOD.slice(), bad=JUNK.slice();
    if(Math.random()<POWER_CHANCE) good.push(PWR.STAR);
    if(Math.random()<POWER_CHANCE) good.push(PWR.DIAMOND);
    if(Math.random()<POWER_CHANCE) good.push(PWR.SHIELD);
    if(Math.random()<POWER_CHANCE) good.push(PWR.FEVER);
    return {good,bad};
  }

  // ตอบสนองเหตุการณ์จาก factory
  function onHit(e){
    const d=e.detail||{};
    // นับ goal/mini
    if (d.good) { deck.onGood(); goal.prog = Math.min(goal.target, goal.prog+1); }
    else { deck.onJunk(); } // โดนขยะ = พลาด

    // เอฟเฟกต์
    fx(d.x||0,d.y||0,!!d.good,d.delta||0);

    // อัปเดต HUD
    pushHUD();
  }
  function onScore(e){
    const s=e.detail||{};
    deck.updateScore(s.score||0);
    deck.updateCombo(s.combo||0);
    pushHUD();
  }
  function onTime(){ deck.second(); pushHUD(); }
  function onAvoid(){ deck.onJunk(); pushHUD(); } // ขยะหมดเวลา = หลีกสำเร็จ(นับภารกิจหลบ)

  // ฟัง event
  window.addEventListener('hha:hit-screen', onHit);
  window.addEventListener('hha:score', onScore);
  window.addEventListener('hha:time', onTime);
  window.addEventListener('hha:expired', onAvoid); // หรือ hha:avoid ก็ฟังไว้แล้ว

  // สรุปผล: เติมจำนวน mini quests + goalCleared
  const onEndOnce = (ev)=>{
    window.removeEventListener('hha:hit-screen', onHit);
    window.removeEventListener('hha:score', onScore);
    window.removeEventListener('hha:time', onTime);
    window.removeEventListener('hha:expired', onAvoid);

    const cleared = deck.getProgress().filter(q=>q.done).length;
    const total   = deck.getProgress().length;

    const base = ev.detail||{};
    // ส่ง hha:end ใหม่ที่มีข้อมูลสรุปครบ (index จะอ่านอันนี้)
    window.dispatchEvent(new CustomEvent('hha:end',{
      detail:{
        ...base,
        questsCleared: cleared,
        questsTotal: total,
        goalCleared: goal.prog >= goal.target
      }
    }));
  };
  window.addEventListener('hha:end', onEndOnce, { once:true });

  // judge: ให้ factory ใช้เพื่อตัดสิน + จัดการพาวเวอร์
  function judge(char, {isGood}){
    const now=performance.now();
    if (char===PWR.STAR)    return {good:true, scoreDelta:80};
    if (char===PWR.DIAMOND){ deck.onDiamond(); return {good:true, scoreDelta:120}; }
    if (char===PWR.SHIELD){ shieldUntil=now+5000; return {good:true, scoreDelta:30}; }
    if (char===PWR.FEVER){  feverUntil=now+6000; deck.onFeverStart(); return {good:true, scoreDelta:40}; }
    const mul = (feverUntil>now)?2:1;
    return {good:isGood, scoreDelta:(isGood?10:-12)*mul};
  }

  // เปิดเกมผ่าน factory
  return factoryBoot({
    host, difficulty, duration,
    pools: makePools(),
    goodRate: 0.70,
    judge,
    onExpire: (ev)=>{ if (ev && ev.isGood===false) window.dispatchEvent(new CustomEvent('hha:expired',{detail:ev})); }
  });
}

export default { boot };
