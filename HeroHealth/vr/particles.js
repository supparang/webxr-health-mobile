// === vr/particles.js ===
export const Particles = {
  burst(layer, pos, color='#ffffff'){
    for(let i=0;i<10;i++){
      const p = document.createElement('a-sphere');
      p.setAttribute('radius', 0.03);
      p.setAttribute('color', color);
      p.setAttribute('position', `${pos.x} ${pos.y} ${pos.z}`);
      layer.appendChild(p);
      const dx=(Math.random()*2-1)*0.6, dy=Math.random()*0.8+0.2, dz=(Math.random()*2-1)*0.6;
      const x=pos.x+dx, y=pos.y+dy, z=pos.z+dz;
      p.setAttribute('animation__move', `property: position; to: ${x} ${y} ${z}; dur: 600; easing: ease-out`);
      p.setAttribute('animation__fade', `property: material.opacity; to: 0; dur: 650; easing: linear`);
      setTimeout(()=>p.remove(), 700);
    }
  },
  spark(layer, pos, color='#ffd54f'){
    for(let i=0;i<20;i++){
      const s = document.createElement('a-plane');
      s.setAttribute('width',0.04); s.setAttribute('height',0.04);
      s.setAttribute('material',`color:${color}; opacity:1; side:double`);
      s.setAttribute('position', `${pos.x} ${pos.y} ${pos.z}`);
      layer.appendChild(s);
      const dx=(Math.random()*2-1)*0.8, dy=Math.random()*1.2+0.2, dz=(Math.random()*2-1)*0.8;
      const x=pos.x+dx, y=pos.y+dy, z=pos.z+dz;
      s.setAttribute('animation__move', `property: position; to: ${x} ${y} ${z}; dur: 800; easing: ease-out`);
      s.setAttribute('animation__fade', `property: material.opacity; to: 0; dur: 900; easing: linear`);
      setTimeout(()=>s.remove(), 950);
    }
  },
  smoke(layer, pos){
    for(let i=0;i<8;i++){
      const c = document.createElement('a-sphere');
      c.setAttribute('radius', 0.05);
      c.setAttribute('color', '#666');
      c.setAttribute('position', `${pos.x} ${pos.y} ${pos.z}`);
      layer.appendChild(c);
      const dx=(Math.random()*2-1)*0.4, dy=Math.random()*0.6+0.1, dz=(Math.random()*2-1)*0.4;
      const x=pos.x+dx, y=pos.y+dy, z=pos.z+dz;
      c.setAttribute('animation__move', `property: position; to: ${x} ${y} ${z}; dur: 700; easing: ease-out`);
      c.setAttribute('animation__fade', `property: material.opacity; to: 0; dur: 800; easing: linear`);
      setTimeout(()=>c.remove(), 820);
    }
  }
};
