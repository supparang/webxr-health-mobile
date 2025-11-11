// DOM version via mode-factory (spawns guaranteed)
import { boot as run } from '../vr/mode-factory.js';
import { MissionDeck } from '../vr/mission.js';

export async function boot(cfg = {}) {
  const deck = new MissionDeck().draw3();
  const GOOD = ['🥦','🥕','🍎','🐟','🥛','🍊','🍌','🍇','🥬','🍚','🥜','🍞','🍓','🍍','🥝','🍐'];
  const JUNK = ['🍔','🍟','🍕','🍩','🍪','🧁','🥤','🧋','🍫','🌭','🍰','🍬'];
  const STAR='⭐', DIA='💎', SHIELD='🛡️';

  // Goal: เก็บของดีให้ได้ 25 ชิ้น
  let goodOK = 0;
  const goalTotal = 25;
  showGoal(`เก็บของดีให้ได้ ${goalTotal} ชิ้น — คืบหน้า ${goodOK}/${goalTotal}`);

  function judge(ch, s){
    if (ch===STAR){ deck.onStar(); return {good:true, scoreDelta:40}; }
    if (ch===DIA ){ deck.onDiamond(); return {good:true, scoreDelta:80}; }
    if (ch===SHIELD){ return {good:true, scoreDelta:0}; }

    const isGood = GOOD.includes(ch);
    if (isGood){
      goodOK++; deck.onGood();
      updateGoal(`เก็บของดีให้ได้ ${goalTotal} ชิ้น — คืบหน้า ${goodOK}/${goalTotal}`);
      return {good:true, scoreDelta: 20 + Math.max(0, s.combo*2) };
    } else {
      deck.onJunk();
      return {good:false, scoreDelta: -15};
    }
  }

  // HUD Mini quest (ทีละใบ)
  showQuest(deck.getCurrent()?.label || 'กำลังเริ่ม…');
  const off1 = listen('hha:score', e=>{
    deck.updateScore(e.detail?.score||0);
    deck.updateCombo(e.detail?.combo||0);
    if (deck._autoAdvance()) showQuest(deck.getCurrent()?.label || 'ครบแล้ว!');
  });

  // extra time if cleared early
  const off2 = listen('hha:time', e=>{
    if (e.detail?.sec>0 && deck.isCleared()){
      // เพิ่มภารกิจสุ่มต่อเมื่อเหลือเวลา
      const more = new MissionDeck().draw3();
      deck.deck.push(...more.filter(q=>!deck.deck.find(x=>x.id===q.id)));
      showQuest(deck.getCurrent()?.label || 'Bonus Quest!');
    }
  });

  // เรียกเครื่อง
  const g = await run({
    host: cfg.host,
    difficulty: cfg.difficulty || 'normal',
    duration: cfg.duration,
    pools: { good: [...GOOD, STAR, DIA, SHIELD], bad: JUNK },
    goodRate: 0.65,
    judge
  });

  // clean
  return {
    stop(){ off1(); off2(); g.stop(); },
    pause(){ g.pause(); deck.pause(); },
    resume(){ deck.resume(); g.resume(); }
  };
}

/* ---------- tiny HUD helpers (DOM) ---------- */
function showGoal(text){ upsert('goalLine', text); }
function updateGoal(text){ upsert('goalLine', text); }
function showQuest(text){ upsert('questLine', `Quest ${text}`); }
function upsert(id, text){
  let wrap = document.getElementById('goalQuestPanel');
  if(!wrap){
    wrap = document.createElement('div');
    wrap.id = 'goalQuestPanel';
    wrap.style.cssText = 'position:fixed;left:0;right:0;bottom:8px;padding:8px 14px;z-index:910;color:#e8eefc;font:600 14px system-ui';
    const box = document.createElement('div');
    box.id='goalLine'; box.style.marginBottom='6px'; wrap.appendChild(box);
    const box2=document.createElement('div'); box2.id='questLine'; wrap.appendChild(box2);
    document.body.appendChild(wrap);
  }
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}
function listen(name, fn){ window.addEventListener(name, fn); return ()=>window.removeEventListener(name,fn); }
export default { boot };