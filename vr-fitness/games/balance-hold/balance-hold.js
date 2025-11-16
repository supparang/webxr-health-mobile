// ==========================================================
// Balance Hold Engine — BH-ENGINE v1.0
// Modular Game Logic (PC, Mobile, VR Ready)
// Author: ChatGPT + Your VR Fitness Suite
//
// Usage:
// import { BalanceHold } from "./balance-hold.js";
// const bh = new BalanceHold({ stage, meter, hud, result });
// bh.start();
// ==========================================================

export class BalanceHold {
  constructor(options){
    this.stage  = options.stage;     // <div id="bh-stage">
    this.meter  = options.meter;     // <div id="bh-meter-fill">
    this.hud    = options.hud;       // {...}
    this.result = options.result;    // {...}

    this.config = Object.assign({
      duration     : 60,
      driftBase    : 0.4,  // ค่าแกว่งพื้นฐาน
      feverCombo   : 5,
      onfireCombo  : 8,
      punishForce  : 22, // ลด meter เมื่อสั่นแรง
      recoverSpeed : 16  // ฟื้นตัวของ meter
    }, options.config || {});

    this.state = {
      play     : false,
      elapsed  : 0,
      lastTs   : 0,
      score    : 0,
      hits     : 0,
      miss     : 0,
      combo    : 0,
      bestCombo: 0,
      fever    : 0,
      onfire   : false,
      meterVal : 0, // 0–100
      raf      : 0
    };

    // ค่าการแกว่ง (mock sensor ก่อน)
    this.drift = 0;

    this._bindEvents();
  }

  // ===== UI HUD =====
  updateHUD(){
    if(this.hud.time)  this.hud.time.textContent  = Math.max(0, Math.ceil(this.config.duration - this.state.elapsed));
    if(this.hud.score) this.hud.score.textContent = this.state.score;
    if(this.hud.combo) this.hud.combo.textContent = "x" + this.state.combo;
    if(this.hud.fever) this.hud.fever.style.transform = "scaleX(" + (this.state.fever / 100) + ")";
    this.meter.style.transform = "scaleX(" + (this.state.meterVal / 100) + ")";
  }

  floatText(txt, isBad=false){
    const el = document.createElement("div");
    el.className = "float-score" + (isBad?" miss":"");
    el.textContent = txt;
    el.style.left  = "50%";
    el.style.top   = "50%";
    el.style.transform = "translate(-50%, -50%)";
    this.stage.appendChild(el);
    setTimeout(()=>el.remove(),700);
  }

  // ===== Sensor Mock =====
  // PC/Mobile = ใช้ movement / pointer / tilt
  setDriftForce(v){
    this.drift = v;
  }

  // ===== Judge =====
  hit(){
    const nextCombo = this.state.combo + 1;
    const crit      = (nextCombo >= this.config.feverCombo);
    const onfire    = (nextCombo >= this.config.onfireCombo);

    let gain = 8 + (crit ? 12 : 0);

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
    this.state.fever = Math.min(100, this.state.combo * 12);

    this.floatText("+"+gain);
  }

  miss(){
    this.state.miss++;
    this.state.combo = 0;
    this.state.fever = 0;
    this.state.onfire = false;
    this.stage.classList.remove("onfire-screen");

    this.floatText("-5", true);
  }

  // ===== Loop =====
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

    // Random external sway (breathing + room drift)
    this.state.meterVal += (this.drift * this.config.punishForce) * dt;
    this.state.meterVal -= this.config.recoverSpeed * dt;

    // Clamp
    this.state.meterVal = Math.max(0, Math.min(100, this.state.meterVal));

    // Judge
    if(this.state.meterVal < 35){
      this.hit();
    } else if(this.state.meterVal > 70){
      this.miss();
    }

    this.updateHUD();
    this.state.raf = requestAnimationFrame(this.loop.bind(this));
  }

  // ===== Core =====
  reset(){
    const s = this.state;
    s.elapsed = s.lastTs = 0;
    s.score = s.hits = s.miss = s.combo = s.bestCombo = s.fever = 0;
    s.onfire = false;
    s.meterVal = 0;

    this.stage.classList.remove("onfire-screen");
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

    const total = this.state.hits + this.state.miss;
    const acc = total>0 ? this.state.hits/total : 0;

    let rank = "C";
    if(this.state.score>=1600 && acc>=0.95) rank="SSS";
    else if(this.state.score>=1100 && acc>=0.90) rank="S";
    else if(this.state.score>=800  && acc>=0.80) rank="A";
    else if(this.state.score>=500  && acc>=0.60) rank="B";

    if(this.result.box){
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

  // ===== Events =====
  _bindEvents(){
    // Mobile tilt
    window.addEventListener("deviceorientation", e=>{
      if(!this.state.play) return;
      const tilt = Math.abs(e.beta || 0) / 50; // 0–2
      this.setDriftForce(tilt);
    });

    // PC Move mouse → simulate sway
    this.stage.addEventListener("mousemove", e=>{
      if(!this.state.play) return;
      const rect=this.stage.getBoundingClientRect();
      const cx = rect.width/2;
      const diff = (e.clientX - cx) / rect.width;
      this.setDriftForce(Math.abs(diff));
    });

    // auto pause
    document.addEventListener("visibilitychange",()=>{
      if(document.hidden && this.state.play){
        this.state.play=false;
        cancelAnimationFrame(this.state.raf);
      }
    });
  }
}