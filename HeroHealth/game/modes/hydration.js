// === Hero Health Academy — modes/hydration.js (hydration bar + rules + mini-quests ready) ===
export const name = 'hydration';

// ... (คงรายการ WATER/SWEET/NEUTRAL และ ST ไว้)

function zoneOf(level, min, max){
  if (level < min) return 'LOW';
  if (level > max) return 'HIGH';
  return 'OK';
}

export function init(gameState, hud, diff){
  ST.lang = localStorage.getItem('hha_lang') || 'TH';
  ST.level = 50;
  ST.safeMin = 40;
  ST.safeMax = 60;

  ST.$wrap  = document.getElementById('hydroWrap');
  ST.$bar   = document.getElementById('hydroBar');
  ST.$label = document.getElementById('hydroLabel');

  // เก็บโซนล่าสุดไว้ตรวจ cross
  ST.prevZone = zoneOf(ST.level, ST.safeMin, ST.safeMax);

  if (ST.$wrap){ ST.$wrap.style.display = 'block'; }
  renderBar();
}
export function cleanup(){
  if (ST.$wrap) ST.$wrap.style.display = 'none';
}
export function tick(){
  // ยิง hydro_tick ทุกวินาที เพื่อให้เควสต์ HYD เดิน
  try{
    const z = zoneOf(ST.level, ST.safeMin, ST.safeMax);
    window.HHA_QUESTS?.event?.('hydro_tick', { level: ST.level, zone: z });
  }catch{}
}

// สุ่มชิ้น: (เดิม)
export function pickMeta(diff){
  // ... (เหมือนเดิม)
}

// กฎ (เดิม) + ยิง hydro_click / hydro_cross
export function onHit(meta, systems, gameState, hud){
  let res = 'ok';
  const before = {
    level: ST.level,
    zone: zoneOf(ST.level, ST.safeMin, ST.safeMax)
  };

  if (meta.type==='water'){
    ST.level = clamp(ST.level + 8, 0, 120);
  }else if (meta.type==='sweet'){
    ST.level = clamp(ST.level + 4, 0, 120);
  } // neutral: ไม่เปลี่ยน

  const afterZone = zoneOf(ST.level, ST.safeMin, ST.safeMax);

  // ยิงคลิกสำหรับเควสต์ SMART SIPS / TREATS TO BALANCE
  try{
    window.HHA_QUESTS?.event?.('hydro_click', {
      zoneBefore: before.zone,
      kind: meta.type   // 'water' | 'sweet' | 'neutral'
    });
  }catch{}

  // ยิง cross เมื่อเปลี่ยนโซน
  if (afterZone !== before.zone){
    try{
      window.HHA_QUESTS?.event?.('hydro_cross', { from: before.zone, to: afterZone });
    }catch{}
    ST.prevZone = afterZone;
  }

  // ตัดสินผล (เดิม)
  if (ST.level > ST.safeMax){
    if (meta.type==='water'){ res='bad'; }
    else if (meta.type==='sweet'){ res='good'; }
    else { res='ok'; }
  } else if (ST.level < ST.safeMin){
    if (meta.type==='sweet'){ res='bad'; }
    else if (meta.type==='water'){ res='good'; }
    else { res='ok'; }
  } else {
    if (meta.type==='water'){ res='good'; }
    else if (meta.type==='sweet'){ res='ok'; }
    else { res='ok'; }
  }

  if (res==='good') systems.coach?.say?.(t('ดีมาก! ระดับน้ำกำลังดี', 'Nice! Hydration on track', ST.lang));
  if (res==='bad')  systems.coach?.say?.(t('ยังไม่เหมาะนะ', 'Not ideal yet', ST.lang));

  renderBar();
  return res;
}

// Power durations (เดิม)
export function getPowerDurations(){ return { x2:8, freeze:3, magnet:0 }; }
export const powers = {
  x2Target(){ ST.x2Until = performance.now() + 8000; },
  freezeTarget(){ /* main.js จัดการหยุด spawn */ },
  magnetNext(){ /* ไม่ใช้ */ }
};

// สแน็ปช็อตให้ main.js อ่านได้
export function getHydroSnapshot(){
  return { level: ST.level, min: ST.safeMin, max: ST.safeMax, zone: zoneOf(ST.level, ST.safeMin, ST.safeMax) };
}

// ... (renderBar / utils และ fx เดิมทั้งหมด)
