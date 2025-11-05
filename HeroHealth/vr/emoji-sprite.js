// vr/emoji-sprite.js
const _EMOJI_CACHE = new Map();

function makeEmojiCanvas(char, size=256, font='system-ui, "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji"'){
  const key = `${char}@${size}`;
  if (_EMOJI_CACHE.has(key)) return _EMOJI_CACHE.get(key);
  const c = document.createElement('canvas'); c.width = c.height = size;
  const ctx = c.getContext('2d');
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `${Math.floor(size*0.8)}px ${font}`;
  ctx.clearRect(0,0,size,size);
  ctx.shadowColor = 'rgba(0,0,0,0.25)'; ctx.shadowBlur = size*0.05;
  ctx.fillText(char, size/2, size/2);
  _EMOJI_CACHE.set(key, c);
  return c;
}

AFRAME.registerComponent('emoji-sprite', {
  schema: { char:{type:'string', default:'🍎'}, size:{type:'int', default:256},
            width:{type:'number', default:0.34}, height:{type:'number', default:0.34},
            glow:{type:'boolean', default:true} },
  init(){
    this.canvas = makeEmojiCanvas(this.data.char, this.data.size);
    const tex = new THREE.CanvasTexture(this.canvas);
    tex.needsUpdate = true; tex.minFilter = THREE.LinearFilter; tex.magFilter = THREE.LinearFilter;
    this.el.setAttribute('geometry', `primitive: plane; width: ${this.data.width}; height: ${this.data.height}`);
    this.el.setAttribute('material', 'transparent: true; side: double');
    const mesh = this.el.getObject3D('mesh');
    if (mesh){
      mesh.material.map = tex;
      if (this.data.glow){
        mesh.material.emissive = new THREE.Color(0xffffff);
        mesh.material.emissiveIntensity = 0.35;
        mesh.material.emissiveMap = tex;
      }
      mesh.material.needsUpdate = true;
    }
  },
  update(old){
    if (old && old.char === this.data.char && old.size === this.data.size) return;
    this.canvas = makeEmojiCanvas(this.data.char, this.data.size);
    const mesh = this.el.getObject3D('mesh');
    if (mesh){
      const tex = new THREE.CanvasTexture(this.canvas);
      tex.needsUpdate = true; tex.minFilter = THREE.LinearFilter; tex.magFilter = THREE.LinearFilter;
      mesh.material.map = tex;
      if (this.data.glow){
        mesh.material.emissive = new THREE.Color(0xffffff);
        mesh.material.emissiveIntensity = 0.35;
        mesh.material.emissiveMap = tex;
      }
      mesh.material.needsUpdate = true;
    }
  }
});
