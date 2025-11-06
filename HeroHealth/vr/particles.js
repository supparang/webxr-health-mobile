// === vr/particles.js (3D FX + score popup + shake) ===
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
      s.setAttribute('material',`color:${color}; opacity:1; side:double; shader:flat`);
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

// -------- Advanced, used by modes --------
export const AdvancedFX = {
  // ชิ้นส่วนแตกกระจายแบบ 3D
  explode3D(layer, pos, color='#69f0ae'){
    for(let i=0;i<18;i++){
      const b = document.createElement('a-box');
      b.setAttribute('depth', 0.04);
      b.setAttribute('height', 0.05);
      b.setAttribute('width',  0.05);
      b.setAttribute('color', color);
      b.setAttribute('position', `${pos.x} ${pos.y} ${pos.z}`);
      b.setAttribute('material','opacity:0.95; metalness:0.1; roughness:0.4');
      layer.appendChild(b);
      const dx=(Math.random()*2-1)*0.6, dy=Math.random()*0.9+0.2, dz=(Math.random()*2-1)*0.6;
      const rx=(Math.random()*360), ry=(Math.random()*360), rz=(Math.random()*360);
      const x=pos.x+dx, y=pos.y+dy, z=pos.z+dz;
      b.setAttribute('animation__move', `property: position; to: ${x} ${y} ${z}; dur: 450; easing: ease-out`);
      b.setAttribute('animation__rot',  `property: rotation; to: ${rx} ${ry} ${rz}; dur: 450; easing: ease-out`);
      b.setAttribute('animation__fade', `property: material.opacity; to: 0; dur: 520; delay: 360; easing: linear`);
      setTimeout(()=>b.remove(), 560);
    }
  },

  // ป้ายคะแนนเด้ง + ลอยขึ้น
  popupScore(layer, pos, text='+10'){
    const t = document.createElement('a-entity');
    t.setAttribute('troika-text', `value: ${text}; color:#fff; fontSize:0.08; anchor:center; outlineWidth:0.004; outlineColor:#000`);
    t.setAttribute('position', `${pos.x} ${pos.y} ${pos.z}`);
    layer.appendChild(t);
    const y2 = pos.y + 0.35;
    t.setAttribute('animation__up',   `property: position; to: ${pos.x} ${y2} ${pos.z}; dur: 650; easing: ease-out`);
    t.setAttribute('animation__scale',`property: scale; to: 1.2 1.2 1.2; dur: 120; dir: alternate; easing: ease-out`);
    t.setAttribute('animation__fade', `property: opacity; to: 0; dur: 680; delay: 200; easing: linear`);
    setTimeout(()=>t.remove(), 720);
  },

  // เขย่ากล้องสั้น ๆ
  shakeRig(intensity=0.02, dur=160){
    try{
      const rig = document.querySelector('#rig');
      if(!rig) return;
      const p = rig.getAttribute('position') || {x:0,y:0,z:0};
      const x = p.x + (Math.random()*2-1)*intensity;
      const y = p.y + (Math.random()*2-1)*intensity*0.5;
      const z = p.z + (Math.random()*2-1)*intensity;
      rig.setAttribute('animation__shake_pos', `property: position; to: ${x} ${y} ${z}; dur: ${dur}; dir: alternate; loop: 2; easing: ease-in-out`);
    }catch{}
  }
};
