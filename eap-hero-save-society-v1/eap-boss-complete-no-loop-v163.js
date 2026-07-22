/* =========================================================
   EAP Hero • Boss Complete No-Loop v163
   - The adaptive 4-skill Boss run is the real Boss Gate.
   - When the completed-run screen shows "Enter Boss Clash",
     finish the gate instead of starting the same run again.
   - Emits a visible "Boss Defeated!" result so the existing
     Boss Completion Sync writes the official result to Google Sheet.
   - Does not invent or locally advance official cloud progression.
========================================================= */
(function () {
  'use strict';
  if (window.__EAP_BOSS_COMPLETE_NO_LOOP_V163__) return;
  window.__EAP_BOSS_COMPLETE_NO_LOOP_V163__ = true;

  var VERSION = '20260722-EAP-BOSS-COMPLETE-NO-LOOP-V163';
  var NAMES = {
    B1: 'Detail Trap Spider',
    B2: 'Copy-Paste Zombie',
    B3: 'Broken Paragraph Beast',
    B4: 'Plagiarism Monster',
    B5: 'Final Academic Mission'
  };
  var NEXT = { B1: 'S4', B2: 'S7', B3: 'S10', B4: 'S13', B5: 'Complete' };

  function text(value) {
    return String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
  }

  function app() {
    return document.getElementById('app');
  }

  function bodyText() {
    var root = app() || document.body;
    return text(root && root.innerText || '');
  }

  function gateFromPage() {
    var source = bodyText();
    var m = source.match(/Boss Gate\s*([1-5])/i);
    if (m) return 'B' + Number(m[1]);

    try {
      var state = JSON.parse(localStorage.getItem('EAP_HERO_PROGRESS_V3') || '{}') || {};
      var route = text(state.currentCloudRoute || state.currentRoute || '');
      m = route.match(/^B([1-5])$/i);
      if (m) return 'B' + Number(m[1]);
    } catch (_) {}
    return '';
  }

  function isCompletedRunScreen() {
    var source = bodyText();
    var hasComplete = /(?:Fallback|Standard|Single)\s+Run\s+Complete/i.test(source) ||
      /Reading\s*1.*Listening\s*1.*Writing\s*1.*Speaking\s*1/i.test(source);
    var hasEnter = /Enter\s+Boss\s+Clash/i.test(source);
    return hasComplete && hasEnter;
  }

  function isEnterBossButton(node) {
    var button = node && node.closest && node.closest('button,a,[role="button"]');
    if (!button) return null;
    return /Enter\s+Boss\s+Clash/i.test(text(button.textContent || button.innerText || '')) ? button : null;
  }

  function resultHtml(gate) {
    var boss = NAMES[gate] || gate;
    var next = NEXT[gate] || '';
    return '' +
      '<main class="wrap" style="max-width:1100px;margin:auto;padding:20px">' +
        '<section class="panel" style="margin-top:18px;text-align:center;padding:28px">' +
          '<div style="font-size:72px;line-height:1">🏆</div>' +
          '<div class="badges" style="justify-content:center;margin:12px 0">' +
            '<span class="pill">' + gate + ' Boss Gate</span>' +
            '<span class="pill">Official completion pending Sheet sync</span>' +
          '</div>' +
          '<h1 style="margin:8px 0">Boss Defeated!</h1>' +
          '<h3>' + boss + '</h3>' +
          '<p class="lead">คุณทำ Reading, Listening, Writing และ Speaking ครบแล้ว จึงไม่ต้องเริ่ม Boss รอบเดิมซ้ำ</p>' +
          '<div class="grid four" style="margin:18px 0">' +
            '<div class="stat"><b>Reading</b><span>✓ Complete</span></div>' +
            '<div class="stat"><b>Listening</b><span>✓ Complete</span></div>' +
            '<div class="stat"><b>Writing</b><span>✓ Complete</span></div>' +
            '<div class="stat"><b>Speaking</b><span>✓ Complete</span></div>' +
          '</div>' +
          '<div class="panel light" style="margin:16px 0">' +
            '<b>กำลังบันทึกผล Boss Gate ลง Google Sheet</b>' +
            '<p class="mini-note">ระบบจะตรวจ Resume จาก Sheet แล้วจึงเปิดด่านถัดไป</p>' +
          '</div>' +
          '<div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">' +
            '<button type="button" class="btn primary" id="eap163Map">กลับแผนที่</button>' +
            '<button type="button" class="btn ghost" id="eap163Report">My Learning Report</button>' +
          '</div>' +
          (next && next !== 'Complete' ? '<p class="mini-note" style="margin-top:14px">เมื่อ Sheet ยืนยันแล้ว ด่านถัดไปคือ ' + next + '</p>' : '') +
        '</section>' +
      '</main>';
  }

  function finishBoss(event) {
    var gate = gateFromPage();
    if (!gate) return false;

    if (event) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    }

    var lockKey = 'EAP_BOSS_FINISHING_' + gate;
    if (sessionStorage.getItem(lockKey) === '1') return true;
    sessionStorage.setItem(lockKey, '1');

    var root = app();
    if (!root) return false;
    root.innerHTML = resultHtml(gate);
    document.documentElement.dataset.eapBossNoLoopVersion = VERSION;

    var map = document.getElementById('eap163Map');
    if (map) map.onclick = function () {
      sessionStorage.removeItem(lockKey);
      if (window.EAPHero && typeof window.EAPHero.home === 'function') window.EAPHero.home();
      else location.reload();
    };

    var report = document.getElementById('eap163Report');
    if (report) report.onclick = function () {
      if (window.EAPHero && typeof window.EAPHero.report === 'function') window.EAPHero.report();
    };

    setTimeout(function () {
      window.dispatchEvent(new CustomEvent('eap:boss-defeated-visible', {
        detail: { gate: gate, version: VERSION, source: 'completed_adaptive_run' }
      }));
    }, 50);

    return true;
  }

  document.addEventListener('click', function (event) {
    var button = isEnterBossButton(event.target);
    if (!button || !isCompletedRunScreen()) return;
    finishBoss(event);
  }, true);

  function normalizeButton() {
    if (!isCompletedRunScreen()) return;
    var buttons = document.querySelectorAll('button,a,[role="button"]');
    for (var i = 0; i < buttons.length; i++) {
      if (/Enter\s+Boss\s+Clash/i.test(text(buttons[i].textContent || ''))) {
        buttons[i].textContent = 'Finish Boss Gate';
        buttons[i].dataset.eapBossFinishV163 = 'true';
      }
    }
  }

  var timer = 0;
  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(normalizeButton, 50);
  }

  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  window.addEventListener('load', schedule);
  schedule();

  window.EAPBossCompleteNoLoop = {
    version: VERSION,
    finish: finishBoss,
    isCompletedRunScreen: isCompletedRunScreen
  };
})();
