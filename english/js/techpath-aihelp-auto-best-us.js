/* =========================================================
 * /english/js/techpath-aihelp-auto-best-us.js
 * PATCH v20260509-AUTO-BEST-US-VOICE
 *
 * ✅ เลือกเสียง American English ที่ดีที่สุดให้อัตโนมัติ
 * ✅ ไม่ต้องกด dropdown เอง
 * ✅ บังคับ AI Help ใช้เสียงนั้นทุกครั้ง
 * ✅ แก้กรณีแผงเลือกเสียงกดไม่ได้ / ถูก layer บัง
 * ✅ ใช้ร่วมกับ techpath-aihelp-voice-counter-stable.js
 * ========================================================= */

(function () {
  'use strict';

  const PATCH_ID = 'techpath-aihelp-auto-best-us-v20260509';

  const VOICE_KEY = 'TECHPATH_AIHELP_SELECTED_VOICE_URI';
  const OLD_VOICE_KEY = 'LESSON_AIHELP_SELECTED_VOICE_V1';
  const PRESET_KEY = 'TECHPATH_AIHELP_VOICE_PRESET';

  let nativeSpeak = null;
  let nativeCancel = null;

  function getVoices() {
    try {
      return window.speechSynthesis ? window.speechSynthesis.getVoices() || [] : [];
    } catch (e) {
      return [];
    }
  }

  function isEnglish(v) {
    return String(v && v.lang ? v.lang : '').toLowerCase().startsWith('en');
  }

  function isBadAccent(v) {
    const s = `${v.name || ''} ${v.lang || ''}`;
    return /en-gb|british|united kingdom|en-au|australia|australian|en-in|india|indian/i.test(s);
  }

  function scoreVoice(v) {
    const s = `${v.name || ''} ${v.lang || ''}`;
    const lang = String(v.lang || '').toLowerCase();

    let score = 0;

    if (lang === 'en-us') score += 5000;
    if (/united states/i.test(s)) score += 2000;
    if (/google us english/i.test(s)) score += 3000;

    // เสียง US ที่ฟังดี / ชัด / เป็นธรรมชาติ
    if (/microsoft jenny/i.test(s)) score += 2800;
    if (/microsoft aria/i.test(s)) score += 2700;
    if (/microsoft ava/i.test(s)) score += 2600;
    if (/microsoft ana/i.test(s)) score += 2400;
    if (/samantha/i.test(s)) score += 2300;
    if (/microsoft zira/i.test(s)) score += 2100;
    if (/alex/i.test(s)) score += 1900;

    // เสียงผู้ชาย ชัดแต่บางเครื่องแข็งกว่า
    if (/microsoft guy/i.test(s)) score += 1700;
    if (/microsoft david/i.test(s)) score += 1500;
    if (/microsoft mark/i.test(s)) score += 1300;

    if (/us english/i.test(s)) score += 1200;
    if (/\bus\b/i.test(s)) score += 800;

    if (isBadAccent(v)) score -= 10000;
    if (/default|compact|novelty/i.test(s)) score -= 500;

    return score;
  }

  function pickBestUSVoice() {
    const voices = getVoices().filter(isEnglish);

    if (!voices.length) return null;

    const sorted = voices
      .map(v => ({ voice: v, score: scoreVoice(v) }))
      .sort((a, b) => b.score - a.score);

    return sorted[0] ? sorted[0].voice : null;
  }

  function saveBestVoice() {
    const best = pickBestUSVoice();

    if (!best) return null;

    try {
      localStorage.setItem(VOICE_KEY, best.voiceURI || best.name);
      localStorage.setItem(OLD_VOICE_KEY, best.voiceURI || best.name);

      // Teacher preset ฟังนุ่มสุด
      localStorage.setItem(PRESET_KEY, 'teacher');
    } catch (e) {}

    const select = document.getElementById('techPathAIHelpVoiceSelect');
    if (select) {
      select.value = best.voiceURI || best.name;
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }

    return best;
  }

  function getLockedVoice() {
    const best = pickBestUSVoice();
    return best || null;
  }

  function showBadge(voice) {
    let badge = document.getElementById('techPathBestUSVoiceBadge');

    if (!badge) {
      badge = document.createElement('div');
      badge.id = 'techPathBestUSVoiceBadge';
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
      ? `🇺🇸 ใช้เสียง US ที่ดีที่สุด: <b>${voice.name}</b> (${voice.lang})`
      : '⚠️ ยังไม่พบเสียง US ใน browser นี้';

    badge.style.display = 'block';

    clearTimeout(badge._t);
    badge._t = setTimeout(function () {
      badge.style.display = 'none';
    }, 3200);
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

    if (!lang.startsWith('en') && !isEnglishText(text)) return u;

    const voice = getLockedVoice();

    if (voice) {
      u.voice = voice;
      u.lang = voice.lang || 'en-US';
    } else {
      u.lang = 'en-US';
    }

    // ค่าฟังนุ่ม ชัด ไม่แหบ ไม่ยาน
    u.rate = 0.93;
    u.pitch = 1.03;
    u.volume = 1;

    if (!u.__bestUsVoiceBound) {
      u.__bestUsVoiceBound = true;

      const oldStart = u.onstart;

      u.onstart = function (ev) {
        showBadge(voice);

        if (typeof oldStart === 'function') {
          try {
            oldStart.call(this, ev);
          } catch (e) {}
        }
      };
    }

    return u;
  }

  function patchSpeak() {
    if (!window.speechSynthesis || !window.speechSynthesis.speak) return;

    if (!nativeSpeak) nativeSpeak = window.speechSynthesis.speak.bind(window.speechSynthesis);
    if (!nativeCancel && window.speechSynthesis.cancel) {
      nativeCancel = window.speechSynthesis.cancel.bind(window.speechSynthesis);
    }

    if (window.speechSynthesis.speak.__bestUsVoicePatched) return;

    const wrappedSpeak = function (utterance) {
      try {
        fixUtterance(utterance);
      } catch (e) {}

      return nativeSpeak(utterance);
    };

    wrappedSpeak.__bestUsVoicePatched = true;
    window.speechSynthesis.speak = wrappedSpeak;
  }

  function speakBestUS(text, options) {
    options = options || {};

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

  function exposeApi() {
    window.TechPathBestUSVoice = {
      version: PATCH_ID,
      pick: pickBestUSVoice,
      save: saveBestVoice,
      speak: speakBestUS,
      test: function () {
        const best = saveBestVoice();
        showBadge(best);
        return speakBestUS('Hello. This is the best available American English voice for AI Help.');
      },
      debug: function () {
        const best = pickBestUSVoice();

        return {
          patch: PATCH_ID,
          bestVoice: best ? {
            name: best.name,
            lang: best.lang,
            voiceURI: best.voiceURI,
            score: scoreVoice(best)
          } : null,
          allEnglishVoices: getVoices().filter(isEnglish).map(v => ({
            name: v.name,
            lang: v.lang,
            voiceURI: v.voiceURI,
            score: scoreVoice(v)
          })).sort((a, b) => b.score - a.score),
          speakPatched: !!(
            window.speechSynthesis &&
            window.speechSynthesis.speak &&
            window.speechSynthesis.speak.__bestUsVoicePatched
          )
        };
      }
    };

    // ให้ตัวเดิมเรียกแล้วก็ใช้เสียง US ที่ดีที่สุด
    if (window.TechPathAIHelpStable) {
      const oldSpeak = window.TechPathAIHelpStable.speak;

      window.TechPathAIHelpStable.getSelectedVoice = pickBestUSVoice;
      window.TechPathAIHelpStable.getBestUSVoice = pickBestUSVoice;

      window.TechPathAIHelpStable.speak = function (text, options) {
        saveBestVoice();

        if (typeof oldSpeak === 'function') {
          return oldSpeak(text, options);
        }

        return speakBestUS(text, options);
      };
    }
  }

  function fixPanelClick() {
    const panel = document.getElementById('techPathAIHelpStable');

    if (panel) {
      panel.style.setProperty('z-index', '9999998', 'important');
      panel.style.setProperty('pointer-events', 'auto', 'important');

      panel.querySelectorAll('select, button, summary, option').forEach(function (el) {
        el.style.setProperty('pointer-events', 'auto', 'important');
        el.style.setProperty('touch-action', 'manipulation', 'important');
      });
    }
  }

  function init() {
    saveBestVoice();
    patchSpeak();
    exposeApi();
    fixPanelClick();
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
    window.speechSynthesis.onvoiceschanged = function () {
      init();
    };
  }
})();
