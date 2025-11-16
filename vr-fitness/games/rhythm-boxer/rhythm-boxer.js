// === Rhythm Boxer Engine — Modular Version (RB-ENGINE v1.0) ===
// Usage:
// const rb = new RhythmBoxer({ stage, hud, result, config });
// rb.start();

export class RhythmBoxer {
  constructor(options) {
    this.stage       = options.stage;
    this.hud         = options.hud;
    this.result      = options.result;

    this.config = Object.assign({
      duration: 90,
      spawnBase: 1.1,
      lifetime: 1.4,
      feverCombo: 5,
      onfireCombo: 8,
    }, options.config || {});

    this.targets = new Set();
    this.audioCtx = null;

    this.state = {
      play: false,
      elapsed: 0,
      lastTs: 0,
      score: 0,
      hits: 0,
      miss: 0,
      combo: 0,
      bestCombo: 0,
      spawnTimer: 0,
      fever: 0,
      onfire: false,
      slowUntil: 0,
      freezeUntil: 0,
      raf: 0
    };

    this.EMOJI = ['🥁','🎵','✨','🔊','🎧','🎶'];
    this.ITEM  = { slow:'🐢', freeze:'🧊', bomb:'🎹' };

    this._bindEvents();
  }

  // ---------- Helpers ----------
  rand(a,b){ return Math.random() * (b-a) + a; }
  pick(arr){ return arr[Math.floor(Math.random() * arr.length)]; }

  // ---------- SFX ----------
  beep(type){
    try{
      if(!this.audioCtx)
        this.audioCtx = new (window.AudioContext||window.webkitAudioContext)();

      const ctx = this.audioCtx;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      let f=440, d=0.08, v=0.25;
      if(type==='hit')  { f=520; d=0.06; }
      if(type==='miss') { f=180; d=0.1; }
      if(type==='item') { f=700; d=0.1; }
      if(type==='fever'){ f=900; d=0.14; }
      if(type==='onfire'){f=300; d=0.18; }

      osc.frequency.value=f;
      osc.type = (type==='miss' ? 'sawtooth' : 'square');
      gain.gain.value=v;

      osc.connect(gain); gain.connect(ctx.destination);
      const now = ctx.currentTime;
      osc.start(now); osc.stop(now+d);
      gain.gain.setTargetAtTime(0,now+d*0.4,0.05);
    }catch(e){}
  }

  updateHUD(){
    if(this.hud.time)  this.hud.time.textContent  = Math.max(0, Math.ceil(this.config.duration-this.state.elapsed));
    if(this.hud.score) this.hud.score.textContent = this.state.score;
    if(this.hud.combo) this.hud.combo.textContent = "x" + this.state.combo;
    if(this.hud.fever)
      this.hud.fever.style.transform = "scaleX(" + (this.state.fever/100) + ")";
  }

  // ---------- Particle FX ----------
  particles(x,y,good=true){
    for(let i=0;i<8;i++){
      const p=document.createElement("div");
      p.className="particle";
      p.style.background=good?'#4ade80':'#ef4444';
      p.style.left=x+"px"; p.style.top=y+"px";
      p.style.setProperty('--dx',this.rand(-40,40)+"px");
      p.style.setProperty('--dy',this.rand(-40,40)+"px");
      this.stage.appendChild(p);
      setTimeout(()=>p.remove(),450);
    }
  }

  floatScore(x,y,val,isMiss,crit){
    const el=document.createElement("div");
    el.className="float-score" + (isMiss?" miss":"") + (crit?" crit":"");
    el.textContent=(isMiss?"-"+val:"+"+val);
    el.style.left=x+"px"; el.style.top=y+"px";
    this.stage.appendChild(el);
    setTimeout(()=>el.remove(),700);
  }

  popupFever(){
    if(!this.result.feverContainer) return;
    const el=document.createElement("div");
    el.id="fever-popup";
    el.textContent="🔥 FEVER !! 🔥";
    this.result.feverContainer.appendChild(el);
    setTimeout(()=>el.remove(),900);
  }

  popupOnFire(){
    if(!this.result.onfireContainer) return;
    const el=document.createElement("div");
    el.className="onfire-popup";
    el.textContent="🔥🔥 ON-FIRE MODE !!! 🔥🔥";
    this.result.onfireContainer.appendChild(el);
    setTimeout(()=>el.remove(),1000);
  }

  // ---------- Target Spawn ----------
  spawn(){
    if(!this.state.play) return;

    const rect=this.stage.getBoundingClientRect();
    const x=this.rand(rect.width*0.2, rect.width*0.8);
    const y=this.rand(rect.height*0.35, rect.height*0.65);

    const el=document.createElement("div");
    let isItem=false, type=null;

    if(Math.random()<0.12){
      isItem=true;
      type=this.pick(Object.keys(this.ITEM));
      el.className="rb-target rb-target-pop rb-target-item";
      el.textContent=this.ITEM[type];
      el.dataset.item=type;
    }else{
      el.className="rb-target rb-target-pop";
      el.textContent=this.pick(this.EMOJI);
    }

    el.style.left=x+"px";
    el.style.top=y+"px";
    el.dataset.created = performance.now();

    el.addEventListener("pointerdown", (e)=>{
      e.stopPropagation();
      if(!this.state.play) return;

      const nextCombo=this.state.combo+1;
      const crit = (nextCombo >= this.config.feverCombo);

      isItem ? this.useItem(type, el) : this.hit(el, crit);
    }, { passive:false });

    this.stage.appendChild(el);
    this.targets.add(el);
  }

  // ---------- Item Effect ----------
  useItem(type, el){
    const now = performance.now()/1000;
    if(type==='slow')   this.state.slowUntil = now+3;
    if(type==='freeze') this.state.freezeUntil = now+2;
    if(type==='bomb'){
      this.targets.forEach(t=>t.remove());
      this.targets.clear();
    }
    this.burst(el,true);
    this.beep('item');
  }

  // ---------- Hit / Miss ----------
  burst(el, good){
    const r=el.getBoundingClientRect();
    const x=r.left+r.width/2, y=r.top+r.height/2;
    this.particles(x,y,good);
    this.floatScore(x,y,good?"+": "-", !good, false);
    el.remove();
    this.targets.delete(el);
  }

  hit(el, crit){
    if(!this.targets.has(el)) return;
    this.targets.delete(el);

    const r=el.getBoundingClientRect();
    const x=r.left+r.width/2;
    const y=r.top+r.height/2;

    const nextCombo=this.state.combo+1;
    const fever  = (nextCombo >= this.config.feverCombo);
    const onfire = (nextCombo >= this.config.onfireCombo);

    if(fever && !crit) crit=true;

    let gain = 10 + (crit ? 20 : 0);

    if(onfire){
      if(!this.state.onfire){
        this.state.onfire=true;
        this.stage.classList.add("onfire-screen");
        this.popupOnFire();
        this.beep("onfire");
      }
      gain *= 2;
    }

    this.state.score += gain;
    this.state.hits++;
    this.state.combo++;
    this.state.bestCombo = Math.max(this.state.bestCombo, this.state.combo);

    this.state.fever = Math.min(100, this.state.combo*10);

    if(crit){
      this.popupFever();
      this.beep("fever");
    }else{
      this.beep("hit");
    }

    this.floatScore(x,y,gain,false,crit);
    this.particles(x,y,true);
    el.remove();

    this.updateHUD();
  }

  miss(el){
    this.state.miss++;
    this.state.combo=0;
    this.state.fever=0;
    this.state.onfire=false;
    this.stage.classList.remove("onfire-screen");

    const r=el.getBoundingClientRect();
    const x=r.left+r.width/2, y=r.top+r.height/2;

    this.floatScore(x,y,5,true,false);
    this.particles(x,y,false);
    el.remove();
    this.targets.delete(el);

    this.beep("miss");
    this.updateHUD();
  }

  // ---------- Game Loop ----------
  loop(ts){
    if(!this.state.play) return;

    if(!this.state.lastTs) this.state.lastTs=ts;
    const dt = (ts-this.state.lastTs)/1000;
    this.state.lastTs = ts;
    this.state.elapsed += dt;

    if(this.state.elapsed >= this.config.duration)
      return this.finish();

    const now = performance.now()/1000;
    let spawnFactor = 1;
    if(now < this.state.freezeUntil) spawnFactor = 0;
    if(now < this.state.slowUntil)   spawnFactor = 0.5;

    this.state.spawnTimer += dt * spawnFactor;

    const t = this.state.elapsed / this.config.duration;
    const dyn = Math.max(this.config.spawnBase*(1-0.45*t), 0.4);

    if(this.state.spawnTimer >= dyn){
      this.state.spawnTimer = 0;
      this.spawn();
    }

    const nowms = performance.now();
    this.targets.forEach(el=>{
      const age = (nowms - Number(el.dataset.created)) / 1000;
      if(age >= this.config.lifetime && now >= this.state.freezeUntil){
        this.miss(el);
      }
    });

    this.updateHUD();
    this.state.raf = requestAnimationFrame(this.loop.bind(this));
  }

  // ---------- Game Control ----------
  reset(){
    const s=this.state;
    s.elapsed=s.spawnTimer=s.lastTs=0;
    s.score=s.hits=s.miss=s.combo=s.bestCombo=s.fever=0;
    s.onfire=false;
    this.targets.forEach(el=>el.remove());
    this.targets.clear();
    this.stage.classList.remove("onfire-screen");
    this.updateHUD();
  }

  start(){
    this.reset();
    this.state.play=true;
    this.state.raf=requestAnimationFrame(this.loop.bind(this));
  }

  finish(){
    this.state.play=false;
    cancelAnimationFrame(this.state.raf);
    this.targets.forEach(el=>el.remove());
    this.targets.clear();

    const total=this.state.hits+this.state.miss;
    const acc = total>0 ? this.state.hits/total : 0;

    let rank="C";
    if(this.state.score>=1600 && acc>=0.95) rank="SSS";
    else if(this.state.score>=1100 && acc>=0.90) rank="S";
    else if(this.state.score>=800  && acc>=0.80) rank="A";
    else if(this.state.score>=500  && acc>=0.60) rank="B";

    if(this.result && this.result.box){
      this.result.box.style.display="flex";
      if(this.result.score)   this.result.score.textContent=this.state.score;
      if(this.result.hits)    this.result.hits.textContent=this.state.hits;
      if(this.result.miss)    this.result.miss.textContent=this.state.miss;
      if(this.result.acc)     this.result.acc.textContent=Math.round(acc*100)+"%";
      if(this.result.best)    this.result.best.textContent="x"+this.state.bestCombo;
      if(this.result.time)    this.result.time.textContent=this.config.duration;
      if(this.result.rank)    this.result.rank.textContent=rank;
    }
  }

  // ---------- Event Binding ----------
  _bindEvents(){
    document.addEventListener("visibilitychange",()=>{
      if(document.hidden && this.state.play){
        this.state.play=false;
        cancelAnimationFrame(this.state.raf);
      }
    });
  }
}