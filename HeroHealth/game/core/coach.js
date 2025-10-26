// core/coach.js
// โค้ชปลุกใจ: มีคิวข้อความ, ระดับน้ำเสียง (good/hint/bad/system), auto-hide, กันสแปม

export class Coach {
  constructor({ lang = 'TH' } = {}) {
    this.lang = lang;
    this.queue = [];
    this.busy = false;
    this.holdMs = 1400;         // เวลาโชว์ขั้นต่ำ
    this.cooldownMs = 450;      // เวลาเว้นระหว่างข้อความ
    this.maxLen = 80;
    this._mount();
  }

  _mount() {
    this.box = document.getElementById('coachBox');
    this.textEl = document.getElementById('coachText');
    if (this.box) this.box.style.display = 'none';
  }

  setLang(l) { this.lang = l || 'TH'; }

  say(msg, tone = 'system') {
    if (!msg) return;
    const clean = String(msg).slice(0, this.maxLen);
    this.queue.push({ msg: clean, tone, ts: Date.now() });
    this._drain();
  }

  onStart(modeKey) {
    const m = (this.lang === 'TH')
      ? 'เริ่มกันเลย! โฟกัสให้ดี สู้ ๆ 💪'
      : 'Let’s go! Stay focused and have fun! 💪';
    this.say(m, 'hint');
  }

  onEnd(score, { grade = 'A' } = {}) {
    const m = (this.lang === 'TH')
      ? `จบเกม! คะแนน ${score|0} เกรด ${grade} เยี่ยมมาก!`
      : `Finished! Score ${score|0}, grade ${grade}. Great work!`;
    this.say(m, 'good');
  }

  _drain() {
    if (this.busy || !this.queue.length) return;
    this.busy = true;

    const { msg, tone } = this.queue.shift();
    const color =
      tone === 'good'  ? '#8fffa5' :
      tone === 'bad'   ? '#ff9b9b' :
      tone === 'hint'  ? '#aee3ff' : '#fff';

    if (this.box && this.textEl) {
      this.textEl.textContent = msg;
      this.box.style.display = 'flex';
      this.box.style.borderColor = color;
      this.textEl.style.color = color;

      // animation in
      this.box.style.opacity = '0';
      this.box.style.transform = 'translateY(8px)';
      requestAnimationFrame(() => {
        this.box.style.transition = 'opacity .22s, transform .22s';
        this.box.style.opacity = '1';
        this.box.style.transform = 'translateY(0)';
      });

      setTimeout(() => {
        // animation out
        this.box.style.opacity = '0';
        this.box.style.transform = 'translateY(8px)';
        setTimeout(() => {
          this.box.style.display = 'none';
          this.busy = false;
          setTimeout(() => this._drain(), this.cooldownMs);
        }, 220);
      }, this.holdMs);
    } else {
      // fallback console
      console.log('[Coach]', msg);
      this.busy = false;
      setTimeout(() => this._drain(), this.cooldownMs);
    }
  }
}
