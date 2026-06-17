/* =========================================================
   CSAI2102 AI Quest
   S1 AR Practice Mode
   File: /ai-quest/js/aiquest-s1-ar-practice-v362.js
   Version: v3.6.2-s1-ar-practice-mode
   Purpose:
   - Add AR Practice to S1 AI Awakening
   - Camera background + DOM card overlay
   - Sort objects into AI / Automation / Sensor-only / Rule-based / Prediction
   - Save result locally for later submit/teacher integration
========================================================= */

(function(){
  'use strict';

  const VERSION = 'v3.6.2-s1-ar-practice-mode';
  const STORAGE_KEY = 'AIQUEST_S1_AR_PRACTICE_RESULT_V362';

  const CATEGORIES = [
    { id:'ai', label:'AI', desc:'มีการรับรู้/เรียนรู้/ทำนาย/ตัดสินใจจากข้อมูล' },
    { id:'automation', label:'Automation', desc:'ทำงานอัตโนมัติตามขั้นตอนที่ตั้งไว้' },
    { id:'sensor', label:'Sensor-only', desc:'ตรวจจับ/วัดค่า แต่ยังไม่ตัดสินใจเอง' },
    { id:'rulebased', label:'Rule-based', desc:'ใช้กฎ IF–THEN ชัดเจน ไม่ได้เรียนรู้เอง' },
    { id:'prediction', label:'Prediction', desc:'ใช้ข้อมูลเพื่อคาดการณ์/จัดอันดับ/แนะนำ' }
  ];

  const BANK = [
    {
      id:'door_timer',
      object:'automatic door with motion trigger',
      th:'ประตูอัตโนมัติที่เปิดเมื่อมีคนเดินผ่าน',
      answer:'automation',
      hint:'ทำตาม trigger ที่ตั้งไว้ ไม่ได้เรียนรู้หรือทำนายเอง',
      explain:'ประตูเปิดตามเงื่อนไข/เซนเซอร์ จัดเป็น automation มากกว่า AI'
    },
    {
      id:'temp_sensor',
      object:'temperature sensor',
      th:'เซนเซอร์วัดอุณหภูมิ',
      answer:'sensor',
      hint:'วัดค่าอย่างเดียว ยังไม่ตัดสินใจซับซ้อน',
      explain:'sensor-only คือรับข้อมูลจากโลกจริง แต่ยังไม่ได้ reasoning หรือ learning'
    },
    {
      id:'face_unlock',
      object:'face recognition unlock',
      th:'ระบบปลดล็อกด้วยใบหน้า',
      answer:'ai',
      hint:'มีการรู้จำ pattern จากภาพ',
      explain:'face recognition ใช้ AI/computer vision เพื่อจำแนกรูปแบบใบหน้า'
    },
    {
      id:'traffic_timer',
      object:'traffic light timer',
      th:'สัญญาณไฟจราจรแบบตั้งเวลา',
      answer:'automation',
      hint:'ทำงานตามเวลาที่ตั้งไว้',
      explain:'ถ้าเป็นไฟจราจรตั้งเวลาเฉย ๆ คือ automation ไม่ใช่ AI'
    },
    {
      id:'rule_chatbot',
      object:'rule-based FAQ chatbot',
      th:'แชตบอตตอบคำถามจากคีย์เวิร์ดและกฎ IF–THEN',
      answer:'rulebased',
      hint:'ดูว่ามีกฎตายตัวหรือเรียนรู้จากข้อมูล',
      explain:'ถ้าตอบตาม rule/keyword แบบตายตัว จัดเป็น rule-based system'
    },
    {
      id:'movie_recommend',
      object:'movie recommendation system',
      th:'ระบบแนะนำหนังจากพฤติกรรมผู้ใช้',
      answer:'prediction',
      hint:'ใช้ข้อมูลเก่าเพื่อคาดการณ์สิ่งที่ผู้ใช้อาจชอบ',
      explain:'recommendation system ใช้ข้อมูลเพื่อทำนาย/จัดอันดับ จึงเป็น prediction system'
    },
    {
      id:'spam_filter',
      object:'email spam filter',
      th:'ระบบกรองอีเมลสแปม',
      answer:'prediction',
      hint:'คาดการณ์ว่าอีเมลน่าจะเป็น spam หรือไม่',
      explain:'spam filter มักใช้ ML/AI เพื่อทำนาย class ของอีเมล'
    },
    {
      id:'calculator',
      object:'calculator app',
      th:'แอปเครื่องคิดเลข',
      answer:'automation',
      hint:'คำนวณตามสูตรที่กำหนด ไม่ได้เรียนรู้เอง',
      explain:'เครื่องคิดเลขทำงานตาม algorithm แน่นอน จัดเป็น automation/computation ไม่ใช่ AI'
    },
    {
      id:'smart_camera',
      object:'smart camera detects people',
      th:'กล้องอัจฉริยะตรวจจับคนในภาพ',
      answer:'ai',
      hint:'มีการจำแนก object จากภาพ',
      explain:'object/person detection เป็นงาน computer vision จัดเป็น AI'
    },
    {
      id:'voice_assistant',
      object:'voice assistant understands command',
      th:'ผู้ช่วยเสียงที่เข้าใจคำสั่งผู้ใช้',
      answer:'ai',
      hint:'เกี่ยวกับภาษา เสียง และความตั้งใจของผู้ใช้',
      explain:'voice assistant ใช้ speech/NLP/intent detection จัดเป็น AI'
    },
    {
      id:'light_sensor',
      object:'light sensor turns on lamp',
      th:'เซนเซอร์แสงสั่งเปิดไฟเมื่อมืด',
      answer:'automation',
      hint:'มี sensor แต่การตอบสนองเป็นกฎตรงไปตรงมา',
      explain:'แม้มี sensor แต่ถ้าเป็นเงื่อนไขง่าย ๆ เช่น มืดแล้วเปิดไฟ ถือเป็น automation'
    },
    {
      id:'health_risk',
      object:'health risk prediction app',
      th:'แอปทำนายความเสี่ยงสุขภาพจากข้อมูลผู้ใช้',
      answer:'prediction',
      hint:'มีการคาดการณ์ความเสี่ยงจากข้อมูล',
      explain:'ระบบทำนาย risk ใช้ข้อมูลเพื่อ prediction จึงอยู่หมวด prediction/AI'
    }
  ];

  let stream = null;
  let currentRound = [];
  let index = 0;
  let correct = 0;
  let wrong = 0;
  let helpUsed = 0;
  let startedAt = 0;
  let lastResult = null;

  function $(id){
    return document.getElementById(id);
  }

  function esc(v){
    return String(v ?? '').replace(/[&<>"']/g, s => ({
      '&':'&amp;',
      '<':'&lt;',
      '>':'&gt;',
      '"':'&quot;',
      "'":'&#039;'
    }[s]));
  }

  function shuffle(arr){
    const a = (arr || []).slice();
    for(let i = a.length - 1; i > 0; i--){
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function toast(msg){
    if(typeof window.showToast === 'function'){
      window.showToast(msg);
      return;
    }
    console.log('[S1 AR]', msg);
  }

  function beep(kind){
    try{
      if(typeof window.beep === 'function'){
        window.beep(kind === 'ok' ? 'ok' : 'bad');
      }
    }catch(e){}
  }

  function injectStyle(){
    if($('s1ArStyleV362')) return;

    const css = document.createElement('style');
    css.id = 's1ArStyleV362';
    css.textContent = `
      .s1-ar-fab-v362{
        position:fixed;
        right:14px;
        bottom:calc(14px + env(safe-area-inset-bottom,0px));
        z-index:9998;
        border:0;
        border-radius:999px;
        padding:12px 16px;
        font-weight:900;
        color:#052e16;
        background:linear-gradient(135deg,#86efac,#67e8f9);
        box-shadow:0 14px 34px rgba(0,0,0,.28);
        cursor:pointer;
      }

      .s1-ar-panel-v362{
        position:fixed;
        inset:0;
        z-index:10000;
        background:#020617;
        color:#e5eefc;
        display:none;
        overflow:hidden;
        font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
      }

      .s1-ar-panel-v362.open{
        display:block;
      }

      .s1-ar-video-v362{
        position:absolute;
        inset:0;
        width:100%;
        height:100%;
        object-fit:cover;
        transform:scaleX(-1);
        opacity:.88;
        background:#0f172a;
      }

      .s1-ar-fallback-bg-v362{
        position:absolute;
        inset:0;
        background:
          radial-gradient(circle at 15% 10%, rgba(34,211,238,.25), transparent 34%),
          radial-gradient(circle at 80% 30%, rgba(167,139,250,.22), transparent 35%),
          linear-gradient(135deg,#071426,#0f172a 55%,#111827);
      }

      .s1-ar-overlay-v362{
        position:absolute;
        inset:0;
        padding:14px;
        padding-top:calc(14px + env(safe-area-inset-top,0px));
        padding-bottom:calc(14px + env(safe-area-inset-bottom,0px));
        display:flex;
        flex-direction:column;
        gap:12px;
        background:linear-gradient(to bottom,rgba(2,6,23,.72),rgba(2,6,23,.20),rgba(2,6,23,.78));
      }

      .s1-ar-top-v362{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:10px;
      }

      .s1-ar-title-v362{
        font-weight:1000;
        font-size:18px;
        line-height:1.15;
      }

      .s1-ar-sub-v362{
        font-size:12px;
        color:#bae6fd;
        margin-top:2px;
      }

      .s1-ar-btn-v362{
        border:1px solid rgba(255,255,255,.18);
        background:rgba(15,23,42,.72);
        color:#f8fafc;
        border-radius:14px;
        padding:10px 12px;
        font-weight:900;
        cursor:pointer;
      }

      .s1-ar-main-v362{
        flex:1;
        display:flex;
        align-items:center;
        justify-content:center;
        min-height:0;
      }

      .s1-ar-card-v362{
        width:min(92vw,520px);
        border:1px solid rgba(148,163,184,.24);
        background:rgba(15,23,42,.78);
        backdrop-filter:blur(14px);
        border-radius:24px;
        padding:18px;
        box-shadow:0 22px 54px rgba(0,0,0,.38);
      }

      .s1-ar-badge-v362{
        display:inline-flex;
        align-items:center;
        gap:6px;
        border-radius:999px;
        padding:6px 10px;
        background:rgba(56,189,248,.18);
        border:1px solid rgba(56,189,248,.32);
        color:#bae6fd;
        font-size:12px;
        font-weight:900;
      }

      .s1-ar-object-v362{
        margin:12px 0 4px;
        font-size:24px;
        font-weight:1000;
        line-height:1.2;
      }

      .s1-ar-th-v362{
        font-size:16px;
        color:#fef9c3;
        line-height:1.45;
        margin-bottom:12px;
      }

      .s1-ar-choices-v362{
        display:grid;
        grid-template-columns:1fr;
        gap:8px;
      }

      .s1-ar-choice-v362{
        border:1px solid rgba(148,163,184,.24);
        background:rgba(30,41,59,.86);
        color:#f8fafc;
        border-radius:16px;
        padding:12px 12px;
        text-align:left;
        font-weight:900;
        cursor:pointer;
      }

      .s1-ar-choice-v362 small{
        display:block;
        color:#9fb2cc;
        font-weight:700;
        margin-top:3px;
        line-height:1.35;
      }

      .s1-ar-choice-v362.correct{
        border-color:rgba(34,197,94,.8);
        background:rgba(34,197,94,.22);
      }

      .s1-ar-choice-v362.wrong{
        border-color:rgba(239,68,68,.8);
        background:rgba(239,68,68,.22);
      }

      .s1-ar-feedback-v362{
        margin-top:12px;
        padding:12px;
        border-radius:16px;
        border:1px solid rgba(148,163,184,.22);
        background:rgba(2,6,23,.58);
        line-height:1.45;
      }

      .s1-ar-feedback-v362.good{
        border-color:rgba(34,197,94,.45);
        background:rgba(34,197,94,.14);
      }

      .s1-ar-feedback-v362.bad{
        border-color:rgba(239,68,68,.45);
        background:rgba(239,68,68,.14);
      }

      .s1-ar-bottom-v362{
        display:flex;
        gap:8px;
        flex-wrap:wrap;
        justify-content:space-between;
        align-items:center;
      }

      .s1-ar-meter-v362{
        color:#cbd5e1;
        font-size:13px;
        font-weight:800;
      }

      .s1-ar-result-v362{
        width:min(92vw,560px);
        border:1px solid rgba(148,163,184,.24);
        background:rgba(15,23,42,.86);
        backdrop-filter:blur(14px);
        border-radius:24px;
        padding:18px;
        box-shadow:0 22px 54px rgba(0,0,0,.38);
      }

      .s1-ar-result-v362 h2{
        margin:0 0 8px;
      }

      .s1-ar-result-grid-v362{
        display:grid;
        grid-template-columns:repeat(3,1fr);
        gap:8px;
        margin:12px 0;
      }

      .s1-ar-stat-v362{
        border:1px solid rgba(148,163,184,.20);
        background:rgba(30,41,59,.82);
        border-radius:16px;
        padding:12px;
      }

      .s1-ar-stat-v362 b{
        display:block;
        font-size:22px;
      }

      .s1-ar-stat-v362 span{
        color:#9fb2cc;
        font-size:12px;
        font-weight:800;
      }

      @media(min-width:720px){
        .s1-ar-choices-v362{
          grid-template-columns:1fr 1fr;
        }
      }
    `;
    document.head.appendChild(css);
  }

  function ensurePanel(){
    injectStyle();

    let panel = $('s1ArPanelV362');
    if(panel) return panel;

    panel = document.createElement('section');
    panel.id = 's1ArPanelV362';
    panel.className = 's1-ar-panel-v362';
    panel.innerHTML = `
      <div id="s1ArFallbackBgV362" class="s1-ar-fallback-bg-v362"></div>
      <video id="s1ArVideoV362" class="s1-ar-video-v362" autoplay playsinline muted></video>
      <div class="s1-ar-overlay-v362">
        <div class="s1-ar-top-v362">
          <div>
            <div class="s1-ar-title-v362">S1 AR Practice: AI Object Scanner</div>
            <div class="s1-ar-sub-v362">จัดหมวดวัตถุรอบตัว: AI / Automation / Sensor / Rule-based / Prediction</div>
          </div>
          <button id="s1ArExitV362" class="s1-ar-btn-v362">ออกจาก AR</button>
        </div>

        <div id="s1ArMainV362" class="s1-ar-main-v362"></div>

        <div class="s1-ar-bottom-v362">
          <div id="s1ArMeterV362" class="s1-ar-meter-v362">Ready</div>
          <div>
            <button id="s1ArHelpV362" class="s1-ar-btn-v362">AI Help</button>
            <button id="s1ArSkipV362" class="s1-ar-btn-v362">ข้าม AR</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(panel);

    $('s1ArExitV362').onclick = closeAR;
    $('s1ArSkipV362').onclick = skipAR;
    $('s1ArHelpV362').onclick = showHint;

    return panel;
  }

  function addFloatingButton(){
    injectStyle();

    if($('s1ArFabV362')) return;

    const btn = document.createElement('button');
    btn.id = 's1ArFabV362';
    btn.className = 's1-ar-fab-v362';
    btn.textContent = '📷 S1 AR Practice';
    btn.onclick = startAR;
    document.body.appendChild(btn);
  }

  function shouldShowFab(){
    const q = new URLSearchParams(location.search);
    const session = String(q.get('session') || q.get('mission') || '').toLowerCase();
    if(session === 's1' || session === 'm1') return true;

    const text = (document.body && document.body.innerText || '').toLowerCase();
    if(text.includes('ai awakening')) return true;
    if(text.includes('s1') && text.includes('automation')) return true;
    if(text.includes('ai vs automation')) return true;

    return false;
  }

  function refreshFabVisibility(){
    addFloatingButton();
    const btn = $('s1ArFabV362');
    if(!btn) return;
    btn.style.display = shouldShowFab() ? 'block' : 'none';
  }

  function buildRound(){
    return shuffle(BANK).slice(0,8);
  }

  async function startCamera(){
    const video = $('s1ArVideoV362');
    const bg = $('s1ArFallbackBgV362');

    try{
      if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia){
        throw new Error('Camera API not available');
      }

      stream = await navigator.mediaDevices.getUserMedia({
        video:{
          facingMode:{ ideal:'environment' },
          width:{ ideal:1280 },
          height:{ ideal:720 }
        },
        audio:false
      });

      video.srcObject = stream;
      video.style.display = 'block';
      bg.style.display = 'none';
      return true;
    }catch(err){
      console.warn('[S1 AR] camera fallback', err);
      video.style.display = 'none';
      bg.style.display = 'block';
      toast('เปิดกล้องไม่ได้ ใช้ AR Card Overlay แบบไม่ใช้กล้องแทน');
      return false;
    }
  }

  async function startAR(){
    ensurePanel();

    currentRound = buildRound();
    index = 0;
    correct = 0;
    wrong = 0;
    helpUsed = 0;
    startedAt = Date.now();
    lastResult = null;

    $('s1ArPanelV362').classList.add('open');

    await startCamera();
    renderCard();

    window.dispatchEvent(new CustomEvent('aiquest:s1-ar-start', {
      detail:{ version:VERSION, total:currentRound.length }
    }));
  }

  function stopCamera(){
    if(stream){
      stream.getTracks().forEach(t => t.stop());
      stream = null;
    }
  }

  function closeAR(){
    stopCamera();
    const panel = $('s1ArPanelV362');
    if(panel) panel.classList.remove('open');
  }

  function skipAR(){
    const result = {
      version:VERSION,
      sessionId:'s1',
      missionId:'m1',
      arMode:true,
      arCompleted:false,
      arSkipped:true,
      arScore:0,
      correct,
      wrong,
      total:currentRound.length || 0,
      helpUsed,
      badge:'',
      finishedAt:new Date().toISOString()
    };

    saveResult(result);
    closeAR();
    toast('ข้าม AR Practice แล้ว กลับไปทำ Mission ปกติได้');
  }

  function currentItem(){
    return currentRound[index];
  }

  function setMeter(){
    const total = currentRound.length || 0;
    const acc = (correct + wrong) ? Math.round(correct / (correct + wrong) * 100) : 0;
    const meter = $('s1ArMeterV362');
    if(meter){
      meter.textContent = `ข้อ ${Math.min(index + 1, total)}/${total} • Correct ${correct} • Accuracy ${acc}%`;
    }
  }

  function renderCard(){
    const main = $('s1ArMainV362');
    const item = currentItem();

    if(!item){
      renderResult();
      return;
    }

    setMeter();

    main.innerHTML = `
      <div class="s1-ar-card-v362">
        <span class="s1-ar-badge-v362">Object ${index + 1}/${currentRound.length}</span>
        <div class="s1-ar-object-v362">${esc(item.object)}</div>
        <div class="s1-ar-th-v362">${esc(item.th)}</div>

        <div class="s1-ar-choices-v362">
          ${CATEGORIES.map(cat => `
            <button class="s1-ar-choice-v362" data-cat="${esc(cat.id)}">
              ${esc(cat.label)}
              <small>${esc(cat.desc)}</small>
            </button>
          `).join('')}
        </div>

        <div id="s1ArFeedbackV362" class="s1-ar-feedback-v362" style="display:none"></div>
      </div>
    `;

    document.querySelectorAll('.s1-ar-choice-v362').forEach(btn => {
      btn.onclick = () => answer(btn.dataset.cat);
    });
  }

  function answer(catId){
    const item = currentItem();
    if(!item) return;

    const ok = catId === item.answer;

    document.querySelectorAll('.s1-ar-choice-v362').forEach(btn => {
      btn.disabled = true;
      if(btn.dataset.cat === item.answer) btn.classList.add('correct');
      else if(btn.dataset.cat === catId) btn.classList.add('wrong');
    });

    if(ok){
      correct++;
      beep('ok');
    }else{
      wrong++;
      beep('bad');
    }

    const feedback = $('s1ArFeedbackV362');
    if(feedback){
      feedback.style.display = 'block';
      feedback.className = 's1-ar-feedback-v362 ' + (ok ? 'good' : 'bad');
      feedback.innerHTML = `
        <b>${ok ? 'ถูกต้อง' : 'ยังไม่ถูก'}</b><br>
        คำตอบที่เหมาะที่สุด: <b>${esc(labelOf(item.answer))}</b><br>
        ${esc(item.explain)}
        <div style="margin-top:10px">
          <button id="s1ArNextV362" class="s1-ar-btn-v362">
            ${index >= currentRound.length - 1 ? 'สรุปผล AR' : 'ข้อต่อไป'}
          </button>
        </div>
      `;
    }

    setMeter();

    const next = $('s1ArNextV362');
    if(next){
      next.onclick = () => {
        index++;
        renderCard();
      };
    }

    window.dispatchEvent(new CustomEvent('aiquest:s1-ar-answer', {
      detail:{
        version:VERSION,
        itemId:item.id,
        answer:catId,
        correctAnswer:item.answer,
        isCorrect:ok,
        index,
        correct,
        wrong
      }
    }));
  }

  function labelOf(id){
    const cat = CATEGORIES.find(c => c.id === id);
    return cat ? cat.label : id;
  }

  function showHint(){
    const item = currentItem();
    if(!item) return;

    helpUsed++;

    const feedback = $('s1ArFeedbackV362');
    if(feedback){
      feedback.style.display = 'block';
      feedback.className = 's1-ar-feedback-v362';
      feedback.innerHTML = `
        <b>AI Help</b><br>
        ${esc(item.hint)}
      `;
    }

    window.dispatchEvent(new CustomEvent('aiquest:s1-ar-help', {
      detail:{
        version:VERSION,
        itemId:item.id,
        helpUsed
      }
    }));
  }

  function renderResult(){
    stopCamera();

    const total = currentRound.length || 0;
    const accuracy = total ? Math.round(correct / total * 100) : 0;
    const usedSec = Math.round((Date.now() - startedAt) / 1000);
    const badge = accuracy >= 85 ? 'AI Scanner Master' : accuracy >= 70 ? 'AI Scanner' : 'AR Practice Started';
    const bonus = accuracy >= 85 ? 3 : accuracy >= 70 ? 2 : correct > 0 ? 1 : 0;

    const result = {
      version:VERSION,
      sessionId:'s1',
      missionId:'m1',
      arMode:true,
      arCompleted:true,
      arSkipped:false,
      arScore:accuracy,
      correct,
      wrong,
      total,
      helpUsed,
      usedSec,
      badge,
      bonus,
      finishedAt:new Date().toISOString()
    };

    saveResult(result);

    const main = $('s1ArMainV362');
    main.innerHTML = `
      <div class="s1-ar-result-v362">
        <span class="s1-ar-badge-v362">AR Practice Complete</span>
        <h2>${esc(badge)}</h2>
        <p>สรุปผล S1 AR Practice: AI Object Scanner</p>

        <div class="s1-ar-result-grid-v362">
          <div class="s1-ar-stat-v362">
            <span>AR Score</span>
            <b>${accuracy}%</b>
          </div>
          <div class="s1-ar-stat-v362">
            <span>Correct</span>
            <b>${correct}/${total}</b>
          </div>
          <div class="s1-ar-stat-v362">
            <span>Bonus</span>
            <b>+${bonus}</b>
          </div>
        </div>

        <div class="s1-ar-feedback-v362 good">
          <b>บันทึก AR result แล้ว</b><br>
          ผลนี้เก็บใน localStorage และพร้อมเชื่อมกับ Result / Submit / Teacher Dashboard ใน patch ถัดไป
        </div>

        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">
          <button id="s1ArReplayV362" class="s1-ar-btn-v362">เล่น AR อีกครั้ง</button>
          <button id="s1ArBackV362" class="s1-ar-btn-v362">กลับ Mission</button>
        </div>
      </div>
    `;

    $('s1ArReplayV362').onclick = startAR;
    $('s1ArBackV362').onclick = closeAR;

    setMeter();

    window.dispatchEvent(new CustomEvent('aiquest:s1-ar-complete', {
      detail:result
    }));
  }

  function saveResult(result){
    lastResult = result;
    window.AIQUEST_S1_AR_RESULT = result;

    try{
      localStorage.setItem(STORAGE_KEY, JSON.stringify(result));
    }catch(e){}

    try{
      const all = JSON.parse(localStorage.getItem('AIQUEST_AR_RESULTS') || '{}');
      all.s1 = result;
      localStorage.setItem('AIQUEST_AR_RESULTS', JSON.stringify(all));
    }catch(e){}
  }

  function loadResult(){
    try{
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if(saved && saved.sessionId === 's1'){
        lastResult = saved;
        window.AIQUEST_S1_AR_RESULT = saved;
        return saved;
      }
    }catch(e){}
    return null;
  }

  function getResult(){
    return lastResult || loadResult();
  }

  function decorateS1Cards(){
    const nodes = Array.from(document.querySelectorAll('button, .card, .stageCard, .roadmap-card, [data-stage-id], [data-session]'));

    nodes.forEach(node => {
      if(node.dataset && node.dataset.s1ArDecorated === '1') return;

      const txt = (node.textContent || '').toLowerCase();
      const sid = (
        node.getAttribute('data-stage-id') ||
        node.getAttribute('data-session') ||
        node.getAttribute('data-id') ||
        ''
      ).toLowerCase();

      const isS1 = sid === 'm1' || sid === 's1' || txt.includes('ai awakening') || (txt.includes('s1') && txt.includes('automation'));

      if(!isS1) return;

      if(node.dataset) node.dataset.s1ArDecorated = '1';

      if(node.querySelector && node.querySelector('.s1-ar-mini-btn-v362')) return;

      const mini = document.createElement('button');
      mini.type = 'button';
      mini.className = 's1-ar-mini-btn-v362';
      mini.textContent = '📷 AR Practice';
      mini.style.cssText = [
        'margin-top:8px',
        'border:1px solid rgba(34,211,238,.35)',
        'background:rgba(34,211,238,.14)',
        'color:#cffafe',
        'border-radius:999px',
        'padding:7px 10px',
        'font-weight:900',
        'cursor:pointer'
      ].join(';');

      mini.onclick = ev => {
        ev.preventDefault();
        ev.stopPropagation();
        startAR();
      };

      try{
        node.appendChild(mini);
      }catch(e){}
    });
  }

  function installObservers(){
    refreshFabVisibility();
    decorateS1Cards();

    const mo = new MutationObserver(() => {
      refreshFabVisibility();
      decorateS1Cards();
    });

    mo.observe(document.body, {
      childList:true,
      subtree:true
    });

    setInterval(() => {
      refreshFabVisibility();
      decorateS1Cards();
    }, 2500);
  }

  window.AIQUEST_S1_AR_PRACTICE = {
    version:VERSION,
    start:startAR,
    close:closeAR,
    skip:skipAR,
    getResult,
    loadResult,
    categories:CATEGORIES,
    bank:BANK
  };

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', installObservers);
  }else{
    installObservers();
  }

  console.log('[AIQuest] ' + VERSION + ' loaded', window.AIQUEST_S1_AR_PRACTICE);
})();
