/* =========================================================
 * /english/js/techpath-voice-natural-fix.js
 * PATCH v20260508-VOICE-NATURAL-FIX
 *
 * ✅ ลดเสียงแหบ/เสียงยาน
 * ✅ ใช้ rate/pitch กลาง ๆ
 * ✅ เลือกเสียง US ที่ฟังธรรมชาติกว่า ถ้ามี
 * ✅ ไม่ยุ่ง route / level / student
 * ========================================================= */

(function () {
  'use strict';

  const PATCH_ID = 'techpath-voice-natural-fix-v20260508';
  const VOICE_KEY = 'TECHPATH_AIHELP_SELECTED_VOICE_URI';
  const OLD_VOICE_KEY = 'LESSON_AIHELP_SELECTED_VOICE_V1';

  let nativeSpeak = null;
  let nativeCancel = null;

  const PREFERRED = [
    /Google US English/i,
    /Microsoft Jenny/i,
    /Microsoft Aria/i,
    /Microsoft Ava/i,
    /Microsoft Zira/i,
    /Samantha/i,
    /Alex/i,
    /Microsoft David/i,
    /Microsoft Mark/i
  ];

  function getVoices() {
    try {
      return window.speechSynthesis ? window.speechSynthesis.getVoices() || [] : [];
    } catch (e) {
      return [];
    }
  }

  function isEnglish(v) {
    return String(v.lang || '').toLowerCase().startsWith('en');
  }

  function isUS(v) {
    const s = `${v.name || ''} ${v.lang || ''}`;
    return /en-us|united states|google us|us english|samantha|alex/i.test(s);
  }

  function scoreVoice(v) {
    const s = `${v.name || ''} ${v.lang || ''}`;
    let score = 0;

    if (isUS(v)) score += 1000;

    PREFERRED.forEach((rx, i) => {
      if (rx.test(s)) score += 300 - i * 20;
    });

    // ลดโอกาสเลือกเสียงที่มักแข็ง/robot ถ้ามีตัวอื่นดีกว่า
    if (/Microsoft Mark/i.test(s)) score -= 80;
    if (/Microsoft David/i.test(s)) score -= 40;

    return score;
  }

  function getSelectedVoice() {
    const voices = getVoices().filter(isEnglish);

    if (!voices.length) return null;

    const selected =
      localStorage.getItem(VOICE_KEY) ||
      localStorage.getItem(OLD_VOICE_KEY) ||
      '';

    if (selected) {
      const found = voices.find(v => v.voiceURI === selected || v.name === selected);
      if (found) return found;
    }

    return voices.sort((a, b) => scoreVoice(b) - scoreVoice(a))[0] || null;
  }

  function isEnglishText(text) {
    const s = String(text || '');
    const en = (s.match(/[A-Za-z]/g) || []).length;
    const th = (s.match(/[\u0E00-\u0E7F]/g) || []).length;
    return en >= 3 && en >= th;
  }

  function fixUtterance(u) {
    if (!u) return u;

    const text = String(u.text || '');
    const lang = String(u.lang || '').toLowerCase();

    if (!lang.startsWith('en') && !isEnglishText(text)) {
      return u;
    }

    const voice = getSelectedVoice();

    if (voice) {
      u.voice = voice;
      u.lang = voice.lang || 'en-US';
    } else {
      u.lang = 'en-US';
    }

    // ค่ากลางที่ฟังเป็นธรรมชาติกว่า
    u.rate = 0.95;
    u.pitch = 1.0;
    u.volume = 1;

    return u;
  }

  function speakNatural(text) {
    const msg = String(text || '').replace(/\s+/g, ' ').trim();
    if (!msg || !window.speechSynthesis || !window.SpeechSynthesisUtterance) return false;

    const u = new SpeechSynthesisUtterance(msg);
    fixUtterance(u);

    try {
      if (nativeCancel) nativeCancel();
      else window.speechSynthesis.cancel();
    } catch (e) {}

    if (nativeSpeak) nativeSpeak(u);
    else window.speechSynthesis.speak(u);

    return true;
  }

  function patchSpeak() {
    if (!window.speechSynthesis || !window.speechSynthesis.speak) return;

    if (!nativeSpeak) nativeSpeak = window.speechSynthesis.speak.bind(window.speechSynthesis);
    if (!nativeCancel) nativeCancel = window.speechSynthesis.cancel.bind(window.speechSynthesis);

    if (window.speechSynthesis.speak.__naturalFixed) return;

    const wrapped = function (utterance) {
      try {
        fixUtterance(utterance);
      } catch (e) {}

      return nativeSpeak(utterance);
    };

    wrapped.__naturalFixed = true;
    window.speechSynthesis.speak = wrapped;
  }

  function patchGlobals() {
    window.speakAIHelpUS = speakNatural;
    window.speakAIHelp = speakNatural;
    window.playAIHelpVoice = speakNatural;
    window.playAiHelpVoice = speakNatural;
    window.speakCoach = speakNatural;
    window.speakHint = speakNatural;

    window.TechPathVoiceNaturalFix = {
      version: PATCH_ID,
      speak: speakNatural,
      getSelectedVoice,
      test: function () {
        return speakNatural('Hello. This is a clearer and more natural AI Help voice.');
      },
      debug: function () {
        const v = getSelectedVoice();
        return {
          patch: PATCH_ID,
          selectedVoice: v ? {
            name: v.name,
            lang: v.lang,
            voiceURI: v.voiceURI
          } : null,
          rate: 0.95,
          pitch: 1.0
        };
      }
    };
  }

  function init() {
    patchSpeak();
    patchGlobals();
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
    if (tries >= 20) clearInterval(timer);
  }, 500);

  if (window.speechSynthesis) {
    window.speechSynthesis.onvoiceschanged = init;
  }
})();