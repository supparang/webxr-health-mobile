// vr/emoji-sprite.js
// วาดอีโมจิลง canvas → ทำเป็น texture → วางบน plane โปร่งใส
// ใช้: <a-entity emoji-sprite="char: 🍎; size: 0.5"></a-entity>

AFRAME.registerComponent('emoji-sprite', {
  schema: {
    char: { default: '🍎' },
    size: { default: 0.6 },        // ความกว้าง/สูงของ plane (เมตร)
    fontSize: { default: 256 },    // px
    padding: { default: 32 }       // px
  },
  init: function () {
    const d = this.data;
    const el = this.el;

    // Canvas โปร่งใส
    const canvas = document.createElement('canvas');
    const W = d.fontSize + d.padding * 2;
    const H = d.fontSize + d.padding * 2;
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d', { alpha: true });
    ctx.clearRect(0, 0, W, H);

    // เรนเดอร์อีโมจิ (ไม่ทำพื้นทึบ)
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `${d.fontSize}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
    ctx.fillText(d.char, W / 2, H / 2);

    // สร้าง texture
    const tex = new THREE.CanvasTexture(canvas);
    tex.minFilter = THREE.LinearMipMapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.anisotropy = 4;

    // สร้าง mesh เป็น plane (โปร่งใส + ไม่เขียน depth)
    const geo = new THREE.PlaneGeometry(d.size, d.size);
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      alphaTest: 0.05,
      depthWrite: false,      // สำคัญ: ไม่ทิ้งเงาดำทับ HUD
      side: THREE.DoubleSide
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.renderOrder = 2;      // ให้เรนเดอร์หลังพื้นไกลเล็กน้อย

    el.setObject3D('mesh', mesh);
  },
  update: function (old) {
    if (old && old.char !== this.data.char) {
      // ถ้าเปลี่ยนตัวอีโมจิ ให้สร้างใหม่อย่างเร็ว
      this.remove();
      this.init();
    }
  },
  remove: function () {
    const obj = this.el.getObject3D('mesh');
    if (obj) {
      obj.geometry.dispose();
      if (obj.material.map) obj.material.map.dispose();
      obj.material.dispose();
      this.el.removeObject3D('mesh');
    }
  }
});
