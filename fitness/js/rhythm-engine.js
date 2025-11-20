// ===== Rhythm Engine (2025-11-20) =====
export class RhythmEngine {
  constructor(opts={}) {
    this.layer   = opts.targetLayer;
    this.diff    = opts.difficulty || 'normal';
    this.mode    = opts.mode || 'normal';
    this.research= opts.research || {};

    this.targets = [];
    this.active  = false;
    this.timeLeft= 60;

    this.score=0;
    this.combo=0;
    this.maxCombo=0;
    this.perfect=0;
    this.miss=0;
    this.offsetSamples=[];

    this.onUpdate = null;
    this.onFinish = null;

    this.pattern = this.makePattern();
  }

  makePattern() {
    // Basic beat timeline (ms)
    // diff จะเร่งช้าตามระดับ
    let bpm = (this.diff==='easy'? 80 : this.diff==='normal'? 108 : 130);
    let interval = 60000/bpm;

    const beats = [];
    for (let t=0; t<60*1000; t+=interval) {
      beats.push(t);
    }
    return beats;
  }

  start() {
    this.active = true;
    this.startTime = performance.now();
    this.tick();
    this.spawnLoop();
  }

  forceEnd() {
    this.finish('manual');
  }

  tick() {
    if (!this.active) return;
    const now = performance.now();
    this.timeLeft = Math.max(0, 60 - (now - this.startTime)/1000);

    if (this.onUpdate) {
      this.onUpdate({
        score:this.score,
        combo:this.combo,
        perfect:this.perfect,
        miss:this.miss,
        timeLeft:this.timeLeft.toFixed(1)
      });
    }

    if (this.timeLeft<=0) return this.finish('timeout');
    requestAnimationFrame(()=>this.tick());
  }

  spawnLoop() {
    if (!this.active) return;

    const now = performance.now() - this.startTime;
    const beat = this.pattern.find(b => Math.abs(b-now) < 40);
    if (beat!==undefined) {
      this.spawnTarget(beat);
    }

    requestAnimationFrame(()=>this.spawnLoop());
  }

  spawnTarget(beatTime) {
    const el = document.createElement('div');
    el.className = 'rb-target';
    el.textContent = '🥊';

    // random position
    const layerRect = this.layer.getBoundingClientRect();
    const x = Math.random()*layerRect.width;
    const y = Math.random()*layerRect.height;

    el.style.left = x+'px';
    el.style.top  = y+'px';

    this.layer.appendChild(el);

    const t = {
      el, beatTime,
      removed:false
    };
    this.targets.push(t);

    el.addEventListener('pointerdown', () => this.hit(t));
    
    // auto-miss if too slow
    setTimeout(()=>{
      if (!t.removed) this.missTarget(t);
    },150);
  }

  hit(t) {
    if (t.removed) return;

    const now = performance.now() - this.startTime;
    const offset = now - t.beatTime;  // ms difference
    t.removed = true;
    t.el.remove();

    this.offsetSamples.push(offset);

    const abs = Math.abs(offset);
    let score = 0;
    let type  = 'miss';

    if (abs<60) {
      type='perfect'; score=300; this.perfect++;
    } else if (abs<120) {
      type='good'; score=100;
    } else {
      type='bad'; score=30;
    }

    this.score += score;
    this.combo++;
    this.maxCombo = Math.max(this.maxCombo,this.combo);

    this.updateGroove();

    if (this.onUpdate) {
      this.onUpdate({
        score:this.score,
        combo:this.combo,
        perfect:this.perfect,
        miss:this.miss,
        timeLeft:this.timeLeft.toFixed(1)
      });
    }
  }

  missTarget(t) {
    if (t.removed) return;
    t.removed=true;
    this.miss++;
    this.combo=0;
    t.el.remove();
  }

  updateGroove() {
    // combo-based groove meter (simple version)
    const fill = document.querySelector('#groove-fill');
    const w = Math.min(100,(this.combo*2));
    fill.style.width = w+'%';
  }

  finish(reason) {
    this.active=false;

    const avgOffset = this.offsetSamples.length?
      this.offsetSamples.reduce((a,b)=>a+b,0)/this.offsetSamples.length : 0;

    const acc = (this.perfect+this.score/300)/this.pattern.length;

    if (this.onFinish) {
      this.onFinish({
        score:this.score,
        rhythmAccuracy:acc,
        avgOffset:avgOffset,
        perfect:this.perfect,
        miss:this.miss,
        maxCombo:this.maxCombo,
        reason
      });
    }
  }
}