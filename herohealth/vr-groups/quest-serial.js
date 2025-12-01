// vr-groups/quest-serial.js
// จัดการภารกิจแบบต่อเนื่อง (Serial Quests) + HUD แสดงสถานะ

(function (ns) {
  'use strict';

  // ===== กำหนดภารกิจ (ปรับตัวเลขทีหลังได้) =====
  // ถ้ามี ns.foodGroupsQuestDefs อยู่แล้ว จะใช้ของเดิมแทน
  var QUEST_DEFS = ns.foodGroupsQuestDefs || [
    { id: 'Q1', groupId: 1, target: 5, label: 'เก็บอาหารหมู่ 1 ให้ครบ 5 ชิ้น' },
    { id: 'Q2', groupId: 2, target: 5, label: 'เก็บอาหารหมู่ 2 ให้ครบ 5 ชิ้น' },
    { id: 'Q3', groupId: 3, target: 5, label: 'เก็บอาหารหมู่ 3 ให้ครบ 5 ชิ้น' }
  ];

  function normalizeTarget(t) {
    // ถ้าไม่ได้กำหนด target หรือไม่ใช่ตัวเลข → ใช้ค่า default = 5
    if (typeof t !== 'number' || !isFinite(t) || t <= 0) return 5;
    return Math.round(t);
  }

  function cloneQuest(q) {
    return {
      id: q.id,
      groupId: q.groupId,
      target: normalizeTarget(q.target),
      label: q.label,
      progress: 0,
      done: false
    };
  }

  // ===== HUD แสดงภารกิจบนจอ =====
  var QuestHUD = (function () {
    var el = null;

    function ensure() {
      if (el) return el;
      el = document.createElement('div');
      el.id = 'fgQuestHUD';
      el.style.position = 'fixed';
      el.style.top = '12px';
      el.style.left = '50%';
      el.style.transform = 'translateX(-50%)';
      el.style.padding = '6px 12px';
      el.style.borderRadius = '999px';
      el.style.fontFamily = "system-ui, -apple-system, 'IBM Plex Sans Thai', sans-serif";
      el.style.fontSize = '13px';
      el.style.lineHeight = '1.4';
      el.style.background = 'rgba(15,23,42,0.82)';
      el.style.color = '#e5e7eb';
      el.style.boxShadow = '0 6px 18px rgba(15,23,42,0.55)';
      el.style.zIndex = '9998';
      el.style.pointerEvents = 'none';
      el.style.textAlign = 'center';
      el.style.maxWidth = '90vw';
      el.innerHTML = 'ภารกิจจะเริ่มเร็ว ๆ นี้...';
      document.body.appendChild(el);
      return el;
    }

    function format(status, quest) {
      if (!status || !status.total) {
        return 'ยังไม่มีภารกิจ';
      }

      if (!quest) {
        // เคลียร์ครบแล้ว
        return '🎉 ภารกิจทั้งหมดสำเร็จแล้ว (' +
          status.cleared + '/' + status.total + ' ภารกิจ)';
      }

      var target = normalizeTarget(quest.target);
      var done = quest.progress || 0;
      var remain = Math.max(0, target - done);

      var line1 = 'ภารกิจ ' + status.currentIndex + '/' + status.total +
        ' : ' + (quest.label || ('เก็บอาหารหมู่ ' + quest.groupId + ' ให้ครบ ' + target + ' ชิ้น'));
      var line2 = 'ทำได้แล้ว ' + done + '/' + target + ' ชิ้น · เหลืออีก ' + remain +
        ' ชิ้น | สำเร็จแล้ว ' + status.cleared + ' ภารกิจ';

      return line1 + '<br/>' + line2;
    }

    return {
      reset: function () {
        var hud = ensure();
        hud.innerHTML = 'ภารกิจจะเริ่มเร็ว ๆ นี้...';
      },
      update: function (status, quest, justFinished) {
        var hud = ensure();
        hud.innerHTML = format(status, quest);
        if (justFinished) {
          // แสดงแถบเขียวเบา ๆ เวลาเคลียร์ภารกิจ
          hud.style.background = 'rgba(22,163,74,0.9)';
          setTimeout(function () {
            if (!hud) return;
            hud.style.background = 'rgba(15,23,42,0.82)';
          }, 700);
        }
      },
      finish: function (status) {
        var hud = ensure();
        if (!status || !status.total) {
          hud.innerHTML = 'จบเกมแล้ว';
        } else if (status.cleared >= status.total) {
          hud.innerHTML = '🎉 เยี่ยมมาก! ภารกิจทั้งหมดสำเร็จแล้ว (' +
            status.cleared + '/' + status.total + ' ภารกิจ)';
        } else {
          hud.innerHTML = 'จบเวลาแล้ว สำเร็จ ' +
            status.cleared + '/' + status.total + ' ภารกิจ';
        }
      }
    };
  })();

  // ===== Quest Manager สำหรับนับภารกิจ =====
  function FoodGroupsQuestManager(onChange) {
    this.onChange = typeof onChange === 'function' ? onChange : function () {};
    this.quests = [];
    this.index = 0;
    this.clearedCount = 0;

    this.reset();
  }

  FoodGroupsQuestManager.prototype.reset = function () {
    this.quests = QUEST_DEFS.map(cloneQuest);
    this.index = 0;
    this.clearedCount = 0;

    var q = this.getCurrent();
    var status = this.getStatus();

    QuestHUD.reset();
    QuestHUD.update(status, q, false);

    // progressCount = 0 ตอนเริ่ม
    this.onChange(q, 0, false, null);
  };

  FoodGroupsQuestManager.prototype.getCurrent = function () {
    if (this.index < 0 || this.index >= this.quests.length) return null;
    return this.quests[this.index];
  };

  FoodGroupsQuestManager.prototype.getClearedCount = function () {
    return this.clearedCount;
  };

  FoodGroupsQuestManager.prototype.getStatus = function () {
    var total = this.quests.length;
    var hasCurrent = this.index >= 0 && this.index < total;
    return {
      currentIndex: hasCurrent ? (this.index + 1) : total,
      total: total,
      cleared: this.clearedCount
    };
  };

  // เรียกจากเกมเมื่อยิงโดนเป้าหมาย (groupId)
  FoodGroupsQuestManager.prototype.notifyHit = function (groupId) {
    var q = this.getCurrent();
    if (!q) return null;

    if (q.groupId !== groupId) {
      return { bonus: 0 };
    }

    q.progress = (q.progress || 0) + 1;
    q.target = normalizeTarget(q.target);

    var justFinished = false;
    var finishedQuest = null;

    if (!q.done && q.progress >= q.target) {
      q.done = true;
      justFinished = true;
      finishedQuest = q;
      this.clearedCount++;

      // ข้ามไปภารกิจถัดไป
      this.index++;
    }

    var current = this.getCurrent();
    var status = this.getStatus();

    // ★ ส่งเป็น "จำนวนชิ้นที่ทำได้" ไม่ใช่สัดส่วน
    var progressCount = q.progress;

    this.onChange(current, progressCount, justFinished, finishedQuest);
    QuestHUD.update(status, current || q, justFinished);

    return {
      bonus: justFinished ? 10 : 0  // ให้โบนัสเวลาจบภารกิจ
    };
  };

  // export
  ns.FoodGroupsQuestManager = FoodGroupsQuestManager;
  ns.foodGroupsQuestHUD = QuestHUD;

})(window.GAME_MODULES || (window.GAME_MODULES = {}));
