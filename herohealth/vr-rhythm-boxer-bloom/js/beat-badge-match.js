// /herohealth/vr-rhythm-boxer-bloom/js/beat-badge-match.js
'use strict';

(function (W, D, B) {
  const qs = new URLSearchParams(W.location.search);
  const $ = (id) => D.getElementById(id);

  const ACTIONS = [
    { id:'jab', label:'JAB', icon:'👊', hint:'หมัดตรง', lane:0 },
    { id:'cross', label:'CROSS', icon:'💥', hint:'หมัดแรง', lane:1 },
    { id:'block', label:'BLOCK', icon:'🛡', hint:'ตั้งการ์ด', lane:2 },
    { id:'duck', label:'DUCK', icon:'⬇️', hint:'หลบต่ำ', lane:3 }
  ];

  const params = B.createParams(qs, {
    back: '../vr-rhythm-boxer-bloom/index.html',
    next: '../vr-rhythm-boxer-bloom/hit-line-coach.html'
  });

  const els = {
    btnBack: $('btnBack'),
    btnHubTop: $('btnHubTop'),
    hudView: $('hudView'),
    hudCorrect: $('hudCorrect'),
    hudWrong: $('hudWrong'),
    hudRound: $('hudRound'),
    hudAvg: $('hudAvg'),
    hudTime: $('hudTime'),

    coachTitle: $('coachTitle'),
    coachText: $('coachText'),

    symbolIcon: $('symbolIcon'),
    choices: $('choices'),
    feedback: $('feedback'),
    countdown: $('countdown'),
    countdownNum: $('countdownNum'),
    cvrCrosshair: $('cvrCrosshair'),
    cvrFocus: $('cvrFocus'),

    summary: $('summary'),
    summaryTitle: $('summaryTitle'),
    summarySub: $('summarySub'),
    sumCorrect: $('sumCorrect'),
    sumWrong: $('sumWrong'),
    sumAcc: $('sumAcc'),
    sumRank: $('sumRank'),
    sumAvg: $('sumAvg'),
    sumLevel: $('sumLevel'),
    sumScore: $('sumScore'),
    sumTip: $('sumTip'),
    btnReplayPage: $('btnReplayPage'),
    btnNext: $('btnNext'),
    btnMainGame: $('btnMainGame'),
    btnHub: $('btnHub')
  };

  const state = {
    started: false,
    ended: false,
    startAt: 0,
    durationMs: B.clamp(params.time * 1000, 25000, 70000),
    rounds: params.diff === 'hard' ? 10 : 8,
    currentRound: 0,
    correct: 0,
    wrong: 0,
    responseTimes: [],
    answered: false,
    currentQuestion: null,

    cvrIndex: 0,
    gamma: 0,
    gammaOffset: 0,
    gammaSmooth: 0,
    laneLockUntil: 0
  };

  function rng(seed){
    let x = seed >>> 0;
    return function(){
      x ^= x << 13; x >>>= 0;
      x ^= x >>> 17; x >>>= 0;
      x ^= x << 5; x >>>= 0;
      return (x >>> 0) / 4294967296;
    };
  }
  const rand = rng(params.seed);

  function sample(arr){
    return arr[Math.floor(rand() * arr.length)];
  }

  function shuffle(arr){
    const a = arr.slice();
    for(let i = a.length - 1; i > 0; i--){
      const j = Math.floor(rand() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function avgResponseMs(){
    return Math.round(B.avg(state.responseTimes));
  }

  function accuracyPercent(){
    return B.accuracy(state.correct, state.correct + state.wrong);
  }

  function rankOf(){
    const acc = accuracyPercent();
    const avg = avgResponseMs();

    if (acc >= 95 && avg <= 1200) return 'S';
    if (acc >= 85 && avg <= 1800) return 'A';
    if (acc >= 70) return 'B';
    if (acc >= 55) return 'C';
    return 'D';
  }

  function scoreFinal(){
    return (state.correct * 10) - (state.wrong * 2);
  }

  function bestTip(){
    const acc = accuracyPercent();
    const avg = avgResponseMs();

    if (acc < 60) return 'ทวนชื่อกับสัญลักษณ์อีกนิด';
    if (avg > 2200) return 'จำ icon ให้ไวขึ้นอีกหน่อย';
    if (acc >= 90) return 'จำสัญลักษณ์ได้แม่นแล้ว';
    return 'เริ่มจับคู่ icon ได้ดีขึ้นแล้ว';
  }

  function setCoach(title, text){
    if (els.coachTitle) els.coachTitle.textContent = title;
    if (els.coachText) els.coachText.textContent = text;
  }

  function updateHud(leftMs){
    els.hudView.textContent = params.view.toUpperCase();
    els.hudCorrect.textContent = String(state.correct);
    els.hudWrong.textContent = String(state.wrong);
    els.hudRound.textContent = `${Math.min(state.currentRound + 1, state.rounds)}/${state.rounds}`;
    els.hudAvg.textContent = `${avgResponseMs()} ms`;
    els.hudTime.textContent = `${Math.max(0, Math.ceil(leftMs / 1000))}`;
  }

  function choiceButtons(){
    return [...els.choices.querySelectorAll('.choice')];
  }

  function highlightFocusedChoice(index){
    const buttons = choiceButtons();
    buttons.forEach((btn, idx) => btn.classList.toggle('focus', idx === index));
    const btn = buttons[index];
    if (!btn || !els.cvrFocus) return;

    const lane = Number(btn.dataset.lane);
    const action = ACTIONS.find(a => a.lane === lane);
    els.cvrFocus.textContent = action ? action.label : 'JAB';
  }

  function renderQuestion(){
    const answer = sample(ACTIONS);
    const choices = shuffle(ACTIONS);

    state.currentQuestion = {
      answer: answer.id,
      icon: answer.icon,
      choices
    };
    state.answered = false;

    els.symbolIcon.textContent = answer.icon;
    els.choices.innerHTML = choices.map((a, idx) => `
      <button class="choice cvr-target" data-id="${a.id}" data-lane="${a.lane}" type="button">
        <div class="big">${a.label}</div>
        <div class="small">${params.view === 'pc' ? `กด ${idx + 1}` : (params.view === 'cvr' ? 'เล็งแล้วกด' : a.hint)}</div>
      </button>
    `).join('');

    highlightFocusedChoice(state.cvrIndex);
  }

  function submitAnswer(id){
    if (!state.started || state.ended || state.answered) return;
    if (!id) return;

    state.answered = true;
    const elapsed = performance.now() - state.startAt;
    state.responseTimes.push(elapsed);

    const correct = id === state.currentQuestion.answer;
    const buttons = choiceButtons();

    buttons.forEach((btn) => {
      const bid = btn.dataset.id;
      if (bid === state.currentQuestion.answer) btn.classList.add('correct');
      if (bid === id && bid !== state.currentQuestion.answer) btn.classList.add('wrong');
      btn.disabled = true;
    });

    if (correct){
      state.correct += 1;
      B.showFeedback(els.feedback, 'ถูกแล้ว!');
      setCoach('เยี่ยมมาก!', 'ใช่เลย จำสัญลักษณ์นี้ได้แล้ว');
    } else {
      state.wrong += 1;
      const ans = ACTIONS.find(a => a.id === state.currentQuestion.answer);
      B.showFeedback(els.feedback, 'ลองอีกนิด');
      setCoach(`คำตอบคือ ${ans.label}`, 'ค่อย ๆ จับคู่ icon กับชื่อ action ให้แม่น');
    }

    updateHud(Math.max(0, state.durationMs - elapsed));

    W.setTimeout(() => {
      state.currentRound += 1;
      if (state.currentRound >= state.rounds){
        showSummary();
        return;
      }
      renderQuestion();
    }, 850);
  }

  function saveSummary(){
    const payload = {
      pid: params.pid,
      game: 'beat-badge-match',
      gameId: 'beat-badge-match',
      zone: params.zone,
      cat: params.cat,
      diff: params.diff,
      timeSec: Math.round(state.durationMs / 1000),
      view: params.view,
      runMode: params.run,
      scoreFinal: scoreFinal(),
      correct: state.correct,
      wrong: state.wrong,
      accPct: accuracyPercent(),
      avgResponseMs: avgResponseMs(),
      rank: rankOf(),
      durationSec: Math.round(state.durationMs / 1000),
      studyId: params.studyId,
      planDay: params.planDay,
      planSlot: params.planSlot,
      timestampIso: B.nowIso()
    };

    B.saveSummary('beat-badge-match', params.pid, payload);
  }

  function showSummary(){
    state.ended = true;
    saveSummary();

    els.sumCorrect.textContent = String(state.correct);
    els.sumWrong.textContent = String(state.wrong);
    els.sumAcc.textContent = `${accuracyPercent()}%`;
    els.sumRank.textContent = rankOf();
    els.sumAvg.textContent = `${avgResponseMs()} ms`;
    els.sumLevel.textContent = params.diff;
    els.sumScore.textContent = String(scoreFinal());
    els.sumTip.textContent = bestTip();

    els.summaryTitle.textContent =
      rankOf() === 'S' ? 'จำได้สุดยอดมาก!' :
      rankOf() === 'A' ? 'จำสัญลักษณ์ได้ดี!' :
      'เริ่มจับคู่ได้แล้ว!';
    els.summarySub.textContent =
      'มินิเกมนี้ช่วยให้เด็กตอบได้ทันทีว่า icon แต่ละแบบคือ action อะไร';

    els.summary.classList.remove('hidden');
  }

  function bindInputs(){
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

    W.addEventListener('keydown', (e) => {
      const k = String(e.key || '').toLowerCase();
      if (k === '1') submitAnswer(choiceButtons()[0]?.dataset.id);
      else if (k === '2') submitAnswer(choiceButtons()[1]?.dataset.id);
      else if (k === '3') submitAnswer(choiceButtons()[2]?.dataset.id);
      else if (k === '4') submitAnswer(choiceButtons()[3]?.dataset.id);
      else if (params.view === 'cvr' && (k === ' ' || k === 'enter')){
        e.preventDefault();
        submitAnswer(choiceButtons()[state.cvrIndex]?.dataset.id);
      } else if (params.view === 'cvr' && k === 'r'){
        e.preventDefault();
        B.reCenterCvr(state, els.feedback);
      }
    }, { passive:false });

    if (params.view === 'cvr'){
      B.attachCvrInput({
        state,
        onShoot: () => submitAnswer(choiceButtons()[state.cvrIndex]?.dataset.id),
        onRecenter: () => B.reCenterCvr(state, els.feedback)
      });
    }
  }

  function showCorrectView(){
    const isCvr = params.view === 'cvr';
    if (els.cvrCrosshair) els.cvrCrosshair.classList.toggle('hidden', !isCvr);
    if (els.cvrFocus) els.cvrFocus.classList.toggle('hidden', !isCvr);
  }

  function tick(now){
    if (!state.started){
      updateHud(state.durationMs);
      W.requestAnimationFrame(tick);
      return;
    }

    const elapsed = now - state.startAt;
    const left = Math.max(0, state.durationMs - elapsed);
    updateHud(left);

    if (elapsed >= state.durationMs){
      showSummary();
      return;
    }

    W.requestAnimationFrame(tick);
  }

  async function boot(){
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

    if (params.view === 'cvr'){
      await B.loadVrUiIfNeeded(params.view);
      const loop = B.makeCvrFocusLoop(
        state,
        () => choiceButtons().length,
        (idx) => highlightFocusedChoice(idx)
      );
      loop();
    }

    if (els.btnReplayPage){
      els.btnReplayPage.addEventListener('click', () => {
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