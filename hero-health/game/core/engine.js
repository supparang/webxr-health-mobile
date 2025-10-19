let VRB = (typeof window !== 'undefined') ? window.VRButton : null;

async function ensureVRButton(){
  if (VRB && typeof VRB.createButton === 'function') return VRB;
  try{
    const mod = await import('https://unpkg.com/three@0.159.0/examples/jsm/webxr/VRButton.js');
    VRB = mod.VRButton;
  }catch(e){
    console.warn('[HHA] VRButton module not available, continue without XR button.');
  }
  return VRB;
}

export class Engine{
  constructor(THREE, canvas){
    if (!THREE) throw new Error('[HHA] THREE is not available on window. Make sure three.min.js is loaded before main.js');

    this.THREE = THREE;
    this.canvas = canvas;

    // --- Scene / Camera ---
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(60, innerWidth/innerHeight, 0.1, 100);
    this.camera.position.set(0,1.6,0.5);
    this.camera.lookAt(0,1.6,-1);

    // --- Renderer ---
    this.renderer = new THREE.WebGLRenderer({canvas, antialias:true, alpha:true});
    // ตั้งค่าเริ่มต้นให้คม และให้ main.js ปรับได้ภายหลัง
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.xr.enabled = true; // เปิดก่อนสร้างปุ่ม (สำคัญ)

    // --- World container ---
    this.group = new THREE.Group();
    this.scene.add(this.group);

    // --- Picking ---
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    addEventListener('resize', ()=>this.onResize());

    // --- VR Button ---
    ensureVRButton().then(VR=>{
      try{
        if(VR && typeof VR.createButton==='function'){
          const btn = VR.createButton(this.renderer);
          if (btn && !btn.isConnected) document.body.appendChild(btn);
        }
      }catch(e){
        console.warn('[HHA] VRButton create failed:', e);
      }
    });

    this._loop = ()=>{};
  }

  onResize(){
    this.camera.aspect = innerWidth/innerHeight;
    this.camera.updateProjectionMatrix();
    // รักษา pixelRatio ที่ตั้งไว้ (main.js อาจเปลี่ยนระหว่างเกม)
    const currentPR = this.renderer.getPixelRatio ? this.renderer.getPixelRatio() : Math.min(2, window.devicePixelRatio||1);
    this.renderer.setPixelRatio(currentPR);
    this.renderer.setSize(innerWidth, innerHeight);
  }

  startLoop(loopFn){
    this._loop = loopFn;
    this.renderer.setAnimationLoop(()=>{
      this._loop && this._loop();
      this.renderer.render(this.scene, this.camera);
    });
  }

  makeBillboard(text){
    const size=128;
    const cvs=document.createElement('canvas'); cvs.width=cvs.height=size;
    const ctx=cvs.getContext('2d');
    ctx.clearRect(0,0,size,size);
    ctx.font='96px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
    ctx.textAlign='center';
    ctx.textBaseline='middle';
    ctx.fillStyle='#fff';
    ctx.fillText(text, size/2, size/2+8);

    const tex=new this.THREE.CanvasTexture(cvs);
    tex.needsUpdate = true;
    tex.minFilter = this.THREE.LinearFilter;
    tex.magFilter = this.THREE.LinearFilter;

    const mat=new this.THREE.SpriteMaterial({map:tex, transparent:true});
    const sp=new this.THREE.Sprite(mat);
    sp.scale.set(0.35,0.35,0.35);

    // ช่วย main.js ทำความสะอาดเมื่อลบ
    sp.onBeforeDetach = () => {
      if (mat.map) mat.map.dispose();
      mat.dispose();
    };

    return sp;
  }

  raycastFromClient(x,y){
    const r=this.renderer.domElement.getBoundingClientRect();
    this.mouse.x=((x-r.left)/r.width)*2-1;
    this.mouse.y=-((y-r.top)/r.height)*2+1;
    this.raycaster.setFromCamera(this.mouse, this.camera);
    return this.raycaster.intersectObjects(this.group.children, true);
  }
}
