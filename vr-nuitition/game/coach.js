// === Hero Health — game/coach.js ===
// โค้ชพูดกับเด็ก ป.5 แบบสั้น สนุก ตรงประเด็น
// ใช้ร่วมกับ main.js ผ่าน window.HH_COACH

(function () {
  'use strict';

  // สร้าง bubble โค้ชมุมซ้ายล่าง
  function ensureCoachBubble() {
    let wrap = document.getElementById('hha-coach');
    if (wrap) return wrap;

    wrap = document.createElement('div');
    wrap.id = 'hha-coach';
    Object.assign(wrap.style, {
      position: 'fixed',
      left: '12px',
      bottom: '12px',
      maxWidth: '260px',
      zIndex: '9300',
      fontFamily: 'system-ui,Segoe UI,Inter,Roboto,sans-serif',
      fontSize: '13px',
      color: '#e5e7eb',
      pointerEvents: 'none'
    });

    wrap.innerHTML = `
      <div id="hha-coach-bubble"
        style="
          background:rgba(15,23,42,0.97);
          border-radius:16px;
          padding:10px 12px;
          border:1px solid rgba(96,165,250,0.9);
          box-shadow:0 12px 30px rgba(0,0,0,0.75);
          display:none;
        ">
        <div style="font-size:12px;color:#93c5fd;margin-bottom:4px;">
          🧑‍🏫 โค้ช Hero Health
        </div>
        <div id="hha-coach-text"></div>
      </div>
    `;
    document.body.appendChild(wrap);
    return wrap;
  }

  function showCoachMessage(text, durationMs) {
    ensureCoachBubble();
    const bubble = document.getElementById('hha-coach-bubble');
    const label = document.getElementById('hha-coach-text');
    if (!bubble || !label) return;

    label.textContent = text;
    bubble.style.display = 'block';
    bubble.style.opacity = '1';
    bubble.style.transform = 'translateY(0)';

    if (durationMs && durationMs > 0) {
      setTimeout(function () {
        bubble.style.opacity = '0';
        bubble.style.transform = 'translateY(6px)';
        setTimeout(function () {
          bubble.style.display = 'none';
        }, 260);
      }, durationMs);
    }
  }

  // ---------- ข้อความตามโหมด ----------
  const FEVER_LINES = {
    goodjunk: [
      '🔥 Fever mode! คลิกของดีรัว ๆ เลยเด็ก ๆ!',
      'ไฟติดแล้ว! ห้ามหลงคลิกของขยะนะ 💥'
    ],
    groups: [
      '🔥 Fever! เลือกให้ตรงหมู่ เป้าไวแต่ใจเย็น ๆ นะ',
      'โหมดไฟลุก! ดูสัญลักษณ์หมู่ดี ๆ ก่อนแตะ 👀'
    ],
    hydration: [
      '🔥 น้ำดีพุ่งแล้ว! เก็บน้ำเปล่าให้สุด อย่าเผลอแตะน้ำหวานนะ 💧',
      'โหมดกระหายน้ำ! ใครเก็บน้ำดีได้เยอะกว่ากันนะ?'
    ],
    plate: [
      '🔥 จานกำลังสวย! รีบใส่อาหารดี ๆ ลงจานให้ครบหมู่เลย 🥗',
      'โหมดจานไฟฟ้า! ระวังฟาสต์ฟู้ดมาล่อข้างจอ 🍔'
    ],
    default: [
      'Fever มาแล้ว! เก็บของดีให้สุดพลังเลย! 💥',
      'โหมดไฟลุก! มือไว แต่ต้องแม่นนะ 😎'
    ]
  };

  const ROUND_TIPS = {
    goodjunk: {
      highScore: 'สุดยอดเลย! แยกของดีออกจากของขยะได้เก่งมาก 🥦✨',
      lowAcc: 'รอบหน้า ลองมองให้ชัวร์ก่อนแตะนะ ของขยะชอบมาปน 😈',
      normal: 'ดีมาก! ถ้าอยากเก่งขึ้นอีก ลองตั้งใจเลือกแต่ของดีให้มากขึ้นนะ 🍎'
    },
    groups: {
      highScore: 'เก่งมาก! จำหมู่อาหารได้แม่นสุด ๆ เลย 🍚🥦',
      lowAcc: 'รอบหน้า ลองมองสัญลักษณ์หมู่บนภารกิจก่อนแตะทุกครั้งนะ 👀',
      normal: 'ทำได้ดีเลย! ถ้าอยากเป๊ะ ลองฝึกแยกหมู่ให้ไวขึ้นอีกนิด 💪'
    },
    hydration: {
      highScore: 'ดื่มน้ำดีสุด ๆ! คุณคือฮีโร่น้ำดื่มของห้องนี้เลย 💧🦸',
      lowAcc: 'ยังพลาดน้ำหวานนิดหน่อย รอบหน้าอย่าเผลอแตะแก้วสีจัด ๆ นะ 🥤',
      normal: 'เริ่มจำแก้วน้ำดีได้แล้ว! ลองหลบน้ำหวานให้หมดทั้งรอบดูไหม? 😄'
    },
    plate: {
      highScore: 'จานนี้คุณจัดสวยมาก! ได้ทั้งผัก ผลไม้ และโปรตีนครบเลย 🥗✨',
      lowAcc: 'ขนมกับฟาสต์ฟู้ดยังแอบมาเยอะ รอบหน้าเลือกผักกับผลไม้ให้มากขึ้นนะ 🍎',
      normal: 'จัดจานได้ดีเลย! ถ้าเติมผักกับผลไม้ให้เยอะกว่านี้จะเพอร์เฟกต์มาก 🌈'
    },
    default: {
      highScore: 'คะแนนดีมาก! เห็นได้ชัดว่าตั้งใจเล่นสุด ๆ 👏',
      lowAcc: 'รอบหน้าโฟกัสเรื่องความแม่นอีกนิด คะแนนจะพุ่งขึ้นเลย 💪',
      normal: 'เล่นได้ดีเลย! ถ้าอยากอัปเลเวล ลองเพิ่มคอมโบให้ยาวขึ้นดูนะ 😄'
    }
  };

  const QUEST_LINES = {
    allDone: 'เคลียร์ Mini Quest ครบ! สกิลระดับโปรแล้วนะนี่ 🎯',
    someDone: 'เคลียร์เควสต์ไปแล้ว ' ,
    noneDone: 'ลองกดให้ต่อเนื่องยาว ๆ จะช่วยให้เควสต์ผ่านง่ายขึ้นนะ ✨'
  };

  const BOSS_LINES = {
    win: 'ล้ม Boss ได้แล้ว! สุดยอดพลังสายตาและนิ้วไว 👊',
    lose: 'เกือบล้ม Boss แล้ว! รอบหน้าลองโฟกัสตอนท้ายเกมให้มากขึ้นนะ 😎'
  };

  // ---------- เลือกข้อความตามผลการเล่น ----------
  function pickRoundMessage(mode, summary) {
    const pack = ROUND_TIPS[mode] || ROUND_TIPS.default;
    const acc = summary.accuracy || 0;

    if (acc >= 85 && summary.missionGoodCount >= summary.missionTarget) {
      return pack.highScore;
    }
    if (acc < 70) {
      return pack.lowAcc;
    }
    return pack.normal;
  }

  function buildQuestLine(summary) {
    const q = summary.quests || [];
    const doneCount = q.filter(x => x && x.done).length;

    if (!q.length) return '';

    if (doneCount === q.length) {
      return QUEST_LINES.allDone;
    }
    if (doneCount === 0) {
      return QUEST_LINES.noneDone;
    }
    return QUEST_LINES.someDone + doneCount + ' เควสต์แล้ว เหลืออีกนิดเดียว! 🎯';
  }

  function buildBossLine(summary) {
    if (!summary.boss || !summary.boss.spawned) return '';
    return summary.boss.defeated ? BOSS_LINES.win : BOSS_LINES.lose;
  }

  // ---------- Public API ----------
  window.HH_COACH = {
    // เรียกเมื่อ Fever เริ่ม
    onFeverStart: function (mode, diff) {
      const list = FEVER_LINES[mode] || FEVER_LINES.default;
      const msg = list[Math.floor(Math.random() * list.length)];
      showCoachMessage(msg, 2200);
    },

    // เรียกเมื่อจบรอบ
    onRoundEnd: function (summary) {
      // summary = {
      //   mode, diff, score, maxCombo,
      //   missionGoodCount, missionTarget,
      //   accuracy, avgRT, quests, boss: { spawned, defeated }
      // }

      const mode = summary.mode || 'default';
      const mainLine = pickRoundMessage(mode, summary);
      const questLine = buildQuestLine(summary);
      const bossLine = buildBossLine(summary);

      let final = mainLine;
      if (questLine) final += ' ' + questLine;
      if (bossLine) final += ' ' + bossLine;

      showCoachMessage(final, 6000);
    }
  };
})();
