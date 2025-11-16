// === Hero Health — coach.js ===
// โค้ชเวอร์ชัน ป.5 ภาษาสั้น ๆ สนุก ๆ + emoji
// main.js จะเรียก HH_COACH.onFeverStart(...) และ HH_COACH.onRoundEnd(...)

(function () {
  'use strict';

  const COACH = {};
  window.HH_COACH = COACH;

  let bubble;
  let hideTimer = null;

  function ensureBubble() {
    if (bubble) return bubble;
    bubble = document.createElement('div');
    bubble.id = 'hha-coach-bubble';
    Object.assign(bubble.style, {
      position: 'fixed',
      left: '12px',
      bottom: '12px',
      maxWidth: '260px',
      padding: '8px 12px',
      borderRadius: '16px',
      background: 'rgba(15,23,42,0.95)',
      border: '1px solid rgba(56,189,248,0.8)',
      color: '#e5e7eb',
      fontFamily: 'system-ui,Segoe UI,Inter,Roboto,sans-serif',
      fontSize: '13px',
      lineHeight: '1.4',
      boxShadow: '0 12px 30px rgba(0,0,0,0.6)',
      zIndex: '9300',
      display: 'none'
    });

    bubble.innerHTML = `
      <div style="font-weight:600;margin-bottom:2px;font-size:12px;">
        🧑‍🏫 โค้ชสุขภาพ
      </div>
      <div id="hha-coach-text"></div>
    `;
    document.body.appendChild(bubble);
    return bubble;
  }

  function showMessage(text, ms) {
    ensureBubble();
    const txt = document.getElementById('hha-coach-text');
    if (txt) txt.textContent = text;
    bubble.style.display = 'block';
    bubble.style.opacity = '1';

    if (hideTimer) clearTimeout(hideTimer);
    hideTimer = setTimeout(function () {
      if (!bubble) return;
      bubble.style.opacity = '0';
      setTimeout(function () {
        if (bubble) bubble.style.display = 'none';
      }, 220);
    }, ms || 4000);
  }

  // ---------- ช่วยแปลง mode/diff เป็นภาษาเด็ก ----------
  function modeLabel(mode) {
    switch ((mode || '').toLowerCase()) {
      case 'goodjunk':  return 'ดี vs ขยะ';
      case 'groups':    return 'จัดหมู่อาหาร';
      case 'hydration': return 'น้ำดี น้ำหวาน';
      case 'plate':     return 'จานสมดุล';
      default:          return 'โหมดลับ';
    }
  }

  function diffLabel(diff) {
    switch ((diff || '').toLowerCase()) {
      case 'easy':   return 'โหมดชิล ๆ 😌';
      case 'normal': return 'โหมดกำลังดี 🙂';
      case 'hard':   return 'โหมดยอดนักสู้ 💥';
      default:       return 'โหมดกำลังดี 🙂';
    }
  }

  // ---------- API สำหรับ main.js ----------

  COACH.onRoundStart = function (info) {
    // info: {mode,diff}
    const m = modeLabel(info && info.mode);
    const d = diffLabel(info && info.diff);
    showMessage('วันนี้เล่นโหมด ' + m + ' | ' + d + ' ลองกดให้ทันก่อนเป้าหายไปนะ 👀', 4500);
  };

  COACH.onFeverStart = function (mode, diff) {
    // เรียกจาก main.js ตอนเริ่ม Fever
    const m = modeLabel(mode);
    showMessage('โหมดไฟแรงมาแล้ว! 🔥 โหมด ' + m + ' กดให้ไว คอมโบพุ่งเลย! ✨', 3500);
  };

  COACH.onRoundEnd = function (summary) {
    // summary: { mode, diff, score, maxCombo, missionGoodCount, missionTarget, accuracy, avgRT, quests, boss }
    const m = modeLabel(summary.mode);
    const d = diffLabel(summary.diff);

    const okMission = summary.missionGoodCount >= summary.missionTarget;
    const acc = (summary.accuracy != null ? summary.accuracy : 0);
    const combo = summary.maxCombo || 0;

    let msg = 'โหมด ' + m + ' | ' + d + '\n';

    if (okMission) {
      msg += 'ภารกิจผ่านแล้ว เก่งมาก! 🎉\n';
    } else {
      msg += 'ใกล้ผ่านแล้ว ลองอีกครั้งได้ 👍\n';
    }

    msg += 'คะแนน: ' + summary.score + ' | คอมโบสูงสุด: ' + combo + '\n';

    if (acc >= 90) {
      msg += 'ยิงแม่นมาก เหมือนเลเซอร์เลย 💚';
    } else if (acc >= 75) {
      msg += 'แม่นใช้ได้ ลองค่อย ๆ ดูรูปก่อนกดนะ 👀';
    } else {
      msg += 'ไม่เป็นไร รอบหน้าใจเย็น ๆ เลือกของดีให้ชัวร์ก่อนกดนะ 🤝';
    }

    showMessage(msg, 6500);
  };

})();
