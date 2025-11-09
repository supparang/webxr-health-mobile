// === vr/shards.js ===
// 3D shard effect (แตกกระจาย) + floating score label
// ใช้: burstAt(scene, {x,y,z}, {color,count,speed,life})
//     floatScore(scene, {x,y,z}, "+10", {dur})

export function burstAt(scene, pos, {
  color = '#ffd166',
  count = 14,
  speed = 0.9,
  life  = 650
} = {}) {
  const root = document.createElement('a-entity');
  root.setAttribute('position', `${pos.x} ${pos.y} ${pos.z}`);
  scene.appendChild(root);

  for (let i = 0; i < count; i++) {
    const p = document.createElement('a-plane');
    p.setAttribute('width',  0.04 + Math.random() * 0.06);
    p.setAttribute('height', 0.02 + Math.random() * 0.04);
    p.setAttribute('material', `color:${color}; opacity:0.95; side:double`);

    const ang = Math.random() * Math.PI * 2;
    const vy = (Math.random() * 0.9 + 0.2) * speed;
    const vx = Math.cos(ang) * speed * (0.3 + Math.random() * 0.7);
    const vz = Math.sin(ang) * speed * (0.3 + Math.random() * 0.7);

    p.setAttribute('animation__move',
      `property: position; to: ${vx} ${vy} ${vz}; dur: ${life}; easing: ease-out`);
    p.setAttribute('animation__fade',
      `property: material.opacity; to: 0; dur: ${life}; easing: linear`);

    root.appendChild(p);
  }

  setTimeout(() => { if (root.parentNode) root.parentNode.removeChild(root); }, life + 60);
}

export function floatScore(scene, pos, text = '+1', { dur = 700 } = {}) {
  const label = document.createElement('a-text');
  label.setAttribute('value', text);
  label.setAttribute('align', 'center');
  label.setAttribute('color', '#ffffff');
  label.setAttribute('shader', 'msdf');      // คมชัด
  label.setAttribute('side', 'double');
  label.setAttribute('position', `${pos.x} ${pos.y} ${pos.z}`);
  label.setAttribute('scale', '0.5 0.5 0.5');
  label.setAttribute('opacity', '0.95');

  label.setAttribute('animation__rise',
    `property: position; to: ${pos.x} ${pos.y + 0.4} ${pos.z}; dur: ${dur}; easing: ease-out`);
  label.setAttribute('animation__fade',
    `property: opacity; to: 0; dur: ${dur}; easing: linear`);

  scene.appendChild(label);
  setTimeout(() => { if (label.parentNode) label.parentNode.removeChild(label); }, dur + 40);
}

export default { burstAt, floatScore };
