/* =========================================================
   EAP Hero Writing Evidence Guard v3
   File: eap-writing-evidence-guard-v1.js

   Purpose
   - Captures a valid normal-session writing response at submit time.
   - Waits for the genuine “Writing Evidence Saved” completion screen.
   - Sends submit_evidence independently of the core submit method.
   - Leaves Mastery / Exposure classification to Apps Script Contract V2.
========================================================= */
(function(){
  'use strict';

  var STORE = 'EAP_HERO_PROGRESS_V3';
  var SENT = 'EAP_HERO_WRITING_EVIDENCE_SENT_V3';
  var pending = null;
  var heroPatched = false;

  function clean(value){
    return String(value == null ? '' : value)
      .replace(/\s+/g, ' ')
      .trim();
  }

  function appText(){
    return String(
      (document.getElementById('app') || document.body).innerText || ''
    );
  }

  function writingBox(){
    return document.getElementById('writingOutput');
  }

  function currentSession(){
    var match = appText().match(/(?:Session\s*|\bS)(1[0-5]|[1-9])\b/i);
    return Number(match && match[1] || 0);
  }

  function isWritingPage(){
    return /Writing Mission|Writing Evidence Saved/i.test(appText());
  }

  function isCompletionPage(){
    return /Writing Evidence Saved/i.test(appText());
  }

  function acceptable(value){
    return clean(value).split(/\s+/).filter(Boolean).length >= 4;
  }

  function readJson(key){
    try { return JSON.parse(localStorage.getItem(key) || 'null'); }
    catch(error){ return null; }
  }

  function findProfileIn(value, depth){
    if(!value || depth > 4) return null;

    if(typeof value === 'object'){
      var studentId = clean(value.studentId || value.id || value.studentCode);
      var name = clean(value.name || value.studentName || value.displayName);
      var section = clean(value.section || value.classGroup || value.group);

      if(studentId && (name || section)){
        return {
          studentId: studentId,
          name: name || 'Guest',
          section: section || '122'
        };
      }

      var keys = Object.keys(value);
      for(var index = 0; index < keys.length; index += 1){
        var found = findProfileIn(value[keys[index]], depth + 1);
        if(found) return found;
      }
    }

    return null;
  }

  function playerState(){
    var primary = readJson(STORE);
    var profile = findProfileIn(primary, 0);

    if(!profile){
      for(var index = 0; index < localStorage.length; index += 1){
        var key = localStorage.key(index) || '';
        if(!/eap.*(profile|progress|player)/i.test(key)) continue;
        profile = findProfileIn(readJson(key), 0);
        if(profile) break;
      }
    }

    if(!profile) return null;

    return {
      profile: {
        studentId: profile.studentId,
        id: profile.studentId,
        name: profile.name,
        studentName: profile.name,
        section: profile.section
      }
    };
  }

  function sentMap(){
    return readJson(SENT) || {};
  }

  function saveSent(map){
    try { localStorage.setItem(SENT, JSON.stringify(map)); }
    catch(error){}
  }

  function scoreFromPage(){
    var matches = appText().match(/\b(\d{1,3})\s*\/\s*100\b/g) || [];
    if(!matches.length) return 0;

    var score = Number(String(matches[0]).split('/')[0]);
    return Number.isFinite(score)
      ? Math.max(0, Math.min(100, score))
      : 0;
  }

  function titleFor(sessionNumber){
    var titles = {
      1:'Academic Hero Awakening',
      2:'Vocabulary Lab',
      3:'Main Idea Hunter',
      4:'Keyword Scanner',
      5:'Critical Reading',
      6:'Summary Builder',
      7:'Academic Tone Battle',
      8:'Paragraph Structure Lab',
      9:'Paragraph Writing',
      10:'Data Description',
      11:'Academic Email',
      12:'Citation and Ethics',
      13:'Academic Listening',
      14:'Academic Presentation',
      15:'Final Integration'
    };

    return titles[sessionNumber] || ('Session ' + sessionNumber);
  }

  function promptFromPage(){
    var node = document.querySelector(
      '[data-writing-prompt], .writing-prompt, .mission-prompt, .prompt'
    );

    return clean(node && node.innerText) || 'Writing activity evidence.';
  }

  function queueWriting(value, sessionNumber, prompt){
    if(!acceptable(value) || !sessionNumber) return false;

    var now = Date.now();
    var samePending = pending &&
      pending.sessionNumber === sessionNumber &&
      pending.value === value &&
      now - pending.createdAt < 5000;

    if(samePending) return true;

    pending = {
      id: 'writing-pending-' + now,
      value: value,
      prompt: clean(prompt) || promptFromPage(),
      sessionNumber: sessionNumber,
      createdAt: now,
      sent: false
    };

    window.setTimeout(flushPending, 350);
    window.setTimeout(flushPending, 1200);
    window.setTimeout(flushPending, 2600);
    window.setTimeout(flushPending, 5000);

    return true;
  }

  function flushPending(){
    if(!pending || pending.sent || !isCompletionPage()) return false;

    var sync = window.EAPEvidenceSyncV131 ||
      window.EAPEvidenceSyncV130 ||
      window.EAPEvidenceSyncV129;

    if(!sync || typeof sync.submitRaw !== 'function'){
      console.warn('[EAP Writing Evidence Guard v3] Evidence Sync is unavailable');
      return false;
    }

    var state = playerState();
    if(!state || !state.profile || !clean(state.profile.studentId)){
      console.warn('[EAP Writing Evidence Guard v3] Player profile is unavailable');
      return false;
    }

    var person = state.profile;
    var evidenceId = [
      'writing',
      clean(person.studentId),
      'S' + pending.sessionNumber,
      pending.createdAt
    ].join('-');

    var sent = sentMap();
    if(sent[evidenceId]){
      pending.sent = true;
      return true;
    }

    var entry = {
      rawEvidenceId: evidenceId,
      sessionId: 'S' + pending.sessionNumber,
      sessionTitle: titleFor(pending.sessionNumber),
      skill: 'writing',
      evidenceType: 'writing_evidence',
      taskId: 'writing_s' + pending.sessionNumber,
      score: scoreFromPage(),
      prompt: pending.prompt,
      output: pending.value,
      answer: pending.value,
      studentAnswer: pending.value,
      attemptNo: 1,
      at: new Date().toISOString()
    };

    var ok = sync.submitRaw(entry, state, { output: pending.value });

    if(ok){
      sent[evidenceId] = Date.now();
      saveSent(sent);
      pending.sent = true;
      console.info('[EAP Writing Evidence Guard v3] evidence queued', evidenceId);
    }

    return ok;
  }

  function showInvalidNotice(){
    alert('กรุณาเขียนคำตอบของตนเองอย่างน้อย 1 ประโยคก่อนส่ง');
    if(writingBox()) writingBox().focus();
  }

  function captureSubmit(event){
    var button = event.target && event.target.closest
      ? event.target.closest('button')
      : null;

    if(!button || !/submit\s*writing/i.test(clean(button.textContent))) return;
    if(!isWritingPage()) return;

    var value = clean(writingBox() && writingBox().value);
    var sessionNumber = currentSession();

    if(!acceptable(value)){
      event.preventDefault();
      event.stopImmediatePropagation();
      showInvalidNotice();
      return;
    }

    queueWriting(value, sessionNumber, promptFromPage());
  }

  function patchHero(){
    var api = window.EAPHero;

    if(!api || heroPatched || typeof api.submitWriting !== 'function') return;

    var original = api.submitWriting.bind(api);
    api.submitWriting = function(){
      var value = clean(writingBox() && writingBox().value);
      var sessionNumber = currentSession();

      if(isWritingPage() && !acceptable(value)){
        showInvalidNotice();
        return false;
      }

      if(acceptable(value) && sessionNumber){
        queueWriting(value, sessionNumber, promptFromPage());
      }

      return original.apply(api, arguments);
    };

    heroPatched = true;
  }

  document.addEventListener('click', captureSubmit, true);

  var observer = new MutationObserver(function(){
    flushPending();
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true
  });

  var patchTimer = window.setInterval(function(){
    patchHero();
    if(heroPatched) window.clearInterval(patchTimer);
  }, 120);

  window.EAPWritingEvidenceGuardV3 = {
    queueWriting: queueWriting,
    flushPending: flushPending,
    debug: function(){
      return {
        pending: pending,
        completion: isCompletionPage(),
        session: currentSession(),
        state: playerState()
      };
    }
  };
})();
