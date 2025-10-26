// game/core/coach.js
// โค้ช: ข้อความปลุกใจ/คำใบ้ระหว่างเล่น + auto-hide + คิวข้อความ
export class Coach {
  constructor(opts = {}) {
    this.lang = opts.lang || 'TH';
    this.wrap = document.getElementById('coachHUD');
    this.text = document.getElementById('coachText');
    if (!this.wrap || !this.text) {
      this.wrap = document.createElement('div');
      this.wrap.id = 'coachHUD';
      this.wrap.className = 'coach';
      this.wrap.style.display = 'none';
      this.text = document.createElement('div');
      this.text.id = 'coachText';
      this.wrap.appendChild(this.text);
      document.body.appendChild(this.wrap);
    }
    this.queue = [];
    this.showing = false;
    this.hideTimer = 0;
    this.lastPep = 0;
    this.cooldownMs = 1800;
  }

  setLang(l) { this.lang = l || 'TH'; }

  say(msg, { stayMs = 1400, force = false } = {}) {
    if (!msg) return;
    this.queue.push({ msg, stayMs, force });
    this.#drain();
  }

  onStart(modeKey) {
    const th = ['พร้อมลุย! เก็บให้ถูกนะ 💪', 'เริ่มแล้ว! โฟกัสสิ่งดี ๆ ✨', 'ไปกันเลย! อย่ายอมแพ้! 🔥'];
    const en = ['Let’s go! Pick the good stuff 💪', 'Game on! Focus on the good ✨', 'Go go go! Don’t give up! 🔥'];
    this.say((this.lang === 'TH' ? th : en)[(Math.random() * th.length) | 0], { stayMs: 1600 });
  }

  onEnd(score, info) {
    const good = this.lang === 'TH'
      ? `ยอดเยี่ยม! ได้ ${score} คะแนน`
      : `Great job! You scored ${score}`;
    this.say(good, { stayMs: 1800, force: true });
  }

  onCombo(x) {
    const now = Date.now();
    if (now - this.lastPep < this.cooldownMs) return;
    this.lastPep = now;
    let line;
    if (this.lang === 'TH') {
      if (x >= 20) line = 'คอมโบไฟลุก! รักษาจังหวะไว้! 🔥';
      else if (x >= 10) line = 'จังหวะมาแล้ว! ต่อเนื่อง! ✨';
      else if (x >= 5)  line = 'กำลังดี! ไปต่อ! 💪';
    } else {
      if (x >= 20) line = 'Combo on fire! Keep it up! 🔥';
      else if (x >= 10) line = 'You’re rolling! Keep going! ✨';
      else if (x >= 5)  line = 'Nice rhythm! Push on! 💪';
    }
    if (line) this.say(line, { stayMs: 1200 });
  }

  onFever() {
    const line = this.lang === 'TH' ? 'FEVER! คูณคะแนน กดให้สุด! ✨' : 'FEVER! Score it big! ✨';
    this.say(line, { stayMs: 1400, force: true });
  }

  // ===== Cheer mini-quests for goodjunk =====
  onQuestStart(q) {
    const TH = {
      collect: `ภารกิจ: เก็บของดีให้ครบ ${q.need} ชิ้น ✨`,
      avoid:   `ภารกิจ: เลี่ยงของขยะ ${q.need}s ⏳`,
      perfect: `ภารกิจ: PERFECT ${q.need} ครั้ง 💎`,
      combo:   `ภารกิจ: ไปให้ถึงคอมโบ x${q.need} 🚀`,
      streak:  `ภารกิจ: ของดีติดกัน ${q.need} ครั้ง 🔗`,
    };
    const EN = {
      collect: `Quest: Collect ${q.need} healthy ✨`,
      avoid:   `Quest: Avoid junk for ${q.need}s ⏳`,
      perfect: `Quest: Get ${q.need} PERFECT 💎`,
      combo:   `Quest: Reach combo x${q.need} 🚀`,
      streak:  `Quest: ${q.need} healthy in a row 🔗`,
    };
    const msg = (this.lang === 'TH' ? TH : EN)[q.type] || 'Quest!';
    this.say(msg, { stayMs: 1600, force: true });
  }

  onQuestProgress(q) {
    const TH = {
      collect: `ดีมาก! ${q.progress}/${q.need} แล้ว ✨`,
      avoid:   `ใกล้แล้ว! เหลือ ${Math.max(0, q.remain|0)}s ⏳`,
      perfect: `PERFECT ${q.progress}/${q.need} 💎`,
      combo:   `คอมโบปัจจุบัน x${q.comboNow||0} / x${q.need}`,
      streak:  `ติดกัน ${q.streak||0}/${q.need} 🔗`,
    };
    const EN = {
      collect: `Nice! ${q.progress}/${q.need} ✨`,
      avoid:   `Almost! ${Math.max(0, q.remain|0)}s left ⏳`,
      perfect: `PERFECT ${q.progress}/${q.need} 💎`,
      combo:   `Combo x${q.comboNow||0} / x${q.need}`,
      streak:  `In a row ${q.streak||0}/${q.need} 🔗`,
    };
    const msg = (this.lang === 'TH' ? TH : EN)[q.type];
    if (msg) this.say(msg, { stayMs: 1100 });
  }

  onQuestComplete(q) {
    const msg = this.lang === 'TH' ? '🏁 ภารกิจสำเร็จ!' : '🏁 Quest Complete!';
    this.say(msg, { stayMs: 1500, force: true });
  }

  onQuestFail(q) {
    const msg = this.lang === 'TH' ? '⌛ ภารกิจไม่สำเร็จ — ลองใหม่!' : '⌛ Quest failed — try again!';
    this.say(msg, { stayMs: 1500 });
  }

  // ===== queue driver =====
  #drain() {
    if (this.showing || this.queue.length === 0) return;
    const { msg, stayMs } = this.queue.shift();
    this.text.textContent = msg;
    this.wrap.style.display = 'block';
    this.wrap.style.opacity = '0';
    this.wrap.style.transform = 'translate(-50%, -8px)';
    requestAnimationFrame(() => {
      this.wrap.style.transition = 'opacity .18s ease, transform .18s ease';
      this.wrap.style.opacity = '1';
      this.wrap.style.transform = 'translate(-50%, 0)';
    });

    this.showing = true;
    clearTimeout(this.hideTimer);
    this.hideTimer = setTimeout(() => {
      this.wrap.style.opacity = '0';
      this.wrap.style.transform = 'translate(-50%, -8px)';
      setTimeout(() => {
        this.wrap.style.display = 'none';
        this.showing = false;
        this.#drain();
      }, 200);
    }, Math.max(800, stayMs | 0));
  }
}
