// === /herohealth/vr-groups/pattern-gen.js ===
// GroupsVR AI Pattern Generator — SAFE
// ✅ play only (enabled via ai-hooks with ?ai=1)
// ✅ Generates: spawn position pattern, wave/cluster, boss phase2 (fun), motion class
// ✅ Keeps inside engine playRect (engine clamps again)
// Emits: ai:pattern {mode, lane, waveLeft}

(function(root){
  'use strict';
  const NS = root.GroupsVR = root.GroupsVR || {};
  const clamp = (v,a,b)=>Math.max(a, Math.min(b, Number(v)||0));

  function emit(name, detail){
    try{ root.dispatchEvent(new CustomEvent(name,{detail})); }catch(_){}
  }

  function makeRng(u32){
    let s = (u32>>>0) || 1;
    return ()=>((s = (Math.imul(1664525, s) + 1013904223)>>>0) / 4294967296);
  }
  function hashSeed(str){
    str = String(str ?? '');
    let h = 2166136261>>>0;
    for(let i=0;i<str.length;i++){
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h>>>0;
  }
  function pick(rng, arr){ return arr[(rng()*arr.length)|0]; }

  // Pattern modes
  const MODES = [
    'lanes3',    // 3 lanes x center-ish
    'arc',       // arc around center
    'zigzag',    // alternating left/right
    'cluster',   // small cluster bursts
    'random'     // fallback
  ];

  function PatternGen(){
    this.enabled = false;
    this.runMode = 'play';
    this.seed = '0';
    this.rng = makeRng(123);
    this.mode = 'lanes3';
    this.modeUntil = 0;

    this.lane = 0;
    this.zig = 0;

    this.wave = null; // {on,left,kindBias,forceDrift}
    this.lastTick = 0;

    this.bossPhase2Ready = false; // unlocked by good streak
    this.lastAcc = 0;
    this.lastCombo = 0;
    this.lastMiss = 0;
    this.stormOn = false;
  }

  PatternGen.prototype.attach = function(cfg){
    cfg = cfg || {};
    const rm = String(cfg.runMode||'play').toLowerCase();
    this.runMode = rm;
    this.enabled = !!cfg.enabled && (rm==='play');

    if(rm==='research' || rm==='practice') this.enabled = false;

    this.seed = String(cfg.seed ?? '0');
    this.rng = makeRng(hashSeed(this.seed + '::pattern'));

    this.mode = pick(this.rng, MODES);
    this.modeUntil = Date.now() + 12000 + ((this.rng()*9000)|0);

    this.lane = 0;
    this.zig = 0;
    this.wave = null;

    this.bossPhase2Ready = false;
    this.lastAcc = 0;
    this.lastCombo = 0;
    this.lastMiss = 0;
    this.stormOn = false;
  };

  PatternGen.prototype.stop = function(){
    this.enabled = false;
    this.wave = null;
  };

  PatternGen.prototype.onScore = function(d){
    d = d||{};
    this.lastCombo = Number(d.combo||0);
    this.lastMiss  = Number(d.misses||0);

    // unlock phase2 if streak feels “wow”
    if(this.lastCombo >= 10 && this.lastMiss <= 6){
      this.bossPhase2Ready = true;
    }
  };

  PatternGen.prototype.onRank = function(d){
    d = d||{};
    this.lastAcc = Number(d.accuracy||0);
  };

  PatternGen.prototype.onProgress = function(d){
    d = d||{};
    const k = String(d.kind||'');
    if(k==='storm_on')  this.stormOn = true;
    if(k==='storm_off') this.stormOn = false;
    if(k==='boss_down') {
      // after boss down, small chance to trigger a wave
      if(this.enabled && this.runMode==='play' && this.rng() < 0.55){
        this.startWave();
      }
    }
  };

  PatternGen.prototype.maybeRotateMode = function(){
    const now = Date.now();
    if(now >= this.modeUntil){
      // avoid repeating same mode too often
      const candidates = MODES.filter(m=>m!==this.mode);
      this.mode = pick(this.rng, candidates);
      this.modeUntil = now + 11000 + ((this.rng()*10000)|0);
    }
  };

  PatternGen.prototype.startWave = function(){
    // wave: 6-10 spawns with bias + drift
    const left = 6 + ((this.rng()*5)|0);
    const kindBias = (this.rng()<0.65) ? 'good' : 'mixed';
    const forceDrift = (this.rng()<0.75);
    this.wave = { on:true, left, kindBias, forceDrift };
    emit('ai:pattern', { mode:this.mode, lane:this.lane, waveLeft:left });
  };

  PatternGen.prototype.consumeWave = function(){
    if(!this.wave || !this.wave.on) return null;
    this.wave.left -= 1;
    if(this.wave.left <= 0){
      this.wave = null;
      emit('ai:pattern', { mode:this.mode, lane:this.lane, waveLeft:0 });
      return null;
    }
    return this.wave;
  };

  /**
   * nextSpawnOverride({rect, view, kindHint}) -> { x,y, motionClass, driftMs, driftAmp, kindForce? }
   * rect = {xMin,xMax,yMin,yMax,W,H}
   */
  PatternGen.prototype.nextSpawnOverride = function(input){
    if(!this.enabled || this.runMode!=='play') return null;
    input = input || {};
    const R = input.rect;
    if(!R) return null;

    this.maybeRotateMode();

    // wave bias
    const wave = this.wave ? this.consumeWave() : null;

    // set lane width (3 lanes)
    const lanes3 = ()=>{
      const w = (R.xMax - R.xMin);
      const laneW = w / 3;
      // advance lane with some randomness
      if(this.rng()<0.75) this.lane = (this.lane + 1) % 3;
      const x = R.xMin + laneW*(this.lane + 0.5);
      const y = R.yMin + (this.rng()*(R.yMax - R.yMin));
      return { x, y };
    };

    const zigzag = ()=>{
      const left = R.xMin + 18;
      const right= R.xMax - 18;
      this.zig = 1 - this.zig;
      const x = (this.zig===0) ? left : right;
      const y = R.yMin + (this.rng()*(R.yMax - R.yMin));
      return { x, y };
    };

    const arc = ()=>{
      const cx = (R.xMin + R.xMax)/2;
      const cy = (R.yMin + R.yMax)/2;
      const rx = (R.xMax - R.xMin)*0.42;
      const ry = (R.yMax - R.yMin)*0.34;
      const a = (this.rng()*Math.PI*2);
      const x = cx + Math.cos(a)*rx;
      const y = cy + Math.sin(a)*ry;
      return { x, y };
    };

    const cluster = ()=>{
      // small cluster around a pivot point for 2-4 spawns
      const pivotX = R.xMin + (this.rng()*(R.xMax - R.xMin));
      const pivotY = R.yMin + (this.rng()*(R.yMax - R.yMin));
      const dx = (this.rng()*120) - 60;
      const dy = (this.rng()*120) - 60;
      return { x: pivotX + dx, y: pivotY + dy };
    };

    let pos;
    if(this.mode==='lanes3') pos = lanes3();
    else if(this.mode==='zigzag') pos = zigzag();
    else if(this.mode==='arc') pos = arc();
    else if(this.mode==='cluster') pos = cluster();
    else pos = { x: R.xMin + this.rng()*(R.xMax-R.xMin), y: R.yMin + this.rng()*(R.yMax-R.yMin) };

    // clamp inside rect (engine clamps again anyway)
    pos.x = clamp(pos.x, R.xMin, R.xMax);
    pos.y = clamp(pos.y, R.yMin, R.yMax);

    // motion
    const motionClass = (wave && wave.forceDrift) ? 'drift' : (this.rng()<0.35 ? 'drift' : '');
    const driftMs = 1200 + ((this.rng()*900)|0);
    const driftAmp = 10 + ((this.rng()*18)|0);

    // kind force during wave (optional)
    let kindForce = null;
    if(wave && wave.kindBias==='good' && this.rng()<0.75){
      kindForce = 'good';
    }

    emit('ai:pattern', { mode:this.mode, lane:this.lane, waveLeft: wave ? wave.left : 0 });

    return { x:pos.x, y:pos.y, motionClass, driftMs, driftAmp, kindForce };
  };

  // boss phase2: request extra "escort" spawns after boss spawn
  PatternGen.prototype.bossPhase2 = function(){
    if(!this.enabled || this.runMode!=='play') return { on:false };
    // require unlock + decent accuracy
    const ok = this.bossPhase2Ready && this.lastAcc >= 70;
    if(!ok) return { on:false };

    // consume unlock (one-time per game, feels special)
    this.bossPhase2Ready = false;

    // 3 escorts
    return { on:true, escorts: 3, escortKind: (this.rng()<0.65?'good':'mixed') };
  };

  // Export
  const PG = new PatternGen();
  NS.PatternGen = PG;

  // wire listeners (safe)
  root.addEventListener('hha:score', (ev)=>PG.onScore(ev.detail||{}), {passive:true});
  root.addEventListener('hha:rank',  (ev)=>PG.onRank(ev.detail||{}), {passive:true});
  root.addEventListener('groups:progress', (ev)=>PG.onProgress(ev.detail||{}), {passive:true});
  root.addEventListener('hha:end', ()=>PG.stop(), {passive:true});
})(window);