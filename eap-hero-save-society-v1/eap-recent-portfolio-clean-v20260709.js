/* =========================================================
   EAP Hero Recent Portfolio Clean v20260709
   V5 STUDENT RECENT ONLY + HIDE TIME COLUMN
   - Student-facing table hides display/restore time to avoid confusion.
   - Keeps Session / Skill / Score / Output visible.
   - Teacher Dashboard / Sheet remain the source of truth for exact timestamp.
   - UI-only. Does not delete localStorage, does not change Sheet rows,
     scores, pass/fail, evidence, teacher review, or unlock rules.
========================================================= */
(function(){
  'use strict';

  var VERSION = 'v20260710-EAP-RECENT-PORTFOLIO-CLEAN-V5-HIDE-STUDENT-TIME';
  var STYLE_ID = 'eap-recent-portfolio-clean-style-v5';
  var timer = null;

  function text(value){
    return String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
  }

  function num(value){
    var n = Number(text(value).replace(/[^0-9.-]/g, ''));
    return Number.isFinite(n) ? n : 0;
  }

  function addStyle(){
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = [
      'tr[data-eap-portfolio-hidden="1"]{display:none!important}',
      '.eap-portfolio-clean-note{display:inline-flex;margin-left:10px;padding:4px 8px;border-radius:999px;background:#dcfce7;color:#047857;font:800 11px Arial,"Noto Sans Thai",sans-serif;vertical-align:middle}',
      '.eap-portfolio-student-note{display:block;margin:7px 0 4px;color:#cbd5e1;font:800 12px Arial,"Noto Sans Thai",sans-serif;line-height:1.35}',
      '.eap-portfolio-student-note b{color:#a7f3d0}',
      'table[data-eap-student-portfolio="1"] th[data-eap-time-col="1"], table[data-eap-student-portfolio="1"] td[data-eap-time-col="1"]{display:none!important}',
      '@media(max-width:760px){.eap-portfolio-clean-note{margin-left:0;margin-top:6px}.eap-portfolio-student-note{font-size:11px}}'
    ].join('\n');
    document.head.appendChild(style);
  }

  function isLegacy(rowText){
    var t = text(rowText).toLowerCase();
    return /completed legacy evidence retained after browser-storage migration|legacy evidence retained|browser-storage migration|sundefined|snull|snan/.test(t);
  }

  function isRestoreConfirmation(rowText){
    var t = text(rowText).toLowerCase();
    return /ความคืบหน้าที่ยืนยันแล้วจาก\s*cloud\/sheet|confirmed from cloud\/sheet|cloud\/sheet confirmed|restored from sheet|resumeSource|server_sessionprogress/.test(t);
  }

  function isSystemOutputOnly(rowText){
    var t = text(rowText).toLowerCase();
    return /^(auto_evidence_review_optional|teacher_can_review_optional|auto_review_optional)$/i.test(text(rowText)) || /\b(auto_evidence_review_optional|teacher_can_review_optional)\b/.test(t);
  }

  function isSkill(value){
    return /^(reading|writing|listening|speaking)$/i.test(text(value));
  }

  function normalizeSession(value){
    var raw = text(value).toUpperCase();
    if (/^S\d{1,2}$/.test(raw)) return raw;
    if (/^\d{1,2}$/.test(raw)) return 'S' + Number(raw);
    if (/^B\d$/.test(raw)) return raw;
    return '';
  }

  function looksLikePortfolioTable(table){
    var all = text(table.innerText).toLowerCase();
    return /วันที่\/เวลา|recent portfolio|session/.test(all) && /skill/.test(all) && /score/.test(all);
  }

  function parseRow(row){
    var cells = Array.prototype.slice.call(row.querySelectorAll('td')).map(function(td){ return text(td.textContent); });
    var body = text(row.textContent);
    var session = '';
    var skill = '';
    var score = 0;
    var output = cells.length ? cells[cells.length - 1] : '';

    cells.forEach(function(c){
      if (!session) session = normalizeSession(c);
      if (!skill && isSkill(c)) skill = c.charAt(0).toUpperCase() + c.slice(1).toLowerCase();
    });

    var skillIndex = cells.findIndex(isSkill);
    if (skillIndex >= 0 && cells[skillIndex + 1] != null) score = num(cells[skillIndex + 1]);
    if (!score) {
      for (var i = 0; i < cells.length; i += 1) {
        var n = num(cells[i]);
        if (n > 0 && n <= 100) { score = n; break; }
      }
    }

    return { cells: cells, body: body, session: session, skill: skill, score: score, output: output };
  }

  function hide(row){
    row.dataset.eapPortfolioHidden = '1';
    row.setAttribute('aria-hidden', 'true');
  }

  function show(row){
    row.removeAttribute('data-eap-portfolio-hidden');
    row.removeAttribute('aria-hidden');
  }

  function markAndHideTimeColumn(table){
    table.dataset.eapStudentPortfolio = '1';
    var rows = Array.prototype.slice.call(table.querySelectorAll('tr'));
    rows.forEach(function(row){
      var cells = Array.prototype.slice.call(row.children);
      if (cells[0]) {
        cells[0].dataset.eapTimeCol = '1';
        cells[0].setAttribute('aria-hidden', 'true');
      }
    });
  }

  function cleanTable(table){
    if (!looksLikePortfolioTable(table)) return;

    markAndHideTimeColumn(table);

    var rows = Array.prototype.slice.call(table.querySelectorAll('tbody tr'));
    var buckets = {};

    rows.forEach(function(row){
      show(row);
      var parsed = parseRow(row);

      if (!parsed.body || isLegacy(parsed.body) || isRestoreConfirmation(parsed.body) || isSystemOutputOnly(parsed.output)) {
        hide(row);
        return;
      }

      if (!parsed.session || !parsed.skill) return;

      var key = parsed.session + '|' + parsed.skill.toLowerCase();
      if (!buckets[key]) buckets[key] = [];
      buckets[key].push({ row: row, score: parsed.score, length: parsed.output.length || parsed.body.length });
    });

    Object.keys(buckets).forEach(function(key){
      var list = buckets[key];
      list.sort(function(a, b){ return (b.score - a.score) || (b.length - a.length); });
      list.forEach(function(item, index){
        if (index > 0 && item.score < list[0].score) hide(item.row);
      });
    });

    addNote(table);
    addStudentNote(table);
  }

  function findTitle(table){
    var title = null;
    var node = table;
    for (var i = 0; i < 5 && node; i += 1) {
      var prev = node.previousElementSibling;
      while (prev) {
        if (/recent portfolio/i.test(text(prev.textContent))) { title = prev; break; }
        prev = prev.previousElementSibling;
      }
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
    note.textContent = 'หลักฐานล่าสุดของผู้เรียน';
    title.appendChild(note);
  }

  function addStudentNote(table){
    var title = findTitle(table);
    if (!title || title.parentElement.querySelector('.eap-portfolio-student-note')) return;
    var note = document.createElement('div');
    note.className = 'eap-portfolio-student-note';
    note.innerHTML = '<b>สำหรับผู้เรียน:</b> ตารางนี้แสดง Session, Skill, Score และคำตอบล่าสุด/ดีที่สุดเท่านั้น เวลาเล่นจริงให้ครูดูจาก Teacher Dashboard';
    title.insertAdjacentElement('afterend', note);
  }

  function run(){
    addStyle();
    Array.prototype.slice.call(document.querySelectorAll('#app table')).forEach(cleanTable);
  }

  function schedule(){
    clearTimeout(timer);
    timer = setTimeout(run, 80);
  }

  window.EAPRecentPortfolioClean = { version: VERSION, run: run };
  window.addEventListener('load', schedule);
  window.addEventListener('storage', schedule);
  window.addEventListener('eap:resume-synced', schedule);
  window.addEventListener('eap:profile-saved', schedule);
  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  schedule();
})();
