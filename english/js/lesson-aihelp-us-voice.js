/* =========================================================
 * /english/js/lesson-aihelp-us-voice.js
 * PATCH v20260506-US-VOICE-AIHELP
 *
 * ✅ Force AI Help voice to real US English when available
 * ✅ Prefer Google/Microsoft/Samantha en-US voices
 * ✅ Works on Android / Chrome / Edge / iOS Safari fallback
 * ✅ Exposes:
 *    window.LessonUSVoice.speak(text)
 *    window.speakAIHelpUS(text)
 * ========================================================= */

(function () {
  'use strict';

  const VOICE_PATCH_ID = 'lesson-aihelp-us-voice-v20260506';

  const preferredVoiceNames = [
    'Google US English',
    'Microsoft Aria Online (Natural) - English (United States)',
    'Microsoft Jenny Online (Natural) - English (United States)',
    'Microsoft Guy Online (Natural) - English (United States)',
    'Microsoft Ava Online (Natural) - English (United States)',
    'Microsoft Andrew Online (Natural) - English (United States)',
    'Samantha',
    'Alex'
  ];

  let cachedVoice = null;
  let voicesReady = false;

  function getVoices() {
    try {
      return window.speechSynthesis ? window.speechSynthesis.getVoices() || [] : [];
    } catch (e) {
      return [];
    }
  }

  function scoreVoice(v) {
    const name = String(v.name || '');
    const lang = String(v.lang || '').toLowerCase();

    let score = 0;

    if (lang === 'en-us') score += 100;
    if (lang.startsWith('en-us')) score += 90;

    if (/united states/i.test(name)) score += 60;
    if (/\bUS\b/i.test(name)) score += 50;
    if (/american/i.test(name)) score += 50;

    if (/google us english/i.test(name)) score += 100;
    if (/microsoft/i.test(name) && /united states/i.test(name)) score += 90;
    if (/aria/i.test(name)) score += 30;
    if (/jenny/i.test(name)) score += 28;
    if (/samantha/i.test(name)) score += 70;
    if (/alex/i.test(name)) score += 55;

    // กันเสียง UK / AU / India หลุดมา
    if (lang === 'en-gb' || /united kingdom|british|uk english/i.test(name)) score -= 200;
    if (lang === 'en-au' || /australia|australian/i.test(name)) score -= 200;
    if (lang === 'en-in' || /india|indian/i.test(name)) score -= 200;

    return score;
  }

  function pickUSVoice() {
    const voices = getVoices();

    if (!voices.length) return null;

    // 1) exact preferred names
    for (const wanted of preferredVoiceNames) {
      const found = voices.find(v => String(v.name || '').toLowerCase() === wanted.toLowerCase());
      if (found && String(found.lang || '').toLowerCase().startsWith('en-us')) {
        cachedVoice = found;
        return found;
      }
    }

    // 2) any strong en-US voice
    const sorted = voices
      .map(v => ({ voice: v, score: scoreVoice(v) }))
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score);

    cachedVoice = sorted.length ? sorted[0].voice : null;
    return cachedVoice;
  }

  function ensureVoiceReady() {
    if (!('speechSynthesis' in window)) return;

    const voices = getVoices();
    if (voices.length) {
      voicesReady = true;
      pickUSVoice();
      return;
    }

    // Chrome/Android โหลด voices ช้ากว่า DOM
    window.speechSynthesis.onvoiceschanged = function () {
      voicesReady = true;
      pickUSVoice();
    };
  }

  function normalizeText(text) {
    let s = String(text || '').trim();

    // กัน AI Help อ่าน emoji / สัญลักษณ์ยาว ๆ มากเกินไป
    s = s
      .replace(/[🎯🏠▶️📊🎤📖👾🎧🏆⭐🔥⚡💡✅❌]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    return s;
  }

  function speakUS(text, options) {
    options = options || {};

    const msg = normalizeText(text);
    if (!msg) return false;

    if (!('speechSynthesis' in window) || !window.SpeechSynthesisUtterance) {
      console.warn('[AIHelp US Voice] speechSynthesis not supported.');
      return false;
    }

    try {
      window.speechSynthesis.cancel();
    } catch (e) {}

    const u = new SpeechSynthesisUtterance(msg);

    // สำคัญที่สุด: บังคับ US
    u.lang = 'en-US';

    const voice = cachedVoice || pickUSVoice();
    if (voice) {
      u.voice = voice;
      u.lang = voice.lang || 'en-US';
    }

    // ปรับให้ออกเสียงแบบครู US ชัด ๆ ไม่เร็วเกิน
    u.rate = Number(options.rate || 0.88);
    u.pitch = Number(options.pitch || 1.02);
    u.volume = Number(options.volume || 1);

    u.onstart = function () {
      document.documentElement.classList.add('aihelp-speaking-us');
      window.dispatchEvent(new CustomEvent('lesson:aihelp-voice-start', {
        detail: {
          lang: u.lang,
          voice: voice ? voice.name : 'fallback-en-US'
        }
      }));
    };

    u.onend = function () {
      document.documentElement.classList.remove('aihelp-speaking-us');
      window.dispatchEvent(new CustomEvent('lesson:aihelp-voice-end', {
        detail: {
          lang: u.lang,
          voice: voice ? voice.name : 'fallback-en-US'
        }
      }));
    };

    u.onerror = function () {
      document.documentElement.classList.remove('aihelp-speaking-us');
    };

    window.speechSynthesis.speak(u);
    return true;
  }

  function injectTinyStyle() {
    if (document.getElementById(VOICE_PATCH_ID + '-style')) return;

    const style = document.createElement('style');
    style.id = VOICE_PATCH_ID + '-style';
    style.textContent = `
      .aihelp-speaking-us .ai-help-btn,
      .aihelp-speaking-us [data-ai-help],
      .aihelp-speaking-us button[aria-label*="AI"] {
        box-shadow: 0 0 0 3px rgba(105,225,255,.25), 0 0 22px rgba(105,225,255,.38) !important;
      }
    `;
    document.head.appendChild(style);
  }

  function patchKnownGlobals() {
    // ให้โค้ดเดิมเรียกใช้ได้ง่าย
    window.LessonUSVoice = {
      speak: speakUS,
      pickVoice: pickUSVoice,
      getVoice: function () {
        return cachedVoice || pickUSVoice();
      },
      listUSVoices: function () {
        return getVoices().filter(v => String(v.lang || '').toLowerCase().startsWith('en-us'));
      }
    };

    window.speakAIHelpUS = speakUS;

    // ถ้าโปรเจกต์มีฟังก์ชันชื่อพวกนี้อยู่แล้ว ให้ครอบด้วย US Voice
    const possibleNames = [
      'speakAIHelp',
      'speakAiHelp',
      'playAIHelpVoice',
      'playAiHelpVoice',
      'lessonSpeak',
      'speakLessonTip'
    ];

    possibleNames.forEach(function (name) {
      const oldFn = window[name];

      if (typeof oldFn === 'function' && !oldFn.__usVoicePatched) {
        const wrapped = function (text) {
          if (typeof text === 'string' && text.trim()) {
            return speakUS(text);
          }
          return oldFn.apply(this, arguments);
        };

        wrapped.__usVoicePatched = true;
        window[name] = wrapped;
      }
    });
  }

  function patchAIHelpButtons() {
    const buttons = Array.from(document.querySelectorAll('button, [role="button"], .ai-help-btn, [data-ai-help]'));

    buttons.forEach(function (btn) {
      if (btn.dataset.usVoiceAiHelpBound === '1') return;

      const label = String(btn.textContent || btn.getAttribute('aria-label') || '').toLowerCase();
      const isAiHelp =
        btn.hasAttribute('data-ai-help') ||
        label.includes('ai help') ||
        label.includes('ai guide') ||
        label.includes('ai learning') ||
        label.includes('help');

      if (!isAiHelp) return;

      btn.dataset.usVoiceAiHelpBound = '1';

      btn.addEventListener('click', function () {
        // ให้ engine เดิมทำงานก่อน แล้วค่อยดูว่ามีข้อความ help ใหม่ขึ้นไหม
        window.setTimeout(function () {
          const helpText =
            btn.getAttribute('data-speak') ||
            btn.getAttribute('data-ai-help') ||
            readVisibleAIHelpText();

          if (helpText) speakUS(helpText);
        }, 120);
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
      '.hint-text'
    ];

    for (const sel of selectors) {
      const el = document.querySelector(sel);
      const txt = el ? String(el.textContent || '').trim() : '';
      if (txt && txt.length >= 4) return txt;
    }

    return '';
  }

  function init() {
    injectTinyStyle();
    ensureVoiceReady();
    patchKnownGlobals();
    patchAIHelpButtons();

    let tries = 0;
    const timer = window.setInterval(function () {
      tries += 1;
      ensureVoiceReady();
      patchKnownGlobals();
      patchAIHelpButtons();

      if (tries >= 20) window.clearInterval(timer);
    }, 300);

    try {
      const mo = new MutationObserver(function () {
        patchAIHelpButtons();
      });

      mo.observe(document.body, {
        childList: true,
        subtree: true
      });

      window.setTimeout(function () {
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
