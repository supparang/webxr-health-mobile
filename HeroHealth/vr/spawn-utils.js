// === /HeroHealth/vr/spawn-utils.js (clean, ESM) ===
// สุ่มตำแหน่งแบบ "ไม่กระจุก" ด้วยระยะห่างขั้นต่ำ (minDist) + อายุจุด (decaySec)
// ใช้ร่วมกับทุกโหมดเกม

export function makeSpawner({ bounds, minDist = 0.32, decaySec = 2.0 }) {
  const box = bounds || { x: [-0.75, 0.75], y: [-0.05, 0.45], z: -1.6 };
  const actives = []; // {x,y,z,t}

  const now = () => performance.now();
  const rand = (a, b) => a + Math.random() * (b - a);

  function inside() {
    const x = rand(box.x[0], box.x[1]);
    const y = rand(box.y[0], box.y[1]);
    const z = box.z;
    return { x, y, z };
  }

  function prune() {
    const limit = decaySec * 1000;
    const t = now();
    for (let i = actives.length - 1; i >= 0; i--) {
      if (t - actives[i].t > limit) actives.splice(i, 1);
    }
  }

  function ok(p) {
    for (let i = 0; i < actives.length; i++) {
      const a = actives[i];
      const dx = p.x - a.x, dy = p.y - a.y, dz = (p.z || -1.6) - (a.z || -1.6);
      if ((dx*dx + dy*dy + dz*dz) < (minDist * minDist)) return false;
    }
    return true;
  }

  function sample(maxTry = 40) {
    prune();
    for (let i = 0; i < maxTry; i++) {
      const p = inside();
      if (ok(p)) return p;
    }
    // ถ้าหาไม่ได้จริง ๆ ให้คืน "กึ่งกลาง"
    return { x: (box.x[0] + box.x[1]) / 2, y: (box.y[0] + box.y[1]) / 2, z: box.z };
  }

  function markActive(p) {
    const rec = { x: p.x, y: p.y, z: p.z, t: now() };
    actives.push(rec);
    return rec;
  }

  function unmark(rec) {
    const i = actives.indexOf(rec);
    if (i >= 0) actives.splice(i, 1);
  }

  return { sample, markActive, unmark };
}

export default { makeSpawner };