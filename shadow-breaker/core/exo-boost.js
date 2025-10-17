<script>
/* =========================================================================
   EXO_BOOST: one-stop systems for fun & flow across all minigames
   Includes:
   - DynamicDifficulty
   - FeverManager / Overdrive
   - MissionManager (short goals)
   - Specials (gold/time/bomb/shield) + effects
   - Juice (camera shake / flash)
   - XP / Level / Daily quests (meta progression)
   - Season Packs registry (songs/maps/themes)
   Author: you 💪  Version: 1.0
   ========================================================================*/

(function (w){
  const LS = (k,v)=> (v===undefined? JSON.parse(localStorage.getItem(k)||'null')
                                     : localStorage.setItem(k, JSON.stringify(v)));

  /* ------------------------ Dynamic Difficulty ------------------------- */
  class DynamicDifficulty {
    constructor({baseSpeed=4.0, baseSpawn=600, minSpawn=380, maxSpawn=900, step=0.04, hitBias=+1, missBias=-2}={}){
      this.baseSpeed=baseSpeed; this.baseSpawn=baseSpawn;
      this.minSpawn=minSpawn; this.maxSpawn=maxSpawn;
      this.step=step; this.hitBias=hitBias; this.missBias=missBias;
      this.diffScore=0; // + ขึ้นยาก / - ผ่อน
    }
    onHit(){ this.diffScore += this.hitBias; }
    onMiss(){ this.diffScore += this.missBias; }
    getSpeedMul(){ return 1 + Math.max(-0.35, Math.min(0.65, this.diffScore*this.step)); }
    getSpawnIv(){ // ค่าช่วงสปอว์นที่ขึ้นกับความยาก
      const f = 1 - Math.max(-0.35, Math.min(0.65, this.diffScore*this.step)); // ยิ่งเก่ง ยิ่ง f ลด
      const iv = this.baseSpawn * f;
      return Math.round(Math.max(this.minSpawn, Math.min(this.maxSpawn, iv)));
    }
    tickDecay(dt){ // คืนสู่ค่ากลางช้า ๆ
      const k = dt/1000 * 0.35;
      this.diffScore *= (1 - Math.min(0.3, k));
    }
    reset(){ this.diffScore=0; }
  }

  /* ------------------------------ Fever -------------------------------- */
  class FeverManager {
    constructor({need=8, dur=9000, mul=2.0, barEl=null, flashEl=null}={}){
      this.need=need; this.dur=dur; this.mul=mul;
      this.barEl=barEl; this.flashEl=flashEl;
      this.on=false; this.t=0; this.streak=0;
    }
    hit(){
      if(!this.on){
        this.streak++;
        if(this.barEl) this.barEl.style.width = (100*Math.min(1,this.streak/this.need))+'%';
        if(this.streak>=this.need) this._enter();
      } else {
        this.t = Math.min(this.dur, this.t + 200); // ต่อเวลาเล็กน้อยเมื่อฮิต
      }
    }
    miss(){
      this.streak=0;
      if(!this.on && this.barEl) this.barEl.style.width='0%';
    }
    tick(dt){
      if(!this.on) return;
      this.t -= dt;
      if(this.t<=0) this._exit();
      else if(this.barEl) this.barEl.style.width = (100*Math.max(0,Math.min(1,this.t/this.dur)))+'%';
    }
    _enter(){
      this.on=true; this.t=this.dur;
      document.body.classList.add('feverOn');
      if(this.flashEl){ this.flashEl.classList.add('show'); setTimeout(()=> this.flashEl.classList.remove('show'), 140); }
    }
    _exit(){
      this.on=false;
      document.body.classList.remove('feverOn');
      if(this.barEl) this.barEl.style.width='0%';
    }
    mulScore(v){ return Math.round(v * (this.on? this.mul:1)); }
    reset(){ this.on=false; this.t=0; this.streak=0; if(this.barEl) this.barEl.style.width='0%'; document.body.classList.remove('feverOn'); }
  }

  /* ------------------------------ Missions ----------------------------- */
  class MissionManager {
    // metrics: {score, hits, misses, comboMax, avoided, perfectPct, timePlayed}
    constructor(preset='short'){
      this.active = this._buildPreset(preset);
      this.done = [];
    }
    _buildPreset(preset){
      // ทำให้สั้น สนุก จบไว
      const M = [
        { id:'combo15',  name:'Combo x15',   check:(m)=> (m.comboMax||0) >= 15, xp: 40 },
        { id:'avoid10',  name:'Dodge x10',   check:(m)=> (m.avoided||0)  >= 10, xp: 40 },
        { id:'p80',      name:'Perfect ≥80%',check:(m)=> (m.perfectPct||0)>= 80, xp: 60 },
      ];
      return (preset==='short')? M : M;
    }
    evaluate(metrics){
      this.done = this.active.filter(x=> x.check(metrics));
      return this.done;
    }
    rewardXP(){ return this.done.reduce((s,x)=> s+x.xp, 0); }
  }

  /* ------------------------------ Specials ----------------------------- */
  const Specials = {
    // ส่งอัตราเองได้ เช่น {gold:.12, time:.06, bomb:.08, shield:.10}
    roll(rates={gold:.10, time:.06, bomb:.08, shield:.12}){
      const r=Math.random();
      let acc=0;
      for (const k of ['gold','time','bomb','shield']){
        acc += (rates[k]||0);
        if (r<acc) return k;
      }
      return 'normal';
    },
    // คืนผลกระทบสำหรับเกมทั่วไป (สามารถ override ได้รายเกม)
    apply(kind, game){
      // game = {state, addTime(sec), addScore(v), penalty(v), onShieldHit(entity), onBomb(entity)}
      switch(kind){
        case 'gold':   game.addScore?.(150); break;
        case 'time':   game.addTime?.(2); break;
        case 'bomb':   game.penalty?.(120); game.onBomb?.(); break;
        case 'shield': game.onShieldHit?.(); break; // ต้องตีสองครั้ง: โค้ดเกมกำหนด hp เอง
      }
    }
  };

  /* -------------------------------- Juice ------------------------------ */
  const Juice = {
    shake(camera, power=0.015, ms=60){
      if(!camera) return;
      const c=camera, ox=c.position.x, oy=c.position.y;
      c.position.x = ox + (Math.random()*power - power/2);
      c.position.y = oy + (Math.random()*power - power/2);
      setTimeout(()=>{ c.position.x=ox; c.position.y=oy; }, ms);
    },
    flash(el){ if(el){ el.classList.add('show'); setTimeout(()=>el.classList.remove('show'),140); } }
  };

  /* --------------------------- XP / Level / Quests --------------------- */
  const XP_KEY = 'EXO_XP_V1';
  const XP = {
    get(){ return LS(XP_KEY) || {level:1, xp:0, skins:[], themes:[], sfx:[], daily:{} }; },
    set(v){ LS(XP_KEY, v); },
    add(amount){
      const s=this.get();
      s.xp += amount;
      let up=0;
      // เส้นโค้งเลเวล: 100, 220, 360, 520, ...
      while(s.xp >= this.needFor(s.level+1)){ s.level++; up++; }
      this.set(s);
      return {level:s.level, xp:s.xp, levelUp: up>0};
    },
    needFor(level){ return 100 + (level-1)*120; },
    unlock(type, id){
      const s=this.get();
      const arr = (type==='skin'? s.skins : type==='theme'? s.themes : s.sfx);
      if(!arr.includes(id)) arr.push(id);
      this.set(s);
    }
  };

  /* ----------------------------- Season Packs -------------------------- */
  // ใช้เป็น Registry กลางสำหรับเพลง/ฉาก/แพทเทิร์น
  const PACKS = {
    seasons: [
      { id:'s1', name:'Season 1: Kickoff', rhythm:[
          { id:'r101', name:'Pulse 110', bpm:110, diff:'normal', url:'../assets/rhythm/pulse110.json' },
          { id:'r102', name:'Drive 120', bpm:120, diff:'hard',   url:'../assets/rhythm/drive120.json' }
        ],
        dash:[
          { id:'d101', name:'City Lanes', diff:'normal' }
        ]
      }
    ]
  };

  // Expose
  w.EXO_BOOST = { DynamicDifficulty, FeverManager, MissionManager, Specials, Juice, XP, PACKS };
})(window);
</script>
