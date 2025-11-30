// vr-goodjunk/coach.js
(function (ns) {
  'use strict';

  const Coach = {
    say(text) {
      if (ns.foodGroupsUI && ns.foodGroupsUI.setQuest) {
        ns.foodGroupsUI.setQuest(text);
      }
    },

    sayQuest(quest, progress) {
      if (!quest) {
        this.say('เคลียร์ภารกิจครบแล้ว 🎉');
        return;
      }
      const txt = `หมู่ ${quest.groupId} ให้ครบ ${quest.targetCount} ชิ้น `
        + `(ตอนนี้ ${progress}/${quest.targetCount})`;
      this.say(txt);
    },

    sayStart() {
      this.say('ฟังภารกิจจากโค้ช แล้วเล็งให้ถูกหมู่เลย! 💥');
    },

    sayFinish() {
      this.say('สุดยอด จบเกมแล้ว! 🎉');
    }
  };

  ns.foodGroupsCoach = Coach;
})(window.GAME_MODULES);
