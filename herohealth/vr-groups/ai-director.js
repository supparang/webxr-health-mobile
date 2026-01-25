// === /herohealth/vr-groups/ai-director.js ===
// PACK 23: AI Difficulty Director (Play only; smooth + fair)
// Emits: groups:dd {spawnRateMs, junkWeight, sizeScale, stormIntensity, pressure, reason}

(function(){
  'use strict';
  const WIN = window;

  const clamp=(v,a,b)=>{ v=Number(v)||0; return v<a?a:(v>b?b:v); };
  const lerp=(a,b,t)=> a + (b-a)*t;
  const nowMs=()=> (performance && performance.now) ? performance.now() : Date.now();

  const Director = {
    on:false,
    base:{
      spawnRateMs: 980,     // ค่า “กลาง” (ปรับได้ตามเกมเดิม)
      junkWeight: 0.25,
      sizeScale: 1.00,
      stormIntensity: 0.50
    },
    cur:{
      spawnRateMs: 980,
      junkWeight: 0.25,
      sizeScale: 1.00,
      stormIntensity: 0.50
    },
    lastPushAt:0,
    tickIt:0,

    // live signals
    risk:0,        // 0..1 (จาก predictor)
    prof:{ skill:0.5, haste:0.5, confuse:0.5, needsHelp:0.5 },
    state:{ acc:0, combo:0, miss:0, left:90, storm:0, miniUrg:0 },

    attach(opts){
      const enabled = !!opts?.enabled;
      const runMode = String(opts?.runMode||'play');

      if (!enabled || runMode !== 'play'){
        this.stop();
        return;
      }
      this.on = true;

      // reset to base (soft)
      this.cur.spawnRateMs = this.base.spawnRateMs;
      this.cur.junkWeight  = this.base.junkWeight;
      this.cur.sizeScale   = this.base.sizeScale;
      this.cur.stormIntensity = this.base.stormIntensity;

      this._bindOnce();

      clearInterval(this.tickIt);
      this.tickIt = setInterval(()=> this.tick(), 1000);
    },

    stop(){
      this.on = false;
      clearInterval(this.tickIt);
      this.tickIt = 0;
    },

    _bindOnce(){
      if (WIN.__GVR_P23_BOUND__) return;
      WIN.__GVR_P23_BOUND__ = true;

      // รับ risk จาก predictor
      WIN.addEventListener('groups:ai_predict', (ev)=>{
        if (!Director.on) return;
        const d = ev.detail||{};
        Director.risk = clamp(d.r ?? Director.risk, 0, 1);
      }, {passive:true});

      // รับ profile จาก personalization
      WIN.addEventListener('groups:ai_profile', (ev)=>{
        if (!Director.on) return;
        const d = ev.detail||{};
        if (d.profile) Director.prof = Object.assign({}, Director.prof, d.profile);
      }, {passive:true});

      // รับสถานะพื้นฐานจาก HUD events (ปลอดภัย)
      WIN.addEventListener('hha:rank', (ev)=>{
        if (!Director.on) return;
        const d = ev.detail||{};
        Director.state.acc = Number(d.accuracy ?? Director.state.acc) || 0;
      }, {passive:true});

      WIN.addEventListener('hha:score', (ev)=>{
        if (!Director.on) return;
        const d = ev.detail||{};
        Director.state.combo = Number(d.combo ?? Director.state.combo) || 0;
        Director.state.miss  = Number(d.misses ?? Director.state.miss) || 0;
      }, {passive:true});

      WIN.addEventListener('hha:time', (ev)=>{
        if (!Director.on) return;
        const d = ev.detail||{};
        Director.state.left = Math.max(0, Math.round(d.left ?? Director.state.left));
      }, {passive:true});

      // จาก script หน้า groups-vr.html ที่มี _storm / _miniUrg อยู่แล้ว:
      // เราฟังผ่าน progress / quest
      WIN.addEventListener('groups:progress', (ev)=>{
        if (!Director.on) return;
        const k = String(ev.detail?.kind||'');
        if (k==='storm_on') Director.state.storm = 1;
        if (k==='storm_off') Director.state.storm = 0;
      }, {passive:true});

      WIN.addEventListener('quest:update', (ev)=>{
        if (!Director.on) return;
        const mLeft = Number(ev.detail?.miniTimeLeftSec||0);
        Director.state.miniUrg = (mLeft>0 && mLeft<=3) ? 1 : 0;
      }, {passive:true});
    },

    // แกนสำคัญ: คำนวณ pressure (0..1) ให้ “ยุติธรรม”
    calcPressure(){
      const prof = this.prof;
      const accBad = clamp((100 - (this.state.acc||0))/100, 0, 1);
      const comboN = clamp((this.state.combo||0)/10, 0, 1);

      // risk สูง = เกมกำลังพาเด็กพลาด → ลดความกดดัน
      // skill สูง + combo ดี = เพิ่มความท้าทายได้
      // needsHelp สูง = ลดความท้าทาย
      let p =
        0.55
        + (prof.skill - 0.5)*0.25
        - (prof.needsHelp - 0.5)*0.30
        + (comboN - 0.3)*0.10
        - (accBad - 0.25)*0.12
        - (this.risk - 0.4)*0.22;

      // mini urgent / storm: อย่าซ้ำเติม
      if (this.state.miniUrg) p -= 0.10;
      if (this.state.storm)   p -= 0.08;

      return clamp(p, 0.15, 0.90);
    },

    tick(){
      if (!this.on) return;

      const pressure = this.calcPressure();
      const prof = this.prof;

      // เป้าหมายของ Director:
      // pressure สูง -> spawn ถี่ขึ้น, junk เพิ่มนิด, size เล็กนิด, storm เข้มขึ้นนิด
      // pressure ต่ำ -> spawn ห่างขึ้น, junk ลด, size ใหญ่ขึ้น, storm อ่อนลง

      // spawnRate (ms): 760..1240
      let targetSpawn = lerp(1240, 760, pressure);

      // junkWeight: 0.12..0.34 (เด็กใหม่ไม่โดนหลอกเยอะ)
      let targetJunk  = lerp(0.12, 0.34, pressure);

      // sizeScale: 1.18..0.92 (ง่าย -> ใหญ่)
      let targetSize  = lerp(1.18, 0.92, pressure);

      // stormIntensity: 0.25..0.85
      let targetStorm = lerp(0.25, 0.85, pressure);

      // fairness guard: ถ้า profile haste สูง (ยิงมั่ว) อย่าเพิ่ม spawn ถี่เกิน
      if (prof.haste > 0.65){
        targetSpawn = Math.max(targetSpawn, 920);
        targetJunk  = Math.min(targetJunk, 0.28);
      }

      // fairness guard: ถ้าสับสนหมู่สูง ลด junk เพิ่ม size
      if (prof.confuse > 0.60){
        targetJunk = Math.max(0.10, targetJunk - 0.07);
        targetSize = Math.min(1.22, targetSize + 0.06);
      }

      // slew-rate กันกระชาก (ค่อย ๆ ปรับ)
      const k = 0.22; // 0..1
      this.cur.spawnRateMs = Math.round(lerp(this.cur.spawnRateMs, targetSpawn, k));
      this.cur.junkWeight  = clamp(lerp(this.cur.junkWeight,  targetJunk,  k), 0.08, 0.40);
      this.cur.sizeScale   = clamp(lerp(this.cur.sizeScale,   targetSize,  k), 0.85, 1.25);
      this.cur.stormIntensity = clamp(lerp(this.cur.stormIntensity, targetStorm, k), 0.20, 0.90);

      // push event ทุก ~1s
      const t = nowMs();
      if (t - this.lastPushAt > 900){
        this.lastPushAt = t;
        try{
          WIN.dispatchEvent(new CustomEvent('groups:dd', {
            detail:{
              spawnRateMs: this.cur.spawnRateMs,
              junkWeight:  Math.round(this.cur.junkWeight*100)/100,
              sizeScale:   Math.round(this.cur.sizeScale*100)/100,
              stormIntensity: Math.round(this.cur.stormIntensity*100)/100,
              pressure: Math.round(pressure*100)/100,
              reason:'tick'
            }
          }));
        }catch(_){}
      }
    }
  };

  WIN.GroupsVR = WIN.GroupsVR || {};
  WIN.GroupsVR.AIDirector = Director;
})();