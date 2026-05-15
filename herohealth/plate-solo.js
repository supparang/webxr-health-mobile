// === PATCH: /herohealth/plate-solo.js ===
// v20260514-PLATE-SOLO-ZONEFIX2-DOMSYNC-MINIFAIR-PORTIONPATCH
// ✅ แก้สมดุลด้านบนค้าง 0%
// ✅ แก้ portion target ไม่ให้ทุกหมู่เต็มเร็วเท่ากัน
// ✅ แก้ Mini Event ให้ยุติธรรมขึ้น ไม่ fail ง่ายเกิน
// ✅ แก้ Cooldown ให้กลับ Nutrition Zone แน่นอน
// ✅ กัน howBanner typo ถ้ามีหลุดมาจาก patch ก่อนหน้า

var howBanner = function(txt){
  try {
    if (typeof showBanner === 'function') showBanner(txt);
  } catch(e) {}
};

(function installPlateSoloFinalPatch(){
  'use strict';

  const PATCH_VERSION = '20260514-PLATE-SOLO-ZONEFIX2-DOMSYNC-MINIFAIR-PORTIONPATCH';

  try {
    VERSION = PATCH_VERSION;
    if (HHA) HHA.version = PATCH_VERSION;
    console.info('[Plate Solo Patch]', PATCH_VERSION, 'installed');
  } catch(e) {}

  const PATCH_GROUP_TARGETS = {
    protein: 3.6,
    carb: 3.8,
    veg: 5.2,
    fruit: 4.4,
    fat: 2.6
  };

  const PATCH_GROUP_PORTION_SCALE = {
    protein: .72,
    carb: .72,
    veg: .55,
    fruit: .62,
    fat: .48
  };

  function targetOf(g){
    try {
      return Number(PATCH_GROUP_TARGETS[g] || CFG.target || 4);
    } catch(e) {
      return 4;
    }
  }

  function limitOf(g){
    return targetOf(g) + .75;
  }

  function portionOf(g, v){
    return Number(v || 0) * Number(PATCH_GROUP_PORTION_SCALE[g] || .65);
  }

  function setTextAll(selectors, value){
    try {
      selectors.forEach(sel => {
        DOC.querySelectorAll(sel).forEach(el => {
          if (el) el.textContent = value;
        });
      });
    } catch(e) {}
  }

  function setWidthAll(selectors, value){
    try {
      selectors.forEach(sel => {
        DOC.querySelectorAll(sel).forEach(el => {
          if (el && el.style) el.style.width = value;
        });
      });
    } catch(e) {}
  }

  balanceScore = function(){
    const vals = GROUPS.map(g => {
      const target = targetOf(g.id);
      const f = state.fill[g.id] || 0;

      return f <= target
        ? (f / target) * 100
        : Math.max(0, 100 - (f - target) * 42);
    });

    return Math.round(vals.reduce((a,b) => a + b, 0) / vals.length);
  };

  mostMissingGroup = function(){
    return GROUPS
      .map(g => ({
        ...g,
        need:targetOf(g.id) - (state.fill[g.id] || 0)
      }))
      .sort((a,b) => b.need - a.need)[0] || GROUPS[0];
  };

  mostOverGroup = function(){
    return GROUPS
      .map(g => ({
        ...g,
        over:(state.fill[g.id] || 0) - targetOf(g.id)
      }))
      .sort((a,b) => b.over - a.over)[0] || GROUPS[0];
  };

  wouldOverload = function(food){
    return !!(
      food &&
      food.effects &&
      Object.entries(food.effects).some(([g,v]) =>
        (state.fill[g] || 0) + portionOf(g,v) > targetOf(g) + .20
      )
    );
  };

  applyEffects = function(effects){
    Object.entries(effects || {}).forEach(([g,v]) => {
      if (g in state.fill) {
        state.fill[g] = clamp(
          (state.fill[g] || 0) + portionOf(g,v),
          0,
          limitOf(g)
        );
      }
    });
  };

  renderMeters = function(){
    resolvePlateEls();

    if (!els.meters) {
      console.warn('[Plate Solo] renderMeters skipped: #meters not found');
      return;
    }

    els.meters.innerHTML = GROUPS.map(g => {
      const target = targetOf(g.id);

      return `
        <div id="bar-${g.id}" class="meter-row food-meter" data-group="${g.id}">
          <div class="meter-head">
            <span class="meter-name">${g.icon} ${esc(g.label)}</span>
            <span id="gmv-${g.id}" class="meter-value">0.0/${target.toFixed(1)}</span>
          </div>
          <div class="meter-track">
            <i id="bari-${g.id}" class="meter-fill"></i>
          </div>
          <div id="need-${g.id}" class="meter-need">
            ยังขาด ${target.toFixed(1)}
          </div>
        </div>
      `;
    }).join('');

    setTextAll([
      '#balance',
      '#balanceText',
      '.balanceText',
      '.balanceValue',
      '[data-stat="balance"]'
    ], '0%');

    setWidthAll([
      '#balanceFill',
      '#balanceBar',
      '.balanceFill',
      '.balanceBar',
      '[data-stat-fill="balance"]'
    ], '0%');
  };

  updateMeters = function(){
    GROUPS.forEach(g => {
      const target = targetOf(g.id);
      const v = state.fill[g.id] || 0;
      const pct = clamp((v / target) * 100, 0, 145);

      const bar = byId('bar-' + g.id);
      const fill = byId('bari-' + g.id);
      const label = byId('gmv-' + g.id);
      const need = byId('need-' + g.id);

      if (!bar || !fill || !label || !need) return;

      fill.style.width = Math.min(pct,100) + '%';

      bar.classList.toggle('over', v > target + .20);
      bar.classList.toggle('warn', v >= target * .82 && v <= target + .20);

      label.textContent = `${v.toFixed(1)}/${target.toFixed(1)}`;

      need.textContent =
        v > target + .20
          ? 'ล้นแล้ว! อย่าเติมเพิ่ม'
          : (
              v >= target * .82
                ? 'พอดีแล้ว'
                : `ยังขาด ${(target - v).toFixed(1)}`
            );
    });

    const bal = balanceScore();

    setTextAll([
      '#balance',
      '#balanceText',
      '.balanceText',
      '.balanceValue',
      '[data-stat="balance"]'
    ], bal + '%');

    setWidthAll([
      '#balanceFill',
      '#balanceBar',
      '.balanceFill',
      '.balanceBar',
      '[data-stat-fill="balance"]'
    ], bal + '%');
  };

  function syncHudStats(){
    const bal = balanceScore();
    const left = state.practiceActive
      ? Math.ceil(practiceLeftSec())
      : Math.ceil(timeLeft());

    setTextAll([
      '#score',
      '#scoreText',
      '.scoreText',
      '[data-stat="score"]'
    ], Math.round(state.score));

    setTextAll([
      '#combo',
      '#comboText',
      '.comboText',
      '[data-stat="combo"]'
    ], state.combo);

    setTextAll([
      '#balance',
      '#balanceText',
      '.balanceText',
      '.balanceValue',
      '[data-stat="balance"]'
    ], bal + '%');

    setTextAll([
      '#timeText',
      '#timerText',
      '.timeText',
      '.timerText',
      '[data-stat="time"]'
    ], left);

    setTextAll(['#miniScore'], Math.round(state.score));
    setTextAll(['#miniCombo'], state.combo);
    setTextAll(['#miniBalance'], bal + '%');
    setTextAll(['#miniTime'], left + 's');

    setWidthAll([
      '#balanceFill',
      '#balanceBar',
      '.balanceFill',
      '.balanceBar',
      '[data-stat-fill="balance"]'
    ], bal + '%');
  }

  chooseFood = function(){
    if (state.practiceActive) return choosePracticeFood();

    const m = mostMissingGroup();

    if (state.mini && state.mini.type === 'healthyRain' && chance(.82)) {
      const pool = FOODS.filter(f =>
        !f.junk &&
        f.effects &&
        (
          f.effects[m.id] ||
          GROUPS.some(g =>
            state.fill[g.id] < targetOf(g.id) * .82 &&
            f.effects[g.id]
          )
        ) &&
        !wouldOverload(f)
      );

      if (pool.length) {
        return { ...pick(pool) };
      }
    }

    if (state.mini && state.mini.type === 'missingAlert' && chance(.72)) {
      const g = state.mini.group || m.id;

      const pool = FOODS.filter(f =>
        !f.junk &&
        f.effects &&
        f.effects[g] &&
        !wouldOverload(f)
      );

      if (pool.length) {
        return { ...pick(pool) };
      }
    }

    if (chance(.075) && !state.boss && !state.mini && !state.lastSaveActive) {
      return { ...pick(POWERS) };
    }

    let jr =
      CFG.junk +
      (state.wave - 1) * .035 +
      (state.rush ? .06 : 0) +
      (state.boss ? .08 : 0) +
      (state.directorLevel * .025 - state.assistLevel * .035);

    if (state.mini && state.mini.type === 'junkInvasion') jr += .42;
    if (state.lastSaveActive) jr += .12;

    if (chance(clamp(jr, .08, .72))) {
      return { ...pick(FOODS.filter(f => f.junk)) };
    }

    const missingIds = GROUPS
      .filter(g => state.fill[g.id] < targetOf(g.id) * .82)
      .map(g => g.id);

    if (missingIds.length && chance(.64)) {
      const g = pick(missingIds);

      const pool = FOODS.filter(f =>
        !f.junk &&
        f.effects &&
        f.effects[g] &&
        !wouldOverload(f)
      );

      if (pool.length) {
        return { ...pick(pool) };
      }
    }

    const safeHealthy = FOODS.filter(f =>
      !f.junk &&
      f.effects &&
      !wouldOverload(f)
    );

    if (safeHealthy.length) {
      return { ...pick(safeHealthy) };
    }

    if (chance(.40)) {
      return { ...pick(POWERS) };
    }

    return { ...pick(FOODS.filter(f => f.junk)) };
  };

  startMiniEvent = function(){
    state.lastMiniAt = now();

    const m = mostMissingGroup();

    const pool = [
      {
        type:'healthyRain',
        icon:'🌧️',
        title:'Healthy Rain',
        text:'อาหารดีตกเร็วขึ้น! เลือกให้ถูก 3 ครั้ง',
        sec:10,
        target:3
      },
      {
        type:'junkInvasion',
        icon:'🚨',
        title:'Junk Invasion',
        text:'ของหลอกบุก! รอดโดยไม่เลือก junk',
        sec:8,
        target:0
      },
      {
        type:'missingAlert',
        icon:'🔎',
        title:'Missing Group Alert',
        text:`รีบเติม ${m.icon} ${m.label} 2 ครั้ง`,
        sec:10,
        target:2,
        group:m.id
      }
    ];

    state.mini = pick(pool);
    state.miniExpire = now() + state.mini.sec * 1000;
    state.miniStats = {
      hits:0,
      junk:0,
      groupHits:0
    };

    if (els.miniEventBox) els.miniEventBox.classList.add('on');
    if (els.miniEventText) els.miniEventText.textContent = `${state.mini.icon} ${state.mini.text}`;
    if (els.miniEventSec) els.miniEventSec.textContent = state.mini.sec + 's';
    if (els.miniEventFill) els.miniEventFill.style.width = '100%';

    showBanner(`${state.mini.icon} ${state.mini.title}!`);
    sfx('fever');
    logLine(`Mini Event: ${state.mini.title}`);

    try {
      if (state.mini.type === 'healthyRain') {
        const safe = FOODS.filter(f =>
          !f.junk &&
          f.effects &&
          !wouldOverload(f)
        );

        for (let i = 0; i < 2; i++) {
          setTimeout(() => {
            if (
              state.running &&
              !state.ended &&
              state.mini &&
              state.mini.type === 'healthyRain'
            ) {
              spawnFood({
                ...pick(safe.length ? safe : FOODS.filter(f => !f.junk))
              });
            }
          }, 180 + i * 420);
        }
      }

      if (state.mini.type === 'missingAlert') {
        const g = state.mini.group || mostMissingGroup().id;

        const pool2 = FOODS.filter(f =>
          !f.junk &&
          f.effects &&
          f.effects[g] &&
          !wouldOverload(f)
        );

        for (let i = 0; i < 2; i++) {
          setTimeout(() => {
            if (
              state.running &&
              !state.ended &&
              state.mini &&
              state.mini.type === 'missingAlert'
            ) {
              spawnFood({
                ...pick(pool2.length ? pool2 : FOODS.filter(f => !f.junk))
              });
            }
          }, 180 + i * 480);
        }
      }
    } catch(e) {}
  };

  updatePracticeCoach = function(){
    const left = practiceLeftSec();

    let ph = 0;

    if (left <= PRACTICE_SEC * .66) ph = 1;
    if (left <= PRACTICE_SEC * .33) ph = 2;

    state.practicePhase = ph;

    const data = [
      {
        icon:'✅',
        title:'Practice 1/3',
        text:'เลือกอาหารที่มีป้าย “ควรเก็บ” เพื่อเติมหมู่ที่จานยังขาด'
      },
      {
        icon:'⚠️',
        title:'Practice 2/3',
        text:'ถ้าเห็นป้าย “ล้น!” ให้ระวัง อาหารดีแต่หมู่นั้นเต็มแล้ว'
      },
      {
        icon:'🚫',
        title:'Practice 3/3',
        text:'หลบ Junk เช่น ของทอด ของหวาน น้ำหวาน แล้วเก็บของดีให้ทัน'
      }
    ][ph];

    if (els.practiceIcon) els.practiceIcon.textContent = data.icon;
    if (els.practiceTitle) els.practiceTitle.textContent = data.title;
    if (els.practiceText) els.practiceText.textContent = data.text;
    if (els.practiceSec) els.practiceSec.textContent = Math.ceil(left) + 's';
    if (els.practiceFill) els.practiceFill.style.width = clamp(left/PRACTICE_SEC*100,0,100) + '%';

    if (ph === 1) {
      state.fill.carb = Math.max(state.fill.carb, targetOf('carb'));
    }
  };

  rescueSkill = function(){
    if (!state.running || state.paused || state.ended || state.rescueUsed) return;

    state.rescueUsed = true;

    if (els.btnSkill) els.btnSkill.disabled = true;

    state.freezeUntil = now() + 2500;
    state.shield = Math.max(state.shield,1);

    const m = mostMissingGroup();

    state.fill[m.id] = Math.min(
      targetOf(m.id) * .7,
      (state.fill[m.id] || 0) + .55
    );

    addScore(30, 'Rescue +30', 'power');
    healPlate(18, 'Rescue Skill');

    feedback('✨ Rescue! Freeze + Shield + เติมหมู่ที่ขาด', 'perfect');
    sfx('fever');
    logLine('ใช้ Rescue Skill แล้ว');

    updateAll();
  };

  updateAll = function(){
    resolvePlateEls();

    const left = state.practiceActive
      ? Math.ceil(practiceLeftSec())
      : Math.ceil(timeLeft());

    const total = state.practiceActive ? PRACTICE_SEC : state.totalSec;

    syncHudStats();

    if (els.timerFill) {
      setWidthSafe(els.timerFill, clamp(left / total * 100, 0, 100) + '%');
      toggleSafe(els.timerFill, 'danger', left <= 15);
    }

    const phaseName = state.boss
      ? (
          state.bossDefeated
            ? 'Boss defeated • รักษาจานให้จบสวย'
            : 'Boss Plate • ทำถูกเพื่อลด HP'
        )
      : state.rush
        ? 'Rush Window • คะแนน x2'
        : `Wave ${state.wave || 1} • ${DIFF}`;

    setTextSafe(
      els.phaseText,
      state.practiceActive
        ? '🧑‍🍳 Practice Mode • ลองก่อน คะแนนยังไม่คิดจริง'
        : isFever()
          ? '🔥 FEVER MODE • คะแนน x2'
          : phaseName
    );

    updateMeters();
    renderPlate();
    updatePowers();
    updateBoss();
    renderMissions();
    updatePlateHealthUI();
  };

  goCooldown = function(){
    flushLogs(true);

    const gate = new URL(
      'https://supparang.github.io/webxr-health-mobile/herohealth/warmup-gate.html',
      location.href
    );

    const zoneUrl = new URL(
      'https://supparang.github.io/webxr-health-mobile/herohealth/nutrition-zone.html',
      location.href
    );

    preserveParams(zoneUrl, [
      'pid',
      'name',
      'nick',
      'diff',
      'time',
      'view',
      'run',
      'seed',
      'studyId',
      'conditionGroup',
      'section',
      'session_code',
      'log',
      'api'
    ]);

    zoneUrl.searchParams.set('pid', qs('pid','anon'));

    const nm = qs('name', qs('nick',''));
    if (nm) zoneUrl.searchParams.set('name', nm);

    zoneUrl.searchParams.set('diff', qs('diff','normal'));
    zoneUrl.searchParams.set('time', qs('time','120'));
    zoneUrl.searchParams.set('view', qs('view','mobile'));
    zoneUrl.searchParams.set('run', qs('run','play'));
    zoneUrl.searchParams.set('zone','nutrition');
    zoneUrl.searchParams.set('from','plate-solo-cooldown');

    zoneUrl.searchParams.set(
      'hub',
      qs(
        'rootHub',
        'https://supparang.github.io/webxr-health-mobile/herohealth/hub.html'
      )
    );

    preserveParams(gate, [
      'pid',
      'name',
      'nick',
      'diff',
      'time',
      'view',
      'run',
      'seed',
      'studyId',
      'conditionGroup',
      'section',
      'session_code',
      'log',
      'api'
    ]);

    gate.searchParams.set('pid', qs('pid','anon'));

    if (nm) gate.searchParams.set('name', nm);

    gate.searchParams.set('diff', qs('diff','normal'));
    gate.searchParams.set('time', qs('time','120'));
    gate.searchParams.set('view', qs('view','mobile'));
    gate.searchParams.set('run', qs('run','play'));

    gate.searchParams.set('phase','cooldown');
    gate.searchParams.set('zone','nutrition');
    gate.searchParams.set('game','plate');
    gate.searchParams.set('gameId','plate');
    gate.searchParams.set('mode','solo');
    gate.searchParams.set('entry','plate-solo');
    gate.searchParams.set('from','plate-solo-summary');

    // สำคัญ: หลัง cooldown จบ ต้องกลับ Nutrition Zone
    gate.searchParams.set('hub', zoneUrl.toString());
    gate.searchParams.set('next', zoneUrl.toString());

    location.href = gate.toString();
  };

  try {
    if (els && els.btnCooldown) {
      els.btnCooldown.__plateBound = false;
    }

    if (els && els.btnSummaryBack) {
      els.btnSummaryBack.__plateBound = false;
    }

    if (typeof bind === 'function') bind();
  } catch(e) {}

})();
