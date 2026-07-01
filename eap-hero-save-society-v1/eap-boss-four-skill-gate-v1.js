/* =========================================================
   EAP Boss Gate Four-Skill Patch v1
   B1–B5: Reading → Listening → Writing → Speaking → Boss Clash
   Load AFTER eap-hero.js and eap-evidence-sync-v129.js
========================================================= */
(() => {
  'use strict';

  const STORAGE_KEY = 'EAP_HERO_PROGRESS_V3';
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));

  const GATES = {
    1: {
      title:'Boss Gate 1 · Foundation Check',
      reading:'Academic English helps learners read sources, explain ideas, and set clear learning goals.',
      readQuestion:'Which statement best summarizes the source?',
      readChoices:[
        'Academic English supports academic learning goals and communication.',
        'Academic English is only used for casual conversation.',
        'Learners should avoid academic sources.',
        'Goals are not useful for university study.'
      ], readAnswer:0,
      listening:'First, identify the main idea. Next, choose one useful academic word. Finally, explain why the word helps your study.',
      listenQuestion:'What should the learner do after identifying the main idea?',
      listenChoices:['Finish immediately.','Choose one useful academic word.','Ignore source details.','Write unrelated information.'],
      listenAnswer:1,
      writing:'Write 2–4 sentences: state one academic goal and one action you will take.',
      speaking:'Speak for 30–45 seconds: state one academic goal, one action, and a clear closing.'
    },
    2: {
      title:'Boss Gate 2 · Evidence & Summary Check',
      reading:'Reliable academic work uses clear keywords, checks evidence, and summarizes the central idea in the writer’s own words.',
      readQuestion:'Which action is best supported by the source?',
      readChoices:[
        'Copy the first sentence exactly.',
        'Check evidence and summarize the central idea in your own words.',
        'Use one keyword without reading.',
        'Choose a claim because it sounds confident.'
      ], readAnswer:1,
      listening:'A credible source has an identifiable author, relevant evidence, and a clear publication context.',
      listenQuestion:'Which feature did the speaker mention?',
      listenChoices:['A clear publication context.','A colorful page design.','A short caption.','A celebrity name.'],
      listenAnswer:0,
      writing:'Write 2–4 sentences: summarize the source and explain why checking evidence matters.',
      speaking:'Speak for 30–45 seconds: state the main idea, one evidence-checking action, and a conclusion.'
    },
    3: {
      title:'Boss Gate 3 · Academic Paragraph Check',
      reading:'A focused academic paragraph begins with one topic sentence, develops the idea with support or evidence, and closes by linking back to the main point.',
      readQuestion:'Which paragraph order matches the source?',
      readChoices:[
        'Topic sentence → support/evidence → closing sentence.',
        'Closing → unrelated detail → greeting.',
        'Example → new topic → random opinion.',
        'Reference list → title → question.'
      ], readAnswer:0,
      listening:'Academic tone is clear, formal, and cautious. Writers should avoid slang and unsupported strong claims.',
      listenQuestion:'What tone should academic writers avoid?',
      listenChoices:[
        'Clear and cautious language.',
        'Formal vocabulary.',
        'Slang and unsupported strong claims.',
        'A focused topic sentence.'
      ], listenAnswer:2,
      writing:'Write a 3–4 sentence paragraph about one study strategy with topic, support, and closing.',
      speaking:'Speak for 30–45 seconds: explain your paragraph topic, one support detail, and your closing idea.'
    },
    4: {
      title:'Boss Gate 4 · Data, Email & Ethics Check',
      reading:'Academic communication requires accurate data description, a polite purpose in email, and honest acknowledgement of sources and AI support.',
      readQuestion:'Which response follows all three principles?',
      readChoices:[
        'Report data accurately, write politely, and acknowledge sources or AI support.',
        'Use dramatic data, a short command, and hide the source.',
        'Copy an answer and claim it is original.',
        'Choose the largest number without checking.'
      ], readAnswer:0,
      listening:'Online quiz use increased from 40 percent to 58 percent. The result should be described accurately without claiming a cause.',
      listenQuestion:'What did the speaker advise?',
      listenChoices:[
        'Claim that quizzes caused every improvement.',
        'Describe the increase accurately without an unsupported cause.',
        'Ignore the numbers.',
        'Report a decrease.'
      ], listenAnswer:1,
      writing:'Write 2–4 sentences: describe the trend from 40% to 58% and one ethical source or AI action.',
      speaking:'Speak for 30–45 seconds: report the trend, one polite academic action, and one ethics reminder.'
    },
    5: {
      title:'Final Boss · Integrated EAP Performance',
      reading:'Digital literacy helps students evaluate online information, use evidence responsibly, and communicate a practical solution to a social problem.',
      readQuestion:'Which final response best uses the source?',
      readChoices:[
        'Evaluate information, use evidence, and propose a practical solution.',
        'Share the first claim without checking it.',
        'Use a solution without evidence.',
        'Avoid explaining the social problem.'
      ], readAnswer:0,
      listening:'First, identify a social problem. Next, support your idea with one credible detail. In conclusion, propose a realistic action.',
      listenQuestion:'What should come before the realistic action?',
      listenChoices:[
        'A credible supporting detail.',
        'An unrelated story.',
        'Difficult vocabulary only.',
        'A casual greeting.'
      ], listenAnswer:0,
      writing:'Write 3–4 sentences: name a social problem, give one evidence-based detail, and propose a realistic solution.',
      speaking:'Speak for 30–45 seconds: present the problem, one evidence detail, one solution, and a clear conclusion.'
    }
  };

  const gateNo = (id) => Number(String(id || '').replace(/\D/g, '')) || 1;

  function readState() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); }
    catch (error) { return { profile:{ name:'Guest', studentId:'guest', section:'122' } }; }
  }

  function sendEvidence(gate, skill, prompt, output, extras = {}) {
    const state = readState();
    const entry = {
      rawEvidenceId: `boss-${gate}-${skill}-${Date.now()}`,
      sessionId: `B${gate}`,
      sessionTitle: GATES[gate].title,
      skill,
      evidenceType: `boss_${skill.toLowerCase()}_evidence`,
      taskId: `B${gate}_${skill}`,
      score: 100,
      passed: true,
      prompt,
      output,
      durationSec: extras.durationSec || 0,
      targetRange: extras.targetRange || '',
      teacherReviewRequired: skill === 'Speaking',
      teacherReviewStatus: skill === 'Speaking' ? 'pending_teacher_review' : '',
      oralChecklist: extras.checklist || {},
      attemptCount: 1,
      at: new Date().toISOString(),
      boss: { gate, requiredSkills:['Reading','Listening','Writing','Speaking'] }
    };
    if (window.EAPEvidenceSyncV129?.submitRaw) {
      window.EAPEvidenceSyncV129.submitRaw(entry, state);
    }
  }

  function playVoice(text) {
    try {
      speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      utterance.rate = 0.86;
      speechSynthesis.speak(utterance);
    } catch (error) {}
  }

  function page(gate, stage, body) {
    const stepNames = ['Reading','Listening','Writing','Speaking'];
    document.getElementById('app').innerHTML = `
      <main class="wrap" style="max-width:1180px;margin:auto;padding:20px">
        <section class="panel" style="margin-top:18px">
          <div class="badges">
            <span class="pill">Boss Gate ${gate}</span>
            <span class="pill">Four-Skill Evidence</span>
            <span class="pill">Step ${stage + 1}/4</span>
          </div>
          <h2>${esc(GATES[gate].title)}</h2>
          <p class="lead">Complete Reading, Listening, Writing, and Speaking before the Boss Clash.</p>
          <div class="grid four" style="margin:14px 0">
            ${stepNames.map((skill, index) => `
              <div class="stat" style="${index === stage ? 'outline:3px solid #73d9e7' : ''}">
                <b>${index < stage ? '✓ ' : ''}${skill}</b>
                <span>${index < stage ? 'Complete' : index === stage ? 'Current' : 'Locked'}</span>
              </div>
            `).join('')}
          </div>
          ${body}
        </section>
      </main>
    `;
  }

  function choiceStage(gate, stage, kind) {
    const g = GATES[gate];
    const reading = kind === 'reading';
    const source = reading ? g.reading : g.listening;
    const question = reading ? g.readQuestion : g.listenQuestion;
    const choices = reading ? g.readChoices : g.listenChoices;
    const answer = reading ? g.readAnswer : g.listenAnswer;

    page(gate, stage, `
      <div class="panel light">
        <h3>${reading ? '📖 Reading' : '🎧 Listening'}</h3>
        <p style="font-size:18px;line-height:1.6">${esc(source)}</p>
        ${reading ? '' : '<button class="btn ghost" id="playVoice">▶ Play audio again</button><p class="mini-note">Audio transcript is shown for accessibility.</p>'}
      </div>
      <h3>${esc(question)}</h3>
      ${choices.map((choice, index) => `
        <button class="btn ghost block boss4-choice" data-index="${index}" style="text-align:left;margin:9px 0">
          ${String.fromCharCode(65 + index)}. ${esc(choice)}
        </button>
      `).join('')}
      <p id="boss4Message" class="mini-note"></p>
    `);

    document.getElementById('playVoice')?.addEventListener('click', () => playVoice(source));
    document.querySelectorAll('.boss4-choice').forEach((button) => {
      button.addEventListener('click', () => {
        if (Number(button.dataset.index) !== answer) {
          document.getElementById('boss4Message').textContent = 'Try again. Check the source carefully.';
          return;
        }
        sendEvidence(gate, reading ? 'Reading' : 'Listening', source, choices[answer]);
        reading ? choiceStage(gate, 1, 'listening') : writingStage(gate);
      });
    });
    if (!reading) setTimeout(() => playVoice(source), 300);
  }

  function writingStage(gate) {
    const g = GATES[gate];
    page(gate, 2, `
      <div class="panel light">
        <h3>✍️ Writing Evidence</h3>
        <p>${esc(g.writing)}</p>
        <textarea id="bossWriting" rows="7" style="width:100%;padding:14px;border-radius:12px;font:inherit" placeholder="Write your answer here..."></textarea>
        <p class="mini-note">Use your own words. This is evidence, not automatic grammar scoring.</p>
        <button class="btn primary" id="saveWriting">Save writing & continue</button>
        <p id="writingMessage" class="mini-note"></p>
      </div>
    `);

    document.getElementById('saveWriting').addEventListener('click', () => {
      const output = document.getElementById('bossWriting').value.trim();
      if (output.split(/\s+/).filter(Boolean).length < 12) {
        document.getElementById('writingMessage').textContent = 'Write at least 12 words before continuing.';
        return;
      }
      sendEvidence(gate, 'Writing', g.writing, output);
      speakingStage(gate);
    });
  }

  function speakingStage(gate) {
    const g = GATES[gate];
    let startedAt = 0;
    let timer = null;

    page(gate, 3, `
      <div class="panel light">
        <h3>🗣️ Boss Speaking Evidence</h3>
        <p>${esc(g.speaking)}</p>
        <p><b id="speakClock">00:00</b> / 00:30 minimum</p>
        <button class="btn ghost" id="startSpeaking">Start speaking timer</button>
        <label style="display:block;margin:12px 0"><input type="checkbox" id="checkTopic"> I stated the topic</label>
        <label style="display:block;margin:12px 0"><input type="checkbox" id="checkDetail"> I gave one source detail</label>
        <label style="display:block;margin:12px 0"><input type="checkbox" id="checkClosing"> I ended with a clear closing</label>
        <textarea id="speakingNote" rows="4" style="width:100%;padding:14px;border-radius:12px;font:inherit" placeholder="Speaking note: write 1–2 sentences about what you said."></textarea>
        <p class="mini-note">Optional audio recording remains available through the speaking evidence tool. Teacher review applies only to this Boss speaking evidence.</p>
        <button class="btn primary" id="finishSpeaking" style="margin-top:12px">Save speaking & enter Boss Clash</button>
        <p id="speakingMessage" class="mini-note"></p>
      </div>
    `);

    document.getElementById('startSpeaking').addEventListener('click', () => {
      if (startedAt) return;
      startedAt = Date.now();
      document.getElementById('startSpeaking').textContent = 'Speaking timer running';
      timer = setInterval(() => {
        const seconds = Math.floor((Date.now() - startedAt) / 1000);
        document.getElementById('speakClock').textContent =
          `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
      }, 250);
    });

    document.getElementById('finishSpeaking').addEventListener('click', () => {
      const seconds = startedAt ? Math.floor((Date.now() - startedAt) / 1000) : 0;
      const note = document.getElementById('speakingNote').value.trim();
      const checklist = {
        spoke: seconds >= 30,
        topic: document.getElementById('checkTopic').checked,
        detail: document.getElementById('checkDetail').checked,
        closing: document.getElementById('checkClosing').checked
      };

      if (
        seconds < 30 ||
        !checklist.topic ||
        !checklist.detail ||
        !checklist.closing ||
        note.split(/\s+/).filter(Boolean).length < 8
      ) {
        document.getElementById('speakingMessage').textContent =
          'Complete 30 seconds, all checklist items, and an 8-word speaking note.';
        return;
      }

      if (timer) clearInterval(timer);
      sendEvidence(gate, 'Speaking', g.speaking, note, {
        durationSec: seconds,
        targetRange: '30–45',
        checklist
      });
      window.EAPHero.__bossFourSkillOriginalStart(`gate${gate}`);
    });
  }

  function patch() {
    if (!window.EAPHero?.startGateBoss || window.EAPHero.__bossFourSkillPatched) return;
    window.EAPHero.__bossFourSkillPatched = true;
    window.EAPHero.__bossFourSkillOriginalStart = window.EAPHero.startGateBoss;
    window.EAPHero.startGateBoss = (gateId) => choiceStage(gateNo(gateId), 0, 'reading');
  }

  const wait = setInterval(() => {
    patch();
    if (window.EAPHero?.__bossFourSkillPatched) clearInterval(wait);
  }, 100);
})();
