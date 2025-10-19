// systems/score.js
export class ScoreSystem{
  constructor(){ this.score=0; this.combo=1; this.best=0; }
  add(base){ this.score = Math.max(0, this.score + base*this.combo); this.best = Math.max(this.best, this.score); }
  good(){ this.combo = Math.min(6, this.combo+1); }
  bad(){ this.combo = 1; }
  reset(){ this.score=0; this.combo=1; }
}
