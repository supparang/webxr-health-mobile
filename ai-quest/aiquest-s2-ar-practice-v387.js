/* CSAI2102 AI Quest — S2 AR Agent Builder v4.0.4
   S2 now uses the same Easy Hand Lane interaction model as S1:
   3 large targets, cursor smoothing, generous magnetic hit areas,
   1.2s dwell, and optional pinch selection. Mouse/touch remains available.
*/
(() => {
  'use strict';

  const V = 'v4.0.4-s2-easy-hand-lanes';
  const $ = (id) => document.getElementById(id);
  const KEY = 'AIQUEST_S2_AR_RESULT_V401';
  const CFG = Object.freeze({
    dwell: 1200,
    cooldown: 850,
    pinch: 0.118,
    pad: 92,
    magnet: 245,
    maxInferenceFps: 18
  });
  const INTERACTIVE = '#s2choices387 .s2ans387:not([disabled]),#s2next387:not([disabled]),#s2again387:not([disabled]),#s2back387:not([disabled]),#s2help387:not([disabled])';

  const ITEMS = [
    ['Smart irrigation controller', 'เลือก PEAS ส่วนที่เป็น Sensor', 'Soil moisture sensor',
      ['Soil moisture sensor', 'Water pump', 'Farm field'],
      'Sensor คือสิ่งที่ agent ใช้รับรู้สภาพแวดล้อม'],
    ['Smart irrigation controller', 'เลือก PEAS ส่วนที่เป็น Actuator', 'Water pump',
      ['Water pump', 'Rain forecast', 'Water-saving score'],
      'Actuator คือสิ่งที่ agent ใช้กระทำกับ environment'],
    ['Smart irrigation controller', 'เลือก PEAS ส่วนที่เป็น Performance', 'Water-saving score',
      ['Water-saving score', 'Soil moisture sensor', 'Farm field'],
      'Performance measure บอกว่าระบบทำได้ดีแค่ไหน'],
    ['Food delivery route planner', 'Environment ของ agent คืออะไร?', 'Road map, traffic and orders',
      ['Road map, traffic and orders', 'GPS location sensor', 'Driver navigation screen'],
      'Environment คือโลกหรือบริบทที่ agent ทำงานอยู่'],
    ['Student support chatbot', 'ข้อใดอธิบาย Rational Agent ได้ดีที่สุด?', 'เลือกคำตอบที่คาดว่าจะช่วยผู้ใช้ได้ดีที่สุดจากข้อมูลที่มี',
      ['เลือกคำตอบที่คาดว่าจะช่วยผู้ใช้ได้ดีที่สุดจากข้อมูลที่มี', 'ตอบเหมือนเดิมทุกครั้ง', 'ต้องรู้ทุกอย่างก่อนตอบ'],
      'Rational agent เลือก action ที่คาดว่าดีที่สุดจากข้อมูลที่มี'],
    ['Autonomous vacuum robot', 'ข้อใดเป็น percept ของ agent?', 'ตำแหน่งสิ่งกีดขวางจากเซนเซอร์',
      ['ตำแหน่งสิ่งกีดขวางจากเซนเซอร์', 'การหมุนล้อ', 'พื้นสะอาดที่สุด'],
      'Percept คือข้อมูลที่ agent รับเข้ามาจาก sensor']
  ];

  let questions = [];
  let index = 0;
  let correct = 0;
  let helpUsed = 0;
  let startedAt = 0;
  let stream = null;
  let hands = null;
  let raf = 0;
  let active = false;
  let starting = false;
  let answerLocked = false;
  let handReady = false;
  let lastActivationAt = 0;
  let lastPinch = false;
  let cursorX = null;
  let cursorY = null;
  let target = null;
  let targetSince = 0;
  let failures = 0;
  let token = 0;
  let unregisterCleanup = () => {};

  const mix = (items) => items.slice().sort(() => Math.random() - 0.5);
  const esc = (value) => String(value ?? '').replace(/[&<>\"]/g, (char) => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;'
  }[char]));

  const runtime = () => window.AIQuestARRuntime || null;
  const panel = () => $('s2ar387');
  const video = () => $('s2v387');
  const isOpen = () => Boolean(panel() && panel().style.display !== 'none');

  function ensureStyle(){
    if ($('s2easyHandStyle401')) return;
    const style = document.createElement('style');
    style.id = 's2easyHandStyle401';
    style.textContent = `
      #s2ar387 .s2ans387{min-height:78px;text-align:left;padding:13px 15px;border:2px solid #94a3b855;border-radius:18px;background:#1e293bf2;color:#fff;font-size:18px;font-weight:1000}
      #s2ar387 .s2ans387.hand-target-s2{border-color:#67e8f9!important;box-shadow:0 0 0 7px #22d3ee2b,0 0 30px #22d3ee77!important;transform:scale(1.015)}
      .s2hc401{position:fixed;left:0;top:0;width:45px;height:45px;border:3px solid #67e8f9;border-radius:50%;z-index:100560;pointer-events:none;transform:translate(-50%,-50%);display:none;background:#02061722;box-shadow:0 0 0 11px #22d3ee2b,0 0 30px #22d3ee88}
      .s2hc401.p{border-color:#86efac;box-shadow:0 0 0 14px #86efac44,0 0 36px #86efacaa}
      .s2hr401{position:fixed;left:0;top:0;width:74px;height:74px;border-radius:50%;z-index:100559;pointer-events:none;transform:translate(-50%,-50%);display:none;background:conic-gradient(#86efac var(--p,0deg),#ffffff28 0deg);-webkit-mask:radial-gradient(circle,transparent 54%,#000 56%);mask:radial-gradient(circle,transparent 54%,#000 56%)}
      #s2hand387{max-width:min(92vw,620px)}
      @media(max-width:600px){#s2ar387 .s2ans387{min-height:72px;font-size:17px}}
    `;
    document.head.appendChild(style);
  }

  function ensureUI(){
    ensureStyle();
    if ($('s2ar387')) return;

    const root = document.createElement('section');
    root.id = 's2ar387';
    root.style.cssText = 'display:none;position:fixed;inset:0;z-index:100500;background:#020617;color:#fff;font-family:system-ui';
    root.innerHTML = `
      <video id="s2v387" autoplay muted playsinline style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.50;transform:scaleX(-1)"></video>
      <div style="position:absolute;inset:0;background:linear-gradient(#020617d8,#02061755,#020617e8);pointer-events:none"></div>
      <div style="position:absolute;top:14px;left:14px;right:14px;display:flex;justify-content:space-between;gap:12px">
        <div>
          <b>S2 AR Practice: Agent Builder</b>
          <div style="font-size:12px;color:#ddd6fe">PEAS · Percept · Rational Agent</div>
          <div id="s2hand387" style="margin-top:7px;font-size:12px;background:#172554cc;border:1px solid #60a5fa66;border-radius:999px;padding:6px 9px;display:inline-block">Hand Easy Mode: กำลังเตรียมกล้อง…</div>
        </div>
        <button id="s2close387" type="button">ออกจาก AR</button>
      </div>
      <div style="position:absolute;inset:94px 0 70px;display:grid;place-items:center;padding:10px">
        <div id="s2card387" style="width:min(680px,95vw);max-height:calc(100vh - 175px);overflow:auto;padding:18px;border:1px solid #c4b5fd66;border-radius:25px;background:#0f172aef"></div>
      </div>
      <div style="position:absolute;bottom:12px;left:14px;right:14px;display:flex;justify-content:space-between;align-items:center;gap:10px">
        <span id="s2meter387"></span><button id="s2help387" type="button">AI Help</button>
      </div>`;

    document.body.appendChild(root);
    $('s2close387').onclick = close;
    $('s2help387').onclick = hint;

    [['s2hc401','s2hc401'],['s2hr401','s2hr401']].forEach(([id, className]) => {
      if ($(id)) return;
      const node = document.createElement('div');
      node.id = id;
      node.className = className;
      document.body.appendChild(node);
    });
  }

  function setHandStatus(text, ok){
    const node = $('s2hand387');
    if (!node) return;
    node.textContent = text;
    node.style.borderColor = ok ? '#86efac88' : '#fbbf2488';
    node.style.background = ok ? '#14532dcc' : '#78350fcc';
  }

  function setCursorVisible(show){
    ['s2hc401','s2hr401'].forEach((id) => {
      const node = $(id);
      if (node) node.style.display = show ? 'block' : 'none';
    });
  }

  function clearTarget(){
    if (target) target.classList.remove('hand-target-s2');
    target = null;
    targetSince = 0;
    const ring = $('s2hr401');
    if (ring) ring.style.setProperty('--p', '0deg');
  }

  function controls(){
    return [...document.querySelectorAll(INTERACTIVE)]
      .filter((button) => !button.disabled && button.offsetParent !== null);
  }

  function label(button){
    if (!button) return '';
    if (button.id === 's2next387') return 'ข้อต่อไป';
    if (button.id === 's2again387') return 'ฝึกซ้ำ';
    if (button.id === 's2back387') return 'กลับ Session 2';
    if (button.id === 's2help387') return 'AI Help';
    return String(button.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 54);
  }

  function hitTest(x, y){
    const exact = document.elementFromPoint(x, y)?.closest?.(INTERACTIVE);
    if (exact) return exact;

    let winner = null;
    let distance = Infinity;
    controls().forEach((button) => {
      const rect = button.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const d = Math.hypot(x - cx, y - cy);
      const expanded = x >= rect.left - CFG.pad && x <= rect.right + CFG.pad &&
        y >= rect.top - CFG.pad && y <= rect.bottom + CFG.pad;
      if ((expanded || d < CFG.magnet) && d < distance) {
        winner = button;
        distance = d;
      }
    });
    return winner;
  }

  function activate(button, mode){
    if (!button || button.disabled) return;
    const now = Date.now();
    if (now - lastActivationAt < CFG.cooldown) return;
    lastActivationAt = now;
    clearTarget();
    try { button.focus({ preventScroll:true }); } catch (_) {}
    if (button.dataset.a) answer(button.dataset.a, mode);
    else button.click();
  }

  function drawHand(results){
    if (!active || !isOpen()) return;
    const landmarks = results.multiHandLandmarks?.[0];
    if (!landmarks?.[8] || !landmarks?.[4]) {
      setCursorVisible(false);
      clearTarget();
      setHandStatus('Hand Easy Mode: ยังไม่พบมือ • ใช้เมาส์/ทัชได้ทันที', false);
      return;
    }

    handReady = true;
    const tip = landmarks[8];
    const thumb = landmarks[4];
    const rawX = (1 - tip.x) * window.innerWidth;
    const rawY = tip.y * window.innerHeight;
    cursorX = cursorX == null ? rawX : cursorX * 0.52 + rawX * 0.48;
    cursorY = cursorY == null ? rawY : cursorY * 0.52 + rawY * 0.48;

    const pinch = Math.hypot(tip.x - thumb.x, tip.y - thumb.y, (tip.z || 0) - (thumb.z || 0)) < CFG.pinch;
    const cursor = $('s2hc401');
    const ring = $('s2hr401');
    setCursorVisible(true);
    cursor.style.left = `${cursorX}px`;
    cursor.style.top = `${cursorY}px`;
    cursor.classList.toggle('p', pinch);
    ring.style.left = `${cursorX}px`;
    ring.style.top = `${cursorY}px`;

    const nextTarget = hitTest(cursorX, cursorY);
    if (!nextTarget) {
      clearTarget();
      setHandStatus('Hand Easy Mode: เลื่อนปลายนิ้วเข้าใกล้ช่องคำตอบ', true);
      lastPinch = pinch;
      return;
    }

    if (nextTarget !== target) {
      clearTarget();
      target = nextTarget;
      targetSince = Date.now();
      target.classList.add('hand-target-s2');
    }

    const elapsed = Date.now() - targetSince;
    ring.style.setProperty('--p', `${Math.min(360, Math.round(elapsed / CFG.dwell * 360))}deg`);
    const text = label(target);
    setHandStatus(
      pinch
        ? `Hand: pinch เพื่อเลือก “${text}”`
        : `Hand Easy Mode: เล็ง “${text}” • วงเต็มใน ${Math.max(0, (CFG.dwell - elapsed) / 1000).toFixed(1)} วิ`,
      true
    );

    if (pinch && !lastPinch) activate(target, 'hand_pinch');
    else if (elapsed >= CFG.dwell) activate(target, 'hand_dwell');
    lastPinch = pinch;
  }

  function loadScript(src){
    return new Promise((resolve, reject) => {
      const full = new URL(src, document.baseURI).href;
      const old = [...document.scripts].find((node) => node.src === full);
      if (old) {
        if (window.Hands) return resolve(window.Hands);
        old.addEventListener('load', () => window.Hands ? resolve(window.Hands) : reject(new Error('Hands API missing')), { once:true });
        old.addEventListener('error', () => reject(new Error('MediaPipe load failed')), { once:true });
        return;
      }
      const tag = document.createElement('script');
      tag.src = src;
      tag.async = true;
      tag.crossOrigin = 'anonymous';
      tag.onload = () => window.Hands ? resolve(window.Hands) : reject(new Error('Hands API missing'));
      tag.onerror = () => reject(new Error('MediaPipe load failed'));
      document.head.appendChild(tag);
    });
  }

  async function loadHands(){
    if (window.Hands) return window.Hands;
    const base = 'https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1646424915';
    return loadScript(`${base}/hands.js`);
  }

  async function startCameraAndHands(mine){
    const v = video();
    const arRuntime = runtime();
    try {
      const profile = arRuntime?.getCameraConstraints?.({ facingMode:{ ideal:'user' } }) || { facingMode:{ ideal:'user' } };
      stream = await navigator.mediaDevices.getUserMedia({ video:profile, audio:false });
      if (!active || mine !== token) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      v.srcObject = stream;
      v.style.display = 'block';
      await v.play();
      arRuntime?.registerVideo?.(v);
    } catch (error) {
      console.warn('[S2 AR] camera fallback', error);
      v.style.display = 'none';
      setHandStatus('Hand Easy Mode: เปิดกล้องไม่ได้ • ใช้เมาส์/ทัชได้ทันที', false);
      return;
    }

    let Hands;
    try {
      Hands = await loadHands();
    } catch (error) {
      console.warn('[S2 AR] MediaPipe unavailable', error);
      setHandStatus('Hand Easy Mode: โหลดตัวตรวจจับไม่สำเร็จ • ใช้เมาส์/ทัชได้ทันที', false);
      return;
    }
    if (!active || mine !== token) return;

    hands = new Hands({ locateFile:(file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1646424915/${file}` });
    hands.setOptions({
      maxNumHands:1,
      modelComplexity:0,
      minDetectionConfidence:0.42,
      minTrackingConfidence:0.42
    });
    hands.onResults(drawHand);
    setHandStatus('Hand Easy Mode: ยกมือกลางกล้อง • ชี้ค้าง 1.2 วินาที หรือหนีบนิ้วเพื่อเลือก', true);

    async function loop(){
      if (!active || mine !== token || !hands || !isOpen()) return;
      const allow = !arRuntime || arRuntime.shouldProcessFrame(CFG.maxInferenceFps);
      if (v.readyState >= 2 && allow) {
        try {
          await hands.send({ image:v });
          failures = 0;
        } catch (error) {
          failures += 1;
          if (failures >= 2) {
            console.warn('[S2 AR] hand detector paused after errors', error);
            hands = null;
            setCursorVisible(false);
            clearTarget();
            setHandStatus('Hand หยุดเพื่อป้องกันเกมค้าง • ใช้เมาส์/ทัชได้ตามปกติ', false);
            return;
          }
        }
      }
      raf = requestAnimationFrame(loop);
    }
    loop();
  }

  function stopCamera(fromRuntime = false){
    token += 1;
    active = false;
    cancelAnimationFrame(raf);
    raf = 0;
    if (!fromRuntime) {
      try { unregisterCleanup(); } catch (_) {}
    }
    unregisterCleanup = () => {};

    if (hands?.close) {
      try { hands.close(); } catch (_) {}
    }
    hands = null;
    if (stream) {
      try { stream.getTracks().forEach((track) => track.stop()); } catch (_) {}
      stream = null;
    }
    const v = video();
    if (v) {
      try { v.pause(); v.srcObject = null; } catch (_) {}
    }
    cursorX = null;
    cursorY = null;
    lastPinch = false;
    setCursorVisible(false);
    clearTarget();
  }

  async function start(){
    if (starting) return;
    ensureUI();
    starting = true;
    try {
      stopCamera();
      active = true;
      const mine = ++token;
      questions = mix(ITEMS);
      index = 0;
      correct = 0;
      helpUsed = 0;
      startedAt = Date.now();
      answerLocked = false;
      handReady = false;
      lastActivationAt = 0;
      failures = 0;
      lastPinch = false;
      clearTarget();
      panel().style.display = 'block';
      video().style.display = '';
      draw();

      unregisterCleanup = runtime()?.registerCleanup?.(() => stopCamera(true)) || (() => {});
      await startCameraAndHands(mine);
      window.dispatchEvent(new CustomEvent('aiquest:s2-ar-start', { detail:{ version:V, mode:'easy_hand_lanes' } }));
    } finally {
      starting = false;
    }
  }

  function close(){
    stopCamera();
    if (panel()) panel().style.display = 'none';
    try { runtime()?.leave?.('s2-close'); } catch (_) {}
  }

  function draw(){
    const item = questions[index];
    if (!item) {
      done();
      return;
    }
    answerLocked = false;
    clearTarget();
    $('s2meter387').textContent = `Mission ${index + 1}/${questions.length} • Correct ${correct} • Help ${helpUsed}`;
    const choices = mix(item[3]);
    $('s2card387').innerHTML = `
      <div style="font-size:12px;font-weight:900;color:#ddd6fe">AGENT BUILDER ${index + 1}/${questions.length} • 3 EASY HAND LANES</div>
      <h2>${esc(item[0])}</h2>
      <p style="padding:10px;border-radius:14px;background:#22d3ee14;border:1px solid #22d3ee33"><b>โจทย์:</b> ${esc(item[1])}</p>
      <p style="font-size:13px;color:#cbd5e1">เลือก 1 จาก 3 ช่องใหญ่: เล็งปลายนิ้วในช่องแล้วค้างประมาณ 1.2 วินาที หรือหนีบนิ้วโป้ง+นิ้วชี้เพื่อเลือก • คลิก/แตะได้เสมอ</p>
      <div id="s2choices387" style="display:grid;gap:10px">
        ${choices.map((choice) => `<button type="button" class="s2ans387" data-a="${esc(choice)}">${esc(choice)}</button>`).join('')}
      </div>
      <div id="s2fb387" style="margin-top:12px"></div>`;
    document.querySelectorAll('#s2choices387 .s2ans387').forEach((button) => {
      button.onclick = () => answer(button.dataset.a, 'mouse_touch');
    });
  }

  function answer(value, mode){
    if (answerLocked) return;
    answerLocked = true;
    const item = questions[index];
    const yes = value === item[2];

    document.querySelectorAll('#s2choices387 .s2ans387').forEach((button) => {
      button.disabled = true;
      button.classList.remove('hand-target-s2');
      button.style.borderColor = button.dataset.a === item[2]
        ? '#86efac'
        : (button.dataset.a === value ? '#fda4af' : '#94a3b855');
      if (button.dataset.a === item[2]) button.style.background = '#166534cc';
      else if (button.dataset.a === value) button.style.background = '#991b1bcc';
    });
    if (yes) correct += 1;

    $('s2fb387').innerHTML = `
      <div style="padding:12px;border-radius:14px;background:${yes ? '#16653455' : '#991b1b55'};border:1px solid ${yes ? '#86efac99' : '#fda4af99'}">
        <b>${yes ? 'ถูกต้อง!' : 'ยังไม่ถูก'}</b><br>${esc(item[4])}
        <br><small>Input: ${mode === 'hand_pinch' ? 'Hand pinch' : (mode === 'hand_dwell' ? 'Hand dwell' : 'Mouse / Touch')}</small>
        <div style="margin-top:10px"><button type="button" id="s2next387">${index === questions.length - 1 ? 'สรุป AR' : 'ข้อต่อไป'}</button></div>
      </div>`;
    $('s2next387').onclick = () => {
      index += 1;
      draw();
    };
    setHandStatus('Hand Easy Mode: เล็งปุ่ม “ข้อต่อไป” เพื่อไปยังคำถามถัดไป', true);
  }

  function hint(){
    const item = questions[index];
    if (!item || answerLocked) return;
    helpUsed += 1;
    $('s2fb387').innerHTML = '<div style="padding:12px;border-radius:14px;background:#22d3ee14;border:1px solid #22d3ee33"><b>AI Help:</b><br>จำ PEAS: P = วัดผล, E = โลก, A = สิ่งที่กระทำ, S = สิ่งที่รับรู้</div>';
  }

  function done(){
    stopCamera();
    const score = Math.round(correct * 100 / questions.length);
    const result = {
      version:V,
      sessionId:'s2',
      missionId:'m2',
      arCompleted:true,
      total:questions.length,
      correct,
      wrong:questions.length - correct,
      accuracy:score,
      arScore:score,
      helpUsed,
      usedSec:Math.round((Date.now() - startedAt) / 1000),
      finishedAt:new Date().toISOString(),
      inputMode:handReady ? 'easy_hand_or_mouse_touch' : 'mouse_touch'
    };
    window.AIQUEST_S2_AR_RESULT = result;
    try { localStorage.setItem(KEY, JSON.stringify(result)); } catch (_) {}

    $('s2card387').innerHTML = `
      <div style="font-size:12px;font-weight:900;color:#ddd6fe">AR Practice Complete</div>
      <h2>${score >= 85 ? 'Agent Builder Master' : 'S2 AR Complete'}</h2>
      <p>คะแนน ${score}% • ถูก ${correct}/${questions.length}</p>
      <p style="font-size:13px;color:#cbd5e1">S2 ใช้ Easy Hand Lanes แบบเดียวกับ S1: 3 ช่องใหญ่, ชี้ค้าง 1.2 วินาที, พื้นที่จับกว้าง และ pinch ได้</p>
      <button type="button" id="s2again387">ฝึกซ้ำ</button>
      <button type="button" id="s2back387">กลับ Session 2</button>`;
    $('s2again387').onclick = start;
    $('s2back387').onclick = () => {
      close();
      location.href = 'index.html?session=s2';
    };
  }

  const params = new URLSearchParams(location.search);
  if ((params.get('session') || '').toLowerCase() === 's2' && (params.get('ar') || '').toLowerCase() === 'agent') {
    setTimeout(start, 350);
  }

  window.AIQUEST_S2_AR_PRACTICE = Object.freeze({
    start,
    close,
    version:V,
    mode:'easy_hand_lanes',
    config:CFG
  });
})();
