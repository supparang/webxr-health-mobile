// === core/score.js ===
// คำนวณคะแนน + คอมโบ + bestCombo
export class ScoreSystem {
  constructor(){
    this.value = 0;
    this.combo = 0;
    this.bestCombo = 0;
  }
  add(n = 0){
    this.value += (n|0);
  }
  incCombo(){
    this.combo = (this.combo|0) + 1;
    if ((this.combo|0) > (this.bestCombo|0)) this.bestCombo = this.combo|0;
  }
  resetCombo(){ this.combo = 0; }
  get(){ return this.value|0; }
  reset(){ this.value = 0; this.combo = 0; this.bestCombo = 0; }
}
export default ScoreSystem;
