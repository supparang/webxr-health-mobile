// === Hero Health — mode.goodjunk.js (VR Nutrition, Production Ready 2025-11-29) ===
// โหมด Good vs Junk สำหรับ VR Nutrition
// - แยก config ตามระดับความยาก (easy/normal/hard)
// - ผูก diff table เข้ากับ window.HHA_DIFF_TABLE สำหรับใช้ในงานวิจัย/รายงาน
// - มี fallback config ปลอดภัย ถ้าระดับที่ส่งมาไม่ตรง

(function () {
  'use strict';

  const MODE_ID = 'goodjunk';

  // ให้แน่ใจว่ามี namespace กลางสำหรับทุกโหมด
  window.HH_MODES = window.HH_MODES || {};

  // ---------- Diff Table เฉพาะโหมด Good vs Junk ----------
  // โครงสร้าง: LOCAL_DIFF_TABLE[diffKey] = { engine: {...}, benchmark: {...} }
  const LOCAL_DIFF_TABLE = {
    easy: {
      engine: {
        SPAWN_INTERVAL: 1000,      // ms ระหว่างเป้าถัดไป (ช้าสุด เหมาะสำหรับ VR มือใหม่)
        ITEM_LIFETIME: 2300,       // ms เป้ายังอยู่บนจอ
        MAX_ACTIVE: 3,             // จำนวนเป้าบนจอพร้อมกัน
        MISSION_GOOD_TARGET: 15,   // จำนวนของดีที่ต้องคลิกให้ครบ
        SIZE_FACTOR: 1.25,         // ขนาดเป้าใหญ่ขึ้นสำหรับโหมดง่าย
        FEVER_DURATION: 5,         // วินาทีของโหมด FEVER
        DIAMOND_TIME_BONUS: 3,     // เวลาเพิ่มเมื่อเก็บ 💎
        TYPE_WEIGHTS: {            // น้ำหนักสุ่มชนิดเป้า (รวม ~100)
          good:   62,
          junk:   14,
          star:    8,
          gold:    6,
          diamond: 3,
          shield:  5,
          fever:   2,
          rainbow: 0
        }
      },
      benchmark: {
        targetAccuracyPct: 85,
        targetMissionSuccessPct: 90,
        expectedAvgRTms: 900,
        // ใช้สำหรับสอนครั้งแรก ๆ / เด็กที่ไม่คุ้น VR
        note: 'โหมดฝึกพื้นฐาน แยกของดี/ขยะ เหมาะใช้สอนครั้งแรก ๆ'
      }
    },
    normal: {
      engine: {
        SPAWN_INTERVAL: 650,
        ITEM_LIFETIME: 1500,
        MAX_ACTIVE: 4,
        MISSION_GOOD_TARGET: 20,
        SIZE_FACTOR: 1.0,
        FEVER_DURATION: 6,
        DIAMOND_TIME_BONUS: 2,
        TYPE_WEIGHTS: {
          good:   48,
          junk:   30,
          star:    7,
          gold:    6,
          diamond: 4,
          shield:  3,
          fever:   4,
          rainbow: 1
        }
      },
      benchmark: {
        targetAccuracyPct: 75,
        targetMissionSuccessPct: 70,
        expectedAvgRTms: 750,
        note: 'ระดับมาตรฐานสำหรับเก็บข้อมูลก่อน–หลังการสอน'
      }
    },
    hard: {
      engine: {
        SPAWN_INTERVAL: 480,
        ITEM_LIFETIME: 1050,
        MAX_ACTIVE: 6,
        MISSION_GOOD_TARGET: 26,
        SIZE_FACTOR: 0.9,          // เป้าเล็กลง ต้องโฟกัสมากขึ้น
        FEVER_DURATION: 7,
        DIAMOND_TIME_BONUS: 1,
        TYPE_WEIGHTS: {
          good:   34,
          junk:   42,
          star:    6,
          gold:    5,
          diamond: 5,
          shield:  3,
          fever:   7,
          rainbow: 3
        }
      },
      benchmark: {
        targetAccuracyPct: 60,
        targetMissionSuccessPct: 50,
        expectedAvgRTms: 700,
        note: 'ใช้แยกเด็กที่มีการควบคุมตนเองดี / สมาธิดี (executive function)'
      }
    }
  };

  // ---------- ผูกเข้ากับ Global Research Diff Table ----------
  // โครงสร้างรวม: window.HHA_DIFF_TABLE['goodjunk'] = LOCAL_DIFF_TABLE
  // ไม่เขียนทับถ้ามีของเดิมอยู่แล้ว (กันกรณี preload จากไฟล์อื่น)
  if (!window.HHA_DIFF_TABLE) {
    window.HHA_DIFF_TABLE = {};
  }
  if (!window.HHA_DIFF_TABLE[MODE_ID]) {
    window.HHA_DIFF_TABLE[MODE_ID] = LOCAL_DIFF_TABLE;
  }

  // ---------- Fallback engine config (ใช้เมื่อ diff ไม่ตรง) ----------
  const DEFAULT_ENGINE_CONFIG = {
    SPAWN_INTERVAL: 650,
    ITEM_LIFETIME: 1500,
    MAX_ACTIVE: 4,
    MISSION_GOOD_TARGET: 20,
    SIZE_FACTOR: 1.0,
    FEVER_DURATION: 6,
    DIAMOND_TIME_BONUS: 2,
    TYPE_WEIGHTS: {
      good:   48,
      junk:   30,
      star:    7,
      gold:    6,
      diamond: 4,
      shield:  3,
      fever:   4,
      rainbow: 1
    }
  };

  function normalizeDiffKey(diff) {
    if (!diff) return 'normal';
    const d = String(diff).toLowerCase();
    if (d === 'medium') return 'normal'; // กันกรณีส่ง medium มาจากเมนู
    if (LOCAL_DIFF_TABLE[d]) return d;
    return 'normal';
  }

  // ---------- config สำหรับ engine ----------
  function configForDiff(diff) {
    const key = normalizeDiffKey(diff);
    const cfg = LOCAL_DIFF_TABLE[key] && LOCAL_DIFF_TABLE[key].engine;
    // ป้องกัน null/undefined เผื่อมีการแก้ config ผิดในอนาคต
    return cfg ? cfg : DEFAULT_ENGINE_CONFIG;
  }

  // ---------- benchmark สำหรับงานวิจัย / UI สถิติ ----------
  function benchmarkForDiff(diff) {
    const key = normalizeDiffKey(diff);
    const info = LOCAL_DIFF_TABLE[key] && LOCAL_DIFF_TABLE[key].benchmark;
    return info || null;
  }

  // ---------- Emoji Pools ----------
  // NOTE: ตัว renderer/engine ควรใช้ font emoji ที่รองรับแล้ว (เช่น system-ui + emoji)
  const GOOD = [
    '🍎','🍓','🍇','🥦','🥕','🍅','🥬',
    '🍊','🍌','🫐','🍐','🍍','🍋','🍉','🥝',
    '🍚','🥛','🍞','🐟','🥗'
  ];
  const JUNK    = ['🍔','🍟','🍕','🍩','🍪','🧁','🥤','🧋','🥓','🍫','🌭'];
  const STAR    = ['⭐','🌟'];
  const GOLD    = ['🥇','🏅','🪙'];
  const DIAMOND = ['💎'];
  const SHIELD  = ['🛡️'];
  const FEVER   = ['🔥'];
  const RAINBOW = ['🌈'];
  const BOSS    = ['👾','🤖'];

  function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  // ---------- Register Mode ให้ main.js ใช้งาน ----------
  window.HH_MODES[MODE_ID] = {
    id: MODE_ID,
    label: 'Good vs Junk',

    // main.js เรียกตอนเริ่มเกม → ส่ง config ให้ engine
    setupForDiff: function (diff) {
      return configForDiff(diff);
    },

    // (option เสริม) ถ้าต้องการโชว์ target/benchmark ในหน้าจอสถิติ
    benchmarkForDiff: function (diff) {
      return benchmarkForDiff(diff);
    },

    // ใช้ใน HUD / overlay อธิบายภารกิจ (รองรับ VR: ข้อความสั้น อ่านง่าย)
    missionText: function (target) {
      return 'ภารกิจวันนี้: คลิกของดีให้ครบ ' +
        target +
        ' ชิ้น แล้วหลบอาหารขยะให้ได้มากที่สุด!';
    },

    // main.js เรียกทุกครั้งที่ spawn เป้าใหม่
    pickEmoji: function (type) {
      if (type === 'good')    return pickRandom(GOOD);
      if (type === 'junk')    return pickRandom(JUNK);
      if (type === 'star')    return pickRandom(STAR);
      if (type === 'gold')    return pickRandom(GOLD);
      if (type === 'diamond') return pickRandom(DIAMOND);
      if (type === 'shield')  return pickRandom(SHIELD);
      if (type === 'fever')   return pickRandom(FEVER);
      if (type === 'rainbow') return pickRandom(RAINBOW);
      if (type === 'boss')    return pickRandom(BOSS);
      return '❓';
    },

    // expose diff table ตรง ๆ เผื่อ analytics ภายนอกมาอ่านทีหลัง
    diffTable: LOCAL_DIFF_TABLE
  };
})();
