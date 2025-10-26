// core/engine.js — สะพานเชื่อม THREE กับ <canvas id="c"> + FX เบา ๆ
export class Engine {
  constructor(THREE, canvas) {
    this.THREE = THREE;
    this.canvas = canvas || document.getElementById('c');

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: true
    });
    this.renderer.setPixelRatio(window.devicePixelRatio || 1);
    this._resize = this._resize.bind(this);
    this._resize();
    window.addEventListener('resize', this._resize, { passive: true });

    // world แบบมินิมอล (เผื่ออนาคตอยากวาง scene 3D เล็ก ๆ)
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(60, this.canvas.clientWidth / this.canvas.clientHeight, 0.1, 100);
    this.camera.position.set(0, 0, 5);

    // FX helper (DOM)
    this.fx = new FloatingFX(this);
    this._raf = 0;
    this._tick = this._tick.bind(this);
    this._raf = requestAnimationFrame(this._tick);
  }

  _resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    if (this.camera) {
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    }
  }

  _tick() {
    try { this.renderer.render(this.scene, this.camera); } catch {}
    this._raf = requestAnimationFrame(this._tick);
  }

  dispose() {
    cancelAnimationFrame(this._raf);
    window.removeEventListener('resize', this._resize);
    try { this.renderer.dispose(); } catch {}
  }
}

// เอฟเฟกต์ตัวหนังสือลอยบน DOM (ใช้ในโหมดเช่น goodjunk ผ่าน sys.fx.popText)
export class FloatingFX {
  constructor(eng) { this.eng = eng; }
  popText(text, opts = {}) {
    const color = opts.color || '#7fffd4';
    const x = (opts.x ?? (window.innerWidth * 0.5)) | 0;
    const y = (opts.y ?? (window.innerHeight * 0.45)) | 0;

    const el = document.createElement('div');
    el.style.cssText = `
      position:fixed;left:${x}px;top:${y}px;transform:translate(-50%,-50%);
      font:800 20px/1.2 ui-rounded,system-ui;color:${color};
      text-shadow:0 2px 6px #000c;z-index:160;pointer-events:none;opacity:0;translate:0 6px;
      transition:opacity .22s, translate .22s;
    `;
    el.textContent = text;
    document.body.appendChild(el);
    requestAnimationFrame(()=>{ el.style.opacity='1'; el.style.translate='0 0'; });
    setTimeout(()=>{ el.style.opacity='0'; el.style.translate='0 -8px'; setTimeout(()=>{ try{el.remove();}catch{} }, 220); }, 720);
  }
}
