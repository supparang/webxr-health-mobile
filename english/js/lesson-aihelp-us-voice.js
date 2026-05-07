/* =========================================================
 * /english/js/lesson-aihelp-us-voice.js
 * PATCH v20260506b-STRICT-US-VOICE-DOCTOR
 *
 * เป้าหมาย:
 * ✅ AI Help ใช้เสียง en-US จริงเมื่อ browser/device มีให้
 * ✅ ไม่หลอกว่าเป็น US ถ้าเครื่องไม่มี US voice
 * ✅ แสดงชื่อ voice ที่ใช้จริงบนจอ
 * ✅ มี debug panel: US Voice / Current Voice / Available en-US
 * ✅ กัน fallback ไป UK / AU / IN / Samsung English โดยไม่รู้ตัว
 *
 * ใช้:
 * window.speakAIHelpUS("Great job. Speak clearly and slowly.");
 * window.LessonUSVoice.debug();
 * ========================================================= */

(function () {
  'use strict';

  const PATCH_ID = 'lesson-aihelp-us-voice-strict-v20260506b';

  let cachedVoice = null;
  let lastVoiceName = '';
  let lastVoiceLang = '';
  let voiceLoadTimer = null;

  const BAD_ACCENT_PATTERNS = [
    /en-gb/i,
    /en-au/i,
    /en-in/i,
    /en-ie/i,
    /en-za/i,
    /united kingdom/i,
    /british/i,
    /australia/i,
    /australian/i,
    /india/i,
    /indian/i
  ];

  const BEST_US_PATTERNS = [
    /google us english/i,
    /microsoft aria.*english.*united states/i,
    /microsoft jenny.*english.*united states/i,
    /microsoft guy.*english.*united states/i,
    /microsoft ava.*english.*united states/i,
    /microsoft andrew.*english.*united states/i,
    /samantha/i,
    /alex/i,
    /english.*united states/i,
    /\bus english\b/i,
    /\bus\b/i
  ];

  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, function (m) {
      return {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      }[m];
    });
  }

  function getVoices() {
    try {
      if (!window.speechSynthesis) return [];
      return window.speechSynthesis.getVoices() || [];
    } catch (e) {
      return [];
    }
  }

  function isBadAccent(v) {
    const s = `${v.name || ''} ${v.lang || ''}`;
    return BAD_ACCENT_PATTERNS.some(rx => rx.test(s));
  }

  function isStrictUS(v) {
    const lang = String(v.lang || '').toLowerCase();
    if (!lang.startsWith('en-us')) return false;
    if (isBadAccent(v)) return false;
    return true;
  }

  function scoreUSVoice(v) {
    if (!isStrictUS(v)) return -9999;

    const name = String(v.name || '');
    const lang = String(v.lang || '').toLowerCase();

    let score = 1000;

    if (lang === 'en-us') score += 200;
    if (/google us english/i.test(name)) score += 500;
    if (/microsoft/i.test(name) && /united states/i.test(name)) score += 450;
    if (/online.*natural/i.test(name)) score += 180;
    if (/aria/i.test(name)) score += 120;
    if (/jenny/i.test(name)) score += 110;
    if (/guy/i.test(name)) score += 90;
    if (/samantha/i.test(name)) score += 250;
    if (/alex/i.test(name)) score += 180;
    if (/united states/i.test(name)) score += 180;
    if (/\bus\b/i.test(name)) score += 120;

    BEST_US_PATTERNS.forEach((rx, i) => {
      if (rx.test(name)) score += (BEST_US_PATTERNS.length - i) * 10;
    });

    return score;
  }

  function pickStrictUSVoice() {
    const voices = getVoices();

    const usVoices = voices
      .filter(isStrictUS)
      .map(v => ({
        voice: v,
        score: scoreUSVoice(v)
      }))
      .sort((a, b) => b.score - a.score);

    cachedVoice = usVoices.length ? usVoices[0].voice : null;
    return cachedVoice;
  }

  function normalizeText(text) {
    return String(text || '')
      .replace(/[🎯🏠▶️📊🎤📖👾🎧🏆⭐🔥⚡💡✅❌]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function toast(msg, type) {
    let box = document.getElementById('lessonUsVoiceToast');
    if (!box) {
      box = document.createElement('div');
      box.id = 'lessonUsVoiceToast';
      box.style.cssText = [
        'position:fixed',
        'left:12px',
        'right:12px',
        'bottom:82px',
        'z-index:999999',
        'padding:12px 14px',
        'border-radius:16px',
        'font:800 13px/1.45 system-ui,-apple-system,Segoe UI,sans-serif',
        'color:#eaffff',
        'background:rgba(8,18,33,.94)',
        'border:1px solid rgba(120,230,255,.38)',
        'box-shadow:0 14px 40px rgba(0,0,0,.35)',
        'display:none',
        'white-space:normal'
      ].join(';');
      document.body.appendChild(box);
    }

    box.innerHTML = msg;
    box.style.display = 'block';
    box.style.borderColor = type === 'warn'
      ? 'rgba(255,210,90,.65)'
      : 'rgba(120,230,255,.55)';

    clearTimeout(box._t);
    box._t = setTimeout(() => {
      box.style.display = 'none';
    }, 5200);
  }

  function renderDoctorPanel() {
    let panel = document.getElementById('lessonUsVoiceDoctor');
    if (!panel) {
      panel = document.createElement('details');
      panel.id = 'lessonUsVoiceDoctor';
      panel.style.cssText = [
        'position:fixed',
        'right:10px',
        'bottom:136px',
        'z-index:999998',
        'max-width:min(420px,calc(100vw - 20px))',
        'background:rgba(6,16,30,.96)',
        'color:#eaffff',
        'border:1px solid rgba(120,230,255,.35)',
        'border-radius:18px',
        'box-shadow:0 14px 44px rgba(0,0,0,.35)',
        'font:700 12px/1.45 system-ui,-apple-system,Segoe UI,sans-serif',
        'overflow:hidden'
      ].join(';');

      panel.innerHTML = `
        <summary style="cursor:pointer;padding:10px 12px;font-weight:900;color:#75eeff;">
          🇺🇸 US Voice Doctor
        </summary>
        <div id="lessonUsVoiceDoctorBody" style="padding:0 12px 12px;"></div>
      `;
      document.body.appendChild(panel);
    }

    const body = document.getElementById('lessonUsVoiceDoctorBody');
    const voices = getVoices();
    const usVoices = voices.filter(isStrictUS);
    const selected = cachedVoice || pickStrictUSVoice();

    body.innerHTML = `
      <div style="margin:8px 0;padding:8px;border-radius:12px;background:rgba(255,255,255,.07);">
        <div><b>Selected:</b> ${selected ? esc(selected.name) : '<span style="color:#ffd166">No strict en-US voice found</span>'}</div>
        <div><b>Lang:</b> ${selected ? esc(selected.lang) : '-'}</div>
        <div><b>Last spoken:</b> ${lastVoiceName ? esc(lastVoiceName) + ' / ' + esc(lastVoiceLang) : '-'}</div>
      </div>

      <div style="margin:8px 0;">
        <b>Available strict en-US voices:</b> ${usVoices.length}
      </div>

      <div style="max-height:150px;overflow:auto;padding-right:4px;">
        ${
          usVoices.length
            ? usVoices.map(v => `
                <div style="padding:6px 0;border-top:1px solid rgba(255,255,255,.08);">
                  🇺🇸 ${esc(v.name)} <span style="opacity:.75">(${esc(v.lang)})</span>
                </div>
              `).join('')
            : `
                <div style="color:#ffd166;padding:8px 0;">
                  เครื่อง/browser นี้ยังไม่ส่ง voice en-US จริงมาให้ Web Speech API
                </div>
              `
        }
      </div>

      <button id="lessonUsVoiceTestBtn" type="button"
        style="margin-top:10px;width:100%;height:38px;border:0;border-radius:999px;background:#65e8ff;color:#06202a;font-weight:1000;">
        Test US Voice
      </button>
    `;

    const testBtn = document.getElementById('lessonUsVoiceTestBtn');
    if (testBtn && !testBtn.dataset.bound) {
      testBtn.dataset.bound = '1';
      testBtn.addEventListener('click', function () {
        speakUS('Hello. This is the American English voice for AI Help.', { debug: true });
      });
    }
  }

  function speakUS(text, options) {
    options = options || {};

    const msg = normalizeText(text);
    if (!msg) return false;

    if (!('speechSynthesis' in window) || !window.SpeechSynthesisUtterance) {
      toast('⚠️ Browser นี้ไม่รองรับ speechSynthesis', 'warn');
      return false;
    }

    const voice = cachedVoice || pickStrictUSVoice();

    if (!voice) {
      renderDoctorPanel();

      toast(
        '⚠️ ยังไม่ได้เสียง US จริงจากเครื่องนี้<br>' +
        'ตอนนี้ browser ไม่มี voice ที่เป็น <b>en-US</b> ให้เลือก จึงอาจออกสำเนียงไม่ใช่ US<br>' +
        'ให้เปิด <b>US Voice Doctor</b> เพื่อดูรายชื่อเสียงที่เครื่องมี',
        'warn'
      );

      // fallback แบบบอกตรง ๆ ว่าไม่ใช่ strict US
      // ถ้าไม่อยากให้พูดเลยเวลาไม่มี US ให้ comment block นี้ออก
      try {
        window.speechSynthesis.cancel();
        const fallback = new SpeechSynthesisUtterance(msg);
        fallback.lang = 'en-US';
        fallback.rate = 0.86;
        fallback.pitch = 1.02;
        fallback.volume = 1;
        fallback.onstart = function () {
          lastVoiceName = 'fallback browser voice';
          lastVoiceLang = fallback.lang || 'en-US';
          renderDoctorPanel();
        };
        window.speechSynthesis.speak(fallback);
      } catch (e) {}

      return false;
    }

    try {
      window.speechSynthesis.cancel();
    } catch (e) {}

    const u = new SpeechSynthesisUtterance(msg);
    u.voice = voice;
    u.lang = voice.lang || 'en-US';
    u.rate = Number(options.rate || 0.86);
    u.pitch = Number(options.pitch || 1.02);
    u.volume = Number(options.volume || 1);

    u.onstart = function () {
      lastVoiceName = voice.name || '';
      lastVoiceLang = voice.lang || '';
      document.documentElement.classList.add('aihelp-speaking-us');
      renderDoctorPanel();

      toast(
        '🇺🇸 AI Help Voice: <b>' + esc(lastVoiceName) + '</b><br>Lang: <b>' + esc(lastVoiceLang) + '</b>',
        'ok'
      );

      window.dispatchEvent(new CustomEvent('lesson:aihelp-voice-start', {
        detail: {
          voice: lastVoiceName,
          lang: lastVoiceLang,
          strictUS: true
        }
      }));
    };

    u.onend = function () {
      document.documentElement.classList.remove('aihelp-speaking-us');
      window.dispatchEvent(new CustomEvent('lesson:aihelp-voice-end', {
        detail: {
          voice: lastVoiceName,
          lang: lastVoiceLang,
          strictUS: true
        }
      }));
    };

    u.onerror = function () {
      document.documentElement.classList.remove('aihelp-speaking-us');
    };

    window.speechSynthesis.speak(u);
    return true;
  }

  function injectStyle() {
    if (document.getElementById(PATCH_ID + '-style')) return;

    const style = document.createElement('style');
    style.id = PATCH_ID + '-style';
    style.textContent = `
      .aihelp-speaking-us .ai-help-btn,
      .aihelp-speaking-us [data-ai-help],
      .aihelp-speaking-us button[aria-label*="AI"],
      .aihelp-speaking-us button {
        filter: drop-shadow(0 0 10px rgba(105,232,255,.28));
      }
    `;
    document.head.appendChild(style);
  }

  function patchKnownGlobals() {
    window.LessonUSVoice = {
      speak: speakUS,
      pickVoice: pickStrictUSVoice,
      getVoice: function () {
        return cachedVoice || pickStrictUSVoice();
      },
      getAllVoices: getVoices,
      getUSVoices: function () {
        return getVoices().filter(isStrictUS);
      },
      debug: function () {
        pickStrictUSVoice();
        renderDoctorPanel();
        const panel = document.getElementById('lessonUsVoiceDoctor');
        if (panel) panel.open = true;
        return {
          selected: cachedVoice ? {
            name: cachedVoice.name,
            lang: cachedVoice.lang
          } : null,
          usVoices: getVoices().filter(isStrictUS).map(v => ({
            name: v.name,
            lang: v.lang
          })),
          allVoices: getVoices().map(v => ({
            name: v.name,
            lang: v.lang
          }))
        };
      }
    };

    window.speakAIHelpUS = speakUS;

    const possibleNames = [
      'speakAIHelp',
      'speakAiHelp',
      'playAIHelpVoice',
      'playAiHelpVoice',
      'lessonSpeak',
      'speakLessonTip',
      'speakCoach',
      'speakHint'
    ];

    possibleNames.forEach(function (name) {
      const oldFn = window[name];

      if (typeof oldFn === 'function' && !oldFn.__strictUSVoicePatched) {
        const wrapped = function (text) {
          if (typeof text === 'string' && text.trim()) {
            return speakUS(text);
          }
          return oldFn.apply(this, arguments);
        };

        wrapped.__strictUSVoicePatched = true;
        window[name] = wrapped;
      }
    });
  }

  function patchAIHelpButtons() {
    const buttons = Array.from(document.querySelectorAll(
      'button, [role="button"], .ai-help-btn, [data-ai-help], [data-speak]'
    ));

    buttons.forEach(function (btn) {
      if (btn.dataset.strictUsVoiceBound === '1') return;

      const label = String(btn.textContent || btn.getAttribute('aria-label') || '').toLowerCase();
      const isAIHelp =
        btn.hasAttribute('data-ai-help') ||
        btn.hasAttribute('data-speak') ||
        label.includes('ai help') ||
        label.includes('ai guide') ||
        label.includes('ai learning') ||
        label.includes('help');

      if (!isAIHelp) return;

      btn.dataset.strictUsVoiceBound = '1';

      btn.addEventListener('click', function () {
        setTimeout(function () {
          const text =
            btn.getAttribute('data-speak') ||
            btn.getAttribute('data-ai-help') ||
            readVisibleAIHelpText();

          if (text) speakUS(text);
        }, 160);
      }, true);
    });
  }

  function readVisibleAIHelpText() {
    const selectors = [
      '#aiHelpText',
      '#ai-help-text',
      '.ai-help-text',
      '.aiHelpText',
      '[data-ai-help-text]',
      '.coach-text',
      '.ai-coach-text',
      '.hint-text',
      '.help-text',
      '.feedback-text'
    ];

    for (const sel of selectors) {
      const el = document.querySelector(sel);
      const txt = el ? String(el.textContent || '').trim() : '';
      if (txt && txt.length >= 4) return txt;
    }

    return '';
  }

  function loadVoicesAggressively() {
    pickStrictUSVoice();
    renderDoctorPanel();

    if (!window.speechSynthesis) return;

    window.speechSynthesis.onvoiceschanged = function () {
      pickStrictUSVoice();
      renderDoctorPanel();
    };

    clearInterval(voiceLoadTimer);

    let tries = 0;
    voiceLoadTimer = setInterval(function () {
      tries += 1;
      pickStrictUSVoice();
      renderDoctorPanel();

      if (cachedVoice || tries >= 20) {
        clearInterval(voiceLoadTimer);
      }
    }, 250);
  }

  function init() {
    injectStyle();
    patchKnownGlobals();
    loadVoicesAggressively();
    patchAIHelpButtons();

    let tries = 0;
    const timer = setInterval(function () {
      tries += 1;
      patchKnownGlobals();
      pickStrictUSVoice();
      patchAIHelpButtons();

      if (tries >= 20) clearInterval(timer);
    }, 300);

    try {
      const mo = new MutationObserver(function () {
        patchAIHelpButtons();
      });

      mo.observe(document.body, {
        childList: true,
        subtree: true
      });

      setTimeout(function () {
        try { mo.disconnect(); } catch (e) {}
      }, 15000);
    } catch (e) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
