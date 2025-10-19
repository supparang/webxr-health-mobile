// systems/powerups.js
export class PowerUpSystem {
  constructor(){
    this.effects = { slow:0, boost:0, shield:0 };
    this.timeScale = 1.0; // < 1 = slow motion
    this.scoreBoost = 0;  // extra multiplier
    this.hasShield = false;
  }
  tick(dt){
    const s = this.effects;
    if(s.slow>0){ s.slow=Math.max(0, s.slow-dt); }
    if(s.boost>0){ s.boost=Math.max(0, s.boost-dt); }
    if(s.shield>0){ s.shield=Math.max(0, s.shield-dt); this.hasShield = s.shield>0; }
    this.timeScale = s.slow>0 ? 0.6 : 1.0;
    this.scoreBoost = s.boost>0 ? 1 : 0; // +1x
  }
  apply(kind){
    if(kind==='slow'){ this.effects.slow += 4000; }
    if(kind==='boost'){ this.effects.boost += 6000; }
    if(kind==='shield'){ this.effects.shield = Math.max(this.effects.shield, 5000); this.hasShield = true; }
  }
  consumeShield(){
    if(this.hasShield){ this.hasShield=false; this.effects.shield=0; return true; }
    return false;
  }
}
