// === /english/js/lesson-skill-data-guard.js ===
// PATCH v20260424g-LESSON-SKILL-DATA-GUARD
// Force lesson skill from /english/js/lesson-data.js
// Fix: speaking panel must NOT appear on every session.

import * as LessonDataModule from './lesson-data.js?v=20260424';

(function () {
  'use strict';

  const VERSION = 'v20260424g-LESSON-SKILL-DATA-GUARD';

  const DATA =
    LessonDataModule.LESSON_DATA ||
    LessonDataModule.default ||
    LessonDataModule.LESSONS ||
    LessonDataModule.SESSIONS ||
    LessonDataModule.lessonData ||
    null;

  window.LESSON_DATA = DATA;

  function $(sel, root = document) {
    return root.querySelector(sel);
  }

  function normalizeSid(v) {
    const raw = String(v || '').trim().toUpperCase();
    if (/^S\d+$/.test(raw)) {
      const n = Math.max(1, Math.min(15, parseInt(raw.replace('S', ''), 10) || 1));
      return `S${n}`;
    }
    const n = Math.max(1, Math.min(15, parseInt(raw, 10) || 1));
    return `S${n}`;
  }

  function currentSid() {
    const q = new URLSearchParams(location.search || '');

    try {
      if (window.LESSON_CURRENT_STATE?.sid) {
        return normalizeSid(window.LESSON_CURRENT_STATE.sid);
      }
    } catch (err) {}

    return normalizeSid(
      q.get('s') ||
      q.get('sid') ||
      q.get('session') ||
      q.get('unit') ||
      q.get('lesson') ||
      '1'
    );
  }

  function normalizeSkill(v) {
    const raw = String(v || '').trim().toLowerCase();

    if (['speaking', 'speak', 'voice', 'pronunciation', 'พูด'].includes(raw)) return 'speaking';
    if (['listening', 'listen', 'audio', 'hearing', 'ฟัง'].includes(raw)) return 'listening';
    if (['reading', 'read', 'อ่าน'].includes(raw)) return 'reading';
    if (['writing', 'write', 'typing', 'type', 'เขียน'].includes(raw)) return 'writing';
    if (['boss', 'challenge', 'bossstage', 'boss-stage'].includes(raw)) return 'boss';
    if (['finalboss', 'final-boss', 'final_boss', 'capstone'].includes(raw)) return 'finalBoss';

    return '';
  }

  function findSessionFromData(sid) {
    if (!DATA) return null;

    const n = parseInt(String(sid).replace('S', ''), 10) || 1;

    if (Array.isArray(DATA)) {
      return (
        DATA.find(x =>
          normalizeSid(x?.sid || x?.id || x?.session || x?.unit || x?.lessonNo) === sid
        ) ||
        DATA[n - 1] ||
        null
      );
    }

    if (typeof DATA === 'object') {
      const direct =
        DATA[sid] ||
        DATA[sid.toLowerCase()] ||
        DATA[String(n)] ||
        DATA.sessions?.[sid] ||
        DATA.sessions?.[sid.toLowerCase()] ||
        DATA.sessions?.[String(n)] ||
        DATA.lessons?.[sid] ||
        DATA.lessons?.[sid.toLowerCase()] ||
        DATA.lessons?.[String(n)];

      if (direct) return direct;

      const arr =
        DATA.sessions ||
        DATA.lessons ||
        DATA.items ||
        DATA.data ||
        null;

      if (Array.isArray(arr)) {
        return (
          arr.find(x =>
            normalizeSid(x?.sid || x?.id || x?.session || x?.unit || x?.lessonNo) === sid
          ) ||
          arr[n - 1] ||
          null
        );
      }
    }

    return null;
  }

  function getSkillFromSession(session, sid) {
    if (!session) return '';

    const directSkill = normalizeSkill(
      session.skill ||
      session.primarySkill ||
      session.mainSkill ||
      session.type ||
      session.activityType ||
      session.missionType ||
      session.mode
    );

    if (directSkill) return directSkill;

    if (session.boss === true || session.isBoss === true) {
      return sid === 'S15' ? 'finalBoss' : 'boss';
    }

    const candidates = [];

    if (Array.isArray(session.questions)) candidates.push(...session.questions);
    if (Array.isArray(session.items)) candidates.push(...session.items);
    if (Array.isArray(session.missions)) candidates.push(...session.missions);
    if (Array.isArray(session.tasks)) candidates.push(...session.tasks);

    const banks = session.banks || session.levels || session.difficulties;
    if (banks && typeof banks === 'object') {
      ['easy', 'normal', 'hard', 'expert'].forEach(diff => {
        if (Array.isArray(banks[diff])) candidates.push(...banks[diff]);
      });
    }

    for (const item of candidates) {
      const s = normalizeSkill(
        item?.skill ||
        item?.type ||
        item?.activityType ||
        item?.missionType
      );
      if (s) return s;
    }

    return '';
  }

  function getDataSkill(sid = currentSid()) {
    sid = normalizeSid(sid);

    const session = findSessionFromData(sid);
    const skill = getSkillFromSession(session, sid);

    // ถ้า data ไม่บอก skill จริง ๆ ให้ return unknown
    // ห้ามเดาเป็น speaking เองเด็ดขาด
    return skill || 'unknown';
  }

  function removeSpeakingUI(reason) {
    const panel = $('#lessonSpeakingPanel');
    if (panel) panel.remove();

    const scene = $('a-scene');
    if (scene) {
      const board = $('#lessonSpeakingVrBoard', scene);
      if (board) board.remove();
    }

    window.LESSON_SPEAKING_BLOCKED = true;

    console.log('[LessonSkillDataGuard] removed speaking UI:', reason);
  }

  function applySkillFromData(reason) {
    const sid = currentSid();
    const skill = getDataSkill(sid);

    document.documentElement.dataset.lessonSid = sid;
    document.documentElement.dataset.lessonSkill = skill;
    window.LESSON_DATA_SKILL = skill;

    // override router skill ให้ยึด data
    if (window.LESSON_ROUTER && !window.LESSON_ROUTER.__dataGuardPatched) {
      const originalGetCurrentSkill = window.LESSON_ROUTER.getCurrentSkill?.bind(window.LESSON_ROUTER);
      const originalPickItem = window.LESSON_ROUTER.pickItem?.bind(window.LESSON_ROUTER);

      window.LESSON_ROUTER.getCurrentSkill = function () {
        const dataSkill = getDataSkill(currentSid());
        if (dataSkill && dataSkill !== 'unknown') return dataSkill;
        return originalGetCurrentSkill ? originalGetCurrentSkill() : 'unknown';
      };

      if (originalPickItem) {
        window.LESSON_ROUTER.pickItem = function (options = {}) {
          const item = originalPickItem(options);
          const sid2 = normalizeSid(options.sid || currentSid());
          const dataSkill = getDataSkill(sid2);

          if (dataSkill && dataSkill !== 'unknown') {
            item.skill = dataSkill;
            item.routeSkill = dataSkill;
          }

          return item;
        };
      }

      window.LESSON_ROUTER.__dataGuardPatched = true;
    }

    // ถ้าไม่ใช่ speaking ห้ามมี speaking panel
    if (skill !== 'speaking') {
      removeSpeakingUI(`${sid} skill=${skill} reason=${reason}`);
    } else {
      window.LESSON_SPEAKING_BLOCKED = false;
      if (window.LESSON_SPEAKING_FIX?.refresh) {
        try {
          window.LESSON_SPEAKING_FIX.refresh();
        } catch (err) {}
      }
    }

    window.dispatchEvent(new CustomEvent('lesson:data-skill-ready', {
      detail: { version: VERSION, sid, skill, session: findSessionFromData(sid), reason }
    }));

    document.dispatchEvent(new CustomEvent('lesson:data-skill-ready', {
      detail: { version: VERSION, sid, skill, session: findSessionFromData(sid), reason }
    }));

    console.log('[LessonSkillDataGuard]', VERSION, { sid, skill, reason });
    return skill;
  }

  window.LESSON_DATA_GUARD = {
    version: VERSION,
    data: DATA,
    currentSid,
    getDataSkill,
    findSessionFromData,
    apply: applySkillFromData
  };

  applySkillFromData('boot');

  window.addEventListener('lesson:router-ready', () => applySkillFromData('router-ready'));
  window.addEventListener('lesson:item-ready', () => applySkillFromData('item-ready'));
  window.addEventListener('lesson:view-mode-ready', () => applySkillFromData('view-mode-ready'));

  // กัน speaking-fix timer สร้าง panel กลับมาอีก
  setTimeout(() => applySkillFromData('t500'), 500);
  setTimeout(() => applySkillFromData('t1200'), 1200);
  setTimeout(() => applySkillFromData('t2500'), 2500);
  setTimeout(() => applySkillFromData('t4000'), 4000);
})();
