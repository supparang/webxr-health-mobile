// /herohealth/vr-rhythm-boxer-bloom/js/combo-composer.js
'use strict';

(function (W, D, B) {
  const qs = new URLSearchParams(W.location.search);
  const $ = (id) => D.getElementById(id);

  const ACTIONS = [
    { id:'jab',   lane:0, label:'JAB',   icon:'👊', cls:'l0' },
    { id:'cross', lane:1, label:'CROSS', icon:'💥', cls:'l1' },
    { id:'block', lane:2, label:'BLOCK', icon:'🛡', cls:'l2' },
    { id:'duck',  lane:3, label:'DUCK',  icon:'⬇️', cls:'l3' }
  ];

  const byId = (id) => ACTIONS.find(a => a.id === id);
  const byLane = (lane) => ACTIONS.find(a => a.lane === lane);

  const params = B.createParams(qs, {
    back: '../vr-rhythm-boxer-bloom/index.html',
    next: '../vr-rhythm-boxer-main/boxer.html'
  });

  const els = {
    btnBack: $('btnBack'),
    btnHubTop: $('btnHubTop'),

    hudView: $('hudView'),
    hudPhase: $('hudPhase'),
    hudLength: $('hudLength'),
    hudUnique: $('hudUnique'),
    hudReplay: $('hudReplay'),
    hudTime: $('hudTime'),

    coachTitle: $('coachTitle'),
    coachText: $('coachText'),

    phaseBanner: $('phaseBanner'),
    ruleLength: $('ruleLength'),
    ruleUnique: $('ruleUnique'),
    ruleRepeat: $('ruleRepeat'),

    sequence: $('sequence'),
    composeCard: $('composeCard'),
    replayCard: $('replayCard'),
    composeGrid: $('composeGrid'),
    replayInputs: $('replayInputs'),

    btnUndo: $('btnUndo'),
    btnClear: $('btnClear'),
    btnPreview: $('btnPreview'),
    btnStartReplay: $('btnStartReplay'),

    cueBox: $('cueBox'),
    cueIcon: $('cueIcon'),
    cueLabel: $('cueLabel'),
    cueHelp: $('cueHelp'),

    feedback: $('feedback'),
    countdown: $('countdown'),
    countdownNum: $('countdownNum'),
    cvrCrosshair: $('cvrCrosshair'),
    cvrFocus: $('cvrFocus'),

    summary: $('summary'),
    summaryTitle: $('summaryTitle'),
    summarySub: $('summarySub'),
    sumLength: $('sumLength'),
    sumUnique: $('sumUnique'),
    sumReplay: $('sumReplay'),
    sumRank: $('sumRank'),
    sumAllTypes: $('sumAllTypes'),
    sumCreativity: $('sumCreativity'),
    sumPattern: $('sumPattern'),
    sumTip: $('sumTip'),
    btnReplayPage: $('btnReplayPage'),
    btnNext: $('btnNext'),
    btnMainGame: $('btnMainGame'),
    btnHub: $('btnHub')
  };

  const RULES = (() => {
    if (params.diff === 'easy') {
      return { length:4, minUnique:2, noTriple:true, needAll:false };
    }
    if (params.diff === 'hard') {
      return { length:6, minUnique:4, noTriple:true, needAll:true };
    }
    return { length:5, minUnique:3, noTriple:true, needAll:false };
  })();

  const state = {
    started: false,
    ended: false,
    startAt: 0,
    durationMs: B.clamp(params.time * 1000, 30000, 90000),

    phase: 'compose',
    combo: [],
    previewTimer: 0,

    replayIndex: 0,
    replayHits: 0,
    replayWrong: 0,
    replayWindowOpen: false,
    replayWindowTarget: '',
    replayStepStart: 0,

    cvrIndex: 0,
    gamma: 0,
    gammaOffset: 0,
    gammaSmooth: 0,
    laneLockUntil: 0
  };

  function setCoach(title, text) {
    if (els.coachTitle) els.coachTitle.textContent = title;
    if (els.coachText) els.coachText.textContent = text;
  }

  function updateRuleTexts() {
    if (els.ruleLength) {
      els.ruleLength.textContent = `ความยาว ${RULES.length} จังหวะ`;
    }
    if (els.ruleUnique) {
      els.ruleUnique.textContent = RULES.needAll
        ? 'ต้องมีครบทั้ง 4 แบบ'
        : `มีอย่างน้อย ${RULES.minUnique} แบบ`;
    }
    if (els.ruleRepeat) {
      els.ruleRepeat.textContent = RULES.noTriple
        ? 'ห้ามซ้ำติดกันเกิน 2 ครั้ง'
        : 'ซ้ำได้';
    }
  }

  function uniqueTypes(combo = state.combo) {
    return [...new Set(combo)].length;
  }

  function containsAllTypes(combo = state.combo) {
    return ACTIONS.every(a => combo.includes(a.id));
  }

  function noTripleRepeat(combo = state.combo) {
    for (let i = 2; i < combo.length; i++) {
      if (combo[i] === combo[i - 1] && combo[i] === combo[i - 2]) return false;
    }
    return true;
  }

  function patternLabel(combo = state.combo) {
    if (!combo.length) return '-';

    if (combo.length >= 4) {
      const half = Math.floor(combo.length / 2);
      const firstHalf = combo.slice(0, half).join('-');
      const secondHalf = combo.slice(half).join('-');
      if (firstHalf === secondHalf) return 'repeat-half';
    }

    if (combo.every((v, i) => i === 0 || v !== combo[i - 1])) return 'alternating';
    if (uniqueTypes(combo) === combo.length) return 'all-unique';
    if (combo[0] === combo[combo.length - 1]) return 'loop-back';
    return 'mixed-pattern';
  }

  function creativityScore(combo = state.combo) {
    let score = 0;
    score += combo.length * 10;
    score += uniqueTypes(combo) * 12;
    if (containsAllTypes(combo)) score += 18;
    if (noTripleRepeat(combo)) score += 10;
    if (patternLabel(combo) !== 'mixed-pattern') score += 10;
    return score;
  }

  function validateCombo() {
    if (state.combo.length !== RULES.length) {
      return { ok:false, msg:`ต้องสร้างให้ครบ ${RULES.length} จังหวะก่อน` };
    }
    if (uniqueTypes(state.combo) < RULES.minUnique) {
      return { ok:false, msg:`ต้องมีอย่างน้อย ${RULES.minUnique} แบบ` };
    }
    if (RULES.needAll && !containsAllTypes(state.combo)) {
      return { ok:false, msg:'รอบนี้ต้องมีครบทั้ง 4 แบบ' };
    }
    if (RULES.noTriple && !noTripleRepeat(state.combo)) {
      return { ok:false, msg:'ห้ามซ้ำแบบเดิมติดกันเกิน 2 ครั้ง' };
    }
    return { ok:true, msg:'พร้อมแล้ว!' };
  }

  function accuracyReplay() {
    return state.combo.length ? Math.round((state.replayHits / state.combo.length) * 100) : 0;
  }

  function rankOf() {
    const creativity = creativityScore();
    const replayAcc = accuracyReplay();

    let score = 0;
    score += creativity * 0.55;
    score += replayAcc * 0.45;

    if (score >= 88) return 'S';
    if (score >= 76) return 'A';
    if (score >= 64) return 'B';
    if (score >= 50) return 'C';
    return 'D';
  }

  function bestTip() {
    if (state.combo.length < RULES.length) return 'สร้างให้ครบความยาวก่อน';
    if (uniqueTypes() < RULES.minUnique) return 'เพิ่ม action ให้หลากหลายขึ้น';
    if (!noTripleRepeat()) return 'หลีกเลี่ยงการซ้ำติดกันมากเกินไป';
    if (accuracyReplay() < 60) return 'ตอน Replay ให้มอง cue แล้วตอบทันที';
    if (containsAllTypes()) return 'ยอดเยี่ยม มีครบทุกแบบแล้ว';
    return 'ดีมาก ลองออกแบบ pattern ที่ซับซ้อนขึ้นอีก';
  }

  function updateHud(leftMs) {
    if (els.hudView) els.hudView.textContent = params.view.toUpperCase();
    if (els.hudPhase) els.hudPhase.textContent = state.phase.toUpperCase();
    if (els.hudLength) els.hudLength.textContent = `${state.combo.length}/${RULES.length}`;
    if (els.hudUnique) els.hudUnique.textContent = String(uniqueTypes());
    if (els.hudReplay) els.hudReplay.textContent = `${state.replayHits}/${state.combo.length || 0}`;
    if (els.hudTime) els.hudTime.textContent = `${Math.max(0, Math.ceil(leftMs / 1000))}`;
  }

  function renderSequence(activeIndex = -1) {
    if (!els.sequence) return;

    els.sequence.innerHTML = '';

    for (let i = 0; i < RULES.length; i++) {
      const id = state.combo[i];
      if (id) {
        const a = byId(id);
        els.sequence.insertAdjacentHTML('beforeend', `
          <div class="seq-slot filled ${a.cls} ${i === activeIndex ? 'focus' : ''}">
            <div class="seq-icon">${a.icon}</div>
            <div class="seq-label">${a.label}</div>
          </div>
        `);
      } else {
        els.sequence.insertAdjacentHTML('beforeend', `
          <div class="seq-slot">
            <div class="seq-icon">＋</div>
            <div class="seq-label">Slot ${i + 1}</div>
          </div>
        `);
      }

      if (i < RULES.length - 1) {
        els.sequence.insertAdjacentHTML('beforeend', `<div class="seq-join">→</div>`);
      }
    }
  }

  function addAction(id) {
    if (state.phase !== 'compose' || state.ended) return;

    if (state.combo.length >= RULES.length) {
      B.showFeedback(els.feedback, 'ครบแล้ว');
      setCoach('ครบความยาวแล้ว', 'ลบตัวล่าสุด หรือเริ่มเล่นตาม combo ได้เลย');
      return;
    }

    state.combo.push(id);
    renderSequence();
    updateHud(Math.max(0, state.durationMs - (performance.now() - state.startAt)));

    const check = validateCombo();
    if (check.ok) {
      setCoach('พร้อมแล้ว!', 'กด “เล่นตาม combo” เพื่อเข้าสู่ Replay Phase');
    } else {
      setCoach('สร้างต่อได้', check.msg);
    }
  }

  function undoAction() {
    if (state.phase !== 'compose' || state.ended) return;
    if (!state.combo.length) return;

    state.combo.pop();
    renderSequence();
    setCoach('ลบตัวล่าสุดแล้ว', 'เรียงใหม่ได้จนกว่าจะพอใจ');
  }

  function clearCombo() {
    if (state.phase !== 'compose' || state.ended) return;

    state.combo = [];
    renderSequence();
    setCoach('เริ่มใหม่ได้เลย', 'ลองสร้าง pattern ที่หลากหลายขึ้น');
  }

  function previewCombo() {
    if (state.phase !== 'compose' || state.ended) return;
    if (!state.combo.length) {
      B.showFeedback(els.feedback, 'ยังไม่มี combo');
      return;
    }

    clearInterval(state.previewTimer);
    let i = 0;

    setCoach('กำลัง preview', 'ดู sequence ของตัวเองก่อนเริ่มเล่นจริง');

    state.previewTimer = W.setInterval(() => {
      renderSequence(i);
      const a = byId(state.combo[i]);

      if (els.cueBox) els.cueBox.classList.add('active');
      if (els.cueIcon) els.cueIcon.textContent = a.icon;
      if (els.cueLabel) els.cueLabel.textContent = a.label;
      if (els.cueHelp) els.cueHelp.textContent = 'นี่คือ combo ที่คุณสร้าง';

      i++;

      if (i >= state.combo.length) {
        clearInterval(state.previewTimer);
        W.setTimeout(() => {
          renderSequence(-1);
          if (els.cueBox) els.cueBox.classList.remove('active');
          if (els.cueIcon) els.cueIcon.textContent = '🎵';
          if (els.cueLabel) els.cueLabel.textContent = 'READY';
          if (els.cueHelp) els.cueHelp.textContent = 'ดูแล้วกดเล่นตามได้เลย';
        }, 650);
      }
    }, 650);
  }

  function replayButtons() {
    return [...D.querySelectorAll('#replayInputs .replay-btn')];
  }

  function clearReplayMarks() {
    replayButtons().forEach(btn => {
      btn.classList.remove('good', 'bad', 'focus');
    });
  }

  function startReplayPhase() {
    if (state.phase !== 'compose' || state.ended) return;

    const check = validateCombo();
    if (!check.ok) {
      B.showFeedback(els.feedback, check.msg);
      setCoach('ยังไม่พร้อม', check.msg);
      return;
    }

    state.phase = 'replay';
    state.replayIndex = 0;
    state.replayHits = 0;
    state.replayWrong = 0;
    state.replayWindowOpen = false;
    state.replayWindowTarget = '';

    clearReplayMarks();

    if (els.phaseBanner) els.phaseBanner.textContent = 'REPLAY YOUR COMBO';
    if (els.composeCard) els.composeCard.classList.add('hidden');
    if (els.replayCard) els.replayCard.classList.remove('hidden');

    setCoach('Replay Phase', 'ตอนเห็น cue ให้กด action เดียวกันตาม combo ของตัวเอง');
    updateHud(Math.max(0, state.durationMs - (performance.now() - state.startAt)));

    runReplayStep();
  }

  function runReplayStep() {
    if (state.ended || state.phase !== 'replay') return;

    if (state.replayIndex >= state.combo.length) {
      showSummary();
      return;
    }

    clearReplayMarks();

    const id = state.combo[state.replayIndex];
    const a = byId(id);

    if (els.cueBox) els.cueBox.classList.add('active');
    if (els.cueIcon) els.cueIcon.textContent = a.icon;
    if (els.cueLabel) els.cueLabel.textContent = a.label;
    if (els.cueHelp) els.cueHelp.textContent = 'กด action เดียวกันตอนนี้';

    renderSequence(state.replayIndex);

    state.replayWindowOpen = true;
    state.replayWindowTarget = id;
    state.replayStepStart = performance.now();

    W.setTimeout(() => {
      if (!state.replayWindowOpen) return;

      state.replayWindowOpen = false;
      state.replayWrong += 1;
      B.showFeedback(els.feedback, 'MISS');
      setCoach('พลาดแล้ว', 'รอบหน้าให้ตอบทันทีเมื่อเห็น cue');
      state.replayIndex += 1;
      updateHud(Math.max(0, state.durationMs - (performance.now() - state.startAt)));
      runReplayStep();
    }, 1150);
  }

  function submitReplay(id) {
    if (state.phase !== 'replay' || state.ended || !state.replayWindowOpen) return;
    if (!id) return;

    const target = state.replayWindowTarget;
    const btn = replayButtons().find(b => b.dataset.id === id);

    state.replayWindowOpen = false;

    if (id === target) {
      state.replayHits += 1;
      if (btn) btn.classList.add('good');
      B.showFeedback(els.feedback, 'ตรงแล้ว!');
      setCoach('ดีมาก!', 'เล่นตาม combo ของตัวเองได้ถูกต้อง');
    } else {
      state.replayWrong += 1;
      if (btn) btn.classList.add('bad');
      B.showFeedback(els.feedback, 'ยังไม่ตรง');
      setCoach('ลองอีกนิด', `โจทย์คือ ${byId(target).label}`);
    }

    state.replayIndex += 1;
    updateHud(Math.max(0, state.durationMs - (performance.now() - state.startAt)));

    W.setTimeout(() => {
      runReplayStep();
    }, 520);
  }

  function saveSummary() {
    const payload = {
      pid: params.pid,
      game: 'combo-composer',
      gameId: 'combo-composer',
      zone: params.zone,
      cat: params.cat,
      diff: params.diff,
      timeSec: Math.round(state.durationMs / 1000),
      view: params.view,
      runMode: params.run,

      scoreFinal: creativityScore() + (state.replayHits * 10),
      createdLength: state.combo.length,
      uniqueTypes: uniqueTypes(),
      containsAllTypes: containsAllTypes() ? 1 : 0,
      replaySuccess: state.replayHits,
      replayTotal: state.combo.length,
      replayAccPct: accuracyReplay(),
      creativityScore: creativityScore(),
      composerPattern: patternLabel(),
      comboText: state.combo.join('-'),
      rank: rankOf(),
      durationSec: Math.round(state.durationMs / 1000),
      studyId: params.studyId,
      planDay: params.planDay,
      planSlot: params.planSlot,
      timestampIso: B.nowIso()
    };

    B.saveSummary('combo-composer', params.pid, payload);
  }

  function showSummary() {
    state.ended = true;
    clearInterval(state.previewTimer);
    saveSummary();

    if (els.sumLength) els.sumLength.textContent = String(state.combo.length);
    if (els.sumUnique) els.sumUnique.textContent = String(uniqueTypes());
    if (els.sumReplay) els.sumReplay.textContent = `${state.replayHits}/${state.combo.length}`;
    if (els.sumRank) els.sumRank.textContent = rankOf();
    if (els.sumAllTypes) els.sumAllTypes.textContent = containsAllTypes() ? 'Yes' : 'No';
    if (els.sumCreativity) els.sumCreativity.textContent = String(creativityScore());
    if (els.sumPattern) els.sumPattern.textContent = patternLabel();
    if (els.sumTip) els.sumTip.textContent = bestTip();

    if (els.summaryTitle) {
      els.summaryTitle.textContent =
        rankOf() === 'S' ? 'สร้างได้สุดยอดมาก!' :
        rankOf() === 'A' ? 'คอมโบดีมาก!' :
        'เริ่มสร้าง pattern ของตัวเองได้แล้ว!';
    }

    if (els.summarySub) {
      els.summarySub.textContent =
        'มินิเกมนี้ช่วยให้เด็กคิดและสร้าง sequence เอง ก่อนนำไปใช้ในเกมหลัก';
    }

    if (els.summary) els.summary.classList.remove('hidden');
  }

  function cvrTargets() {
    return [...D.querySelectorAll('.cvr-target:not(.hidden)')].filter(el => !el.closest('.hidden'));
  }

  function updateCvrFocusLabel() {
    const target = cvrTargets()[state.cvrIndex];
    if (!target || !els.cvrFocus) {
      if (els.cvrFocus) els.cvrFocus.textContent = 'TARGET';
      return;
    }

    const label =
      target.dataset.id ? byId(target.dataset.id)?.label :
      target.textContent.trim().replace(/\s+/g, ' ').slice(0, 18);

    els.cvrFocus.textContent = label || 'TARGET';
  }

  function highlightCvrTarget() {
    cvrTargets().forEach((el, idx) => {
      el.classList.toggle('focus', idx === state.cvrIndex);
    });
    updateCvrFocusLabel();
  }

  function routeAction(btn) {
    const role = btn.dataset.role;
    const id = btn.dataset.id;

    if (role === 'add') addAction(id);
    else if (role === 'undo') undoAction();
    else if (role === 'clear') clearCombo();
    else if (role === 'preview') previewCombo();
    else if (role === 'start') startReplayPhase();
    else if (role === 'replay') submitReplay(id);
  }

  function triggerCvrTarget() {
    const target = cvrTargets()[state.cvrIndex];
    if (!target) return;
    routeAction(target);
  }

  function bindInputs() {
    D.addEventListener('pointerdown', (e) => {
      const btn = e.target.closest('[data-role]');
      if (!btn) return;
      e.preventDefault();
      routeAction(btn);
    }, { passive:false });

    D.addEventListener('touchstart', (e) => {
      const btn = e.target.closest('[data-role]');
      if (!btn) return;
      e.preventDefault();
      routeAction(btn);
    }, { passive:false });

    W.addEventListener('keydown', (e) => {
      const k = String(e.key || '').toLowerCase();

      if (state.phase === 'compose') {
        if (k === '1') addAction('jab');
        else if (k === '2') addAction('cross');
        else if (k === '3') addAction('block');
        else if (k === '4') addAction('duck');
        else if (k === 'backspace') undoAction();
        else if (k === 'c') clearCombo();
        else if (k === 'p') previewCombo();
        else if (k === 'enter') startReplayPhase();
      } else if (state.phase === 'replay') {
        if (k === '1' || k === 'a') submitReplay('jab');
        else if (k === '2' || k === 'l') submitReplay('cross');
        else if (k === '3' || k === 'w') submitReplay('block');
        else if (k === '4' || k === 's') submitReplay('duck');
      }

      if (params.view === 'cvr') {
        if (k === ' ') {
          e.preventDefault();
          triggerCvrTarget();
        } else if (k === 'r') {
          e.preventDefault();
          B.reCenterCvr(state, els.feedback);
        }
      }
    }, { passive:false });

    if (params.view === 'cvr') {
      B.attachCvrInput({
        state,
        onShoot: () => triggerCvrTarget(),
        onRecenter: () => B.reCenterCvr(state, els.feedback)
      });
    }
  }

  function showCorrectView() {
    const isCvr = params.view === 'cvr';
    if (els.cvrCrosshair) els.cvrCrosshair.classList.toggle('hidden', !isCvr);
    if (els.cvrFocus) els.cvrFocus.classList.toggle('hidden', !isCvr);
  }

  function tick(now) {
    if (!state.started) {
      updateHud(state.durationMs);
      W.requestAnimationFrame(tick);
      return;
    }

    const elapsed = now - state.startAt;
    const left = Math.max(0, state.durationMs - elapsed);
    updateHud(left);

    if (!state.ended && elapsed >= state.durationMs) {
      showSummary();
      return;
    }

    W.requestAnimationFrame(tick);
  }

  async function boot() {
    B.setCommonLinks({
      searchParams: qs,
      backEl: els.btnBack,
      hubTopEl: els.btnHubTop,
      hubEl: els.btnHub,
      mainGameEl: els.btnMainGame,
      nextEl: els.btnNext,
      backHref: params.back,
      hubHref: params.hub,
      nextHref: params.next,
      mainGameHref: '../vr-rhythm-boxer-main/boxer.html'
    });

    updateRuleTexts();
    showCorrectView();
    renderSequence();
    bindInputs();
    updateHud(state.durationMs);

    if (params.view === 'cvr') {
      await B.loadVrUiIfNeeded(params.view);
      const loop = B.makeCvrFocusLoop(
        state,
        () => cvrTargets().length || 1,
        () => highlightCvrTarget()
      );
      loop();
    }

    if (els.btnReplayPage) {
      els.btnReplayPage.addEventListener('click', () => {
        const u = new URL(W.location.href);
        u.searchParams.set('seed', String(Date.now()));
        W.location.href = u.toString();
      });
    }

    B.startCountdown(els.countdown, els.countdownNum, 3, () => {
      state.started = true;
      state.startAt = performance.now();
      highlightCvrTarget();
    });

    W.requestAnimationFrame(tick);
  }

  boot();
})(window, document, window.RBBloom);