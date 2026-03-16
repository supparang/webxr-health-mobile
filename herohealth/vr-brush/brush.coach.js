// /herohealth/vr-brush/brush.coach.js
// HOTFIX v20260316c-BRUSH-COACH-MATCH-6ZONES

const ZONE_META = [
  {
    id:'upper_outer',
    label:'ฟันบนด้านนอก',
    direction:'ขึ้น-ลง',
    expectedDir:'vertical',
    realTip:'เวลาจริงให้แปรงด้านนอกของฟันบนเบา ๆ ทีละซี่ ไล่จากซ้ายไปขวา'
  },
  {
    id:'upper_inner',
    label:'ฟันบนด้านใน',
    direction:'ขึ้น-ลง',
    expectedDir:'vertical',
    realTip:'เวลาจริงอย่าลืมด้านในของฟันบน เพราะเป็นจุดที่มักถูกลืม'
  },
  {
    id:'upper_chew',
    label:'ฟันบนด้านบดเคี้ยว',
    direction:'ซ้าย-ขวา',
    expectedDir:'horizontal',
    realTip:'เวลาจริงให้ถูบริเวณบดเคี้ยวไปมาเบา ๆ ให้ทั่วร่องฟัน'
  },
  {
    id:'lower_outer',
    label:'ฟันล่างด้านนอก',
    direction:'ขึ้น-ลง',
    expectedDir:'vertical',
    realTip:'เวลาจริงให้แปรงด้านนอกของฟันล่างให้ครบทั้งแนว'
  },
  {
    id:'lower_inner',
    label:'ฟันล่างด้านใน',
    direction:'ขึ้น-ลง',
    expectedDir:'vertical',
    realTip:'เวลาจริงด้านในฟันล่างสำคัญมาก ควรค่อย ๆ ถูให้ทั่ว'
  },
  {
    id:'lower_chew',
    label:'ฟันล่างด้านบดเคี้ยว',
    direction:'ซ้าย-ขวา',
    expectedDir:'horizontal',
    realTip:'เวลาจริงให้แปรงผิวบดเคี้ยวไปมาเพื่อเก็บคราบตามร่องฟัน'
  }
];

function clamp(v,a,b){
  return Math.max(a, Math.min(b, v));
}

function safePct(n){
  return clamp(Math.round(Number(n) || 0), 0, 100);
}

export function createZoneMastery(){
  return ZONE_META.map(z => ({
    id: z.id,
    label: z.label,
    expectedDir: z.expectedDir,
    correctDirHits: 0,
    wrongDirHits: 0,
    localMiss: 0,
    totalStar: 0
  }));
}

export function zoneDirectionText(idx){
  return ZONE_META[idx]?.direction || 'ถูตามแนวที่กำหนด';
}

export function humanZoneInstruction(label){
  return `ถู${label || 'โซนนี้'}`;
}

export function starsText(n){
  const s = clamp(Math.round(Number(n) || 0), 0, 3);
  return `${'★'.repeat(s)}${'☆'.repeat(3 - s)}`;
}

export function zoneSummaryChecks(zoneState, zoneMastery, idx, targetClean = 85){
  const z = zoneState?.[idx];
  const m = zoneMastery?.[idx];
  if(!z || !m){
    return {
      clean:false,
      direction:false,
      control:false,
      cleanPct:0,
      dirRate:0,
      localMiss:0,
      stars:0
    };
  }

  const cleanPct = safePct(z.clean);
  const totalDir = (m.correctDirHits || 0) + (m.wrongDirHits || 0);
  const dirRate = totalDir > 0
    ? Math.round(((m.correctDirHits || 0) / totalDir) * 100)
    : 0;

  const localMiss = Math.max(0, Math.round(m.localMiss || 0));

  const clean = cleanPct >= targetClean;
  const direction = totalDir === 0 ? false : dirRate >= 60;
  const control = localMiss <= 2;

  const stars =
    (clean ? 1 : 0) +
    (direction ? 1 : 0) +
    (control ? 1 : 0);

  return {
    clean,
    direction,
    control,
    cleanPct,
    dirRate,
    localMiss,
    stars
  };
}

export function calcZoneStars(zoneState, zoneMastery, idx, targetClean = 85){
  const checks = zoneSummaryChecks(zoneState, zoneMastery, idx, targetClean);
  const m = zoneMastery?.[idx];
  if(m) m.totalStar = checks.stars;
  return checks.stars;
}

export function zoneSummaryLine(zoneState, zoneMastery, idx, targetClean = 85){
  const meta = ZONE_META[idx];
  const c = zoneSummaryChecks(zoneState, zoneMastery, idx, targetClean);

  const cleanLine = `สะอาด ${c.cleanPct}%`;
  const dirLine = c.dirRate > 0
    ? `ทิศถูก ${c.dirRate}%`
    : `ยังไม่มีข้อมูลทิศ`;
  const missLine = `พลาด ${c.localMiss} ครั้ง`;

  return `${meta?.label || 'โซนนี้'} • ${cleanLine} • ${dirLine} • ${missLine}`;
}

export function zoneRealLifeTip(idx){
  return ZONE_META[idx]?.realTip || 'แปรงเบา ๆ ให้ทั่วทุกซี่';
}

export function overallRealLifeTip(zoneState, zoneMastery, targetClean = 85){
  if(!Array.isArray(zoneState) || !Array.isArray(zoneMastery)){
    return 'เวลาจริงควรแปรงให้ทั่วทุกด้านของฟัน ทั้งด้านนอก ด้านใน และด้านบดเคี้ยว';
  }

  const weak = zoneState
    .map((_, idx)=> ({
      idx,
      ...zoneSummaryChecks(zoneState, zoneMastery, idx, targetClean)
    }))
    .sort((a,b)=> a.stars - b.stars || a.cleanPct - b.cleanPct)[0];

  if(!weak){
    return 'เวลาจริงควรแปรงให้ทั่วทุกด้านของฟัน ทั้งด้านนอก ด้านใน และด้านบดเคี้ยว';
  }

  if(!weak.clean){
    return `จุดที่ควรฝึกเพิ่มคือ ${ZONE_META[weak.idx]?.label || 'บางโซน'} เพราะยังสะอาดไม่พอ ควรถูให้ทั่วมากขึ้น`;
  }

  if(!weak.direction){
    return `จุดที่ควรฝึกเพิ่มคือ ${ZONE_META[weak.idx]?.label || 'บางโซน'} ลองถูแบบ${zoneDirectionText(weak.idx)}ให้สม่ำเสมอขึ้น`;
  }

  if(!weak.control){
    return `จุดที่ควรฝึกเพิ่มคือ ${ZONE_META[weak.idx]?.label || 'บางโซน'} พยายามลดการกดผิดหรือเปลี่ยนโซนเร็วเกินไป`;
  }

  return 'ทำได้ดีแล้ว เวลาจริงอย่าลืมแปรงให้ครบทั้งด้านนอก ด้านใน และด้านบดเคี้ยวของทุกซี่';
}

export function zoneCoachFeedback({
  zoneState,
  zoneMastery,
  idx,
  mode = 'learn',
  targetClean = 85
}){
  const meta = ZONE_META[idx];
  const c = zoneSummaryChecks(zoneState, zoneMastery, idx, targetClean);

  if(c.stars >= 3){
    return {
      tone:'good',
      text:`ยอดเยี่ยม! ${meta?.label || 'โซนนี้'} สะอาดดีและถูได้ถูกทิศ`
    };
  }

  if(!c.clean){
    return {
      tone:'warn',
      text:`${meta?.label || 'โซนนี้'} ยังสะอาดไม่พอ ลองถูให้ทั่วอีกนิด`
    };
  }

  if(!c.direction){
    return {
      tone:'warn',
      text:`ลองถู${zoneDirectionText(idx)} จะช่วยให้ ${meta?.label || 'โซนนี้'} สะอาดขึ้น`
    };
  }

  if(!c.control){
    return {
      tone:'mid',
      text:`ทำได้ดีแล้ว ลองคุมมือให้นิ่งขึ้นอีกนิดที่ ${meta?.label || 'โซนนี้'}`
    };
  }

  if(mode === 'challenge'){
    return {
      tone:'good',
      text:`ดีมาก! ${meta?.label || 'โซนนี้'} ผ่านโหมดท้าทายแล้ว`
    };
  }

  return {
    tone:'good',
    text:`ดีมาก! ${meta?.label || 'โซนนี้'} ผ่านแล้ว`
  };
}