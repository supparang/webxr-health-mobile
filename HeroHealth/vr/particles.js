// === vr/particles.js — shard burst / smoke / pulse (no optional chaining) ===
export const Particles = {
  burstShards: function(host, pos, opts){
    host = host || document.getElementById('spawnHost') || document.body;
    pos = pos || {x:0,y:1.2,z:-1.4};
    opts = opts || {};
    var n   = opts.count  || 10;
    var w   = opts.w      || 0.08;
    var h   = opts.h      || 0.12;
    var spd = opts.speed  || 0.7;   // ระยะกระจาย
    var dur = opts.dur    || 600;   // ms
    var col = opts.color  || '#8ee9a1';

    for(var i=0;i<n;i++){
      var p = document.createElement('a-plane');
      p.setAttribute('width', w);
      p.setAttribute('height',h);
      p.setAttribute('material','color:'+col+'; side:double; opacity:0.96; transparent:true');
      p.setAttribute('position', pos.x+' '+pos.y+' '+pos.z);

      // ทิศทางสุ่ม (ฮาโล)
      var a = Math.random()*Math.PI*2;
      var r = (0.25 + Math.random()*spd);
      var up= (0.10 + Math.random()*0.40);
      var tx = pos.x + Math.cos(a)*r;
      var ty = pos.y + up;
      var tz = pos.z + Math.sin(a)*r;

      // เคลื่อน + หมุน + จางหาย
      p.setAttribute('animation__pos','property: position; to: '+tx+' '+ty+' '+tz+'; dur: '+dur+'; easing: ease-out');
      p.setAttribute('animation__rot','property: rotation; to: '+(Math.random()*360|0)+' '+(Math.random()*360|0)+' '+(Math.random()*360|0)+'; dur: '+dur+'; easing: linear');
      p.setAttribute('animation__fade','property: material.opacity; to: 0; dur: '+dur+'; easing: linear');

      host.appendChild(p);
      (function(node){
        setTimeout(function(){ try{ node.parentNode.removeChild(node); }catch(e){} }, dur+40);
      })(p);
    }
  },

  smoke: function(host, pos, opts){
    host = host || document.getElementById('spawnHost') || document.body;
    pos = pos || {x:0,y:1.2,z:-1.4};
    opts = opts || {};
    var p = document.createElement('a-plane');
    p.setAttribute('width', 0.38);
    p.setAttribute('height',0.38);
    p.setAttribute('material','color:#000; opacity:0.35; side:double; transparent:true');
    p.setAttribute('position', pos.x+' '+pos.y+' '+pos.z);
    p.setAttribute('animation__rise','property: position; to: '+pos.x+' '+(pos.y+0.35)+' '+pos.z+'; dur: 420; easing: ease-out');
    p.setAttribute('animation__fade','property: material.opacity; to: 0; dur: 420; easing: linear');
    host.appendChild(p);
    setTimeout(function(){ try{ p.parentNode.removeChild(p); }catch(e){} }, 460);
  },

  feverPulse: function(scene, on){
    // สร้าง/ซ่อนวงแหวนพัลส์ด้านหน้า
    var id='feverPulseFX';
    var fx = document.getElementById(id);
    if(!fx){
      fx = document.createElement('a-entity');
      fx.id = id;
      fx.setAttribute('visible', false);
      // วงแหวน 3 ชั้น
      for(var i=0;i<3;i++){
        var r = 0.25 + i*0.08;
        var ring = document.createElement('a-ring');
        ring.setAttribute('radius-inner', (r-0.01).toFixed(2));
        ring.setAttribute('radius-outer', (r+0.01).toFixed(2));
        ring.setAttribute('position', '0 1.05 -1.25');
        ring.setAttribute('material','color:#ffd166; opacity:0.85; side:double');
        // พัลส์วน
        ring.setAttribute('animation__pulse','property: scale; from: 1 1 1; to: 1.25 1.25 1; dir: alternate; loop: true; dur: '+(700+ i*120)+'; easing: easeInOutSine');
        ring.setAttribute('animation__fade','property: material.opacity; from:0.65; to:0.35; dir: alternate; loop:true; dur:'+(700+i*120)+'; easing: easeInOutSine');
        fx.appendChild(ring);
      }
      (scene||document.body).appendChild(fx);
    }
    fx.setAttribute('visible', !!on);
  }
};

export default Particles;
