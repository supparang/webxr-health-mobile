// === /herohealth/vr/hha-coach.js ===
// โค้ชหยดน้ำ (Coach Bubble) สำหรับเกม Hero Health (GoodJunk / Hydration / ฯลฯ)
// ฟัง event: quest:update, hha:end แล้วพูดแนวเด็ก ป.5
(function (global) {
  'use strict';

  const win = global;
  let wrap = null;
  let avatarEl = null;
  let nameEl = null;
  let textMainEl = null;
  let textSubEl = null;

  function createStyleOnce() {
    if (document.getElementById('hha-coach-style')) return;
    const st = document.createElement('style');
    st.id = 'hha-coach-style';
    st.textContent = `
      #hha-coach {
        position: fixed;
        left: 50%;
        bottom: 12px;
        transform: translateX(-50%);
        z-index: 9999;
        max-width: min(560px, 94vw);
        padding: 10px 14px;
        border-radius: 999px;
        background: rgba(15,23,42,0.95);
        box-shadow: 0 12px 30px rgba(0,0,0,0.45);
        color: #e5e7eb;
        display: flex;
        align-items: center;
        gap: 10px;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      #hha-coach-avatar {
        width: 36px;
        height: 36px;
        border-radius: 999px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 22px;
        background: radial-gradient(circle at 30% 20%, #38bdf8, #0ea5e9, #0369a1);
        box-shadow: 0 0 0 2px rgba(15,23,42,0.9);
        flex-shrink: 0;
      }
      #hha-coach-text {
        display: flex;
        flex-direction: column;
        gap: 2px;
        font-size: 14px;
        line-height: 1.4;
      }
      #hha-coach-name {
        font-weight: 600;
        font-size: 13px;
        opacity: 0.9;
      }
      #hha-coach-main {
        font-size: 14px;
      }
      #hha-coach-sub {
        font-size: 12px;
        opacity: 0.8;
      }

      @media (max-width: 640px) {
        #hha-coach {
          padding: 8px 12px;
          bottom: 8px;
        }
        #hha-coach-avatar {
          width: 32px;
          height: 32px;
          font-size: 20px;
        }
        #hha-coach-text {
          font-size: 13px;
        }
        #hha-coach-main {
          font-size: 13px;
        }
        #hha-coach-sub {
          font-size: 11px;
        }
      }
    `;
    document.head.appendChild(st);
  }

  function ensureUI() {
    if (wrap) return wrap;
    createStyleOnce();

    wrap = document.createElement('div');
    wrap.id = 'hha-coach';

    avatarEl = document.createElement('div');
    avatarEl.id = 'hha-coach-avatar';
    avatarEl.textContent = '💧😄';  // หน้าโค้ช emoji

    const textWrap = document.createElement('div');
    textWrap.id = 'hha-coach-text';

    nameEl = document.createElement('div');
    nameEl.id = 'hha-coach-name';
    nameEl.textContent = 'โค้ชหยดน้ำ';

    textMainEl = document.createElement('div');
    textMainEl.id = 'hha-coach-main';
    textMainEl.textContent = 'วันนี้มาฝึกดื่มน้ำให้พอกันนะ ✨';

    textSubEl = document.createElement('div');
    textSubEl.id = 'hha-coach-sub';
    textSubEl.textContent = 'เล็งเป้าน้ำดี 💧 หลีกเป้าน้ำหวาน 🥤 ให้ไวเลย!';

    textWrap.appendChild(nameEl);
    textWrap.appendChild(textMainEl);
    textWrap.appendChild(textSubEl);

    wrap.appendChild(avatarEl);
    wrap.appendChild(textWrap);

    document.body.appendChild(wrap);
    return wrap;
  }

  function setCoachText(main, sub) {
    ensureUI();
    if (main) textMainEl.textContent = main;
    if (sub !== undefined) textSubEl.textContent = sub;
  }

  // ===== Helper: แปลง label ให้เป็นสไตล์เด็ก ป.5 =====
  function kidfyLabel(label) {
    if (!label) return '';
    let t = String(label);

    t = t.replace('อยู่ในโซนสมดุล (GREEN)', 'อยู่โซนน้ำสีเขียวให้ได้นาน ๆ');
    t = t.replace('คะแนนรวม', 'คะแนนรวมให้ถึง');
    t = t.replace('เก็บไฮเดรต', 'เก็บเป้าน้ำดีให้ครบ');
    t = t.replace('พลาดไม่เกิน', 'ห้ามพลาดเกิน');
    t = t.replace('อยู่รอด', 'เล่นให้ครบ');

    return t;
  }

  function speakFromQuest(detail) {
    ensureUI();
    const goal = detail.goal || null;
    const mini = detail.mini || null;
    const hint = detail.hint || '';

    let main = '';
    let sub  = '';

    if (goal && !goal.done) {
      main = `ภารกิจใหญ่: ${kidfyLabel(goal.label)}`;
      if (mini && !mini.done) {
        sub = `ภารกิจย่อย: ${kidfyLabel(mini.label)} ✨`;
      } else if (hint) {
        sub = hint;
      } else {
        sub = 'ลองทำให้ครบดูนะ เดี๋ยวโค้ชช่วยเชียร์ให้สุดเสียงเลย! 💪';
      }
    } else if (mini && !mini.done) {
      main = `ภารกิจย่อย: ${kidfyLabel(mini.label)}`;
      sub  = hint || 'อีกนิดเดียวเองน้า สู้ ๆๆ 🔥';
    } else {
      main = 'ดีมากเลย ภารกิจชุดนี้ใกล้ครบแล้ว! 🎉';
      sub  = hint || 'โค้ชขออีกชุดเดียวพอไหวมั้ยยย 😆';
    }

    setCoachText(main, sub);
  }

  function speakStart(mode) {
    ensureUI();
    if (mode === 'Hydration') {
      setCoachText(
        'วันนี้มาเป็นฮีโร่น้ำดีกันนะ 💧',
        'พยายามอยู่โซนน้ำสีเขียวให้นานที่สุด แล้วเล็งเป้าน้ำดีให้แม่น ๆ เลย!'
      );
    } else {
      setCoachText(
        'พร้อมลุยภารกิจ Hero Health ยังงง 😄',
        'โค้ชจะคอยกระซิบเคล็ดลับให้ตลอดเกมเลยน้าาา ✨'
      );
    }
  }

  function speakEnd(detail) {
    ensureUI();
    const mode = detail.mode || 'Game';
    const score = detail.score ?? 0;
    const miss  = detail.misses ?? 0;
    const green = detail.greenTick ?? 0;

    if (mode === 'Hydration') {
      setCoachText(
        `จบเกมแล้ว เย้! คะแนน ${score} คะแนน 🎉`,
        `อยู่โซนน้ำสีเขียว ${green}s | MISS ${miss} ครั้ง ลองรอบหน้าให้ดีกว่าเดิมอีกนิดนะ 💪`
      );
    } else {
      setCoachText(
        `ภารกิจจบแล้ว เยี่ยมมากฮีโร่! 🌟`,
        `คะแนน ${score} | MISS ${miss} ครั้ง โค้ชให้ดาวเพิ่มในใจอีกดวง ⭐`
      );
    }
  }

  // ====== event listeners ======

  // เริ่มเกม (ให้ hydration.safe.js หรือ main game เรียกเองได้ถ้าอยากละเอียดขึ้น)
  // ที่นี่ใช้ hha:time ครั้งแรกเป็นสัญญาณเริ่มคร่าว ๆ
  let firstTimeFired = false;
  win.addEventListener('hha:time', function (ev) {
    if (firstTimeFired) return;
    firstTimeFired = true;
    speakStart('Hydration');
  });

  // อัปเดตเควสต์
  win.addEventListener('quest:update', function (ev) {
    const detail = ev.detail || {};
    speakFromQuest(detail);
  });

  // จบเกม
  win.addEventListener('hha:end', function (ev) {
    const detail = ev.detail || {};
    speakEnd(detail);
  });

})(window);
