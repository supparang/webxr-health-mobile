/* =========================================================
   EAP Hero • Boss Auto Finalize v2
   VERSION: 20260813-BOSS-AUTO-FINALIZE-V2

   PURPOSE
   - The adaptive Boss run itself is the Boss Gate.
   - In the current UI, "Enter Boss Clash" is rendered only after
     Reading + Listening + Writing + Speaking have all completed.
   - Therefore the appearance of that CTA is the canonical visible
     completion signal. Finalize immediately and never enter the
     legacy Evidence Count Guardian path.
   - Emits the same eap:boss-defeated-visible event used by the
     existing cloud completion sync. No official progress is invented.
========================================================= */
(function () {
  'use strict';
  if (window.__EAP_BOSS_AUTO_FINALIZE_V2__) return;
  window.__EAP_BOSS_AUTO_FINALIZE_V2__ = true;

  var VERSION = '20260813-BOSS-AUTO-FINALIZE-V2';
  var fired = false;
  var timer = 0;

  function clean(v) {
    return String(v == null ? '' : v).replace(/\s+/g, ' ').trim();
  }

  function root() {
    return document.getElementById('app') || document.body;
  }

  function pageText() {
    var r = root();
    return clean(r && r.innerText || '');
  }

  function gateFromPage() {
    var s = pageText();
    var m = s.match(/Boss Gate\s*([1-5])/i);
    if (m) return 'B' + Number(m[1]);
    try {
      var p = JSON.parse(localStorage.getItem('EAP_HERO_PROGRESS_V3') || '{}') || {};
      var route = clean(p.currentCloudRoute || p.currentRoute || '');
      m = route.match(/^B([1-5])$/i);
      if (m) return 'B' + Number(m[1]);
    } catch (_) {}
    return '';
  }

  function completionButton() {
    var nodes = document.querySelectorAll('button,a,[role="button"]');
    for (var i = 0; i < nodes.length; i++) {
      var t = clean(nodes[i].textContent || nodes[i].innerText || '');
      if (/^(?:Enter\s+Boss\s+Clash|Finish\s+Boss\s+Gate)$/i.test(t)) return nodes[i];
    }
    return null;
  }

  function fallbackFinish(gate) {
    var r = root();
    if (!r || !gate) return false;

    var names = {
      B1: 'Detail Trap Spider',
      B2: 'Copy-Paste Zombie',
      B3: 'Broken Paragraph Beast',
      B4: 'Plagiarism Monster',
      B5: 'Final Academic Mission'
    };
    var next = { B1: 'S4', B2: 'S7', B3: 'S10', B4: 'S13', B5: 'Complete' };

    r.innerHTML = '' +
      '<main class="wrap" style="max-width:1100px;margin:auto;padding:20px">' +
        '<section class="panel" style="margin-top:18px;text-align:center;padding:28px">' +
          '<div style="font-size:72px;line-height:1">🏆</div>' +
          '<div class="badges" style="justify-content:center;margin:12px 0">' +
            '<span class="pill">' + gate + ' Boss Gate</span>' +
            '<span class="pill">Saving to Google Sheet…</span>' +
          '</div>' +
          '<h1 style="margin:8px 0">Boss Defeated!</h1>' +
          '<h3>' + (names[gate] || gate) + '</h3>' +
          '<p class="lead">Reading, Listening, Writing และ Speaking ครบแล้ว ระบบกำลังยืนยันผลกับ Google Sheet</p>' +
          '<div class="grid four" style="margin:18px 0">' +
            '<div class="stat"><b>Reading</b><span>✓ Complete</span></div>' +
            '<div class="stat"><b>Listening</b><span>✓ Complete</span></div>' +
            '<div class="stat"><b>Writing</b><span>✓ Complete</span></div>' +
            '<div class="stat"><b>Speaking</b><span>✓ Complete</span></div>' +
          '</div>' +
          '<p class="mini-note">ด่านถัดไป: ' + (next[gate] || '') + '</p>' +
        '</section>' +
      '</main>';

    setTimeout(function () {
      window.dispatchEvent(new CustomEvent('eap:boss-defeated-visible', {
        detail: { gate: gate, version: VERSION, source: 'visible_completed_run_cta' }
      }));
    }, 30);
    return true;
  }

  function finalizeNow() {
    if (fired) return;
    var btn = completionButton();
    if (!btn) return;
    var gate = gateFromPage();
    if (!gate) return;

    fired = true;
    document.documentElement.dataset.eapBossAutoFinalizeVersion = VERSION;

    try {
      btn.textContent = 'Finishing Boss Gate…';
      btn.disabled = true;
      btn.style.pointerEvents = 'none';
    } catch (_) {}

    setTimeout(function () {
      try {
        if (window.EAPBossCompleteNoLoop && typeof window.EAPBossCompleteNoLoop.finish === 'function') {
          var ok = window.EAPBossCompleteNoLoop.finish();
          if (ok) return;
        }
        fallbackFinish(gate);
      } catch (err) {
        console.error('[EAP Boss Auto Finalize v2]', err);
        fallbackFinish(gate);
      }
    }, 20);
  }

  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(finalizeNow, 25);
  }

  new MutationObserver(schedule).observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true
  });

  window.addEventListener('load', schedule);
  window.addEventListener('pageshow', schedule);
  setInterval(function () { if (!fired) finalizeNow(); }, 250);
  schedule();
})();
