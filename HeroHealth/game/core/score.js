// === core/score.js ===
export class ScoreSystem {
  constructor () {
    this.value = 0;
    this.combo = 0;
    this.bestCombo = 0;

    this.fever = {
      charge: 0,       // 0..100
      active: false,
      timeLeft: 0      // sec
    };
  }

  reset () {
    this.value = 0;
    this.combo = 0;
    this.bestCombo = 0;
    this.fever.charge = 0;
    this.fever.active = false;
    this.fever.timeLeft = 0;
  }

  add (n = 0, { kind = 'good' } = {}) {
    // base add
    this.value += n|0;

    // combo rules
    if (n > 0) {
      this.combo++;
      if (this.combo > this.bestCombo) this.bestCombo = this.combo;
      // charge fever faster on perfect
      const gain = (kind === 'perfect') ? 15 : 8;
      this._chargeFever(gain);
    } else {
      // soft reset on miss/bad
      this.combo = 0;
    }
  }

  tick (dt) {
    if (this.fever.active) {
      this.fever.timeLeft -= dt;
      if (this.fever.timeLeft <= 0) {
        this.fever.active = false;
        this.fever.timeLeft = 0;
      }
    }
  }

  _chargeFever (v) {
    if (this.fever.active) return;
    this.fever.charge = Math.min(100, this.fever.charge + (v|0));
  }

  tryActivateFever () {
    if (this.fever.active) return false;
    if (this.fever.charge < 100) return false;
    this.fever.active = true;
    this.fever.timeLeft = 7; // seconds
    this.fever.charge = 0;
    return true;
  }

  get () { return this.value|0; }
}
