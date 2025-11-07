// === particles.js — no optional chaining (2025-11-07) ===
export var Particles = {
  burst: function(host, pos, color){
    try{
      if(!host) return;
      var t=document.createElement('a-entity');
      t.setAttribute('geometry','primitive: sphere; radius: 0.02');
      t.setAttribute('material','color: '+(color||'#69f0ae')+'; opacity: 0.9');
      t.setAttribute('position', pos.x+' '+pos.y+' '+pos.z);
      host.appendChild(t);
      setTimeout(function(){ try{ t.remove(); }catch(e){} }, 280);
    }catch(e){}
  },
  smoke: function(host, pos){
    try{
      if(!host) return;
      var t=document.createElement('a-plane');
      t.setAttribute('width','0.22'); t.setAttribute('height','0.22');
      t.setAttribute('material','color: #111; opacity: 0.6');
      t.setAttribute('position', pos.x+' '+pos.y+' '+pos.z);
      host.appendChild(t);
      setTimeout(function(){ try{ t.remove(); }catch(e){} }, 300);
    }catch(e){}
  }
};