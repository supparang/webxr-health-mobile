<script>
/*! EXO_BOOST Lite v1.0 — minimal & API compatible */
(function(w){ "use strict";

/* ---------- tiny safe storage (no-op tolerant) ---------- */
const _get=(k,fb=null)=>{try{const v=localStorage.getItem(k);return v?JSON.parse(v):fb;}catch(e){return fb;}};
const _set=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}};

/* ============== Dynamic Difficulty (core) ============== */
class DynamicDifficulty{
  constructor(o={}){
    const d={baseSpeed:4.0,baseSpawn:600,minSpawn:380,maxSpawn:900,step:0.04,hitBias:+1,missBias:-2,decay:0.35};
    Object.assign(this,d,o); this.diffScore=0;
  }
  onHit(){this.diffScore+=this.hitBias;}
  onMiss(){this.diffScore+=this.missBias;}
  getSpeedMul(){const x=this.diffScore*this.step; return 1+Math.max(-0.35,Math.min(0.65,x));}
  getSpawnIv(){const x=this.diffScore*this.step; const f=1-Math.max(-0.35,Math.min(0.65,x)); const iv=this.baseSpawn*f; return Math.round(Math.max(this.minSpawn,Math.min(this.maxSpawn,iv)));}
  tickDecay(dtMs){const k=Math.min(1,(dtMs/1000)*this.decay); this.diffScore*=(1-Math.min(0.3,k));}
  reset(){this.diffScore=0;}
}

/* ================= Fever / Overdrive (core) ============ */
class FeverManager{
  constructor(o={}){const d={need:8,dur:9000,mul:2.0,barEl:null,flashEl:null};Object.assign(this,d,o);this.on=false;this.t=0;this.streak=0;}
  hit(){if(!this.on){this.streak++; if(this.barEl)this.barEl.style.width=(100*Math.min(1,this.streak/this.need))+'%'; if(this.streak>=this.need)this._enter();} else {this.t=Math.min(this.dur,this.t+200);}}
  miss(){if(!this.on){this.streak=0; if(this.barEl)this.barEl.style.width='0%';}}
  tick(dt){if(!this.on)return; this.t-=dt; if(this.t<=0){this._exit();}else if(this.barEl){const p=Math.max(0,Math.min(1,this.t/this.dur)); this.barEl.style.width=(p*100)+'%';}}
  _enter(){this.on=true; this.t=this.dur; document.body.classList.add('feverOn'); if(this.flashEl){this.flashEl.classList.add('show'); setTimeout(()=>this.flashEl.classList.remove('show'),140);}}
  _exit(){this.on=false; this.t=0; this.streak=0; document.body.classList.remove('feverOn'); if(this.barEl)this.barEl.style.width='0%';}
  mulScore(v){return Math.round(v*(this.on?this.mul:1));}
  reset(){this.on=false; this.t=0; this.streak=0; if(this.barEl)this.barEl.style.width='0%'; document.body.classList.remove('feverOn');}
}

/* =================== Specials (core) =================== */
const Specials={
  roll(rates={gold:.10,time:.06,bomb:.08,shield:.12}){
    const keys=['gold','time','bomb','shield']; const r=Math.random(); let acc=0;
    for(const k of keys){acc+=(rates[k]||0); if(r<acc)return k;} return 'normal';
  },
  // generic apply hook (optional inเกม; Lite ทำแบบปลอดภัย)
  apply(kind,api){switch(kind){
    case 'gold':   api?.addScore && api.addScore(150); break;
    case 'time':   api?.addTime  && api.addTime(2);    break;
    case 'bomb':   api?.penalty  && api.penalty(120);  api?.onBomb && api.onBomb(); break;
    case 'shield': api?.onShieldHit && api.onShieldHit(); break;
  }}
};

/* ===================== Juice (core) ==================== */
const Juice={
  shake(cam,power=.015,ms=60){try{if(!cam)return; const c=cam,ox=c.position.x,oy=c.position.y; c.position.x=ox+(Math.random()*power-power/2); c.position.y=oy+(Math.random()*power-power/2); setTimeout(()=>{c.position.x=ox;c.position.y=oy;},ms);}catch(e){}},
  flash(el){if(!el)return; el.classList.add('show'); setTimeout(()=>el.classList.remove('show'),140);}
};

/* ====== Stubs: Missions / XP / PACKS (API compatible) == */
class MissionManager{
  constructor(){this.active=[];this.done=[];}
  evaluate(){this.done=[];return this.done;}
  rewardXP(){return 0;}
  reset(){this.done=[];}
}
const XP={
  get(){return _get('EXO_XP_VLITE',{level:1,xp:0});},
  set(v){_set('EXO_XP_VLITE',v);},
  needFor(lvl){return 100+(lvl-1)*120;},
  add(amount){const s=this.get(); s.xp+=Math.max(0,Math.round(amount||0)); while(s.xp>=this.needFor(s.level+1))s.level++; this.set(s); return {level:s.level,xp:s.xp,levelUp:false};},
  unlock(){return this.get();},
  reset(){this.set({level:1,xp:0});}
};
const PACKS={seasons:[]}; // ว่างไว้ ลดน้ำหนัก

/* ================ Export =============================== */
w.EXO_BOOST={version:'1.0-lite',DynamicDifficulty,FeverManager,Specials,Juice,MissionManager,XP,PACKS};

})(window);
</script>
