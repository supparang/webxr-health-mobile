// vr-groups/coach.js — Safe-Area + Mobile Friendly
(function (ns) {
  'use strict';

  let rootEl = null;
  let lineMain = null;
  let lineSub = null;

  function ensureDom() {
    if (rootEl) return;

    rootEl = document.createElement('div');
    rootEl.id = 'fgCoach';

    Object.assign(rootEl.style, {
      position: 'fixed',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: '9500',
      maxWidth: '92vw',
      background: 'rgba(15,23,42,0.88)',
      borderRadius: '999px',
      border: '1px solid rgba(148,163,184,0.65)',
      boxShadow: '0 12px 30px rgba(15,23,42,0.8)',
      padding: '8px 18px',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      pointerEvents: 'none',
      fontFamily: "'IBM Plex Sans Thai', system-ui",
      color: '#e5e7eb',

      /** 🔥 กันโดนบัง โดยใช้พื้นที่ปลอดภัยของ iOS + buffer 24px */
      bottom: 'calc(env(safe-area-inset-bottom, 16px) + 24px)'
    });

    // avatar
    const avatar = document.createElement('span');
    avatar.textContent = '🥦';
    avatar.style.fontSize = '20px';

    const wrap = document.createElement('div');
    wrap.style.display = 'flex';
    wrap.style.flexDirection = 'column';

    lineMain = document.createElement('div');
    lineMain.style.fontWeight = '600';
    lineMain.style.fontSize = '14px';

    lineSub = document.createElement('div');
    lineSub.style.fontSize = '12px';
    lineSub.style.opacity = '0.9';

    wrap.appendChild(lineMain);
    wrap.appendChild(lineSub);
    rootEl.appendChild(avatar);
    rootEl.appendChild(wrap);

    document.body.appendChild(rootEl);

    // 📱 Mobile optimization
    const mq = window.matchMedia("(max-width: 600px)");
    if (mq.matches) {
      lineMain.style.fontSize = '13px';
      lineSub.style.fontSize = '11px';
      rootEl.style.padding = '6px 14px';
    }
  }

  function setCoach(main, sub) {
    ensureDom();
    if (main != null) lineMain.textContent = main;
    if (sub  != null) lineSub.textContent  = sub;
  }

  // โค้ชพูดตอนเริ่มเกม
  function sayStart() {
    setCoach(
      'วันนี้มาลองเลือกอาหารดี ๆ ให้ครบทุกหมู่กันนะ 💚',
      'เล็ง emoji อาหารแล้วกดยิง เป้าภารกิจจะมีวงแหวนทอง ✨'
    );
  }

  // โค้ชพูดตอนจบเกม
  function sayFinish(info) {
    let main = 'เยี่ยมมาก! เล่นจบรอบแล้ว 🎉';
    let sub  = 'ลองเล่นอีกครั้งเพื่อเก็บคะแนนให้สูงขึ้นนะ!';

    if (info?.questsTotal) {
      main = `ทำภารกิจสำเร็จแล้ว ${info.questsCleared}/${info.questsTotal} ภารกิจ 🎉`;
      sub  = 'เก็บภารกิจให้ครบทุกหมู่ได้เลย ✨';
    }
    setCoach(main, sub);
  }

  // ตอนมีภารกิจใหม่ / ความคืบหน้า
  function sayQuest(quest, progress) {
    if (!quest) return;
    const need = quest.need || 5;
    const em   = quest.emoji || '🍎';

    setCoach(
      `ภารกิจ: เก็บ ${em} ให้ครบ ${need} ครั้ง!`,
      `ตอนนี้ได้ ${progress}/${need} แล้ว สู้ต่ออีกนิดนะ ✨`
    );
  }

  // ตัวจัดการกลาง
  function onQuestChange(p) {
    if (p.justFinished && p.finished) {
      setCoach(
        `ภารกิจสำเร็จ! ${p.finished.emoji || '✨'} 🎉`,
        'โค้ชจะส่งภารกิจถัดไปให้นะ!'
      );
    } else if (p.current) {
      sayQuest(p.current, p.progress);
    } else {
      setCoach('ทำภารกิจของรอบนี้ครบแล้ว 💚', 'ลองเก็บคะแนนรวมให้สูงขึ้นนะ!');
    }
  }

  ns.foodGroupsCoach = { sayStart, sayFinish, sayQuest, onQuestChange };

})(window.GAME_MODULES || (window.GAME_MODULES = {}));