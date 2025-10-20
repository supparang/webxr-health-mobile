export class ScoreSystem{
  constructor(){ this.reset(); }
  reset(){ this.score=0; this.combo=0; this.bestCombo=0; }
  add(v){
    this.score+=v;
    if(v>0){ this.combo++; this.bestCombo=Math.max(this.bestCombo,this.combo); try{ coach?.onCombo?.(this.combo); if(this.combo>0 && this.combo % 5 === 0){ try{ systems?.fever&&(systems.fever.active=true, systems.fever.timer=6000); coach?.onFever?.(); }catch{} } }
    if(v<0){ this.bad(); }
    return this.score;
  }
  bad(){ this.combo=0; }
}