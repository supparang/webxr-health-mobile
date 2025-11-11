// === /HeroHealth/modes/goodjunk.safe.js (goal capped + auto new quest set) ===
import { boot as run } from '../vr/mode-factory.js';
import { MissionDeck } from '../vr/mission.js';

/* ---------------- HUD: Goal Panel ---------------- */
function ensureGoalPanel(){
  const old = document.getElementById('goalPanel'); if (old) { try{ old.remove(); }catch(e){} }
  const wrap = document.createElement('div');
  wrap.id='goalPanel'; wrap.setAttribute('data-hha-ui','');
  Object.assign(wrap.style,{
    position:'fixed',left:'50%',bottom:'64px',transform:'translateX(-50%)',
    width:'min(820px,92vw)',background:'#0f172acc',color:'#e8eefc',
    border:'1px solid #334155',borderRadius:'14px',padding:'12px 14px',
    backdropFilter:'blur(6px)',zIndex:'900',fontFamily:'system-ui,-apple-system,Segoe UI,Roboto,Thonburi,sans-serif'
  });
  wrap.innerHTML =
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">'+
      '<div id="goalTitle" style="font-weight:800">เป้า:</div>'+
      '<div id="goalMode"  style="opacity:.8">โหมด: normal</div>'+
    '</div>'+
    '<div style="height:10px;background:#0b1222;border:1px solid #334155;border-radius:999px;overflow:hidden">'+
      '<div id="goalFill" style="height:100%;width:0%;background:linear-gradient(90deg,#22c55e,#93c5fd)"></div>'+
    '</div>'+
    '<div id="questLine" style="margin-top:10px;font-weight:700;opacity:.95"></div>';
  document.body.appendChild(wrap);
}
function setGoalText(s){ const el=document.getElementById('goalTitle'); if(el) el.textContent=s; }
function setGoalPct(p){ const f=document.getElementById('goalFill'); if(f) f.style.width=Math.max(0,Math.min(100,p))+'%'; }
function setModeLabel(d){ const el=document.getElementById('goalMode'); if(el) el.textContent='โหมด: '+d; }
function setQuestLine(s){ const el=document.getElementById('questLine'); if(el) el.textContent=s; }

/* ---------------- Quest deck (เฉพาะที่นับจาก hit/score/combo) ---------------- */
function buildDeck(){
  const pool = [
    {id:'good10',   level:'easy',   label:'เก็บของดี 10 ชิ้น',    check:s=>s.goodCount>=10,  prog:s=>Math.min(10,s.goodCount), target:10},
    {id:'combo10',  level:'normal', label:'ทำคอมโบ 10',           check:s=>s.comboMax>=10,   prog:s=>Math.min(10,s.comboMax),  target:10},
    {id:'score500', level:'hard',   label:'ทำคะแนน 500+',          check:s=>s.score>=500,     prog:s=>Math.min(500,s.score),    target:500},
    {id:'star2',    level:'normal', label:'เก็บดาว ⭐ 2 ดวง',       check:s=>s.star>=2,        prog:s=>Math.min(2,s.star),       target:2},
    {id:'diamond1', level:'hard',   label:'เก็บเพชร 💎 1 เม็ด',     check:s=>s.diamond>=1,     prog:s=>Math.min(1,s.diamond),    target:1}
  ];
  const md = new MissionDeck({ pool });
  md.draw3();
  return md;
}

/* ---------------- Game ---------------- */
export async function boot(cfg = {}){
  const diff = String(cfg.difficulty || 'normal');
  const dur  = Number(cfg.duration  || (diff==='easy'?90:diff==='hard'?45:60));
  const GOAL_TOTAL = 25;

  // score state
  let score=0, combo=0, starCount=0, diamondCount=0;
  let goodOK=0, goalDone=false;

  // quest state
  let deck = buildDeck();
  let deckRound = 1;                 // ชุดที่เท่าไร (เริ่มชุดแรก)
  let totalCleared = 0;              // นับจำนวนเควสต์ที่ผ่านทั้งหมด
  let remainSec = dur;

  // items
  const GOOD=['🥦','🥕','🍎','🐟','🥛','🍊','🍌','🍇','🥬','🍚','🥜','🍞','🍓','🍍','🥝','🍐'];
  const JUNK=['🍔','🍟','🍕','🍩','🍪','🧁','🥤','🧋','🍫','🌭','🍰','🍬'];
  const STAR='⭐', DIA='💎', SHIELD='🛡️';

  // HUD
  ensureGoalPanel(); setModeLabel(diff);
  setGoalText(`เป้า: เก็บของดีให้ได้ ${GOAL_TOTAL} ชิ้น — คืบหน้า 0/${GOAL_TOTAL}`); setGoalPct(0);
  function updateQuestHUD(){
    const cur = deck.getCurrent();
    const label = cur ? cur.label : 'กำลังเริ่ม…';
    window.dispatchEvent(new CustomEvent('hha:quest',{detail:{text:`Quest ${deck.currentIndex+1}/3 — ${label}`}}));
    setQuestLine(`Quest ${deck.currentIndex+1}/3 — ${label}`);
  }
  updateQuestHUD();

  // ดึงเวลาจาก mode-factory
  window.addEventListener('hha:time', (e)=>{ if (e && e.detail && Number.isFinite(e.detail.sec)) remainSec = e.detail.sec; });

  function tryRefillDeck(){
    // เพิ่มชุดใหม่ถ้าเคลียร์ครบ 3 และเวลาเหลือ > 3s
    if (deck.isCleared() && remainSec > 3) {
      totalCleared += 3;
      deck = buildDeck();          // สุ่ม 3 ใบใหม่
      deckRound += 1;
      updateQuestHUD();
      window.dispatchEvent(new CustomEvent('hha:quest:newset',{detail:{round:deckRound}}));
    }
  }

  function judge(ch){
    let res={good:false,scoreDelta:0};

    if (ch===STAR){
      score+=40; starCount++; deck.onStar(); deck.updateScore(score);
      res={good:true,scoreDelta:+40};
    } else if (ch===DIA){
      score+=80; diamondCount++; deck.onDiamond(); deck.updateScore(score);
      res={good:true,scoreDelta:+80};
    } else if (ch===SHIELD){
      // ให้ค่าเล็กน้อยเพื่อความรู้สึก
      score+=10; deck.updateScore(score);
      res={good:true,scoreDelta:+10};
    } else if (GOOD.indexOf(ch)>=0){
      const delta = 20 + combo*2;
      score += delta; combo++;
      // ---- Goal: คุมไม่ให้เกิน 25/25 ----
      if (!goalDone) {
        goodOK = Math.min(GOAL_TOTAL, goodOK + 1);
        setGoalText(`เป้า: เก็บของดีให้ได้ ${GOAL_TOTAL} ชิ้น — คืบหน้า ${goodOK}/${GOAL_TOTAL}`);
        setGoalPct((goodOK/GOAL_TOTAL)*100);
        if (goodOK >= GOAL_TOTAL) {
          goalDone = true;
          // แจ้งว่า goal เสร็จ (index จะโชว์เองถ้รองรับ)
          window.dispatchEvent(new CustomEvent('hha:goal',{detail:{done:true, total:GOAL_TOTAL}}));
        }
      }
      deck.onGood(); deck.updateScore(score); deck.updateCombo(combo);
      res={good:true,scoreDelta:+delta};
    } else {
      combo=0; score=Math.max(0, score-15); deck.updateScore(score); deck.updateCombo(combo);
      res={good:false,scoreDelta:-15};
    }

    // HUD คะแนน
    window.dispatchEvent(new CustomEvent('hha:score',{detail:{score,combo}}));

    // ขยับเควสต์ + เติมชุดใหม่ถ้าจบ
    const progressed = deck._autoAdvance ? deck._autoAdvance() : false;
    if (progressed) updateQuestHUD();
    tryRefillDeck();
    return res;
  }

  // ฟัง end เพื่อยิงสรุปเสริม (รวม goal/quests)
  function onEnd(e){
    const base = (e && e.detail) ? e.detail : {};
    const clearedNow = deck.getProgress().filter(p=>p.done).length;
    const sum = {
      ...base,
      mode:'Good vs Junk',
      difficulty: diff,
      score,
      combo,
      goalDone,
      questsCleared: totalCleared + clearedNow,
      questsTotal: (deckRound-1)*3 + 3
    };
    // กระจายสรุปฉบับเต็มแยก event (ปลอดภัยกว่าการ re-dispatch hha:end)
    window.dispatchEvent(new CustomEvent('hha:quest-summary',{detail:sum}));
  }
  window.addEventListener('hha:end', onEnd, { once:true });

  // เริ่มเกม (ใช้ DOM spawner)
  const g = await run({
    host: cfg.host || document.querySelector('#spawnHost') || document.body,
    difficulty: diff,
    duration: dur,
    pools: { good:[].concat(GOOD,[STAR,DIA,SHIELD]), bad:JUNK },
    goodRate: 0.65,
    judge
  });

  return {
    stop(){ try{ g.stop&&g.stop(); }catch(e){} },
    pause(){ try{ g.pause&&g.pause(); deck.pause(); }catch(e){} },
    resume(){ try{ g.resume&&g.resume(); deck.resume(); updateQuestHUD(); }catch(e){} }
  };
}

export default { boot };