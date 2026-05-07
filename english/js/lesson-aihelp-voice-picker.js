/* =========================================================
 * /english/js/lesson-aihelp-voice-picker.js
 * PATCH v20260506-VOICE-PICKER
 *
 * ✅ เลือกเสียงคนพูดสำหรับ AI Help ได้
 * ✅ แสดงเฉพาะ English voices โดยให้ en-US อยู่บนสุด
 * ✅ จำเสียงที่เลือกไว้ใน localStorage
 * ✅ Override window.speakAIHelpUS() ให้ใช้เสียงที่เลือก
 * ✅ ใช้ร่วมกับ lesson-aihelp-us-voice.js ได้
 * ========================================================= */

(function () {
  'use strict';

  const STORAGE_KEY = 'LESSON_AIHELP_SELECTED_VOICE_V1';
  const PANEL_ID = 'lessonAiHelpVoicePicker';

  let selectedVoiceURI = localStorage.getItem(STORAGE_KEY) || '';
  let cachedVoices = [];

  function getVoices() {
    try {
      cachedVoices = window.speechSynthesis ? window.speechSynthesis.getVoices() || [] : [];
      return cachedVoices;
    } catch (e) {
      return [];
    }
  }

  function isEnglish(v) {
    return String(v.lang || '').toLowerCase().startsWith('en');
  }

  function isUS(v) {
    return String(v.lang || '').toLowerCase().startsWith('en-us') ||
      /united states|google us|us english|samantha|alex/i.test(String(v.name || ''));
  }

  function sortVoices(voices) {
    return voices
      .filter(isEnglish)
      .sort(function (a, b) {
        const au = isUS(a) ? 0 : 1;
        const bu = isUS(b) ? 0 : 1;
        if (au !== bu) return au - bu;

        const an = String(a.name || '').toLowerCase();
        const bn = String(b.name || '').toLowerCase();

        const ap = /google us|microsoft aria|microsoft jenny|samantha|alex/i.test(an) ? 0 : 1;
        const bp = /google us|microsoft aria|microsoft jenny|samantha|alex/i.test(bn) ? 0 : 1;
        if (ap !== bp) return ap - bp;

        return an.localeCompare(bn);
      });
  }

  function getSelectedVoice() {
    const voices = getVoices();
    const englishVoices = sortVoices(voices);

    if (selectedVoiceURI) {
      const byUri = englishVoices.find(v => v.voiceURI === selectedVoiceURI);
      if (byUri) return byUri;

      const byName = englishVoices.find(v => v.name === selectedVoiceURI);
      if (byName) return byName;
    }

    return englishVoices.find(isUS) || englishVoices[0] || null;
  }

  function cleanText(text) {
    return String(text || '')
      .replace(/[🎯🏠▶️📊🎤📖👾🎧🏆⭐🔥⚡💡✅❌]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function speakWithSelectedVoice(text, options) {
    options = options || {};

    const msg = cleanText(text);
    if (!msg) return false;

    if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) {
      alert('เครื่องนี้ไม่รองรับระบบอ่านข้อความอัตโนมัติ');
      return false;
    }

    const voice = getSelectedVoice();

    try {
      window.speechSynthesis.cancel();
    } catch (e) {}

    const u = new SpeechSynthesisUtterance(msg);

    if (voice) {
      u.voice = voice;
      u.lang = voice.lang || 'en-US';
    } else {
      u.lang = 'en-US';
    }

    u.rate = Number(options.rate || 0.86);
    u.pitch = Number(options.pitch || 1.02);
    u.volume = Number(options.volume || 1);

    u.onstart = function () {
      showCurrentVoiceBadge(voice);
    };

    window.speechSynthesis.speak(u);
    return true;
  }

  function showCurrentVoiceBadge(voice) {
    let badge = document.getElementById('lessonAiHelpVoiceBadge');

    if (!badge) {
      badge = document.createElement('div');
      badge.id = 'lessonAiHelpVoiceBadge';
      badge.style.cssText = [
        'position:fixed',
        'left:12px',
        'right:12px',
        'bottom:82px',
        'z-index:999999',
        'padding:10px 14px',
        'border-radius:16px',
        'background:rgba(5,17,32,.94)',
        'color:#eaffff',
        'border:1px solid rgba(105,232,255,.42)',
        'font:800 13px/1.45 system-ui,-apple-system,Segoe UI,sans-serif',
        'box-shadow:0 14px 40px rgba(0,0,0,.32)',
        'display:none'
      ].join(';');

      document.body.appendChild(badge);
    }

    badge.innerHTML = voice
      ? `🔊 AI Help Voice: <b>${escapeHtml(voice.name)}</b> <span style="opacity:.8">(${escapeHtml(voice.lang)})</span>`
      : '🔊 AI Help Voice: browser default';

    badge.style.display = 'block';

    clearTimeout(badge._t);
    badge._t = setTimeout(function () {
      badge.style.display = 'none';
    }, 3800);
  }

  function escapeHtml(s) {
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

  function createPickerPanel() {
    if (document.getElementById(PANEL_ID)) return;

    const panel = document.createElement('details');
    panel.id = PANEL_ID;
    panel.open = false;

    panel.style.cssText = [
      'position:fixed',
      'right:10px',
      'bottom:142px',
      'z-index:999997',
      'width:min(430px,calc(100vw - 20px))',
      'background:rgba(7,18,34,.96)',
      'color:#eaffff',
      'border:1px solid rgba(105,232,255,.38)',
      'border-radius:18px',
      'box-shadow:0 18px 48px rgba(0,0,0,.36)',
      'font:800 13px/1.45 system-ui,-apple-system,Segoe UI,sans-serif',
      'overflow:hidden'
    ].join(';');

    panel.innerHTML = `
      <summary style="cursor:pointer;padding:11px 13px;color:#75eeff;font-weight:1000;">
        🔊 เลือกเสียง AI Help
      </summary>

      <div style="padding:0 13px 13px;">
        <div style="font-size:12px;opacity:.82;margin:2px 0 8px;">
          เลือกเสียง English ที่เครื่องนี้มีให้ใช้ — เสียง US จะอยู่ด้านบน
        </div>

        <select id="lessonAiHelpVoiceSelect"
          style="
            width:100%;
            min-height:42px;
            border-radius:14px;
            border:1px solid rgba(105,232,255,.35);
            background:rgba(255,255,255,.10);
            color:#eaffff;
            padding:0 10px;
            font-weight:900;
            outline:none;
          ">
          <option value="">Loading voices...</option>
        </select>

        <div style="display:flex;gap:8px;margin-top:10px;">
          <button id="lessonAiHelpVoiceTest" type="button"
            style="flex:1;height:40px;border:0;border-radius:999px;background:#65e8ff;color:#06202a;font-weight:1000;">
            Test Voice
          </button>

          <button id="lessonAiHelpVoiceRefresh" type="button"
            style="width:92px;height:40px;border:1px solid rgba(105,232,255,.32);border-radius:999px;background:rgba(255,255,255,.10);color:#eaffff;font-weight:1000;">
            Refresh
          </button>
        </div>

        <div id="lessonAiHelpVoiceNote" style="font-size:12px;opacity:.78;margin-top:8px;"></div>
      </div>
    `;

    document.body.appendChild(panel);

    document.getElementById('lessonAiHelpVoiceTest').addEventListener('click', function () {
      speakWithSelectedVoice('Hello. This is the selected voice for AI Help.');
    });

    document.getElementById('lessonAiHelpVoiceRefresh').addEventListener('click', function () {
      populatePicker();
    });

    document.getElementById('lessonAiHelpVoiceSelect').addEventListener('change', function () {
      selectedVoiceURI = this.value;
      localStorage.setItem(STORAGE_KEY, selectedVoiceURI);
      populatePicker();
      speakWithSelectedVoice('Voice selected. I will use this voice for AI Help.');
    });
  }

  function populatePicker() {
    const select = document.getElementById('lessonAiHelpVoiceSelect');
    const note = document.getElementById('lessonAiHelpVoiceNote');
    if (!select) return;

    const voices = sortVoices(getVoices());

    if (!voices.length) {
      select.innerHTML = `<option value="">No English voice found yet</option>`;
      if (note) {
        note.innerHTML = 'ถ้ายังไม่ขึ้น ให้กด Refresh หรือเปิดหน้านี้ใหม่อีกครั้ง บาง browser โหลด voice ช้า';
      }
      return;
    }

    const selected = getSelectedVoice();
    const selectedURI = selected ? selected.voiceURI : '';

    select.innerHTML = voices.map(function (v) {
      const usTag = isUS(v) ? '🇺🇸 US • ' : 'EN • ';
      const value = escapeHtml(v.voiceURI || v.name);
      const label = escapeHtml(`${usTag}${v.name} (${v.lang})`);
      const isSel = (v.voiceURI === selectedURI || v.name === selectedVoiceURI) ? 'selected' : '';
      return `<option value="${value}" ${isSel}>${label}</option>`;
    }).join('');

    if (selected && !selectedVoiceURI) {
      selectedVoiceURI = selected.voiceURI || selected.name;
      localStorage.setItem(STORAGE_KEY, selectedVoiceURI);
    }

    if (note) {
      const usCount = voices.filter(isUS).length;
      note.innerHTML = usCount
        ? `พบเสียง US/คล้าย US: <b>${usCount}</b> เสียง`
        : `⚠️ เครื่องนี้ยังไม่พบเสียง US จริง อาจได้สำเนียง English แบบอื่น`;
    }
  }

  function exposeGlobals() {
    window.LessonVoicePicker = {
      speak: speakWithSelectedVoice,
      getSelectedVoice,
      refresh: populatePicker,
      open: function () {
        createPickerPanel();
        populatePicker();
        const panel = document.getElementById(PANEL_ID);
        if (panel) panel.open = true;
      }
    };

    // override ให้ AI Help ใช้เสียงที่เลือก
    window.speakAIHelpUS = speakWithSelectedVoice;

    if (!window.LessonUSVoice) window.LessonUSVoice = {};
    window.LessonUSVoice.speak = speakWithSelectedVoice;
    window.LessonUSVoice.getSelectedVoice = getSelectedVoice;
    window.LessonUSVoice.openVoicePicker = function () {
      window.LessonVoicePicker.open();
    };
  }

  function init() {
    createPickerPanel();
    exposeGlobals();
    populatePicker();

    if (window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = function () {
        populatePicker();
      };
    }

    let tries = 0;
    const timer = setInterval(function () {
      tries += 1;
      populatePicker();
      exposeGlobals();

      if (getVoices().length || tries >= 20) {
        clearInterval(timer);
      }
    }, 300);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
