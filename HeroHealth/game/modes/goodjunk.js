// /webxr-health-mobile/HeroHealth/game/modes/goodjunk.js
// Good vs Junk — Guaranteed Spawn + 3D Shatter (auto-fallback DOM)
// 2025-10-31 G2

export const name = 'goodjunk';

const GOOD_EMOJI = ['🥦','🥕','🍎','🍌','🥗','🐟','🥜','🍚','🍞','🥛','🍇','🍓','🍊','🍅','🍆','🥬','🥝','🍍','🍐','🍑'];
const JUNK_EMOJI = ['🍔','🍟','🌭','🍕','🍩','🍪','🍰','🧋','🥤','🍗','🍖','🍫','🥓','🍿','🧈','🧂'];

let alive=false, use3D=false;
let R=null,S=null,C=null,THREE=null;
let targets=[], shards=[];
let spawnT=0, rate=700, life=1600;
let hostDOM=null;
let firstSpawned=false;

// ---- glue ----
function addScore(d,p){ try{ if(window.__HHA_modeHooks && window.__HHA_modeHooks.addScore) return window.__HHA_modeHooks.addScore(d,!!p);}catch(e){} try{ if(window.addScore) return window.addScore(d,!!p);}catch(e){} }
function badHit(){ try{ if(window.__HHA_modeHooks && window.__HHA_modeHooks.badHit) return window.__HHA_modeHooks.badHit(); }catch(e){} try{ if(window.badHit) return window.badHit(); }catch(e){} }

function rng(a,b){ return Math.floor(a + Math.random()*(b-a+1)); }
function rand(a,b){ return a + Math.random()*(b-a); }

// ---- 3D ----
function makeTarget3D(isGood){
  const col = isGood ? 0x31d67b : 0xe24d4d;
  const geo = isGood ? new THREE.IcosahedronGeometry(0.45, 1) : new THREE.OctahedronGeometry(0.48, 0);
  const mat = new THREE.MeshStandardMaterial({ color: col, roughness:0.35, metalness:0.1, emissive:0x000000 });
  const m = new THREE.Mesh(geo, mat);
  // spawn ในเฟรมกล้องแน่ ๆ
  const spanX = 4.6, spanY = 2.7;
  m.position.set(rand(-spanX,spanX), rand(-spanY,spanY), rand(-0.4, 0.4));
  m.rotation.set(rand(0,Math.PI), rand(0,Math.PI), rand(0,Math.PI));
  m.userData = { good:isGood?1:0, born:performance.now(), spin:{x:rand(-1.2,1.2),y:rand(-1.5,1.5),z:rand(-0.6,0.6)} };
  S.add(m); targets.push(m);
  firstSpawned = true;
}

function shatterAt(pos, color){
  for(let i=0;i<18;i++){
    const g = new THREE.TetrahedronGeometry(rand(0.06,0.12), 0);
    const m = new THREE.MeshStandardMaterial({ color: color, roughness:0.6, metalness:0.0, transparent:true, opacity:1.0 });
    const p = new THREE.Mesh(g,m);
    p.position.copy(pos);
    p.userData = { vel:new THREE.Vector3(rand(-2.2,2.2), rand(-2.2,2.2), rand(-2.0,2.0)),
                   rot:new THREE.Vector3(rand(-3,3), rand(-3,3), rand(-3,3)), life:0.8 };
    S.add(p); shards.push(p);
  }
  try{
    const gl = document.getElementById('gameLayer');
    gl.style.transition='transform 60ms ease';
    gl.style.transform='translate3d(2px,-2px,0)'; setTimeout(()=>{ gl.style.transform='translate3d(0,0,0)'; }, 80);
  }catch(_){}
}

function update3D(dt){
  const now = performance.now();
  for(let i=targets.length-1;i>=0;i--){
    const t = targets[i];
    t.rotation.x += t.userData.spin.x * (dt/1000);
    t.rotation.y += t.userData.spin.y * (dt/1000);
    t.rotation.z += t.userData.spin.z * (dt/1000);
    if(now - t.userData.born > life){ S.remove(t); targets.splice(i,1); }
  }
  for(let i=shards.length-1;i>=0;i--){
    const s = shards[i];
    s.userData.life -= dt/1000;
    s.position.addScaledVector(s.userData.vel, dt/1000);
    s.rotation.x += s.userData.rot.x * (dt/1000);
    s.rotation.y += s.userData.rot.y * (dt/1000);
    s.rotation.z += s.userData.rot.z * (dt/1000);
    s.userData.vel.y -= 4.8 * (dt/1000);
    s.material.opacity = Math.max(0, s.userData.life / 0.8);
    if(s.userData.life <= 0){ S.remove(s); shards.splice(i,1); }
  }
}

function pointerHit(ctx){
  if(!use3D) return false;
  ctx.raycaster.setFromCamera(ctx.pointer, C);
  const hits = ctx.raycaster.intersectObjects(targets, true);
  if(hits && hits.length){
    const obj = hits[0].object;
    const isGood = obj.userData.good === 1;
    S.remove(obj); const idx = targets.indexOf(obj); if(idx>=0) targets.splice(idx,1);
    shatterAt(hits[0].point, isGood ? 0x31d67b : 0xe24d4d);
    if(isGood){ const perfect = Math.random()<0.22; addScore(perfect?200:100, perfect); } else { badHit(); }
    return true;
  }
  return false;
}

// ---- DOM fallback ----
function makeDOM(isGood){
  const d = document.createElement('button');
  d.className='spawn-emoji';
  d.textContent = isGood ? GOOD_EMOJI[rng(0,GOOD_EMOJI.length-1)] : JUNK_EMOJI[rng(0,JUNK_EMOJI.length-1)];
  d.style.position='absolute'; d.style.border='0'; d.style.background='transparent';
  d.style.fontSize='38px'; d.style.filter='drop-shadow(0 3px 6px rgba(0,0,0,.45))';
  const W = hostDOM.clientWidth||640, H = hostDOM.clientHeight||360, pad=24;
  d.style.left = rng(pad, Math.max(pad, W-64))+'px';
  d.style.top  = rng(pad, Math.max(pad, H-64))+'px';
  const lifeMs = rng(life-250, life+250); let gone=false;
  const to = setTimeout(()=>{ if(!gone) leave(); }, lifeMs);
  function leave(){ gone=true; d.style.transition='transform 160ms ease, opacity 160ms ease'; d.style.transform='scale(.6) translateY(10px)'; d.style.opacity='0'; setTimeout(()=>d.remove(),170); }
  d.addEventListener('click', function(){
    if(!alive) return; clearTimeout(to);
    d.style.transition='transform 120ms ease, opacity 120ms ease'; d.style.transform='scale(1.25)'; setTimeout(()=>{ d.style.opacity='0'; },90);
    setTimeout(()=>d.remove(),130);
    if(isGood){ const perfect=Math.random()<0.22; addScore(perfect?200:100, perfect); } else { badHit(); }
  }, false);
  hostDOM.appendChild(d);
  firstSpawned = true;
}

// ---- Public API ----
export function help(lang){
  return (lang==='en') ? 'Hit 3D healthy targets (shatter). Avoid junk!'
                       : 'ตีเป้า 3D แตกกระจาย หลีกเลี่ยงขยะ!';
}

export function start(cfg){
  alive = true; spawnT = 0; firstSpawned=false;
  const d = cfg && cfg.difficulty ? String(cfg.difficulty) : 'Normal';
  if(d === 'Easy'){ rate=820; life=1900; } else if(d==='Hard'){ rate=560; life=1400; } else { rate=700; life=1600; }

  use3D = !!(cfg && cfg.three && cfg.three.ready);
  if(use3D){
    THREE = cfg.three.THREE; R = cfg.three.renderer; S = cfg.three.scene; C = cfg.three.camera;
    targets.length=0; shards.length=0;
  }else{
    hostDOM = document.getElementById('spawnHost');
    if(!hostDOM){
      const gl = document.getElementById('gameLayer');
      hostDOM = document.createElement('div'); hostDOM.id='spawnHost'; hostDOM.style.position='absolute'; hostDOM.style.inset='0'; hostDOM.style.zIndex='8';
      (gl||document.body).appendChild(hostDOM);
    }else{
      hostDOM.style.zIndex='8';
    }
  }
  try{ document.getElementById('hudWrap').style.display='block'; }catch(_){}

  // ---- Guaranteed first spawn ----
  setTimeout(()=>{ if(!alive) return; if(use3D) makeTarget3D(true); else makeDOM(true); }, 150);

  // ---- Anti-silent: ถ้า 1.2s แล้วยังว่าง → ระเบิด 3 ลูกทันที
  setTimeout(()=>{
    if(!alive || firstSpawned) return;
    for(let i=0;i<3;i++){ if(use3D) makeTarget3D(Math.random()<0.7); else makeDOM(Math.random()<0.7); }
  }, 1200);
}

export function pause(){ alive = false; }
export function resume(){ alive = true; }
export function stop(){
  alive=false;
  if(use3D && S){
    for(let i=targets.length-1;i>=0;i--){ S.remove(targets[i]); } targets.length=0;
    for(let i=shards.length-1;i>=0;i--){ S.remove(shards[i]); } shards.length=0;
  }
  if(hostDOM){ hostDOM.querySelectorAll('.spawn-emoji').forEach(n=>n.remove()); }
}

// dt = milliseconds
export function update(dt){
  if(!alive) return;
  spawnT += dt;
  if(spawnT >= rate){
    spawnT = Math.max(0, spawnT - rate);
    const count = (Math.random()<0.15)? 2 : 1;
    for(let i=0;i<count;i++){
      const isGood = Math.random()<0.7;
      if(use3D) makeTarget3D(isGood); else makeDOM(isGood);
    }
  }
  if(use3D) update3D(dt);
}

// คลิกในแคนวาส 3D
export function onPointer(ctx){ if(!alive || !use3D) return; pointerHit(ctx); }
