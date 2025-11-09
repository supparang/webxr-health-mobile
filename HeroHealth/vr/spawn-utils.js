// Non-overlap spawner (กลางจอ) — ใช้ร่วมกันทุกโหมด
export function makeSpawner(opt = {}) {
  const b = opt.bounds || { x:[-0.75,0.75], y:[-0.05,0.45], z:-1.6 };
  const minDist = Number(opt.minDist || 0.32);
  const decaySec = Number(opt.decaySec || 2.0);

  const act = []; // {x,y,z,t}
  function now(){ return performance.now(); }
  function sweep() {
    const limit = now() - decaySec*1000;
    for (let i=act.length-1; i>=0; i--) if (act[i].t < limit) act.splice(i,1);
  }
  function dist2(a,b){ const dx=a.x-b.x, dy=a.y-b.y; return dx*dx+dy*dy; }

  function sample() {
    sweep();
    for (let k=0; k<40; k++){
      const x = rnd(b.x[0], b.x[1]);
      const y = rnd(b.y[0], b.y[1]);
      const z = b.z;
      let ok = true;
      for (const p of act){ if (dist2(p,{x,y}) < minDist*minDist){ ok=false; break; } }
      if (ok) return {x,y,z};
    }
    // ถ้าหาที่ว่างไม่เจอจริง ๆ → ส่งกึ่งกลาง
    return { x:(b.x[0]+b.x[1])/2, y:(b.y[0]+b.y[1])/2, z:b.z };
  }
  function markActive(p){ const r={x:p.x,y:p.y,z:p.z,t:now()}; act.push(r); return r; }
  function unmark(r){ const i=act.indexOf(r); if(i>-1) act.splice(i,1); }

  return { sample, markActive, unmark, _active:act };
}
function rnd(a,b){ return a + Math.random()*(b-a); }
export default { makeSpawner };
