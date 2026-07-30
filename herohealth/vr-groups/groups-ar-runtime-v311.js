(() => {
  'use strict';

  const B = window.GroupsARBank;
  const $ = (id) => document.getElementById(id);
  const q = new URLSearchParams(location.search);
  const VERSION = 'groups-ar-v5.0.0-thai-student-strict-ar';

  if (!B) {
    document.body.innerHTML = '<main style="padding:24px;font-family:system-ui"><h1>เปิดเกมไม่สำเร็จ</h1><p>คลังอาหารโหลดไม่ครบ กรุณาตรวจอินเทอร์เน็ตแล้วลองใหม่</p></main>';
    return;
  }

  const recent = (() => {
    try { return JSON.parse(localStorage.getItem('HHA_GROUPS_AR_RECENT_ITEMS') || '[]'); }
    catch (_) { return []; }
  })();

  const read = (key, fallback) => q.get(key) || fallback;
  const number = (key, fallback, min, max) => Math.max(min, Math.min(max, Number(read(key, fallback)) || fallback));
  const bool = (key) => /^(1|true|yes)$/i.test(read(key, ''));
  const shuffle = (list) => {
    const out = [...list];
    for (let i = out.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  };
  const iso = () => new Date().toISOString();
  const qa = (() => {
    try { return JSON.parse(localStorage.getItem('HHA_GROUPS_AR_QA_PROFILE') || 'null'); }
    catch (_) { return null; }
  })();

  const ID = {
    studentId: read('studentId', read('pid', 'anon')),
    studentName: read('studentName', read('name', 'Hero')),
    section: read('section', read('classSection', '')),
    studyId: read('studyId', ''),
    conditionGroup: read('conditionGroup', '')
  };

  const CFG = {
    diff: read('diff', 'normal'),
    variant: read('variant', 'normal'),
    time: number('time', 300, 120, 900),
    api: read('api', ''),
    log: bool('log'),
    hub: read('hub', '../nutrition-zone.html'),
    pinchClose: number('pinchClose', qa?.pinchClose || 0.057, 0.035, 0.085),
    pinchOpen: number('pinchOpen', qa?.pinchOpen || 0.09, 0.055, 0.14),
    detectEvery: number('detectEveryMs', qa?.detectEveryMs || 38, 28, 75),
    maxFoods: number('maxFoods', qa?.maxFoods || 2, 1, 2)
  };

  const E = {
    camera: $('camera'), arena: $('arena'), layer: $('foodLayer'), hand: $('hand'),
    phase: $('phaseTitle'), phaseSub: $('phaseSub'), cameraBadge: $('cameraBadge'), cameraText: $('cameraText'),
    score: $('score'), acc: $('acc'), combo: $('combo'), time: $('time'),
    boss: $('boss'), bossPhase: $('bossPhase'), bossHp: $('bossHp'), bossSkill: $('bossSkill'),
    feedback: $('feedback'), bins: [...document.querySelectorAll('.bin')],
    cue: $('cue'), cueTitle: $('cueTitle'), cueSub: $('cueSub'), intro: $('intro'),
    reason: $('reason'), reasonLabel: $('reasonLabel'), reasonQ: $('reasonQ'), answers: $('answers'),
    summary: $('summary'), sumIcon: $('sumIcon'), sumTitle: $('sumTitle'), sumSub: $('sumSub'),
    summaryGrid: $('summaryGrid'), bars: $('bars'), delivery: $('delivery'),
    startCamera: $('startCamera'), openQa: $('openQa'), qaBtn: $('qaBtn'),
    arOnlyBlock: $('arOnlyBlock'), arOnlyTitle: $('arOnlyTitle'), arOnlyMessage: $('arOnlyMessage'),
    retryAr: $('retryAr')
  };

  const blankGroups = () => Object.fromEntries(
    [1, 2, 3, 4, 5].map((group) => [group, { total: 0, correct: 0, retryTotal: 0, retryCorrect: 0 }])
  );

  const S = {
    started: false, ended: false, input: 'hand-ar-only', stream: null, tracker: null,
    handReady: false, cameraOpening: false, frames: 0, handFrames: 0, handScores: [],
    lastVideo: -1, lastDetect: 0, pinching: false, pinches: 0, selected: null,
    active: new Map(), phase: 'camera', phaseIndex: -1, queue: [], wrong: [], events: [],
    attemptId: `groups-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    score: 0, total: 0, correct: 0, firstTotal: 0, firstCorrect: 0,
    retryTotal: 0, retryCorrect: 0, reasonTotal: 0, reasonCorrect: 0,
    combo: 0, maxCombo: 0, timeLeft: CFG.time, lastTick: performance.now(),
    bossPhase: 0, bossHp: 100, bossNeed: new Set(), bossRequired: 0,
    bossMastered: new Set(), bossItems: new Map(), bossResults: { 1: false, 2: false, 3: false },
    group: blankGroups(), confusion: {}, itemBorn: new Map(), usedIds: new Set()
  };

  const phases = CFG.variant === 'boss-rush'
    ? ['boss1', 'boss2', 'boss3']
    : ['training', 'sort', 'speed', 'reason', 'retry', 'boss1', 'boss2', 'boss3'];

  const titles = {
    training: ['รอบฝึกอาหาร 5 หมู่', 'ฝึกหมู่ละ 1 ชิ้น รอบนี้ไม่หักคะแนน'],
    sort: ['รอบจัดหมู่อาหาร', 'หยิบอาหารทีละชิ้นแล้วปล่อยลงหมู่ที่ถูกต้อง'],
    speed: ['รอบท้าทายความเร็ว', 'มีอาหาร 2 ชิ้น เลือกจัดชิ้นใดก่อนก็ได้'],
    reason: ['ตรวจเหตุผล', 'เลือกเหตุผลจากสารอาหารและหน้าที่ของอาหาร'],
    retry: ['แก้ข้อที่พลาด', 'ลองจัดอาหารที่เคยผิดอีกครั้ง'],
    boss1: ['ด่านบอส 1 • ครบ 5 หมู่', 'จัดอาหารให้ถูกอย่างน้อยหมู่ละ 1 ชิ้น'],
    boss2: ['ด่านบอส 2 • อาหารชวนสับสน', 'สังเกตอาหารที่มักถูกจัดผิดหมู่'],
    boss3: ['ด่านบอส 3 • แยกส่วนประกอบ', 'แยกวัตถุดิบในอาหารผสมให้ถูกหมู่']
  };

  function event(type, extra = {}) {
    S.events.push({
      studentId: ID.studentId,
      studentName: ID.studentName,
      section: ID.section,
      eventId: `e-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      attemptId: S.attemptId,
      eventType: type,
      phase: S.phase,
      clientTs: iso(),
      ...extra
    });
    if (S.events.length > 500) S.events.shift();
  }

  function status(kind, text) {
    E.cameraBadge.className = `cameraBadge ${kind}`;
    E.cameraText.textContent = text;
  }

  function feedback(text) {
    E.feedback.textContent = text;
  }

  function cue(title, subtitle, duration = 1100) {
    E.cueTitle.textContent = title;
    E.cueSub.textContent = subtitle;
    E.cue.classList.add('show');
    clearTimeout(cue.timer);
    cue.timer = setTimeout(() => E.cue.classList.remove('show'), duration);
  }

  function update() {
    const accuracy = S.total ? Math.round((S.correct / S.total) * 100) : 0;
    E.score.textContent = S.score;
    E.acc.textContent = `${accuracy}%`;
    E.combo.textContent = S.combo;
    E.time.textContent = S.started ? `${S.timeLeft} วิ` : '--';
    E.bossPhase.textContent = S.bossPhase || '-';
    E.bossHp.style.width = `${Math.max(0, S.bossHp)}%`;
  }

  function setPhase(phase) {
    S.phase = phase;
    const title = titles[phase] || [phase, ''];
    E.phase.textContent = title[0];
    E.phaseSub.textContent = title[1];
    E.boss.classList.toggle('show', phase.startsWith('boss'));
    event('phase_start', { phase });

    if (phase.startsWith('boss')) {
      S.bossPhase = Number(phase.slice(-1));
      S.bossHp = 100;
      S.bossNeed = new Set([1, 2, 3, 4, 5]);
      S.bossRequired = phase === 'boss1' ? 5 : 0;
      S.bossMastered = new Set();
      S.bossItems = new Map();
      E.bossSkill.textContent = title[1];
    }
    update();
  }

  function pickGroup(group, count = 1) {
    let pool = B.foods.filter((item) => item.group === group && !recent.includes(item.id) && !S.usedIds.has(item.id));
    if (pool.length < count) pool = B.foods.filter((item) => item.group === group && !S.usedIds.has(item.id));
    if (pool.length < count) pool = B.foods.filter((item) => item.group === group);
    return shuffle(pool).slice(0, count);
  }

  function foodPool(perGroup = 3) {
    return shuffle([1, 2, 3, 4, 5].flatMap((group) => pickGroup(group, perGroup)));
  }

  function phaseQueue(phase) {
    if (phase === 'training') {
      return shuffle([1, 2, 3, 4, 5].map((group) => pickGroup(group, 1)[0]))
        .map((item) => ({ ...item, training: true }));
    }
    if (phase === 'sort') return foodPool(CFG.diff === 'easy' ? 2 : 3);
    if (phase === 'speed') return foodPool(CFG.diff === 'hard' ? 3 : 2);
    if (phase === 'retry') {
      return S.wrong.length
        ? shuffle(S.wrong.map((item) => ({ ...item, retry: true })))
        : foodPool(1).map((item) => ({ ...item, retry: true }));
    }
    if (phase === 'boss1') return foodPool(2).map((item) => ({ ...item, boss: true }));
    if (phase === 'boss2') {
      const tricky = B.foods.filter((item) => B.trickNames.includes(item.name));
      return shuffle(tricky).slice(0, Math.min(10, tricky.length)).map((item) => ({ ...item, boss: true, trick: true }));
    }
    if (phase === 'boss3') {
      const meal = shuffle(B.meals)[0];
      cue(`${meal.emoji} ${meal.name}`, 'แยกวัตถุดิบทีละชิ้น');
      return shuffle(meal.parts.map((item) => ({ ...item, boss: true, meal: meal.name })));
    }
    return [];
  }

  function nextPhase() {
    clearFoods();
    S.phaseIndex += 1;
    if (S.phaseIndex >= phases.length) return finish('complete');
    const phase = phases[S.phaseIndex];
    setPhase(phase);
    if (phase === 'reason') return startReasons();
    S.queue = phaseQueue(phase);
    if (phase.startsWith('boss')) {
      S.queue.forEach((item) => S.bossItems.set(item.id, item));
      if (phase !== 'boss1') S.bossRequired = S.bossItems.size;
    }
    spawn();
  }

  function startFlow() {
    if (S.started || !S.handReady) return;
    S.started = true;
    S.lastTick = performance.now();
    requestAnimationFrame(tick);
    nextPhase();
  }

  function clearFoods() {
    S.active.forEach((value) => value.el.remove());
    S.active.clear();
    S.selected = null;
    E.bins.forEach((bin) => bin.classList.remove('hover'));
  }

  function bossPassed() {
    if (S.phase === 'boss1') return S.bossMastered.size >= 5;
    if (S.phase === 'boss2') return S.bossRequired > 0 && S.bossMastered.size >= Math.ceil(S.bossRequired * 0.75);
    if (S.phase === 'boss3') return S.bossRequired > 0 && S.bossMastered.size >= S.bossRequired;
    return true;
  }

  function spawn() {
    if (S.ended || S.phase === 'reason') return;

    if (!S.queue.length && !S.active.size) {
      if (S.phase.startsWith('boss')) {
        if (bossPassed()) {
          S.bossResults[S.bossPhase] = true;
          S.bossHp = 0;
          update();
          cue('ผ่านด่านบอสแล้ว!', `ผ่านเป้าหมายของด่าน ${S.bossPhase}`);
          return setTimeout(nextPhase, 650);
        }

        const missing = [...S.bossItems.values()].filter((item) => {
          const key = S.phase === 'boss1' ? `g${item.group}` : item.id;
          return !S.bossMastered.has(key);
        });
        S.queue = shuffle(missing.length ? missing : [...S.bossItems.values()])
          .map((item) => ({ ...item, bossRetry: true }));
        feedback('ยังไม่ผ่านด่าน ลองแก้รายการที่เหลืออีกครั้ง');
      } else {
        return setTimeout(nextPhase, 450);
      }
    }

    const activeLimit = S.phase === 'speed' ? CFG.maxFoods : 1;
    while (S.active.size < activeLimit && S.queue.length) makeFood(S.queue.shift());
  }

  function makeFood(food) {
    const rect = E.arena.getBoundingClientRect();
    const id = `${food.id}-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
    const element = document.createElement('div');
    const x = rect.width * (0.2 + Math.random() * 0.6);
    const y = rect.height * (0.34 + Math.random() * 0.28);

    element.className = `food${food.retry ? ' retry' : ''}${food.trick ? ' trick' : ''}`;
    element.innerHTML = `<span class="emoji">${food.emoji}</span><span class="name">${food.name}</span>`;
    element.style.left = `${x}px`;
    element.style.top = `${y}px`;
    element.style.pointerEvents = 'none';

    E.layer.appendChild(element);
    S.active.set(id, { id, f: food, el: element, x, y });
    S.usedIds.add(food.id);
    S.itemBorn.set(id, performance.now());
  }

  function select(id) {
    const value = S.active.get(id);
    if (!value) return;
    S.selected = id;
    value.el.classList.add('selected');
  }

  function binAt(x, y) {
    const rect = E.arena.getBoundingClientRect();
    if (y >= rect.height * 0.75) {
      return Math.max(1, Math.min(5, Math.floor((x / Math.max(1, rect.width)) * 5) + 1));
    }
    return 0;
  }

  function hoverBin(x, y) {
    const group = binAt(x, y);
    E.bins.forEach((bin) => bin.classList.toggle('hover', Number(bin.dataset.group) === group));
    return group;
  }

  function classify(id, chosen) {
    const value = S.active.get(id);
    if (!value) return;
    const food = value.f;
    const correct = chosen === food.group;
    const reactionMs = Math.round(performance.now() - (S.itemBorn.get(id) || performance.now()));

    value.el.remove();
    S.active.delete(id);
    S.itemBorn.delete(id);

    if (!food.training) {
      S.total += 1;
      S.group[food.group].total += 1;
      if (food.retry) {
        S.retryTotal += 1;
        S.group[food.group].retryTotal += 1;
      } else {
        S.firstTotal += 1;
      }
    }

    if (correct) {
      if (!food.training) {
        S.correct += 1;
        S.group[food.group].correct += 1;
        if (food.retry) {
          S.retryCorrect += 1;
          S.group[food.group].retryCorrect += 1;
        } else {
          S.firstCorrect += 1;
        }
        S.combo += 1;
        S.maxCombo = Math.max(S.maxCombo, S.combo);
        S.score += 100 + Math.min(100, S.combo * 10) + (food.boss ? 80 : 0);

        if (food.boss) {
          const masteryKey = S.phase === 'boss1' ? `g${food.group}` : food.id;
          S.bossMastered.add(masteryKey);
          S.bossNeed.delete(food.group);
          S.bossHp = Math.max(0, 100 - Math.round((S.bossMastered.size / Math.max(1, S.bossRequired)) * 100));
        }
      }
      feedback(`✅ ถูกต้อง! ${food.name} อยู่${B.groups[food.group].name}`);
    } else {
      S.combo = 0;
      if (!food.training && !food.retry) S.wrong.push({ ...food });
      const key = `${food.group}>${chosen}`;
      S.confusion[key] = (S.confusion[key] || 0) + 1;
      feedback(`❌ ${food.name} อยู่${B.groups[food.group].name} เดี๋ยวจะได้ลองใหม่`);
    }

    event(food.training ? 'training' : 'classify', {
      itemId: food.id,
      prompt: food.name,
      yourAnswer: chosen,
      correctAnswer: food.group,
      isCorrect: correct,
      reactionMs,
      retry: Boolean(food.retry),
      bossPhase: S.bossPhase,
      dish: food.meal || ''
    });

    update();
    spawn();
  }

  let reasonSet = [];
  let reasonIndex = 0;

  function startReasons() {
    reasonSet = shuffle(B.reasons).slice(0, 3);
    reasonIndex = 0;
    S.reasonTotal = reasonSet.length;
    showReason();
  }

  function showReason() {
    if (reasonIndex >= reasonSet.length) {
      E.reason.classList.remove('show');
      return nextPhase();
    }

    const reason = reasonSet[reasonIndex];
    E.reasonLabel.textContent = `ตรวจเหตุผล ${reasonIndex + 1}/${reasonSet.length}`;
    E.reasonQ.textContent = reason.q;
    E.answers.innerHTML = '';

    shuffle([reason.answer, ...reason.distractors]).forEach((text) => {
      const button = document.createElement('button');
      button.className = 'answer';
      button.textContent = text;
      button.onclick = () => {
        const correct = text === reason.answer;
        if (correct) {
          S.reasonCorrect += 1;
          S.score += 120;
          feedback('✅ เหตุผลถูกต้อง');
        } else {
          feedback(`❌ เหตุผลที่ถูกคือ: ${reason.answer}`);
        }
        event('reason', {
          itemId: reason.id,
          prompt: reason.q,
          yourAnswer: text,
          correctAnswer: reason.answer,
          isCorrect: correct,
          scoreDelta: correct ? 120 : 0
        });
        reasonIndex += 1;
        update();
        showReason();
      };
      E.answers.appendChild(button);
    });

    E.reason.classList.add('show');
  }

  function friendlyCameraError(error) {
    const name = String(error?.name || '');
    if (name === 'NotAllowedError' || name === 'SecurityError') {
      return 'Chrome ยังไม่ได้รับอนุญาตให้ใช้กล้อง กรุณาเปิดสิทธิ์กล้องแล้วลองใหม่';
    }
    if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
      return 'ไม่พบกล้องของอุปกรณ์ กรุณาตรวจกล้องแล้วลองใหม่';
    }
    if (name === 'NotReadableError' || name === 'TrackStartError') {
      return 'กล้องกำลังถูกแอปอื่นใช้งาน กรุณาปิดแอปนั้นแล้วลองใหม่';
    }
    return 'กล้องหรือระบบตรวจจับมือยังไม่พร้อม กรุณาตรวจอุปกรณ์แล้วลองใหม่';
  }

  function showArError(title, error) {
    S.cameraOpening = false;
    S.handReady = false;
    status('error', 'AR ยังไม่พร้อม');
    const message = friendlyCameraError(error);
    feedback(message);
    if (E.arOnlyTitle) E.arOnlyTitle.textContent = title;
    if (E.arOnlyMessage) E.arOnlyMessage.textContent = message;
    E.arOnlyBlock?.classList.remove('hidden');
    if (E.startCamera) {
      E.startCamera.disabled = false;
      E.startCamera.textContent = '📷 ลองเปิดกล้องอีกครั้ง';
    }
    event('ar_error', { message: String(error?.message || error || title), errorName: String(error?.name || '') });
  }

  async function startCamera() {
    if (S.cameraOpening || S.started) return;
    S.cameraOpening = true;
    E.startCamera.disabled = true;
    E.startCamera.textContent = 'กำลังเปิดกล้อง…';
    status('loading', 'กำลังเปิดกล้อง');

    try {
      S.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      });
      E.camera.srcObject = S.stream;
      await E.camera.play();
      status('ready', 'กล้องพร้อม');
      await initHand();
    } catch (error) {
      showArError('เปิด Camera AR ไม่สำเร็จ', error);
    }
  }

  async function initHand() {
    try {
      status('loading', 'กำลังตรวจจับมือ');
      const vision = await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs');
      const files = await vision.FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
      );
      S.tracker = await vision.HandLandmarker.createFromOptions(files, {
        baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
          delegate: 'GPU'
        },
        runningMode: 'VIDEO',
        numHands: 1,
        minHandDetectionConfidence: 0.5,
        minHandPresenceConfidence: 0.5,
        minTrackingConfidence: 0.45
      });
      S.handReady = true;
      S.cameraOpening = false;
      status('ready', 'พร้อมใช้มือ');
      feedback('ยกมือให้กล้องเห็น แล้วจีบนิ้วเพื่อหยิบอาหาร');
      startFlow();
    } catch (error) {
      showArError('ระบบตรวจจับมือยังไม่พร้อม', error);
    }
  }

  function handProcess(result) {
    S.frames += 1;
    const landmarks = result?.landmarks?.[0];
    if (!landmarks) {
      E.hand.classList.remove('show', 'pinch');
      return;
    }

    S.handFrames += 1;
    const indexTip = landmarks[8];
    const thumbTip = landmarks[4];
    const rect = E.arena.getBoundingClientRect();
    const x = (1 - indexTip.x) * rect.width;
    const y = indexTip.y * rect.height;
    const distance = Math.hypot(indexTip.x - thumbTip.x, indexTip.y - thumbTip.y);
    const pinching = S.pinching ? distance < CFG.pinchOpen : distance < CFG.pinchClose;

    S.handScores.push(result.handedness?.[0]?.[0]?.score || 0.5);
    if (S.handScores.length > 600) S.handScores.shift();

    E.hand.style.left = `${x}px`;
    E.hand.style.top = `${y}px`;
    E.hand.classList.add('show');
    E.hand.classList.toggle('pinch', pinching);

    if (pinching && !S.pinching) {
      S.pinches += 1;
      let bestId = '';
      let bestDistance = 100;
      S.active.forEach((value, id) => {
        const candidate = Math.hypot(value.x - x, value.y - y);
        if (candidate < bestDistance) {
          bestId = id;
          bestDistance = candidate;
        }
      });
      if (bestId) select(bestId);
    }

    if (pinching && S.selected) {
      const value = S.active.get(S.selected);
      if (value) {
        value.x = x;
        value.y = y;
        value.el.style.left = `${x}px`;
        value.el.style.top = `${y}px`;
        hoverBin(x, y);
      }
    }

    if (!pinching && S.pinching && S.selected) {
      const id = S.selected;
      const group = binAt(x, y);
      S.selected = null;
      E.bins.forEach((bin) => bin.classList.remove('hover'));
      if (group) classify(id, group);
      else S.active.get(id)?.el.classList.remove('selected');
    }

    S.pinching = pinching;
  }

  function tick(timestamp) {
    if (S.ended) return;

    if (S.started && timestamp - S.lastTick >= 1000) {
      const elapsed = Math.floor((timestamp - S.lastTick) / 1000);
      S.timeLeft = Math.max(0, S.timeLeft - elapsed);
      S.lastTick += elapsed * 1000;
      update();
      if (!S.timeLeft) return finish('time');
    }

    if (
      S.handReady && E.camera.readyState >= 2 && E.camera.currentTime !== S.lastVideo &&
      timestamp - S.lastDetect >= CFG.detectEvery
    ) {
      S.lastVideo = E.camera.currentTime;
      S.lastDetect = timestamp;
      try {
        handProcess(S.tracker.detectForVideo(E.camera, performance.now()));
      } catch (error) {
        event('hand_runtime_error', { message: String(error?.message || error) });
      }
    }

    requestAnimationFrame(tick);
  }

  function buildResult(reason) {
    const accuracy = S.total ? Math.round((S.correct / S.total) * 100) : 0;
    const reasonAccuracy = S.reasonTotal ? Math.round((S.reasonCorrect / S.reasonTotal) * 100) : 0;
    const retryAccuracy = S.retryTotal ? Math.round((S.retryCorrect / S.retryTotal) * 100) : 100;
    const groupAccuracy = {};
    let balanced = true;

    for (let group = 1; group <= 5; group += 1) {
      groupAccuracy[group] = S.group[group].total
        ? Math.round((S.group[group].correct / S.group[group].total) * 100)
        : 0;
      if (groupAccuracy[group] < 60) balanced = false;
    }

    const bossWin = S.bossResults[1] === true && S.bossResults[2] === true && S.bossResults[3] === true;
    const reasonGate = CFG.variant === 'boss-rush' || reasonAccuracy >= 67;
    const passed = accuracy >= 75 && reasonGate && balanced && bossWin;
    const stars = accuracy >= 85 && (CFG.variant === 'boss-rush' || reasonAccuracy >= 80) &&
      retryAccuracy >= 70 && balanced && bossWin ? 3 : accuracy >= 70 && reasonGate && bossWin ? 2 : 1;

    return {
      type: 'attempt', schemaVersion: 'herohealth-groups-ar-v5', version: VERSION,
      attemptId: S.attemptId, studentId: ID.studentId, studentName: ID.studentName,
      section: ID.section, studyId: ID.studyId, conditionGroup: ID.conditionGroup,
      sessionId: 'nutrition-groups-ar', missionId: 'groups-ar',
      missionTitle: 'ภารกิจพิชิตอาหาร 5 หมู่', difficulty: CFG.diff, runMode: CFG.variant,
      isPractice: CFG.variant === 'boss-rush', score: S.score, stars, mastered: passed, passed,
      accuracy, correct: S.correct, total: S.total, wrong: S.total - S.correct,
      maxCombo: S.maxCombo,
      firstAttemptAccuracy: S.firstTotal ? Math.round((S.firstCorrect / S.firstTotal) * 100) : 0,
      retryAccuracy, reasonCorrect: S.reasonCorrect, reasonTotal: S.reasonTotal, reasonAccuracy,
      bossWin, bossResults: S.bossResults, groupAccuracy, confusionMatrix: S.confusion,
      inputMode: 'hand-ar-only', cameraEnabled: Boolean(S.stream), handReady: S.handReady,
      handSeenRate: S.frames ? Math.round((S.handFrames / S.frames) * 100) : 0,
      handConfidence: S.handScores.length
        ? Number((S.handScores.reduce((sum, value) => sum + value, 0) / S.handScores.length).toFixed(3))
        : 0,
      pinchCount: S.pinches, fallbackCount: 0,
      qaProfile: {
        pinchClose: CFG.pinchClose, pinchOpen: CFG.pinchOpen,
        detectEveryMs: CFG.detectEvery, maxFoods: CFG.maxFoods,
        source: qa?.version ? 'device-check' : 'default'
      },
      contentVersion: B.version,
      contentCounts: { foods: B.foods.length, meals: B.meals.length, reasons: B.reasons.length },
      usedTimeSec: CFG.time - S.timeLeft, timeLeftSec: S.timeLeft,
      completionReason: reason,
      wrongItems: S.wrong.map((item) => ({ id: item.id, name: item.name, group: item.group })),
      clientTs: iso(), userAgent: navigator.userAgent, pageUrl: location.href, events: S.events
    };
  }

  async function deliver(result) {
    try { localStorage.setItem('HHA_GROUPS_AR_LAST_RESULT', JSON.stringify(result)); }
    catch (_) {}

    if (!CFG.api || !CFG.log) {
      E.delivery.textContent = window.HH_GROUPS_PASSPORT_MODE
        ? 'กำลังส่งผลกลับ Hero Passport…'
        : 'บันทึกผลการเล่นแล้ว';
      return;
    }

    const body = JSON.stringify(result);
    let delivered = false;
    try {
      if (navigator.sendBeacon) {
        delivered = navigator.sendBeacon(CFG.api, new Blob([body], { type: 'application/json' }));
      }
    } catch (_) {}

    if (!delivered) {
      try {
        await fetch(CFG.api, {
          method: 'POST', mode: 'no-cors',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body
        });
        delivered = true;
      } catch (_) {}
    }

    E.delivery.textContent = delivered
      ? 'บันทึกผลการเล่นแล้ว'
      : 'เครือข่ายยังไม่พร้อม ผลการเล่นถูกเก็บไว้แล้ว';
  }

  function finish(reason = 'complete') {
    if (S.ended) return;
    S.ended = true;

    try {
      localStorage.setItem('HHA_GROUPS_AR_RECENT_ITEMS', JSON.stringify([...S.usedIds].slice(-80)));
    } catch (_) {}

    clearFoods();
    try { S.stream?.getTracks().forEach((track) => track.stop()); }
    catch (_) {}

    const result = buildResult(reason);
    const weak = Object.entries(result.groupAccuracy)
      .filter(([, value]) => value < 60)
      .map(([group]) => `หมู่ ${group}`)
      .join(', ') || 'ไม่มี';

    E.sumIcon.textContent = result.passed ? '🏆' : '🛟';
    E.sumTitle.textContent = result.passed ? 'ผ่านภารกิจอาหาร 5 หมู่' : 'จบภารกิจแล้ว';
    E.sumSub.textContent = result.passed
      ? `${result.stars} ดาว • ทำได้ดีครบทั้ง 5 หมู่`
      : `${result.stars} ดาว • ควรฝึกเพิ่ม: ${weak}`;

    const summaryRows = [
      ['คะแนน', result.score],
      ['ความถูกต้อง', `${result.accuracy}%`],
      ['รอบแรก', `${result.firstAttemptAccuracy}%`],
      ['ตอบเหตุผล', `${result.reasonAccuracy}%`],
      ['แก้ข้อพลาด', `${result.retryAccuracy}%`],
      ['ด่านบอส', result.bossWin ? 'ผ่าน' : 'ยังไม่ครบ']
    ];

    E.summaryGrid.innerHTML = summaryRows
      .map(([label, value]) => `<div class="sum"><small>${label}</small><b>${value}</b></div>`)
      .join('');

    E.bars.innerHTML = Object.entries(result.groupAccuracy)
      .map(([group, value]) => `<div class="barRow"><span>หมู่ ${group} ${B.groups[group].short}</span><div class="bar"><i style="width:${value}%"></i></div><span>${value}%</span></div>`)
      .join('');

    E.summary.classList.remove('hidden');
    deliver(result);
  }

  E.startCamera.onclick = () => {
    E.intro.classList.add('hidden');
    E.arOnlyBlock?.classList.add('hidden');
    startCamera();
  };

  if ($('startTouch')) {
    $('startTouch').disabled = true;
    $('startTouch').hidden = true;
  }
  if ($('touchBtn')) {
    $('touchBtn').disabled = true;
    $('touchBtn').hidden = true;
  }

  E.qaBtn.onclick = E.openQa.onclick = () => {
    const url = new URL('./groups-ar-check-v2.html', location.href);
    q.forEach((value, key) => url.searchParams.set(key, value));
    location.assign(url);
  };

  E.retryAr.onclick = () => {
    E.arOnlyBlock?.classList.add('hidden');
    startCamera();
  };

  $('zoneBtn').onclick = $('sumZone').onclick = () => location.assign(CFG.hub);
  $('replay').onclick = () => location.reload();
  $('teacherBtn').onclick = () => {
    const url = new URL('../groups-ar-teacher.html', location.href);
    if (CFG.api) url.searchParams.set('api', CFG.api);
    if (ID.section) url.searchParams.set('section', ID.section);
    location.assign(url);
  };

  window.addEventListener('visibilitychange', () => {
    if (!document.hidden && S.stream && E.camera.paused) E.camera.play().catch(() => {});
  });
  window.addEventListener('beforeunload', () => {
    try { S.stream?.getTracks().forEach((track) => track.stop()); }
    catch (_) {}
  });

  document.body.classList.add('strictAr');
  status('idle', 'รอเปิดกล้อง');
  update();
})();
