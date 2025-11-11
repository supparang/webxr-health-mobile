// === modes/goodjunk.safe.js — Good vs Junk (2025-11-10) ===
import { boot as domFactoryBoot } from '../vr/mode-factory.js';
import { MissionDeck } from '../vr/mission.js';
import { questHUDInit, questHUDUpdate, questHUDDispose } from '../vr/quest-hud.js';
import { burstAtScreen, floatScoreScreen } from '../vr/ui-water.js';

// -------- พูลอิโมจิ --------
const GOOD = ['🍎','🍐','🍊','🍋','🍓','🍇','🍉','🍌','🥦','🥕','🥬','🍅','🌽','🥒','🥝','🥭','🍍'];
const JUNK = ['🍔','🍟','🍕','🌭','🍩','🍪','🍰','🧁','🍫','🍬','🍭','🥤','🧋'];
const POWERUPS = {
  STAR    : '⭐',   // +คะแนนพิเศษทันที
  DIAMOND : '💎',   // นับภารกิจเพชร
  SHIELD  : '🛡️',  // กันพลาดชั่วคราว
  FEVER   : '🔥',   // คูณคะแนนช่วงสั้น ๆ
};
const POWER_LIST = Object.values(POWERUPS);

// โอกาสเกิดพาวเวอร์อัพต่อชิ้น
const POWER_CHANCE = 0.08;

// -------- UI helper (pill แสดงสถานะพาวเวอร์) --------
function ensurePowerPill(){
  let el = document.getElementById('powerPill');
  if (el) return el;
  el = document.createElement('div');
  el.id = 'powerPill';
  Object.assign(el.style,{
    position:'fixed', top:'16px', right:'50%', transform:'translateX(190px)',
    background:'#0f172acc', border:'1px solid #334155', borderRadius:'12px',
    padding:'8px 12px', color:'#e2e8f0', font:'800 14px system-ui', zIndex:900
  });
  el.textContent = 'Power: —';
  el.setAttribute('data-hha-ui','');
  document.body.appendChild(el);
  return el;
}
function updatePowerPill(state){
  const el = ensurePowerPill();
  const flags = [];
  if (state.feverUntil > performance.now())   flags.push('🔥 Fever');
  if (state.shieldUntil > performance.now())  flags.push('🛡️ Shield');
  if (state.starFlash > performance.now())    flags.push('⭐');
  if (state.diaFlash > performance.now())     flags.push('💎');
  el.textContent = 'Power: ' + (flags.join(' · ') || '—');
}

// -------- HUD (pill + แผงเควสต์) --------
function pushQuestUI(deck, goal, hint='เก็บของดี เลี่ยงของขยะ'){
  const cur = deck.getCurrent();
  const progList = deck.getProgress();
  window.dispatchEvent(new CustomEvent('hha:quest',{
    detail:{
      text: cur ? `Mini Quest — ${cur.label}` : 'Mini Quest — กำลังเริ่ม…',
      goal: { label: goal.label, prog: goal.prog, target: goal.target },
      mini: cur ? {
        label: cur.label,
        prog: (progList.find(p=>p.id===cur.id)?.prog) || 0,
        target: cur.target || 0
      } : null
    }
  }));
  questHUDUpdate(deck, hint);
}

// -------- ตัวเกมหลักของโหมด --------
export async function boot({ host, difficulty='normal', duration=60 } = {}){
  questHUDDispose(); questHUDInit();

  // Goal หลัก
  const GOAL_TARGET = (difficulty==='easy') ? 20 : (difficulty==='hard' ? 30 : 25);
  const goal = { label:`เป้า: เก็บของดีให้ได้ ${GOAL_TARGET} ชิ้น`, prog:0, target:GOAL_TARGET };

  // Deck เควสต์ย่อย (3 ใบ)
  const deck = new MissionDeck();
  deck.draw3();
  pushQuestUI(deck, goal);

  // สถานะพาวเวอร์
  const PWR = {
    feverUntil: 0,
    shieldUntil: 0,
    starFlash: 0,
    diaFlash: 0,
    feverMul: 2,
  };
  updatePowerPill(PWR);

  // เอฟเฟกต์ชน
  function fxHit(x,y,good,delta){
    floatScoreScreen(x,y,(delta>0?'+':'')+delta,(good?'#a7f3d0':'#fecaca'));
    burstAtScreen(x,y,{ count: good?18:10, color: good?'#34d399':'#f97316' });
  }

  // เกณฑ์ตัดสินผลการจิ้ม (ใช้ใน mode-factory)
  function judge(char, { isGood }){
    // จัดการพาวเวอร์ก่อน
    if (char === POWERUPS.STAR){
      PWR.starFlash = performance.now() + 1200;
      updatePowerPill(PWR);
      // นับเป็นของดีและให้คะแนนพิเศษ
      return { good:true, scoreDelta: 80, power:'star' };
    }
    if (char === POWERUPS.DIAMOND){
      PWR.diaFlash = performance.now() + 1200;
      deck.onDiamond();                // แจ้งเด็คเพื่อเควสต์ 💎
      updatePowerPill(PWR);
      return { good:true, scoreDelta: 120, power:'diamond' };
    }
    if (char === POWERUPS.SHIELD){
      PWR.shieldUntil = performance.now() + 5000; // 5 วิ
      updatePowerPill(PWR);
      return { good:true, scoreDelta: 30, power:'shield' };
    }
    if (char === POWERUPS.FEVER){
      PWR.feverUntil = performance.now() + 6000; // 6 วิ
      deck.onFeverStart();
      updatePowerPill(PWR);
      return { good:true, scoreDelta: 40, power:'fever' };
    }

    // ปกติ: good/bad จากพูล + คูณ fever
    const mul = (PWR.feverUntil > performance.now()) ? PWR.feverMul : 1;
    const base = isGood ? 10 : -12;
    return { good:isGood, scoreDelta: base * mul };
  }

  // สุ่มพูล (ผสมพาวเวอร์ตามโอกาส)
  function buildPools(){
    // คลนนิ่งเพื่อไม่แก้ของเดิม
    const good = GOOD.slice();
    const bad  = JUNK.slice();
    // แทรกพาวเวอร์เป็นบางครั้ง
    if (Math.random() < POWER_CHANCE) good.push(POWERUPS.STAR);
    if (Math.random() < POWER_CHANCE) good.push(POWERUPS.DIAMOND);
    if (Math.random() < POWER_CHANCE) good.push(POWERUPS.SHIELD);
    if (Math.random() < POWER_CHANCE) good.push(POWERUPS.FEVER);
    return { good, bad };
  }

  // ฟังเหตุการณ์จาก factory
  function onHit(ev){
    const d = ev.detail||{};
    // อัปเดตเด็ค
    if (d.good) {
      deck.onGood();
      goal.prog = Math.min(goal.target, goal.prog + 1);
    } else {
      // ถ้าติด Shield → ยกโทษครั้งนี้
      if (PWR.shieldUntil > performance.now()){
        // ไม่รีเซ็ตคอมโบให้โทษเบา—ส่งสัญญาณแค่เอฟเฟกต์เล็กน้อย
      } else {
        deck.onJunk();
      }
    }
    fxHit(d.x||0, d.y||0, !!d.good, d.delta||0);
    pushQuestUI(deck, goal);
    updatePowerPill(PWR);
  }
  function onScore(ev){
    const s = ev.detail||{};
    deck.updateScore(s.score||0);
    deck.updateCombo(s.combo||0);
    pushQuestUI(deck, goal);
  }
  function onTime(){ deck.second(); pushQuestUI(deck, goal); }
  function onAvoid(){ deck.onJunk(); pushQuestUI(deck, goal); } // หลีกขยะ (หมดเวลา) = ถือว่าพลาดถูกต้องตามเควสต์

  window.addEventListener('hha:hit-screen', onHit);
  window.addEventListener('hha:score', onScore);
  window.addEventListener('hha:time', onTime);
  window.addEventListener('hha:avoid', onAvoid);

  // ตอนจบ: ส่งสรุปที่มี mini quests
  const onEnd = (ev)=>{
    const info = ev.detail||{};
    window.removeEventListener('hha:hit-screen', onHit);
    window.removeEventListener('hha:score', onScore);
    window.removeEventListener('hha:time', onTime);
    window.removeEventListener('hha:avoid', onAvoid);

    const cleared = deck.getProgress().filter(q=>q.done).length;
    const total   = deck.getProgress().length;
    // ส่งต่อไปยัง index (หน้าสรุปกำลังใช้ detail.from hha:end)
    window.dispatchEvent(new CustomEvent('hha:end', {
      detail: {
        ...info,
        questsCleared: cleared,
        questsTotal: total,
        goalCleared: goal.prog >= goal.target
      }
    }));
  };
  const onceEnd = (e)=>{ window.removeEventListener('hha:end', onceEnd); onEnd(e); };
  window.addEventListener('hha:end', onceEnd, { once:true });

  // เริ่มเกมผ่าน factory
  return domFactoryBoot({
    host,
    difficulty,
    duration,
    pools: buildPools(),
    goodRate: 0.70,
    judge,
    onExpire: (ev)=>{
      // เมื่อชิ้นหมดอายุ: ถ้าเป็นขยะ → หลีกสำเร็จ (สำหรับเควสต์ avoid)
      if (ev && ev.isGood===false) {
        window.dispatchEvent(new CustomEvent('hha:avoid', { detail:{ ch: ev.ch }}));
      }
    }
  });
}

export default { boot };
