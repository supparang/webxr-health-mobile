// === vr/mission.js ===
export class MissionDeck{
  constructor(){
    this.pool = [
      { id:'good10',    level:'easy',   label:'เก็บของดี 10 ชิ้น',       check:s=>s.goodCount>=10 },
      { id:'avoid5',    level:'easy',   label:'หลีกของขยะ 5 ครั้ง',       check:s=>s.junkMiss>=5 },
      { id:'combo10',   level:'normal', label:'ทำคอมโบ 10',              check:s=>s.comboMax>=10 },
      { id:'good20',    level:'normal', label:'เก็บของดี 20 ชิ้น',       check:s=>s.goodCount>=20 },
      { id:'nostreak10',level:'normal', label:'ไม่พลาด 10 วิ',            check:s=>s.noMissTime>=10 },
      { id:'fever2',    level:'hard',   label:'เข้า Fever 2 ครั้ง',       check:s=>s.feverCount>=2 },
      { id:'combo20',   level:'hard',   label:'คอมโบ 20 ต่อเนื่อง',      check:s=>s.comboMax>=20 },
      { id:'score500',  level:'hard',   label:'ทำคะแนน 500+',             check:s=>s.score>=500 },
      { id:'star3',     level:'normal', label:'เก็บดาว ⭐ 3 ดวง',          check:s=>s.star>=3 },
      { id:'diamond1',  level:'hard',   label:'เก็บเพชร 💎 1 เม็ด',        check:s=>s.diamond>=1 },
    ];
    this.reset();
  }
  reset(){ this.currentIndex=0; this.stats={goodCount:0, junkMiss:0, comboMax:0, noMissTime:0, feverCount:0, score:0, star:0, diamond:0}; }
  draw3(){
    this.reset();
    const pick = (lvl)=>{
      const c = this.pool.filter(q=>q.level===lvl);
      return c[Math.floor(Math.random()*c.length)];
    };
    const out = [ pick('easy'), pick('normal'), pick('hard') ];
    this.deck = out;
    return out;
  }
  tick(ev){
    if(ev.good) this.stats.goodCount++;
    this.stats.comboMax = Math.max(this.stats.comboMax, ev.combo||0);
    this.stats.score = ev.score||0;
    if(ev.feverActive) this.stats.feverCount = Math.max(this.stats.feverCount, this.stats.feverCount+0);
    if(ev.star) this.stats.star++;
    if(ev.diamond) this.stats.diamond++;

    const cur = this.deck[this.currentIndex];
    if(cur && cur.check(this.stats)){
      this.currentIndex = Math.min(this.deck.length-1, this.currentIndex+1);
    }
  }
}
