// === core/sfx.js (event SFX router; mute-able) ===
export class SFX {
  constructor() {
    this.enabled = true;
    const byId = id => document.getElementById(id);
    this.map = {
      good: byId('sfx-good') || byId('good'),
      bad: byId('sfx-bad') || byId('bad'),
      perfect: byId('sfx-perfect') || byId('perfect'),
      tick: byId('sfx-tick') || byId('tick'),
      powerup: byId('sfx-powerup') || byId('powerup'),
      fever_on: byId('sfx-fever-on') || byId('fever_on'),
      fever_off: byId('sfx-fever-off') || byId('fever_off'),
      quest_clear: byId('sfx-quest-clear') || byId('quest_clear'),
      mission_fail: byId('sfx-mission-fail') || byId('mission_fail'),
    };
  }
  setEnabled(v){ this.enabled = !!v; }
  isEnabled(){ return !!this.enabled; }
  _play(key){
    if(!this.enabled) return;
    const a = this.map[key];
    if (a && a.play) { try { a.currentTime = 0; a.play(); } catch {} }
  }
  good(){ this._play('good'); }
  bad(){ this._play('bad'); }
  perfect(){ this._play('perfect'); }
  tick(){ this._play('tick'); }
  power(){ this._play('powerup'); }
  fever(on=true){ this._play(on?'fever_on':'fever_off'); }
  quest(ok=true){ this._play(ok?'quest_clear':'mission_fail'); }
}
export default { SFX };
