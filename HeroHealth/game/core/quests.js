// === core/quests.js (Difficulty-scaled mini-quests; single-active; HUD/Coach wired) ===
/*
  ใช้กับ main.js แบบ:
    Quests.bindToMain({ hud, coach })
    Quests.beginRun(modeKey, diff, lang, matchTime)
    Quests.event('hit' | 'miss' | 'power' | 'fever', payload)
    Quests.tick({ score, dt, fever })   // เรียกทุกวินาทีจาก main
    const res = Quests.endRun({ score })
*/

export const Quests = (() => {
  // ----- Catalog -----
  const CATALOG = [
    { key: 'good',        icon: '🥗', labelEN: 'Good items',     labelTH: 'ของดี',               type: 'count' },
    { key: 'perfect',     icon: '💥', labelEN: 'Perfect',        labelTH: 'เพอร์เฟกต์',          type: 'count' },
    { key: 'star',        icon: '⭐', labelEN: 'Collect Stars',   labelTH: 'เก็บดาว',             type: 'count' },
    { key: 'feverSec',    icon: '🔥', labelEN: 'Fever Seconds',  labelTH: 'วินาที Fever',        type: 'time'  },
    { key: 'noMiss',      icon: '🟦', labelEN: 'No-Miss',        labelTH: 'ไม่พลาดต่อเนื่อง',   type: 'streak'},
    { key: 'combo',       icon: '⚡', labelEN: 'Combo Streak',    labelTH: 'คอมโบต่อเนื่อง',     type: 'peak'  },
    { key: 'score',       icon: '🏆', labelEN: 'Score Target',   labelTH: 'ทำคะแนนรวม',          type: 'score' },
    { key: 'shield',      icon: '🛡️', labelEN: 'Collect Shields',labelTH: 'เก็บโล่',            type: 'count' },
    { key: 'golden',      icon: '🌟', labelEN: 'Golden',         labelTH: 'เก็บทอง',             type: 'count' },
    { key: 'avoidJunk',   icon: '🚫', labelEN: 'Avoid Junk',     labelTH: 'เลี่ยงของไม่ดี',      type: 'count' },
  ];

  // ----- Difficulty scaling ranges -----
  // ค่าช่วงเป้าหมายต่อเควสต์ (ตาม Easy/Normal/Hard)
  const TARGETS = {
    Easy: {
      good: [5, 8], perfect: [2, 4], star: [1, 3], feverSec: [5, 8],
      noMiss: [3, 5], combo: [6, 9], score: [600, 1000], shield: [1, 1],
      golden: [1, 3], avoidJunk: [3, 5]
    },
    Normal: {
      good: [6,10], perfect: [3, 6], star: [2, 4], feverSec: [6,12],
      noMiss: [4, 7], combo: [8,12], score: [800, 1400], shield: [1, 2],
      golden: [2, 4], avoidJunk: [4, 8]
    },
    Hard: {
      good: [8,12], perfect: [4, 7], star: [3, 5], feverSec: [10,16],
      noMiss: [6, 9], combo: [12,16], score: [1200, 2000], shield: [2, 3],
      golden: [3, 5], avoidJunk: [6,10]
    }
  };

  // ----- State -----
  const S = {
    hud: null, coach: null,
    mode: 'goodjunk', diff: 'Normal', lang: 'TH', matchTime: 45,
    list: [],        // เควสต์ลิสต์ (สุ่มเรียง)
    i: -1,           // index เควสต์ปัจจุบัน
    cur: null,       // {key, need, progress, done, fail, type}
    done: [],        // สำเร็จแล้ว (array ของ cur snapshot)
    // ตัวช่วยรวม
    feverActive: false,
    feverAccum: 0,            // วินาที fever ที่สะสม
    noMissStreak: 0,
    bestComboSeen: 0,
    scoreNow: 0
  };

  function randi(min, max) { return (min + Math.floor(Math.random() * (max - min + 1))); }
  function pickNeed(key, diff) {
    const span = (TARGETS[diff] || TARGETS.Normal)[key];
    if (!span) return 5;
    const [a, b] = span;
    return randi(a, b);
  }

  function labelOf(k) {
    const item = CATALOG.find(x => x.key === k);
    if (!item) return k;
    return S.lang === 'EN' ? item.labelEN : item.labelTH;
  }
  function iconOf(k) {
    const item = CATALOG.find(x => x.key === k);
    return item ? item.icon : '⭐';
  }
  function typeOf(k) {
    const item = CATALOG.find(x => x.key === k);
    return item ? item.type : 'count';
  }

  // ----- HUD sync -----
  function refreshHUD() {
    if (!S.hud) return;
    const chips = [];
    if (S.cur) {
      const pct = S.cur.need > 0 ? Math.min(100, Math.round((S.cur.progress / S.cur.need) * 100)) : 0;
      chips.push({
        key: S.cur.key, icon: iconOf(S.cur.key),
        label: `${labelOf(S.cur.key)}`,
        progress: S.cur.type === 'peak' ? Math.max(S.cur.progress | 0, S.bestComboSeen | 0) : S.cur.progress | 0,
        need: S.cur.need,
        done: !!S.cur.done,
        fail: !!S.cur.fail,
        remain: Math.max(0, (S.cur.need | 0) - (S.cur.progress | 0)),
        pct
      });
    }
    S.hud.setQuestChips?.(chips);
  }

  function nextQuest() {
    S.i++;
    if (S.i >= S.list.length) {
      // หมดลิสต์แล้ว – วนสุ่มใหม่
      shuffleNewList();
      S.i = 0;
    }
    const k = S.list[S.i];
    S.cur = {
      key: k,
      type: typeOf(k),
      need: pickNeed(k, S.diff),
      progress: 0,
      done: false,
      fail: false
    };
    if (S.coach) {
      const msg = S.lang === 'EN'
        ? `Quest: ${labelOf(k)} → ${S.cur.need}`
        : `ภารกิจ: ${labelOf(k)} → ${S.cur.need}`;
      S.coach.onStart ? S.coach.onStart(msg) : S.hud?.say?.(msg);
    } else {
      S.hud?.say?.((S.lang==='EN'?'Quest: ':'ภารกิจ: ') + labelOf(k));
    }
    refreshHUD();
  }

  function shuffleNewList() {
    const keys = CATALOG.map(x => x.key);
    // สุ่มลิสต์แบบกระจาย
    for (let i = keys.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [keys[i], keys[j]] = [keys[j], keys[i]];
    }
    S.list = keys;
  }

  function markProgress(delta) {
    if (!S.cur || S.cur.done) return;
    S.cur.progress = Math.max(0, (S.cur.progress | 0) + (delta | 0));
    // ตรวจสำเร็จ
    const goal = S.cur.type === 'peak'
      ? Math.max(S.cur.progress | 0, S.bestComboSeen | 0)
      : S.cur.progress | 0;
    if (goal >= (S.cur.need | 0)) {
      S.cur.done = true;
      S.done.push({ ...S.cur });
      S.hud?.say?.(S.lang === 'EN' ? 'Quest complete!' : 'ภารกิจสำเร็จ!');
      // เปิดเควสต์ถัดไป
      nextQuest();
    } else {
      refreshHUD();
    }
  }

  // ----- Public API -----
  function bindToMain({ hud, coach }) {
    S.hud = hud || null;
    S.coach = coach || null;
    refreshHUD();
    return { refresh: refreshHUD };
  }

  function beginRun(mode, diff, lang, matchTime) {
    S.mode = String(mode || 'goodjunk');
    S.diff = String(diff || 'Normal');
    S.lang = (String(lang || 'TH')).toUpperCase();
    S.matchTime = matchTime | 0 || 45;

    S.done.length = 0;
    S.feverActive = false;
    S.feverAccum = 0;
    S.noMissStreak = 0;
    S.bestComboSeen = 0;
    S.scoreNow = 0;

    shuffleNewList();
    S.i = -1;
    nextQuest();
  }

  function endRun({ score } = {}) {
    const summary = {
      totalDone: S.done.length,
      items: S.done.slice(0, 10).map(q => `${iconOf(q.key)} ${labelOf(q.key)} ${q.need}`)
    };
    // เคลียร์ HUD
    refreshHUD();
    return summary;
  }

  function event(kind, payload = {}) {
    // kind: 'hit' | 'miss' | 'power' | 'fever'
    if (!S.cur) return;

    // สะสม peak combo (มาจาก main → payload.comboNow)
    if (payload.comboNow != null) {
      S.bestComboSeen = Math.max(S.bestComboSeen | 0, payload.comboNow | 0);
    }

    if (kind === 'fever') {
      S.feverActive = !!payload.on;
      return;
    }

    if (kind === 'hit') {
      // สำหรับ no-miss streak
      S.noMissStreak++;

      // Good / Perfect / Star / Golden
      const isPerfect = (payload.result === 'perfect');
      const isGoodHit = (payload.result === 'good' || isPerfect);

      if (S.cur.key === 'good'      && isGoodHit) markProgress(1);
      if (S.cur.key === 'perfect'   && isPerfect) markProgress(1);
      if (S.cur.key === 'star'      && (payload.meta?.star || payload.points === 150)) markProgress(1);
      if (S.cur.key === 'golden'    && payload.meta?.golden === true) markProgress(1);
      if (S.cur.key === 'combo')    markProgress(0); // ใช้ peak เทียบใน markProgress()
      if (S.cur.key === 'noMiss')   markProgress(1);
      // score/feverSec จะนับใน tick()
      refreshHUD();
      return;
    }

    if (kind === 'power') {
      if (S.cur.key === 'shield' && payload?.kind === 'shield') markProgress(1);
      refreshHUD();
      return;
    }

    if (kind === 'miss') {
      // ชนิด miss: 'avoid-junk', 'timeout-good', 'click-junk' (ส่งมาจาก mode)
      if (payload.kind === 'avoid-junk' && S.cur.key === 'avoidJunk') {
        markProgress(1);
      }
      // no-miss streak แตก
      S.noMissStreak = 0;
      refreshHUD();
      return;
    }
  }

  function tick({ score, dt = 1, fever = false } = {}) {
    S.scoreNow = score | 0;

    // Fever seconds
    if (fever || S.feverActive) {
      S.feverAccum += (dt || 1);
      if (S.cur?.key === 'feverSec') {
        // นับเป็นวินาทีเต็มเท่านั้น
        const have = Math.floor(S.feverAccum | 0);
        const doneBefore = S.cur.progress | 0;
        if (have > doneBefore) {
          S.cur.progress = have;
          if (S.cur.progress >= (S.cur.need | 0)) {
            S.cur.done = true;
            S.done.push({ ...S.cur });
            S.hud?.say?.(S.lang === 'EN' ? 'Quest complete!' : 'ภารกิจสำเร็จ!');
            nextQuest();
          } else {
            refreshHUD();
          }
        }
      }
    }

    // Score target
    if (S.cur?.key === 'score') {
      const before = S.cur.progress | 0;
      S.cur.progress = Math.min(S.cur.need | 0, S.scoreNow | 0);
      if (S.cur.progress !== before) {
        if (S.cur.progress >= (S.cur.need | 0)) {
          S.cur.done = true;
          S.done.push({ ...S.cur });
          S.hud?.say?.(S.lang === 'EN' ? 'Quest complete!' : 'ภารกิจสำเร็จ!');
          nextQuest();
        } else {
          refreshHUD();
        }
      }
    }

    // Combo (peak) จะถูกวัดผ่าน event('hit' … comboNow)
  }

  return { bindToMain, beginRun, endRun, event, tick };
})();
export default { Quests };
