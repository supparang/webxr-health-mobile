<script>
/*!
 * EXO_BOOST v1.0.0
 * Systems: DynamicDifficulty / Fever / Missions / Specials / Juice / XP / Season Packs
 * Lightweight, no deps. Persist via localStorage.
 * (c) EXO Team
*/
(function (w){
  "use strict";

  /* ---------- tiny storage helpers ---------- */
  const _get = (k, fb=null) => {
    try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fb; } catch(e){ return fb; }
  };
  const _set = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch(e){} };

  /* ================= Dynamic Difficulty ================= */
  class DynamicDifficulty {
    constructor(opts={}){
      const o = Object.assign({
        baseSpeed: 4.0,       // baseline target speed
        baseSpawn: 600,       // baseline spawn interval (ms)
        minSpawn: 380,        // clamp faster bound
        maxSpawn: 900,        // clamp slower bound
        step: 0.04,           // slope (diffScore -> effect)
        hitBias: +1,          // how much to add on hit
        missBias: -2,         // how much to add on miss
        decay: 0.35           // decay per second back to neutral
      }, opts);
      Object.assign(this, o);
      this.diffScore = 0;     // + hard / - easy
    }
    onHit(){ this.diffScore += this.hitBias; }
    onMiss(){ this.diffScore += this.missBias; }
    getSpeedMul(){
      const x = this.diffScore * this.step;
      return 1 + Math.max(-0.35, Math.min(0.65, x));
    }
    getSpawnIv(){
      const x = this.diffScore * this.step;
      const f = 1 - Math.max(-0.35, Math.min(0.65, x)); // higher skill -> smaller iv
      const iv = this.baseSpawn * f;
      return Math.round(Math.max(this.minSpawn, Math.min(this.maxSpawn, iv)));
    }
    tickDecay(dtMs){
      // exponential-ish decay toward 0
      const k = Math.min(1, (dtMs/1000) * this.decay);
      this.diffScore *= (1 - Math.min(0.3, k));
    }
    reset(){ this.diffScore = 0; }
  }

  /* ================= Fever / Overdrive ================== */
  class FeverManager {
    constructor(opts={}){
      const o = Object.assign({
        need: 8,    // consecutive hits needed
        dur: 9000,  // ms
        mul: 2.0,   // score multiplier
        barEl: null,
        flashEl: null
      }, opts);
      Object.assign(this, o);
      this.on = false;
      this.t = 0;
      this.streak = 0;
    }
    hit(){
      if(!this.on){
        this.streak++;
        if(this.barEl) this.barEl.style.width = (100*Math.min(1,this.streak/this.need)) + '%';
        if(this.streak >= this.need) this._enter();
      }else{
        this.t = Math.min(this.dur, this.t + 200); // extend slightly per hit
      }
    }
    miss(){
      if(!this.on){
        this.streak = 0;
        if(this.barEl) this.barEl.style.width = '0%';
      }
    }
    tick(dtMs){
      if(!this.on) return;
      this.t -= dtMs;
      if(this.t <= 0){ this._exit(); }
      else if(this.barEl){
        const pct = Math.max(0, Math.min(1, this.t/this.dur));
        this.barEl.style.width = (pct*100) + '%';
      }
    }
    _enter(){
      this.on = true; this.t = this.dur;
      document.body.classList.add('feverOn');
      if(this.flashEl){ this.flashEl.classList.add('show'); setTimeout(()=> this.flashEl.classList.remove('show'), 140); }
    }
    _exit(){
      this.on = false; this.t = 0; this.streak = 0;
      document.body.classList.remove('feverOn');
      if(this.barEl) this.barEl.style.width = '0%';
    }
    mulScore(v){ return Math.round(v * (this.on ? this.mul : 1)); }
    reset(){ this.on=false; this.t=0; this.streak=0; if(this.barEl) this.barEl.style.width='0%'; document.body.classList.remove('feverOn'); }
  }

  /* ===================== Missions ======================= */
  // metrics: {score, hits, misses, comboMax, avoided, perfectPct, timePlayed}
  class MissionManager {
    constructor(preset='short'){
      this.active = this._preset(preset);
      this.done = [];
    }
    _preset(p){
      // quick goals for short sessions
      const M = [
        { id:'combo15',  name:'Combo x15',     check:m=> (m.comboMax||0) >= 15,      xp:40 },
        { id:'avoid10',  name:'Dodge x10',     check:m=> (m.avoided||0)  >= 10,      xp:40 },
        { id:'p80',      name:'Perfect ≥80%',  check:m=> (m.perfectPct||0) >= 80,    xp:60 },
      ];
      return M;
    }
    evaluate(metrics){
      this.done = this.active.filter(x=> { 
        try { return !!x.check(metrics); } catch(e){ return false; }
      });
      return this.done;
    }
    rewardXP(){ return this.done.reduce((s,x)=> s + (x.xp||0), 0); }
    reset(){ this.done=[]; }
  }

  /* ===================== Specials ======================= */
  // Common drop table + simple apply hooks
  const Specials = {
    roll(rates={gold:.10, time:.06, bomb:.08, shield:.12}){
      const keys = ['gold','time','bomb','shield'];
      const r = Math.random(); let acc = 0;
      for(const k of keys){ acc += (rates[k]||0); if(r<acc) return k; }
      return 'normal';
    },
    // generic apply; per-game can override with custom rules
    apply(kind, api){
      // api: { addScore(v), addTime(sec), penalty(v), onShieldHit(entity), onBomb(entity) }
      switch(kind){
        case 'gold':   api.addScore && api.addScore(150); break;
        case 'time':   api.addTime && api.addTime(2); break;
        case 'bomb':   api.penalty && api.penalty(120); api.onBomb && api.onBomb(); break;
        case 'shield': api.onShieldHit && api.onShieldHit(); break;
      }
    }
  };

  /* ======================= Juice ======================== */
  const Juice = {
    shake(camera, power=0.015, ms=60){
      try{
        if(!camera) return;
        const c=camera, ox=c.position.x, oy=c.position.y;
        c.position.x = ox + (Math.random()*power - power/2);
        c.position.y = oy + (Math.random()*power - power/2);
        setTimeout(()=>{ c.position.x=ox; c.position.y=oy; }, ms);
      }catch(e){}
    },
    flash(el){
      if(!el) return;
      el.classList.add('show'); setTimeout(()=> el.classList.remove('show'), 140);
    }
  };

  /* =================== XP / Level (Meta) ================= */
  const XP_KEY = 'EXO_XP_V1';
  const XP = {
    get(){ return _get(XP_KEY, {level:1, xp:0, skins:[], themes:[], sfx:[], daily:{}}); },
    set(v){ _set(XP_KEY, v); },
    needFor(level){ return 100 + (level-1)*120; }, // 100,220,340,... linear-ish
    add(amount){
      const s=this.get(); s.xp += Math.max(0, Math.round(amount||0));
      let levelUps = 0;
      while(s.xp >= this.needFor(s.level+1)){ s.level++; levelUps++; }
      this.set(s);
      return { level:s.level, xp:s.xp, levelUp:(levelUps>0) };
    },
    unlock(type, id){
      const s=this.get();
      const key = type==='skin' ? 'skins' : type==='theme' ? 'themes' : 'sfx';
      const arr = s[key] || (s[key]=[]);
      if(!arr.includes(id)) arr.push(id);
      this.set(s);
      return s;
    },
    reset(){ this.set({level:1, xp:0, skins:[], themes:[], sfx:[], daily:{}}); }
  };

  /* =================== Season Packs ===================== */
  const PACKS = {
    seasons: [
      { id:'s1', name:'Season 1: Kickoff',
        rhythm: [
          { id:'r101', name:'Pulse 110', bpm:110, diff:'normal', url:'../assets/rhythm/pulse110.json' },
          { id:'r102', name:'Drive 120', bpm:120, diff:'hard',   url:'../assets/rhythm/drive120.json' }
        ],
        dash:   [
          { id:'d101', name:'City Lanes', diff:'normal' }
        ],
        power:  [
          { id:'p101', name:'Core Flow', diff:'normal' }
        ]
      }
    ]
  };

  /* ================ Export to window ==================== */
  w.EXO_BOOST = {
    version: '1.0.0',
    DynamicDifficulty,
    FeverManager,
    MissionManager,
    Specials,
    Juice,
    XP,
    PACKS
  };
})(window);
</script>
