// core/sfx.js
// จัดการเสียงอย่างง่าย + ปุ่มเปิด/ปิด + ปลดล็อกเสียงสำหรับ iOS/Android

export class SFX {
  constructor() {
    this.enabled = (localStorage.getItem('hha_sound') !== '0');
    this._unlocked = false;
  }

  setEnabled(on) {
    this.enabled = !!on;
  }

  unlock() {
    if (this._unlocked) return;
    const ids = ['sfx-good','sfx-bad','sfx-perfect','sfx-tick','sfx-powerup'];
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        try { el.play().then(()=>{ el.pause(); el.currentTime = 0; }); } catch {}
      }
    });
    this._unlocked = true;
  }

  play(id) {
    if (!this.enabled) return;
    const el = document.getElementById(id);
    if (el) {
      try { el.currentTime = 0; el.play(); } catch {}
    }
  }

  good()    { this.play('sfx-good'); }
  bad()     { this.play('sfx-bad'); }
  perfect() { this.play('sfx-perfect'); }
  tick()    { this.play('sfx-tick'); }
  power()   { this.play('sfx-powerup'); }
}
