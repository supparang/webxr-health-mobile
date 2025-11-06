// === vr/particles.js (2025-11-06 enhanced) ===
export const Particles = {

  burst(layer, pos, color='#ffffff') {
    if (!layer) return;
    const N = 10;
    for (let i=0;i<N;i++) {
      const p = document.createElement('a-sphere');
      const r = 0.02 + Math.random()*0.02;
      p.setAttribute('radius', r);
      p.setAttribute('color', color);
      p.setAttribute('material', 'opacity:1; transparent:true; side:double');
      p.setAttribute('visible', false);
      layer.appendChild(p);

      // จุดปล่อย
      const start = `${pos.x} ${pos.y} ${pos.z}`;
      const dx=(Math.random()*2-1)*0.6, dy=Math.random()*0.8+0.2, dz=(Math.random()*2-1)*0.6;
      const x=pos.x+dx, y=pos.y+dy, z=pos.z+dz;
      const moveDur = 500 + Math.random()*300;

      // animation
      p.setAttribute('animation__move', `property: position; from: ${start}; to: ${x} ${y} ${z}; dur: ${moveDur}; easing: easeOutQuad`);
      p.setAttribute('animation__fade', `property: material.opacity; to: 0; dur: ${moveDur+100}; easing: linear`);
      p.setAttribute('animation__scale', `property: scale; from: 0.4 0.4 0.4; to: 1 1 1; dur: 150; easing: easeOutBack`);
      p.object3D.visible = true;

      requestAnimationFrame(()=>setTimeout(()=>p.remove(), moveDur+120));
    }
  },

  spark(layer, pos, color='#ffd54f') {
    if (!layer) return;
    const N = 18;
    for (let i=0;i<N;i++) {
      const s = document.createElement('a-plane');
      const w=0.03+Math.random()*0.03;
      s.setAttribute('width', w); s.setAttribute('height', w);
      s.setAttribute('material', `color:${color}; opacity:1; transparent:true; side:double`);
      s.setAttribute('visible', false);
      layer.appendChild(s);

      const start = `${pos.x} ${pos.y} ${pos.z}`;
      const dx=(Math.random()*2-1)*0.7, dy=Math.random()*1.1+0.2, dz=(Math.random()*2-1)*0.7;
      const x=pos.x+dx, y=pos.y+dy, z=pos.z+dz;
      const dur = 650+Math.random()*300;

      s.setAttribute('animation__move', `property: position; from:${start}; to:${x} ${y} ${z}; dur:${dur}; easing:easeOutCubic`);
      s.setAttribute('animation__fade', `property: material.opacity; to:0; dur:${dur+150}; easing:linear`);
      s.setAttribute('animation__rot', `property: rotation; to:${Math.random()*360} ${Math.random()*360} ${Math.random()*360}; dur:${dur}; easing:easeOutCubic`);
      s.object3D.visible = true;

      requestAnimationFrame(()=>setTimeout(()=>s.remove(), dur+200));
    }
  },

  smoke(layer, pos, color='#666') {
    if (!layer) return;
    const N = 8;
    for (let i=0;i<N;i++) {
      const c = document.createElement('a-sphere');
      const r = 0.05 + Math.random()*0.02;
      c.setAttribute('radius', r);
      c.setAttribute('color', color);
      c.setAttribute('material','opacity:0.8; transparent:true; side:double');
      c.setAttribute('visible', false);
      layer.appendChild(c);

      const start = `${pos.x} ${pos.y} ${pos.z}`;
      const dx=(Math.random()*2-1)*0.4, dy=Math.random()*0.5+0.2, dz=(Math.random()*2-1)*0.4;
      const x=pos.x+dx, y=pos.y+dy, z=pos.z+dz;
      const dur = 700+Math.random()*250;

      c.setAttribute('animation__move', `property: position; from:${start}; to:${x} ${y} ${z}; dur:${dur}; easing:easeOutQuad`);
      c.setAttribute('animation__fade', `property: material.opacity; to:0; dur:${dur+200}; easing:linear`);
      c.setAttribute('animation__scale', `property: scale; from:1 1 1; to:1.6 1.6 1.6; dur:${dur}; easing:linear`);
      c.object3D.visible = true;

      requestAnimationFrame(()=>setTimeout(()=>c.remove(), dur+250));
    }
  }
};
