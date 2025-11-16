// ============================================================
// SHADOW BREAKER — PRODUCTION ENGINE v2.0
// Full safe-boot + UX + performance + logging ready
// ============================================================

export class ShadowBreaker {
  constructor(options) {
    // Core refs
    this.stage  = options.stage;
    this.hud    = options.hud;
    this.result = options.result;

    // Validate elements
    if (!this.stage) return this._fatal("[SB] Stage not found");
    
    // Config with guards
    const uq = new URLSearchParams(location.search);
    const diff = uq.get('diff');
    const time = parseInt(uq.get('time'));

    const DIFF_PRESET = {
      easy:   { duration: 60, spawn:1.35, lifetime:1.65 },
      normal: { duration: 90, spawn:1.05, lifetime:1.35 },
      hard:   { duration:120, spawn:0.85, lifetime:1.10 }
    };

    this.diff = DIFF_PRESET[diff] ? diff : 'normal';
    this.cfg  = DIFF_PRESET[this.diff];

    if (!Number.isFinite(time) || time < 30 || time > 300) {
      this.cfg.duration = this.cfg.duration;
    } else {
      this.cfg.duration = time;
    }

    this.state = {
      play:false, paused:false,
      elapsed:0, lastTs:0, spawnT:0,
      score:0, hits:0, miss:0, combo:0, best:0,
      fever:0, onfire:false,
      raf:0
    };

    // max performance pool
    this.TARGET_POOL_MAX = 12;
    this.targets = new Set();

    // emoji pool
    this.EMOJI = ['🥊','💥','⭐','🔥','⚡','💫'];

    // bind input
    this._bindEvents();
  }

  _fatal(msg){
    alert(msg);
    console.error(msg);
  }

  start(){
    this._reset();
    this.state.play = true;
    this._loop();
  }

  pause(v=true){
    if (!this.state.play) return;
    this.state.paused = v;
    if (v) cancelAnimationFrame(this.state.raf);
    else { this.state.lastTs = 0; this._loop(); }
  }

  _reset(){
    Object.assign(this.state, {
      play:true, paused:false,
      elapsed:0, lastTs:0, spawnT:0,
      score:0, hits:0, miss:0, combo:0, best:0,
      fever:0, onfire:false
    });
    this.stage.classList.remove('shake');
    this.targets.forEach(t=>t.remove());
    this.targets.clear();
    this._hud();
  }

  // HUD update
  _hud(){
    this.hud.time.textContent  = Math.max(0,Math.ceil(this.cfg.duration - this.state.elapsed));
    this.hud.score.textContent = this.state.score;
    this.hud.combo.textContent = 'x'+this.state.combo;
  }

  // Spawn target
  _spawn(){
    if (this.targets.size >= this.TARGET_POOL_MAX) return;
    
    const el=document.createElement('div');
    el.className='sb-target';
    el.textContent=this._pick(this.EMOJI);

    const r=this.stage.getBoundingClientRect();
    el.style.left = (Math.random()* (r.width - 90) + 45) + 'px';
    el.style.top  = (Math.random()* (r.height - 150) + 75) + 'px';

    el.dataset.created=performance.now();
    el.addEventListener("pointerdown",e=>this._hit(el));

    this.stage.appendChild(el);
    this.targets.add(el);
  }

  _hit(el){
    if (!this.targets.has(el)) return;

    const age=(performance.now()-Number(el.dataset.created))/1000;
    const isCrit=this.state.combo+1 >=5;
    const isOnfire=this.state.combo+1 >=8;

    let gain=10 + (isCrit?20:0);

    if (isOnfire){
      if(!this.state.onfire){
        this.state.onfire=true;
      }
      el.classList.add('onfire');
      gain*=2;
    } else if (isCrit) {
      el.classList.add('fever');
    }

    this.state.hits++;
    this.state.combo++;
    this.state.best=Math.max(this.state.best,this.state.combo);
    this.state.fever=Math.min(100,this.state.combo*10);
    this.state.score+=gain;

    this._pfx(el);
    this._float(el, "+"+gain);
    this.targets.delete(el); el.remove();

    this._hud();
  }

  _miss(el){
    this.state.miss++;
    this.state.combo=0;
    this.state.fever=0;
    this.state.onfire=false;
    this._float(el,"-5",true);
    this._shake();
    this.targets.delete(el); el.remove();
  }

  _shake(){
    this.stage.classList.add('shake');
    setTimeout(()=>this.stage.classList.remove('shake'),180);
  }

  _float(el,txt,isBad){
    const r=el.getBoundingClientRect();
    const f=document.createElement('div');
    f.className='float';
    if(isBad) f.style.color='var(--c-bad)'; else f.style.color='var(--c-good)';
    f.textContent=txt;
    f.style.left=(r.left+r.width/2)+'px';
    f.style.top =(r.top+r.height/2)+'px';
    document.body.appendChild(f);
    setTimeout(()=>f.remove(),700);
  }

  _pfx(el){
    const r=el.getBoundingClientRect();
    for(let i=0;i<7;i++){
      const p=document.createElement('div');
      p.className='pfx';
      p.style.left=(r.left+r.width/2)+'px';
      p.style.top =(r.top+r.height/2)+'px';
      p.style.background='var(--c-neon)';
      p.style.setProperty('--dx',(Math.random()*120-60)+'px');
      p.style.setProperty('--dy',(Math.random()*120-60)+'px');
      document.body.appendChild(p);
      setTimeout(()=>p.remove(),450);
    }
  }

  _pick(arr){ return arr[Math.floor(Math.random()*arr.length)]; }

  // Main Loop
  _loop(ts){
    if(!this.state.play || this.state.paused) return;

    if(!this.state.lastTs) this.state.lastTs=ts;
    const dt=(ts-this.state.lastTs)/1000;
    this.state.lastTs=ts;
    this.state.elapsed+=dt;

    if(this.state.elapsed >= this.cfg.duration) return this._finish();

    // spawn logic dynamic
    this.state.spawnT+=dt;
    const t=this.state.elapsed/this.cfg.duration;
    const dyn=Math.max(this.cfg.spawn*(1-0.45*t),0.38);

    if(this.state.spawnT>=dyn){
      this.state.spawnT=0;
      this._spawn();
    }

    // lifetime miss
    const now=performance.now();
    this.targets.forEach(el=>{
      if((now-Number(el.dataset.created))/1000 >= this.cfg.lifetime){
        this._miss(el);
      }
    });

    this._hud();
    this.state.raf=requestAnimationFrame(this._loop.bind(this));
  }

  _finish(){
    this.state.play=false;
    cancelAnimationFrame(this.state.raf);

    // Remove remaining
    this.targets.forEach(t=>t.remove());
    this.targets.clear();

    // Grade
    const total=this.state.hits+this.state.miss;
    const acc= total>0 ? this.state.hits/total : 0;
    let rank="C";
    if(this.state.score>=1600 && acc>=.95) rank="SSS";
    else if(this.state.score>=1100 && acc>=.90) rank="S";
    else if(this.state.score>=800  && acc>=.80) rank="A";
    else if(this.state.score>=500  && acc>=.60) rank="B";

    // show result
    this.result.box.style.display="flex";
    this.result.score.textContent=this.state.score;
    this.result.hits.textContent =this.state.hits;
    this.result.miss.textContent =this.state.miss;
    this.result.acc.textContent  =Math.round(acc*100)+"%";
    this.result.best.textContent ="x"+this.state.best;
    this.result.rank.textContent =rank;
  }

  // Input binding
  _bindEvents(){
    document.addEventListener("visibilitychange",()=>{
      if(document.hidden) this.pause(true);
    });
  }
}