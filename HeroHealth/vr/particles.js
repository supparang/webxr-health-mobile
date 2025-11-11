// === vr/particles.js — shard burst / theme-aware (safe host + DOM fallback) ===
export const Particles = {
  burstShards(host, pos, opts = {}) {
    // 1) หาที่แปะก่อน: A-Frame scene หรือ spawnHost ถ้ามี
    host =
      host ||
      document.getElementById('spawnHost') ||
      document.querySelector('a-scene') ||
      null;

    // 2) ถ้าไม่มี A-Frame host → ใช้ DOM fallback (จุด x,y ต้องมาจาก opts.screen)
    if (!host || host.tagName !== 'A-ENTITY' && host.tagName !== 'A-SCENE') {
      const s = opts.screen;
      if (!s || typeof s.x !== 'number' || typeof s.y !== 'number') {
        // ไม่มีพิกัดจอ → ไม่ทำอะไรเพื่อกันล้ม
        return;
      }
      return burstDomAt(s.x, s.y, opts);
    }

    // 3) ใช้ A-Frame (world pos จำเป็น)
    const world = pos || { x: 0, y: 1, z: -1.5 };
    const theme = opts.theme || 'default';
    let color = '#8ee9a1', count = 10, speed = 0.8, dur = 600;
    if (theme === 'goodjunk') { color = '#8ee9a1'; count = 12; }
    else if (theme === 'plate') { color = '#facc15'; count = 14; }
    else if (theme === 'hydration') { color = '#60a5fa'; count = 10; }
    else if (theme === 'groups') { color = '#f472b6'; count = 16; }

    for (let i = 0; i < count; i++) {
      const shard = document.createElement('a-plane');
      shard.setAttribute('width', 0.06);
      shard.setAttribute('height', 0.12);
      shard.setAttribute('material', `color:${color}; opacity:0.9; transparent:true; side:double`);
      shard.setAttribute('position', `${world.x} ${world.y} ${world.z}`);

      const a = Math.random() * Math.PI * 2;
      const r = 0.25 + Math.random() * speed;
      const up = 0.10 + Math.random() * 0.40;
      const tx = world.x + Math.cos(a) * r;
      const ty = world.y + up;
      const tz = world.z + Math.sin(a) * r;

      shard.setAttribute('animation__move', `property: position; to:${tx} ${ty} ${tz}; dur:${dur}; easing:ease-out`);
      shard.setAttribute('animation__fade', `property: material.opacity; to:0; dur:${dur}; easing:linear`);

      try { host.appendChild(shard); } catch { /* กันล้ม */ }
      setTimeout(()=>{ try{ shard.remove(); }catch{} }, dur + 80);
    }
  }
};

// ---------- DOM fallback (จุดแตกกระจายบนจอ ไม่พึ่ง A-Frame) ----------
function burstDomAt(x, y, opts = {}) {
  const count = Math.max(4, Math.min(28, opts.count || 16));
  const col   = opts.color || '#22c55e';
  const root  = ensureDomFxRoot();
  for (let i = 0; i < count; i++) {
    const p = document.createElement('div');
    Object.assign(p.style, {
      position: 'fixed', left: x + 'px', top: y + 'px',
      width: '6px', height: '6px', borderRadius: '999px',
      background: col, opacity: '0.95', zIndex: 999,
      transform: 'translate(-50%,-50%)',
      transition: 'all .55s ease', pointerEvents: 'none'
    });
    root.appendChild(p);
    const ang = Math.random() * Math.PI * 2, r = 18 + Math.random() * 22;
    const tx = x + Math.cos(ang) * r, ty = y + Math.sin(ang) * r - 6;
    requestAnimationFrame(()=>{ // kick transition
      p.style.left = tx + 'px';
      p.style.top  = ty + 'px';
      p.style.opacity = '0';
    });
    setTimeout(()=>{ try{ p.remove(); }catch{} }, 600);
  }
}

let __domFxRoot = null;
function ensureDomFxRoot(){
  if (__domFxRoot && document.body.contains(__domFxRoot)) return __domFxRoot;
  __domFxRoot = document.createElement('div');
  __domFxRoot.id = 'hha-fx-root';
  __domFxRoot.style.position = 'fixed';
  __domFxRoot.style.inset = '0';
  __domFxRoot.style.pointerEvents = 'none';
  __domFxRoot.style.zIndex = '998';
  document.body.appendChild(__domFxRoot);
  return __domFxRoot;
}

export default { Particles };
