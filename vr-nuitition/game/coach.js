// === Hero Health — coach.js (AAA-style DOM Coach) ===
// โค้ชตัวการ์ตูน มุมซ้ายล่าง: มีอารมณ์, พูดตอนเริ่ม, ตอนโดนดี/ขยะ, Fever, Quest, จบเกม

(function () {
  'use strict';

  function randOf(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  const Coach = {
    elRoot: null,
    elText: null,
    elMood: null,

    mood: 'normal',      // normal | excited | warning | fever | result
    lastLineAt: 0,
    cooldownMs: 900,     // กันพูดรัวเกินไป
    feverCount: 0,
    missJunk: 0,
    goodHits: 0,
    questCompleted: 0,

    // — สร้าง DOM —
    ensureDom() {
      if (this.elRoot) return;

      const wrap = document.createElement('div');
      wrap.id = 'hha-coach';
      Object.assign(wrap.style, {
        position: 'fixed',
        left: '12px',
        bottom: '12px',
        zIndex: '9150',
        display: 'flex',
        alignItems: 'flex-end',
        gap: '8px',
        pointerEvents: 'none',
        fontFamily: 'system-ui,Segoe UI,Inter,Roboto,sans-serif'
      });

      const avatar = document.createElement('div');
      Object.assign(avatar.style, {
        width: '52px',
        height: '52px',
        borderRadius: '999px',
        background: 'radial-gradient(circle at 30% 20%, #38bdf8, #1d4ed8)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 10px 25px rgba(15,23,42,0.9)',
        border: '2px solid rgba(148,163,184,0.95)',
        transform: 'translateY(0)',
        transition: 'transform 0.16s ease'
      });
      avatar.textContent = '🧑‍🏫';

      const bubble = document.createElement('div');
      Object.assign(bubble.style, {
        maxWidth: '220px',
        padding: '8px 10px',
        borderRadius: '14px',
        background: 'rgba(15,23,42,0.95)',
        border: '1px solid rgba(148,163,184,0.9)',
        color: '#e5e7eb',
        fontSize: '11px',
        lineHeight: '1.4',
        boxShadow: '0 12px 30px rgba(15,23,42,0.9)',
        pointerEvents: 'auto'
      });

      const moodEl = document.createElement('div');
      Object.assign(moodEl.style, {
        fontSize: '11px',
        opacity: '0.9',
        marginBottom: '2px',
        color: '#bfdbfe'
      });
      moodEl.textContent = 'โค้ชพร้อมสอน 💬';

      const textEl = document.createElement('div');
      textEl.textContent = 'พร้อมลุยไปด้วยกันเลย!';

      bubble.appendChild(moodEl);
      bubble.appendChild(textEl);

      wrap.appendChild(avatar);
      wrap.appendChild(bubble);

      document.body.appendChild(wrap);

      this.elRoot = wrap;
      this.elText = textEl;
      this.elMood = moodEl;
      this.elAvatar = avatar;
    },

    setMood(mood) {
      this.mood = mood;
      if (!this.elMood || !this.elAvatar) return;

      if (mood === 'normal') {
        this.elMood.textContent = 'โค้ชโหมดปกติ 💬';
        this.elAvatar.style.transform = 'translateY(0)';
        this.elAvatar.style.background =
          'radial-gradient(circle at 30% 20%, #38bdf8, #1d4ed8)';
      } else if (mood === 'excited') {
        this.elMood.textContent = 'โค้ชกำลังลุย! ⚡';
        this.elAvatar.style.transform = 'translateY(-2px)';
        this.elAvatar.style.background =
          'radial-gradient(circle at 30% 20%, #22c55e, #15803d)';
      } else if (mood === 'warning') {
        this.elMood.textContent = 'โค้ชเตือนนิดนึงนะ ⚠️';
        this.elAvatar.style.transform = 'translateY(0)';
        this.elAvatar.style.background =
          'radial-gradient(circle at 30% 20%, #fb923c, #b91c1c)';
      } else if (mood === 'fever') {
        this.elMood.textContent = 'โหมด FEVER!! 🔥';
        this.elAvatar.style.transform = 'translateY(-3px)';
        this.elAvatar.style.background =
          'radial-gradient(circle at 30% 20%, #fb923c, #f97316)';
      } else if (mood === 'result') {
        this.elMood.textContent = 'สรุปรอบนี้ 📊';
        this.elAvatar.style.transform = 'translateY(0)';
        this.elAvatar.style.background =
          'radial-gradient(circle at 30% 20%, #a855f7, #6d28d9)';
      }
    },

    canSpeak(force) {
      if (force) return true;
      const now = performance.now();
      return (now - this.lastLineAt) >= this.cooldownMs;
    },

    speak(line, mood, force) {
      this.ensureDom();
      if (!this.canSpeak(force)) return;

      this.lastLineAt = performance.now();
      if (line && this.elText) {
        this.elText.textContent = line;
      }
      if (mood) this.setMood(mood);

      // bounce เล็กน้อยเวลาเปลี่ยนประโยค
      if (this.elRoot) {
        this.elRoot.style.transform = 'translateY(-2px)';
        setTimeout(() => {
          if (this.elRoot) this.elRoot.style.transform = 'translateY(0)';
        }, 140);
      }
    },

    // ==================== public APIs ====================

    init(context) {
      this.ensureDom();
      this.mood = 'normal';
      this.lastLineAt = 0;
      this.feverCount = 0;
      this.missJunk = 0;
      this.goodHits = 0;
      this.questCompleted = 0;

      const mode = context && context.modeLabel ? context.modeLabel : 'Mini Game';
      const diff = context && context.diffLabel ? context.diffLabel : '';
      const player = context && context.playerName ? context.playerName : 'น้อง';

      const line = randOf([
        `วันนี้มาเล่นโหมด ${mode} กัน!`,
        `พร้อมลุยโหมด ${mode} ระดับ ${diff} แล้วใช่มั้ย?`,
        `${player} มาแล้ว~ โค้ชช่วยเต็มที่เลย 😄`
      ]);
      this.speak(line, 'normal', true);
    },

    onGameStart(ctx) {
      const player = ctx && ctx.playerName ? ctx.playerName : 'น้อง';
      const line = randOf([
        `เริ่มแล้ว! ลองดูรอบนี้ ${player} เก่งขึ้นแค่ไหน 🔥`,
        `พร้อมแล้วลุยเลย! กดของดีให้ทันนะ 💪`,
        `โค้ชเชียร์อยู่ตรงนี้นะ สู้ ๆ! ✨`
      ]);
      this.speak(line, 'normal', true);
    },

    onHit(ctx) {
      // ctx: { type, isGood, isJunk, isPower, combo, score, feverActive, diff, mode }
      if (!ctx) return;

      if (ctx.isGood) {
        this.goodHits++;
        // เน้นตอนคอมโบสูง ๆ
        if (ctx.combo >= 10 && this.canSpeak(false)) {
          const line = randOf([
            `คอมโบ ${ctx.combo} แล้ววว! สุดยอด 🔥`,
            `อย่าหยุดนะ คอมโบกำลังมา! ⚡`,
            `ยิงต่อเนื่องแบบนี้ โค้ชปลื้มมาก 😍`
          ]);
          this.speak(line, ctx.feverActive ? 'fever' : 'excited', false);
          return;
        }

        if (this.canSpeak(false)) {
          const line = randOf([
            `ดีมาก~ ของดีทั้งนั้นเลย ✅`,
            `เก่งมาก เลือกได้ตรงเป้าสุด ๆ 👏`,
            `แบบนี้แหละ สายสุขภาพตัวจริง 💚`
          ]);
          this.speak(line, ctx.feverActive ? 'fever' : 'normal', false);
        }
      } else if (ctx.isJunk) {
        this.missJunk++;
        if (!this.canSpeak(false)) return;

        const line = randOf([
          `โอ๊ะ~ อันนั้นไม่ค่อยดีเท่าไหร่นะ ⚠️`,
          `ระวังของล่อนิดนึงน้า 😅`,
          `ไม่เป็นไร รอบหน้าเลือกให้เป๊ะกว่านี้ได้ ✨`
        ]);
        this.speak(line, 'warning', false);
      } else if (ctx.isPower) {
        if (!this.canSpeak(false)) return;
        const line = randOf([
          `ได้พาวเวอร์อัปแล้ว! ใช้ให้คุ้มนะ 💫`,
          `เก็บบัฟเยอะ ๆ แล้วคอมโบจะพุ่งแรงเลย 😎`
        ]);
        this.speak(line, ctx.feverActive ? 'fever' : 'excited', false);
      }
    },

    onFeverStart(ctx) {
      this.feverCount++;
      const line = randOf([
        `FEVER MODE!! ยิงคะแนนให้สุดเลย 🔥🔥`,
        `ตอนนี้ x2 คะแนนอยู่ รีบโกยให้เต็มที่! ⚡`,
        `โหมดไฟลุกแล้วว! กดรัว ๆ ได้เลย 😆`
      ]);
      this.speak(line, 'fever', true);
    },

    onFeverEnd(ctx) {
      if (!this.canSpeak(false)) return;
      const line = randOf([
        `หมด FEVER แล้ว~ พักหายใจนิดนึง 😌`,
        `ดีมาก รอบนี้เก็บคะแนนช่วง FEVER ได้เยอะเลย!`,
        `รอบหน้าเข้าครั้งหน้า เอาให้คุ้มกว่าเดิมอีกนะ 💪`
      ]);
      this.speak(line, 'normal', false);
    },

    onQuestComplete(q) {
      this.questCompleted++;
      if (!this.canSpeak(true)) return;
      const label = q && q.label ? q.label : 'เควสต์';
      const line = randOf([
        `เควสต์ "${label}" ผ่านแล้ว! สุดยอดเลย 🎉`,
        `เยี่ยมมาก เควสต์สำเร็จไปอีกหนึ่งด่าน ✨`,
        `เห็นมั้ย วางแผนดี ๆ เควสต์ก็ผ่านสบาย 😎`
      ]);
      this.speak(line, 'excited', true);
    },

    onMissionEnd(ctx) {
      // ctx: { success, score, goodCount, combo, modeLabel, diffLabel }
      this.setMood('result');

      const s = (ctx && ctx.score) || 0;
      const g = (ctx && ctx.goodCount) || 0;
      const combo = (ctx && ctx.combo) || 0;
      const success = !!(ctx && ctx.success);
      const modeLabel = (ctx && ctx.modeLabel) || 'โหมดนี้';

      let line;
      if (success) {
        line = randOf([
          `ภารกิจใน ${modeLabel} ผ่านแล้ว! เก่งมาก 🎉`,
          `ยอดเยี่ยม! คะแนนรวม ${s} คอมโบสูงสุด ${combo} เลย 👏`,
          `โค้ชภูมิใจมาก รอบนี้ทำได้ดีสุด ๆ ✨`
        ]);
      } else {
        line = randOf([
          `เกือบแล้ว อีกนิดเดียวเอง 👍`,
          `ไม่เป็นไร รอบหน้า ${modeLabel} ต้องผ่านแน่นอน!`,
          `รอบนี้ได้ ${s} คะแนน ลองสังเกตจังหวะแล้วกลับมาแก้เกมกัน 😉`
        ]);
      }
      this.speak(line, 'result', true);
    }
  };

  // export
  window.HH_COACH = Coach;
})();
