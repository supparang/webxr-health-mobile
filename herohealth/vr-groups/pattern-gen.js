// === /herohealth/vr-groups/pattern-gen.js ===
// PACK 24: Pattern Generator (seeded) for Waves/Boss/Storm
// Enabled only in play+ai=1. Deterministic by seed.
// Emits: groups:pattern {name, phase, meta}
//        groups:progress {kind: 'boss_spawn'|'boss_down'|'storm_on'|'storm_off'|...}

(function(){
  'use strict';
  const WIN = window;

  // ---------- utils ----------
  const clamp=(v,a,b)=>{ v=Number(v)||0; return v<a?a:(v>b?b:v); };
  const pick=(arr, r)=> arr[Math.floor(r()*arr.length)];
  const hash32=(s)=>{
    s = String(s||'');
    let h = 2166136261 >>> 0;
    for (let i=0;i<s.length;i++){
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  };
  const mulberry32=(a)=>{
    return function(){
      let t = a += 0x6D2B79F5;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  // normalized play area (avoid HUD zones)
  function normToPx(nx, ny, bounds){
    // bounds = {w,h, topSafePx, bottomSafePx}
    const w=bounds.w, h=bounds.h;
    const top=bounds.topSafePx||0, bot=bounds.bottomSafePx||0;
    const y0 = top + 8;
    const y1 = h - bot - 8;
    const x = clamp(nx, 0.06, 0.94) * w;
    const y = y0 + clamp(ny, 0.06, 0.94) * (y1 - y0);
    return { x, y };
  }

  // ---------- pattern shapes ----------
  function makeLine(r){
    const left = r() < 0.5;
    const x0 = left ? 0.18 : 0.82;
    const x1 = left ? 0.82 : 0.18;
    const y = 0.35 + r()*0.35;
    return (i,n)=>({ nx: x0 + (x1-x0)*(i/(n-1)), ny: y });
  }
  function makeArc(r){
    const up = r() < 0.5;
    const cx = 0.5, cy = up ? 0.22 : 0.78;
    const rad = 0.34;
    const a0 = up ? Math.PI*0.15 : Math.PI*1.15;
    const a1 = up ? Math.PI*0.85 : Math.PI*1.85;
    return (i,n)=>{
      const t = (n<=1)?0: (i/(n-1));
      const a = a0 + (a1-a0)*t;
      return { nx: cx + Math.cos(a)*rad, ny: cy + Math.sin(a)*rad };
    };
  }
  function makeBurst(r){
    const cx = 0.5 + (r()-0.5)*0.10;
    const cy = 0.5 + (r()-0.5)*0.10;
    return (i,n)=>{
      const a = (Math.PI*2) * (i/n);
      const rad = 0.14 + (i/n)*0.28;
      return { nx: cx + Math.cos(a)*rad, ny: cy + Math.sin(a)*rad };
    };
  }
  function makeSpiral(r){
    const cx=0.5, cy=0.5;
    const dir = (r()<0.5) ? 1 : -1;
    return (i,n)=>{
      const t = (i/(n-1||1));
      const a = dir*(Math.PI*2)*(0.5 + 1.6*t);
      const rad = 0.10 + 0.34*t;
      return { nx: cx + Math.cos(a)*rad, ny: cy + Math.sin(a)*rad };
    };
  }
  function makeZigzag(r){
    const y0 = 0.28 + r()*0.10;
    const y1 = 0.72 - r()*0.10;
    return (i,n)=>{
      const t = (i/(n-1||1));
      const nx = 0.18 + 0.64*t;
      const ny = (i%2===0) ? y0 : y1;
      return { nx, ny };
    };
  }

  const WAVE_MAKERS = [
    { name:'LINE',   mk: makeLine },
    { name:'ARC',    mk: makeArc },
    { name:'BURST',  mk: makeBurst },
    { name:'SPIRAL', mk: makeSpiral },
    { name:'ZIGZAG', mk: makeZigzag }
  ];

  // ---------- generator ----------
  const Gen = {
    on:false,
    seedStr:'0',
    r: ()=>Math.random(),
    plan:[],
    idx:0,
    phase:'idle',
    cur:null,

    attach({ seed, enabled, runMode }){
      if (!enabled || String(runMode||'play')!=='play'){
        this.on=false; this.plan=[]; this.idx=0; this.cur=null; this.phase='idle';
        return;
      }
      this.on=true;
      this.seedStr = String(seed||Date.now());
      this.r = mulberry32(hash32('GVR-P24:'+this.seedStr));

      // สร้างแผนเวลา (duration 90s default)
      this.plan = this.buildPlan(90);
      this.idx = 0;
      this.cur = null;
      this.phase='wave';

      try{
        WIN.dispatchEvent(new CustomEvent('groups:pattern', {
          detail:{ name:'READY', phase:'init', meta:{ seed:this.seedStr } }
        }));
      }catch(_){}
    },

    buildPlan(totalSec){
      const r=this.r;
      const plan=[];
      let t=0;

      // every ~12s a wave, boss at ~30s & ~70s, storms sprinkled
      while (t < totalSec){
        // boss beats
        if (t===24 || t===60){
          plan.push({ at:t, type:'boss', dur:8 + Math.floor(r()*4) }); // 8-11s
          t += plan[plan.length-1].dur;
          continue;
        }

        // storm beat (chance)
        if (r() < 0.18){
          const dur = 6 + Math.floor(r()*4); // 6-9s
          plan.push({ at:t, type:'storm', dur });
          t += dur;
          continue;
        }

        // normal wave
        const W = pick(WAVE_MAKERS, r);
        const dur = 10 + Math.floor(r()*4); // 10-13s
        plan.push({ at:t, type:'wave', dur, waveName: W.name, mk: W.mk(r) });
        t += dur;
      }
      return plan;
    },

    // called by engine with elapsedSec
    update(elapsedSec){
      if (!this.on) return null;

      // advance segment
      const seg = this.plan[this.idx];
      if (!seg) return null;

      if (elapsedSec >= (seg.at + seg.dur)){
        this.idx = Math.min(this.plan.length-1, this.idx+1);
        return this.update(elapsedSec);
      }

      // if new segment
      if (!this.cur || this.cur.at !== seg.at){
        this.cur = seg;

        try{
          if (seg.type==='storm') WIN.dispatchEvent(new CustomEvent('groups:progress', { detail:{ kind:'storm_on' } }));
          if (seg.type==='boss')  WIN.dispatchEvent(new CustomEvent('groups:progress', { detail:{ kind:'boss_spawn' } }));
          if (seg.type==='wave')  WIN.dispatchEvent(new CustomEvent('groups:pattern', {
            detail:{ name: seg.waveName, phase:'wave', meta:{ dur:seg.dur, at:seg.at } }
          }));
          if (seg.type==='storm') WIN.dispatchEvent(new CustomEvent('groups:pattern', {
            detail:{ name:'STORM', phase:'storm', meta:{ dur:seg.dur, at:seg.at } }
          }));
          if (seg.type==='boss') WIN.dispatchEvent(new CustomEvent('groups:pattern', {
            detail:{ name:'BOSS', phase:'boss', meta:{ dur:seg.dur, at:seg.at } }
          }));
        }catch(_){}
      }

      return seg;
    },

    // main hook: produce spawn suggestion
    // ctx: { elapsedSec, nInWave, iInWave, bounds:{w,h,topSafePx,bottomSafePx}, groupIndex, wantKind: 'good'|'junk' }
    suggest(ctx){
      if (!this.on) return null;

      const seg = this.update(ctx.elapsedSec||0);
      if (!seg) return null;

      const r=this.r;
      const bounds = ctx.bounds || {w:window.innerWidth, h:window.innerHeight, topSafePx:0, bottomSafePx:0};

      if (seg.type === 'wave'){
        const n = Math.max(1, ctx.nInWave||6);
        const i = clamp(ctx.iInWave||0, 0, n-1);
        const p = seg.mk ? seg.mk(i,n) : {nx:0.5, ny:0.5};
        const xy = normToPx(p.nx, p.ny, bounds);
        return { x: xy.x, y: xy.y, sizeScale: 1.0, tag:'wave:'+seg.waveName };
      }

      if (seg.type === 'storm'){
        // storm: seeded jitter but still “patterned”
        const nx = 0.12 + r()*0.76;
        const ny = 0.20 + r()*0.62;
        const xy = normToPx(nx, ny, bounds);
        return { x: xy.x, y: xy.y, sizeScale: 0.96, tag:'storm' };
      }

      if (seg.type === 'boss'){
        // boss: spawn near center band, with small movement
        const nx = 0.45 + (r()-0.5)*0.18;
        const ny = 0.42 + (r()-0.5)*0.18;
        const xy = normToPx(nx, ny, bounds);
        return { x: xy.x, y: xy.y, sizeScale: 1.10, tag:'boss' };
      }

      return null;
    },

    // call when leaving segment
    stopStormIfNeeded(elapsedSec){
      const seg = this.plan[this.idx];
      if (!seg) return;
      if (seg.type !== 'storm') return;
      if (elapsedSec >= (seg.at + seg.dur - 0.05)){
        try{ WIN.dispatchEvent(new CustomEvent('groups:progress', { detail:{ kind:'storm_off' } })); }catch(_){}
      }
    },

    bossDown(){
      try{ WIN.dispatchEvent(new CustomEvent('groups:progress', { detail:{ kind:'boss_down' } })); }catch(_){}
    }
  };

  WIN.GroupsVR = WIN.GroupsVR || {};
  WIN.GroupsVR.PatternGen = Gen;
})();