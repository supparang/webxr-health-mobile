export class ScoreSystem {
  constructor(){ this.reset(); this._boostFn = null; this._handlers = {}; }
  setBoostFn(fn){ this._boostFn = fn; }
  setHandlers(h){ this._handlers = h || {}; }
  reset(){ this.score=0; this.combo=0; this.bestCombo=0; }

  add(v){
    // บูสต์เฉพาะแต้มบวก
    let val = v|0;
    if(val>0 && typeof this._boostFn === 'function'){
      const b = Math.max(0, this._boostFn());
      val = Math.round(val * (1 + b));
    }
    this.score += val;

    if(v>0){
      this.combo++;
      this.bestCombo = Math.max(this.bestCombo, this.combo);
      this._handlers.onCombo?.(this.combo);
    }else if(v<0){
      this.bad();
    }
    return this.score;
  }
  bad(){ this.combo = 0; }
}
