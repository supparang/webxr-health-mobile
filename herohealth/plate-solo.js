// === PATCH: /herohealth/plate-solo.js ===
// v20260515-PLATE-SOLO-SCOPEFIX3-PORTION-ZONE-COOLDOWN
// ✅ ต้องวาง "ก่อน function init(){" และยังอยู่ใน (() => { ... }) เท่านั้น
// ✅ ห้ามวางหลัง })();
// ✅ แก้ balanceScore scope error
// ✅ เป้าหมายแต่ละหมู่ไม่เท่ากัน
// ✅ ปริมาณต่อชิ้นไม่เติม 1.0 เท่ากันทุกหมู่
// ✅ Cooldown กลับ Nutrition Zone และ Nutrition Zone กลับ Hub ได้ถูก

(function installPlateSoloScopeFix3(){
  if (WIN.__HHA_PLATE_SOLO_SCOPEFIX3__) return;
  WIN.__HHA_PLATE_SOLO_SCOPEFIX3__ = true;

  VERSION = '20260515-PLATE-SOLO-SCOPEFIX3-PORTION-ZONE-COOLDOWN';
  HHA.version = VERSION;

  const HERO_BASE = 'https://supparang.github.io/webxr-health-mobile/herohealth/';
  const HUB_URL = HERO_BASE + 'hub.html';
  const NUTRITION_ZONE_URL = HERO_BASE + 'nutrition-zone.html';
  const COOLDOWN_GATE_URL = HERO_BASE + 'warmup-gate.html';

  const PORTION_TARGETS = {
    protein: 3.6,
    carb: 3.8,
    veg: 5.2,
    fruit: 4.4,
    fat: 2.6
  };

  const PORTION_SCALE = {
    protein: .72,
    carb: .74,
    veg: .55,
    fruit: .62,
    fat: .48
  };

  function n1(v){
    const x = Number(v || 0);
    return x.toFixed(1).replace(/\.0$/, '');
  }

  function targetOf(groupId){
    return Number(PORTION_TARGETS[groupId] || CFG.target || 4);
  }

  function scaleOf(groupId){
    return Number(PORTION_SCALE[groupId] || .65);
  }

  function portionOf(groupId, value){
    return Number(value || 0) * scaleOf(groupId);
  }

  function limitOf(groupId){
    return targetOf(groupId) + .55;
  }

  function isGroupMissing(groupId){
    return (state.fill[groupId] || 0) < targetOf(groupId) * .82;
  }

  function clampAllGroups(){
    GROUPS.forEach(g => {
      state.fill[g.id] = clamp(
        state.fill[g.id] || 0,
        0,
        limitOf(g.id)
      );
    });
  }

  balanceScore = function(){
    const vals = GROUPS.map(g => {
      const target = targetOf(g.id);
      const v = state.fill[g.id] || 0;

      return v <= target
        ? (v / target) * 100
        : Math.max(0, 100 - (v - target) * 48);
    });

    return Math.round(vals.reduce((a,b) => a + b, 0) / vals.length);
  };

  mostMissingGroup = function(){
    return GROUPS
      .map(g => ({
        ...g,
        need: targetOf(g.id) - (state.fill[g.id] || 0)
      }))
      .sort((a,b) => b.need - a.need)[0] || GROUPS[0];
  };

  mostOverGroup = function(){
    return GROUPS
      .map(g => ({
        ...g,
        over: (state.fill[g.id] || 0) - targetOf(g.id)
      }))
      .sort((a,b) => b.over - a.over)[0] || GROUPS[0];
  };

  wouldOverload = function(food){
    return !!(
      food &&
      food.effects &&
      Object.entries(food.effects).some(([g,v]) =>
        (state.fill[g] || 0) + portionOf(g,v) > targetOf(g) + .18
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
            <span id="gmv-${g.id}" class="meter-value">0.0/${n1(target)}</span>
          </div>
          <div class="meter-track">
            <i id="bari-${g.id}" class="meter-fill"></i>
          </div>
          <div id="need-${g.id}" class="meter-need">
            ยังขาด ${n1(target)}
          </div>
        </div>
      `;
    }).join('');

    if (els.balance) els.balance.textContent = '0%';

    const balanceFill =
      byId('balanceFill') ||
      byId('balanceBar') ||
      DOC.querySelector('.progress-fill');

    if (balanceFill) balanceFill.style.width = '0%';
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

      bar.classList.toggle('over', v > target + .18);
      bar.classList.toggle('warn', v >= target * .82 && v <= target + .18);

      label.textContent = `${v.toFixed(1)}/${n1(target)}`;

      need.textContent =
        v > target + .18
          ? 'ล้นแล้ว! อย่าเติมเพิ่ม'
          : (
              v >= target * .82
                ? 'พอดีแล้ว'
                : `ยังขาด ${(target - v).toFixed(1)}`
            );
    });

    const balanceFill =
      byId('balanceFill') ||
      byId('balanceBar') ||
      DOC.querySelector('.progress-fill');

    if (balanceFill) {
      balanceFill.style.width = balanceScore() + '%';
    }
  };

  chooseFood = function(){
    if (state.practiceActive) return choosePracticeFood();

    const missing = mostMissingGroup();

    if (state.lastSaveActive && state.lastSaveStats && chance(.72)) {
      const g = state.lastSaveStats.needGroup;
      const pool = FOODS.filter(f =>
        !f.junk &&
        f.effects &&
        f.effects[g] &&
        !wouldOverload(f)
      );

      if (pool.length) return { ...pick(pool) };
    }

    if (state.mini && state.mini.type === 'healthyRain' && chance(.82)) {
      const pool = FOODS.filter(f =>
        !f.junk &&
        f.effects &&
        (
          f.effects[missing.id] ||
          GROUPS.some(g => isGroupMissing(g.id) && f.effects[g.id])
        ) &&
        !wouldOverload(f)
      );

      if (pool.length) return { ...pick(pool) };
    }

    if (state.mini && state.mini.type === 'missingAlert' && chance(.72)) {
      const g = state.mini.group || missing.id;
      const pool = FOODS.filter(f =>
        !f.junk &&
        f.effects &&
        f.effects[g] &&
        !wouldOverload(f)
      );

      if (pool.length) return { ...pick(pool) };
    }

    if (chance(.08) && !state.boss && !state.mini && !state.lastSaveActive) {
      return { ...pick(POWERS) };
    }

    let junkRate =
      CFG.junk +
      (state.wave - 1) * .032 +
      (state.rush ? .055 : 0) +
      (state.boss ? .075 : 0) +
      (state.directorLevel * .023 - state.assistLevel * .035);

    if (state.mini && state.mini.type === 'junkInvasion') junkRate += .40;
    if (state.lastSaveActive) junkRate += .10;

    if (chance(clamp(junkRate, .08, .70))) {
      return { ...pick(FOODS.filter(f => f.junk)) };
    }

    const missingIds = GROUPS
      .filter(g => isGroupMissing(g.id))
      .map(g => g.id);

    if (missingIds.length && chance(.72)) {
      const g = pick(missingIds);
      const pool = FOODS.filter(f =>
        !f.junk &&
        f.effects &&
        f.effects[g] &&
        !wouldOverload(f)
      );

      if (pool.length) return { ...pick(pool) };
    }

    const safeHealthy = FOODS.filter(f =>
      !f.junk &&
      f.effects &&
      !wouldOverload(f)
    );

    if (safeHealthy.length && balanceScore() < 92) {
      return { ...pick(safeHealthy) };
    }

    if (chance(.44)) {
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
        sec:8,
        target:3
      },
      {
        type:'junkInvasion',
        icon:'🚨',
        title:'Junk Invasion',
        text:'ของหลอกบุก! รอดโดยไม่เลือก junk',
        sec:7,
        target:0
      },
      {
        type:'missingAlert',
        icon:'🔎',
        title:'Missing Group Alert',
        text:`รีบเติม ${m.icon} ${m.label} 2 ครั้ง`,
        sec:8,
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
  };

  updateMiniEvent = function(){
    if (!state.mini) return;

    const left = Math.max(0, state.miniExpire - now());

    if (els.miniEventSec) els.miniEventSec.textContent = Math.ceil(left/1000) + 's';
    if (els.miniEventFill) els.miniEventFill.style.width = clamp(left/(state.mini.sec*1000)*100,0,100) + '%';

    if (left <= 0) {
      let success = false;

      if (state.mini.type === 'healthyRain') {
        success = state.miniStats && state.miniStats.hits >= Math.max(2, state.mini.target - 1);
      } else if (state.mini.type === 'missingAlert') {
        success = state.miniStats && state.miniStats.groupHits >= Math.max(1, state.mini.target - 1);
      } else if (state.mini.type === 'junkInvasion') {
        success = state.miniStats && state.miniStats.junk === 0;
      }

      finishMiniEvent(success);
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
      targetOf(m.id) * .72,
      (state.fill[m.id] || 0) + targetOf(m.id) * .16
    );

    addScore(30, 'Rescue +30', 'power');
    healPlate(18, 'Rescue Skill');

    feedback('✨ Rescue! Freeze + Shield + เติมหมู่ที่ขาด', 'perfect');
    sfx('fever');
    logLine('ใช้ Rescue Skill แล้ว');

    updateAll();
  };

  const oldBossAttack = bossAttack;
  bossAttack = function(){
    oldBossAttack();
    clampAllGroups();
    updateAll();
  };

  function rootHubUrl(){
    const raw = qs('hub','');

    if (!raw) return HUB_URL;

    try {
      const u = new URL(raw, location.href);

      if (u.pathname.includes('/herohealth/nutrition-zone.html')) {
        return u.searchParams.get('hub') || HUB_URL;
      }

      return u.toString();
    } catch(e) {
      return HUB_URL;
    }
  }

  buildNutritionZoneUrl = function(fromTag){
    const u = new URL(NUTRITION_ZONE_URL, location.href);

    preserveParams(u, [
      'pid',
      'name',
      'nick',
      'diff',
      'time',
      'view',
      'seed',
      'studyId',
      'conditionGroup',
      'section',
      'session_code',
      'log',
      'api'
    ]);

    u.searchParams.set('pid', qs('pid','anon'));

    const nm = qs('name', qs('nick',''));
    if (nm) u.searchParams.set('name', nm);

    u.searchParams.set('diff', qs('diff','normal'));
    u.searchParams.set('time', qs('time','120'));
    u.searchParams.set('view', qs('view','mobile'));
    u.searchParams.set('run','play');
    u.searchParams.set('zone','nutrition');
    u.searchParams.set('from', fromTag || 'plate-solo');
    u.searchParams.set('hub', rootHubUrl());

    return u;
  };

  goBack = function(){
    flushLogs(true);
    location.href = buildNutritionZoneUrl('plate-solo').toString();
  };

  goCooldown = function(){
    flushLogs(true);

    const gate = new URL(COOLDOWN_GATE_URL, location.href);
    const zoneUrl = buildNutritionZoneUrl('plate-solo-cooldown-done');

    preserveParams(gate, [
      'pid',
      'name',
      'nick',
      'diff',
      'time',
      'view',
      'seed',
      'studyId',
      'conditionGroup',
      'section',
      'session_code',
      'log',
      'api'
    ]);

    gate.searchParams.set('pid', qs('pid','anon'));

    const nm = qs('name', qs('nick',''));
    if (nm) gate.searchParams.set('name', nm);

    gate.searchParams.set('diff', qs('diff','normal'));
    gate.searchParams.set('time', qs('time','120'));
    gate.searchParams.set('view', qs('view','mobile'));
    gate.searchParams.set('run','play');

    gate.searchParams.set('phase','cooldown');
    gate.searchParams.set('zone','nutrition');
    gate.searchParams.set('cat','nutrition');
    gate.searchParams.set('game','plate');
    gate.searchParams.set('gameId','plate');
    gate.searchParams.set('mode','solo');
    gate.searchParams.set('entry','plate-solo');
    gate.searchParams.set('from','plate-solo-summary');

    gate.searchParams.set('hub', zoneUrl.toString());
    gate.searchParams.set('next', zoneUrl.toString());
    gate.searchParams.set('returnTo', zoneUrl.toString());
    gate.searchParams.set('back', zoneUrl.toString());

    location.href = gate.toString();
  };

  console.info('[Plate Solo Patch]', VERSION, 'installed inside scope');
})();
