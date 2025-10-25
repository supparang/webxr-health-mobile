// game/modes/groups.js
// โหมด: จาน 5 หมู่ + เควส 45s + Power-up Dual Target

/* =========================
   1) คอนฟิก / คงที่
   ========================= */
const GROUPS = {
  grain:   { labelTH:'ธัญพืช',  labelEN:'Grain',   em:['🍚','🍞','🥖','🥯','🍜'] },
  veg:     { labelTH:'ผัก',     labelEN:'Veg',     em:['🥦','🥕','🥬','🌽','🫑'] },
  protein: { labelTH:'โปรตีน',  labelEN:'Protein', em:['🥩','🍗','🍖','🥚','🐟'] },
  fruit:   { labelTH:'ผลไม้',   labelEN:'Fruit',   em:['🍎','🍌','🍇','🍓','🍊'] },
  dairy:   { labelTH:'นม',      labelEN:'Dairy',   em:['🥛','🧀','🍦','🍨'] }
};
const GROUP_KEYS = Object.keys(GROUPS);
const pick = (arr)=>arr[(Math.random()*arr.length)|0];

// dual target power-up settings
const DUAL_DURATION = { Easy:10, Normal:12, Hard:14 }; // วินาที
// chance to spawn power-up ต่อสแปวน์ 1 ครั้ง
const POWERUP_RATE  = { Easy:0.04, Normal:0.05, Hard:0.06 };

/* =========================
   2) Utils
   ========================= */
function labelOf(key, lang='TH'){
  const g = GROUPS[key]; if(!g) return '—';
  return lang==='EN' ? g.labelEN : g.labelTH;
}
function setTargetHUD(state, hud){
  const lang = state.lang || 'TH';
  const gctx = state.ctx.groups;
  const keys = [gctx.target1, gctx.target2].filter(Boolean);
  const text = keys.map(k=>labelOf(k, lang)).join(' + ');
  if (hud?.showTarget) hud.showTarget();
  if (hud?.setTargetBadge) hud.setTargetBadge(text || '—');
  else {
    const b = document.getElementById('targetBadge'); if (b) b.textContent = text || '—';
    const w = document.getElementById('targetWrap');  if (w) w.style.display = 'block';
  }
}
function setMissionLine(text){
  const el = document.getElementById('missionLine');
  if (!el) return;
  el.style.display = text ? 'block' : 'none';
  if (text) el.textContent = text;
}
function rotateSingleTarget(except){
  const pool = GROUP_KEYS.filter(k=>k!==except);
  return pick(pool);
}
function targetChanceByDiff(diffKey){
  if(diffKey==='Easy')   return 0.45;
  if(diffKey==='Hard')   return 0.65;
  return 0.55;
}

/* =========================
   3) Public API
   ========================= */
export function init(state, hud, diff){
  state.ctx = state.ctx || {};
  // groups context
  state.ctx.groups = {
    target1: pick(GROUP_KEYS),
    target2: null,            // จะถูกตั้งค่าเมื่อได้ power-up (dual target)
    targetHits: 0,            // นับชิ้นที่เข้าเป้าเพื่อหมุนเป้า
    dualRemain: 0,            // วินาทีที่ dual ยังทำงาน
    // mission (45s window)
    mission: newMissionWindow(state)
  };
  // HUD
  setTargetHUD(state, hud);
  // แสดง mission line
  updateMissionHUD(state);
}

export function tick(state, sys, hud){
  const { fx, sfx, coach } = sys || {};
  const gctx = state.ctx?.groups;
  if (!gctx) return;

  // 1) นับเวลามิชชัน
  if (gctx.mission && !gctx.mission.done){
    gctx.mission.remain = Math.max(0, gctx.mission.remain - 1);
    // เช็คสำเร็จ
    if (gctx.mission.progress >= gctx.mission.need){
      gctx.mission.done = true;
      fx?.popText?.('🏁 Mission Complete', { color:'#7fffd4' });
      sfx?.perfect?.(); coach?.say?.(state.lang==='TH'?'มิชชันผ่าน!':'Mission complete!');
    }
    // หมดเวลา
    if (!gctx.mission.done && gctx.mission.remain === 0){
      gctx.mission.done = true; gctx.mission.fail = true;
      fx?.popText?.('⌛ Mission Failed', { color:'#ff9b9b' });
      coach?.say?.(state.lang==='TH'?'มิชชันพลาด':'Mission failed');
    }
  }

  // 2) นับเวลาพาวเวอร์อัป dual
  if (gctx.dualRemain > 0){
    gctx.dualRemain--;
    if (gctx.dualRemain === 0){
      // หมดฤทธิ์ → กลับเป็น target เดียว
      gctx.target2 = null;
      setTargetHUD(state, hud);
      coach?.say?.(state.lang==='TH'?'หมดพลัง Dual':'Dual over');
    }
  }

  // อัปเดต HUD mission ทุกวินาที
  updateMissionHUD(state);
}

export function pickMeta(diff, state){
  const gctx = state.ctx?.groups || {};
  // ลุ้น power-up ก่อน
  if (Math.random() < (POWERUP_RATE[state.difficulty] || 0.05)){
    return {
      type:'powerup_dual',
      char:'✨',          // ไอคอน power-up
      life: Math.max(2000, diff?.life ?? 2500)
    };
  }

  // ไอเท็มอาหาร
  const useDual = !!gctx.target2;
  const wantTarget = Math.random() < targetChanceByDiff(state.difficulty);

  let groupKey;
  if (useDual && wantTarget){
    // ปล่อยให้ตรงเป้าหนึ่งในสอง
    groupKey = Math.random()<0.5 ? gctx.target1 : gctx.target2;
  }else if (wantTarget){
    groupKey = gctx.target1;
  }else{
    // สุ่มอย่างอื่นที่ไม่ใช่ target1/2
    const exclude = [gctx.target1, gctx.target2].filter(Boolean);
    const pool = GROUP_KEYS.filter(k => !exclude.includes(k));
    groupKey = pool.length? pick(pool) : gctx.target1;
  }

  const char = pick(GROUPS[groupKey].em);
  const life = (diff?.life ?? 3000);
  return {
    type:'food',
    char,
    life,
    groupKey,
    good: isOnTarget(groupKey, gctx) // true ถ้าตรงเป้าหนึ่งในสอง
  };
}

export function onHit(meta, sys, state, hud){
  const { score, sfx, fx, coach } = sys || {};
  const lang = state.lang || 'TH';
  const gctx = state.ctx?.groups;

  if (meta.type === 'powerup_dual'){
    // เปิดโหมด dual target ชั่วคราว
    // กำหนด target2 ให้ไม่ซ้ำ target1
    const next = rotateSingleTarget(gctx.target1);
    gctx.target2 = next;
    gctx.dualRemain = DUAL_DURATION[state.difficulty] || 12;

    setTargetHUD(state, hud);
    fx?.popText?.('DUAL TARGET!', { color:'#ffd54a' });
    sfx?.power?.(); coach?.say?.(lang==='TH'?'เป้า ×2 ชั่วคราว!':'Dual targets!');
    // โบนัสเล็กน้อย
    score?.add?.(3);
    return;
  }

  if (meta.type !== 'food'){
    score?.add?.(1); fx?.popText?.('+1', { color:'#8ff' }); return;
  }

  // เข้าเป้าหนึ่งในสอง?
  if (meta.good){
    score?.add?.(7);
    score.combo = (score.combo||0) + 1;
    fx?.popText?.('+7', { color:'#7fffd4' });
    sfx?.good?.();
    coach?.say?.(lang==='TH'?'เข้าเป้า!':'On target!');

    // นับเพื่อหมุนเป้า
    gctx.targetHits = (gctx.targetHits||0) + 1;

    // อัปเดตมิชชันถ้ายังไม่สำเร็จ
    if (gctx.mission && !gctx.mission.done){
      if (gctx.mission.kind === 'collect_target'){
        gctx.mission.progress++;
      }
    }

    // ทุก ๆ 3 ชิ้นที่เข้าเป้า → หมุน target1 (target2 คงเดิมถ้า dual ยังทำงาน)
    if (gctx.targetHits >= 3){
      gctx.target1 = rotateSingleTarget(gctx.target2 || gctx.target1);
      gctx.targetHits = 0;
      setTargetHUD(state, hud);
    }
    return;
  }

  // เก็บถูกหมู่ (หนึ่งใน 5) แต่ไม่ใช่เป้า
  if (GROUPS[meta.groupKey]){
    score?.add?.(2);
    fx?.popText?.('+2', { color:'#9fdcff' });
    sfx?.tick?.();
    coach?.say?.(lang==='TH'?'ดี แต่ไม่ตรงเป้า':'OK, not target');
    return;
  }

  // ผิดหมวด
  score?.add?.(-2);
  score.combo = 0;
  fx?.popText?.('-2', { color:'#ff7a7a' });
  sfx?.bad?.();
  coach?.say?.(lang==='TH'?'ผิดหมวด!':'Wrong group!');
}

/* =========================
   4) Mission (ภายในโหมด)
   ========================= */
function newMissionWindow(state){
  // มิชชัน 45 วินาที: "เก็บตรงเป้าจำนวน N ชิ้น"
  const byDiff = { Easy: 6, Normal: 8, Hard: 10 };
  const need = byDiff[state.difficulty] ?? 8;
  return {
    kind: 'collect_target',
    need,           // ต้องเก็บตรงเป้ากี่ชิ้น
    progress: 0,    // ความคืบหน้า
    remain: 45,     // วินาที
    done: false,
    fail: false
  };
}

function updateMissionHUD(state){
  const gctx = state.ctx?.groups;
  if (!gctx?.mission) { setMissionLine(''); return; }
  const m = gctx.mission;
  if (m.done) {
    setMissionLine(m.fail ? '⌛ Mission Failed' : '🏁 Mission Complete');
    return;
  }
  // โชว์รูปแบบ: “🎯 เป้าหมาย x/Y • 45s”
  const lang = state.lang || 'TH';
  const lbl = lang==='TH' ? 'ตรงเป้า' : 'on target';
  setMissionLine(`🎯 ${lbl} ${m.progress}/${m.need} • ${m.remain|0}s`);
}

/* =========================
   5) Helpers
   ========================= */
function isOnTarget(groupKey, gctx){
  return groupKey === gctx.target1 || (!!gctx.target2 && groupKey === gctx.target2);
}
