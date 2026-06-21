(function(){
  const $ = (selector) => document.querySelector(selector);
  const stage = $('#gameStage');
  const TIMER_SECONDS = 270;
  const userSignals = {
    menu: '“ฉันไม่แน่ใจว่าต้องเริ่มจากเมนูไหนก่อน เพราะชื่อเมนูคล้ายกันมาก”',
    font: '“ฉันอ่านคำแนะนำบนหน้าจอไม่ทัน และไม่เห็นข้อมูลสำคัญบนมือถือ”',
    cta: '“ฉันไม่แน่ใจว่าปุ่มนี้ส่งคำร้องจริง หรือแค่บันทึกข้อมูลไว้เฉย ๆ”',
    feedback: '“ฉันกดส่งแล้ว แต่ไม่รู้ว่าระบบรับเรื่องหรือยัง จึงเกือบกดซ้ำ”',
    mobile: '“ตอนใช้มือถือ ฉันแตะเมนูผิดบ่อย เพราะปุ่มอยู่ชิดกันเกินไป”'
  };

  let current;
  let timerId = null;
  let timerPaused = false;
  let state;

  const choose = (array) => array[Math.floor(Math.random() * array.length)];

  function freshState(){
    return {
      phase: 0,
      score: 0,
      stability: 100,
      combo: 0,
      found: [],
      classes: {},
      fixes: {},
      explain: null,
      hintCount: 2,
      remaining: TIMER_SECONDS,
      wrongScans: 0,
      timerExpired: false,
      toastTimer: null
    };
  }

  function start(){
    stopTimer();
    current = choose(W1_CASES);
    state = freshState();
    updateHud();
    render();
    startTimer();
  }

  function stopTimer(){
    if(timerId){
      window.clearInterval(timerId);
      timerId = null;
    }
  }

  function startTimer(){
    stopTimer();
    timerPaused = false;
    timerId = window.setInterval(() => {
      if(timerPaused || document.hidden || state.phase >= 5) return;
      state.remaining = Math.max(0, state.remaining - 1);
      if(state.remaining === 0 && !state.timerExpired){
        state.timerExpired = true;
        state.combo = 0;
        state.stability = Math.max(0, state.stability - 12);
        showToast('⏱ Time pressure! ผู้ใช้เริ่มหมดความอดทนแล้ว Experience Stability ลดลง', 'danger');
      }
      updateHud();
    }, 1000);
  }

  function formatTime(total){
    const minutes = Math.floor(total / 60);
    const seconds = String(total % 60).padStart(2, '0');
    return `${minutes}:${seconds}`;
  }

  function updateHud(){
    const friction = Math.max(0, 100 - state.stability);
    $('#stabilityValue').textContent = state.stability;
    $('#comboValue').textContent = state.combo;
    $('#scoreValue').textContent = state.score;
    $('#timeValue').textContent = formatTime(state.remaining);
    $('#hintValue').textContent = state.hintCount;
    $('#frictionValue').textContent = friction;

    const frictionChip = $('#frictionChip');
    if(frictionChip){
      frictionChip.classList.remove('pulse-safe','pulse-warn','pulse-danger');
      frictionChip.classList.add(friction >= 45 ? 'pulse-danger' : friction >= 20 ? 'pulse-warn' : 'pulse-safe');
    }
    const timeChip = $('#timeChip');
    if(timeChip) timeChip.classList.toggle('time-danger', state.remaining <= 45);
    const hintBtn = $('#hintBtn');
    if(hintBtn){
      hintBtn.disabled = state.phase !== 0 || state.hintCount <= 0 || state.found.length >= current.issues.length;
      hintBtn.setAttribute('aria-label', `ใช้คำใบ้ เหลือ ${state.hintCount} ครั้ง`);
    }
  }

  function markPhase(){
    document.querySelectorAll('.phase').forEach((element, index) => {
      element.classList.toggle('active', index === state.phase);
      element.disabled = index > state.phase;
    });
  }

  function add(points, good = true){
    if(good){
      state.combo += 1;
      state.score += points + Math.min(state.combo, 8);
      state.stability = Math.min(100, state.stability + 2);
    }else{
      state.combo = 0;
      state.stability = Math.max(0, state.stability - 10);
    }
    updateHud();
  }

  function registerWrongScan(){
    state.wrongScans += 1;
    state.combo = 0;
    state.stability = Math.max(0, state.stability - 5);
    const message = state.wrongScans >= 2
      ? 'สัญญาณยังไม่ชัด ลองอ่าน User Signal อีกครั้ง หรือใช้ Hint เพื่อเปิดเบาะแส 1 จุด'
      : 'ยังไม่ใช่จุด UX Friction ที่สำคัญ ลองเชื่อมปัญหากับเป้าหมายของผู้ใช้ก่อน';
    showToast(`⚠ ${message}`, 'warn');
    updateHud();
  }

  function next(){
    state.phase += 1;
    markPhase();
    render();
    window.scrollTo({top:0, behavior:'smooth'});
  }

  function render(){
    markPhase();
    const renderer = [observe, diagnose, fix, userTest, explain][state.phase];
    if(renderer) renderer();
    updateHud();
  }

  function screenCopy(){
    if(current.id === 'appointment'){
      return {
        heading: 'จองเวลาพบอาจารย์',
        intro: 'เลือกเวลาที่สะดวกเพื่อยืนยันการนัดหมายกับอาจารย์ที่ปรึกษาในระบบกลาง',
        label: 'ช่วงเวลาที่ต้องการนัด',
        input: 'เลือกวันและเวลา',
        label2: 'รายละเอียดเพิ่มเติม',
        textarea: 'พิมพ์วัตถุประสงค์...',
        send: 'ดำเนินการ',
        menu: ['นัดหมายทั่วไป','จองเวลาอาจารย์','นัดหมายวิชาการ','เปลี่ยนเวลานัด','บริการอื่น ๆ']
      };
    }
    return {
      heading: 'ส่งคำร้องขอความช่วยเหลือ',
      intro: 'กรุณากรอกข้อมูลของคุณให้ครบเพื่อดำเนินการตามขั้นตอนภายในระบบศูนย์กลางบริการนักศึกษา',
      label: 'เรื่องที่ต้องการติดต่อ',
      input: 'เลือกหัวข้อบริการ',
      label2: 'รายละเอียดเพิ่มเติม',
      textarea: 'พิมพ์ข้อความ...',
      send: 'ดำเนินการส่ง',
      menu: ['บริการทั่วไป','บริการนักศึกษา','ช่วยเหลือนักศึกษา','คำร้องนักศึกษา','บริการอื่น ๆ']
    };
  }

  function renderEvidenceSlots(){
    const slots = Array.from({length: current.issues.length}, (_, index) => {
      const issueId = state.found[index];
      if(!issueId){
        return `<div class="found-item evidence-locked"><strong>Evidence Slot ${String(index + 1).padStart(2,'0')} — ยังไม่พบ</strong><small>สแกนหน้าจอโดยมองจากเป้าหมายของผู้ใช้</small></div>`;
      }
      const issue = current.issues.find(item => item.id === issueId);
      return `<div class="found-item evidence-found"><strong>Evidence ${String(index + 1).padStart(2,'0')} — ${issue.name}</strong><small>${issue.detail}</small></div>`;
    });
    return slots.join('');
  }

  function showToast(message, tone = 'info'){
    const toast = $('#signalToast');
    if(!toast) return;
    toast.className = `signal-toast show ${tone}`;
    toast.innerHTML = message;
    window.clearTimeout(state.toastTimer);
    state.toastTimer = window.setTimeout(() => {
      toast.classList.remove('show');
    }, 4800);
  }

  function renderSignalToast(issue){
    const userQuote = userSignals[issue.id] || '“ผู้ใช้กำลังติดขัดกับบางสิ่งบนหน้าจอ”';
    showToast(`<span class="toast-kicker">NEW USER SIGNAL</span><strong>${userQuote}</strong><small>เก็บเป็น Evidence แล้ว ไปจัดประเภทใน Diagnose ต่อ</small>`, 'signal');
  }

  function requestHint(){
    if(state.phase !== 0 || state.hintCount <= 0) return;
    const candidates = [...document.querySelectorAll('.hotspot')].filter((element) => !state.found.includes(element.dataset.id));
    const target = candidates[Math.floor(Math.random() * candidates.length)];
    if(!target) return;
    state.hintCount -= 1;
    target.classList.add('hint-reveal');
    target.setAttribute('aria-label', 'Hint: มี UX Friction อยู่บริเวณนี้');
    showToast('💡 Hint active — มองหาสิ่งที่ทำให้ผู้ใช้เริ่มงานต่อไม่ได้ หรือไม่รู้ว่าสถานะระบบเป็นอย่างไร', 'info');
    window.setTimeout(() => target.classList.remove('hint-reveal'), 2600);
    updateHud();
  }

  function observe(){
    const copy = screenCopy();
    stage.innerHTML = `
      <section class="stage-card">
        <div class="stage-grid">
          <div>
            <p class="eyebrow">USER SIGNAL</p>
            <blockquote class="case-quote">${current.quote}</blockquote>
            <div class="case-meta"><span>บริการ: ${current.service}</span><span>บริบท: ${current.device}</span><span>เป้าหมาย: ส่งคำร้องให้สำเร็จ</span></div>
            <p class="muted">สแกนหน้าจอจำลองเพื่อค้นหาจุดที่ทำให้ผู้ใช้ติดขัด มีทั้งหมด <b>${current.issues.length}</b> จุด <span class="scan-note">— กรอบคำตอบจะยังไม่แสดงจนกว่าจะพบหรือใช้ Hint</span></p>
            <div id="mockScreen" class="mock-screen" aria-label="หน้าจอจำลองมีปัญหา" tabindex="0">
              <div class="mock-top"><b>Smart Campus</b><div class="mock-nav"><span>บริการ</span><span>ช่วยเหลือ</span><span>บัญชี</span></div></div>
              <div class="mock-content">
                <h3>${copy.heading}</h3>
                <p>${copy.intro}</p>
                <div class="mock-form">
                  <span class="mock-label">${copy.label}</span>
                  <div class="mock-input">${copy.input}</div>
                  <span class="mock-label" style="margin-top:8px">${copy.label2}</span>
                  <div class="mock-input mock-textarea">${copy.textarea}</div>
                  <div class="mock-btn-row"><button class="mock-send" type="button" tabindex="-1">${copy.send}</button></div>
                  <div class="mock-no-feedback"></div>
                </div>
                <div class="mock-side-menu">${copy.menu.map(item => `<span>${item}</span>`).join('')}</div>
              </div>
              <button class="hotspot hs-menu" data-id="menu" aria-label="สแกนบริเวณเมนู"></button>
              <button class="hotspot hs-font" data-id="font" aria-label="สแกนบริเวณข้อความ"></button>
              <button class="hotspot hs-cta" data-id="cta" aria-label="สแกนบริเวณปุ่มส่ง"></button>
              <button class="hotspot hs-feedback" data-id="feedback" aria-label="สแกนบริเวณสถานะหลังส่ง"></button>
              <button class="hotspot hs-mobile" data-id="mobile" aria-label="สแกนบริเวณเมนูบนมือถือ"></button>
            </div>
            <div id="signalToast" class="signal-toast" role="status" aria-live="polite"></div>
          </div>
          <aside class="scan-side">
            <p class="eyebrow">FRICTION HUNT</p>
            <h2>ค้นหาจุดพังของประสบการณ์ผู้ใช้</h2>
            <p>อย่าคลิกสุ่ม: เริ่มจากเป้าหมายของผู้ใช้ว่าเขาต้องการทำอะไรให้สำเร็จ แล้วหาสิ่งที่ทำให้เขาหลงทาง ไม่มั่นใจ หรือทำงานต่อไม่ได้</p>
            <div class="issue-counter">พบแล้ว <b id="foundCount">${state.found.length}</b> / ${current.issues.length} จุด <span class="scan-mistakes">• Wrong scans ${state.wrongScans}</span></div>
            <div id="foundList" class="found-list">${renderEvidenceSlots()}</div>
            <div class="scan-rule"><strong>SCAN RULE</strong><span>คลิกพลาดจะเพิ่ม Friction Pulse และรีเซ็ต Combo • Hint เปิดได้เพียง 2 ครั้ง</span></div>
            <div class="notification warning">Critical Alert: ต้องค้นหาและแก้ปัญหาสำคัญให้ครบ จึงจะผ่าน Mission ได้</div>
            <div class="stage-actions"><button id="scanNext" class="primary-btn" type="button" ${state.found.length === current.issues.length ? '' : 'disabled'}>${state.found.length === current.issues.length ? 'จัดประเภทปัญหา →' : 'สแกน Evidence ให้ครบ'}</button></div>
          </aside>
        </div>
      </section>`;

    const mockScreen = $('#mockScreen');
    mockScreen.addEventListener('click', (event) => {
      if(event.target.closest('.hotspot')) return;
      registerWrongScan();
      $('#foundCount').textContent = state.found.length;
      const scanMistakes = document.querySelector('.scan-mistakes');
      if(scanMistakes) scanMistakes.textContent = `• Wrong scans ${state.wrongScans}`;
    });

    document.querySelectorAll('.hotspot').forEach((element) => {
      element.addEventListener('click', (event) => {
        event.stopPropagation();
        const id = element.dataset.id;
        if(state.found.includes(id)) return;
        state.found.push(id);
        element.classList.add('found');
        const issue = current.issues.find(item => item.id === id);
        add(7, true);
        $('#foundCount').textContent = state.found.length;
        $('#foundList').innerHTML = renderEvidenceSlots();
        renderSignalToast(issue);
        if(state.found.length === current.issues.length){
          $('#scanNext').disabled = false;
          $('#scanNext').textContent = 'จัดประเภทปัญหา →';
          showToast('✅ Evidence ครบแล้ว — เข้าสู่ Diagnose เพื่อแยกผลกระทบต่อผู้ใช้', 'success');
        }
      });
    });
    $('#scanNext').addEventListener('click', next);
  }

  function diagnose(){
    stage.innerHTML = `<section class="stage-card"><p class="eyebrow">DIAGNOSE</p><h2>ปัญหานี้กระทบผู้ใช้ในมิติใดมากที่สุด?</h2><p class="muted">เลือกคำตอบที่ “ชัดที่สุด” สำหรับแต่ละจุด แม้บางปัญหาจะกระทบได้มากกว่าหนึ่งมิติ</p><div class="classification-grid">${current.issues.map(issue => `<article class="issue-classify" data-id="${issue.id}"><h3>${issue.name}${issue.critical ? ' <span style="color:var(--red);font-size:.72rem">● CRITICAL</span>' : ''}</h3><p>${issue.detail}</p><div class="button-row">${['Usability','Emotion','Accessibility','Value'].map(category => `<button class="chip-btn" type="button" data-cat="${category}">${category}</button>`).join('')}</div></article>`).join('')}</div><div class="stage-actions"><button id="diagNext" class="primary-btn" type="button" disabled>เลือกวิธีแก้ →</button></div></section>`;
    document.querySelectorAll('.issue-classify').forEach(card => card.querySelectorAll('.chip-btn').forEach(button => button.addEventListener('click', () => {
      card.querySelectorAll('.chip-btn').forEach(item => item.classList.remove('selected'));
      button.classList.add('selected');
      state.classes[card.dataset.id] = button.dataset.cat;
      $('#diagNext').disabled = Object.keys(state.classes).length !== current.issues.length;
    })));
    $('#diagNext').addEventListener('click', () => {
      current.issues.forEach(issue => add(4, state.classes[issue.id] === issue.cat));
      next();
    });
  }

  function fix(){
    stage.innerHTML = `<section class="stage-card"><p class="eyebrow">DESIGN FIX</p><h2>เลือกวิธีแก้ที่ช่วยผู้ใช้ได้จริง</h2><p class="muted">ให้ความสำคัญกับปัญหา Critical ก่อน: งานต้องทำสำเร็จ อ่านได้ และรู้สถานะของระบบ</p><div class="fix-grid">${current.issues.map(issue => `<article class="fix-card" data-id="${issue.id}"><h3>${issue.name}</h3>${W1_FIXES[issue.fix].map((fixOption, index) => `<button type="button" class="choice-btn" data-index="${index}">${String.fromCharCode(65 + index)}. ${fixOption.t}</button>`).join('')}</article>`).join('')}</div><div class="stage-actions"><button id="fixNext" class="primary-btn" type="button" disabled>ดูผล User Simulation →</button></div></section>`;
    document.querySelectorAll('.fix-card').forEach(card => card.querySelectorAll('.choice-btn').forEach(button => button.addEventListener('click', () => {
      card.querySelectorAll('.choice-btn').forEach(item => item.classList.remove('selected'));
      button.classList.add('selected');
      state.fixes[card.dataset.id] = Number(button.dataset.index);
      $('#fixNext').disabled = Object.keys(state.fixes).length !== current.issues.length;
    })));
    $('#fixNext').addEventListener('click', () => {
      current.issues.forEach(issue => {
        const isCorrect = W1_FIXES[issue.fix][state.fixes[issue.id]].ok;
        add(8, isCorrect);
      });
      next();
    });
  }

  function userTest(){
    const fixCorrect = current.issues.filter(issue => W1_FIXES[issue.fix][state.fixes[issue.id]].ok).length;
    const criticalFixed = current.issues.filter(issue => issue.critical).every(issue => W1_FIXES[issue.fix][state.fixes[issue.id]].ok);
    const foundPct = state.found.length / current.issues.length;
    const success = Math.round(42 + fixCorrect / current.issues.length * 52);
    const errors = Math.max(0, 7 - fixCorrect + Math.floor(state.wrongScans / 3));
    const time = Math.max(38, 125 - fixCorrect * 16 + state.wrongScans * 3);
    state.sim = {fixCorrect, criticalFixed, foundPct, success, errors, time};
    stage.innerHTML = `<section class="stage-card"><p class="eyebrow">USER TEST SIMULATION</p><h2>${criticalFixed ? 'ผู้ใช้เริ่มทำงานสำเร็จแล้ว' : 'ระบบยังมี Critical Friction เหลืออยู่'}</h2><p class="muted">ผลจำลองนี้สะท้อนผลของการตัดสินใจออกแบบ ไม่ใช่แค่จำนวนคำตอบที่ถูก</p><div class="simulation-result"><article class="metric-card"><span>Task Success</span><b class="${success >= 70 ? 'metric-good' : 'metric-bad'}">${success}%</b></article><article class="metric-card"><span>Misclicks</span><b class="${errors <= 2 ? 'metric-good' : 'metric-bad'}">${errors}</b></article><article class="metric-card"><span>Time on Task</span><b class="${time <= 70 ? 'metric-good' : 'metric-bad'}">${time}s</b></article><article class="metric-card"><span>Critical Gate</span><b class="${criticalFixed ? 'metric-good' : 'metric-bad'}">${criticalFixed ? 'PASS' : 'FAIL'}</b></article></div><div class="timeline"><div class="timeline-item">ผู้ใช้มองหาเมนูและเริ่มกรอกแบบฟอร์ม</div><div class="timeline-item">${fixCorrect >= 3 ? 'CTA และข้อมูลสำคัญทำให้ผู้ใช้เข้าใจสิ่งที่ต้องทำต่อ' : 'ผู้ใช้ยังเสียเวลาเพราะ CTA หรือข้อมูลสำคัญไม่ชัด'}</div><div class="timeline-item">${criticalFixed ? 'ผู้ใช้ได้รับสถานะยืนยัน จึงไม่ต้องส่งซ้ำ' : 'ผู้ใช้ยังไม่แน่ใจว่าส่งสำเร็จหรือไม่ และอาจทำรายการซ้ำ'}</div></div><div class="stage-actions"><button id="testNext" class="primary-btn" type="button">Explain Check →</button></div></section>`;
    $('#testNext').addEventListener('click', next);
  }

  function explain(){
    const good = 'การเพิ่มข้อความยืนยันและสถานะที่ตรวจสอบได้ช่วยลดความกังวล ทำให้ผู้ใช้รู้ว่าระบบรับข้อมูลแล้วและไม่ต้องส่งซ้ำ';
    const options = [good, 'เพราะทำให้หน้าจอดูมีสีสันขึ้น จึงน่าจะทำให้ผู้ใช้ชอบระบบมากกว่าเดิม', 'เพราะระบบควรซ่อนผลลัพธ์ไว้เพื่อให้ผู้ใช้กลับมาเปิดหน้าเดิมหลายครั้ง', 'เพราะปุ่มยืนยันควรอยู่ห่างจากฟอร์ม เพื่อให้ผู้ใช้มีเวลาคิดนานขึ้น'];
    stage.innerHTML = `<section class="stage-card explain-card"><p class="eyebrow">EXPLAIN CHECK</p><h2>เหตุใดการเพิ่มข้อความยืนยันหลังส่งคำร้องจึงช่วย UX?</h2><p>เลือกคำอธิบายที่เชื่อม “การออกแบบ” กับ “ผลที่เกิดกับผู้ใช้” ได้ดีที่สุด</p><div class="explain-options">${options.map((option, index) => `<button class="explain-option" type="button" data-i="${index}">${String.fromCharCode(65 + index)}. ${option}</button>`).join('')}</div></section>`;
    document.querySelectorAll('.explain-option').forEach(button => button.addEventListener('click', () => {
      state.explain = Number(button.dataset.i);
      add(12, state.explain === 0);
      summary();
    }));
  }

  function summary(){
    stopTimer();
    const simulation = state.sim;
    const raw = Math.min(100, Math.round((state.score / (current.issues.length * 19 + 12)) * 100));
    const score = Math.max(0, raw);
    let stars = 0;
    if(score >= 60 && simulation.criticalFixed && state.explain === 0) stars = 1;
    if(score >= 75 && simulation.fixCorrect >= 4) stars = 2;
    if(score >= 90 && simulation.fixCorrect === current.issues.length && state.stability >= 80 && state.wrongScans <= 1) stars = 3;
    const skills = {
      empathy: Math.round((Object.keys(state.classes).filter(id => state.classes[id] === current.issues.find(issue => issue.id === id).cat).length / current.issues.length) * 35),
      clarity: Math.round((simulation.fixCorrect / current.issues.length) * 40),
      flow: Math.round(simulation.criticalFixed ? 25 : 10)
    };
    const dxp = stars ? Math.round(45 + stars * 25 + score / 4) : 0;
    UXQ.addMissionResult('w1', {score, stars, dxp, skills, caseId: current.id, wrongScans: state.wrongScans, completedAt: new Date().toISOString()});
    const title = stars ? ['', 'Mission Clear!', 'Mastery Achieved!', 'Expert Rescue!'][stars] : 'Recovery Needed';
    const note = stars ? 'คุณผ่าน W1 แล้ว W2 จะพร้อมเมื่อ Mission Pack ถัดไปถูกเพิ่มเข้าระบบ' : 'ยังผ่านไม่ครบ: ลองเล่นใหม่โดยโฟกัส Critical Error, ลดการสแกนสุ่ม และเชื่อมเหตุผลกับผลที่เกิดกับผู้ใช้';
    stage.innerHTML = `<section class="stage-card summary-hero"><p class="eyebrow">MISSION REPORT</p><div class="star-result">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</div><h2>${title}</h2><div class="score-big">${score}</div><p class="muted">คะแนน Mission • ${current.title}</p><div class="summary-grid"><article><span>DXP ได้รับ</span><b>+${dxp}</b></article><article><span>Critical Gate</span><b class="${simulation.criticalFixed ? 'metric-good' : 'metric-bad'}">${simulation.criticalFixed ? 'PASS' : 'FAIL'}</b></article><article><span>Evidence Discipline</span><b>${state.wrongScans === 0 ? 'Clean' : `${state.wrongScans} miss`}</b></article></div><p class="summary-note">${note}</p><div class="stage-actions" style="justify-content:center"><a class="ghost-btn" href="./index.html">กลับ Mission Map</a><button id="replayBtn" class="primary-btn" type="button">เล่นซ้ำ • Case ใหม่</button></div></section>`;
    $('#replayBtn').addEventListener('click', start);
  }

  $('#howBtn').addEventListener('click', () => {
    timerPaused = true;
    $('#howDialog').showModal();
  });
  $('#howDialog').addEventListener('close', () => { timerPaused = false; });
  document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => document.getElementById(button.dataset.close).close()));
  $('#hintBtn').addEventListener('click', requestHint);
  document.addEventListener('visibilitychange', () => updateHud());
  start();
})();
