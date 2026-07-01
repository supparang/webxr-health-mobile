/* =========================================================
   EAP Hero Sheet Sync v123
   File: eap-sheet-sync-v123.js

   ส่งเฉพาะผลกิจกรรมใหม่จาก portfolio จริง
   - ไม่ backfill ข้อมูลเก่า
   - ไม่ส่ง legacy completion
   - มีปุ่มส่งผลล่าสุดเข้า Sheet สำหรับตรวจสอบ
   - ส่ง submissionKind: fresh_evidence_v118
     ให้ตรงกับ EAPHero.gs v118
========================================================= */

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

  function readJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);

      return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      // Ignore storage failure.
    }
  }

  function text(value) {
    return value === undefined || value === null
      ? ''
      : String(value);
  }

  function number(value, fallback) {
    const parsed = Number(value);

    return Number.isFinite(parsed)
      ? parsed
      : (fallback === undefined ? 0 : fallback);
  }

  function getState() {
    return readJson(STATE_KEY, null);
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

  function getStamp(entry, index) {
    return text(
      entry.latestAt ||
      entry.at ||
      entry.evidenceId ||
      index
    );
  }

  function getSignature(entry, index) {
    return [
      text(entry.session || entry.sessionId),
      text(entry.skill).toLowerCase(),
      getStamp(entry, index),
      text(
        entry.latestScore !== undefined
          ? entry.latestScore
          : entry.score
      )
    ].join('|');
  }

  function getAccuracy(entry) {
    const values = [
      entry.accuracy,
      entry.bestAccuracy,
      entry.accPct,
      entry.accuracyPct
    ];

    for (let i = 0; i < values.length; i++) {
      const value = Number(values[i]);

      if (Number.isFinite(value)) {
        return Math.max(0, Math.min(100, value));
      }
    }

    return '';
  }

  function getItems(state) {
    const portfolio = state && Array.isArray(state.portfolio)
      ? state.portfolio
      : [];

    return portfolio
      .map(function (entry, index) {
        return {
          entry: entry || {},
          index: index
        };
      })
      .filter(function (item) {
        const sessionId = text(
          item.entry.session || item.entry.sessionId
        );

        const skill = text(item.entry.skill);

        return !!sessionId && !!skill;
      });
  }

  function isLegacy(entry) {
    return (
      entry.legacyCompletion === true ||
      text(entry.legacyCompletion).toLowerCase() === 'true'
    );
  }

  function createAttemptId(profile, item) {
    const entry = item.entry;

    const sessionId = text(
      entry.session || entry.sessionId
    );

    const skill = text(entry.skill)
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '');

    const stamp = getStamp(entry, item.index)
      .replace(/[^a-zA-Z0-9_-]/g, '');

    return [
      'eap',
      'v123',
      profile.studentId,
      sessionId,
      skill,
      stamp
    ].join('-');
  }

  function buildPayload(item, state) {
    const entry = item.entry;
    const profile = getProfile(state);

    const sessionId = text(
      entry.session || entry.sessionId
    );

    const score = number(
      entry.latestScore !== undefined
        ? entry.latestScore
        : entry.score,
      0
    );

    return {
      action: 'submit_attempt',

      /* สำคัญ: ต้องตรงกับ EAPHero.gs v118 */
      submissionKind: SUBMISSION_KIND,

      attemptId: createAttemptId(profile, item),

      studentId: profile.studentId,
      studentName: profile.studentName,
      section: profile.section,

      sessionId: sessionId,
      sessionTitle: text(entry.sessionTitle),

      skill: text(entry.skill),

      score: score,
      accuracy: getAccuracy(entry),

      passMark: 60,
      passed: score >= 60,

      legacyCompletion: false,

      hintUsed: number(
        entry.aiUses || entry.hintUsed,
        0
      ),

      replay: entry.replay === true,

      clientTimestamp: getStamp(entry, item.index),
      sourceUrl: location.href
    };
  }

  function transmitAutomatically(payload) {
    const body = JSON.stringify(payload);

    try {
      if (
        navigator.sendBeacon &&
        navigator.sendBeacon(
          WEB_APP_URL,
          new Blob(
            [body],
            { type: 'text/plain;charset=UTF-8' }
          )
        )
      ) {
        return true;
      }
    } catch (error) {
      // Continue to fetch fallback.
    }

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
    } catch (error) {
      return false;
    }
  }

  function postVisible(payload) {
    const popup = window.open(
      '',
      'eap_sheet_result',
      'width=640,height=480'
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
      } catch (error) {
        // Ignore cleanup issue.
      }
    }, 0);
  }

  function getLatestFreshResult() {
    const state = getState();

    const freshItems = getItems(state).filter(function (item) {
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

  function setBaseline() {
    const state = getState();

    getItems(state).forEach(function (item) {
      known[getSignature(item.entry, item.index)] = true;
    });

    baselineReady = true;
  }

  function syncNewEvidence() {
    if (!baselineReady) {
      setBaseline();
      return;
    }

    const state = getState();
    const sent = readJson(SENT_KEY, {});

    getItems(state).forEach(function (item) {
      const entry = item.entry;
      const signature = getSignature(entry, item.index);

      if (known[signature]) {
        return;
      }

      known[signature] = true;

      if (isLegacy(entry)) {
        return;
      }

      const payload = buildPayload(item, state);

      if (sent[payload.attemptId]) {
        return;
      }

      if (transmitAutomatically(payload)) {
        sent[payload.attemptId] = Date.now();
      }
    });

    writeJson(SENT_KEY, sent);
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
      const latest = getLatestFreshResult();

      if (!latest) {
        alert('ยังไม่พบผลกิจกรรมใหม่สำหรับส่ง');
        return;
      }

      const payload = buildPayload(
        latest.item,
        latest.state
      );

      postVisible(payload);
    });

    document.body.appendChild(button);
  }

  window.EAPSheetSyncV123 = {
    sync: syncNewEvidence,

    sendLatest: function () {
      const latest = getLatestFreshResult();

      if (!latest) {
        return false;
      }

      postVisible(
        buildPayload(
          latest.item,
          latest.state
        )
      );

      return true;
    }
  };

  setBaseline();

  setInterval(syncNewEvidence, 700);

  window.addEventListener('load', function () {
    setTimeout(addManualButton, 1200);
  });
})();
