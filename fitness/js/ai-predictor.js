// === /fitness/js/ai-predictor.js ===
// Rhythm Boxer AI Predictor (Lite ML/DL-style heuristic, deterministic-friendly)
// ✅ fatigueRisk 0..1
// ✅ skillScore  0..1
// ✅ suggestedDifficulty: easy|normal|hard
// ✅ micro-tip (rate-limited)
// ✅ onUpdate(cb)

'use strict';

(function(){
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const now=()=>{ try{return performance.now();}catch(_){return Date.now();} };

  class AiPredictorRB{
    constructor(opts={}){
      this.enabled = !!opts.enabled;
      this.mode = opts.mode || 'normal';
      this.rateMs = opts.rateMs || 800;  // update frequency
      this.tipMs  = opts.tipMs  || 2500; // tip rate limit
      this.cb = null;

      this.reset();
    }

    reset(){
      this.t0 = now();
      this.lastEmit = 0;
      this.lastTip = 0;

      // rolling windows
      this.win = []; // {t, hit, judge, absOff, dt, blank, hp, combo}
      this.winSec = 10.0;

      // outputs
      this.fatigueRisk = 0;
      this.skillScore = 0.5;
      this.suggestedDifficulty = 'normal';
      this.tip = '';
    }

    onUpdate(cb){ this.cb = (typeof cb==='function')?cb:null; }

    setEnabled(v){ this.enabled = !!v; }

    pushEvent(e){
      if(!this.enabled) return;

      // e: {songTime, isHit, judgment, absOffset, rawOffset, blankTap, hp, combo}
      const t = Number(e.songTime)||0;
      this.win.push({
        t,
        hit: e.isHit?1:0,
        judge: e.judgment||'',
        absOff: Number(e.absOffset)||0,
        dt: Number(e.rawOffset)||0,
        blank: e.blankTap?1:0,
        hp: Number(e.hp)||0,
        combo: Number(e.combo)||0
      });

      // trim window
      const minT = t - this.winSec;
      while(this.win.length && this.win[0].t < minT) this.win.shift();

      const ts = now();
      if(ts - this.lastEmit >= this.rateMs){
        this.lastEmit = ts;
        this._recalcAndEmit(t);
      }
    }

    _recalcAndEmit(songTime){
      const w = this.win;
      if(!w.length) return;

      const n = w.length;
      const hitN = w.reduce((s,x)=>s+x.hit,0);
      const missN = n - hitN;

      const absMean = w.reduce((s,x)=>s+x.absOff,0)/n;
      const blankN = w.reduce((s,x)=>s+x.blank,0);

      // ความเสถียร: variance ของ abs offset (ใช้ mean square แบบง่าย)
      const m = absMean;
      const varAbs = w.reduce((s,x)=>{ const d=x.absOff-m; return s+d*d; },0)/Math.max(1,n);
      const jitter = Math.sqrt(varAbs); // 0..?

      // proxy: skill สูงเมื่อ hit rate สูง + abs offset ต่ำ + jitter ต่ำ + combo เฉลี่ยสูง
      const hitRate = hitN / Math.max(1,n);
      const comboAvg = w.reduce((s,x)=>s+x.combo,0)/n;

      // normalize (heuristic)
      const offScore = 1 - clamp(absMean/0.18, 0, 1);     // 0.18s ~ แย่
      const jitScore = 1 - clamp(jitter/0.14, 0, 1);      // jitter 0.14 ~ แย่
      const comboScore = clamp(comboAvg/18, 0, 1);

      let skill = 0.45*hitRate + 0.25*offScore + 0.15*jitScore + 0.15*comboScore;
      skill = clamp(skill, 0, 1);

      // fatigue risk: miss เพิ่ม, blank เพิ่ม, jitter เพิ่ม, hp ต่ำ
      const hpNow = w[w.length-1].hp;
      const hpRisk = 1 - clamp(hpNow/100, 0, 1);
      let fatigue = 0.40*clamp(missN/Math.max(1,n),0,1) + 0.20*clamp(blankN/Math.max(1,n),0,1) +
                    0.20*(1-jitScore) + 0.20*hpRisk;
      fatigue = clamp(fatigue, 0, 1);

      // suggested difficulty (ทำให้ “แฟร์”)
      let sug = 'normal';
      if(skill > 0.78 && fatigue < 0.38) sug = 'hard';
      else if(skill < 0.42 || fatigue > 0.70) sug = 'easy';

      // tip (rate limited)
      let tip = '';
      const ts = now();
      if(ts - this.lastTip >= this.tipMs){
        this.lastTip = ts;
        if(fatigue > 0.75) tip = 'พักมือ 3–5 วิ แล้วกลับมาเน้น “ตรงจังหวะ” มากกว่ากดรัว';
        else if(blankN >= 2) tip = 'อย่ากดรัว—รอให้โน้ตใกล้เส้นตี แล้วแตะ “จังหวะเดียว”';
        else if(absMean > 0.14) tip = 'ลองช้าลงนิด: แตะตอนโน้ต “ทับเส้นตี” จะได้ Perfect มากขึ้น';
        else if(skill > 0.80 && hitRate > 0.85) tip = 'ดีมาก! ลองคุมคอมโบยาว ๆ แล้วรอช่วง Storm ให้พีก';
        else tip = ''; // เงียบได้
      }

      this.skillScore = skill;
      this.fatigueRisk = fatigue;
      this.suggestedDifficulty = sug;
      this.tip = tip;

      if(this.cb){
        this.cb({
          songTime,
          fatigueRisk: this.fatigueRisk,
          skillScore: this.skillScore,
          suggestedDifficulty: this.suggestedDifficulty,
          tip: this.tip
        });
      }
    }
  }

  window.AiPredictorRB = AiPredictorRB;
})();