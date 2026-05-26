(function(){
  'use strict';

  const PATCH_VERSION = 'v2026-SESSION1-FINAL-POLISH-1.5';
  const RUN_KEY = 'CSAI2102_AIQUEST_S1_POLISH_CURRENT_RUN';
  const HISTORY_KEY = 'CSAI2102_AIQUEST_S1_POLISH_HISTORY';
  const BALANCE_KEY = 'CSAI2102_AIQUEST_S1_BALANCE_CONFIG';
  const PLAYTEST_KEY = 'CSAI2102_AIQUEST_S1_PLAYTEST_RESPONSES';

  const DEFAULT_BALANCE = {
    easyTimeMul: 1.35,
    normalTimeMul: 1.10,
    challengeTimeMul: 0.88,
    targetScoreMin: 70,
    targetScoreMax: 88,
    targetReplayIntent: 4
  };

  let currentRun = null;
  let lastCapturedKey = '';
  let resultInjected = false;

  boot();

  function boot(){
    injectMobilePolishCSS();
    installBalanceOverride();
    installChoiceCapture();
    installResultObserver();
    installStartHooks();
    installMenuBalanceButton();
    console.info('[AI Quest Session 1 Final Polish]', PATCH_VERSION, 'loaded');
  }

  // ---------------------------------------------------------------------------
  // 3) Mobile QA polish
  // ---------------------------------------------------------------------------
  function injectMobilePolishCSS(){
    const css = `
      :root{
        --s1-touch: 56px;
      }

      .s1-polish-panel{
        margin-top:14px;
        padding:14px;
        border-radius:18px;
        border:1px solid rgba(56,189,248,.32);
        background:rgba(56,189,248,.07);
        color:#e0f2fe;
        line-height:1.65;
        text-align:left;
      }

      .s1-polish-panel h3{
        margin:0 0 8px;
        font-size:18px;
      }

      .s1-polish-panel h4{
        margin:12px 0 6px;
        font-size:15px;
        color:#bae6fd;
      }

      .s1-polish-panel ul{
        margin:8px 0;
        padding-left:20px;
      }

      .s1-review-item{
        padding:10px;
        border-radius:14px;
        border:1px solid rgba(255,255,255,.12);
        background:rgba(255,255,255,.055);
        margin-top:8px;
      }

      .s1-review-item.ok{
        border-color:rgba(52,211,153,.34);
        background:rgba(52,211,153,.07);
      }

      .s1-review-item.bad{
        border-color:rgba(251,113,133,.34);
        background:rgba(251,113,133,.07);
      }

      .s1-playtest-grid{
        display:grid;
        gap:10px;
      }

      .s1-playtest-row{
        display:grid;
        grid-template-columns:1fr auto;
        gap:10px;
        align-items:center;
        padding:10px;
        border-radius:14px;
        border:1px solid rgba(255,255,255,.12);
        background:rgba(255,255,255,.045);
      }

      .s1-playtest-row select,
      .s1-polish-panel input,
      .s1-polish-panel select,
      .s1-polish-panel textarea{
        background:#0f172a;
        color:#f8fafc;
        border:1px solid rgba(255,255,255,.14);
        border-radius:12px;
        padding:9px 10px;
      }

      .s1-polish-panel textarea{
        width:100%;
        min-height:70px;
        resize:vertical;
      }

      .s1-toolbar{
        display:flex;
        flex-wrap:wrap;
        gap:8px;
        justify-content:center;
        margin-top:12px;
      }

      .s1-tiny{
        font-size:12px;
        color:#a8b3c7;
      }

      .s1-balance-float{
        position:fixed;
        right:14px;
        bottom:calc(78px + env(safe-area-inset-bottom,0px));
        z-index:45;
        border:1px solid rgba(255,255,255,.16);
        background:rgba(15,23,42,.88);
        color:#f8fafc;
        border-radius:999px;
        padding:10px 12px;
        box-shadow:0 18px 44px rgba(0,0,0,.34);
        font-weight:900;
      }

      @media (max-width:680px){
        .choiceBtn{
          min-height:var(--s1-touch) !important;
          padding:14px 12px !important;
          font-size:15px !important;
          line-height:1.25 !important;
        }

        .choicesGrid{
          gap:10px !important;
        }

        .coachBox,
        .feedback{
          font-size:14px !important;
          line-height:1.55 !important;
        }

        .hud{
          gap:6px !important;
        }

        .hudChip{
          max-width:100%;
        }

        .gameArea{
          scroll-margin-top:12px;
        }

        .s1-playtest-row{
          grid-template-columns:1fr;
        }

        .s1-toolbar .btn{
          flex:1 1 100%;
        }

        .s1-balance-float{
          right:10px;
          bottom:calc(66px + env(safe-area-inset-bottom,0px));
          font-size:12px;
          padding:9px 10px;
        }
      }
    `;

    const style = document.createElement('style');
    style.id = 's1-final-polish-css';
    style.textContent = css;
    document.head.appendChild(style);
  }

  // ---------------------------------------------------------------------------
  // 4) Balance difficulty: timer override + diagnosis panel
  // ---------------------------------------------------------------------------
  function getBalance(){
    try{
      return { ...DEFAULT_BALANCE, ...JSON.parse(localStorage.getItem(BALANCE_KEY) || '{}') };
    }catch(error){
      return { ...DEFAULT_BALANCE };
    }
  }

  function saveBalance(config){
    localStorage.setItem(BALANCE_KEY, JSON.stringify({ ...getBalance(), ...config }));
  }

  function installBalanceOverride(){
    const originalBaseTime = window.baseTime;

    if(typeof originalBaseTime !== 'function'){
      return;
    }

    window.baseTime = function(seconds){
      const balance = getBalance();
      const diff = getCurrentDifficulty();
      const mul = diff === 'easy'
        ? balance.easyTimeMul
        : diff === 'challenge'
          ? balance.challengeTimeMul
          : balance.normalTimeMul;

      return Math.max(20, Math.round(seconds * Number(mul || 1)));
    };
  }

  function getCurrentDifficulty(){
    const select = document.getElementById('difficultySelect');
    return select ? select.value : 'normal';
  }

  function installMenuBalanceButton(){
    if(document.getElementById('s1BalanceFloat')) return;

    const btn = document.createElement('button');
    btn.id = 's1BalanceFloat';
    btn.className = 's1-balance-float';
    btn.type = 'button';
    btn.textContent = '⚙️ Balance';
    btn.addEventListener('click', showBalanceModal);
    document.body.appendChild(btn);
  }

  function showBalanceModal(){
    const old = document.getElementById('s1BalanceModal');
    if(old) old.remove();

    const balance = getBalance();
    const modal = document.createElement('div');
    modal.id = 's1BalanceModal';
    modal.className = 'modalBack show';
    modal.innerHTML = `
      <div class="modal">
        <h3>Session 1 Balance Settings</h3>
        <p>ใช้ปรับเวลาและเกณฑ์วิเคราะห์ความยาก หลังแก้แล้วรอบถัดไปจะใช้ค่าล่าสุด</p>

        <div class="s1-polish-panel">
          <h4>Timer Multiplier</h4>
          <div class="s1-playtest-grid">
            <label>Easy Time Multiplier <input id="s1BalEasy" type="number" step="0.05" min="0.5" max="2" value="${balance.easyTimeMul}"></label>
            <label>Normal Time Multiplier <input id="s1BalNormal" type="number" step="0.05" min="0.5" max="2" value="${balance.normalTimeMul}"></label>
            <label>Challenge Time Multiplier <input id="s1BalChallenge" type="number" step="0.05" min="0.5" max="2" value="${balance.challengeTimeMul}"></label>
          </div>

          <h4>Target Score Range</h4>
          <div class="s1-playtest-grid">
            <label>Target Score Min <input id="s1TargetMin" type="number" step="1" min="0" max="100" value="${balance.targetScoreMin}"></label>
            <label>Target Score Max <input id="s1TargetMax" type="number" step="1" min="0" max="100" value="${balance.targetScoreMax}"></label>
          </div>
        </div>

        <div class="row" style="justify-content:flex-end;margin-top:14px">
          <button class="btn secondary" id="s1CloseBalance">ปิด</button>
          <button class="btn good" id="s1SaveBalance">บันทึก Balance</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    modal.querySelector('#s1CloseBalance').onclick = () => modal.remove();
    modal.querySelector('#s1SaveBalance').onclick = () => {
      saveBalance({
        easyTimeMul: Number(modal.querySelector('#s1BalEasy').value || DEFAULT_BALANCE.easyTimeMul),
        normalTimeMul: Number(modal.querySelector('#s1BalNormal').value || DEFAULT_BALANCE.normalTimeMul),
        challengeTimeMul: Number(modal.querySelector('#s1BalChallenge').value || DEFAULT_BALANCE.challengeTimeMul),
        targetScoreMin: Number(modal.querySelector('#s1TargetMin').value || DEFAULT_BALANCE.targetScoreMin),
        targetScoreMax: Number(modal.querySelector('#s1TargetMax').value || DEFAULT_BALANCE.targetScoreMax)
      });
      modal.remove();
      toast('บันทึก Balance แล้ว รอบถัดไปจะใช้ค่าใหม่');
    };
  }

  function getBalanceDiagnosis(score, helpUsed, wrongCount, replayIntent){
    const balance = getBalance();
    const tips = [];

    if(score < balance.targetScoreMin){
      tips.push('คะแนนเฉลี่ยต่ำกว่าเป้าหมาย: อาจเพิ่มเวลาเล็กน้อย หรือให้ AI Coach tip ชัดขึ้นใน Trick Cards');
    }else if(score > balance.targetScoreMax && helpUsed === 0){
      tips.push('คะแนนสูงและไม่ใช้ AI Help: อาจเพิ่ม Challenge โดยเพิ่ม Explain Strike หรือเพิ่ม Boss Claim ในรอบถัดไป');
    }else{
      tips.push('ระดับความยากอยู่ในช่วงเหมาะสมสำหรับ pilot');
    }

    if(wrongCount >= 5){
      tips.push('ตอบผิดหลายครั้ง: ควรตรวจว่าตัวเลือกหลอกยากเกินไปหรือคำอธิบายยังไม่พอ');
    }

    if(Number(replayIntent || 0) > 0 && Number(replayIntent) < balance.targetReplayIntent){
      tips.push('Replay intent ต่ำ: เพิ่ม reward/animation หรือทำ Mastery Goal ให้ชัดขึ้น');
    }

    return tips;
  }

  // ---------------------------------------------------------------------------
  // 1) Review after game + capture items
  // ---------------------------------------------------------------------------
  function startNewRun(){
    currentRun = {
      runId: 'S1-' + Date.now() + '-' + Math.random().toString(16).slice(2,8),
      startedAt: new Date().toISOString(),
      difficulty: getCurrentDifficulty(),
      reviewItems: [],
      wrongItems: [],
      score: null,
      stars: null,
      helpUsed: 0,
      resultText: '',
      userAgent: navigator.userAgent
    };
    lastCapturedKey = '';
    resultInjected = false;
    saveCurrentRun();
  }

  function saveCurrentRun(){
    if(currentRun){
      localStorage.setItem(RUN_KEY, JSON.stringify(currentRun));
    }
  }

  function loadCurrentRun(){
    if(currentRun) return currentRun;
    try{
      currentRun = JSON.parse(localStorage.getItem(RUN_KEY) || 'null');
    }catch(error){
      currentRun = null;
    }
    return currentRun;
  }

  function installStartHooks(){
    document.addEventListener('click', (event) => {
      const start = event.target.closest('#startSelected, #btnReplay');
      if(start){
        startNewRun();
      }
    }, true);
  }

  function installChoiceCapture(){
    document.addEventListener('click', (event) => {
      const btn = event.target.closest('.choiceBtn');
      if(!btn) return;

      const selectedText = cleanText(btn.textContent);
      const beforeKey = makeQuestionKey();

      setTimeout(() => {
        captureChoice(selectedText, beforeKey, btn);
      }, 80);
    }, true);
  }

  function captureChoice(selectedText, beforeKey, clickedButton){
    const run = loadCurrentRun() || (startNewRun(), currentRun);
    const area = document.getElementById('gameArea');
    if(!area) return;

    const phase = cleanText(area.querySelector('.phasePill.active')?.textContent || 'Unknown');
    const prompt = getPromptText(area);
    const feedback = cleanText(area.querySelector('#fb')?.textContent || area.querySelector('.feedback')?.textContent || '');
    const coach = cleanText(area.querySelector('#coachBox')?.textContent || '');
    const correctButton = area.querySelector('.choiceBtn.correct');
    const correctText = cleanText(correctButton?.textContent || '');
    const ok = !!clickedButton.classList.contains('correct') || selectedText === correctText;
    const key = beforeKey + '|' + selectedText + '|' + correctText;

    if(key === lastCapturedKey) return;
    lastCapturedKey = key;

    const item = {
      at: new Date().toISOString(),
      phase,
      prompt,
      selected: selectedText,
      correct: correctText,
      ok,
      feedback,
      coach,
      misconception: inferMisconception(prompt, feedback, coach)
    };

    run.reviewItems.push(item);
    if(!ok) run.wrongItems.push(item);

    const helpText = document.getElementById('helpText')?.textContent || '';
    const match = helpText.match(/AI Help\s+(\d)\/3/i);
    if(match){
      run.helpUsed = 3 - Number(match[1]);
    }

    saveCurrentRun();
  }

  function makeQuestionKey(){
    const area = document.getElementById('gameArea');
    if(!area) return 'no-area';
    const phase = cleanText(area.querySelector('.phasePill.active')?.textContent || 'Unknown');
    const prompt = getPromptText(area);
    const choices = [...area.querySelectorAll('.choiceBtn')].map(b => cleanText(b.textContent)).join('|');
    return `${phase}|${prompt}|${choices}`;
  }

  function getPromptText(root){
    const promptCard = root.querySelector('.promptCard');
    if(promptCard) return cleanText(promptCard.textContent);

    const bigCard = root.querySelector('.bigCard');
    if(bigCard) return cleanText(bigCard.textContent);

    return cleanText(root.textContent || '').slice(0,180);
  }

  function cleanText(text){
    return String(text || '').replace(/\s+/g,' ').trim();
  }

  function inferMisconception(prompt, feedback, coach){
    const text = `${prompt} ${feedback} ${coach}`.toLowerCase();
    if(text.includes('automation') || text.includes('อัตโนมัติ')) return 'automation';
    if(text.includes('sensor')) return 'sensor';
    if(text.includes('rule-based') || text.includes('keyword') || text.includes('กฎตายตัว')) return 'rulebased';
    if(text.includes('เครื่องคิดเลข') || text.includes('สูตร')) return 'calculator';
    if(text.includes('หุ่นยนต์')) return 'robot';
    if(text.includes('ผิดพลาด') || text.includes('hallucination') || text.includes('bias')) return 'trust';
    if(text.includes('random') || text.includes('สุ่ม')) return 'random';
    if(text.includes('ฐานข้อมูล') || text.includes('data')) return 'data';
    if(text.includes('internet') || text.includes('อินเทอร์เน็ต')) return 'internet';
    if(text.includes('เร็ว') || text.includes('speed')) return 'speed';
    if(text.includes('smart')) return 'smartword';
    if(text.includes('เสียง')) return 'voice';
    if(text.includes('machine learning') || text.includes('ml')) return 'mlonly';
    if(text.includes('big data')) return 'bigdata';
    if(text.includes('แอป')) return 'app';
    return '';
  }

  // ---------------------------------------------------------------------------
  // Result observer: inject review/export/playtest/balance diagnosis
  // ---------------------------------------------------------------------------
  function installResultObserver(){
    const observer = new MutationObserver(() => {
      const resultScreen = document.getElementById('resultScreen');
      if(!resultScreen) return;

      if(resultScreen.classList.contains('active')){
        setTimeout(injectResultPolish, 120);
      }else{
        resultInjected = false;
      }
    });

    observer.observe(document.body, { childList:true, subtree:true, attributes:true, attributeFilter:['class'] });
  }

  function injectResultPolish(){
    if(resultInjected) return;

    const resultBox = document.querySelector('#resultScreen .resultBox');
    if(!resultBox) return;

    const run = loadCurrentRun() || (startNewRun(), currentRun);
    run.endedAt = new Date().toISOString();
    run.score = Number(document.getElementById('resultScore')?.textContent || 0);
    run.stars = cleanText(document.getElementById('resultStars')?.textContent || '');
    run.resultText = cleanText(document.getElementById('resultFeedback')?.textContent || '');
    run.difficulty = getCurrentDifficulty();
    saveCurrentRun();
    saveRunToHistory(run);

    const review = buildReviewHTML(run);
    const exportPanel = buildTeacherExportHTML(run);
    const balancePanel = buildBalanceDiagnosisHTML(run);
    const playtestPanel = buildPlaytestHTML(run);

    const wrapper = document.createElement('div');
    wrapper.id = 's1FinalPolishPanel';
    wrapper.innerHTML = review + exportPanel + balancePanel + playtestPanel;

    const reflection = resultBox.querySelector('.reflection');
    if(reflection){
      resultBox.insertBefore(wrapper, reflection);
    }else{
      resultBox.appendChild(wrapper);
    }

    bindResultButtons(run);
    resultInjected = true;
  }

  function buildReviewHTML(run){
    const wrong = (run.wrongItems || []).slice(-5);
    const total = (run.reviewItems || []).length;
    const wrongCount = (run.wrongItems || []).length;

    const items = wrong.length
      ? wrong.map((item, idx) => `
          <div class="s1-review-item bad">
            <b>ข้อที่ควรทบทวน ${idx + 1}</b><br>
            <span class="s1-tiny">Phase: ${escapeHtml(item.phase)}</span><br>
            <b>โจทย์:</b> ${escapeHtml(item.prompt)}<br>
            <b>ตอบ:</b> ${escapeHtml(item.selected)}<br>
            <b>คำตอบที่ถูก:</b> ${escapeHtml(item.correct || '-') }<br>
            <b>Coach:</b> ${escapeHtml(item.coach || item.feedback || '-')}
          </div>
        `).join('')
      : `<div class="s1-review-item ok"><b>ยอดเยี่ยม!</b> รอบนี้ไม่มีข้อผิดที่ระบบจับได้ ลอง Challenge Mode เพื่อเก็บ Mastery</div>`;

    return `
      <div class="s1-polish-panel" id="s1ReviewPanel">
        <h3>1) Review หลังจบเกม</h3>
        <p>รอบนี้ตอบทั้งหมด <b>${total}</b> ครั้ง / ตอบผิด <b>${wrongCount}</b> ครั้ง</p>
        ${items}
      </div>
    `;
  }

  function buildTeacherExportHTML(run){
    return `
      <div class="s1-polish-panel" id="s1TeacherPanel">
        <h3>2) Teacher Export / Summary</h3>
        <p>ส่งออกข้อมูลรอบนี้เพื่อดูว่าเด็กพลาดเรื่องใด และใช้ปรับการสอนในคาบถัดไป</p>
        <div class="s1-toolbar">
          <button class="btn secondary small" id="s1CopySummary">คัดลอก Teacher Summary</button>
          <button class="btn secondary small" id="s1DownloadCSV">ดาวน์โหลด CSV รอบนี้</button>
          <button class="btn secondary small" id="s1DownloadHistoryCSV">ดาวน์โหลด CSV ทุกครั้งในเครื่องนี้</button>
        </div>
      </div>
    `;
  }

  function buildBalanceDiagnosisHTML(run){
    const playtest = getLastPlaytestForRun(run.runId);
    const replayIntent = playtest ? playtest.replay : 0;
    const tips = getBalanceDiagnosis(Number(run.score || 0), Number(run.helpUsed || 0), (run.wrongItems || []).length, replayIntent);

    return `
      <div class="s1-polish-panel" id="s1BalancePanel">
        <h3>4) Balance ความยาก</h3>
        <ul>${tips.map(tip => `<li>${escapeHtml(tip)}</li>`).join('')}</ul>
        <p class="s1-tiny">เป้าหมาย: นักศึกษาส่วนใหญ่ควรได้ 70–88 คะแนนใน Normal และยังอยากเล่นซ้ำเพื่อเก็บ 3 ดาว</p>
      </div>
    `;
  }

  function buildPlaytestHTML(run){
    return `
      <div class="s1-polish-panel" id="s1PlaytestPanel">
        <h3>5) Playtest Form</h3>
        <p>ให้ผู้เล่นตอบหลังเล่นจบ ใช้ตรวจว่า “สนุก เร้าใจ ท้าทาย เล่นซ้ำ” จริงหรือไม่</p>
        <div class="s1-playtest-grid">
          ${ratingRow('fun','เกมนี้สนุก',4)}
          ${ratingRow('challenge','เกมนี้ท้าทายพอดี',4)}
          ${ratingRow('exciting','เกมนี้เร้าใจ/ลุ้น',4)}
          ${ratingRow('replay','อยากเล่นซ้ำเพื่อเก็บ 3 ดาว',4)}
          ${ratingRow('learning','เกมช่วยให้เข้าใจ AI มากขึ้น',4)}
        </div>
        <h4>ความคิดเห็นเพิ่มเติม</h4>
        <textarea id="s1PlaytestComment" placeholder="เช่น ข้อไหนยากไป ปุ่มใหญ่พอไหม AI Help ช่วยจริงไหม"></textarea>
        <div class="s1-toolbar">
          <button class="btn good small" id="s1SavePlaytest">บันทึก Playtest</button>
          <button class="btn secondary small" id="s1DownloadPlaytestCSV">ดาวน์โหลด Playtest CSV</button>
        </div>
      </div>
    `;
  }

  function ratingRow(name, label, value){
    return `
      <label class="s1-playtest-row">
        <span>${label}</span>
        <select id="s1Rate_${name}">
          ${[1,2,3,4,5].map(n => `<option value="${n}" ${n === value ? 'selected' : ''}>${n}/5</option>`).join('')}
        </select>
      </label>
    `;
  }

  function bindResultButtons(run){
    document.getElementById('s1CopySummary')?.addEventListener('click', () => {
      copyTeacherSummary(run);
    });

    document.getElementById('s1DownloadCSV')?.addEventListener('click', () => {
      downloadCSV('session1-run-review.csv', runToCSV([run]));
    });

    document.getElementById('s1DownloadHistoryCSV')?.addEventListener('click', () => {
      downloadCSV('session1-all-review-history.csv', runToCSV(getHistory()));
    });

    document.getElementById('s1SavePlaytest')?.addEventListener('click', () => {
      savePlaytest(run);
    });

    document.getElementById('s1DownloadPlaytestCSV')?.addEventListener('click', () => {
      downloadCSV('session1-playtest.csv', playtestToCSV(getPlaytests()));
    });
  }

  // ---------------------------------------------------------------------------
  // 2) Teacher export
  // ---------------------------------------------------------------------------
  function saveRunToHistory(run){
    const history = getHistory();
    const exists = history.some(item => item.runId === run.runId);
    const next = exists
      ? history.map(item => item.runId === run.runId ? run : item)
      : [...history, run];

    localStorage.setItem(HISTORY_KEY, JSON.stringify(next.slice(-60)));
  }

  function getHistory(){
    try{
      return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    }catch(error){
      return [];
    }
  }

  function copyTeacherSummary(run){
    const summary = makeTeacherSummary(run);

    if(navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(summary).then(() => toast('คัดลอก Teacher Summary แล้ว'));
    }else{
      prompt('Copy summary:', summary);
    }
  }

  function makeTeacherSummary(run){
    const wrong = run.wrongItems || [];
    const total = run.reviewItems || [];
    const mis = countBy(wrong.map(item => item.misconception || 'unknown'));
    const topMis = Object.entries(mis).sort((a,b) => b[1] - a[1]).map(([k,v]) => `${k}: ${v}`).join(', ') || '-';

    return [
      `CSAI2102 AI Quest — Session 1 Teacher Summary`,
      `Run ID: ${run.runId}`,
      `Time: ${run.endedAt || new Date().toISOString()}`,
      `Difficulty: ${run.difficulty}`,
      `Score: ${run.score}`,
      `Stars: ${run.stars}`,
      `Total interactions: ${total.length}`,
      `Wrong: ${wrong.length}`,
      `AI Help used: ${run.helpUsed}/3`,
      `Top misconceptions: ${topMis}`,
      `Recommendation: ${teacherRecommendation(run)}`
    ].join('\n');
  }

  function teacherRecommendation(run){
    const wrong = run.wrongItems || [];
    const mis = countBy(wrong.map(item => item.misconception || 'unknown'));
    const top = Object.entries(mis).sort((a,b)=>b[1]-a[1])[0]?.[0];

    const map = {
      automation:'ทบทวน Automation vs AI ด้วยตัวอย่างประตูเลื่อน นาฬิกาปลุก ระบบแจ้งเตือน และตู้ขายน้ำ',
      sensor:'ทบทวน Sensor vs AI โดยย้ำว่า sensor คือ input ไม่ใช่ AI โดยตัวเอง',
      rulebased:'ทบทวน Rule-based vs Learning-based ด้วยตัวอย่าง FAQ bot และ chatbot แบบเมนู',
      calculator:'ทบทวนโปรแกรมทั่วไป vs AI ด้วยเครื่องคิดเลข สูตร Excel และการแปลงหน่วย',
      trust:'ทบทวนข้อจำกัดของ AI, hallucination, bias และ human oversight',
      robot:'ทบทวนว่า AI ไม่จำเป็นต้องเป็นหุ่นยนต์ อาจเป็นซอฟต์แวร์ได้',
      data:'ทบทวน Data vs AI: การมีข้อมูลยังไม่พอ ต้องมีการวิเคราะห์/เรียนรู้',
      random:'ทบทวน Random vs Intelligence',
      unknown:'ให้ดู Review Items รายข้อและถามผู้เรียนว่าเหตุผลที่เลือกคืออะไร'
    };

    return map[top] || map.unknown;
  }

  function runToCSV(runs){
    const rows = [[
      'runId','startedAt','endedAt','difficulty','score','stars','helpUsed','phase','prompt','selected','correct','ok','misconception','feedback','coach','userAgent'
    ]];

    runs.forEach(run => {
      const items = run.reviewItems && run.reviewItems.length ? run.reviewItems : [{}];
      items.forEach(item => {
        rows.push([
          run.runId,
          run.startedAt,
          run.endedAt,
          run.difficulty,
          run.score,
          run.stars,
          run.helpUsed,
          item.phase || '',
          item.prompt || '',
          item.selected || '',
          item.correct || '',
          item.ok === undefined ? '' : item.ok,
          item.misconception || '',
          item.feedback || '',
          item.coach || '',
          run.userAgent || navigator.userAgent
        ]);
      });
    });

    return rows.map(row => row.map(csvCell).join(',')).join('\n');
  }

  function csvCell(value){
    const text = String(value ?? '');
    return '"' + text.replace(/"/g,'""') + '"';
  }

  function downloadCSV(filename, csvText){
    const blob = new Blob(['\ufeff' + csvText], { type:'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 500);
  }

  function countBy(list){
    return list.reduce((acc, key) => {
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
  }

  // ---------------------------------------------------------------------------
  // 5) Playtest data
  // ---------------------------------------------------------------------------
  function savePlaytest(run){
    const data = {
      runId: run.runId,
      at: new Date().toISOString(),
      difficulty: run.difficulty,
      score: run.score,
      fun: Number(document.getElementById('s1Rate_fun')?.value || 0),
      challenge: Number(document.getElementById('s1Rate_challenge')?.value || 0),
      exciting: Number(document.getElementById('s1Rate_exciting')?.value || 0),
      replay: Number(document.getElementById('s1Rate_replay')?.value || 0),
      learning: Number(document.getElementById('s1Rate_learning')?.value || 0),
      comment: document.getElementById('s1PlaytestComment')?.value || ''
    };

    const playtests = getPlaytests();
    const next = [...playtests.filter(item => item.runId !== run.runId), data].slice(-100);
    localStorage.setItem(PLAYTEST_KEY, JSON.stringify(next));

    toast('บันทึก Playtest แล้ว');

    const balancePanel = document.getElementById('s1BalancePanel');
    if(balancePanel){
      const tips = getBalanceDiagnosis(Number(run.score || 0), Number(run.helpUsed || 0), (run.wrongItems || []).length, data.replay);
      balancePanel.innerHTML = `
        <h3>4) Balance ความยาก</h3>
        <ul>${tips.map(tip => `<li>${escapeHtml(tip)}</li>`).join('')}</ul>
        <p class="s1-tiny">อัปเดตจาก Playtest ล่าสุดแล้ว</p>
      `;
    }
  }

  function getPlaytests(){
    try{
      return JSON.parse(localStorage.getItem(PLAYTEST_KEY) || '[]');
    }catch(error){
      return [];
    }
  }

  function getLastPlaytestForRun(runId){
    return getPlaytests().filter(item => item.runId === runId).at(-1);
  }

  function playtestToCSV(items){
    const rows = [[
      'runId','at','difficulty','score','fun','challenge','exciting','replay','learning','comment'
    ]];

    items.forEach(item => {
      rows.push([
        item.runId,
        item.at,
        item.difficulty,
        item.score,
        item.fun,
        item.challenge,
        item.exciting,
        item.replay,
        item.learning,
        item.comment
      ]);
    });

    return rows.map(row => row.map(csvCell).join(',')).join('\n');
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  function toast(message){
    const existing = document.getElementById('toast');
    if(existing){
      existing.textContent = message;
      existing.classList.add('show');
      clearTimeout(toast._timer);
      toast._timer = setTimeout(() => existing.classList.remove('show'), 2200);
      return;
    }
    console.info(message);
  }

  function escapeHtml(value){
    return String(value ?? '').replace(/[&<>"']/g, ch => ({
      '&':'&amp;',
      '<':'&lt;',
      '>':'&gt;',
      '"':'&quot;',
      "'":'&#39;'
    }[ch]));
  }
})();
