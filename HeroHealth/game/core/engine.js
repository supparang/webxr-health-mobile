
let VRB = (typeof window !== 'undefined') ? window.VRButton : null;
async function ensureVRButton(){
  if (VRB && typeof VRB.createButton === 'function') return VRB;
  try{ const mod = await import('https://unpkg.com/three@0.159.0/examples/jsm/webxr/VRButton.js'); VRB = mod.VRButton; }
  catch(e){ console.warn('[HHA] VRButton module not available.'); }
  return VRB;
}
export class Engine{
  constructor(THREE, canvas){
    this.THREE=THREE; this.canvas=canvas;
    this.scene=new THREE.Scene();
    this.camera=new THREE.PerspectiveCamera(60, innerWidth/innerHeight, 0.1, 100);
    this.camera.position.set(0,1.6,0.5); this.camera.lookAt(0,1.6,-1);
    this.renderer=new THREE.WebGLRenderer({canvas, antialias:true, alpha:true});
    this.renderer.setSize(innerWidth, innerHeight);
    this.group=new THREE.Group(); this.scene.add(this.group);
    this.raycaster=new THREE.Raycaster(); this.mouse=new THREE.Vector2();
    addEventListener('resize', ()=>this.onResize());
    ensureVRButton().then(VR=>{ if(VR && typeof VR.createButton==='function'){ document.body.appendChild(VR.createButton(this.renderer)); this.renderer.xr.enabled=true; } });
    this._loop=()=>{};
  }
  onResize(){ this.camera.aspect=innerWidth/innerHeight; this.camera.updateProjectionMatrix(); this.renderer.setSize(innerWidth, innerHeight); }
  startLoop(loopFn){ this._loop=loopFn; this.renderer.setAnimationLoop(()=>{ this._loop && this._loop(); this.renderer.render(this.scene, this.camera); }); }
  makeBillboard(text){
    const size=128, cvs=document.createElement('canvas'); cvs.width=cvs.height=size;
    const ctx=cvs.getContext('2d'); ctx.clearRect(0,0,size,size); ctx.font='96px serif'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillStyle='#fff'; ctx.fillText(text, size/2, size/2+8);
    const tex=new this.THREE.CanvasTexture(cvs); const mat=new this.THREE.SpriteMaterial({map:tex, transparent:true}); const sp=new this.THREE.Sprite(mat); sp.scale.set(0.35,0.35,0.35); return sp;
  }
  raycastFromClient(x,y){ const r=this.renderer.domElement.getBoundingClientRect(); this.mouse.x=((x-r.left)/r.width)*2-1; this.mouse.y=-((y-r.top)/r.height)*2+1; this.raycaster.setFromCamera(this.mouse, this.camera); return this.raycaster.intersectObjects(this.group.children, true); }
}
