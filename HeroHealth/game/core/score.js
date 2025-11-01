// === core/score.js ===
export class ScoreSystem {
  constructor() {
    this.value = 0;
    this.combo = 0;
    this.bestCombo = 0;
  }
  add(n = 0) {
    this.value += (n | 0);
    this.combo = (this.combo | 0) + (n > 0 ? 1 : 0);
    if ((this.combo | 0) > (this.bestCombo | 0)) this.bestCombo = this.combo | 0;
  }
  miss() {
    this.combo = 0;
  }
  reset() {
    this.value = 0;
    this.combo = 0;
    this.bestCombo = 0;
  }
  get() {
    return this.value | 0;
  }
}
