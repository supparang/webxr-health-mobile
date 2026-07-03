/* =========================================================
   EAP Hero Learning Ladder v1
   A2 Foundation → A2+ Bridge → B1 Core → B1+ Stretch
   Applies a visible, source-grounded scaffold to every S1–S15
   mission without changing the original evidence or replay model.
   ========================================================= */
(function () {
  'use strict';

  var BANK = function () {
    return (window.EAP_GOLD_AUTHORED_BANK && window.EAP_GOLD_AUTHORED_BANK.sessions) || {};
  };

  var PLAN = {
    1: { theme: 'Set one clear academic goal', focus: 'goal + action', core: ['Reading', 'Speaking'] },
    2: { theme: 'Use academic words in context', focus: 'word + meaning + simple use', core: ['Reading', 'Writing'] },
    3: { theme: 'Find the main idea', focus: 'main idea + one detail', core: ['Reading', 'Writing'] },
    4: { theme: 'Read keywords and signals', focus: 'keyword + relationship', core: ['Reading', 'Listening'] },
    5: { theme: 'Check claims and evidence', focus: 'claim + evidence', core: ['Reading', 'Speaking'] },
    6: { theme: 'Summarize a short source', focus: 'main idea + own words', core: ['Reading', 'Writing'] },
    7: { theme: 'Build a focused paragraph', focus: 'topic + support + closing', core: ['Writing', 'Speaking'] },
    8: { theme: 'Improve paragraph structure', focus: 'order + linking word', core: ['Reading', 'Writing'] },
    9: { theme: 'Write with academic tone', focus: 'formal choice + cautious claim', core: ['Writing', 'Speaking'] },
    10: { theme: 'Take useful research notes', focus: 'source + key point', core: ['Reading', 'Writing'] },
    11: { theme: 'Use evidence responsibly', focus: 'claim + support', core: ['Writing', 'Speaking'] },
    12: { theme: 'Cite and paraphrase safely', focus: 'own words + source signal', core: ['Reading', 'Writing'] },
    13: { theme: 'Understand presentation messages', focus: 'listen + key message', core: ['Listening', 'Writing'] },
    14: { theme: 'Plan a clear presentation', focus: 'opening + point + close', core: ['Writing', 'Speaking'] },
    15: { theme: 'Respond in an academic setting', focus: 'answer + reason + close', core: ['Writing', 'Speaking'] }
  };

  var MEANINGS = {
    'conduct research': 'do a study',
    'significant': 'important or meaningful',
    'analyze': 'study carefully',
    'analysis': 'careful study of information',
    'analytical': 'related to careful study',
    'indicate': 'show or suggest',
    'prove': 'show something is certainly true',
    'evidence': 'information that supports an idea',
    'claim': 'an idea that needs support',
    'source': 'where information comes from',
    'main idea': 'the most important message',
    'keyword': 'an important topic word',
    'summary': 'a short version of the main points',
    'paraphrase': 'say the same idea in new words',
    'citation': 'a source signal in academic work',
    'method': 'a way to do a study',
    'result': 'what a study found',
    'conclusion': 'the final main point',
    'however': 'but / in contrast',
    'therefore': 'because of that / as a result'
  };

  function clean(value) {
    return String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
  }

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  function appText() {
    return clean((document.getElementById('app') || document.body).innerText || '');
  }

  function activeSession() {
    var text = appText();
    var patterns = [
      /\bS(?:ession)?\s*0?(1[0-5]|[1-9])\b/i,
      /Session\s*:?\s*(1[0-5]|[1-9])\b/i
    ];
    for (var i = 0; i < patterns.length; i++) {
      var hit = text.match(patterns[i]);
      if (hit) return Number(hit[1]);
    }
    return 0;
  }

  function activeSkill() {
    var text = appText();
    var match = text.match(/\b(Reading|Writing|Listening|Speaking)\s+Mission\b/i) ||
      text.match(/\b(Reading|Writing|Listening|Speaking)\s+Evidence\b/i) ||
      text.match(/\b(Reading|Writing|Listening|Speaking)\b/i);
    return match ? match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase() : '';
  }

  function isBossPage() {
    var text = appText();
    return /Boss Gate|Final Boss|Boss Clash|Four-Skill Evidence/i.test(text);
  }

  function activeSource(session) {
    var sessions = BANK();
    var sources = sessions[String(session)] && sessions[String(session)].sources;
    if (!Array.isArray(sources)) return null;
    var text = appText();
    var best = null;
    sources.forEach(function (source) {
      var score = 0;
      if (source.id && text.indexOf(source.id) >= 0) score += 10;
      if (source.title && text.indexOf(source.title) >= 0) score += 8;
      var start = clean(source.passage).slice(0, 42);
      if (start && text.indexOf(start) >= 0) score += 7;
      if (score && (!best || score > best.score)) best = { source: source, score: score };
    });
    return best && best.source;
  }

  function quotedPhrases(text) {
    var found = [];
    String(text || '').replace(/[“"]([^”"]{2,100})[”"]/g, function (_, phrase) {
      found.push(clean(phrase));
      return _;
    });
    return found;
  }

  function usefulPhrase(source) {
    if (!source) return 'one useful academic phrase';
    var quoted = quotedPhrases(source.passage || source.specificPassage || '');
    if (quoted.length) {
      var longest = quoted.slice().sort(function (a, b) { return b.length - a.length; })[0];
      return longest.replace(/[.]+$/, '');
    }
    var words = Array.isArray(source.keywords) ? source.keywords.filter(Boolean) : [];
    if (words.length) return clean(words[0]);
    return clean(source.title || 'one useful academic phrase');
  }

  function meaningFor(phrase, source) {
    var key = clean(phrase).toLowerCase();
    if (MEANINGS[key]) return MEANINGS[key];
    var partial = Object.keys(MEANINGS).find(function (item) { return key.indexOf(item) >= 0 || item.indexOf(key) >= 0; });
    if (partial) return MEANINGS[partial];
    if (source && source.main) return 'an important idea in this source';
    return 'an important academic idea';
  }

  function sourceTopic(source, fallback) {
    return clean((source && (source.title || source.keywords && source.keywords[0])) || fallback || 'this topic');
  }

  function frameSet(skill, source, session) {
    var phrase = usefulPhrase(source);
    var meaning = meaningFor(phrase, source);
    var topic = sourceTopic(source, PLAN[session] && PLAN[session].focus);
    var evidence = clean((source && source.evidence) || phrase).replace(/[.]+$/, '');

    if (skill === 'Writing') {
      return [
        'The source is about ' + topic + '.',
        'One useful point is: ' + phrase + '.',
        'This can help me in my study.'
      ];
    }
    if (skill === 'Speaking') {
      return [
        'Today I will talk about ' + topic + '.',
        'One useful phrase is ' + phrase + '.',
        'This is useful for my study.'
      ];
    }
    if (skill === 'Listening') {
      return [
        'I heard: ' + phrase + '.',
        'It means ' + meaning + '.',
        'The key message is about ' + topic + '.'
      ];
    }
    return [
      phrase + '.',
      'It means ' + meaning + '.',
      'In this source, ' + phrase + ' is important.'
    ];
  }

  function triggerInput(field) {
    try { field.dispatchEvent(new Event('input', { bubbles: true })); } catch (_) {}
    try { field.dispatchEvent(new Event('change', { bubbles: true })); } catch (_) {}
    field.focus();
  }

  function fillField(field, text) {
    if (!field) return;
    var current = clean(field.value);
    field.value = current ? current + ' ' + text : text;
    triggerInput(field);
  }

  function findFields() {
    return Array.prototype.slice.call(document.querySelectorAll('#app textarea, #app input[type="text"]'))
      .filter(function (field) {
        return field.offsetParent !== null && !field.disabled && field.id !== 'bossWriting' && field.id !== 'speakingNote';
      });
  }

  function setHelperText(field, text) {
    if (!field || !field.parentNode) return;
    var key = 'eap-ladder-helper-' + (field.id || Math.random().toString(36).slice(2));
    var existing = field.parentNode.querySelector('[data-eap-helper-for="' + (field.id || '') + '"]');
    if (existing) {
      existing.textContent = text;
      return;
    }
    var helper = document.createElement('div');
    helper.dataset.eapHelperFor = field.id || '';
    helper.className = 'eap-ladder-field-help';
    helper.textContent = text;
    field.insertAdjacentElement('beforebegin', helper);
  }

  function insertCss() {
    if (document.getElementById('eap-learning-ladder-style')) return;
    var style = document.createElement('style');
    style.id = 'eap-learning-ladder-style';
    style.textContent = [
      '.eap-ladder{margin:14px 0 18px;padding:16px;border:2px solid #86d9e8;border-radius:16px;background:linear-gradient(135deg,#eefcff,#f8fbff);color:#102033}',
      '.eap-ladder-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;flex-wrap:wrap}',
      '.eap-ladder h3{margin:0;font-size:17px}.eap-ladder p{margin:7px 0;color:#40556d;line-height:1.5}',
      '.eap-ladder-level{display:inline-block;padding:5px 9px;border-radius:999px;background:#dff7ed;color:#087f5b;font-size:12px;font-weight:900}',
      '.eap-ladder-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px;margin-top:12px}',
      '.eap-ladder-step{padding:10px;border-radius:12px;background:#fff;border:1px solid #d7e7ef}',
      '.eap-ladder-step b{display:block;font-size:13px;margin-bottom:4px}',
      '.eap-ladder-chip{display:block;width:100%;margin:7px 0 0;border:1px solid #94cbe0;border-radius:9px;padding:8px 9px;background:#fff;color:#17375e;text-align:left;font:700 13px system-ui,-apple-system,sans-serif;cursor:pointer}',
      '.eap-ladder-chip:hover{background:#e9f9ff}',
      '.eap-ladder-foot{margin-top:10px;padding:9px 10px;border-radius:10px;background:#fff6d7;color:#735400;font-size:12px;font-weight:700}',
      '.eap-ladder-field-help{margin:9px 0 5px;padding:8px 10px;border-left:4px solid #74d4e8;background:#effbfe;color:#315368;font-size:13px;font-weight:700;border-radius:7px}',
      '.eap-ladder-challenge{margin-top:10px;border:1px dashed #7a73cf;border-radius:10px;padding:8px 10px;color:#4c3f98;font-size:12px}',
      '@media(max-width:760px){.eap-ladder-grid{grid-template-columns:1fr}}'
    ].join('');
    document.head.appendChild(style);
  }

  function makeCard(session, skill, source, fields) {
    var old = document.getElementById('eap-learning-ladder-card');
    if (old) old.remove();
    var plan = PLAN[session] || { theme: 'Academic English practice', focus: 'one source-based action', core: [] };
    var frames = frameSet(skill, source, session);
    var card = document.createElement('section');
    card.id = 'eap-learning-ladder-card';
    card.className = 'eap-ladder';
    card.innerHTML = '' +
      '<div class="eap-ladder-head">' +
        '<div><h3>🪜 Easy Path · ' + esc(skill || 'Academic English') + '</h3>' +
        '<p><b>Session ' + esc(session || '') + ':</b> ' + esc(plan.theme) + ' · วันนี้ทำทีละขั้น: ' + esc(plan.focus) + '</p></div>' +
        '<span class="eap-ladder-level">A2 Foundation → A2+ Bridge</span>' +
      '</div>' +
      '<div class="eap-ladder-grid">' +
        '<div class="eap-ladder-step"><b>1. Choose one clue</b><span>แตะตัวอย่างจาก source ก่อน แล้วแก้ไขได้</span><button class="eap-ladder-chip" data-slot="0">' + esc(frames[0]) + '</button></div>' +
        '<div class="eap-ladder-step"><b>2. Use a short frame</b><span>ตอบด้วย 1 ประโยคสั้น ๆ ไม่ต้องเขียนยาว</span><button class="eap-ladder-chip" data-slot="1">' + esc(frames[1]) + '</button></div>' +
        '<div class="eap-ladder-step"><b>3. Build one simple use</b><span>ใช้ประโยคต้นแบบ แล้วเปลี่ยนคำสำคัญได้</span><button class="eap-ladder-chip" data-slot="2">' + esc(frames[2]) + '</button></div>' +
      '</div>' +
      '<div class="eap-ladder-challenge"><b>B1+ Challenge (เลือกทำได้):</b> เพิ่มคำว่า because / however / therefore หรืออธิบายเหตุผลของคุณอีก 1 ประโยค</div>' +
      '<div class="eap-ladder-foot">✓ งานระดับ Foundation ต้องใช้ source clue + short frame เท่านั้น · ไม่ต้องพิมพ์คำตอบอิสระยาว ๆ เพื่อผ่านด่าน</div>';

    card.querySelectorAll('.eap-ladder-chip').forEach(function (button) {
      button.addEventListener('click', function () {
        var slot = Number(button.dataset.slot || 0);
        fillField(fields[slot] || fields[fields.length - 1], frames[slot]);
      });
    });

    var anchor = fields[0] && fields[0].closest('.panel,section,div');
    if (anchor) anchor.insertAdjacentElement('beforebegin', card);
    else {
      var app = document.getElementById('app');
      if (app) app.insertAdjacentElement('afterbegin', card);
    }
  }

  function helperLines(skill) {
    if (skill === 'Writing') return [
      'Step 1: เลือก topic sentence สั้น ๆ จากตัวช่วยด้านบน',
      'Step 2: เพิ่ม 1 support detail จาก source',
      'Step 3: ปิดด้วยประโยคสั้น ๆ เช่น This can help me study.'
    ];
    if (skill === 'Speaking') return [
      'Step 1: บอกหัวข้อด้วย Today I will talk about …',
      'Step 2: บอก 1 detail จาก source',
      'Step 3: ปิดด้วย This is useful for my study.'
    ];
    if (skill === 'Listening') return [
      'Step 1: ฟัง 2 รอบและจับคำสำคัญ 1 คำ',
      'Step 2: ใช้ frame It means …',
      'Step 3: บอก key message สั้น ๆ'
    ];
    return [
      'Step 1: เลือกคำหรือวลีจาก source',
      'Step 2: ใช้ frame It means …',
      'Step 3: ใช้ frame In this source, … is important.'
    ];
  }

  function apply() {
    insertCss();
    if (isBossPage()) return;
    var session = activeSession();
    var skill = activeSkill();
    var fields = findFields();
    if (!session || !skill || fields.length < 2) return;
    var source = activeSource(session);
    makeCard(session, skill, source, fields);
    var lines = helperLines(skill);
    fields.slice(0, 3).forEach(function (field, index) {
      setHelperText(field, lines[index] || lines[lines.length - 1]);
    });
  }

  var pending;
  function schedule() {
    clearTimeout(pending);
    pending = setTimeout(apply, 90);
  }

  window.EAPLearningLadderV1 = { apply: apply, plan: PLAN };
  window.addEventListener('load', schedule);
  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
})();
