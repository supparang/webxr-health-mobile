/* =========================================================
   EAP Hero Boss Gate v4 — Four Skills + Score Rubric
   - B1-B5 run Reading -> Listening -> Writing -> Speaking before Boss Clash.
   - Supports EAPBossReplayBankV3: 150 Boss skill-items.
   - Reading/Listening score by attempt quality, not always 100.
   - Writing/Speaking score by task-completion rubric, not grammar/pronunciation auto-judgment.
   - Boss Speaking still creates teacher review evidence.
========================================================= */
(function () {
  'use strict';

  var STORAGE_KEY = 'EAP_HERO_PROGRESS_V3';
  var SKILLS = ['Reading', 'Listening', 'Writing', 'Speaking'];
  var SCENARIO_CACHE = {};

  var GATES = {
    1:{title:'Boss Gate 1 · Foundation Check',arc:'S1-S3 · goal, academic words, main idea'},
    2:{title:'Boss Gate 2 · Reading Signals & Summary Check',arc:'S4-S6 · keywords, evidence, summary'},
    3:{title:'Boss Gate 3 · Paragraph & Tone Check',arc:'S7-S9 · paragraph structure and academic tone'},
    4:{title:'Boss Gate 4 · Data, Email & Ethics Check',arc:'S10-S12 · notes, evidence, citation and ethical use'},
    5:{title:'Final Boss · Integrated EAP Performance',arc:'S13-S15 · presentation, Q&A and social solution'}
  };

  var FALLBACK = {
    1:{tag:'Default Goal Builder',reading:'Academic English helps students read sources, explain ideas, and set clear learning goals.',rq:'What is the main message?',ra:'Academic English helps students learn and communicate at university.',rd:['Academic English is only for casual chats.','Students should avoid setting goals.','Sources are not useful for study.'],listening:'First, choose one academic goal. Next, choose one small action. Finally, check your progress.',lq:'What should a learner do after choosing a goal?',la:'Choose one small action.',ld:['Stop studying.','Copy another plan.','Ignore progress.'],writing:'Write 2-4 sentences: one academic goal, one action, and one way to check progress.',speaking:'Speak for 30-45 seconds: introduce your goal, one action, and a closing.'},
    2:{tag:'Default Evidence Check',reading:'A careful reader uses keywords, checks evidence, and writes the central idea in short new words.',rq:'Which action matches the source?',ra:'Find keywords, check evidence, and write a short summary.',rd:['Copy the first sentence only.','Choose a claim because it sounds strong.','Ignore evidence and read the title only.'],listening:'A credible source has a clear author, relevant evidence, and a publication context.',lq:'Which feature was mentioned?',la:'A clear author.',ld:['A colourful page.','A celebrity photo.','A short slogan.'],writing:'Write 2-4 sentences: make one claim, add one detail, and explain why it is relevant.',speaking:'Speak for 30-45 seconds: state a claim, one evidence check, and a conclusion.'},
    3:{tag:'Default Paragraph Builder',reading:'A focused paragraph has a topic sentence, support or evidence, and a closing sentence.',rq:'Which order is correct?',ra:'Topic sentence, support, closing sentence.',rd:['Closing, greeting, new topic.','Random detail, title, question.','Reference list, unrelated opinion, heading.'],listening:'Academic tone is clear and careful. Avoid slang and very strong claims without support.',lq:'What should a writer avoid?',la:'Slang and unsupported strong claims.',ld:['Clear language.','A topic sentence.','One support detail.'],writing:'Write a short paragraph with a topic sentence, one support detail, and a closing.',speaking:'Speak for 30-45 seconds: explain one study strategy with a clear closing.'},
    4:{tag:'Default Data Reporter',reading:'Academic communication reports data accurately, uses a polite purpose, and names sources or AI support honestly.',rq:'Which response follows the source?',ra:'Report data carefully, write politely, and name the source or AI support.',rd:['Change numbers to sound dramatic.','Copy work and say it is original.','Hide where information comes from.'],listening:'Online quiz use rose from 40 percent to 58 percent. Describe the increase, but do not claim a cause without evidence.',lq:'What should the learner do?',la:'Describe the increase carefully.',ld:['Say quizzes caused every improvement.','Ignore the numbers.','Report a decrease.'],writing:'Write 2-4 sentences: describe a data change and one limit.',speaking:'Speak for 30-45 seconds: report one result carefully and close clearly.'},
    5:{tag:'Default Community Solution',reading:'Digital literacy helps students evaluate online information, use evidence responsibly, and explain a practical solution to a social problem.',rq:'Which final response uses the source well?',ra:'Check information, use evidence, and propose a practical solution.',rd:['Share the first online claim without checking.','Give a solution without evidence.','Avoid explaining the social problem.'],listening:'First, name one social problem. Next, add one credible detail. Finally, propose one realistic action.',lq:'What comes before the realistic action?',la:'One credible detail.',ld:['A casual greeting.','A difficult word only.','An unrelated story.'],writing:'Write 3-4 sentences: one social problem, one evidence-based detail, and one realistic action.',speaking:'Speak for 30-45 seconds: present one problem, one detail, one solution, and a conclusion.'}
  };

  function esc(value){
    return String(value == null ? '' : value).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; });
  }
  function clone(obj){ return JSON.parse(JSON.stringify(obj)); }
  function words(value){ return String(value || '').trim().split(/\s+/).filter(Boolean); }
  function wordCount(value){ return words(value).length; }
  function clamp(n,min,max){ return Math.max(min, Math.min(max, n)); }

  function shuffleWithAnswer(correct, distractors){
    var items = [correct].concat(distractors || []).map(function(text,index){ return {text:text, correct:index===0}; });
    for (var i=items.length-1;i>0;i--){ var j=Math.floor(Math.random()*(i+1)); var t=items[i]; items[i]=items[j]; items[j]=t; }
    var answer = items.findIndex(function(item){ return item.correct; });
    return { choices:items.map(function(item){ return item.text; }), answer:answer < 0 ? 0 : answer };
  }

  function fallbackScenario(gate){ return clone(FALLBACK[gate] || FALLBACK[1]); }

  function activeScenario(gate){
    var current = window.EAPBossReplayScenario;
    if (current && Number(current.gate) === Number(gate) && current.scenario){ SCENARIO_CACHE[gate] = current.scenario; return current.scenario; }
    if (SCENARIO_CACHE[gate]) return SCENARIO_CACHE[gate];
    var fallback = fallbackScenario(gate);
    SCENARIO_CACHE[gate] = fallback;
    window.EAPBossReplayScenario = { gate:gate, scenario:fallback };
    return fallback;
  }

  function gateData(gate){
    var base = clone(GATES[gate] || GATES[1]);
    var sc = activeScenario(gate);
    var reading = shuffleWithAnswer(sc.ra, sc.rd);
    var listening = shuffleWithAnswer(sc.la, sc.ld);
    base.scenarioTag = sc.tag || 'Boss Scenario';
    base.itemMeta = sc.itemMeta || {};
    base.reading = { source:sc.reading, question:sc.rq, choices:reading.choices, answer:reading.answer };
    base.listening = { source:sc.listening, question:sc.lq, choices:listening.choices, answer:listening.answer };
    base.writing = { prompt:sc.writing, frames:sc.writingFrames || ['My main point is clear.','One useful detail is included.','This helps me explain the task.'] };
    base.speaking = { prompt:sc.speaking, frames:sc.speakingFrames || ['Today I will explain my idea.','One important detail is included.','This is useful for my study.'] };
    return base;
  }

  function readState(){
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); }
    catch(_){ return { profile:{studentId:'guest', studentName:'Guest', section:'122'} }; }
  }
  function gateNo(value){ var n = Number(String(value || '').replace(/\D/g,'')); return GATES[n] ? n : 1; }
  function evidenceSync(){ return window.EAPEvidenceSyncV130 || window.EAPEvidenceSyncV129 || null; }

  function mcqScore(wrongCount){
    if (wrongCount <= 0) return {score:100, level:'Excellent', note:'ตอบถูกตั้งแต่ครั้งแรก'};
    if (wrongCount === 1) return {score:85, level:'Good', note:'ตอบถูกหลังลองใหม่ 1 ครั้ง'};
    if (wrongCount === 2) return {score:72, level:'Pass', note:'ตอบถูกหลังทบทวน source'};
    return {score:60, level:'Pass', note:'ผ่านขั้นต่ำจากการลองใหม่หลายครั้ง'};
  }

  function writingScore(output, frames){
    var wc = wordCount(output);
    var lower = String(output || '').toLowerCase();
    var frameHits = (frames || []).filter(function(f){ return lower.indexOf(String(f).split(' ').slice(0,4).join(' ').toLowerCase()) >= 0; }).length;
    var connectors = /(because|for example|this helps|therefore|however|also|first|next|finally|one useful|one important)/i.test(output) ? 1 : 0;
    var components = {
      taskComplete: wc >= 6 ? 25 : Math.round(wc * 4),
      ideas: clamp(Math.round(wc * 1.4), 8, 25),
      frameUse: clamp(frameHits * 7 + (connectors ? 6 : 0), 8, 20),
      clarity: wc >= 18 ? 20 : wc >= 12 ? 16 : 12,
      mechanics: wc >= 10 ? 10 : 7
    };
    var score = clamp(components.taskComplete + components.ideas + components.frameUse + components.clarity + components.mechanics, 50, 100);
    if (wc >= 25 && connectors) score = Math.max(score, 92);
    return { score:score, level:score >= 90 ? 'Excellent' : score >= 75 ? 'Good' : score >= 60 ? 'Pass' : 'Developing', note:'Writing rubric: task, ideas, frame use, clarity, basic mechanics', components:components };
  }

  function speakingScore(seconds, checklist, note){
    var noteWords = wordCount(note);
    var checked = ['topic','detail','closing'].filter(function(k){ return checklist[k]; }).length;
    var components = {
      duration: seconds >= 40 ? 25 : seconds >= 30 ? 22 : seconds >= 20 ? 18 : Math.round(seconds * 0.8),
      checklist: checked * 15,
      note: noteWords >= 18 ? 20 : noteWords >= 10 ? 16 : noteWords >= 5 ? 12 : 4,
      reflectionMatch: checked === 3 && noteWords >= 5 ? 10 : 5
    };
    var score = clamp(components.duration + components.checklist + components.note + components.reflectionMatch, 45, 100);
    if (seconds >= 20 && checked === 3 && noteWords >= 5) score = Math.max(score, 75);
    return { score:score, level:score >= 90 ? 'Excellent' : score >= 75 ? 'Good' : score >= 60 ? 'Pass' : 'Developing', note:'Speaking rubric: duration, checklist, speaking note. Pronunciation/grammar are for teacher review, not auto-scored.', components:components };
  }

  function sendEvidence(gate, skill, prompt, output, extras){
    extras = extras || {};
    var g = gateData(gate);
    var score = Number(extras.score || 100);
    var entry = {
      rawEvidenceId:'boss-' + gate + '-' + skill + '-' + Date.now(),
      sessionId:'B' + gate,
      sessionTitle:g.title,
      skill:skill,
      evidenceType:'boss_' + skill.toLowerCase() + '_evidence',
      taskId:'B' + gate + '_' + skill,
      score:score,
      latestScore:score,
      passed:score >= 60,
      prompt:prompt,
      output:output,
      durationSec:extras.durationSec || 0,
      targetRange:extras.targetRange || '',
      teacherReviewRequired:skill === 'Speaking',
      teacherReviewStatus:skill === 'Speaking' ? 'pending_teacher_review' : '',
      oralChecklist:extras.checklist || {},
      attemptCount:extras.attemptCount || 1,
      at:new Date().toISOString(),
      scoreLevel:extras.level || '',
      scoreExplanation:extras.note || '',
      scoringBreakdown:extras.components || {},
      boss:{gate:gate, requiredSkills:SKILLS.slice(), stage:skill, scenarioTag:g.scenarioTag, itemMeta:g.itemMeta || {}}
    };
    var sync = evidenceSync();
    if (sync && typeof sync.submitRaw === 'function') sync.submitRaw(entry, readState());
  }

  function playVoice(text){
    try { window.speechSynthesis.cancel(); var voice = new SpeechSynthesisUtterance(text); voice.lang='en-US'; voice.rate=0.78; window.speechSynthesis.speak(voice); } catch(_) {}
  }

  function shell(gate, current, inner){
    var g = gateData(gate);
    document.getElementById('app').innerHTML = '' +
      '<main class="wrap" style="max-width:1100px;margin:auto;padding:20px">' +
      '<section class="panel" style="margin-top:18px">' +
      '<div class="badges"><span class="pill">Boss Gate ' + gate + '</span><span class="pill">4 Skills Required</span><span class="pill">Scenario: ' + esc(g.scenarioTag) + '</span><span class="pill">Score Rubric V4</span></div>' +
      '<h2>' + esc(g.title) + '</h2>' +
      '<p class="lead">' + esc(g.arc) + ' · ทำทีละทักษะ คะแนนมาจากคุณภาพการทำภารกิจ ไม่ใช่ 100 อัตโนมัติ</p>' +
      '<div class="grid four" style="margin:14px 0">' + SKILLS.map(function(skill,index){ var state = index < current ? '✓ Complete' : index === current ? 'Current' : 'Locked'; var outline = index === current ? 'outline:3px solid #73d9e7' : ''; return '<div class="stat" style="' + outline + '"><b>' + esc(skill) + '</b><span>' + state + '</span></div>'; }).join('') + '</div>' + inner +
      '</section></main>';
  }

  function scoreBox(title, rubric){
    return '<div class="panel light" style="margin:12px 0;padding:14px"><b>' + esc(title) + ': ' + rubric.score + '/100 · ' + esc(rubric.level) + '</b><p class="mini-note">' + esc(rubric.note) + '</p></div>';
  }

  function sourceBox(kind, source){
    var listen = kind === 'Listening';
    return '<div class="panel light" style="margin:14px 0"><h3>' + (listen ? '🎧 Listening' : '📖 Reading') + ' · Boss Scenario</h3>' +
      (listen ? '<button type="button" class="btn ghost" id="bossPlay">▶ Play audio</button> <button type="button" class="btn ghost" id="bossShowText">Show text support</button><p id="bossTranscript" class="mini-note" style="display:none;margin-top:10px">' + esc(source) + '</p>' : '<p style="font-size:18px;line-height:1.65">' + esc(source) + '</p>') +
      '<p class="mini-note">ตอบถูกครั้งแรกได้คะแนนสูงสุด · ตอบผิดลองใหม่ได้แต่คะแนนลดลงเล็กน้อย · ตำแหน่งคำตอบหมุนทุกครั้ง</p></div>';
  }

  function choiceStage(gate, kind){
    var g = gateData(gate), task = kind === 'Reading' ? g.reading : g.listening, stage = kind === 'Reading' ? 0 : 1, wrong = 0;
    shell(gate, stage, sourceBox(kind, task.source) + '<h3>' + esc(task.question) + '</h3>' + task.choices.map(function(choice,index){ return '<button type="button" class="btn ghost block eap-boss-choice" data-answer="' + index + '" style="margin:9px 0;text-align:left">' + String.fromCharCode(65+index) + '. ' + esc(choice) + '</button>'; }).join('') + '<p id="bossMessage" class="mini-note"></p>');
    document.getElementById('bossPlay') && document.getElementById('bossPlay').addEventListener('click', function(){ playVoice(task.source); });
    document.getElementById('bossShowText') && document.getElementById('bossShowText').addEventListener('click', function(){ var t=document.getElementById('bossTranscript'); t.style.display=t.style.display==='none'?'block':'none'; });
    if (kind === 'Listening') setTimeout(function(){ playVoice(task.source); }, 280);
    Array.prototype.slice.call(document.querySelectorAll('.eap-boss-choice')).forEach(function(button){
      button.addEventListener('click', function(){
        if (Number(button.dataset.answer) !== task.answer){ wrong += 1; document.getElementById('bossMessage').textContent = 'ลองอีกครั้ง: กลับไปดู keyword/evidence ใน source หรือฟังอีก 1 รอบ'; return; }
        var rubric = mcqScore(wrong);
        sendEvidence(gate, kind, task.source, task.choices[task.answer], {score:rubric.score, level:rubric.level, note:rubric.note, attemptCount:wrong + 1});
        document.getElementById('bossMessage').innerHTML = scoreBox(kind + ' Score', rubric);
        setTimeout(function(){ if (kind === 'Reading') choiceStage(gate, 'Listening'); else writingStage(gate); }, 650);
      });
    });
  }

  function frameButtons(frames){ return '<div style="display:grid;gap:8px;margin:12px 0">' + frames.map(function(frame,index){ return '<button type="button" class="btn ghost eap-boss-frame" data-index="' + index + '" style="text-align:left">＋ ' + esc(frame) + '</button>'; }).join('') + '</div>'; }
  function bindFrames(frames, fieldId){ Array.prototype.slice.call(document.querySelectorAll('.eap-boss-frame')).forEach(function(button){ button.addEventListener('click', function(){ var field=document.getElementById(fieldId); var value=frames[Number(button.dataset.index)]; field.value = field.value.trim() ? field.value.trim() + ' ' + value : value; field.dispatchEvent(new Event('input',{bubbles:true})); field.focus(); }); }); }

  function writingStage(gate){
    var g = gateData(gate), task = g.writing;
    shell(gate, 2, '<div class="panel light"><h3>✍️ Writing · Boss Scenario</h3><p>' + esc(task.prompt) + '</p><p class="mini-note">คะแนนดูจาก task, ideas, frame use, clarity และ basic mechanics · ไม่หัก grammar โหดเกินระดับ A2-B1+</p>' + frameButtons(task.frames) + '<textarea id="bossWriting" rows="6" style="width:100%;padding:14px;border-radius:12px;font:inherit" placeholder="Use the sentence frames or write your own short answer."></textarea><button type="button" class="btn primary" id="bossSaveWriting">Save writing & continue</button><p id="bossWriteMessage" class="mini-note"></p></div>');
    bindFrames(task.frames, 'bossWriting');
    document.getElementById('bossSaveWriting').addEventListener('click', function(){
      var output = document.getElementById('bossWriting').value.trim();
      if (wordCount(output) < 6){ document.getElementById('bossWriteMessage').textContent = 'เลือก sentence frame อย่างน้อย 2 อัน หรือเขียนคำตอบสั้น ๆ ก่อนดำเนินการต่อ'; return; }
      var rubric = writingScore(output, task.frames);
      sendEvidence(gate, 'Writing', task.prompt, output, {score:rubric.score, level:rubric.level, note:rubric.note, components:rubric.components});
      document.getElementById('bossWriteMessage').innerHTML = scoreBox('Writing Score', rubric);
      setTimeout(function(){ speakingStage(gate); }, 720);
    });
  }

  function speakingStage(gate){
    var g = gateData(gate), task = g.speaking, startedAt = 0, timer = null;
    shell(gate, 3, '<div class="panel light"><h3>🗣️ Speaking · Boss Scenario with Cue Cards</h3><p>' + esc(task.prompt) + '</p><div class="grid three" style="margin:12px 0">' + task.frames.map(function(frame,index){ return '<div class="stat"><b>Cue ' + (index+1) + '</b><span>' + esc(frame) + '</span></div>'; }).join('') + '</div><p><b id="bossSpeakClock">00:00</b> / 00:20 minimum</p><button type="button" class="btn ghost" id="bossStartSpeak">Start speaking timer</button><label style="display:block;margin:12px 0"><input type="checkbox" id="bossTopic"> I stated the topic</label><label style="display:block;margin:12px 0"><input type="checkbox" id="bossDetail"> I gave one source detail</label><label style="display:block;margin:12px 0"><input type="checkbox" id="bossClose"> I used a clear closing</label><textarea id="bossSpeakingNote" rows="4" style="width:100%;padding:14px;border-radius:12px;font:inherit" placeholder="Type 1-2 sentences about what you said."></textarea><p class="mini-note">ระบบให้คะแนนจากเวลา + checklist + note เท่านั้น · ครูตรวจ Boss Speaking เพิ่มภายหลัง ไม่ใช้ transcript ตัดสิน grammar/pronunciation อัตโนมัติ</p><button type="button" class="btn primary" id="bossFinishSpeak">Save speaking & enter Boss Clash</button><p id="bossSpeakMessage" class="mini-note"></p></div>');
    document.getElementById('bossStartSpeak').addEventListener('click', function(){ if (startedAt) return; startedAt = Date.now(); this.textContent = 'Speaking timer running'; timer = setInterval(function(){ var seconds = Math.floor((Date.now()-startedAt)/1000); document.getElementById('bossSpeakClock').textContent = String(Math.floor(seconds/60)).padStart(2,'0') + ':' + String(seconds%60).padStart(2,'0'); }, 250); });
    document.getElementById('bossFinishSpeak').addEventListener('click', function(){
      var seconds = startedAt ? Math.floor((Date.now()-startedAt)/1000) : 0;
      var note = document.getElementById('bossSpeakingNote').value.trim();
      var checklist = {spoke:seconds>=20, topic:document.getElementById('bossTopic').checked, detail:document.getElementById('bossDetail').checked, closing:document.getElementById('bossClose').checked};
      if (!checklist.spoke || !checklist.topic || !checklist.detail || !checklist.closing || wordCount(note) < 5){ document.getElementById('bossSpeakMessage').textContent = 'ทำให้ครบ: พูด 20 วินาที, ติ๊ก 3 checklist, และพิมพ์ speaking note สั้น ๆ อย่างน้อย 5 คำ'; return; }
      if (timer) clearInterval(timer);
      var rubric = speakingScore(seconds, checklist, note);
      sendEvidence(gate, 'Speaking', task.prompt, note, {score:rubric.score, level:rubric.level, note:rubric.note, components:rubric.components, durationSec:seconds, targetRange:'20-45', checklist:checklist});
      document.getElementById('bossSpeakMessage').innerHTML = scoreBox('Speaking Score', rubric);
      setTimeout(function(){ completeFourSkills(gate); }, 780);
    });
  }

  function completeFourSkills(gate){
    shell(gate, 4, '<div class="panel light" style="text-align:center;padding:26px"><h3>✅ Four-Skill Evidence Complete</h3><p>คุณทำ Reading, Listening, Writing และ Speaking ครบแล้ว</p><p class="mini-note">Boss Speaking ถูกส่งเป็นรายการสำหรับ Teacher Review ตามข้อตกลงรายวิชา</p><button type="button" class="btn primary" id="enterBossClash">Enter Boss Clash</button></div>');
    document.getElementById('enterBossClash').addEventListener('click', function(){ var original = window.EAPHero && window.EAPHero.__bossFourSkillOriginalStart; if (typeof original === 'function') original('gate' + gate); });
  }

  function patch(){
    if (!window.EAPHero || typeof window.EAPHero.startGateBoss !== 'function' || window.EAPHero.__bossFourSkillV4Patched) return;
    window.EAPHero.__bossFourSkillV4Patched = true;
    window.EAPHero.__bossFourSkillOriginalStart = window.EAPHero.startGateBoss;
    window.EAPHero.startGateBoss = function(gateId){
      var gate = gateNo(gateId);
      if (window.EAPBossReplayScenario && Number(window.EAPBossReplayScenario.gate) !== Number(gate)) window.EAPBossReplayScenario = null;
      choiceStage(gate, 'Reading');
    };
  }

  var wait = setInterval(function(){ patch(); if (window.EAPHero && window.EAPHero.__bossFourSkillV4Patched) clearInterval(wait); }, 100);
  window.EAPBossFourSkillV4 = { gates:GATES, start:function(gate){ choiceStage(gateNo(gate),'Reading'); }, version:'v4-score-rubric-150-bank-ready', scoring:{mcqScore:mcqScore, writingScore:writingScore, speakingScore:speakingScore} };
})();
