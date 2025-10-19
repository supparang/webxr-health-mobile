export class FeverSystem{
  constructor(){ this.timer=0; this.active=false; }
  scoreMul(){ return this.active?2:1; }
  update(dt){ if(this.active){ this.timer-=dt; if(this.timer<=0){ this.active=false; } } }
  onBad(){ this.active=false; }
}
