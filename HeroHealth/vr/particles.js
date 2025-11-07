// === Hero Health VR — vr/particles.js (score FX overlay) ===
export const Particles = (function(){
  let layer = null;

  function ensureLayer(){
    if (!layer){
      layer = document.getElementById('fxLayer');
      if(!layer){
        layer = document.createElement('div');
        layer.id = 'fxLayer';
        layer.style.position='fixed';
        layer.style.inset='0';
        layer.style.pointerEvents='none';
        layer.style.zIndex='950';
        document.body.appendChild(layer);
      }
    }
    return layer;
  }

  function hit(x, y, opt){
    ensureLayer();
    window.dispatchEvent(new CustomEvent('hha:hit', { detail: { x, y, ...opt } }));
  }

  function clear(){
    ensureLayer();
    while(layer.firstChild) layer.firstChild.remove();
  }

  return { hit, clear };
})();
export default Particles;