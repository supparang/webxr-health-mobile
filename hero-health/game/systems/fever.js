export class FeverSystem{
  constructor(){ this.active=false; this.level=0; this.timer=0; this.multi=1; this.len=6000; this.streak=0; }
  update(dt){ if(this.active){ this.timer -= dt; if(this.timer<=0){ this.active=false; this.level=0; this.multi=1; } } }
  onGood(){ this.streak++; if(!this.active && this.streak>=5){ this.enter(1); } else if(this.active && this.level<3 && this.streak%6===0){ this.level++; this.multi = 1 + this.level; this.timer += 1500; } }
  onBad(){ this.streak=0; if(this.active){ this.level=Math.max(0,this.level-1); this.multi = Math.max(1, 1 + this.level); if(this.level===0) this.active=false; } }
  enter(lv=1){ this.active=true; this.level=lv; this.multi=1+lv; this.timer=this.len; }
  scoreMul(){ return this.active ? this.multi : 1; }
  goldenChance(){ return this.active ? (0.05 * this.level) : 0; }
}