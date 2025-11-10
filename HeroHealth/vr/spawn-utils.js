// === vr/spawn-utils.js ===
export function makeSpawner({ bounds={x:[-0.75,0.75], y:[-0.05,0.45], z:-1.6}, minDist=0.32, decaySec=2.0 } = {}) {
  const actives = []; // {x,y,z,t}
  const now = () => performance.now();
  const rand = (a,b)=> a + Math.random()*(b-a);

  function prune() {
    const limit = now() - decaySec*1000;
    for (let i=actives.length-1; i>=0; i--) if (actives[i].t < limit) actives.splice(i,1);
  }
  function ok(p) {
    for (let i=0;i<actives.length;i++){
      const a=actives[i], dx=p.x-a.x, dy=p.y-a.y, dz=(p.z-a.z);
      if ((dx*dx+dy*dy+dz*dz) < (minDist*minDist)) return false;
    }
    return true;
  }
  function inside(){ return { x:rand(bounds.x[0],bounds.x[1]), y:rand(bounds.y[0],bounds.y[1]), z:bounds.z }; }

  function sample(maxTry=36){ prune(); for(let i=0;i<maxTry;i++){ const p=inside(); if(ok(p)) return p; } return inside(); }
  function markActive(p){ const r={x:p.x,y:p.y,z:p.z,t:now()}; actives.push(r); return r; }
  function unmark(r){ const i=actives.indexOf(r); if(i>-1) actives.splice(i,1); }

  return { sample, markActive, unmark };
}
export default { makeSpawner };