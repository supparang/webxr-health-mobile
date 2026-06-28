/* AI Quest S2 AR Agent Builder v4.0.2
   Hand dwell supports answer choices AND post-answer controls (Next, Replay, Back).
   Touch/mouse remains available as a fallback.
*/
(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const KEY = 'AIQUEST_S2_AR_RESULT_V387';
  const DWELL_MS = 1350;
  const ACTIVATE_GUARD_MS = 750;
  const INTERACTIVE = '#s2choices387 button[data-a]:not([disabled]),#s2next387:not([disabled]),#s2again387:not([disabled]),#s2back387:not([disabled]),#s2help387:not([disabled])';

  const ITEMS = [
    ['Smart irrigation controller','เลือก PEAS ส่วนที่เป็น Sensor','Soil moisture sensor',['Soil moisture sensor','Water pump','Keep plants healthy','Farm field'],'Sensor คือสิ่งที่ agent ใช้รับรู้สภาพแวดล้อม'],
    ['Smart irrigation controller','เลือก PEAS ส่วนที่เป็น Actuator','Water pump',['Water pump','Rain forecast','Farm field','Water-saving score'],'Actuator คือสิ่งที่ agent ใช้กระทำกับ environment'],
    ['Smart irrigation controller','เลือก PEAS ส่วนที่เป็น Performance','Water-saving score',['Water-saving score','Soil moisture sensor','Farm field','Water pump'],'Performance measure บอกว่าทำได้ดีแค่ไหน'],
    ['Food delivery route planner','Environment ของ agent คืออะไร?','Road map, traffic and orders',['Road map, traffic and orders','GPS location sensor','Driver navigation screen','Fast delivery score'],'Environment คือโลกหรือบริบทที่ agent ทำงานอยู่'],
    ['Student support chatbot','ข้อใดอธิบาย Rational Agent ได้ดีที่สุด?','เลือกคำตอบที่คาดว่าจะช่วยผู้ใช้ได้ดีที่สุดจากข้อมูลที่มี',['เลือกคำตอบที่คาดว่าจะช่วยผู้ใช้ได้ดีที่สุดจากข้อมูลที่มี','ตอบเหมือนเดิมทุกครั้ง','ต้องรู้ทุกอย่างก่อนตอบ','ทำงานเร็วที่สุดเสมอ'],'Rational agent เลือก action ที่คาดว่าดีที่สุดจากข้อมูลที่มี'],
    ['Autonomous vacuum robot','ข้อใดเป็น percept ของ agent?','ตำแหน่งสิ่งกีดขวางจากเซนเซอร์',['ตำแหน่งสิ่งกีดขวางจากเซนเซอร์','การหมุนล้อ','พื้นสะอาดที่สุด','ห้องนั่งเล่น'],'Percept คือข้อมูลที่ agent รับเข้ามาจาก sensor']
  ];

  let questions = [];
  let index = 0;
  let correct = 0;
  let helpUsed = 0;
  let startedAt = 0;
  let stream = null;
  let hands = null;
  let raf = 0;
  let answerLocked = false;
  let hoverKey = '';
  let hoverSince = 0;
  let handReady = false;
  let lastActivationAt = 0;

  const mix = (array) => array.slice().sort(() => Math.random() - .5);
  const esc = (value) => String(value ?? '').replace(/[&<>\"]/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[char]));

  function ensureUI(){
    if ($('s2ar387')) return;
    const root = document.createElement('section');
    root.id = 's2ar387';
    root.style.cssText = 'display:none;position:fixed;inset:0;z-index:100500;background:#020617;color:#fff;font-family:system-ui';
    root.innerHTML = `
      <video id="s2v387" autoplay muted playsinline style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.42;transform:scaleX(-1)"></video>
      <canvas id="s2c387" style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none;transform:scaleX(-1)"></canvas>
      <div style="position:absolute;inset:0;background:linear-gradient(#020617d8,#02061755,#020617e8);pointer-events:none"></div>
      <div style="position:absolute;top:14px;left:14px;right:14px;display:flex;justify-content:space-between;gap:12px">
        <div><b>S2 AR Practice: Agent Builder</b><div style="font-size:12px;color:#ddd6fe">PEAS · Percept · Rational Agent</div><div id="s2hand387" style="margin-top:7px;font-size:12px;background:#172554cc;border:1px solid #60a5fa66;border-radius:999px;padding:6px 9px;display:inline-block">Hand: กำลังเตรียมกล้อง…</div></div>
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
  }

  function setHandStatus(text, ok){
    const node = $('s2hand387');
    if (!node) return;
    node.textContent = text;
    node.style.borderColor = ok ? '#86efac88' : '#fbbf2488';
    node.style.background = ok ? '#14532dcc' : '#78350fcc';
  }

  function loadScript(src){
    return new Promise((resolve,reject) => {
      const absolute = new URL(src, document.baseURI).href;
      const existing = [...document.scripts].find(script => script.src === absolute);
      if (existing) return resolve();
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  async function loadHands(){
    if (window.Hands) return true;
    try {
      await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js');
      await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js');
      await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js');
      return Boolean(window.Hands);
    } catch (error) {
      console.warn('[S2 AR] MediaPipe unavailable', error);
      return false;
    }
  }

  function resizeCanvas(){
    const video = $('s2v387');
    const canvas = $('s2c387');
    if (!video || !canvas || !video.videoWidth) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
  }

  function interactiveButtons(){
    return [...document.querySelectorAll(INTERACTIVE)];
  }

  function clearHover(){
    hoverKey = '';
    hoverSince = 0;
    interactiveButtons().forEach(button => {
      button.style.outline = '';
      button.style.boxShadow = '';
    });
  }

  function controlLabel(button){
    if (!button) return '';
    if (button.id === 's2next387') return 'ข้อต่อไป';
    if (button.id === 's2again387') return 'ฝึกซ้ำ';
    if (button.id === 's2back387') return 'กลับ Session 2';
    if (button.id === 's2help387') return 'AI Help';
    return String(button.textContent || '').trim().replace(/\s+/g,' ').slice(0,48);
  }

  function activate(button){
    if (!button || button.disabled) return;
    const now = performance.now();
    if (now - lastActivationAt < ACTIVATE_GUARD_MS) return;
    lastActivationAt = now;
    clearHover();
    if (button.dataset.a) answer(button.dataset.a, 'hand');
    else button.click();
  }

  function drawHand(results){
    const canvas = $('s2c387');
    if (!canvas) return;
    const context = canvas.getContext('2d');
    context.save();
    context.clearRect(0,0,canvas.width,canvas.height);

    const landmarks = results.multiHandLandmarks?.[0];
    if (!landmarks) {
      setHandStatus('Hand: ไม่พบมือ • ใช้เมาส์/ทัชได้', false);
      clearHover();
      context.restore();
      return;
    }

    handReady = true;
    const tip = landmarks[8];
    const x = (1-tip.x) * window.innerWidth;
    const y = tip.y * window.innerHeight;

    context.beginPath();
    context.arc(tip.x * canvas.width, tip.y * canvas.height, 16, 0, Math.PI * 2);
    context.fillStyle = '#34d399';
    context.fill();
    context.lineWidth = 5;
    context.strokeStyle = '#ffffff';
    context.stroke();

    const target = document.elementFromPoint(x,y)?.closest?.(INTERACTIVE) || null;
    if (!target) {
      clearHover();
      setHandStatus('Hand: เล็งให้อยู่ในปุ่มคำตอบหรือปุ่ม “ข้อต่อไป”', true);
      context.restore();
      return;
    }

    const key = target.id || target.dataset.a || controlLabel(target);
    if (hoverKey !== key) {
      clearHover();
      hoverKey = key;
      hoverSince = performance.now();
    }

    const elapsed = performance.now() - hoverSince;
    const percent = Math.min(1, elapsed / DWELL_MS);
    target.style.outline = `4px solid ${percent >= 1 ? '#86efac' : '#fbbf24'}`;
    target.style.boxShadow = `0 0 0 7px rgba(251,191,36,${.12 + percent*.16})`;
    const remaining = Math.max(0, (DWELL_MS-elapsed)/1000).toFixed(1);
    setHandStatus(`Hand: เล็ง “${controlLabel(target)}” • เลือกใน ${remaining} วิ`, true);
    if (elapsed >= DWELL_MS) activate(target);
    context.restore();
  }

  async function startCameraAndHands(){
    const video = $('s2v387');
    try {
      stream = await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'user'}},audio:false});
      video.srcObject = stream;
      await video.play();
      resizeCanvas();
      window.addEventListener('resize', resizeCanvas, {passive:true});
    } catch (error) {
      console.warn('[S2 AR] camera fallback', error);
      video.style.display = 'none';
      $('s2c387').style.display = 'none';
      setHandStatus('Hand: เปิดกล้องไม่ได้ • ใช้เมาส์/ทัชได้', false);
      return;
    }

    const loaded = await loadHands();
    if (!loaded) {
      setHandStatus('Hand: โหลดตัวตรวจจับไม่สำเร็จ • ใช้เมาส์/ทัชได้', false);
      return;
    }

    hands = new Hands({locateFile:file => 'https://cdn.jsdelivr.net/npm/@mediapipe/hands/' + file});
    hands.setOptions({maxNumHands:1,modelComplexity:0,minDetectionConfidence:.55,minTrackingConfidence:.52});
    hands.onResults(drawHand);

    async function loop(){
      if (!hands || !$('s2ar387') || $('s2ar387').style.display === 'none') return;
      const allowFrame = !window.AIQuestARRuntime || window.AIQuestARRuntime.shouldProcessFrame(18);
      if (video.readyState >= 2 && allowFrame) {
        try { await hands.send({image:video}); }
        catch (error) { console.warn('[S2 AR] hand frame error', error); }
      }
      raf = requestAnimationFrame(loop);
    }
    loop();
  }

  async function start(){
    ensureUI();
    stopCamera();
    questions = mix(ITEMS);
    index = 0;
    correct = 0;
    helpUsed = 0;
    startedAt = Date.now();
    answerLocked = false;
    handReady = false;
    lastActivationAt = 0;
    clearHover();
    $('s2v387').style.display = '';
    $('s2c387').style.display = '';
    $('s2ar387').style.display = 'block';
    draw();
    await startCameraAndHands();
    window.dispatchEvent(new CustomEvent('aiquest:s2-ar-start'));
  }

  function stopCamera(){
    cancelAnimationFrame(raf);
    raf = 0;
    if (stream) { stream.getTracks().forEach(track => track.stop()); stream = null; }
    if (hands?.close) { try { hands.close(); } catch (_) {} }
    hands = null;
    clearHover();
    window.removeEventListener('resize', resizeCanvas);
  }

  function close(){
    stopCamera();
    $('s2ar387')?.style.setProperty('display','none');
  }

  function draw(){
    const item = questions[index];
    if (!item) { done(); return; }
    answerLocked = false;
    clearHover();
    $('s2meter387').textContent = `Mission ${index+1}/${questions.length} • Correct ${correct} • Help ${helpUsed}`;
    const choices = mix(item[3]);
    $('s2card387').innerHTML = `
      <div style="font-size:12px;font-weight:900;color:#ddd6fe">AGENT BUILDER ${index+1}/${questions.length}</div>
      <h2>${esc(item[0])}</h2>
      <p style="padding:10px;border-radius:14px;background:#22d3ee14;border:1px solid #22d3ee33"><b>โจทย์:</b> ${esc(item[1])}</p>
      <p style="font-size:13px;color:#cbd5e1">ใช้มือเล็งในปุ่มประมาณ 1.35 วินาที หรือคลิก/แตะปุ่มได้ หลังตอบให้เล็งปุ่ม “ข้อต่อไป” เพื่อไปต่อ</p>
      <div id="s2choices387" style="display:grid;gap:10px">
        ${choices.map(answer => `<button type="button" data-a="${esc(answer)}" style="min-height:64px;text-align:left;padding:12px;border:2px solid #94a3b855;border-radius:17px;background:#1e293bf2;color:white;font-size:16px;font-weight:900">${esc(answer)}</button>`).join('')}
      </div>
      <div id="s2fb387" style="margin-top:12px"></div>`;
    document.querySelectorAll('#s2choices387 button').forEach(button => button.onclick = () => answer(button.dataset.a, 'mouse_touch'));
  }

  function answer(value, mode){
    if (answerLocked) return;
    answerLocked = true;
    const item = questions[index];
    const yes = value === item[2];
    document.querySelectorAll('#s2choices387 button').forEach(button => {
      button.disabled = true;
      button.style.outline = '';
      button.style.boxShadow = '';
      button.style.borderColor = button.dataset.a === item[2] ? '#86efac' : (button.dataset.a === value ? '#fda4af' : '#94a3b855');
      if (button.dataset.a === item[2]) button.style.background = '#166534cc';
      else if (button.dataset.a === value) button.style.background = '#991b1bcc';
    });
    if (yes) correct += 1;
    $('s2fb387').innerHTML = `<div style="padding:12px;border-radius:14px;background:${yes?'#16653455':'#991b1b55'};border:1px solid ${yes?'#86efac99':'#fda4af99'}"><b>${yes?'ถูกต้อง!':'ยังไม่ถูก'}</b><br>${esc(item[4])}<br><small>Input: ${mode === 'hand' ? 'Hand dwell' : 'Mouse / Touch'}</small><div style="margin-top:10px"><button type="button" id="s2next387">${index === questions.length-1 ? 'สรุป AR' : 'ข้อต่อไป'}</button></div></div>`;
    $('s2next387').onclick = () => { index += 1; draw(); };
    setHandStatus('Hand: เล็งปุ่ม “ข้อต่อไป” เพื่อไปยังคำถามถัดไป', true);
  }

  function hint(){
    const item = questions[index];
    if (!item || answerLocked) return;
    helpUsed += 1;
    $('s2fb387').innerHTML = '<div style="padding:12px;border-radius:14px;background:#22d3ee14;border:1px solid #22d3ee33"><b>AI Help:</b><br>จำ PEAS: P=วัดผล, E=โลก, A=สิ่งที่กระทำ, S=สิ่งที่รับรู้</div>';
  }

  function done(){
    stopCamera();
    const score = Math.round(correct * 100 / questions.length);
    const result = {
      version:'v4.0.2-s2-ar-all-controls',
      sessionId:'s2', missionId:'m2', arCompleted:true,
      total:questions.length, correct, wrong:questions.length-correct,
      accuracy:score, arScore:score, helpUsed,
      usedSec:Math.round((Date.now()-startedAt)/1000),
      finishedAt:new Date().toISOString(),
      inputMode:handReady ? 'hand_or_mouse_touch' : 'mouse_touch'
    };
    window.AIQUEST_S2_AR_RESULT = result;
    try { localStorage.setItem(KEY, JSON.stringify(result)); } catch (_) {}
    $('s2card387').innerHTML = `<div style="font-size:12px;font-weight:900;color:#ddd6fe">AR Practice Complete</div><h2>${score >= 85 ? 'Agent Builder Master' : 'S2 AR Complete'}</h2><p>คะแนน ${score}% • ถูก ${correct}/${questions.length}</p><p style="font-size:13px;color:#cbd5e1">ใช้มือเล็งปุ่มด้านล่างเพื่อฝึกซ้ำหรือกลับ Session 2</p><button type="button" id="s2again387">ฝึกซ้ำ</button> <button type="button" id="s2back387">กลับ Session 2</button>`;
    $('s2again387').onclick = start;
    $('s2back387').onclick = () => { close(); location.href = 'index.html?session=s2'; };
  }

  const params = new URLSearchParams(location.search);
  if ((params.get('session') || '').toLowerCase() === 's2' && (params.get('ar') || '').toLowerCase() === 'agent') setTimeout(start,350);
  window.AIQUEST_S2_AR_PRACTICE = {start,close,version:'v4.0.2'};
})();
