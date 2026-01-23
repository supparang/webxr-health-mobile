// === /herohealth/vr-groups/ai-predictor.js ===
// GroupsVR Predictor (ML/DL-ready)
// ✅ collects gameplay signals from existing events
// ✅ runs every 1s (low cost) -> DLModel.predict()
// ✅ emits: ai:prediction {riskMiss, accNextPct, recommend, source, features}
// ✅ optional: micro coaching signal (NOT spamming) via hha:coach if CoachAI wants it later
//
// Feature vector (Float32Array[10]):
// 0 acc (0..1)
// 1 comboNorm (0..1)
// 2 missRate (0..1)
// 3 pressureNorm (0..1)
// 4 stormOn (0/1)
// 5 miniOn (0/1)
// 6 timeLeftNorm (0..1)
// 7 goalPct (0..1)
// 8 powerPct (0..1)
// 9 speedHint (0..1)  (derived)

(function(root){
  'use strict';
  const NS = root.GroupsVR = root.GroupsVR || {};
  const nowMs = ()=> (root.performance && performance.now) ? performance.now() : Date.now();

  function emit(name, detail){
    try{ root.dispatchEvent(new CustomEvent(name,{detail})); }catch(_){}
  }
  function clamp(v,a,b){ v=Number(v); if(!isFinite(v)) v=a; return v<a?a:(v>b?b:v); }

  function Predictor(){
    this.enabled = false;
    this.runMode = 'play';
    this.seed = '0';

    this.tmr = 0;
    this.lastTickAt = 0;

    // state
    this.acc = 0;
    this.combo = 0;
    this.misses = 0;
    this.timeLeft = 90;

    this.pressure = 0;      // 0..3 from groups.safe.js summary/logic
    this.stormOn = 0;       // 0/1
    this.miniOn = 0;        // 0/1

    this.goalPct = 0;
    this.powerCur = 0;
    this.powerThr = 8;

    this.judged = 0;        // approximate (from rank updates)
    this.lastAccAt = 0;

    this._onRank = null;
    this._onScore = null;
    this._onTime = null;
    this._onProg = null;
    this._onQuest = null;
    this._onPower = null;
  }

  Predictor.prototype.attach = function(cfg){
    cfg = cfg || {};
    const rm = String(cfg.runMode||'play').toLowerCase();
    this.runMode = rm;

    this.enabled = !!cfg.enabled && (rm === 'play');
    if (rm === 'research' || rm === 'practice') this.enabled = false;

    this.seed = String(cfg.seed ?? '0');

    this._bind();
    this._startLoop();
  };

  Predictor.prototype.detach = function(){
    this.enabled = false;
    this._unbind();
    if (this.tmr) { clearInterval(this.tmr); this.tmr = 0; }
  };

  Predictor.prototype._bind = function(){
    if (this._onRank) return;

    this._onRank = (ev)=>{
      const d = ev.detail||{};
      const acc = Number(d.accuracy ?? 0);
      this.acc = clamp(acc/100, 0, 1);
      this.lastAccAt = nowMs();
    };
    this._onScore = (ev)=>{
      const d = ev.detail||{};
      this.combo = Number(d.combo ?? 0) | 0;
      this.misses = Number(d.misses ?? 0) | 0;
    };
    this._onTime = (ev)=>{
      const d = ev.detail||{};
      this.timeLeft = Number(d.left ?? this.timeLeft) | 0;
    };
    this._onPower = (ev)=>{
      const d = ev.detail||{};
      this.powerCur = Number(d.charge ?? 0) | 0;
      this.powerThr = Math.max(1, Number(d.threshold ?? this.powerThr) | 0);
    };
    this._onProg = (ev)=>{
      const d = ev.detail||{};
      // storm on/off
      if (d.kind === 'storm_on') this.stormOn = 1;
      if (d.kind === 'storm_off') this.stormOn = 0;
      // pressure
      if (d.kind === 'pressure') this.pressure = Number(d.level ?? this.pressure) | 0;
    };
    this._onQuest = (ev)=>{
      const d = ev.detail||{};
      const gPct = Number(d.goalPct ?? 0);
      this.goalPct = clamp(gPct/100, 0, 1);
      // mini: treat active when miniTimeLeftSec > 0 and miniTotal>1
      const mLeft = Number(d.miniTimeLeftSec ?? 0) | 0;
      this.miniOn = (mLeft > 0) ? 1 : 0;
    };

    root.addEventListener('hha:rank', this._onRank, {passive:true});
    root.addEventListener('hha:score', this._onScore, {passive:true});
    root.addEventListener('hha:time', this._onTime, {passive:true});
    root.addEventListener('groups:power', this._onPower, {passive:true});
    root.addEventListener('groups:progress', this._onProg, {passive:true});
    root.addEventListener('quest:update', this._onQuest, {passive:true});
  };

  Predictor.prototype._unbind = function(){
    if (!this._onRank) return;
    root.removeEventListener('hha:rank', this._onRank);
    root.removeEventListener('hha:score', this._onScore);
    root.removeEventListener('hha:time', this._onTime);
    root.removeEventListener('groups:power', this._onPower);
    root.removeEventListener('groups:progress', this._onProg);
    root.removeEventListener('quest:update', this._onQuest);

    this._onRank = this._onScore = this._onTime = this._onProg = this._onQuest = this._onPower = null;
  };

  Predictor.prototype._startLoop = function(){
    if (this.tmr) clearInterval(this.tmr);
    this.tmr = setInterval(()=>this._tick(), 1000);
    this._tick();
  };

  Predictor.prototype._buildFeatures = function(){
    const f = new Float32Array(10);

    const acc = clamp(this.acc, 0, 1);
    const comboNorm = clamp(this.combo / 12, 0, 1);
    const missRate = clamp(this.misses / 18, 0, 1);
    const pressureNorm = clamp((this.pressure|0) / 3, 0, 1);
    const stormOn = this.stormOn ? 1 : 0;
    const miniOn = this.miniOn ? 1 : 0;
    const timeLeftNorm = clamp(this.timeLeft / 90, 0, 1);
    const goalPct = clamp(this.goalPct, 0, 1);
    const powerPct = clamp(this.powerCur / Math.max(1,this.powerThr), 0, 1);

    // speedHint: (อยากเร่งเมื่อ acc ดี + risk ต่ำ + เวลาเหลือ)
    const speedHint = clamp((acc*0.55 + comboNorm*0.25 + timeLeftNorm*0.20) - (missRate*0.40 + pressureNorm*0.25 + stormOn*0.15), 0, 1);

    f[0]=acc;
    f[1]=comboNorm;
    f[2]=missRate;
    f[3]=pressureNorm;
    f[4]=stormOn;
    f[5]=miniOn;
    f[6]=timeLeftNorm;
    f[7]=goalPct;
    f[8]=powerPct;
    f[9]=speedHint;
    return f;
  };

  Predictor.prototype._tick = function(){
    if (!this.enabled) return;

    const f = this._buildFeatures();

    const DL = NS.DLModel;
    const out = (DL && DL.predict) ? DL.predict(f) : { riskMiss:0.35, accNext:0.55, recommend:0.0, source:'none' };

    const detail = {
      riskMiss: clamp(out.riskMiss, 0, 1),
      accNextPct: Math.round(clamp(out.accNext, 0, 1) * 100),
      recommend: clamp(out.recommend, -1, 1), // -1 slow down, +1 speed up
      source: String(out.source||'unknown'),
      features: Array.from(f).map(x=>+x.toFixed(4))
    };

    emit('ai:prediction', detail);
  };

  NS.Predictor = new Predictor();
})(window);