// ==========================================================
// Jump Duck Engine — JD-ENGINE v1.0
// Modular Game Logic for use with play.html
// Author: ChatGPT with your VR Fitness system
// Usage:
// import { JumpDuck } from "./jump-duck.js";
// const jd = new JumpDuck({ stage, player, hud, result });
// jd.start();
// ==========================================================

export class JumpDuck {
  constructor(options) {
    this.stage  = options.stage;   // <div id="jd-stage">
    this.player = options.player;  // <div id="player">
    this.hud    = options.hud;     // { time, score, combo, fever }
    this.result = options.result;  // {...}

    this.config = Object.assign({
      duration   : 90,
      spawnBase  : 1.2,
      feverCombo : 5,
      onfireCombo: 8,
      lifetime   : 1.2
    }, options.config || {});

    this.obstacles = new Set();

    this.state = {
      play:false,
      elapsed:0,
      lastTs:0,
      spawnTimer:0,
      score:0,
      hits:0,
      miss:0,
      combo:0,
      bestCombo:0,
      fever:0,
      onfire:false,
      raf:0
    };

    this.OBS_HIGH = "🪨"; // ต้อง Duck
    this.OBS_LOW  = "🔥"; // ต้อง Jump

    this._bindEvents();
  }

  rand(a,b){ return Math.random()*(b-a)+a; }

  updateHUD(){
    if(this.hud.time) this.hud.time.textContent = Math.ceil(this.config.duration - this.state.elapsed);
    if(this.hud.score) this.hud.score.textContent = this.state.score;
    if(this.hud.combo) this.hud.combo.textContent = "x" + this.state.combo;
    if(this.hud.fever) this.hud.fever.style.transform = "scaleX(" + (this.state.fever / 100) + ")";
  }

  // ----- Floating Score -----
  floatScore(val, isMiss, crit){
    const el = document.createElement("div");
    el.className = "float-score" + (isMiss ? " miss" : "") + (crit ? " crit" : "");
    el.textContent = (isMiss?"-"+val:"+"+val);
    el.style.left="50%"; el.style.bottom="38%";
    el.style.transform="translateX(-50%)";
    this.stage.appendChild(el);
    setTimeout(()=>el.remove(),700);
  }

  // ----- Input Actions -----
  jump(){
    if(this.player.classList.contains("ducking")) return;
    this.player.classList.add("jumping");
    setTimeout(()=>this.player.classList.remove("jumping"),500);
  }

  duck(){
    if(this.player.classList.contains("jumping")) return;
    this.player.classList.add("ducking");
    setTimeout(()=>this.player.classList.remove("ducking"),450);
  }

  // ----- Spawn -----
  spawn(){
    if(!this.state.play) return;

    const el = document.createElement("div");
    const isHigh = Math.random() < 0.5;

    el.className = "obstacle " + (isHigh?"obs-high":"obs-low");
    el.textContent = isHigh ? this.OBS_HIGH : this.OBS_LOW;
    el.dataset.type = isHigh ? "high" : "low";

    const rect = this.stage.getBoundingClientRect();
    el.style.left = (rect.width*0.50) + "px";
    el.style.top  = (isHigh? (rect.height*0.40) : (rect.height*0.70)) + "px";

    this.obstacles.add(el);
    this.stage.appendChild(el);

    setTimeout(()=>this.check(el), this.config.lifetime * 1000);
  }

  // ----- Judge -----
  check(el){
    if(!this.obstacles.has(el)) return;

    const isHigh = el.dataset.type === "high";
    const correct =
      (isHigh && this.player.classList.contains("ducking")) ||
      (!isHigh && this.player.classList.contains("jumping"));

    this.obstacles.delete(el);
    el.remove();

    correct ? this.hit() : this.miss();
    this.updateHUD();
  }

  hit(){
    const nextCombo  = this.state.combo + 1;
    const crit       = (nextCombo >= this.config.feverCombo);
    const onfire     = (nextCombo >= this.config.onfireCombo);

    let gain = 12 + (crit?18:0);

    if(onfire){
      if(!this.state.onfire){
        this.state.onfire = true;
        this.stage.classList.add("onfire-screen");
      }
      gain *= 2;
    }

    this.state.score += gain;
    this.state.hits++;
    this.state.combo++;
    this.state.bestCombo = Math.max(this.state.bestCombo, this.state.combo);

    this.state.fever = Math.min(100, this.state.combo * 10);
    this.floatScore(gain,false,crit);
  }

  miss(){
    this.state.miss++;
    this.state.combo = 0;
    this.state.fever = 0;
    this.state.onfire = false;
    this.stage.classList.remove("onfire-screen");
    this.floatScore(5,true,false);
  }

  // ----- Game Loop -----
  loop(ts){
    if(!this.state.play) return;

    if(!this.state.lastTs) this.state.lastTs = ts;
    const dt = (ts - this.state.lastTs) / 1000;
    this.state.lastTs = ts;
    this.state.elapsed += dt;

    if(this.state.elapsed >= this.config.duration){
      this.finish();
      return;
    }

    this.state.spawnTimer += dt;
    const t = this.state.elapsed / this.config.duration;
    const dyn = Math.max(this.config.spawnBase * (1 - 0.5*t), 0.4);

    if(this.state.spawnTimer >= dyn){
      this.state.spawnTimer = 0;
      this.spawn();
    }

    this.updateHUD();
    this.state.raf = requestAnimationFrame(this.loop.bind(this));
  }

  // ----- Core Control -----
  reset(){
    this.state.elapsed=this.state.spawnTimer=this.state.lastTs=0;
    this.state.score=this.state.hits=this.state.miss=this.state.combo=this.state.bestCombo=this.state.fever=0;
    this.state.onfire=false;
    this.stage.classList.remove("onfire-screen");

    this.obstacles.forEach(el=>el.remove());
    this.obstacles.clear();
    this.updateHUD();
  }

  start(){
    this.reset();
    if(this.result.box) this.result.box.style.display="none";
    this.state.play = true;
    this.state.raf = requestAnimationFrame(this.loop.bind(this));
  }

  finish(){
    this.state.play = false;
    cancelAnimationFrame(this.state.raf);

    // cleanup
    this.obstacles.forEach(el=>el.remove());
    this.obstacles.clear();

    const total=this.state.hits+this.state.miss;
    const acc = total>0 ? this.state.hits/total : 0;

    let rank="C";
    if(this.state.score>=1600 && acc>=0.95) rank="SSS";
    else if(this.state.score>=1100 && acc>=0.90) rank="S";
    else if(this.state.score>=800  && acc>=0.80) rank="A";
    else if(this.state.score>=500  && acc>=0.60) rank="B";

    if(this.result && this.result.box){
      this.result.box.style.display="flex";
      if(this.result.score) this.result.score.textContent=this.state.score;
      if(this.result.hits)  this.result.hits.textContent=this.state.hits;
      if(this.result.miss)  this.result.miss.textContent=this.state.miss;
      if(this.result.acc)   this.result.acc.textContent=Math.round(acc*100)+"%";
      if(this.result.best)  this.result.best.textContent="x"+this.state.bestCombo;
      if(this.result.time)  this.result.time.textContent=this.config.duration;
      if(this.result.rank)  this.result.rank.textContent=rank;
    }
  }

  // ----- Event Binding -----
  _bindEvents(){
    document.addEventListener("keydown", e=>{
      if(!this.state.play) return;
      if(e.code==="ArrowUp" || e.code==="Space") this.jump();
      if(e.code==="ArrowDown") this.duck();
    });

    this.stage.addEventListener("click", ()=>{
      if(!this.state.play) return;
      Math.random()<0.5 ? this.jump() : this.duck();
    });

    document.addEventListener("visibilitychange", ()=>{
      if(document.hidden && this.state.play){
        this.state.play=false;
        cancelAnimationFrame(this.state.raf);
      }
    });
  }
}