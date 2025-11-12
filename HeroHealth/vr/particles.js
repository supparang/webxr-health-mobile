// === /HeroHealth/vr/particles.js — DOM burst + score pop (final) ===
export const Particles = {
  burstShards(host, pos, opts) {
    opts = opts || {};
    const scr = opts.screen || (pos && typeof pos.x === 'number' && typeof pos.y === 'number'
                                ? { x: pos.x, y: pos.y } : null);

    // ---------- DOM MODE ----------
    if (scr) {
      const x = Math.round(scr.x), y = Math.round(scr.y);
      const theme = opts.theme || 'default';
      let color = '#8ee9a1', count = 14, dur = 560;

      if (theme === 'goodjunk')   { color = '#22c55e'; count = 16; }
      else if (theme === 'groups'){ color = '#f59e0b'; count = 14; }
      else if (theme === 'hydration'){ color = '#60a5fa'; count = 14; }
      else if (theme === 'plate'){ color = '#facc15'; count = 16; }

      for (let i = 0; i < count; i++) {
        const p = document.createElement('div');
        Object.assign(p.style, {
          position:'fixed', left:x+'px', top:y+'px', width:'6px', height:'6px',
          borderRadius:'999px', background:color, opacity:'0.96', zIndex:999,
          transform:'translate(-50%,-50%)', transition:'all .55s ease', pointerEvents:'none'
        });
        document.body.appendChild(p);
        const ang = Math.random()*Math.PI*2, r = 24 + Math.random()*28;
        const tx = x + Math.cos(ang)*r, ty = y + Math.sin(ang)*r - 8;
        requestAnimationFrame(()=>{ p.style.left=tx+'px'; p.style.top=ty+'px'; p.style.opacity='0'; });
        setTimeout(()=>{ try{p.remove();}catch{} }, dur);
      }
      return;
    }

    // ---------- 3D MODE (fallback ไป DOM ถ้าไม่มี A-Frame) ----------
    try {
      let root = host || document.getElementById('spawnHost') || document.querySelector('a-scene') || document.body;
      const theme = opts.theme || 'default';
      let color = '#8ee9a1', count = 10, dur = 600;
      if (theme === 'goodjunk') { color='#22c55e'; count=12; }
      else if (theme === 'plate'){ color='#facc15'; count=14; }
      else if (theme === 'hydration'){ color='#60a5fa'; count=10; }
      else if (theme === 'groups'){ color='#f472b6'; count=16; }

      if (!window.AFRAME || !root) {
        const x = (pos && pos.x) || (window.innerWidth/2);
        const y = (pos && pos.y) || (window.innerHeight/2);
        return this.burstShards(null, null, { screen:{x,y}, theme });
      }

      for (let i=0;i<count;i++){
        const shard=document.createElement('a-plane');
        shard.setAttribute('width',0.06);
        shard.setAttribute('height',0.12);
        shard.setAttribute('material',`color:${color}; opacity:0.9; transparent:true`);
        const p = pos && pos.x!=null ? pos : {x:0,y:1,z:-1.5};
        shard.setAttribute('position',`${p.x} ${p.y} ${p.z||-1.5}`);
        const a=Math.random()*Math.PI*2, r=0.25+Math.random()*0.8, up=0.10+Math.random()*0.40;
        const tx=(p.x||0)+Math.cos(a)*r, ty=(p.y||1)+up, tz=(p.z||-1.5)+Math.sin(a)*r;
        shard.setAttribute('animation__move',`property: position; to:${tx} ${ty} ${tz}; dur:${dur}; easing:ease-out`);
        shard.setAttribute('animation__fade',`property: material.opacity; to:0; dur:${dur}; easing:linear`);
        root.appendChild(shard);
        setTimeout(()=>{ try{shard.remove();}catch{} }, dur+80);
      }
    } catch {
      const x=(pos&&pos.x)||(window.innerWidth/2), y=(pos&&pos.y)||(window.innerHeight/2);
      this.burstShards(null, null, { screen:{x,y}, theme:opts.theme });
    }
  },

  // ✅ คะแนนเด้งที่ตำแหน่งคลิก
  scorePop(x, y, text, good=true){
    const el=document.createElement('div');
    el.textContent = String(text ?? (good?'+10':'-10'));
    Object.assign(el.style,{
      position:'fixed', left:x+'px', top:y+'px', transform:'translate(-50%,-50%)',
      font:'800 16px system-ui', color: good ? '#22c55e' : '#ef4444', zIndex:1000,
      textShadow:'0 2px 8px rgba(0,0,0,.55)', pointerEvents:'none', transition:'all .6s ease', opacity:'1'
    });
    document.body.appendChild(el);
    requestAnimationFrame(()=>{ el.style.top=(y-28)+'px'; el.style.opacity='0'; });
    setTimeout(()=>{ try{el.remove();}catch{} }, 650);
  }
};

export default { Particles };
