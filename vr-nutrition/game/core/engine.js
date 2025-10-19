// ใช้ VRButton แบบ ES Module (แก้ปัญหา "VRButton is not defined")
import { VRButton } from 'https://unpkg.com/three@0.159.0/examples/jsm/webxr/VRButton.js';

export class Engine{
  constructor(THREE, canvas){
    this.THREE = THREE;
    this.canvas = canvas;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth/window.innerHeight, 0.1, 100);
    this.camera.position.set(0,1.6,0.5);
    this.camera.lookAt(0,1.6,-1);

    this.renderer = new THREE.WebGLRenderer({canvas, antialias:true, alpha:true});
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.xr.enabled = true;
    document.body.appendChild(VRButton.createButton(this.renderer));

    this.group = new THREE.Group();
    this.scene.add(this.group);

    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    window.addEventListener('resize', ()=>this.onResize());
  }

  onResize(){
    this.camera.aspect = window.innerWidth/window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  startLoop(loopFn){
    this._loop = loopFn || (()=>{});
    this.renderer.setAnimationLoop(()=>{
      this._loop();
      this.renderer.render(this.scene, this.camera);
    });
  }

  // Billboard emoji (CanvasTexture)
  makeBillboard(text){
    const size = 128;
    const cvs = document.createElement('canvas');
    cvs.width = cvs.height = size;
    const ctx = cvs.getContext('2d');
    ctx.clearRect(0,0,size,size);
    ctx.font = '96px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff';
    ctx.fillText(text, size/2, size/2+8);
    const tex = new this.THREE.CanvasTexture(cvs);
    const mat = new this.THREE.SpriteMaterial({map:tex, transparent:true});
    const sp  = new this.THREE.Sprite(mat);
    sp.scale.set(0.35,0.35,0.35);
    return sp;
  }

  raycastFromClient(x,y){
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((x-rect.left)/rect.width)*2-1;
    this.mouse.y = -((y-rect.top)/rect.height)*2+1;
    this.raycaster.setFromCamera(this.mouse, this.camera);
    return this.raycaster.intersectObjects(this.group.children, true);
  }
}
