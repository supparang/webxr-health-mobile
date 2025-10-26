// game/core/coach.js
// ระบบโค้ชพูดให้กำลังใจระหว่างเล่น
export class Coach {
  constructor(opts = {}) {
    this.lang = opts.lang || 'TH';
    this.textEl = document.getElementById('coachText');
    this.wrapEl = document.getElementById('coachHUD');
    this.timer = null;
  }

  speak(msg, ms = 2400) {
    if (!this.textEl || !this.wrapEl) return;
    this.textEl.textContent = msg;
    this.wrapEl.style.display = 'block';
    clearTimeout(this.timer);
    this.timer = setTimeout(() => { this.wrapEl.style.display = 'none'; }, ms);
  }

  onStart(mode) {
    const msgTH = {
      goodjunk: 'เก็บของดี หลีกเลี่ยงของขยะนะ!',
      groups: 'เก็บให้ตรงหมวดนะ!',
      hydration: 'รักษาสมดุลน้ำ 45–65%!',
      plate: 'จัดจานให้ครบทุกหมู่!'
    };
    const msgEN = {
      goodjunk: 'Pick good food, avoid junk!',
      groups: 'Match the right food groups!',
      hydration: 'Keep hydration 45–65%!',
      plate: 'Complete your healthy plate!'
    };
    const m = (this.lang === 'TH' ? msgTH : msgEN)[mode] || (this.lang==='TH'?'เริ่มกันเลย!':'Let’s go!');
    this.speak(m, 3000);
  }

  onEnd(score, { grade = 'A' } = {}) {
    const msgTH = score > 500 ? 'สุดยอด! ได้คะแนนดีมาก!' : 'ดีมาก! พยายามอีกนิดนะ!';
    const msgEN = score > 500 ? 'Great job!' : 'Keep it up!';
    this.speak(this.lang === 'TH' ? msgTH : msgEN, 3200);
  }

  setLang(l) { this.lang = l || 'TH'; }
}
