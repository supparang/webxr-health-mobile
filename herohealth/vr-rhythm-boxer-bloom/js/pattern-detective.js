// /herohealth/vr-rhythm-boxer-bloom/js/pattern-detective.js
'use strict';

(function (W, D, B) {
  const qs = new URLSearchParams(W.location.search);
  const $ = (id) => D.getElementById(id);

  const ACTIONS = [
    { id:'jab',   lane:0, label:'JAB',   icon:'👊', hint:'ฟ้า',   cls:'l0' },
    { id:'cross', lane:1, label:'CROSS', icon:'💥', hint:'ส้ม',   cls:'l1' },
    { id:'block', lane:2, label:'BLOCK', icon:'🛡', hint:'เขียว', cls:'l2' },
    { id:'duck',  lane:3, label:'DUCK',  icon:'⬇️', hint:'ม่วง',  cls:'l3' }
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
    hudSolved: $('hudSolved'),
    hudWrong: $('hudWrong'),
    hudStreak: $('hudStreak'),
    hudRound: $('hudRound'),
    hudTime: $('hudTime'),

    coachTitle: $('coachTitle'),
    coachText: $('coachText'),

    promptTitle: $('promptTitle'),
    promptSub: $('promptSub'),
    sequence: $('sequence'),
    choices: $('choices'),
    feedback: $('feedback'),
    countdown: $('countdown'),
    countdownNum: $('countdownNum'),
    cvrCrosshair: $('cvrCrosshair'),
    cvrFocus: $('cvrFocus'),

    summary: $('summary'),
    summaryTitle: $('summaryTitle'),
    summarySub: $('summarySub'),
    sumSolved: $('sumSolved'),
    sumWrong: $('sumWrong'),
    sumAcc: $('sumAcc'),
    sumRank: $('sumRank'),
    sumStreak: $('sumStreak'),
    sumAvg: $('sumAvg'),
    sumLevel: $('sumLevel'),
    sumTip: $('sumTip'),
    btnReplay: $('btnReplay'),
    btnNext: $('btnNext'),
    btnMainGame: $('btnMainGame'),
    btnHub: $('btnHub')
  };

  const state = {
    started: false,
    ended: false,
    startAt: 0,
    durationMs: B.clamp(params.time * 1000, 25000, 70000),

    rounds: 8,
    currentRound: 0,
    solved: 0,
    wrong: 0,
    streak: 0,
    bestStreak: 0,
    solveTimes: [],
    currentQuestion: null,
    answered: false,

    cvrIndex: 0,
    gamma: 0,
    gammaOffset: 0,
    gammaSmooth: 0,
    laneLockUntil: 0
  };

  function rng(seed) {
    let x = seed >>> 0;
    return function () {
      x ^= x << 13; x >>>= 0;
      x ^= x >>> 17; x >>>= 0;
      x ^= x << 5; x >>>= 0;
      return (x >>> 0) / 4294967296;
    };
  }
  const rand = rng(params.seed);

  function sample(arr) {
    return arr[Math.floor(rand() * arr.length)];
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  const PATTERNS_EASY = [
    { seq:['jab','cross','jab','cross'], answer:'jab',   tip:'สลับกันไปมา' },
    { seq:['block','duck','block','duck'], answer:'block', tip:'สลับกันไปมา' },
    { seq:['jab','jab','cross','jab','jab'], answer:'cross', tip:'จับกลุ่มซ้ำ 2-1' },
    { seq:['duck','block','duck','block'], answer:'duck', tip:'สลับกันไปมา' }
  ];

  const PATTERNS_NORMAL = [
    { seq:['jab','cross','block','jab','cross'], answer:'block', tip:'วนลำดับ 3 ตัว' },
    { seq:['duck','jab','duck','jab','duck'], answer:'jab', tip:'สลับ 2 ตัว' },
    { seq:['block','block','cross','block','block'], answer:'cross', tip:'รูปแบบ 2-1' },
    { seq:['jab','duck','cross','jab','duck'], answer:'cross', tip:'วนลำดับ 3 ตัว' },
    { seq:['cross','block','duck','cross','block'], answer:'duck', tip:'วนลำดับ 3 ตัว' }
  ];

  const PATTERNS_HARD = [
    { seq:['jab','cross','jab','block','jab','cross','jab'], answer:'block', tip:'จับ pattern 4 ตัวที่ซ่อนอยู่' },
    { seq:['duck','block','duck','jab','duck','block','duck'], answer:'jab', tip:'รูปแบบ 3-1 ซ้ำ' },
    { seq:['cross','cross','duck','block','cross','cross','duck'], answer:'block', tip:'รูปแบบ 2-1-1 ซ้ำ' },
    { seq:['jab','block','cross','duck','jab','block','cross'], answer:'duck', tip:'วนลำดับ 4 ตัว' }
  ];

  function setCoach(title, text) {
    if (els.coachTitle) els.coachTitle.textContent = title;
    if (els.coachText) els.coachText.textContent = text;
  }

  function avgSolveMs() {
    return Math.round(B.avg(state.solveTimes));
  }

  function accuracyPercent() {
    return B.accuracy(state.solved, state.solved + state.wrong);
  }

  function rankOf() {
    const acc = accuracyPercent();
    if (acc >= 94 && state.bestStreak >= 5) return 'S';
    if (acc >= 84 && state.bestStreak >= 3) return 'A';
    if (acc >= 70) return 'B';
    if (acc >= 55) return 'C';
    return 'D';
  }

  function bestTip() {
    if (accuracyPercent() < 60) return 'มองหาว่ารูปแบบกำลัง “สลับ” หรือ “วนซ้ำ”';
    if (state.bestStreak >= 4) return 'ดีมาก เริ่มเห็นโครงของ sequence แล้ว';
    if (params.diff === 'hard') return 'โจทย์ยากขึ้น ลองจับ pattern เป็นกลุ่ม 3–4 ตัว';
    return 'ลองดูว่าลำดับกำลังวนกลับมาตรงไหน';
  }

  function scoreFinal() {
    return state.solved * 10;
  }

  function updateHud(leftMs) {
    if (els.hudView) els.hudView.textContent = params.view.toUpperCase();
    if (els.hudSolved) els.hudSolved.textContent = String(state.solved);
    if (els.hudWrong) els.hudWrong.textContent = String(state.wrong);
    if (els.hudStreak) els.hudStreak.textContent = String(state.streak);
    if (els.hudRound) els.hudRound.textContent = `${Math.min(state.currentRound + 1, state.rounds)}/${state.rounds}`;
    if (els.hudTime) els.hudTime.textContent = `${Math.max(0, Math.ceil(leftMs / 1000))}`;
  }

  function makeQuestion() {
    let bank = PATTERNS_NORMAL;
    if (params.diff === 'easy') bank = PATTERNS_EASY;
    else if (params.diff === 'hard') bank = PATTERNS_HARD;

    const base = sample(bank);
    const correct = byId(base.answer);

    let choices = ACTIONS.map(a => a.id);
    choices = shuffle(choices).slice(0, 4);
    if (!choices.includes(correct.id)) {
      choices[0] = correct.id;
      choices = shuffle(choices);
    }

    return {
      seq: base.seq.slice(),
      answer: base.answer,
      tip: base.tip,
      choices
    };
  }

  function tokenHtml(id, isQuestion) {
    if (isQuestion) {
      return `
        <div class="seq-token">
          <div class="seq-icon">❓</div>
          <div class="seq-label">NEXT?</div>
        </div>
      `;
    }

    const a = byId(id);
    return `
      <div class="seq-token ${a.cls}">
        <div class="seq-icon">${a.icon}</div>
        <div class="seq-label">${a.label}</div>
      </div>
    `;
  }

  function choiceButtons() {
    return [...els.choices.querySelectorAll('.choice')];
  }

  function highlightFocusedChoice(index) {
    const buttons = choiceButtons();
    buttons.forEach((btn, idx) => {
      btn.classList.toggle('focus', idx === index);
    });

    const btn = buttons[index];
    if (!btn || !els.cvrFocus) return;

    const lane = Number(btn.dataset.lane);
    const action = byLane(lane);
    els.cvrFocus.textContent = action ? action.label : 'JAB';
  }

  function renderQuestion() {
    state.currentQuestion = makeQuestion();
    state.answered = false;

    if (els.sequence) {
      els.sequence.innerHTML = '';
      state.currentQuestion.seq.forEach((id, i) => {
        els.sequence.insertAdjacentHTML('beforeend', tokenHtml(id, false));
        if (i < state.currentQuestion.seq.length - 1) {
          els.sequence.insertAdjacentHTML('beforeend', `<div class="seq-join">→</div>`);
        }
      });
      els.sequence.insertAdjacentHTML('beforeend', `<div class="seq-join">→</div>`);
      els.sequence.insertAdjacentHTML('beforeend', tokenHtml('', true));
    }

    if (els.choices) {
      els.choices.innerHTML = state.currentQuestion.choices.map((id, idx) => {
        const a = byId(id);
        return `
          <button class="choice ${a.cls} cvr-target" data-id="${a.id}" data-lane="${a.lane}" type="button">
            <div class="choice-icon">${a.icon}</div>
            <div class="choice-label">${a.label}</div>
            <div class="choice-hint">${params.view === 'pc' ? `กด ${idx + 1}` : (params.view === 'cvr' ? 'เล็งแล้วกด' : 'แตะคำตอบ')}</div>
          </button>
        `;
      }).join('');
    }

    setCoach('หาคำตอบถัดไป', `ดู pattern ให้ดี — เคล็ดลับ: ${state.currentQuestion.tip}`);
    highlightFocusedChoice(state.cvrIndex);
  }

  function submitAnswer(id) {
    if (!state.started || state.ended || state.answered) return;
    if (!id) return;

    state.answered = true;
    const elapsed = performance.now() - state.startAt;
    const q = state.currentQuestion;
    const correct = q.answer === id;

    const buttons = choiceButtons();
    buttons.forEach((btn) => {
      const bid = btn.dataset.id;
      if (bid === q.answer) btn.classList.add('correct');
      if (bid === id && bid !== q.answer) btn.classList.add('wrong');
      btn.disabled = true;
    });

    if (correct) {
      state.solved += 1;
      state.streak += 1;
      state.bestStreak = Math.max(state.bestStreak, state.streak);
      state.solveTimes.push(elapsed);
      B.showFeedback(els.feedback, 'ถูกแล้ว!');
      setCoach('เยี่ยมมาก!', `ใช่เลย — ${q.tip}`);
    } else {
      state.wrong += 1;
      state.streak = 0;
      B.showFeedback(els.feedback, 'ลองดูใหม่');
      setCoach('เกือบถูกแล้ว', `คำตอบที่ถูกคือ ${byId(q.answer).label} — ${q.tip}`);
    }

    updateHud(Math.max(0, state.durationMs - elapsed));

    W.setTimeout(() => {
      state.currentRound += 1;
      if (state.currentRound >= state.rounds) {
        showSummary();
        return;
      }
      renderQuestion();
    }, 900);
  }

  function saveSummary() {
    const payload = {
      pid: params.pid,
      game: 'pattern-detective',
      gameId: 'pattern-detective',
      zone: params.zone,
      cat: params.cat,
      diff: params.diff,
      timeSec: Math.round(state.durationMs / 1000),
      view: params.view,
      runMode: params.run,
      scoreFinal: scoreFinal(),
      solved: state.solved,
      wrong: state.wrong,
      streak: state.bestStreak,
      avgSolveMs: avgSolveMs(),
      patternLevel: params.diff,
      accPct: accuracyPercent(),
      rank: rankOf(),
      durationSec: Math.round(state.durationMs / 1000),
      studyId: params.studyId,
      planDay: params.planDay,
      planSlot: params.planSlot,
      timestampIso: B.nowIso()
    };

    B.saveSummary('pattern-detective', params.pid, payload);
  }

  function showSummary() {
    state.ended = true;
    saveSummary();

    if (els.sumSolved) els.sumSolved.textContent = String(state.solved);
    if (els.sumWrong) els.sumWrong.textContent = String(state.wrong);
    if (els.sumAcc) els.sumAcc.textContent = `${accuracyPercent()}%`;
    if (els.sumRank) els.sumRank.textContent = rankOf();
    if (els.sumStreak) els.sumStreak.textContent = String(state.bestStreak);
    if (els.sumAvg) els.sumAvg.textContent = `${avgSolveMs()} ms`;
    if (els.sumLevel) els.sumLevel.textContent = params.diff;
    if (els.sumTip) els.sumTip.textContent = bestTip();

    if (els.summaryTitle) {
      els.summaryTitle.textContent =
        rankOf() === 'S' ? 'วิเคราะห์เก่งมาก!' :
        rankOf() === 'A' ? 'จับ pattern ได้ดี!' :
        'เริ่มเห็นโครงของ pattern แล้ว!';
    }

    if (els.summarySub) {
      els.summarySub.textContent =
        'มินิเกมนี้ช่วยให้เด็กอ่าน sequence และเดาลำดับถัดไปก่อนเข้า main game';
    }

    if (els.summary) els.summary.classList.remove('hidden');
  }

  function bindInputs() {
    if (els.choices) {
      els.choices.addEventListener('pointerdown', (e) => {
        const btn = e.target.closest('.choice');
        if (!btn) return;
        e.preventDefault();
        submitAnswer(btn.dataset.id);
      }, { passive:false });

      els.choices.addEventListener('touchstart', (e) => {
        const btn = e.target.closest('.choice');
        if (!btn) return;
        e.preventDefault();
        submitAnswer(btn.dataset.id);
      }, { passive:false });
    }

    W.addEventListener('keydown', (e) => {
      const k = String(e.key || '').toLowerCase();
      if (k === '1') submitAnswer(choiceButtons()[0]?.dataset.id);
      else if (k === '2') submitAnswer(choiceButtons()[1]?.dataset.id);
      else if (k === '3') submitAnswer(choiceButtons()[2]?.dataset.id);
      else if (k === '4') submitAnswer(choiceButtons()[3]?.dataset.id);
      else if (params.view === 'cvr' && (k === ' ' || k === 'enter')) {
        e.preventDefault();
        submitAnswer(choiceButtons()[state.cvrIndex]?.dataset.id);
      } else if (params.view === 'cvr' && k === 'r') {
        e.preventDefault();
        B.reCenterCvr(state, els.feedback);
      }
    }, { passive:false });

    if (params.view === 'cvr') {
      B.attachCvrInput({
        state,
        onShoot: () => submitAnswer(choiceButtons()[state.cvrIndex]?.dataset.id),
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

    showCorrectView();
    updateHud(state.durationMs);
    bindInputs();

    if (params.view === 'cvr') {
      await B.loadVrUiIfNeeded(params.view);
      const loop = B.makeCvrFocusLoop(
        state,
        () => choiceButtons().length || 4,
        (idx) => highlightFocusedChoice(idx)
      );
      loop();
    }

    if (els.btnReplay) {
      els.btnReplay.addEventListener('click', () => {
        const u = new URL(W.location.href);
        u.searchParams.set('seed', String(Date.now()));
        W.location.href = u.toString();
      });
    }

    B.startCountdown(els.countdown, els.countdownNum, 3, () => {
      state.started = true;
      state.startAt = performance.now();
      renderQuestion();
    });

    W.requestAnimationFrame(tick);
  }

  boot();
})(window, document, window.RBBloom);