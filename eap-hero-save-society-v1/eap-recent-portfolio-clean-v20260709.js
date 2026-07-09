/* =========================================================
   EAP Hero Recent Portfolio Clean v20260709
   V1
   - Cleans the student-facing Recent Portfolio table only.
   - Hides blank/legacy/migration rows and duplicate lower-score rows.
   - Keeps the best visible row per Session + Skill, so learners see useful
     evidence only, not repeated migration noise.
   - UI-only. Does not delete localStorage, does not change Sheet rows,
     scores, pass/fail, evidence, teacher review, or unlock rules.
========================================================= */
(function(){
  'use strict';

  var VERSION = 'v20260709-EAP-RECENT-PORTFOLIO-CLEAN-V1-HIDE-LEGACY-DUPES';
  var STYLE_ID = 'eap-recent-portfolio-clean-style-v1';
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
      '.eap-portfolio-clean-note{display:inline-flex;margin-left:10px;padding:4px 8px;border-radius:999px;background:#dcfce7;color:#047857;font:800 11px Arial,"Noto Sans Thai",sans-serif;vertical-align:middle}'
    ].join('\n');
    document.head.appendChild(style);
  }

  function isLegacy(rowText){
    var t = text(rowText).toLowerCase();
    return /completed legacy evidence retained after browser-storage migration|legacy evidence retained|browser-storage migration|sundefined|snull|snan/.test(t);
  }

  function isSkill(value){
    return /^(reading|writing|listening|speaking)$/i.test(text(value));
  }

  function tableLooksLikePortfolio(table){
    var header = text(table.querySelector('thead') ? table.querySelector('thead').innerText : table.innerText).toLowerCase();
    return /recent portfolio|วันที่\/เวลา|session|skill|score|output/.test(header) && /skill/.test(header) && /score/.test(header);
  }

  function cleanTable(table){
    if (!tableLooksLikePortfolio(table)) return;

    var rows = Array.prototype.slice.call(table.querySelectorAll('tbody tr'));
    var buckets = {};

    rows.forEach(function(row){
      row.removeAttribute('data-eap-portfolio-hidden');
      row.removeAttribute('aria-hidden');
      var cells = Array.prototype.slice.call(row.querySelectorAll('td'));
      if (cells.length < 5) return;

      var session = text(cells[1] && cells[1].textContent).toUpperCase();
      var skill = text(cells[2] && cells[2].textContent);
      var score = num(cells[3] && cells[3].textContent);
      var output = text(cells[4] && cells[4].textContent);
      var rowText = text(row.textContent);

      var bad = false;
      if (!session || !isSkill(skill)) bad = true;
      if (!output) bad = true;
      if (isLegacy(rowText)) bad = true;
      if (score <= 0 && !output) bad = true;
      if (score <= 0 && isLegacy(rowText)) bad = true;

      if (bad) {
        row.dataset.eapPortfolioHidden = '1';
        row.setAttribute('aria-hidden', 'true');
        return;
      }

      var key = session + '|' + skill.toLowerCase();
      if (!buckets[key]) buckets[key] = [];
      buckets[key].push({ row: row, score: score, textLength: output.length });
    });

    Object.keys(buckets).forEach(function(key){
      var list = buckets[key];
      list.sort(function(a, b){
        return (b.score - a.score) || (b.textLength - a.textLength);
      });
      list.forEach(function(item, index){
        if (index > 0) {
          item.row.dataset.eapPortfolioHidden = '1';
          item.row.setAttribute('aria-hidden', 'true');
        }
      });
    });

    addNote(table);
  }

  function addNote(table){
    var title = null;
    var node = table;
    for (var i = 0; i < 5 && node; i += 1) {
      var prev = node.previousElementSibling;
      while (prev) {
        if (/recent portfolio/i.test(text(prev.textContent))) {
          title = prev;
          break;
        }
        prev = prev.previousElementSibling;
      }
      if (title) break;
      node = node.parentElement;
    }
    if (!title || title.querySelector('.eap-portfolio-clean-note')) return;
    var note = document.createElement('span');
    note.className = 'eap-portfolio-clean-note';
    note.textContent = 'แสดงเฉพาะหลักฐานที่ใช้ได้';
    title.appendChild(note);
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