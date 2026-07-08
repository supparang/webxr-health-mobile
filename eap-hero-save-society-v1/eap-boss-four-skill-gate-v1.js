/* =========================================================
   EAP Hero Boss Gate v3 — Four Skills + Rotating Scenario Bank
   - B1–B5 run Reading → Listening → Writing → Speaking before Boss Clash.
   - Uses EAPBossReplayScenario from eap-boss-replay-bank-v2.js when available.
   - Reading/Listening source, question, and answers rotate per Boss attempt.
   - Answer order is shuffled per render while preserving the correct answer.
   - Writing/Speaking prompts follow the same selected Boss scenario.
   - Boss Speaking creates teacher review evidence; no pronunciation/grammar
     score is auto-decided.
========================================================= */
(function () {
  'use strict';

  var STORAGE_KEY = 'EAP_HERO_PROGRESS_V3';
  var SKILLS = ['Reading', 'Listening', 'Writing', 'Speaking'];
  var SCENARIO_CACHE = {};

  var GATES = {
    1: {
      title: 'Boss Gate 1 · Foundation Check',
      arc: 'S1–S3 · goal, academic words, main idea',
      reading: {
        source: 'Academic English helps students read sources, explain ideas, and set clear learning goals.',
        question: 'What is the main message?',
        choices: [
          'Academic English helps students learn and communicate at university.',
          'Academic English is only for casual chats.',
          'Students should avoid setting goals.',
          'Sources are not useful for study.'
        ], answer: 0
      },
      listening: {
        source: 'First, choose one academic goal. Next, choose one small action. Finally, check your progress.',
        question: 'What should a learner do after choosing a goal?',
        choices: ['Choose one small action.', 'Stop studying.', 'Copy another plan.', 'Ignore progress.'], answer: 0
      },
      writing: {
        prompt: 'Build a short goal statement with one action.',
        frames: ['My academic goal is to improve reading.', 'I will read one short source each week.', 'This action can help me make progress.']
      },
      speaking: {
        prompt: 'Use the three cues to give a short goal talk.',
        frames: ['Today I will talk about my academic goal.', 'One action is to read one short source each week.', 'This goal can help my university study.']
      }
    },
    2: {
      title: 'Boss Gate 2 · Reading Signals & Summary Check',
      arc: 'S4–S6 · keywords, evidence, summary',
      reading: {
        source: 'A careful reader uses keywords, checks evidence, and writes the central idea in short new words.',
        question: 'Which action matches the source?',
        choices: [
          'Find keywords, check evidence, and write a short summary.',
          'Copy the first sentence only.',
          'Choose a claim because it sounds strong.',
          'Ignore evidence and read the title only.'
        ], answer: 0
      },
      listening: {
        source: 'A credible source has a clear author, relevant evidence, and a publication context.',
        question: 'Which feature was mentioned?',
        choices: ['A clear author.', 'A colourful page.', 'A celebrity photo.', 'A short slogan.'], answer: 0
      },
      writing: {
        prompt: 'Build a 3-sentence source summary.',
        frames: ['The source is about checking information.', 'One useful point is to check evidence.', 'This helps students write a careful summary.']
      },
      speaking: {
        prompt: 'Use the three cues to explain one reading strategy.',
        frames: ['Today I will explain a reading strategy.', 'I will check one source detail.', 'This can help me understand the main idea.']
      }
    },
    3: {
      title: 'Boss Gate 3 · Paragraph & Tone Check',
      arc: 'S7–S9 · paragraph structure and academic tone',
      reading: {
        source: 'A focused paragraph has a topic sentence, support or evidence, and a closing sentence.',
        question: 'Which order is correct?',
        choices: [
          'Topic sentence → support → closing sentence.',
          'Closing → greeting → new topic.',
          'Random detail → title → question.',
          'Reference list → unrelated opinion → heading.'
        ], answer: 0
      },
      listening: {
        source: 'Academic tone is clear and careful. Avoid slang and very strong claims without support.',
        question: 'What should a writer avoid?',
        choices: ['Slang and unsupported strong claims.', 'Clear language.', 'A topic sentence.', 'One support detail.'], answer: 0
      },
      writing: {
        prompt: 'Build a mini paragraph about one study strategy.',
        frames: ['One useful study strategy is to review key words.', 'For example, I can review five words after class.', 'This strategy can support my academic reading.']
      },
      speaking: {
        prompt: 'Use the three cues to present your mini paragraph.',
        frames: ['Today I will explain one study strategy.', 'For example, I can review key words after class.', 'This strategy can support my reading.']
      }
    },
    4: {
      title: 'Boss Gate 4 · Data, Email & Ethics Check',
      arc: 'S10–S12 · notes, evidence, citation and ethical use',
      reading: {
        source: 'Academic communication reports data accurately, uses a polite purpose, and names sources or AI support honestly.',
        question: 'Which response follows the source?',
        choices: [
          'Report data carefully, write politely, and name the source or AI support.',
          'Change numbers to sound dramatic.',
          'Copy work and say it is original.',
          'Hide where information comes from.'
        ], answer: 0
      },
      listening: {
        source: 'Online quiz use rose from 40 percent to 58 percent. Describe the increase, but do not claim a cause without evidence.',
        question: 'What should the learner do?',
        choices: ['Describe the increase carefully.', 'Say quizzes caused every improvement.', 'Ignore the numbers.', 'Report a decrease.'], answer: 0
      },
      writing: {
        prompt: 'Build a short accurate data statement.',
        frames: ['Online quiz use increased from 40% to 58%.', 'The data show an increase in quiz use.', 'We should name the source of the data.']
      },
      speaking: {
        prompt: 'Use the three cues to report one result carefully.',
        frames: ['Today I will report one result.', 'Quiz use increased from 40% to 58%.', 'We should use data and sources honestly.']
      }
    },
    5: {
      title: 'Final Boss · Integrated EAP Performance',
      arc: 'S13–S15 · presentation, Q&A and social solution',
      reading: {
        source: 'Digital literacy helps students evaluate online information, use evidence responsibly, and explain a practical solution to a social problem.',
        question: 'Which final response uses the source well?',
        choices: [
          'Check information, use evidence, and propose a practical solution.',
          'Share the first online claim without checking.',
          'Give a solution without evidence.',
          'Avoid explaining the social problem.'
        ], answer: 0
      },
      listening: {
        source: 'First, name one social problem. Next, add one credible detail. Finally, propose one realistic action.',
        question: 'What comes before the realistic action?',
        choices: ['One credible detail.', 'A casual greeting.', 'A difficult word only.', 'An unrelated story.'], answer: 0
      },
      writing: {
        prompt: 'Build a 3-sentence practical solution.',
        frames: ['One social problem is false information online.', 'Students can check the author and evidence.', 'This action can support safer information use.']
      },
      speaking: {
        prompt: 'Use the three cues to give a short final presentation.',
        frames: ['Today I will present one social problem.', 'Students can check the author and evidence.', 'This is a realistic action for safer online information.']
      }
    }
  };

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function shuffleWithAnswer(correct, distractors) {
    var items = [correct].concat(distractors || []).map(function (text, index) {
      return { text: text, correct: index === 0 };
    });
    for (var i = items.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = items[i];
      items[i] = items[j];
      items[j] = tmp;
    }
    var answer = items.findIndex(function (item) { return item.correct; });
    return {
      choices: items.map(function (item) { return item.text; }),
      answer: answer < 0 ? 0 : answer
    };
  }

  function fallbackScenario(gate) {
    var g = GATES[gate] || GATES[1];
    return {
      tag: 'Default Boss Variant',
      reading: g.reading.source,
      rq: g.reading.question,
      ra: g.reading.choices[g.reading.answer],
      rd: g.reading.choices.filter(function (_, index) { return index !== g.reading.answer; }),
      listening: g.listening.source,
      lq: g.listening.question,
      la: g.listening.choices[g.listening.answer],
      ld: g.listening.choices.filter(function (_, index) { return index !== g.listening.answer; }),
      writing: g.writing.prompt,
      speaking: g.speaking.prompt
    };
  }

  function activeScenario(gate) {
    var current = window.EAPBossReplayScenario;
    if (current && Number(current.gate) === Number(gate) && current.scenario) {
      SCENARIO_CACHE[gate] = current.scenario;
      return current.scenario;
    }
    if (SCENARIO_CACHE[gate]) return SCENARIO_CACHE[gate];
    var fallback = fallbackScenario(gate);
    SCENARIO_CACHE[gate] = fallback;
    window.EAPBossReplayScenario = { gate: gate, scenario: fallback };
    return fallback;
  }

  function gateData(gate) {
    var g = clone(GATES[gate] || GATES[1]);
    var sc = activeScenario(gate);
    var reading = shuffleWithAnswer(sc.ra, sc.rd);
    var listening = shuffleWithAnswer(sc.la, sc.ld);

    g.scenarioTag = sc.tag || 'Boss Scenario';
    g.reading.source = sc.reading || g.reading.source;
    g.reading.question = sc.rq || g.reading.question;
    g.reading.choices = reading.choices;
    g.reading.answer = reading.answer;

    g.listening.source = sc.listening || g.listening.source;
    g.listening.question = sc.lq || g.listening.question;
    g.listening.choices = listening.choices;
    g.listening.answer = listening.answer;

    g.writing.prompt = sc.writing || g.writing.prompt;
    g.speaking.prompt = sc.speaking || g.speaking.prompt;

    return g;
  }

  function readState() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); }
    catch (_) { return { profile: { studentId: 'guest', studentName: 'Guest', section: '122' } }; }
  }

  function gateNo(value) {
    var n = Number(String(value || '').replace(/\D/g, ''));
    return GATES[n] ? n : 1;
  }

  function evidenceSync() {
    return window.EAPEvidenceSyncV130 || window.EAPEvidenceSyncV129 || null;
  }

  function sendEvidence(gate, skill, prompt, output, extras) {
    extras = extras || {};
    var g = gateData(gate);
    var entry = {
      rawEvidenceId: 'boss-' + gate + '-' + skill + '-' + Date.now(),
      sessionId: 'B' + gate,
      sessionTitle: g.title,
      skill: skill,
      evidenceType: 'boss_' + skill.toLowerCase() + '_evidence',
      taskId: 'B' + gate + '_' + skill,
      score: 100,
      passed: true,
      prompt: prompt,
      output: output,
      durationSec: extras.durationSec || 0,
      targetRange: extras.targetRange || '',
      teacherReviewRequired: skill === 'Speaking',
      teacherReviewStatus: skill === 'Speaking' ? 'pending_teacher_review' : '',
      oralChecklist: extras.checklist || {},
      attemptCount: 1,
      at: new Date().toISOString(),
      boss: { gate: gate, requiredSkills: SKILLS.slice(), stage: skill, scenarioTag: g.scenarioTag }
    };
    var sync = evidenceSync();
    if (sync && typeof sync.submitRaw === 'function') sync.submitRaw(entry, readState());
  }

  function playVoice(text) {
    try {
      window.speechSynthesis.cancel();
      var voice = new SpeechSynthesisUtterance(text);
      voice.lang = 'en-US';
      voice.rate = 0.78;
      window.speechSynthesis.speak(voice);
    } catch (_) {}
  }

  function shell(gate, current, inner) {
    var g = gateData(gate);
    document.getElementById('app').innerHTML = '' +
      '<main class="wrap" style="max-width:1100px;margin:auto;padding:20px">' +
        '<section class="panel" style="margin-top:18px">' +
          '<div class="badges"><span class="pill">Boss Gate ' + gate + '</span><span class="pill">4 Skills Required</span><span class="pill">Scenario: ' + esc(g.scenarioTag) + '</span></div>' +
          '<h2>' + esc(g.title) + '</h2>' +
          '<p class="lead">' + esc(g.arc) + ' · ทำทีละทักษะพร้อมตัวช่วย แล้วจึงเข้าสู่ Boss Clash</p>' +
          '<div class="grid four" style="margin:14px 0">' +
            SKILLS.map(function (skill, index) {
              var state = index < current ? '✓ Complete' : index === current ? 'Current' : 'Locked';
              var outline = index === current ? 'outline:3px solid #73d9e7' : '';
              return '<div class="stat" style="' + outline + '"><b>' + esc(skill) + '</b><span>' + state + '</span></div>';
            }).join('') +
          '</div>' + inner +
        '</section>' +
      '</main>';
  }

  function sourceBox(kind, source) {
    var listen = kind === 'Listening';
    return '' +
      '<div class="panel light" style="margin:14px 0">' +
        '<h3>' + (listen ? '🎧 Listening' : '📖 Reading') + ' · Boss Scenario</h3>' +
        (listen ? '<button type="button" class="btn ghost" id="bossPlay">▶ Play audio</button> <button type="button" class="btn ghost" id="bossShowText">Show text support</button><p id="bossTranscript" class="mini-note" style="display:none;margin-top:10px">' + esc(source) + '</p>' : '<p style="font-size:18px;line-height:1.65">' + esc(source) + '</p>') +
        '<p class="mini-note">เลือกคำตอบที่ตรงกับข้อความมากที่สุด · ตอบผิดลองใหม่ได้ · คำถามและตำแหน่งคำตอบหมุนทุกครั้ง</p>' +
      '</div>';
  }

  function choiceStage(gate, kind) {
    var g = gateData(gate);
    var task = kind === 'Reading' ? g.reading : g.listening;
    var stage = kind === 'Reading' ? 0 : 1;
    shell(gate, stage, sourceBox(kind, task.source) +
      '<h3>' + esc(task.question) + '</h3>' +
      task.choices.map(function (choice, index) {
        return '<button type="button" class="btn ghost block eap-boss-choice" data-answer="' + index + '" style="margin:9px 0;text-align:left">' + String.fromCharCode(65 + index) + '. ' + esc(choice) + '</button>';
      }).join('') +
      '<p id="bossMessage" class="mini-note"></p>');

    document.getElementById('bossPlay') && document.getElementById('bossPlay').addEventListener('click', function () { playVoice(task.source); });
    document.getElementById('bossShowText') && document.getElementById('bossShowText').addEventListener('click', function () {
      var text = document.getElementById('bossTranscript');
      text.style.display = text.style.display === 'none' ? 'block' : 'none';
    });
    if (kind === 'Listening') setTimeout(function () { playVoice(task.source); }, 280);

    Array.prototype.slice.call(document.querySelectorAll('.eap-boss-choice')).forEach(function (button) {
      button.addEventListener('click', function () {
        if (Number(button.dataset.answer) !== task.answer) {
          document.getElementById('bossMessage').textContent = 'ลองอีกครั้ง: กลับไปดูคำสำคัญใน source หรือฟังอีก 1 รอบ';
          return;
        }
        sendEvidence(gate, kind, task.source, task.choices[task.answer]);
        if (kind === 'Reading') choiceStage(gate, 'Listening');
        else writingStage(gate);
      });
    });
  }

  function frameButtons(frames) {
    return '<div style="display:grid;gap:8px;margin:12px 0">' + frames.map(function (frame, index) {
      return '<button type="button" class="btn ghost eap-boss-frame" data-index="' + index + '" style="text-align:left">＋ ' + esc(frame) + '</button>';
    }).join('') + '</div>';
  }

  function bindFrames(frames, fieldId) {
    Array.prototype.slice.call(document.querySelectorAll('.eap-boss-frame')).forEach(function (button) {
      button.addEventListener('click', function () {
        var field = document.getElementById(fieldId);
        var value = frames[Number(button.dataset.index)];
        field.value = field.value.trim() ? field.value.trim() + ' ' + value : value;
        field.dispatchEvent(new Event('input', { bubbles: true }));
        field.focus();
      });
    });
  }

  function wordCount(text) {
    return String(text || '').trim().split(/\s+/).filter(Boolean).length;
  }

  function writingStage(gate) {
    var g = gateData(gate);
    var task = g.writing;
    shell(gate, 2,
      '<div class="panel light">' +
        '<h3>✍️ Writing · Boss Scenario</h3>' +
        '<p>' + esc(task.prompt) + '</p>' +
        '<p class="mini-note">แตะ sentence frames 2–3 อัน แล้วปรับคำให้เป็นของคุณได้</p>' +
        frameButtons(task.frames) +
        '<textarea id="bossWriting" rows="6" style="width:100%;padding:14px;border-radius:12px;font:inherit" placeholder="Use the sentence frames or write your own short answer."></textarea>' +
        '<p class="mini-note">ผ่านด้วยคำตอบสั้นที่มีอย่างน้อย 2 ideas · ไม่ใช้ grammar auto-score</p>' +
        '<button type="button" class="btn primary" id="bossSaveWriting">Save writing & continue</button><p id="bossWriteMessage" class="mini-note"></p>' +
      '</div>');
    bindFrames(task.frames, 'bossWriting');
    document.getElementById('bossSaveWriting').addEventListener('click', function () {
      var output = document.getElementById('bossWriting').value.trim();
      if (wordCount(output) < 6) {
        document.getElementById('bossWriteMessage').textContent = 'เลือก sentence frame อย่างน้อย 2 อัน หรือเขียนคำตอบสั้น ๆ ก่อนดำเนินการต่อ';
        return;
      }
      sendEvidence(gate, 'Writing', task.prompt, output);
      speakingStage(gate);
    });
  }

  function speakingStage(gate) {
    var g = gateData(gate);
    var task = g.speaking;
    var startedAt = 0;
    var timer = null;
    shell(gate, 3,
      '<div class="panel light">' +
        '<h3>🗣️ Speaking · Boss Scenario with Cue Cards</h3>' +
        '<p>' + esc(task.prompt) + '</p>' +
        '<div class="grid three" style="margin:12px 0">' + task.frames.map(function (frame, index) {
          return '<div class="stat"><b>Cue ' + (index + 1) + '</b><span>' + esc(frame) + '</span></div>';
        }).join('') + '</div>' +
        '<p><b id="bossSpeakClock">00:00</b> / 00:20 minimum</p>' +
        '<button type="button" class="btn ghost" id="bossStartSpeak">Start speaking timer</button>' +
        '<label style="display:block;margin:12px 0"><input type="checkbox" id="bossTopic"> I stated the topic</label>' +
        '<label style="display:block;margin:12px 0"><input type="checkbox" id="bossDetail"> I gave one source detail</label>' +
        '<label style="display:block;margin:12px 0"><input type="checkbox" id="bossClose"> I used a clear closing</label>' +
        '<textarea id="bossSpeakingNote" rows="4" style="width:100%;padding:14px;border-radius:12px;font:inherit" placeholder="Type 1–2 sentences about what you said."></textarea>' +
        '<p class="mini-note">ระบบตรวจเวลาและ checklist เท่านั้น · ครูตรวจหลักฐาน Boss Speaking ภายหลัง ไม่ใช้ transcript ตัดสิน grammar หรือ pronunciation อัตโนมัติ</p>' +
        '<button type="button" class="btn primary" id="bossFinishSpeak">Save speaking & enter Boss Clash</button><p id="bossSpeakMessage" class="mini-note"></p>' +
      '</div>');

    document.getElementById('bossStartSpeak').addEventListener('click', function () {
      if (startedAt) return;
      startedAt = Date.now();
      this.textContent = 'Speaking timer running';
      timer = setInterval(function () {
        var seconds = Math.floor((Date.now() - startedAt) / 1000);
        document.getElementById('bossSpeakClock').textContent = String(Math.floor(seconds / 60)).padStart(2, '0') + ':' + String(seconds % 60).padStart(2, '0');
      }, 250);
    });

    document.getElementById('bossFinishSpeak').addEventListener('click', function () {
      var seconds = startedAt ? Math.floor((Date.now() - startedAt) / 1000) : 0;
      var note = document.getElementById('bossSpeakingNote').value.trim();
      var checklist = {
        spoke: seconds >= 20,
        topic: document.getElementById('bossTopic').checked,
        detail: document.getElementById('bossDetail').checked,
        closing: document.getElementById('bossClose').checked
      };
      if (!checklist.spoke || !checklist.topic || !checklist.detail || !checklist.closing || wordCount(note) < 5) {
        document.getElementById('bossSpeakMessage').textContent = 'ทำให้ครบ: พูด 20 วินาที, ติ๊ก 3 checklist, และพิมพ์ speaking note สั้น ๆ อย่างน้อย 5 คำ';
        return;
      }
      if (timer) clearInterval(timer);
      sendEvidence(gate, 'Speaking', task.prompt, note, { durationSec: seconds, targetRange: '20–40', checklist: checklist });
      completeFourSkills(gate);
    });
  }

  function completeFourSkills(gate) {
    shell(gate, 4,
      '<div class="panel light" style="text-align:center;padding:26px">' +
        '<h3>✅ Four-Skill Evidence Complete</h3>' +
        '<p>คุณทำ Reading, Listening, Writing และ Speaking ครบแล้ว</p>' +
        '<p class="mini-note">Boss Speaking ถูกส่งเป็นรายการสำหรับ Teacher Review ตามข้อตกลงรายวิชา</p>' +
        '<button type="button" class="btn primary" id="enterBossClash">Enter Boss Clash</button>' +
      '</div>');
    document.getElementById('enterBossClash').addEventListener('click', function () {
      var original = window.EAPHero && window.EAPHero.__bossFourSkillOriginalStart;
      if (typeof original === 'function') original('gate' + gate);
    });
  }

  function patch() {
    if (!window.EAPHero || typeof window.EAPHero.startGateBoss !== 'function' || window.EAPHero.__bossFourSkillV3Patched) return;
    window.EAPHero.__bossFourSkillV3Patched = true;
    window.EAPHero.__bossFourSkillOriginalStart = window.EAPHero.startGateBoss;
    window.EAPHero.startGateBoss = function (gateId) {
      var gate = gateNo(gateId);
      if (window.EAPBossReplayScenario && Number(window.EAPBossReplayScenario.gate) !== Number(gate)) {
        window.EAPBossReplayScenario = null;
      }
      choiceStage(gate, 'Reading');
    };
  }

  var wait = setInterval(function () {
    patch();
    if (window.EAPHero && window.EAPHero.__bossFourSkillV3Patched) clearInterval(wait);
  }, 100);

  window.EAPBossFourSkillV2 = { gates: GATES, start: function (gate) { choiceStage(gateNo(gate), 'Reading'); } };
  window.EAPBossFourSkillV3 = { gates: GATES, start: function (gate) { choiceStage(gateNo(gate), 'Reading'); }, version: 'v3-rotating-scenarios' };
})();