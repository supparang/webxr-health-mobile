// === /herohealth/hydration-vr/hydration.quest.js ===
// Mission Deck สำหรับโหมด Hydration VR
// - สุ่ม Goal 2 ภารกิจจาก pool ~10 ใบต่อเกม
// - สุ่ม Mini quest 3 ภารกิจจาก pool ~15 ใบต่อเกม
// - รองรับ diff: easy / normal / hard

'use strict';

/**
 * สุ่มเลือก n รายการแบบไม่ซ้ำจากอาร์เรย์ src
 */
function pickMany(src, n) {
  const arr = [...src];
  const out = [];
  while (arr.length && out.length < n) {
    const idx = Math.floor(Math.random() * arr.length);
    out.push(arr.splice(idx, 1)[0]);
  }
  return out;
}

/**
 * สร้างอ็อบเจกต์ภารกิจจาก template
 */
function makeCard(tpl, tier, kind) {
  return {
    id: tpl.id,
    label: tpl.label,
    kind,          // 'goal' / 'mini'
    tier,          // easy / normal / hard
    metric: tpl.metric,   // ใช้คีย์อะไรใน stats
    mode: tpl.mode || 'gte', // เปรียบเทียบแบบไหน
    target: tpl.target,
    prog: 0,
    done: false
  };
}

/**
 * อัปเดต progress ของการ์ดจาก stats ปัจจุบัน
 */
function updateCardProgress(card, stats) {
  const v = stats[card.metric] || 0;
  card.prog = Math.min(card.target, Math.max(0, Math.round(v)));

  switch (card.mode) {
    case 'lte': // ค่าน้อยกว่าหรือเท่ากับเป้าถือว่าผ่าน (เช่น miss ไม่เกิน 6)
      card.done = v <= card.target;
      break;
    case 'rangeGreen': // โซนน้ำ GREEN อย่างน้อย target วินาที
      card.prog = Math.min(card.target, stats.greenTick || 0);
      card.done = (stats.greenTick || 0) >= card.target;
      break;
    default: // gte
      card.done = v >= card.target;
  }
}

// ---------- Template ภารกิจ ----------

// metric ที่ใช้ใน stats มี:
// score, comboMax, missHits, goodHits, junkHits, greenTick, timeSec

const GOAL_TEMPLATES = {
  easy: [
    { id: 'g_e_score_800',      label: 'ทำคะแนนให้ได้อย่างน้อย 800 คะแนน',        metric: 'score',     target: 800 },
    { id: 'g_e_score_1200',     label: 'ทำคะแนนให้ได้อย่างน้อย 1,200 คะแนน',       metric: 'score',     target: 1200 },
    { id: 'g_e_good_12',        label: 'เก็บน้ำดีให้ครบ 12 ครั้ง',                  metric: 'goodHits', target: 12 },
    { id: 'g_e_good_16',        label: 'เก็บน้ำดีให้ครบ 16 ครั้ง',                  metric: 'goodHits', target: 16 },
    { id: 'g_e_combo_4',        label: 'ดันคอมโบให้ถึงอย่างน้อย x4 สัก 1 ครั้ง',   metric: 'comboMax', target: 4 },
    { id: 'g_e_green_20',       label: 'รักษาโซน GREEN รวมอย่างน้อย 20 วินาที',    metric: 'greenTick', target: 20, mode: 'rangeGreen' },
    { id: 'g_e_green_30',       label: 'รักษาโซน GREEN รวมอย่างน้อย 30 วินาที',    metric: 'greenTick', target: 30, mode: 'rangeGreen' },
    { id: 'g_e_miss_leq_8',     label: 'ทั้งเกมพลาดไม่เกิน 8 ครั้ง',                metric: 'missHits', target: 8,  mode: 'lte' },
    { id: 'g_e_miss_leq_6',     label: 'ทั้งเกมพลาดไม่เกิน 6 ครั้ง',                metric: 'missHits', target: 6,  mode: 'lte' },
    { id: 'g_e_time_40',        label: 'เล่นให้นานอย่างน้อย 40 วินาทีในโหมดนี้',   metric: 'timeSec',  target: 40 }
  ],
  normal: [
    { id: 'g_n_score_1600',     label: 'ทำคะแนนให้ได้อย่างน้อย 1,600 คะแนน',       metric: 'score',     target: 1600 },
    { id: 'g_n_score_2200',     label: 'ทำคะแนนให้ได้อย่างน้อย 2,200 คะแนน',       metric: 'score',     target: 2200 },
    { id: 'g_n_good_18',        label: 'เก็บน้ำดีให้ครบ 18 ครั้ง',                  metric: 'goodHits', target: 18 },
    { id: 'g_n_good_22',        label: 'เก็บน้ำดีให้ครบ 22 ครั้ง',                  metric: 'goodHits', target: 22 },
    { id: 'g_n_combo_6',        label: 'ดันคอมโบให้ถึงอย่างน้อย x6 สัก 1 ครั้ง',   metric: 'comboMax', target: 6 },
    { id: 'g_n_green_35',       label: 'รักษาโซน GREEN รวมอย่างน้อย 35 วินาที',    metric: 'greenTick', target: 35, mode: 'rangeGreen' },
    { id: 'g_n_green_45',       label: 'รักษาโซน GREEN รวมอย่างน้อย 45 วินาที',    metric: 'greenTick', target: 45, mode: 'rangeGreen' },
    { id: 'g_n_miss_leq_6',     label: 'ทั้งเกมพลาดไม่เกิน 6 ครั้ง',                metric: 'missHits', target: 6,  mode: 'lte' },
    { id: 'g_n_miss_leq_5',     label: 'ทั้งเกมพลาดไม่เกิน 5 ครั้ง',                metric: 'missHits', target: 5,  mode: 'lte' },
    { id: 'g_n_time_60',        label: 'เล่นให้นานอย่างน้อย 60 วินาทีในโหมดนี้',   metric: 'timeSec',  target: 60 }
  ],
  hard: [
    { id: 'g_h_score_2200',     label: 'ทำคะแนนให้ได้อย่างน้อย 2,200 คะแนน',       metric: 'score',     target: 2200 },
    { id: 'g_h_score_2800',     label: 'ทำคะแนนให้ได้อย่างน้อย 2,800 คะแนน',       metric: 'score',     target: 2800 },
    { id: 'g_h_good_22',        label: 'เก็บน้ำดีให้ครบ 22 ครั้ง',                  metric: 'goodHits', target: 22 },
    { id: 'g_h_good_26',        label: 'เก็บน้ำดีให้ครบ 26 ครั้ง',                  metric: 'goodHits', target: 26 },
    { id: 'g_h_combo_8',        label: 'ดันคอมโบให้ถึงอย่างน้อย x8 สัก 1 ครั้ง',   metric: 'comboMax', target: 8 },
    { id: 'g_h_green_45',       label: 'รักษาโซน GREEN รวมอย่างน้อย 45 วินาที',    metric: 'greenTick', target: 45, mode: 'rangeGreen' },
    { id: 'g_h_green_55',       label: 'รักษาโซน GREEN รวมอย่างน้อย 55 วินาที',    metric: 'greenTick', target: 55, mode: 'rangeGreen' },
    { id: 'g_h_miss_leq_5',     label: 'ทั้งเกมพลาดไม่เกิน 5 ครั้ง',                metric: 'missHits', target: 5,  mode: 'lte' },
    { id: 'g_h_miss_leq_4',     label: 'ทั้งเกมพลาดไม่เกิน 4 ครั้ง',                metric: 'missHits', target: 4,  mode: 'lte' },
    { id: 'g_h_time_80',        label: 'เล่นให้นานอย่างน้อย 80 วินาทีในโหมดนี้',   metric: 'timeSec',  target: 80 }
  ]
};

const MINI_TEMPLATES = {
  easy: [
    { id: 'm_e_combo_3',        label: 'ทำคอมโบให้ถึง x3 อย่างน้อย 1 ครั้ง',       metric: 'comboMax', target: 3 },
    { id: 'm_e_combo_4',        label: 'ทำคอมโบให้ถึง x4 อย่างน้อย 1 ครั้ง',       metric: 'comboMax', target: 4 },
    { id: 'm_e_good_8',         label: 'เก็บน้ำดีให้ครบ 8 ครั้ง',                    metric: 'goodHits', target: 8 },
    { id: 'm_e_good_12',        label: 'เก็บน้ำดีให้ครบ 12 ครั้ง',                   metric: 'goodHits', target: 12 },
    { id: 'm_e_green_15',       label: 'รักษาโซน GREEN รวมอย่างน้อย 15 วินาที',     metric: 'greenTick', target: 15, mode: 'rangeGreen' },
    { id: 'm_e_green_20',       label: 'รักษาโซน GREEN รวมอย่างน้อย 20 วินาที',     metric: 'greenTick', target: 20, mode: 'rangeGreen' },
    { id: 'm_e_miss_leq_6',     label: 'ทั้งเกมพลาดไม่เกิน 6 ครั้ง',                metric: 'missHits', target: 6,  mode: 'lte' },
    { id: 'm_e_miss_leq_7',     label: 'ทั้งเกมพลาดไม่เกิน 7 ครั้ง',                metric: 'missHits', target: 7,  mode: 'lte' },
    { id: 'm_e_time_30',        label: 'เล่นโหมดนี้ให้นานอย่างน้อย 30 วินาที',      metric: 'timeSec',  target: 30 },
    { id: 'm_e_junk_leq_6',     label: 'โดนน้ำหวาน/คาเฟอีนไม่เกิน 6 แก้ว',        metric: 'junkHits', target: 6,  mode: 'lte' },
    { id: 'm_e_junk_leq_8',     label: 'โดนน้ำหวาน/คาเฟอีนไม่เกิน 8 แก้ว',        metric: 'junkHits', target: 8,  mode: 'lte' },
    { id: 'm_e_score_700',      label: 'เก็บคะแนนอย่างน้อย 700 คะแนน',             metric: 'score',     target: 700 },
    { id: 'm_e_score_900',      label: 'เก็บคะแนนอย่างน้อย 900 คะแนน',             metric: 'score',     target: 900 },
    { id: 'm_e_good_more_junk', label: 'เก็บน้ำดีมากกว่าน้ำหวานตลอดทั้งเกม',       metric: 'goodMinusJunk', target: 1 }
  ],
  normal: [
    { id: 'm_n_combo_4',        label: 'ทำคอมโบให้ถึง x4 อย่างน้อย 1 ครั้ง',       metric: 'comboMax', target: 4 },
    { id: 'm_n_combo_6',        label: 'ทำคอมโบให้ถึง x6 อย่างน้อย 1 ครั้ง',       metric: 'comboMax', target: 6 },
    { id: 'm_n_good_14',        label: 'เก็บน้ำดีให้ครบ 14 ครั้ง',                   metric: 'goodHits', target: 14 },
    { id: 'm_n_good_18',        label: 'เก็บน้ำดีให้ครบ 18 ครั้ง',                   metric: 'goodHits', target: 18 },
    { id: 'm_n_green_25',       label: 'รักษาโซน GREEN รวมอย่างน้อย 25 วินาที',     metric: 'greenTick', target: 25, mode: 'rangeGreen' },
    { id: 'm_n_green_30',       label: 'รักษาโซน GREEN รวมอย่างน้อย 30 วินาที',     metric: 'greenTick', target: 30, mode: 'rangeGreen' },
    { id: 'm_n_miss_leq_6',     label: 'ทั้งเกมพลาดไม่เกิน 6 ครั้ง',                metric: 'missHits', target: 6,  mode: 'lte' },
    { id: 'm_n_miss_leq_5',     label: 'ทั้งเกมพลาดไม่เกิน 5 ครั้ง',                metric: 'missHits', target: 5,  mode: 'lte' },
    { id: 'm_n_time_45',        label: 'เล่นโหมดนี้ให้นานอย่างน้อย 45 วินาที',      metric: 'timeSec',  target: 45 },
    { id: 'm_n_junk_leq_6',     label: 'โดนน้ำหวาน/คาเฟอีนไม่เกิน 6 แก้ว',        metric: 'junkHits', target: 6,  mode: 'lte' },
    { id: 'm_n_junk_leq_5',     label: 'โดนน้ำหวาน/คาเฟอีนไม่เกิน 5 แก้ว',        metric: 'junkHits', target: 5,  mode: 'lte' },
    { id: 'm_n_score_1200',     label: 'เก็บคะแนนอย่างน้อย 1,200 คะแนน',           metric: 'score',     target: 1200 },
    { id: 'm_n_score_1500',     label: 'เก็บคะแนนอย่างน้อย 1,500 คะแนน',           metric: 'score',     target: 1500 },
    { id: 'm_n_good_more_junk', label: 'เก็บน้ำดีอย่างน้อย 10 แก้ว มากกว่าน้ำหวาน', metric: 'goodMinusJunk', target: 3 }
  ],
  hard: [
    { id: 'm_h_combo_6',        label: 'ทำคอมโบให้ถึง x6 อย่างน้อย 1 ครั้ง',       metric: 'comboMax', target: 6 },
    { id: 'm_h_combo_8',        label: 'ทำคอมโบให้ถึง x8 อย่างน้อย 1 ครั้ง',       metric: 'comboMax', target: 8 },
    { id: 'm_h_good_18',        label: 'เก็บน้ำดีให้ครบ 18 ครั้ง',                   metric: 'goodHits', target: 18 },
    { id: 'm_h_good_22',        label: 'เก็บน้ำดีให้ครบ 22 ครั้ง',                   metric: 'goodHits', target: 22 },
    { id: 'm_h_green_35',       label: 'รักษาโซน GREEN รวมอย่างน้อย 35 วินาที',     metric: 'greenTick', target: 35, mode: 'rangeGreen' },
    { id: 'm_h_green_40',       label: 'รักษาโซน GREEN รวมอย่างน้อย 40 วินาที',     metric: 'greenTick', target: 40, mode: 'rangeGreen' },
    { id: 'm_h_miss_leq_5',     label: 'ทั้งเกมพลาดไม่เกิน 5 ครั้ง',                metric: 'missHits', target: 5,  mode: 'lte' },
    { id: 'm_h_miss_leq_4',     label: 'ทั้งเกมพลาดไม่เกิน 4 ครั้ง',                metric: 'missHits', target: 4,  mode: 'lte' },
    { id: 'm_h_time_60',        label: 'เล่นโหมดนี้ให้นานอย่างน้อย 60 วินาที',      metric: 'timeSec',  target: 60 },
    { id: 'm_h_junk_leq_4',     label: 'โดนน้ำหวาน/คาเฟอีนไม่เกิน 4 แก้ว',        metric: 'junkHits', target: 4,  mode: 'lte' },
    { id: 'm_h_junk_leq_3',     label: 'โดนน้ำหวาน/คาเฟอีนไม่เกิน 3 แก้ว',        metric: 'junkHits', target: 3,  mode: 'lte' },
    { id: 'm_h_score_1600',     label: 'เก็บคะแนนอย่างน้อย 1,600 คะแนน',           metric: 'score',     target: 1600 },
    { id: 'm_h_score_2000',     label: 'เก็บคะแนนอย่างน้อย 2,000 คะแนน',           metric: 'score',     target: 2000 },
    { id: 'm_h_good_more_junk', label: 'เก็บน้ำดีอย่างน้อย 15 แก้ว มากกว่าน้ำหวาน', metric: 'goodMinusJunk', target: 5 }
  ]
};

/**
 * สร้าง Deck สำหรับโหมด Hydration ตาม diff
 */
export function createHydrationQuest(diff = 'normal') {
  const tier = (diff === 'easy' || diff === 'hard') ? diff : 'normal';

  const stats = {
    score: 0,
    combo: 0,
    comboMax: 0,
    missHits: 0,
    goodHits: 0,
    junkHits: 0,
    goodMinusJunk: 0,
    greenTick: 0,
    timeSec: 0,
    zone: 'GREEN'
  };

  let goals = [];
  let minis = [];

  function refreshAll() {
    goals.forEach((g) => updateCardProgress(g, stats));
    minis.forEach((m) => updateCardProgress(m, stats));
  }

  return {
    stats,

    // --- เรียกจาก hydration.safe.js ---
    updateScore(v) {
      stats.score = Number(v) || 0;
      refreshAll();
    },

    updateCombo(v) {
      stats.combo = Number(v) || 0;
      if (stats.combo > stats.comboMax) stats.comboMax = stats.combo;
      refreshAll();
    },

    onGood() {
      stats.goodHits += 1;
      stats.goodMinusJunk = stats.goodHits - stats.junkHits;
      refreshAll();
    },

    onJunk() {
      stats.junkHits += 1;
      stats.missHits += 1; // ใช้เป็น miss หลักของภารกิจ
      stats.goodMinusJunk = stats.goodHits - stats.junkHits;
      refreshAll();
    },

    second() {
      stats.timeSec += 1;
      // greenTick และ zone ถูกอัปเดตจาก hydration.safe.js โดยตรงใน stats
      refreshAll();
    },

    // hydration.safe.js จะอัปเดต zone + greenTick ให้โดยตรง
    // (เช่น deck.stats.greenTick++, deck.stats.zone = ...)

    drawGoals(count) {
      const src = GOAL_TEMPLATES[tier] || GOAL_TEMPLATES.normal;
      const picked = pickMany(src, count || 2);
      goals = picked.map((tpl) => makeCard(tpl, tier, 'goal'));
      refreshAll();
    },

    draw3() {
      const src = MINI_TEMPLATES[tier] || MINI_TEMPLATES.normal;
      const picked = pickMany(src, 3);
      minis = picked.map((tpl) => makeCard(tpl, tier, 'mini'));
      refreshAll();
    },

    getProgress(kind) {
      if (kind === 'goals' || kind === 'goal') return goals;
      if (kind === 'mini' || kind === 'minis') return minis;
      return [];
    }
  };
}

export default { createHydrationQuest };
