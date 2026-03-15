export const BRUSH_ZONES = [
  { id:'upper_outer', label:'ฟันบนด้านนอก', dir:'vertical' },
  { id:'upper_inner', label:'ฟันบนด้านใน', dir:'vertical' },
  { id:'upper_chew',  label:'ฟันบนด้านบดเคี้ยว', dir:'horizontal' },
  { id:'lower_outer', label:'ฟันล่างด้านนอก', dir:'vertical' },
  { id:'lower_inner', label:'ฟันล่างด้านใน', dir:'vertical' },
  { id:'lower_chew',  label:'ฟันล่างด้านบดเคี้ยว', dir:'horizontal' }
];

export function starsText(n){
  const safe = Math.max(0, Math.min(3, Number(n) || 0));
  return '★'.repeat(safe) + '☆'.repeat(3 - safe);
}

export function zoneDirectionText(idx){
  return BRUSH_ZONES[idx]?.dir === 'horizontal' ? 'ถูซ้าย-ขวา' : 'ถูขึ้น-ลง';
}

export function humanZoneInstruction(label){
  const map = {
    'ฟันบนด้านนอก': 'ถูฟันแถวบนด้านหน้า',
    'ฟันบนด้านใน': 'ถูฟันแถวบนด้านใน',
    'ฟันบนด้านบดเคี้ยว': 'ถูด้านบนของฟันแถวบน',
    'ฟันล่างด้านนอก': 'ถูฟันแถวล่างด้านหน้า',
    'ฟันล่างด้านใน': 'ถูฟันแถวล่างด้านใน',
    'ฟันล่างด้านบดเคี้ยว': 'ถูด้านบนของฟันแถวล่าง'
  };
  return map[label] || `ถู${label}`;
}

export function createZoneMastery(){
  return BRUSH_ZONES.map(z => ({
    id: z.id,
    label: z.label,
    cleanStar: 0,
    dirStar: 0,
    controlStar: 0,
    totalStar: 0,
    correctDirHits: 0,
    wrongDirHits: 0,
    localMiss: 0
  }));
}

export function zoneRealLifeTip(idx){
  const z = BRUSH_ZONES[idx];
  if (!z) return 'ลองแปรงช้า ๆ ให้ทั่วทุกซี่';

  if (z.id === 'upper_outer' || z.id === 'lower_outer') {
    return 'ตอนแปรงจริง ฟันด้านนอกให้ปัดขึ้น-ลงเบา ๆ';
  }
  if (z.id === 'upper_inner' || z.id === 'lower_inner') {
    return 'ตอนแปรงจริง ฟันด้านในให้ค่อย ๆ ปัดขึ้น-ลงให้ทั่ว';
  }
  if (z.id === 'upper_chew' || z.id === 'lower_chew') {
    return 'ตอนแปรงจริง ฟันบดเคี้ยวให้ถูซ้าย-ขวาสั้น ๆ';
  }
  return 'ลองแปรงช้า ๆ ให้ทั่วทุกซี่';
}

export function calcZoneStars(zoneState, zoneMastery, idx, targetClean){
  const zs = zoneState[idx];
  const ms = zoneMastery[idx];
  if (!zs || !ms) return 0;

  const cleanPct = Math.max(0, Math.min(100, Math.round(zs.clean || 0)));
  ms.cleanStar = cleanPct >= targetClean ? 1 : 0;

  const totalDir = (ms.correctDirHits || 0) + (ms.wrongDirHits || 0);
  const dirRate = totalDir > 0 ? (ms.correctDirHits / totalDir) : 0;
  ms.dirStar = totalDir >= 6 && dirRate >= 0.72 ? 1 : 0;

  ms.controlStar = (ms.localMiss || 0) <= 2 ? 1 : 0;
  ms.totalStar = ms.cleanStar + ms.dirStar + ms.controlStar;

  return ms.totalStar;
}

export function zoneCoachFeedback({ zoneState, zoneMastery, idx, mode, targetClean }){
  const zs = zoneState[idx];
  const ms = zoneMastery[idx];
  if (!zs || !ms) return { text:'ลองอีกครั้งนะ', tone:'mid' };

  calcZoneStars(zoneState, zoneMastery, idx, targetClean);

  if (mode === 'learn') {
    if (ms.cleanStar === 0) return { text:`ดีแล้ว ลองถู ${ms.label} ต่ออีกนิด`, tone:'mid' };
    if (ms.dirStar === 0) return { text:'ลองถูตามทิศที่บอก จะง่ายขึ้น', tone:'mid' };
    return { text:'เยี่ยมมาก กำลังทำได้ดีเลย', tone:'good' };
  }

  if (ms.totalStar >= 3) {
    return { text:`เยี่ยมมาก! ${ms.label} ทำได้ดีมาก`, tone:'good' };
  }
  if (ms.cleanStar === 0) {
    return { text:`${ms.label} ยังไม่สะอาดพอ ลองถูต่ออีกนิด`, tone:'warn' };
  }
  if (ms.dirStar === 0) {
    return { text:`${ms.label} สะอาดแล้ว ลองถูตามทิศให้ชัดขึ้น`, tone:'mid' };
  }
  if (ms.controlStar === 0) {
    return { text:`${ms.label} ดีแล้ว ระวังอย่ากดพลาดอีกนิด`, tone:'mid' };
  }
  return { text:`${ms.label} ผ่านแล้ว ไปต่อกัน`, tone:'good' };
}

export function zoneSummaryChecks(zoneState, zoneMastery, idx, targetClean){
  const zs = zoneState[idx];
  const ms = zoneMastery[idx];
  if (!zs || !ms) return null;

  calcZoneStars(zoneState, zoneMastery, idx, targetClean);

  const totalDir = (ms.correctDirHits || 0) + (ms.wrongDirHits || 0);
  const dirRate = totalDir > 0 ? Math.round((ms.correctDirHits / totalDir) * 100) : 0;

  return {
    clean: !!ms.cleanStar,
    direction: !!ms.dirStar,
    control: !!ms.controlStar,
    stars: ms.totalStar || 0,
    cleanPct: Math.max(0, Math.min(100, Math.round(zs.clean || 0))),
    localMiss: ms.localMiss || 0,
    dirRate
  };
}

export function zoneSummaryLine(zoneState, zoneMastery, idx, targetClean){
  const c = zoneSummaryChecks(zoneState, zoneMastery, idx, targetClean);
  const label = zoneState[idx]?.label || `โซน ${idx+1}`;
  if (!c) return label;

  if (c.stars >= 3) return `${label} • เก่งมาก`;
  if (c.clean && !c.direction) return `${label} • สะอาดแล้ว แต่ยังควรถูตามทิศให้ชัดขึ้น`;
  if (c.clean && !c.control) return `${label} • ทำได้แล้ว แต่ยังพลาดบ้าง`;
  if (!c.clean) return `${label} • ยังถูไม่ทั่วพอ`;
  return `${label} • ผ่านแล้ว`;
}

export function overallRealLifeTip(zoneState, zoneMastery, targetClean){
  const weak = zoneMastery
    .map((m, i) => ({ i, stars: calcZoneStars(zoneState, zoneMastery, i, targetClean) }))
    .sort((a, b) => a.stars - b.stars)[0];

  if (!weak) return 'ลองแปรงช้า ๆ ให้ทั่วทุกซี่';
  return zoneRealLifeTip(weak.i);
}