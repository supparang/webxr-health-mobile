/* ===================================================
   HEROHEALTH GAME DIRECTOR
   FEVER + AI Difficulty + Mini Boss
   Works with ALL fitness games
=================================================== */

(function(global){
'use strict';

function clamp(v,min,max){ return Math.max(min,Math.min(max,v)); }

class HHGameDirector{

  constructor(opts={}){
    this.score = 0;
    this.combo = 0;
    this.miss = 0;

    this.level = 1;
    this.spawnRate = 1;
    this.speedMul = 1;

    this.fever = false;
    this.boss = false;

    this.lastAdjust = performance.now();
  }

  /* ======================
     PLAYER EVENTS
  ====================== */

  hit(){
    this.score++;
    this.combo++;
    this.adjustDifficulty();
    this.checkFever();
  }

  missHit(){
    this.combo = 0;
    this.miss++;
    this.adjustDifficulty(true);
  }

  /* ======================
     AI DIFFICULTY DIRECTOR
  ====================== */

  adjustDifficulty(isMiss=false){

    const now = performance.now();
    if(now - this.lastAdjust < 800) return;
    this.lastAdjust = now;

    const skill = clamp(
      (this.combo*0.08) - (this.miss*0.05),
      -1, 3
    );

    this.level = clamp(1 + skill,1,5);

    this.spawnRate = 1 + this.level*0.25;
    this.speedMul  = 1 + this.level*0.18;

    global.dispatchEvent(new CustomEvent('hh:difficulty',{
      detail:{
        level:this.level,
        spawnRate:this.spawnRate,
        speed:this.speedMul
      }
    }));
  }

  /* ======================
     FEVER MODE
  ====================== */

  checkFever(){
    if(this.fever) return;

    if(this.combo >= 8){
      this.startFever();
    }
  }

  startFever(){
    this.fever = true;

    global.dispatchEvent(new CustomEvent('hh:fever',{detail:{on:true}}));

    setTimeout(()=>{
      this.fever=false;
      global.dispatchEvent(new CustomEvent('hh:fever',{detail:{on:false}}));
    },6000);
  }

  /* ======================
     MINI BOSS
  ====================== */

  maybeSpawnBoss(){

    if(this.boss) return;

    if(this.score>0 && this.score % 25 === 0){
      this.startBoss();
    }
  }

  startBoss(){
    this.boss = true;

    global.dispatchEvent(new CustomEvent('hh:boss',{detail:{on:true}}));

    setTimeout(()=>{
      this.boss=false;
      global.dispatchEvent(new CustomEvent('hh:boss',{detail:{on:false}}));
    },8000);
  }

}

global.HHGameDirector = HHGameDirector;

})(window);