AFRAME.registerComponent('simple-button', {
  schema: { label:{type:'string'}, color:{type:'string', default:'#22C55E'}, action:{type:'string'} },
  init: function(){
    const el=this.el, d=this.data;
    const p=document.createElement('a-plane'); p.setAttribute('width','2.0'); p.setAttribute('height','0.5');
    p.setAttribute('color',d.color); p.setAttribute('opacity','0.98'); p.setAttribute('material','shader: flat'); p.classList.add('clickable');
    const t=document.createElement('a-text'); t.setAttribute('value',d.label); t.setAttribute('align','center'); t.setAttribute('width','1.9'); t.setAttribute('color','#fff'); t.setAttribute('position','0 0 0.01');
    el.appendChild(p); el.appendChild(t);
    el.addEventListener('click', ()=> el.sceneEl.emit('ui-action', {action:d.action}));
  }
});

AFRAME.registerComponent('food-token', {
  schema:{ healthy:{default:true}, label:{default:''} },
  init: function(){
    const el=this.el, d=this.data;
    const base=document.createElement('a-cylinder'); base.setAttribute('radius','0.20'); base.setAttribute('height','0.05'); base.setAttribute('color', d.healthy ? '#BBF7D0' : '#FFD6D6');
    const body=document.createElement('a-sphere'); body.setAttribute('radius','0.16'); body.setAttribute('position','0 0.18 0'); body.setAttribute('color', d.healthy ? '#22C55E' : '#EF4444');
    const text=document.createElement('a-text'); text.setAttribute('value', d.label || (d.healthy ? 'ดีต่อสุขภาพ' : 'อาหารขยะ')); text.setAttribute('width','1.0'); text.setAttribute('align','center'); text.setAttribute('color','#111'); text.setAttribute('position','0 0.38 0');
    el.appendChild(base); el.appendChild(body); el.appendChild(text);
    el.classList.add('clickable');
    el.addEventListener('click', ()=> el.sceneEl.emit('food-hit', { healthy:d.healthy, entity:el }));
  }
});

AFRAME.registerComponent('simple-game', {
  init: function(){
    const scene=this.el;
    this.panel=document.getElementById('panel'); this.game=document.getElementById('game');
    this.spawnArea=document.getElementById('spawnArea'); this.hudText=document.getElementById('hudText');
    this.result=document.getElementById('result'); this.resBody=document.getElementById('resBody');

    this.score=0; this.timeLeft=45; this.spawnInt=null; this.timer=null;

    scene.addEventListener('ui-action', (e)=> this.onAction(e.detail.action));
    scene.addEventListener('food-hit', (e)=> this.onHit(e.detail));

    this.showMenu();
  },

  showMenu: function(){ this.stopAll(); this.clearArea(); this.score=0; this.timeLeft=45; this.panel.setAttribute('visible', true); this.game.setAttribute('visible', false); this.result.setAttribute('visible', false); this.updateHUD(); },
  startGame: function(){
    this.stopAll(); this.clearArea();
    this.panel.setAttribute('visible', false); this.game.setAttribute('visible', true); this.result.setAttribute('visible', false);
    this.score=0; this.timeLeft=45; this.updateHUD();
    this.timer=setInterval(()=>{ if(this.timeLeft<=0){ this.endGame(); return; } this.timeLeft--; this.updateHUD(); }, 1000);
    const once = ()=>{ const healthy = Math.random() < 0.6; const label = healthy ? this.pick(['ผัก','ผลไม้','ข้าวกล้อง','ปลา','นมจืด']) : this.pick(['น้ำอัดลม','ของทอด','ขนมหวาน','มันฝรั่งแผ่น','ชาไข่มุกหวาน']); const ent=document.createElement('a-entity'); ent.setAttribute('food-token', { healthy, label }); const p=this.randomPos(1.4, 0.9); ent.setAttribute('position', `${p.x} 0 ${p.z}`); this.spawnArea.appendChild(ent); setTimeout(()=>{ ent.parentNode && ent.parentNode.removeChild(ent); }, 5000); };
    once(); this.spawnInt=setInterval(()=>{ once(); if(Math.random()<0.4) once(); }, 1100);
  },
  endGame: function(){ this.stopAll(); this.game.setAttribute('visible', false); this.result.setAttribute('visible', true); this.resBody.setAttribute('value', `คะแนน: ${this.score}`); },
  onAction: function(a){ if(a==='start') return this.startGame(); if(a==='restart') return this.startGame(); if(a==='menu') return this.showMenu(); },
  onHit: function(detail){ if(this.timeLeft<=0) return; this.score += detail.healthy ? 10 : -5; const ent=detail.entity; ent.setAttribute('material', 'color: #fff176'); setTimeout(()=>{ try{ ent.parentNode && ent.parentNode.removeChild(ent); }catch(e){} }, 60); this.updateHUD(); },
  updateHUD: function(){ this.hudText.setAttribute('value', `คะแนน: ${this.score} | เวลา: ${this.timeLeft}s`); },
  stopAll: function(){ if(this.spawnInt){ clearInterval(this.spawnInt); this.spawnInt=null; } if(this.timer){ clearInterval(this.timer); this.timer=null; } },
  clearArea: function(){ while(this.spawnArea.firstChild){ this.spawnArea.removeChild(this.spawnArea.firstChild); } },
  pick: function(arr){ return arr[Math.floor(Math.random()*arr.length)]; },
  randomPos: function(w,d){ return { x:(Math.random()* (w*2) - w), z:(Math.random()* (d*2) - d) }; }
});

document.addEventListener('DOMContentLoaded', ()=>{ document.querySelector('a-scene').setAttribute('simple-game',''); });
