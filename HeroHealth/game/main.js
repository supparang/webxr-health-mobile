// === Hero Health — main.js (Mission 30/40/50 + Streak/Fever + Stars v2) ===
import * as goodjunk from './modes/goodjunk.safe.js';

const $ = (s)=>document.querySelector(s);
function getParam(name, def){ try{
  const u = new URL(location.href); return u.searchParams.get(name) ?? def;
}catch{ return def; }}

// -------- Mission goal modes --------
// เลือกได้ 3 แบบ: 30 / 40 / 50
// วิธีเลือก:
//   • ผ่าน query: ?goal=30 | 40 | 50
//   • หรือ set data-goal บน <body data-goal="40">
//   • ไม่ระบุ = 40
const GOAL_DEFAULT = 40;
function resolveGoal(){
  const q = parseInt(getParam('goal', ''), 10);
  if(q===30 || q===40 || q===50) return q;
  const dataGoal = parseInt(document.body?.dataset?.goal||'',10);
  if(dataGoal===30 || dataGoal===40 || dataGoal===50) return dataGoal;
  return GOAL_DEFAULT;
}

// -------- Stars formula (ใหม่) --------
// คิดจาก 3 ปัจจัย: คะแนน, สำเร็จมิชชัน, คอมโบสูงสุด
// สเกลดาว: 1–5
function calcStars({score, missionCleared, maxCombo}){
  let base = 1;
  if(score >= 300) base = 3;
  if(score >= 450) base = 4;
  if(score >= 600) base = 5;
  // โบนัสมิชชัน
  if(missionCleared) base += 1;
  // โบนัสคอมโบ
  if(maxCombo >= 12) base += 1;
  return Math.max(1, Math.min(5, base));
}

// -------- Streak / Fever config --------
// fever แสดงผลที่ HUD และเล่นเสียงเชียร์/ข้อความ
const FEVER_UP_PER_GOOD = 14;         // +14 ต่อการคลิก good 1 ครั้ง
const FEVER_DECAY_PER_SEC = 6;        // -6 ต่อวินาที
const FEVER_THRESHOLD = 100;          // >= 100 → ติด Fever
const FEVER_DURATION_MS = 6000;       // นาน 6 วินาที (visual/coach)

let hud, coach, gj;
let mission = { goal: resolveGoal(), good: 0, junk: 0 };
let streak = 0, maxComboSeen = 1;
let fever = { pct: 0, active: false, _timer: null };

async function boot(){
  // ใช้ HUD/Coach ที่โปรเจกต์ของคุณมีอยู่ (ถ้าไม่มี มี fallback ใน index/hud.js)
  const HUDClass = (window.HUD)||class{
    setTimer(){} setScore(){} setCombo(){}
    setStatus(){} showMission(){} setMissionGoal(){} updateMission(){}
    setStreak(){} setFever(){} showResult(o){ alert(o?.summary||'จบเกม'); }
  };
  const CoachClass = (window.Coach)||class{
    say(){} cheer(){} playBGM(){} stopBGM(){} sfx(){}
  };

  hud = new HUDClass();
  coach = new CoachClass();

  // ตั้งค่า Mission (goal 30/40/50)
  mission.goal = resolveGoal();
  hud.setMissionGoal?.(mission.goal);
  hud.showMission?.(true);
  hud.updateMission?.(mission.good, mission.goal);

  // เตรียมปุ่มเริ่ม
  const startBtn = $('[data-action="start"]') || $('#startBtn');
  startBtn?.addEventListener('click', startGoodJunk);

  // ตั้งค่า Streak/Fever เริ่มต้น
  hud.setStreak?.(0);
  hud.setFever?.({pct:0, active:false});
}

function resetRuntime(){
  mission.good = 0; mission.junk = 0;
  streak = 0; maxComboSeen = 1;
  fever = { pct: 0, active: false, _timer: null };
  hud.updateMission?.(mission.good, mission.goal);
  hud.setScore?.(0); hud.setCombo?.(1); hud.setStatus?.('READY');
  hud.setStreak?.(0);
  hud.setFever?.({pct:0, active:false});
}

function startGoodJunk(){
  resetRuntime();

  const host = document.getElementById('spawnHost') || document.getElementById('gameLayer') || document.querySelector('.game-wrap') || document.body;

  coach.playBGM?.('bgm_main');
  coach.say?.(`เริ่มภารกิจ: เก็บอาหารดีให้ครบ ${mission.goal} ชิ้น!`);

  // เริ่มเกมโหมด goodjunk
  gj = goodjunk.mount({
    host,
    hud,
    sfx: {
      pop: ()=>coach.sfx?.('pop'),
      boo: ()=>coach.sfx?.('boo')
    },
    onEvent: handleGameEvent
  });

  gj.start();
}

// ---- Fever control (visual/coach only) ----
function bumpFever(){
  if(fever.active) return; // ระหว่าง Fever ไม่สะสมเพิ่ม
  fever.pct = Math.min(100, fever.pct + FEVER_UP_PER_GOOD);
  hud.setFever?.({pct: fever.pct, active:false});
  if(fever.pct >= FEVER_THRESHOLD){
    triggerFever();
  }
}
function decayFever(){
  if(fever.active) return;
  fever.pct = Math.max(0, fever.pct - FEVER_DECAY_PER_SEC);
  hud.setFever?.({pct: fever.pct, active:false});
}
function triggerFever(){
  fever.active = true;
  hud.setFever?.({pct: 100, active:true});
  coach.cheer?.('great');
  coach.say?.('Fever Time! รัวให้สุด!');
  clearTimeout(fever._timer);
  fever._timer = setTimeout(()=>{
    fever.active = false;
    fever.pct = 0;
    hud.setFever?.({pct: 0, active:false});
  }, FEVER_DURATION_MS);
}

function handleGameEvent(ev){
  switch(ev.type){
    case 'start':
      hud.setStatus?.('PLAY');
      break;

    case 'tick':
      // ลด fever ทีละวินาที
      decayFever();
      break;

    case 'hit': {
      const kind = ev.payload?.kind;
      const combo = ev.payload?.combo ?? 1;
      const score = ev.payload?.score ?? 0;

      maxComboSeen = Math.max(maxComboSeen, combo);

      if(kind === 'good'){
        mission.good++;
        hud.updateMission?.(mission.good, mission.goal);

        // Streak / Coach
        streak++;
        hud.setStreak?.(streak);

        // Fever
        bumpFever();

        // Milestones (ข้อความไทย)
        if(mission.good===5)  coach.say?.(`เยี่ยม! เหลืออีก ${mission.goal-mission.good}`);
        if(mission.good===15) coach.say?.('ผ่านครึ่งทางแล้ว ไปต่อ!');
        if(mission.good===mission.goal-5) coach.say?.('อีก 5 ชิ้นสุดท้าย สู้!');
        if(mission.good===mission.goal)   coach.cheer?.('great');

        // ชมตามคอมโบ
        if(combo===5)  coach.say?.('คอมโบ x5 สวย!');
        if(combo===10) coach.say?.('คอมโบ x10 แรงขึ้น!');
        if(combo===15) coach.say?.('คอมโบ x15 สุดจัด!');
      }else{
        // โดน junk → reset streak/fever meter (เฉพาะ streak; fever ไม่รีเซ็ตทันที)
        mission.junk++;
        streak = 0;
        hud.setStreak?.(0);
        coach.say?.('ระวังของหวาน! คอมโบรีเซ็ตแล้ว');
      }

      break;
    }

    case 'pause':
      coach.say?.('พักแป๊บ'); hud.setStatus?.('PAUSED'); coach.stopBGM?.();
      break;

    case 'resume':
      coach.say?.('ไปต่อ!'); hud.setStatus?.('PLAY'); coach.playBGM?.('bgm_main');
      break;

    case 'end': {
      coach.stopBGM?.();
      const res = ev.payload || {score:0, maxCombo:1, hits:{good:0, junk:0}, time:0};
      const missionCleared = mission.good >= mission.goal;
      const stars = calcStars({score:res.score, missionCleared, maxCombo:maxComboSeen});
      coach.cheer?.(missionCleared ? 'victory' : 'ok');

      hud.showResult?.({
        mode:'goodjunk',
        score:res.score,
        time:res.time,
        stars,
        banner: missionCleared ? 'MISSION CLEAR' : 'TIME UP',
        details:{
          mission:{goal:mission.goal, good:mission.good, junk:mission.junk},
          maxCombo:res.maxCombo,
          good:res.hits?.good||0,
          junk:res.hits?.junk||0
        },
        summary: `ผลลัพธ์: ${missionCleared?'ผ่านภารกิจ':'ยังไม่ผ่าน'} | คะแนน ${res.score} | ⭐ ${'★'.repeat(stars)}${'☆'.repeat(5-stars)} | ดี ${res.hits?.good||0} | ขยะ ${res.hits?.junk||0} | คอมโบสูงสุด x${res.maxCombo}`
      });
      break;
    }
  }
}

// start
boot();
