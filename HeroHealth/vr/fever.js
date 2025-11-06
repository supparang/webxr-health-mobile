// === vr/fever.js ===
import { SFX } from './sfx.js';

export class Fever{
  constructor(scene, ui){
    this.scene = scene; this.ui = ui; this.level=0; this.active=false; this.count=0;
    this.sfx = new SFX();
    this.fireAura = null;
  }
  add(v){
    this.level = Math.max(0, Math.min(100, this.level + v));
    if(this.level>=100 && !this.active) this.start();
  }
  fill(){ this.level=100; if(!this.active) this.start(); }
  reset(){ this.level=0; this.active=false; this.count=0; this._stopAura(); this._sceneColor('#0b1324'); }
  start(){
    this.active=true; this.count++;
    this._sceneColor('#3b0f0f');
    this._startAura();
    this.sfx.feverStart();
    setTimeout(()=>this.end(), 10000);
  }
  end(){
    if(!this.active) return;
    this.active=false; this.level=0;
    this._stopAura();
    this._sceneColor('#0b1324');
    this.sfx.feverEnd();
  }
  _sceneColor(hex){
    const sky = this.scene.querySelector('a-sky'); if(sky) sky.setAttribute('color', hex);
  }
  _startAura(){
    if(this.fireAura) return;
    const fx = document.createElement('a-entity');
    fx.setAttribute('position','0 0 0');
    for(let i=0;i<18;i++){
      const p = document.createElement('a-plane');
      p.setAttribute('width',0.12); p.setAttribute('height',0.28);
      p.setAttribute('material','color:#ff6600; opacity:0.9; side:double');
      const angle = (i/18)*Math.PI*2;
      const r=0.7; const x=Math.cos(angle)*r, z=Math.sin(angle)*r;
      const y=0.1+Math.random()*0.2;
      p.setAttribute('position',`${x} ${y} ${z}`);
      p.setAttribute('animation__rise',`property: position; to: ${x} ${y+1.4} ${z}; dur: 900; dir: alternate; loop: true; easing: ease-in-out`);
      p.setAttribute('animation__fade',`property: material.opacity; to: 0.5; dur: 900; dir: alternate; loop: true; easing: ease-in-out`);
      fx.appendChild(p);
    }
    fx.id='fireAura';
    this.scene.appendChild(fx);
    this.fireAura = fx;
  }
  _stopAura(){ this.scene.querySelector('#fireAura')?.remove(); this.fireAura=null; }
}
