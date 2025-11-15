// === Hero Health — coach.js (2025 Research Edition) ===
// โค้ชกลางสำหรับทุกโหมด: goodjunk / groups / hydration / plate
// - แสดง bubble ด้านล่างซ้าย
// - ให้ feedback ตาม mode/diff
// - ใช้ข้อมูลจาก onRoundEnd (accuracy, avgRT, accTarget)

(function () {
  'use strict';

  // ---------- DOM helpers ----------
  function $(sel) {
    return document.querySelector(sel);
  }

  function createCoachUI() {
    if ($('#hha-coach')) return $('#hha-coach');

    const root = document.createElement('div');
    root.id = 'hha-coach';
    Object.assign(root.style, {
      position: 'fixed',
      left: '16px',
      bottom: '16px',
      maxWidth: '320px',
      zIndex: '9300',
      fontFamily: 'system-ui,Segoe UI,Inter,Roboto,sans-serif',
      color: '#e5e7eb',
      pointerEvents: 'none'
    });

    root.innerHTML = `
      <div id="hha-coach-badge"
        style="
          display:inline-flex;align-items:center;gap:6px;
          padding:3px 8px;border-radius:999px;
          font-size:11px;
          background:rgba(15,23,42,0.9);
          border:1px solid rgba(148,163,184,0.7);
          margin-bottom:4px;
        ">
        <span>🧑‍🏫 Hero Coach</span>
        <span id="hha-coach-mode-tag" style="opacity:0.9;"></span>
      </div>
      <div id="hha-coach-bubble"
        style="
          display:none;
          background:rgba(15,23,42,0.96);
          border-radius:16px;
          padding:10px 12px;
          font-size:12px;
          line-height:1.4;
          border:1px solid rgba(56,189,248,0.8);
          box-shadow:0 14px 30px rgba(0,0,0,0.7);
          pointerEvents:auto;
        ">
        <div id="hha-coach-text"></div>
      </div>
    `;
    document.body.appendChild(root);
    return root;
  }

  let hideTimer = null;

  function say(text, durationSec) {
    createCoachUI();
    const bubble = $('#hha-coach-bubble');
    const textEl = $('#hha-coach-text');
    if (!bubble || !textEl) return;

    textEl.textContent = text;
    bubble.style.display = 'block';
    bubble.style.opacity = '1';
    bubble.style.transform = 'translateY(0)';
    bubble.style.transition = 'opacity 160ms ease-out, transform 160ms ease-out';

    if (hideTimer) clearTimeout(hideTimer);
    const t = typeof durationSec === 'number' ? durationSec : 4;
    hideTimer = setTimeout(function () {
      bubble.style.opacity = '0';
      bubble.style.transform = 'translateY(6px)';
      setTimeout(function () {
        bubble.style.display = 'none';
      }, 180);
    }, t * 1000);
  }

  function setModeTag(mode, diff) {
    createCoachUI();
    const el = $('#hha-coach-mode-tag');
    if (!el) return;
    const m = (mode || '').toLowerCase();
    let label = '';
    if (m === 'goodjunk') label = 'Good vs Junk';
    else if (m === 'groups') label = 'Food Groups';
    else if (m === 'hydration') label = 'Hydration';
    else if (m === 'plate') label = 'Balanced Plate';
    else label = mode || '';

    const d = (diff || '').toLowerCase();
    const diffLabel = d ? (' • ' + d) : '';
    el.textContent = label + diffLabel;
  }

  // ---------- โปรไฟล์เด็ก ----------
  function getProfile() {
    try {
      return {
        name:  sessionStorage.getItem('hhaProfileName')  || '',
        sid:   sessionStorage.getItem('hhaProfileId')    || '',
        grade: sessionStorage.getItem('hhaProfileGrade') || '',
        room:  sessionStorage.getItem('hhaProfileRoom')  || ''
      };
    } catch (e) {
      return { name: '', sid: '', grade: '', room: '' };
    }
  }

  function shortName(name) {
    if (!name) return '';
    if (name.length <= 8) return name;
    return name.slice(0, 8) + '…';
  }

  // ---------- Strategy ตาม mode ----------
  function introForMode(mode, diff) {
    const m = (mode || '').toLowerCase();
    const d = (diff || '').toLowerCase();
    const prof = getProfile();
    const who = prof.name ? shortName(prof.name) : 'หนู';

    if (m === 'goodjunk') {
      if (d === 'easy')   return `พร้อมมั้ย ${who}? รอบนี้เก็บของดีให้ทันเวลา หลบขยะให้ได้เยอะที่สุดนะ 🍎🚫🍔`;
      if (d === 'hard')   return `โหมดฮาร์ดมาแล้ว! ${who} ต้องไวเหมือนสายฟ้า เก็บของดีให้สุด อย่าเผลอดีดโดน junk นะ ⚡`;
      return `Good vs Junk โหมดปกติ เริ่มจับจังหวะให้ทัน เป้าเยอะขึ้นแต่โค้ชเชื่อว่า ${who} เอาอยู่ 💪`;
    }

    if (m === 'groups') {
      if (d === 'easy')   return `วันนี้เราฝึกจำหมู่อาหารกันนะ ${who} ดูให้ดีว่าอาหารชิ้นไหนอยู่หมู่เป้าหมาย แล้วค่อยคลิก 🥦🍚🍎`;
      if (d === 'hard')   return `โหมดจับหมู่อาหารแบบไว ๆ! เลือกเฉพาะหมู่เป้าหมายให้ถูก ถ้าสงสัย ให้หลบไว้ก่อน 👀`;
      return `Food Groups โหมดปกติ ลองทดสอบว่าหนูจำหมู่อาหารได้จริงแค่ไหน เลือกให้ตรงหมู่เป้าหมายเลย!`;
    }

    if (m === 'hydration') {
      if (d === 'easy')   return `ภารกิจน้ำดีเริ่มแล้ว ${who} เลือกแค่น้ำเปล่า นม ชาไม่หวานนะ น้ำหวานให้หลบไว้ก่อน 💧🥛`;
      if (d === 'hard')   return `โหมดน้ำดี vs น้ำหวานแบบท้าทาย เลือกให้ไวแต่คิดให้ดีว่าอันไหนหวานเกินไป 🚰🚫🥤`;
      return `Hydration โหมดปกติ ลองดูว่าเราคัดน้ำดีออกจากน้ำหวานได้แม่นแค่ไหนกันนะ`;
    }

    if (m === 'plate') {
      if (d === 'easy')   return `มาจัด “จานสมดุล” กันนะ ${who} เลือกผัก ผลไม้ ข้าว-แป้ง และโปรตีนดีให้โดนใจหมอ 😉`;
      if (d === 'hard')   return `โหมดจานสมดุลขั้นเทพ เลือกเฉพาะของดีต่อสุขภาพให้ไว ของมัน/หวานให้หลบให้หมด 🍽️`;
      return `Balanced Plate โหมดปกติ ลองจัดจานที่มีครบทั้งผัก ผลไม้ ข้าว-แป้ง และโปรตีนดีให้สมดุลที่สุด`;
    }

    return `พร้อมเล่นรอบใหม่แล้ว ลองตั้งสติ หายใจลึก ๆ แล้วไปลุยกันเลย ${who}!`;
  }

  function commentForAccuracy(mode, diff, accuracy, accTarget) {
    const acc = accuracy || 0;
    const band = accTarget && accTarget.band ? accTarget.band : 'within';
    const prof = getProfile();
    const who = prof.name ? shortName(prof.name) : 'หนู';

    const accStr = acc.toFixed(1) + '%';

    if (band === 'below') {
      // ต่ำกว่าเป้า
      if (acc < 40) {
        return `${who} ได้ความแม่นยำ ${accStr} ยังต่ำกว่าเป้าที่ครูตั้งไว้อยู่นิดนึง รอบหน้าลองช้าลงอีกนิด ดูให้ชัวร์ก่อนคลิกนะ 👀`;
      }
      return `${who} ได้ ${accStr} ต่ำกว่าเป้าไปนิดเดียวเอง รอบหน้าลองโฟกัสให้มากขึ้นอีกนิด โค้ชเชื่อว่าผ่านช่วงเป้าได้แน่ 💪`;
    }
    if (band === 'above') {
      // สูงกว่าเป้า (เก่งมาก)
      if (acc >= 90) {
        return `โห เก่งมาก! ความแม่นยำ ${accStr} สูงกว่าเป้าเยอะเลย ${who} อย่าลืมรักษามาตรฐานนี้ไว้ให้ได้อีกหลาย ๆ รอบนะ 🏆`;
      }
      return `เยี่ยมเลย ${who}! ความแม่นยำ ${accStr} สูงกว่าเป้าที่ครูตั้งไว้ แปลว่ารอบนี้หนูคุมเกมได้ดีมาก 👍`;
    }
    // within
    return `${who} ได้ความแม่นยำ ${accStr} อยู่ในช่วงเป้าพอดี ถือว่าทำได้ตามมาตรฐานเลย รอบหน้าถ้าอยากท้าทาย ลองเปลี่ยนเป็น diff ที่ยากขึ้นได้นะ 😄`;
  }

  function commentForSpeed(avgRT) {
    if (!avgRT || avgRT <= 0) return '';
    if (avgRT < 450) {
      return `ความเร็วตอบสนองประมาณ ${avgRT.toFixed(0)} ms ถือว่าไวมาก แต่ระวังอย่าให้ไวเกินจนคลิกผิดนะ ⚡`;
    }
    if (avgRT < 800) {
      return `ความเร็วตอบสนองประมาณ ${avgRT.toFixed(0)} ms กำลังดีเลย เร็วแต่ยังมีเวลาคิด 😉`;
    }
    return `ความเร็วตอบสนองประมาณ ${avgRT.toFixed(0)} ms ค่อนข้างช้า ลองฝึกให้กล้าแตะเร็วขึ้นอีกนิดได้เลย ไม่เป็นไร ค่อย ๆ ฝึกไป ❤️`;
  }

  function commentForQuests(quests) {
    if (!quests) return '';
    const list = Array.isArray(quests) ? quests : (quests.list || []);
    if (!list.length) return '';

    const done = list.filter(q => q && q.done).length;
    if (done === 0) {
      return 'รอบนี้ยังไม่ผ่าน Mini Quest เลย ลองอ่านเป้าหมายทีละข้อแล้วค่อย ๆ เก็บให้ครบในรอบต่อไปนะ 🧩';
    }
    if (done === list.length) {
      return `สุดยอด! ผ่าน Mini Quest ครบทุกข้อเลย 🎯`;
    }
    return `ผ่าน Mini Quest ไปแล้ว ${done}/${list.length} ข้อ รอบหน้าเราลองเก็บให้ครบทุกภารกิจกันดูไหม? 🎯`;
  }

  function combineMessages(parts) {
    return parts.filter(Boolean).join(' ');
  }

  // ---------- Public API ----------
  const Coach = {
    /**
     * main.js อาจเรียกตอนเริ่มรอบใหม่
     * ctx: { mode, diff, duration, profile?, sessionInfo? }
     */
    onRoundStart: function (ctx) {
      try {
        const mode = ctx && ctx.mode;
        const diff = ctx && ctx.diff;
        setModeTag(mode, diff);
        const msg = introForMode(mode, diff);
        say(msg, 5);
      } catch (e) {
        // เงียบไว้
      }
    },

    /**
     * main.js เรียกตอนจบรอบ
     * summary: {
     *   mode, diff, score, maxCombo, missionGoodCount, missionTarget,
     *   accuracy, avgRT, quests, boss: {spawned, defeated},
     *   accTarget: {min, max, band}
     * }
     */
    onRoundEnd: function (summary) {
      try {
        const mode = summary && summary.mode;
        const diff = summary && summary.diff;
        const accuracy = summary && typeof summary.accuracy === 'number'
          ? summary.accuracy : 0;
        const avgRT = summary && typeof summary.avgRT === 'number'
          ? summary.avgRT : 0;
        const accTarget = summary && summary.accTarget;
        const quests = summary && summary.quests;
        const boss = summary && summary.boss;

        setModeTag(mode, diff);

        const mAcc = commentForAccuracy(mode, diff, accuracy, accTarget);
        const mRT  = commentForSpeed(avgRT);
        const mQ   = commentForQuests(quests);

        let mBoss = '';
        if (boss && boss.spawned) {
          if (boss.defeated) {
            mBoss = 'และยังจัดการ Boss ได้สำเร็จอีกด้วย เก่งมาก! 👾🎉';
          } else {
            mBoss = 'รอบนี้ Boss ยังไม่ยอมล้ม รอบหน้าเรามาลองโฟกัส Boss ให้มากขึ้นอีกนิดนะ 👾💪';
          }
        }

        const finalText = combineMessages([mAcc, mRT, mQ, mBoss]);
        say(finalText || 'จบรอบนี้ได้ดีมาก ลองดูผลคะแนนแล้วเลือกว่าจะฝึกรอบถัดไปแบบไหนต่อเลยนะ 😊', 8);
      } catch (e) {
        // ถ้าอะไรพังก็ไม่ต้องทำอะไรเพิ่มเติม
      }
    },

    /**
     * main.js อาจเรียกเมื่อ Fever เปิด/ปิด
     */
    onFeverChange: function (isOn) {
      try {
        if (isOn) {
          say('FEVER TIME!! เก็บคอมโบให้สุด อย่าให้หลุดแม้แต่ชิ้นเดียว 🔥', 3.5);
        }
      } catch (e) {}
    },

    /**
     * main.js หรือระบบอื่น ๆ สามารถใช้เรียกพูดเฉพาะกิจได้
     */
    speak: function (text, durationSec) {
      say(text, durationSec);
    }
  };

  window.HH_COACH = Coach;
})();
