// === AI Pattern Generator (Deterministic) ===
// Used by GroupsVR to generate target layouts in a controlled way

'use strict';

function seededRand(seed){
  let x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function makeRNG(seed){
  let s = seed || 123456;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

// ----- PATTERN GENERATORS -----

function patternGrid9({width, height, padding=0.1}){
  const pts = [];
  const cols = 3, rows = 3;
  for(let y=0;y<rows;y++){
    for(let x=0;x<cols;x++){
      pts.push({
        x: (x+1)/(cols+1),
        y: (y+1)/(rows+1)
      });
    }
  }
  return pts;
}

function patternRing({count=8, radius=0.35}){
  const pts = [];
  for(let i=0;i<count;i++){
    const a = (Math.PI*2*i)/count;
    pts.push({
      x: 0.5 + Math.cos(a)*radius,
      y: 0.5 + Math.sin(a)*radius
    });
  }
  return pts;
}

function patternWave({count=8}){
  const pts = [];
  for(let i=0;i<count;i++){
    const t = i/(count-1);
    pts.push({
      x: 0.1 + 0.8*t,
      y: 0.5 + Math.sin(t*Math.PI*2)*0.25
    });
  }
  return pts;
}

function patternRandom({count=8, rng}){
  const pts = [];
  for(let i=0;i<count;i++){
    pts.push({
      x: 0.1 + 0.8*rng(),
      y: 0.15 + 0.7*rng()
    });
  }
  return pts;
}

export function generatePattern(type, opts={}){
  const seed = opts.seed || 1;
  const rng = makeRNG(seed);
  const count = opts.count || 8;

  switch(type){
    case 'grid9': return patternGrid9(opts);
    case 'ring':  return patternRing(opts);
    case 'wave':  return patternWave(opts);
    case 'random':
    default:
      return patternRandom({count, rng});
  }
}