// === /HeroHealth/vr/spawn-utils.js (2025-11-10 release) ===
// Non-overlap spawner กลางจอ: ลด "เป้ากระจุก", กันติดขอบ, adaptive minDist ระหว่างที่หาไม่เจอจุดว่าง
// API:
//   const sp = makeSpawner({ bounds, minDist, decaySec, edgeMargin })
//   sp.sample(maxTry?) -> {x,y,z}
//   sp.markActive(p) -> rec
//   sp.unmark(rec)
//   sp.getActiveCount() -> number
//   sp.clear()
//   sp.getBounds() -> {x:[min,max], y:[min,max], z:number}

export function makeSpawner(opts = {}) {
  const bounds = normalizeBounds(
    opts.bounds || { x: [-0.75, 0.75], y: [-0.05, 0.45], z: -1.6 }
  );
  const baseMin   = Number.isFinite(opts.minDist)   ? +opts.minDist   : 0.32;
  const decaySec  = Number.isFinite(opts.decaySec)  ? +opts.decaySec  : 2.0;
  const edge      = Number.isFinite(opts.edgeMargin)? +opts.edgeMargin: 0.02; // กันติดขอบนิดหน่อย

  let adaptiveMin = baseMin; // จะปรับลด/คืนอัตโนมัติ
  const actives = []; // {x,y,z,t}

  const now  = () => performance.now();
  const rand = (a,b) => a + Math.random() * (b - a);

  function normalizeBounds(b) {
    const bx = Array.isArray(b.x) ? b.x : [-0.75, 0.75];
    const by = Array.isArray(b.y) ? b.y : [-0.05, 0.45];
    const bz = (typeof b.z === 'number') ? b.z : -1.6;
    const x0 = Math.min(bx[0], bx[1]), x1 = Math.max(bx[0], bx[1]);
    const y0 = Math.min(by[0], by[1]), y1 = Math.max(by[0], by[1]);
    return { x:[x0, x1], y:[y0, y1], z:bz };
  }

  function prune() {
    const limit = now() - decaySec * 1000;
    for (let i = actives.length - 1; i >= 0; i--) {
      if (actives[i].t < limit) actives.splice(i, 1);
    }
  }

  function inside() {
    // กันติดขอบ edge
    const x0 = bounds.x[0] + edge, x1 = bounds.x[1] - edge;
    const y0 = bounds.y[0] + edge, y1 = bounds.y[1] - edge;
    return { x: rand(x0, x1), y: rand(y0, y1), z: bounds.z };
  }

  function ok(p) {
    // ใช้ระยะ 2D (z คงที่อยู่แล้ว) + adaptiveMin
    const min2 = adaptiveMin * adaptiveMin;
    for (let i = 0; i < actives.length; i++) {
      const a = actives[i];
      const dx = p.x - a.x, dy = p.y - a.y;
      if ((dx*dx + dy*dy) < min2) return false;
    }
    return true;
  }

  function sample(maxTry = 48) {
    prune();

    // พยายามแบบ rejection ก่อน
    for (let i = 0; i < maxTry; i++) {
      const p = inside();
      if (ok(p)) {
        adaptiveMin = baseMin; // คืนค่าเมื่อหาจุดได้
        return p;
      }
      // ทุก ๆ 12 ครั้ง ลดความเข้มงวด minDist ลงเล็กน้อย (แต่ไม่ต่ำกว่า 70% ของฐาน)
      if ((i+1) % 12 === 0) {
        adaptiveMin = Math.max(baseMin * 0.7, adaptiveMin * 0.9);
      }
    }

    // ถ้ายังไม่ได้จริง ๆ → ใช้ “dart throw” รอบศูนย์กลางคร่าว ๆ ช่วยแตกกลุ่ม
    const cx = (bounds.x[0] + bounds.x[1]) * 0.5;
    const cy = (bounds.y[0] + bounds.y[1]) * 0.5;
    for (let k = 0; k < 24; k++) {
      const ang = Math.random() * Math.PI * 2;
      const r   = adaptiveMin * (0.6 + Math.random() * 0.8);
      const p   = { x: clamp(cx + Math.cos(ang)*r, bounds.x[0]+edge, bounds.x[1]-edge),
                    y: clamp(cy + Math.sin(ang)*r, bounds.y[0]+edge, bounds.y[1]-edge),
                    z: bounds.z };
      if (ok(p)) return p;
    }

    // สุดท้ายจริง ๆ → กึ่งกลาง (รับประกันส่งค่ากลับ)
    return { x: cx, y: cy, z: bounds.z };
  }

  function markActive(p) {
    const rec = { x: p.x, y: p.y, z: p.z, t: now() };
    actives.push(rec);
    return rec;
  }

  function unmark(rec) {
    const i = actives.indexOf(rec);
    if (i > -1) actives.splice(i, 1);
  }

  function getActiveCount() { return actives.length; }
  function clear() { actives.length = 0; adaptiveMin = baseMin; }
  function getBounds() { return { x:[...bounds.x], y:[...bounds.y], z:bounds.z }; }

  return { sample, markActive, unmark, getActiveCount, clear, getBounds };
}

function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

export default { makeSpawner };