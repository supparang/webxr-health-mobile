// === vr/spawn-utils.js (shared by all modes) ===
// Poisson-like spawn spacing + adaptive pacing per alive count

const CONST = {
  LIFE_MS: 1800,     // นานแค่ไหนที่ถือว่ายังกันชนอยู่
  MIN_DIST: 0.45,    // ระยะกันชนขั้นต่ำ (เมตร)
  R_MIN: 0.35,       // รัศมีรอบ origin ขั้นต่ำ
  R_MAX: 1.0,        // รัศมีรอบ origin ขั้นสูงสุด
  EXTRA_PER_ALIVE: 140, // หน่วงเพิ่มต่อชิ้นที่ยังค้างอยู่
  EXTRA_CAP: 700,       // หน่วงเพิ่มสูงสุด
};

export const SpawnSpace = (() => {
  const pts = []; // {x,y,z,t}
  const MIN2 = CONST.MIN_DIST * CONST.MIN_DIST;

  function purge(now) {
    while (pts.length && now - pts[0].t > CONST.LIFE_MS) pts.shift();
  }
  function farEnough(x, z) {
    for (const p of pts) {
      const dx = p.x - x, dz = p.z - z;
      if (dx*dx + dz*dz < MIN2) return false;
    }
    return true;
  }

  return {
    next(origin) {
      const now = performance.now();
      purge(now);
      // ลองสุ่มหลายครั้งเพื่อหาโล่ง
      for (let k = 0; k < 18; k++) {
        const ang = Math.random() * Math.PI * 2;
        const r   = CONST.R_MIN + Math.random() * (CONST.R_MAX - CONST.R_MIN);
        const x = origin.x + Math.cos(ang) * r;
        const z = origin.z + Math.sin(ang) * r;
        if (farEnough(x, z)) {
          pts.push({ x, y: origin.y, z, t: now });
          const y = origin.y + (Math.random()*0.04 - 0.02);
          return { x, y, z };
        }
      }
      // fallback: ดันออกซ้าย/ขวา
      const x = origin.x + (Math.random() < 0.5 ? -CONST.MIN_DIST : CONST.MIN_DIST);
      const z = origin.z + (Math.random() < 0.5 ? -CONST.MIN_DIST : CONST.MIN_DIST);
      pts.push({ x, y: origin.y, z, t: now });
      return { x: x, y: origin.y, z: z };
    }
  };
})();

export function createSpawnerPacer() {
  const alive = new Set();
  function track(el) {
    alive.add(el);
    // เมื่อโดนลบออกจาก scene
    el.addEventListener('remove', () => alive.delete(el));
  }
  function schedule(baseMs, fn) {
    const extra = Math.min(CONST.EXTRA_CAP, alive.size * CONST.EXTRA_PER_ALIVE);
    setTimeout(fn, baseMs + extra);
  }
  function aliveCount() { return alive.size; }
  return { track, schedule, aliveCount };
}

// ค่ามาตรฐานต่อตามระดับ
export function defaultsByDifficulty(diff) {
  // gap: ช่วงเวลาสปอว์นพื้นฐาน / life: อายุเป้า
  if (diff === 'easy')   return { gap: [650, 750], life: [2200, 2500] };
  if (diff === 'hard')   return { gap: [380, 480], life: [1400, 1600] };
  /* normal */           return { gap: [520, 600], life: [1800, 2000] };
}
// ช่วยสุ่มในช่วงค่า
export function randIn([a,b]) { return Math.floor(a + Math.random()*(b-a)); }
