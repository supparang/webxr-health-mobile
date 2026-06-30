/* EAP Hero sheet bridge v123
   ส่งเฉพาะผลใหม่หลังหน้าเกมเปิดแล้ว
   มีปุ่ม “ส่งผลล่าสุดเข้า Sheet” สำหรับตรวจสอบการส่งแบบชัดเจน
*/
(function () {
  'use strict';

  const WEB_APP_URL =
    'https://script.google.com/macros/s/AKfycbwxHHHw6Pk4rMdDnTM_6jxcL2GYdABc0hHFOlc8r_NS4D-siLYv0P-OZg3cfINE9A8X5A/exec';

  const SECTION = '122';
  const SUBMISSION_KIND = 'fresh_evidence_v118';

  const STATE_KEY = 'EAP_HERO_PROGRESS_V3';
  const SENT_KEY = 'EAP_HERO_SHEET_SENT_V123';

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
    const n = Number(value);
    return Number.isFinite(n)
      ? n
      : (fallback === undefined ? 0 : fallback);
  }

  function getProfile(state) {
    const profile =
      (state && (state.profile || state.player)) || {};

    return {
      studentId: text(
        profile.studentId ||
        profile.id ||
        (state && state.studentId) ||
        'guest'
      ),

      studentName: text(
        profile.studentName ||
        profile.name ||
        (state && state.studentName) ||
        'Guest'
      ),

      section: text(
        profile.section ||
        (state && state.section) ||
        SECTION
      )
    };
  }

  function entryStamp(entry, index) {
    return text(
      entry.latestAt ||
      entry.at ||
      entry.evidenceId ||
      index
    );
  }

  function entrySignature(entry, index) {
    return [
      text(entry.session || entry.sessionId),
      text(entry.skill).toLowerCase(),
      entryStamp(entry, index),
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

    for (const value of candidates) {
      const n = Number(value);

      if (Number.isFinite(n)) {
        return Math.max(0, Math.min(100, n));
      }
    }

    return '';
  }

  function getPortfolioItems(state) {
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
        return Boolean(
          text(item.entry.session || item.entry.sessionId) &&
          text(item.entry.skill)
        );
      });
  }

  function isLegacy(entry) {
    return (
      entry.legacyCompletion === true ||
      text(entry.legacyCompletion).toLowerCase() === 'true'
    );
  }

  function payloadFor(item, state) {
    const entry = item.entry;
    const profile = getProfile(state);

    const sessionId = text(
      entry.session || entry.sessionId
    );

    const skill = text(entry.skill);

    const score = num(
      entry.latestScore !== undefined
        ? entry.latestScore
        : entry.score,
      0
    );

    const stamp = entryStamp(entry, item.index);

    return {
      action: 'submit_attempt',

      /* สำคัญ: ต้องตรงกับ EAPHero.gs v118 */
      submissionKind: SUBMISSION_KIND,

      attemptId:
        'eap-v123-' +
        profile.studentId +
        '-' +
        sessionId +
        '-' +
        skill.toLowerCase() +
        '-' +
        encodeURIComponent(stamp),

      studentId: profile.studentId,
      studentName: profile.studentName,
      section: profile.section,

      sessionId: sessionId,
      sessionTitle: text(entry.sessionTitle),

      skill: skill,
      score: score,
      accuracy: getAccuracy(entry),

      passMark: 60,
      passed: score >= 60,

      /* ไม่ส่ง legacy เข้า Sheet */
      legacyCompletion: false,

      hintUsed: num(
        entry.aiUses || entry.hintUsed,
        0
      ),

      replay: entry.replay === true,

      clientTimestamp: stamp,
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
      'width=620,height=460'
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
    form.remove();
  }

  function latestFreshResult() {
    const state = read(STATE_KEY, null);

    const list = getPortfolioItems(state).filter(function (item) {
      return !isLegacy(item.entry);
    });

    if (!list.length) {
      return null;
    }

    return {
      state: state,
      item: list[list.length - 1]
    };
  }

  function setBaseline() {
    const state = read(STATE_KEY, null);

    getPortfolioItems(state).forEach(function (item) {
      known[
        entrySignature(item.entry, item.index)
      ] = true;
    });

    baselineReady = true;
  }

  function sync() {
    if (!baselineReady) {
      setBaseline();
      return;
    }

    const state = read(STATE_KEY, null);
    const sent = read(SENT_KEY, {});

    getPortfolioItems(state).forEach(function (item) {
      const entry = item.entry;

      const signature = entrySignature(
        entry,
        item.index
      );

      if (known[signature]) {
        return;
      }

      known[signature] = true;

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
    if (
      document.getElementById(
        'eap-sheet-manual-send'
      )
    ) {
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

    button.onclick = function () {
      const latest = latestFreshResult();

      if (!latest) {
        alert('ยังไม่พบผลกิจกรรมใหม่สำหรับส่ง');
        return;
      }

      postVisible(
        payloadFor(
          latest.item,
          latest.state
        )
      );
    };

    document.body.appendChild(button);
  }

  window.EAPSheetSyncV123 = {
    sync: sync,

    sendLatest: function () {
      const latest = latestFreshResult();

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

  setBaseline();

  setInterval(sync, 700);

  setTimeout(addManualButton, 1200);
})();
