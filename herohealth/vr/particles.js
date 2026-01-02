// -------------------- FX (Particles) --------------------
// requires: ./vr/particles.js -> window.Particles.{popText,burst,celebrate}
function hasFX(){
  return !!(window.Particles && (window.Particles.popText || window.Particles.burst || window.Particles.celebrate));
}
function fxXYFromEl(el){
  try{
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width/2, y: r.top + r.height/2 };
  }catch(_){}
  // fallback center
  return { x: window.innerWidth/2, y: window.innerHeight/2 };
}
function fxPop(el, text, cls=''){
  if (!hasFX() || !window.Particles.popText) return;
  const {x,y} = fxXYFromEl(el);
  try{ window.Particles.popText(x,y,text,cls); }catch(_){}
}
function fxBurst(el, n=14){
  if (!hasFX() || !window.Particles.burst) return;
  const {x,y} = fxXYFromEl(el);
  try{ window.Particles.burst(x,y,n); }catch(_){}
}
function fxCelebrate(){
  if (!hasFX() || !window.Particles.celebrate) return;
  try{ window.Particles.celebrate(); }catch(_){}
}