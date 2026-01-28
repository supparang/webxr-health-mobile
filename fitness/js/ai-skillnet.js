// === /fitness/js/ai-skillnet.js ===
// Tiny "Deep Learning feel" net (2-layer MLP) trained online (SGD)
// Predicts probability of HIT given features (zone/type/storm/diff + recent performance)
'use strict';

function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }
const sigmoid = (x)=> 1/(1+Math.exp(-x));

function randn(){
  // quick-ish random normal-ish
  let u=0,v=0; while(u===0) u=Math.random(); while(v===0) v=Math.random();
  return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v);
}

export class SkillNet {
  constructor(opts={}){
    // feature count
    this.nIn = 10;
    this.nH  = 12;
    this.lr  = opts.lr ?? 0.08;
    this.l2  = opts.l2 ?? 0.0008;

    // weights
    this.W1 = Array.from({length:this.nH}, ()=> Array.from({length:this.nIn}, ()=> randn()*0.12));
    this.b1 = Array.from({length:this.nH}, ()=> 0);
    this.W2 = Array.from({length:this.nH}, ()=> randn()*0.12);
    this.b2 = 0;

    // rolling stats
    this.roll = {
      n: 0,
      hit: 0,
      miss: 0,
      rtSum: 0
    };

    this.lastPred = 0.5;
  }

  // build features (normalized 0..1-ish)
  featurize(ctx){
    const z = clamp(ctx.zoneId ?? 0, 0, 5);
    const type = String(ctx.type || 'normal');
    const isBoss = !!ctx.isBossFace;
    const storm = !!ctx.inStorm;
    const diff = String(ctx.diff || 'normal');

    const n = this.roll.n || 1;
    const acc = clamp(this.roll.hit / Math.max(1, (this.roll.hit + this.roll.miss)), 0, 1);
    const avgRt = this.roll.n ? (this.roll.rtSum/this.roll.n) : 520;
    const rtN = clamp((avgRt - 220)/(750-220), 0, 1);

    const tBomb  = (type==='bomb'  || type==='decoy') ? 1 : 0;
    const tHeal  = (type==='heal') ? 1 : 0;
    const tShield= (type==='shield') ? 1 : 0;
    const tNorm  = (type==='normal') ? 1 : 0;

    const dEasy  = (diff==='easy') ? 1 : 0;
    const dHard  = (diff==='hard') ? 1 : 0;

    // zone as 0..1
    const zN = z/5;

    return [
      1,            // bias
      zN,
      tNorm,
      tBomb,
      tHeal,
      tShield,
      isBoss ? 1 : 0,
      storm ? 1 : 0,
      dEasy,
      dHard,
      // (acc, rtN) folded into bias by adapting weights via training signal;
      // but we can also inject into bias by overriding bias input (1) via acc later if needed
    ];
  }

  forward(x){
    // hidden: relu
    const h = new Array(this.nH);
    for (let i=0;i<this.nH;i++){
      let s = this.b1[i];
      const wi = this.W1[i];
      for (let j=0;j<this.nIn;j++) s += wi[j]*x[j];
      h[i] = s > 0 ? s : 0;
    }
    let o = this.b2;
    for (let i=0;i<this.nH;i++) o += this.W2[i]*h[i];
    const p = sigmoid(o);
    return { h, p };
  }

  predict(ctx){
    const x = this.featurize(ctx);
    const { p } = this.forward(x);
    this.lastPred = p;
    return p;
  }

  updateRolling(ev){
    // ev: {hit:boolean, rtMs?:number}
    this.roll.n++;
    if (ev.hit) this.roll.hit++;
    else this.roll.miss++;
    if (ev.rtMs!=null) this.roll.rtSum += Number(ev.rtMs)||0;

    // keep window-ish (soft)
    if (this.roll.n > 120){
      this.roll.n = Math.round(this.roll.n*0.72);
      this.roll.hit = Math.round(this.roll.hit*0.72);
      this.roll.miss = Math.round(this.roll.miss*0.72);
      this.roll.rtSum = this.roll.rtSum*0.72;
    }
  }

  train(ctx, y){
    // y: 1 hit, 0 miss/timeout
    y = y ? 1 : 0;
    const x = this.featurize(ctx);
    const { h, p } = this.forward(x);

    // BCE grad: (p - y)
    const g = (p - y);

    // update W2/b2
    for (let i=0;i<this.nH;i++){
      const gradW2 = g * h[i] + this.l2 * this.W2[i];
      this.W2[i] -= this.lr * gradW2;
    }
    this.b2 -= this.lr * g;

    // backprop to hidden (relu)
    for (let i=0;i<this.nH;i++){
      const dh = g * this.W2[i];
      if (h[i] <= 0) continue;

      const wi = this.W1[i];
      for (let j=0;j<this.nIn;j++){
        const gradW1 = dh * x[j] + this.l2 * wi[j];
        wi[j] -= this.lr * gradW1;
      }
      this.b1[i] -= this.lr * dh;
    }

    // rolling update
    this.updateRolling({ hit: y===1, rtMs: ctx.rtMs });

    this.lastPred = p;
    return p;
  }

  // skill score 0..1 (for difficulty director)
  skillScore(){
    const acc = clamp(this.roll.hit / Math.max(1,(this.roll.hit+this.roll.miss)), 0, 1);
    const avgRt = this.roll.n ? (this.roll.rtSum/this.roll.n) : 520;
    const rtN = clamp((avgRt - 220)/(750-220), 0, 1);
    // faster + accurate => higher
    const score = clamp(0.62*acc + 0.38*(1-rtN), 0, 1);
    return score;
  }
}