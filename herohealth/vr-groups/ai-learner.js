// === /herohealth/vr-groups/ai-learner.js ===
// PACK 25: Tiny Online Learner (Bandit-lite + Online Logistic)
// - Learns ONLY in play + ai=1
// - OFF in research / practice
// - Chooses next wave pattern bias (LINE/ARC/BURST/SPIRAL/ZIGZAG) + light storm chance bias
// Emits:
//   groups:ai_feature {x, y, meta}
//   groups:ai_choice  {choice, probs, meta}
// Stores (play only):
//   localStorage: GVR_AI_MODEL_v1  (small)

(function(){
  'use strict';
  const WIN = window;

  // ---- utils ----
  const clamp=(v,a,b)=>{ v=Number(v)||0; return v<a?a:(v>b?b:v); };
  const sigmoid=(x)=> 1/(1+Math.exp(-x));
  const softmax=(z)=>{
    const m = Math.max(...z);
    const ex = z.map(v=>Math.exp(v-m));
    const s = ex.reduce((a,b)=>a+b,0)||1;
    return ex.map(v=>v/s);
  };
  const hash32=(s)=>{
    s=String(s||''); let h=2166136261>>>0;
    for(let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619); }
    return h>>>0;
  };
  const mulberry32=(a)=>()=>{ let t=a+=0x6D2B79F5; t=Math.imul(t^(t>>>15),t|1); t^=t+Math.imul(t^(t>>>7),t|61); return ((t^(t>>>14))>>>0)/4294967296; };

  // ---- gate ----
  function qs(k,d=null){
    try{ return new URL(location.href).searchParams.get(k) ?? d; }catch{ return d; }
  }
  function aiEnabled(){
    const run = String(qs('run','play')||'play').toLowerCase();
    const on  = String(qs('ai','0')||'0');
    if (run === 'research') return false;
    return (on === '1' || on === 'true');
  }
  function runMode(){
    const r = String(qs('run','play')||'play').toLowerCase();
    if (r === 'research') return 'research';
    if (r === 'practice') return 'practice';
    return 'play';
  }

  // ---- model ----
  const LS_KEY = 'GVR_AI_MODEL_v1';

  // Actions = wave types
  const ACTIONS = ['LINE','ARC','BURST','SPIRAL','ZIGZAG'];

  // Feature vector x (8 dims) – bounded 0..1 where possible
  // x = [
  //  missRate10s, accBad, comboLow, leftLow, storm, miniUrg, speedHigh, fatigue
  // ]
  const D = 8;

  // Online logistic per-action: w[action][D] + b[action]
  function freshWeights(){
    const w = {};
    for (const a of ACTIONS) w[a] = Array(D).fill(0);
    const b = {};
    for (const a of ACTIONS) b[a] = 0;
    return { w, b };
  }

  function loadModel(){
    try{
      const obj = JSON.parse(localStorage.getItem(LS_KEY)||'null');
      if (!obj || !obj.w || !obj.b) return null;
      // quick sanity
      for (const a of ACTIONS){
        if (!Array.isArray(obj.w[a]) || obj.w[a].length!==D) return null;
        if (typeof obj.b[a] !== 'number') return null;
      }
      return obj;
    }catch{ return null; }
  }

  function saveModel(m){
    try{ localStorage.setItem(LS_KEY, JSON.stringify(m)); }catch{}
  }

  // ---- learner state ----
  const Learner = {
    on:false,
    seedStr:'0',
    rng: ()=>Math.random(),
    model: freshWeights(),
    // telemetry history (for features)
    hist: [],
    maxHist: 24,
    lastChoice: null,
    lastChoiceAtSec: 0,
    // fairness guards
    eps: 0.12,           // exploration
    lr: 0.18,            // learning rate (small)
    reg: 0.0015,         // L2 regularization (small)
    stormBias: 0.0,      // learned storm tendency (-0.08..+0.10)
    stormBiasClip: [-0.08, 0.10],

    attach({ seed, enabled, runMode }){
      this.on = !!enabled && String(runMode||'play')==='play';
      if (!this.on) return;

      this.seedStr = String(seed||Date.now());
      this.rng = mulberry32(hash32('GVR-L25:'+this.seedStr));

      // load or init
      const m = loadModel();
      this.model = m || freshWeights();

      this.hist.length = 0;
      this.lastChoice = null;
      this.lastChoiceAtSec = 0;
      this.stormBias = clamp((this.model.stormBias||0), this.stormBiasClip[0], this.stormBiasClip[1]);

      try{
        WIN.dispatchEvent(new CustomEvent('groups:ai_choice', { detail:{ choice:'READY', probs:{}, meta:{ seed:this.seedStr } } }));
      }catch(_){}
    },

    stop(){
      this.on = false;
    },

    pushTelemetry(t){
      // t: {sec, miss, acc, combo, left, storm, miniUrg, shots10s?}
      this.hist.push(t);
      if (this.hist.length > this.maxHist) this.hist.shift();
    },

    missRate10s(nowSec){
      // uses miss delta /10sec if enough history
      const cut = nowSec - 10;
      const a = this.hist.filter(x=>x.sec>=cut);
      if (a.length < 2) return 0;
      const dm = (a[a.length-1].miss - a[0].miss);
      return Math.max(0, dm) / 10; // miss/sec
    },

    // feature extractor (0..1)
    features(now){
      const missRate = clamp(this.missRate10s(now.sec)*2.2, 0, 1);     // normalize
      const accBad   = clamp((100 - (now.acc||0))/100, 0, 1);
      const comboLow = clamp(1 - clamp((now.combo||0)/10, 0, 1), 0, 1);
      const leftLow  = clamp((12 - (now.left||0))/12, 0, 1);
      const storm    = now.storm ? 1 : 0;
      const miniU    = now.miniUrg ? 1 : 0;

      // speedHigh: ถ้ายิงถี่แต่ miss สูง → รีบ (proxy)
      const speedHigh = clamp(missRate*0.65 + (now.shots10s||0)/10*0.55, 0, 1);

      // fatigue: ใกล้ท้ายเกม + accBad สูง
      const fatigue = clamp(leftLow*0.55 + accBad*0.35, 0, 1);

      const x = [missRate, accBad, comboLow, leftLow, storm, miniU, speedHigh, fatigue];

      try{
        WIN.dispatchEvent(new CustomEvent('groups:ai_feature', { detail:{ x, y:null, meta:{ sec:now.sec } } }));
      }catch(_){}

      return x;
    },

    // score each action by logistic (higher = better expected outcome)
    scoreAction(a, x){
      const w = this.model.w[a];
      const b = this.model.b[a];
      let z = b;
      for (let i=0;i<D;i++) z += (w[i]||0) * (x[i]||0);
      return z;
    },

    chooseAction(now){
      if (!this.on) return null;

      const x = this.features(now);
      const z = ACTIONS.map(a=> this.scoreAction(a, x));
      let p = softmax(z);

      // fairness: keep floor probability
      p = p.map(v=> clamp(v, 0.06, 0.70));
      // renormalize
      const s = p.reduce((a,b)=>a+b,0)||1;
      p = p.map(v=>v/s);

      // epsilon-greedy exploration
      const r = this.rng();
      let choice = null;
      if (r < this.eps){
        choice = ACTIONS[Math.floor(this.rng()*ACTIONS.length)];
      }else{
        // sample by p
        let u = this.rng(), cum=0;
        for (let i=0;i<ACTIONS.length;i++){
          cum += p[i];
          if (u <= cum){ choice = ACTIONS[i]; break; }
        }
        choice = choice || ACTIONS[ACTIONS.length-1];
      }

      const probs = {};
      for (let i=0;i<ACTIONS.length;i++) probs[ACTIONS[i]] = Math.round(p[i]*1000)/1000;

      this.lastChoice = { choice, x, probs, atSec: now.sec };
      this.lastChoiceAtSec = now.sec;

      try{
        WIN.dispatchEvent(new CustomEvent('groups:ai_choice', { detail:{ choice, probs, meta:{ sec:now.sec } } }));
      }catch(_){}

      return choice;
    },

    // reward y: +1 if improved (acc up / miss down / combo up) in last window; else 0
    reward(now){
      const a = this.hist;
      if (a.length < 6) return 0;
      const t1 = a[a.length-1];
      const t0 = a[Math.max(0, a.length-6)];
      const dAcc = (t1.acc - t0.acc);
      const dMiss= (t1.miss - t0.miss);
      const dCombo= (t1.combo - t0.combo);

      // success if accuracy improves OR miss does not increase and combo increases
      const ok = (dAcc >= 2) || (dMiss <= 0 && dCombo >= 2);
      return ok ? 1 : 0;
    },

    // online update after a segment (wave) ends
    updateAfterWave(now){
      if (!this.on || !this.lastChoice) return;

      // only update if enough time passed
      if ((now.sec - this.lastChoice.atSec) < 6) return;

      const y = this.reward(now); // 0/1
      const a = this.lastChoice.choice;
      const x = this.lastChoice.x;

      // logistic gradient for chosen action: pred = sigmoid(z)
      const z = this.scoreAction(a, x);
      const pred = sigmoid(z);
      const err = (y - pred); // gradient ascent on log-likelihood

      // w <- w + lr*(err*x - reg*w)
      const w = this.model.w[a];
      for (let i=0;i<D;i++){
        w[i] = (w[i]||0) + this.lr * (err*(x[i]||0) - this.reg*(w[i]||0));
        // clip weights to stay tiny (avoid extreme behavior)
        w[i] = clamp(w[i], -2.2, 2.2);
      }
      this.model.b[a] = clamp((this.model.b[a]||0) + this.lr*(err - this.reg*(this.model.b[a]||0)), -1.4, 1.4);

      // storm bias: if y==0 and storm active often → reduce slightly, else increase slightly
      const storm = now.storm ? 1 : 0;
      this.stormBias += this.lr * ( (y? +0.03 : -0.04) * (storm?1:0) );
      this.stormBias = clamp(this.stormBias, this.stormBiasClip[0], this.stormBiasClip[1]);
      this.model.stormBias = this.stormBias;

      saveModel(this.model);

      try{
        WIN.dispatchEvent(new CustomEvent('groups:ai_feature', { detail:{ x, y, meta:{ update:true, choice:a, sec:now.sec } } }));
      }catch(_){}

      // reset lastChoice so we don't over-update
      this.lastChoice = null;
    },

    // expose storm bias for PatternGen
    getStormBias(){
      return this.on ? this.stormBias : 0;
    }
  };

  // expose
  WIN.GroupsVR = WIN.GroupsVR || {};
  WIN.GroupsVR.AILearner = Learner;
})();