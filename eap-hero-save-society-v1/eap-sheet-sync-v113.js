/* =========================================================
   EAP Hero Sheet Bridge v123
   ส่งเฉพาะผลกิจกรรมใหม่ที่ไม่ใช่ legacy ไปยัง EAP Hero Sheet

   ใช้ร่วมกับ:
   - EAPHero.gs v118
   - submissionKind: fresh_evidence_v118
========================================================= */

(function () {
  'use strict';

  const WEB_APP_URL =
    'https://script.google.com/macros/s/AKfycbwxHHHw6Pk4rMdDnTM_6jxcL2GYdABc0hHFOlc8r_NS4D-siLYv0P-OZg3cfINE9A8X5A/exec';

  const SECTION = '122';

  const STATE_KEY = 'EAP_HERO_PROGRESS_V3';
  const SENT_KEY = 'EAP_HERO_SHEET_SENT_V123';

  const SUBMISSION_KIND = 'fresh_evidence_v118';

  let baselineReady = false;
  let known = {};

  function read(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key) || '');
    } catch (_) {
      return fallback;
    }
  }

  function write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (_) {}
  }

  function text(value) {
    return value === undefined || value === null
      ? ''
      : String(value);
  }

  function num(value, fallback) {
    const number = Number(value);

    return Number.isFinite(number)
      ? number
      : (fallback === undefined ? 0 : fallback);
  }

  function profile(state) {
    const player =
      (state && (state.profile || state.player)) || {};

    return {
      studentId: text(
        player.studentId ||
        player.id ||
        (state && state.studentId) ||
        'guest'
      ),

      studentName: text(
        player.studentName ||
        player.name ||
        (state && state.studentName) ||
        'Guest'
      ),

      section: text(
        player.section ||
        (state && state.section) ||
        SECTION
      )
    };
  }

  function stamp(entry, index) {
    return text(
      entry.latestAt ||
      entry.at ||
      entry.evidenceId ||
      index
    );
  }

  function signature(entry, index) {
    return [
      text(entry.session || entry.sessionId),
      text(entry.skill).toLowerCase(),
      stamp(entry, index),
      text(
        entry.latestScore !== undefined
          ? entry.latestScore
          : entry.score
      )
    ].join('|');
  }

  function getAccuracy(entry) {
    const candidates = [
      entry.accuracy,
      entry.bestAccuracy,
      entry.accPct,
      entry.accuracyPct
    ];

    for (let i = 0; i < candidates.length; i++) {
      const value = Number(candidates[i]);

      if (Number.isFinite(value)) {
        return Math.max(0, Math.min(100, value));
      }
    }

    return '';
  }

  function isLegacy(entry) {
    return (
      entry.legacyCompletion === true ||
      text(entry.legacyCompletion).toLowerCase() === 'true'
    );
  }

  function items(state) {
    if (!state || !Array.isArray(state.portfolio)) {
      return [];
    }

    return state.portfolio
      .map(function (entry, index) {
        return {
          entry: entry || {},
          index: index
        };
      })
      .filter(function (item) {
        const entry = item.entry;

        return (
          text(entry.session || entry.sessionId) &&
          text(entry.skill)
        );
      });
  }

  function payloadFor(item, state) {
    const entry = item.entry;
    const user = profile(state);

    const sessionId = text(
      entry.session || entry.sessionId
    );

    const score = num(
      entry.latestScore !== undefined
        ? entry.latestScore
        : entry.score,
      0
    );

    const cleanStamp = stamp(entry, item.index)
      .replace(/[^A-Za-z0-9_-]/g, '');

    return {
      action: 'submit_attempt',

      // ต้องตรงกับ EAPHero.gs v118
      submissionKind: SUBMISSION_KIND,

      attemptId:
        'eap-v123-' +
        user.studentId + '-' +
        sessionId + '-' +
        text(entry.skill).toLowerCase() + '-' +
        cleanStamp,

      studentId: user.studentId,
      studentName: user.studentName,
      section: user.section,

      sessionId: sessionId,
      sessionTitle: text(entry.sessionTitle),
      skill: text(entry.skill),

      score: score,
      accuracy: getAccuracy(entry),

      passMark: 60,
      passed: score >= 60,

      // ห้ามส่ง legacy เข้า Sheet
      legacyCompletion: false,

      hintUsed: num(
        entry.aiUses || entry.hintUsed,
        0
      ),

      replay: entry.replay === true,

      clientTimestamp: stamp(entry, item.index),
      sourceUrl: location.href
    };
  }

  function autoTransmit(payload) {
    const body = JSON.stringify(payload);

    try {
      if (
        navigator.sendBeacon &&
        navigator.sendBeacon(
          WEB_APP_URL,
          new Blob(
            [body],
            {
              type: 'text/plain;charset=UTF-8'
            }
          )
        )
      ) {
        return true;
      }
    } catch (_) {}

    try {
      fetch(WEB_APP_URL, {
        method: 'POST',
        mode: 'no-cors',
        keepalive: true,

        headers: {
          'Content-Type': 'text/plain;charset=UTF-8'
        },

        body: body
      }).catch(function () {});

      return true;
    } catch (_) {
      return false;
    }
  }

  function postVisible(payload) {
    const popup = window.open(
      '',
      'eap_sheet_result',
      'width=680,height=500'
    );

    if (!popup) {
      alert(
        'เบราว์เซอร์บล็อกหน้าต่างยืนยัน กรุณาอนุญาต pop-up ชั่วคราว'
      );
      return;
    }

    const form = document.createElement('form');

    form.method = 'POST';
    form.action = WEB_APP_URL;
    form.target = 'eap_sheet_result';
    form.style.display = 'none';

    Object.keys(payload).forEach(function (key) {
      const input = document.createElement('input');

      input.type = 'hidden';
      input.name = key;
      input.value = text(payload[key]);

      form.appendChild(input);
    });

    document.body.appendChild(form);

    form.submit();

    setTimeout(function () {
      try {
        form.remove();
      } catch (_) {}
    }, 50);
  }

  function getLatestFreshItem() {
    const state = read(STATE_KEY, null);

    const freshItems = items(state).filter(function (item) {
      return !isLegacy(item.entry);
    });

    if (!freshItems.length) {
      return null;
    }

    return {
      state: state,
      item: freshItems[freshItems.length - 1]
    };
  }

  function createBaseline() {
    const state = read(STATE_KEY, null);

    items(state).forEach(function (item) {
      known[signature(item.entry, item.index)] = true;
    });

    baselineReady = true;
  }

  function sync() {
    if (!baselineReady) {
      createBaseline();
      return;
    }

    const state = read(STATE_KEY, null);
    const sent = read(SENT_KEY, {});

    items(state).forEach(function (item) {
      const entry = item.entry;
      const key = signature(entry, item.index);

      if (known[key]) {
        return;
      }

      known[key] = true;

      if (isLegacy(entry)) {
        return;
      }

      const payload = payloadFor(item, state);

      if (sent[payload.attemptId]) {
        return;
      }

      if (autoTransmit(payload)) {
        sent[payload.attemptId] = Date.now();
      }
    });

    write(SENT_KEY, sent);
  }

  function addManualButton() {
    if (document.getElementById('eap-sheet-manual-send')) {
      return;
    }

    const button = document.createElement('button');

    button.id = 'eap-sheet-manual-send';
    button.type = 'button';
    button.textContent = '📤 ส่งผลล่าสุดเข้า Sheet';

    button.style.cssText = [
      'position:fixed',
      'right:18px',
      'bottom:18px',
      'z-index:99999',
      'border:0',
      'border-radius:999px',
      'padding:12px 16px',
      'background:#17375e',
      'color:#fff',
      'font:700 14px Arial,sans-serif',
      'box-shadow:0 6px 18px rgba(0,0,0,.25)',
      'cursor:pointer'
    ].join(';');

    button.addEventListener('click', function () {
      const latest = getLatestFreshItem();

      if (!latest) {
        alert('ยังไม่พบผลกิจกรรมใหม่สำหรับส่ง');
        return;
      }

      const payload = payloadFor(
        latest.item,
        latest.state
      );

      postVisible(payload);
    });

    document.body.appendChild(button);
  }

  window.EAPSheetSyncV123 = {
    sync: sync,

    sendLatest: function () {
      const latest = getLatestFreshItem();

      if (!latest) {
        return false;
      }

      postVisible(
        payloadFor(
          latest.item,
          latest.state
        )
      );

      return true;
    }
  };

  createBaseline();

  setInterval(sync, 700);

  window.addEventListener('load', function () {
    setTimeout(addManualButton, 1200);
  });
})();
