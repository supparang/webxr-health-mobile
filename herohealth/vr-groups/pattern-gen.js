// === /herohealth/vr-groups/pattern-gen.js ===
// PACK 59: Seeded Pattern Generator for spawn positions
// Modes: scatter | ring | wave | grid9
// Deterministic with rng() injected

(function(){
  'use strict';
  const WIN = window;
  WIN.GroupsVR = WIN.GroupsVR || {};

  function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }

  function PatternGen(rng){
    this.rng = rng;
    this.mode = 'scatter';
    this.phase = 0;
    this.lastSwitch = 0;
    this.switchEveryMs = 9000;
  }

  PatternGen.prototype.pickMode = function(){
    // weighted
    const r = this.rng();
    if (r < 0.55) return 'scatter';
    if (r < 0.73) return 'wave';
    if (r < 0.90) return 'ring';
    return 'grid9';
  };

  PatternGen.prototype.tick = function(t, runMode){
    // research: keep stable, less switching
    const sw = (runMode==='research') ? 14000 : this.switchEveryMs;
    if (!this.lastSwitch) this.lastSwitch = t;
    if (t - this.lastSwitch > sw){
      this.lastSwitch = t;
      this.mode = this.pickMode();
      this.phase = 0;
    }
    this.phase += 1;
  };

  PatternGen.prototype.nextXY = function(R, view){
    const rng = this.rng;
    const w = Math.max(10, R.xMax - R.xMin);
    const h = Math.max(10, R.yMax - R.yMin);

    if (this.mode === 'scatter'){
      const x = R.xMin + rng()*w;
      const y = R.yMin + rng()*h;
      return { x, y };
    }

    if (this.mode === 'grid9'){
      const gx = (this.phase % 3);
      const gy = ((this.phase/3)|0) % 3;
      const pad = 0.16;
      const x = R.xMin + (gx+pad + rng()*0.12) * (w/3);
      const y = R.yMin + (gy+pad + rng()*0.12) * (h/3);
      return { x, y };
    }

    if (this.mode === 'ring'){
      const cx = (R.xMin + R.xMax)*0.5;
      const cy = (R.yMin + R.yMax)*0.5;
      const rad = Math.min(w,h) * (view==='cvr' ? 0.32 : 0.36);
      const ang = (this.phase * 0.62) + rng()*0.22;
      const x = cx + Math.cos(ang)*rad;
      const y = cy + Math.sin(ang)*rad;
      return { x, y };
    }

    // wave
    {
      const cx = (R.xMin + R.xMax)*0.5;
      const y = R.yMin + ( (this.phase % 10) / 9 ) * h;
      const amp = w * 0.24;
      const ang = (this.phase * 0.85) + rng()*0.18;
      const x = clamp(cx + Math.sin(ang)*amp, R.xMin, R.xMax);
      return { x, y };
    }
  };

  WIN.GroupsVR.PatternGen = {
    create: (rng)=> new PatternGen(rng)
  };
})();