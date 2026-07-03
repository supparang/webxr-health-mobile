/* UX Quest • W1 Week 1 Alignment v1
 * Loads before uxq-mission-engine-v3.js on W1 only.
 * Aligns the game with CSAI2601 Week 1: UI/UX & Front-end Design.
 */
(() => {
  'use strict';

  if (!/w1-ux-crisis-casefile\.html/i.test(location.pathname)) return;

  const SCAN_KEY = 'uxq.w1.first-impression.v1';
  const MINI_STEPS = [2, 4, 6];
  const completedMini = new Set();
  let current;
  let bypassStart = false;
  let bypassNext = false;
  let observerStarted = false;

  const esc = (value) => String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  const STAGE_LABELS = {
    evidence: {
      label: '01 • First Impression Evidence',
      instruction: 'เริ่มจาก Task และพฤติกรรมจริง: ผู้ใช้ทำอะไร เห็นอะไร และติดตรงไหน ไม่ใช่จากความชอบของทีม'
    },
    hypothesis: {
      label: '02 • UX Impact',
      instruction: 'เชื่อมหลักฐานกับ friction ที่ผู้ใช้พบ เช่น ไม่เห็นสถานะ ไม่รู้ขั้นถัดไป หรือไม่มั่นใจว่าทำสำเร็จ'
    },
    fix: {
      label: '03 • UI/UX Fix',
      instruction: 'เลือกการแก้ที่ทำให้ hierarchy, feedback หรือ next step ชัดขึ้นและช่วยให้ task สำเร็จ'
    },
    test: {
      label: '04 • Task Success Test',
      instruction: 'วัด task success, เวลา, ความผิดพลาด และความมั่นใจของผู้ใช้ ไม่ใช่ถามเพียงว่าสวยหรือไม่'
    }
  };

  const START_SCAN = [
    {
      id: 'task',
      prompt: 'ก่อนบอกว่าหน้าจอ “ดี” หรือ “ไม่ดี” ควรถามอะไรเป็นอันดับแรก?',
      options: [
        ['ผู้ใช้ต้องการทำงานอะไรให้สำเร็จในสถานการณ์นี้', true],
        ['ทีมชอบสีใดมากที่สุด', false],
        ['หน้าจอมีเอฟเฟกต์มากพอหรือยัง', false]
      ],
      feedback: 'UX เริ่มที่เป้าหมายของผู้ใช้ (task) เพราะหน้าจอเดียวกันอาจดีหรือแย่ต่างกันตามงานที่ผู้ใช้ต้องทำ'
    },
    {
      id: 'hierarchy',
      prompt: 'เมื่อผู้ใช้กำลังรีบ อะไรควรเด่นที่สุดบนหน้าจอ?',
      options: [
        ['ข้อมูลและการกระทำที่ช่วยให้ทำ task ปัจจุบันต่อได้', true],
        ['ทุกปุ่มให้เด่นเท่ากันเพื่อความยุติธรรม', false],
        ['องค์ประกอบตกแต่งที่ทำให้หน้าจอดูทันสมัย', false]
      ],
      feedback: 'Visual hierarchy ที่ดีทำให้ผู้ใช้เห็นสิ่งสำคัญก่อน ไม่ต้องสแกนทุกอย่างหรือเดาว่าต้องกดอะไร'
    },
    {
      id: 'state',
      prompt: 'ผู้ใช้กดส่งแบบฟอร์มแล้ว แต่ไม่รู้ว่าระบบบันทึกสำเร็จหรือไม่ ปัญหานี้คืออะไร?',
      options: [
        ['ปัญหา UX เรื่อง feedback/state ซึ่ง UI ที่ไม่ชัดอาจเป็นสาเหตุ', true],
        ['ปัญหาความสวยของสีพื้นหลังเท่านั้น', false],
        ['ปัญหาที่ผู้ใช้ควรจำเองว่าเคยกดส่งแล้ว', false]
      ],
      feedback: 'เมื่อ state ไม่ชัด ผู้ใช้จะกดซ้ำ ย้อนกลับ หรือถามเจ้าหน้าที่ แม้ปุ่มจะดูสวยก็ตาม'
    },
    {
      id: 'emotion',
      prompt: 'สำหรับ task สำคัญ เช่น จ่ายเงิน จองคิว หรือส่งเอกสาร ระบบควรทำให้ผู้ใช้รู้สึกอย่างไร?',
      options: [
        ['มั่นใจ ควบคุมได้ และรู้ขั้นถัดไป', true],
        ['ตื่นเต้นกับภาพเคลื่อนไหวมากที่สุด', false],
        ['ต้องค้นหาข้อมูลเองเพื่อพิสูจน์ว่าเข้าใจจริง', false]
      ],
      feedback: 'Experience ที่ดีช่วยลดความกังวลและทำให้ผู้ใช้เชื่อว่าระบบพาเขาไปถึงเป้าหมายได้'
    }
  ];

  const MINI_CHECKS = {
    2: {
      prompt: 'UI หรือ UX? วันและเวลานัดมีตัวอักษรเล็กจนผู้ใช้มาผิดวัน',
      options: [
        ['UI issue ที่สร้าง UX impact เพราะ hierarchy ไม่ช่วยให้ผู้ใช้ตัดสินใจถูก', true],
        ['เป็นเพียงปัญหาความชอบส่วนตัว', false],
        ['ผู้ใช้ควรจำวันนัดเองโดยไม่ต้องดูหน้าสรุป', false]
      ],
      feedback: 'ตัวอักษรหรือ hierarchy เป็นระดับ UI แต่ผลที่ผู้ใช้มาผิดวันคือ UX impact จึงต้องวิเคราะห์ทั้งองค์ประกอบและผลต่อ task'
    },
    4: {
      prompt: 'UI หรือ UX? ผู้ใช้ส่งฟอร์มแล้วแต่ไม่รู้ว่าต้องทำอะไรต่อ',
      options: [
        ['UX problem เรื่อง state/next step; ควรออกแบบ feedback ที่ชัดในจังหวะนั้น', true],
        ['เพิ่มฟีเจอร์ใหม่ให้มากที่สุดก่อน', false],
        ['ถามเพียงว่าผู้ใช้ชอบหน้าจอหรือไม่', false]
      ],
      feedback: 'วิธีแก้ที่ตรงคือแสดงสถานะสำเร็จ สิ่งที่บันทึก และ next step ไม่ใช่เพิ่มองค์ประกอบที่ไม่ช่วยให้ task ไปต่อ'
    },
    6: {
      prompt: 'UI หรือ UX? ปุ่มทุกปุ่มมีสีสดและขนาดเท่ากันจนผู้ใช้ไม่รู้ต้องกดอะไรต่อ',
      options: [
        ['UI hierarchy ไม่ชัดและกลายเป็น UX friction ในการเลือก action', true],
        ['ยิ่งเด่นเท่ากันยิ่งดี เพราะไม่มีปุ่มใดสำคัญกว่า', false],
        ['แก้ด้วยการใส่ข้อความยาว ๆ ก่อนทุกปุ่ม', false]
      ],
      feedback: 'เมื่อทุกอย่างแข่งกันเด่น ผู้ใช้ต้องใช้เวลาเปรียบเทียบเกินจำเป็น การออกแบบควรทำ primary action เด่นในบริบทงาน'
    }
  };

  function addStyle(){
    if (document.getElementById('uxq-w1-alignment-style')) return;
    const style = document.createElement('style');
    style.id = 'uxq-w1-alignment-style';
    style.textContent = `
      .uxq-w1-lens{margin:2px 0 4px;padding:15px;border-radius:17px;border:1px solid rgba(110,231,255,.36);background:linear-gradient(140deg,rgba(110,231,255,.10),rgba(155,140,255,.10));display:grid;gap:9px}
      .uxq-w1-lens__head{display:flex;gap:9px;align-items:center}.uxq-w1-lens__head strong{font-size:.96rem}.uxq-w1-lens__head span{font-size:.74rem;letter-spacing:.09em;font-weight:900;color:var(--uxq-accent);text-transform:uppercase}
      .uxq-w1-lens__grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}.uxq-w1-lens__grid div{padding:10px 11px;border-radius:12px;background:rgba(6,18,40,.35);border:1px solid rgba(181,205,255,.15)}.uxq-w1-lens__grid b{display:block;color:#fff;font-size:.85rem;margin-bottom:4px}.uxq-w1-lens__grid span{display:block;color:var(--uxq-muted);font-size:.78rem;line-height:1.45}
      .uxq-w1-stage-lens{margin:13px 0 0;padding:10px 12px;border-left:3px solid var(--uxq-accent);border-radius:0 12px 12px 0;background:rgba(110,231,255,.08);color:#dcecff;font-size:.86rem;line-height:1.5}.uxq-w1-stage-lens b{color:var(--uxq-accent)}
      .uxq-w1-coach{width:min(760px,100%);text-align:left;border:1px solid rgba(155,140,255,.48);border-radius:16px;padding:15px 16px;background:rgba(155,140,255,.10);display:grid;gap:8px}.uxq-w1-coach__kicker{font-size:.73rem;font-weight:900;letter-spacing:.1em;color:#c7bbff;text-transform:uppercase}.uxq-w1-coach h3{margin:0;font-size:1rem}.uxq-w1-coach p{margin:0;color:#dbe7ff;line-height:1.58}.uxq-w1-coach ul{margin:0;padding-left:20px;color:#dbe7ff;line-height:1.6;font-size:.9rem}
      .uxq-w1-modal{position:fixed;inset:0;z-index:1000;display:grid;place-items:center;padding:18px;background:rgba(2,9,24,.80);backdrop-filter:blur(8px)}.uxq-w1-modal__panel{width:min(760px,100%);max-height:min(92vh,900px);overflow:auto;border:1px solid rgba(110,231,255,.42);border-radius:22px;padding:clamp(18px,4vw,30px);background:linear-gradient(155deg,#132b56,#08152f);box-shadow:0 25px 70px rgba(0,0,0,.48)}.uxq-w1-modal__kicker{margin:0 0 8px;color:var(--uxq-accent);font-weight:900;font-size:.75rem;letter-spacing:.11em;text-transform:uppercase}.uxq-w1-modal h2{margin:0;font-size:clamp(1.35rem,3vw,2rem);line-height:1.12}.uxq-w1-modal__lede{margin:9px 0 0;color:var(--uxq-muted);line-height:1.62}.uxq-w1-check{margin:14px 0 0;padding:14px;border:1px solid var(--uxq-line);background:rgba(4,14,32,.36);border-radius:15px}.uxq-w1-check legend{padding:0 4px;color:#fff;font-weight:800;line-height:1.45}.uxq-w1-check label{display:block;margin-top:9px;padding:10px 11px;border:1px solid rgba(181,205,255,.18);border-radius:11px;color:#dce8ff;cursor:pointer;line-height:1.45}.uxq-w1-check label:has(input:checked){border-color:rgba(110,231,255,.75);background:rgba(110,231,255,.10)}.uxq-w1-check input{margin-right:8px;accent-color:#6ee7ff}.uxq-w1-modal__error{margin:12px 0 0;color:#ffb0bb;font-weight:750}.uxq-w1-modal__result{margin-top:16px;padding:14px;border-radius:14px;border:1px solid rgba(119,233,164,.48);background:rgba(39,112,77,.16);color:#e4ffec;line-height:1.6}.uxq-w1-modal__result b{color:#a9f2bf}.uxq-w1-modal__actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:18px}
      @media(max-width:760px){.uxq-w1-lens__grid{grid-template-columns:1fr}.uxq-w1-modal{padding:10px}.uxq-w1-modal__panel{border-radius:18px;padding:18px}.uxq-w1-check label{font-size:.92rem}}
    `;
    document.head.appendChild(style);
  }

  function safeStore(value){
    try { localStorage.setItem(SCAN_KEY, JSON.stringify(value)); return; } catch (error) {}
    try { sessionStorage.setItem(SCAN_KEY, JSON.stringify(value)); } catch (error) {}
  }

  function scanSummary(){
    try { return JSON.parse(localStorage.getItem(SCAN_KEY) || sessionStorage.getItem(SCAN_KEY) || 'null'); }
    catch (error) { return null; }
  }

  function choiceGroup(question){
    return `<fieldset class="uxq-w1-check"><legend>${esc(question.prompt)}</legend>${question.options.map(([label, correct], index) => `<label><input type="radio" name="${esc(question.id)}" value="${index}" data-correct="${correct ? '1' : '0'}">${esc(label)}</label>`).join('')}</fieldset>`;
  }

  function removeModal(){ document.querySelector('.uxq-w1-modal')?.remove(); }

  function openStartScan(){
    if (document.querySelector('.uxq-w1-modal')) return;
    addStyle();
    const modal = document.createElement('section');
    modal.className = 'uxq-w1-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', 'First Impression Scan');
    modal.innerHTML = `<div class="uxq-w1-modal__panel"><p class="uxq-w1-modal__kicker">Before the mission • Week 1</p><h2>First Impression Scan</h2><p class="uxq-w1-modal__lede">ตอบ 4 ข้อนี้ก่อนเริ่มเกม เพื่อใช้เป็นเลนส์วิเคราะห์ในใบงาน UX First Impression Audit ข้อนี้ไม่คิดคะแนนเกม แต่ช่วยให้เริ่มจากผู้ใช้ ไม่ใช่เริ่มจากความสวย</p><form id="uxqW1ScanForm">${START_SCAN.map(choiceGroup).join('')}<p class="uxq-w1-modal__error" id="uxqW1ScanError" hidden>เลือกคำตอบให้ครบก่อนเริ่มภารกิจ</p><div class="uxq-w1-modal__actions"><button class="uxq-btn" type="submit">ตรวจ First Impression Scan <span aria-hidden="true">→</span></button><button class="uxq-btn uxq-btn--ghost" id="uxqW1ScanCancel" type="button">กลับไปอ่าน Briefing</button></div></form></div>`;
    document.body.appendChild(modal);
    document.getElementById('uxqW1ScanCancel')?.addEventListener('click', removeModal);
    document.getElementById('uxqW1ScanForm')?.addEventListener('submit', (event) => {
      event.preventDefault();
      const chosen = START_SCAN.map((question) => modal.querySelector(`input[name="${question.id}"]:checked`));
      const error = modal.querySelector('#uxqW1ScanError');
      if (chosen.some((item) => !item)) { error.hidden = false; return; }
      const score = chosen.filter((item) => item.dataset.correct === '1').length;
      safeStore({ completedAt: new Date().toISOString(), score, total: START_SCAN.length, choices: chosen.map((item) => Number(item.value)) });
      const feedback = START_SCAN.filter((question, index) => chosen[index].dataset.correct !== '1').map((question) => `<li><b>${esc(question.id)}</b>: ${esc(question.feedback)}</li>`);
      modal.querySelector('.uxq-w1-modal__panel').innerHTML = `<p class="uxq-w1-modal__kicker">Scan complete</p><h2>คุณใช้ UX Lens ได้ ${score}/${START_SCAN.length} จุด</h2><div class="uxq-w1-modal__result"><b>จำ 4 คำถามไว้ระหว่างเล่น:</b><br>Task → Hierarchy → Feedback/State → Confidence${feedback.length ? `<ul>${feedback.join('')}</ul>` : '<br>ดีมาก: คุณเริ่มจากผู้ใช้และผลของการออกแบบได้ครบ'}</div><div class="uxq-w1-modal__actions"><button id="uxqW1StartAfterScan" class="uxq-btn" type="button">เริ่มคดี UX Detective <span aria-hidden="true">→</span></button></div>`;
      document.getElementById('uxqW1StartAfterScan')?.addEventListener('click', () => {
        removeModal();
        bypassStart = true;
        document.getElementById('uxqStart')?.click();
      });
    });
  }

  function currentQuestionNo(){
    const meter = document.querySelector('.uxq-hud .uxq-meter b');
    const matched = String(meter?.textContent || '').match(/(\d+)\s*\//);
    return matched ? Number(matched[1]) : 0;
  }

  function openMiniCheck(step){
    const mini = MINI_CHECKS[step];
    if (!mini || document.querySelector('.uxq-w1-modal')) return;
    addStyle();
    const modal = document.createElement('section');
    modal.className = 'uxq-w1-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', 'UI หรือ UX Mini Check');
    modal.innerHTML = `<div class="uxq-w1-modal__panel"><p class="uxq-w1-modal__kicker">UI or UX? • Checkpoint ${step}</p><h2>หยุดคิด 20 วินาที</h2><p class="uxq-w1-modal__lede">คำถามนี้ไม่หักคะแนน แต่ช่วยเชื่อมคดีในเกมกับคำศัพท์ที่ใช้ทำ UX Audit</p><form id="uxqW1MiniForm">${choiceGroup(Object.assign({ id:'mini' + step }, mini))}<p class="uxq-w1-modal__error" id="uxqW1MiniError" hidden>เลือกคำตอบก่อนดำเนินภารกิจต่อ</p><div class="uxq-w1-modal__actions"><button class="uxq-btn" type="submit">ดูเหตุผล <span aria-hidden="true">→</span></button></div></form></div>`;
    document.body.appendChild(modal);
    document.getElementById('uxqW1MiniForm')?.addEventListener('submit', (event) => {
      event.preventDefault();
      const input = modal.querySelector('input[name="mini' + step + '"]:checked');
      if (!input) { modal.querySelector('#uxqW1MiniError').hidden = false; return; }
      const correct = input.dataset.correct === '1';
      modal.querySelector('.uxq-w1-modal__panel').innerHTML = `<p class="uxq-w1-modal__kicker">Mini check feedback</p><h2>${correct ? '✓ เชื่อม UI กับ UX ได้ถูกทิศ' : '↺ ลองมองผลต่อ task อีกครั้ง'}</h2><div class="uxq-w1-modal__result"><b>เหตุผล:</b> ${esc(mini.feedback)}</div><div class="uxq-w1-modal__actions"><button id="uxqW1ContinueAfterMini" class="uxq-btn" type="button">กลับไปเก็บหลักฐานต่อ <span aria-hidden="true">→</span></button></div>`;
      document.getElementById('uxqW1ContinueAfterMini')?.addEventListener('click', () => {
        removeModal();
        bypassNext = true;
        document.getElementById('uxqNext')?.click();
      });
    });
  }

  function decorateIntro(){
    const hero = document.querySelector('.uxq-hero');
    if (!hero || hero.querySelector('.uxq-w1-lens')) return;
    addStyle();
    const previous = scanSummary();
    const card = document.createElement('section');
    card.className = 'uxq-w1-lens';
    card.innerHTML = `<div class="uxq-w1-lens__head"><span>Week 1 Lens</span><strong>ก่อนแก้ UI ให้สแกนผลต่อ UX</strong></div><div class="uxq-w1-lens__grid"><div><b>1. Task</b><span>ผู้ใช้ต้องการทำอะไรให้สำเร็จ?</span></div><div><b>2. Clarity</b><span>สิ่งที่ต้องเห็นหรือกดต่อชัดหรือไม่?</span></div><div><b>3. Confidence</b><span>ผู้ใช้รู้หรือยังว่างานสำเร็จและต้องทำอะไรต่อ?</span></div></div>${previous ? `<small class="uxq-small-note">First Impression Scan ล่าสุด: ${previous.score || 0}/${previous.total || 4} จุด — เล่นรอบนี้เพื่อใช้เลนส์เดิมกับคดีใหม่</small>` : ''}`;
    const actions = hero.querySelector('.uxq-actions');
    if (actions) actions.insertAdjacentElement('beforebegin', card); else hero.appendChild(card);
  }

  function decorateMission(){
    const question = document.querySelector('.uxq-question');
    if (!question || question.querySelector('.uxq-w1-stage-lens')) return;
    const stage = String(document.querySelector('.uxq-stage')?.textContent || '').toLowerCase();
    let text = 'ก่อนตอบ: มอง Task → สิ่งที่ผู้ใช้เห็น → friction → ผลต่อความมั่นใจ';
    if (stage.includes('evidence')) text = 'First Impression Lens: เลือกพฤติกรรมที่เห็นจริง ไม่เลือกความเห็นของทีม';
    else if (stage.includes('impact')) text = 'UX Impact Lens: อธิบาย friction ว่าผู้ใช้หยุด งง กดซ้ำ หรือไม่มั่นใจเพราะอะไร';
    else if (stage.includes('fix')) text = 'UI/UX Fix Lens: วิธีแก้ต้องทำให้ hierarchy, feedback หรือ next step ชัดขึ้น';
    else if (stage.includes('test')) text = 'Task Success Lens: วัดว่าผู้ใช้ทำงานสำเร็จ รู้สถานะ และใช้เวลาน้อยลงหรือไม่';
    const hint = document.createElement('aside');
    hint.className = 'uxq-w1-stage-lens';
    hint.innerHTML = `<b>Week 1 UX Lens</b> • ${esc(text)}`;
    question.insertBefore(hint, question.firstChild);
  }

  function focusLabel(key){
    const map = {
      evidence: 'Evidence: กลับไปหาพฤติกรรมผู้ใช้จริงก่อนสรุป',
      hypothesis: 'Hypothesis: อธิบาย friction จากหลักฐาน ไม่เหมารวมผู้ใช้',
      fix: 'Fix: แก้ hierarchy, feedback หรือ next step ให้ตรงคอขวด',
      test: 'Test: วัด task success และความมั่นใจ ไม่ถามเพียงว่าชอบไหม'
    };
    return map[String(key || '').toLowerCase()] || 'กลับไปตรวจความเชื่อมโยงระหว่าง task, friction และการตัดสินใจ';
  }

  function decorateResult(){
    const result = document.querySelector('.uxq-results');
    if (!result || result.querySelector('.uxq-w1-coach')) return;
    const receipt = window.UXQSubmissionReceipt?.getLast?.();
    const focus = Array.isArray(receipt?.learningMap?.focus) ? receipt.learningMap.focus : [];
    const card = document.createElement('section');
    card.className = 'uxq-w1-coach';
    const scan = scanSummary();
    const body = focus.length
      ? `<p>ก่อนส่งใบงาน UX First Impression Audit ให้กลับไปแก้ส่วนต่อไปนี้จากผลเกม:</p><ul>${focus.map((item) => `<li>${esc(focusLabel(item.stageKey))}</li>`).join('')}</ul>`
      : '<p>คุณเชื่อมคำตอบกับเหตุผลได้ดีแล้ว นำหลักคิดไปใช้กับระบบจริง โดยระบุ Task → Friction → UX impact → Quick redesign → Test plan ให้ครบ</p>';
    card.innerHTML = `<div class="uxq-w1-coach__kicker">Week 1 • Audit Transfer</div><h3>นำผลเกมกลับไปทำใบงาน UX First Impression Audit</h3>${body}${scan ? `<p>First Impression Scan: ${scan.score || 0}/${scan.total || 4} — ใช้เลนส์นี้ประกอบการอธิบาย Value, Usability และ Experience</p>` : ''}`;
    const anchor = result.querySelector('.uxq-takeaway, .uxq-submission-receipt');
    if (anchor) anchor.insertAdjacentElement('afterend', card); else result.appendChild(card);
  }

  function decorate(){
    decorateIntro();
    decorateMission();
    decorateResult();
  }

  function attachEnhancements(){
    if (observerStarted) return;
    observerStarted = true;
    addStyle();
    document.addEventListener('click', (event) => {
      const start = event.target instanceof Element ? event.target.closest('#uxqStart') : null;
      if (start) {
        if (bypassStart) { bypassStart = false; completedMini.clear(); return; }
        event.preventDefault();
        event.stopImmediatePropagation();
        openStartScan();
        return;
      }
      const next = event.target instanceof Element ? event.target.closest('#uxqNext') : null;
      if (!next) return;
      if (bypassNext) { bypassNext = false; return; }
      const step = currentQuestionNo();
      if (!MINI_STEPS.includes(step) || completedMini.has(step)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      completedMini.add(step);
      openMiniCheck(step);
    }, true);
    const boot = () => {
      decorate();
      const observer = new MutationObserver(() => window.requestAnimationFrame(decorate));
      observer.observe(document.documentElement, { childList:true, subtree:true });
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true});
    else boot();
  }

  Object.defineProperty(window, 'UXQMissionEngine', {
    configurable: true,
    get: () => current,
    set: (engine) => {
      if (!engine || typeof engine.init !== 'function') { current = engine; return; }
      const init = engine.init.bind(engine);
      current = Object.freeze(Object.assign({}, engine, {
        init: (config) => {
          const enriched = Object.assign({}, config, {
            eyebrow: 'WEEK 1 • UI/UX & FRONT-END DESIGN',
            title: 'UX Detective: UI, UX และ First Impression',
            shortName: 'W1 UX DETECTIVE',
            intro: 'ฝึกมองให้ลึกกว่าคำว่า “สวย” หรือ “รก”: ระบุ task ของผู้ใช้ หาหลักฐานของ friction แยก UI problem ออกจาก UX impact แล้วเลือกวิธีแก้และการทดสอบที่พิสูจน์ผลได้',
            format: '2 คดีสุ่ม • 4 ขั้นวิเคราะห์ • UI/UX mini-check • Reason Check',
            duration: '12–15 นาที',
            passText: '≥ 2★ ระดับความพร้อม • 3★ ต้องเชื่อมหลักฐานกับเหตุผลได้',
            correctLabel: 'วิเคราะห์ UI/UX จากหลักฐานได้ตรงผู้ใช้',
            retryLabel: 'กลับไปดู task, friction และสิ่งที่ผู้ใช้ต้องเห็นต่อ',
            badge: 'UX First Impression Analyst',
            stageMeta: Object.assign({}, config.stageMeta || {}, STAGE_LABELS),
            takeaways: [
              'UI คือองค์ประกอบบนหน้าจอ แต่ UX คือผลที่องค์ประกอบนั้นมีต่อการทำ task และความรู้สึกของผู้ใช้',
              'เริ่ม UX Audit จาก task, บริบท และพฤติกรรมจริง ไม่ใช่จากความชอบของทีม',
              'Friction ที่สำคัญมักเกิดเมื่อ hierarchy, feedback หรือ next step ไม่ชัด',
              'การทดสอบที่ดีวัด task success, เวลา, ความผิดพลาด และความมั่นใจของผู้ใช้'
            ]
          });
          const output = init(enriched);
          attachEnhancements();
          return output;
        }
      }));
    }
  });
})();
