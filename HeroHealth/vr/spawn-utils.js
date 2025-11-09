// === vr/spawn-utils.js ===
// Poisson-like spacing + adaptive pacing shared across modes

const CONST = {
  LIFE_MS: 1800,
  MIN_DIST: 0.45,
  R_MIN: 0.35,
  R_MAX: 1.0,
  EXTRA_PER_ALIVE: 140,
  EXTRA_CAP: 700,
};

export const SpawnSpace = (() => {
  const pts = []; // {x,y,z,t}
  const MIN2 = CONST.MIN_DIST * CONST.MIN_DIST;
  function purge(now) { while (pts.length && now - pts[0].t > CONST.LIFE_MS) pts.shift(); }
  function farEnough(x, z) { for (const p of pts){const dx=x-p.x,dz=z-p.z; if(dx*dx+dz*dz<MIN2) return false;} return true; }
  return {
    next(origin){
      const now = performance.now(); purge(now);
      for(let k=0;k<18;k++){
        const ang=Math.random()*Math.PI*2;
        const r=CONST.R_MIN+Math.random()*(CONST.R_MAX-CONST.R_MIN);
        const x=origin.x+Math.cos(ang)*r, z=origin.z+Math.sin(ang)*r;
        if(farEnough(x,z)){ pts.push({x,y:origin.y,z,t:now}); return {x,y:origin.y,z}; }
      }
      const x=origin.x+(Math.random()<.5?-CONST.MIN_DIST:CONST.MIN_DIST);
      const z=origin.z+(Math.random()<.5?-CONST.MIN_DIST:CONST.MIN_DIST);
      pts.push({x,y:origin.y,z,t:performance.now()}); return {x,y:origin.y,z};
    }
  };
})();

export function createSpawnerPacer(){
  const alive=new Set();
  function track(el){ alive.add(el); el.addEventListener('remove',()=>alive.delete(el)); }
  function schedule(baseMs,fn){ const extra=Math.min(CONST.EXTRA_CAP,alive.size*CONST.EXTRA_PER_ALIVE); setTimeout(fn,baseMs+extra); }
  return { track, schedule, aliveCount:()=>alive.size };
}

export function defaultsByDifficulty(diff){
  if(diff==='easy')   return { gap:[650,750], life:[2200,2500] };
  if(diff==='hard')   return { gap:[380,480], life:[1400,1600] };
  return /* normal */ { gap:[520,600], life:[1800,2000] };
}
export function randIn([a,b]){ return Math.floor(a + Math.random()*(b-a)); }
