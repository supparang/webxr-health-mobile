// === goodjunk.js — 3D Emoji Shatter (G14 + FX hooks) ===
export const name = 'goodjunk';

const GOOD=['🥦','🥕','🍎','🍌','🥗','🐟','🥜','🍚','🍞','🥛','🍇','🍓','🍊','🍅','🍆','🥬','🥝','🍍','🍐','🍑'];
const JUNK=['🍔','🍟','🌭','🍕','🍩','🍪','🍰','🧋','🥤','🍗','🍖','🍫','🥓','🍿','🧈','🧂'];

let alive=false, use3D=false, THREE=null, R=null, S=null, C=null, utils=null;
let root=null, hostDOM=null, targets=[], shards=[];
let DIFF='Normal', spawnT=0, rate=700, life=1600, firstSpawned=false;

// glue
function addScore(d,p){ try{ if(window.__HHA_modeHooks?.addScore){ window.__HHA_modeHooks.addScore(d,!!p); return; } }catch(_){}
  try{ const s=document.getElementById('score'), c=document.getElementById('combo');
       if(s){ const cur=(parseInt(s.textContent||'0',10)||0)+d; s.textContent=String(cur); }
       if(c){ const k=parseInt(String(c.textContent||'x0').replace('x',''),10)||0; c.textContent='x'+(k+1); } }catch(_){}
}
function badHit(){ try{ if(window.__HHA_modeHooks?.badHit){ window.__HHA_modeHooks.badHit(); return; } }catch(_){}
  try{ const c=document.getElementById('combo'); if(c) c.textContent='x0'; }catch(_){}
}
function popupFromPoint(pt, text, good=true){
  const v = pt.clone().project(C);
  try{ window.__HHA_showPopup && window.__HHA_showPopup(v.x, v.y, text, !!good); }catch(_){}
}

// utils
const rng=(a,b)=>Math.floor(a + Math.random()*(b-a+1));
const rand=(a,b)=>a + Math.random()*(b-a);
const pick=(arr)=>arr[rng(0,arr.length-1)];

function makeEmojiTexture(THREE, emoji, size=256){
  const c=document.createElement('canvas'); c.width=c.height=size;
  const g=c.getContext('2d');
  g.textAlign='center'; g.textBaseline='middle';
  g.clearRect(0,0,size,size);
  g.shadowColor='rgba(0,0,0,.35)'; g.shadowBlur=size*0.06; g.shadowOffsetY=size*0.02;
  g.font=`${Math.floor(size*0.74)}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",system-ui,sans-serif`;
  g.fillText(emoji, size/2, size/2);
  const box=g.getImageData(size*0.4,size*0.4,size*0.2,size*0.2).data;
  let r=0,gc=0,b=0,n=0; for(let i=0;i<box.length;i+=4){ r+=box[i]; gc+=box[i+1]; b+=box[i+2]; n++; }
  const avg=(n?{r:(r/n)|0,g:(gc/n)|0,b:(b/n)|0}:{r:255,g:255,b:255});
  const tex=new THREE.CanvasTexture(c); tex.anisotropy=4; tex.needsUpdate=true;
  return { texture:tex, avgColor:(avg.r<<16)|(avg.g<<8)|avg.b };
}

function diffScale(canvas){
  const byDiff = (DIFF==='Easy')? 0.85 : (DIFF==='Hard'? 0.65 : 0.75);
  const h = canvas?.height || canvas?.getBoundingClientRect?.().height || window.innerHeight || 720;
  const screenFactor = Math.max(0.6, Math.min(1.0, h/720));
  return byDiff * screenFactor * (0.95 + Math.random()*0.10);
}

// --- 3D target sprite (tag + under root) ---
function makeTarget3D(isGood){
  const emoji = pick(isGood?GOOD:JUNK);
  const { texture, avgColor } = makeEmojiTexture(THREE, emoji, 256);
  const mat = new THREE.SpriteMaterial({ map:texture, transparent:true, depthWrite:false, depthTest:false });
  const spr = new THREE.Sprite(mat);
  const scaleWorld = diffScale(R?.domElement || document.getElementById('c'));
  spr.scale.set(scaleWorld, scaleWorld, 1);
  spr.renderOrder = 10;

  const base = utils?.randInView?.(rand(-0.18,0.5)) || {x:0,y:0,z:0};
  const holder = new THREE.Object3D();
  holder.position.set(base.x, base.y, base.z);
  holder.userData = {
    tag:'target',
    good:isGood?1:0,
    color:avgColor,
    spin:{x:rand(-0.7,0.7), y:rand(-0.9,0.9), z:rand(-0.5,0.5)},
    born:performance.now(),
    scaleWorld
  };
  holder.add(spr);

  root.add(holder);
  targets.push(holder);
  firstSpawned=true;
}

function shatter(point, color){
  const col=new THREE.Color(color);
  for(let i=0;i<22;i++){
    const g=new THREE.TetrahedronGeometry(rand(0.06,0.12),0);
    const m=new THREE.MeshStandardMaterial({ color:col, roughness:0.55, metalness:0.08, transparent:true, opacity:1.0 });
    const p=new THREE.Mesh(g,m);
    p.position.copy(point);
    p.userData={ tag:'shard', vel:new THREE.Vector3(rand(-2.2,2.2),rand(-2.2,2.2),rand(-2.0,2.0)),
                 rot:new THREE.Vector3(rand(-3,3),rand(-3,3),rand(-3,3)), life:0.85 };
    root.add(p); shards.push(p);
  }
  try{ const gl=document.getElementById('gameLayer')||document.body;
       gl.style.transition='transform 60ms ease'; gl.style.transform='translate3d(2px,-2px,0)';
       setTimeout(()=>{ gl.style.transform='translate3d(0,0,0)' }, 80); }catch(_){}
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

// pointer — raycast เฉพาะ root (กันชนเศษ)
export function onPointer(ctx){
  if(!alive || !use3D) return;

  if(ctx?.ray?.params?.Sprite) ctx.ray.params.Sprite.threshold = 0.6;

  ctx.ray.setFromCamera(ctx.pointer, C);
  const hits = ctx.ray.intersectObjects(root.children, true);
  if(!hits?.length) return;

  let obj = hits[0].object;
  while(obj && obj.parent && obj !== root && obj.userData?.tag!=='target'){ obj = obj.parent; }
  if(!obj?.userData || obj.userData.tag!=='target') return;

  const good = obj.userData.good === 1;
  const pt   = hits[0].point.clone();
  const col  = obj.userData.color || (good?0x31d67b:0xe24d4d);

  root.remove(obj); const i=targets.indexOf(obj); if(i>=0) targets.splice(i,1);
  shatter(pt, col);

  if(good){
    const perfect=Math.random()<0.22; const gain = perfect?200:100;
    addScore(gain, perfect);
    popupFromPoint(pt, (gain>100?'+200':'+100'), true);
    // FX shatter (NDC)
    try{ const v = pt.clone().project(C); window.__HHA_screenShatter && window.__HHA_screenShatter(v.x, v.y); }catch(_){}
  }else{
    badHit(); popupFromPoint(pt, 'MISS', false);
    try{ const v = pt.clone().project(C); window.__HHA_screenShatter && window.__HHA_screenShatter(v.x, v.y); }catch(_){}
  }
}

// DOM fallback
function makeDOM(isGood){
  const d=document.createElement('button');
  d.className='spawn-emoji'; d.textContent=pick(isGood?GOOD:JUNK);
  d.style.cssText='position:absolute;border:0;background:transparent;font-size:40px;filter:drop-shadow(0 3px 6px rgba(0,0,0,.45));cursor:pointer';
  const W=hostDOM.clientWidth||640, H=hostDOM.clientHeight||360, pad=18;
  d.style.left = rng(pad, Math.max(pad, W-64))+'px';
  d.style.top  = rng(pad, Math.max(pad, H-64))+'px';
  const lifeMs=rng(life-250,life+250); let gone=false;
  const to=setTimeout(()=>{ if(!gone) leave(); }, lifeMs);
  function leave(){ gone=true; d.style.transition='transform 160ms ease, opacity 160ms ease';
    d.style.transform='scale(.6) translateY(10px)'; d.style.opacity='0'; setTimeout(()=>d.remove(),170); }
  d.addEventListener('click',(e)=>{
    if(!alive) return; clearTimeout(to); leave();
    // FX shatter (screen px)
    try{ window.__HHA_screenShatterFromPx && window.__HHA_screenShatterFromPx(e.clientX, e.clientY); }catch(_){}
    const gain = Math.random()<0.22?200:100;
    if(isGood){ addScore(gain, gain===200); } else { badHit(); }
  },false);
  hostDOM.appendChild(d); firstSpawned=true;
}

// API
export function help(lang){
  return (lang==='en')? 'Tap healthy foods (3D). They shatter and show +score. Avoid junk.' :
                        'ตีอาหารดี (3D) ให้แตกกระจาย พร้อมเด้งคะแนน หลีกเลี่ยงอาหารขยะ';
}

export function start(cfg){
  alive=true; spawnT=0; firstSpawned=false;
  DIFF = (cfg?.difficulty ? String(cfg.difficulty) : 'Normal');
  if(DIFF==='Easy'){ rate=820; life=1900; } else if(DIFF==='Hard'){ rate=560; life=1400; } else { rate=700; life=1600; }

  use3D = !!(cfg?.three?.ready);
  if(use3D){
    try{ const host=document.getElementById('spawnHost'); host && host.querySelectorAll('.spawn-emoji').forEach(n=>n.remove()); }catch(_){}
    THREE = cfg.three.THREE; R=cfg.three.renderer; S=cfg.three.scene; C=cfg.three.cam||cfg.three.camera; utils = cfg.three.utils || null;
    if(root){ root.clear(); cfg.three.scene.remove(root); }
    root = new THREE.Group(); root.name='GJ-Root';
    S.add(root); targets.length=0; shards.length=0;
  }else{
    hostDOM = document.getElementById('spawnHost') || (()=>{
      const gl=document.getElementById('gameLayer'); const h=document.createElement('div'); h.id='spawnHost'; h.style.cssText='position:absolute;inset:0'; (gl||document.body).appendChild(h); return h;
    })();
  }

  try{ const hud=document.getElementById('hudWrap'); if(hud) hud.style.display='block'; }catch(_){}
  setTimeout(()=>{ if(!alive) return; (use3D?makeTarget3D:makeDOM)(true); }, 150);
  setTimeout(()=>{ if(!alive || firstSpawned) return; for(let i=0;i<3;i++){ (use3D?makeTarget3D:makeDOM)(Math.random()<0.7); } }, 1000);
}

export function pause(){ alive=false; }
export function resume(){ alive=true; }
export function stop(){
  alive=false;
  if(use3D && root){ root.clear(); if(S) S.remove(root); root=null; }
  if(hostDOM){ try{ hostDOM.querySelectorAll('.spawn-emoji').forEach(n=>n.remove()); }catch(_){ } }
}

export function update(dt){
  if(!alive) return;
  spawnT += dt;
  if(spawnT >= rate){
    spawnT = Math.max(0, spawnT - rate);
    const count=(Math.random()<0.15)?2:1;
    for(let i=0;i<count;i++) (use3D?makeTarget3D:makeDOM)(Math.random()<0.7);
  }
  if(use3D) update3D(dt);
}
