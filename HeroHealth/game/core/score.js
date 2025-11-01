// === core/score.js (unified v2.2: PowerUp v3-aware + HUD hooks + accuracy + legacy-safe)
export class ScoreSystem {
  constructor(opts) {
    opts = opts || {};
    this.base = { ok:4, good:10, perfect:18, bad:-6 };
    if (opts.base && typeof opts.base==='object') {
      for (var k in opts.base) this.base[k]=opts.base[k];
    }

    // score / combo
    this.value = 0;
    this.combo = 0;
    this.bestCombo = 0;

    // multipliers / bonuses
    this.comboStep = 0.03;   // +3% per combo step
    this.comboMulCap = 1.30; // max +30%
    this.feverBonusMax = 0.10; // up to +10% of base while "fever"

    // grades
    this.gradeBreaks  = opts.gradeBreaks  || [120,240,360,480,600];
    this.gradeLetters = opts.gradeLetters || { S:520, A:380, B:260, C:160 };

    // clamps
    this._deltaClamp = { min:-100, max:200 };

    // hooks
    this._handlers = { change:null };
    this._boostFn = null;
    this._comboGetter = null;
    this._feverGetter = null;

    // optional bindings (HUD/Power/Progress)
    this._hud = null;
    this._progress = null;

    // accuracy tracker
    this._hits = { good:0, perfect:0, bad:0, total:0 };
  }

  /* -------------------- Public API -------------------- */

  reset(){
    this.value=0; this.combo=0; this.bestCombo=0;
    this._hits.good=0; this._hits.perfect=0; this._hits.bad=0; this._hits.total=0;
    this._emit();
  }

  /** Attach optional systems in one call.
   * opts: { power?:PowerUpSystemV3, hud?:createHUD(), progress?:Progress }
   */
  bind(opts){
    opts = opts || {};
    this._hud = opts.hud || null;
    this._progress = opts.progress || null;

    // Wire with PowerUp v3
    var power = opts.power;
    if (power && typeof power.onChange==='function') {
      // boost function already handled via PowerUpSystem.attachToScore,
      // but we also want a fever getter mapping from timers
      var self=this;
      power.onChange(function(t){
        try{
          // t: {x2,freeze,sweep,shield,shieldCount}
          // Map to 0..1 fever intensity (1 if any of x2/sweep active)
          var fever = 0;
          if (t){
            if ((t.x2|0)>0) fever = 1;
            else if ((t.sweep|0)>0) fever = 1;
          }
          self.setFeverGetter(function(){ return fever; });
        }catch(_e){}
      });
      // Also let PowerUp feed dynamic boosts into scoring
      try{ power.attachToScore && power.attachToScore(this); }catch(_e){}
    }

    // Reflect immediately
    this._emit();
    return this;
  }

  setHandlers(h){
    if (!h) return;
    for (var k in h){ this._handlers[k]=h[k]; }
  }

  setBoostFn(fn){ this._boostFn=(typeof fn==='function')?fn:null; }
  setComboGetter(fn){ this._comboGetter=(typeof fn==='function')?fn:null; }
  setFeverGetter(fn){ this._feverGetter=(typeof fn==='function')?fn:null; }

  /** Add raw delta (after multipliers already applied) */
  add(n, meta){
    n = n|0; meta = meta||{};
    var extra = 0;
    try{ if (this._boostFn) extra = (this._boostFn(n)|0); }catch(_e){ extra=0; }
    var delta = n + extra;
    if (delta < this._deltaClamp.min) delta = this._deltaClamp.min;
    if (delta > this._deltaClamp.max) delta = this._deltaClamp.max;

    if (delta>0){
      this.combo += 1;
      if ((this.combo|0) > (this.bestCombo|0)) this.bestCombo = this.combo|0;
    } else if (delta<0){
      this.combo = 0;
    }

    var before = this.value|0;
    this.value = before + delta;
    this._emit({ delta:delta, meta:meta });
  }

  /** Soft penalty (does not go below 0), resets combo */
  addPenalty(n, meta){
    n = Math.max(0, n|0);
    var before = this.value|0;
    var after = Math.max(0, before - n);
    this.value = after;
    this.combo = 0;
    meta = meta||{};
    meta.penalty = true;
    this._emit({ delta:(after-before), meta:meta });
  }

  /** Add by semantic kind: ok/good/perfect/bad */
  addKind(kind, meta){
    kind = String(kind||'').toLowerCase();
    meta = meta||{};

    // base points
    var base = this.base[kind];
    if (typeof base!=='number') base = 0;

    if (kind==='bad' || base<0){
      // register accuracy
      this._accMark('bad');
      this.addPenalty(Math.abs(base)||8, { kind:kind });
      return;
    }

    // current combo
    var comboNow = (this._comboGetter ? (this._comboGetter()|0) : (this.combo|0));
    var mul = 1;
    if (comboNow>1 && base>0){
      mul = 1 + (Math.max(0, comboNow-1) * this.comboStep);
      if (mul > this.comboMulCap) mul = this.comboMulCap;
    }

    // fever bonus (0..1)
    var fever01 = 0;
    try{
      if (this._feverGetter){
        var fv = +this._feverGetter() || 0;
        if (fv<0) fv=0; if (fv>1) fv=1;
        fever01 = fv;
      }
    }catch(_e){ fever01 = 0; }
    var feverBonus = base>0 ? Math.round(base*this.feverBonusMax*fever01) : 0;

    var raw = Math.round(base*mul) + feverBonus;

    // register accuracy
    if (kind==='perfect') this._accMark('perfect');
    else if (kind==='good' || kind==='ok') this._accMark('good');

    this.add(raw, { kind:kind, comboNow:comboNow, mul:mul, fever01:fever01 });
  }

  /** Get current numeric score */
  get(){ return this.value|0; }

  /** Accuracy percent (0–100), based on perfect/good vs total click outcomes */
  getAccuracy(){
    var t=this._hits.total|0;
    if (t<=0) return 0;
    var goodish=(this._hits.good|0)+(this._hits.perfect|0);
    return Math.round(100 * goodish / t);
  }

  /** Current grade & stars snapshot */
  getGrade(){
    var s=this.value|0, br=this.gradeBreaks;
    var stars = (s>=br[4])?5:(s>=br[3])?4:(s>=br[2])?3:(s>=br[1])?2:(s>=br[0])?1:0;
    var gl=this.gradeLetters;
    var letter=(s>=gl.S)?'S':(s>=gl.A)?'A':(s>=gl.B)?'B':(s>=gl.C)?'C':'D';
    return { score:s, stars:stars, grade:letter, acc:this.getAccuracy(), bestCombo:this.bestCombo|0 };
  }

  /* -------------------- Internals -------------------- */

  _accMark(kind){
    // Update accuracy counters
    this._hits.total = (this._hits.total|0) + 1;
    if (kind==='bad') this._hits.bad = (this._hits.bad|0) + 1;
    else if (kind==='perfect') this._hits.perfect = (this._hits.perfect|0) + 1;
    else this._hits.good = (this._hits.good|0) + 1;
  }

  _emit(payload){
    payload = payload||{};
    // 1) external handler
    try{
      if (this._handlers && typeof this._handlers.change==='function'){
        this._handlers.change(this.value|0, payload);
      }
    }catch(_e){}

    // 2) HUD reflection (best-effort)
    try{
      if (this._hud && typeof this._hud.updateScore==='function'){
        // hud.updateScore(score, combo, timeLeft?) — third param is optional
        this._hud.updateScore(this.value|0, this.combo|0, 0);
      }
    }catch(_e){}

    // 3) Progress notify (score tick / combo best)
    try{
      if (this._progress && typeof this._progress.notify==='function'){
        this._progress.notify('score_tick', { score:this.value|0 });
        this._progress.notify('combo_best', { value:this.bestCombo|0 });
      }
    }catch(_e){}
  }
}
