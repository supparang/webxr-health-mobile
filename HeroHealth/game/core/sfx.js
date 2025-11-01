// === core/sfx.js ===
// ใช้ <audio id="sfx-good|sfx-bad|sfx-perfect|sfx-tick|sfx-powerup"> จาก index.html
function id(id){ return document.getElementById(id); }

export class SFX {
  constructor() {
    this.enabled = true;
    this.bank = {
      good:    id('sfx-good'),
      bad:     id('sfx-bad'),
      perfect: id('sfx-perfect'),
      tick:    id('sfx-tick'),
      powerup: id('sfx-powerup'),
    };
  }
  setEnabled(v){ this.enabled = !!v; }
  isEnabled(){ return !!this.enabled; }

  _play(tag){
    if (!this.enabled) return;
    const a = this.bank[tag];
    try { a && (a.currentTime = 0, a.play()); } catch {}
  }
  play(tag){ this._play(tag); }
  tick(){ this._play('tick'); }
  good(){ this._play('good'); }
  bad(){ this._play('bad'); }
  perfect(){ this._play('perfect'); }
  power(){ this._play('powerup'); }

  // โหลดแบบชี้ id (เผื่อเรียกจากหน้า)
  static loadIds(ids = []) {
    // no-op สำหรับ compatibility
    return true;
  }
}
export const SFXLoaded = true;
