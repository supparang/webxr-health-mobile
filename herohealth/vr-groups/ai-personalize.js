// === /herohealth/vr-groups/ai-personalize.js ===
// PACK 22: Online Personalization (Calibration 30s / 25 shots) — PLAY only
// ✅ Builds player profile: skill / haste / confuse / needsHelp
// ✅ Emits: groups:ai_profile {phase:'calib'|'locked', profile, metrics}
// ✅ Safe: auto OFF in research/practice (caller should gate)

(function(){
  'use strict';
  const WIN = window, DOC = document;

  const clamp=(v,a,b)=>{ v=Number(v)||0; return v<a?a:(v>b?b:v); };
  const nowMs=()=> (performance && performance.now) ? performance.now() : Date.now();

  const Personalize = {
    enabled:false,
    phase:'off',           // off | calib | locked
    t0:0,
    timeLimitMs:30000,
    shotLimit:25,

    // live stats
    shots:0,
    miss:0,
    score:0,
    acc:0,
    combo:0,

    judges:0,
    wrongGroup:0,

    // pace stats
    lastShotAt:0,
    dtShots:[],            // last N shot intervals (ms)
    maxDtKeep:16,

    // derived profile
    profile:{
      skill:0.5,
      haste:0.5,
      confuse:0.5,
      needsHelp:0.5
    },

    // derived metrics (debug)
    metrics:{
      shotsPerSec:0,
      missRate10s:0,
      wrongRate:0,
      dtVar:0,
      accBad:0
    },

    _it:0,
    _lastEmitAt:0,

    attach(opts){
      const runMode = String(opts?.runMode||'play');
      const enabled = !!opts?.enabled;

      // caller should already gate, but double-safety:
      if (!enabled || runMode !== 'play'){
        this.disable();
        return;
      }

      this.enabled = true;
      this.phase = 'calib';
      this.t0 = nowMs();
      this.shots=0; this.miss=0; this.score=0; this.acc=0; this.combo=0;
      this.judges=0; this.wrongGroup=0;
      this.lastShotAt=0; this.dtShots.length=0;

      this._bindEvents();
      clearInterval(this._it);
      this._it = setInterval(()=> this._tick(), 500);

      this._emitProfile(true);
    },

    disable(){
      this.enabled=false;
      this.phase='off';
      clearInterval(this._it);
      this._it=0;
    },

    _bindEvents(){
      // prevent multiple bind
      if (WIN.__GVR_P22_BOUND__) return;
      WIN.__GVR_P22_BOUND__ = true;

      WIN.addEventListener('hha:shoot', ()=>{
        if (!Personalize.enabled) return;
        const t = nowMs();
        if (Personalize.lastShotAt){
          const dt = t - Personalize.lastShotAt;
          if (dt>0 && dt<4000){
            Personalize.dtShots.push(dt);
            if (Personalize.dtShots.length > Personalize.maxDtKeep) Personalize.dtShots.shift();
          }
        }
        Personalize.lastShotAt = t;
        Personalize.shots = (Personalize.shots|0) + 1;
      }, {passive:true});

      WIN.addEventListener('hha:score', (ev)=>{
        if (!Personalize.enabled) return;
        const d = ev.detail||{};
        Personalize.score = Number(d.score ?? Personalize.score) || 0;
        Personalize.combo = Number(d.combo ?? Personalize.combo) || 0;
        Personalize.miss  = Number(d.misses ?? Personalize.miss) || 0;
      }, {passive:true});

      WIN.addEventListener('hha:rank', (ev)=>{
        if (!Personalize.enabled) return;
        const d = ev.detail||{};
        Personalize.acc = Number(d.accuracy ?? Personalize.acc) || 0;
      }, {passive:true});

      WIN.addEventListener('hha:judge', (ev)=>{
        if (!Personalize.enabled) return;
        const d = ev.detail||{};
        Personalize.judges = (Personalize.judges|0) + 1;
        const reason = String(d.reason||'');
        if (reason.includes('wrong_group')) Personalize.wrongGroup = (Personalize.wrongGroup|0) + 1;
      }, {passive:true});

      WIN.addEventListener('hha:end', ()=>{
        if (!Personalize.enabled) return;
        // lock on end to preserve summary usage
        Personalize._lock();
      }, {passive:true});
    },

    _calcDtVar(){
      const a = this.dtShots;
      if (a.length < 4) return 0;
      const m = a.reduce((s,x)=>s+x,0)/a.length;
      const v = a.reduce((s,x)=>s+(x-m)*(x-m),0)/a.length;
      // normalize (0..1): 0 stable, 1 very unstable
      return clamp(Math.sqrt(v)/800, 0, 1);
    },

    _calcShotsPerSec(){
      const t = nowMs();
      const dt = Math.max(1, t - this.t0);
      return clamp((this.shots / (dt/1000)), 0, 6);
    },

    _calcMissRate10s(){
      // ใช้ miss/เวลาแบบหยาบในช่วง calib (พอสำหรับ personalization)
      const t = nowMs();
      const dt = Math.max(1, t - this.t0);
      const missPerSec = (this.miss / (dt/1000));
      return clamp(missPerSec, 0, 1);
    },

    _calcWrongRate(){
      if (this.judges <= 0) return 0;
      return clamp(this.wrongGroup / this.judges, 0, 1);
    },

    _buildProfile(){
      const shotsPerSec = this._calcShotsPerSec();          // 0..6
      const missRate10s = this._calcMissRate10s();          // 0..1
      const wrongRate   = this._calcWrongRate();            // 0..1
      const dtVar       = this._calcDtVar();                // 0..1
      const accBad      = clamp((100 - this.acc)/100, 0, 1);

      this.metrics = {
        shotsPerSec,
        missRate10s,
        wrongRate,
        dtVar,
        accBad
      };

      // haste: ยิงถี่ + dt แกว่ง (ยิงมั่ว) + miss สูง
      const haste = clamp(
        (shotsPerSec/4.0)*0.45 + dtVar*0.30 + missRate10s*0.25,
        0, 1
      );

      // confuse: wrongRate + accBad (สนับสนุนกัน)
      const confuse = clamp(
        wrongRate*0.70 + accBad*0.30,
        0, 1
      );

      // skill: acc ดี + miss ต่ำ + haste ต่ำ
      const skill = clamp(
        (1-accBad)*0.55 + (1-missRate10s)*0.25 + (1-haste)*0.20,
        0, 1
      );

      // needsHelp: confuse + haste + accBad (รวม)
      const needsHelp = clamp(
        confuse*0.45 + haste*0.30 + accBad*0.25,
        0, 1
      );

      // smooth (EMA) กันสวิง
      const ema = (oldv, newv, k=0.35)=> oldv*(1-k)+newv*k;
      this.profile = {
        skill: ema(this.profile.skill, skill),
        haste: ema(this.profile.haste, haste),
        confuse: ema(this.profile.confuse, confuse),
        needsHelp: ema(this.profile.needsHelp, needsHelp)
      };
    },

    _lock(){
      if (!this.enabled) return;
      this.phase = 'locked';
      this._emitProfile(true);
    },

    _emitProfile(force=false){
      const t = nowMs();
      if (!force && (t - this._lastEmitAt) < 1200) return;
      this._lastEmitAt = t;

      try{
        WIN.dispatchEvent(new CustomEvent('groups:ai_profile', {
          detail:{
            phase:this.phase,
            profile:Object.assign({}, this.profile),
            metrics:Object.assign({}, this.metrics),
            shots:this.shots|0,
            miss:this.miss|0,
            acc:this.acc|0,
            wrongGroup:this.wrongGroup|0,
            judges:this.judges|0
          }
        }));
      }catch(_){}
    },

    _tick(){
      if (!this.enabled) return;

      this._buildProfile();
      this._emitProfile(false);

      // stop calib conditions
      const t = nowMs();
      const timeUp = (t - this.t0) >= this.timeLimitMs;
      const shotUp = (this.shots|0) >= this.shotLimit;

      if (this.phase === 'calib' && (timeUp || shotUp)){
        this._lock();
      }
    },

    // public getter for other scripts
    getProfile(){ return Object.assign({}, this.profile); },
    getPhase(){ return this.phase; }
  };

  WIN.GroupsVR = WIN.GroupsVR || {};
  WIN.GroupsVR.Personalize = Personalize;
})();