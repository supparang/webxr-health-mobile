// game/modes/goodjunk.js
// โหมด: ดี vs ขยะ — เก็บของดี หลีกเลี่ยงขยะ
// มินิเควสท์: เลือกแบบสุ่ม 3 จาก 5 แบบ แสดงใน #missionLine และอัปเดตทุกวินาที
// ส่งผลลัพธ์ให้ main.js: 'good' | 'bad' | 'perfect' | 'power'

/* ========== คอนเทนต์พื้นฐาน ========== */
const HEALTHY = ['🥦','🍎','🥕','🍅','🍇','🍉','🥗','🥒','🥬','🌽'];
const JUNK    = ['🍔','🍟','🍩','🍕','🥤','🍫','🌭','🧁','🍪','🧃'];
const TRAPS   = ['💣','☠️'];

const GOOD_RATIO = { Easy:0.72, Normal:0.65, Hard:0.58 };
const POWER_RATE = { Easy:0.08, Normal:0.10, Hard:0.12 };
const ENABLED_POWERS = ['scorex2','freeze'];
const ENABLE_TRAPS = true;
const TRAP_RATE = 0.06;

const PERFECT_WINDOW_MS = 320;
const MIN_LIFE_BY_DIFF  = { Easy:2600, Normal:2200, Hard:1900 };

/* ========== มินิเควสท์ 5 แบบ ==========
   จะสุ่มมา 3 แบบตอนเริ่มโหมด
   - collectGood: เก็บอาหารดีจำนวน X
   - avoidJunk:   หลีกเลี่ยงขยะ (กดพลาดได้ไม่เกิน M ครั้ง)
   - perfectTaps: ทำ PERFECT ให้ครบ X ครั้ง
   - streakGood:  ทำคอมโบดีต่อเนื่อง X โดยไม่โดน bad คั่น
   - powerHunter: เก็บพาวเวอร์อัป X ครั้ง
*/
const QUEST_POOL = {
  Easy:   { collectGood:8,  perfectTaps:3, streakGood:6,  powerHunter:2, avoidBadMax:2,  time:45 },
  Normal: { collectGood:10, perfectTaps:4, streakGood:8,  powerHunter:3, avoidBadMax:2,  time:45 },
  Hard:   { collectGood:12, perfectTaps:5, streakGood:10, powerHunter:4, avoidBadMax:1,  time:45 }
};

const QUEST_DEFS = (diff) => {
  const p = QUEST_POOL[diff] || QUEST_POOL.Normal;
  return [
    { key:'collectGood', need:p.collectGood, label:(n)=>`🥗 เก็บของดีให้ครบ ${n}` },
    { key:'avoidJunk',   need:p.avoidBadMax, label:(n)=>`🚫 หลีกเลี่ยงขยะ (พลาดได้ไม่เกิน ${n})` },
    { key:'perfectTaps', need:p.perfectTaps, label:(n)=>`✨ ทำ PERFECT ให้ครบ ${n}` },
    { key:'streakGood',  need:p.streakGood,  label:(n)=>`🔥 ทำดีติดกัน ${n} ครั้ง` },
    { key:'powerHunter', need:p.powerHunter, label:(n)=>`⚡ เก็บพาวเวอร์อัปให้ครบ ${n}` },
  ].map(x=>({ ...x, time: p.time }));
};

function pick(arr){ return arr[(Math.random()*arr.length)|0]; }
function sampleN(arr,n){
  const a = arr.slice(); const out=[];
  while (a.length && out.length<n){ out.push(a.splice((Math.random()*a.length)|0,1)[0]); }
  return out;
}
function iconOf(power){
  if (power==='scorex2') return '✖️2';
  if (power==='freeze')  return '🧊';
  return '✨';
}
function lifeAdaptive(diff, state, mul=1){
  const gj = state.ctx?.gj || {};
  const hits = gj.hits|0, miss = gj.miss|0;
  const acc  = (hits+miss)>0 ? (hits/(hits+miss)) : 1;
  const boost= acc < 0.55 ? 1.25 : acc < 0.75 ? 1.12 : 1.0;
  const base = (diff?.life || 3000) * boost * mul;
  const minL = MIN_LIFE_BY_DIFF[state.difficulty] || 2100;
  return Math.max(minL, Math.round(base));
}

/* ========== มินิ HUD helpers (#missionLine) ========== */
function showMissionLine(on){ const el=document.getElementById('missionLine'); if(el) el.style.display = on?'block':'none'; }
function setMissionText(text){ const el=document.getElementById('missionLine'); if(el) el.textContent = text || '—'; }
function fmtTime(s){ s|=0; return s<10?('0'+s):(''+s); }

function renderQuestHUD(state){
  const gj = state.ctx?.gj; if(!gj) return;
  const qs = gj.quests; const i = gj.qIndex|0;
  if (!qs || !qs.length || i>=qs.length){
    setMissionText('🏁 เควสท์ทั้งหมดเสร็จแล้ว!');
    return;
  }
  const q = qs[i];
  let line = `🎯 เควสท์ ${i+1}/${qs.length}: ${q.label(q.need)} • ${q.progress|0}/${q.need}`;
  if (q.key==='avoidJunk'){ line = `🎯 เควสท์ ${i+1}/${qs.length}: ${q.label(q.need)} • พลาด: ${q.badCount|0}/${q.need}`; }
  line += ` • ${fmtTime(q.remain)}s`;
  setMissionText(line);
}

/* ========== Public API ========== */
export function init(state){
  state.ctx = state.ctx || {};
  const defs = QUEST_DEFS(state.difficulty);
  const picks = sampleN(defs, 3); // สุ่มมา 3 เควสท์

  // เตรียมสถานะ
  state.ctx.gj = {
    hits:0, miss:0,
    lastTapTs:0,
    // counters สำหรับเควสท์
    counters:{ good:0, perfect:0, power:0, streak:0, bad:0 },
    // เควสท์ชุดที่จะใช้
    quests: picks.map(q=>({
      ...q,
      progress: 0,
      badCount: 0,     // เฉพาะ avoidJunk
      remain: q.time,
      done: false,
      success: false
    })),
    qIndex: 0
  };

  showMissionLine(true);
  renderQuestHUD(state);
}

export function pickMeta(diff, state){
  const ts = performance?.now?.() || Date.now();

  // โอกาสเกิดพาวเวอร์
  if (Math.random() < (POWER_RATE[state.difficulty] || POWER_RATE.Normal) && ENABLED_POWERS.length){
    const p = pick(ENABLED_POWERS);
    return { type:'power', power:p, char:iconOf(p), life: lifeAdaptive(diff, state, 1.0), ts };
  }

  // โอกาสกับดัก
  if (ENABLE_TRAPS && Math.random() < TRAP_RATE){
    const char = pick(TRAPS);
    return { type:'trap', char, good:false, life: lifeAdaptive(diff, state, 1.05), ts };
  }

  // อาหารทั่วไป
  const wantGood = Math.random() < (GOOD_RATIO[state.difficulty] || GOOD_RATIO.Normal);
  const char = wantGood ? pick(HEALTHY) : pick(JUNK);
  return { type:'food', char, good:wantGood, life: lifeAdaptive(diff, state, 1.0), ts };
}

export function onHit(meta, sys, state){
  const { sfx, power, fx, coach } = sys || {};
  const gj = state.ctx?.gj || (state.ctx.gj = { hits:0, miss:0, counters:{}, quests:[], qIndex:0 });

  // ===== พาวเวอร์อัป =====
  if (meta.type === 'power'){
    try{ sfx?.play?.('sfx-powerup'); }catch{}
    gj.counters.power = (gj.counters.power|0) + 1;
    // ใช้พาวเวอร์
    if (meta.power === 'scorex2'){ try{ power?.apply?.('boost'); }catch{} fx?.popText?.('SCORE ×2',{color:'#b0ff66'}); }
    else if (meta.power === 'freeze'){
      const now = performance?.now?.()||Date.now();
      state.freezeUntil = now + 2000;
      fx?.popText?.('FREEZE!',{color:'#66e0ff'});
    }
    // อัปเดตเควสท์ powerHunter ถ้ามี
    updateQuestProgress('powerHunter', 1, state, coach);
    renderQuestHUD(state);
    return 'power';
  }

  // ===== กับดัก =====
  if (meta.type === 'trap'){
    gj.miss++; gj.counters.bad = (gj.counters.bad|0) + 1;
    // streak โดนรีเซ็ต
    gj.counters.streak = 0;
    // อัปเดตเควสท์ avoidJunk (นับ bad)
    updateQuestAvoidBad(state, 1, coach);
    try{ sfx?.bad?.(); }catch{}
    fx?.popText?.('TRAP!',{color:'#ff9b9b'});
    renderQuestHUD(state);
    return 'bad';
  }

  // ===== อาหาร =====
  if (meta.type === 'food'){
    if (meta.good){
      gj.hits++;
      gj.counters.good = (gj.counters.good|0) + 1;
      gj.counters.streak = (gj.counters.streak|0) + 1;

      // PERFECT window
      if (meta.ts){
        const dt = (performance?.now?.()||Date.now()) - meta.ts;
        if (dt <= PERFECT_WINDOW_MS){
          gj.counters.perfect = (gj.counters.perfect|0) + 1;
          updateQuestProgress('perfectTaps', 1, state, coach);
          updateQuestProgress('streakGood', 1, state, coach, true); // true = นับทีละ 1 จาก streak
          updateQuestProgress('collectGood', 1, state, coach);
          try{ sfx?.good?.(); }catch{}
          fx?.popText?.('PERFECT',{color:'#ccff88'});
          renderQuestHUD(state);
          return 'perfect';
        }
      }
      // GOOD (ไม่ perfect)
      updateQuestProgress('collectGood', 1, state, coach);
      updateQuestProgress('streakGood', 1, state, coach, true);
      try{ sfx?.good?.(); }catch{}
      fx?.popText?.('GOOD',{color:'#7fffd4'});
      renderQuestHUD(state);
      return 'good';
    } else {
      // โดน Junk
      gj.miss++;
      gj.counters.bad = (gj.counters.bad|0) + 1;
      // streak โดนรีเซ็ต
      gj.counters.streak = 0;
      // อัปเดต avoidJunk
      updateQuestAvoidBad(state, 1, coach);
      try{ sfx?.bad?.(); }catch{}
      fx?.popText?.('JUNK!',{color:'#ff9b9b'});
      renderQuestHUD(state);
      return 'bad';
    }
  }

  return 'ok';
}

export function tick(state, sys){
  const { sfx, fx, coach } = sys || {};
  const gj = state.ctx?.gj; if (!gj?.quests || !gj.quests.length) return;

  const i = gj.qIndex|0;
  if (i >= gj.quests.length){ return; } // เควสท์ครบแล้ว

  const q = gj.quests[i];
  if (q.done) return;

  // นับเวลาถอยหลัง
  q.remain = Math.max(0, (q.remain|0) - 1);

  // เงื่อนไขสำเร็จของแต่ละเควสท์ (บางอันปรับจาก counters ใน onHit แล้ว)
  // - collectGood, perfectTaps, powerHunter, streakGood: อัปเดตใน onHit
  // - avoidJunk: สำเร็จเมื่อเวลาหมดโดย badCount <= need
  if (q.key === 'avoidJunk' && q.remain === 0){
    if ((q.badCount|0) <= q.need){
      q.done = true; q.success = true;
      fx?.popText?.('🏁 Mission Complete', { color:'#7fffd4' });
      coach?.say?.('เยี่ยม! หลีกเลี่ยงได้ดีมาก');
      moveToNextQuest(state);
    }else{
      q.done = true; q.success = false;
      fx?.popText?.('⌛ Mission Failed', { color:'#ff9b9b' });
      coach?.say?.('ไม่เป็นไร ลองใหม่ในเควสท์ถัดไป!');
      moveToNextQuest(state);
    }
  }

  // อัปเดต HUD เสมอ
  renderQuestHUD(state);
}

export function cleanup(state){
  // ซ่อนแถบภารกิจเมื่อออกจากโหมด
  showMissionLine(false);
}

/* ========== Quest helpers ========== */
function moveToNextQuest(state){
  const gj = state.ctx?.gj; if(!gj) return;
  gj.qIndex = (gj.qIndex|0) + 1;
  // ถ้าจบครบ 3 เควสท์แล้ว ปิดเส้น
  if (gj.qIndex >= gj.quests.length){
    setMissionText('🏁 เควสท์ทั้งหมดเสร็จแล้ว!');
    // ทิ้งข้อความไว้ 2 วิแล้วซ่อน
    setTimeout(()=>showMissionLine(false), 2000);
  }else{
    renderQuestHUD(state);
  }
}

function updateQuestProgress(key, inc, state, coach, isStreak=false){
  const gj = state.ctx?.gj; if(!gj) return;
  const i = gj.qIndex|0;
  const qs = gj.quests; if(!qs || i>=qs.length) return;
  const q = qs[i]; if(q.key !== key || q.done) return;

  if (key === 'streakGood'){
    // นับจากตัวนับ streak ใน gj.counters
    if (isStreak){
      q.progress = Math.max(q.progress|0, gj.counters.streak|0); // ใช้ค่าสูงสุดที่ทำได้ในรอบนั้น
    }
  } else {
    q.progress = Math.min(q.need, (q.progress|0) + (inc|0));
  }

  if ((q.progress|0) >= (q.need|0)){
    q.done = true; q.success = true;
    coach?.say?.('สุดยอด! เควสท์ผ่านแล้ว');
    try{ state?.ctx && (state.ctx.lastQuestKey = key); }catch{}
    // โชว์แล้วไปเควสท์ถัดไป
    moveToNextQuest(state);
  }
}

function updateQuestAvoidBad(state, badInc=1, coach){
  const gj = state.ctx?.gj; if(!gj) return;
  const i = gj.qIndex|0;
  const qs = gj.quests; if(!qs || i>=qs.length) return;
  const q = qs[i]; if(q.key !== 'avoidJunk' || q.done) return;

  q.badCount = Math.max(0, (q.badCount|0) + (badInc|0));
  // ถ้าเกินโควตาพลาดแล้ว และยังเหลือเวลา — ยังไม่ “จบทันที”
  // เงื่อนไขสำเร็จจะตัดสินตอนหมดเวลาใน tick()
}
