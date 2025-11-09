// === vr/spawn-utils.js ===
// สุ่มตำแหน่งแบบ Blue-noise (dart throwing) + กันชนระยะขั้นต่ำ + ขอบเขตเล่นกลางจอ

export function makeSpawner({
  // กล่องสปอนกลางจอ (เมตร, อิงตำแหน่ง spawnHost)
  bounds = { x:[-0.70, 0.70], y:[-0.10, 0.40], z:-1.6 },
  minDist = 0.28,          // ระยะห่างขั้นต่ำระหว่างเป้า
  ringBias = 0.15,         // โอกาสใช้วงแหวน (ช่วยกระจาย)
  maxTries = 32,           // ความพยายามต่อชิ้น
  decaySec = 2.5           // เวลาคงอยู่ในรายการกันชน
} = {}) {
  const actives = new Set();    // world positions ของเป้าที่ยังอยู่
  const hist = [];              // short memory กันสปอนซ้ำจุดเดิม

  function _now(){ return performance.now(); }
  function _add(pt){
    const rec = {x:pt.x, y:pt.y, z:pt.z, t:_now()};
    hist.push(rec);
    actives.add(rec);
    // ล้างของเก่า
    const cutoff = _now() - decaySec*1000;
    while (hist.length && hist[0].t < cutoff) hist.shift();
  }
  function _remove(rec){ actives.delete(rec); }

  function _ok(p){
    const d2min = minDist*minDist;
    // เทียบกับของที่ยังอยู่
    for (const r of actives){
      const dx=p.x-r.x, dy=p.y-r.y;
      if (dx*dx+dy*dy < d2min) return false;
    }
    // เทียบ short history เบา ๆ
    for (let i=hist.length-1; i>=0 && i>hist.length-12; i--){
      const r = hist[i]; const dx=p.x-r.x, dy=p.y-r.y;
      if (dx*dx+dy*dy < d2min*0.8) return false;
    }
    return true;
  }

  function _rand(min,max){ return min + Math.random()*(max-min); }

  // สุ่มตำแหน่งใหม่
  function sample() {
    // 20–30 ครั้งแบบ dart throwing
    for (let k=0;k<maxTries;k++){
      let x,y;
      if (Math.random()<ringBias){
        // bias ให้เกิดเป็นวงกว้าง ๆ ไม่ชนกลาง
        const rx = (bounds.x[1]-bounds.x[0]) * 0.44;
        const ry = (bounds.y[1]-bounds.y[0]) * 0.44;
        const ang = Math.random()*Math.PI*2;
        const r   = 0.35 + Math.random()*0.55;
        x = r*rx*Math.cos(ang);
        y = r*ry*Math.sin(ang);
      }else{
        x = _rand(bounds.x[0], bounds.x[1]);
        y = _rand(bounds.y[0], bounds.y[1]);
      }
      const p = {x,y,z:bounds.z};
      if (_ok(p)) return p;
    }
    // fallback: จุดที่ไกลที่สุดจากของเดิม
    let best = {x:0,y:0,z:bounds.z}, bestScore = -1;
    for (let i=0;i<24;i++){
      const p = { x:_rand(bounds.x[0],bounds.x[1]), y:_rand(bounds.y[0],bounds.y[1]), z:bounds.z };
      let dmin = 9e9;
      for (const r of actives){ const dx=p.x-r.x, dy=p.y-r.y; dmin = Math.min(dmin, dx*dx+dy*dy); }
      if (dmin>bestScore){ bestScore=dmin; best=p; }
    }
    return best;
  }

  return {
    sample,
    markActive(worldPos){ _add(worldPos); return worldPos; },
    unmark(rec){ _remove(rec); },
    setMinDist(v){ minDist = Math.max(0.1, Number(v)||minDist); },
    setBounds(b){ Object.assign(bounds,b); },
    get bounds(){ return bounds; }
  };
}
export default { makeSpawner };
