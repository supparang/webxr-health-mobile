// === vr/particles.js — shard burst / theme-aware ===
export const Particles = {
  burstShards(host, pos, opts = {}) {
    host = host || document.getElementById('spawnHost');
    pos = pos || {x:0,y:1,z:-1.5};

    const theme = opts.theme || 'default';
    let color = '#8ee9a1', count=10, speed=0.8, dur=600;
    if(theme==='goodjunk'){ color='#8ee9a1'; count=12; }
    else if(theme==='plate'){ color='#facc15'; count=14; }
    else if(theme==='hydration'){ color='#60a5fa'; count=10; }
    else if(theme==='groups'){ color='#f472b6'; count=16; }

    for(let i=0;i<count;i++){
      const shard=document.createElement('a-plane');
      shard.setAttribute('width',0.06);
      shard.setAttribute('height',0.12);
      shard.setAttribute('material',`color:${color}; opacity:0.9; transparent:true; side:double`);
      shard.setAttribute('position',`${pos.x} ${pos.y} ${pos.z}`);

      const a=Math.random()*Math.PI*2;
      const r=0.25+Math.random()*speed;
      const up=0.10+Math.random()*0.40;
      const tx=pos.x+Math.cos(a)*r;
      const ty=pos.y+up;
      const tz=pos.z+Math.sin(a)*r;

      shard.setAttribute('animation__move',`property: position; to:${tx} ${ty} ${tz}; dur:${dur}; easing:ease-out`);
      shard.setAttribute('animation__fade',`property: material.opacity; to:0; dur:${dur}; easing:linear`);
      host.appendChild(shard);
      setTimeout(()=>{ try{ shard.remove(); }catch{} }, dur+100);
    }
  },

  feverPulse(scene,on){
    let fx=document.getElementById('feverPulseFX');
    if(!fx){
      fx=document.createElement('a-entity');
      fx.id='feverPulseFX';
      for(let i=0;i<3;i++){
        const ring=document.createElement('a-ring');
        const r=0.28+i*0.07;
        ring.setAttribute('radius-inner',(r-0.01).toFixed(2));
        ring.setAttribute('radius-outer',(r+0.01).toFixed(2));
        ring.setAttribute('position','0 1.05 -1.25');
        ring.setAttribute('material','color:#ffcc00; opacity:0.8; side:double');
        ring.setAttribute('animation__pulse',`property: scale; from:1 1 1; to:1.3 1.3 1; dir:alternate; loop:true; dur:${700+i*150}; easing:easeInOutSine`);
        fx.appendChild(ring);
      }
      (scene||document.querySelector('a-scene')||document.body).appendChild(fx);
    }
    fx.setAttribute('visible',!!on);
  }
};
export default Particles;