// game/core/powerup.js
export class PowerUpSystem{
  constructor(){ this.timeScale=1; this.scoreBoost=0; this.timers={ x2:0, freeze:0, sweep:0 }; }
  tick1s(){ // ลดเวลาใน main.tick()
    ['x2','freeze','sweep'].forEach(k=>{ if(this.timers[k]>0) this.timers[k]-=1; });
    this.scoreBoost = (this.timers.x2>0) ? 1 : 0;
    this.timeScale  = (this.timers.freeze>0) ? 1.15 : 1; // แค่ชะลอเล็กน้อย
  }
  apply(kind, opts={}){
    if(kind==='boost'||kind==='x2'){ this.timers.x2 = Math.max(this.timers.x2, opts.sec||7); this.scoreBoost=1; }
    else if(kind==='freeze'){ this.timers.freeze = Math.max(this.timers.freeze, opts.sec||2); }
    else if(kind==='sweep'){ this.timers.sweep = Math.max(this.timers.sweep, opts.sec||1); (opts.onSweep||(()=>{}))(); }
  }
}
