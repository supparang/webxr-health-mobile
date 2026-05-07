/* =========================================================
 * /english/js/lesson-aihelp-voice-lock.js
 * PATCH v20260506c-VOICE-HARD-LOCK
 *
 * แก้ปัญหา:
 * ✅ เลือกเสียงใน dropdown แล้ว AI Help ยังใช้เสียงอื่น
 * ✅ ดัก speechSynthesis.speak() ทุกครั้ง
 * ✅ บังคับ utterance.voice = เสียงที่เลือกไว้
 * ✅ บังคับ Play US Audio / AI Help / Listen Sample ที่เป็น English ให้ใช้เสียงเดียวกัน
 * ✅ แสดง badge ว่าใช้เสียงอะไรจริงตอนพูด
 *
 * สำคัญ:
 * ต้องโหลดไฟล์นี้เป็น script ตัวสุดท้ายก่อน </body>
 * ========================================================= */

(function () {
  'use strict';

  const PATCH_ID = 'lesson-aihelp-voice-hard-lock-v20260506c';
  const STORAGE_KEY = 'LESSON_AIHELP_SELECTED_VOICE_V1';

  let originalSpeak = null;
  let lastForcedVoice = null;
  let lastForcedLang = '';
  let patchReady = false;

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

  function getSelectedKey() {
    const select = document.getElementById('lessonAiHelpVoiceSelect');

    if (select && select.value) {
      return select.value;
    }

    try {
      return localStorage.getItem(STORAGE_KEY) || '';
    } catch (e) {
      return '';
    }
  }

  function isEnglishVoice(v) {
    return String(v && v.lang ? v.lang : '').toLowerCase().startsWith('en');
  }

  function isUSVoice(v) {
    const name = String(v && v.name ? v.name : '');
    const lang = String(v && v.lang ? v.lang : '').toLowerCase();

    return (
      lang.startsWith('en-us') ||
      /united states|google us|us english|samantha|alex/i.test(name)
    );
  }

  function voiceScore(v) {
    const name = String(v && v.name ? v.name : '');
    const lang = String(v && v.lang ? v.lang : '').toLowerCase();

    let score = 0;

    if (lang === 'en-us') score += 500;
    if (lang.startsWith('en-us')) score += 400;

    if (/microsoft david/i.test(name)) score += 350;
    if (/microsoft aria/i.test(name)) score += 340;
    if (/microsoft jenny/i.test(name)) score += 330;
    if (/microsoft guy/i.test(name)) score += 320;
    if (/google us english/i.test(name)) score += 310;
    if (/samantha/i.test(name)) score += 300;
    if (/alex/i.test(name)) score += 250;

    if (/united states/i.test(name)) score += 180;
    if (/\bus\b/i.test(name)) score += 120;

    if (/united kingdom|british|en-gb|australia|australian|en-au|india|indian|en-in/i.test(name + ' ' + lang)) {
      score -= 999;
    }

    return score;
  }

  function findSelectedVoice() {
    const voices = getVoices();
    const key = getSelectedKey();

    if (!voices.length) return null;

    if (key) {
      const exact = voices.find(function (v) {
        return (
          String(v.voiceURI || '') === key ||
          String(v.name || '') === key
        );
      });

      if (exact) return exact;

      const loose = voices.find(function (v) {
        const name = String(v.name || '');
        const uri = String(v.voiceURI || '');
        return (
          key.includes(name) ||
          name.includes(key) ||
          key.includes(uri) ||
          uri.includes(key)
        );
      });

      if (loose) return loose;
    }

    if (
      window.LessonVoicePicker &&
      typeof window.LessonVoicePicker.getSelectedVoice === 'function'
    ) {
      try {
        const picked = window.LessonVoicePicker.getSelectedVoice();
        if (picked) return picked;
      } catch (e) {}
    }

    return voices
      .filter(isEnglishVoice)
      .sort(function (a, b) {
        return voiceScore(b) - voiceScore(a);
      })[0] || null;
  }

  function isMostlyEnglishText(text) {
    const s = String(text || '').trim();
    if (!s) return false;

    const englishLetters = (s.match(/[A-Za-z]/g) || []).length;
    const thaiLetters = (s.match(/[\u0E00-\u0E7F]/g) || []).length;

    return englishLetters >= 3 && englishLetters >= thaiLetters;
  }

  function shouldForceUtterance(u) {
    if (!u) return false;

    const text = String(u.text || '');
    const lang = String(u.lang || '').toLowerCase();

    if (lang.startsWith('en')) return true;
    if (isMostlyEnglishText(text)) return true;

    return false;
  }

  function showVoiceBadge(voice, source) {
    let badge = document.getElementById('lessonAiHelpVoiceLockBadge');

    if (!badge) {
      badge = document.createElement('div');
      badge.id = 'lessonAiHelpVoiceLockBadge';
      badge.style.cssText = [
        'position:fixed',
        'left:12px',
        'right:12px',
        'bottom:82px',
        'z-index:999999',
        'padding:10px 14px',
        'border-radius:16px',
        'background:rgba(5,17,32,.96)',
        'color:#eaffff',
        'border:1px solid rgba(105,232,255,.48)',
        'font:800 13px/1.45 system-ui,-apple-system,Segoe UI,sans-serif',
        'box-shadow:0 14px 42px rgba(0,0,0,.35)',
        'display:none'
      ].join(';');

      document.body.appendChild(badge);
    }

    if (voice) {
      badge.innerHTML =
        '🔒 Voice Locked: <b>' +
        esc(voice.name) +
        '</b> <span style="opacity:.82">(' +
        esc(voice.lang || '-') +
        ')</span><br><span style="opacity:.72">source: ' +
        esc(source || 'speechSynthesis.speak') +
        '</span>';
    } else {
      badge.innerHTML =
        '⚠️ Voice Lock: ยังหาเสียงที่เลือกไม่เจอ — browser ใช้ default voice';
    }

    badge.style.display = 'block';

    clearTimeout(badge._t);
    badge._t = setTimeout(function () {
      badge.style.display = 'none';
    }, 4200);
  }

  function forceVoiceOnUtterance(u, source) {
    if (!u || !window.SpeechSynthesisUtterance) return u;

    if (!shouldForceUtterance(u)) return u;

    const voice = findSelectedVoice();

    if (voice) {
      u.voice = voice;
      u.lang = voice.lang || 'en-US';
      lastForcedVoice = voice.name || '';
      lastForcedLang = voice.lang || '';
    } else {
      u.lang = 'en-US';
      lastForcedVoice = '';
      lastForcedLang = 'en-US';
    }

    if (!u.__lessonVoiceLockBound) {
      u.__lessonVoiceLockBound = true;

      const oldStart = u.onstart;
      const oldEnd = u.onend;
      const oldError = u.onerror;

      u.onstart = function (ev) {
        showVoiceBadge(voice, source);

        window.dispatchEvent(new CustomEvent('lesson:voice-lock-start', {
          detail: {
            voice: voice ? voice.name : '',
            lang: voice ? voice.lang : u.lang,
            source: source || 'speechSynthesis.speak'
          }
        }));

        if (typeof oldStart === 'function') {
          try {
            oldStart.call(this, ev);
          } catch (e) {}
        }
      };

      u.onend = function (ev) {
        window.dispatchEvent(new CustomEvent('lesson:voice-lock-end', {
          detail: {
            voice: voice ? voice.name : '',
            lang: voice ? voice.lang : u.lang,
            source: source || 'speechSynthesis.speak'
          }
        }));

        if (typeof oldEnd === 'function') {
          try {
            oldEnd.call(this, ev);
          } catch (e) {}
        }
      };

      u.onerror = function (ev) {
        if (typeof oldError === 'function') {
          try {
            oldError.call(this, ev);
          } catch (e) {}
        }
      };
    }

    return u;
  }

  function cleanText(text) {
    return String(text || '')
      .replace(/[🎯🏠▶️📊🎤📖👾🎧🏆⭐🔥⚡💡✅❌]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function speakLocked(text, options) {
    options = options || {};

    const msg = cleanText(text);
    if (!msg) return false;

    if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) {
      alert('เครื่องนี้ไม่รองรับระบบอ่านข้อความอัตโนมัติ');
      return false;
    }

    const u = new SpeechSynthesisUtterance(msg);

    u.lang = 'en-US';
    u.rate = Number(options.rate || 0.86);
    u.pitch = Number(options.pitch || 1.02);
    u.volume = Number(options.volume || 1);

    forceVoiceOnUtterance(u, 'speakLocked');

    try {
      window.speechSynthesis.cancel();
    } catch (e) {}

    window.speechSynthesis.speak(u);
    return true;
  }

  function patchNativeSpeak() {
    if (!window.speechSynthesis) return false;

    const synth = window.speechSynthesis;

    if (synth.speak && synth.speak.__lessonVoiceHardLocked) {
      return true;
    }

    if (!originalSpeak) {
      originalSpeak = synth.speak.bind(synth);
    }

    const lockedSpeak = function (utterance) {
      try {
        forceVoiceOnUtterance(utterance, 'native-speak-hook');
      } catch (e) {}

      return originalSpeak(utterance);
    };

    lockedSpeak.__lessonVoiceHardLocked = true;

    try {
      synth.speak = lockedSpeak;
      patchReady = true;
      return true;
    } catch (e) {
      patchReady = false;
      return false;
    }
  }

  function patchPickerFunctions() {
    window.speakAIHelpUS = speakLocked;

    if (!window.LessonUSVoice) {
      window.LessonUSVoice = {};
    }

    window.LessonUSVoice.speak = speakLocked;
    window.LessonUSVoice.speakLocked = speakLocked;
    window.LessonUSVoice.getSelectedVoice = findSelectedVoice;
    window.LessonUSVoice.getVoice = findSelectedVoice;

    if (!window.LessonVoicePicker) {
      window.LessonVoicePicker = {};
    }

    window.LessonVoicePicker.speak = speakLocked;
    window.LessonVoicePicker.getSelectedVoice = findSelectedVoice;

    window.LessonVoiceLock = {
      speak: speakLocked,
      getSelectedVoice: findSelectedVoice,
      getSelectedKey: getSelectedKey,
      isReady: function () {
        return patchReady;
      },
      debug: function () {
        const voice = findSelectedVoice();
        const voices = getVoices();

        console.table(voices.map(function (v) {
          return {
            name: v.name,
            lang: v.lang,
            voiceURI: v.voiceURI,
            selected: voice && (v.voiceURI === voice.voiceURI || v.name === voice.name)
          };
        }));

        return {
          patchReady: patchReady,
          selectedKey: getSelectedKey(),
          selectedVoice: voice ? {
            name: voice.name,
            lang: voice.lang,
            voiceURI: voice.voiceURI
          } : null,
          lastForcedVoice: lastForcedVoice,
          lastForcedLang: lastForcedLang
        };
      },
      test: function () {
        return speakLocked('Hello. This is the locked voice for AI Help. I will use the voice selected in the dropdown.');
      }
    };
  }

  function bindSelectChange() {
    const select = document.getElementById('lessonAiHelpVoiceSelect');
    if (!select || select.dataset.voiceLockBound === '1') return;

    select.dataset.voiceLockBound = '1';

    select.addEventListener('change', function () {
      try {
        localStorage.setItem(STORAGE_KEY, select.value || '');
      } catch (e) {}

      setTimeout(function () {
        speakLocked('Voice locked. I will use this selected voice for AI Help.');
      }, 120);
    });
  }

  function injectStyle() {
    if (document.getElementById(PATCH_ID + '-style')) return;

    const style = document.createElement('style');
    style.id = PATCH_ID + '-style';
    style.textContent = `
      #lessonAiHelpVoicePicker {
        box-shadow:
          0 0 0 2px rgba(105,232,255,.16),
          0 18px 48px rgba(0,0,0,.36) !important;
      }

      #lessonAiHelpVoicePicker summary::after {
        content: "  • locked";
        color: #8affd2;
        font-weight: 1000;
      }
    `;
    document.head.appendChild(style);
  }

  function init() {
    injectStyle();
    patchNativeSpeak();
    patchPickerFunctions();
    bindSelectChange();

    if (window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = function () {
        patchNativeSpeak();
        patchPickerFunctions();
        bindSelectChange();
      };
    }

    let tries = 0;
    const timer = setInterval(function () {
      tries += 1;

      patchNativeSpeak();
      patchPickerFunctions();
      bindSelectChange();

      if (tries >= 30) {
        clearInterval(timer);
      }
    }, 300);

    try {
      const mo = new MutationObserver(function () {
        patchPickerFunctions();
        bindSelectChange();
      });

      mo.observe(document.body, {
        childList: true,
        subtree: true
      });

      setTimeout(function () {
        try {
          mo.disconnect();
        } catch (e) {}
      }, 15000);
    } catch (e) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
