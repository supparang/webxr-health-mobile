// === Hero Health — coach.js ===
// โค้ชพูดแนวเกม ROV/Free Fire แต่สุภาพสำหรับ ป.5–ป.6

(function () {
  'use strict';

  function createCoachBubble() {
    let el = document.getElementById('hha-coach');
    if (el) return el;

    el = document.createElement('div');
    el.id = 'hha-coach';
    Object.assign(el.style, {
      position: 'fixed',
      left: '16px',
      bottom: '16px',
      maxWidth: '260px',
      padding: '10px 12px',
      borderRadius: '16px',
      background: 'rgba(15,23,42,0.96)',
      color: '#e5e7eb',
      fontFamily: 'system-ui,Segoe UI,Inter,Roboto,sans-serif',
      fontSize: '12px',
      boxShadow: '0 18px 40px rgba(0,0,0,0.7)',
      border: '1px solid rgba(148,163,184,0.8)',
      zIndex: 9300,
      display: 'flex',
      alignItems: 'flex-start',
      gap: '8px',
      pointerEvents: 'none'
    });

    el.innerHTML = `
      <div style="font-size:20px;line-height:1;">🧑‍⚕️</div>
      <div>
        <div style="font-weight:600;font-size:12px;margin-bottom:2px;">โค้ชสุขภาพ</div>
        <div id="hha-coach-text" style="font-size:12px;line-height:1.4;">
          พร้อมลุยแล้วนะ! ลองเก็บของดีให้เยอะสุด ๆ ไปเลย 💪
        </div>
      </div>
    `;
    document.body.appendChild(el);
    return el;
  }

  function setCoachMessage(msg) {
    const bubble = createCoachBubble();
    const textEl = document.getElementById('hha-coach-text');
    if (textEl) {
      textEl.textContent = msg;
    }
  }

  // helper ให้เลือกข้อความตาม rank slug
  function messageForRank(rankSlug) {
    switch (rankSlug) {
      case 'healthy-god':
        return 'โหดมาก! ระดับ Healthy God แล้ว แบบนี้ถ้าเป็นแข่งจริงก็ MVP แน่นอน 🌈';
      case 'super-fit':
        return 'ฟอร์มดีมาก Super Fit! ลองเล่นอีกสักรอบ เผื่อดันขึ้น Healthy God ได้เลย 💪';
      case 'active-hero':
        return 'Active Hero แล้ว! ขยับเก่ง เลือกของดีได้เยอะมาก เก่งมากนะ ⚡';
      case 'rookie':
        return 'Rookie มือใหม่ไฟแรง! รอบหน้าโฟกัสเพิ่มอีกนิด จะกลายเป็นฮีโร่แน่นอน 🎯';
      case 'sleepy':
      default:
        return 'เหมือนร่างกายยังง่วง ๆ อยู่นิดหน่อย ลองพักสายตา หายใจลึก ๆ แล้วลองใหม่อีกทีนะ 😴';
    }
  }

  window.HH_COACH = {
    // เรียกจาก main.js ตอนเริ่ม Fever ใหม่
    onFeverStart: function (mode, diff) {
      const msg = 'โหมด FEVER มาแล้ว! ลุยเก็บของดีรัว ๆ ให้สุดแบบไม่พลาดเลยนะ 🔥';
      setCoachMessage(msg);
    },

    // เรียกจาก main.js ตอนจบรอบ
    onRoundEnd: function (summary) {
      // summary.rank = { slug, shortLabel, banner, note, ... }
      const r = summary && summary.rank ? summary.rank : null;
      const slug = r ? r.slug : 'sleepy';
      const msgCore = messageForRank(slug);

      // เติม context เล็กน้อยให้ครูใช้ อธิบายเด็ก
      let extra = '';
      if (summary && typeof summary.accuracy === 'number') {
        if (summary.accuracy >= 90) {
          extra = ' ความแม่นยำสูงมาก เกือบไม่พลาดเลย!';
        } else if (summary.accuracy >= 70) {
          extra = ' แม่นใช้ได้ ลองลดการกดพลาดอีกนิดเดียวจะดีมาก!';
        } else {
          extra = ' รอบนี้พลาดเยอะหน่อย ไม่เป็นไร รอบหน้าลองกดช้าลงแต่ให้แม่นขึ้นดูนะ';
        }
      }

      setCoachMessage(msgCore + extra);
    }
  };
})();
