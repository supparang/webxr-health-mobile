// === core/engine.js (ถ้ายังไม่มี)
export class Engine{
  constructor(){ this._paused=false; this._raf=0; this._tick=this._tick.bind(this); }
  start(){ if(this._raf) return; this._raf=requestAnimationFrame(this._tick); }
  _tick(){ if(!this._paused){ /* do game loop work */ } this._raf=requestAnimationFrame(this._tick); }
  pause(){ this._paused=true; }
  resume(){ this._paused=false; }
  stop(){ try{ cancelAnimationFrame(this._raf);}catch(_){} this._raf=0; }
}
// ผูกกับอีเวนต์
// window.addEventListener('hha:pause', ()=>engine.pause());
// window.addEventListener('hha:resume', ()=>engine.resume());
