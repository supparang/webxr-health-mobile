// === Hero Health Academy — core/powerup.js (v3.1: Fever integrated) ===
export class PowerUpSystem {
  constructor() {
    this.timeScale = 1;
    this.scoreBoost = 0;
    this.timers = { x2:0, freeze:0, sweep:0, shield:0 };
    this.stacks = { x2:0, freeze:0, sweep:0, shield:0 };
    this._boostTimeout = 0;
    this._tickerId = null;
    this._onChange = null;

    // FEVER
    this.value = 0; // 0–100
    this.onFeverChange = null;

    this._boostFn = (base)=>{
      const b = Number(base)||0;
      const x2Extra = (this.timers.x2>0)?b:0;
      const flat = this.scoreBoost|0;
      return x2Extra + flat;
    };
  }

  onChange(cb){ this._onChange=(typeof cb==='function')?cb:null; }
  onFever(cb){ this.onFeverChange=(typeof cb==='function')?cb:null; }

  _emitChange(){ try{ this._onChange?.(this.getCombinedTimers()); }catch{} }
  _emitFever(){ try{ this.onFeverChange?.(this.value); }catch{} }

  attachToScore(score){ if (score?.setBoostFn) score.setBoostFn((n)=>this._boostFn(n)); }

  apply(kind, seconds){
    if (kind==='boost'){
      this.scoreBoost=7;
      clearTimeout(this._boostTimeout);
      this._boostTimeout=setTimeout(()=>{ this.scoreBoost=0; this._emitChange(); },7000);
      this._emitChange(); return;
    }
    const def={ x2:8, freeze:3, sweep:2, shield:5 }[kind];
    if (def==null) return;
    this._addStack(kind, Number.isFinite(seconds)?(seconds|0):def);
  }

  getCombinedTimers(){ return { x2:this.timers.x2|0, freeze:this.timers.freeze|0, sweep:this.timers.sweep|0, shield:this.timers.shield|0, shieldCount:this.stacks.shield|0 }; }
  isFrozen(){ return (this.timers.freeze|0)>0; }

  consumeShield(){
    if ((this.stacks.shield|0)>0){
      this.stacks.shield=Math.max(0,(this.stacks.shield|0)-1);
      if(this.stacks.shield===0) this.timers.shield=0;
      this._emitChange(); return true;
    }
    return false;
  }

  _addStack(key, sec){
    const s=Math.max(1, sec|0);
    this.stacks[key]=(this.stacks[key]|0)+1;
    this.timers[key]=(this.timers[key]|0)+s;
    this._emitChange(); this._ensureTicker();
  }

  _ensureTicker(){ if (this._tickerId) return; this._tickerId=setInterval(()=>this._tick1s(),1000); }
  _stopTicker(){ if(!this._tickerId) return; clearInterval(this._tickerId); this._tickerId=null; }

  _tick1s(){
    let any=false;
    for(const k of Object.keys(this.timers)){
      let cur=this.timers[k]|0;
      if(cur>0){
        cur=Math.max(0,cur-1);
        if(cur!==(this.timers[k]|0)){ this.timers[k]=cur; any=true; }
        if(cur===0){ if((this.stacks[k]|0)>0){ this.stacks[k]=Math.max(0,(this.stacks[k]|0)-1); } }
      }
    }
    if(any) this._emitChange();
    if(!this.timers.x2 && !this.timers.freeze && !this.timers.sweep && !this.timers.shield){ this._stopTicker(); }
  }

  add(amount=5){ this.value=Math.min(100,this.value+amount); this._emitFever(); }
  drain(dt=0.2){ if(this.value<=0) return; this.value=Math.max(0,this.value-dt); this._emitFever(); }
  resetFever(){ this.value=0; this._emitFever(); }
}
