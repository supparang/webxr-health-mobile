
export class PowerUpSystem{
  constructor(){ this.timeScale=1; this.scoreBoost=0; this._shield=0; }
  apply(k){
    if(k==='slow'){ this.timeScale=0.8; setTimeout(()=>this.timeScale=1,5000); }
    if(k==='boost'){ this.scoreBoost=0.5; setTimeout(()=>this.scoreBoost=0,5000); }
    if(k==='shield'){ this._shield=Math.min(2,this._shield+1); }
  }
  tick(dt){}
  consumeShield(){ if(this._shield>0){ this._shield--; return true;} return false; }
}
