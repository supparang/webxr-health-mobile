// === vr/particles.js (simple FX + advanced 3D shards + score popup) ===
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

// === Advanced 3D fx ===
export const AdvancedFX = {
  // ชิ้นแตก 3D แบบกล่อง
  explode3D(layer, pos, color='#8bf7d8'){
    const N = 12;
    for(let i=0;i<N;i++){
      const s = document.createElement('a-box');
      const size = 0.05 + Math.random()*0.04;
      s.setAttribute('width',size); s.setAttribute('height',size); s.setAttribute('depth',size);
      s.setAttribute('material',`color:${color}; opacity:0.95; metalness:0.2; roughness:0.4`);
      s.setAttribute('position', `${pos.x} ${pos.y} ${pos.z}`);
      layer.appendChild(s);
      const dx=(Math.random()*2-1)*0.7, dy=Math.random()*1.1+0.3, dz=(Math.random()*2-1)*0.7;
      const x=pos.x+dx, y=pos.y+dy, z=pos.z+dz;
      s.setAttribute('animation__move', `property: position; to: ${x} ${y} ${z}; dur: 550; easing: ease-out`);
      s.setAttribute('animation__rot',  `property: rotation; to: ${Math.random()*360} ${Math.random()*360} ${Math.random()*360}; dur: 550; easing: ease-out`);
      s.setAttribute('animation__fade', `property: material.opacity; to: 0; dur: 600; easing: linear; delay: 200`);
      setTimeout(()=>s.remove(), 700);
    }
  },
  // ป้ายคะแนนเด้งขึ้น
  popupScore(layer, pos, text='+10'){
    const label = document.createElement('a-entity');
    label.setAttribute('troika-text', `value: ${text}; color:#fff; fontSize:0.06; anchor:center; outlineColor:#000; outlineWidth:0.02`);
    label.setAttribute('position', `${pos.x} ${pos.y} ${pos.z}`);
    layer.appendChild(label);
    const y2 = pos.y + 0.6;
    label.setAttribute('animation__rise', `property: position; to: ${pos.x} ${y2} ${pos.z}; dur: 800; easing: ease-out`);
    label.setAttribute('animation__fade', `property: components.troika-text.material.opacity; to: 0; dur: 800; easing: linear`);
    setTimeout(()=>label.remove(), 820);
  },
  // เขย่า Rig เบา ๆ ให้รู้สึกแรงกระแทก
  shakeRig(rig=document.getElementById('rig'), amp=0.02, dur=120){
    if(!rig) return;
    const p = rig.getAttribute('position') || {x:0,y:0,z:0};
    const x = p.x + (Math.random()*2-1)*amp, y = p.y + (Math.random()*2-1)*amp;
    rig.setAttribute('animation__shake', `property: position; to: ${x} ${y} ${p.z}; dur: ${dur}; dir: alternate; easing: ease-in-out`);
    setTimeout(()=>rig.setAttribute('position', `${p.x} ${p.y} ${p.z}`), dur+30);
  }
};
