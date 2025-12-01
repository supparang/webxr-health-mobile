// vr-groups/coach.js
// โค้ชตัวหนังสือเล็ก ๆ ด้านบน บอกภารกิจ / ให้กำลังใจ

(function (ns) {
  'use strict';

  var el = null;

  function ensureEl() {
    if (el) return el;
    el = document.createElement('div');
    el.id = 'fgCoach';
    el.style.position = 'fixed';
    el.style.bottom = '18px';
    el.style.left = '50%';
    el.style.transform = 'translateX(-50%)';
    el.style.padding = '6px 14px';
    el.style.borderRadius = '999px';
    el.style.background = 'rgba(15,23,42,0.9)';
    el.style.color = '#e5e7eb';
    el.style.fontFamily = "system-ui, -apple-system, 'IBM Plex Sans Thai', sans-serif";
    el.style.fontSize = '13px';
    el.style.lineHeight = '1.4';
    el.style.boxShadow = '0 6px 18px rgba(15,23,42,0.6)';
    el.style.zIndex = '9997';
    el.style.pointerEvents = 'none';
    el.style.maxWidth = '92vw';
    el.style.textAlign = 'center';
    el.style.opacity = '0';
    el.style.transition = 'opacity .2s ease';
    document.body.appendChild(el);
    return el;
  }

  function showText(text) {
    var box = ensureEl();
    box.innerHTML = text;
    box.style.opacity = '1';
    clearTimeout(showText._timer);
    showText._timer = setTimeout(function () {
      box.style.opacity = '0';
    }, 3000);
  }

  var Coach = {
    sayStart: function () {
      showText('🎮 เล็งเป้าแล้วเก็บอาหารดี ๆ ให้ครบทุกหมู่ สู้ ๆ !');
    },
    sayFinish: function () {
      showText('⏰ หมดเวลาแล้ว มาดูคะแนนกับภารกิจที่สำเร็จกัน!');
    },

    sayQuest: function (quest, progressCount) {
      if (!quest) return;
      var target = quest.target || 5;
      var done = progressCount || 0;
      showText('🎯 ' + (quest.label || 'เก็บหมู่ ' + quest.groupId) +
        ' (' + done + '/' + target + ' ชิ้น)');
    },

    onQuestChange: function (info) {
      var quest = info.current;
      var status = info.status;
      if (!quest && status) {
        showText('🎉 เยี่ยมมาก! คุณทำครบ ' + status.cleared + ' ภารกิจแล้ว');
        return;
      }
      if (!quest) return;

      var target = quest.target || 5;
      var done = quest.progress || 0;

      var prefix = info.justFinished
        ? '✔ ภารกิจสำเร็จ! ต่อไป... '
        : '📌 ภารกิจ ' + status.currentIndex + '/' + status.total + ': ';

      showText(prefix +
        (quest.label || ('หมู่ ' + quest.groupId)) +
        ' (' + done + '/' + target + ' ชิ้น)');
    }
  };

  ns.foodGroupsCoach = Coach;

})(window.GAME_MODULES || (window.GAME_MODULES = {}));
