// === /HeroHealth/modes/goodjunk.safe.js (clean, goal+miniquest, must-spawn) ===
import { boot as run } from '../vr/mode-factory.js';
import { MissionDeck } from '../vr/mission.js';

/* ---------------- HUD: Goal panel (DOM) ---------------- */
function ensureGoalPanel() {
  // เคลียร์ของเก่า (ป้องกันค้างจากโหมดก่อน)
  const old = document.getElementById('goalPanel');
  if (old) try { old.remove(); } catch {}

  const wrap = document.createElement('div');
  wrap.id = 'goalPanel';
  wrap.setAttribute('data-hha-ui', '');
  Object.assign(wrap.style, {
    position:'fixed', left:'50%', bottom:'64px', transform:'translateX(-50%)',
    width:'min(820px,92vw)', background:'#0f172acc', color:'#e8eefc',
    border:'1px solid #334155', borderRadius:'14px', padding:'12px 14px',
    backdropFilter:'blur(6px)', zIndex:'900', fontFamily:'system-ui,-apple-system,Segoe UI,Roboto,Thonburi,sans-serif'
  });

  wrap.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:8px">
      <div id="goalTitle" style="font-weight:800">เป้า:</div>
      <div id="goalMode"  style="opacity:.8">โหมด: normal</div>
    </div>
    <div style="height:10px;background:#0b1222;border:1px solid #334155;border-radius:999px;overflow:hidden">
      <div id="goalFill" style="height:100%;width:0%;background:linear-gradient(90deg,#22c55e,#93c5fd)"></div>
    </div>
    <div id="questLine" style="margin-top:10px;font-weight:700;opacity:.95"></div>
  `;
  document.body.appendChild(wrap);
  return wrap;
}
function setGoalText(text) {
  const el = document.getElementById('goalTitle');
  if (el) el.textContent = text;
}
function setGoalPct(pct) {
  const f = document.getElementById('goalFill');
  if (f) f.style.width = Math.max(0, Math.min(100, pct)) + '%';
}
function setModeLabel(diff) {
  const el = document.getElementById('goalMode');
  if (el) el.textContent = 'โหมด: ' + diff;
}
function setQuestLine(txt) {
  const el = document.getElementById('questLine');
  if (el) el.textContent = txt;
}

/* ---------------- Mini Quest: deck (เฉพาะเงื่อนไขที่นับจาก click/score/combo) ---------------- */
function buildGoodjunkDeck() {
  // เลือกเฉพาะเควสต์ที่ไม่ต้องรู้ “พลาดเพราะปล่อยให้หมดเวลา”
  const pool = [
    { id:'good10',   level:'easy',   label:'เก็บของดี 10 ชิ้น',   check:s=>s.goodCount>=10,  prog:s=>Math.min(10,s.goodCount), target:10 },
    { id:'combo10',  level:'normal', label:'ทำคอมโบ 10',          check:s=>s.comboMax>=10,   prog:s=>Math.min(10,s.comboMax),   target:10 },
    { id:'score500', level:'hard',   label:'ทำคะแนน 500+',        check:s=>s.score>=500,     prog:s=>Math.min(500,s.score),     target:500 },
    { id:'star2',    level:'normal', label:'เก็บดาว ⭐ 2 ดวง',     check:s=>s.star>=2,        prog:s=>Math.min(2,s.star),        target:2 },
    { id:'diamond1', level:'hard',   label:'เก็บเพชร 💎 1 เม็ด',   check:s=>s.diamond>=1,     prog:s=>Math.min(1,s.diamond),     target:1 },
  ];
  const md = new MissionDeck({ pool });
  md.draw3();
  return md;
}

/* ---------------- Game ---------------- */
export async function boot(cfg = {}) {
  const diff = String(cfg.difficulty || 'normal');
  const dur  = Number(cfg.duration || (diff==='easy'?90:diff==='hard'?45:60));

  // สุ่มและเตรียม mission deck
  const md = buildGoodjunkDeck();

  // goal: เก็บ “ของดี” ให้ครบจำนวนหนึ่ง
  const GOAL_TOTAL = 25;
  let goodOK = 0;

  // pools
  const GOOD = ['🥦','🥕','🍎','🐟','🥛','🍊','🍌','🍇','🥬','🍚','🥜','🍞','🍓','🍍','🥝','🍐'];
  const JUNK = ['🍔','🍟','🍕','🍩','🍪','🧁','🥤','🧋','🍫','🌭','🍰','🍬'];
  const STAR = '⭐', DIA='💎', SHIELD='🛡️';

  // สร้าง HUD Goal
  ensureGoalPanel();
  setModeLabel(diff);
  setGoalText(`เป้า: เก็บของดีให้ได้ ${GOAL_TOTAL} ชิ้น — คืบหน้า ${goodOK}/${GOAL_TOTAL}`);
  setGoalPct(0);

  // แจ้ง HUD mini quest (ทีละใบ)
  function updateQuestHUD() {
    const cur = md.getCurrent();
    const label = cur ? cur.label : 'กำลังเริ่ม…';
    window.dispatchEvent(new CustomEvent('hha:quest', { detail:{ text:`Quest ${md.currentIndex+1}/3 — ${label}` } }));
    setQuestLine(`Quest ${md.currentIndex+1}/3 — ${label}`); // แสดงซ้ำในกล่อง Goal เพื่อเห็นชัด
  }
  updateQuestHUD();

  // สถานะสำหรับ HUD หลัก (ให้ index อัปเดต)
  let score=0, combo=0, starCount=0, diamondCount=0;

  // ตัดสินผลเมื่อคลิกเป้า
  function judge(ch, s) {
    // s = { score, combo, misses, diff }
    let res = { good:false, scoreDelta:0 };

    if (ch === STAR) {                     // ⭐ โบนัส
      score += 40; starCount++;
      md.onStar(); md.updateScore(score);
      res = { good:true, scoreDelta:+40 };
    }
    else if (ch === DIA) {                 // 💎 โบนัสใหญ่
      score += 80; diamondCount++;
      md.onDiamond(); md.updateScore(score);
      res = { good:true, scoreDelta:+80 };
    }
    else if (ch === SHIELD) {              // 🛡️ (ตอนนี้ยังไม่ใช้โทษ-กันพลาดใน factory)
      score += 10;
      res = { good:true, scoreDelta:+10 };
    }
    else if (GOOD.includes(ch)) {          // ของดี
      const delta = 20 + combo*2;
      score += delta; combo++;
      goodOK++;
      md.onGood(); md.updateScore(score); md.updateCombo(combo);

      // อัปเดต goal bar
      setGoalText(`เป้า: เก็บของดีให้ได้ ${GOAL_TOTAL} ชิ้น — คืบหน้า ${goodOK}/${GOAL_TOTAL}`);
      setGoalPct( (goodOK/GOAL_TOTAL)*100 );

      res = { good:true, scoreDelta:+delta };
    }
    else {                                 // ขยะ
      combo = 0;
      score = Math.max(0, score-15);
      md.updateScore(score); md.updateCombo(combo);
      res = { good:false, scoreDelta:-15 };
    }

    // ส่ง HUD คะแนนหลัก
    window.dispatchEvent(new CustomEvent('hha:score',{detail:{score, combo}}));

    // ถ้าจบเควสต์ใบปัจจุบัน ให้ขยับและอัปเดต HUD
    if (md._autoAdvance && md._autoAdvance()) {
      updateQuestHUD();
    }

    return res;
  }

  // เมื่อเวลาเดิน (mission deck ต้องได้ noMissTime จากเกมหลัก แต่ factory ไม่มี hook miss)
  // ในโหมดนี้เราไม่ใช้เควสต์ที่อิง noMissTime / junkMiss จึงไม่ต้องอัปเดตเพิ่ม

  // สุ่มสปอว์น (ใช้ factory ที่ดูแล “ต้องมีลูกเป้าเสมอ” ให้แล้ว)
  const g = await run({
    host: cfg.host || document.querySelector('#spawnHost') || document.body,
    difficulty: diff,
    duration: dur,
    pools: { good: [...GOOD, STAR, DIA, SHIELD], bad: JUNK },
    goodRate: 0.65,
    judge
  });

  // คืน control ให้ index จัด pause/resume/stop
  return {
    stop(){ try{ g.stop && g.stop(); }catch{} },
    pause(){ try{ g.pause && g.pause(); md.pause(); }catch{} },
    resume(){ try{ g.resume && g.resume(); md.resume(); updateQuestHUD(); }catch{} }
  };
}

export default { boot };