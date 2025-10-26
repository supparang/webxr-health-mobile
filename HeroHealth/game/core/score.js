// game/core/score.js
export class ScoreSystem{
  constructor(){ this.score=0; this.combo=0; }
  reset(){ this.score=0; this.combo=0; }
  add(n){ this.score += (n|0); }
}
