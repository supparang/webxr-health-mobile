// === vr/spawn-utils.js (clean, unified) ===
// สุ่มตำแหน่งแบบ "ไม่กระจุก" ด้วย minDist + decay (จุดที่เพิ่งใช้จะล็อกช่วงหนึ่ง)
// ใช้ร่วมทุกโหมดได้: goodjunk / groups / hydration / plate
//
// ใช้:
//   import { makeSpawner } from '../vr/spawn-utils.js';
//   const sp = makeSpawner({ bounds:{x:[-0.75,0.75], y:[-0.05,0.45], z:-1.6}, minDist:0.32, decaySec:2.0 });
//   const p = sp.sample(); const rec = sp.markActive(p); ... sp.unmark(rec);

export function makeSpawner(opts = {}) {
  const bounds   = opts.bounds  || { x:[-0.75,0.75], y:[-0.05,0.45], z:-1.6 };
  const minDist  = Number(opts.minDist  ?? 0.32);
  const decaySec = Number(opts.decaySec ?? 2.0);

  const actives = []; // {x,y,z,t}
  const now = () => performance.now();

  function rand(a,b){ return a + Math.random()*(b-a); }

  function inside() {
    const x = rand(bounds.x[0], bounds.x[1]);
    const y = rand(bounds.y[0], bounds.y[1]);
    const z = bounds.z || -1.6;
    return { x, y, z };
  }

  function ok(p) {
    for (let i = 0; i < actives.length; i++) {
      const a = actives[i];
      const dx = p.x - a.x, dy = p.y - a.y, dz = (p.z||-1.6) - (a.z||-1.6);
      if ((dx*dx + dy*dy + dz*dz) < (minDist*minDist)) return false;
    }
    return true;
  }

  function prune() {
    const limit = decaySec * 1000;
    const t = now();
    for (let i = actives.length - 1; i >= 0; i--) {
      if (t - actives[i].t > limit) actives.splice(i, 1);
    }
  }

  function sample(maxTry = 24) {
    prune();
    for (let i = 0; i < maxTry; i++) {
      const p = inside();
      if (ok(p)) return p;
    }
    // ถ้าหาที่ว่างไม่ได้จริง ๆ ให้ใช้กึ่งกลาง bounds
    return { x:(bounds.x[0]+bounds.x[1])/2, y:(bounds.y[0]+bounds.y[1])/2, z:bounds.z||-1.6 };
  }

  function markActive(p) {
    const rec = { x:p.x, y:p.y, z:p.z, t: now() };
    actives.push(rec);
    return rec;
  }

  function unmark(rec) {
    const i = actives.indexOf(rec);
    if (i >= 0) actives.splice(i, 1);
  }

  function clear() {
    actives.length = 0;
  }

  return { sample, markActive, unmark, clear };
}

export default { makeSpawner };
