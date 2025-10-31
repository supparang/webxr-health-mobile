// /webxr-health-mobile/HeroHealth/game/modes/goodjunk.js
// Good vs Junk — 3D Targets + Shatter FX (auto-fallback to DOM if no Three)
// 2025-10-31

export const name = 'goodjunk';

const GOOD_EMOJI = ['🥦','🥕','🍎','🍌','🥗','🐟','🥜','🍚','🍞','🥛','🍇','🍓','🍊','🍅','🍆','🥬','🥝','🍍','🍐','🍑'];
const JUNK_EMOJI = ['🍔','🍟','🌭','🍕','🍩','🍪','🍰','🧋','🥤','🍗','🍖','🍫','🥓','🍿','🧈','🧂'];

let alive = false, use3D = false;
let R=null, S=null, C=null, THREE=null; // renderer, scene, camera, lib
let targets = [], shards = [];
let spawnT = 0, rate = 700, life = 1600;
let hostDOM = null; // สำหรับ fallback DOM

// ---------- glue to core ----------
function addScore(delta, perfect){
  try{ if (window.__HHA_modeHooks?.addScore) return window.__HHA_modeHooks.addScore(delta, !!perfect); }catch(_){}
  try{ if (window.addScore) return window.addScore(delta, !!perfect); }catch(_){}
}
function badHit(){
  try{ if (window.__HHA_modeHooks?.badHit) return window.__HHA_modeHooks.badHit(); }catch(_){}
  try{ if (window.badHit) return window.badHit(); }catch(_){}
}

// ---------- helpers ----------
function rng(a,b){ return Math.floor(a + Math.random()*(b-a+1)); }
function rand(a,b){ return a + Math.random()*(b-a); }

// ---------- 3D target factory ----------
function makeTarget3D(isGood){
  const col = isGood ? 0x31d67b : 0xe24d4d;
  const geo = isGood ? new THREE.IcosahedronGeometry(0.45, 1) : new THREE.OctahedronGeometry(0.48, 0);
  const mat = new THREE.MeshStandardMaterial({ color: col, roughness: 0.35, metalness: 0.1, emissive: 0x000000 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.userData = { good:isGood?1:0, born: performance.now() };

  // random pos inside camera view (approx)
  const spanX = 5.2, spanY = 3.0;
  mesh.position.set(rand(-spanX,spanX), rand(-spanY,spanY), rand(-1.0, 1.2));
  mesh.rotation.set(rand(0,Math.PI), rand(0,Math.PI), rand(0,Math.PI));
  mesh.userData.spin = { x: rand(-1.2,1.2), y: rand(-1.5,1.5), z: rand(-0.6,0.6) };
  S.add(mesh);
  targets.push(mesh);
}

function shatterAt(pos, color){
  const pieces = 20;
  for(let i=0;i<pieces;i++){
    const g = new THREE.TetrahedronGeometry(rand(0.06,0.12), 0);
    const m = new THREE.MeshStandardMaterial({ color: color, roughness:0.6, metalness:0.0, transparent:true, opacity:1.0 });
    const p = new THREE.Mesh(g,m);
    p.position.copy(pos);
    p.userData.vel = new THREE.Vector3(rand(-2.2,2.2), rand(-2.2,2.2), rand(-2.0,2.0));
    p.userData.rot = new THREE.Vector3(rand(-3,3), rand(-3,3), rand(-3,3));
    p.userData.life = 0.8; // seconds
    S.add(p); shards.push(p);
  }
  // screen shake เบา ๆ
  try{
    const gl = document.getElementById('gameLayer');
    gl.style.transition='transform 60ms ease';
    gl.style.transform='translate3d(2px, -2px, 0)';
    setTimeout(()=>{ gl.style.transform='translate3d(0,0,0)'; }, 80);
  }catch(_){}
}

function update3D(dt){
  // ro
