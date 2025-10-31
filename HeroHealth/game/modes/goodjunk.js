// === goodjunk.js — 3D Emoji Shatter (2025-10-31 G6) ===
// - เป้าเป็น "อีโมจิอาหาร" แบบ 3D (Sprite) หมุนเอียงเล็กน้อย
// - คลิกแล้ว "แตกกระจาย" เป็นชิ้น (shards) สีอิงจากอีโมจิ
// - ให้คะแนน/คอมโบ ผ่าน __HHA_modeHooks (fallback อัปเดต DOM ได้)
// - การันตีสปอว์นทันที + anti-silent ภายใน 1.2s
// - ถ้า 3D ใช้ไม่ได้ → fallback DOM emoji บน #spawnHost

export const name = 'goodjunk';

const GOOD_EMOJI = ['🥦','🥕','🍎','🍌','🥗','🐟','🥜','🍚','🍞','🥛','🍇','🍓','🍊','🍅','🍆','🥬','🥝','🍍','🍐','🍑'];
const JUNK_EMOJI = ['🍔','🍟','🌭','🍕','🍩','🍪','🍰','🧋','🥤','🍗','🍖','🍫','🥓','🍿','🧈','🧂'];

let alive = false;
let use3D = false;

// Three.js context
let THREE=null, R=null, S=null, C=null; // (renderer, scene, camera)
let root = null;         // THREE.Group สำหรับโหมดนี้
let targets = [];        // Sprite เป้าที่ยิงได้
let shards  = [];        // ชิ้นแตกกระจาย

// DOM fallback
let hostDOM = null;

// timing
let spawnT = 0, rate = 700, life = 1600;
let firstSpawned = false;

// ---------- glue to main (score/combo) ----------
function addScore(delta, perfect){
  try{
    if (window.__HHA_modeHooks && typeof window.__HHA_modeHooks.addScore === 'function'){
      window.__HHA_modeHooks.addScore(delta, !!perfect); return;
    }
  }catch(_){}
  // DOM fallback update
  try{
    const s=document.getElementById('score'), c=document.getElementById('combo');
    if(s){ s.textContent = String((parseInt(s.textContent||'0',10)||0) + delta); }
    if(c){
      const cur = parseInt(String(c.textContent||'x0').replace('x',''),10)||0;
      c.textContent = 'x' + String(cur+1);
    }
  }catch(_){}
}
function badHit(){
  try{
    if (window.__HHA_modeHooks && typeof window.__HHA_modeHooks.badHit === 'function'){
      window.__HHA_modeHooks.badHit(); return;
    }
  }catch(_){}
  try{ const c=document.getElementById('combo'); if(c) c.textContent='x0'; }catch(_){}
}

// ---------- utils ----------
function rng(a,b){ return Math.floor(a + Math.random()*(b-a+1)); }
function rand(a,b){ return a + Math.random()*(b-a); }
function pickEmoji(isGood){ return (isGood?GOOD_EMOJI:JUNK_EMOJI)[rng(0, (isGood?GOOD_EMOJI:JUNK_EMOJI).length-1)]; }

// ---------- CanvasTexture from emoji ----------
function makeEmojiTexture(THREE, emoji, size=256){
  const c=document.createElement('canvas'); c.width=c.height=size;
  const g=c.getContext('2d');
  g.clearRect(0,0,size,size);
  // background transparent + soft shadow
  g.textAlign='center'; g.textBaseline='middle';
  g.shadowColor='rgba(0,0,0,0.35)'; g.shadowBlur=size*0.05; g.shadowOffsetY=size*0.02;
  g.font = `${Math.floor(size*0.74)}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",system-ui,sans-serif`;
  g.fillText(emoji, size/2, size/2);
  // quick average color (center box)
  const box = g.getImageData(size*0.4, size*0.4, size*0.2, size*0.2).data;
  let r=0,gc=0,b=0,count=0;
  for(let i=0;i<box.length;i+=4){ r+=box[i]; gc+=box[i+1]; b+=box[i+2]; count++; }
  const avg = (count>0)? { r: (r/count)|0, g: (gc/count)|0, b: (b/count)|0 } : { r:255,g:255,b:255 };
  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 4; tex.needsUpdate = true;
  return { texture: tex, avgColor: (avg.r<<16) | (avg.g<<8) | (avg.b) };
}

// ---------- 3D target (Sprite) ----------
function makeTarget3D(isGood){
  const emoji = pickEmoji(isGood);
  const { texture, avgColor } = makeEmojiTexture(THREE, emoji, 256);
  const mat = new THREE.SpriteMaterial({ map: texture, transparent:true, depthWrite:false });
  const spr = new THREE.Sprite(mat);
  const scale = 1.15; // ขนาดเป้า
  spr.scale.set(scale, scale, 1);

  // spawn ภายในกล้องแน่ ๆ
  const spanX = 4.6, spanY = 2.7;
  spr.position.set(rand(-spanX,spanX), rand(-spanY,spanY), rand(-0.4,0.6));
  spr.userData = {
    good: isGood?1:0,
    born: performance.now(),
    spin: { x: rand(-0.7,0.7), y: rand(-0.9,0.9), z: rand(-0.5,0.5) },
    color: avgColor
  };

  // เอฟเฟกต์หมุน (ใช้ rotation ใน update)
  // Sprite จะหันหา camera เสมอ แต่เราจะ "โยกเอียง" ด้วย quaternion บางส่วน
  // (hack) เพิ่ม child Object3D มารับหมุน
  const holder = new THREE.Object3D();
  holder.add(spr);
  holder.position.copy(spr.position);
  spr.position.set(0,0,0);
  holder.userData = spr.userData;
  root.add(holder);
  targets.push(holder);
  firstSpawned = true;
}

// ---------- Shatter ----------
function shatter(point, color){
  // color (0xRRGGBB) → THREE.Color
  const col = new THREE.Color(color);
  for(let i=0;i<22;i++){
    const g = new THREE.TetrahedronGeometry(rand(0.06,0.12), 0);
    const m = new THREE.MeshStandardMaterial({ color: col, roughness:0.55, metalness:0.08, transparent:true, opacity:1.0 });
    const p = new THREE.Mesh(g,m);
    p.position.copy(point);
    p.userData = { vel:new THREE.Vector3(rand(-2.2,2.2), rand(-2.2,2.2), rand(-2.0,2.0)),
                   rot:new THREE.Vector3(rand(-3,3), rand(-3,3), rand(-3,3)),
                   life:0.85 };
    root.add(p); shards.push(p);
  }
  // screen shake
  try{
    const gl = document.getElementById('gameLayer');
    gl.style.transition='transform 60ms ease';
    gl.style.transform='translate3d(2px,-2px,0)';
    setTimeout(()=>{ gl.style.transform='translate3d(0,0,0)'; }, 80);
  }catch(_){}
}

// ---------- update (3D) ----------
function update3D(dt){
  const now = performance.now();
  for(let i=targets.length-1;i>=0;i--){
    const h = targets[i];
    const s = h.userData.spin;
    h.rotation.x += s.x*(dt/1000);
    h.rotation.y += s.y*(dt/1000);
    h.rotation.z += s.z*(dt/1000);
    if(now - h.userData.born > life){
      root.remove(h); targets.splice(i,1);
    }
  }
  for(let i=shards.length-1;i>=0;i--){
    const p = shards[i];
    p.userData.life -= dt/1000;
    p.position.addScaledVector(p.userData.vel, dt/1000);
    p.rotation.x += p.userData.rot.x*(dt/1000);
    p.rotation.y += p.userData.rot.y*(dt/1000);
    p.rotation.z += p.userData.rot.z*(dt/1000);
    p.userData.vel.y -= 4.8*(dt/1000);
    p.material.opacity = Math.max(0, p.userData.life/0.85);
    if(p.userData.life <= 0){ root.remove(p); shards.splice(i,1); }
  }
}

// ---------- pointer (3D hit) ----------
export function onPointer(ctx){
  if(!alive || !use3D) return;
  // ใช้ raycaster กับ "holder" (Object3D) → intersectObjects ต้องรับ children=true
  ctx.ray.setFromCamera(ctx.pointer, C);
  const hits = ctx.ray.intersectObjects(root.children, true);
  if(hits && hits.length){
    // หา holder บนสุด
    let obj = hits[0].object;
    while(obj && obj.parent && obj.parent !== root){ obj = obj.parent; }
    if(!obj || !obj.userData) return;

    const good = obj.userData.good === 1;
    const pt = hits[0].point.clone();
    const color = obj.userData.color || (good?0x31d67b:0xe24d4d);

    root.remove(obj);
    const idx = targets.indexOf(obj); if(idx>=0) targets.splice(idx,1);

    shatter(pt, color);
    if(good){ const perfect = Math.random()<0.22; addScore(perfect?200:100, perfect); }
    else { badHit(); }
  }
}

// ---------- DOM fallback ----------
function makeDOM(isGood){
  const d = document.createElement('button');
  d.className = 'spawn-emoji';
  d.textContent = pickEmoji(isGood);
  d.style.position='absolute'; d.style.border='0'; d.style.background='transparent';
  d.style.fontSize='42px'; d.style.filter='drop-shadow(0 3px 6px rgba(0,0,0,.45))'; d.style.cursor='pointer';
  const W = hostDOM.clientWidth||640, H=hostDOM.clientHeight||360, pad=24;
  d.style.left = rng(pad, Math.max(pad, W-64))+'px';
  d.style.top  = rng(pad, Math.max(pad, H-64))+'px';

  const lifeMs = rng(life-250, life+250); let gone=false;
  const to = setTimeout(()=>{ if(!gone) leave(); }, lifeMs);
  function leave(){ gone=true; d.style.transition='transform 160ms ease, opacity 160ms ease'; d.style.transform='scale(.6) translateY(10px)'; d.style.opacity='0'; setTimeout(()=>d.remove(),170); }

  d.addEventListener('click', function(){
    if(!alive) return; clearTimeout(to);
    d.style.transition='transform 120ms ease, opacity 120ms ease'; d.style.transform='scale(1.25)';
    setTimeout(()=>{ d.style.opacity='0'; }, 90);
    setTimeout(()=>d.remove(), 130);
    if(isGood){ const perfect=Math.random()<0.22; addScore(perfect?200:100, perfect); } else { badHit(); }
  }, false);

  hostDOM.appendChild(d);
  firstSpawned = true;
}

// ---------- Public API ----------
export function help(lang){
  return (lang==='en')
    ? 'Tap the 3D food emoji to score (they shatter!). Avoid junk ones.'
    : 'แตะอีโมจิอาหารแบบ 3D เพื่อเก็บคะแนน (แตกกระจาย!) หลีกเลี่ยงของขยะ';
}

export function start(cfg){
  alive = true; spawnT = 0; firstSpawned = false;

  // difficulty
  const d = cfg && cfg.difficulty ? String(cfg.difficulty) : 'Normal';
  if(d==='Easy'){ rate=820; life=1900; } else if(d==='Hard'){ rate=560; life=1400; } else { rate=700; life=1600; }

  use3D = !!(cfg && cfg.three && cfg.three.ready);

  if(use3D){
    THREE = cfg.three.THREE; R = cfg.three.renderer; S = cfg.three.scene; C = cfg.three.cam;
    // เคลียร์ root เก่า (ถ้ามี)
    if(root){ S.remove(root); }
    root = new THREE.Group(); root.name='GJ-Root';
    S.add(root);
    targets.length=0; shards.length=0;
  }else{
    hostDOM = document.getElementById('spawnHost');
    if(!hostDOM){
      const gl = document.getElementById('gameLayer');
      hostDOM = document.createElement('div'); hostDOM.id='spawnHost';
      hostDOM.style.position='absolute'; hostDOM.style.inset='0'; hostDOM.style.zIndex='8';
      (gl||document.body).appendChild(hostDOM);
    }else{
      hostDOM.style.zIndex='8';
    }
  }

  // show HUD
  try{ const hud = document.getElementById('hudWrap'); if(hud) hud.style.display='block'; }catch(_){}

  // guaranteed first spawn
  setTimeout(()=>{ if(!alive) return; if(use3D) makeTarget3D(true); else makeDOM(true); }, 150);

  // anti-silent burst
  setTimeout(()=>{
    if(!alive || firstSpawned) return;
    for(let i=0;i<3;i++){ (use3D?makeTarget3D:makeDOM)(Math.random()<0.7); }
  }, 1200);
}

export function pause(){ alive = false; }
export function resume(){ alive = true; }

export function stop(){
  alive = false;
  if(use3D && S){
    if(root){ S.remove(root); root=null; }
    targets.length=0; shards.length=0;
  }
  if(hostDOM){
    try{ hostDOM.querySelectorAll('.spawn-emoji').forEach(n=>n.remove()); }catch(_){}
  }
}

export function update(dt){
  if(!alive) return;

  // spawn logic
  spawnT += dt;
  if(spawnT >= rate){
    spawnT = Math.max(0, spawnT - rate);
    const count = (Math.random()<0.15)? 2 : 1;
    for(let i=0;i<count;i++){
      const isGood = Math.random()<0.7;
      (use3D?makeTarget3D:makeDOM)(isGood);
    }
  }

  // animate
  if(use3D) update3D(dt);
}
