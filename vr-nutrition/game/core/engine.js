// core/engine.js
import { VRButton } from 'https://unpkg.com/three@0.159.0/examples/jsm/webxr/VRButton.js';

export class Engine{
  constructor(THREE, canvas){
    // ...
    document.body.appendChild(VRButton.createButton(this.renderer));
    this.renderer.xr.enabled = true;
  }
  // ...
}

export class Engine {
  constructor(THREE, canvas){
    this.THREE = THREE;
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({canvas, antialias:true});
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.xr.enabled = true;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(60, 2, 0.01, 100);
    this.camera.position.set(0, 1.6, 2.8);
    this.scene.add(new THREE.AmbientLight(0xffffff, 1.0));
    this.group = new THREE.Group();
    this.scene.add(this.group);
    this.raycaster = new THREE.Raycaster();
    this.resize();
    window.addEventListener('resize',()=>this.resize());
    try{
      const VRB = window.VRButton || (window.THREE && window.THREE.VRButton);
      const vrEl = (VRB && VRB.createButton) ? VRB.createButton(this.renderer) : null;
      if(vrEl){
        const slot = document.createElement('div');
        slot.style.position='fixed'; slot.style.right='8px'; slot.style.bottom='8px'; slot.style.zIndex=5;
        slot.appendChild(vrEl); document.body.appendChild(slot);
      }
    }catch(e){}
  }
  resize(){
    const w=innerWidth, h=innerHeight;
    this.renderer.setSize(w,h,false);
    this.camera.aspect=w/h;
    this.camera.updateProjectionMatrix();
  }
  startLoop(draw){
    this.renderer.setAnimationLoop(()=>{
      if(draw) draw();
      this.renderer.render(this.scene, this.camera);
    });
  }
  makeEmojiTexture(char){
    const s=128, c=document.createElement('canvas'); c.width=c.height=s;
    const cx=c.getContext('2d'); cx.font="100px system-ui, 'Apple Color Emoji', 'Segoe UI Emoji'";
    cx.textAlign='center'; cx.textBaseline='middle'; cx.fillText(char,s/2,s/2);
    const tex=new this.THREE.CanvasTexture(c); tex.needsUpdate=true; return tex;
  }
  makeBillboard(char){
    const tex=this.makeEmojiTexture(char);
    const geo=new this.THREE.PlaneGeometry(0.5,0.5);
    const mat=new this.THREE.MeshBasicMaterial({map:tex, transparent:true, side:this.THREE.DoubleSide, depthWrite:false});
    const m=new this.THREE.Mesh(geo,mat); m.lookAt(this.camera.position); return m;
  }
  raycastFromClient(x,y){
    const rect=this.canvas.getBoundingClientRect();
    const nx=(x-rect.left)/rect.width*2-1, ny=-(y-rect.top)/rect.height*2+1;
    const v=new this.THREE.Vector2(nx,ny);
    this.raycaster.setFromCamera(v, this.camera);
    return this.raycaster.intersectObjects(this.group.children, true);
  }
}
