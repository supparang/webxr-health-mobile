// === /herohealth/vr-handwash/handwash-vr.js ===
// Handwash VR starter logic (Cardboard / cVR)
// v20260320a-vr-split

(() => {
  'use strict';

  const qs = new URLSearchParams(location.search);

  const ctx = {
    pid: qs.get('pid') || '',
    studyId: qs.get('studyId') || '',
    run: qs.get('run') || 'play',
    mode: qs.get('mode') || 'cvr',
    diff: qs.get('diff') || 'normal',
    seed: qs.get('seed') || Date.now().toString(),
    hub: qs.get('hub') || '../hub.html',
    next: qs.get('next') || '../germ-detective-v2.html'
  };

  const WHO_STEPS = [
    { id: 1, label: 'ฝ่ามือ', zones: ['palmLeft', 'palmRight'], target: 28 },
    { id: 2, label: 'หลังมือ', zones: ['backLeft', 'backRight'], target: 28 },
    { id: 3, label: 'ซอกนิ้ว', zones: ['betweenFingers'], target: 30 },
    { id: 4, label: 'หลังนิ้ว', zones: ['backFingers'], target: 30 },
    { id: 5, label: 'นิ้วโป้ง', zones: ['thumbs'], target: 30 },
    { id: 6, label: 'ปลายนิ้ว', zones: ['fingertips'], target: 30 },
    { id: 7, label: 'ข้อมือ', zones: ['wrists'], target: 26 }
  ];

  const ZONES = {
    palmLeft: { label: 'ฝ่ามือซ้าย' },
    palmRight: { label: 'ฝ่ามือขวา' },
    backLeft: { label: 'หลังมือซ้าย' },
    backRight: { label: 'หลังมือขวา' },
    betweenFingers: { label: 'ซอกนิ้ว' },
    backFingers: { label: 'หลังนิ้ว' },
    thumbs: { label: 'นิ้วโป้ง' },
    fingertips: { label: 'ปลายนิ้ว' },
    wrists: { label: 'ข้อมือ' }
  };

  const state = {
    phase: 'intro',
    soapApplied: false,
    rinseDone: false,
    dryDone: false,
    whoStepIndex: 0,
    summary: null,
    zones: {
      palmLeft: { clean: 0 },
      palmRight: { clean: 0 },
      backLeft: { clean: 0 },
      backRight: { clean: 0 },
      betweenFingers: { clean: 0 },
      backFingers: { clean: 0 },
      thumbs: { clean: 0 },
      fingertips: { clean: 0 },
      wrists: { clean: 0 }
    }
  };

  const dom = {
    launchOverlay: document.getElementById('launchOverlay'),
    btnStart: document.getElementById('btnStart'),
    btnBackHubTop: document.getElementById('btnBackHubTop'),

    hudTitle: document.getElementById('hudTitle'),
    hudSub: document.getElementById('hudSub'),
    hudWho: document.getElementById('hudWho'),
    hudCoverage: document.getElementById('hudCoverage'),
    hudPhase: document.getElementById('hudPhase'),

    boardTitle: document.getElementById('boardTitle'),
    boardInstruction: document.getElementById('boardInstruction'),
    boardRemain: document.getElementById('boardRemain'),
    stepListLeft: document.getElementById('stepListLeft'),
    stepListRight: document.getElementById('stepListRight'),

    btnSoap: document.getElementById('btnSoap'),
    btnRinse: document.getElementById('btnRinse'),
    btnDry: document.getElementById('btnDry'),
    btnBackHub: document.getElementById('btnBackHub'),

    summaryPanel: document.getElementById('summaryPanel'),
    summaryTitle: document.getElementById('summaryTitle'),
    summaryMain: document.getElementById('summaryMain'),
    summarySub: document.getElementById('summarySub'),
    summaryList: document.getElementById('summaryList'),
    btnReplay: document.getElementById('btnReplay'),
    btnNext: document.getElementById('btnNext'),
    btnSummaryHub: document.getElementById('btnSummaryHub'),

    zoneEls: {
      palmLeft: document.getElementById('zone-palmLeft'),
      palmRight: document.getElementById('zone-palmRight'),
      backLeft: document.getElementById('zone-backLeft'),
      backRight: document.getElementById('zone-backRight'),
      betweenFingers: document.getElementById('zone-betweenFingers'),
      backFingers: document.getElementById('zone-backFingers'),
      thumbs: document.getElementById('zone-thumbs'),
      fingertips: document.getElementById('zone-fingertips'),
      wrists: document.getElementById('zone-wrists')
    }
  };

  bindEvents();
  updateUI();

  function bindEvents() {
    dom.btnStart?.addEventListener('click', () => {
      dom.launchOverlay?.classList.add('hidden');
      updateUI();
    });

    dom.btnBackHubTop?.addEventListener('click', goHub);

    dom.btnSoap?.addEventListener('click', onSoap);
    dom.btnRinse?.addEventListener('click', onRinse);
    dom.btnDry?.addEventListener('click', onDry);
    dom.btnBackHub?.addEventListener('click', goHub);

    dom.btnReplay?.addEventListener('click', restartGame);
    dom.btnNext?.addEventListener('click', goNext);
    dom.btnSummaryHub?.addEventListener('click', goHub);

    Object.entries(dom.zoneEls).forEach(([zoneId, el]) => {
      el?.addEventListener('click', () => onZone(zoneId));
    });
  }

  function getCurrentStep() {
    return WHO_STEPS[state.whoStepIndex] || null;
  }

  function getCoverage() {
    const values = Object.values(state.zones).map(z => z.clean);
    return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
  }

  function getWhoDoneCount() {
    return Math.min(state.whoStepIndex, WHO_STEPS.length);
  }

  function getCurrentAverage(step) {
    if (!step) return 0;
    return Math.round(
      step.zones.reduce((sum, zoneId) => sum + state.zones[zoneId].clean, 0) / step.zones.length
    );
  }

  function onSoap() {
    if (!(state.phase === 'intro' || state.phase === 'soap')) return;
    state.soapApplied = true;
    state.phase = 'scrub';
    updateUI();
  }

  function onZone(zoneId) {
    if (state.phase !== 'scrub') return;

    const step = getCurrentStep();
    if (!step) return;

    if (!step.zones.includes(zoneId)) {
      flashZone(zoneId, '#ef4444', 0.38);
      setHud(`ตอนนี้: ${step.label}`, 'จ้องค้างที่โซนของขั้นปัจจุบัน');
      return;
    }

    const baseGain = 10;
    state.zones[zoneId].clean = clamp(state.zones[zoneId].clean + baseGain, 0, 100);

    flashZone(zoneId, '#facc15', 0.30);

    if (isCurrentStepComplete()) {
      state.whoStepIndex += 1;

      if (state.whoStepIndex >= WHO_STEPS.length) {
        setHud('ครบ WHO 7 ขั้นแล้ว', 'ตอนนี้กด “ล้างน้ำ”');
      } else {
        const next = getCurrentStep();
        setHud('ผ่านขั้นก่อนหน้าแล้ว', `ต่อไป: ${next.label}`);
      }
    } else {
      setHud(`กำลังทำ: ${step.label}`, 'จ้องค้างที่โซนเดิมต่อได้');
    }

    updateUI();
  }

  function isCurrentStepComplete() {
    const step = getCurrentStep();
    if (!step) return true;
    const avg = getCurrentAverage(step);
    return avg >= step.target;
  }

  function onRinse() {
    if (state.phase !== 'scrub') return;

    if (state.whoStepIndex < WHO_STEPS.length) {
      const step = getCurrentStep();
      setHud('ยังไม่ครบ 7 ขั้น', `ตอนนี้ต้องทำ: ${step ? step.label : ''}`);
      return;
    }

    state.rinseDone = true;
    state.phase = 'dry';
    setHud('ล้างน้ำแล้ว', 'ตอนนี้กด “เช็ดมือ”');
    updateUI();
  }

  function onDry() {
    if (state.phase !== 'dry') return;
    state.dryDone = true;
    finishGame();
  }

  function finishGame() {
    state.phase = 'summary';

    const coverage = getCoverage();
    const whoDone = getWhoDoneCount();
    const score = Math.round((whoDone / 7) * 60 + coverage * 0.4);

    state.summary = {
      whoDone,
      coverage,
      score,
      missed: WHO_STEPS.slice(whoDone).map(s => s.label)
    };

    try {
      localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify({
        gameId: 'handwash-vr',
        at: new Date().toISOString(),
        pid: ctx.pid,
        studyId: ctx.studyId,
        whoDone,
        coverage,
        score
      }));
    } catch (_) {}

    updateUI();
  }

  function restartGame() {
    state.phase = 'intro';
    state.soapApplied = false;
    state.rinseDone = false;
    state.dryDone = false;
    state.whoStepIndex = 0;
    state.summary = null;

    Object.keys(state.zones).forEach(zoneId => {
      state.zones[zoneId].clean = 0;
    });

    dom.summaryPanel?.setAttribute('visible', false);
    setHud('กด “ใส่สบู่” เพื่อเริ่ม', 'จากนั้นจ้องค้างที่โซนของขั้นปัจจุบัน');
    updateUI();
  }

  function goHub() {
    const url = buildUrl(ctx.hub, { fromGame: 'handwash-vr' });
    location.href = url;
  }

  function goNext() {
    const url = buildUrl(ctx.next, { fromGame: 'handwash-vr' });
    location.href = url;
  }

  function buildUrl(base, extra = {}) {
    const url = new URL(base, location.href);

    [
      'pid', 'studyId', 'run', 'mode', 'diff', 'seed', 'hub',
      'conditionGroup', 'sessionOrder', 'blockLabel', 'siteCode', 'schoolYear', 'semester'
    ].forEach(key => {
      const value = qs.get(key);
      if (value !== null && value !== '') url.searchParams.set(key, value);
    });

    Object.entries(extra).forEach(([k, v]) => {
      if (v !== undefined && v !== null && String(v) !== '') {
        url.searchParams.set(k, String(v));
      }
    });

    return url.toString();
  }

  function setHud(title, sub) {
    if (dom.hudTitle) dom.hudTitle.textContent = title;
    if (dom.hudSub) dom.hudSub.textContent = sub;
  }

  function updateUI() {
    const step = getCurrentStep();
    const coverage = getCoverage();
    const whoDone = getWhoDoneCount();

    if (dom.hudWho) dom.hudWho.textContent = `WHO ${whoDone} / 7`;
    if (dom.hudCoverage) dom.hudCoverage.textContent = `Coverage ${coverage}%`;
    if (dom.hudPhase) dom.hudPhase.textContent = state.phase;

    if (state.phase === 'intro') {
      dom.boardInstruction?.setAttribute('value', 'กด “ใส่สบู่” เพื่อเริ่ม');
      dom.boardRemain?.setAttribute('value', 'เหลืออีก 0');
      setHud('กด “ใส่สบู่” เพื่อเริ่ม', 'จากนั้นจ้องค้างที่โซนของขั้นปัจจุบัน');
    } else if (state.phase === 'scrub' && step) {
      const avg = getCurrentAverage(step);
      const remain = Math.max(0, step.target - avg);
      dom.boardInstruction?.setAttribute('value', `WHO ขั้นที่ ${step.id}: ${step.label}`);
      dom.boardRemain?.setAttribute('value', `เหลืออีก ${remain}`);
      setHud(`กำลังทำ: ${step.label}`, 'จ้องค้างที่โซนที่ไฮไลต์');
    } else if (state.phase === 'dry') {
      dom.boardInstruction?.setAttribute('value', 'กด “เช็ดมือ”');
      dom.boardRemain?.setAttribute('value', 'เหลืออีก 0');
      setHud('ตอนนี้กด “เช็ดมือ”', 'เสร็จแล้วจะเข้าสรุปผล');
    } else if (state.phase === 'summary') {
      dom.boardInstruction?.setAttribute('value', 'สรุปผล');
      dom.boardRemain?.setAttribute('value', 'เสร็จแล้ว');
    }

    updateStepList();
    updateZoneVisuals();
    updateButtons();
    updateSummary();
  }

  function updateStepList() {
    const left = [];
    const right = [];

    WHO_STEPS.forEach((step, idx) => {
      const avg = getCurrentAverage(step);
      const target = step.target;
      const done = idx < state.whoStepIndex;
      const active = idx === state.whoStepIndex && state.phase === 'scrub';

      const line = `${done ? '✓' : active ? '>' : '•'} ${step.id} ${step.label} ${done ? 'ผ่าน' : `${avg}/${target}`}`;
      if (idx < 4) left.push(line);
      else right.push(line);
    });

    dom.stepListLeft?.setAttribute('value', left.join('\n'));
    dom.stepListRight?.setAttribute('value', right.join('\n'));
  }

  function updateZoneVisuals() {
    const step = getCurrentStep();
    const activeZones = new Set(step ? step.zones : []);

    Object.entries(dom.zoneEls).forEach(([zoneId, el]) => {
      const clean = state.zones[zoneId].clean;
      const isTarget = state.phase === 'scrub' && activeZones.has(zoneId);
      const isClean = clean >= 100;

      if (isClean) {
        setZoneMaterial(el, '#22c55e', 0.26);
        return;
      }

      if (isTarget) {
        setZoneMaterial(el, '#facc15', 0.20);
        return;
      }

      if (state.phase === 'scrub') {
        setZoneMaterial(el, '#ffffff', 0.04);
      } else {
        setZoneMaterial(el, '#ffffff', 0.08);
      }
    });
  }

  function setZoneMaterial(el, color, opacity) {
    if (!el) return;
    el.setAttribute('color', color);
    el.setAttribute('opacity', opacity);
  }

  function flashZone(zoneId, color, opacity) {
    const el = dom.zoneEls[zoneId];
    if (!el) return;

    const prevColor = el.getAttribute('color');
    const prevOpacity = el.getAttribute('opacity');

    el.setAttribute('color', color);
    el.setAttribute('opacity', opacity);

    setTimeout(() => {
      el.setAttribute('color', prevColor);
      el.setAttribute('opacity', prevOpacity);
    }, 180);
  }

  function updateButtons() {
    setButton(dom.btnSoap, state.phase === 'intro' || state.phase === 'soap', '#5ad5ff', '#03263d');
    setButton(dom.btnRinse, state.phase === 'scrub' && state.whoStepIndex >= WHO_STEPS.length, '#f59e0b', '#fff7ed');
    setButton(dom.btnDry, state.phase === 'dry', '#22c55e', '#052e16');
    setButton(dom.btnBackHub, true, '#1b2a39', '#eef8ff');
  }

  function setButton(btn, active, activeColor, textColor) {
    if (!btn) return;
    btn.setAttribute('color', active ? activeColor : '#253646');
    const text = btn.nextElementSibling;
    if (text) text.setAttribute('color', active ? textColor : '#b7d6ea');
  }

  function updateSummary() {
    if (state.phase !== 'summary' || !state.summary) {
      dom.summaryPanel?.setAttribute('visible', false);
      return;
    }

    dom.summaryPanel?.setAttribute('visible', true);

    const missedText = state.summary.missed.length
      ? `ควรฝึกเพิ่ม: ${state.summary.missed.join(' • ')}`
      : 'ครบ WHO 7 ขั้นแล้ว';

    dom.summaryMain?.setAttribute(
      'value',
      `คะแนน ${state.summary.score} • WHO ${state.summary.whoDone}/7 • Coverage ${state.summary.coverage}%`
    );
    dom.summarySub?.setAttribute('value', missedText);

    const lines = [
      `ใส่สบู่: ${state.soapApplied ? 'ผ่าน' : 'ยังไม่ผ่าน'}`,
      `ล้างน้ำ: ${state.rinseDone ? 'ผ่าน' : 'ยังไม่ผ่าน'}`,
      `เช็ดมือ: ${state.dryDone ? 'ผ่าน' : 'ยังไม่ผ่าน'}`
    ];

    dom.summaryList?.setAttribute('value', lines.join('\n'));
    setHud('สรุปผล', `WHO ${state.summary.whoDone}/7 • Coverage ${state.summary.coverage}%`);
  }

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }
})();