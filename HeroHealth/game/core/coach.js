// core/coach.js — โค้ชให้กำลังใจใต้ FEVER
export class Coach {
  constructor(opts = {}) {
    this.lang = opts.lang || 'TH';
    this._elWrap = document.getElementById('coachHUD');
    this._elText = document.getElementById('coachText');
    this._hideTimer = 0;
    this._queue = [];
    this._busy = false;
    if (this._elWrap) this._elWrap.style.display = 'block';
  }

  setLang(l) { this.lang = l || 'TH'; }

  _show(text, ms = 1600) {
    if (!this._elWrap || !this._elText) return;
    this._elWrap.style.display = 'block';
    this._elText.textContent = text;

    // เล็ก ๆ น้อย ๆ: pulse
    this._elWrap.style.transition = 'transform .18s ease, opacity .18s ease';
    this._elWrap.style.transform = 'translateY(4px)';
    this._elWrap.style.opacity = '0.8';
    requestAnimationFrame(() => {
      this._elWrap.style.transform = 'translateY(0)';
      this._elWrap.style.opacity = '1';
    });

    clearTimeout(this._hideTimer);
    this._hideTimer = setTimeout(() => {
      this._elWrap.style.opacity = '0.0';
      this._elWrap.style.transform = 'translateY(4px)';
      setTimeout(() => {
        if (this._elWrap) { this._elWrap.style.opacity = '1'; this._elWrap.style.transform = 'translateY(0)'; }
        this._busy = false;
        this._drain();
      }, 180);
    }, ms);
  }

  _drain() {
    if (this._busy) return;
    const next = this._queue.shift();
    if (!next) return;
    this._busy = true;
    this._show(next.text, next.ms);
  }

  say(text, ms = 1600) {
    this._queue.push({ text, ms });
    this._drain();
  }

  onStart(modeKey) {
    const msgTH = {
      goodjunk: 'เริ่มลุย ดี vs ขยะ! เก็บของดี หลีกเลี่ยงกับดัก ✊',
      groups:   'จาน 5 หมู่! เลือกให้ถูกหมวดนะ!',
      hydration:'รักษาสมดุลน้ำให้พอดี!',
      plate:    'จัดจานสุขภาพให้ครบโควตา!'
    }[modeKey] || 'เริ่มลุยกันเลย!';
    const msgEN = {
      goodjunk: 'Let’s go! Pick healthy, dodge junk ✊',
      groups:   'Food Groups! Hit the right category!',
      hydration:'Keep hydration balanced!',
      plate:    'Build a healthy plate!'
    }[modeKey] || 'Go for it!';
    this.say(this.lang === 'TH' ? msgTH : msgEN, 1800);
  }

  onEnd(score, meta = {}) {
    const grade = meta.grade || 'A';
    const msgTH = `จบเกม! คะแนน ${score|0} เกรด ${grade} เยี่ยมมาก 👏`;
    const msgEN = `Finished! Score ${score|0}, Grade ${grade}. Nice job 👏`;
    this.say(this.lang === 'TH' ? msgTH : msgEN, 1800);
  }

  // บางเหตุการณ์พิเศษ
  onFever() {
    this.say(this.lang==='TH' ? 'FEVER ติดแล้ว! ไหลลื่นเลย!' : 'FEVER on! Keep it up!', 1400);
  }
  onCombo(n) {
    if (n===5) this.say(this.lang==='TH' ? 'คอมโบ 5! เท่!' : 'Combo 5! Nice!', 1200);
    if (n===10) this.say(this.lang==='TH' ? 'คอมโบ 10! สุดยอด!' : 'Combo 10! Awesome!', 1200);
    if (n===20) this.say(this.lang==='TH' ? 'คอมโบ 20!! ไฟลุก!' : 'Combo 20!! On fire!', 1200);
  }
}
