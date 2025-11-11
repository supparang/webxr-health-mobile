// === modes/groups.safe.js — Food Groups w/ Goal + Mini Quests (2025-11-10) ===
import { boot as domFactoryBoot } from '../vr/mode-factory.js';
import { MissionDeck } from '../vr/mission.js';
import { questHUDInit, questHUDUpdate, questHUDDispose } from '../vr/quest-hud.js';
import { burstAtScreen, floatScoreScreen } from '../vr/ui-water.js';

// --- พูลอิโมจิตามหมวด ---
const FRUIT   = ['🍎','🍐','🍊','🍋','🍌','🍉','🍇','🍓','🍒','🥭','🍍','🥝','🍑','🍈','🍅'];
const VEG     = ['🥕','🥦','🧅','🧄','🌽','🥬','🍆','🥒','🫑','🍄','🥔','🧄'];
const PROTEIN = ['🍗','🍖','🥩','🍤','🍣','🥚','🌰','🥜','🫘','🧆'];
const DAIRY   = ['🥛','🧀','🍦','🍨','🍧','🍮','🍯','🍶'];
const GRAIN   = ['🍞','🥐','🥖','🥨','🥯','🍙','🍚','🍘','🍜','🍝','🍕','🌮','🌯'];
const JUNK    = ['🍩','🍪','🍰','🧁','🍫','🍬','🍭','🥤','🧋','🍟','🍔'];

const GROUPS = { FRUIT, VEG, PROTEIN, DAIRY, GRAIN };

// สุ่ม “หมวดที่ถูกต้อง” สำหรับรอบนี้ แล้วทำให้ของหมวดนั้นเป็น Good ที่เหลือคือ Bad (รวม JUNK)
function buildPools(targetGroup='FRUIT'){
  const good = GROUPS[targetGroup] || FRUIT;
  let bad = [];
  for (const [k,arr] of Object.entries(GROUPS)) if (k!==targetGroup) bad = bad.concat(arr);
  bad = bad.concat(JUNK);
  return { good, bad };
}

// helper UI อัปเดตข้อความบน HUD หลัก (แถบล่างและ pill บน)
function pushQuestUI(deck, goal){
  const cur = deck.getCurrent();
  const progList = deck.getProgress();
  // บอกกับ index.vr.html เพื่ออัปเดต pill + แถบล่าง
  window.dispatchEvent(new CustomEvent('hha:quest',{
    detail: {
      text: cur ? `Mini Quest — ${cur.label}` : 'Mini Quest — กำลังเริ่ม…',
      goal: goal && {
        label: goal.label,
        prog : goal.prog,
        target: goal.target
      },
      mini: cur && {
        label: cur.label,
        prog : (typeof cur.prog==='number'?cur.prog:progList.find(p=>p.id===cur.id)?.prog) || 0,
        target: cur.target || 0
      }
    }
  }));
  questHUDUpdate(deck, 'เลือกให้ถูกหมวด');
}

// === boot ===
export async function boot({ host, difficulty='normal', duration=60 } = {}){
  questHUDDispose(); // กันซ้อน
  questHUDInit();

  // สุ่มหมวดเป้าหมายของรอบ
  const TARGETS = ['FRUIT','VEG','PROTEIN','DAIRY','GRAIN'];
  const targetGroup = TARGETS[(Math.random()*TARGETS.length)|0];
  let pools = buildPools(targetGroup);

  // Goal: เลือกให้ถูก “หมวดที่กำหนด” ให้ครบ N ชิ้น
  const GOAL_TARGET = (difficulty==='easy') ? 6 : (difficulty==='hard' ? 10 : 8);
  const goal = { label:`เป้า: เลือกหมู่ ${targetGroup} × ${GOAL_TARGET}`, prog:0, target:GOAL_TARGET };

  // Deck สำหรับ Mini Quests (ใช้พูลเริ่มต้นจาก MissionDeck)
  const deck = new MissionDeck();
  deck.draw3(); // easy/normal/hard อย่างละ 1 จากพูลมาตรฐาน
  pushQuestUI(deck, goal);

  // เอฟเฟกต์ชน (เด้งคะแนน + แตก)
  function fxHit(x,y,good,delta){
    floatScoreScreen(x,y,(delta>0?'+':'')+delta,(good?'#a7f3d0':'#fecaca'));
    burstAtScreen(x,y,{ count: good?18:10, color: good?'#34d399':'#f97316' });
  }

  // เกณฑ์ตัดสินว่าคลิกถูก/ผิด
  function judge(char, { isGood }){
    // factory คำนวณ isGood จาก pool แล้ว → ใช้เป็นผลเลย และให้คะแนนเล็กน้อย
    return { good:isGood, scoreDelta: isGood ? 5 : -8 };
  }

  // ฟัง event จาก factory เพื่ออัปเดต deck/goal/HUD
  window.addEventListener('hha:hit-screen', onHit);
  window.addEventListener('hha:time', onSecond);

  function onHit(ev){
    const d = ev.detail||{};
    // เอฟเฟกต์
    fxHit(d.x||0, d.y||0, !!d.good, d.delta||0);

    // นับ goal
    if (d.good) goal.prog = Math.min(goal.target, goal.prog+1);

    // อัปเดตสถิติให้ deck
    if (d.good) deck.onGood(); else deck.onJunk();
    // combo/score ถูกยิงแยกใน hha:score แต่อัปเดตซ้ำอีกชั้นเพื่อ safety
    if (typeof d.delta==='number') {
      // จะถูกแทนที่ด้วยค่าสูงสุดใน updateScore / updateCombo จาก hha:score
    }

    pushQuestUI(deck, goal);
  }

  function onSecond(){ deck.second(); pushQuestUI(deck, goal); }

  // สรุปเมื่อจบ
  const onEnd = (ev)=>{
    // ส่งข้อมูลเพิ่มสำหรับหน้าสรุป
    const info = ev.detail||{};
    window.removeEventListener('hha:hit-screen', onHit);
    window.removeEventListener('hha:time', onSecond);
    window.dispatchEvent(new CustomEvent('hha:end', {
      detail: {
        ...info,
        questsCleared: deck.getProgress().filter(q=>q.done).length,
        questsTotal: deck.getProgress().length,
        goalCleared: goal.prog >= goal.target
      }
    }));
  };
  const onceEnd = (e)=>{ window.removeEventListener('hha:end', onceEnd); onEnd(e); };
  window.addEventListener('hha:end', onceEnd, { once:true });

  // เริ่มสปอว์นด้วย factory
  return domFactoryBoot({
    host,
    difficulty,
    duration,
    pools: pools,
    goodRate: 0.65,
    judge
  });
}

export default { boot };
