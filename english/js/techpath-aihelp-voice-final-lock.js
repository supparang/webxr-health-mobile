/* =========================================================
 * /english/js/techpath-aihelp-voice-final-lock.js
 * PATCH v20260507-FINAL-AIHELP-VOICE-LOCK
 *
 * ✅ AI Help ตอนเล่นจริงใช้เสียงที่เลือกใน dropdown เสมอ
 * ✅ ดัก speechSynthesis.speak() ทุกครั้ง
 * ✅ sync กับ #techPathVoiceSelect
 * ✅ ใช้ key เดียวกับ lesson-ui-final-stabilize.js
 * ✅ ไม่ยุ่งกับ route / student / copy guard
 * ========================================================= */

(function () {
  'use strict';

  const PATCH_ID = 'techpath-aihelp-voice-final-lock-v20260507';
  const VOICE_KEY = 'TECHPATH_AIHELP_SELECTED_VOICE_URI';
  const OLD_VOICE_KEY = 'LESSON_AIHELP_SELECTED_VOICE_V1';

  let nativeSpeak = null;
  let nativeCancel = null;

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
      return window.speechSynthesis ? window.speechSynthesis.getVoices() || [] : [];
    } catch (e) {
      return [];
    }
  }

  function getSelectedKey() {
    const select = document.getElementById('techPathVoiceSelect');

    if (select && select.value) {
      try {
        localStorage.setItem(VOICE_KEY, select.value);
        localStorage.setItem(OLD_VOICE_KEY, select.value);
      } catch (e) {}

      return select.value;
    }

    try {
      return (
        localStorage.getItem(VOICE_KEY) ||
        localStorage.getItem(OLD_VOICE_KEY) ||
        ''
      );
    } catch (e) {
      return '';
    }
  }

  function isEnglish(v) {
    return String(v && v.lang ? v.lang : '').toLowerCase().startsWith('en');
  }

  function isUS(v) {
    const s = `${v && v.name ? v.name : ''} ${v && v.lang ? v.lang : ''}`;
    return /en-us|united states|google us|us english|samantha|alex|microsoft david|microsoft mark|microsoft zira/i.test(s);
  }

  function sortVoices(voices) {
    return voices.filter(isEnglish).sort(function (a, b) {
      const au = isUS(a) ? 0 : 1;
      const bu = isUS(b) ? 0 : 1;

      if (au !== bu) return au - bu;

      const an = String(a.name || '').toLowerCase();
      const bn = String(b.name || '').toLowerCase();

      return an.localeCompare(bn);
    });
  }

  function getSelectedVoice() {
    const key = getSelectedKey();
    const voices = sortVoices(getVoices());

    if (!voices.length) return null;

    if (key) {
      const exact = voices.find(function (v) {
        return String(v.voiceURI || '') === key || String(v.name || '') === key;
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

    return voices.find(isUS) || voices[0] || null;
  }

  function isEnglishText(text) {
    const s = String(text || '').trim();
    if (!s) return false;

    const en = (s.match(/[A-Za-z]/g) || []).length;
    const th = (s.match(/[\u0E00-\u0E7F]/g) || []).length;

    return en >= 3 && en >= th;
  }

  function shouldForceVoice(utterance) {
    if (!utterance) return false;

    const text = String(utterance.text || '');
    const lang = String(utterance.lang || '').toLowerCase();

    return lang.startsWith('en') || isEnglishText(text);
  }

  function showVoiceBadge(voice) {
    let badge = document.getElementById('techPathFinalVoiceLockBadge');

    if (!badge) {
      badge = document.createElement('div');
      badge.id = 'techPathFinalVoiceLockBadge';
      badge.style.cssText = [
        'position:fixed',
        'left:12px',
        'right:12px',
        'bottom:92px',
        'z-index:9999999',
        'display:none',
        'padding:10px 14px',
        'border-radius:16px',
        'background:rgba(5,17,32,.96)',
        'color:#eaffff',
        'border:1px solid rgba(105,232,255,.48)',
        'box-shadow:0 14px 44px rgba(0,0,0,.38)',
        'font:900 13px/1.45 system-ui,-apple-system,Segoe UI,sans-serif',
        'text-align:center',
        'pointer-events:none'
      ].join(';');

      document.body.appendChild(badge);
    }

    badge.innerHTML = voice
      ? '🔒 AI Help ใช้เสียง: <b>' + esc(voice.name) + '</b> <span style="opacity:.78">(' + esc(voice.lang) + ')</span>'
      : '⚠️ ยังหาเสียงที่เลือกไม่เจอ ใช้ browser default';

    badge.style.display = 'block';

    clearTimeout(badge._t);
    badge._t = setTimeout(function () {
      badge.style.display = 'none';
    }, 3200);
  }

  function forceVoice(utterance) {
    if (!utterance) return utterance;
    if (!shouldForceVoice(utterance)) return utterance;

    const voice = getSelectedVoice();

    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang || 'en-US';
    } else {
      utterance.lang = 'en-US';
    }

    if (!utterance.__techPathVoiceLockBound) {
      utterance.__techPathVoiceLockBound = true;

      const oldStart = utterance.onstart;

      utterance.onstart = function (ev) {
        showVoiceBadge(voice);

        window.dispatchEvent(new CustomEvent('techpath:aihelp-voice-used', {
          detail: {
            patch: PATCH_ID,
            voiceName: voice ? voice.name : '',
            voiceLang: voice ? voice.lang : utterance.lang,
            text: utterance.text || ''
          }
        }));

        if (typeof oldStart === 'function') {
          try {
            oldStart.call(this, ev);
          } catch (e) {}
        }
      };
    }

    return utterance;
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
      return false;
    }

    const u = new SpeechSynthesisUtterance(msg);

    u.lang = 'en-US';
    u.rate = Number(options.rate || 0.86);
    u.pitch = Number(options.pitch || 1.02);
    u.volume = Number(options.volume || 1);

    forceVoice(u);

    try {
      if (nativeCancel) nativeCancel();
      else window.speechSynthesis.cancel();
    } catch (e) {}

    if (nativeSpeak) nativeSpeak(u);
    else window.speechSynthesis.speak(u);

    return true;
  }

  function patchNativeSpeak() {
    if (!window.speechSynthesis || !window.speechSynthesis.speak) return;

    const synth = window.speechSynthesis;

    if (!nativeSpeak) {
      nativeSpeak = synth.speak.bind(synth);
    }

    if (!nativeCancel && synth.cancel) {
      nativeCancel = synth.cancel.bind(synth);
    }

    if (synth.speak.__techPathFinalVoiceLocked) return;

    const lockedSpeak = function (utterance) {
      try {
        forceVoice(utterance);
      } catch (e) {}

      return nativeSpeak(utterance);
    };

    lockedSpeak.__techPathFinalVoiceLocked = true;
    synth.speak = lockedSpeak;
  }

  function patchGlobals() {
    window.speakAIHelpUS = speakLocked;
    window.speakAIHelp = speakLocked;
    window.playAIHelpVoice = speakLocked;
    window.playAiHelpVoice = speakLocked;
    window.speakCoach = speakLocked;
    window.speakHint = speakLocked;

    window.LessonUSVoice = window.LessonUSVoice || {};
    window.LessonUSVoice.speak = speakLocked;
    window.LessonUSVoice.getSelectedVoice = getSelectedVoice;

    window.TechPathVoice = window.TechPathVoice || {};
    window.TechPathVoice.speak = speakLocked;
    window.TechPathVoice.getSelectedVoice = getSelectedVoice;

    window.TechPathVoiceFinalLock = {
      version: PATCH_ID,
      speak: speakLocked,
      getSelectedVoice,
      refresh: function () {
        patchNativeSpeak();
        patchGlobals();
        syncSelectToStorage();
        return getSelectedVoice();
      },
      test: function () {
        return speakLocked('Hello. This is the locked selected voice for AI Help.');
      },
      debug: function () {
        const voice = getSelectedVoice();

        return {
          patch: PATCH_ID,
          selectedKey: getSelectedKey(),
          selectedVoice: voice ? {
            name: voice.name,
            lang: voice.lang,
            voiceURI: voice.voiceURI
          } : null,
          voices: sortVoices(getVoices()).map(function (v) {
            return {
              name: v.name,
              lang: v.lang,
              voiceURI: v.voiceURI
            };
          }),
          nativeSpeakLocked: !!(
            window.speechSynthesis &&
            window.speechSynthesis.speak &&
            window.speechSynthesis.speak.__techPathFinalVoiceLocked
          )
        };
      }
    };
  }

  function syncSelectToStorage() {
    const select = document.getElementById('techPathVoiceSelect');
    if (!select) return;

    if (select.value) {
      try {
        localStorage.setItem(VOICE_KEY, select.value);
        localStorage.setItem(OLD_VOICE_KEY, select.value);
      } catch (e) {}
    }
  }

  function bindSelect() {
    const select = document.getElementById('techPathVoiceSelect');
    if (!select || select.dataset.finalVoiceLockBound === '1') return;

    select.dataset.finalVoiceLockBound = '1';

    select.addEventListener('change', function () {
      syncSelectToStorage();

      window.setTimeout(function () {
        speakLocked('Voice selected. AI Help will use this voice now.');
      }, 120);
    });
  }

  function bindAIHelpButtons() {
    const buttons = Array.from(document.querySelectorAll('button, [role="button"], a'));

    buttons.forEach(function (btn) {
      if (btn.dataset.finalAiHelpVoiceBound === '1') return;

      const label = String(btn.textContent || btn.getAttribute('aria-label') || '').toLowerCase();

      const isAIHelp =
        label.includes('ai help') ||
        label.includes('hint') ||
        label.includes('coach') ||
        btn.hasAttribute('data-ai-help') ||
        btn.hasAttribute('data-speak');

      if (!isAIHelp) return;

      btn.dataset.finalAiHelpVoiceBound = '1';

      btn.addEventListener('click', function () {
        syncSelectToStorage();

        setTimeout(function () {
          patchNativeSpeak();
          patchGlobals();
        }, 30);
      }, true);
    });
  }

  function init() {
    patchNativeSpeak();
    patchGlobals();
    syncSelectToStorage();
    bindSelect();
    bindAIHelpButtons();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

  let tries = 0;
  const timer = setInterval(function () {
    tries += 1;
    init();

    if (tries >= 30) clearInterval(timer);
  }, 400);

  if (window.speechSynthesis) {
    window.speechSynthesis.onvoiceschanged = function () {
      init();
    };
  }

  try {
    const mo = new MutationObserver(function () {
      bindSelect();
      bindAIHelpButtons();
    });

    mo.observe(document.body, {
      childList: true,
      subtree: true
    });

    setTimeout(function () {
      try {
        mo.disconnect();
      } catch (e) {}
    }, 20000);
  } catch (e) {}
})();
