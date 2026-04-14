// /herohealth/vr-rhythm-boxer-bloom/js/hit-line-coach.js
'use strict';

(function (W, D, B) {
  const qs = new URLSearchParams(W.location.search);
  const $ = (id) => D.getElementById(id);

  const ACTIONS = [
    { lane:0, key:'a', label:'JAB',   icon:'👊' },
    { lane:1, key:'l', label:'CROSS', icon:'💥' },
    { lane:2, key:'w', label:'BLOCK', icon:'🛡' },
    { lane:3, key:'s', label:'DUCK',  icon:'⬇️' }
  ];

  const params = B.createParams(qs, {
    back: '../vr-rhythm-boxer-bloom/index.html',
    next: '../vr-rhythm-boxer-main/boxer.html'
  });

  const els = {
    btnBack: $('btnBack'),
    btnHubTop: $('btnHubTop'),
    hudView: $('hudView'),
    hudPerfect: $('hudPerfect'),
    hudEarly: $('hudEarly'),
    hudLate: $('hudLate'),
    hudMiss: $('hudMiss'),
    hudTime: $('hudTime'),

    coachTitle: $('coachTitle'),
    coachText: $('coachText'),

    singleArena: $('singleArena'),
    cvrArena: $('cvrArena'),
    laneGuide: $('laneGuide'),
    noteLayer: $('noteLayer'),
    noteLayerL: $('noteLayerL'),
    noteLayerR: $('noteLayerR'),
    countdown: $('countdown'),
    countdownNum: $('countdownNum'),
    feedback: $('feedback'),

    cvrCrosshair: $('cvrCrosshair'),
    cvrFocus: $('cvrFocus'),

    summary: $('summary'),
    summaryTitle: $('summaryTitle'),
    summarySub: $('summarySub'),
    sumPerfect: $('sumPerfect'),
    sumEarly: $('sumEarly'),
    sumLate: $('sumLate'),
    sumMiss: $('sumMiss'),
    sumAcc: $('sumAcc'),
    sumRank: $('sumRank'),
    sumTip: $('sumTip'),
    sumDur: $('sumDur'),
    btnReplay: $('btnReplay'),
    btnNext: $('btnNext'),
    btnMainGame: $('btnMainGame'),
    btnHub: $('btnHub')
  };

  const hitZones = [...D.querySelectorAll('.hit-zone')];
  const singleLanes = [...D.querySelectorAll('#singleArena .lane')];
  const cvrLanes = [...D.querySelectorAll('#cvrArena .lane')];

  const state = {
    started: false,
    ended: false,
    startAt: 0,
    durationMs: B.clamp(params.time * 1000, 25000, 60000),
    noteTravelMs: params.view === 'pc' ? 1800 : (params.view === 'cvr' ? 2000 : 1900),

    currentLane: 0,
    gamma: 0,
    gammaOffset: 0,
    gammaSmooth: 0,
    cvrIndex: 0,
    laneLockUntil: 0,
    lastCueAt: 0,

    perfect: 0,
    early: 0,
    late: 0,
    miss: 0,
    total: 0,

    notes: []
  };

  function setCoach(title, text){
    if (els.coachTitle) els.coachTitle.textContent = title;
    if (els.coachText) els.coachText.textContent = text;
  }

  function updateHud(leftMs){
    if (els.hudView) els.hudView.textContent = params.view.toUpperCase();
    if (els.hudPerfect) els.hudPerfect.textContent = String(state.perfect);
    if (els.hudEarly) els.hudEarly.textContent = String(state.early);
    if (els.hudLate) els.hudLate.textContent = String(state.late);
    if (els.hudMiss) els.hudMiss.textContent = String(state.miss);
    if (els.hudTime) els.hudTime.textContent = `${Math.max(0, Math.ceil(leftMs / 1000))}`;
  }

  function laneLabel(lane){
    return ACTIONS[lane]?.label || 'JAB';
  }

  function highlightLane(lane){
    state.currentLane = lane;

    hitZones.forEach((el) => el.classList.toggle('glow', Number(el.dataset.lane) === lane));
    singleLanes.forEach((el) => el.classList.toggle('focus', Number(el.dataset.lane) === lane));
    cvrLanes.forEach((el) => el.classList.toggle('focus', Number(el.dataset.lane) === lane));

    if (els.cvrFocus) els.cvrFocus.textContent = laneLabel(lane);
  }

  function cueLane(lane){
    const cueNodes = (nodes) => {
      nodes.forEach((el) => {
        if (Number(el.dataset.lane) === lane) {
          el.classList.add('cue');
          W.setTimeout(() => el.classList.remove('cue'), 140);
        }
      });
    };

    cueNodes(singleLanes);
    cueNodes(cvrLanes);

    hitZones.forEach((el) => {
      if (Number(el.dataset.lane) === lane) {
        el.classList.add('glow');
        W.setTimeout(() => el.classList.remove('glow'), 140);
      }
    });
  }

  function noteNode(lane){
    const n = D.createElement('div');
    n.className = `note lane-${lane}`;
    n.textContent = ACTIONS[lane].icon;
    n.dataset.lane = String(lane);
    n.style.pointerEvents = 'auto';
    n.style.touchAction = 'manipulation';

    const fire = (e) => {
      e.preventDefault();
      e.stopPropagation();
      submitLane(lane);
    };

    n.addEventListener('pointerdown', fire, { passive:false });
    n.addEventListener('touchstart', fire, { passive:false });

    return n;
  }

  function removeNoteVisuals(note){
    if (note.el) {
      note.el.remove();
      note.el = null;
    }
    if (note.elL) {
      note.elL.remove();
      note.elL = null;
    }
    if (note.elR) {
      note.elR.remove();
      note.elR = null;
    }
  }

  function generateSequence(){
    const sequence = [];
    let t = 1400;
    const spacing = params.diff === 'hard' ? 1200 : (params.diff === 'easy' ? 1450 : 1320);

    const fixed =
      params.diff === 'easy'
        ? [0,0,1,1,2,2,3,3]
        : params.diff === 'hard'
          ? [0,1,2,3,1,0,3,2,0,1]
          : [0,1,0,2,1,3,0,1,2,3];

    for (let i = 0; i < fixed.length; i++) {
      sequence.push({
        id: `n${i + 1}`,
        lane: fixed[i],
        hitTime: t,
        judged: false,
        result: '',
        el: null,
        elL: null,
        elR: null
      });
      t += spacing;
    }

    state.total = sequence.length;
    return sequence;
  }

  function buildNotes(){
    state.notes = generateSequence();

    for (const note of state.notes) {
      if (params.view === 'cvr') {
        note.elL = noteNode(note.lane);
        note.elR = noteNode(note.lane);
        if (els.noteLayerL) els.noteLayerL.appendChild(note.elL);
        if (els.noteLayerR) els.noteLayerR.appendChild(note.elR);
      } else {
        note.el = noteNode(note.lane);
        if (els.noteLayer) els.noteLayer.appendChild(note.el);
      }
    }
  }

  function layoutInViewport(noteEl, lane, elapsed, viewportRect, hitPx, hitTime){
    if (!noteEl || !viewportRect) return;

    const laneWidth = viewportRect.width / 4;
    const laneCenterX = (laneWidth * lane) + (laneWidth / 2);
    const startY = 20;

    const progress = (elapsed - (hitTime - state.noteTravelMs)) / state.noteTravelMs;
    const easedCore = B.clamp(progress, 0, 1);
    const eased = 1 - Math.pow(1 - easedCore, 2.15);
    const y = startY + ((hitPx - startY) * eased);

    noteEl.style.left = `${laneCenterX}px`;
    noteEl.style.transform = `translate(-50%, ${y}px) scale(${0.88 + eased * 0.16})`;

    if (progress < -0.15 || progress > 1.25) noteEl.style.display = 'none';
    else noteEl.style.display = '';
  }

  function renderNotes(elapsed){
    if (params.view === 'cvr') {
      const paneL = els.cvrArena?.children?.[0];
      const paneR = els.cvrArena?.children?.[1];
      const rectL = paneL?.getBoundingClientRect();
      const rectR = paneR?.getBoundingClientRect();
      if (!rectL || !rectR) return;

      const hitLinePx = rectL.height - 132;

      for (const note of state.notes) {
        if (note.judged) {
          removeNoteVisuals(note);
          continue;
        }

        layoutInViewport(note.elL, note.lane, elapsed, rectL, hitLinePx, note.hitTime);
        layoutInViewport(note.elR, note.lane, elapsed, rectR, hitLinePx, note.hitTime);

        const dt = note.hitTime - elapsed;
        if (dt < 260 && dt > 120 && performance.now() - state.lastCueAt > 80) {
          state.lastCueAt = performance.now();
          cueLane(note.lane);
        }
      }
      return;
    }

    const rect = els.singleArena?.getBoundingClientRect();
    if (!rect) return;

    const hitLinePx = rect.height - 132;

    for (const note of state.notes) {
      if (note.judged) {
        removeNoteVisuals(note);
        continue;
      }

      layoutInViewport(note.el, note.lane, elapsed, rect, hitLinePx, note.hitTime);

      const dt = note.hitTime - elapsed;
      if (dt < 260 && dt > 120 && performance.now() - state.lastCueAt > 80) {
        state.lastCueAt = performance.now();
        cueLane(note.lane);
      }
    }
  }

  function nearestNote(lane, elapsed){
    let best = null;
    let bestAbs = 999999;

    for (const note of state.notes) {
      if (note.judged || note.lane !== lane) continue;
      const d = elapsed - note.hitTime;
      const a = Math.abs(d);
      if (a < bestAbs) {
        bestAbs = a;
        best = { note, offset: d };
      }
    }
    return best;
  }

  function judgeOffset(offset){
    const abs = Math.abs(offset);
    if (abs <= 120) return 'perfect';
    if (offset < -120 && offset >= -320) return 'early';
    if (offset > 120 && offset <= 320) return 'late';
    return 'miss';
  }

  function submitLane(lane){
    if (!state.started || state.ended) return;

    highlightLane(lane);

    const elapsed = performance.now() - state.startAt;
    const found = nearestNote(lane, elapsed);

    if (!found) {
      B.showFeedback(els.feedback, 'ยังไม่ถึงเส้น');
      setCoach('รออีกนิด', 'ถ้าโน้ตยังอยู่สูง ให้รอจนลงมาใกล้เส้นเหลืองก่อน');
      return;
    }

    const { note, offset } = found;
    const judge = judgeOffset(offset);

    note.judged = true;
    removeNoteVisuals(note);

    if (judge === 'perfect') {
      state.perfect += 1;
      note.result = 'perfect';
      B.showFeedback(els.feedback, 'PERFECT!');
      setCoach('ตรงจังหวะ!', 'แบบนี้แหละ รอให้ชนเส้นก่อนแล้วค่อยกด');
    } else if (judge === 'early') {
      state.early += 1;
      note.result = 'early';
      B.showFeedback(els.feedback, 'เร็วไป');
      setCoach('เร็วไปนิด', 'ครั้งหน้ารอให้ลงมาใกล้เส้นกว่านี้อีกนิด');
    } else if (judge === 'late') {
      state.late += 1;
      note.result = 'late';
      B.showFeedback(els.feedback, 'ช้าไป');
      setCoach('ช้าไปนิด', 'ต้องกดเร็วกว่านี้ตอนแตะเส้นพอดี');
    } else {
      state.miss += 1;
      note.result = 'miss';
      B.showFeedback(els.feedback, 'MISS');
      setCoach('พลาดแล้ว', 'ไม่ต้องไล่แตะกลางจออย่างเดียว ดูเส้นเหลืองแล้วกดตอนชนเส้น');
    }

    updateHud(Math.max(0, state.durationMs - elapsed));
  }

  function handleAutoMiss(elapsed){
    for (const note of state.notes) {
      if (note.judged) continue;
      if (elapsed > note.hitTime + 340) {
        note.judged = true;
        note.result = 'miss';
        state.miss += 1;
        removeNoteVisuals(note);
        setCoach('มองเส้นก่อน', 'คราวหน้าให้ล็อกสายตาที่เส้นเหลือง แล้วดูว่าโน้ตอยู่เลนไหน');
      }
    }
  }

  function accuracyPercent(){
    const ok = state.perfect + state.early + state.late;
    return B.accuracy(ok, state.total);
  }

  function rankOf(){
    const acc = accuracyPercent();
    if (state.perfect >= 7 && acc >= 90) return 'S';
    if (state.perfect >= 5 && acc >= 82) return 'A';
    if (acc >= 70) return 'B';
    if (acc >= 55) return 'C';
    return 'D';
  }

  function bestTip(){
    if (state.early > state.late && state.early >= 2) return 'กดช้าอีกนิด รอให้ถึงเส้น';
    if (state.late > state.early && state.late >= 2) return 'กดไวขึ้นอีกนิด ตอนชนเส้นพอดี';
    if (state.miss >= 3) return 'มองเส้นเหลืองก่อน แล้วแตะเลนหรือแตะตัวโน้ตก็ได้';
    return 'เยี่ยมมาก เริ่มเข้าใจ hit line แล้ว';
  }

  function saveSummary(){
    const payload = {
      pid: params.pid,
      game: 'hit-line-coach',
      gameId: 'hit-line-coach',
      zone: params.zone,
      cat: params.cat,
      diff: params.diff,
      timeSec: Math.round(state.durationMs / 1000),
      view: params.view,
      runMode: params.run,
      scoreFinal: state.perfect * 3 + state.early + state.late,
      perfect: state.perfect,
      early: state.early,
      late: state.late,
      miss: state.miss,
      accPct: accuracyPercent(),
      rank: rankOf(),
      learnedHitTiming: state.perfect >= 4 ? 1 : 0,
      durationSec: Math.round(state.durationMs / 1000),
      studyId: params.studyId,
      planDay: params.planDay,
      planSlot: params.planSlot,
      timestampIso: B.nowIso()
    };

    B.saveSummary('hit-line-coach', params.pid, payload);
  }

  function showSummary(){
    state.ended = true;
    saveSummary();

    if (els.sumPerfect) els.sumPerfect.textContent = String(state.perfect);
    if (els.sumEarly) els.sumEarly.textContent = String(state.early);
    if (els.sumLate) els.sumLate.textContent = String(state.late);
    if (els.sumMiss) els.sumMiss.textContent = String(state.miss);
    if (els.sumAcc) els.sumAcc.textContent = `${accuracyPercent()}%`;
    if (els.sumRank) els.sumRank.textContent = rankOf();
    if (els.sumTip) els.sumTip.textContent = bestTip();
    if (els.sumDur) els.sumDur.textContent = `${Math.round(state.durationMs / 1000)}s`;

    if (els.summaryTitle) {
      els.summaryTitle.textContent =
        rankOf() === 'S' ? 'สุดยอดมาก!' :
        rankOf() === 'A' ? 'เข้าใจแล้ว!' :
        'ใกล้จับจังหวะได้แล้ว!';
    }

    if (els.summarySub) {
      els.summarySub.textContent =
        'ด่านนี้เน้นให้เด็กเข้าใจว่า ต้องแตะตอนโน้ตชนเส้นเหลือง โดยแตะที่โน้ตหรือเลนก็ได้';
    }

    if (els.summary) els.summary.classList.remove('hidden');
  }

  function bindInputs(){
    const tapTargets = [
      ...D.querySelectorAll('#singleArena .lane'),
      ...D.querySelectorAll('#cvrArena .lane'),
      ...D.querySelectorAll('.hit-zone')
    ];

    tapTargets.forEach((node) => {
      const fire = (e) => {
        e.preventDefault();
        const lane = Number(node.dataset.lane || node.closest('[data-lane]')?.dataset.lane);
        if (!Number.isFinite(lane)) return;
        submitLane(lane);
      };

      node.addEventListener('pointerdown', fire, { passive:false });
      node.addEventListener('touchstart', fire, { passive:false });
    });

    W.addEventListener('keydown', (e) => {
      const k = String(e.key || '').toLowerCase();
      if (k === 'a') submitLane(0);
      else if (k === 'l') submitLane(1);
      else if (k === 'w') submitLane(2);
      else if (k === 's') submitLane(3);
      else if (params.view === 'cvr' && (k === ' ' || k === 'enter')){
        e.preventDefault();
        submitLane(state.currentLane);
      } else if (params.view === 'cvr' && k === 'r'){
        e.preventDefault();
        B.reCenterCvr(state, els.feedback);
      }
    }, { passive:false });

    if (params.view === 'cvr'){
      B.attachCvrInput({
        state,
        onShoot: () => submitLane(state.currentLane),
        onRecenter: () => B.reCenterCvr(state, els.feedback)
      });
    }
  }

  function showCorrectView(){
    const isCvr = params.view === 'cvr';

    if (els.singleArena) els.singleArena.classList.toggle('hidden', isCvr);
    if (els.cvrArena) els.cvrArena.classList.toggle('hidden', !isCvr);
    if (els.cvrCrosshair) els.cvrCrosshair.classList.toggle('hidden', !isCvr);
    if (els.cvrFocus) els.cvrFocus.classList.toggle('hidden', !isCvr);

    if (isCvr && els.laneGuide) {
      els.laneGuide.innerHTML = 'เล็งเลนด้วยหัว แล้วกดตอนถึงเส้น<small>ใช้ trigger / tap / Space ก็ได้</small>';
    } else if (els.laneGuide) {
      els.laneGuide.innerHTML = 'แตะที่ตัวโน้ต หรือแตะที่เลนล่างตอนชนเส้นก็ได้';
    }
  }

  function tick(now){
    if (!state.started) {
      updateHud(state.durationMs);
      W.requestAnimationFrame(tick);
      return;
    }

    const elapsed = now - state.startAt;
    const left = Math.max(0, state.durationMs - elapsed);

    renderNotes(elapsed);
    handleAutoMiss(elapsed);
    updateHud(left);

    if (elapsed >= state.durationMs) {
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
    buildNotes();
    bindInputs();
    updateHud(state.durationMs);
    highlightLane(0);

    if (params.view === 'cvr') {
      await B.loadVrUiIfNeeded(params.view);
      const loop = B.makeCvrFocusLoop(
        state,
        () => 4,
        (idx) => {
          state.currentLane = idx;
          highlightLane(idx);
        }
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
      setCoach('เริ่มได้เลย', 'มองเส้นเหลือง แล้วแตะที่ตัวโน้ตหรือแตะเลนตอนชนเส้นก็ได้');
    });

    W.requestAnimationFrame(tick);
  }

  boot();
})(window, document, window.RBBloom);
