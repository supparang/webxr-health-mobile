// === goodjunk.js — 3D Emoji Shatter (G11.1: plane-lock + pixel-safe in-frame) ===
export const name = 'goodjunk';

const GOOD = ['🥦','🥕','🍎','🍌','🥗','🐟','🥜','🍚','🍞','🥛','🍇','🍓','🍊','🍅','🍆','🥬','🥝','🍍','🍐','🍑'];
const JUNK = ['🍔','🍟','🌭','🍕','🍩','🍪','🍰','🧋','🥤','🍗','🍖','🍫','🥓','🍿','🧈','🧂'];

let alive=false, use3D=false;
let THREE=null, R=null, S=null, C=null, utils=null;
let root=null, hostDOM=null;
let targets=[], shards=[];
let spawnT=0, rate=700, life=1600, firstSpawned=false;
let DIFF='Normal';

// ---------- glue ----------
function addScore(delta, perfect){
  try{ if(window.__HHA_modeHooks?.addScore){ window.__HHA_modeHooks.addScore(delta, !!perfect); return; } }catch(_){}
  try{
    const s=document.getElementById('score'), c=document.getElementById('combo');
    if(s) s.textContent = String((parseInt(s.textContent||'0',10)||0) + delta);
    if(c){ const cur=parseInt(String(c.textContent||'x0').replace('x',''),10)||0; c.textContent='x'+(cur+1); }
  }catch(_){}
}
function badHit(){
  try{ if(window.__HHA_modeHooks?.badHit){ window.__HHA_modeHooks.badHit(); return; } }catch(_){}
  try{ const c=document.getElementById('combo'); if(c) c.textContent='x0'; }catch(_){}
}

// ---------- utils ----------
const rng=(a,b)=>Math.floor(a + Math.random()*(b-a+1));
const rand=(a,b)=>a + Math.random()*(b-a);
const pick=(arr)=>arr[rng(0,arr.length-1)];

// emoji → CanvasTexture
function makeEmojiTexture(THREE, emoji, size=256){
  const c=document.createElement('canvas'); c.width=c.height=size;
  const g=c.getContext('2d');
  g.clearRect(0,0,size,size);
  g.textAlign='center'; g.textBaseline='middle';
  g.shadowColor='rgba(0,0,0,0.35)'; g.shadowBlur=size*0.06; g.shadowOffsetY=size*0.02;
  g.font=`${Math.floor(size*0.74)}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",system-ui,sans-serif`;
  g.fillText(emoji, size/2, size/2);
  const box=g.getImageData(size*0.4,size*0.4,size*0.2,size*0.2).data;
  let r=0,gr=0,b=0,n=0; for(let i=0;i<box.length;i+=4){ r+=box[i]; gr+=box[i+1]; b+=box[i+2]; n++; }
  const avg=(n?{r:(r/n)|0,g:(gr/n)|0,b:(b/n)|0}:{r:255,g:255,b:255});
  const tex=new THREE.CanvasTexture(c); tex.anisotropy=4; tex.needsUpdate=true;
  return { texture:tex, avgColor:(avg.r<<16)|(avg.g<<8)|avg.b };
}

// ---------- คำนวณขนาดสไปรท์บนจอ (px) ----------
function spriteScreenSizePx(camera, canvas, scaleWorld){
  const rect = canvas.getBoundingClientRect ? canvas.getBoundingClientRect() : { width: canvas.width, height: canvas.height };
  const hPx = rect.height || canvas.height;
  const wPx = rect.width  || canvas.width;
  const dist = Math.max(0.0001, camera.position.z - 0.0);
  const worldH = 2 * dist * Math.tan((camera.fov * Math.PI/180)/2);
  const worldW = worldH * camera.aspect;
  const pxPerWorldY = hPx / worldH;
  const pxPerWorldX = wPx / worldW;
  return { w: scaleWorld * pxPerWorldX, h: scaleWorld * pxPerWorldY, canvasW:wPx, canvasH:hPx };
}

// ---------- clamp จุดกึ่งกลางให้ทั้งตัวอยู่ในกรอบ (คิดเป็น px) ----------
function clampCenterToCanvasPx(THREE, camera, canvas, holder, spriteScaleWorld, padPx=18){
  const center = holder.position.clone().project(camera);
  const rect = canvas.getBoundingClientRect ? canvas.getBoundingClientRect() : { width: canvas.width, height: canvas.height };
  const px = { x:(center.x*0.5+0.5)*rect.width, y:(-center.y*0.5+0.5)*rect.height };
  const spr = spriteScreenSizePx(camera, canvas, spriteScaleWorld);
  const halfW = spr.w*0.5, halfH = spr.h*0.5;
  const minX = padPx + halfW,           maxX = spr.canvasW - (padPx + halfW);
  const minY = padPx + halfH,           maxY = spr.canvasH - (padPx + halfH);
  const clampedPx = { x: Math.max(minX, Math.min(maxX, px.x)), y: Math.max(minY, Math.min(maxY, px.y)) };
  if (Math.abs(clampedPx.x - px.x) > 0.5 || Math.abs(clampedPx.y - px.y) > 0.5) {
    const ndc = { x:(clampedPx.x/spr.canvasW)*2 - 1, y:-((clampedPx.y/spr.canvasH)*2 - 1) };
    const v = new THREE.Vector3(ndc.x, ndc.y, 0).unproject(camera);
    const dir = v.sub(camera.position).normalize();
    const targetZ = holder.position.z;
    const lambda = (targetZ - camera.position.z) / dir.z;
    holder.position.copy( camera.position.clone().add(dir.multiplyScalar(lambda)) );
  }
}

// ---- ขนาดตามความยาก + ปรับตามความสูงแคนวาส ----
function diffScale(canvas){
  const byDiff = (DIFF==='Easy') ? 0.85 : (DIFF==='Hard' ? 0.65 : 0.75);
  const h = canvas?.height || canvas?.getBoundingClientRect?.().height || 720;
  const screenFactor = Math.max(0.6, Math.min(1.0, h/720));
  return byDiff * screenFactor * rand(0.95, 1.05);
}

// ---------- 3D target ----------
function makeTarget3D(isGood){
  const emoji = pick(isGood?GOOD:JUNK);
  const { texture, avgColor } = makeEmojiTexture(THREE, emoji, 256);

  const mat = new THREE.SpriteMaterial({ map:texture, transparent:true, depthWrite:false, depthTest:false });
  const spr = new THREE.Sprite(mat);

  const scaleWorld = diffScale(R?.domElement || document.getElementById('c'));
  spr.scale.set(scaleWorld, scaleWorld, 1);
  spr.renderOrder = 10;

  const base = utils?.randInView?.(rand(-0.18, 0.5)) || {x:0,y:0,z:0};
  const BIAS_X = +0.18, SPAN_X = 0.50, SPAN_Y = 0.78;

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
    good:isGood?1:0,
    color:avgColor,
    spin:{x:rand(-0.7,0.7), y:rand(-0.9,0.9), z:rand(-0.5,0.5)},
    born:performance.now(),
    scaleWorld
  };
  holder.add(spr);

  const canvas = R?.domElement || document.getElementById('c');
  clampCenterToCanvasPx(THREE, C, canvas, holder, scaleWorld, 18);

  root.add(holder);
  targets.push(holder);
  firstSpawned = true;
}

// ---------- ชิ้นแตก ----------
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

// ---------- pointer ----------
export function onPointer(ctx){
  if(!alive || !use3D) return;
  ctx.ray.setFromCamera(ctx.pointer, C);
  const hits = ctx.ray.intersectObjects(root.children, true);
  if(!hits?.length) return;

  let obj = hits[0].object;
  while(obj && obj.parent && obj.parent !== root){ obj = obj.parent; }
  if(!obj?.userData) return;

  const good = obj.userData.good === 1;
  const pt   = hits[0].point.clone();
  const col  = obj.userData.color || (good?0x31d67b:0xe24d4d);

  root.remove(obj); const i=targets.indexOf(obj); if(i>=0) targets.splice(i,1);
  shatter(pt, col);
  if(good){ const perfect=Math.random()<0.22; addScore(perfect?200:100, perfect); } else { badHit(); }
}

// ---------- DOM fallback ----------
function makeDOM(isGood){
  const d=document.createElement('button');
  d.className='spawn-emoji';
  d.textContent = pick(isGood?GOOD:JUNK);
  const basePx = (DIFF==='Easy')? 44 : (DIFF==='Hard'? 34 : 38);
  d.style.cssText = `position:absolute;border:0;background:transparent;font-size:${basePx}px;filter:drop-shadow(0 3px 6px rgba(0,0,0,.45));cursor:pointer`;
  const W=hostDOM.clientWidth||640, H=hostDOM.clientHeight||360, pad=18;
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
  DIFF = (cfg?.difficulty ? String(cfg.difficulty) : 'Normal');

  // difficulty speed/life
  if(DIFF==='Easy'){ rate=820; life=1900; }
  else if(DIFF==='Hard'){ rate=560; life=1400; }
  else { rate=700; life=1600; }

  use3D = !!(cfg?.three?.ready);
  if(use3D){
    // IMPORTANT: กวาด DOM emoji ทิ้ง เพื่อไม่ให้บัง canvas (ตาม plane-lock)
    try{ const host=document.getElementById('spawnHost'); host && host.querySelectorAll('.spawn-emoji').forEach(n=>n.remove()); }catch(_){}
    THREE = cfg.three.THREE; R=cfg.three.renderer; S=cfg.three.scene; C=cfg.three.cam||cfg.three.camera;
    utils = cfg.three.utils || null;
    if(root) S.remove(root);
    root = new THREE.Group(); root.name='GJ-Root';
    S.add(root); targets.length=0; shards.length=0;
  }else{
    hostDOM = document.getElementById('spawnHost') || (()=>{
      const gl=document.getElementById('gameLayer');
      const h=document.createElement('div'); h.id='spawnHost'; h.style.cssText='position:absolute;inset:0';
      (gl||document.body).appendChild(h); return h;
    })();
  }

  try{ const hud=document.getElementById('hudWrap'); if(hud) hud.style.display='block'; }catch(_){}

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
