/* =========================================================
   EAP Hero Recent Portfolio Clean v20260709
   V9 STUDENT-FRIENDLY WORDING
   - Hides confusing time column for students.
   - Keeps one best row per Session + Skill.
   - Never shows system/legacy/cloud messages to students.
   - Output becomes real student text when available; otherwise 'ทำภารกิจสำเร็จแล้ว'.
   - Teacher Dashboard / Sheet remain the source of truth for exact timestamp and full evidence.
   - UI-only. Does not delete localStorage, does not change Sheet rows,
     scores, pass/fail, evidence, teacher review, or unlock rules.
========================================================= */
(function(){
  'use strict';

  var VERSION = 'v20260710-EAP-RECENT-PORTFOLIO-CLEAN-V9-STUDENT-FRIENDLY';
  var STYLE_ID = 'eap-recent-portfolio-clean-style-v9';
  var STATE_KEY = 'EAP_HERO_PROGRESS_V3';
  var timer = null;

  function text(value){ return String(value == null ? '' : value).replace(/\s+/g, ' ').trim(); }
  function num(value){ var n = Number(text(value).replace(/[^0-9.-]/g, '')); return Number.isFinite(n) ? n : 0; }

  function removeOldStyles(){
    Array.prototype.slice.call(document.querySelectorAll('style[id^="eap-recent-portfolio-clean-style-"]')).forEach(function(style){
      if (style.id !== STYLE_ID && style.parentNode) style.parentNode.removeChild(style);
    });
  }

  function addStyle(){
    removeOldStyles();
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = [
      'tr[data-eap-portfolio-hidden="1"]{display:none!important}',
      '.eap-portfolio-clean-note{display:inline-flex;margin-left:10px;padding:4px 8px;border-radius:999px;background:#dcfce7;color:#047857;font:800 11px Arial,"Noto Sans Thai",sans-serif;vertical-align:middle}',
      '.eap-portfolio-student-note{display:block;margin:7px 0 4px;color:#cbd5e1;font:800 12px Arial,"Noto Sans Thai",sans-serif;line-height:1.35}',
      '.eap-portfolio-student-note b{color:#a7f3d0}',
      'table[data-eap-student-portfolio="1"] th[data-eap-time-col="1"], table[data-eap-student-portfolio="1"] td[data-eap-time-col="1"]{display:none!important}',
      'table[data-eap-student-portfolio="1"] td[data-eap-output-restored="1"]{color:#dbeafe;max-width:520px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '@media(max-width:760px){.eap-portfolio-clean-note{margin-left:0;margin-top:6px}.eap-portfolio-student-note{font-size:11px}}'
    ].join('\n');
    document.head.appendChild(style);
  }

  function readState(){ try { return JSON.parse(localStorage.getItem(STATE_KEY) || '{}') || {}; } catch(error) { return {}; } }

  function normalizeSkill(value){
    var raw = text(value).toLowerCase();
    if (/reading/.test(raw)) return 'Reading';
    if (/writing/.test(raw)) return 'Writing';
    if (/listening/.test(raw)) return 'Listening';
    if (/speaking/.test(raw)) return 'Speaking';
    return '';
  }

  function normalizeSession(value){
    var raw = text(value).toUpperCase();
    if (/^S\d{1,2}$/.test(raw)) return raw;
    if (/^B\d$/.test(raw)) return raw;
    if (/^\d{1,2}$/.test(raw)) return 'S' + Number(raw);
    var m = raw.match(/(?:^|\b)S(?:ESSION)?\s*0?(1[0-5]|[1-9])(?:\b|_)/i);
    return m ? 'S' + Number(m[1]) : '';
  }

  function isSystemText(value){
    var t = text(value).toLowerCase();
    if (!t) return true;
    return /completed legacy evidence retained|browser-storage migration|ความคืบหน้าที่ยืนยันแล้วจาก\s*cloud\/sheet|cloud\/sheet|auto_evidence_review_optional|teacher_can_review_optional|auto_review_optional|confirmed from cloud|restored from sheet|server_sessionprogress|legacy evidence/i.test(t);
  }

  function evidenceOutput(entry){
    var candidates = [
      entry && entry.output,
      entry && entry.studentOutput,
      entry && entry.answer,
      entry && entry.response,
      entry && entry.text,
      entry && entry.note,
      entry && entry.reflection,
      entry && entry.summary,
      entry && entry.writing,
      entry && entry.speakingNote
    ];
    for (var i = 0; i < candidates.length; i += 1) {
      var v = text(candidates[i]);
      if (v && !isSystemText(v)) return v;
    }
    return '';
  }

  function portfolioLookup(){
    var s = readState();
    var portfolio = Array.isArray(s.portfolio) ? s.portfolio : [];
    var lookup = {};
    portfolio.forEach(function(entry){
      var session = normalizeSession(entry && (entry.session || entry.sessionId || entry.routeId || entry.sessionCode || entry.taskId));
      var skill = normalizeSkill(entry && (entry.skill || entry.skillName || entry.evidenceType || entry.taskId || entry.type));
      var score = num(entry && (entry.score ?? entry.latestScore ?? entry.bestScore ?? entry.autoScore ?? entry.missionTaskScore));
      var out = evidenceOutput(entry);
      if (!session || !skill || !out) return;
      var key = session + '|' + skill.toLowerCase();
      var old = lookup[key];
      if (!old || score > old.score || (score === old.score && out.length > old.output.length)) lookup[key] = { output: out, score: score };
    });
    return lookup;
  }

  function looksLikePortfolioTable(table){
    var all = text(table.innerText).toLowerCase();
    return /recent portfolio|session/.test(all) && /skill/.test(all) && /score/.test(all);
  }

  function resetHidden(table){
    Array.prototype.slice.call(table.querySelectorAll('tr,td,th')).forEach(function(el){
      el.removeAttribute('data-eap-portfolio-hidden');
      el.removeAttribute('aria-hidden');
      if (el.style && el.style.display === 'none') el.style.display = '';
    });
  }

  function markAndHideTimeColumn(table){
    table.dataset.eapStudentPortfolio = '1';
    Array.prototype.slice.call(table.querySelectorAll('tr')).forEach(function(row){
      var cells = Array.prototype.slice.call(row.children);
      if (cells[0]) { cells[0].dataset.eapTimeCol = '1'; cells[0].setAttribute('aria-hidden', 'true'); }
    });
  }

  function parseRow(row){
    var cells = Array.prototype.slice.call(row.querySelectorAll('td')).map(function(td){ return text(td.textContent); });
    var session = '', skill = '', score = 0;
    cells.forEach(function(c){ if (!session) session = normalizeSession(c); if (!skill) skill = normalizeSkill(c); });
    var skillIndex = cells.findIndex(function(c){ return !!normalizeSkill(c); });
    if (skillIndex >= 0 && cells[skillIndex + 1] != null) score = num(cells[skillIndex + 1]);
    if (!score) cells.forEach(function(c){ var n = num(c); if (!score && n > 0 && n <= 100) score = n; });
    return { session: session, skill: skill, score: score };
  }

  function shortOutput(value){ var v = text(value); return v.length > 120 ? v.slice(0, 117) + '...' : v; }
  function outputCell(row){ var cells = Array.prototype.slice.call(row.querySelectorAll('td')); return cells.length ? cells[cells.length - 1] : null; }

  function setOutput(row, parsed, lookup){
    var cell = outputCell(row);
    if (!cell || !parsed.session || !parsed.skill) return;
    var current = text(cell.textContent);
    var hit = lookup[parsed.session + '|' + parsed.skill.toLowerCase()];
    var finalText = hit && hit.output ? hit.output : (current && !isSystemText(current) ? current : 'ทำภารกิจสำเร็จแล้ว');
    cell.textContent = shortOutput(finalText);
    cell.title = finalText;
    cell.dataset.eapOutputRestored = '1';
  }

  function dedupeRows(table){
    var rows = Array.prototype.slice.call(table.querySelectorAll('tbody tr'));
    var buckets = {}, lookup = portfolioLookup();
    rows.forEach(function(row){
      var parsed = parseRow(row);
      if (!parsed.session || !parsed.skill) return;
      setOutput(row, parsed, lookup);
      var key = parsed.session + '|' + parsed.skill.toLowerCase();
      if (!buckets[key]) buckets[key] = [];
      buckets[key].push({ row: row, score: parsed.score });
    });
    Object.keys(buckets).forEach(function(key){
      var list = buckets[key];
      list.sort(function(a, b){ return b.score - a.score; });
      list.forEach(function(item, index){
        if (index > 0) { item.row.dataset.eapPortfolioHidden = '1'; item.row.setAttribute('aria-hidden', 'true'); }
      });
    });
  }

  function findTitle(table){
    var title = null, node = table;
    for (var i = 0; i < 5 && node; i += 1) {
      var prev = node.previousElementSibling;
      while (prev) { if (/recent portfolio/i.test(text(prev.textContent))) { title = prev; break; } prev = prev.previousElementSibling; }
      if (title) break;
      node = node.parentElement;
    }
    return title;
  }

  function addNote(table){
    var title = findTitle(table);
    if (!title || title.querySelector('.eap-portfolio-clean-note')) return;
    var note = document.createElement('span');
    note.className = 'eap-portfolio-clean-note';
    note.textContent = 'ภารกิจล่าสุดของผู้เรียน';
    title.appendChild(note);
  }

  function addStudentNote(table){
    var title = findTitle(table);
    if (!title || title.parentElement.querySelector('.eap-portfolio-student-note')) return;
    var note = document.createElement('div');
    note.className = 'eap-portfolio-student-note';
    note.innerHTML = '<b>สำหรับผู้เรียน:</b> ตารางนี้แสดง Session, Skill, Score และสถานะภารกิจล่าสุดเท่านั้น เวลาเล่นจริงให้ครูดูจาก Teacher Dashboard';
    title.insertAdjacentElement('afterend', note);
  }

  function cleanTable(table){
    if (!looksLikePortfolioTable(table)) return;
    resetHidden(table);
    markAndHideTimeColumn(table);
    dedupeRows(table);
    addNote(table);
    addStudentNote(table);
  }

  function run(){ addStyle(); Array.prototype.slice.call(document.querySelectorAll('#app table')).forEach(cleanTable); }
  function schedule(){ clearTimeout(timer); timer = setTimeout(run, 80); }

  window.EAPRecentPortfolioClean = { version: VERSION, run: run };
  window.addEventListener('load', schedule);
  window.addEventListener('storage', schedule);
  window.addEventListener('eap:resume-synced', schedule);
  window.addEventListener('eap:profile-saved', schedule);
  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  schedule();
})();
