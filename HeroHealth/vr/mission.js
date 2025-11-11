// === vr/mission.js (safe) ===
export class MissionDeck {
  constructor(opts = {}) {
    this.pool = (opts.pool && Array.isArray(opts.pool)) ? opts.pool : [
      { id:'good10',    level:'easy',   label:'เก็บของดี 10 ชิ้น',  check:s=>s.goodCount>=10,  prog:s=>Math.min(10,s.goodCount), target:10 },
      { id:'avoid5',    level:'easy',   label:'หลีกของขยะ 5 ครั้ง',  check:s=>s.junkMiss>=5,    prog:s=>Math.min(5,s.junkMiss),   target:5  },
      { id:'combo10',   level:'normal', label:'ทำคอมโบ 10',         check:s=>s.comboMax>=10,   prog:s=>Math.min(10,s.comboMax),  target:10 },
      { id:'good20',    level:'normal', label:'เก็บของดี 20 ชิ้น',  check:s=>s.goodCount>=20,  prog:s=>Math.min(20,s.goodCount), target:20 },
      { id:'nostreak10',level:'normal', label:'ไม่พลาด 10 วิ',       check:s=>s.noMissTime>=10, prog:s=>Math.min(10,s.noMissTime), target:10 },
      { id:'fever2',    level:'hard',   label:'เข้า Fever 2 ครั้ง',  check:s=>s.feverCount>=2,  prog:s=>Math.min(2,s.feverCount), target:2  },
      { id:'combo20',   level:'hard',   label:'คอมโบแตะ 20',        check:s=>s.comboMax>=20,   prog:s=>Math.min(20,s.comboMax),  target:20 },
      { id:'score500',  level:'hard',   label:'ทำคะแนน 500+',       check:s=>s.score>=500,     prog:s=>Math.min(500,s.score),    target:500 },
      { id:'star3',     level:'normal', label:'เก็บดาว ⭐ 3',       check:s=>s.star>=3,        prog:s=>Math.min(3,s.star),       target:3  },
      { id:'diamond1',  level:'hard',   label:'เก็บเพชร 💎 1',      check:s=>s.diamond>=1,     prog:s=>Math.min(1,s.diamond),    target:1  },
    ];
    this.reset();
  }
  reset(){
    this.currentIndex=0;
    this.deck=[];
    this.stats={goodCount:0,junkMiss:0,comboMax:0,noMissTime:0,feverCount:0,score:0,star:0,diamond:0};
    this._paused=false;
  }
  draw3(){
    this.reset();
    const pickBy=l=>{const c=this.pool.filter(q=>q.level===l);return c.length?c[(Math.random()*c.length)|0]:this.pool[(Math.random()*this.pool.length)|0];};
    const m=new Map();
    for(const l of ['easy','normal','hard']){
      let q=pickBy(l), guard=40;
      while(m.has(q.id)&&guard--) q=pickBy(l);
      m.set(q.id,q);
    }
    this.deck=[...m.values()];
    return this.deck;
  }
  pause(){this._paused=true;}
  resume(){this._paused=false;}
  second(){ if(this._paused) return; this.stats.noMissTime=Math.min(9999,this.stats.noMissTime+1); this._autoAdvance(); }
  onGood(){ this.stats.goodCount++; this._autoAdvance(); }
  onJunk(){ this.stats.junkMiss++; this.stats.noMissTime=0; this._autoAdvance(); }
  onStar(){ this.stats.star++; this._autoAdvance(); }
  onDiamond(){ this.stats.diamond++; this._autoAdvance(); }
  onFeverStart(){ this.stats.feverCount++; this._autoAdvance(); }
  updateScore(s){ if(Number.isFinite(s)) this.stats.score=Math.max(this.stats.score,s); this._autoAdvance(); }
  updateCombo(c){ if(Number.isFinite(c)) this.stats.comboMax=Math.max(this.stats.comboMax,c); this._autoAdvance(); }
  tick(ev={}){
    if(ev.good) this.onGood();
    if(ev.junk) this.onJunk();
    if(ev.star) this.onStar();
    if(ev.diamond) this.onDiamond();
    if(ev.feverStart||ev.feverActive===true) this.onFeverStart();
    if(Number.isFinite(ev.score)) this.updateScore(ev.score);
    if(Number.isFinite(ev.combo)) this.updateCombo(ev.combo);
    return this._autoAdvance();
  }
  _autoAdvance(){
    const cur=this.deck[this.currentIndex]; if(!cur) return false;
    if(cur.check(this.stats)){ this.currentIndex=Math.min(this.deck.length-1,this.currentIndex+1); return true; }
    return false;
  }
  getCurrent(){ return this.deck[this.currentIndex]||null; }
  getProgress(){ return this.deck.map((q,i)=>({id:q.id,label:q.label,level:q.level,done:q.check(this.stats),prog:q.prog?q.prog(this.stats):undefined,target:q.target??undefined,current:i===this.currentIndex})); }
  isCleared(){ if(this.deck.length===0) return false; const last=this.deck[this.deck.length-1]; return this.currentIndex===this.deck.length-1 && last.check(this.stats); }
}
export default { MissionDeck };