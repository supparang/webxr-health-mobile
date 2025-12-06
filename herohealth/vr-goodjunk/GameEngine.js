// ---------- ตั้งค่า difficulty ----------
  function applyDifficulty(diffKey) {
    const d = String(diffKey || 'normal').toLowerCase();
    let goalMin, goalMax, comboMin, comboMaxVal;

    if (d === 'easy') {
      SPAWN_INTERVAL  = 1100;
      TARGET_LIFETIME = 1100;
      MAX_ACTIVE      = 3;
      GOOD_RATE       = 0.72;
      SIZE_FACTOR     = 0.80;  // ง่าย: ยังใหญ่สุด แต่เล็กลงกว่ารอบที่แล้ว

      TYPE_WEIGHTS = {
        good:    75,
        junk:    15,
        star:     4,
        diamond:  3,
        shield:   3
      };

      goalMin = 14; goalMax = 18;
      comboMin = 3; comboMaxVal = 4;
    } else if (d === 'hard') {
      SPAWN_INTERVAL  = 750;
      TARGET_LIFETIME = 850;
      MAX_ACTIVE      = 5;
      GOOD_RATE       = 0.6;
      SIZE_FACTOR     = 0.50;  // ยาก: เล็กมากแล้ว เหมือน target จุดเล็ก ๆ

      TYPE_WEIGHTS = {
        good:    65,
        junk:    22,
        star:     5,
        diamond:  4,
        shield:   4
      };

      goalMin = 22; goalMax = 28;
      comboMin = 6; comboMaxVal = 8;
    } else { // normal
      SPAWN_INTERVAL  = 900;
      TARGET_LIFETIME = 900;
      MAX_ACTIVE      = 4;
      GOOD_RATE       = 0.66;
      SIZE_FACTOR     = 0.65;  // ปกติ: กลาง ๆ ระหว่าง easy / hard แต่เล็กลงอีกรอบ

      TYPE_WEIGHTS = {
        good:    70,
        junk:    18,
        star:     4,
        diamond:  4,
        shield:   4
      };

      goalMin = 18; goalMax = 22;
      comboMin = 4; comboMaxVal = 6;
    }

    const goalTarget = randInt(goalMin, goalMax);
    miniComboNeed = randInt(comboMin, comboMaxVal);

    GOAL.target = goalTarget;
    GOAL.label  = `เก็บอาหารดีให้ครบ ${goalTarget} ชิ้น`;
    GOAL.prog   = 0;
    GOAL.done   = false;

    MINI.target = 1;
    MINI.prog   = 0;
    MINI.done   = false;
    MINI.label  = `รักษาคอมโบให้ถึง x${miniComboNeed} อย่างน้อย 1 ครั้ง`;
  }