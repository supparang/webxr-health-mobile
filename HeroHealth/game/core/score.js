// === core/score.js (unified v2)
export class ScoreSystem {
  constructor(opts = {}) {
    this.base = { ok:4, good:10, perfect:18, bad:-6, ...(opts.base||{}) };
    this.value = 0; this.combo = 0; this.bestCombo = 0;
    this.comboStep = 0.03; this.comboMulCap = 1.30;
    this.feverBonusMax = 0.10;
    this.gradeBreaks  = opts.gradeBreaks  || [120,240,360,480,600];
    this.gradeLetters = opts.gradeLetters || { S:520, A:380, B:260, C:160 };
    this._deltaClamp = { min:-100, max:200 };
    this._handlers = { change:null };
    this._boostFn = null; this._comboGetter=null; this._feverGetter=null;
  }
  reset(){ this.value=0; this.combo=0; this.bestCombo=0; this._emit(); }
  add(n=10, meta={}){ let delta=n|0; const extra=this._boostFn?(this._boostFn(n)|0):0; delta+=extra;
    delta=Math.max(this._deltaClamp.min, Math.min(this._deltaClamp.max, delta));
    if (delta>0){ this.combo+=1; if(this.combo>this.bestCombo) this.bestCombo=this.combo|0; } else if (delta<0){ this.combo=0; }
    const before=this.value|0; this.value=before+delta; this._emit({delta,meta}); }
  addPenalty(n=8, meta={}){ const dec=Math.max(0,n|0); const before=this.value|0; this.value=Math.max(0,before-dec); this.combo=0; this._emit({delta:(this.value-before), meta:{...meta,penalty:true}}); }
  get(){ return this.value|0; }
  addKind(kind, meta={}){ const k=String(kind||'').toLowerCase(); let base=this.base[k]; if (typeof base!=='number') base=0;
    if (k==='bad'||base<0){ this.addPenalty(Math.abs(base)||8,{kind:k,...meta}); return; }
    const comboNow=this._comboGetter?(this._comboGetter()|0):this.combo|0;
    let mul=1; if (comboNow>1 && base>0) mul=Math.min(this.comboMulCap, 1+(Math.max(0,comboNow-1)*this.comboStep));
    const fever01=this._feverGetter?Math.max(0,Math.min(1,+this._feverGetter()||0)):0;
    const feverBonus=base>0?Math.round(base*this.feverBonusMax*fever01):0;
    const raw=Math.round(base*mul)+feverBonus; this.add(raw,{kind:k,comboNow,mul,fever01,...meta});
  }
  setBoostFn(fn){ this._boostFn=(typeof fn==='function')?fn:null; }
  setHandlers(h={}){ this._handlers={...this._handlers,...h}; }
  setComboGetter(fn){ this._comboGetter=(typeof fn==='function')?fn:null; }
  setFeverGetter(fn){ this._feverGetter=(typeof fn==='function')?fn:null; }
  getGrade(){ const s=this.value|0, br=this.gradeBreaks;
    const stars=(s>=br[4])?5:(s>=br[3])?4:(s>=br[2])?3:(s>=br[1])?2:(s>=br[0])?1:0;
    const gl=this.gradeLetters; const letter=(s>=gl.S)?'S':(s>=gl.A)?'A':(s>=gl.B)?'B':(s>=gl.C)?'C':'D';
    return { score:s, stars, grade:letter }; }
  _emit(payload={}){ try{ this._handlers.change?.(this.value|0, payload);}catch{} }
}
