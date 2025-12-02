// vr-groups/coach.js
// โค้ชพูด + แสดงสถานะภารกิจ (quest) ด้านล่างจอ

(function (ns) {
  'use strict';

  let rootEl   = null;
  let lineMain = null;
  let lineSub  = null;

  function ensureDom() {
    if (rootEl) return;

    rootEl = document.createElement('div');
    rootEl.id = 'fgCoach';
    rootEl.style.position        = 'fixed';
    rootEl.style.left            = '50%';
    rootEl.style.bottom          = '18px';
    rootEl.style.transform       = 'translateX(-50%)';
    rootEl.style.zIndex          = '9500';
    rootEl.style.maxWidth        = '90vw';
    rootEl.style.background      = 'rgba(15,23,42,0.88)';
    rootEl.style.borderRadius    = '999px';
    rootEl.style.border          = '1px solid rgba(148,163,184,0.65)';
    rootEl.style.boxShadow       = '0 12px 30px rgba(15,23,42,0.8)';
    rootEl.style.padding         = '6px 16px';
    rootEl.style.fontFamily      = "'IBM Plex Sans Thai', system-ui, -apple-system, sans-serif";
    rootEl.style.fontSize        = '13px';
    rootEl.style.color           = '#e5e7eb';
    rootEl.style.display         = 'flex';
    rootEl.style.alignItems      = 'center';
    rootEl.style.gap             = '8px';
    rootEl.style.pointerEvents   = 'none';

    const avatar = document.createElement('span');
    avatar.textContent = '🥦';
    avatar.style.fontSize = '18px';

    const textWrap = document.createElement('div');
    textWrap.style.display   = 'flex';
    textWrap.style.flexDirection = 'column';
    textWrap.style.alignItems = 'flex-start';

    lineMain = document.createElement('div');
    lineMain.style.fontWeight = '600';

    lineSub = document.createElement('div');
    lineSub.style.opacity = '0.9';
    lineSub.style.fontSize = '12px';

    textWrap.appendChild(lineMain);
    textWrap.appendChild(lineSub);
    rootEl.appendChild(avatar);
    rootEl.appendChild(textWrap);
    document.body.appendChild(rootEl);
  }

  function setCoachText(main, sub) {
    ensureDom();
    if (main != null) lineMain.textContent = main;
    if (sub  != null) lineSub.textContent  = sub;
  }

  // ---------- public API ----------

  function sayStart() {
    setCoachText(
      'วันนี้มาลองเลือกอาหารดี ๆ ให้ครบทุกหมู่กันนะ 💚',
      'เล็ง emoji อาหารแล้วยิงให้ตรงหมู่ เป้าภารกิจจะมีวงแหวนสีทองล้อมอยู่ ✨'
    );
  }

  function sayFinish(sessionInfo) {
    let msg = 'เยี่ยมมาก! เล่นจบรอบแล้ว 🎉';
    let sub = 'ลองเล่นอีกครั้งเพื่อเก็บคะแนนให้สูงขึ้น หรือเปรียบเทียบก่อน–หลังการสอนนะ';

    if (sessionInfo && typeof sessionInfo.questsCleared === 'number' &&
        typeof sessionInfo.questsTotal === 'number' && sessionInfo.questsTotal > 0) {
      msg = `จบรอบแล้ว 🎉 ทำภารกิจสำเร็จ ${sessionInfo.questsCleared}/${sessionInfo.questsTotal} ภารกิจ`;
      sub = 'ถ้าอยากเก็บภารกิจให้ครบทุกหมู่ ลองเล่นอีกรอบแล้วโฟกัสเป้าภารกิจ (วงแหวนทอง) ดูนะ ✨';
    }

    setCoachText(msg, sub);
  }

  function sayQuest(quest, progress) {
    if (!quest) return;
    const need = quest.need || quest.target || quest.count || 5;
    const got  = progress || 0;

    const foodLabel = quest.label || quest.name || 'อาหารดี';
    const em        = quest.emoji || '🍎';

    const main = `ภารกิจ: ยิง ${em} ${foodLabel} ให้ครบ ${need} ครั้ง!`;
    const sub  = `ตอนนี้ทำได้ ${got}/${need} แล้ว สู้ต่ออีกนิดจะได้โบนัสพิเศษนะ ✨`;

    setCoachText(main, sub);
  }

  /**
   * onQuestChange(payload)
   * payload = {
   *   current, progress, justFinished, finished, status
   * }
   * status (จาก questManager.getStatus()) น่าจะมี:
   *   { currentIndex, total, cleared, left, ... }
   */
  function onQuestChange(payload) {
    payload = payload || {};
    const q       = payload.current || null;
    const prog    = payload.progress || 0;
    const status  = payload.status  || null;
    const justFin = !!payload.justFinished;

    if (q) {
      sayQuest(q, prog);
    } else {
      // ไม่มีภารกิจ active (เช่น จบทุกอันแล้ว)
      const cleared = status && typeof status.cleared === 'number'
        ? status.cleared
        : (status && typeof status.currentIndex === 'number'
           ? status.currentIndex
           : null);
      const total   = status && typeof status.total === 'number'
        ? status.total
        : null;

      let main = 'ภารกิจของรอบนี้ครบแล้ว เยี่ยมมาก! 💚';
      let sub  = 'ลองโฟกัสเลือกอาหารดี ๆ ทุกหมู่ แล้วดูคะแนนรวมของตัวเองนะ';

      if (cleared != null && total != null) {
        main = `ทำภารกิจสำเร็จแล้ว ${cleared}/${total} ภารกิจ 🎉`;
        sub  = 'ถ้าอยากลองเปลี่ยนความยาก ให้ครูปรับเป็น Normal หรือ Hard เพื่อเก็บข้อมูลเปรียบเทียบได้เลย';
      }

      setCoachText(main, sub);
    }

    // ถ้าเพิ่งเคลียร์ภารกิจนี้เสร็จ ให้ใส่ข้อความยินดีสั้น ๆ
    if (justFin && payload.finished) {
      const em = payload.finished.emoji || '✨';
      const foodLabel = payload.finished.label || 'อาหารดี';

      const main = `ภารกิจสำเร็จ! ${em} เก็บ ${foodLabel} ได้ครบแล้ว 🎉`;
      const sub  = 'เดี๋ยวโค้ชจะส่งภารกิจถัดไปให้ ลองดูว่ารอบนี้จะทำได้ครบทุกหมู่ไหมนะ 💪';
      setCoachText(main, sub);
    }
  }

  ns.foodGroupsCoach = {
    sayStart,
    sayFinish,
    sayQuest,
    onQuestChange
  };
})(window.GAME_MODULES || (window.GAME_MODULES = {}));