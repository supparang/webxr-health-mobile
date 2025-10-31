// === goodjunk.js — 3D Emoji Shatter (G10.1 in-frame, on-top, PC/Mobile/VR) ===
export const name = 'goodjunk';

const GOOD = ['🥦','🥕','🍎','🍌','🥗','🐟','🥜','🍚','🍞','🥛','🍇','🍓','🍊','🍅','🍆','🥬','🥝','🍍','🍐','🍑'];
const JUNK = ['🍔','🍟','🌭','🍕','🍩','🍪','🍰','🧋','🥤','🍗','🍖','🍫','🥓','🍿','🧈','🧂'];

let alive=false, use3D=false;
let THREE=null, R=null, S=null, C=null, utils=null; // three ctx
let root=null;                // Group ของโหมดนี้
let targets=[], shards=[];
let hostDOM=null;             // fallback DOM
let spawnT=0, rate=700, life=1600;
let firstSpawned=false;

// ---------- glue to main ----------
function addScore(delta, perfect){
  try{ if(window.__HHA_modeHooks?.addScore) return window.__HHA_modeHooks.addScore(delta, !!perfect); }catch(_){}
  try{
    const s=document.getElementById('score'), c=document.getElementById('combo');
    if(s) s.textContent = String((parseInt(s.textContent||'0',10)||0) + delta);
    if(c){ const cur=parseInt(String(c.textContent||'x0').replace('x',''),10)||0; c.textContent='x'+(cur+1); }
  }catch(_){}
}
function badHit(){
  try{ if(window.__HHA_modeHooks?.badHit) return window.__HHA_modeHooks.badHit(); }catch(_){}
  try{ const c=document.getElementById('combo'); if(c) c.textContent='x0'; }catch(_){}
}

// ---------- utils ----------
const rng=(a,b)=>Math.floor(a + Math.random()*(b-a+1));
const rand=(a,b)=>a + Math.random()*(b-a);
const pick=(arr)=>arr[rng(0,arr.length-1)];

// ---------- CanvasTexture จาก emoji ----------
function makeEmojiTexture(THREE, emoji, size=256){
  const c=document.createElement('canvas'); c.width=c.height=size;
  const g=c.getContext('2d');
  g.clearRect(0,0,size,size);
  g.textAlign='center'; g.textBaseline='middle';
  g.shadowColor='rgba(0,0,0,0.35)'; g.shadowBlur=size*0.06; g.shadowOffsetY=size*0.02;
  g.font=`${Math.floor(size*0.74)}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",system-ui,sans-serif`;
  g.fillText(emoji, size/2, size/2);

  // average color (กลางภาพ) เพื่อสีของ shards
  const box=g.getImageData(size*0.4,size*0.4,size*0.2,size*0.2).data;
  let r=0,gr=0,b=0,n=0; for(let i=0;i<box.length;i+=4){ r+=box[i]; gr+=box[i+1]; b+=box[i+2]; n++; }
  const avg=(n?{r:(r/n)|0,g:(gr/n)|0,b:(b/n)|0}:{r:255,g:255,b:255});
  const tex=new THREE.CanvasTexture(c); tex.anisotropy=4; tex.needsUpdate=true;
  return { texture:tex, avgColor:(avg.r<<16)|(avg.g<<8)|avg.b };
}

// ---- ช่วยตรวจ/ดันให้อยู่ในกรอบจอ (NDC clamp) ----
function clampIntoView(THREE, camera, holder){
  const v = new THREE.Vector3().copy(holder.position).project(camera);
  // กล่องปลอดภัย (กึ่งกลางกรอบเล่น)
  const SAFE = { minX:-0.15, maxX:0.75, minY:-0.65, maxY:0.65 };
  let nudged = false;
  if (v.x < SAFE.minX) { v.x = SAFE.minX; nudged = true; }
  if (v.x > SAFE.maxX) { v.x = SAFE.maxX; nudged = true; }
  if (v.y < SAFE.minY) { v.y = SAFE.minY; nudged = true; }
  if (v.y > SAFE.maxY) { v.y = SAFE.maxY; nudged = true; }
  if (nudged) holder.position.copy(v.unproject(camera));
}

// ---------- 3D target (Sprite) ----------
function makeTarget3D(isGood){
  const emoji = pick(isGood?GOOD:JUNK);
  const { texture, avgColor } = makeEmojiTexture(THREE, emoji, 256);

  const mat = new THREE.SpriteMaterial({
    map: texture, transparent:true,
    depthWrite:false, depthTest:false   // <— ไม่ให้ถูกบัง
  });
  const spr = new THREE.Sprite(mat);
  const scale = 1.15; spr.scale.set(scale, scale, 1);
  spr.renderOrder = 10;                 // <— ให้อยู่หน้าฉาก

  // --- สุ่ม "ในกรอบ" พร้อมอคติไปกลางจอ ---
  const base = utils?.randInView?.(rand(-0.2, 0.6)) || {x:0,y:0,z:0};

  // อคติไปกึ่งกลาง (ปรับได้): BIAS_X = ขยับไปขวา, SPAN_X/Y = แคบช่วงสุ่ม
  const BIAS_X = +0.22;
  const SPAN_X = 0.60;
  const SPAN_Y = 0.85;

  const dist = (C.position.z - base.z);
  const halfH = Math.tan((C.fov*Math.PI/180)/2) * dist;
  const halfW = halfH * C.aspect;

  const bx = THREE.MathUtils.clamp(base.x, -halfW, halfW);
  const by = THREE.MathUtils.clamp(base.y, -halfH, halfH);
  const cx = (bx * SPAN_X) + (halfW * BIAS_X);
  const cy = (by * SPAN_Y);

  const holder = new THREE.Object3D();
  holder.position.set(cx, cy, base.z);
  holder.userData = {
    good: isGood?1:0,
    color: avgColor,
    spin: { x: rand(-0.7,0.7), y: rand(-0.9,0.9), z: rand(-0.5,0.5) },
    born: performance.now()
  };
  holder.add(spr);

  // กันพลาด: clamp เข้า NDC กล่องปลอดภัย
  clampIntoView(THREE, C, holder);

  root.add(holder);
  targets.push(holder);
  firstSpawned = true;
}

function shatter(point, color){
  const col=new THREE.Color(color);
  for(let i=0;i<22;i++){
    const g=new THREE.TetrahedronGeometry(rand(0.06,0.12),0);
    const m=new THREE.MeshStandardMaterial({ color:col, roughness:0.55, metalness:0.08, transparent:true, opacity:1.0 });
    const p=new THREE.Mesh(g,m);
    p.position.copy(point);
    p.userData={ vel:new THREE.Vector3(rand(-2.2,2.2),rand(-2.2,2.2),rand(-2.0,2.0)),
                 rot:new THREE.Vector3(rand(-3,3),rand(-3,3),rand(-3,3)),
                 life:0.85 };
    root.add(p); shards.push(p);
  }
  // screen shake
  try{ const gl=document.getElementById('gameLayer');
       gl.style.transition='transform 60ms ease';
       gl.style.transform='translate3d(2px,-2px,0)';
       setTimeout(()=>{ gl.style.transform='translate3d(0,0,0)'; }, 80); }catch(_){}
}

function update3D(dt){
  const t=performance.now();
  for(let i=targets.length-1;i>=0;i--){
    const h=targets[i], s=h.userData.spin;
    h.rotation.x += s.x*(dt/1000);
    h.rotation.y += s.y*(dt/1000);
    h.rotation.z += s.z*(dt/1000);
    if(t - h.userData.born > life){ root.remove(h); targets.splice(i,1); }
  }
  for(let i=shards.length-1;i>=0;i--){
    const p=shards[i];
    p.userData.life -= dt/1000;
    p.position.addScaledVector(p.userData.vel, dt/1000);
    p.rotation.x += p.userData.rot.x*(dt/1000);
    p.rotation.y += p.userData.rot.y*(dt/1000);
    p.rotation.z += p.userData.rot.z*(dt/1000);
    p.userData.vel.y -= 4.8*(dt/1000);
    p.material.opacity = Math.max(0, p.userData.life/0.85);
    if(p.userData.life<=0){ root.remove(p); shards.splice(i,1); }
  }
}

// ---------- pointer (raycast) ----------
export function onPointer(ctx){
  if(!alive || !use3D) return;
  ctx.ray.setFromCamera(ctx.pointer, C);
  const hits = ctx.ray.intersectObjects(root.children, true);
  if(hits && hits.length){
    let obj = hits[0].object;
    while(obj && obj.parent && obj.parent !== root){ obj = obj.parent; }
    if(!obj || !obj.userData) return;

    const good = obj.userData.good === 1;
    const pt   = hits[0].point.clone();
    const col  = obj.userData.color || (good?0x31d67b:0xe24d4d);

    root.remove(obj); const i=targets.indexOf(obj); if(i>=0) targets.splice(i,1);
    shatter(pt, col);
    if(good){ const perfect=Math.random()<0.22; addScore(perfect?200:100, perfect); }
    else { badHit(); }
  }
}

// ---------- DOM fallback ----------
function makeDOM(isGood){
  const d=document.createElement('button');
  d.className='spawn-emoji';
  d.textContent = pick(isGood?GOOD:JUNK);
  d.style.position='absolute'; d.style.border='0'; d.style.background='transparent';
  d.style.fontSize='42px'; d.style.filter='drop-shadow(0 3px 6px rgba(0,0,0,.45))'; d.style.cursor='pointer';
  const W=hostDOM.clientWidth||640, H=hostDOM.clientHeight||360, pad=24;
  d.style.left = rng(pad, Math.max(pad, W-64))+'px';
  d.style.top  = rng(pad, Math.max(pad, H-64))+'px';

  const lifeMs=rng(life-250,life+250); let gone=false;
  const to=setTimeout(()=>{ if(!gone) leave(); }, lifeMs);
  function leave(){ gone=true; d.style.transition='transform 160ms ease, opacity 160ms ease';
    d.style.transform='scale(.6) translateY(10px)'; d.style.opacity='0'; setTimeout(()=>d.remove(),170); }
  d.addEventListener('click',()=>{
    if(!alive) return; clearTimeout(to);
    d.style.transition='transform 120ms ease, opacity 120ms ease'; d.style.transform='scale(1.25)';
    setTimeout(()=>{ d.style.opacity='0'; },90); setTimeout(()=>d.remove(),130);
    if(isGood){ const perfect=Math.random()<0.22; addScore(perfect?200:100, perfect); } else { badHit(); }
  },false);

  hostDOM.appendChild(d);
  firstSpawned=true;
}

// ---------- Public API ----------
export function help(lang){
  return (lang==='en')
    ? 'Hit the 3D food emoji (they shatter!). Avoid junk ones.'
    : 'ตีอีโมจิอาหาร 3D (แตกกระจาย!) หลีกเลี่ยงอาหารขยะ';
}

export function start(cfg){
  alive=true; spawnT=0; firstSpawned=false;

  // difficulty
  const d = cfg?.difficulty ? String(cfg.difficulty) : 'Normal';
  if(d==='Easy'){ rate=820; life=1900; } else if(d==='Hard'){ rate=560; life=1400; } else { rate=700; life=1600; }

  use3D = !!(cfg?.three?.ready);
  if(use3D){
    THREE = cfg.three.THREE; R = cfg.three.renderer; S = cfg.three.scene; C = cfg.three.cam || cfg.three.camera;
    utils  = cfg.three.utils || null;
    if(root) S.remove(root);
    root = new THREE.Group(); root.name='GJ-Root';
    S.add(root);
    targets.length=0; shards.length=0;
  }else{
    hostDOM = document.getElementById('spawnHost');
    if(!hostDOM){
      const gl=document.getElementById('gameLayer');
      hostDOM=document.createElement('div'); hostDOM.id='spawnHost';
      hostDOM.style.position='absolute'; hostDOM.style.inset='0';
      (gl||document.body).appendChild(hostDOM);
    }
  }

  // show HUD
  try{ const hud=document.getElementById('hudWrap'); if(hud) hud.style.display='block'; }catch(_){}

  // guaranteed first spawn + anti-silent
  setTimeout(()=>{ if(!alive) return; (use3D?makeTarget3D:makeDOM)(true); }, 150);
  setTimeout(()=>{ if(!alive || firstSpawned) return; for(let i=0;i<3;i++){ (use3D?makeTarget3D:makeDOM)(Math.random()<0.7); } }, 1200);
}

export function pause(){ alive=false; }
export function resume(){ alive=true; }

export function stop(){
  alive=false;
  if(use3D && S){ if(root){ S.remove(root); root=null; } targets.length=0; shards.length=0; }
  if(hostDOM){ try{ hostDOM.querySelectorAll('.spawn-emoji').forEach(n=>n.remove()); }catch(_){ } }
}

export function update(dt){
  if(!alive) return;
  spawnT += dt;
  if(spawnT >= rate){
    spawnT = Math.max(0, spawnT - rate);
    const count = (Math.random()<0.15)?2:1;
    for(let i=0;i<count;i++){ (use3D?makeTarget3D:makeDOM)(Math.random()<0.7); }
  }
  if(use3D) update3D(dt);
}
